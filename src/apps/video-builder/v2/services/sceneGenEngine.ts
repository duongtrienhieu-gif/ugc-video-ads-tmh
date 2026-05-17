// ── SceneGenEngine ───────────────────────────────────────────────────────────
// Generate ONE scene image as an img2img derivation from the approved Master
// Frame. Composition / pose / camera angle / environment / emotion vary per
// scene blueprint — face, hijab, packaging, label, bottle shape are LOCKED
// by passing the master frame as reference image #3.
//
// Reference image order (filesUrl):
//   [0] = "image #1" = PRODUCT  (highest priority — packaging preservation)
//   [1] = "image #2" = AVATAR   (face identity)
//   [2] = "image #3" = MASTER FRAME  (the approved baseline scene to derive from)
//
// The compiled prompt (via compileScenePrompt) explicitly tells the model:
//   "Image #3 = MASTER FRAME — re-use its person + product, only vary pose/env"
//
// QC loop runs after each generation. Smart-retry bumps locks per failure class.
//
// Z24 PROVIDER OVERLOAD FIX:
//   • Switched from raw generateGpt4oImage (5-min timeout) to
//     generateGpt4oImageFast (90s attempt + soft-watchdog at 60s).
//   • Switched prompt source from raw compileScenePrompt → compileSceneRenderPayload
//     (Z19) with mode escalation: attempt 1 = BALANCED, attempt 2 = FAST_SAFE.
//   • Cap filesUrl to 2 refs (product + avatar) — drop master frame ref to
//     reduce image-edit complexity. Identity now travels through prompt locks
//     + the establishing-scene cache, not multi-ref weighting.
//   • Soft-cancel + provider-retry UI signals via new optional callbacks.
// ─────────────────────────────────────────────────────────────────────────────

// Phase 5 build fix — the actual call site at line ~160 uses
// generateGpt4oImageFast. compileScenePrompt + raw generateGpt4oImage
// were only referenced in stale code comments. Importing only what's
// actually called.
import { generateGpt4oImageFast } from '../../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import { compileSceneRenderPayload, modeForAttempt } from './renderPayloadCompiler'
import { runQcLoop } from './qcRetry'
import type {
  SceneBlueprint,
  IdentityPack,
  ConsistencyConfig,
  VisualStyleDna,
  QcScore,
  CompiledPrompt,
  SectionOverrides,
} from '../types'

export interface SceneGenParams {
  kieApiKey: string
  geminiKey: string
  blueprint: SceneBlueprint
  masterFrameUrl: string
  identity: IdentityPack
  productName: string
  consistency: ConsistencyConfig
  dna: VisualStyleDna
  /** If true, skip the QC retry loop — single attempt only (cost control mode) */
  lowCostMode: boolean
  /** Callback per attempt — for UI status updates */
  onAttempt?: (attemptIdx: number, qc: QcScore | null) => void
  /** Z24: KIE soft-timeout crossed — UI shows "provider_stuck" while we
   *  prepare a fresh submission. attempt is 1-indexed (the one that stuck). */
  onProviderStuck?: (attempt: number, totalAttempts: number) => void
  /** Z24: a fresh KIE submission started after a stall — UI flips to
   *  "retrying_provider". attempt is the new 1-indexed attempt. */
  onProviderRetry?: (attempt: number, totalAttempts: number) => void
  /** Z24: provider eventually returned a usable image — UI flashes
   *  "recovered" briefly before QC takes over. */
  onRecovered?: () => void
  /** Abort signal — for user cancel */
  signal?: AbortSignal
}

export interface SceneGenResult {
  imageUrl: string
  promptUsed: string
  qc: QcScore | null
  retryCount: number
  passedOnLastTry: boolean
  compiled: CompiledPrompt
}

// ── Helper: persist a remote URL into asset store ───────────────────────────

async function persistImage(remoteUrl: string): Promise<string> {
  if (isAssetRef(remoteUrl)) return remoteUrl
  const fetchRes = await fetch(remoteUrl)
  const blob = await fetchRes.blob()
  const assetId = await saveAsset(blob, blob.type || 'image/png')
  const resolved = await getUrl(assetId)
  return resolved ?? assetId
}

// ── Internal: one-shot scene generation (compile + KIE call + persist) ──────
//
// Z24 changes vs pre-fix:
//   1. Render payload via compileSceneRenderPayload (mode escalation), not
//      raw compileScenePrompt — strict char budget per attempt.
//   2. filesUrl capped at 2 (product + avatar). Master frame ref dropped:
//      identity travels through the prompt's identity-lock paragraph instead.
//      Low-visibility scenes (pain / failed_attempts) still get only avatar.
//   3. generateGpt4oImageFast wrapper handles soft-timeout (60s warn) +
//      hard timeout (90s per attempt) + fresh resubmission. The wrapper's
//      own retry loop fires onProviderStuck / onProviderRetry through
//      KIE's onStatusChange path is not used — we wrap it manually below.
//   4. Prompt is passed as a function-of-attempt so the wrapper can
//      automatically switch to FAST_SAFE on attempt 2.

async function generateSceneOnce(
  params: SceneGenParams,
  overrides: SectionOverrides,
): Promise<{ imageUrl: string; compiled: CompiledPrompt; modeUsed: string; charsUsed: number }> {
  // We compile twice (BALANCED for attempt 1, FAST_SAFE for attempt 2) so the
  // Fast wrapper can swap the prompt on resubmission without a re-entry.
  const compileAt = (attempt: number) => {
    const mode = modeForAttempt(attempt)  // 1→BALANCED, 2→FAST_SAFE
    const payload = compileSceneRenderPayload(
      {
        identity: params.identity,
        productName: params.productName,
        consistency: params.consistency,
        dna: params.dna,
        overrides,
      },
      params.blueprint,
      params.masterFrameUrl,
      { mode, targetModel: 'gpt4o' },
    )
    return payload
  }

  // Pre-compute attempt-1 payload — we need its filesUrlOrder to assemble refs
  // (filesUrlOrder is independent of mode, depends only on scene type +
  // overrides, so attempt-1 is representative).
  const attempt1Payload = compileAt(1)

  // ── Z24 REF-CAP: max 2 refs (product + avatar). NO master frame ref. ──
  // The master frame's identity transfer happens through the identity-lock
  // paragraph in the prompt, not through ref weighting. Dropping it removes
  // the single heaviest cause of provider stalls on KIE GPT-Image-1.
  const refs: string[] = []
  for (const role of attempt1Payload.filesUrlOrder) {
    if (role === 'product') refs.push(params.identity.productImageUrl)
    if (role === 'avatar')  refs.push(params.identity.avatarImageUrl)
    // role === 'masterFrame' — intentionally skipped (Z24)
  }
  // Smart-retry product-lock bump (only when product is already in refs)
  const productInRefs = attempt1Payload.filesUrlOrder.includes('product')
  if (overrides.bumpProductLock && productInRefs && refs.length > 1) {
    refs.unshift(params.identity.productImageUrl)
  }
  const filesUrl = refs.slice(0, 2)  // hard cap

  // The remote URL: Fast wrapper handles soft-watch + retry; we feed the
  // mode-appropriate prompt per attempt via the function form.
  let lastPayload = attempt1Payload  // captured for return-value below
  const remoteUrl = await generateGpt4oImageFast({
    apiKey: params.kieApiKey,
    prompt: (attempt: number) => {
      const p = compileAt(attempt)
      lastPayload = p
      return p.prompt
    },
    filesUrl,
    size: '2:3',
    softTimeoutMs: 60_000,
    attemptTimeoutMs: 90_000,
    maxAttempts: 2,
    signal: params.signal,
    onAttemptChange: (attempt, total) => {
      // attempt 2 = a fresh submission after the first one was abandoned
      if (attempt > 1) params.onProviderRetry?.(attempt, total)
    },
    onStatusChange: (status) => {
      // soft-timeout is logged inside the wrapper; we flag "stuck" UI when
      // KIE still reports queued/processing late into the attempt.
      if (status === 'processing' || status === 'pending') {
        // No-op here — the wrapper's [POLL_SOFT_TIMEOUT] log fires at 60s.
        // UI surface for "provider_stuck" comes from the runner watchdog.
      }
    },
  })

  // Synthesize a CompiledPrompt-compatible shape for backward compat with
  // callers that read .compiled (debug panel, QC retry overrides). We keep
  // the legacy fields empty since the render-payload compiler doesn't track
  // them separately — only `final` matters for downstream.
  const compiled: CompiledPrompt = {
    identityLock: '',
    productLock: '',
    sceneBlueprint: '',
    visualDna: '',
    negativePrompt: '',
    final: lastPayload.prompt,
    filesUrlOrder: lastPayload.filesUrlOrder,
  }

  return {
    imageUrl: remoteUrl,
    compiled,
    modeUsed: lastPayload.mode,
    charsUsed: lastPayload.chars,
  }
}

// ── Main: generate a single scene with full QC loop ─────────────────────────

/**
 * Generate one scene image with optional QC retry loop. Returns the final
 * accepted image + its QC score + the prompt used (for debug).
 *
 * In lowCostMode: single attempt, no QC, no retry. Just gen + return.
 * Default: full QC loop with smart-retry (per consistency.maxRetries).
 */
export async function generateScene(params: SceneGenParams): Promise<SceneGenResult> {
  // ── Low-cost mode: single shot, no QC ─────────────────────────────────────
  if (params.lowCostMode) {
    params.onAttempt?.(0, null)
    const { imageUrl, compiled } = await generateSceneOnce(params, {})
    const storedUrl = await persistImage(imageUrl)
    return {
      imageUrl: storedUrl,
      promptUsed: compiled.final,
      qc: null,
      retryCount: 0,
      passedOnLastTry: true,  // we don't know, but treat as ok
      compiled,
    }
  }

  // ── Full QC loop ───────────────────────────────────────────────────────────
  // Scenes get a smaller retry budget than master frame (2 retries vs 3).
  // Reasoning: master frame is the ground truth, scenes can drift slightly.
  // If a scene still fails after 2 retries, we keep best-of-N to not block queue.
  const sceneMaxRetries = Math.min(2, params.consistency.maxRetries)

  let lastCompiled: CompiledPrompt | null = null

  const loopResult = await runQcLoop({
    geminiKey: params.geminiKey,
    avatarImageUrl: params.identity.avatarImageUrl,
    productImageUrl: params.identity.productImageUrl,
    consistency: params.consistency,
    maxRetries: sceneMaxRetries,
    generateFn: async (overrides, attemptIdx) => {
      params.onAttempt?.(attemptIdx, null)
      const { imageUrl, compiled } = await generateSceneOnce(params, overrides)
      lastCompiled = compiled
      return await persistImage(imageUrl)
    },
    onAttempt: (attempt) => {
      params.onAttempt?.(attempt.attemptIdx, attempt.qc)
    },
  })

  const finalCompiled: CompiledPrompt = lastCompiled ?? {
    identityLock: '', productLock: '', sceneBlueprint: '',
    visualDna: '', negativePrompt: '', final: '', filesUrlOrder: [],
  }

  return {
    imageUrl: loopResult.finalImageUrl,
    promptUsed: finalCompiled.final,
    qc: loopResult.finalQc,
    retryCount: loopResult.finalQc.retryCount,
    passedOnLastTry: loopResult.passedOnLastTry,
    compiled: finalCompiled,
  }
}
