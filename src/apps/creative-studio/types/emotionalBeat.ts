// ── Emotional Beat Type Contract (P4) ───────────────────────────────────────
//
// An EmotionalBeat is a reusable mood/expression preset that maps a
// photographic shot onto an editorial phase in the UGC narrative arc.
//
// Vocabulary is intentionally aligned with video-builder v2:
//   • EditorialPhase   ← hook / body / education / recovery / cta
//   • ShotEnergy       ← intimate / dynamic / emotional / calm / tension / relief / energetic
//
// Re-declared locally (not imported) because broll-studio MUST NOT cross
// into video-builder per the engine-isolation rule documented in
// ARCHITECTURE.md §"Three engine groups — STRICT isolation". Keeping the
// vocabulary identical lets P9 promote shared types if/when needed.

/** Five-phase editorial arc — same beat ladder used by video-builder v2. */
export type EditorialPhase = 'hook' | 'body' | 'education' | 'recovery' | 'cta'

/** Visual rhythm energy band — same vocabulary as video-builder ShotEnergy. */
export type ShotEnergy =
  | 'intimate'
  | 'dynamic'
  | 'emotional'
  | 'calm'
  | 'tension'
  | 'relief'
  | 'energetic'

/** Reusable mood preset for a single photographic shot. */
export interface EmotionalBeat {
  id: string
  /** UI display label — Vietnamese first per Phase 7 spec. */
  label: { vi: string; en: string }
  /** Editorial phase this beat slots into. */
  phase: EditorialPhase
  /** Shot energy band — drives composition + DOF feel. */
  shotEnergy: ShotEnergy
  /** Mood directive — short paragraph baked into prompt. */
  moodDirective: string
  /** Face expression directive — explicit so KIE does not default to smile. */
  faceExpressionDirective: string
}
