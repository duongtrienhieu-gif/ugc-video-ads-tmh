// ─────────────────────────────────────────────────────────────────────
// Image Semantics — public API barrel (POST-REBUILD)
//
// Slimmed entry. The 9-axis intent layer was deleted; image prompts now
// come from imageSceneSynthesis. This module only carries imageRole +
// intentNote through the pipeline for planning + reference selection.
// ─────────────────────────────────────────────────────────────────────

export { deriveImageIntentPage } from './runtime/deriveImageIntentPage'

export type {
  ImageRole,
  ImageIntent,
  ImageIntentSection,
  ImageIntentPage,
} from './types'
