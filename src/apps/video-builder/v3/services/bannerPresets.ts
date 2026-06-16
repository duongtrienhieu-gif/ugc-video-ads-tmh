// ── Top hook banner presets (P5x) ────────────────────────────────────────────
// A slim banner pinned to the TOP of the video carrying a short HOOK/slogan pulled
// from the locked script's KEY (its anchor). Same 0-credit canvas→PNG→overlay path
// as captions/stickers; the assembler holds it over EVERY non-card segment (the
// social-proof FB-post card skips it — it's already a full-frame card).
//
// 4 hand-tuned presets (the user picked these from mockups) — diversity lives ACROSS
// videos (pick a preset), never within one. Two SHAPES: a centred rounded PILL, and a
// full-width RIBBON flush to the top edge. Fonts cover Vietnamese + Malay + English
// (Be Vietnam Pro app-wide; Montserrat/Inter on demand). The pill background is solid/
// near-solid so the hook stays readable over ANY footage (bright or dark).
// ─────────────────────────────────────────────────────────────────────────────

export type BannerPresetId = 'glass_dark' | 'cream_underline' | 'marker' | 'ribbon'

export type BannerShape = 'pill' | 'ribbon'
/** How the ONE emphasised keyword is drawn. */
export type BannerAccentMode = 'color' | 'highlight' | 'underline'

export interface BannerPreset {
  id: BannerPresetId
  labelVi: string
  shape: BannerShape
  /** CSS font-family stack — first family must cover VN+MS+EN. */
  family: string
  weight: string
  /** Banner background fill (the pill / ribbon body). Supports rgba for the glass look. */
  bg: string
  /** Main text colour. */
  text: string
  /** Emphasised-keyword colour (the accentMode decides how it's applied). */
  accent: string
  accentMode: BannerAccentMode
  /** For accentMode 'highlight': the text colour drawn ON the highlight swipe. */
  highlightText?: string
}

export const BANNER_PRESETS: Record<BannerPresetId, BannerPreset> = {
  // 1 — Montserrat (geometric), dark glass pill, amber keyword. Reads on any footage → default.
  glass_dark: {
    id: 'glass_dark', labelVi: 'Glass tối',
    family: `'Montserrat', 'Be Vietnam Pro', sans-serif`, weight: '800', shape: 'pill',
    bg: 'rgba(18,20,22,0.80)', text: '#FFFFFF', accent: '#FAC775', accentMode: 'color',
  },
  // 2 — Be Vietnam Pro (neutral), cream pill, teal keyword + underline (soft / premium).
  cream_underline: {
    id: 'cream_underline', labelVi: 'Kem + gạch nhấn',
    family: `'Be Vietnam Pro', system-ui, sans-serif`, weight: '800', shape: 'pill',
    bg: '#FAF3E6', text: '#2C2C2A', accent: '#0F6E56', accentMode: 'underline',
  },
  // 3 — Baloo 2 (rounded fat), light pill, keyword on a highlighter swipe (young / UGC).
  marker: {
    id: 'marker', labelVi: 'Bút dạ quang',
    family: `'Baloo 2', 'Be Vietnam Pro', sans-serif`, weight: '800', shape: 'pill',
    bg: '#FBF7F0', text: '#2C2C2A', accent: '#FAC775', accentMode: 'highlight', highlightText: '#633806',
  },
  // 4 — Oswald (tall condensed), full-width teal ribbon, amber keyword (promo / authority).
  ribbon: {
    id: 'ribbon', labelVi: 'Ribbon viền trên',
    family: `'Oswald', 'Be Vietnam Pro', sans-serif`, weight: '700', shape: 'ribbon',
    bg: '#0F6E56', text: '#E1F5EE', accent: '#FAC775', accentMode: 'color',
  },
}

export const BANNER_PRESET_ORDER: BannerPresetId[] = [
  'glass_dark', 'cream_underline', 'marker', 'ribbon',
]

export const DEFAULT_BANNER_PRESET: BannerPresetId = 'glass_dark'
