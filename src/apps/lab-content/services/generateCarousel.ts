import type {
  CarouselOutput, CarouselSlide, CarouselStructure, CarouselStructureOption,
  LabBriefResult, PainPoint,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import { buildPricingPromptBlock, getToneById } from './presets'

// ─────────────────────────────────────────────────────────────────────────
// Carousel Ad Generator — 6-10 slide IG/FB carousel ads, bilingual VI+MY.
// Each slide has caption text + visual direction + background suggestion.
// 4 structure types user can pick.
// ─────────────────────────────────────────────────────────────────────────

export const CAROUSEL_STRUCTURE_OPTIONS: CarouselStructureOption[] = [
  {
    id: 'problem-solution',
    label: 'Problem → Solution',
    glyph: '⚡',
    slideCount: 6,
    hint: '6 slide · Hook → 2 đau → reveal → benefit → CTA',
    briefEn: `PROBLEM-SOLUTION structure — 6 slides:
SLIDE 1: HOOK — short scroll-stopping question or punchline (5-10 words). Examples: "Bạn cũng thế?" or "Đừng tin điều này…"
SLIDE 2: PAIN POINT 1 — name a specific pain in customer's raw language. Make them feel seen.
SLIDE 3: PAIN POINT 2 — name a second related pain that compounds the first.
SLIDE 4: REVEAL — flip the narrative. "Thật ra vấn đề không phải là X — mà là Y" or "Có 1 thứ khác làm nên khác biệt".
SLIDE 5: BENEFIT — show what the product solves. Use 1-2 specific outcomes from the brief's USPs / benefits.
SLIDE 6: CTA — direct action verb. Mention the offer if pricing layer enabled.`,
  },
  {
    id: 'before-after',
    label: 'Before / After Story',
    glyph: '↔️',
    slideCount: 8,
    hint: '8 slide · Story arc transformation',
    briefEn: `BEFORE-AFTER STORY structure — 8 slides:
SLIDE 1: SCENE — set the time / place / character ("Tháng 3 vừa rồi…", "Cuối năm 2023…").
SLIDE 2: STRUGGLE 1 — first specific struggle moment with concrete sensory detail.
SLIDE 3: STRUGGLE 2 — escalation, things got worse before better.
SLIDE 4: TURNING POINT — the discovery moment. Use Pattern Interrupt or insider-secret framing.
SLIDE 5: RESULT — specific result with timeframe ("Sau 21 ngày..." / "2 tuần sau…"). NEVER claim cure.
SLIDE 6: PROOF — testimonial-style line or specific number. Use Specificity Bias (odd numbers).
SLIDE 7: OFFER — present the product + offer naturally as part of the story conclusion.
SLIDE 8: CTA — action verb + soft urgency.`,
  },
  {
    id: 'mechanism',
    label: 'Mechanism Explainer',
    glyph: '🔬',
    slideCount: 8,
    hint: '8 slide · Vì sao + ingredient deep-dive',
    briefEn: `MECHANISM EXPLAINER structure — 8 slides:
SLIDE 1: HOOK — myth-busting question or counter-intuitive truth. Examples: "Đây là lý do bạn vẫn đau lưng dù đã đắp cao…"
SLIDE 2: WHY THE PROBLEM HAPPENS — explain the root cause in plain language (NOT medical jargon).
SLIDE 3: HOW IT WORKS — high-level mechanism the product uses to address that cause.
SLIDE 4: INGREDIENT 1 — name a real ingredient from brief + 1-sentence what it does.
SLIDE 5: INGREDIENT 2 — second real ingredient + what it does.
SLIDE 6: RESULT — what the customer experiences when mechanism + ingredients combine.
SLIDE 7: SOCIAL PROOF — testimonial-style or specific count ("12,847 người…").
SLIDE 8: CTA — confident, evidence-led close.`,
  },
  {
    id: 'listicle-five',
    label: '5 Ways / 5 Mistakes',
    glyph: '🔢',
    slideCount: 7,
    hint: '7 slide · Listicle 5 mục + CTA',
    briefEn: `LISTICLE structure — 7 slides:
SLIDE 1: HOOK — "5 sai lầm hầu hết mọi người mắc khi…" or "5 cách giải quyết X mà bạn chưa từng nghe". The hook must imply VALUE inside the listicle.
SLIDE 2: #1 — first item, label "1." + 1-line content + 1 visual cue.
SLIDE 3: #2 — second item.
SLIDE 4: #3 — third item.
SLIDE 5: #4 — fourth item.
SLIDE 6: #5 — fifth item. End on the strongest or most counter-intuitive point.
SLIDE 7: CTA — summary + action verb. If pricing layer enabled, mention offer.`,
  },
]

export function getCarouselStructureById(id: string): CarouselStructureOption | undefined {
  return CAROUSEL_STRUCTURE_OPTIONS.find((s) => s.id === id)
}

// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT_BASE = `You are an elite multi-slide ad designer who has built over $20M in winning IG + FB carousel ads for the Vietnamese + Malaysian SEA market. Carousel ads have the HIGHEST CTR of any paid ad format because each slide compounds the next — readers swipe because each slide promises payoff in the next.

═══════════════════════════════════════════════════════════════
ANATOMY OF EACH SLIDE
═══════════════════════════════════════════════════════════════
Every slide has 4 elements:
1. CAPTION (5-15 words VN, same range MY) — text overlaid on the slide. KEEP IT SHORT — carousel slides are SCANNED in <2 seconds each.
2. VISUAL DIRECTION (1 line VN) — describe the IMAGE that pairs with this caption. e.g. "Ảnh cận cảnh sản phẩm trên tay, lighting cửa sổ chiều ấm"
3. BACKGROUND SUGGEST — color palette label (vd: "Cream + accent đỏ", "Đen sang trọng + chữ vàng", "Pastel hồng + xanh mint")
4. SLIDE POSITION — the number in the sequence (handled by output marker).

═══════════════════════════════════════════════════════════════
NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════
1. EACH SLIDE'S CAPTION ≤ 15 words. Long captions on carousel = scroll past.
2. EACH SLIDE'S COMPLETION should pull the swipe to the next — end mid-thought, with a question, or a hook into the next reveal.
3. THE FIRST SLIDE must earn the SECOND swipe. If slide 1 is generic, the carousel dies.
4. Use the customer's RAW LANGUAGE from mined pain points — NEVER brand-speak.
5. Use REAL ingredient names — NEVER invent.
6. NEVER claim cure / treatment / guaranteed results.
7. The last slide ALWAYS has a clear CTA + specific action verb.

═══════════════════════════════════════════════════════════════
LANGUAGE
═══════════════════════════════════════════════════════════════
Vietnamese: native VN ad voice, mình/bạn register, customer raw vocabulary, Vietnamese punctuation (…).
Malaysian Malay: native colloquial Bahasa Melayu (NOT formal), mix English naturally ("memang struggle", "tau tak"), keep product + ingredient names in English.`

const OUTPUT_FORMAT_INSTRUCTION = `═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exact markers, nothing else
═══════════════════════════════════════════════════════════════
For each slide use this exact block format:

<<<SLIDE N>>>
<<<CAPTION_VI>>>[Vietnamese caption ≤ 15 words]
<<<CAPTION_MY>>>[Malay caption ≤ 15 words]
<<<VISUAL>>>[Vietnamese 1-line visual direction]
<<<BG>>>[Background palette label]

Generate ALL slides for the chosen structure in numeric order.`

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

function buildSystemPrompt(structure: CarouselStructureOption): string {
  return [
    SYSTEM_PROMPT_BASE,
    '',
    '═══════════════════════════════════════════════════════════════',
    `STRUCTURE — ${structure.label} (${structure.slideCount} slides)`,
    '═══════════════════════════════════════════════════════════════',
    structure.briefEn,
    '',
    OUTPUT_FORMAT_INSTRUCTION,
  ].join('\n')
}

function buildUserPrompt(brief: LabBriefResult, structure: CarouselStructureOption): string {
  const product = useBankStore.getState().getProductById(brief.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm trong bank')

  const tone = getToneById(brief.toneId)

  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT')
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
  lines.push(`TONE OF VOICE — ${tone?.label ?? brief.toneId}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(tone?.promptHint ?? '')
  if (brief.toneId === 'custom' && brief.customToneNote?.trim()) {
    lines.push('')
    lines.push('Custom tone note from user:')
    lines.push(brief.customToneNote.trim())
  }

  // Pricing emphasis: medium — final slide leverages anchor/offer if available
  const pricingBlock = buildPricingPromptBlock(brief.pricing, 'medium')
  if (pricingBlock) {
    lines.push('')
    lines.push(pricingBlock)
    lines.push('')
    lines.push('CAROUSEL PRICING APPLICATION: First N-1 slides stay strategy-led. The final CTA slide mentions the offer + anchor price if available.')
  }

  lines.push('')
  lines.push(`Generate EXACTLY ${structure.slideCount} slides in numeric order using the EXACT marker format. Each slide caption ≤ 15 words.`)

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

function parseSlides(raw: string): CarouselSlide[] {
  const out: CarouselSlide[] = []
  const slideRe = /<<<\s*SLIDE\s+(\d+)\s*>>>/gi
  const indices: { index: number; position: number }[] = []
  let m: RegExpExecArray | null
  while ((m = slideRe.exec(raw))) {
    indices.push({ index: m.index, position: parseInt(m[1], 10) })
  }

  if (indices.length === 0) return out

  const nextMarkers = ['CAPTION_VI', 'CAPTION_MY', 'VISUAL', 'BG', 'SLIDE']

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].index
    const end = i + 1 < indices.length ? indices[i + 1].index : raw.length
    const chunk = raw.slice(start, end)

    const captionVi = extractMarkerBlock(chunk, 'CAPTION_VI', nextMarkers.filter((m) => m !== 'CAPTION_VI'))
    const captionMy = extractMarkerBlock(chunk, 'CAPTION_MY', nextMarkers.filter((m) => m !== 'CAPTION_MY'))
    const visual    = extractMarkerBlock(chunk, 'VISUAL',     nextMarkers.filter((m) => m !== 'VISUAL'))
    const bg        = extractMarkerBlock(chunk, 'BG',         nextMarkers.filter((m) => m !== 'BG'))

    if (captionVi) {
      out.push({
        id: crypto.randomUUID(),
        position: indices[i].position,
        captionVi,
        captionMy: captionMy || captionVi,
        visualDirectionVi: visual || '',
        backgroundSuggest: bg || '',
      })
    }
  }

  // Sort by position
  out.sort((a, b) => a.position - b.position)
  return out
}

// ─────────────────────────────────────────────────────────────────────────
// Main export.
// ─────────────────────────────────────────────────────────────────────────

export async function generateCarousel(
  brief: LabBriefResult,
  structureId: CarouselStructure,
): Promise<CarouselOutput> {
  const apiKey = getGeminiKey()
  const structure = getCarouselStructureById(structureId)
  if (!structure) throw new Error(`Structure không tồn tại: ${structureId}`)

  const systemPrompt = buildSystemPrompt(structure)
  const userPrompt = buildUserPrompt(brief, structure)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: systemPrompt,
    // 8 slides × ~30 words × 2 lang + visual + bg + markers
    maxOutputTokens: 8192,
  })

  const slides = parseSlides(raw)
  if (slides.length === 0) {
    throw new Error('Gemini không trả về slide hợp lệ — thử lại')
  }

  return {
    structure: structureId,
    slides,
    generatedAt: Date.now(),
  }
}
