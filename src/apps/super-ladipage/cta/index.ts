// ─────────────────────────────────────────────────────────────────────
// CTA System — public API barrel (P3 lightweight orchestration)
//
// ADDITIVE to storytelling LOCK. Consumer (storytelling buildPackGenPrompt
// + selectNarratorDna) imports sampleCtaFlow + buildCtaMomentsBrief from
// this barrel. No deep coupling.
// ─────────────────────────────────────────────────────────────────────

// Runtime entry
export { sampleCtaFlow } from './runtime/sampleCtaFlow'
export { buildCtaMomentsBrief } from './runtime/buildCtaMoments'

// Validator (soft)
export { aggressiveSalesDetector } from './validators/aggressiveSalesDetector'

// Types
export type {
  CtaMomentType,
  CtaEnergyModeId,
  CtaEnergyMode,
  CtaPattern,
  CtaFlow,
} from './types'

// Config (read-only data — for QA/debugging)
export {
  CTA_ENERGY_MODES,
  getCtaModeForNiche,
  getCtaModeId,
} from './config/ctaModes'

export {
  MICRO_COMMITMENT_PATTERNS,
  sampleMicroCommitments,
} from './config/microCommitmentPatterns'

export {
  FRICTION_REDUCTION_PATTERNS,
  sampleFrictionReduction,
} from './config/frictionReductionPatterns'

export {
  REASSURANCE_PATTERNS,
  sampleReassurance,
} from './config/reassurancePatterns'

export {
  URGENCY_TEXTURES,
  sampleUrgencyTexture,
} from './config/urgencyTextures'
