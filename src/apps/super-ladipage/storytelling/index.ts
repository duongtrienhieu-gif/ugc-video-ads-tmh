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
  // v4 narrative dynamics types
  NarrativeRole,
  EmotionalFunction,
  CuriosityMechanic,
  RhythmProfile,
  TransitionPsychology,
  HookPattern,
  RetentionMechanic,
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
  // v4 narrative dynamics layer
  NARRATIVE_ROLE_INSTRUCTIONS,
  EMOTIONAL_FUNCTION_INSTRUCTIONS,
  CURIOSITY_MECHANIC_INSTRUCTIONS,
  TRANSITION_PSYCHOLOGY_INSTRUCTIONS,
  composeDynamicsDirective,
  HOOK_PATTERNS, BANNED_HOOK_PATTERNS,
  HOOK_ENFORCEMENT_PROMPT, HOOK_REQUIRED_SECTIONS,
  TENSION_CURVE, detectFlatLine, detectSpike, renderTensionAscii,
  RHYTHM_PROFILES, validateAdjacentRhythms, rhythmInstructionFor,
  RETENTION_MECHANICS, BANNED_RETENTION_PATTERNS,
  RETENTION_RESTRAINT_PROMPT, retentionInstructionFor,
} from './config'

// Resolvers (pure mapping functions — P2/P3 will expand)
export { resolveStorytellingInput } from './resolvers/resolveStorytellingInput'
export { resolveProtagonistProfile } from './resolvers/resolveProtagonistProfile'
export { resolveSectionPlan } from './resolvers/resolveSectionPlan'
