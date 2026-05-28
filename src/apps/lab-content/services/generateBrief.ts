import type {
  ContentAngle, HookCandidate, LabBriefParams, LabBriefResult, PainPoint, PainType,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import { getGoalById, getToneById } from './presets'

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — briefed as an elite content strategist who internalised
// the 14 copywriting formulas + 18 cognitive biases + 10 NLP techniques
// of the Vietnamese UGC ads playbook.
//
// Output is a STRATEGIC BRIEF — not finished copy. Two languages (VI / MY)
// for every text field so the downstream tools can use either.
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior content strategist who has briefed over $50M in winning UGC ads for the Vietnamese + Malaysian SEA market. You have INTERNALISED these frameworks:

═══════════════════════════════════════════════════════════════
INPUT LANGUAGE NOTE
═══════════════════════════════════════════════════════════════
The product info you receive (productName, productDescription, painPoints, usps, benefits, offer, ingredients) may be written in VIETNAMESE — this is the operator's working language so they can review product data easily. Read and understand it semantically as native VN text, then write your OUTPUT strictly in the language(s) specified by the rest of this prompt (VI/MY structured brief). Keep brand names, currencies (RM, ₫, $, ฿), and international scientific ingredient names as-is.


═══════════════════════════════════════════════════════════════
14 COPYWRITING FORMULAS — pick the right one per angle
═══════════════════════════════════════════════════════════════
AIDA (Attention-Interest-Desire-Action) — long-form sales
PAS (Problem-Agitate-Solution) — retargeting, pain-led
4Cs (Clear-Concise-Compelling-Credible) — rational shoppers
FAB (Features-Advantages-Benefits) — product comparison
ACC (Agreement-Credibility-CTA) — brand building, trust
SLAP (Stop-Look-Act-Purchase) — short shock ads
BAB (Before-After-Bridge) — transformation, retargeting
5W1H — comprehensive product description
Storytelling — emotional connection, brand
SSS (Short-Simple-Shareable) — Reels, Stories, viral
Hook-Value-CTA — short TikTok/IG captions
PPPP (Problem-Promise-Proof-Proposal) — rational persuasion
Funnel (TOFU/MOFU/BOFU) — multi-stage campaign
COC (Pillar→Micro-Content) — series, omnichannel

═══════════════════════════════════════════════════════════════
18 COGNITIVE BIASES — pick 2-3 that hit hardest for the angle
═══════════════════════════════════════════════════════════════
Loss Aversion, Scarcity, Social Proof, Authority, Anchoring, Reciprocity,
Curiosity Gap, FOMO, Future Pacing, Contrast Principle, Commitment & Consistency,
Cognitive Ease, Risk Reversal, Narrative Transport, Pattern Interrupt,
Decoy Effect, Halo Effect, Specificity Bias

═══════════════════════════════════════════════════════════════
10 NLP COPYWRITING TECHNIQUES — pick 1-2 per angle
═══════════════════════════════════════════════════════════════
Presupposition, Embedded Command, Open Loop, Pacing & Leading, Sensory Language,
Double Bind, Power Words, Identity Labeling, Negative Future Pacing, Social Currency

═══════════════════════════════════════════════════════════════
YOUR JOB
═══════════════════════════════════════════════════════════════
For the given PRODUCT + GOAL + TONE, produce a STRATEGIC BRIEF (NOT finished ads). The brief is the upstream thinking step — it will be handed to a copywriter to write the actual caption/script later.

The brief contains:
1. FIVE pain points the target customer feels — ranked by intensity (5 = deepest pain). Each pain MUST have a type tag from: money | time | health | relationship | status. Write each pain in customer's own raw language — NOT brand language. Use SPECIFIC details (named situations, named feelings), never generic ("đau lưng" not "có vấn đề về xương").
2. EXACTLY THREE content angles attacking different psychological doors:
   • ANGLE 1 — PAIN angle (what the customer is afraid of losing / suffering from)
   • ANGLE 2 — ASPIRATION angle (what the customer secretly wants to become / achieve)
   • ANGLE 3 — COUNTER-INTUITIVE angle (a surprising truth that breaks a wrong belief — this is usually the VIRAL angle)
   For each: pick ONE formula from the 14, 2-3 biases, 1-2 NLP techniques. The choices must MATCH the angle's emotional door — don't pick generic combos.
3. SEVEN hook candidates (1-2 line opening sentences) — distribute across the 3 angles (suggested: 2 hooks from angle 1, 2 from angle 2, 3 from angle 3 since counter-intuitive is highest leverage). Each hook is a STANDALONE first line that earns the "see more" tap. NO label like "Hook:".
4. A 2-3 sentence STRATEGY SUMMARY tying the angles together — what story arc you would run if doing a multi-post campaign.
5. A 1-2 sentence TONE RATIONALE — why the chosen tone fits this product+goal+audience.

═══════════════════════════════════════════════════════════════
LANGUAGE RULES — every text field outputs BOTH versions
═══════════════════════════════════════════════════════════════
Vietnamese (VI):
- Natural Vietnamese ad-strategist voice
- Informal mình/bạn register
- Customer's raw vocabulary, not corporate
- Vietnamese punctuation properly (… not ...)

Malaysian Malay (MY):
- Native Malaysian colloquial Bahasa Melayu — NOT formal textbook
- Mix English where natural ("memang struggle", "tau tak", "I tak sangka")
- Keep product NAME + INGREDIENT NAMES in English
- Sounds like a real Malaysian strategist, not Google Translate

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exact markers, nothing else
═══════════════════════════════════════════════════════════════
<<<PAIN_POINTS>>>
<<<PAIN 1>>>
<<<INTENSITY>>>5
<<<TYPE>>>money
<<<VI>>>[Vietnamese pain — customer's raw words]
<<<MY>>>[Malaysian version — customer's raw words]
<<<PAIN 2>>>
<<<INTENSITY>>>4
<<<TYPE>>>health
<<<VI>>>...
<<<MY>>>...
<<<PAIN 3>>>
...
<<<PAIN 4>>>
...
<<<PAIN 5>>>
...

<<<ANGLES>>>
<<<ANGLE 1>>>
<<<TYPE>>>pain
<<<TITLE_VI>>>[short Vietnamese title for this angle]
<<<TITLE_MY>>>[Malay title]
<<<DESC_VI>>>[2-3 sentence Vietnamese explanation of what this angle attacks]
<<<DESC_MY>>>[Malay version]
<<<FORMULA>>>PAS
<<<PSYCH>>>Loss Aversion, Future Pacing
<<<NLP>>>Negative Future Pacing, Power Words
<<<ANGLE 2>>>
<<<TYPE>>>aspiration
<<<TITLE_VI>>>...
<<<TITLE_MY>>>...
<<<DESC_VI>>>...
<<<DESC_MY>>>...
<<<FORMULA>>>AIDA
<<<PSYCH>>>Future Pacing, Identity Labeling
<<<NLP>>>Sensory Language, Presupposition
<<<ANGLE 3>>>
<<<TYPE>>>counter-intuitive
<<<TITLE_VI>>>...
<<<TITLE_MY>>>...
<<<DESC_VI>>>...
<<<DESC_MY>>>...
<<<FORMULA>>>SLAP
<<<PSYCH>>>Pattern Interrupt, Curiosity Gap
<<<NLP>>>Open Loop, Embedded Command

<<<HOOKS>>>
<<<HOOK 1>>>
<<<ANGLE_REF>>>1
<<<FORMULA>>>PAS
<<<VI>>>[Vietnamese hook — 1-2 lines, no quotation marks]
<<<MY>>>[Malay hook]
<<<HOOK 2>>>
<<<ANGLE_REF>>>1
<<<FORMULA>>>PAS
<<<VI>>>...
<<<MY>>>...
<<<HOOK 3>>>
<<<ANGLE_REF>>>2
<<<FORMULA>>>AIDA
<<<VI>>>...
<<<MY>>>...
<<<HOOK 4>>>
<<<ANGLE_REF>>>2
<<<FORMULA>>>Storytelling
<<<VI>>>...
<<<MY>>>...
<<<HOOK 5>>>
<<<ANGLE_REF>>>3
<<<FORMULA>>>SLAP
<<<VI>>>...
<<<MY>>>...
<<<HOOK 6>>>
<<<ANGLE_REF>>>3
<<<FORMULA>>>Hook-Value-CTA
<<<VI>>>...
<<<MY>>>...
<<<HOOK 7>>>
<<<ANGLE_REF>>>3
<<<FORMULA>>>SSS
<<<VI>>>...
<<<MY>>>...

<<<STRATEGY_VI>>>
[2-3 sentence Vietnamese strategy summary — how the 3 angles fit together as a campaign]
<<<STRATEGY_MY>>>
[Malay version]

<<<TONE_RATIONALE_VI>>>
[1-2 sentence Vietnamese — why this tone fits the product+goal+audience]`

// ─────────────────────────────────────────────────────────────────────────

function getGeminiKey(): string {
  const s = useSettingsStore.getState()
  if (!s.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return s.getGeminiApiKey()
}

// ─────────────────────────────────────────────────────────────────────────
// Build the user-message portion of the prompt — product + goal + tone.
// ─────────────────────────────────────────────────────────────────────────

function buildUserPrompt(params: LabBriefParams): string {
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm trong bank')

  const goal = getGoalById(params.goal)
  if (!goal) throw new Error(`Goal không tồn tại: ${params.goal}`)

  const tone = getToneById(params.toneId)
  if (!tone) throw new Error(`Tone không tồn tại: ${params.toneId}`)

  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT (use real fields, never invent)')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (product.productName)        lines.push(`Name: ${product.productName}`)
  if (product.productDescription) lines.push(`Description: ${product.productDescription}`)
  if (product.targetMarket)       lines.push(`Target market: ${product.targetMarket}`)
  if (product.painPoints)         lines.push(`Pain points (raw notes): ${product.painPoints}`)
  if (product.usps)               lines.push(`USPs: ${product.usps}`)
  if (product.benefits)           lines.push(`Benefits: ${product.benefits}`)
  if (product.offer)              lines.push(`Offer: ${product.offer}`)
  if (product.ingredients)        lines.push(`Ingredients (name specifically — never generic): ${product.ingredients}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`CAMPAIGN GOAL — ${goal.label}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(goal.promptHint)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`TONE OF VOICE — ${tone.label}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(tone.promptHint)
  if (params.toneId === 'custom' && params.customToneNote?.trim()) {
    lines.push('')
    lines.push('User-provided custom tone note:')
    lines.push(params.customToneNote.trim())
  }

  lines.push('')
  lines.push('Generate the strategic brief now. Use the EXACT marker format from the system prompt. Do NOT skip any section. Do NOT add headers or extra commentary outside the markers.')

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────
// Marker extraction — same tolerant style as generateAdsContent.ts.
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

function findChunks(raw: string, chunkRe: RegExp): { index: number; label: string }[] {
  const results: { index: number; label: string }[] = []
  let m: RegExpExecArray | null
  chunkRe.lastIndex = 0
  while ((m = chunkRe.exec(raw))) {
    results.push({ index: m.index, label: m[0] })
  }
  return results
}

const VALID_PAIN_TYPES: PainType[] = ['money', 'time', 'health', 'relationship', 'status']
function parsePainType(s: string): PainType {
  const lower = s.trim().toLowerCase()
  const match = VALID_PAIN_TYPES.find((t) => t === lower)
  return match ?? 'health'
}

function parseIntensity(s: string): 1 | 2 | 3 | 4 | 5 {
  const n = parseInt(s.trim(), 10)
  if (!Number.isFinite(n)) return 3
  return Math.min(5, Math.max(1, n)) as 1 | 2 | 3 | 4 | 5
}

function parseAngleType(s: string): ContentAngle['type'] {
  const lower = s.trim().toLowerCase()
  if (lower.includes('pain')) return 'pain'
  if (lower.includes('aspir')) return 'aspiration'
  if (lower.includes('counter')) return 'counter-intuitive'
  return 'pain'
}

function parseAngleRef(s: string): 1 | 2 | 3 {
  const n = parseInt(s.trim(), 10)
  if (n === 1 || n === 2 || n === 3) return n
  return 1
}

function parseCsvList(s: string): string[] {
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

// ─────────────────────────────────────────────────────────────────────────
// Main parser — returns parsed fields ready for LabBriefResult assembly.
// ─────────────────────────────────────────────────────────────────────────

function parsePains(raw: string): PainPoint[] {
  const out: PainPoint[] = []
  const chunks = findChunks(raw, /<<<\s*PAIN\s+(\d+)\s*>>>/gi)
  if (chunks.length === 0) return out

  for (let i = 0; i < chunks.length; i++) {
    const start = chunks[i].index
    const end = i + 1 < chunks.length ? chunks[i + 1].index : raw.length
    const chunk = raw.slice(start, end)

    const intensity = parseIntensity(extractMarkerBlock(chunk, 'INTENSITY', ['TYPE', 'VI', 'MY', 'PAIN']))
    const type      = parsePainType(extractMarkerBlock(chunk, 'TYPE', ['VI', 'MY', 'INTENSITY', 'PAIN']))
    const textVi    = extractMarkerBlock(chunk, 'VI', ['MY', 'INTENSITY', 'TYPE', 'PAIN'])
    const textMy    = extractMarkerBlock(chunk, 'MY', ['VI', 'INTENSITY', 'TYPE', 'PAIN'])

    if (textVi && textMy) {
      out.push({
        id: crypto.randomUUID(),
        textVi,
        textMy,
        intensity,
        type,
      })
    }
  }

  // Sort by intensity descending so the worst pain leads the list
  out.sort((a, b) => b.intensity - a.intensity)
  return out
}

function parseAngles(raw: string): ContentAngle[] {
  const out: ContentAngle[] = []
  const chunks = findChunks(raw, /<<<\s*ANGLE\s+(\d+)\s*>>>/gi)
  if (chunks.length === 0) return out

  for (let i = 0; i < chunks.length; i++) {
    const start = chunks[i].index
    const end = i + 1 < chunks.length ? chunks[i + 1].index : raw.length
    const chunk = raw.slice(start, end)

    const nextMarkers = ['TYPE', 'TITLE_VI', 'TITLE_MY', 'DESC_VI', 'DESC_MY', 'FORMULA', 'PSYCH', 'NLP', 'ANGLE', 'HOOKS', 'STRATEGY_VI', 'TONE_RATIONALE_VI']
    const type      = parseAngleType(extractMarkerBlock(chunk, 'TYPE', nextMarkers))
    const titleVi   = extractMarkerBlock(chunk, 'TITLE_VI', nextMarkers)
    const titleMy   = extractMarkerBlock(chunk, 'TITLE_MY', nextMarkers)
    const descVi    = extractMarkerBlock(chunk, 'DESC_VI', nextMarkers)
    const descMy    = extractMarkerBlock(chunk, 'DESC_MY', nextMarkers)
    const formula   = extractMarkerBlock(chunk, 'FORMULA', nextMarkers)
    const psych     = parseCsvList(extractMarkerBlock(chunk, 'PSYCH', nextMarkers))
    const nlp       = parseCsvList(extractMarkerBlock(chunk, 'NLP', nextMarkers))

    if (titleVi && descVi) {
      out.push({
        id: crypto.randomUUID(),
        type,
        titleVi,
        titleMy: titleMy || titleVi,
        descriptionVi: descVi,
        descriptionMy: descMy || descVi,
        recommendedFormula: formula || 'PAS',
        psychology: psych,
        nlpTechniques: nlp,
      })
    }
  }

  return out
}

function parseHooks(raw: string): HookCandidate[] {
  const out: HookCandidate[] = []
  const chunks = findChunks(raw, /<<<\s*HOOK\s+(\d+)\s*>>>/gi)
  if (chunks.length === 0) return out

  for (let i = 0; i < chunks.length; i++) {
    const start = chunks[i].index
    const end = i + 1 < chunks.length ? chunks[i + 1].index : raw.length
    const chunk = raw.slice(start, end)

    const nextMarkers = ['ANGLE_REF', 'FORMULA', 'VI', 'MY', 'HOOK', 'STRATEGY_VI', 'TONE_RATIONALE_VI']
    const angleIndex = parseAngleRef(extractMarkerBlock(chunk, 'ANGLE_REF', nextMarkers))
    const formula    = extractMarkerBlock(chunk, 'FORMULA', nextMarkers)
    const textVi     = extractMarkerBlock(chunk, 'VI', nextMarkers)
    const textMy     = extractMarkerBlock(chunk, 'MY', nextMarkers)

    if (textVi && textMy) {
      out.push({
        id: crypto.randomUUID(),
        angleIndex,
        formulaTag: formula || 'PAS',
        textVi,
        textMy,
      })
    }
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────
// Main export.
// ─────────────────────────────────────────────────────────────────────────

export async function generateBrief(params: LabBriefParams): Promise<LabBriefResult> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ Project')

  const userPrompt = buildUserPrompt(params)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    maxOutputTokens: 8192,
  })

  // Slice out the major sections so each parser only sees its own block.
  const painsBlock    = extractMarkerBlock(raw, 'PAIN_POINTS', ['ANGLES', 'HOOKS', 'STRATEGY_VI', 'TONE_RATIONALE_VI'])
  const anglesBlock   = extractMarkerBlock(raw, 'ANGLES',      ['HOOKS', 'STRATEGY_VI', 'TONE_RATIONALE_VI'])
  const hooksBlock    = extractMarkerBlock(raw, 'HOOKS',       ['STRATEGY_VI', 'STRATEGY_MY', 'TONE_RATIONALE_VI'])
  const strategyVi    = extractMarkerBlock(raw, 'STRATEGY_VI', ['STRATEGY_MY', 'TONE_RATIONALE_VI', 'TONE_RATIONALE_MY'])
  const strategyMy    = extractMarkerBlock(raw, 'STRATEGY_MY', ['TONE_RATIONALE_VI', 'TONE_RATIONALE_MY'])
  const toneRationale = extractMarkerBlock(raw, 'TONE_RATIONALE_VI', ['TONE_RATIONALE_MY'])

  const painPoints = parsePains(painsBlock)
  const angles     = parseAngles(anglesBlock)
  const hooks      = parseHooks(hooksBlock)

  if (painPoints.length === 0 || angles.length === 0 || hooks.length === 0) {
    throw new Error('Gemini không trả về brief hợp lệ — thử lại')
  }

  return {
    productId: params.productId,
    productName: product.productName,
    goal: params.goal,
    toneId: params.toneId,
    customToneNote: params.customToneNote,
    pricing: params.pricing,
    painPoints,
    angles,
    hooks,
    strategySummaryVi: strategyVi || '',
    strategySummaryMy: strategyMy || strategyVi || '',
    toneRationaleVi: toneRationale || '',
    angleOutputs: {},
    generatedAt: Date.now(),
  }
}
