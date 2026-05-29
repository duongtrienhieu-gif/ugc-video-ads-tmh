// ── Realism Levels (P4) ─────────────────────────────────────────────────────
//
// Realism = how "produced vs raw" the section should look. Cleaner for
// hero/offer/cta; messier for UGC/social-proof/pain. Each level resolves
// to a prompt fragment baked into [REALISM] block.

import type { RealismLevel } from '../../types/continuity'

export interface RealismPreset {
  level: RealismLevel
  prompt: string
}

export const REALISM_PRESETS: Record<RealismLevel, RealismPreset> = {
  'clean-commercial': {
    level: 'clean-commercial',
    prompt:
      'Polished commercial finish, even studio-quality lighting, skin retouched lightly, sharp focus throughout. Not glossy CGI — believable but premium.',
  },
  'ugc-natural': {
    level: 'ugc-natural',
    prompt:
      'Believable UGC feel, phone-camera image quality, natural skin texture with visible pores and minor blemishes, casual framing, soft uneven lighting.',
  },
  'phone-authentic': {
    level: 'phone-authentic',
    prompt:
      'Raw smartphone photo, slight noise in shadows, mild motion blur, imperfect framing, ambient indoor light, no professional polish.',
  },
  'messy-real-life': {
    level: 'messy-real-life',
    prompt:
      'Candid messy-home aesthetic, cluttered background okay, natural daylight, no styling effort, genuine unposed moment, posture imperfections welcome.',
  },
}

export function getRealismPrompt(level: RealismLevel): string {
  return REALISM_PRESETS[level].prompt
}
