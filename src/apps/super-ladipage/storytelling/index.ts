// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — public API barrel (Reader-Immersion architecture)
//
// Sandbox riêng cho form 'advertorial' ("Kể Chuyện Hành Trình").
// Consumer chỉ cần import từ đây — không cần biết internal structure.
// ─────────────────────────────────────────────────────────────────────

// Entry point — service
export { generateStorytellingPack } from './services/generateStorytellingPack'

// Types (re-export so consumers chỉ cần 1 import path)
export type {
  StorytellingInput,
  StorytellingPack,
  StorytellingMeta,
  SectionGenStatus,
  ProtagonistProfile,
  NicheKey,
  EmotionalIntensity,
  PacingType,
  ProductRevealSection,
  // Hook + visual + variation types still referenced by consumers
  HookPattern,
  ImagePurposeRole,
  CameraLanguage,
  SocialContext,
  NarratorArchetype,
  PersonaEmotionalDNA,
  EnergyCurveId,
  EnergyCurvePreset,
  MemorySnapshot,
  MemorySnapshotState,
  // Reader-Immersion block architecture (post-v5.8 rebuild)
  Phase,
  YouIBalance,
  PsychologicalFunction,
  BlockId,
  BlockBlueprint,
  BlockPlan,
  BlockSamplingHooks,
} from './types'

export { isStorytellingPack } from './types'

// Runtime + validators (exposed for QA / future tooling)
export { runValidators, logValidationResult } from './validators'
export type { ValidatorName, AggregatedValidation } from './validators'

export { FALLBACK_COPY } from './runtime/fallbackCopy'

// Config (read-only data layer — exposed for QA/debugging)
export {
  STORYTELLING_DEFAULTS, PACK_LIMITS,
  NICHE_PRESETS, getNichePreset,
  CONTINUITY_RULES,
  VISUAL_LANGUAGE, SECTION_VISUAL_MAP,
  PACING_RULES,
  OVERLAY_RULES,
  ANTI_PATTERNS, ANTI_PATTERN_INSTRUCTIONS,
  // Reader-Immersion block architecture
  BLOCK_POOL, ALL_BLOCK_IDS, blocksForPhase,
  // Performance Hook Layer (consolidated)
  YOU_FIRST_OPENERS, BRIDGE_PHRASES,
  sampleYouFirstOpener, sampleBridgePhrase,
  performanceHookSection1Directive,
  HOOK_PATTERNS, HOOK_AXES, NICHE_HOOK_AXIS_BIAS,
  // Rhythm variance validator
  RHYTHM_PROFILES, validateAdjacentRhythms, rhythmInstructionFor,
  // Belief shift engine (drives belief-shift block)
  BELIEF_SHIFT_CATALYSTS, NICHE_REFRAME_EXAMPLES,
  PERMISSION_PATTERNS, BELIEF_SHIFT_PROMPT, getReframeForNiche,
  // Visual role system (Chunk E rebuilds)
  IMAGE_PURPOSE_ROLES, imagePurposeRoleInstruction, NECESSITY_TEST_PROMPT,
  CAMERA_LANGUAGES, CAMERA_LANGUAGE_BY_BEAT,
  cameraLanguageInstruction, CAMERA_ANTI_DRIFT_PROMPT,
  // Soft CTA patterns (drives future-self-cta block)
  SOFT_CTA_TONES, SOFT_CTA_BANNED_PATTERNS,
  SOFT_CTA_PROMPT, buildSoftCtaDirective,
  // Human Variation Engine sampling pools
  NARRATOR_ARCHETYPES, archetypesForNiche, narratorBrief,
  PERSONA_EMOTIONAL_DNA, getEmotionalDnaForNiche, emotionalDnaBrief,
  ENERGY_CURVE_PRESETS, getEnergyCurvePreset, energyCurveBrief,
  // Memory snapshots
  MEMORY_SNAPSHOTS, snapshotsForNiche, snapshotsBrief,
  VISUAL_FIRST_WRITING_PROMPT,
  // Discovery channels (drives natural-product-discovery block)
  DISCOVERY_CHANNELS, discoveryChannelBrief,
  // Visual story coupling
  composeVisualPrompt, visualCoherenceSummary, VISUAL_COHERENCE_PROMPT,
} from './config'

// Selector resolver
export { selectNarratorDna, verifyNicheCoverage } from './runtime/selectNarratorDna'
export type { NarratorDnaSelection } from './runtime/selectNarratorDna'

// Resolvers (pure mapping functions)
export { resolveStorytellingInput } from './resolvers/resolveStorytellingInput'
export { resolveProtagonistProfile } from './resolvers/resolveProtagonistProfile'
export { resolveBlockPlan } from './resolvers/resolveBlockPlan'
