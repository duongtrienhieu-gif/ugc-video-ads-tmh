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
