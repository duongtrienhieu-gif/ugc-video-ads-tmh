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
  generateVideo, pollVideoUntilDone,
} from '../../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import type { Model, Product } from '../../../../stores/types'
import type {
  ActionInsertClip, InsertRenderStage, ActionPresetId, InsertRenderMode,
} from '../types'
import { ACTION_PRESETS } from './actionPresets'
import { getFFmpeg } from './ffmpegLoader'

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
  /** Z39 — 'video' (Kling clip) or 'ken_burns' (still + local zoom). Default
   *  'video'. When 'ken_burns' the renderer skips Kling and produces the mp4
   *  locally from the keyframe (no KIE credit beyond the keyframe). */
  renderMode?: InsertRenderMode
  /** Overlay duration (seconds) — used to size the Ken Burns clip. Ignored for
   *  Kling video (fixed 5s). Default 3.5s. */
  durationSec?: number
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
  /** Present only for Kling ('video') renders — Ken Burns has no KIE task. */
  fullTaskId?: string
}

// ── Build keyframe prompt for the insert ──────────────────────────────────

function buildInsertKeyframePrompt(
  presetId: ActionPresetId,
  product: Product | null,
  productRefIndex: number,
  personRefIndex: number,
  conceptPrompt?: string,
  renderMode?: InsertRenderMode,
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

    // Z48 — the ART STYLE now lives INSIDE the conceptPrompt (the Director
    // writes either a hand-drawn UGC infographic — with ${lang} text labels +
    // icons — or a realistic microscopy look, per scene). So the keyframe
    // builder must NOT impose its own conflicting style anymore. The old Z46
    // block forced "scientific microscopy, monochrome, NO text" onto EVERY
    // graphic scene, which fought an infographic conceptPrompt and produced
    // abstract art with no labels. We now DEFER to the conceptPrompt and only
    // add non-conflicting guards (these apply to both looks):
    const isGraphic = renderMode === 'ken_burns'
    if (isGraphic) {
      // Graphic concept (ken_burns): infographic OR realistic — conceptPrompt
      // decides. Text labels are ALLOWED here (infographics need them).
      paragraphs.push(
        'STYLE: Follow the art direction described in the SCENE above exactly. ' +
        'If it asks for a hand-drawn / sketch infographic, make it look genuinely ' +
        'hand-drawn and friendly (a creator\'s notebook doodle), with the labels ' +
        'written clearly. If it asks for a realistic microscopy / medical look, ' +
        'make it photoreal and credible.',
      )
      paragraphs.push(
        'Avoid: watermarks, brand logos, product packaging, glossy 3D-render ' +
        'plastic look, neon sci-fi glow, rainbow gradient, fantasy color wash. ' +
        'Keep any text labels SHORT and spelled correctly.',
      )
    } else {
      // Emotion concept (video): real human/lifestyle footage, no text.
      paragraphs.push(
        'STYLE: Authentic UGC iPhone footage — real lived-in moment, natural daylight, ' +
        'subtle grain, real texture. NOT cinematic, NOT studio, NOT magazine, NOT stock-photo.',
      )
      paragraphs.push(
        'Avoid: text overlays, watermarks, logos, product packaging, 3D-render look, ' +
        'cartoon, beauty filter, cinematic color grade.',
      )
    }
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

  // 3. Action prompt — Z42: PRODUCT_IN_ACTION uses the director's free action
  // (conceptPrompt) instead of the fixed preset verb, while still keeping the
  // product lock above. The 12 fixed presets keep their hard-won stable prompt.
  const freeAction = presetId === 'PRODUCT_IN_ACTION' ? conceptPrompt?.trim() : ''
  paragraphs.push(`ACTION: ${freeAction && freeAction.length > 0 ? freeAction : preset.promptPreset}`)

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
  // Z42 — CONCEPT_SCENE has NO product on screen (special keyframe branch +
  // Ken Burns default). PRODUCT_IN_ACTION keeps the product but uses the
  // director's free action. Both pull their scene verb from conceptPrompt.
  const isConcept = params.presetId === 'CONCEPT_SCENE'
  const usesFreeAction = isConcept || params.presetId === 'PRODUCT_IN_ACTION'
  const motionScene = usesFreeAction
    ? (params.conceptPrompt?.trim() || preset.promptPreset)
    : preset.promptPreset
  const cameraMotion = preset.cameraPreset === 'static'
    ? 'Locked-off camera.'
    : 'Subtle handheld micro-motion.'

  // ── STAGE 1: KEYFRAME ─────────────────────────────────────────────────
  params.onStageUpdate({ stage: 'keyframe' })

  const keyframePromptUsed = buildInsertKeyframePrompt(
    params.presetId, params.product, productRefIndex, personRefIndex,
    params.conceptPrompt, params.renderMode,
  )
  console.log(`[INSERT ${params.presetId}] Stage 1 keyframe prompt len=${keyframePromptUsed.length}, refs=${filesUrl.length}`)

  const keyframeRemoteUrl = await generateGpt4oImageFast({
    apiKey: params.kieApiKey,
    prompt: keyframePromptUsed,
    filesUrl,
    size: '2:3',  // closest GPT-4o supports to vertical 9:16
    // Z43 — KIE GPT-4o image-edit with 2 reference images routinely takes
    // 90-140s when the KIE queue is busy. The old 90s hard cap abandoned
    // tasks that would have finished at ~100s, turning a slow-but-fine run
    // into a "TIMEOUT" failure. Give it a realistic window (150s) and one
    // extra fresh attempt so a transient KIE "Internal Error" gets a 3rd shot.
    softTimeoutMs: 100_000,
    attemptTimeoutMs: 150_000,
    maxAttempts: 3,
    signal: params.signal,
  })

  const keyframeBlob = await fetch(keyframeRemoteUrl).then((r) => r.blob())
  const keyframeRef = await saveAsset(keyframeBlob, keyframeBlob.type || 'image/png')
  params.onStageUpdate({ stage: 'keyframe', keyframeRef, keyframePromptUsed })

  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')

  // ── STAGE 2 (Ken Burns mode): NO Kling — animate the still locally ─────
  // Z39 — for static concept / ingredient / product-label scenes we don't pay
  // Kling (~45cr) just to add a slow drift. Render a zoom/pan over the keyframe
  // with ffmpeg.wasm IN THE BROWSER (free), and save it as a normal mp4 so the
  // planner + final assembler treat it exactly like a Kling insert.
  if ((params.renderMode ?? 'video') === 'ken_burns') {
    params.onStageUpdate({ stage: 'video_full', keyframeRef, keyframePromptUsed })
    console.log(`[INSERT ${params.presetId}] Stage 2 ken_burns start (local ffmpeg, no Kling)`)
    const videoRef = await renderKenBurnsClip({
      imageBlob: keyframeBlob,
      durationSec: params.durationSec ?? 3.5,
      resolution: params.resolution,
    })
    params.onStageUpdate({ stage: 'completed', keyframeRef, keyframePromptUsed, videoRef })
    return { keyframeRef, keyframePromptUsed, videoRef }
  }

  // ── STAGE 2: VIDEO — SINGLE Kling i2v pass ─────────────────────────────
  // Z38 — there used to be a separate 480p "preview" Kling render here BEFORE
  // the full render — and the two ran back-to-back with NO approval gate in
  // between, so the cheap preview was never actually used to decide anything;
  // it just doubled the Kling submissions (2 paid jobs per insert → 10 for a
  // 5-insert ad). Deleted. One Kling job per insert now. Its taskId is
  // persisted BEFORE polling so a timeout can RESUME the already-paid job
  // (resumeInsertVideo) instead of re-submitting and charging again.
  params.onStageUpdate({ stage: 'video_full', keyframeRef, keyframePromptUsed })
  console.log(`[INSERT ${params.presetId}] Stage 2 video_full start (${params.resolution}, veo3_fast)`)

  const keyframePublicUrl = await getUrl(keyframeRef)
  if (!keyframePublicUrl) throw new Error('Không lấy được URL keyframe (asset store)')

  // Z46 — Kling 3.0 returned 422 (Unprocessable Entity) on every i2v submit,
  // making the engine output zero videos. Swapped to Veo 3.1 Fast: same price
  // tier (60c vs 70c), different KIE endpoint (/veo/generate vs /jobs/createTask),
  // different schema → bypasses whatever Kling regression hit us. Google Veo
  // also handles Asian faces + product preservation reliably.
  const fullSubmission = await generateVideo({
    apiKey: params.kieApiKey,
    model: 'veo3_fast',
    prompt: isConcept
      ? `${motionScene} ${cameraMotion} No product packaging in frame.`
      : `${motionScene} ${cameraMotion} ${preset.handBehavior}`,
    aspectRatio: '9:16',
    resolution: params.resolution,
    // Z46 — Veo 3.1 Fast HARD constraint: duration must be 4, 6, or 8.
    // We pick 6 (middle option) — generous motion buffer that the
    // compositor trims down to the per-insert durationSec (usually 2-4s).
    // Sending 5 returns HTTP 422 "Duration must be 4, 6 or 8 seconds".
    duration: 6,
    referenceImageUrls: [keyframePublicUrl],
  })
  // Persist taskId IMMEDIATELY — the job is paid for. A timeout below leaves
  // a recoverable handle so the user re-polls instead of paying twice.
  console.log(`[INSERT ${params.presetId}] Veo submitted taskId=${fullSubmission.taskId.slice(0, 12)}`)
  params.onStageUpdate({
    stage: 'video_full', keyframeRef, keyframePromptUsed,
    fullTaskId: fullSubmission.taskId,
  })

  const videoRef = await pollAndSaveInsertVideo({
    apiKey: params.kieApiKey,
    taskId: fullSubmission.taskId,
    timeoutMs: 10 * 60 * 1000,  // 10min ceiling for a 5s i2v clip
    logTag: `${params.presetId}/full`,
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
    logTag: 'resume',
  })

  params.onStageUpdate({ stage: 'completed', fullTaskId: params.taskId, videoRef })
  return { videoRef }
}

// ── Ken Burns: still → mp4 (local, free) ────────────────────────────────────
// Z39/Z44 — slow centered zoom over a single keyframe via ffmpeg.wasm zoompan.
// Output is a normal 9:16 mp4 (no audio) saved to the asset store, so the rest
// of the pipeline (planner / assembler) is UNCHANGED — it just sees a videoRef.
// The zoom increment is scaled to the duration so the total push is ~28%
// regardless of clip length. 12% (the original) was too subtle — viewers
// perceived the clip as a static image. 28% is still gentle UGC-style motion
// but unmistakably moving. We pre-upscale 2x before zoompan (the standard
// anti-jitter trick). Runs in the browser → costs ZERO KIE credit.
async function renderKenBurnsClip(args: {
  imageBlob: Blob
  durationSec: number
  resolution: '480p' | '720p' | '1080p'
}): Promise<string> {
  const ffmpeg = await getFFmpeg()
  const dur = Math.max(1.5, Math.min(8, args.durationSec || 3.5))
  const shortSide = args.resolution === '1080p' ? 1080 : args.resolution === '720p' ? 720 : 480
  const W = shortSide % 2 === 0 ? shortSide : shortSide + 1
  const h0 = Math.round((shortSide * 16) / 9)
  const H = h0 % 2 === 0 ? h0 : h0 + 1
  const fps = 30
  const frames = Math.max(1, Math.round(dur * fps))
  const inc = (0.28 / frames).toFixed(6)
  const id = Math.random().toString(36).slice(2, 8)
  const ext = (args.imageBlob.type || '').includes('png') ? 'png' : 'jpg'
  const inName = `kb_${id}.${ext}`
  const outName = `kb_${id}.mp4`

  await ffmpeg.writeFile(inName, new Uint8Array(await args.imageBlob.arrayBuffer()))

  // Cover-crop to 9:16, upscale 2x, then zoompan down to WxH (centered slow zoom-in).
  const vf =
    `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
    `scale=${W * 2}:${H * 2},` +
    `zoompan=z='zoom+${inc}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${fps},` +
    `trim=duration=${dur},setpts=PTS-STARTPTS`

  await ffmpeg.exec([
    '-i', inName,
    '-vf', vf,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-pix_fmt', 'yuv420p', '-r', String(fps), '-t', String(dur),
    '-an', '-y', outName,
  ])

  const data = await ffmpeg.readFile(outName)
  const blob = new Blob(
    [data instanceof Uint8Array ? (data as unknown as BlobPart) : new Uint8Array()],
    { type: 'video/mp4' },
  )
  await ffmpeg.deleteFile(inName).catch(() => {})
  await ffmpeg.deleteFile(outName).catch(() => {})
  return saveAsset(blob, 'video/mp4')
}

/** Poll a Veo i2v task to completion, then download + persist the MP4.
 *  Z46 — was Kling /jobs/recordInfo poll, now Veo /veo/record-info poll. */
async function pollAndSaveInsertVideo(args: {
  apiKey: string
  taskId: string
  timeoutMs: number
  logTag?: string
}): Promise<string> {
  const remoteUrl = await pollVideoUntilDone({
    apiKey: args.apiKey,
    taskId: args.taskId,
    timeoutMs: args.timeoutMs,
    logTag: args.logTag,
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
