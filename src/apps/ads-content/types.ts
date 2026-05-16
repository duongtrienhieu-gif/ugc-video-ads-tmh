// ── Platform (where the ad will run) ──────────────────────────────────────
export type PlatformId =
  | 'facebook-feed'
  | 'facebook-reels'
  | 'instagram'
  | 'tiktok'
  | 'advertorial'

export interface PlatformOption {
  id: PlatformId
  label: string
  glyph: string
  hint: string
  /** Sent into the Gemini prompt to shape the output for this surface. */
  promptHint: string
}

// ── Copy length target ────────────────────────────────────────────────────
export type LengthMode = 'short' | 'medium' | 'long' | 'advertorial'

export interface LengthOption {
  id: LengthMode
  label: string
  glyph: string
  targetWords: number
}

// ── Tone modifiers (multi-select chips) ───────────────────────────────────
export type ToneId =
  | 'soft-sell'
  | 'hard-sell'
  | 'emotional'
  | 'curiosity'
  | 'scientific'
  | 'funny'
  | 'luxury'
  | 'female-audience'
  | 'male-audience'
  | 'older-audience'
  | 'young-gen-z'

export interface ToneOption {
  id: ToneId
  label: string
  promptHint: string
}

// ── CTA aggressiveness ────────────────────────────────────────────────────
export type CtaStrength = 'soft' | 'balanced' | 'hard'

// ── Ads-Content preset (copy framework) ───────────────────────────────────
export type PresetCategory = 'hook' | 'story' | 'social' | 'format' | 'mechanism'

export interface AdsContentPreset {
  id: string
  label: string          // Vietnamese label
  hint: string           // Vietnamese one-liner
  glyph: string          // emoji
  category: PresetCategory
  /** English brief sent into the Gemini prompt to shape this preset's output. */
  briefEn: string
  /** Rich Vietnamese tooltip — same shape as script-architect presets. */
  detailVi: {
    mechanism: string
    goals: string[]
    useCase: string[]
    example: string
  }
}

// ── Generation params ─────────────────────────────────────────────────────
export interface AdsContentGenParams {
  productId: string
  presetId: string
  platform: PlatformId
  lengthMode: LengthMode
  toneIds: ToneId[]
  ctaStrength: CtaStrength
  /** Force educational mechanism explanation on classic presets. */
  educationalMode: boolean
}

// ── Per-variation output ──────────────────────────────────────────────────
export interface AdsContentVariation {
  /** Local UUID — keyed by React. */
  id: string
  /** Short English label describing this variation's hook angle (badge text). */
  hookLabel: string
  vietnamese: string
  malay: string
}

export interface AdsContentResult {
  variations: AdsContentVariation[]
  presetId: string
  presetLabel: string
  presetGlyph: string
  platform: PlatformId
  platformLabel: string
  lengthMode: LengthMode
  toneIds: ToneId[]
  ctaStrength: CtaStrength
  educationalMode: boolean
  productId: string
  productName: string
  generatedAt: number
}

// ── Saved item shape (persisted in localStorage) ──────────────────────────
export interface SavedAdsContent {
  id: string
  productId: string
  productName: string
  presetId: string
  presetLabel: string
  presetGlyph: string
  platform: PlatformId
  platformLabel: string
  /** Vietnamese caption */
  vietnamese: string
  /** Malaysian Malay caption */
  malay: string
  /** Hook angle label from the variation */
  hookLabel: string
  /** Friendly user-set title; defaults to "${productName} — ${presetLabel}". */
  title: string
  createdAt: number
}
