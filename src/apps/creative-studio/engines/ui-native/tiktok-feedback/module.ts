// ── TikTok Shop Feedback Module (P6) ────────────────────────────────────────
//
// Marketplace product review on TikTok Shop. Same shape as shopee-feedback
// but TikTok-flavoured chrome (pink-red accent, different CTA, share icon).

import type {
  UINativeModule,
  UINativeTextContent,
  UINativeTemplate,
} from '../../../types/uiNative'
import type { GeneratedAsset } from '../../../types/asset'
import { TIKTOK_SHOP_REVIEW_TEMPLATE } from './template'
import { TIKTOK_SHOP_EXEMPLARS } from './exemplars'

export const module: UINativeModule = {
  id: 'tiktok-feedback',
  engineGroup: 'ui-native',
  label: { vi: 'Đánh giá TikTok Shop', en: 'TikTok Shop buyer review' },
  category: 'marketplace',
  platform: 'tiktok-shop',
  // P50 — Malaysia primary market; see shopee-feedback/module.ts for
  // the same fix and reasoning.
  defaultLocale: 'my-MY',

  authenticity: {
    requireStatusBar: true,
    requireRealisticTimestamps: true,
    requireImperfectCrop: true,
    requireJpegCompression: true,
    bannedAesthetics: [
      'figma-perfect-edges',
      'studio-clean-screenshot',
      'png-export',
      'desktop-screenshot',
      'rgba-transparency',
    ],
  },

  defaultExemplars: TIKTOK_SHOP_EXEMPLARS,

  buildCanvasTemplate(): UINativeTemplate {
    return TIKTOK_SHOP_REVIEW_TEMPLATE
  },

  buildTextPayload(): Promise<UINativeTextContent> {
    throw new Error('[tiktok-feedback] buildTextPayload is invoked by the dispatcher, not direct')
  },

  buildAvatarPayload(text: UINativeTextContent): { prompts: string[]; refs?: string[] }[] {
    return [{ prompts: [text.participants[0]?.avatarHint ?? 'buyer'] }]
  },

  buildProductThumb(): { prompt: string; refs: string[] } | null {
    return null
  },

  postProcess: 'heavy',

  normalizeOutput(raw, params): GeneratedAsset {
    const now = Date.now()
    return {
      id: `tiktok-feedback_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      outputUrl: raw.outputUrl,
      metadata: {
        generatedAt: now,
        assetType: 'tiktok-feedback',
        engineGroup: 'ui-native',
        category: 'marketplace',
        productId: raw.productId,
        modelId: params.modelId,
        aspectRatio: '9:16',
        tags: ['ui-native', 'tiktok-shop', 'marketplace', 'review'],
        engineExtras: {
          templateId: TIKTOK_SHOP_REVIEW_TEMPLATE.id,
          uiVintage: TIKTOK_SHOP_REVIEW_TEMPLATE.uiVintage,
        },
      },
    }
  },
}
