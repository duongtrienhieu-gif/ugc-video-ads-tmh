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
