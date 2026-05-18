// ── Per-Platform Typography (P12 authenticity overhaul) ─────────────────────
//
// Real screenshots use distinctly different type stacks + weights +
// sizes per app. WhatsApp uses iOS SF Text with tighter line-height,
// TikTok uses heavier weights + denser tracking, Shopee uses a
// compressed e-commerce density.
//
// font sizes are in px at 1080px canvas width (3x of a 360pt phone).

export interface PlatformTypography {
  /** Stack used for primary message / comment text. */
  bodyFont: string
  bodySize: number
  bodyLineHeight: number      // multiplier
  bodyWeight: number
  /** Display name / username weight. */
  nameFont: string
  nameSize: number
  nameWeight: number
  /** Timestamp / metadata. */
  metaFont: string
  metaSize: number
  metaWeight: number
  /** Header title (chat partner name etc). */
  headerFont: string
  headerSize: number
  headerWeight: number
}

const SF_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
const ROBOTO_STACK =
  'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif'
const META_STACK =
  '"Segoe UI", "Helvetica Neue", -apple-system, BlinkMacSystemFont, sans-serif'

export const WHATSAPP_TYPO: PlatformTypography = {
  bodyFont:        SF_STACK,
  bodySize:        26,
  bodyLineHeight:  1.32,
  bodyWeight:      400,
  nameFont:        SF_STACK,
  nameSize:        24,
  nameWeight:      500,
  metaFont:        SF_STACK,
  metaSize:        17,
  metaWeight:      400,
  headerFont:      SF_STACK,
  headerSize:      30,
  headerWeight:    600,
}

export const MESSENGER_TYPO: PlatformTypography = {
  bodyFont:        META_STACK,
  bodySize:        26,
  bodyLineHeight:  1.28,
  bodyWeight:      400,
  nameFont:        META_STACK,
  nameSize:        22,
  nameWeight:      600,
  metaFont:        META_STACK,
  metaSize:        18,
  metaWeight:      400,
  headerFont:      META_STACK,
  headerSize:      30,
  headerWeight:    600,
}

export const TIKTOK_TYPO: PlatformTypography = {
  bodyFont:        SF_STACK,
  bodySize:        26,
  bodyLineHeight:  1.26,
  bodyWeight:      400,
  nameFont:        SF_STACK,
  nameSize:        20,
  nameWeight:      600,
  metaFont:        SF_STACK,
  metaSize:        18,
  metaWeight:      500,
  headerFont:      SF_STACK,
  headerSize:      28,
  headerWeight:    700,
}

export const SHOPEE_TYPO: PlatformTypography = {
  bodyFont:        ROBOTO_STACK,
  bodySize:        26,
  bodyLineHeight:  1.34,
  bodyWeight:      400,
  nameFont:        ROBOTO_STACK,
  nameSize:        24,
  nameWeight:      500,
  metaFont:        ROBOTO_STACK,
  metaSize:        20,
  metaWeight:      400,
  headerFont:      ROBOTO_STACK,
  headerSize:      28,
  headerWeight:    700,
}

export const FACEBOOK_TYPO: PlatformTypography = {
  bodyFont:        META_STACK,
  bodySize:        25,
  bodyLineHeight:  1.32,
  bodyWeight:      400,
  nameFont:        META_STACK,
  nameSize:        22,
  nameWeight:      600,
  metaFont:        META_STACK,
  metaSize:        19,
  metaWeight:      500,
  headerFont:      META_STACK,
  headerSize:      28,
  headerWeight:    700,
}

/** Build a CSS font shorthand from a Typography preset selector. */
export function font(
  preset: PlatformTypography,
  role: 'body' | 'name' | 'meta' | 'header',
): string {
  switch (role) {
    case 'body':   return `${preset.bodyWeight}   ${preset.bodySize}px   ${preset.bodyFont}`
    case 'name':   return `${preset.nameWeight}   ${preset.nameSize}px   ${preset.nameFont}`
    case 'meta':   return `${preset.metaWeight}   ${preset.metaSize}px   ${preset.metaFont}`
    case 'header': return `${preset.headerWeight} ${preset.headerSize}px ${preset.headerFont}`
  }
}
