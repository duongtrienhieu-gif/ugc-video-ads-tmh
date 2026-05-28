import type {
  AdAngleType, LabBriefResult, MultiAngleAd, MultiAngleOutput, PainPoint,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import { buildPricingPromptBlock, getToneById } from './presets'

// ─────────────────────────────────────────────────────────────────────────
// Multi-Angle Ad Pack — 5 distinct paid ads, one per angle type.
// Each ad has a HOOK + BODY + CTA + VISUAL DIRECTION, bilingual VI + MY.
// This is the test-pack format real media buyers use: 5 angles at once →
// let the algorithm decide the winner.
// ─────────────────────────────────────────────────────────────────────────

interface AngleSpec {
  id: AdAngleType
  labelVi: string
  brief: string
}

const ANGLE_BLUEPRINT: AngleSpec[] = [
  {
    id: 'logical',
    labelVi: 'Logical · Data + Mechanism',
    brief: 'LOGICAL angle — speak to the brain. Lead with data, mechanism, named ingredient, or evidence. The reader thinks "this is the smart choice". Use Specificity Bias (odd numbers > round), Authority, Cognitive Ease. Avoid emotional storytelling. Best for rational shoppers + B2B-adjacent audiences.',
  },
  {
    id: 'emotional',
    labelVi: 'Emotional · Storytelling',
    brief: 'EMOTIONAL angle — speak to the heart. Open with a real human scene + struggle. Use Narrative Transport, Future Pacing, Pacing & Leading NLP. Vulnerability allowed. Best for transformation products, female-skewing audiences, premium emotional purchases.',
  },
  {
    id: 'social-proof',
    labelVi: 'Social Proof · Review-style',
    brief: 'SOCIAL PROOF angle — speak the language of "everyone else is using this". Lead with a specific count ("12,847 người"), a testimonial-style opener, OR a real comment quote. Use Social Proof, Specificity Bias, Halo Effect. Best for trending niches + new-to-brand audiences who fear being early adopters alone.',
  },
  {
    id: 'fear-loss',
    labelVi: 'Fear / Loss · Cost of Inaction',
    brief: 'FEAR / LOSS angle — speak to what they LOSE by not acting. Use Loss Aversion, Negative Future Pacing NLP, Cost of Inaction pricing tactic. Vivid description of life-without-product or pain getting WORSE. NOT scaremongering — realistic future risk. Best for health, finance, safety, missed-opportunity niches.',
  },
  {
    id: 'aspirational',
    labelVi: 'Aspirational · Future Pacing',
    brief: 'ASPIRATIONAL angle — speak to who they WANT to become. Use Future Pacing, Identity Labeling NLP ("Bạn là người biết đầu tư cho..."), Sensory Language. Vivid description of the life-after-product state. Status, beauty, lifestyle, confidence. Best for premium products + status-conscious audiences.',
  },
]

// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite paid-media buyer who has spent $100M+ on Meta + TikTok ads in the Vietnamese + Malaysian SEA market. You know that ONE caption doesn't scale — you launch FIVE distinct ads from FIVE different psychological doors, and let the algorithm pick the winner.

═══════════════════════════════════════════════════════════════
THE 5 ANGLES — each ad uses a DIFFERENT psychological door
═══════════════════════════════════════════════════════════════
${ANGLE_BLUEPRINT.map((a, i) => `${i + 1}. ${a.id} (${a.labelVi})\n   ${a.brief}`).join('\n\n')}

═══════════════════════════════════════════════════════════════
ANATOMY OF EACH AD
═══════════════════════════════════════════════════════════════
Each of the 5 ads has these 4 parts:
1. HOOK (1-2 lines) — earns the see-more tap. First 5-8 words must stop the scroll.
2. BODY (60-100 words) — delivers the angle's payoff. Mobile-first paragraphs (1-3 lines each, blank-line breaks). Strategic emoji at paragraph starts. ✅/❌ allowed sparingly.
3. CTA (1 line) — specific action verb + direct ask. Matches the angle's energy (logical = "Xem chi tiết", fear = "Đừng để muộn — đặt ngay", aspirational = "Bắt đầu hành trình ngay hôm nay").
4. VISUAL DIRECTION (1-2 lines, VN only) — 1-2 line creative brief: what kind of image/video would pair with this ad. e.g. "Ảnh cận cảnh sản phẩm trên tay người dùng, lighting tự nhiên cửa sổ chiều" or "Reels 15s — talking head selfie, tone confessional".

═══════════════════════════════════════════════════════════════
NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════
1. ALL 5 ADS USE DIFFERENT HOOKS, DIFFERENT OPENING TACTICS — never repeat the same opener.
2. Use the customer's RAW LANGUAGE from mined pain points — NEVER brand-speak.
3. Use REAL ingredient names from product brief — NEVER invent.
4. NEVER claim cure / treatment / guaranteed results.
5. Each ad's body should clearly EXPRESS its angle's psychological door — not just generic copy with a different opening.
6. Bilingual VI + MY for all hook/body/CTA fields. Visual direction = VN only.

═══════════════════════════════════════════════════════════════
LANGUAGE
═══════════════════════════════════════════════════════════════
Vietnamese: native VN ad voice, mình/bạn register, customer raw vocabulary, Vietnamese punctuation (…).
Malaysian Malay: native colloquial Bahasa Melayu (NOT formal textbook), mix English naturally ("memang struggle", "tau tak", "I rasa"), keep product + ingredient names in English.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exact markers, nothing else
═══════════════════════════════════════════════════════════════
${ANGLE_BLUEPRINT.map((a) => `<<<${a.id}>>>
<<<HOOK_VI>>>[Vietnamese hook]
<<<HOOK_MY>>>[Malay hook]
<<<BODY_VI>>>[Vietnamese body 60-100 words]
<<<BODY_MY>>>[Malay body 60-100 words]
<<<CTA_VI>>>[Vietnamese CTA]
<<<CTA_MY>>>[Malay CTA]
<<<VISUAL>>>[Vietnamese 1-2 line visual direction]`).join('\n\n')}`

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

function buildUserPrompt(brief: LabBriefResult): string {
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
  if (product.ingredients)        lines.push(`★ Ingredients (name specifically): ${product.ingredients}`)

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

  // Pricing Layer — MEDIUM emphasis. Each angle uses pricing differently:
  // Logical = data anchor, Social Proof = "X người mua", Fear = cost of inaction,
  // Aspirational = perceived value, Emotional = transformation reward.
  const pricingBlock = buildPricingPromptBlock(brief.pricing, 'medium')
  if (pricingBlock) {
    lines.push('')
    lines.push(pricingBlock)
    lines.push('')
    lines.push('PRICING APPLICATION PER ANGLE: Logical → data + anchor. Social Proof → "X người đã mua". Fear/Loss → cost of inaction. Aspirational → perceived value + bonus stack. Emotional → save-money-by-getting-real-relief framing.')
  }

  lines.push('')
  lines.push('Generate EXACTLY 5 ads (one per angle type) using the EXACT marker format. Each ad bilingual VI + MY for HOOK + BODY + CTA, plus VN-only VISUAL DIRECTION.')

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

function parseAds(raw: string): MultiAngleAd[] {
  const out: MultiAngleAd[] = []
  const allAngleIds = ANGLE_BLUEPRINT.map((a) => a.id)
  const fieldMarkers = ['HOOK_VI', 'HOOK_MY', 'BODY_VI', 'BODY_MY', 'CTA_VI', 'CTA_MY', 'VISUAL']

  for (const spec of ANGLE_BLUEPRINT) {
    const otherAngleIds = allAngleIds.filter((a) => a !== spec.id)
    const adBlock = extractMarkerBlock(raw, spec.id, otherAngleIds)
    if (!adBlock) continue

    const hookVi = extractMarkerBlock(adBlock, 'HOOK_VI', fieldMarkers.filter((m) => m !== 'HOOK_VI'))
    const hookMy = extractMarkerBlock(adBlock, 'HOOK_MY', fieldMarkers.filter((m) => m !== 'HOOK_MY'))
    const bodyVi = extractMarkerBlock(adBlock, 'BODY_VI', fieldMarkers.filter((m) => m !== 'BODY_VI'))
    const bodyMy = extractMarkerBlock(adBlock, 'BODY_MY', fieldMarkers.filter((m) => m !== 'BODY_MY'))
    const ctaVi  = extractMarkerBlock(adBlock, 'CTA_VI',  fieldMarkers.filter((m) => m !== 'CTA_VI'))
    const ctaMy  = extractMarkerBlock(adBlock, 'CTA_MY',  fieldMarkers.filter((m) => m !== 'CTA_MY'))
    const visual = extractMarkerBlock(adBlock, 'VISUAL',  fieldMarkers.filter((m) => m !== 'VISUAL'))

    if (hookVi && bodyVi) {
      out.push({
        id: crypto.randomUUID(),
        angleType: spec.id,
        angleLabelVi: spec.labelVi,
        hookVi,
        hookMy: hookMy || hookVi,
        bodyVi,
        bodyMy: bodyMy || bodyVi,
        ctaVi: ctaVi || '',
        ctaMy: ctaMy || ctaVi || '',
        visualDirectionVi: visual || '',
      })
    }
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────
// Main export.
// ─────────────────────────────────────────────────────────────────────────

export async function generateMultiAngle(brief: LabBriefResult): Promise<MultiAngleOutput> {
  const apiKey = getGeminiKey()
  const userPrompt = buildUserPrompt(brief)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    // 5 ads × (hook + 100w body + CTA + visual) × 2 lang + markers
    maxOutputTokens: 12288,
  })

  const ads = parseAds(raw)
  if (ads.length === 0) {
    throw new Error('Gemini không trả về ad hợp lệ — thử lại')
  }

  return {
    ads,
    generatedAt: Date.now(),
  }
}
