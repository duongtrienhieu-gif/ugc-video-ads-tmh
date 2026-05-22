// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — public API barrel
//
// Sandbox riêng cho form 'advertorial' ("Kể Chuyện Hành Trình").
// Consumer chỉ cần import từ đây — không cần biết internal structure.
// ─────────────────────────────────────────────────────────────────────

// Entry point — service (P0.5 = mock, P2+ = real)
export { generateStorytellingPack } from './services/generateStorytellingPack'

// Types (re-export so consumers chỉ cần 1 import path)
export type {
  StorytellingInput,
  StorytellingPack,
  StorytellingMeta,
  ProtagonistProfile,
  SectionBlueprint,
  SectionPlan,
  SectionId,
  NicheKey,
  EmotionalIntensity,
  PacingType,
  ProductRevealSection,
} from './types'

export { isStorytellingPack } from './types'

// Config (read-only data layer — exposed for QA/debugging)
export {
  STORYTELLING_DEFAULTS, PACK_LIMITS,
  SECTION_BLUEPRINTS, DEFAULT_SECTION_ORDER,
  NICHE_PRESETS, getNichePreset,
  CONTINUITY_RULES,
  VISUAL_LANGUAGE, SECTION_VISUAL_MAP,
  PACING_RULES,
  OVERLAY_RULES,
  ANTI_PATTERNS, ANTI_PATTERN_INSTRUCTIONS,
} from './config'

// Resolvers (pure mapping functions — P2/P3 will expand)
export { resolveStorytellingInput } from './resolvers/resolveStorytellingInput'
export { resolveProtagonistProfile } from './resolvers/resolveProtagonistProfile'
export { resolveSectionPlan } from './resolvers/resolveSectionPlan'
