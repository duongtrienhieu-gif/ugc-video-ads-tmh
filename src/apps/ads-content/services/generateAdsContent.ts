import type {
  AdsContentGenParams, AdsContentResult, AdsContentVariation,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import {
  getAdsPresetById, getPlatformById, LENGTH_OPTIONS, TONE_OPTIONS,
} from './presets'

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — briefed as an elite Facebook/TikTok media buyer who
// writes CAPTIONS (text alongside the creative), not voice-over scripts.
// Mobile-first formatting is non-negotiable: short paragraphs, blank line
// breaks, strategic emojis, ✅/❌ lists, 👉/👇 for CTAs.
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite performance media buyer who has written over $10M in winning Facebook + TikTok DTC ecommerce ad CAPTIONS for the Southeast Asian market — Malaysia and Vietnam in particular.

You write ad CAPTIONS — the text that appears next to a video / image creative on a feed. NOT voice-over scripts. Treat the output as something a person scrolling on their phone will READ.

═══════════════════════════════════════════════════════════════
NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════
1. Mobile-first formatting:
   • Short paragraphs (1-3 lines max) separated by BLANK LINES
   • Strategic emoji at the START of paragraphs for visual rhythm
   • ✅ for benefits, ❌ for failed alternatives
   • 👉 / 👇 to point at CTAs at the end
   • NO giant text walls
2. The first line of the caption is the HOOK — it earns the "see more" tap
3. Use the product's REAL ingredient names from the brief — never invent, never generic "powerful formula"
4. Education when it helps trust: explain WHY the problem happens, HOW the ingredient works, WHY this is different — in conversational creator voice, NOT medical textbook
5. NEVER claim cure / treatment / guaranteed results — keep tone advertorial-safe
6. End with a clear CTA appropriate to the chosen CTA strength
7. Make each variation FEEL DIFFERENT from the others — different hook angle, different emotional energy, different pacing, different CTA — not just reworded sentences
8. NO markdown headers (#), NO bullet symbols other than ✅ / ❌, NO labels like "Hook:", "CTA:", "Body:"

═══════════════════════════════════════════════════════════════
LANGUAGE — both versions must read as native, not translated
═══════════════════════════════════════════════════════════════
Vietnamese:
- Natural Vietnamese ecommerce ad voice
- Informal "mình/bạn" register
- Vietnamese punctuation properly (… not ...)
- Mobile-first paragraph rhythm
- Local creator tone, not corporate

Malaysian Malay:
- Native Malaysian colloquial Bahasa Melayu — NOT formal textbook
- Mix English where natural ("memang worth it", "serius gila", "I tak sangka", "tau tak")
- Keep product NAME and INGREDIENT NAMES in English
- Sound like a real Malaysian creator on TikTok / Facebook

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exact markers, nothing else
═══════════════════════════════════════════════════════════════
<<<VARIATION 1>>>
<<<HOOK>>>
[3-6 word English label describing this variation's hook angle, e.g. "Pain-led emotional opener" or "Insider-secret curiosity"]
<<<VN>>>
[Vietnamese caption — formatted with blank-line paragraph breaks and emoji rhythm]
<<<MY>>>
[Malaysian Malay caption — same formatting standard]

<<<VARIATION 2>>>
<<<HOOK>>>
[different angle label]
<<<VN>>>
[different hook, different pacing]
<<<MY>>>
[matching Malay version]

<<<VARIATION 3>>>
<<<HOOK>>>
[third angle label]
<<<VN>>>
[third distinct variation]
<<<MY>>>
[matching Malay version]`

// ─────────────────────────────────────────────────────────────────────────

function getGeminiKey(): string {
  const s = useSettingsStore.getState()
  if (!s.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return s.getGeminiApiKey()
}

// ─────────────────────────────────────────────────────────────────────────
// Build the user-message portion of the prompt.
// ─────────────────────────────────────────────────────────────────────────

function buildUserPrompt(params: AdsContentGenParams): string {
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm trong bank')

  const preset = getAdsPresetById(params.presetId)
  if (!preset) throw new Error(`Preset không tồn tại: ${params.presetId}`)

  const platform = getPlatformById(params.platform)
  if (!platform) throw new Error(`Platform không tồn tại: ${params.platform}`)

  const lengthOpt = LENGTH_OPTIONS.find((l) => l.id === params.lengthMode) ?? LENGTH_OPTIONS[1]

  const toneHints = TONE_OPTIONS
    .filter((t) => params.toneIds.includes(t.id))
    .map((t) => `- ${t.label}: ${t.promptHint}`)
    .join('\n')

  // Educational mode is implicit for mechanism-category presets, explicit for the rest
  const educationalActive = params.educationalMode || preset.category === 'mechanism'

  const ctaBrief =
    params.ctaStrength === 'soft'
      ? 'CTA strength: SOFT — gentle invitation ("link in bio if curious"). No urgency, no pressure.'
      : params.ctaStrength === 'hard'
        ? 'CTA strength: HARD — direct, urgent, scarcity if applicable ("tap now, limited stock", "today only"). For warm audiences.'
        : 'CTA strength: BALANCED — confident, direct, no pressure tactics.'

  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT (use real fields, never invent)')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (product.productName)        lines.push(`Name: ${product.productName}`)
  if (product.productDescription) lines.push(`Description: ${product.productDescription}`)
  if (product.targetMarket)       lines.push(`Target market: ${product.targetMarket}`)
  if (product.painPoints)         lines.push(`Pain points: ${product.painPoints}`)
  if (product.usps)               lines.push(`USPs: ${product.usps}`)
  if (product.benefits)           lines.push(`Benefits: ${product.benefits}`)
  if (product.offer)              lines.push(`Offer: ${product.offer}`)
  if (product.ingredients)        lines.push(`★ Ingredients (name specifically — never generic): ${product.ingredients}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`PRESET — ${preset.label} (${preset.category})`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Brief: ${preset.briefEn}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`PLATFORM — ${platform.label}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(platform.promptHint)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('LENGTH + CTA + TONE')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Target length: ~${lengthOpt.targetWords} words per language version (${lengthOpt.label}).`)
  lines.push(ctaBrief)
  if (toneHints) {
    lines.push('')
    lines.push('Tone modifiers (apply ALL):')
    lines.push(toneHints)
  }

  if (educationalActive) {
    lines.push('')
    lines.push('═══════════════════════════════════════════════════════════════')
    lines.push('EDUCATIONAL SELLING — ON')
    lines.push('═══════════════════════════════════════════════════════════════')
    lines.push('Build BELIEF, not just desire. The caption must explain:')
    lines.push('- WHY the problem happens (mechanism, not just "X is bad")')
    lines.push('- HOW one or two key ingredients work, named specifically')
    lines.push('- WHY this product is different from the category default')
    lines.push('Use conversational explanations — analogies, plain-language framing. NEVER medical-textbook tone. NEVER cure / treatment claims.')
  }

  lines.push('')
  lines.push('Generate EXACTLY 3 distinct variations. Each must differ in hook angle, emotional energy, pacing, and CTA style. Use the <<<VARIATION N>>> / <<<HOOK>>> / <<<VN>>> / <<<MY>>> markers EXACTLY.')

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────
// Parse 3 variations out of the Gemini response. Tolerant of small marker
// variance (whitespace, capitalization).
// ─────────────────────────────────────────────────────────────────────────

function extractMarkerBlock(text: string, marker: string, nextMarkers: string[]): string {
  const startRe = new RegExp(`<<<\\s*${marker}\\s*>>>`, 'i')
  const startMatch = startRe.exec(text)
  if (!startMatch) return ''

  const after = text.slice(startMatch.index + startMatch[0].length)
  // Find the nearest next marker
  let nearest = after.length
  for (const m of nextMarkers) {
    const re = new RegExp(`<<<\\s*${m}\\s*>>>`, 'i')
    const found = re.exec(after)
    if (found && found.index < nearest) nearest = found.index
  }
  return after.slice(0, nearest).trim()
}

function parseVariations(raw: string): AdsContentVariation[] {
  const variations: AdsContentVariation[] = []
  // Split into variation chunks by <<<VARIATION N>>>
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

export async function generateAdsContent(params: AdsContentGenParams): Promise<AdsContentResult> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ Project')

  const preset = getAdsPresetById(params.presetId)
  if (!preset) throw new Error(`Preset không hợp lệ: ${params.presetId}`)
  const platform = getPlatformById(params.platform)
  if (!platform) throw new Error(`Platform không hợp lệ: ${params.platform}`)

  const userPrompt = buildUserPrompt(params)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    // Ads content is longer-form than scripts — bump the token budget.
    maxOutputTokens: 8192,
  })

  const variations = parseVariations(raw)

  if (variations.length === 0) {
    throw new Error('Gemini không trả về variation hợp lệ — thử lại')
  }

  return {
    variations,
    presetId: params.presetId,
    presetLabel: preset.label,
    presetGlyph: preset.glyph,
    platform: params.platform,
    platformLabel: platform.label,
    lengthMode: params.lengthMode,
    toneIds: params.toneIds,
    ctaStrength: params.ctaStrength,
    educationalMode: params.educationalMode || preset.category === 'mechanism',
    productId: params.productId,
    productName: product.productName,
    generatedAt: Date.now(),
  }
}
