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
  /** Colour for the ONE emphasised KEY word per chunk (script keyword / price / number). */
  accent: string
  /** Render the caption in UPPERCASE (extra visual distinctiveness for one preset). */
  upper?: boolean
  /** How the accent word is treated — NO background (user rule), differs per preset:
   *  'color' = colour only · 'underline' = colour + underline · 'glow' = colour + neon glow. */
  accentMode?: 'color' | 'underline' | 'glow'
}

// P5y/P5z — 4 genuinely DISTINCT presets, differing on EVERY axis a no-background caption
// can: font + UPPER/lower case + accent COLOUR + accent TREATMENT (plain colour / underline
// / neon glow). Hard rules (user): NO background on any of them, and ALL must have a dark
// STROKE for readability over any footage. Fonts all cover VN+MS+EN. The accent applies to
// exactly ONE key word per chunk (see captionRenderer) so the highlight is always visible.
export const CAPTION_PRESETS: Record<CaptionPresetId, CaptionPreset> = {
  // Neutral clean sans (Be Vietnam Pro — VN-native, the safe one), plain YELLOW keyword.
  clean_white: {
    id: 'clean_white', labelVi: 'Clean White',
    family: `'Be Vietnam Pro', system-ui, sans-serif`, weight: '700',
    fill: '#FFFFFF', stroke: '#000000', strokeFrac: 0.15, shadow: false, accent: '#FFD400', accentMode: 'color',
  },
  // Geometric heavy, UPPERCASE, thick stroke, plain HOT-PINK keyword — the loud one.
  bold_punch: {
    id: 'bold_punch', labelVi: 'Bold Punch',
    family: `'Montserrat', 'Be Vietnam Pro', sans-serif`, weight: '800',
    fill: '#FFFFFF', stroke: '#000000', strokeFrac: 0.22, shadow: false, accent: '#FF2D7E', upper: true, accentMode: 'color',
  },
  // Rounded friendly, lower-case, ORANGE keyword with an UNDERLINE (+ stroke now).
  soft_premium: {
    id: 'soft_premium', labelVi: 'Tròn mềm',
    family: `'Baloo 2', 'Be Vietnam Pro', sans-serif`, weight: '800',
    fill: '#FFFFFF', stroke: '#000000', strokeFrac: 0.13, shadow: false, accent: '#FF7A00', accentMode: 'underline',
  },
  // Oswald — TALL CONDENSED (a dramatically different silhouette from the other 3),
  // NEON-green keyword with a glow. VN-capable.
  neon_pop: {
    id: 'neon_pop', labelVi: 'Neon Pop',
    family: `'Oswald', 'Be Vietnam Pro', sans-serif`, weight: '700',
    fill: '#FFFFFF', stroke: '#000000', strokeFrac: 0.18, shadow: false, accent: '#19FF6A', accentMode: 'glow',
  },
}

export const CAPTION_PRESET_ORDER: CaptionPresetId[] = [
  'clean_white', 'bold_punch', 'soft_premium', 'neon_pop',
]

export const DEFAULT_CAPTION_PRESET: CaptionPresetId = 'clean_white'
