// ─────────────────────────────────────────────────────────────────────
// Product Class — public API barrel
//
// Entry: classifyProductReality(input, keys) → ProductRealityModel
// Brief: buildRealityBrief(model) → Vietnamese prompt block
// Pacing: PACING_OVERRIDES[profile] → resolver override
// ─────────────────────────────────────────────────────────────────────

export { classifyProductReality } from './classifier'
export { buildRealityBrief } from './runtime/buildRealityBrief'

// 2026-05-30 — Cross-validation: catches obvious mismatches between
// niche detection + reality classification (e.g., dental product
// classified as oral-bioactive → forced topical to prevent "từ bên
// trong" framing leak).
export { crossValidateProductReality } from './crossValidate'
export type { CrossValidationResult } from './crossValidate'

// Libraries (exposed for QA / direct lookup)
export { MECHANISM_DESCRIPTIONS } from './libraries/mechanismDescriptions'
export { HERO_TRIGGERS } from './libraries/heroTriggers'
export {
  DISCOVERY_SCENES,
  REALISTIC_DISCOVERY,
  pickRealisticDiscovery,
} from './libraries/discoveryContexts'
export { FAILED_ATTEMPTS } from './libraries/failedAttempts'
export { PACING_OVERRIDES } from './libraries/pacingProfiles'
export type { PacingOverride } from './libraries/pacingProfiles'

// Types
export type {
  ProductForm,
  UsageMode,
  SensationTiming,
  DiscoveryContext,
  ImpulseType,
  MechanismFamily,
  PacingProfile,
  ProductRealityModel,
  ProductClassifierInput,
  ProductClassifierKeys,
} from './types'
