// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — config barrel (Reader-Immersion architecture)
//
// Single import surface for config layer. Post-rebuild: legacy per-section
// directives (narrativeDynamics / retentionPatterns / pacingOrchestration /
// rhythmEngine / microRealismHooks / tensionReleaseMap / sectionBlueprints)
// were obsolete (narrator-protagonist-arc tuned) and have been deleted.
// New architecture lives in blockPool + per-block samplingHooks.
// ─────────────────────────────────────────────────────────────────────

export { STORYTELLING_DEFAULTS, PACK_LIMITS } from './defaults'
export { NICHE_PRESETS, getNichePreset } from './nicheMap'
export { CONTINUITY_RULES } from './continuityRules'
export { VISUAL_LANGUAGE, SECTION_VISUAL_MAP } from './visualLanguage'
export { PACING_RULES } from './pacingRules'
export { OVERLAY_RULES } from './overlayRules'
export { ANTI_PATTERNS, ANTI_PATTERN_INSTRUCTIONS } from './antiPatterns'

// Reader-Immersion block architecture (replaces SECTION_BLUEPRINTS).
export { BLOCK_POOL, ALL_BLOCK_IDS, blocksForPhase } from './blockPool'

// Chunk C2 Stabilization — niche-domain locks + commercial anchors.
export {
  NICHE_DOMAIN_LOCK,
  getDomainLockForNiche,
  nicheDomainLockBrief,
} from './nicheDomainLock'

export type { NicheDomainLock } from './nicheDomainLock'

export {
  NICHE_MECHANISM_VOCAB,
  sampleMechanismFrame,
  nicheMechanismBrief,
} from './nicheMechanismVocab'

export type { NicheMechanismVocab } from './nicheMechanismVocab'

export {
  NICHE_DESIRE_ARCHITECTURE,
  getDesireForNiche,
  nicheDesireBrief,
} from './nicheDesireArchitecture'

export type { NicheDesireArchitecture } from './nicheDesireArchitecture'

export {
  COMMERCIAL_MEMORY_ANCHORS,
  sampleMemoryAnchor,
  memoryAnchorBrief,
} from './commercialMemoryAnchors'

export type {
  AnchorPosture,
  MemoryAnchorPattern,
} from './commercialMemoryAnchors'

// Chunk D — Phase 3 product integration.
export {
  PRODUCT_DISSOLUTION_PATTERNS,
  sampleDissolutionPattern,
  dissolutionBrief,
} from './productDissolutionPatterns'

export type {
  DissolutionPosture,
  DissolutionPattern,
} from './productDissolutionPatterns'

export {
  SOFT_COMPARE_PATTERNS,
  sampleComparePattern,
  softCompareBrief,
} from './softComparePatterns'

export type {
  ComparePosture,
  ComparePattern,
} from './softComparePatterns'

// Performance Hook Layer (consolidated v5.8+): owns YouFirstOpeners,
// BridgePhrases, HOOK_PATTERNS (block-1 flavor), HOOK_AXES (pack theme).
export {
  YOU_FIRST_OPENERS,
  BRIDGE_PHRASES,
  sampleYouFirstOpener,
  sampleBridgePhrase,
  performanceHookSection1Directive,
  HOOK_PATTERNS,
  HOOK_AXES,
  NICHE_HOOK_AXIS_BIAS,
} from './performanceHookLayer'

export type {
  YouFirstStarter,
  YouFirstOpener,
  BridgePhrase,
  HookPatternSpec,
  HookEmotionalAxis,
  HookAxisSpec,
} from './performanceHookLayer'

export {
  RHYTHM_PROFILES,
  validateAdjacentRhythms,
  rhythmInstructionFor,
} from './rhythmVariance'

export type { RhythmConstraints } from './rhythmVariance'

// Belief shift engine (drives belief-shift block)
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

// Visual role system (Chunk E rebuilds)
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

// Soft CTA patterns (drives future-self-cta block)
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

// Human Variation Engine sampling pools
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

// Memory snapshots
export {
  MEMORY_SNAPSHOTS,
  snapshotsForNiche,
  snapshotsBrief,
  VISUAL_FIRST_WRITING_PROMPT,
} from './memorySnapshots'

// Discovery channels (drives natural-product-discovery block)
export {
  DISCOVERY_CHANNELS,
  discoveryChannelBrief,
} from './discoveryChannels'

export type {
  DiscoveryChannel,
  DiscoveryChannelSpec,
} from './discoveryChannels'

// Visual story coupling (narrator + section visual coherence — Chunk E)
export {
  composeVisualPrompt,
  visualCoherenceSummary,
  VISUAL_COHERENCE_PROMPT,
} from './visualStoryCoupling'

export type {
  VisualPromptFragment,
} from './visualStoryCoupling'
