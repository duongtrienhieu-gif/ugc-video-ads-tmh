// Shared canvas geometry. All Konva components measure from these constants
// so changes to header/footer height or safe-zone propagate consistently.

export const CANVAS_SIZE = 1080            // square, TikTok Shop required
export const HEADER_HEIGHT = 100           // Tier 1 — logo + store name + flag chip
export const FOOTER_HEIGHT = 90            // Tier 1 — trust bar (logistics, return, etc.)
export const CONTENT_TOP = HEADER_HEIGHT
export const CONTENT_BOTTOM = CANVAS_SIZE - FOOTER_HEIGHT
export const CONTENT_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP   // 890

// Safe zone — text/logo never inside this margin. Mobile thumbnail crop can
// chew up to 5-8% on each edge; 60px gives ~5.5% buffer at 1080.
export const SAFE_X_LEFT  = 60
export const SAFE_X_RIGHT = CANVAS_SIZE - 60
export const SAFE_INNER_WIDTH = SAFE_X_RIGHT - SAFE_X_LEFT   // 960

export const FONT_FAMILY = 'Plus Jakarta Sans'

// Typography hierarchy at 1080px canvas scale.
// Min size 24px = ~7px on a 300px thumbnail — still readable.
export const FONT_SIZE = {
  hero:        96,     // big claim (slot 1, 8)
  headline:    64,     // section titles
  numericHuge: 144,    // stats (slot 3 metric)
  subheadline: 36,
  body:        24,
  caption:     18,
  disclaimer:  14,
} as const
