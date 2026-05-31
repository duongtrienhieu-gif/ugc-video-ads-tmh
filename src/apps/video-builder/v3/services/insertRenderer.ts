// ── Insert Renderer ──────────────────────────────────────────────────────────
// Z33 §10/13/14 — Per-insert render pipeline. Preview-first, low-motion,
// product-locked.
//
// Pipeline (3 stages — simpler than Phase 3 creator video):
//   1. KEYFRAME  — KIE GPT-4o image-edit produces the still with avatar
//                  + product references. Identity + product locks
//                  applied via promptBuilder.
//   2. PREVIEW   — 1s motion test at TEST_480. Cheap pre-flight check.
//                  Fails-soft (skip if too unstable).
//   3. VIDEO_FULL — KIE Kling image-to-video full insert (5s minimum,
//                   trimmed by compositor to durationPreset).
//
// Single-cut runner. Caller invokes one per insert (no bulk runner — that's
// the Z26 lesson: bulk burns credit). The ActionInsertsPhase UI provides
// per-card render + bulk-pending button which fans out via this function.
// ─────────────────────────────────────────────────────────────────────────────

import {
  generateGpt4oImageFast,
  generateVideoJob, pollVideoJobUntilDone,
} from '../../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import type { Model, Product } from '../../../../stores/types'
import type {
  ActionInsertClip, InsertRenderStage, ActionPresetId,
} from '../types'
import { ACTION_PRESETS } from './actionPresets'

// ── Stage update callback ─────────────────────────────────────────────────

export interface InsertStageUpdate {
  stage: InsertRenderStage
  keyframeRef?: string
  keyframePromptUsed?: string
  previewVideoRef?: string
  fullTaskId?: string
  videoRef?: string
  error?: string
}

export interface RenderInsertParams {
  kieApiKey: string
  presetId: ActionPresetId
  /** Product is required for needsProduct presets; null OK for scene-only
   *  presets like PHONE_SCROLL or BEFORE_AFTER_REACTION. */
  product: Product | null
  /** Avatar ref — used when the insert features the speaker (e.g. DRINK,
   *  TAKE_PILL, BEFORE_AFTER_REACTION). For product-only inserts (e.g.
   *  PRODUCT_CLOSEUP, DESK_PRODUCT) the avatar ref is optional. */
  avatar: Model | null
  /** Chain anchor — the Phase 3 creator video's generated keyframe (the
   *  person already placed in the real scene + wardrobe + lighting). When
   *  present, inserts that feature the person anchor their identity to THIS
   *  frame instead of the raw avatar bank portrait, so the insert person
   *  matches the talking-head creator (no outfit / lighting / look jump). */
  creatorKeyframeRef?: string
  /** Resolution to render at — driven by cost mode */
  resolution: '480p' | '720p' | '1080p'
  /** Skip the cheap preview-motion test (Stage 2). Default false. */
  skipPreview?: boolean
  /** Z37 — free visual prompt for a CONCEPT_SCENE insert (no product on
   *  screen). Required when presetId === 'CONCEPT_SCENE'; ignored otherwise. */
  conceptPrompt?: string
  /** Per-stage status callback */
  onStageUpdate: (update: InsertStageUpdate) => void
  signal?: AbortSignal
}

export interface RenderInsertResult {
  keyframeRef: string
  keyframePromptUsed: string
  previewVideoRef?: string
  videoRef: string
  fullTaskId: string
}

// ── Build keyframe prompt for the insert ──────────────────────────────────

function buildInsertKeyframePrompt(
  presetId: ActionPresetId,
  product: Product | null,
  productRefIndex: number,
  personRefIndex: number,
  conceptPrompt?: string,
): string {
  const preset = ACTION_PRESETS[presetId]
  const paragraphs: string[] = []

  // Z37 — CONCEPT_SCENE: a free concept B-roll written by the AI scene director.
  // No product on screen → no product lock, no identity lock, no preset action.
  // Pure text-to-image illustration of the dialogue span.
  if (presetId === 'CONCEPT_SCENE') {
    const scene = conceptPrompt?.trim()
    paragraphs.push(
      `SCENE: ${scene && scene.length > 0
        ? scene
        : preset.promptPreset}`,
    )
    paragraphs.push('COMPOSITION: vertical 9:16 aspect ratio, natural framing.')
    paragraphs.push('NO PRODUCT PACKAGING visible in frame — concept / mood illustration only.')
    paragraphs.push(
      'STYLE: Authentic UGC iPhone footage — real lived-in moment, natural daylight, ' +
      'subtle grain, real texture. NOT cinematic, NOT studio, NOT magazine, NOT stock-photo.',
    )
    paragraphs.push(
      'Avoid: text overlays, watermarks, logos, product packaging, 3D-render look, ' +
      'cartoon, beauty filter, cinematic color grade.',
    )
    return paragraphs.join('\n\n')
  }

  // 1. Subject locks — reference each image by its ACTUAL position in filesUrl
  if (productRefIndex > 0 && product) {
    paragraphs.push(
      `PRODUCT LOCK: ${product.productName ?? 'the product'} from reference image #${productRefIndex}. ` +
      preset.objectInteraction,
    )
  }
  if (personRefIndex > 0) {
    paragraphs.push(
      `IDENTITY LOCK: Person from reference image #${personRefIndex}. ` +
      `Preserve EXACTLY face, hair, skin tone, body proportions. Do NOT redesign.`,
    )
  }

  // 2. Composition
  paragraphs.push(`COMPOSITION: ${preset.framingPreset} shot, vertical 9:16 aspect ratio.`)

  // 3. Action prompt
  paragraphs.push(`ACTION: ${preset.promptPreset}`)

  // 4. Hand behaviour
  paragraphs.push(`HANDS: ${preset.handBehavior}`)

  // 5. Realism
  paragraphs.push(
    'STYLE: Authentic UGC iPhone photo — real lived-in moment, natural daylight, ' +
    'subtle grain, real skin texture. NOT cinematic, NOT studio, NOT magazine.',
  )

  // 6. Negative
  paragraphs.push(
    'Avoid: malformed hands, extra fingers, distorted product, redesigned packaging, ' +
    'cinematic lighting, 3D-render look, cartoon, beauty filter.',
  )

  return paragraphs.join('\n\n')
}

/** Which presets benefit from including the avatar reference */
function presetUsesAvatar(presetId: ActionPresetId): boolean {
  // Presets that feature the person's face / body
  return ['HOLD_PRODUCT', 'DRINK', 'TAKE_PILL', 'BEFORE_AFTER_REACTION'].includes(presetId)
}

/** Pick which assets to send to KIE as filesUrl — product first, then the
 *  person reference. The person reference chains to the creator video's
 *  keyframe when available (visual continuity), falling back to the raw
 *  avatar bank portrait only when there is no creator keyframe yet. */
async function resolveRefs(
  preset: typeof ACTION_PRESETS[ActionPresetId],
  product: Product | null,
  avatar: Model | null,
  creatorKeyframeRef?: string,
): Promise<{ refs: string[]; productRefIndex: number; personRefIndex: number }> {
  const refs: string[] = []
  let productRefIndex = 0
  let personRefIndex = 0
  if (preset.needsProduct && product?.productImage) {
    const url = isAssetRef(product.productImage)
      ? await getUrl(product.productImage)
      : product.productImage
    if (url) { refs.push(url); productRefIndex = refs.length }
  }
  if (presetUsesAvatar(preset.id)) {
    // Chain anchor first, raw avatar portrait second.
    const personRef = creatorKeyframeRef ?? avatar?.characterImage
    if (personRef) {
      const url = isAssetRef(personRef) ? await getUrl(personRef) : personRef
      if (url) { refs.push(url); personRefIndex = refs.length }
    }
  }
  return { refs, productRefIndex, personRefIndex }
}

// ── Public: render a single insert end-to-end ──────────────────────────────

export async function renderInsert(
  params: RenderInsertParams,
): Promise<RenderInsertResult> {
  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')

  const preset = ACTION_PRESETS[params.presetId]
  const { refs: filesUrl, productRefIndex, personRefIndex } = await resolveRefs(
    preset, params.product, params.avatar, params.creatorKeyframeRef,
  )

  // Z37 — the scene verb that drives the Kling motion prompts (Stage 2/3).
  // For CONCEPT_SCENE it comes from the AI scene director's free prompt; for
  // the 12 product presets it stays the hard-won stable preset prompt.
  const isConcept = params.presetId === 'CONCEPT_SCENE'
  const motionScene = isConcept
    ? (params.conceptPrompt?.trim() || preset.promptPreset)
    : preset.promptPreset
  const cameraMotion = preset.cameraPreset === 'static'
    ? 'Locked-off camera.'
    : 'Subtle handheld micro-motion.'

  // ── STAGE 1: KEYFRAME ─────────────────────────────────────────────────
  params.onStageUpdate({ stage: 'keyframe' })

  const keyframePromptUsed = buildInsertKeyframePrompt(
    params.presetId, params.product, productRefIndex, personRefIndex,
    params.conceptPrompt,
  )
  console.log(`[INSERT ${params.presetId}] Stage 1 keyframe prompt len=${keyframePromptUsed.length}, refs=${filesUrl.length}`)

  const keyframeRemoteUrl = await generateGpt4oImageFast({
    apiKey: params.kieApiKey,
    prompt: keyframePromptUsed,
    filesUrl,
    size: '2:3',  // closest GPT-4o supports to vertical 9:16
    softTimeoutMs: 60_000,
    attemptTimeoutMs: 90_000,
    maxAttempts: 2,
    signal: params.signal,
  })

  const keyframeBlob = await fetch(keyframeRemoteUrl).then((r) => r.blob())
  const keyframeRef = await saveAsset(keyframeBlob, keyframeBlob.type || 'image/png')
  params.onStageUpdate({ stage: 'keyframe', keyframeRef, keyframePromptUsed })

  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')

  // ── STAGE 2: VIDEO — SINGLE Kling i2v pass ─────────────────────────────
  // Z38 — there used to be a separate 480p "preview" Kling render here BEFORE
  // the full render — and the two ran back-to-back with NO approval gate in
  // between, so the cheap preview was never actually used to decide anything;
  // it just doubled the Kling submissions (2 paid jobs per insert → 10 for a
  // 5-insert ad). Deleted. One Kling job per insert now. Its taskId is
  // persisted BEFORE polling so a timeout can RESUME the already-paid job
  // (resumeInsertVideo) instead of re-submitting and charging again.
  params.onStageUpdate({ stage: 'video_full', keyframeRef, keyframePromptUsed })

  const keyframePublicUrl = await getUrl(keyframeRef)
  if (!keyframePublicUrl) throw new Error('Không lấy được URL keyframe (asset store)')

  const fullSubmission = await generateVideoJob({
    apiKey: params.kieApiKey,
    jobModelId: 'kling-3.0/video',
    prompt: isConcept
      ? `${motionScene} ${cameraMotion} No product packaging in frame.`
      : `${motionScene} ${cameraMotion} ${preset.handBehavior}`,
    aspectRatio: '9:16',
    resolution: params.resolution,
    duration: 5,
    referenceImageUrls: [keyframePublicUrl],
  })
  // Persist taskId IMMEDIATELY — the job is paid for. A timeout below leaves
  // a recoverable handle so the user re-polls instead of paying twice.
  params.onStageUpdate({
    stage: 'video_full', keyframeRef, keyframePromptUsed,
    fullTaskId: fullSubmission.taskId,
  })

  const videoRef = await pollAndSaveInsertVideo({
    apiKey: params.kieApiKey,
    taskId: fullSubmission.taskId,
    timeoutMs: 10 * 60 * 1000,  // 10min ceiling for a 5s i2v clip
  })

  params.onStageUpdate({
    stage: 'completed',
    keyframeRef, keyframePromptUsed,
    fullTaskId: fullSubmission.taskId, videoRef,
  })

  return {
    keyframeRef,
    keyframePromptUsed,
    videoRef,
    fullTaskId: fullSubmission.taskId,
  }
}

// ── Resume a paid-but-unfinished insert video job ───────────────────────────
// Z38 — same recovery path as the creator video: when the poll above times out
// (or the user refreshed), the Kling job is still running on KIE and was
// already charged. Re-poll the SAME taskId — never submit a new job, so it
// does NOT spend more credit.

export interface ResumeInsertParams {
  kieApiKey: string
  /** The fullTaskId persisted from a prior (timed-out) insert render. */
  taskId: string
  onStageUpdate: (update: InsertStageUpdate) => void
  timeoutMs?: number
  signal?: AbortSignal
}

export async function resumeInsertVideo(
  params: ResumeInsertParams,
): Promise<{ videoRef: string }> {
  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')
  console.log(`[INSERT resume] re-polling paid task ${params.taskId} (no new charge)`)
  params.onStageUpdate({ stage: 'video_full', fullTaskId: params.taskId })

  const videoRef = await pollAndSaveInsertVideo({
    apiKey: params.kieApiKey,
    taskId: params.taskId,
    timeoutMs: params.timeoutMs ?? 10 * 60 * 1000,
  })

  params.onStageUpdate({ stage: 'completed', fullTaskId: params.taskId, videoRef })
  return { videoRef }
}

/** Poll a Kling i2v task to completion, then download + persist the MP4. */
async function pollAndSaveInsertVideo(args: {
  apiKey: string
  taskId: string
  timeoutMs: number
}): Promise<string> {
  const remoteUrl = await pollVideoJobUntilDone({
    apiKey: args.apiKey,
    taskId: args.taskId,
    timeoutMs: args.timeoutMs,
  })
  const blob = await fetch(remoteUrl).then((r) => r.blob())
  return saveAsset(blob, blob.type || 'video/mp4')
}

/** Helper: list cuts that are eligible for a bulk render call. Excludes
 *  locked / approved / rejected / generating items (Z26 lesson). */
export function listEligibleInsertsForBulk(inserts: ActionInsertClip[]): ActionInsertClip[] {
  return inserts.filter((it) => {
    if (it.status === 'locked' || it.status === 'approved' || it.status === 'rejected') return false
    if (it.stage === 'keyframe' || it.stage === 'preview_motion' || it.stage === 'video_full') return false
    // Idle + failed are eligible (failed inserts can be retried)
    return it.stage === 'idle' || it.stage === 'failed'
  })
}
