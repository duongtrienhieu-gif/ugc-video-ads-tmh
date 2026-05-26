// ─────────────────────────────────────────────────────────────────────
// Proof System — prompts (P1 foundation)
//
// Separate Gemini call for proof generation. ZERO storytelling narrator
// brief — proof voice MUST be isolated from story prose voice.
//
// PROMPT MODE: DECLARATIVE config delivery, NOT prescriptive rule list.
// Sampling architecture (7 stances × entropy × texture × objections)
// carries variety enforcement. Prompt declares sampled state per piece;
// Gemini interprets naturally.
//
// Per governance §5 SAMPLING OVER INSTRUCTIONS — output variety comes
// from sampling diversity, NOT from "REQUIRED" / "BANNED" rules in prompt.
// ─────────────────────────────────────────────────────────────────────

import type { ProofConfig, ProofPieceConfig } from '../types'
import { textureBrief } from '../config/proofTextureProfiles'

export function buildProofSystemPrompt(): string {
  return `You generate Vietnamese mini-reviews/comments for product proof section.

VOICE ROLE: You are NOT a storyteller. You write SHORT internet comments / DMs /
FB replies. Zero storytelling-prose voice. Each piece is from a different person.

PHILOSOPHY (tone, not rule list):
Real proof feels slightly messy — people hedge, ramble, contradict slightly,
speak unevenly. Some pieces underwritten, some longer. Believable human traces
over optimized testimonial writing.

OUTPUT (strict JSON, no markdown fences):
{
  "reviews": [
    { "quote": "...", "author": "...", "meta": "..." },
    { "quote": "...", "author": "...", "meta": "..." },
    { "quote": "...", "author": "...", "meta": "..." }
  ]
}

- "quote" = review text in Vietnamese
- "author" = short label per piece's author format
- "meta" = OPTIONAL short descriptor (may omit)`
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

  // Niche texture brief (sampled data)
  lines.push(textureBrief(args.config.texture))
  lines.push('')

  // Per-piece directives
  lines.push(`═══ 3 PIECES — each from a different person ═══`)
  for (let i = 0; i < args.config.pieces.length; i++) {
    const piece = args.config.pieces[i]
    lines.push('')
    lines.push(`──── PIECE ${i + 1} ────`)
    lines.push(pieceDirective(piece))
  }

  // Brief closing
  lines.push('')
  lines.push('═══ FINAL ═══')
  lines.push('Voice: internet comments / DMs / FB replies. Vietnamese only. JSON only output.')

  return lines.join('\n')
}

function pieceDirective(piece: ProofPieceConfig): string {
  const lines: string[] = []

  // Stance — sampled data
  lines.push(`STANCE: ${piece.stance.id}`)
  lines.push(`  Voice: ${piece.stance.voice}`)
  lines.push(`  Characteristic moves:`)
  for (const move of piece.stance.characteristicMoves) {
    lines.push(`    - ${move}`)
  }
  lines.push(`  Shape examples (niche-mismatched, never copy verbatim):`)
  for (const ex of piece.stance.exampleQuotesMismatched.slice(0, 2)) {
    lines.push(`    "${ex}"`)
  }

  // Entropy — declarative config line (factual, not prescriptive)
  const e = piece.entropy
  lines.push(`Config: grammar=${e.grammar}, certainty=${e.certainty}, effort=${e.effort}, emoji=${e.emojiDensity}, author=${e.authorInfoRichness}`)

  // Phase resonance — sampled vibe
  lines.push(`Phase resonance: ${piece.phaseResonance} — ${phaseResonanceHint(piece.phaseResonance)}`)

  // Counter-objection (when sampled)
  if (piece.counterObjection) {
    lines.push(`Counter objection (this piece addresses skeptical reader via emotional bypass):`)
    lines.push(`  Reader objection: ${piece.counterObjection.objection}`)
    lines.push(`  Counter posture: ${piece.counterObjection.counterPosture}`)
  }

  return lines.join('\n')
}

function phaseResonanceHint(phase: string): string {
  switch (phase) {
    case 'recognition':   return '"tôi cũng gặp" identification'
    case 'trust':         return 'vulnerable / shared experience'
    case 'solution':      return 'skepticism reduction — "tôi cũng từng nghi rồi thử"'
    case 'future-self':   return 'transformation validation — "đã dùng X tháng"'
    case 'cta':           return 'risk reduction — "vẫn đang dùng đều"'
    default:              return 'shared experience'
  }
}
