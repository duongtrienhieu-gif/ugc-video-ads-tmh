import type { VoiceSettings } from '../types'
import type { VoiceHistoryItem } from '../../../stores/types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { saveAsset } from '../../../utils/assetStore'
import { textToSpeech } from '../../../utils/elevenlabs'

/**
 * Generate voiceover using ElevenLabs eleven_multilingual_v2.
 * Supports cloned voices (via /voices/add) and library/premade voices.
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

  const audioBuffer = await textToSpeech({
    apiKey,
    voiceId: settings.voiceId,
    text: ttsText,
    stability,
    similarity: 0.75,
    style: 0.3,
    useSpeakerBoost: true,
    modelId: 'eleven_multilingual_v2',
  })

  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
  const assetId = await saveAsset(blob, 'audio/mpeg')

  // Estimate duration: MP3 at 128 kbps ≈ 16 000 bytes/sec
  const duration = Math.round(audioBuffer.byteLength / 16000)

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
