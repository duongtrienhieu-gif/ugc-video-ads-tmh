// ═════════════════════════════════════════════════════════════════════
// resolveBlockPlan — flex story blocks + interleaved proof callouts
//
// Story block count flexes by emotional intensity + niche:
//   intensity=low   → 12 story blocks (skip both optional)
//   intensity=med   → 13 story blocks (include 1 optional by niche fit)
//   intensity=high  → 14 story blocks (include both optional)
//
// + 3 proof callouts (P2) at phase boundaries:
//   - proof-recognition (after Phase 1 not-alone-bridge)
//   - proof-solution (after Phase 3 why-this-felt-different)
//   - proof-future-self (after Phase 4 emotional-wins)
//
// Total pack: 15-17 blocks. Proof content from separate Gemini call.
// ═════════════════════════════════════════════════════════════════════

import type { BlockId, BlockPlan, NicheKey, StorytellingInput } from '../types'
import { ALL_BLOCK_IDS, BLOCK_POOL } from '../config/blockPool'
// REBUILD Sprint 2 (2026-05-28) — Narrative mode block filter.
import type { NarrativeMode, LengthMode } from '../../narrativeMode'
import { isBlockSkippedForMode, isBlockSkippedForLength } from '../../narrativeMode'

/** Niches where reader skepticism is a primary trust blocker. */
const SKEPTICISM_PRONE_NICHES: NicheKey[] = [
  'skincare', 'haircare', 'beauty-confidence',
]

/** Niches where product mechanism complexity matters (multi-mechanism). */
const MECHANISM_COMPLEX_NICHES: NicheKey[] = [
  'supplement-wellness', 'health-functional',
]

/** Decide whether to include 'skepticism-alignment' optional block. */
function includeSkepticism(input: StorytellingInput): boolean {
  if (input.emotionalIntensity === 'high') return true
  if (input.emotionalIntensity === 'low')  return false
  return SKEPTICISM_PRONE_NICHES.includes(input.niche)
}

/** Decide whether to include 'soft-mechanism-compare' optional block. */
function includeMechanismCompare(input: StorytellingInput): boolean {
  if (input.emotionalIntensity === 'high') return true
  if (input.emotionalIntensity === 'low')  return false
  return MECHANISM_COMPLEX_NICHES.includes(input.niche)
}

/** Top-level resolver: returns 6-15 BlockPlans in canonical phase order.
 *  - Optional blocks toggled by intensity + niche fit.
 *  - REBUILD Sprint 2 (2026-05-28): when `narrativeMode` is provided, cull
 *    filler blocks the mode does not need (e.g. pain-driven-DR drops
 *    not-alone-bridge / belief-shift / emotional-wins).
 *  - 2026-05-29 (Length Mode): when `lengthMode` is provided, cull
 *    additional non-critical blocks for SHORT mode (impulse COD products).
 *    SHORT mode drops hidden-emotional-truth (merged into Block 1) +
 *    soft-mechanism-compare (proof block covers this implicitly) +
 *    skepticism-alignment (optional anyway).
 *  - Order preserved in all cases. */
export function resolveBlockPlan(
  input: StorytellingInput,
  narrativeMode?: NarrativeMode,
  lengthMode?: LengthMode,
): BlockPlan[] {
  const optionalIncluded: Partial<Record<BlockId, boolean>> = {
    'skepticism-alignment': includeSkepticism(input),
    'soft-mechanism-compare': includeMechanismCompare(input),
  }

  const selected: BlockPlan[] = []
  for (const id of ALL_BLOCK_IDS) {
    const blueprint = BLOCK_POOL[id]
    if (!blueprint.required && !optionalIncluded[id]) continue
    if (narrativeMode && isBlockSkippedForMode(id, narrativeMode)) continue
    if (lengthMode && isBlockSkippedForLength(id, lengthMode)) continue
    selected.push({
      blueprint,
      order: selected.length + 1,
    })
  }

  return selected
}
