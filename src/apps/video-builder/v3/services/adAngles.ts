// ── Ad Angle System ──────────────────────────────────────────────────────────
// Z31 §10 — orthogonal modifier to AdStructure. Where AdStructure picks the
// SHAPE of the script, AdAngle picks the TONE / VOICE / register.
//
// Angle is fed into Gemini as a second prompt fragment. The same
// PROBLEM_SOLUTION structure produces very different scripts depending on
// whether the angle is "emotional", "authority", or "native_tiktok".
// ─────────────────────────────────────────────────────────────────────────────

import type { AdAngle } from '../types'

export interface AdAngleConfig {
  id: AdAngle
  labelVi: string
  descriptionVi: string
  emoji: string
  /** Gemini prompt fragment — describes the writing tone */
  tonePrompt: string
  /** Hint for the voice matcher — which voice categories pair well */
  voiceHints: string[]
  /** UI tint */
  tone: 'violet' | 'emerald' | 'amber' | 'pink' | 'sky' | 'rose'
}

export const AD_ANGLES: Record<AdAngle, AdAngleConfig> = {
  emotional: {
    id: 'emotional',
    labelVi: 'Cảm xúc',
    descriptionVi: 'Khai thác cảm xúc sâu — mệt mỏi, lo lắng, hi vọng. Tone tâm sự, nhẹ.',
    emoji: '💗',
    tonePrompt:
      'Voice: emotional, vulnerable, slightly soft. Use micro-pauses (signaled by "..." or ' +
      'sentence breaks). Acknowledge the feeling before naming the product. Like talking ' +
      'to a friend who just listened.',
    voiceHints: ['emotional_mom', 'calm_female'],
    tone: 'rose',
  },

  authority: {
    id: 'authority',
    labelVi: 'Chuyên gia',
    descriptionVi: 'Tự tin, có kiến thức. Phù hợp khi sản phẩm có cơ chế khoa học.',
    emoji: '🎓',
    tonePrompt:
      'Voice: confident, knowledgeable, slightly measured. Use one or two specific facts ' +
      'or mechanisms. No hedging language ("might", "maybe"). Sound like the person who ' +
      'knows because they\'ve seen the data — not like a salesperson.',
    voiceHints: ['authority_male', 'calm_female'],
    tone: 'sky',
  },

  testimonial: {
    id: 'testimonial',
    labelVi: 'Lời chứng',
    descriptionVi: 'Người thật kể trải nghiệm — không phải bán, chỉ chia sẻ.',
    emoji: '🗣️',
    tonePrompt:
      'Voice: first-person testimonial. Use natural disfluencies ("uhm" / "kiểu như" / ' +
      '"thật ra"). Specific timeframes and outcomes ("3 tuần rồi", "2 lần / ngày"). Avoid ' +
      'any sentence that sounds like marketing copy.',
    voiceHints: ['emotional_mom', 'skincare_influencer', 'energetic_creator'],
    tone: 'emerald',
  },

  problem_solution: {
    id: 'problem_solution',
    labelVi: 'Vấn đề → Giải pháp',
    descriptionVi: 'Logic rõ ràng, ngắn gọn — phù hợp ad direct response.',
    emoji: '🎯',
    tonePrompt:
      'Voice: direct, problem-first. State the problem in 1 sentence, the solution in 1 ' +
      'sentence. Cut every word that doesn\'t earn its place. Punchy, momentum-driven.',
    voiceHints: ['energetic_creator', 'authority_male'],
    tone: 'violet',
  },

  curiosity: {
    id: 'curiosity',
    labelVi: 'Tò mò',
    descriptionVi: 'Hook tò mò mạnh — "ít ai biết..." / "bạn không bao giờ đoán được...".',
    emoji: '👀',
    tonePrompt:
      'Voice: build curiosity. Tease information without revealing it in the hook. The ' +
      'PAIN block deepens the mystery ("Nobody told me this..."). DISCOVERY reveals the ' +
      'surprise. Use rhetorical questions sparingly.',
    voiceHints: ['energetic_creator', 'skincare_influencer'],
    tone: 'amber',
  },

  direct_response: {
    id: 'direct_response',
    labelVi: 'Direct Response',
    descriptionVi: 'Bán hàng thẳng — không vòng vo, CTA mạnh. Cho COD / promo nóng.',
    emoji: '⚡',
    tonePrompt:
      'Voice: direct sales. State the offer early. Use urgency markers ("HÔM NAY", "chỉ 50 ' +
      'suất"). CTA appears multiple times. Skip the long emotional setup — get to the offer. ' +
      'TikTok-native, NOT corporate. Energetic, not pushy.',
    voiceHints: ['energetic_creator', 'authority_male', 'gym_creator'],
    tone: 'pink',
  },

  native_tiktok: {
    id: 'native_tiktok',
    labelVi: 'Native TikTok',
    descriptionVi: 'Không có cảm giác là ad — kiểu video creator chia sẻ tự nhiên.',
    emoji: '📱',
    tonePrompt:
      'Voice: pure TikTok creator. Casual, slightly chaotic energy. Use phrases like "ok ' +
      'so listen", "wait this is actually wild", "lemme show you". The product appears as ' +
      'a discovery the creator stumbled on, not a sponsored mention. No "in this video..."',
    voiceHints: ['energetic_creator', 'skincare_influencer', 'gym_creator'],
    tone: 'violet',
  },

  educational: {
    id: 'educational',
    labelVi: 'Giáo dục',
    descriptionVi: 'Dạy người xem một điều gì đó — sản phẩm là công cụ minh hoạ.',
    emoji: '📚',
    tonePrompt:
      'Voice: teacher-mode but TikTok-fast. The DISCOVERY block teaches one concrete thing ' +
      '(a fact, a step, a tip). Product appears as the practical application of the lesson. ' +
      'No condescension; assume the viewer is smart.',
    voiceHints: ['calm_female', 'authority_male'],
    tone: 'sky',
  },
}

export const AD_ANGLE_ORDER: AdAngle[] = [
  'native_tiktok',
  'emotional',
  'curiosity',
  'testimonial',
  'authority',
  'problem_solution',
  'direct_response',
  'educational',
]
