import type {
  ContentAngle, HookLabOutput, LabBriefResult, LabHook, PainPoint,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import { buildPricingPromptBlock, getGoalById, getToneById } from './presets'

// ─────────────────────────────────────────────────────────────────────────
// Hook Lab — generate 30 hook candidates distributed across 8-14 copywriting
// formulas, bilingual VI+MY, each tagged with formula + angle + psychology
// + 1 NLP technique. Inputs: full strategic brief (so hooks honor the angle
// + tone + product context).
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite hook engineer who has written over $30M in scroll-stopping opening lines for UGC ads in the Vietnamese + Malaysian SEA market. You have INTERNALISED the 14 copywriting formulas and know which one produces which kind of scroll-stop.

═══════════════════════════════════════════════════════════════
14 FORMULAS — use ALL OR MOST of these
═══════════════════════════════════════════════════════════════
PAS, AIDA, BAB, Storytelling, Hook-Value-CTA, SLAP, 4Cs, FAB, ACC, 5W1H, SSS, PPPP, Funnel, COC

═══════════════════════════════════════════════════════════════
YOUR JOB
═══════════════════════════════════════════════════════════════
Given a strategic brief (5 pain points + 3 angles + tone + product), generate EXACTLY 30 hook candidates (1-2 line opening sentences each — the very first line of an ad).

Distribution rules:
- Use AT LEAST 8 different formulas across the 30 hooks (heavy formulas can have 3-4 hooks, niche formulas 1-2)
- Distribute hooks across the 3 ANGLES from the brief (roughly 10 per angle, but allow flex — counter-intuitive angle can have more if it shines)
- Each hook must be DIFFERENT from the others — different opening word, different rhythm, different psychological door

Hook quality bar:
- The hook is the FIRST line of an ad — earns the "see more" tap or the 2nd-second of attention
- Use the customer's RAW LANGUAGE from the mined pain points — NOT brand language
- Use the product's REAL ingredient names where relevant — never invent
- No quotation marks around the hook
- No labels like "Hook:" in the text
- NEVER claim cure / guaranteed results

═══════════════════════════════════════════════════════════════
PSYCHOLOGY + NLP toolkit (pick 1-2 biases + optionally 1 NLP per hook)
═══════════════════════════════════════════════════════════════
Biases: Loss Aversion, Scarcity, Social Proof, Authority, Anchoring, Reciprocity, Curiosity Gap, FOMO, Future Pacing, Contrast, Commitment, Cognitive Ease, Risk Reversal, Narrative Transport, Pattern Interrupt, Decoy, Halo, Specificity Bias
NLP: Presupposition, Embedded Command, Open Loop, Pacing & Leading, Sensory Language, Double Bind, Power Words, Identity Labeling, Negative Future Pacing, Social Currency

═══════════════════════════════════════════════════════════════
LANGUAGE — every hook outputs BOTH versions
═══════════════════════════════════════════════════════════════
Vietnamese:
- Native VN ad voice, mình/bạn register
- Customer's raw vocabulary — not corporate
- Vietnamese punctuation (… not ...)

Malaysian Malay:
- Native Malaysian colloquial Bahasa Melayu — NOT formal textbook
- Mix English where natural ("memang struggle", "tau tak", "I rasa")
- Keep product name + ingredient names in English

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exact markers, nothing else
═══════════════════════════════════════════════════════════════
<<<HOOK 1>>>
<<<FORMULA>>>PAS
<<<ANGLE_REF>>>1
<<<PSYCH>>>Loss Aversion, Future Pacing
<<<NLP>>>Negative Future Pacing
<<<VI>>>[Vietnamese hook — 1-2 lines]
<<<MY>>>[Malaysian Malay hook]

<<<HOOK 2>>>
<<<FORMULA>>>AIDA
<<<ANGLE_REF>>>2
<<<PSYCH>>>Curiosity Gap
<<<NLP>>>Open Loop
<<<VI>>>...
<<<MY>>>...

[... continue through HOOK 30 ...]`

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
    `  Formula recommended: ${angle.recommendedFormula}`,
    angle.psychology.length > 0 ? `  Psych: ${angle.psychology.join(', ')}` : '',
    angle.nlpTechniques.length > 0 ? `  NLP: ${angle.nlpTechniques.join(', ')}` : '',
  ].filter(Boolean).join('\n')
}

function buildUserPrompt(brief: LabBriefResult): string {
  const product = useBankStore.getState().getProductById(brief.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm trong bank')

  const goal = getGoalById(brief.goal)
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
  if (product.ingredients)        lines.push(`★ Ingredients: ${product.ingredients}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('MINED PAIN POINTS (use customer language directly)')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(formatPains(brief.painPoints))

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('THE 3 ANGLES — distribute 30 hooks roughly across all 3')
  lines.push('═══════════════════════════════════════════════════════════════')
  brief.angles.forEach((a, i) => {
    lines.push(formatAngle(a, i + 1))
    lines.push('')
  })

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

  // Pricing layer — hooks are short, use MEDIUM emphasis so some hooks
  // (especially counter-intuitive + BOFU-leaning ones) can lead with price
  // anchoring or daily-cost reframing, while most stay strategy-led.
  const pricingBlock = buildPricingPromptBlock(brief.pricing, 'medium')
  if (pricingBlock) {
    lines.push('')
    lines.push(pricingBlock)
    lines.push('')
    lines.push('Pricing-specific note: only 4-6 of the 30 hooks should explicitly use price/offer/discount language — the rest stay strategy-led. The price-led hooks should lead with anchor savings or daily-cost reframing.')
  }

  lines.push('')
  lines.push('Generate EXACTLY 30 hooks following the marker format. Use AT LEAST 8 different formulas. Distribute roughly across all 3 angles.')

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

function parseCsvList(s: string): string[] {
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function parseAngleRef(s: string): 1 | 2 | 3 {
  const n = parseInt(s.trim(), 10)
  if (n === 1 || n === 2 || n === 3) return n
  return 1
}

function parseHooks(raw: string): LabHook[] {
  const out: LabHook[] = []
  const chunkRe = /<<<\s*HOOK\s+(\d+)\s*>>>/gi
  const indices: number[] = []
  let m: RegExpExecArray | null
  while ((m = chunkRe.exec(raw))) indices.push(m.index)

  if (indices.length === 0) return out

  const nextMarkers = ['FORMULA', 'ANGLE_REF', 'PSYCH', 'NLP', 'VI', 'MY', 'HOOK']

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]
    const end = i + 1 < indices.length ? indices[i + 1] : raw.length
    const chunk = raw.slice(start, end)

    const formula    = extractMarkerBlock(chunk, 'FORMULA',   nextMarkers)
    const angleRef   = parseAngleRef(extractMarkerBlock(chunk, 'ANGLE_REF', nextMarkers))
    const psych      = parseCsvList(extractMarkerBlock(chunk, 'PSYCH', nextMarkers))
    const nlp        = extractMarkerBlock(chunk, 'NLP', nextMarkers)
    const vi         = extractMarkerBlock(chunk, 'VI',  nextMarkers)
    const my         = extractMarkerBlock(chunk, 'MY',  nextMarkers)

    if (vi && my) {
      out.push({
        id: crypto.randomUUID(),
        formula: formula || 'PAS',
        angleIndex: angleRef,
        psychology: psych,
        nlpTechnique: nlp || undefined,
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

export async function generateHookLab(brief: LabBriefResult): Promise<HookLabOutput> {
  const apiKey = getGeminiKey()
  const userPrompt = buildUserPrompt(brief)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    // 30 hooks × ~50 words × 2 languages + markers — generous budget.
    maxOutputTokens: 12288,
  })

  const hooks = parseHooks(raw)
  if (hooks.length === 0) {
    throw new Error('Gemini không trả về hook hợp lệ — thử lại')
  }

  return {
    hooks,
    generatedAt: Date.now(),
  }
}
