// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — selectNarratorDna (v5.1)
//
// Seed-based deterministic selector for:
//   - NarratorArchetype (compatible với niche)
//   - PersonaEmotionalDNA (per niche, may be null if niche not mapped)
//   - EnergyCurvePreset (5 presets)
//
// Reproducible: same seed → same selection (debugging).
// Variation: different seeds → different selection.
// Override-able: caller passes seed for testing.
//
// Multi-seed suffix per pick — narrator vs DNA vs curve don't correlate.
// ─────────────────────────────────────────────────────────────────────

import type {
  EnergyCurvePreset, HookPattern, MemorySnapshot, NarratorArchetype, NicheKey, PersonaEmotionalDNA,
} from '../types'
import { NARRATOR_ARCHETYPES, archetypesForNiche } from '../config/narratorArchetypes'
import {
  PERSONA_EMOTIONAL_DNA, getEmotionalDnaForNiche,
} from '../config/personaEmotionalDNA'
import { ENERGY_CURVE_PRESETS } from '../config/energyCurvePresets'
import { snapshotsForNiche } from '../config/memorySnapshots'
import {
  BELIEF_SHIFT_CATALYSTS,
  type BeliefShiftCatalystType,
} from '../config/beliefShiftEngine'
import {
  DISCOVERY_CHANNELS,
  type DiscoveryChannel,
} from '../config/discoveryChannels'
import {
  sampleReviewStyles,
  type ReviewStyleProfile,
} from '../config/reviewStyleProfiles'
import {
  samplePayoffArchetype,
  type PayoffArchetype,
} from '../config/payoffArchetypes'
import {
  sampleYouFirstOpener,
  sampleBridgePhrase,
  HOOK_PATTERNS,
  HOOK_AXES,
  NICHE_HOOK_AXIS_BIAS,
  type YouFirstOpener,
  type BridgePhrase,
  type HookEmotionalAxis,
} from '../config/performanceHookLayer'
import {
  getDomainLockForNiche,
  type NicheDomainLock,
} from '../config/nicheDomainLock'
import {
  sampleMechanismFrame,
  NICHE_MECHANISM_VOCAB,
  type NicheMechanismVocab,
} from '../config/nicheMechanismVocab'
import {
  getDesireForNiche,
  type NicheDesireArchitecture,
} from '../config/nicheDesireArchitecture'
import {
  sampleMemoryAnchor,
  type MemoryAnchorPattern,
} from '../config/commercialMemoryAnchors'

/** Simple deterministic hash — same string → same integer.
 *  Not cryptographic but suitable for pick-by-modulo. */
function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Pick item from array using hash of seed + suffix. */
function pickByHash<T>(items: readonly T[], seed: string, suffix: string): T {
  if (items.length === 0) {
    throw new Error(`pickByHash: empty array for seed="${seed}" suffix="${suffix}"`)
  }
  const idx = hashSeed(`${seed}:${suffix}`) % items.length
  return items[idx]
}

export interface NarratorDnaSelection {
  /** Seed used (echoed back so caller can reproduce). */
  seed: string
  narrator: NarratorArchetype
  /** May be null if niche has no DNA mapped — caller falls back to generic. */
  emotionalDna: PersonaEmotionalDNA | null
  energyCurve: EnergyCurvePreset
  /** v5.2 — Sampled memory snapshots from niche library (5 per pack, deduped). */
  memorySnapshots: MemorySnapshot[]
  /** v5.3 — Sampled hook emotional axis for section 1. */
  hookAxis: HookEmotionalAxis
  /** v5.3 — Sampled discovery channel for section 6. */
  discoveryChannel: DiscoveryChannel
  /** v5.6 — Sampled hook pattern for section 1 (overrides blueprint default).
   *  Per-pack variation across all 6 patterns instead of hardcoded 'emotional-rejection'. */
  hookPattern: HookPattern
  /** v5.6 — Sampled belief shift catalyst type for section 5.
   *  Forces single deterministic catalyst per pack instead of letting Gemini pick from list. */
  beliefCatalystType: BeliefShiftCatalystType
  /** v5.7 — Sampled review style profiles for section 10 (3 per pack).
   *  Diversity-guaranteed across energy + optimism axes. Replaces abstract
   *  TRUST_REALISM_PROMPT rules with concrete per-slot style data. */
  reviewStyles: ReviewStyleProfile[]
  /** v5.7 Chunk 2 — Sampled payoff archetype (1 per pack). Drives emotional
   *  destination of sections 8 / 9 / 11. Replaces default "peaceful reflection"
   *  ending that every pack converged to. */
  payoffArchetype: PayoffArchetype
  /** v5.8 — Performance Hook Layer: you-first opener for section 1.
   *  Reader-immersion shift: reader feels "đang nói về mình" in 1-3s. */
  youFirstOpener: YouFirstOpener
  /** v5.8 — Bridge phrase from "you" to "tôi" closing section 1.
   *  Without bridge, hook feels accusatory. */
  bridgePhrase: BridgePhrase
  /** C2 — Niche domain lock: strict per-niche concrete data pools.
   *  Prevents cross-niche contamination. */
  domainLock: NicheDomainLock
  /** C2 — Niche mechanism vocab (vocab + banned generics + sampled frame). */
  mechanismVocab: NicheMechanismVocab
  /** C2 — Sampled mechanism frame for THIS pack (1 of 3 niche-specific frames). */
  mechanismFrame: string
  /** C2 — Niche desire architecture: emotional gravity per niche. */
  desireArchitecture: NicheDesireArchitecture
  /** C2 — Sampled commercial memory anchor pattern for THIS pack. */
  memoryAnchor: MemoryAnchorPattern
}

export interface SelectArgs {
  niche: NicheKey
  /** Optional explicit seed. If undefined, derived from productId + Date.now(). */
  seed?: string
  /** Product ID — used to derive default seed. */
  productId: string
}

/** Top-level selector. Returns narrator + DNA + curve selection. */
export function selectNarratorDna(args: SelectArgs): NarratorDnaSelection {
  const seed = args.seed ?? `${args.productId}_${Date.now()}`

  // 1. Pick narrator from niche-compatible pool. If empty, fall back to all archetypes.
  const compatibleNarrators = archetypesForNiche(args.niche)
  const narratorPool = compatibleNarrators.length > 0 ? compatibleNarrators : NARRATOR_ARCHETYPES
  const narrator = pickByHash(narratorPool, seed, 'narrator')

  // 2. Pick DNA for niche (may be null if niche not mapped)
  const emotionalDna = getEmotionalDnaForNiche(args.niche)

  // 3. Pick energy curve from 5 presets
  const energyCurve = pickByHash(ENERGY_CURVE_PRESETS, seed, 'curve')

  // 4. v5.2 — Sample 5 memory snapshots from niche library (deduped via hash offsets)
  const nicheSnapshots = snapshotsForNiche(args.niche)
  const memorySnapshots: MemorySnapshot[] = []
  const usedSnapshotIds = new Set<string>()
  const targetCount = Math.min(5, nicheSnapshots.length)
  for (let i = 0; i < targetCount; i++) {
    let idx = hashSeed(`${seed}:snapshot:${i}`) % nicheSnapshots.length
    // Avoid duplicates within same pack — linear probe
    let attempts = 0
    while (usedSnapshotIds.has(nicheSnapshots[idx].id) && attempts < nicheSnapshots.length) {
      idx = (idx + 1) % nicheSnapshots.length
      attempts++
    }
    if (!usedSnapshotIds.has(nicheSnapshots[idx].id)) {
      memorySnapshots.push(nicheSnapshots[idx])
      usedSnapshotIds.add(nicheSnapshots[idx].id)
    }
  }

  // 5. v5.3 — Sample hook emotional axis. Niche bias if mapped.
  const biasedAxes = NICHE_HOOK_AXIS_BIAS[args.niche]
  const axesPool: HookEmotionalAxis[] = biasedAxes && biasedAxes.length > 0
    ? biasedAxes
    : Object.keys(HOOK_AXES) as HookEmotionalAxis[]
  const hookAxis = pickByHash(axesPool, seed, 'hookAxis')

  // 6. v5.3 — Sample discovery channel from 13 channels.
  const channels = Object.keys(DISCOVERY_CHANNELS) as DiscoveryChannel[]
  const discoveryChannel = pickByHash(channels, seed, 'discovery')

  // 7. v5.6 — Sample hook pattern per pack (6 patterns).
  //    Blueprint's hardcoded hookPattern was causing every pack across niches
  //    to repeat the same example phrase ("Tôi bắt đầu ghét buổi sáng"). Now varies per seed.
  const hookPatternKeys = Object.keys(HOOK_PATTERNS) as HookPattern[]
  const hookPattern = pickByHash(hookPatternKeys, seed, 'hookPattern')

  // 8. v5.6 — Sample belief catalyst type per pack (5 catalyst types).
  //    Previously prompt said "CHOOSE 1 of: ..." → Gemini converged to same catalyst.
  //    Forced deterministic per-pack choice = diverse catalyst across packs.
  const catalystKeys = Object.keys(BELIEF_SHIFT_CATALYSTS) as BeliefShiftCatalystType[]
  const beliefCatalystType = pickByHash(catalystKeys, seed, 'beliefCatalyst')

  // 9. v5.7 — Sample 3 review styles for section 10 with diversity guarantee.
  //    Replaces abstract TRUST_REALISM_PROMPT (was causing all reviews to converge
  //    to "polished AI-trying-to-sound-human" voice). Now each review slot gets
  //    a concrete style profile with platform/punctuation/grammar/energy/etc.
  const reviewStyles = sampleReviewStyles(seed, 3)

  // 10. v5.7 Chunk 2 — Sample 1 payoff archetype for emotional destination.
  //     Previously every pack ended in "quiet peace / nhẹ hơn / lắng nghe cơ thể".
  //     Now: 12 archetypes (anger_regret / vanity_return / identity_return / etc).
  const payoffArchetype = samplePayoffArchetype(seed, args.niche)

  // 11. v5.8 — Performance Hook Layer: you-first opener + bridge phrase.
  //     Drives section 1 4-step structure (you-first → micro moment →
  //     hidden emotion → bridge to tôi). Reader-immersion shift.
  const youFirstOpener = sampleYouFirstOpener(seed)
  const bridgePhrase = sampleBridgePhrase(seed)

  // 12. C2 — Niche domain lock + mechanism vocab + desire architecture (per-niche
  //     deterministic — same niche always gets same data, no random selection).
  const domainLock = getDomainLockForNiche(args.niche)
  const mechanismVocab = NICHE_MECHANISM_VOCAB[args.niche]
  const mechanismFrame = sampleMechanismFrame(seed, args.niche)
  const desireArchitecture = getDesireForNiche(args.niche)

  // 13. C2 — Commercial memory anchor (sampled per pack).
  const memoryAnchor = sampleMemoryAnchor(seed)

  console.info(
    `[storytelling/selectNarratorDna] seed=${seed.slice(-12)} → narrator=${narrator.id}, ` +
    `dna=${emotionalDna?.niche ?? 'generic'}, curve=${energyCurve.id}, ` +
    `snapshots=${memorySnapshots.length}, hook=${hookAxis}, discovery=${discoveryChannel}, ` +
    `pattern=${hookPattern}, catalyst=${beliefCatalystType}, ` +
    `reviews=[${reviewStyles.map((r) => r.id).join(', ')}], payoff=${payoffArchetype.id}, ` +
    `youFirst=${youFirstOpener.id}, bridge=${bridgePhrase.id}, ` +
    `memAnchor=${memoryAnchor.id}, mechFrame="${mechanismFrame.slice(0, 40)}..."`,
  )

  return {
    seed, narrator, emotionalDna, energyCurve, memorySnapshots,
    hookAxis, discoveryChannel, hookPattern, beliefCatalystType,
    reviewStyles, payoffArchetype,
    youFirstOpener, bridgePhrase,
    domainLock, mechanismVocab, mechanismFrame, desireArchitecture, memoryAnchor,
  }
}

/** Verify all niches have at least one compatible archetype.
 *  Dev-time sanity check. */
export function verifyNicheCoverage(): { ok: boolean; uncovered: string[] } {
  const niches: NicheKey[] = [
    'skincare', 'haircare', 'supplement-wellness', 'health-functional',
    'mom-baby', 'relationship', 'fitness-recovery', 'beauty-confidence',
  ]
  const uncovered: string[] = []
  for (const n of niches) {
    if (archetypesForNiche(n).length === 0) uncovered.push(n)
  }
  if (PERSONA_EMOTIONAL_DNA && Object.keys(PERSONA_EMOTIONAL_DNA).length === 0) {
    uncovered.push('(no DNA mapped)')
  }
  return { ok: uncovered.length === 0, uncovered }
}
