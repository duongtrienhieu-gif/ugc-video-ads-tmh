// ─────────────────────────────────────────────────────────────────────
// Composer — COMPOSITION RULES (P4)
//
// Block → SectionRole mapping. 7 roles (LOCKED — no expansion).
//
// Optional blocks (skepticism-alignment, soft-mechanism-compare) handled
// gracefully — composer tolerates missing blocks per role.
//
// Order in COMPOSITION_ORDER determines mobile section sequence.
// ─────────────────────────────────────────────────────────────────────

import type { BlockId } from '../../storytelling/types'
import type { SectionRole } from '../types'

/** Block IDs that feed each section role. Order within array preserved
 *  during merge (block order in array = paragraph order in section). */
export const COMPOSITION_RULES: Record<SectionRole, BlockId[]> = {
  'hero-recognition': [
    'self-recognition-hook',
  ],
  'lived-experience': [
    'daily-micro-friction',
    'hidden-emotional-truth',
    'not-alone-bridge',
    'proof-recognition',           // inline proof absorbed into this section
  ],
  'shared-struggle': [
    'narrator-validation-entry',
    'shared-failed-attempts',
    'skepticism-alignment',        // optional — may be absent
  ],
  'reframe-moment': [
    'belief-shift',
  ],
  'solution-opening': [
    'natural-product-discovery',
    'why-this-felt-different',
    'proof-solution',              // inline proof absorbed
    'soft-mechanism-compare',      // optional — may be absent
  ],
  'transformation': [
    'micro-transformation',
    'emotional-wins',
    'proof-future-self',           // inline proof absorbed
  ],
  'close-invitation': [
    'future-self-cta',
  ],
}

/** Canonical order of section roles in composed mobile page. */
export const COMPOSITION_ORDER: SectionRole[] = [
  'hero-recognition',
  'lived-experience',
  'shared-struggle',
  'reframe-moment',
  'solution-opening',
  'transformation',
  'close-invitation',
]

/** Block IDs that are PROOF callouts (absorbed as inlineProof, not paragraph text). */
export const PROOF_CALLOUT_BLOCK_IDS: BlockId[] = [
  'proof-recognition',
  'proof-solution',
  'proof-future-self',
]

/** Block IDs that are OPTIONAL (composer tolerates if absent). */
export const OPTIONAL_BLOCK_IDS: BlockId[] = [
  'skepticism-alignment',
  'soft-mechanism-compare',
]

/** Helper: which role does a block belong to? Returns null if not mapped. */
export function getSectionRoleForBlock(blockId: BlockId): SectionRole | null {
  for (const [role, blocks] of Object.entries(COMPOSITION_RULES) as [SectionRole, BlockId[]][]) {
    if (blocks.includes(blockId)) return role
  }
  return null
}
