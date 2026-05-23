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
  EnergyCurvePreset, MemorySnapshot, NarratorArchetype, NicheKey, PersonaEmotionalDNA,
} from '../types'
import { NARRATOR_ARCHETYPES, archetypesForNiche } from '../config/narratorArchetypes'
import {
  PERSONA_EMOTIONAL_DNA, getEmotionalDnaForNiche,
} from '../config/personaEmotionalDNA'
import { ENERGY_CURVE_PRESETS } from '../config/energyCurvePresets'
import { snapshotsForNiche } from '../config/memorySnapshots'
import {
  HOOK_AXES, NICHE_HOOK_AXIS_BIAS,
  type HookEmotionalAxis,
} from '../config/hookVariation'
import {
  DISCOVERY_CHANNELS,
  type DiscoveryChannel,
} from '../config/discoveryChannels'

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

  console.info(
    `[storytelling/selectNarratorDna] seed=${seed.slice(-12)} → narrator=${narrator.id}, ` +
    `dna=${emotionalDna?.niche ?? 'generic'}, curve=${energyCurve.id}, ` +
    `snapshots=${memorySnapshots.length}, hook=${hookAxis}, discovery=${discoveryChannel}`,
  )

  return {
    seed, narrator, emotionalDna, energyCurve, memorySnapshots,
    hookAxis, discoveryChannel,
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
