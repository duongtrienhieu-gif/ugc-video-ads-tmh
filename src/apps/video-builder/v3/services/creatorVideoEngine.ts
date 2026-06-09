// ── Creator Video Engine ─────────────────────────────────────────────────────
// Z32 §6-10 — Orchestrates the full creator video pipeline:
//
//   STAGE 1  TTS         — ElevenLabs synth of the locked script
//                          → MP3 saved to asset store + measured duration
//
//   STAGE 2  KEYFRAME    — KIE GPT-4o image-edit with avatar + product refs
//                          → still PNG saved to asset store
//
//   STAGE 3  PREVIEW     — (optional, default ON) KIE Kling Avatar Std
//                          generates a 1-2s motion test using the keyframe
//                          + a SHORT silent audio clip. Cheap way to
//                          validate identity-lock + motion style BEFORE
//                          paying for the full lipsync.
//
//   STAGE 4  LIPSYNC     — KIE Kling Avatar Std (or InfiniteTalk) takes
//                          the keyframe + full TTS audio → returns the
//                          final talking video. Synced to voice duration.
//
// Each stage writes status patches to the store (caller's responsibility
// to wire onStageUpdate callback). The engine is otherwise self-contained.
//
// Cost: TEST_480 profile → roughly $0.40-0.80 total for a 30s creator video.
// ─────────────────────────────────────────────────────────────────────────────

import { textToSpeech } from '../../../../utils/elevenlabs'
import {
  generateGpt4oImageFast,
  generateLipSync, pollLipSyncUntilDone,
} from '../../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import type { Model, Product } from '../../../../stores/types'
import type {
  CreatorVideoConfig, CreatorVideoStage, GeneratedScript,
} from '../types'
import { VOICE_CATEGORIES } from './voiceCategories'
import type { VoiceCategoryId } from '../types'
import {
  buildKeyframePrompt, buildLipsyncPrompt,
} from './creatorPromptBuilder'

// ── Z53/Z65 — expressive voice settings ─────────────────────────────────────
// Z53 made the voice expressive (vs the old flat reading tone). Z65 tightens
// the PACE: the user found it "từ tốn" (too leisurely) — that came from v3's
// dramatic expressive pauses + the 1.15× speed. Now: speed maxed to 1.2 (the
// ElevenLabs ceiling) and style trimmed 0.40 → 0.28 so it keeps emotion but
// stops the long pauses, giving a snappier TikTok-creator pace. Faster read →
// shorter video → cheaper per-second lipsync. Shared by preview + render.
export const EXPRESSIVE_TTS = {
  stability: 0.45,   // dynamic, not monotone
  similarity: 0.75,
  style: 0.28,       // some emotion, but fewer leisurely pauses (was 0.40)
  speed: 1.2,        // ElevenLabs max — snappiest natural pace (was 1.15)
} as const

// Synthesize the script with eleven_v3 attempted FIRST (auto-falls back to
// multilingual_v2 if the key/plan lacks v3) + the expressive settings. Reports
// the model that actually rendered via onModelUsed.
async function synthVoice(args: {
  apiKey: string
  voiceId: string
  text: string
  onModelUsed?: (model: string) => void
}): Promise<ArrayBuffer> {
  return textToSpeech({
    apiKey: args.apiKey,
    voiceId: args.voiceId,
    text: args.text,
    modelId: 'eleven_v3',   // try v3 (expressive); falls back to v2 internally
    stability: EXPRESSIVE_TTS.stability,
    similarity: EXPRESSIVE_TTS.similarity,
    style: EXPRESSIVE_TTS.style,
    speed: EXPRESSIVE_TTS.speed,
    outputFormat: 'mp3_44100_128',
    onModelUsed: args.onModelUsed,
  })
}

// ── Stage update callbacks ─────────────────────────────────────────────────

export interface StageUpdate {
  stage: CreatorVideoStage
  /** Asset refs produced so far (cumulative, never erased) */
  voiceRef?: string
  voiceDurationSec?: number
  voiceId?: string
  keyframeRef?: string
  keyframePromptUsed?: string
  previewVideoRef?: string
  fullLipsyncTaskId?: string
  videoRef?: string
  /** Set on failed stage */
  error?: string
}

export interface RenderCreatorVideoParams {
  kieApiKey: string
  elevenLabsApiKey: string
  config: CreatorVideoConfig
  /** Z31 — the locked script from Phase 2. We TTS the concatenation of all blocks. */
  script: GeneratedScript
  /** Z31 voice category — drives WPM/timing + the fallback ElevenLabs voiceId */
  voiceCategory: VoiceCategoryId
  /** User-chosen ElevenLabs voiceId (custom/clone or library voice picked in
   *  Bước 2). When set it OVERRIDES the category's default voiceId for TTS.
   *  Category is still used for timing estimation. null/undefined = use default. */
  voiceId?: string | null
  /** Avatar Model — drives keyframe identity lock */
  avatar: Model
  /** Product (optional — shown in frame only if config.setting is product_demo) */
  product: Product | null
  /** @deprecated Z38 — the preview stage was removed (it was a duplicate
   *  full-length render that double-charged). Kept for call-site back-compat;
   *  the engine ignores it. */
  skipPreview?: boolean
  /** Per-stage status callback. Engine calls this BEFORE each stage starts. */
  onStageUpdate: (update: StageUpdate) => void
  /** Cancel signal — checked between stages. */
  signal?: AbortSignal
}

export interface RenderCreatorVideoResult {
  voiceRef: string
  voiceDurationSec: number
  voiceId: string
  keyframeRef: string
  keyframePromptUsed: string
  videoRef: string
  fullLipsyncTaskId: string
}

// ── Public entry ───────────────────────────────────────────────────────────

export async function renderCreatorVideo(
  params: RenderCreatorVideoParams,
): Promise<RenderCreatorVideoResult> {
  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')

  // ── STAGE 1: TTS via ElevenLabs ────────────────────────────────────────
  params.onStageUpdate({ stage: 'tts' })
  const voiceCategory = VOICE_CATEGORIES[params.voiceCategory]
  // User-picked voice (custom/clone or library) overrides the category default.
  const voiceId = params.voiceId?.trim() || voiceCategory.defaultVoiceId
  const fullScriptText = params.script.blocks.map((b) => b.text).join(' ')

  const voiceSource = params.voiceId?.trim() ? 'user-picked' : `category:${voiceCategory.labelVi}`
  console.log(`[CREATOR_VIDEO Stage 1] TTS voice=${voiceSource} (${voiceId}) chars=${fullScriptText.length}`)
  // Z53 — expressive synth (eleven_v3 first → v2 fallback) so the render matches
  // the "Nghe thử giọng" preview the user approved before paying for lipsync.
  const audioBuffer = await synthVoice({
    apiKey: params.elevenLabsApiKey,
    voiceId,
    text: fullScriptText,
    onModelUsed: (m) => console.log(`[CREATOR_VIDEO Stage 1] TTS model=${m}`),
  })

  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')

  const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
  const voiceRef = await saveAsset(audioBlob, 'audio/mpeg')
  const voiceDurationSec = await measureAudioDurationSec(audioBlob)
  params.onStageUpdate({
    stage: 'tts',
    voiceRef,
    voiceDurationSec,
    voiceId,
  })

  // ── STAGE 2: Keyframe via KIE GPT-4o ───────────────────────────────────
  params.onStageUpdate({
    stage: 'keyframe',
    voiceRef, voiceDurationSec, voiceId,
  })

  // Resolve reference images FIRST so the prompt can reference each by its
  // ACTUAL position in filesUrl. Order: avatar (identity, primary) then the
  // product (optional). Only send the product image when we actually show it
  // in frame, so the prompt never references an image we didn't send.
  const refUrls: string[] = []
  let avatarRefIndex = 0
  let productRefIndex = 0

  if (params.avatar.characterImage) {
    const url = isAssetRef(params.avatar.characterImage)
      ? await getUrl(params.avatar.characterImage)
      : params.avatar.characterImage
    if (url) { refUrls.push(url); avatarRefIndex = refUrls.length }
  }

  const showProductInFrame = params.config.setting === 'product_demo' && !!params.product
  if (showProductInFrame && params.product?.productImage) {
    const url = isAssetRef(params.product.productImage)
      ? await getUrl(params.product.productImage)
      : params.product.productImage
    if (url) { refUrls.push(url); productRefIndex = refUrls.length }
  }

  const keyframePromptUsed = buildKeyframePrompt({
    config: params.config,
    avatar: params.avatar,
    product: params.product,
    showProductInFrame,
    avatarRefIndex,
    productRefIndex,
  })
  console.log(`[CREATOR_VIDEO Stage 2] keyframe prompt len=${keyframePromptUsed.length}`)

  const keyframeRemoteUrl = await generateGpt4oImageFast({
    apiKey: params.kieApiKey,
    prompt: keyframePromptUsed,
    filesUrl: refUrls,
    size: '2:3',  // closest GPT-4o supports to vertical 9:16
    softTimeoutMs: 60_000,
    attemptTimeoutMs: 90_000,
    maxAttempts: 2,
    signal: params.signal,
  })

  // Persist keyframe
  const keyframeBlob = await fetch(keyframeRemoteUrl).then((r) => r.blob())
  const keyframeRef = await saveAsset(keyframeBlob, keyframeBlob.type || 'image/png')
  params.onStageUpdate({
    stage: 'keyframe',
    voiceRef, voiceDurationSec, voiceId,
    keyframeRef, keyframePromptUsed,
  })

  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')

  // ── STAGE: Lipsync render — SINGLE Kling pass ──────────────────────────
  // Z38 — there used to be a separate "preview" Kling render before this one
  // that submitted the SAME model + SAME full audio (kling/ai-avatar-standard
  // with the whole TTS track). It was NOT a cheap 1-2s test — it was a second,
  // identical, full-length lipsync. So every render quietly paid Kling TWICE.
  // A real ~81s render is ~730 KIE credits, so "preview + full" burned ~1.4k
  // for one video. The preview stage is DELETED. We submit ONE job, persist
  // its taskId BEFORE polling so a timeout/refresh can RESUME the already-paid
  // job (resumeCreatorVideoLipsync) instead of re-submitting and charging again.
  params.onStageUpdate({
    stage: 'lipsync_full',
    voiceRef, voiceDurationSec, voiceId,
    keyframeRef, keyframePromptUsed,
  })

  const keyframePublicUrl = await getUrl(keyframeRef)
  const audioPublicUrl    = await getUrl(voiceRef)
  if (!keyframePublicUrl || !audioPublicUrl) {
    throw new Error('Không lấy được URL công khai cho keyframe hoặc audio (asset store fail)')
  }

  // Z72 — Lipsync history: Kling Standard (Z53, baseline) → InfiniteTalk 480p
  // (15s audio cap → 100% fail on real ads) → Kling Pro (works, ~21 cr/s, $4/40s
  // — too expensive for the user) → BACK to Kling AI Avatar Standard. Standard
  // supports the same 5-minute audio as Pro and costs ~half the credit (~10
  // cr/s @720p vs Pro 21 cr/s @1080p). User accepts the lower realism tier as
  // the cost trade-off; cheap + reliable beats expensive + idle.
  const fullLipsync = await generateLipSync({
    apiKey: params.kieApiKey,
    modelId: 'kling/ai-avatar-standard',
    imageUrl: keyframePublicUrl,
    audioUrl: audioPublicUrl,
    prompt: buildLipsyncPrompt({ config: params.config }),
  })
  // Persist taskId IMMEDIATELY — the job is now paid for. If polling below
  // times out, this handle lets the user re-poll without paying again.
  params.onStageUpdate({
    stage: 'lipsync_full',
    voiceRef, voiceDurationSec, voiceId,
    keyframeRef, keyframePromptUsed,
    fullLipsyncTaskId: fullLipsync.taskId,
  })

  const videoRef = await pollAndSaveLipsync({
    apiKey: params.kieApiKey,
    taskId: fullLipsync.taskId,
    timeoutMs: 15 * 60 * 1000,  // 15min ceiling — 60-90s avatar renders are slow
  })

  params.onStageUpdate({
    stage: 'completed',
    voiceRef, voiceDurationSec, voiceId,
    keyframeRef, keyframePromptUsed,
    fullLipsyncTaskId: fullLipsync.taskId,
    videoRef,
  })

  return {
    voiceRef,
    voiceDurationSec,
    voiceId,
    keyframeRef,
    keyframePromptUsed,
    videoRef,
    fullLipsyncTaskId: fullLipsync.taskId,
  }
}

// ── Resume a paid-but-unfinished lipsync job ────────────────────────────────
// Z38 — when the poll above times out (or the user refreshed mid-render), the
// Kling job is STILL running on KIE's side and was already charged. We persist
// its taskId, so this re-polls the SAME job and saves the result. It NEVER
// submits a new job → it does NOT spend any more credit.

export interface ResumeLipsyncParams {
  kieApiKey: string
  /** The fullLipsyncTaskId persisted from a prior (timed-out) render. */
  taskId: string
  onStageUpdate: (update: StageUpdate) => void
  /** Max wait before giving up again. Default 15min. */
  timeoutMs?: number
  signal?: AbortSignal
}

export async function resumeCreatorVideoLipsync(
  params: ResumeLipsyncParams,
): Promise<{ videoRef: string }> {
  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')
  console.log(`[CREATOR_VIDEO resume] re-polling paid task ${params.taskId} (no new charge)`)
  params.onStageUpdate({ stage: 'lipsync_full', fullLipsyncTaskId: params.taskId })

  const videoRef = await pollAndSaveLipsync({
    apiKey: params.kieApiKey,
    taskId: params.taskId,
    timeoutMs: params.timeoutMs ?? 15 * 60 * 1000,
  })

  params.onStageUpdate({ stage: 'completed', fullLipsyncTaskId: params.taskId, videoRef })
  return { videoRef }
}

/** Poll a Kling lipsync task to completion, then download + persist the MP4. */
async function pollAndSaveLipsync(args: {
  apiKey: string
  taskId: string
  timeoutMs: number
}): Promise<string> {
  const remoteUrl = await pollLipSyncUntilDone({
    apiKey: args.apiKey,
    taskId: args.taskId,
    timeoutMs: args.timeoutMs,
  })
  const blob = await fetch(remoteUrl).then((r) => r.blob())
  return saveAsset(blob, blob.type || 'video/mp4')
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Measure the actual duration of an MP3 by playing it through the
 *  HTMLAudioElement metadata. Falls back to estimating from byte size
 *  if metadata-load fails (rough — assumes 128kbps). */
async function measureAudioDurationSec(audioBlob: Blob): Promise<number> {
  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(audioBlob)
    const audio = new Audio()
    let settled = false
    const finish = (sec: number) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      resolve(Number(sec.toFixed(2)))
    }
    audio.addEventListener('loadedmetadata', () => {
      finish(isFinite(audio.duration) ? audio.duration : estimateFromSize(audioBlob.size))
    })
    audio.addEventListener('error', () => finish(estimateFromSize(audioBlob.size)))
    // Safety timeout — fall back to estimate after 5s of nothing
    setTimeout(() => finish(estimateFromSize(audioBlob.size)), 5000)
    audio.src = url
  })
}

function estimateFromSize(bytes: number): number {
  // 128 kbps = 16 KB/s → bytes / 16384
  return Math.max(1, bytes / 16384)
}

// ── Z53 — voice-only preview ────────────────────────────────────────────────
// Runs ONLY the TTS step (no keyframe, no Kling lipsync) so the user can hear
// the actual script in the chosen voice — with the expressive settings + the
// eleven_v3 attempt — BEFORE paying for the expensive lipsync. Returns the
// audio blob (caller plays it via an <audio> element) plus which model
// actually rendered (so the UI can show "v3 expressive" vs "v2 fallback").
export interface VoicePreviewResult {
  audioBlob: Blob
  modelUsed: string
  durationSec: number
}

export async function previewCreatorVoice(args: {
  elevenLabsApiKey: string
  script: GeneratedScript
  voiceCategory: VoiceCategoryId
  voiceId?: string | null
}): Promise<VoicePreviewResult> {
  const voiceCategory = VOICE_CATEGORIES[args.voiceCategory]
  const voiceId = args.voiceId?.trim() || voiceCategory.defaultVoiceId
  const fullScriptText = args.script.blocks.map((b) => b.text).join(' ')
  if (!fullScriptText.trim()) throw new Error('Chưa có kịch bản để nghe thử')

  let modelUsed = 'eleven_multilingual_v2'
  console.log(`[VOICE_PREVIEW] voiceId=${voiceId} chars=${fullScriptText.length} — TTS only, no lipsync`)
  const buffer = await synthVoice({
    apiKey: args.elevenLabsApiKey,
    voiceId,
    text: fullScriptText,
    onModelUsed: (m) => { modelUsed = m },
  })
  const audioBlob = new Blob([buffer], { type: 'audio/mpeg' })
  const durationSec = await measureAudioDurationSec(audioBlob)
  console.log(`[VOICE_PREVIEW] done model=${modelUsed} dur=${durationSec}s`)
  return { audioBlob, modelUsed, durationSec }
}
