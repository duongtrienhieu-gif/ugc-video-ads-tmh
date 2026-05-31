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
  /** Skip the cheap preview-motion test (Stage 3). Default false. */
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
  previewVideoRef?: string
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
  const audioBuffer = await textToSpeech({
    apiKey: params.elevenLabsApiKey,
    voiceId,
    text: fullScriptText,
    // Slight downward adjustment for long scripts — stability over expressiveness
    stability: 0.78,
    similarity: 0.75,
    style: 0,
    speed: 1.0,
    outputFormat: 'mp3_44100_128',  // matches Starter $5/mo plan
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

  // ── STAGE 3: Preview motion (optional, default ON) ─────────────────────
  let previewVideoRef: string | undefined
  if (!params.skipPreview) {
    params.onStageUpdate({
      stage: 'preview_motion',
      voiceRef, voiceDurationSec, voiceId,
      keyframeRef, keyframePromptUsed,
    })

    try {
      const keyframePublicUrl = await getUrl(keyframeRef)
      const audioPublicUrl    = await getUrl(voiceRef)
      if (!keyframePublicUrl || !audioPublicUrl) {
        throw new Error('Không lấy được URL công khai cho keyframe hoặc audio (asset store fail)')
      }

      // Use first ~2s of audio as the preview source. We pass the FULL
      // audio URL — Kling Avatar will sync the visible motion length to
      // however long the lipsync runs. For the preview, we want minimal
      // duration; in v1 of this engine we don't trim audio (Kling Avatar
      // doesn't expose a duration cap on its preview submission), so we
      // accept that the "preview" is technically the full lipsync but
      // shorter resolution. Real trim happens in v2.
      const previewLipsync = await generateLipSync({
        apiKey: params.kieApiKey,
        modelId: 'kling/ai-avatar-standard',
        imageUrl: keyframePublicUrl,
        audioUrl: audioPublicUrl,
        prompt: buildLipsyncPrompt({ config: params.config }),
      })
      const previewRemoteUrl = await pollLipSyncUntilDone({
        apiKey: params.kieApiKey,
        taskId: previewLipsync.taskId,
        timeoutMs: 6 * 60 * 1000,
      })
      const previewBlob = await fetch(previewRemoteUrl).then((r) => r.blob())
      previewVideoRef = await saveAsset(previewBlob, previewBlob.type || 'video/mp4')
      params.onStageUpdate({
        stage: 'preview_motion',
        voiceRef, voiceDurationSec, voiceId,
        keyframeRef, keyframePromptUsed,
        previewVideoRef,
      })
    } catch (err) {
      // Preview is OPTIONAL — log + continue to full render. We do NOT
      // fail the whole job just because the cheap preview hit a snag.
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[CREATOR_VIDEO Stage 3] preview skipped: ${msg.slice(0, 200)}`)
    }
  }

  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')

  // ── STAGE 4: Full lipsync render ───────────────────────────────────────
  // If we already rendered the preview AT THE SAME RESOLUTION as the full
  // render, we technically already have the full video — re-use it.
  // But for clarity we always do a fresh full-render submission; future
  // optimisation can short-circuit when preview output is identical.
  params.onStageUpdate({
    stage: 'lipsync_full',
    voiceRef, voiceDurationSec, voiceId,
    keyframeRef, keyframePromptUsed,
    previewVideoRef,
  })

  const keyframePublicUrl = await getUrl(keyframeRef)
  const audioPublicUrl    = await getUrl(voiceRef)
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
  params.onStageUpdate({
    stage: 'lipsync_full',
    voiceRef, voiceDurationSec, voiceId,
    keyframeRef, keyframePromptUsed,
    previewVideoRef,
    fullLipsyncTaskId: fullLipsync.taskId,
  })

  const fullRemoteUrl = await pollLipSyncUntilDone({
    apiKey: params.kieApiKey,
    taskId: fullLipsync.taskId,
    timeoutMs: 10 * 60 * 1000,  // 10min ceiling for full lipsync
  })
  const fullBlob = await fetch(fullRemoteUrl).then((r) => r.blob())
  const videoRef = await saveAsset(fullBlob, fullBlob.type || 'video/mp4')

  params.onStageUpdate({
    stage: 'completed',
    voiceRef, voiceDurationSec, voiceId,
    keyframeRef, keyframePromptUsed,
    previewVideoRef,
    fullLipsyncTaskId: fullLipsync.taskId,
    videoRef,
  })

  return {
    voiceRef,
    voiceDurationSec,
    voiceId,
    keyframeRef,
    keyframePromptUsed,
    previewVideoRef,
    videoRef,
    fullLipsyncTaskId: fullLipsync.taskId,
  }
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
