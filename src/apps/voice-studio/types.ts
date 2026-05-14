export type Gender = 'Female' | 'Male'
export type Ambience = 'Studio' | 'Small Room'

export interface VoiceOption {
  name: string
  gender: Gender
  style: string
}

// OpenAI-compatible voices available via kie.ai TTS
export const VOICES: VoiceOption[] = [
  { name: 'Nova',    gender: 'Female', style: 'FRIENDLY'   },
  { name: 'Shimmer', gender: 'Female', style: 'GENTLE'     },
  { name: 'Alloy',   gender: 'Female', style: 'NEUTRAL'    },
  { name: 'Echo',    gender: 'Male',   style: 'SMOOTH'     },
  { name: 'Fable',   gender: 'Male',   style: 'EXPRESSIVE' },
  { name: 'Onyx',    gender: 'Male',   style: 'DEEP'       },
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
    voiceName: 'Nova',
    gender: 'Female',
    creativity: 1.3,
    ambience: 'Studio',
    styleInstructions: '',
  }
}
