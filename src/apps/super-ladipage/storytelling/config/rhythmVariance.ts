// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — rhythm variance config (P0.5.4 realignment)
//
// Storyselling target: CONVERSATIONAL DEFAULT — sounds like a Vietnamese
// friend casually sharing, NOT screenplay cadence.
//
// Changes from P0.5.2:
//   - 'fragmented' DROPPED (created AI-essay feel)
//   - 'short-clipped' RESTRICTED to rare emphasis only
//   - 'conversational' promoted to DEFAULT for most sections
//   - Adjacent rhythm rule LOOSENED — 2 flowing sections OK if readable
//
// Validators no longer punish "similar rhythm" if both conversational —
// readability > variance.
// ─────────────────────────────────────────────────────────────────────

import type { BlockId } from '../types'

/** Cadence profile key. Legacy v4-v5.8 RhythmProfile union was tuned for
 *  per-section narrator-arc rhythm; Reader-Immersion architecture lets
 *  cadence emerge from narrator psychology + paragraphTarget. Kept as
 *  free-form string for validator + sampling object compat. */
export type RhythmProfile =
  | 'conversational'
  | 'long-flowing'
  | 'short-clipped'
  | 'reflective-pause'
  | 'mixed'

export interface RhythmConstraints {
  profile: RhythmProfile
  sentenceLengthAvg: [min: number, max: number]
  paragraphLines: [min: number, max: number]
  /** Style markers — runtime đính kèm vào prompt. */
  styleMarkers: string[]
  /** 1-line distilled instruction cho prompt injection. */
  instruction: string
}

export const RHYTHM_PROFILES: Record<RhythmProfile, RhythmConstraints> = {
  'conversational': {
    profile: 'conversational',
    sentenceLengthAvg: [12, 20],
    paragraphLines: [2, 4],
    styleMarkers: ['flowing', 'natural-spoken', 'medium-long', 'occasional-rhetorical'],
    instruction:
      'sentences 12-20 words avg, flowing natural conversation tone, 2-4 sentences per paragraph — sounds like talking to a friend',
  },
  'long-flowing': {
    profile: 'long-flowing',
    sentenceLengthAvg: [15, 22],
    paragraphLines: [3, 5],
    styleMarkers: ['em-dash-rich', 'comma-rich', 'reflective-flow'],
    instruction:
      'sentences 15-22 words avg, em-dash/comma rich, reflective flowing prose — slightly longer breath',
  },
  'short-clipped': {
    profile: 'short-clipped',
    sentenceLengthAvg: [5, 12],
    paragraphLines: [2, 3],
    styleMarkers: ['emphasis-line', 'sparing-clipped', 'used-with-restraint'],
    instruction:
      'SHORTER sentences (5-12 words) used SPARINGLY — only as emphasis among flowing context. Not fragmented chops.',
  },
  'reflective-pause': {
    profile: 'reflective-pause',
    sentenceLengthAvg: [12, 18],
    paragraphLines: [2, 3],
    styleMarkers: ['interior-monologue', 'occasional-trailing-thought', 'slow-flowing'],
    instruction:
      'flowing interior monologue, 12-18 word sentences, occasional trailing "…" — slow but NOT fragmented',
  },
  'mixed': {
    profile: 'mixed',
    sentenceLengthAvg: [10, 22],
    paragraphLines: [2, 5],
    styleMarkers: ['variance-natural', 'multi-tonal', 'dialogue-OK'],
    instruction:
      'mixed cadence — combine medium-flowing with occasional dialogue/emphasis. NOT fragmented spam.',
  },
}

/** P0.5.4 — Anti-monotony LOOSENED. Adjacent sections with both
 *  'conversational' or both 'long-flowing' are OK if readable. We only
 *  flag if rhythm choice produces unnatural cadence — but cadence is
 *  enforced via prompt instruction, not validator regex.
 *
 *  Validator now informational — doesn't trigger retry. */
export function validateAdjacentRhythms(
  sectionRhythms: Array<{ id: BlockId; rhythm: RhythmProfile }>,
): { valid: boolean; violations: Array<{ a: BlockId; b: BlockId; rhythm: RhythmProfile }> } {
  // Storyselling: we don't punish adjacent same-profile if both flowing.
  // The OUTPUT-side adjacentRhythmDetector still checks actual sentence
  // stats — but config-level rhythm reuse is fine.
  void sectionRhythms
  return { valid: true, violations: [] }
}

/** 1-line instruction for prompt injection per section. */
export function rhythmInstructionFor(profile: RhythmProfile): string {
  return RHYTHM_PROFILES[profile].instruction
}
