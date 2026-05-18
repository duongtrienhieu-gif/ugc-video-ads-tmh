// ── DNA Directive Assembler (P28 — Phase 4 Intelligence Layer) ─────────────
//
// Converts a CreativeDNA into a structured "hard rules" text block.
// Every engine (photographic / ui-native / designed-graphic) consumes
// this block — photographic via BLOCKS.dnaRules() in the prompt
// assembler, ui-native + designed-graphic via systemInstruction append.
//
// THIS IS THE SOURCE OF TRUTH. The block label uses HARD RULES SOURCE
// OF TRUTH to signal to the LLM that everything inside has priority
// over the model's stylistic defaults.

import type { CreativeDNA } from '../../types/creativeDNA'

const LIST_GLYPH = '- '

function bulletList(items: string[] | undefined): string {
  if (!items || items.length === 0) return ''
  return items.map((it) => `${LIST_GLYPH}${it}`).join('\n')
}

/** Convert a CreativeDNA into a structured directive block.
 *
 *  Emits empty string if no rule arrays are populated — keeps legacy
 *  configs (P15-era, no rule arrays declared) from polluting the prompt
 *  with empty section headers. */
export function assembleDnaDirective(dna: CreativeDNA): string {
  const sections: string[] = []

  // ── Section 1: marketing + emotional + behavior summary ────────────
  const headerLines: string[] = []
  if (dna.marketingGoal)    headerLines.push(`Marketing goal: ${dna.marketingGoal}`)
  if (dna.emotionalGoal)    headerLines.push(`Emotional goal: ${dna.emotionalGoal}`)
  if (dna.typographyStyle)  headerLines.push(`Typography: ${dna.typographyStyle}`)
  if (dna.platformBehavior) headerLines.push(`Platform behavior: ${dna.platformBehavior}`)
  if (headerLines.length === 0
      && !dna.layoutRules?.length
      && !dna.contentRules?.length
      && !dna.visualRules?.length
      && !dna.qualityRules?.length
      && !dna.failureModes?.length) {
    // Nothing to emit — legacy config without Phase 4 rules.
    return ''
  }

  sections.push('[CREATIVE DNA — HARD RULES SOURCE OF TRUTH]')
  if (headerLines.length > 0) {
    sections.push(headerLines.join('\n'))
  }

  // ── Section 2: layout rules ────────────────────────────────────────
  if (dna.layoutRules?.length) {
    sections.push('[LAYOUT RULES — MUST FOLLOW]\n' + bulletList(dna.layoutRules))
  }

  // ── Section 3: content rules ───────────────────────────────────────
  if (dna.contentRules?.length) {
    sections.push('[CONTENT RULES — MUST FOLLOW]\n' + bulletList(dna.contentRules))
  }

  // ── Section 4: visual rules ────────────────────────────────────────
  if (dna.visualRules?.length) {
    sections.push('[VISUAL RULES — MUST FOLLOW]\n' + bulletList(dna.visualRules))
  }

  // ── Section 5: failure modes (negatives) ───────────────────────────
  if (dna.failureModes?.length) {
    sections.push('[FAILURE MODES — MUST NEVER PRODUCE]\n' + bulletList(dna.failureModes))
  }

  // ── Section 6: quality bar ─────────────────────────────────────────
  if (dna.qualityRules?.length) {
    sections.push('[QUALITY BAR — THESE MUST HOLD IN THE OUTPUT]\n' + bulletList(dna.qualityRules))
  }

  return sections.join('\n\n')
}

/** Compact summary suitable for logging / metadata.engineExtras. Returns
 *  a JSON-friendly snapshot of the DNA rule arrays — used by QC to
 *  surface the active rule set in the output's metadata. */
export function dnaSummary(dna: CreativeDNA): Record<string, unknown> {
  return {
    marketingGoal:    dna.marketingGoal,
    emotionalGoal:    dna.emotionalGoal,
    typographyStyle:  dna.typographyStyle,
    platformBehavior: dna.platformBehavior,
    layoutRules:      dna.layoutRules     ?? [],
    contentRules:     dna.contentRules    ?? [],
    visualRules:      dna.visualRules     ?? [],
    qualityRules:     dna.qualityRules    ?? [],
    failureModes:     dna.failureModes    ?? [],
  }
}
