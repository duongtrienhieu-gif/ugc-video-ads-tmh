// ═════════════════════════════════════════════════════════════════════
// Image Scene Synthesis — module barrel
// ═════════════════════════════════════════════════════════════════════

export type {
  SceneRendererKey,
  SceneSynthesisInput,
  SceneDescription,
  RouterDecision,
  PageSceneSynthesis,
  ProtagonistVisualContext,
  ProductVisualContext,
  ImageRole,
} from './types'

export {
  decideRouting,
  isAnchorRole,
  getRendererKey,
} from './config/rendererRouting'

export {
  VISUAL_GENRE_SYSTEM_INSTRUCTION,
  ROLE_MICRO_RULES,
  PHASE_MOOD_HINT,
} from './config/storytellingVisualGenre'

export { synthesizeImageScene } from './runtime/synthesizeImageScene'
export { synthesizePageScenes } from './runtime/synthesizePageScenes'
