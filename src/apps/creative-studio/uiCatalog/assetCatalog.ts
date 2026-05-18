// ── Asset Catalog (P11) ─────────────────────────────────────────────────────
//
// User-facing metadata for every asset type in ASSET_REGISTRY. This is the
// UI layer's source of truth for:
//   • Which asset types to display in the picker
//   • Grouping (photographic / ui-native / designed-graphic)
//   • Display label / description / platform badge / aspect / icon
//
// The UI layer NEVER mutates prompts or talks to KIE directly — it just
// builds a payload and calls generateAssets(assetType, payload). All
// routing happens inside the registry.

import type { AssetTypeId } from '../types/asset'
import type { EngineGroup } from '../types/engine'

export interface AssetCatalogEntry {
  /** Must match a key in ASSET_REGISTRY. */
  id: AssetTypeId
  /** Engine group — drives visual identity + controls. */
  group: EngineGroup
  /** Display title (Vietnamese first per Phase 7 spec). */
  title: { vi: string; en: string }
  /** Short description shown under the title. */
  description: { vi: string; en: string }
  /** Output aspect ratio for the badge. */
  aspectRatio: '1:1' | '4:5' | '9:16' | '3:2' | '16:9'
  /** Platform / category badge text (eg "WhatsApp", "Photo", "Banner"). */
  platformBadge: string
  /** Static preview thumbnail URL (relative to /public). Optional. */
  previewUrl?: string
  /** Lucide icon name string — resolved by the picker. */
  iconKey: string
}

/**
 * 17 entries — one per ASSET_REGISTRY key. Ordered within each group by
 * "most common use case first". P11 ships labels matching the user spec
 * (eg "WhatsApp Feedback" over the internal asset id `whatsapp-proof`).
 */
export const ASSET_CATALOG: AssetCatalogEntry[] = [
  // ── PHOTOGRAPHIC ───────────────────────────────────────────────────
  {
    id: 'product-shot',
    group: 'photographic',
    title: { vi: 'Ảnh sản phẩm', en: 'Product shot' },
    description: { vi: 'Packshot studio sạch, label rõ ràng', en: 'Clean studio packshot, label clear' },
    aspectRatio: '1:1',
    platformBadge: 'Photo',
    iconKey: 'package',
  },
  {
    id: 'holding-product',
    group: 'photographic',
    title: { vi: 'Cầm sản phẩm', en: 'Holding product' },
    description: { vi: 'Tay người cầm SP trước camera', en: 'Person holding product at camera' },
    aspectRatio: '1:1',
    platformBadge: 'Photo',
    iconKey: 'package',
  },
  {
    id: 'ugc-selfie',
    group: 'photographic',
    title: { vi: 'UGC Selfie', en: 'UGC selfie' },
    description: { vi: 'Selfie smartphone cùng SP, vibe TikTok', en: 'Selfie with product, TikTok vibe' },
    aspectRatio: '1:1',
    platformBadge: 'Photo',
    iconKey: 'userRound',
  },
  {
    id: 'review-table',
    group: 'photographic',
    title: { vi: 'Review trên bàn', en: 'Desk review' },
    description: { vi: 'Flat-lay top-down trên bàn gỗ', en: 'Top-down flat-lay on wood' },
    aspectRatio: '1:1',
    platformBadge: 'Photo',
    iconKey: 'layoutGrid',
  },
  {
    id: 'before-after',
    group: 'photographic',
    title: { vi: 'Before / After', en: 'Before / After' },
    description: { vi: 'Split frame transformation', en: 'Split-frame transformation' },
    aspectRatio: '1:1',
    platformBadge: 'Photo',
    iconKey: 'arrowRightLeft',
  },
  {
    id: 'lifestyle-kitchen',
    group: 'photographic',
    title: { vi: 'Bếp sáng', en: 'Kitchen lifestyle' },
    description: { vi: 'Bếp buổi sáng, nắng cửa sổ', en: 'Bright morning kitchen' },
    aspectRatio: '1:1',
    platformBadge: 'Photo',
    iconKey: 'sun',
  },
  {
    id: 'bathroom-routine',
    group: 'photographic',
    title: { vi: 'Bathroom routine', en: 'Bathroom routine' },
    description: { vi: 'Skincare routine marble bathroom', en: 'Skincare morning routine' },
    aspectRatio: '1:1',
    platformBadge: 'Photo',
    iconKey: 'sparkles',
  },
  {
    id: 'cafe-lifestyle',
    group: 'photographic',
    title: { vi: 'Cafe lifestyle', en: 'Cafe lifestyle' },
    description: { vi: 'Bàn cafe có cappuccino và laptop', en: 'Cafe table moment' },
    aspectRatio: '1:1',
    platformBadge: 'Photo',
    iconKey: 'coffee',
  },
  {
    id: 'ugc-tiktok',
    group: 'photographic',
    title: { vi: 'UGC TikTok', en: 'UGC TikTok' },
    description: { vi: 'Phone-camera review style, ring-light', en: 'Phone review TikTok still' },
    aspectRatio: '1:1',
    platformBadge: 'TikTok',
    iconKey: 'video',
  },

  // ── UI-NATIVE ──────────────────────────────────────────────────────
  {
    id: 'whatsapp-proof',
    group: 'ui-native',
    title: { vi: 'WhatsApp Feedback', en: 'WhatsApp feedback' },
    description: { vi: 'Testimonial chat thread WhatsApp như thật', en: 'Authentic WhatsApp testimonial' },
    aspectRatio: '9:16',
    platformBadge: 'WhatsApp',
    iconKey: 'messageCircle',
  },
  {
    id: 'messenger-chat',
    group: 'ui-native',
    title: { vi: 'Messenger Chat', en: 'Messenger chat' },
    description: { vi: 'Conversation Facebook Messenger', en: 'Facebook Messenger conversation' },
    aspectRatio: '9:16',
    platformBadge: 'Messenger',
    iconKey: 'messagesSquare',
  },
  {
    id: 'shopee-feedback',
    group: 'ui-native',
    title: { vi: 'Shopee Review', en: 'Shopee review' },
    description: { vi: 'Đánh giá người mua Shopee 5 sao', en: 'Shopee buyer 5-star review' },
    aspectRatio: '9:16',
    platformBadge: 'Shopee',
    iconKey: 'shoppingBag',
  },
  {
    id: 'tiktok-feedback',
    group: 'ui-native',
    title: { vi: 'TikTok Shop Review', en: 'TikTok Shop review' },
    description: { vi: 'Đánh giá người mua TikTok Shop', en: 'TikTok Shop buyer review' },
    aspectRatio: '9:16',
    platformBadge: 'TikTok Shop',
    iconKey: 'shoppingBag',
  },
  {
    id: 'facebook-comment',
    group: 'ui-native',
    title: { vi: 'Facebook Comments', en: 'Facebook comments' },
    description: { vi: 'Thread bình luận Facebook post', en: 'Facebook post comment thread' },
    aspectRatio: '9:16',
    platformBadge: 'Facebook',
    iconKey: 'messageSquare',
  },
  {
    id: 'tiktok-comment',
    group: 'ui-native',
    title: { vi: 'TikTok Comments', en: 'TikTok comments' },
    description: { vi: 'Comment overlay TikTok video, dark theme', en: 'TikTok comment overlay' },
    aspectRatio: '9:16',
    platformBadge: 'TikTok',
    iconKey: 'video',
  },

  // ── DESIGNED-GRAPHIC ───────────────────────────────────────────────
  {
    id: 'infographic',
    group: 'designed-graphic',
    title: { vi: 'Infographic', en: 'Infographic' },
    description: { vi: 'Hero stat + bullets + footnote', en: 'Hero stat + bullets + footnote' },
    aspectRatio: '4:5',
    platformBadge: 'Banner',
    iconKey: 'barChart3',
  },
  {
    id: 'cta-banner',
    group: 'designed-graphic',
    title: { vi: 'CTA Banner', en: 'CTA banner' },
    description: { vi: 'Banner promo với headline + offer + CTA', en: 'Promo banner with headline + offer + CTA' },
    aspectRatio: '4:5',
    platformBadge: 'Banner',
    iconKey: 'megaphone',
  },
]

/** Group metadata — visual identity per engine group. */
export interface GroupMeta {
  group: EngineGroup
  title: { vi: string; en: string }
  description: { vi: string; en: string }
  /** Tailwind gradient classes for the group card border / accent. */
  accentClass: string
  /** Tailwind bg classes for the card hover. */
  cardBgClass: string
}

export const GROUP_META: GroupMeta[] = [
  {
    group: 'photographic',
    title: { vi: 'Ảnh photographic', en: 'Photographic' },
    description: { vi: 'AI photo generation — KIE GPT-4o image-to-image', en: 'AI photo via KIE GPT-4o' },
    accentClass: 'border-rose-200',
    cardBgClass: 'bg-gradient-to-br from-rose-50/60 to-white hover:from-rose-100/60',
  },
  {
    group: 'ui-native',
    title: { vi: 'UI-native screenshot', en: 'UI-native screenshot' },
    description: { vi: 'Canvas template + AI avatar — mobile UI thật', en: 'Canvas template + AI avatar' },
    accentClass: 'border-indigo-200',
    cardBgClass: 'bg-gradient-to-br from-indigo-50/60 to-white hover:from-indigo-100/60',
  },
  {
    group: 'designed-graphic',
    title: { vi: 'Designed graphic', en: 'Designed graphic' },
    description: { vi: 'Layout + typography + design tokens', en: 'Layout + typography + tokens' },
    accentClass: 'border-amber-200',
    cardBgClass: 'bg-gradient-to-br from-amber-50/60 to-white hover:from-amber-100/60',
  },
]

export function findCatalogEntry(id: AssetTypeId): AssetCatalogEntry | null {
  return ASSET_CATALOG.find((e) => e.id === id) ?? null
}

export function listCatalogByGroup(group: EngineGroup): AssetCatalogEntry[] {
  return ASSET_CATALOG.filter((e) => e.group === group)
}
