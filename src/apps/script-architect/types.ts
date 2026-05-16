// ── Tone modifiers — multi-select toggle chips ───────────────────────────
export type ToneModifier =
  | 'hard-sell'
  | 'soft-sell'
  | 'emotional'
  | 'scientific'
  | 'funny'
  | 'luxury'
  | 'aggressive-hook'
  | 'female-audience'
  | 'male-audience'
  | 'older-audience'
  | 'young-tiktok'

export interface ToneOption {
  id: ToneModifier
  label: string
  /** Sent verbatim into the Gemini prompt. */
  promptHint: string
}

export type HookStrength = 'safe' | 'balanced' | 'aggressive'
export type LengthSeconds = 15 | 30 | 45 | 60

// ── Script preset (framework, not random AI style) ──────────────────────
export interface ScriptPreset {
  id: string
  /** Vietnamese label shown in the UI. */
  label: string
  /** Vietnamese one-line hint. */
  hint: string
  /** Visual glyph (emoji or symbol). */
  glyph: string
  category: 'classic' | 'educational'
  /** All five fields below are sent verbatim into the Gemini prompt — they
   *  define HOW the script should sound, not just the wording. */
  hookFormula: string
  pacingNote: string
  emotionalAngle: string
  ctaStyle: string
  proofStyle: string
}

// ── Structured internal output (future-ready for storyboard mapping) ────
export interface ScriptStructured {
  hook: string
  pain: string
  /** Only populated when educationalMode is ON. */
  whyItHappens?: string
  /** Only populated when educationalMode is ON. */
  ingredientMechanism?: string
  solution: string
  benefits: string
  proof: string
  cta: string
  emotionalTone: string
  pacing: string
  audienceAngle: string
}

export interface ScriptGenerationParams {
  productId: string
  presetId: string
  lengthSec: LengthSeconds
  hookStrength: HookStrength
  toneModifiers: ToneModifier[]
  educationalMode: boolean
}

export interface ScriptGenerationResult {
  english: string
  malay: string
  /** Optional — parsed from <<<STRUCTURED>>>; null if Gemini didn't return valid JSON. */
  structured: ScriptStructured | null
  /** Echoed back so the UI can render badges + the save flow can store metadata. */
  presetId: string
  presetLabel: string
  lengthSec: LengthSeconds
  hookStrength: HookStrength
  toneModifiers: ToneModifier[]
  educationalMode: boolean
}
