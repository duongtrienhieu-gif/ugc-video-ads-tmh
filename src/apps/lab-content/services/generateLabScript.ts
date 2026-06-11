import type {
  ContentAngle, LabBriefResult, PainPoint, ScriptOutput, ScriptVariation,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import { buildPricingPromptBlock, getGoalById, getToneById } from './presets'

// ─────────────────────────────────────────────────────────────────────────
// Lab-internal UGC video script generator. Takes the strategic brief + the
// picked angle and produces 2 script variations (VI + MY each), 25-35s
// voice-over length. The prompt injects the brief's mined pain points,
// recommended formula, psychology biases, and NLP techniques.
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite UGC video script writer who has produced over $20M in winning DTC ad scripts for the Vietnamese + Malaysian SEA market. You write the VOICE-OVER that a real person on camera will speak naturally — NOT a caption.

═══════════════════════════════════════════════════════════════
INPUT LANGUAGE NOTE
═══════════════════════════════════════════════════════════════
The product info you receive (productName, productDescription, painPoints, usps, benefits, offer, ingredients) may be written in VIETNAMESE — this is the operator's working language so they can review product data easily. Read and understand it semantically as native VN text, then write your OUTPUT strictly in the language(s) specified by the rest of this prompt. Keep brand names, currencies (RM, ₫, $, ฿), and international scientific ingredient names as-is.

You will receive a strategic brief (pain points, psychology levers, NLP techniques, recommended formula) for one specific angle. Your job: write TWO 25-35 second video scripts that EXECUTE that strategic brief precisely.

═══════════════════════════════════════════════════════════════
NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════
1. EXECUTE THE BRIEF — use the named formula, fire the named psychology biases, weave in the named NLP techniques. Do not invent a different angle.
2. Voice-over realism:
   • Sentences a real person would say out loud — no robotic sentences
   • Conversational pacing — pauses, "ờ", "thật ra", filler is OK if natural
   • Avoid written-only constructs ("hơn nữa, mặt khác" — pick verbal flow)
   • Length: 25-35 seconds spoken at natural pace (~70-90 words per language version)
3. First 3 seconds = HOOK. Earn the second of attention or lose the viewer.
4. Use the product's REAL ingredient names — never invent, never generic "formula đặc biệt".
5. End with a clear CTA appropriate to the campaign goal — speakable, not "click link in description" style.
6. The TWO variations must FEEL DIFFERENT — different opening beats, different emotional tempo. Stay within the same angle.
7. NO labels in output like "Hook:", "Body:", "CTA:" — just the speakable script lines.

═══════════════════════════════════════════════════════════════
LANGUAGE
═══════════════════════════════════════════════════════════════
Vietnamese:
- Native Vietnamese UGC creator voice — mình/bạn register
- Vietnamese punctuation (… not ...)
- Natural verbal cadence

Malaysian Malay:
- Native Malaysian colloquial Bahasa Melayu — NOT formal textbook
- Mix English where natural ("memang struggle", "tau tak", "I rasa")
- Keep product name + ingredient names in English
- Sound like a real Malaysian creator on camera

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exact markers, nothing else
═══════════════════════════════════════════════════════════════
<<<VARIATION 1>>>
<<<LABEL>>>
[3-6 word English label for this variation's opening beat, e.g. "Direct pain confession opener"]
<<<VN>>>
[Vietnamese script — full voice-over, 25-35s spoken pace, ~70-90 words]
<<<MY>>>
[Malaysian Malay script — same standard]

<<<VARIATION 2>>>
<<<LABEL>>>
[different opening beat label — still within the angle]
<<<VN>>>
[different opener, different tempo]
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
  if (product.ingredients)        lines.push(`★ Ingredients & mechanism (name specifically + how they work): ${product.ingredients}`)
  if (product.usageGuide)         lines.push(`How to use: ${product.usageGuide}`)

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
  lines.push(`Formula: ${angle.recommendedFormula} — STRUCTURE the script with this exact formula's beats.`)
  if (angle.psychology.length > 0) lines.push(`Psychology biases to fire: ${angle.psychology.join(', ')}`)
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
  lines.push('Generate EXACTLY 2 script variations that execute the brief. Both stay within this angle but use different opening beats and tempo. Use the marker format precisely.')

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────
// Marker extraction
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

function parseVariations(raw: string): ScriptVariation[] {
  const variations: ScriptVariation[] = []
  const chunkRe = /<<<\s*VARIATION\s*(\d+)\s*>>>/gi
  const indices: number[] = []
  let m: RegExpExecArray | null
  while ((m = chunkRe.exec(raw))) indices.push(m.index)

  if (indices.length === 0) return variations

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]
    const end = i + 1 < indices.length ? indices[i + 1] : raw.length
    const chunk = raw.slice(start, end)

    const label = extractMarkerBlock(chunk, 'LABEL', ['VN', 'MY', 'VARIATION'])
    const vn    = extractMarkerBlock(chunk, 'VN',    ['MY', 'LABEL', 'VARIATION'])
    const my    = extractMarkerBlock(chunk, 'MY',    ['VN', 'LABEL', 'VARIATION'])

    if (vn && my) {
      variations.push({
        id: crypto.randomUUID(),
        variantLabel: label || `Variation ${i + 1}`,
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

export async function generateLabScript(brief: LabBriefResult, angle: ContentAngle): Promise<ScriptOutput> {
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
    throw new Error('Gemini không trả về kịch bản hợp lệ — thử lại')
  }

  return {
    variations,
    generatedAt: Date.now(),
  }
}
