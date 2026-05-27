// ─────────────────────────────────────────────────────────────────────
// Prompt Translation — public API barrel (POST-REBUILD slim)
//
// Fragment-stacking pipeline deleted. Only the page-level pass-through
// remains to preserve the subtype chain (ImagePromptPage feeds
// rendererAdapters / orchestration / exportPipeline).
// ─────────────────────────────────────────────────────────────────────

export { translateImageIntentPage } from './runtime/translateImageIntentPage'

export type {
  ImagePromptContract,
  ImagePromptSection,
  ImagePromptPage,
} from './types'
