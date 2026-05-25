// ═════════════════════════════════════════════════════════════════════
// resolveBlockPlan — flex 13-15 blocks per pack
//
// Block count flexes by emotional intensity + niche:
//   intensity=low   → 13 blocks (skip both optional)
//   intensity=med   → 14 blocks (include 1 optional by niche fit)
//   intensity=high  → 15 blocks (include both optional)
//
// Niche bias for optional blocks:
//   - skepticism-alignment: niches with high vanity skepticism
//     (skincare, haircare, beauty-confidence) — readers pre-disposed
//     to "yeah but I've tried everything"
//   - soft-mechanism-compare: niches with mechanism complexity
//     (supplement-wellness, health-functional) — readers need to
//     understand why this approach differs
// ═════════════════════════════════════════════════════════════════════

import type { BlockId, BlockPlan, NicheKey, StorytellingInput } from '../types'
import { ALL_BLOCK_IDS, BLOCK_POOL } from '../config/blockPool'

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

/** Top-level resolver: returns 13-15 BlockPlans in canonical phase order.
 *  Optional blocks toggled by intensity + niche fit. Order preserved. */
export function resolveBlockPlan(input: StorytellingInput): BlockPlan[] {
  const optionalIncluded: Partial<Record<BlockId, boolean>> = {
    'skepticism-alignment': includeSkepticism(input),
    'soft-mechanism-compare': includeMechanismCompare(input),
  }

  const selected: BlockPlan[] = []
  for (const id of ALL_BLOCK_IDS) {
    const blueprint = BLOCK_POOL[id]
    if (!blueprint.required && !optionalIncluded[id]) continue
    selected.push({
      blueprint,
      order: selected.length + 1,
    })
  }

  return selected
}
