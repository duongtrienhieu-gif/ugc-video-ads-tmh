import type {
  ContentAngle, LabBriefResult, PainPoint, SalesLetterLength, SalesLetterOutput, SalesLetterSection,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import { buildPricingPromptBlock, getGoalById, getToneById } from './presets'

// ─────────────────────────────────────────────────────────────────────────
// Long-Form Sales Letter — 1000-2500 word advertorial / landing page copy.
// 14-section narrative blueprint using AIDA + PPPP + Storytelling chain.
// Heavily uses Pricing Layer (HARD emphasis) when available.
// ─────────────────────────────────────────────────────────────────────────

interface SectionSpec {
  id: string
  labelVi: string
  /** Approximate word share — guides AI on length allocation. */
  wordShare: number
  /** English instruction for what this section must do. */
  brief: string
}

const LETTER_BLUEPRINT: SectionSpec[] = [
  {
    id: 'hero',
    labelVi: 'Hero Hook',
    wordShare: 0.05,
    brief: 'Open with a SCROLL-STOPPING headline + first paragraph. The first sentence MUST earn the second-of-attention. Use Pattern Interrupt OR Curiosity Gap OR a counter-intuitive truth. NO generic openers.',
  },
  {
    id: 'pain-reveal',
    labelVi: 'Đánh thẳng nỗi đau',
    wordShare: 0.10,
    brief: 'Agitate the customer\'s real pain. Use the mined pain points from the brief in their RAW LANGUAGE. Make the reader feel "this is me, this is exactly my situation". Specific scene, specific feelings, specific consequences.',
  },
  {
    id: 'story',
    labelVi: 'Câu chuyện nhân vật',
    wordShare: 0.15,
    brief: 'Tell a STORY arc — a real or composite character who had this pain, tried failed solutions, then discovered something different. Use Narrative Transport. Build emotional investment. End with a turning point that hooks toward the solution.',
  },
  {
    id: 'mechanism',
    labelVi: 'Vì sao sản phẩm hiệu quả',
    wordShare: 0.12,
    brief: 'Reveal the MECHANISM — explain WHY the problem actually happens (most readers don\'t know) and HOW this product addresses the root cause. Plain-language science. Build belief through understanding, not hype.',
  },
  {
    id: 'ingredient-deep-dive',
    labelVi: 'Phân tích ingredient / feature',
    wordShare: 0.10,
    brief: 'Deep-dive on 2-3 KEY ingredients / features from the brief. Name them specifically. Explain what each does in 1-2 sentences each. Cite research or tradition where natural. NEVER invent ingredients.',
  },
  {
    id: 'proof',
    labelVi: 'Bằng chứng & Social proof',
    wordShare: 0.10,
    brief: 'Stack proof: 2-3 customer-style testimonials (realistic short quotes, not over-the-top), 1-2 specific numbers ("12,847 người", "94% feedback tích cực"), optional expert / certification mention. Use Specificity Bias (odd numbers > round numbers).',
  },
  {
    id: 'offer',
    labelVi: 'Giới thiệu Offer',
    wordShare: 0.08,
    brief: 'Present the offer with full clarity. What the customer gets, in what quantity, for what price. Use Anchoring if anchor price is provided (giá gốc → giá hôm nay). Make the value-to-price gap visible.',
  },
  {
    id: 'bonus-stack',
    labelVi: 'Bonus tặng kèm',
    wordShare: 0.07,
    brief: 'Stack bonuses with perceived monetary value. Each bonus gets its own line with its perceived value. Sum the total bonus value. Use Perceived Value Inflation. If bonus info from brief is empty, infer 2-3 reasonable bonuses (consultation, follow-up support, member group) — but stay realistic.',
  },
  {
    id: 'anchoring',
    labelVi: 'Neo giá & Daily Cost',
    wordShare: 0.06,
    brief: 'Re-anchor the price with reframing tactics: "Tổng giá trị X → Giá hôm nay chỉ Y" (Value Stacking), and "Chỉ XK/ngày" (Daily Cost Breakdown) if a daily breakdown makes sense. Make the price feel trivial against the value + duration.',
  },
  {
    id: 'risk-reversal',
    labelVi: 'Đảm bảo / Hoàn tiền',
    wordShare: 0.05,
    brief: 'Risk Reversal — explicitly tell the reader they have NOTHING to lose. Money-back guarantee, free shipping, COD payment, try-before-pay. Remove every reason to hesitate.',
  },
  {
    id: 'urgency',
    labelVi: 'Khẩn cấp / Số lượng',
    wordShare: 0.05,
    brief: 'Add real urgency or scarcity (only if true — never fake). Limited stock, deadline, seasonal pricing, ending bonus. If no real scarcity exists, use Cost of Inaction instead ("Mỗi tháng không hành động = mất...").',
  },
  {
    id: 'faq',
    labelVi: 'FAQ xử lý objection',
    wordShare: 0.07,
    brief: 'Top 4-5 objections customers raise + concise rebuttals. Format: Q line + A paragraph. Cover: price, effectiveness doubt, fit doubt, comparison to alternatives, "tried before failed".',
  },
  {
    id: 'recap',
    labelVi: 'Tổng kết & Future Pacing',
    wordShare: 0.06,
    brief: 'Re-cap the story arc: where they were, where they\'ll be after using this. Use Future Pacing — let the reader IMAGINE specific scenes of life-after-product. Emotional close before the CTA.',
  },
  {
    id: 'final-cta',
    labelVi: 'Final CTA',
    wordShare: 0.04,
    brief: 'The closing CTA paragraph. Direct, action-verb, repeated 2x within the paragraph. Make the next step crystal clear. Final reminder of risk-reversal + bonus. Last line should feel like a friend pushing the reader to act.',
  },
]

// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite long-form direct-response copywriter who has written over $50M in winning advertorials / sales letters for Vietnamese + Malaysian SEA market. You have INTERNALISED the 14 copywriting formulas and write in a SINGLE NARRATIVE ARC that pulls the reader from the first line to the final CTA without losing them.

═══════════════════════════════════════════════════════════════
THE 14-SECTION BLUEPRINT — strict order, each section has a specific job
═══════════════════════════════════════════════════════════════
${LETTER_BLUEPRINT.map((s, i) => `${i + 1}. ${s.id} (${s.labelVi}) — ${Math.round(s.wordShare * 100)}% of total length\n   ${s.brief}`).join('\n\n')}

═══════════════════════════════════════════════════════════════
NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════
1. SINGLE NARRATIVE ARC — each section must logically lead to the next. Read the whole letter and it should feel like one continuous voice, not 14 disconnected blocks.
2. Use the customer's RAW LANGUAGE from mined pain points — NEVER brand-speak.
3. Use REAL ingredient names + USPs from the product brief — NEVER invent.
4. NEVER claim cure / treatment / guaranteed results.
5. Mobile-first formatting WITHIN each section: short paragraphs (2-4 lines), blank line breaks, occasional ✅ or ❌ where natural.
6. Each section's word count should ROUGHLY match its allocated share of total length — don't make any section 2x its target.
7. The opener earns the entire letter. If the hero hook is weak, the whole letter dies.

═══════════════════════════════════════════════════════════════
LANGUAGE
═══════════════════════════════════════════════════════════════
Vietnamese:
- Native Vietnamese long-form ad voice — informal mình/bạn register
- Customer raw vocabulary
- Vietnamese punctuation (… not ...)
- Each section is its own short essay (200-400 words at 2000-total)

Malaysian Malay:
- Native Malaysian colloquial Bahasa Melayu — NOT formal textbook
- Mix English where natural ("memang struggle", "tau tak", "I rasa")
- Keep product + ingredient names in English
- Sound like a real Malaysian creator writing at length

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exact markers, nothing else
═══════════════════════════════════════════════════════════════
${LETTER_BLUEPRINT.map((s) => `<<<${s.id}>>>\n<<<VI>>>\n[Vietnamese section ${s.labelVi}]\n<<<MY>>>\n[Malay section ${s.labelVi}]`).join('\n\n')}`

// ─────────────────────────────────────────────────────────────────────────

function getGeminiKey(): string {
  const s = useSettingsStore.getState()
  if (!s.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return s.getGeminiApiKey()
}

function formatPains(pains: PainPoint[]): string {
  return pains
    .map((p, i) => `${i + 1}. [intensity ${p.intensity}/5 · ${p.type}] ${p.textVi}`)
    .join('\n')
}

function formatAngle(angle: ContentAngle, idx: number): string {
  return [
    `ANGLE ${idx} (${angle.type}): ${angle.titleVi}`,
    `  ${angle.descriptionVi}`,
    `  Formula: ${angle.recommendedFormula}`,
  ].join('\n')
}

function buildUserPrompt(brief: LabBriefResult, targetLength: SalesLetterLength, focusAngle: ContentAngle | null): string {
  const product = useBankStore.getState().getProductById(brief.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm trong bank')

  const goal = getGoalById(brief.goal)
  const tone = getToneById(brief.toneId)

  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`TARGET LENGTH — ${targetLength} words per language version`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`The total VI section content should sum to approximately ${targetLength} words. Same for MY. Each section follows the word-share allocation from the system prompt.`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT (use real fields, never invent)')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (product.productName)        lines.push(`Name: ${product.productName}`)
  if (product.productDescription) lines.push(`Description: ${product.productDescription}`)
  if (product.targetMarket)       lines.push(`Target market: ${product.targetMarket}`)
  if (product.usps)               lines.push(`USPs: ${product.usps}`)
  if (product.benefits)           lines.push(`Benefits: ${product.benefits}`)
  if (product.offer)              lines.push(`Offer: ${product.offer}`)
  if (product.ingredients)        lines.push(`★ Ingredients & mechanism (name specifically + how they work): ${product.ingredients}`)
  if (product.usageGuide)         lines.push(`How to use: ${product.usageGuide}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('MINED PAIN POINTS (USE THE CUSTOMER\'S RAW LANGUAGE)')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(formatPains(brief.painPoints))

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (focusAngle) {
    lines.push('PRIMARY ANGLE — lead the narrative from this angle')
    lines.push('═══════════════════════════════════════════════════════════════')
    lines.push(formatAngle(focusAngle, 1))
  } else {
    lines.push('THE 3 ANGLES — weave them into the narrative arc')
    lines.push('═══════════════════════════════════════════════════════════════')
    brief.angles.forEach((a, i) => {
      lines.push(formatAngle(a, i + 1))
      lines.push('')
    })
  }

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`CAMPAIGN GOAL — ${goal?.label ?? brief.goal}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(goal?.promptHint ?? '')

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`TONE OF VOICE — ${tone?.label ?? brief.toneId}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(tone?.promptHint ?? '')
  if (brief.toneId === 'custom' && brief.customToneNote?.trim()) {
    lines.push('')
    lines.push('Custom tone note from user:')
    lines.push(brief.customToneNote.trim())
  }

  // Pricing Layer — HARD emphasis (sales letter is conversion-focused)
  const pricingBlock = buildPricingPromptBlock(brief.pricing, 'hard')
  if (pricingBlock) {
    lines.push('')
    lines.push(pricingBlock)
  }

  lines.push('')
  lines.push('Generate the 14-section sales letter using EXACT marker format. Each section in BOTH Vietnamese AND Malaysian Malay. Total VI content ≈ target length; same for MY.')

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────
// Marker extraction
// ─────────────────────────────────────────────────────────────────────────

function extractMarkerBlock(text: string, marker: string, nextMarkers: string[]): string {
  const safeMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const startRe = new RegExp(`<<<\\s*${safeMarker}\\s*>>>`, 'i')
  const startMatch = startRe.exec(text)
  if (!startMatch) return ''

  const after = text.slice(startMatch.index + startMatch[0].length)
  let nearest = after.length
  for (const m of nextMarkers) {
    const safeNext = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`<<<\\s*${safeNext}\\s*>>>`, 'i')
    const found = re.exec(after)
    if (found && found.index < nearest) nearest = found.index
  }
  return after.slice(0, nearest).trim()
}

function parseSections(raw: string): SalesLetterSection[] {
  const out: SalesLetterSection[] = []
  const allIds = LETTER_BLUEPRINT.map((s) => s.id)

  for (const spec of LETTER_BLUEPRINT) {
    const otherIds = allIds.filter((id) => id !== spec.id)
    const sectionBlock = extractMarkerBlock(raw, spec.id, otherIds)
    if (!sectionBlock) continue

    const vi = extractMarkerBlock(sectionBlock, 'VI', ['MY'])
    const my = extractMarkerBlock(sectionBlock, 'MY', ['VI'])

    if (vi && my) {
      out.push({
        id: crypto.randomUUID(),
        sectionType: spec.id,
        labelVi: spec.labelVi,
        vietnamese: vi,
        malay: my,
      })
    }
  }

  return out
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

// ─────────────────────────────────────────────────────────────────────────
// Main export.
// ─────────────────────────────────────────────────────────────────────────

export async function generateSalesLetter(
  brief: LabBriefResult,
  targetLength: SalesLetterLength,
  focusAngle: ContentAngle | null,
): Promise<SalesLetterOutput> {
  const apiKey = getGeminiKey()
  const userPrompt = buildUserPrompt(brief, targetLength, focusAngle)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    // 14 sections × ~2x target length (for VI + MY both) + markers
    maxOutputTokens: 24576,
  })

  const sections = parseSections(raw)
  if (sections.length < 8) {
    throw new Error(`Gemini chỉ trả về ${sections.length}/14 section — thử lại`)
  }

  const wordCountVi = sections.reduce((sum, s) => sum + countWords(s.vietnamese), 0)
  const wordCountMy = sections.reduce((sum, s) => sum + countWords(s.malay), 0)

  return {
    targetLength,
    sections,
    wordCountVi,
    wordCountMy,
    generatedAt: Date.now(),
  }
}
