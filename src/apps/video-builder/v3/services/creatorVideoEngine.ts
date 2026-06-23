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

import { textToSpeech, textToSpeechWithTimestamps, type TtsTimestamps } from '../../../../utils/elevenlabs'
import {
  generateGpt4oImageFast,
  generateNanoBanana2,
  generateLipSync, pollLipSyncUntilDone,
} from '../../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import { getFFmpeg } from './ffmpegLoader'
import type { Model, Product } from '../../../../stores/types'
import type {
  CreatorVideoConfig, CreatorVideoStage, GeneratedScript, VoiceAlignment, ScriptLang,
} from '../types'
import { VOICE_CATEGORIES } from './voiceCategories'
import type { VoiceCategoryId } from '../types'
import {
  buildKeyframePrompt, buildLipsyncPrompt,
} from './creatorPromptBuilder'

// ── Z53/Z65/Z81 — expressive voice settings ─────────────────────────────────
// Z53 made the voice expressive. Z65 tried to fix the "từ tốn" (too leisurely)
// pace by raising the `speed` voice-setting to 1.2 — but that DID NOTHING,
// because eleven_v3 (the expressive model we use) SILENTLY IGNORES the `speed`
// param (it's only honoured by eleven_multilingual_v2). So the render kept
// coming out at ~1.0× while the UI claimed 1.2×.
// Z81 fix: we no longer rely on the API `speed`. We synth at neutral 1.0 and
// then time-stretch the audio with ffmpeg `atempo` (pitch-preserving) to TARGET
// pace below — works for BOTH models, and preview === render. `speed` here is
// the atempo TARGET, not the API value.
export const EXPRESSIVE_TTS = {
  stability: 0.45,   // dynamic, not monotone
  similarity: 0.75,
  style: 0.28,       // some emotion, but fewer leisurely pauses (was 0.40)
  speed: 1.2,        // Z98 — reverted 1.35 → 1.2. 1.35 read "như gió" (too fast)
                     // and risked Kling lipsync drift, which would knock the
                     // whole director timeline off. 1.2 is the natural-but-snappy
                     // pace. atempo TARGET, applied post-TTS via ffmpeg (v3 ignores
                     // the API speed param). Also matches the 215-wpm estimate,
                     // which was calibrated for ~1.2×.
} as const

// P6e — PER-LANGUAGE TTS pace. Malay at 1.2× read "như gió" / lipsync drifted, so MY
// drops to 1.15×; VN (+ everything else) stays the natural-but-snappy 1.2×. This is the
// atempo TARGET (applied post-TTS); the voice-timing estimator's MS rate is lowered to
// match so the Bước-1 "~Xs" gợi ý stays accurate.
const TTS_SPEED_BY_LANG: Partial<Record<ScriptLang, number>> = { ms: 1.15 }
function ttsSpeedForLang(lang?: ScriptLang): number {
  return (lang && TTS_SPEED_BY_LANG[lang]) || EXPRESSIVE_TTS.speed
}

// Z81 — time-stretch the TTS audio to a target pace (pitch-preserving) via
// ffmpeg atempo. This is the ONLY reliable way to control pace because v3
// ignores the API speed param. Fallback: on ANY ffmpeg error, return the
// original audio unchanged so the voice never breaks.
// Z98 — returns the (possibly) sped-up audio AND the tempo that was ACTUALLY
// achieved. On any ffmpeg failure the audio stays 1.0× and tempoApplied=1, so the
// caller can build the word-alignment against the REAL pace instead of blindly
// assuming 1.2× (which desynced every scene by ~20% whenever atempo silently
// fell back — the "gợi ý 74s ra thực 84s" bug).
async function applyTempo(audio: ArrayBuffer, tempo: number): Promise<{ audio: ArrayBuffer; tempoApplied: number }> {
  if (!Number.isFinite(tempo) || Math.abs(tempo - 1) < 0.01) return { audio, tempoApplied: 1 }
  try {
    const ffmpeg = await getFFmpeg()
    const id = Math.random().toString(36).slice(2, 8)
    const inName = `tts_${id}.mp3`
    const outName = `tts_${id}_fast.mp3`
    await ffmpeg.writeFile(inName, new Uint8Array(audio))
    // atempo valid range is 0.5–2.0 per pass; our 1.2 is well within it.
    await ffmpeg.exec(['-i', inName, '-filter:a', `atempo=${tempo.toFixed(3)}`, '-y', outName])
    const data = await ffmpeg.readFile(outName)
    await ffmpeg.deleteFile(inName).catch(() => {})
    await ffmpeg.deleteFile(outName).catch(() => {})
    const arr = data instanceof Uint8Array ? data : new Uint8Array()
    if (arr.byteLength === 0) return { audio, tempoApplied: 1 }  // safety — empty output → kept original 1.0×
    return { audio: arr.slice().buffer, tempoApplied: tempo }
  } catch (err) {
    console.warn('[TTS atempo] failed — using original (1.0×) speed', err)
    return { audio, tempoApplied: 1 }
  }
}

// Synthesize the script with eleven_v3 attempted FIRST (auto-falls back to
// multilingual_v2 if the key/plan lacks v3) + the expressive settings. Reports
// the model that actually rendered via onModelUsed.
async function synthVoice(args: {
  apiKey: string
  voiceId: string
  text: string
  lang?: ScriptLang
  onModelUsed?: (model: string) => void
}): Promise<ArrayBuffer> {
  const raw = await textToSpeech({
    apiKey: args.apiKey,
    voiceId: args.voiceId,
    text: args.text,
    modelId: 'eleven_v3',   // try v3 (expressive); falls back to v2 internally
    stability: EXPRESSIVE_TTS.stability,
    similarity: EXPRESSIVE_TTS.similarity,
    style: EXPRESSIVE_TTS.style,
    speed: 1.0,             // Z81 — neutral; real pace applied via atempo below
    outputFormat: 'mp3_44100_128',
    onModelUsed: args.onModelUsed,
  })
  // Z81 — apply the snappy pace ourselves (v3 ignores the API speed param). P6e — per-lang.
  return (await applyTempo(raw, ttsSpeedForLang(args.lang))).audio
}

// Z98 (#6) — map raw ElevenLabs char timings onto the FINAL atempo'd audio.
// atempo is a linear time-scale, so every spoken second compresses by 1/speed.
// We expand to ONE entry per code unit so `text.length === charStartSecs.length`
// always holds — ElevenLabs usually returns single chars, but a multi-char token
// would otherwise desync the index lookup the planner relies on.
function toVoiceAlignment(raw: TtsTimestamps, tempo: number, model: string): VoiceAlignment {
  const speed = Number.isFinite(tempo) && tempo > 0 ? tempo : 1
  const text: string[] = []
  const charStartSecs: number[] = []
  for (let i = 0; i < raw.characters.length; i++) {
    const tok = raw.characters[i] ?? ''
    const t = Number(((raw.characterStartTimesSeconds[i] ?? 0) / speed).toFixed(3))
    for (let k = 0; k < tok.length; k++) { text.push(tok[k]); charStartSecs.push(t) }
  }
  return { text: text.join(''), charStartSecs, model }
}

// Z98 (#6) — HYBRID timestamped TTS. Try eleven_v3 (expressive) WITH timestamps
// first; if v3 returns no alignment OR errors, try multilingual_v2 (guaranteed
// timing). Audio + alignment ALWAYS come from the SAME call — different models
// render different durations, so pairing v3 audio with v2 timing would mis-place
// every scene. If NO model yields alignment we keep the best audio we got (or
// fall back to plain synthVoice) and return alignment=null → the planner falls
// back to the WPM estimate. The TTS itself never breaks.
async function synthVoiceTimed(args: {
  apiKey: string
  voiceId: string
  text: string
  lang?: ScriptLang
  onModelUsed?: (model: string) => void
}): Promise<{ audio: ArrayBuffer; alignment: VoiceAlignment | null }> {
  const ttsSpeed = ttsSpeedForLang(args.lang)   // P6e — MY 1.15×, else 1.2×
  // Z98 — pre-warm ffmpeg.wasm IN PARALLEL with the TTS network call so it's
  // ready by the time applyTempo runs (atempo silently fell back to 1.0× when
  // ffmpeg wasn't loaded yet). Best-effort: applyTempo awaits the same singleton.
  void getFFmpeg().catch(() => {})
  let fallbackAudio: ArrayBuffer | null = null
  let fallbackModel = ''
  for (const model of ['eleven_v3', 'eleven_multilingual_v2'] as const) {
    try {
      const res = await textToSpeechWithTimestamps({
        apiKey: args.apiKey,
        voiceId: args.voiceId,
        text: args.text,
        modelId: model,
        stability: EXPRESSIVE_TTS.stability,
        similarity: EXPRESSIVE_TTS.similarity,
        style: EXPRESSIVE_TTS.style,
        speed: 1.0,                       // pace applied via atempo below, not the API
        outputFormat: 'mp3_44100_128',
      })
      if (res.alignment) {
        args.onModelUsed?.(model)
        // Z98 — build the alignment against the tempo ACTUALLY achieved, not the
        // requested 1.2×. If atempo silently fell back to 1.0×, tempoApplied=1 and
        // the word timings now match the real (un-sped) audio → no 20% desync.
        const { audio, tempoApplied } = await applyTempo(res.buffer, ttsSpeed)
        return { audio, alignment: toVoiceAlignment(res.alignment, tempoApplied, model) }
      }
      // Audio came back but with no timing — remember it only if nothing better
      // turns up, then try the next (more timing-reliable) model.
      if (!fallbackAudio) { fallbackAudio = res.buffer; fallbackModel = model }
      console.warn(`[TTS timed] ${model} returned audio without alignment — trying next model`)
    } catch (err) {
      console.warn(`[TTS timed] ${model} failed`, err)
    }
  }
  // No alignment from any model — use the best timing-less audio we captured…
  if (fallbackAudio) {
    args.onModelUsed?.(fallbackModel)
    return { audio: (await applyTempo(fallbackAudio, ttsSpeed)).audio, alignment: null }
  }
  // …or, if every timestamped call failed outright, the original plain path.
  console.warn('[TTS timed] all timestamped calls failed — plain TTS (no timing)')
  return { audio: await synthVoice(args), alignment: null }
}

// Z98 B2 — VOICE-FIRST. Synthesize the REAL voice (TTS only, NO keyframe) so the
// director at Step 2 can read the actual measured duration + per-word timing
// before deciding how many B-roll scenes to cut and where. The exact same audio
// is reused at Step 3 for lipsync (no second TTS charge). Mirrors Stage 1 of
// renderCreatorKeyframe, which now calls this too.
export async function generateCreatorVoice(params: {
  elevenLabsApiKey: string
  script: GeneratedScript
  voiceCategory: VoiceCategoryId
  voiceId?: string | null
  /** P6e — output language → picks the TTS pace (MY 1.15×, else 1.2×). */
  lang?: ScriptLang
  signal?: AbortSignal
}): Promise<{ voiceRef: string; voiceDurationSec: number; voiceId: string; voiceAlignment?: VoiceAlignment }> {
  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')
  const voiceCategory = VOICE_CATEGORIES[params.voiceCategory]
  const voiceId = params.voiceId?.trim() || voiceCategory.defaultVoiceId
  const fullScriptText = params.script.blocks.map((b) => b.text).join(' ')
  console.log(`[VOICE-FIRST] TTS voice=${voiceId} lang=${params.lang ?? 'vi'} speed=${ttsSpeedForLang(params.lang)} chars=${fullScriptText.length}`)
  const { audio, alignment } = await synthVoiceTimed({
    apiKey: params.elevenLabsApiKey,
    voiceId,
    text: fullScriptText,
    lang: params.lang,
    onModelUsed: (m) => console.log(`[VOICE-FIRST] TTS model=${m}`),
  })
  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')
  const audioBlob = new Blob([audio], { type: 'audio/mpeg' })
  const voiceRef = await saveAsset(audioBlob, 'audio/mpeg')
  const voiceDurationSec = await measureAudioDurationSec(audioBlob)
  console.log(
    `[VOICE-FIRST] done dur=${voiceDurationSec.toFixed(1)}s timing=${alignment
      ? `REAL (${alignment.model}, ${alignment.charStartSecs.length} chars)`
      : 'estimate (no alignment)'}`,
  )
  return { voiceRef, voiceDurationSec, voiceId, voiceAlignment: alignment ?? undefined }
}

// ── Stage update callbacks ─────────────────────────────────────────────────

export interface StageUpdate {
  stage: CreatorVideoStage
  /** Asset refs produced so far (cumulative, never erased) */
  voiceRef?: string
  voiceDurationSec?: number
  voiceId?: string
  /** Z98 (#6) — real per-character voice timing (when timestamped TTS succeeded). */
  voiceAlignment?: VoiceAlignment
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

export interface RenderKeyframeResult {
  voiceRef: string
  voiceDurationSec: number
  voiceId: string
  keyframeRef: string
  keyframePromptUsed: string
  /** Z98 (#6) — real per-character voice timing (absent if timestamped TTS failed). */
  voiceAlignment?: VoiceAlignment
  /** P6av — Hybrid 2-keyframe: a SECOND keyframe of the SAME creator HOLDING the product,
   *  used for lips lines that mention/point at the product (so the talking head isn't static).
   *  Best-effort: absent if the toggle is off / no product / the gen failed → lips fall back
   *  to keyframeRef (KF-A). */
  keyframeProductRef?: string
}

// Z95 — STAGE 1+2 ONLY (TTS + keyframe). STOPS at 'keyframe_ready' so the user
// reviews/regenerates the CHEAP keyframe (~6cr) BEFORE paying for the EXPENSIVE
// lipsync (~600cr). Pass reuseVoice* to regenerate ONLY the keyframe without
// re-synthesizing (and re-paying for) the voice.
export async function renderCreatorKeyframe(
  params: RenderCreatorVideoParams & {
    reuseVoiceRef?: string
    reuseVoiceDurationSec?: number
    reuseVoiceId?: string
    reuseVoiceAlignment?: VoiceAlignment
    /** P6e — output language → TTS pace (MY 1.15×, else 1.2×). */
    lang?: ScriptLang
    /** P6av — also generate KF-B (same creator HOLDING the product) for product-mention lips. */
    withProductKeyframe?: boolean
  },
): Promise<RenderKeyframeResult> {
  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')

  let voiceRef: string
  let voiceDurationSec: number
  let voiceId: string
  let voiceAlignment: VoiceAlignment | undefined

  if (params.reuseVoiceRef) {
    // Regenerate keyframe ONLY — reuse the already-paid voice (no new TTS cost). Guard on the
    // voice REF alone: the default voice is stored with an empty voiceId (''), so requiring
    // reuseVoiceId here would wrongly fall through to a new TTS charge. voiceId is metadata only.
    voiceRef = params.reuseVoiceRef
    voiceDurationSec = params.reuseVoiceDurationSec ?? 0
    voiceId = params.reuseVoiceId ?? params.voiceId ?? ''
    voiceAlignment = params.reuseVoiceAlignment
  } else {
    // ── STAGE 1: TTS via ElevenLabs (same routine voice-first uses at Step 2) ──
    params.onStageUpdate({ stage: 'tts' })
    const voice = await generateCreatorVoice({
      elevenLabsApiKey: params.elevenLabsApiKey,
      script: params.script,
      voiceCategory: params.voiceCategory,
      voiceId: params.voiceId,
      lang: params.lang,
      signal: params.signal,
    })
    voiceRef = voice.voiceRef
    voiceDurationSec = voice.voiceDurationSec
    voiceId = voice.voiceId
    voiceAlignment = voice.voiceAlignment
    params.onStageUpdate({ stage: 'tts', voiceRef, voiceDurationSec, voiceId, voiceAlignment })
  }

  // ── STAGE 2: Keyframe via KIE GPT-4o ───────────────────────────────────
  params.onStageUpdate({ stage: 'keyframe', voiceRef, voiceDurationSec, voiceId, voiceAlignment })

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
  // P6aa — keyframe (khuôn mặt) generation with a MODEL FALLBACK. Primary = gpt-4o-image (strong
  // ref-preservation). When KIE's gpt-4o-image endpoint is STUCK/overloaded (the "stuck queue —
  // quá 90s" timeout the user hit repeatedly), DON'T just fail — fall back to nano-banana-2 (a
  // DIFFERENT KIE endpoint, also ref-preserving per CLAUDE.md, same avatar/product refs + portrait
  // ratio) so a single-endpoint outage no longer blocks the whole video.
  let keyframeRemoteUrl: string
  try {
    keyframeRemoteUrl = await generateGpt4oImageFast({
      apiKey: params.kieApiKey,
      prompt: keyframePromptUsed,
      filesUrl: refUrls,
      size: '2:3',
      softTimeoutMs: 60_000,
      attemptTimeoutMs: 90_000,
      maxAttempts: 2,
      signal: params.signal,
    })
  } catch (e) {
    console.warn('[CREATOR_VIDEO Stage 2] gpt-4o-image kẹt → fallback nano-banana-2:', e)
    keyframeRemoteUrl = await generateNanoBanana2({
      apiKey: params.kieApiKey,
      prompt: keyframePromptUsed,
      imageInput: refUrls,
      aspectRatio: '2:3',
      resolution: '1K',
      signal: params.signal,
    })
  }
  const keyframeBlob = await fetch(keyframeRemoteUrl).then((r) => r.blob())
  const keyframeRef = await saveAsset(keyframeBlob, keyframeBlob.type || 'image/png')

  // ── P6av — STAGE 2b: KF-B = the SAME creator HOLDING the product (for lips lines that
  // mention/point at it, so the talking head isn't static). Generated by i2i FROM KF-A
  // (identity + outfit lock) + the product image → face/outfit match KF-A; product stays the
  // real one. Best-effort: any failure leaves keyframeProductRef undefined → lips fall back to
  // KF-A (never breaks the flow). Only runs when the toggle is on AND a product exists.
  let keyframeProductRef: string | undefined
  if (params.withProductKeyframe && params.product?.productImage) {
    try {
      const kfaUrl = await getUrl(keyframeRef)
      const prodImg = params.product.productImage
      const prodUrl = isAssetRef(prodImg) ? await getUrl(prodImg) : prodImg
      const refs2 = [kfaUrl, prodUrl].filter((x): x is string => !!x)
      if (refs2.length === 2) {
        const promptB =
          `Edit reference image #1 (a creator talking to camera). KEEP the EXACT SAME person — same ` +
          `face, hair/hijab, OUTFIT and background as reference #1 — but now they are HOLDING the ` +
          `product from reference image #2 with both hands at CHEST height, presenting it toward the ` +
          `camera while talking (mouth slightly open, natural, friendly). The product is the EXACT ` +
          `product from reference #2 — same packaging, colour, label; do NOT redesign or swap it. ` +
          `Render-safe: product held steady against the body, NOT up near the face, NOT rotating, no ` +
          `floating object. HANDS anatomically correct — exactly five fingers per hand, natural relaxed ` +
          `grip, fingers do NOT pass through, merge with, or bend around the product; no extra, missing, ` +
          `or malformed fingers/thumbs. Exactly ONE product in frame (do NOT duplicate or add a second). ` +
          `Vertical 9:16 authentic UGC photo, identical lighting to reference #1.`
        let urlB: string
        try {
          urlB = await generateGpt4oImageFast({ apiKey: params.kieApiKey, prompt: promptB, filesUrl: refs2, size: '2:3', softTimeoutMs: 60_000, attemptTimeoutMs: 90_000, maxAttempts: 2, signal: params.signal })
        } catch {
          urlB = await generateNanoBanana2({ apiKey: params.kieApiKey, prompt: promptB, imageInput: refs2, aspectRatio: '2:3', resolution: '1K', signal: params.signal })
        }
        const blobB = await fetch(urlB).then((r) => r.blob())
        keyframeProductRef = await saveAsset(blobB, blobB.type || 'image/png')
      }
    } catch (e) {
      console.warn('[CREATOR_VIDEO Stage 2b] KF-B (creator cầm sản phẩm) gen lỗi → lips dùng KF-A:', e)
    }
  }

  // Z95 — STOP at keyframe_ready (awaiting approval). NO lipsync yet.
  params.onStageUpdate({
    stage: 'keyframe_ready',
    voiceRef, voiceDurationSec, voiceId, keyframeRef, keyframePromptUsed, voiceAlignment,
  })
  return { voiceRef, voiceDurationSec, voiceId, keyframeRef, keyframePromptUsed, voiceAlignment, keyframeProductRef }
}

export interface RenderLipsyncResult { videoRef: string; fullLipsyncTaskId: string }

// Z95 — STAGE 3 ONLY. Lipsync the APPROVED keyframe with the already-paid voice.
// Persists the taskId BEFORE polling so a timeout/refresh can RESUME the paid
// job (resumeCreatorVideoLipsync) instead of re-submitting + re-charging.
export async function renderCreatorLipsync(params: {
  kieApiKey: string
  config: CreatorVideoConfig
  voiceRef: string
  keyframeRef: string
  onStageUpdate: (u: StageUpdate) => void
  signal?: AbortSignal
}): Promise<RenderLipsyncResult> {
  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')
  params.onStageUpdate({ stage: 'lipsync_full' })

  const keyframePublicUrl = await getUrl(params.keyframeRef)
  const audioPublicUrl    = await getUrl(params.voiceRef)
  if (!keyframePublicUrl || !audioPublicUrl) {
    throw new Error('Không lấy được URL công khai cho keyframe hoặc audio (asset store fail)')
  }
  const fullLipsync = await generateLipSync({
    apiKey: params.kieApiKey,
    modelId: 'kling/ai-avatar-standard',
    imageUrl: keyframePublicUrl,
    audioUrl: audioPublicUrl,
    prompt: buildLipsyncPrompt({ config: params.config }),
  })
  // Paid now — persist taskId so a timeout can resume without paying again.
  params.onStageUpdate({ stage: 'lipsync_full', fullLipsyncTaskId: fullLipsync.taskId })

  const videoRef = await pollAndSaveLipsync({
    apiKey: params.kieApiKey,
    taskId: fullLipsync.taskId,
    timeoutMs: 15 * 60 * 1000,
  })
  params.onStageUpdate({ stage: 'completed', fullLipsyncTaskId: fullLipsync.taskId, videoRef })
  return { videoRef, fullLipsyncTaskId: fullLipsync.taskId }
}

// ── POC (Phase 0) — SEGMENTED lipsync ───────────────────────────────────────
// Proves the hybrid direction: lip-sync only a SHORT span of the voice instead of
// the full ~60s (~500cr). Kling Avatar generates the mouth FROM the audio, so a
// sliced 4s clip's mouth matches exactly those 4s of speech — placed back at the
// same span on the master TTS track, it stays in sync inherently. A few ~32cr
// short cuts then replace the one ~500cr full lipsync.
//
// ADDITIVE — does NOT touch renderCreatorLipsync (the existing full path stays
// 100% intact). This is a standalone capability for the POC + the future hybrid
// director; nothing else calls it yet.
export async function renderLipsyncSegment(params: {
  kieApiKey: string
  config: CreatorVideoConfig
  /** The FULL TTS audio (asset ref) — we slice it, never re-synthesize. */
  voiceRef: string
  /** The creator keyframe (asset ref) — the talking face. */
  keyframeRef: string
  startSec: number
  endSec: number
}): Promise<{ videoRef: string; segVoiceRef: string; durSec: number }> {
  const startSec = Math.max(0, params.startSec)
  const durSec = Math.max(0.5, params.endSec - startSec)

  // 1. Slice the voice [startSec, startSec+durSec] with ffmpeg (re-encode for an
  //    accurate cut — mp3 stream-copy cuts land on the nearest frame, not exact).
  const fullUrl = await getUrl(params.voiceRef)
  if (!fullUrl) throw new Error('Không lấy được audio gốc (voiceRef)')
  const audioBytes = new Uint8Array(await (await fetch(fullUrl)).arrayBuffer())
  const ffmpeg = await getFFmpeg()
  const id = Math.random().toString(36).slice(2, 8)
  const inName = `seg_${id}_in.mp3`
  const outName = `seg_${id}_out.mp3`
  await ffmpeg.writeFile(inName, audioBytes)
  await ffmpeg.exec([
    '-ss', startSec.toFixed(3), '-i', inName, '-t', durSec.toFixed(3),
    '-c:a', 'libmp3lame', '-q:a', '4', '-y', outName,
  ])
  const outData = await ffmpeg.readFile(outName)
  await ffmpeg.deleteFile(inName).catch(() => {})
  await ffmpeg.deleteFile(outName).catch(() => {})
  const outArr = outData instanceof Uint8Array ? outData : new Uint8Array()
  if (outArr.byteLength === 0) throw new Error('Cắt audio thất bại (output rỗng)')
  const segVoiceRef = await saveAsset(new Blob([outArr.slice()], { type: 'audio/mpeg' }), 'audio/mpeg')
  console.log(`[LIPSYNC-SEG] sliced voice [${startSec.toFixed(2)}s..${(startSec + durSec).toFixed(2)}s] → ${outArr.byteLength} bytes`)

  // 2. Lip-sync the SLICED audio + the creator keyframe → a short talking clip.
  const keyframePublicUrl = await getUrl(params.keyframeRef)
  const segAudioPublicUrl = await getUrl(segVoiceRef)
  if (!keyframePublicUrl || !segAudioPublicUrl) {
    throw new Error('Không lấy được URL công khai (keyframe / segment audio)')
  }
  // FIX — segments are SHORT (0.5–6s). Kling Avatar Standard is the LONG-FORM model
  // (max 5 min) and consistently fails ("internal error, please try again later") on
  // these micro-clips. InfiniteTalk is the SHORT-audio lip-sync model (≤15s, ~3cr/s)
  // and is the right tool for per-scene segments. The FULL creator video keeps Kling
  // Avatar (renderCreatorLipsync) — only the hybrid segment path switches here.
  const job = await generateLipSync({
    apiKey: params.kieApiKey,
    modelId: 'infinitalk/from-audio',
    imageUrl: keyframePublicUrl,
    audioUrl: segAudioPublicUrl,
    prompt: buildLipsyncPrompt({ config: params.config }),
    resolution: '480p',
  })
  console.log(`[LIPSYNC-SEG] infinitalk job ${job.taskId} submitted (dur≈${durSec.toFixed(1)}s, audio=${outArr.byteLength}B)`)
  const videoRef = await pollAndSaveLipsync({
    apiKey: params.kieApiKey,
    taskId: job.taskId,
    timeoutMs: 15 * 60 * 1000,
  })
  return { videoRef, segVoiceRef, durSec }
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
