// ── Caption presets (P5k) ────────────────────────────────────────────────────
// CapCut-style burned caption styles. Each preset is a LOCKED bundle (font + weight
// + colors + stroke/shadow + accent) so a single video is 100% consistent — the fix
// for the old burner's "mỗi frame một font, loạn màu" (libass font-fallback chaos +
// per-word style). Diversity lives ACROSS videos (pick a preset), never within one.
//
// All fonts are vetted to cover Vietnamese + Malay + English glyphs. Be Vietnam Pro
// is already loaded app-wide; Montserrat / Inter are loaded on demand from the Google
// Fonts CDN (see captionRenderer.ensureCaptionFonts) so we don't bundle extra files.
// NO bubble background (per user) — clean text + stroke (or soft shadow) only.
// ─────────────────────────────────────────────────────────────────────────────

export type CaptionPresetId = 'clean_white' | 'bold_punch' | 'soft_premium' | 'neon_pop'

export interface CaptionPreset {
  id: CaptionPresetId
  labelVi: string
  /** CSS font-family stack (canvas `ctx.font`). First family must cover VN+MS+EN;
   *  Be Vietnam Pro is the universal fallback so any missing glyph still renders. */
  family: string
  /** Numeric weight string for ctx.font (the @font-face must provide it). */
  weight: string
  /** Text fill. */
  fill: string
  /** Outline colour (ignored when `shadow` is true). */
  stroke: string
  /** Outline width as a fraction of the font px (0 = no stroke). */
  strokeFrac: number
  /** Soft drop-shadow instead of a hard stroke (premium look). */
  shadow: boolean
  /** Colour for emphasised tokens (price / number / %). '' = same as fill. */
  accent: string
}

export const CAPTION_PRESETS: Record<CaptionPresetId, CaptionPreset> = {
  clean_white: {
    id: 'clean_white', labelVi: 'Clean White',
    family: `'Be Vietnam Pro', system-ui, sans-serif`, weight: '700',
    fill: '#FFFFFF', stroke: '#000000', strokeFrac: 0.16, shadow: false, accent: '#FFD400',
  },
  bold_punch: {
    id: 'bold_punch', labelVi: 'Bold Punch',
    family: `'Montserrat', 'Be Vietnam Pro', sans-serif`, weight: '800',
    fill: '#FFFFFF', stroke: '#000000', strokeFrac: 0.22, shadow: false, accent: '#FFD400',
  },
  soft_premium: {
    id: 'soft_premium', labelVi: 'Soft / Premium',
    family: `'Inter', 'Be Vietnam Pro', sans-serif`, weight: '600',
    fill: '#FFFFFF', stroke: '#000000', strokeFrac: 0, shadow: true, accent: '#FFFFFF',
  },
  neon_pop: {
    id: 'neon_pop', labelVi: 'Neon Pop',
    family: `'Be Vietnam Pro', sans-serif`, weight: '700',
    fill: '#FFFFFF', stroke: '#000000', strokeFrac: 0.18, shadow: false, accent: '#39FF14',
  },
}

export const CAPTION_PRESET_ORDER: CaptionPresetId[] = [
  'clean_white', 'bold_punch', 'soft_premium', 'neon_pop',
]

export const DEFAULT_CAPTION_PRESET: CaptionPresetId = 'clean_white'
