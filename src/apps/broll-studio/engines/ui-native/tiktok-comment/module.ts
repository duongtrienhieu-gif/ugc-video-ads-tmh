// ── TikTok Comment Overlay Module (P6) ──────────────────────────────────────
//
// Social-comment proof on TikTok. Dark theme overlay over a video peek.
// Shares the comment-thread text content shape with facebook-comment but
// renders with TikTok's distinct dark aesthetic.

import type {
  UINativeModule,
  UINativeTextContent,
  UINativeTemplate,
} from '../../../types/uiNative'
import type { GeneratedAsset } from '../../../types/asset'
import { TIKTOK_COMMENT_TEMPLATE } from './template'
import { TIKTOK_COMMENT_EXEMPLARS } from './exemplars'

export const module: UINativeModule = {
  id: 'tiktok-comment',
  engineGroup: 'ui-native',
  label: { vi: 'Bình luận TikTok', en: 'TikTok comment overlay' },
  category: 'social-comment',
  platform: 'tiktok-comment',
  defaultLocale: 'vi-VN',

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

  defaultExemplars: TIKTOK_COMMENT_EXEMPLARS,

  buildCanvasTemplate(): UINativeTemplate {
    return TIKTOK_COMMENT_TEMPLATE
  },

  buildTextPayload(): Promise<UINativeTextContent> {
    throw new Error('[tiktok-comment] buildTextPayload is invoked by the dispatcher, not direct')
  },

  buildAvatarPayload(text: UINativeTextContent): { prompts: string[]; refs?: string[] }[] {
    return [{ prompts: [text.participants[0]?.avatarHint ?? 'casual commenter'] }]
  },

  buildProductThumb(): { prompt: string; refs: string[] } | null {
    return null
  },

  postProcess: 'medium',

  normalizeOutput(raw, params): GeneratedAsset {
    const now = Date.now()
    return {
      id: `tiktok-comment_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      outputUrl: raw.outputUrl,
      metadata: {
        generatedAt: now,
        assetType: 'tiktok-comment',
        engineGroup: 'ui-native',
        category: 'social-comment',
        productId: raw.productId,
        modelId: params.modelId,
        aspectRatio: '9:16',
        tags: ['ui-native', 'tiktok', 'social-comment'],
        engineExtras: {
          templateId: TIKTOK_COMMENT_TEMPLATE.id,
          uiVintage: TIKTOK_COMMENT_TEMPLATE.uiVintage,
        },
      },
    }
  },
}
