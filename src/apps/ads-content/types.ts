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

// ── Output language mode ──────────────────────────────────────────────────
// 'vi' = Vietnamese only · 'ms' = Bahasa Malaysia only (+ VN gloss for the
// operator) · 'both' = both native captions side by side.
export type LangMode = 'vi' | 'ms' | 'both'

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
  /** Angle id (ADS_ANGLES) — the simplified replacement for the old 27 presets. */
  presetId: string
  platform: PlatformId
  /** Which language(s) to output. */
  langMode: LangMode
  lengthMode: LengthMode
  toneIds: ToneId[]
  ctaStrength: CtaStrength
  /** Force educational mechanism explanation. */
  educationalMode: boolean
}

// ── Per-variation output ──────────────────────────────────────────────────
export interface AdsContentVariation {
  /** Local UUID — keyed by React. */
  id: string
  /** Short English label describing this variation's hook angle (badge text). */
  hookLabel: string
  /** 2-3 scroll-stopping headlines to post alongside the video/creative. */
  titles: string[]
  /** Faithful VN gloss of each title — present only when MS is an output language. */
  titlesGlossVi?: string[]
  /** Vietnamese caption — '' when langMode === 'ms'. */
  vietnamese: string
  /** Bahasa Malaysia caption — '' when langMode === 'vi'. */
  malay: string
  /** Faithful VN gloss of the Malay caption so the VN operator understands it. */
  malayGlossVi?: string
}

export interface AdsContentResult {
  variations: AdsContentVariation[]
  presetId: string
  presetLabel: string
  presetGlyph: string
  platform: PlatformId
  platformLabel: string
  langMode: LangMode
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
