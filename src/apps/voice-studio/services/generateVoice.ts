import type { VoiceSettings } from '../types'
import type { VoiceHistoryItem } from '../../../stores/types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { saveAsset } from '../../../utils/assetStore'
import { textToSpeech } from '../../../utils/elevenlabs'
import { getFFmpeg } from '../../video-builder/v3/services/ffmpegLoader'
import { fetchFile } from '@ffmpeg/util'

/**
 * Generate voiceover using ElevenLabs eleven_multilingual_v2.
 * Supports cloned voices (via /voices/add) and library/premade voices.
 *
 * Speed handling: eleven_multilingual_v2 silently ignores the
 * `voice_settings.speed` parameter (verified empirically — 0.7x and 1.2x
 * produce identical output). To make the speed slider actually work, we
 * tell ElevenLabs speed=1.0 and apply ffmpeg.wasm's `atempo` filter
 * client-side after the audio comes back. atempo preserves pitch — it
 * doesn't sound chipmunked at fast speeds or doped-up at slow speeds.
 */
export async function generateVoice(
  settings: VoiceSettings,
  scriptText: string,
): Promise<VoiceHistoryItem> {
  const apiKey = useSettingsStore.getState().getElevenLabsApiKey()

  if (!settings.voiceId) {
    throw new Error('Chưa chọn giọng đọc. Vui lòng chọn giọng từ danh sách hoặc clone giọng mới.')
  }

  // Map creativity (0–2) → stability (1.0 → 0.0). More creative = lower stability = more expressive variation.
  const stability = Math.max(0, Math.min(1, 1 - settings.creativity / 2))

  // Style instructions can be prepended in brackets — ElevenLabs v2/v3 understands inline directives
  let ttsText = scriptText
  if (settings.styleInstructions.trim()) {
    ttsText = `[${settings.styleInstructions.trim()}] ${scriptText}`
  }

  // Always request speed=1.0 from ElevenLabs (see header note). We apply
  // the chosen tempo locally after.
  const rawAudioBuffer = await textToSpeech({
    apiKey,
    voiceId: settings.voiceId,
    text: ttsText,
    stability,
    similarity: settings.similarity,
    style: settings.styleExaggeration,
    speed: 1.0,
    useSpeakerBoost: settings.useSpeakerBoost,
    modelId: 'eleven_multilingual_v2',
  })

  const finalBuffer = needsTempoChange(settings.speed)
    ? await applyAtempo(rawAudioBuffer, settings.speed)
    : rawAudioBuffer

  const blob = new Blob([finalBuffer], { type: 'audio/mpeg' })
  const assetId = await saveAsset(blob, 'audio/mpeg')

  // Real duration from decoded metadata. Old code estimated via
  // `byteLength / 16000` assuming 128 kbps but textToSpeech defaults to
  // 192 kbps on Creator+ plans, so the estimate ran ~1.5x too high.
  const duration = Math.round(await measureAudioDuration(blob).catch(() => finalBuffer.byteLength / 24000))

  return {
    id: crypto.randomUUID(),
    voiceName: settings.voiceName,
    voiceId: settings.voiceId,
    modelId: 'eleven_multilingual_v2',
    scriptText,
    scriptPreview: scriptText.slice(0, 80) + (scriptText.length > 80 ? '...' : ''),
    audioUrl: assetId,
    duration,
    createdAt: Date.now(),
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function needsTempoChange(speed: number): boolean {
  return Number.isFinite(speed) && Math.abs(speed - 1.0) > 0.01
}

/** Re-encode the audio at a different tempo via ffmpeg.wasm's atempo filter.
 *  Pitch is preserved; only playback speed changes. Range 0.5–2.0 (single
 *  atempo instance); the UI's 0.7–1.2 slider lives well inside that. */
async function applyAtempo(input: ArrayBuffer, tempo: number): Promise<ArrayBuffer> {
  const ffmpeg = await getFFmpeg()
  const inputBlob = new Blob([input], { type: 'audio/mpeg' })
  const inName  = 'in.mp3'
  const outName = 'out.mp3'
  await ffmpeg.writeFile(inName, await fetchFile(inputBlob))
  await ffmpeg.exec(['-i', inName, '-filter:a', `atempo=${tempo.toFixed(2)}`, '-y', outName])
  const data = await ffmpeg.readFile(outName)
  await ffmpeg.deleteFile(inName).catch(() => {})
  await ffmpeg.deleteFile(outName).catch(() => {})
  const u8 = typeof data === 'string' ? new TextEncoder().encode(data) : data
  // Copy into a plain ArrayBuffer (u8.buffer could be SharedArrayBuffer
  // when running in a cross-origin-isolated worker context).
  const out = new ArrayBuffer(u8.byteLength)
  new Uint8Array(out).set(u8)
  return out
}

/** Measure real audio duration in seconds from a Blob using HTMLAudioElement
 *  metadata — independent of bitrate, so it's accurate regardless of which
 *  output_format ElevenLabs chose (192 kbps default vs 128 kbps fallback). */
function measureAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const d = audio.duration
      URL.revokeObjectURL(url)
      if (!Number.isFinite(d) || d <= 0) reject(new Error('invalid duration metadata'))
      else resolve(d)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('cannot decode audio metadata'))
    }
  })
}
