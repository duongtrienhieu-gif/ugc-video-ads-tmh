import type { CocFormatOption, GoalOption, PricingInfo, PricingStrategyOption, ToneOption } from '../types'

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
    label: 'Neo giá gốc',
    glyph: '⚓',
    hint: 'Giá gốc → giá sale, não tự tính phần "tiết kiệm"',
    promptHint:
      'PRICE ANCHORING — always show the anchor (original / compare-at) price BEFORE the current price. The brain auto-calculates the savings. Use format like "Giá gốc 990K → hôm nay chỉ 490K" or "Trên Shopee 1.2tr — tại đây 590K". Make the discount feel obvious.',
  },
  {
    id: 'value-stacking',
    label: 'Cộng dồn giá trị',
    glyph: '💎',
    hint: '"Tổng giá trị 15tr → bạn chỉ trả 3tr"',
    promptHint:
      'VALUE STACKING — list every component the customer receives + its perceived monetary value, sum them, THEN reveal the price. Format: "Bạn nhận: ✅ A (trị giá X) ✅ B (trị giá Y) ✅ C (trị giá Z) → Tổng giá trị: $TOTAL → Giá hôm nay chỉ $PRICE". The gap between total value and price must feel absurd.',
  },
  {
    id: 'cost-inaction',
    label: 'Chi phí không hành động',
    glyph: '⏰',
    hint: '"Không mua = mất X triệu mỗi tháng"',
    promptHint:
      'COST OF INACTION — quantify what the customer LOSES by not buying. Convert pain to money: "Mỗi tháng không giải quyết = mất X tiền thuốc / X năng suất / X cơ hội". Make doing nothing feel more expensive than buying.',
  },
  {
    id: 'daily-cost',
    label: 'Bóc tách giá theo ngày',
    glyph: '📅',
    hint: '"Chỉ 16K/ngày — rẻ hơn ly cà phê"',
    promptHint:
      'DAILY COST BREAKDOWN — divide the total price by the usage period (typically days or weeks) and reframe as a tiny relatable amount. Format: "Chỉ XK/ngày — rẻ hơn 1 ly cà phê / 1 bữa ăn vặt / 1 lần shopee". Make the price feel trivial.',
  },
  {
    id: 'decoy',
    label: 'Mồi nhử 3 gói',
    glyph: '🎯',
    hint: '3 gói: Basic / Pro (target) / Premium',
    promptHint:
      'DECOY PRICING — present 3 options where the MIDDLE option is the conversion target. Basic = under-featured for the price. Pro (target) = best ratio. Premium = expensive overkill. The decoy makes Pro feel obviously correct. Only use if the product genuinely has tiers or bundles.',
  },
  {
    id: 'pain-paying',
    label: 'Giảm cảm giác mất tiền',
    glyph: '💳',
    hint: 'Trả góp 0%, COD, dùng thử, hoàn tiền',
    promptHint:
      'PAIN OF PAYING REDUCTION — make the moment of paying feel painless. Mention: COD (thanh toán khi nhận), trả góp 0%, dùng thử miễn phí 7-30 ngày, hoàn tiền 100% nếu không hài lòng. Remove the "risk" psychological cost.',
  },
  {
    id: 'perceived-value',
    label: 'Tăng giá trị cảm nhận',
    glyph: '🎁',
    hint: 'Bonus tặng kèm — giá trị cảm nhận cao',
    promptHint:
      'PERCEIVED VALUE INFLATION — emphasise high-perceived-value bonuses that cost the brand little to give: ebooks, consultation, member group, follow-up support. Format: "Tặng kèm [bonus name] trị giá XK — chỉ trong hôm nay". The bonus name must feel premium even if cheap to produce.',
  },
]

export function getPricingStrategyById(id: string): PricingStrategyOption | undefined {
  return PRICING_STRATEGY_OPTIONS.find((s) => s.id === id)
}

/**
 * Build a Vietnamese-language pricing brief block to inject into Gemini
 * user prompts. Triggered purely by the user picking strategies — no
 * price / offer / bonus input required (AI infers details from product
 * brief in bankStore where available).
 *
 * Returns empty string if no strategies are selected.
 *
 * @param pricing  pricing info (may be undefined)
 * @param emphasis  'soft' for TOFU (mention price only if natural),
 *                  'medium' for MOFU, 'hard' for BOFU (pricing = hero)
 */
export function buildPricingPromptBlock(
  pricing: PricingInfo | undefined,
  emphasis: 'soft' | 'medium' | 'hard',
): string {
  if (!pricing) return ''
  // Trigger purely by selected strategies — no toggle, no price fields needed.
  if (!pricing.preferredStrategies || pricing.preferredStrategies.length === 0) return ''

  const lines: string[] = []
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRICING LAYER — user-picked persuasion strategies to apply')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('The user wants the following pricing / persuasion strategies actively used in the copy. Infer the concrete price + offer + bonus details from the PRODUCT brief above (product.offer field) — if not provided, write the strategy in a generic but compelling way (e.g. "Giá hôm nay chỉ bằng 1 ly cà phê / ngày").')

  lines.push('')
  lines.push('USER-PICKED STRATEGIES (must apply ALL of these where natural):')
  pricing.preferredStrategies.forEach((sid) => {
    const opt = getPricingStrategyById(sid)
    if (opt) lines.push(`- ${opt.label}: ${opt.promptHint}`)
  })

  // Emphasis instruction
  lines.push('')
  if (emphasis === 'soft') {
    lines.push('EMPHASIS = SOFT (top-of-funnel / awareness): Pricing is BACKGROUND, not the hero. Mention strategies only if they fit naturally. Do NOT lead with discount or urgency. Build belief first.')
  } else if (emphasis === 'medium') {
    lines.push('EMPHASIS = MEDIUM (mid-funnel / consideration): Pricing strategies are persuasion levers among many. Use 1-2 of the picked strategies. Avoid hard urgency.')
  } else {
    lines.push('EMPHASIS = HARD (bottom-of-funnel / conversion): Pricing strategies are HEROES of the copy. Use ALL picked strategies aggressively. Repeat the offer + CTA. Build urgency if real scarcity exists.')
  }

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────
// COC formats — 7 platform-specific micro-content target formats.
// ─────────────────────────────────────────────────────────────────────────

export const COC_FORMAT_OPTIONS: CocFormatOption[] = [
  {
    id: 'facebook-feed',
    label: 'Facebook Feed',
    glyph: '📘',
    hint: 'Caption FB ~120-180 từ, paragraph rhythm',
    formatBrief:
      'Facebook Feed caption — 120-180 words. Mobile-first paragraph rhythm: short paragraphs (1-3 lines) separated by BLANK LINES. Strategic emoji at paragraph starts. The first line is the HOOK that earns "see more". End with a clear CTA. No hashtags (FB algo penalises them).',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    glyph: '📷',
    hint: 'IG caption + 5-8 hashtag liên quan',
    formatBrief:
      'Instagram caption — 80-150 words. More visual / aspirational tone than Facebook. End with 5-8 RELEVANT hashtags (mix of broad + niche). The first sentence must earn the "more" tap. Allowed emoji freely.',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    glyph: '🎵',
    hint: 'Caption ngắn 50-80 từ, slang OK',
    formatBrief:
      'TikTok caption — 50-80 words. VERY casual, slang OK, can break grammar for rhythm. First 5-7 words must be a scroll-stopper. End with a soft CTA or rhetorical question. NO hashtags except 1-2 trending ones if relevant.',
  },
  {
    id: 'threads',
    label: 'Threads',
    glyph: '🧵',
    hint: 'Max 3 dòng, ~200 chars, tone đối thoại',
    formatBrief:
      'Threads post — max 3 lines, ~200 characters total. Conversational, opinion-led tone (Threads readers want hot takes, not ads). Can be a question, a thought-stopper, or a tiny story. NO emojis spam, NO hashtags. Sound human.',
  },
  {
    id: 'zalo-sms',
    label: 'Zalo / SMS',
    glyph: '💬',
    hint: 'Broadcast 1-2 câu, max 160 chars',
    formatBrief:
      'Zalo / SMS broadcast — 1-2 short sentences, max 160 characters total. Direct, value-led, no fluff. Include the offer + 1 clear action (link / hotline / promo code). Treat like sending to a known customer.',
  },
  {
    id: 'email',
    label: 'Email',
    glyph: '📧',
    hint: 'Subject + preview line tối ưu inbox',
    formatBrief:
      'Email subject + preview line. SUBJECT: under 50 chars, curiosity-led or value-led, no spam triggers ("FREE", "URGENT" in CAPS, multiple !!). PREVIEW: under 90 chars, complements (not repeats) the subject. Output format MUST be exactly:\nSUBJECT: <text>\nPREVIEW: <text>',
  },
  {
    id: 'instagram-story',
    label: 'Instagram Story (3 frames)',
    glyph: '📱',
    hint: '3 frame text — escalating đến CTA',
    formatBrief:
      'Instagram Story — 3 frames of short text. Each frame is 1-2 short lines (Story is read in 2-3 seconds). Frame 1 = hook / question / pattern interrupt. Frame 2 = value / insight / reveal. Frame 3 = CTA (swipe up, link in bio, follow). Output format MUST be exactly:\nFRAME 1: <text>\nFRAME 2: <text>\nFRAME 3: <text>',
  },
]

export function getCocFormatById(id: string): CocFormatOption | undefined {
  return COC_FORMAT_OPTIONS.find((f) => f.id === id)
}
