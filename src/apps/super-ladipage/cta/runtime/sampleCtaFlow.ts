// ─────────────────────────────────────────────────────────────────────
// CTA — sampleCtaFlow (P3)
//
// Per-pack orchestrator. Samples:
//   - 1 niche-specific energy mode (deterministic per niche, no random)
//   - 2 distinct micro-commitment patterns
//   - 1 friction reduction pattern
//   - 1 reassurance pattern
//   - 1 urgency texture pattern
//
// Result = CtaFlow object injected at pack prompt top as brief.
// Gemini interprets and weaves into natural narrator voice across blocks.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey, CtaFlow } from '../types'
import { getCtaModeForNiche } from '../config/ctaModes'
import { sampleMicroCommitments } from '../config/microCommitmentPatterns'
import { sampleFrictionReduction } from '../config/frictionReductionPatterns'
import { sampleReassurance } from '../config/reassurancePatterns'
import { sampleUrgencyTexture } from '../config/urgencyTextures'

/** Top-level CTA flow sampler — deterministic per seed + niche. */
export function sampleCtaFlow(seed: string, niche: NicheKey): CtaFlow {
  return {
    energyMode:        getCtaModeForNiche(niche),
    microCommitments:  sampleMicroCommitments(seed, 2),
    frictionReduction: sampleFrictionReduction(seed),
    reassurance:       sampleReassurance(seed),
    urgency:           sampleUrgencyTexture(seed),
  }
}
