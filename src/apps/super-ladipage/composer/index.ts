// ─────────────────────────────────────────────────────────────────────
// Composer System — public API barrel (P4 headless orchestration)
//
// Single entry: composeMobilePage. Output: ComposedPage (render-agnostic).
// ─────────────────────────────────────────────────────────────────────

// Entry — main composer
export { composeMobilePage } from './runtime/composeMobilePage'
export type { ComposeArgs } from './runtime/composeMobilePage'

// Types
export type {
  SectionRole,
  SectionDensity,
  PacingRole,
  ImageRole,
  ScrollWeight,
  SpacingHint,
  InlineProofPiece,
  ComposedSection,
  ComposedPage,
} from './types'

// Config (read-only — exposed for QA/debugging + future renderer)
export {
  COMPOSITION_RULES,
  COMPOSITION_ORDER,
  PROOF_CALLOUT_BLOCK_IDS,
  OPTIONAL_BLOCK_IDS,
  getSectionRoleForBlock,
} from './config/compositionRules'

export {
  DENSITY_PROFILES,
  getDensityProfile,
} from './config/densityProfiles'

export type { DensityProfile } from './config/densityProfiles'

// Runtime helpers (exposed for QA/testing)
export { mergeBlocks } from './runtime/mergeBlocks'
export type { MergedBlocks } from './runtime/mergeBlocks'

export { computeDensity, estimateScrollTime } from './runtime/computeDensity'
export type { DensityMetrics } from './runtime/computeDensity'

export { assignImageRole } from './runtime/assignImageRole'

export { computeTransitionHint } from './runtime/computeTransitions'

// Validator (standalone — not in storytelling runValidators pipeline)
export { scrollFatigueDetector } from './validators/scrollFatigueDetector'
