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
// ─────────────────────────────────────────────────────────────────────────────

import { generateGpt4oImage } from '../../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import { compileScenePrompt } from './promptCompiler'
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

async function generateSceneOnce(
  params: SceneGenParams,
  overrides: SectionOverrides,
): Promise<{ imageUrl: string; compiled: CompiledPrompt }> {
  // Compile the scene prompt — passes master frame URL as 3rd reference
  const compiled = compileScenePrompt(
    {
      identity: params.identity,
      productName: params.productName,
      consistency: params.consistency,
      dna: params.dna,
      overrides,
    },
    params.blueprint,
    params.masterFrameUrl,
  )

  // Build filesUrl array matching the compiled prompt's reference indices
  const filesUrl: string[] = []
  for (const role of compiled.filesUrlOrder) {
    if (role === 'product')     filesUrl.push(params.identity.productImageUrl)
    if (role === 'avatar')      filesUrl.push(params.identity.avatarImageUrl)
    if (role === 'masterFrame') filesUrl.push(params.masterFrameUrl)
  }

  // Smart-retry duplicates the product ref for stronger weighting
  if (overrides.bumpProductLock && filesUrl.length > 1) {
    filesUrl.unshift(params.identity.productImageUrl)
  }

  // KIE supports max 5 filesUrl — truncate
  const remoteUrl = await generateGpt4oImage({
    apiKey: params.kieApiKey,
    prompt: compiled.final,
    filesUrl: filesUrl.slice(0, 5),
    size: '2:3',  // vertical-ish (gpt4o only supports 1:1/3:2/2:3)
    timeoutMs: 5 * 60 * 1000,
    signal: params.signal,
  })

  return { imageUrl: remoteUrl, compiled }
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
