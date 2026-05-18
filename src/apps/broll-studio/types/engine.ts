// ── Creative Studio — Engine Group Type System (Phase 2 scaffold) ──────────
//
// Three engine groups. Each group has a fundamentally different rendering
// pipeline. Cross-group import is FORBIDDEN at the architecture level —
// folder boundaries enforce this convention (engines/photographic/* MUST
// NOT import from engines/ui-native/*, and vice versa).
//
// P2 = type contracts only. NO logic, NO modules attached to these groups
// yet. P3 will start populating engines/photographic/.

/**
 * Engine group identifier — every asset module declares which group it
 * belongs to via its `engineGroup` field. The orchestrator dispatches
 * based on this value.
 *
 * - 'photographic'      → AI image generation (KIE GPT-4o), full-image render
 * - 'ui-native'         → Mobile UI screenshot simulation (canvas template
 *                         + atomic AI assets + post-process compression)
 * - 'designed-graphic'  → Layout / poster / infographic / banner generation
 *                         (canvas + AI for image regions)
 */
export type EngineGroup =
  | 'photographic'
  | 'ui-native'
  | 'designed-graphic'

/**
 * Pipeline characteristics per engine group. Documented here for clarity;
 * each group module enforces its own subset of these in its contract.
 */
export interface EngineGroupCharacteristics {
  /** Primary backend the engine talks to */
  primaryBackend: 'kie-gpt4o' | 'canvas-only' | 'canvas+kie-atomic'
  /** Whether output is a single image or a composed pipeline result */
  outputMode: 'single-image' | 'composed-canvas' | 'designed-layout'
  /** Whether reference images are part of the contract */
  usesReferenceImages: 'product+avatar' | 'reference-screenshot' | 'design-system'
  /** Quality lever — what carries the bulk of output quality for this group */
  qualityLever: 'prompt' | 'template+reference-library' | 'design-system+typography'
}

/** Characteristics map — read-only metadata for tooling / debug panels. */
export const ENGINE_GROUP_CHARACTERISTICS: Record<EngineGroup, EngineGroupCharacteristics> = {
  'photographic': {
    primaryBackend: 'kie-gpt4o',
    outputMode: 'single-image',
    usesReferenceImages: 'product+avatar',
    qualityLever: 'prompt',
  },
  'ui-native': {
    primaryBackend: 'canvas+kie-atomic',
    outputMode: 'composed-canvas',
    usesReferenceImages: 'reference-screenshot',
    qualityLever: 'template+reference-library',
  },
  'designed-graphic': {
    primaryBackend: 'canvas+kie-atomic',
    outputMode: 'designed-layout',
    usesReferenceImages: 'design-system',
    qualityLever: 'design-system+typography',
  },
} as const
