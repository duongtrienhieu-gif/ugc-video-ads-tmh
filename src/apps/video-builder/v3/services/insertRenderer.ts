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
    // Z61 — emotion concept (video) features a PERSON; lock it to the creator
    // avatar so the same face appears across the whole ad (not a random
    // stranger). Graphic concept (ken_burns infographic) has no person.
    const isEmotionPerson = renderMode === 'video' && personRefIndex > 0
    if (isEmotionPerson) {
      paragraphs.push(
        `IDENTITY LOCK: The person in this scene is the SAME person from reference ` +
        `image #${personRefIndex} — preserve EXACTLY their face, hair, skin tone, ` +
        `age and build. This must read as the same creator who appears elsewhere ` +
        `in the video, NOT a different model.`,
      )
    }
    paragraphs.push(
      `SCENE: ${scene && scene.length > 0
        ? scene
        : preset.promptPreset}`,
    )
    paragraphs.push(
      'COMPOSITION: vertical 9:16 aspect ratio, ONE clear focal subject centred ' +
      'with generous empty margins. The frame is cropped to tall vertical and ' +
      'slowly zoomed, so EVERY visible element — subject, icons, and especially ' +
      'TEXT LABELS — MUST sit within the CENTRAL 60% of the frame (≥20% padding ' +
      'from EVERY edge: top, bottom, left, right). NO text touching or running ' +
      'off any edge. If a label is long, break it into two stacked short lines ' +
      'rather than letting it stretch toward the edges.',
    )
    if (!isEmotionPerson) {
      // Z70 — strengthen no-product rule. Even "generic" devices that look like
      // a competitor / fake version of the product (a generic knee brace, a
      // generic jar of powder, an unbranded toothbrush head) are NOT allowed
      // here. The viewer should see anatomy, ingredients, mechanism, or feeling
      // — never any object that competes visually with the real product.
      paragraphs.push(
        'NO PRODUCT — concept / mood illustration only. ZERO product-like objects in ' +
        'frame: no brace, no jar, no bottle, no tube, no sachet, no pill, no device, ' +
        'no toothbrush head, no medical appliance — branded OR unbranded, real OR ' +
        'generic, full OR partial. Show ONLY anatomy, ingredients in their raw form, ' +
        'mechanism diagrams, body parts, or feelings/emotions. The product belongs ' +
        'in CUT scenes (HOLD_PRODUCT, PRODUCT_IN_ACTION, etc.), never here.',
      )
    } else {
      paragraphs.push('No product packaging in frame — this is a reaction / emotion shot of the person only.')
    }

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
        'STYLE: Follow the art direction in the SCENE above. If it is a sketch / ' +
        'infographic, make it a SIMPLE friendly HAND-DRAWN visual — clean line-art ' +
        'doodle, warm marker feel, one clear idea, lots of empty space, absorbable ' +
        'at a glance. Render the SHORT text labels the SCENE specifies (ingredient ' +
        'names, a number, the key term) EXACTLY as written in the SCENE — same ' +
        'language, do NOT translate or change them — a few short labels (1-3 words ' +
        'each), BIG and correctly spelled. NO sentences or paragraphs. If the SCENE ' +
        'asks for a realistic microscopy / medical look instead, make it photoreal.',
      )
      paragraphs.push(
        'Avoid: paragraphs or sentences of text, dense medical-poster layout, ' +
        'multiple stacked sections, title bars, rows of bottom icons, busy ' +
        'cluttered compositions, watermarks, brand logos, product packaging, ' +
        'glossy plastic 3D-render, neon glow, rainbow gradient. Keep ONLY the few ' +
        'key-term labels — no explanatory prose.',
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

/** Z61 — which scenes feature the CREATOR and must lock to the avatar so the
 *  same person appears across the whole ad. Without this, emotion concept
 *  scenes + product-in-action scenes generated RANDOM strangers, so a single
 *  review showed 2-3 different faces (authenticity killer).
 *    • HOLD_PRODUCT / DRINK / TAKE_PILL / BEFORE_AFTER_REACTION — person + product
 *    • PRODUCT_IN_ACTION — the person uses/applies the product (brush, rub…)
 *    • CONCEPT_SCENE + video (emotion) — a person expressing a feeling
 *  Graphic CONCEPT_SCENE (ken_burns infographic) has NO person → no avatar. */
function usesAvatarRef(presetId: ActionPresetId, renderMode?: InsertRenderMode): boolean {
  if (['HOLD_PRODUCT', 'DRINK', 'TAKE_PILL', 'BEFORE_AFTER_REACTION', 'PRODUCT_IN_ACTION'].includes(presetId)) {
    return true
  }
  // Emotion concept scenes feature the creator; graphic infographics do not.
  if (presetId === 'CONCEPT_SCENE') return renderMode === 'video'
  return false
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
  renderMode?: InsertRenderMode,
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
  if (usesAvatarRef(preset.id, renderMode)) {
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
    preset, params.product, params.avatar, params.creatorKeyframeRef, params.renderMode,
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

  // ── STAGE 2 (still mode): NO video API — hold the keyframe locally ─────
  // Z39/Z76 — for concept / ingredient / mechanism scenes we don't pay the i2v
  // model just to add motion. Render a STATIC image clip over the keyframe with
  // ffmpeg.wasm IN THE BROWSER (free) and save it as a normal mp4 so the planner
  // + final assembler treat it exactly like a video insert.
  // Z76 — was a Ken Burns zoom; the zoom+crop kept cutting off the infographic
  // text labels ("ảng bám" / "Vi khu" sheared at the edges). User wants 100%
  // of the content visible, so it's now a non-moving fit (see renderStaticImageClip).
  if ((params.renderMode ?? 'video') === 'ken_burns') {
    params.onStageUpdate({ stage: 'video_full', keyframeRef, keyframePromptUsed })
    console.log(`[INSERT ${params.presetId}] Stage 2 static-image start (local ffmpeg, no video API)`)
    const videoRef = await renderStaticImageClip({
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
  console.log(`[INSERT ${params.presetId}] Stage 2 video_full start (${params.resolution}, grok-imagine/image-to-video)`)

  const keyframePublicUrl = await getUrl(keyframeRef)
  if (!keyframePublicUrl) throw new Error('Không lấy được URL keyframe (asset store)')

  // Z76 — i2v model history: Kling 3.0 (422) → Veo 3.1 Fast (audio fails, ~60c)
  // → Wan 2.7 (16cr/s) → grok-imagine-video-1-5-preview (PREMIUM 14.5cr/s — the
  // big credit burn) → NOW `grok-imagine/image-to-video`, the cheap Grok tier at
  // 1.6 cr/s @480p (~9× cheaper). VIDEO-ONLY (no audio-gen failures). Animates
  // the keyframe via image_urls so the GPT-4o face+product lock is kept.
  // The model has a 6s FLOOR (its duration min), so a clip is always 6s and the
  // assembler trims it down to the timeline segment. ~10cr/clip at 480p.
  // Static-image auto-fallback (Z63/Z76) still covers any failure.
  const videoDuration = Math.max(6, Math.min(8, Math.ceil(params.durationSec ?? 6)))
  try {
    const fullSubmission = await generateVideoJob({
      apiKey: params.kieApiKey,
      jobModelId: 'grok-imagine/image-to-video',
      prompt: isConcept
        ? `${motionScene} ${cameraMotion} No product packaging in frame.`
        : `${motionScene} ${cameraMotion} ${preset.handBehavior}`,
      aspectRatio: '9:16',
      resolution: params.resolution,
      duration: videoDuration,
      referenceImageUrls: [keyframePublicUrl],
    })
    console.log(`[INSERT ${params.presetId}] Grok submitted taskId=${fullSubmission.taskId.slice(0, 12)} dur=${videoDuration}s`)
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
  } catch (videoErr) {
    if (params.signal?.aborted) throw videoErr  // user cancelled — don't fall back
    const msg = videoErr instanceof Error ? videoErr.message : String(videoErr)
    console.warn(`[INSERT ${params.presetId}] Grok i2v failed (${msg.slice(0, 140)}) → auto fallback to a static image clip from the existing keyframe`)
    params.onStageUpdate({ stage: 'video_full', keyframeRef, keyframePromptUsed })
    const videoRef = await renderStaticImageClip({
      imageBlob: keyframeBlob,
      durationSec: params.durationSec ?? 4,
      resolution: params.resolution,
    })
    params.onStageUpdate({ stage: 'completed', keyframeRef, keyframePromptUsed, videoRef })
    return { keyframeRef, keyframePromptUsed, videoRef }
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

// ── Static image clip: still → mp4 (local, free) ───────────────────────────
// Z76 — replaces the old Ken Burns zoom. User feedback: the zoom+crop kept
// shearing the infographic text labels off the edges, and no amount of prompt
// tuning fully fixed it. The ONLY way to guarantee 100% of the content stays
// visible is to NOT crop and NOT move. So this renders a fully static clip:
//   • foreground = the whole keyframe scaled to FIT (force_original_aspect_
//     ratio=decrease) → never cropped, every label intact.
//   • background = the same keyframe scaled to COVER + heavily blurred, filling
//     the letterbox gap so there are no hard black bars (the standard vertical-
//     content fill look). The keyframe bg is light cream, so the blur reads as
//     a soft extension, not a bar.
// Output is a normal 9:16 mp4 (no audio) saved to the asset store, so the rest
// of the pipeline (planner / assembler) is UNCHANGED — it just sees a videoRef.
// Runs in the browser → costs ZERO KIE credit.
async function renderStaticImageClip(args: {
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
  const id = Math.random().toString(36).slice(2, 8)
  const ext = (args.imageBlob.type || '').includes('png') ? 'png' : 'jpg'
  const inName = `st_${id}.${ext}`
  const outName = `st_${id}.mp4`

  await ffmpeg.writeFile(inName, new Uint8Array(await args.imageBlob.arrayBuffer()))

  // split: [bg] cover+blur fills the frame, [fg] full image fit on top centred.
  // NO crop on fg → text can never be cut. NO zoompan → fully static.
  const filter =
    `[0:v]split=2[bg][fg];` +
    `[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=20:2,setsar=1[bgb];` +
    `[fg]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1[fgs];` +
    `[bgb][fgs]overlay=(W-w)/2:(H-h)/2:format=auto,format=yuv420p[v]`

  await ffmpeg.exec([
    '-loop', '1', '-t', String(dur), '-i', inName,
    '-filter_complex', filter, '-map', '[v]',
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

/** Poll an i2v task to completion, then download + persist the MP4.
 *  Z67 — Wan i2v uses the /jobs API (createTask + recordInfo), so poll with
 *  pollVideoJobUntilDone (was Veo /veo/record-info in Z46). */
async function pollAndSaveInsertVideo(args: {
  apiKey: string
  taskId: string
  timeoutMs: number
  logTag?: string
}): Promise<string> {
  const remoteUrl = await pollVideoJobUntilDone({
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
