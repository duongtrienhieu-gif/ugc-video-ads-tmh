import type {
  CocFormatId, CocMicroContent, CocOutput, LabBriefResult,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import { COC_FORMAT_OPTIONS, buildPricingPromptBlock, getToneById } from './presets'

// ─────────────────────────────────────────────────────────────────────────
// COC Multiplier — 1 pillar content → 7 platform-specific micro-content.
// Implements the "COC" (Content Once, Cut-many) formula from the skill.
// Each micro is platform-native, bilingual VI + MY, preserves the pillar's
// core message but reshapes language + length + rhythm to fit the channel.
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite content repurposer who has multiplied $20M+ worth of pillar content into platform-native micro-content for the Vietnamese + Malaysian SEA market. You understand that EACH platform has its own RHYTHM, ATTENTION SPAN, and TONE — copy-pasting the same caption everywhere is the #1 mistake amateurs make.

═══════════════════════════════════════════════════════════════
INPUT LANGUAGE NOTE
═══════════════════════════════════════════════════════════════
The product info you receive (productName, productDescription, painPoints, usps, benefits, offer, ingredients) may be written in VIETNAMESE — this is the operator's working language so they can review product data easily. Read and understand it semantically as native VN text, then write your OUTPUT strictly in the language(s) specified by the rest of this prompt. Keep brand names, currencies (RM, ₫, $, ฿), and international scientific ingredient names as-is.

═══════════════════════════════════════════════════════════════
YOUR JOB
═══════════════════════════════════════════════════════════════
Given ONE pillar content piece + product/tone context, produce EXACTLY 7 platform-native micro-content variants. Each variant:
1. Preserves the pillar's CORE MESSAGE and PROOF POINTS
2. REWRITES (not just trims) the language to fit the platform's native rhythm
3. Adjusts the CTA + format to the platform's expected behavior
4. Stays in the brand TONE provided
5. Outputs BOTH Vietnamese AND Malaysian Malay

═══════════════════════════════════════════════════════════════
PLATFORM FORMAT SPECS — follow each one exactly
═══════════════════════════════════════════════════════════════
${COC_FORMAT_OPTIONS.map((f) => `${f.glyph} ${f.label} (id: ${f.id}):\n${f.formatBrief}`).join('\n\n')}

═══════════════════════════════════════════════════════════════
LANGUAGE
═══════════════════════════════════════════════════════════════
Vietnamese:
- Natural VN voice for that platform (FB = informal warm; TikTok = slangy; Threads = opinion-led)
- mình/bạn register
- Vietnamese punctuation (… not ...)

Malaysian Malay:
- Native Malaysian colloquial Bahasa Melayu — NOT formal textbook
- Mix English where natural ("memang struggle", "tau tak")
- Keep product name + ingredient names in English
- Adjust register per platform (FB = warm; TikTok = casual; Threads = hot-take)

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exact markers, nothing else
═══════════════════════════════════════════════════════════════
<<<facebook-feed>>>
<<<VI>>>[Vietnamese FB caption]
<<<MY>>>[Malay FB caption]

<<<instagram>>>
<<<VI>>>[Vietnamese IG caption + hashtags]
<<<MY>>>[Malay IG caption + hashtags]

<<<tiktok>>>
<<<VI>>>[Vietnamese TikTok caption]
<<<MY>>>[Malay TikTok caption]

<<<threads>>>
<<<VI>>>[Vietnamese Threads]
<<<MY>>>[Malay Threads]

<<<zalo-sms>>>
<<<VI>>>[Vietnamese Zalo/SMS]
<<<MY>>>[Malay Zalo/SMS]

<<<email>>>
<<<VI>>>
SUBJECT: [Vietnamese subject]
PREVIEW: [Vietnamese preview]
<<<MY>>>
SUBJECT: [Malay subject]
PREVIEW: [Malay preview]

<<<instagram-story>>>
<<<VI>>>
FRAME 1: [Vietnamese frame 1]
FRAME 2: [Vietnamese frame 2]
FRAME 3: [Vietnamese frame 3]
<<<MY>>>
FRAME 1: [Malay frame 1]
FRAME 2: [Malay frame 2]
FRAME 3: [Malay frame 3]`

// ─────────────────────────────────────────────────────────────────────────

function getGeminiKey(): string {
  const s = useSettingsStore.getState()
  if (!s.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return s.getGeminiApiKey()
}

function buildUserPrompt(brief: LabBriefResult, pillarText: string): string {
  const product = useBankStore.getState().getProductById(brief.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm trong bank')

  const tone = getToneById(brief.toneId)

  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PILLAR CONTENT (the source — multiply this into 7 platform variants)')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(pillarText.trim())

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT CONTEXT (for grounding — never invent fields)')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (product.productName)        lines.push(`Name: ${product.productName}`)
  if (product.productDescription) lines.push(`Description: ${product.productDescription}`)
  if (product.targetMarket)       lines.push(`Target market: ${product.targetMarket}`)
  if (product.usps)               lines.push(`USPs: ${product.usps}`)
  if (product.benefits)           lines.push(`Benefits: ${product.benefits}`)
  if (product.ingredients)        lines.push(`★ Ingredients & mechanism: ${product.ingredients}`)
  if (product.usageGuide)         lines.push(`How to use: ${product.usageGuide}`)
  if (product.offer)              lines.push(`Offer: ${product.offer}`)

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

  // Pricing layer — medium emphasis: pricing can appear in micros where natural
  // (especially Zalo/SMS + Email which are direct-response), softer in Threads.
  const pricingBlock = buildPricingPromptBlock(brief.pricing, 'medium')
  if (pricingBlock) {
    lines.push('')
    lines.push(pricingBlock)
  }

  lines.push('')
  lines.push('Generate the full 7 platform-native micro-content variants using EXACT marker format. Each platform follows its own format spec — DO NOT copy-paste the same content across platforms.')

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────
// Marker extraction
// ─────────────────────────────────────────────────────────────────────────

function extractMarkerBlock(text: string, marker: string, nextMarkers: string[]): string {
  // Escape regex special chars in the marker (e.g. dashes)
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

const FORMAT_IDS: CocFormatId[] = COC_FORMAT_OPTIONS.map((f) => f.id)

function parseMicros(raw: string): CocMicroContent[] {
  const out: CocMicroContent[] = []

  for (const formatId of FORMAT_IDS) {
    // Section markers are the other format IDs (used to bound the slice)
    const otherFormats = FORMAT_IDS.filter((f) => f !== formatId)
    const block = extractMarkerBlock(raw, formatId, otherFormats)
    if (!block) continue

    const vi = extractMarkerBlock(block, 'VI', ['MY'])
    const my = extractMarkerBlock(block, 'MY', ['VI'])

    if (vi && my) {
      out.push({
        id: crypto.randomUUID(),
        format: formatId,
        vietnamese: vi,
        malay: my,
      })
    }
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────
// Main export.
// ─────────────────────────────────────────────────────────────────────────

export async function generateCoc(brief: LabBriefResult, pillarText: string): Promise<CocOutput> {
  const apiKey = getGeminiKey()
  const trimmedPillar = pillarText.trim()
  if (!trimmedPillar) throw new Error('Pillar content trống — paste hoặc dán nội dung trước')

  const userPrompt = buildUserPrompt(brief, trimmedPillar)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    // 7 formats × ~120 words × 2 languages + markers — generous budget.
    maxOutputTokens: 10240,
  })

  const micros = parseMicros(raw)
  if (micros.length === 0) {
    throw new Error('Gemini không trả về micro-content hợp lệ — thử lại')
  }

  return {
    pillarText: trimmedPillar,
    micros,
    generatedAt: Date.now(),
  }
}
