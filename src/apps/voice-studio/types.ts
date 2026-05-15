export type Gender = 'Female' | 'Male'
export type Ambience = 'Studio' | 'Small Room'

// Voice metadata returned from ElevenLabs /v1/voices (or cached locally)
export interface VoiceOption {
  voiceId: string       // ElevenLabs voice_id
  name: string          // display name
  gender: Gender
  style: string         // short label (e.g. "CLONED", "PREMADE", or accent)
  category?: 'cloned' | 'premade' | 'generated' | 'professional'
  previewUrl?: string
}

export interface VoiceSettings {
  voiceId: string
  voiceName: string
  gender: Gender
  creativity: number          // 0-2 → maps to ElevenLabs stability (inverse)
  ambience: Ambience
  styleInstructions: string
}

export function createDefaultSettings(): VoiceSettings {
  return {
    voiceId: '',
    voiceName: '',
    gender: 'Female',
    creativity: 0.8,
    ambience: 'Studio',
    styleInstructions: '',
  }
}
