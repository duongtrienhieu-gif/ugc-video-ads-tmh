// ── Master Frame Job Runner ──────────────────────────────────────────────────
// Production-grade async pipeline: caller invokes startMasterFrameJob() and
// receives a jobId IMMEDIATELY. The actual pipeline runs as a detached promise
// that updates masterFrameJobStore as it progresses through phases.
//
// PHASES (in order):
//   queued → extracting_identity → generating → auto_validating
//                                              ├ pass → completed
//                                              └ fail → retrying_1 → … → retrying_3 → completed
//
// Each phase persists its progress to the store (and thus localStorage) so:
//   • UI updates reactively
//   • Refresh recovers the job
//   • Intermediate images are auto-saved to asset store (per spec)
//
// Pre-Gemini heuristic check skips expensive QC for obviously-bad outputs.
//
// SAFETY: max 12-minute total duration. Hard timeout returns structured failure.
// ─────────────────────────────────────────────────────────────────────────────

import { useMasterFrameJobStore } from '../stores/masterFrameJobStore'
import { compileMasterFramePrompt } from './promptCompiler'
import { compileMasterFrameRenderPayload } from './renderPayloadCompiler'
import type { RenderMode } from './renderPayloadCompiler'
import { generateGpt4oImageFast } from '../../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import { directGeminiVision } from '../../../../utils/gemini'
import { qcImage } from './qcEngine'
import { heuristicCheck } from './qcHeuristic'
import { computeConsistencyConfig, computeQcThresholds, defaultVisualStyleDna } from '../types'
import type {
  MasterFrameJobInputs,
  MasterFrameJobAttempt,
  MasterFrameJobStatus,
  SectionOverrides,
  FailureClassification,
  IdentityPack,
  QcScore,
  CompiledPrompt,
} from '../types'

// Z16: shorter hard limit since Fast mode tops out at ~130s per gen call.
// Old 12min ceiling was way over user target of 30-60s.
const MAX_JOB_DURATION_MS = 3 * 60 * 1000   // 3-min hard ceiling (was 12min)
const MAX_RETRIES = 3
const PER_ATTEMPT_TIMEOUT_MS = 60_000        // per KIE submission, 2 submissions per QC attempt
const SOFT_TIMEOUT_MS = 45_000               // Z18 — soft-timeout warning threshold

// Z16: track the active AbortController so cancelMasterFrameJob() can
// signal the KIE poll loop instead of letting it run to its own timeout.
let activeJobAbort: AbortController | null = null

// ─────────────────────────────────────────────────────────────────────────
// Z18 → Z19 — Promptweight simplification superseded by renderPayloadCompiler.
//
// The old simplifyMasterFramePromptForRetry() did regex-strip surgery on
// the rich prompt. Z19 replaces it with a proper mode-aware compiler
// (compileMasterFrameRenderPayload) that knows about FAST_SAFE / BALANCED
// / CINEMATIC_HEAVY modes + per-model budget + priority-order trimming.
//
// The mode escalation lives at the call site (search for "mode escalation"
// below).
// ─────────────────────────────────────────────────────────────────────────

// ── Identity describe Gemini prompts (lifted from masterFrame.ts) ────────────

const AVATAR_DESCRIBE = `Describe this person's face and identifying features in 2-3 SHORT sentences for an image-generation identity anchor: gender, age range, ethnicity, skin tone, face shape, eye color, hijab/hair, facial hair, outfit, accessories. Output: flowing sentences, no preamble, no markdown.`

const PRODUCT_DESCRIBE = `Describe this product as a SINGLE precise sentence (max 50 words) for an image-gen anchor. MUST include: container TYPE (jar/bottle/tube/sachet/box/blister/spray/pump), proportions (squat vs tall), primary color + cap color, material, label color + brand text, size relative to hand. Output: only the description, no preamble.`

async function imageUrlToBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    if (url.startsWith('data:')) {
      const m = url.match(/^data:([^;]+);base64,(.+)$/)
      return m ? { mimeType: m[1], base64: m[2] } : null
    }
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const mimeType = blob.type || 'image/jpeg'
    const buf = await blob.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return { base64: btoa(binary), mimeType }
  } catch { return null }
}

async function describeViaGemini(imageUrl: string, prompt: string, geminiKey: string): Promise<string> {
  const img = await imageUrlToBase64(imageUrl)
  if (!img) return ''
  const response = await directGeminiVision({
    apiKey: geminiKey,
    parts: [
      { inlineData: { mimeType: img.mimeType, data: img.base64 } },
      { text: prompt },
    ],
    maxOutputTokens: 350,
    model: 'gemini-2.5-flash',
  })
  return response.trim().replace(/^["']|["']$/g, '')
}

// ── Smart retry: failure → which lock to bump ────────────────────────────────

function bumpsForFailure(c: FailureClassification): SectionOverrides {
  switch (c) {
    case 'wrong-product':
    case 'redesigned-packaging':
      return { bumpProductLock: true }
    case 'wrong-label':
      return { bumpProductLock: true, bumpLabelLock: true }
    case 'wrong-hijab':
    case 'wrong-ethnicity':
    case 'wrong-age':
      return { bumpIdentityLock: true }
    case 'studio-look':
    case 'cinematic-lighting':
    case 'stock-photo-vibe':
    case 'plastic-skin':
    case 'fake-hands':
      return { bumpRealism: true }
    case 'multiple-issues':
      return { bumpProductLock: true, bumpIdentityLock: true, bumpRealism: true, bumpLabelLock: true }
    default:
      return {}
  }
}

function mergeOverrides(a: SectionOverrides, b: SectionOverrides): SectionOverrides {
  return {
    bumpProductLock: a.bumpProductLock || b.bumpProductLock,
    bumpIdentityLock: a.bumpIdentityLock || b.bumpIdentityLock,
    bumpRealism: a.bumpRealism || b.bumpRealism,
    bumpLabelLock: a.bumpLabelLock || b.bumpLabelLock,
  }
}

const RETRY_STATUS: MasterFrameJobStatus[] = ['retrying_1', 'retrying_2', 'retrying_3']

// ── Job runner orchestration ─────────────────────────────────────────────────

export interface StartJobParams {
  kieApiKey: string
  geminiKey: string
  inputs: MasterFrameJobInputs
}

/** Returns jobId. The pipeline runs as a detached promise in background. */
export function startMasterFrameJob(params: StartJobParams): string {
  const store = useMasterFrameJobStore.getState()
  const jobId = `mfj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  store.createJob({
    jobId,
    status: 'queued',
    inputs: params.inputs,
  })

  // Detached promise — caller does NOT await
  runJobPipeline(jobId, params).catch((err) => {
    console.error('[masterFrameJobRunner] uncaught error:', err)
    finalizeFailure(jobId, 'unknown', err instanceof Error ? err.message : String(err))
  })

  return jobId
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function getJob() {
  return useMasterFrameJobStore.getState().job
}

function finalizeFailure(_jobId: string, failureType: 'timeout' | 'api_error' | 'qc_unrecoverable' | 'cancelled' | 'unknown', message: string): void {
  const store = useMasterFrameJobStore.getState()
  const cur = store.job
  if (!cur) return
  store.updateJob({
    status: 'failed',
    failure: {
      failureType,
      message,
      lastScores: cur.attempts.at(-1)?.qc ?? undefined,
      retryHistory: cur.attempts.map((a) => ({
        attemptIdx: a.attemptIdx,
        classification: a.qc?.classification,
        failureReasons: a.qc?.failureReasons,
      })),
    },
  })
}

async function persistImage(remoteUrl: string): Promise<string> {
  if (isAssetRef(remoteUrl)) return remoteUrl
  const fetchRes = await fetch(remoteUrl)
  const blob = await fetchRes.blob()
  const assetId = await saveAsset(blob, blob.type || 'image/png')
  const resolved = await getUrl(assetId)
  return resolved ?? assetId
}

// ── Main pipeline ────────────────────────────────────────────────────────────

async function runJobPipeline(_jobId: string, params: StartJobParams): Promise<void> {
  const store = useMasterFrameJobStore.getState()
  const startedAt = Date.now()
  const inputs = params.inputs
  const consistency = computeConsistencyConfig(inputs.consistencyStrength)
  const dna = defaultVisualStyleDna()
  const thresholds = computeQcThresholds(inputs.consistencyStrength)

  // Z16: fresh AbortController per job so cancel signal reaches the KIE poll.
  activeJobAbort = new AbortController()
  const jobAbortSignal = activeJobAbort.signal
  console.log(`[masterFrame START] jobId=${_jobId} qcEnabled=${inputs.qcEnabled} target=30-60s`)

  // Global watchdog — hard timeout. On fire, ALSO abort the KIE poll so the
  // pipeline doesn't keep running after the watchdog triggers.
  const watchdog = setTimeout(() => {
    if (getJob()?.status !== 'completed' && getJob()?.status !== 'failed' && getJob()?.status !== 'cancelled') {
      console.error(`[masterFrame WATCHDOG] hit ${Math.round(MAX_JOB_DURATION_MS / 1000)}s — aborting`)
      activeJobAbort?.abort()
      finalizeFailure(_jobId, 'timeout', `Job vượt giới hạn ${Math.round(MAX_JOB_DURATION_MS / 1000)}s — KIE backend có thể bị stuck`)
    }
  }, MAX_JOB_DURATION_MS)

  try {
    // ── Phase 1: extracting_identity ────────────────────────────────────────
    store.setStatus('extracting_identity')
    const [avatarDesc, productDesc] = await Promise.all([
      describeViaGemini(inputs.avatarImageUrl, AVATAR_DESCRIBE, params.geminiKey),
      describeViaGemini(inputs.productImageUrl, PRODUCT_DESCRIBE, params.geminiKey),
    ])
    if (cancelledCheck()) return
    const identity: IdentityPack = {
      avatarDescription: avatarDesc,
      productDescription: productDesc,
      avatarImageUrl: inputs.avatarImageUrl,
      productImageUrl: inputs.productImageUrl,
    }
    store.setIdentity(identity)

    // ── Retry loop: generating → auto_validating → (retry or finalize) ─────
    let overrides: SectionOverrides = {}
    let lastCompiled: CompiledPrompt | null = null
    const acceptedAttempts: MasterFrameJobAttempt[] = []

    for (let attemptIdx = 0; attemptIdx <= MAX_RETRIES; attemptIdx++) {
      if (cancelledCheck()) return

      // Pick the right status for this attempt
      const genStatus: MasterFrameJobStatus = attemptIdx === 0 ? 'generating' : RETRY_STATUS[attemptIdx - 1]
      store.setStatus(genStatus)

      const attempt: MasterFrameJobAttempt = {
        attemptIdx,
        imageUrl: null,
        startedAt: Date.now(),
      }
      store.addAttempt(attempt)

      // Compile + submit
      const compiled = compileMasterFramePrompt({
        identity,
        productName: inputs.productName,
        consistency,
        dna,
        overrides,
      })
      lastCompiled = compiled

      const filesUrl: string[] = []
      for (const role of compiled.filesUrlOrder) {
        if (role === 'product') filesUrl.push(identity.productImageUrl)
        if (role === 'avatar')  filesUrl.push(identity.avatarImageUrl)
      }
      if (overrides.bumpProductLock && filesUrl.length > 1) {
        filesUrl.unshift(identity.productImageUrl)
      }

      // Z19: Pick the render mode based on outer QC retry index.
      //   Outer QC attempt 0  → start with BALANCED (cinematic cues kept)
      //   Outer QC attempt 1+ → start with FAST_SAFE (strip everything decorative)
      // Inner Fast wrapper retry (attempt 2) ALWAYS downshifts to FAST_SAFE.
      const startMode: RenderMode = attemptIdx === 0 ? 'BALANCED' : 'FAST_SAFE'

      let remoteUrl: string
      try {
        // Z16+Z18+Z19: Fast wrapper with mode-aware lightweight payload.
        // Per-attempt timeline:
        //   Inner 1: startMode (BALANCED on qcAttempt 0, FAST_SAFE on retry)
        //   Inner 2: FAST_SAFE (forced — recovery from stuck attempt)
        // renderPayloadCompiler enforces 600-850 char budget + strips
        // cinematic extras + emits [RENDER_PAYLOAD] log.
        remoteUrl = await generateGpt4oImageFast({
          apiKey: params.kieApiKey,
          prompt: (innerAttempt) => {
            const mode: RenderMode = innerAttempt === 1 ? startMode : 'FAST_SAFE'
            const payload = compileMasterFrameRenderPayload(
              { identity, productName: inputs.productName, consistency, dna, overrides },
              { mode, targetModel: 'gpt4o' },
            )
            return payload.prompt
          },
          filesUrl: filesUrl.slice(0, 5),
          size: '2:3',
          attemptTimeoutMs: PER_ATTEMPT_TIMEOUT_MS,
          softTimeoutMs: SOFT_TIMEOUT_MS,
          maxAttempts: 2,
          signal: jobAbortSignal,
          onAttemptChange: (a, t) => {
            const mode: RenderMode = a === 1 ? startMode : 'FAST_SAFE'
            console.log(`[masterFrame] QC attempt ${attemptIdx + 1} → KIE submit ${a}/${t} mode=${mode}`)
          },
        })
      } catch (err) {
        const msg = (err as Error).message
        if (msg.includes('CANCELLED')) {
          console.log('[masterFrame] cancelled mid-gen')
          return
        }
        finalizeFailure(_jobId, 'api_error', `KIE GPT-4o lỗi attempt ${attemptIdx + 1}: ${msg}`)
        return
      }
      if (cancelledCheck()) return

      // Auto-save intermediate (per spec: save every successful gen immediately)
      const storedUrl = await persistImage(remoteUrl)
      store.patchLastAttempt({ imageUrl: storedUrl })

      // ── auto_validating phase: heuristic + Gemini QC ─────────────────────
      if (!inputs.qcEnabled) {
        // QC disabled: accept as-is
        acceptedAttempts.push({ ...attempt, imageUrl: storedUrl, finishedAt: Date.now() })
        store.finalize({ imageUrl: storedUrl, qc: null, compiled })
        return
      }

      store.setStatus('auto_validating')

      // OPTIMIZATION: heuristic pre-check — skip Gemini QC if obviously broken
      const heuristic = await heuristicCheck(storedUrl)
      let qc: QcScore | null = null

      if (!heuristic.plausible) {
        // Treat as fail without calling Gemini (saves $$ + ~5s)
        console.warn(`[job-runner] attempt ${attemptIdx} heuristic-fail: ${heuristic.reason}`)
        qc = {
          passed: false,
          retryCount: attemptIdx,
          faceScore: 0,
          productScore: 0,
          ocrScore: 0,
          realismScore: 0,
          failureReasons: [`heuristic: ${heuristic.reason ?? 'unknown'}`],
          classification: 'multiple-issues',
          recommendation: 'Image failed cheap heuristic check; retry with all locks bumped',
          notes: 'Ảnh ra rỗng/đen hoặc lỗi — auto-retry',
        }
      } else {
        // Run real Gemini QC
        try {
          qc = await qcImage({
            geminiKey: params.geminiKey,
            generatedImageUrl: storedUrl,
            avatarImageUrl: identity.avatarImageUrl,
            productImageUrl: identity.productImageUrl,
            retryCount: attemptIdx,
            thresholds,
          })
        } catch (err) {
          console.warn(`[job-runner] QC error attempt ${attemptIdx}:`, err)
          // QC failure = treat image as still candidate but unscored — don't retry just for this
          break
        }
      }

      store.patchLastAttempt({ qc, finishedAt: Date.now() })
      acceptedAttempts.push({ ...attempt, imageUrl: storedUrl, qc, finishedAt: Date.now() })

      // Pass → finalize and exit
      if (qc.passed) {
        store.finalize({ imageUrl: storedUrl, qc, compiled })
        return
      }

      // Fail and out of retries → finalize best-of-N
      if (attemptIdx === MAX_RETRIES) break

      // Otherwise smart-retry
      const newBumps = bumpsForFailure(qc.classification)
      overrides = mergeOverrides(overrides, newBumps)
    }

    // Retry budget exhausted — pick best-scoring attempt and finalize
    if (acceptedAttempts.length === 0) {
      finalizeFailure(_jobId, 'qc_unrecoverable', 'Không có attempt nào hoàn thành')
      return
    }
    const scoreAttempt = (a: MasterFrameJobAttempt): number => {
      const s = a.qc
      if (!s) return 0
      return s.productScore * 3 + s.faceScore * 2 + s.realismScore * 1.5 + s.ocrScore * 1
    }
    const best = acceptedAttempts.reduce((a, b) => (scoreAttempt(b) > scoreAttempt(a) ? b : a))
    store.finalize({
      imageUrl: best.imageUrl!,
      qc: best.qc ?? null,
      compiled: lastCompiled ?? null,
    })
  } finally {
    clearTimeout(watchdog)
    // Z16: release the abort controller so the next job can start clean
    activeJobAbort = null
    console.log(`[masterFrame END] +${Math.round((Date.now() - startedAt) / 1000)}s status=${getJob()?.status}`)
  }
}

/** Check if the user cancelled the job — store.status changes to 'cancelled' */
function cancelledCheck(): boolean {
  return getJob()?.status === 'cancelled'
}

/** Cancel the active job — Z16 now ALSO aborts the KIE poll loop so the
 *  network request actually stops instead of running to its own timeout. */
export function cancelMasterFrameJob(): void {
  const store = useMasterFrameJobStore.getState()
  const cur = store.job
  if (!cur || cur.status === 'completed' || cur.status === 'failed') return
  store.updateJob({ status: 'cancelled' })
  // Z16: signal the AbortController so generateGpt4oImageFast bails immediately
  if (activeJobAbort) {
    console.log('[masterFrame] user cancel → aborting KIE poll')
    activeJobAbort.abort()
    activeJobAbort = null
  }
}

/** Reset to start fresh — clears any active or finished job. */
export function clearMasterFrameJob(): void {
  useMasterFrameJobStore.getState().clearJob()
}
