// ─────────────────────────────────────────────────────────────────────
// Composer — mergeBlocks (P4)
//
// Combine N source blocks → 1 section. Strategy:
//   - Concat paragraphs (preserve block order)
//   - Separate proof blocks (absorbed as inlineProof, NOT paragraph text)
//   - Skip empty/missing blocks (optional blocks tolerated)
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../../storytelling/runtime/parsePackResponse'
import type { BlockId } from '../../storytelling/types'
import type { InlineProofPiece } from '../types'
import { PROOF_CALLOUT_BLOCK_IDS } from '../config/compositionRules'

export interface MergedBlocks {
  /** Concatenated narrative paragraphs (non-proof blocks). */
  paragraphs: string[]
  /** Single inline proof piece if any proof block was in source set. */
  inlineProof?: InlineProofPiece
  /** Source block IDs actually merged (excludes missing optional blocks). */
  sourceBlockIds: BlockId[]
}

/** Merge source blocks for a section role.
 *  - Looks up each block in packSections (by id).
 *  - Concatenates paragraphs for non-proof blocks.
 *  - Absorbs first proof block as inlineProof (per section, only 1).
 *  - Tolerates missing blocks (returns whatever it finds). */
export function mergeBlocks(
  sourceBlockIds: BlockId[],
  packSections: ParsedSection[],
): MergedBlocks {
  const sectionsById = new Map(packSections.map((s) => [s.id, s]))
  const paragraphs: string[] = []
  const presentBlockIds: BlockId[] = []
  let inlineProof: InlineProofPiece | undefined

  for (const blockId of sourceBlockIds) {
    const section = sectionsById.get(blockId)
    if (!section) continue  // optional block missing — skip gracefully

    if (PROOF_CALLOUT_BLOCK_IDS.includes(blockId)) {
      // Absorb proof piece as inline (first one wins if multiple).
      if (!inlineProof && section.reviews && section.reviews.length > 0) {
        const r = section.reviews[0]
        inlineProof = {
          quote: r.quote,
          author: r.author,
          meta: r.meta,
        }
      }
      // Even if no review piece, mark block as "present" for trace.
      presentBlockIds.push(blockId)
      continue
    }

    // Non-proof block → concat paragraphs
    for (const p of section.paragraphs) {
      if (p && p.trim().length > 0) {
        paragraphs.push(p)
      }
    }
    presentBlockIds.push(blockId)
  }

  return { paragraphs, inlineProof, sourceBlockIds: presentBlockIds }
}
