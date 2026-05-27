// ─────────────────────────────────────────────────────────────────────
// Renderer Adapter — SDXL (P11)
//
// Style: weighted tags + ordered fragments + strong negative handling.
// Weights front-load the most important bucket leaders.
//
// Weighting policy (LOCKED — position-based, no semantic logic):
//   realismFragments[0]     → weight 1.2  (baseline realism anchor)
//   compositionFragments[0] → weight 1.15 (framing anchor)
//   atmosphereFragments[0]  → weight 1.05 (lighting anchor)
// All other fragments unweighted. SDXL emphasis syntax: (text:weight).
//
// Negative handling: SDXL has native strong negative-prompt support.
// Full avoidance fragment list goes to negativePrompt. Never weakened.
//
// LOCKED: weights chosen by POSITION in bucket, not semantic content.
// Upstream translateImageIntent already orders fragments with the
// dominant axis value first — adapter cannot re-interpret.
// ─────────────────────────────────────────────────────────────────────

import type { ImagePromptContract } from '../../promptTranslation'
import type { RendererPrompt } from '../types'

const WEIGHT_REALISM_LEADER = 1.2
const WEIGHT_COMPOSITION_LEADER = 1.15
const WEIGHT_ATMOSPHERE_LEADER = 1.05

export function sdxlAdapter(contract: ImagePromptContract): RendererPrompt {
  // ── Apply position-based weighting to bucket leaders ────────────
  const realism = applyLeaderWeight(contract.realismFragments, WEIGHT_REALISM_LEADER)
  const composition = applyLeaderWeight(
    contract.compositionFragments,
    WEIGHT_COMPOSITION_LEADER,
  )
  const atmosphere = applyLeaderWeight(
    contract.atmosphereFragments,
    WEIGHT_ATMOSPHERE_LEADER,
  )

  // ── Positive: weighted leaders front-loaded ─────────────────────
  const positive = [...realism, ...composition, ...atmosphere].join(', ')

  // ── Negative: full avoidance list, no weakening ─────────────────
  const negative = contract.avoidanceFragments.join(', ')

  return {
    prompt: positive,
    negativePrompt: negative,
  }
}

/** Wraps the first fragment in (text:weight) syntax. Rest unchanged. */
function applyLeaderWeight(fragments: string[], weight: number): string[] {
  if (fragments.length === 0) return fragments
  const leader = `(${fragments[0]}:${weight})`
  return [leader, ...fragments.slice(1)]
}
