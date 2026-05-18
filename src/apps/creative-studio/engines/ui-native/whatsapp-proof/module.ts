// ── WhatsApp Proof Module (P5) ──────────────────────────────────────────────
//
// First UI-Native engine module. Surfaces the WhatsApp testimonial-thread
// asset to the public registry. Composition is done by the ui-native
// dispatcher, which calls these builder methods in order.

import type {
  UINativeModule,
  UINativeTextContent,
  UINativeTemplate,
} from '../../../types/uiNative'
import type { GeneratedAsset } from '../../../types/asset'
import { WHATSAPP_CONVERSATION_TEMPLATE } from './template'
import { WHATSAPP_EXEMPLARS } from './exemplars'

export const module: UINativeModule = {
  id: 'whatsapp-proof',
  engineGroup: 'ui-native',
  label: { vi: 'Bằng chứng WhatsApp', en: 'WhatsApp testimonial proof' },
  category: 'chat-proof',
  platform: 'whatsapp',
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

  defaultExemplars: WHATSAPP_EXEMPLARS,

  buildCanvasTemplate(): UINativeTemplate {
    return WHATSAPP_CONVERSATION_TEMPLATE
  },

  // Wired by ui-native dispatcher. Throws here when called directly to
  // surface a coding error early (dispatcher should always be the caller).
  buildTextPayload(): Promise<UINativeTextContent> {
    throw new Error('[whatsapp-proof] buildTextPayload is invoked by the dispatcher, not direct')
  },

  buildAvatarPayload(text: UINativeTextContent): { prompts: string[]; refs?: string[] }[] {
    return [{ prompts: [text.participants[0].avatarHint] }]
  },

  buildProductThumb(): { prompt: string; refs: string[] } | null {
    return null
  },

  postProcess: 'heavy',

  normalizeOutput(raw, params): GeneratedAsset {
    const now = Date.now()
    return {
      id: `whatsapp-proof_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      outputUrl: raw.outputUrl,
      metadata: {
        generatedAt: now,
        assetType: 'whatsapp-proof',
        engineGroup: 'ui-native',
        category: 'chat-proof',
        productId: raw.productId,
        modelId: params.modelId,
        aspectRatio: '9:16',
        tags: ['ui-native', 'whatsapp', 'chat-proof', 'testimonial'],
        engineExtras: {
          templateId: WHATSAPP_CONVERSATION_TEMPLATE.id,
          uiVintage: WHATSAPP_CONVERSATION_TEMPLATE.uiVintage,
        },
      },
    }
  },
}
