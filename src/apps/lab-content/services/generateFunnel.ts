import type {
  ContentAngle, FunnelOutput, FunnelPiece, FunnelTier, LabBriefResult, PainPoint,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import { buildPricingPromptBlock, getToneById } from './presets'

// ─────────────────────────────────────────────────────────────────────────
// Funnel Content — produces 9 ready-to-post captions across 3 funnel
// tiers: TOFU (awareness), MOFU (consideration), BOFU (conversion).
// Each piece is 100-150 words per language version, bilingual VI+MY,
// tagged with the formula used and CTA strength.
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite content strategist + copywriter who has built over $30M in winning multi-stage funnel campaigns for the Vietnamese + Malaysian SEA market. You think in CUSTOMER JOURNEYS — strangers → warm leads → buyers — and write the exact captions each stage needs.

═══════════════════════════════════════════════════════════════
THE 3 FUNNEL TIERS — strict tier purpose
═══════════════════════════════════════════════════════════════

🟢 TOFU = AWARENESS
- Audience: cold strangers who don't know the brand yet
- Job: stop the scroll, build emotional resonance, plant a seed
- Best formulas: Storytelling, ACC (Agreement-Credibility-CTA), AIDA, Hook-Value-CTA
- CTA: SOFT — invite engagement (save, follow, share, comment) NOT direct sale
- DO NOT push offer / urgency / scarcity at this tier — kills cold trust
- Allowed energy: human story, emotional truth, relatable scene, surprising fact

🔵 MOFU = CONSIDERATION
- Audience: warm leads who know the brand + problem, evaluating fit
- Job: build belief through education + comparison + mechanism
- Best formulas: FAB (Features-Advantages-Benefits), 4Cs (Clear-Concise-Compelling-Credible), PPPP (Problem-Promise-Proof-Proposal), 5W1H
- CTA: BALANCED — "learn more", "see comparison", "save for later", or low-friction conversion ("try sample")
- Emphasis: WHY this product works (mechanism, ingredient, evidence) + WHY it beats alternatives
- Tone: confident but not aggressive

🔴 BOFU = CONVERSION
- Audience: hot leads ready to decide — they need the final push
- Job: close the sale with urgency + reassurance
- Best formulas: PAS (Problem-Agitate-Solution), SLAP (Stop-Look-Act-Purchase), Hook-Value-CTA, AIDA
- CTA: HARD — specific action verb, urgency framing, scarcity (if real), risk reversal
- Push: offer + scarcity + social proof + risk-reversal
- Acceptable to repeat CTA 2-3 times within the caption

═══════════════════════════════════════════════════════════════
YOUR JOB
═══════════════════════════════════════════════════════════════
Given a strategic brief (5 pain points + 3 angles + tone + product), produce EXACTLY 9 captions — 3 per tier (TOFU / MOFU / BOFU). Each caption is 100-150 words per language version, ready to paste into Facebook / TikTok / Instagram.

Distribution rules:
- 3 pieces per tier, EACH piece uses a DIFFERENT formula from the tier's allowed list
- The 3 pieces within a tier MUST feel different — different opening tactics, different emotional flavors, different pacing
- All pieces honor the brand TONE provided
- All pieces use REAL ingredient + USP info from the product brief — never invent

Format rules per caption:
- Mobile-first: short paragraphs (1-3 lines) separated by BLANK LINES
- Strategic emoji at paragraph starts for visual rhythm
- ✅ for benefits, ❌ for failed alternatives (use sparingly)
- 👉 / 👇 to point at CTAs
- NO markdown headers, NO labels like "Hook:" / "CTA:"
- NEVER claim cure / treatment / guaranteed results

═══════════════════════════════════════════════════════════════
LANGUAGE — every caption outputs BOTH versions
═══════════════════════════════════════════════════════════════
Vietnamese:
- Natural Vietnamese ad voice, mình/bạn register
- Customer's raw vocabulary — not corporate
- Vietnamese punctuation (… not ...)

Malaysian Malay:
- Native Malaysian colloquial Bahasa Melayu — NOT formal textbook
- Mix English where natural ("memang struggle", "tau tak", "I rasa")
- Keep product name + ingredient names in English
- Sound like a real Malaysian creator

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exact markers, nothing else
═══════════════════════════════════════════════════════════════
<<<TOFU>>>
<<<PIECE 1>>>
<<<FORMULA>>>Storytelling
<<<CTA_STRENGTH>>>soft
<<<VI>>>[Vietnamese caption — 100-150 words, mobile-first formatting]
<<<MY>>>[Malaysian Malay caption — same standard]

<<<PIECE 2>>>
<<<FORMULA>>>ACC
<<<CTA_STRENGTH>>>soft
<<<VI>>>...
<<<MY>>>...

<<<PIECE 3>>>
<<<FORMULA>>>AIDA
<<<CTA_STRENGTH>>>soft
<<<VI>>>...
<<<MY>>>...

<<<MOFU>>>
<<<PIECE 1>>>
<<<FORMULA>>>FAB
<<<CTA_STRENGTH>>>balanced
<<<VI>>>...
<<<MY>>>...

<<<PIECE 2>>>
<<<FORMULA>>>PPPP
<<<CTA_STRENGTH>>>balanced
<<<VI>>>...
<<<MY>>>...

<<<PIECE 3>>>
<<<FORMULA>>>4Cs
<<<CTA_STRENGTH>>>balanced
<<<VI>>>...
<<<MY>>>...

<<<BOFU>>>
<<<PIECE 1>>>
<<<FORMULA>>>PAS
<<<CTA_STRENGTH>>>hard
<<<VI>>>...
<<<MY>>>...

<<<PIECE 2>>>
<<<FORMULA>>>SLAP
<<<CTA_STRENGTH>>>hard
<<<VI>>>...
<<<MY>>>...

<<<PIECE 3>>>
<<<FORMULA>>>Hook-Value-CTA
<<<CTA_STRENGTH>>>hard
<<<VI>>>...
<<<MY>>>...`

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
    angle.psychology.length > 0 ? `  Psych: ${angle.psychology.join(', ')}` : '',
  ].filter(Boolean).join('\n')
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
  lines.push('MINED PAIN POINTS')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(formatPains(brief.painPoints))

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('THE 3 ANGLES from the brief — reference for narrative continuity')
  lines.push('═══════════════════════════════════════════════════════════════')
  brief.angles.forEach((a, i) => {
    lines.push(formatAngle(a, i + 1))
    lines.push('')
  })

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`TONE OF VOICE — ${tone?.label ?? brief.toneId}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(tone?.promptHint ?? '')
  if (brief.toneId === 'custom' && brief.customToneNote?.trim()) {
    lines.push('')
    lines.push('Custom tone note from user:')
    lines.push(brief.customToneNote.trim())
  }

  // Pricing layer — funnel has the richest tier-aware emphasis use:
  // - TOFU section uses SOFT (background mention only)
  // - MOFU section uses MEDIUM (value-stacking + anchoring lever)
  // - BOFU section uses HARD (pricing is the hero of the copy)
  // We instruct the model directly because Funnel generates all 3 tiers in one call.
  const pricingBlockHard = buildPricingPromptBlock(brief.pricing, 'hard')
  if (pricingBlockHard) {
    lines.push('')
    lines.push(pricingBlockHard)
    lines.push('')
    lines.push('TIER-SPECIFIC PRICING APPLICATION:')
    lines.push('- TOFU pieces: do NOT lead with price. Mention offer only at the end if it fits naturally (1 of 3 pieces max).')
    lines.push('- MOFU pieces: use Value Stacking + Anchoring to build perceived value. No hard urgency.')
    lines.push('- BOFU pieces: pricing is the HERO. Use Anchoring + Daily-Cost + Risk-Reversal + Urgency aggressively. Every BOFU piece should make the offer visible.')
  }

  lines.push('')
  lines.push('Generate the full 9-piece funnel using EXACT marker format. 3 pieces per tier. Each piece uses a DIFFERENT formula from the tier\'s allowed list. Each piece 100-150 words per language.')

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

function parseCtaStrength(s: string): FunnelPiece['ctaStrength'] {
  const lower = s.trim().toLowerCase()
  if (lower.startsWith('soft')) return 'soft'
  if (lower.startsWith('hard')) return 'hard'
  return 'balanced'
}

function findChunks(raw: string, chunkRe: RegExp): number[] {
  const out: number[] = []
  chunkRe.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = chunkRe.exec(raw))) out.push(m.index)
  return out
}

function parseTierPieces(tierBlock: string, tier: FunnelTier): FunnelPiece[] {
  const out: FunnelPiece[] = []
  const indices = findChunks(tierBlock, /<<<\s*PIECE\s+(\d+)\s*>>>/gi)
  if (indices.length === 0) return out

  const nextMarkers = ['FORMULA', 'CTA_STRENGTH', 'VI', 'MY', 'PIECE', 'TOFU', 'MOFU', 'BOFU']

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]
    const end = i + 1 < indices.length ? indices[i + 1] : tierBlock.length
    const chunk = tierBlock.slice(start, end)

    const formula  = extractMarkerBlock(chunk, 'FORMULA',      nextMarkers)
    const ctaRaw   = extractMarkerBlock(chunk, 'CTA_STRENGTH', nextMarkers)
    const vi       = extractMarkerBlock(chunk, 'VI',           nextMarkers)
    const my       = extractMarkerBlock(chunk, 'MY',           nextMarkers)

    if (vi && my) {
      out.push({
        id: crypto.randomUUID(),
        tier,
        formula: formula || 'PAS',
        ctaStrength: parseCtaStrength(ctaRaw),
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

export async function generateFunnel(brief: LabBriefResult): Promise<FunnelOutput> {
  const apiKey = getGeminiKey()
  const userPrompt = buildUserPrompt(brief)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    // 9 pieces × ~250 words × 2 languages + markers — generous budget.
    maxOutputTokens: 14336,
  })

  // Slice into tier blocks so each parser only sees its tier.
  const tofuBlock = extractMarkerBlock(raw, 'TOFU', ['MOFU', 'BOFU'])
  const mofuBlock = extractMarkerBlock(raw, 'MOFU', ['BOFU', 'TOFU'])
  const bofuBlock = extractMarkerBlock(raw, 'BOFU', ['MOFU', 'TOFU'])

  const pieces: FunnelPiece[] = [
    ...parseTierPieces(tofuBlock, 'tofu'),
    ...parseTierPieces(mofuBlock, 'mofu'),
    ...parseTierPieces(bofuBlock, 'bofu'),
  ]

  if (pieces.length === 0) {
    throw new Error('Gemini không trả về phễu hợp lệ — thử lại')
  }

  return {
    pieces,
    generatedAt: Date.now(),
  }
}
