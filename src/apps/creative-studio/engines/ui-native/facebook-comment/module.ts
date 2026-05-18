// ── Facebook Comment Thread Module (P6) ─────────────────────────────────────
//
// Social-comment proof — Facebook post engagement bar + comment list.
// Avatars are NOT generated per commenter (would burn N×KIE credits);
// instead one shared anonymous-customer avatar is reused, which matches
// real Facebook screenshots where many commenters use default avatars.

import type {
  UINativeModule,
  UINativeTextContent,
  UINativeTemplate,
} from '../../../types/uiNative'
import type { GeneratedAsset } from '../../../types/asset'
import { FACEBOOK_COMMENT_TEMPLATE } from './template'
import { FACEBOOK_EXEMPLARS } from './exemplars'

export const module: UINativeModule = {
  id: 'facebook-comment',
  engineGroup: 'ui-native',
  label: { vi: 'Bình luận Facebook', en: 'Facebook comment thread' },
  category: 'social-comment',
  platform: 'facebook',
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

  defaultExemplars: FACEBOOK_EXEMPLARS,

  buildCanvasTemplate(): UINativeTemplate {
    return FACEBOOK_COMMENT_TEMPLATE
  },

  buildTextPayload(): Promise<UINativeTextContent> {
    throw new Error('[facebook-comment] buildTextPayload is invoked by the dispatcher, not direct')
  },

  buildAvatarPayload(text: UINativeTextContent): { prompts: string[]; refs?: string[] }[] {
    // One avatar reused for all commenters — matches the
    // mixed-default-avatar look of real FB screenshots and keeps the
    // KIE bill bounded.
    return [{ prompts: [text.participants[0]?.avatarHint ?? 'casual commenter'] }]
  },

  buildProductThumb(): { prompt: string; refs: string[] } | null {
    return null
  },

  postProcess: 'medium',

  normalizeOutput(raw, params): GeneratedAsset {
    const now = Date.now()
    return {
      id: `facebook-comment_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      outputUrl: raw.outputUrl,
      metadata: {
        generatedAt: now,
        assetType: 'facebook-comment',
        engineGroup: 'ui-native',
        category: 'social-comment',
        productId: raw.productId,
        modelId: params.modelId,
        aspectRatio: '9:16',
        tags: ['ui-native', 'facebook', 'social-comment'],
        engineExtras: {
          templateId: FACEBOOK_COMMENT_TEMPLATE.id,
          uiVintage: FACEBOOK_COMMENT_TEMPLATE.uiVintage,
        },
      },
    }
  },
}
