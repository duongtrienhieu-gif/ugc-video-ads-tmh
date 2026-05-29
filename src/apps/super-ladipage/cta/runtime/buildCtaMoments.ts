// ─────────────────────────────────────────────────────────────────────
// CTA — buildCtaMoments (P3)
//
// Compose sampled CtaFlow into pack-top brief. Declarative (samping
// state delivery), NOT prescriptive per-block prescription.
//
// Gemini reads brief at top of pack prompt → naturally weaves moments
// into appropriate phase blocks. NO per-block CTA instructions to
// avoid prompt stacking.
// ─────────────────────────────────────────────────────────────────────

import type { CtaFlow, CtaPattern } from '../types'

/** Compose CTA moments brief.
 *
 *  CP-SYNTHESIS (2026-05-28): when commercialPsych.ctaEnergyVibe is
 *  provided (product-specific synthesized), it OVERRIDES the niche-table
 *  energyMode.vibe. Avoid patterns merged from both sources. Pattern:
 *  same as nicheDesireBrief override. */
export function buildCtaMomentsBrief(
  flow: CtaFlow,
  commercialPsych?: {
    ctaEnergyVibe?: string
    ctaAvoidPatterns?: string[]
  },
): string {
  const lines: string[] = []

  const useSynthesizedVibe = Boolean(
    commercialPsych && commercialPsych.ctaEnergyVibe && commercialPsych.ctaEnergyVibe.length > 5,
  )
  const vibe = useSynthesizedVibe ? commercialPsych!.ctaEnergyVibe! : flow.energyMode.vibe
  const avoidPatterns = useSynthesizedVibe && commercialPsych!.ctaAvoidPatterns && commercialPsych!.ctaAvoidPatterns!.length > 0
    ? Array.from(new Set([...commercialPsych!.ctaAvoidPatterns!, ...flow.energyMode.avoidPatterns]))
    : flow.energyMode.avoidPatterns

  lines.push(`═══ CTA ORCHESTRATION (per-pack — lightweight action momentum) ═══`)
  lines.push(``)
  lines.push(`CTA energy: ${useSynthesizedVibe ? 'product-synthesized — AUTHORITATIVE' : `niche-baseline ${flow.energyMode.id} (${flow.energyMode.niche})`}`)
  lines.push(`  Vibe: ${vibe}`)
  lines.push(`  ⛔ Final block (future-self-cta) MUST NOT default to:`)
  for (const avoid of avoidPatterns) {
    lines.push(`     ✗ ${avoid}`)
  }
  lines.push(``)

  lines.push(`MICRO-COMMITMENTS (weave 1-2 small internal-agreement lines across Phase 2-3-4):`)
  for (const mc of flow.microCommitments) {
    lines.push(`  - ${mc.posture}`)
    lines.push(`    Frame: ${mc.frame}`)
    lines.push(`    Shape example (niche-mismatched): ${mc.exampleNicheMismatched}`)
  }
  lines.push(``)

  lines.push(`FRICTION REDUCTION (1 moment, near solution opening or pre-CTA):`)
  patternLines(flow.frictionReduction, lines)
  lines.push(``)

  lines.push(`REASSURANCE TEXTURE (1 moment, Phase 4 — anti-miracle gradual language):`)
  patternLines(flow.reassurance, lines)
  lines.push(``)

  lines.push(`URGENCY TEXTURE (1 moment, near final CTA — EMOTIONAL urgency only):`)
  patternLines(flow.urgency, lines)
  lines.push(``)

  lines.push(`PHILOSOPHY (CTA orchestration):`)
  lines.push(`- CTA should feel emotionally inevitable, NOT commercially inserted.`)
  lines.push(`- Layered momentum > 1 final CTA. Small commitments accumulate.`)
  lines.push(`- ⛔ NEVER: "đặt hàng ngay" / "mua ngay" / scarcity / countdown / "chỉ còn".`)
  lines.push(`- ✅ ALWAYS: emotional pull, gradual descent into action.`)

  return lines.join('\n')
}

function patternLines(p: CtaPattern, lines: string[]): void {
  lines.push(`  Posture: ${p.posture}`)
  lines.push(`  Frame: ${p.frame}`)
  lines.push(`  Shape example (niche-mismatched, never copy verbatim): ${p.exampleNicheMismatched}`)
}
