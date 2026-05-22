// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — rhythm variance config
//
// Per-rhythm-profile cadence constraints. Anti-monotony validator:
// no 2 adjacent sections share rhythm profile.
//
// Runtime prompt builder inject 1-2 dòng compact constraint cho mỗi
// section, KHÔNG dump full table.
// ─────────────────────────────────────────────────────────────────────

import type { RhythmProfile, SectionId } from '../types'

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
  'short-clipped': {
    profile: 'short-clipped',
    sentenceLengthAvg: [5, 9],
    paragraphLines: [1, 2],
    styleMarkers: ['period-heavy', 'frequent-line-breaks', 'declarative'],
    instruction: 'sentences 5-9 words avg, period-heavy, frequent breaks, declarative',
  },
  'long-flowing': {
    profile: 'long-flowing',
    sentenceLengthAvg: [15, 22],
    paragraphLines: [3, 5],
    styleMarkers: ['em-dash-rich', 'comma-rich', 'observational'],
    instruction: 'sentences 15-22 words avg, em-dash/comma rich, observational',
  },
  'fragmented': {
    profile: 'fragmented',
    sentenceLengthAvg: [3, 15],
    paragraphLines: [1, 3],
    styleMarkers: ['repetition-allowed', 'sentence-fragments', 'recurring-pattern'],
    instruction: 'irregular 3-15 words, fragments OK, repetition mimics recurring pain',
  },
  'conversational': {
    profile: 'conversational',
    sentenceLengthAvg: [4, 18],
    paragraphLines: [2, 4],
    styleMarkers: ['rhetorical-questions', 'contractions', 'second-person-asides'],
    instruction: 'rhetorical, contractions OK, occasional "bạn biết...", list-y',
  },
  'reflective-pause': {
    profile: 'reflective-pause',
    sentenceLengthAvg: [10, 16],
    paragraphLines: [2, 3],
    styleMarkers: ['trailing-ellipsis', 'interior-monologue', 'slow-cadence'],
    instruction: 'longer sentences with trailing "…", interior monologue, slow',
  },
  'mixed': {
    profile: 'mixed',
    sentenceLengthAvg: [5, 22],
    paragraphLines: [1, 5],
    styleMarkers: ['variance-high', 'multi-tonal', 'dialogue-OK'],
    instruction: 'high variance — short impact lines + longer descriptions + dialogue',
  },
}

/** Anti-monotony validator: 2 adjacent sections KHÔNG được cùng rhythm. */
export function validateAdjacentRhythms(
  sectionRhythms: Array<{ id: SectionId; rhythm: RhythmProfile }>,
): { valid: boolean; violations: Array<{ a: SectionId; b: SectionId; rhythm: RhythmProfile }> } {
  const violations: Array<{ a: SectionId; b: SectionId; rhythm: RhythmProfile }> = []
  for (let i = 0; i < sectionRhythms.length - 1; i++) {
    const cur = sectionRhythms[i]
    const next = sectionRhythms[i + 1]
    if (cur.rhythm === next.rhythm) {
      violations.push({ a: cur.id, b: next.id, rhythm: cur.rhythm })
    }
  }
  return { valid: violations.length === 0, violations }
}

/** 1-line instruction for prompt injection per section. */
export function rhythmInstructionFor(profile: RhythmProfile): string {
  return RHYTHM_PROFILES[profile].instruction
}
