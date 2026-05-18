// ── Designed-Graphic Typography Tokens (P7) ─────────────────────────────────
//
// Scale + family tokens shared across all designed-graphic modules
// (infographic / cta-banner / comparison / promo). P8 modules pick a
// preset by id; or compose a custom typography from these atoms.

import type { DesignedGraphicTypography } from '../../types/designedGraphic'

/** Font family stacks — all browser-safe + DM Sans (already loaded). */
export const FONT_STACK_SANS =
  'DM Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
export const FONT_STACK_SERIF =
  'Charter, "Iowan Old Style", Georgia, "Times New Roman", serif'
export const FONT_STACK_DISPLAY =
  '"DM Sans", "Inter", system-ui, -apple-system, sans-serif'

/** Common scale presets keyed by use-case. Numbers are px at 1080 width. */
export const TYPOGRAPHY_PRESETS: Record<string, DesignedGraphicTypography> = {
  /** Infographic body — wide enough for reading at 4:5 aspect. */
  'infographic-default': {
    displayPx: 84,
    bodyPx:    32,
    captionPx: 22,
    fontStack: FONT_STACK_SANS,
  },
  /** Bigger display for hero stat callouts. */
  'infographic-impact': {
    displayPx: 140,
    bodyPx:    32,
    captionPx: 22,
    fontStack: FONT_STACK_DISPLAY,
  },
  /** CTA banner — bold display, minimal body. */
  'cta-banner-default': {
    displayPx: 96,
    bodyPx:    36,
    captionPx: 26,
    fontStack: FONT_STACK_DISPLAY,
  },
  /** Editorial / news-style scaling. */
  'editorial': {
    displayPx: 72,
    bodyPx:    30,
    captionPx: 22,
    fontStack: FONT_STACK_SERIF,
  },
}

export function findTypography(id: string): DesignedGraphicTypography {
  return TYPOGRAPHY_PRESETS[id] ?? TYPOGRAPHY_PRESETS['infographic-default']
}
