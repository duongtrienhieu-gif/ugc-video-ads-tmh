import type { VoiceSettings } from '../types'
import type { VoiceHistoryItem } from '../../../stores/types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { kieTTS } from '../../../utils/kieai'
import { saveAsset } from '../../../utils/assetStore'

export async function generateVoice(
  settings: VoiceSettings,
  scriptText: string,
): Promise<VoiceHistoryItem> {
  const apiKey = useSettingsStore.getState().getApiKey()

  let ttsText = scriptText
  if (settings.styleInstructions) {
    ttsText = `Say in a ${settings.styleInstructions} style: ${scriptText}`
  }

  const voiceId = settings.voiceName.toLowerCase()
  const audioBuffer = await kieTTS({ apiKey, text: ttsText, voiceId })

  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
  const assetId = await saveAsset(blob, 'audio/mpeg')

  // Estimate duration: MP3 at ~128 kbps ≈ 16 000 bytes/sec
  const duration = Math.round(audioBuffer.byteLength / 16000)

  return {
    id: crypto.randomUUID(),
    voiceName: settings.voiceName,
    voiceId,
    modelId: 'kie-tts',
    scriptText,
    scriptPreview: scriptText.slice(0, 80) + (scriptText.length > 80 ? '...' : ''),
    audioUrl: assetId,
    duration,
    createdAt: Date.now(),
  }
}
