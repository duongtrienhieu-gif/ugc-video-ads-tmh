// ── Per-Platform Metrics (P12 authenticity overhaul) ────────────────────────
//
// Each platform owns its own pixel constants — NO shared "generic chat"
// numbers. These match what's observed in real mobile screenshots
// (iPhone 15 Pro / Samsung S24 at native resolution).
//
// Numbers are in pixels at 1080×1920 canvas (3x device pixel ratio of a
// 360pt-wide phone). When the canvas resolution changes, scale these
// proportionally (factor = canvas.width / 1080).

export interface PlatformMetrics {
  /** Max bubble / row width as a fraction of canvas width. */
  bubbleMaxWidthFrac: number
  /** Header (app bar) height in px. */
  headerHeight: number
  /** Header avatar radius. */
  headerAvatarRadius: number
  /** Inline (per-message) avatar radius — 0 means no inline avatar. */
  inlineAvatarRadius: number
  /** Bubble padding X / Y. */
  bubblePaddingX: number
  bubblePaddingY: number
  /** Bubble corner radius. */
  bubbleRadius: number
  /** Gap between consecutive bubbles. */
  bubbleGap: number
  /** Left/right page margin. */
  sideMargin: number
  /** Composer / footer height. */
  footerHeight: number
}

export const WHATSAPP_METRICS: PlatformMetrics = {
  bubbleMaxWidthFrac: 0.72,
  headerHeight:       104,
  headerAvatarRadius: 36,
  inlineAvatarRadius: 0,    // WhatsApp shows no inline avatar in 1:1 chat
  bubblePaddingX:     22,
  bubblePaddingY:     14,
  bubbleRadius:       12,
  bubbleGap:          14,
  sideMargin:         28,
  footerHeight:       110,
}

export const MESSENGER_METRICS: PlatformMetrics = {
  bubbleMaxWidthFrac: 0.66,
  headerHeight:       108,
  headerAvatarRadius: 32,
  inlineAvatarRadius: 22,
  bubblePaddingX:     24,
  bubblePaddingY:     16,
  bubbleRadius:       22,    // Messenger bubbles are noticeably rounder
  bubbleGap:          10,
  sideMargin:         28,
  footerHeight:       110,
}

export const TIKTOK_COMMENT_METRICS: PlatformMetrics = {
  bubbleMaxWidthFrac: 0.78,
  headerHeight:       80,
  headerAvatarRadius: 20,
  inlineAvatarRadius: 26,   // TikTok shows avatar per commenter
  bubblePaddingX:     0,    // TikTok comments are not in bubbles — flat rows
  bubblePaddingY:     12,
  bubbleRadius:       0,
  bubbleGap:          22,   // generous vertical gap between rows
  sideMargin:         24,
  footerHeight:       140,
}

export const FACEBOOK_COMMENT_METRICS: PlatformMetrics = {
  bubbleMaxWidthFrac: 0.74,
  headerHeight:       96,
  headerAvatarRadius: 22,
  inlineAvatarRadius: 26,   // FB shows avatar per commenter
  bubblePaddingX:     20,
  bubblePaddingY:     12,
  bubbleRadius:       20,
  bubbleGap:          14,
  sideMargin:         24,
  footerHeight:       130,
}

export const SHOPEE_METRICS: PlatformMetrics = {
  bubbleMaxWidthFrac: 1.0,
  headerHeight:       96,
  headerAvatarRadius: 24,
  inlineAvatarRadius: 0,
  bubblePaddingX:     20,
  bubblePaddingY:     16,
  bubbleRadius:       8,    // Shopee uses near-square cards
  bubbleGap:          12,
  sideMargin:         32,
  footerHeight:       110,
}

export const TIKTOK_SHOP_METRICS: PlatformMetrics = {
  bubbleMaxWidthFrac: 1.0,
  headerHeight:       102,
  headerAvatarRadius: 26,
  inlineAvatarRadius: 0,
  bubblePaddingX:     24,
  bubblePaddingY:     18,
  bubbleRadius:       12,
  bubbleGap:          14,
  sideMargin:         32,
  footerHeight:       120,
}
