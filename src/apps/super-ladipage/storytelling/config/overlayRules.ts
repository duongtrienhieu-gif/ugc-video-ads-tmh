// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — overlay rules
//
// Anti-ads-vibe guardrail. Max 2 overlay/pack. Allowed = photo-book
// caption / film subtitle / diary timestamp / chapter marker. Banned =
// CTA/headline/promo/benefits — bất kỳ vibe sales nào.
// ─────────────────────────────────────────────────────────────────────

import type { OverlayRules } from '../types'

export const OVERLAY_RULES: OverlayRules = {
  allowedTypes: [
    'chapter-marker',     // "Chương 1" / "Một năm sau."
    'diary-timestamp',    // "Tháng 5, 2024" / "Ba tuần sau."
    'film-subtitle',      // "Tôi đã không nói cho ai biết."
    'photobook-caption',  // "Aishah, một sáng tháng Ba."
  ],

  bannedTypes: [
    'cta-button',
    'headline-banner',
    'benefits-list',
    'badge-sticker',
    'star-rating',
    'price-tag',
    'urgency-strip',
    'sales-copy',
  ],

  /** Hard cap — 2 overlay/pack. Anti-ads-vibe guardrail. */
  maxPerPack: 2,

  styleSpec: {
    fontFamily: 'italic-serif',
    /** Max % canvas width — small, không hero. */
    sizePctMax: 3,
    /** Semi-transparent — không hard layer. */
    opacity: 0.8,
    positions: ['lower-third-left', 'top-left'],
  },

  vibeSelfTestPrompt:
    'Overlay text này có giống caption photo book / film subtitle không, hay giống headline ads? Nếu giống ads — drop overlay.',
}
