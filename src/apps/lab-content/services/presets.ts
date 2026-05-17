import type { GoalOption, ToneOption } from '../types'

// ─────────────────────────────────────────────────────────────────────────
// Goal options — 4 mục tiêu cốt lõi của campaign.
// Mỗi goal định hướng AI chọn công thức + góc + cường độ CTA khác nhau.
// ─────────────────────────────────────────────────────────────────────────

export const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'awareness',
    label: 'Nhận biết',
    glyph: '👋',
    hint: 'Người lạ chưa biết brand — kéo họ chú ý',
    promptHint:
      'Goal = AWARENESS. The audience does NOT yet know this brand. The brief should favor angles that earn ATTENTION (storytelling, pattern interrupt, counter-intuitive truths). Recommend formulas: Storytelling, ACC, AIDA, Hook-Value-CTA. CTA should be soft (follow, save, share) — not a hard sale.',
  },
  {
    id: 'engagement',
    label: 'Tương tác',
    glyph: '💬',
    hint: 'KH đã biết — đẩy comment, share, save',
    promptHint:
      'Goal = ENGAGEMENT. Audience knows the brand. Focus on angles that spark COMMENT / SHARE / SAVE — debatable opinions, relatable pain, social-currency hooks ("tag a friend who…"). Recommend formulas: Storytelling, SSS, Hook-Value-CTA, COC. CTA invites discussion or tagging — not direct sale.',
  },
  {
    id: 'conversion',
    label: 'Chuyển đổi',
    glyph: '💰',
    hint: 'Bán hàng trực tiếp — chốt đơn ngay',
    promptHint:
      'Goal = CONVERSION. The audience is warm and ready to buy. The brief MUST push toward direct purchase. Recommend formulas: PAS, PPPP, SLAP, AIDA, FAB. Strong loss-aversion + scarcity. CTA must be specific + action verb (mua, đặt, nhận ưu đãi).',
  },
  {
    id: 'retargeting',
    label: 'Remarketing',
    glyph: '🎯',
    hint: 'KH đã xem nhưng chưa mua — kéo lại',
    promptHint:
      'Goal = RETARGETING. The audience has seen the product but did NOT buy. Resolve their objection (price doubt / trust / risk). Recommend formulas: PAS, BAB, PPPP. Heavy on risk-reversal, social proof, before/after. Address WHY they hesitated last time. CTA acknowledges the prior visit ("Bạn đã suy nghĩ rồi — đây là lý do…").',
  },
]

// ─────────────────────────────────────────────────────────────────────────
// Tone options — 5 giọng văn từ skill + 1 Custom.
// ─────────────────────────────────────────────────────────────────────────

export const TONE_OPTIONS: ToneOption[] = [
  {
    id: 'direct-sharp',
    label: 'Thẳng thắn + có chêm',
    glyph: '⚡',
    hint: 'Câu ngắn, châm biếm nhẹ, data chốt hạ',
    promptHint:
      'Tone: DIRECT + SHARP. Short sentences. Mild sarcasm where appropriate. Data points to "close the case". Best for tech, professional services, younger audiences. NO fluffy adjectives.',
  },
  {
    id: 'expert',
    label: 'Chuyên gia uy tín',
    glyph: '🩺',
    hint: 'Điềm đạm, trích dẫn, bằng chứng',
    promptHint:
      'Tone: EXPERT AUTHORITY. Calm, measured cadence. Cites ingredients, mechanisms, certifications. Light academic flavor — but never lecturing. Best for health, supplement, finance, B2B.',
  },
  {
    id: 'friendly',
    label: 'Bạn bè thân mật',
    glyph: '🤝',
    hint: 'Conversational, dùng slang, hỏi-đáp',
    promptHint:
      'Tone: FRIENDLY / CONVERSATIONAL. Like recommending to a close friend. Uses "mình"/"bạn" register. Light slang where natural. Asks rhetorical questions. Best for lifestyle, fashion, F&B, GenZ.',
  },
  {
    id: 'storyteller',
    label: 'Storyteller cảm xúc',
    glyph: '📖',
    hint: 'Kể chuyện chậm, nhiều chi tiết cảm xúc',
    promptHint:
      'Tone: EMOTIONAL STORYTELLER. Narrative-led — sets scene, names a character (real or composite), describes feeling in concrete detail. Slower pacing. Short paragraphs. Best for family, health, insurance, transformation stories.',
  },
  {
    id: 'hype',
    label: 'Năng lượng cao / hype',
    glyph: '🔥',
    hint: 'Emoji nhiều, câu ngắn, urgency liên tục',
    promptHint:
      'Tone: HIGH ENERGY / HYPE. Heavy use of emoji at paragraph starts. Punchy 1-line sentences. Constant urgency framing. Selective CAPS for emphasis. Best for flash sale, event launch, entertainment.',
  },
  {
    id: 'custom',
    label: 'Tự định nghĩa',
    glyph: '✍️',
    hint: 'Mô tả tone bằng văn bản — AI sẽ học',
    promptHint:
      'Tone: CUSTOM — follow the user-provided tone note exactly. If user provided a sample text, mirror its rhythm and vocabulary. If user described it in words, internalize each adjective.',
  },
]

export function getGoalById(id: string): GoalOption | undefined {
  return GOAL_OPTIONS.find((g) => g.id === id)
}

export function getToneById(id: string): ToneOption | undefined {
  return TONE_OPTIONS.find((t) => t.id === id)
}
