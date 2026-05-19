// ── Character Memory (P4) ──────────────────────────────────────────────────
//
// Builds + seeds the CharacterMemory object that drives identity continuity
// across a multi-section pack. Two sources of truth:
//   1. Avatar bank entry (Model from bankStore) — when modelId is set.
//   2. Persona seed — when no avatar but a persona was routed.
//
// Future: a third source — a Gemini Vision pass on the first generated
// section to extract the real face descriptors. P4 stubs the slot; the
// orchestrator will call extractCharacterMemoryFromImage() in P4.5/P5.

import type { CharacterMemory, RealismLevel } from '../../../types/continuity'
import type { Persona } from '../../../types/persona'

/** Construct a fallback memory when neither avatar nor persona is set. */
export function defaultCharacterMemory(): CharacterMemory {
  return {
    id: 'default',
    gender: 'female',
    ethnicity: 'Southeast Asian',
    ageRange: '28-38',
    skinTone: 'warm medium',
    realismLevel: 'ugc-natural',
  }
}

/** Seed a CharacterMemory from a Persona — used when no avatar is bound. */
export function memoryFromPersona(persona: Persona, id?: string): CharacterMemory {
  return {
    id: id ?? persona.id,
    ...persona.seedMemory,
  }
}

/**
 * Merge two memories — later fields win where defined. Used by the
 * orchestrator to overlay form-specified hints on top of persona seed.
 */
export function mergeMemory(
  base: CharacterMemory,
  overlay: Partial<CharacterMemory>,
): CharacterMemory {
  return {
    ...base,
    ...overlay,
    // Arrays merge by replace, not concat — overlay wins entirely.
    outfitPalette: overlay.outfitPalette ?? base.outfitPalette,
  }
}

/**
 * Build a [CHARACTER MEMORY] prompt block. Embedded into every locked-
 * continuity section so KIE keeps face / ethnicity / hijab consistent.
 */
export function buildCharacterMemoryBlock(memory: CharacterMemory): string {
  const lines: string[] = []
  lines.push(`Identity lock — same individual across the entire pack.`)
  lines.push(`Gender: ${memory.gender}. Ethnicity: ${memory.ethnicity}. Age: ${memory.ageRange}.`)
  if (memory.faceShape)  lines.push(`Face shape: ${memory.faceShape}.`)
  if (memory.skinTone)   lines.push(`Skin tone: ${memory.skinTone}.`)
  if (memory.hijabStyle) lines.push(`Hijab: ${memory.hijabStyle}. Hijab MUST remain consistent — no removal, no switching to a different style.`)
  else if (memory.hairStyle) lines.push(`Hair: ${memory.hairStyle}.`)
  if (memory.bodyType)   lines.push(`Build: ${memory.bodyType}.`)
  return `[CHARACTER MEMORY]\n${lines.join(' ')}`
}

/** Decide a realism level given memory + a section-specific hint. */
export function resolveRealism(
  memory: CharacterMemory,
  override?: RealismLevel,
): RealismLevel {
  return override ?? memory.realismLevel
}
