// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — config barrel
//
// Single import surface cho mọi consumer của config layer:
//   import { SECTION_BLUEPRINTS, CONTINUITY_RULES, ... } from '../config'
// ─────────────────────────────────────────────────────────────────────

export { STORYTELLING_DEFAULTS, PACK_LIMITS } from './defaults'
export { SECTION_BLUEPRINTS, DEFAULT_SECTION_ORDER } from './sectionBlueprints'
export { NICHE_PRESETS, getNichePreset } from './nicheMap'
export { CONTINUITY_RULES } from './continuityRules'
export { VISUAL_LANGUAGE, SECTION_VISUAL_MAP } from './visualLanguage'
export { PACING_RULES } from './pacingRules'
export { OVERLAY_RULES } from './overlayRules'
export { ANTI_PATTERNS, ANTI_PATTERN_INSTRUCTIONS } from './antiPatterns'

// v4 narrative dynamics layer
export {
  NARRATIVE_ROLE_INSTRUCTIONS,
  EMOTIONAL_FUNCTION_INSTRUCTIONS,
  CURIOSITY_MECHANIC_INSTRUCTIONS,
  TRANSITION_PSYCHOLOGY_INSTRUCTIONS,
  composeDynamicsDirective,
} from './narrativeDynamics'

export {
  HOOK_PATTERNS,
  BANNED_HOOK_PATTERNS,
  HOOK_ENFORCEMENT_PROMPT,
  HOOK_REQUIRED_SECTIONS,
} from './narrativeHooks'

export type { HookPatternSpec } from './narrativeHooks'

export {
  TENSION_CURVE,
  detectFlatLine,
  detectSpike,
  renderTensionAscii,
} from './tensionReleaseMap'

export {
  RHYTHM_PROFILES,
  validateAdjacentRhythms,
  rhythmInstructionFor,
} from './rhythmVariance'

export type { RhythmConstraints } from './rhythmVariance'

export {
  RETENTION_MECHANICS,
  BANNED_RETENTION_PATTERNS,
  RETENTION_RESTRAINT_PROMPT,
  retentionInstructionFor,
} from './retentionPatterns'

export type { RetentionMechanicSpec } from './retentionPatterns'

// v4.2 — Belief shift engine
export {
  BELIEF_SHIFT_CATALYSTS,
  NICHE_REFRAME_EXAMPLES,
  PERMISSION_PATTERNS,
  BELIEF_SHIFT_PROMPT,
  getReframeForNiche,
} from './beliefShiftEngine'

export type {
  BeliefShiftCatalystType,
  BeliefShiftCatalystSpec,
  BeliefShiftReframe,
  BeliefShiftPermission,
} from './beliefShiftEngine'

// v4.3 — Visual role system
export {
  IMAGE_PURPOSE_ROLES,
  imagePurposeRoleInstruction,
  NECESSITY_TEST_PROMPT,
} from './imagePurposeRoles'

export type {
  ImagePurposeRoleSpec,
} from './imagePurposeRoles'

export {
  CAMERA_LANGUAGES,
  CAMERA_LANGUAGE_BY_BEAT,
  cameraLanguageInstruction,
  CAMERA_ANTI_DRIFT_PROMPT,
} from './cameraLanguage'

export type {
  CameraLanguageSpec,
} from './cameraLanguage'

// v4.4 — Micro-realism injector
export {
  MICRO_REALISM_HOOKS,
  SECTION_MICRO_REALISM_MAP,
  MICRO_REALISM_PROMPT,
  microRealismDirectiveFor,
} from './microRealismHooks'

export type {
  MicroRealismCategory,
  MicroRealismDetailSet,
} from './microRealismHooks'

// v4.5 — Soft CTA patterns
export {
  SOFT_CTA_TONES,
  SOFT_CTA_BANNED_PATTERNS,
  SOFT_CTA_PROMPT,
  buildSoftCtaDirective,
} from './softCtaPatterns'

export type {
  SoftCtaTone,
  SoftCtaToneSpec,
} from './softCtaPatterns'

// v4.6 — Pacing orchestration
export {
  PACING_CLASSES,
  SECTION_PACING_MAP,
  pacingClassDirective,
  validatePacingVariety,
} from './pacingOrchestration'

export type {
  PacingClassSpec,
} from './pacingOrchestration'

// v5.1 — Human Variation Engine (P0.6)
export {
  NARRATOR_ARCHETYPES,
  archetypesForNiche,
  narratorBrief,
} from './narratorArchetypes'

export {
  PERSONA_EMOTIONAL_DNA,
  getEmotionalDnaForNiche,
  emotionalDnaBrief,
} from './personaEmotionalDNA'

export {
  ENERGY_CURVE_PRESETS,
  getEnergyCurvePreset,
  energyCurveBrief,
} from './energyCurvePresets'

// v5.2 — Memory snapshots + Visual-First Writing
export {
  MEMORY_SNAPSHOTS,
  snapshotsForNiche,
  snapshotsBrief,
  VISUAL_FIRST_WRITING_PROMPT,
} from './memorySnapshots'
