export type Gender = 'Female' | 'Male'
export type Ambience = 'Studio' | 'Small Room'

export interface VoiceOption {
  name: string          // friendly display name
  voiceId: string       // Google Cloud TTS voice name (ms-MY-*)
  gender: Gender
  style: string
}

// Native Malaysian Malay voices from Google Cloud Text-to-Speech (ms-MY locale)
// WaveNet voices = neural quality, trained on Malaysian Malay (Peninsular accent)
export const VOICES: VoiceOption[] = [
  { name: 'Yasmin', voiceId: 'ms-MY-Wavenet-A', gender: 'Female', style: 'FRIENDLY' },
  { name: 'Aisha',  voiceId: 'ms-MY-Wavenet-C', gender: 'Female', style: 'GENTLE'   },
  { name: 'Nurul',  voiceId: 'ms-MY-Standard-A', gender: 'Female', style: 'NEUTRAL'  },
  { name: 'Bunga',  voiceId: 'ms-MY-Standard-C', gender: 'Female', style: 'WARM'     },
  { name: 'Adam',   voiceId: 'ms-MY-Wavenet-B', gender: 'Male',   style: 'CONFIDENT' },
  { name: 'Hakim',  voiceId: 'ms-MY-Wavenet-D', gender: 'Male',   style: 'NEUTRAL'   },
  { name: 'Osman',  voiceId: 'ms-MY-Standard-B', gender: 'Male',   style: 'DEEP'      },
  { name: 'Ariff',  voiceId: 'ms-MY-Standard-D', gender: 'Male',   style: 'YOUTHFUL'  },
]

export interface VoiceSettings {
  voiceName: string
  gender: Gender
  creativity: number
  ambience: Ambience
  styleInstructions: string
}

export function createDefaultSettings(): VoiceSettings {
  return {
    voiceName: 'Yasmin',
    gender: 'Female',
    creativity: 1.0,
    ambience: 'Studio',
    styleInstructions: '',
  }
}
