// ─────────────────────────────────────────────────────────────────────
// Render Contract System — public API barrel (P5 mobile rendering intelligence)
//
// Single entry: deriveRenderContractedPage. Output: RenderContractedPage
// (renderer-agnostic).
// ─────────────────────────────────────────────────────────────────────

// Entry — main derive fn
export { deriveRenderContractedPage } from './runtime/deriveRenderContractedPage'
export { deriveRenderContract } from './runtime/deriveRenderContract'

// Helpers (exposed for testing / future renderer consumers)
export { computeProofPresentation } from './runtime/computeProofPresentation'
export { computeCtaPlacement } from './runtime/computeCtaPlacement'

// Types
export type {
  LayoutType,
  MobilePattern,
  ImageAspectRatio,
  TextChunking,
  TypographyDominance,
  ProofPresentation,
  CtaPlacement,
  SpacingPreset,
  VisualEnergy,
  RenderContract,
  RenderContractedSection,
  RenderContractedPage,
} from './types'

// Config (read-only — for QA + future renderer consumption)
export {
  LAYOUT_PATTERN_DEFAULTS,
  getLayoutPattern,
} from './config/layoutPatterns'

export type { LayoutPattern } from './config/layoutPatterns'

export {
  IMAGE_SPECS,
  getImageSpec,
} from './config/imageSpecs'

export type { ImageSpec } from './config/imageSpecs'

export {
  deriveTypographySpec,
} from './config/typographySpecs'

export type { TypographySpec } from './config/typographySpecs'

export {
  VISUAL_ENERGY_MAP,
  getVisualEnergy,
} from './config/visualEnergyMap'

export type { EnergyEntry } from './config/visualEnergyMap'

// Validator (standalone — surfaces warnings via deriveRenderContractedPage)
export { renderContractConsistencyDetector } from './validators/renderContractConsistencyDetector'
