// ─────────────────────────────────────────────────────────────────────
// Render Contract — computeProofPresentation (P5)
//
// Decides how inline proof piece renders within section:
//   - 'inline-quote-callout' for narrative sections (text-led with proof)
//   - 'bordered-block' for solution sections (more separation, scannable)
//   - 'subtle-attribution' for transformation sections (gentle, secondary)
//   - 'none' if no proof piece present
// ─────────────────────────────────────────────────────────────────────

import type { ComposedSection, SectionRole } from '../../composer'
import type { ProofPresentation } from '../types'

/** Per-role default proof presentation when inlineProof present. */
const ROLE_PROOF_PRESENTATION: Partial<Record<SectionRole, ProofPresentation>> = {
  'lived-experience':  'inline-quote-callout',   // Phase 1 — identification proof
  'solution-opening':  'bordered-block',         // Phase 3 — skepticism reduction needs visual weight
  'transformation':    'subtle-attribution',     // Phase 4 — gentle witness, anti-pressure
}

/** Compute proof presentation for section. */
export function computeProofPresentation(section: ComposedSection): ProofPresentation {
  if (!section.inlineProof) return 'none'
  return ROLE_PROOF_PRESENTATION[section.role] ?? 'subtle-attribution'
}
