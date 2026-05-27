// ─────────────────────────────────────────────────────────────────────
// Prompt Translation System — public API barrel (P10)
//
// Single entry: translateImageIntentPage. Output: ImagePromptPage
// with per-section ImagePromptContract (6 fragment buckets).
//
// Renderer-agnostic. Future model adapters consume fragments freely.
// ─────────────────────────────────────────────────────────────────────

// Entry — main translate fns
export { translateImageIntentPage } from './runtime/translateImageIntentPage'
export { translateImageIntent } from './runtime/translateImageIntent'

// Types
export type {
  ImagePromptContract,
  ImagePromptSection,
  ImagePromptPage,
} from './types'

// Config (read-only — for QA + model adapter introspection)
export {
  REALISM_FRAGMENTS_BY_LEVEL,
  REALISM_FRAGMENTS_BY_POLISH,
  COMPOSITION_FRAGMENTS_BY_FRAMING,
  COMPOSITION_FRAGMENTS_BY_TENSION,
  COMPOSITION_FRAGMENTS_BY_DISTANCE,
  ATMOSPHERE_FRAGMENTS_BY_LIGHTING,
  ATMOSPHERE_FRAGMENTS_BY_NOISE,
  ATMOSPHERE_FRAGMENTS_BY_EMOTION,
  PROOF_FRAGMENTS_BY_FEEL,
  ROLE_FRAGMENTS,
} from './config/fragmentMaps'

export {
  GLOBAL_AVOIDANCE_FRAGMENTS,
  ROLE_AVOIDANCE_FRAGMENTS,
  PROOF_AVOIDANCE_FRAGMENTS,
} from './config/avoidanceFragments'

// Validator
export { promptContractValidator } from './validators/promptContractValidator'
