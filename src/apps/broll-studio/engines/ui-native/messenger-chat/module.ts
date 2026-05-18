// ── Messenger Chat Module (P5) ──────────────────────────────────────────────
//
// Second UI-Native module — Facebook Messenger style chat. Sister to
// whatsapp-proof. Same dispatcher pipeline, different template + palette.

import type {
  UINativeModule,
  UINativeTextContent,
  UINativeTemplate,
} from '../../../types/uiNative'
import type { GeneratedAsset } from '../../../types/asset'
import { MESSENGER_CONVERSATION_TEMPLATE } from './template'
import { MESSENGER_EXEMPLARS } from './exemplars'

export const module: UINativeModule = {
  id: 'messenger-chat',
  engineGroup: 'ui-native',
  label: { vi: 'Tin nhắn Messenger', en: 'Messenger chat proof' },
  category: 'chat-proof',
  platform: 'messenger',
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

  defaultExemplars: MESSENGER_EXEMPLARS,

  buildCanvasTemplate(): UINativeTemplate {
    return MESSENGER_CONVERSATION_TEMPLATE
  },

  buildTextPayload(): Promise<UINativeTextContent> {
    throw new Error('[messenger-chat] buildTextPayload is invoked by the dispatcher, not direct')
  },

  buildAvatarPayload(text: UINativeTextContent): { prompts: string[]; refs?: string[] }[] {
    // Messenger shows the customer avatar on every incoming bubble +
    // header. Still only one avatar generation needed (reused).
    return [{ prompts: [text.participants[0].avatarHint] }]
  },

  buildProductThumb(): { prompt: string; refs: string[] } | null {
    return null
  },

  postProcess: 'medium',

  normalizeOutput(raw, params): GeneratedAsset {
    const now = Date.now()
    return {
      id: `messenger-chat_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      outputUrl: raw.outputUrl,
      metadata: {
        generatedAt: now,
        assetType: 'messenger-chat',
        engineGroup: 'ui-native',
        category: 'chat-proof',
        productId: raw.productId,
        modelId: params.modelId,
        aspectRatio: '9:16',
        tags: ['ui-native', 'messenger', 'chat-proof', 'testimonial'],
        engineExtras: {
          templateId: MESSENGER_CONVERSATION_TEMPLATE.id,
          uiVintage: MESSENGER_CONVERSATION_TEMPLATE.uiVintage,
        },
      },
    }
  },
}
