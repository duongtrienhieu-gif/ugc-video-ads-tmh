import type {
  CaptionOutput, CaptionVariation, ContentAngle, LabBriefResult, PainPoint,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import { buildPricingPromptBlock, getGoalById, getToneById } from './presets'

// ─────────────────────────────────────────────────────────────────────────
// Lab-internal caption generator. Takes the strategic brief + the picked
// angle and produces 2 caption variations (VI + MY each). The prompt is
// richer than Ads Content's because it injects the brief's mined pain
// points, recommended formula, psychology biases, and NLP techniques.
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite performance media buyer who has written over $10M in winning Facebook + TikTok DTC ecommerce ad CAPTIONS for the Vietnamese + Malaysian SEA market.

═══════════════════════════════════════════════════════════════
INPUT LANGUAGE NOTE
═══════════════════════════════════════════════════════════════
The product info you receive (productName, productDescription, painPoints, usps, benefits, offer, ingredients) may be written in VIETNAMESE — this is the operator's working language so they can review product data easily. Read and understand it semantically as native VN text, then write your OUTPUT strictly in the language(s) specified by the rest of this prompt. Keep brand names, currencies (RM, ₫, $, ฿), and international scientific ingredient names as-is.

You will receive a strategic brief (pain points, psychology levers, NLP techniques, recommended formula) for one specific angle. Your job: write TWO caption variations that EXECUTE that strategic brief precisely.

═══════════════════════════════════════════════════════════════
NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════
1. EXECUTE THE BRIEF — use the named formula, fire the named psychology biases, weave in the named NLP techniques. Do not invent a different angle.
2. Mobile-first formatting:
   • Short paragraphs (1-3 lines max) separated by BLANK LINES
   • Strategic emoji at the START of paragraphs for visual rhythm
   • ✅ for benefits, ❌ for failed alternatives
   • 👉 / 👇 to point at CTAs at the end
   • NO giant text walls
3. The first line of the caption is the HOOK — it earns the "see more" tap
4. Use the product's REAL ingredient names from the brief — never invent, never generic "powerful formula"
5. NEVER claim cure / treatment / guaranteed results — keep tone advertorial-safe
6. End with a clear CTA appropriate to the campaign goal
7. The TWO variations must FEEL DIFFERENT from each other — different opening tactics within the same angle
8. NO markdown headers, NO bullet symbols other than ✅ / ❌, NO labels like "Hook:" / "CTA:"

═══════════════════════════════════════════════════════════════
LANGUAGE
═══════════════════════════════════════════════════════════════
Vietnamese:
- Natural Vietnamese ecommerce ad voice, mình/bạn register
- Vietnamese punctuation (… not ...)
- Mobile-first paragraph rhythm

Malaysian Malay:
- Native Malaysian colloquial Bahasa Melayu — NOT formal textbook
- Mix English where natural ("memang worth it", "I tak sangka", "tau tak")
- Keep product name + ingredient names in English
- Sound like a real Malaysian creator

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exact markers, nothing else
═══════════════════════════════════════════════════════════════
<<<VARIATION 1>>>
<<<HOOK>>>
[3-6 word English label describing this variation's opening tactic]
<<<VN>>>
[Vietnamese caption — blank-line paragraph rhythm + emoji rhythm]
<<<MY>>>
[Malaysian Malay caption — same standard]

<<<VARIATION 2>>>
<<<HOOK>>>
[different opening tactic label — still within the angle]
<<<VN>>>
[different hook, different pacing]
<<<MY>>>
[matching Malay]`

// ─────────────────────────────────────────────────────────────────────────

function getGeminiKey(): string {
  const s = useSettingsStore.getState()
  if (!s.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return s.getGeminiApiKey()
}

function formatPainPoints(pains: PainPoint[]): string {
  return pains
    .map((p, i) => `${i + 1}. [intensity ${p.intensity}/5 · ${p.type}] ${p.textVi}`)
    .join('\n')
}

function buildUserPrompt(brief: LabBriefResult, angle: ContentAngle): string {
  const product = useBankStore.getState().getProductById(brief.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm trong bank')

  const goal = getGoalById(brief.goal)
  const tone = getToneById(brief.toneId)

  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT (use real fields, never invent)')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (product.productName)        lines.push(`Name: ${product.productName}`)
  if (product.productDescription) lines.push(`Description: ${product.productDescription}`)
  if (product.targetMarket)       lines.push(`Target market: ${product.targetMarket}`)
  if (product.usps)               lines.push(`USPs: ${product.usps}`)
  if (product.benefits)           lines.push(`Benefits: ${product.benefits}`)
  if (product.offer)              lines.push(`Offer: ${product.offer}`)
  if (product.ingredients)        lines.push(`★ Ingredients (name specifically): ${product.ingredients}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('MINED PAIN POINTS (use the customer\'s raw language)')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(formatPainPoints(brief.painPoints))

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`THE ANGLE TO EXECUTE — ${angle.type.toUpperCase()}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Title: ${angle.titleVi}`)
  lines.push(`Direction: ${angle.descriptionVi}`)
  lines.push(`Formula: ${angle.recommendedFormula} — STRUCTURE the caption with this exact formula's beats.`)
  if (angle.psychology.length > 0) lines.push(`Psychology biases to fire (woven into the copy): ${angle.psychology.join(', ')}`)
  if (angle.nlpTechniques.length > 0) lines.push(`NLP techniques to apply: ${angle.nlpTechniques.join(', ')}`)

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

  // Pricing layer — emphasis derived from campaign goal
  const emphasis: 'soft' | 'medium' | 'hard' =
    brief.goal === 'conversion' || brief.goal === 'retargeting' ? 'hard'
    : brief.goal === 'engagement' ? 'medium'
    : 'soft'
  const pricingBlock = buildPricingPromptBlock(brief.pricing, emphasis)
  if (pricingBlock) {
    lines.push('')
    lines.push(pricingBlock)
  }

  lines.push('')
  lines.push('Generate EXACTLY 2 caption variations that execute the brief. Both stay within this angle but use different opening tactics. Use the marker format precisely.')

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────
// Marker extraction — reused style from generateAdsContent.ts / generateBrief.ts
// ─────────────────────────────────────────────────────────────────────────

function extractMarkerBlock(text: string, marker: string, nextMarkers: string[]): string {
  const startRe = new RegExp(`<<<\\s*${marker}\\s*>>>`, 'i')
  const startMatch = startRe.exec(text)
  if (!startMatch) return ''

  const after = text.slice(startMatch.index + startMatch[0].length)
  let nearest = after.length
  for (const m of nextMarkers) {
    const re = new RegExp(`<<<\\s*${m}\\s*>>>`, 'i')
    const found = re.exec(after)
    if (found && found.index < nearest) nearest = found.index
  }
  return after.slice(0, nearest).trim()
}

function parseVariations(raw: string): CaptionVariation[] {
  const variations: CaptionVariation[] = []
  const chunkRe = /<<<\s*VARIATION\s*(\d+)\s*>>>/gi
  const indices: number[] = []
  let m: RegExpExecArray | null
  while ((m = chunkRe.exec(raw))) indices.push(m.index)

  if (indices.length === 0) return variations

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]
    const end = i + 1 < indices.length ? indices[i + 1] : raw.length
    const chunk = raw.slice(start, end)

    const hook = extractMarkerBlock(chunk, 'HOOK', ['VN', 'MY', 'VARIATION'])
    const vn   = extractMarkerBlock(chunk, 'VN',   ['MY', 'HOOK', 'VARIATION'])
    const my   = extractMarkerBlock(chunk, 'MY',   ['VN', 'HOOK', 'VARIATION'])

    if (vn && my) {
      variations.push({
        id: crypto.randomUUID(),
        hookLabel: hook || `Variation ${i + 1}`,
        vietnamese: vn,
        malay: my,
      })
    }
  }

  return variations
}

// ─────────────────────────────────────────────────────────────────────────
// Main export.
// ─────────────────────────────────────────────────────────────────────────

export async function generateLabCaption(brief: LabBriefResult, angle: ContentAngle): Promise<CaptionOutput> {
  const apiKey = getGeminiKey()
  const userPrompt = buildUserPrompt(brief, angle)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    maxOutputTokens: 6144,
  })

  const variations = parseVariations(raw)
  if (variations.length === 0) {
    throw new Error('Gemini không trả về caption hợp lệ — thử lại')
  }

  return {
    variations,
    generatedAt: Date.now(),
  }
}
