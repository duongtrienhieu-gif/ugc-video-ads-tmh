import type { GoalOption, PricingInfo, PricingStrategyOption, ToneOption } from '../types'

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

// ─────────────────────────────────────────────────────────────────────────
// Pricing strategies — 7 chiến lược giá / neo tâm lý từ skill.
// ─────────────────────────────────────────────────────────────────────────

export const PRICING_STRATEGY_OPTIONS: PricingStrategyOption[] = [
  {
    id: 'anchoring',
    label: 'Price Anchoring',
    glyph: '⚓',
    hint: 'Giá gốc → giá sale, não tự tính "tiết kiệm"',
    promptHint:
      'PRICE ANCHORING — always show the anchor (original / compare-at) price BEFORE the current price. The brain auto-calculates the savings. Use format like "Giá gốc 990K → hôm nay chỉ 490K" or "Trên Shopee 1.2tr — tại đây 590K". Make the discount feel obvious.',
  },
  {
    id: 'value-stacking',
    label: 'Value Stacking',
    glyph: '💎',
    hint: '"Tổng giá trị 15tr → bạn chỉ trả 3tr"',
    promptHint:
      'VALUE STACKING — list every component the customer receives + its perceived monetary value, sum them, THEN reveal the price. Format: "Bạn nhận: ✅ A (trị giá X) ✅ B (trị giá Y) ✅ C (trị giá Z) → Tổng giá trị: $TOTAL → Giá hôm nay chỉ $PRICE". The gap between total value and price must feel absurd.',
  },
  {
    id: 'cost-inaction',
    label: 'Cost of Inaction',
    glyph: '⏰',
    hint: '"Không mua = mất X tr mỗi tháng"',
    promptHint:
      'COST OF INACTION — quantify what the customer LOSES by not buying. Convert pain to money: "Mỗi tháng không giải quyết = mất X tiền thuốc / X năng suất / X cơ hội". Make doing nothing feel more expensive than buying.',
  },
  {
    id: 'daily-cost',
    label: 'Daily Cost Breakdown',
    glyph: '📅',
    hint: '"Chỉ 16K/ngày — rẻ hơn ly cà phê"',
    promptHint:
      'DAILY COST BREAKDOWN — divide the total price by the usage period (typically days or weeks) and reframe as a tiny relatable amount. Format: "Chỉ XK/ngày — rẻ hơn 1 ly cà phê / 1 bữa ăn vặt / 1 lần shopee". Make the price feel trivial.',
  },
  {
    id: 'decoy',
    label: 'Decoy Pricing',
    glyph: '🎯',
    hint: '3 gói: Basic / Pro (target) / Premium',
    promptHint:
      'DECOY PRICING — present 3 options where the MIDDLE option is the conversion target. Basic = under-featured for the price. Pro (target) = best ratio. Premium = expensive overkill. The decoy makes Pro feel obviously correct. Only use if the product genuinely has tiers or bundles.',
  },
  {
    id: 'pain-paying',
    label: 'Pain of Paying Reduction',
    glyph: '💳',
    hint: 'Trả góp 0%, dùng thử, COD',
    promptHint:
      'PAIN OF PAYING REDUCTION — make the moment of paying feel painless. Mention: COD (thanh toán khi nhận), trả góp 0%, dùng thử miễn phí 7-30 ngày, hoàn tiền 100% nếu không hài lòng. Remove the "risk" psychological cost.',
  },
  {
    id: 'perceived-value',
    label: 'Perceived Value Inflation',
    glyph: '🎁',
    hint: 'Bonus tặng kèm giá trị cảm nhận cao',
    promptHint:
      'PERCEIVED VALUE INFLATION — emphasise high-perceived-value bonuses that cost the brand little to give: ebooks, consultation, member group, follow-up support. Format: "Tặng kèm [bonus name] trị giá XK — chỉ trong hôm nay". The bonus name must feel premium even if cheap to produce.',
  },
]

export function getPricingStrategyById(id: string): PricingStrategyOption | undefined {
  return PRICING_STRATEGY_OPTIONS.find((s) => s.id === id)
}

/**
 * Build a Vietnamese-language pricing brief block to inject into Gemini
 * user prompts. Returns empty string if pricing is disabled or empty.
 *
 * @param pricing  pricing info (may be undefined)
 * @param emphasis  'soft' for TOFU/MOFU (mention price only if natural),
 *                  'hard' for BOFU (pricing is the hero of the copy)
 */
export function buildPricingPromptBlock(
  pricing: PricingInfo | undefined,
  emphasis: 'soft' | 'medium' | 'hard',
): string {
  if (!pricing || !pricing.enabled) return ''

  const hasAnyData =
    pricing.currentPrice > 0 ||
    pricing.anchorPrice > 0 ||
    pricing.offerDescription.trim() ||
    pricing.bonusDescription.trim() ||
    pricing.preferredStrategies.length > 0

  if (!hasAnyData) return ''

  const formatVND = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M VNĐ`
      : `${(n / 1_000).toFixed(0)}K VNĐ`

  const lines: string[] = []
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRICING LAYER — pricing facts + persuasion strategies to apply')
  lines.push('═══════════════════════════════════════════════════════════════')

  if (pricing.currentPrice > 0) {
    lines.push(`Current price: ${formatVND(pricing.currentPrice)} (${pricing.currentPrice.toLocaleString('vi-VN')}đ)`)
  }
  if (pricing.anchorPrice > 0 && pricing.anchorPrice > pricing.currentPrice) {
    const discountPct = Math.round(((pricing.anchorPrice - pricing.currentPrice) / pricing.anchorPrice) * 100)
    lines.push(`Anchor / compare price: ${formatVND(pricing.anchorPrice)} (${pricing.anchorPrice.toLocaleString('vi-VN')}đ) — discount ${discountPct}%`)
  }
  if (pricing.offerDescription.trim()) {
    lines.push(`Offer details: ${pricing.offerDescription.trim()}`)
  }
  if (pricing.bonusDescription.trim()) {
    lines.push(`Bonus / value-add: ${pricing.bonusDescription.trim()}`)
  }

  // Strategy directives
  if (pricing.preferredStrategies.length === 0) {
    lines.push('')
    lines.push('Strategy selection: AI CHOOSES the most relevant pricing strategies from the 7-strategy toolkit for this product + audience. Pick 2-3, not all.')
  } else {
    lines.push('')
    lines.push('USER-PREFERRED STRATEGIES (must apply ALL of these where natural):')
    pricing.preferredStrategies.forEach((sid) => {
      const opt = getPricingStrategyById(sid)
      if (opt) lines.push(`- ${opt.label}: ${opt.promptHint}`)
    })
  }

  // Emphasis instruction
  lines.push('')
  if (emphasis === 'soft') {
    lines.push('EMPHASIS = SOFT (top-of-funnel / awareness): Pricing is BACKGROUND, not the hero. Mention price only if it fits naturally. Do NOT lead with discount or urgency. Build belief first.')
  } else if (emphasis === 'medium') {
    lines.push('EMPHASIS = MEDIUM (mid-funnel / consideration): Pricing is one persuasion lever among many. Use 1-2 strategies (Value Stacking, Anchoring) to build perceived value. Avoid hard urgency.')
  } else {
    lines.push('EMPHASIS = HARD (bottom-of-funnel / conversion): Pricing is the HERO of the copy. Use 2-3 strategies aggressively. Heavy use of anchor price, daily-cost reframing, scarcity, urgency, risk reversal. Repeat the offer + CTA.')
  }

  // Pricing toolkit always available
  lines.push('')
  lines.push('AVAILABLE PRICING TOOLKIT (use as appropriate):')
  PRICING_STRATEGY_OPTIONS.forEach((s) => {
    lines.push(`• ${s.label} (${s.glyph}): ${s.hint}`)
  })

  return lines.join('\n')
}
