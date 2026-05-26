// ─────────────────────────────────────────────────────────────────────
// Proof System — sampleProofConfig (P1 foundation)
//
// Per-pack sampling orchestrator. Generates 3 ProofPieceConfig with
// variety enforced across:
//   - 3 distinct stances (no repeat)
//   - 3 distinct phaseResonances
//   - 3 distinct entropy profiles (grammar + effort variety)
//   - 1-2 pieces tagged with counter-objection (from niche pool)
//
// Texture profile (per niche) attached at pack level.
//
// Deterministic per seed — same input → same proof config (debugging).
// ─────────────────────────────────────────────────────────────────────

import type {
  NicheKey, ProofConfig, ProofPieceConfig, ProofPhase,
} from '../types'
import { sampleStances } from '../config/proofStances'
import { getTextureProfile } from '../config/proofTextureProfiles'
import { sampleObjections } from '../config/objectionPatterns'
import { sampleEntropyProfiles } from '../config/proofEntropyRules'

const PHASE_POOL: ProofPhase[] = ['recognition', 'trust', 'solution', 'future-self', 'cta']

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 3 distinct phase resonances. */
function samplePhases(seed: string, count = 3): ProofPhase[] {
  const all = [...PHASE_POOL]
  const picked: ProofPhase[] = []
  for (let i = 0; i < count; i++) {
    if (all.length === 0) break
    const idx = hashSeed(`${seed}:phase:${i}`) % all.length
    picked.push(all[idx])
    all.splice(idx, 1)
  }
  return picked
}

/** Top-level sampler: 3 ProofPieceConfig + texture per pack. */
export function sampleProofConfig(seed: string, niche: NicheKey): ProofConfig {
  const stances = sampleStances(seed, 3)
  const phases = samplePhases(seed, 3)
  const entropies = sampleEntropyProfiles(seed, 3)
  const objections = sampleObjections(seed, niche, 2)
  const texture = getTextureProfile(niche)

  const pieces: ProofPieceConfig[] = []
  for (let i = 0; i < 3; i++) {
    pieces.push({
      stance: stances[i],
      phaseResonance: phases[i] ?? 'trust',
      entropy: entropies[i],
      // Assign objection to first 2 pieces only (if niche has objections).
      counterObjection: i < objections.length ? objections[i] : undefined,
    })
  }

  return { pieces, texture }
}
