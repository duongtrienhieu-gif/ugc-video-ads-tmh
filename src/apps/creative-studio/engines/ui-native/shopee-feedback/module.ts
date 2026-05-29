// ── Shopee Feedback Module (P6) ─────────────────────────────────────────────
//
// Marketplace product review on Shopee — single review card with star
// rating, variant, body, helpful count. Sister of tiktok-feedback.

import type {
  UINativeModule,
  UINativeTextContent,
  UINativeTemplate,
} from '../../../types/uiNative'
import type { GeneratedAsset } from '../../../types/asset'
import { SHOPEE_REVIEW_TEMPLATE } from './template'
import { SHOPEE_EXEMPLARS } from './exemplars'

export const module: UINativeModule = {
  id: 'shopee-feedback',
  engineGroup: 'ui-native',
  label: { vi: 'Đánh giá Shopee', en: 'Shopee buyer review' },
  category: 'marketplace',
  platform: 'shopee',
  // P50 — Malaysia is the primary market for the app's social-proof
  // creatives; the user reported Vietnamese leaking into Shopee/TikTok
  // Shop screenshots when the locale picker wasn't explicitly set. The
  // default now matches the primary market so a fresh session never
  // emits Vietnamese text in a my-MY ad.
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

  defaultExemplars: SHOPEE_EXEMPLARS,

  buildCanvasTemplate(): UINativeTemplate {
    return SHOPEE_REVIEW_TEMPLATE
  },

  buildTextPayload(): Promise<UINativeTextContent> {
    throw new Error('[shopee-feedback] buildTextPayload is invoked by the dispatcher, not direct')
  },

  buildAvatarPayload(text: UINativeTextContent): { prompts: string[]; refs?: string[] }[] {
    return [{ prompts: [text.participants[0]?.avatarHint ?? 'buyer'] }]
  },

  buildProductThumb(): { prompt: string; refs: string[] } | null {
    // MVP: review card can attach the product image from bankStore directly
    // (passed via params.options.productImageUrl). No fresh KIE call.
    return null
  },

  postProcess: 'heavy',

  normalizeOutput(raw, params): GeneratedAsset {
    const now = Date.now()
    return {
      id: `shopee-feedback_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      outputUrl: raw.outputUrl,
      metadata: {
        generatedAt: now,
        assetType: 'shopee-feedback',
        engineGroup: 'ui-native',
        category: 'marketplace',
        productId: raw.productId,
        modelId: params.modelId,
        aspectRatio: '9:16',
        tags: ['ui-native', 'shopee', 'marketplace', 'review'],
        engineExtras: {
          templateId: SHOPEE_REVIEW_TEMPLATE.id,
          uiVintage: SHOPEE_REVIEW_TEMPLATE.uiVintage,
        },
      },
    }
  },
}
