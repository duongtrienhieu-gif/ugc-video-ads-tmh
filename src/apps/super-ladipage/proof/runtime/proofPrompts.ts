// ─────────────────────────────────────────────────────────────────────
// Proof System — prompts (P1 foundation)
//
// Separate Gemini call for proof generation. ZERO storytelling narrator
// brief — proof voice MUST be isolated from story prose voice.
//
// System prompt: anti-fake-review philosophy + stance/entropy framing.
// User prompt: per-piece directive (stance + entropy + phase + optional
// objection counter).
// ─────────────────────────────────────────────────────────────────────

import type { ProofConfig, ProofPieceConfig } from '../types'
import { textureBrief } from '../config/proofTextureProfiles'
import { entropyDirective } from '../config/proofEntropyRules'

export function buildProofSystemPrompt(): string {
  return `You generate Vietnamese mini-reviews/comments for product proof section.

YOU ARE NOT a storyteller. You write SHORT internet comments / DMs / FB replies
from DIFFERENT random humans. Each piece is from a DIFFERENT person with a
DIFFERENT brain (certainty level, enthusiasm, writing effort, eloquence).

🎯 PROOF PHILOSOPHY LOCK (critical):

Proof should feel SLIGHTLY MESSY — not fully optimized, not fully certain,
sometimes underwritten. Real people:
  - hedge
  - ramble
  - contradict slightly
  - speak unevenly
  - over/under explain randomly

DO NOT optimize toward perfect testimonial writing.
Optimize toward BELIEVABLE HUMAN TRACES.

⛔ ABSOLUTE BANS:
  - Polished testimonial prose ("Sản phẩm tuyệt vời", "Mình hoàn toàn hài lòng")
  - Star-rating vibe ("5/5 sao", "10/10")
  - Salesy enthusiasm ("phải mua ngay", "đáng tiền")
  - All 3 pieces same energy level (some flat, some mild — variety required)
  - Doctor/expert authority tone ("bác sĩ khuyên...")
  - Identical sentence structure across 3 pieces
  - Multiple emojis (🎉🥰💕)
  - Complete uniform grammar across all 3 pieces

✅ REQUIRED across 3 pieces (entropy variety):
  - DIFFERENT grammar quality (one casual, one fragmented, one fuller)
  - DIFFERENT certainty levels (one hedged, one mild, one stronger)
  - DIFFERENT effort (one 1-sentence dry, one 2-sentence, one paragraph-rambling)
  - DIFFERENT author info richness (one name+age, one nickname, one generic)
  - At least 1 piece SHOULD feel underwritten / fragmented / "low-effort comment"

OUTPUT FORMAT (strict JSON, no fences):
{
  "reviews": [
    { "quote": "...", "author": "...", "meta": "..." },
    { "quote": "...", "author": "...", "meta": "..." },
    { "quote": "...", "author": "...", "meta": "..." }
  ]
}

- "quote" = the review text in Vietnamese.
- "author" = short Vietnamese label per piece's authorInfoRichness directive.
- "meta" = OPTIONAL short descriptor ("FB comment", "DM", "Sau 3 tuần dùng", etc) — may omit.`
}

export function buildProofUserPrompt(
  args: {
    productName: string
    productNiche: string
    painPoint: string
    storyContextLine: string
    config: ProofConfig
  },
): string {
  const lines: string[] = []

  // Context block
  lines.push('PRODUCT CONTEXT (for grounding — do NOT echo verbatim):')
  lines.push(`- Product: ${args.productName}`)
  lines.push(`- Niche: ${args.productNiche}`)
  lines.push(`- Pain it addresses: ${args.painPoint}`)
  lines.push(`- Story summary: ${args.storyContextLine}`)
  lines.push('')

  // Niche texture brief
  lines.push(textureBrief(args.config.texture))
  lines.push('')

  // Per-piece directives
  lines.push(`═══ 3 PIECES — EACH FROM DIFFERENT PERSON ═══`)
  for (let i = 0; i < args.config.pieces.length; i++) {
    const piece = args.config.pieces[i]
    lines.push('')
    lines.push(`──── PIECE ${i + 1} ────`)
    lines.push(pieceDirective(piece))
  }

  // Closing reminders
  lines.push('')
  lines.push('═══ FINAL REMINDERS ═══')
  lines.push('- 3 pieces, each from DIFFERENT person with DIFFERENT brain.')
  lines.push('- At least 1 piece SHOULD feel underwritten / awkward / careless. That is REALISTIC.')
  lines.push('- DO NOT write storytelling-prose. DO write internet comments.')
  lines.push('- Vietnamese only. JSON only output. No markdown fences.')

  return lines.join('\n')
}

function pieceDirective(piece: ProofPieceConfig): string {
  const lines: string[] = []

  // Stance
  lines.push(`STANCE: ${piece.stance.id}`)
  lines.push(`  Voice: ${piece.stance.voice}`)
  lines.push(`  Characteristic moves:`)
  for (const move of piece.stance.characteristicMoves) {
    lines.push(`    - ${move}`)
  }
  lines.push(`  Shape examples (NEVER copy verbatim — niche-mismatched):`)
  for (const ex of piece.stance.exampleQuotesMismatched.slice(0, 2)) {
    lines.push(`    "${ex}"`)
  }

  // Entropy
  lines.push(`ENTROPY (this piece's specific texture):`)
  lines.push(entropyDirective(piece.entropy))

  // Phase resonance (forward-looking — affects vibe)
  lines.push(`PHASE RESONANCE: ${piece.phaseResonance}`)
  lines.push(`  → vibe should fit phase: ${phaseResonanceHint(piece.phaseResonance)}`)

  // Optional counter-objection
  if (piece.counterObjection) {
    lines.push(`COUNTER OBJECTION (this piece addresses skeptical reader):`)
    lines.push(`  Reader objection: ${piece.counterObjection.objection}`)
    lines.push(`  Counter posture: ${piece.counterObjection.counterPosture}`)
    lines.push(`  ⚠️ DO NOT direct-refute — emotional bypass via stance posture.`)
  }

  return lines.join('\n')
}

function phaseResonanceHint(phase: string): string {
  switch (phase) {
    case 'recognition':   return '"tôi cũng gặp / cũng bị như vậy" identification proof'
    case 'trust':         return 'vulnerable / shared experience — confessional tone'
    case 'solution':      return 'skepticism reduction — "tôi cũng từng nghi rồi thử"'
    case 'future-self':   return 'transformation validation — "đã dùng X tháng, đỡ rồi"'
    case 'cta':           return 'risk reduction / reassurance — "vẫn đang dùng đều"'
    default:              return 'shared experience'
  }
}
