// ─────────────────────────────────────────────────────────────────────
// Image Semantics System — public API barrel (P9 image intent layer)
//
// Single entry: deriveImageIntentPage. Output: ImageIntentPage
// (renderer-agnostic, no prompts, no AI sophistication).
// ─────────────────────────────────────────────────────────────────────

// Entry — main derive fns
export { deriveImageIntentPage } from './runtime/deriveImageIntentPage'
export { deriveImageIntent } from './runtime/deriveImageIntent'

// Types
export type {
  RealismLevel,
  FramingStyle,
  ImageEmotionalState,
  CompositionTension,
  PolishLevel,
  SubjectDistance,
  ProofFeel,
  VisualNoise,
  LightingMood,
  ImageRole,
  ImageIntent,
  ImageIntentSection,
  ImageIntentPage,
} from './types'

// Config (read-only — for QA + future prompt builder)
export {
  ROLE_PROFILES,
} from './config/roleProfiles'

export type { RoleProfile } from './config/roleProfiles'

export {
  EMOTION_BY_ENERGY,
  NOISE_BY_TOLERANCE,
  COMPOSITION_BY_COMPRESSION,
  POLISH_BY_BREATHING,
  ROLE_OVERRIDES,
} from './config/intentMaps'

export type { ImageRoleOverride } from './config/intentMaps'

// Validator (standalone — surfaces via deriveImageIntentPage)
export { imageIntentCoherenceDetector } from './validators/imageIntentCoherenceDetector'
