// ─────────────────────────────────────────────────────────────────────────
// Image-to-video clip generation for v2 pipeline (Phase 6 — video-gen).
//
// Provider: Kling 3.0 std via KIE.ai jobs API.
// Why Kling: most natural human micro-motion for UGC ads — stomach holding,
// selfie talk, eating, laugh — without the "cinematic AI commercial" sheen
// that Veo Quality has. Sweet spot for Malaysia FB / TikTok native ads.
//
// Compile pipeline (per scene):
//   keyframe asset:xxx
//   + motionStyle / cameraMotion / sceneType / emotion (from SceneBlueprint)
//   → tight Kling-friendly motion prompt
//   → KIE job → poll → asset:xxx (persisted video)
// ─────────────────────────────────────────────────────────────────────────

import type { SceneBlueprint } from '../types'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import { generateVideoJob, pollVideoJobUntilDone } from '../../../../utils/kieai'

// KIE model id for Kling 3.0 (Kling 1.6 std isn't surfaced separately in
// KIE's current catalogue; 3.0 is the newer std-mode replacement with the
// same UGC-friendly motion profile + slightly better human realism).
const KLING_MODEL_ID = 'kling-3.0/video'
/** Approx credits per 5s clip — surfaced in the cost preview UI. */
export const KLING_CREDIT_PER_CLIP = 70

// ── Map motionStyle → concrete English phrase Kling responds well to ───
const MOTION_PHRASE: Record<NonNullable<SceneBlueprint['motionStyle']>, string> = {
  subtle_head_turn:   'subtle natural head turn toward camera, small blink, micro-expression shift',
  stomach_holding:    'subject gently holds their stomach, slight body discomfort, soft wince, no exaggeration',
  eating_motion:      'subject takes a small natural bite or sip, relaxed chewing, comfortable expression',
  selfie_talk:        'subject talks softly toward the phone camera, natural mouth movement, small nods',
  pointing_product:   'subject extends index finger to point at product label, gentle controlled movement',
  laugh_with_family:  'subject laughs warmly, small genuine body laugh, slight shoulder lift',
  unboxing_reveal:    'subject\'s hands lift and rotate the package, slow reveal, careful unwrapping',
  walking_in:         'subject walks slowly into frame from one side, natural gait, no rushing',
  static_pose:        'subject holds the exact pose, only subtle breathing and blinking — no body shift',
}

const CAMERA_PHRASE: Record<NonNullable<SceneBlueprint['cameraMotion']>, string> = {
  handheld:        'subtle handheld micro-shake, realistic phone camera feel',
  iphone_selfie:   'arm-extended selfie bob, slight vertical sway',
  slow_pushin:     'slow dolly push-in toward subject, very gentle, ~5% zoom',
  slow_pullout:    'slow dolly pull-out from subject, gentle reveal of surroundings',
  static:          'locked tripod, no camera motion at all',
  over_shoulder:   'over-the-shoulder POV looking past the subject toward what they hold',
  walking_follow:  'tracking shot following the subject at walking pace, smooth gimbal feel',
  overhead_top:    'static overhead top-down view, slight micro-shake only',
}

// ── Compile per-scene video prompt ──────────────────────────────────────
export function compileVideoPrompt(blueprint: SceneBlueprint): string {
  const motion = blueprint.motionStyle ? MOTION_PHRASE[blueprint.motionStyle] : 'natural subtle body movement, gentle breathing, occasional blink'
  const camera = blueprint.cameraMotion ? CAMERA_PHRASE[blueprint.cameraMotion] : 'subtle handheld phone camera feel'
  const emotion = blueprint.emotion || 'natural'
  const sceneType = blueprint.sceneType || 'lifestyle'

  // Tight prompt: animate the still without re-inventing the scene. Kling
  // tends to add too much when given long descriptive prompts — keep it
  // to motion + camera + emotion + a NO-DRAMA clause.
  return `Animate the input image with realistic natural human micro-motion.

Subject motion: ${motion}.
Camera: ${camera}.
Emotion: ${emotion} — keep the expression consistent with the input photo.
Beat: ${sceneType}.

Style: authentic UGC phone-camera realism. No cinematic camera moves, no dramatic zoom, no synthetic-looking motion. Subject's face / outfit / environment / product must stay identical to the input image — only animate motion. 24fps natural pace, no slow motion.`
}

// ── Public API ─────────────────────────────────────────────────────────

export interface RunVideoClipParams {
  apiKey: string
  blueprint: SceneBlueprint
  /** asset:xxx ref of the approved keyframe still. Will be resolved to a
   *  public URL Kling can fetch. */
  keyframeRef: string
  /** 5 / 8 / 10 — Kling-supported clip durations. */
  durationSec?: number
  /** Optional onStatus callback for queue progress. */
  onStatus?: (status: 'queued' | 'processing' | 'completed' | 'failed', taskId?: string) => void
  /** Cancel signal — if aborted, the polling loop short-circuits. */
  signal?: AbortSignal
}

export interface RunVideoClipResult {
  /** asset:xxx ref of the persisted video clip. */
  videoRef: string
  taskId: string
  promptUsed: string
}

/**
 * Generate a single image-to-video clip via Kling 3.0 std.
 * Resolves the keyframe asset ref → public URL → submits to KIE → polls
 * for the resulting MP4 → saves the MP4 into the asset store → returns
 * the new asset ref.
 *
 * Throws on credit / API / timeout errors so the caller (job runner) can
 * mark the item failed.
 */
export async function runVideoClip(params: RunVideoClipParams): Promise<RunVideoClipResult> {
  if (params.signal?.aborted) throw new Error('Đã huỷ')

  // 1. Resolve the keyframe to a public URL Kling backend can fetch
  let keyframeUrl: string
  if (isAssetRef(params.keyframeRef)) {
    const resolved = await getUrl(params.keyframeRef)
    if (!resolved) throw new Error('Không tải được keyframe — asset không tồn tại')
    keyframeUrl = resolved
  } else {
    keyframeUrl = params.keyframeRef
  }

  if (params.signal?.aborted) throw new Error('Đã huỷ')

  // 2. Compile the motion prompt from the blueprint
  const promptUsed = compileVideoPrompt(params.blueprint)

  // 3. Submit the Kling job
  params.onStatus?.('queued')
  const { taskId } = await generateVideoJob({
    apiKey: params.apiKey,
    jobModelId: KLING_MODEL_ID,
    prompt: promptUsed,
    aspectRatio: '9:16',  // vertical for FB Reels / TikTok / IG Reels
    resolution: '720p',   // Kling std default
    duration: params.durationSec ?? 5,
    referenceImageUrls: [keyframeUrl],
  })
  params.onStatus?.('processing', taskId)

  // 4. Poll until done
  const remoteVideoUrl = await pollVideoJobUntilDone({
    apiKey: params.apiKey,
    taskId,
    timeoutMs: 6 * 60 * 1000,  // Kling typically completes in 60-120s; 6min ceiling
    onStatusChange: (s) => {
      if (s === 'completed' || s === 'failed') params.onStatus?.(s, taskId)
    },
  })

  if (params.signal?.aborted) throw new Error('Đã huỷ')

  // 5. Fetch the MP4 and persist into the asset store so it survives the
  //    KIE signed-URL TTL.
  const resp = await fetch(remoteVideoUrl)
  if (!resp.ok) throw new Error(`Fetch clip lỗi: ${resp.status}`)
  const blob = await resp.blob()
  const videoRef = await saveAsset(blob, blob.type || 'video/mp4')

  return { videoRef, taskId, promptUsed }
}
