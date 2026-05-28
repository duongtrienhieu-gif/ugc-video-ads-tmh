// ── Persona Library types (P4) ──────────────────────────────────────────────
//
// Personas are pre-defined "ideal customer / hero" archetypes the
// storytelling engine routes to based on form intent (gut health → Malay
// Muslim mother, vitality → middle-aged father, etc.). A persona seeds
// CharacterMemory so the pack starts coherent even before section 1 renders.

import type { CharacterMemory, RealismLevel } from './continuity'

/** Canonical persona ids — extend via shared/personas/library/. */
export type PersonaId =
  | 'malay_muslim_mother'
  | 'young_office_worker'
  | 'middle_age_father'
  | 'wellness_woman_40s'
  | 'clinical_expert'

/** A persona = display label + seed CharacterMemory + suggested camera + realism. */
export interface Persona {
  id: PersonaId
  /** Vietnamese-first label per Phase 7 i18n convention. */
  label: { vi: string; en: string }
  /** One-line description for routing hints / UI tooltip. */
  description: string
  /** Seed identity — orchestrator uses this as CharacterMemory base. */
  seedMemory: Omit<CharacterMemory, 'id'>
  /** Preferred camera style id (see cameraStyles.ts). */
  preferredCameraStyle: string
  /** Default realism level — overridden by section/intent if needed. */
  defaultRealism: RealismLevel
  /** Free-form intent tags the router matches against form intent. */
  intentTags: string[]
}
