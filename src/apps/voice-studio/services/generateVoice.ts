import type { VoiceSettings } from '../types'
import type { VoiceHistoryItem } from '../../../stores/types'
import { VOICES } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { saveAsset } from '../../../utils/assetStore'

const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize'

/**
 * Google Cloud Text-to-Speech with native Malaysian Malay voices (ms-MY).
 * Reuses the same Google API key as Gemini — user must enable
 * "Cloud Text-to-Speech API" in their Google Cloud project.
 */
export async function generateVoice(
  settings: VoiceSettings,
  scriptText: string,
): Promise<VoiceHistoryItem> {
  const apiKey = useSettingsStore.getState().getGoogleTtsApiKey()

  // Map friendly name → Google voice ID
  const voice = VOICES.find((v) => v.name === settings.voiceName)
  if (!voice) throw new Error(`Không tìm thấy giọng đọc: ${settings.voiceName}`)
  const googleVoiceId = voice.voiceId

  // Map creativity (0–2) → speaking rate (0.75–1.25) for natural variation
  const speakingRate = 0.75 + (settings.creativity / 2) * 0.5

  // Apply ambience as effects profile
  const effectsProfileId =
    settings.ambience === 'Small Room' ? ['small-bluetooth-speaker-class-device'] : ['headphone-class-device']

  const body = {
    input: { text: scriptText },
    voice: { languageCode: 'ms-MY', name: googleVoiceId },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate,
      effectsProfileId,
    },
  }

  const res = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    if (res.status === 403) {
      throw new Error('API key chưa bật "Cloud Text-to-Speech API". Vào Google Cloud Console → APIs & Services → Library → bật Cloud Text-to-Speech API.')
    }
    if (res.status === 400) {
      throw new Error(`Yêu cầu không hợp lệ: ${errText.slice(0, 200)}`)
    }
    throw new Error(`Google TTS lỗi (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as { audioContent?: string }
  if (!data.audioContent) throw new Error('Google TTS không trả về audio')

  // Decode base64 → Uint8Array → Blob
  const binary = atob(data.audioContent)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'audio/mpeg' })
  const assetId = await saveAsset(blob, 'audio/mpeg')

  // Estimate duration: MP3 at ~24 kbps (Google default) ≈ 3000 bytes/sec
  const duration = Math.round(bytes.byteLength / 3000)

  return {
    id: crypto.randomUUID(),
    voiceName: settings.voiceName,
    voiceId: googleVoiceId,
    modelId: 'google-cloud-tts',
    scriptText,
    scriptPreview: scriptText.slice(0, 80) + (scriptText.length > 80 ? '...' : ''),
    audioUrl: assetId,
    duration,
    createdAt: Date.now(),
  }
}
