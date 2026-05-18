// ── Smart Recommendation Engine (P30 — Phase 6) ────────────────────────────
//
// After a creative completes, surface 2-3 marketing-logical follow-ups
// so the user keeps producing as a CAMPAIGN, not as one-off renders.
//
// Recommendations come from marketing playbook patterns, not from
// random graph traversal:
//   • a UGC selfie pairs with a WhatsApp proof and a Shopee review
//   • a packshot pairs with a UGC selfie (humanize the studio shot)
//   • a before/after pairs with an infographic (justify the claim)
//   • a Facebook comment thread pairs with a TikTok viral comment
//   • etc.
//
// The engine is INTENT-AWARE — every suggestion includes a short
// reason string so the UI can render "Tạo X vì Y" tooltips. The
// reason is shown in the picker chip.
//
// SCALING RULE: adding a new creative type → add one mapping entry.

import type { AssetTypeId } from '../../types/asset'
import { findCatalogEntry } from '../../uiCatalog/assetCatalog'

export interface Suggestion {
  id: AssetTypeId
  /** Vietnamese marketing rationale shown on the chip / tooltip. */
  reason: string
}

/** Per-creative follow-up map.  Each entry lists 2-4 follow-ups in
 *  priority order. The picker UI surfaces the first N. */
const FOLLOW_UPS: Record<AssetTypeId, Suggestion[]> = {
  // ── social proof family — pair with more proof formats ──────────────
  'whatsapp-proof': [
    { id: 'messenger-chat',  reason: 'Đa dạng kênh trust — bổ sung bằng chứng inbox Messenger' },
    { id: 'shopee-feedback', reason: 'Củng cố bằng review marketplace — khách Việt tin Shopee' },
    { id: 'facebook-comment', reason: 'Thêm engagement cộng đồng dưới bài post' },
  ],
  'messenger-chat': [
    { id: 'whatsapp-proof',  reason: 'Bổ sung trust qua WhatsApp — kênh riêng tư hơn' },
    { id: 'facebook-comment', reason: 'Engagement public — show shop được nhiều người tương tác' },
    { id: 'shopee-feedback', reason: 'Trust số liệu — Shopee review chuẩn ecommerce' },
  ],
  'facebook-comment': [
    { id: 'tiktok-comment',  reason: 'Trigger FOMO Gen Z — bình luận TikTok viral' },
    { id: 'whatsapp-proof',  reason: 'Củng cố với 1-on-1 chat — private trust' },
    { id: 'shopee-feedback', reason: 'Review marketplace bổ sung số liệu rating' },
  ],
  'tiktok-comment': [
    { id: 'facebook-comment', reason: 'Mở rộng audience — Facebook demographic rộng hơn' },
    { id: 'tiktok-feedback', reason: 'TikTok Shop review — biến viral thành conversion' },
    { id: 'whatsapp-proof',  reason: 'Trust private — 1-on-1 chat balance với public viral' },
  ],
  'shopee-feedback': [
    { id: 'tiktok-feedback', reason: 'Mở rộng sang TikTok Shop — Gen Z trust' },
    { id: 'whatsapp-proof',  reason: 'Bổ sung trust kênh chat — không phụ thuộc marketplace' },
    { id: 'infographic',     reason: 'Justify rating bằng thống kê + bullet công dụng' },
  ],
  'tiktok-feedback': [
    { id: 'shopee-feedback', reason: 'Mở rộng cross-platform — Shopee là default audience Việt' },
    { id: 'tiktok-comment',  reason: 'Tăng FOMO — viral comment overlay' },
    { id: 'ugc-tiktok',      reason: 'Match với UGC creator review still cho TikTok ads' },
  ],

  // ── product-explain — justify the purchase ──────────────────────────
  'infographic': [
    { id: 'cta-banner',       reason: 'Pair số liệu với CTA — biến trust thành click' },
    { id: 'before-after',     reason: 'Visual proof bổ sung số liệu — show kết quả cụ thể' },
    { id: 'whatsapp-proof',   reason: 'Customer testimonial pair với data — full conversion stack' },
  ],
  'cta-banner': [
    { id: 'infographic',      reason: 'Justify CTA bằng số liệu hero stat + bullets' },
    { id: 'shopee-feedback',  reason: 'Trust signal trước khi click — review marketplace' },
    { id: 'before-after',     reason: 'Show kết quả ngay trên ads — boost CTR' },
  ],

  // ── pro-photo — humanize the studio ────────────────────────────────
  'product-shot': [
    { id: 'holding-product',  reason: 'Humanize — tay người cầm sản phẩm tăng trust' },
    { id: 'ugc-selfie',       reason: 'Pair packshot studio với selfie thật khách hàng' },
    { id: 'review-table',     reason: 'Macro detail — show chất lượng cận cảnh' },
  ],
  'review-table': [
    { id: 'product-shot',     reason: 'Pair macro với hero packshot — full product set' },
    { id: 'holding-product',  reason: 'Thêm trust qua bàn tay người dùng' },
    { id: 'infographic',      reason: 'Visualize công dụng — từ texture sang số liệu' },
  ],
  'before-after': [
    { id: 'infographic',      reason: 'Justify visual delta bằng số liệu thống kê' },
    { id: 'whatsapp-proof',   reason: 'Customer kể lại quá trình — pair text với hình' },
    { id: 'shopee-feedback',  reason: 'Buyer review marketplace tăng trust kết quả' },
  ],
  'lifestyle-kitchen': [
    { id: 'bathroom-routine', reason: 'Mở rộng routine — sáng đến tối, full functional set' },
    { id: 'holding-product',  reason: 'Pair benefit scene với UGC packshot-with-hands' },
    { id: 'cafe-lifestyle',   reason: 'Đa dạng context — kitchen → cafe → mixed urban set' },
  ],
  'bathroom-routine': [
    { id: 'lifestyle-kitchen', reason: 'Mở rộng routine — bathroom + kitchen full skincare set' },
    { id: 'ugc-selfie',        reason: 'UGC selfie — sản phẩm trong tay người thật routine' },
    { id: 'before-after',      reason: 'Show kết quả routine — proof of efficacy' },
  ],
  'cafe-lifestyle': [
    { id: 'ugc-selfie',       reason: 'Selfie với sản phẩm — vibe urban đồng bộ' },
    { id: 'lifestyle-kitchen', reason: 'Đa dạng context — cafe + home full lifestyle' },
    { id: 'whatsapp-proof',   reason: 'Customer chat trải nghiệm — bổ sung lifestyle bằng trust' },
  ],

  // ── ugc-real — diversify human trust ────────────────────────────────
  'holding-product': [
    { id: 'ugc-selfie',       reason: 'Thêm selfie POV — vibe creator vs studio packshot-hands' },
    { id: 'product-shot',     reason: 'Pair UGC với packshot studio — full product set' },
    { id: 'ugc-tiktok',       reason: 'TikTok review still — mở rộng sang creator content' },
  ],
  'ugc-selfie': [
    { id: 'ugc-tiktok',       reason: 'TikTok review still — vibe creator video frame' },
    { id: 'holding-product',  reason: 'Pair selfie với UGC packshot-with-hands chuẩn' },
    { id: 'whatsapp-proof',   reason: 'Selfie + WhatsApp chat — full UGC trust stack' },
  ],
  'ugc-tiktok': [
    { id: 'tiktok-comment',   reason: 'Pair frame creator với comment viral overlay' },
    { id: 'ugc-selfie',       reason: 'Selfie POV — đồng bộ với TikTok creator content' },
    { id: 'tiktok-feedback',  reason: 'TikTok Shop review — chuyển sang conversion' },
  ],

  // ── coming-soon roadmap items — suggest existing alternates ─────────
  'ingredients-explain': [
    { id: 'infographic',      reason: 'Phiên bản đang triển khai — dùng infographic số liệu trong khi chờ' },
    { id: 'review-table',     reason: 'Macro shot ingredient texture — proof of formulation' },
  ],
  'mechanism-explain': [
    { id: 'infographic',      reason: 'Đang phát triển — dùng infographic số liệu trong khi chờ' },
    { id: 'before-after',     reason: 'Visual cơ chế hoạt động qua kết quả before/after' },
  ],
  'benefit-timeline': [
    { id: 'before-after',     reason: 'Đang phát triển — dùng before/after để show timeline kết quả' },
    { id: 'infographic',      reason: 'Số liệu sau X ngày — pair với hero stat infographic' },
  ],
  'group-holding': [
    { id: 'holding-product',  reason: 'Đang phát triển — bắt đầu với 1 người cầm sản phẩm' },
    { id: 'ugc-selfie',       reason: 'Selfie UGC — diverse face approach' },
  ],
  'collage-4-frames': [
    { id: 'ugc-selfie',       reason: 'Đang phát triển — generate nhiều selfie UGC riêng' },
    { id: 'holding-product',  reason: 'Combine với UGC packshot-with-hands' },
  ],
  'expert-kol': [
    { id: 'infographic',      reason: 'Đang phát triển — dùng infographic authority trong khi chờ' },
    { id: 'whatsapp-proof',   reason: 'Customer testimonial — alternative authority signal' },
  ],
}

/** Return follow-up suggestions for a given creative.
 *  Filters out comingSoon entries by default (the user can't generate
 *  them yet, so suggesting them is confusing). */
export function suggestFollowUps(
  id: AssetTypeId,
  opts: { includeComingSoon?: boolean; limit?: number } = {},
): Suggestion[] {
  const limit = opts.limit ?? 3
  const includeComingSoon = opts.includeComingSoon ?? false
  const raw = FOLLOW_UPS[id] ?? []

  return raw
    .filter((s) => {
      if (includeComingSoon) return true
      const entry = findCatalogEntry(s.id)
      return !entry?.comingSoon
    })
    .slice(0, limit)
}
