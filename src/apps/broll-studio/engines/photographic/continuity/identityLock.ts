// ── Identity Lock (P4) ─────────────────────────────────────────────────────
//
// At LOCKED continuity, every section must reuse the hero face. Identity
// lock builds the prompt instruction that tells KIE "the person in
// reference image N is the SAME individual as in earlier sections" and
// hardens the negative prompt against ethnicity drift / hijab swaps /
// random male injection.

import type { CharacterMemory, ContinuityLevel } from '../../../types/continuity'

export const IDENTITY_LOCK_NEGATIVES: readonly string[] = [
  'different person',
  'face swap',
  'ethnicity drift',
  'changed face shape',
  'hijab removed',
  'hijab style swap',
  'random male appearing in female scene',
  'random female appearing in male scene',
  'plastic surgery look',
  'younger / older than specified age range',
] as const

/**
 * Build the [IDENTITY LOCK] prompt block. Returns empty string when
 * continuityLevel === 'NONE' (each render free to vary).
 */
export function buildIdentityLockBlock(
  memory: CharacterMemory | undefined,
  level: ContinuityLevel,
): string {
  if (!memory || level === 'NONE') return ''
  if (level === 'SOFT') {
    return `[IDENTITY LOCK — SOFT]\nPreserve the persona vibe: ${memory.gender}, ${memory.ethnicity}, age ${memory.ageRange}. Face does not need pixel-perfect match but ethnicity and demographic identity MUST be preserved.`
  }
  // LOCKED
  return `[IDENTITY LOCK — STRICT]\nThis MUST be the SAME individual as in the avatar reference. Pixel-faithful face — same bone structure, same skin tone, same demographic identity. ${memory.hijabStyle ? `Hijab must remain present and in the same style (${memory.hijabStyle}).` : ''} No face swap, no ethnicity drift, no age drift.`
}

/** Append identity-lock negatives to a base negative list. */
export function appendIdentityNegatives(base: string[]): string[] {
  return [...base, ...IDENTITY_LOCK_NEGATIVES]
}
