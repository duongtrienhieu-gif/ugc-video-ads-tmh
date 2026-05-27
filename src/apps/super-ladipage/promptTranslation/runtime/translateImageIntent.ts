// ─────────────────────────────────────────────────────────────────────
// Prompt Translation — translateImageIntent (P10 single-section)
//
// ImageIntent → ImagePromptContract. Pure translation. Each axis value
// concatenated to its bucket via lookup. Deterministic, stable order.
// No interpolation, no model syntax.
//
// LOCKED: positiveFragments = union of realism + composition + atmosphere
//         negativeFragments = alias of avoidanceFragments
// ─────────────────────────────────────────────────────────────────────

import type { ImageIntent } from '../../imageSemantics'
import type { ImagePromptContract } from '../types'
import {
  REALISM_FRAGMENTS_BY_LEVEL,
  REALISM_FRAGMENTS_BY_POLISH,
  COMPOSITION_FRAGMENTS_BY_FRAMING,
  COMPOSITION_FRAGMENTS_BY_TENSION,
  COMPOSITION_FRAGMENTS_BY_DISTANCE,
  ATMOSPHERE_FRAGMENTS_BY_LIGHTING,
  ATMOSPHERE_FRAGMENTS_BY_NOISE,
  ATMOSPHERE_FRAGMENTS_BY_EMOTION,
  PROOF_FRAGMENTS_BY_FEEL,
  ROLE_FRAGMENTS,
} from '../config/fragmentMaps'
import {
  GLOBAL_AVOIDANCE_FRAGMENTS,
  ROLE_AVOIDANCE_FRAGMENTS,
  PROOF_AVOIDANCE_FRAGMENTS,
} from '../config/avoidanceFragments'

export function translateImageIntent(intent: ImageIntent): ImagePromptContract {
  // ── REALISM bucket ─────────────────────────────────────────────
  const realismFragments = dedupe([
    ...REALISM_FRAGMENTS_BY_LEVEL[intent.realismLevel],
    ...REALISM_FRAGMENTS_BY_POLISH[intent.polishLevel],
  ])

  // ── COMPOSITION bucket ─────────────────────────────────────────
  const compositionFragments = dedupe([
    ...COMPOSITION_FRAGMENTS_BY_FRAMING[intent.framingStyle],
    ...COMPOSITION_FRAGMENTS_BY_TENSION[intent.compositionTension],
    ...COMPOSITION_FRAGMENTS_BY_DISTANCE[intent.subjectDistance],
    ...PROOF_FRAGMENTS_BY_FEEL[intent.proofFeel],
    ...ROLE_FRAGMENTS[intent.imageRole],
  ])

  // ── ATMOSPHERE bucket ──────────────────────────────────────────
  const atmosphereFragments = dedupe([
    ...ATMOSPHERE_FRAGMENTS_BY_LIGHTING[intent.lightingMood],
    ...ATMOSPHERE_FRAGMENTS_BY_NOISE[intent.visualNoise],
    ...ATMOSPHERE_FRAGMENTS_BY_EMOTION[intent.emotionalState],
  ])

  // ── AVOIDANCE bucket — global + role + proof conditionals ──────
  const avoidanceFragments = dedupe([
    ...GLOBAL_AVOIDANCE_FRAGMENTS,
    ...ROLE_AVOIDANCE_FRAGMENTS[intent.imageRole],
    ...PROOF_AVOIDANCE_FRAGMENTS[intent.proofFeel],
  ])

  // ── Unions (renderer convenience) ──────────────────────────────
  const positiveFragments = dedupe([
    ...realismFragments,
    ...compositionFragments,
    ...atmosphereFragments,
  ])
  const negativeFragments = avoidanceFragments  // alias

  return {
    positiveFragments,
    negativeFragments,
    realismFragments,
    compositionFragments,
    atmosphereFragments,
    avoidanceFragments,
  }
}

/** Stable de-duplication preserving first occurrence order. */
function dedupe(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const f of list) {
    if (!seen.has(f)) {
      seen.add(f)
      out.push(f)
    }
  }
  return out
}
