// ─────────────────────────────────────────────────────────────────────
// Ladipage Adapter — public API barrel (P16A)
//
// Single entry: adaptToLadipage(exportablePage). Output: LadipageExportBundle
// with per-section template + text + image + layout payload.
//
// Serializers convert bundle → clipboard HTML or downloadable JSON.
// NO autonomous redesign. NO hidden mutation. Translation layer only.
// ─────────────────────────────────────────────────────────────────────

// Entry
export { adaptToLadipage } from './runtime/adaptToLadipage'
export type { AdaptToLadipageOptions } from './runtime/adaptToLadipage'

// Serializers
export {
  serializeBundleHtml,
  serializeSectionHtml,
} from './serializers/htmlFragmentSerializer'
export { serializeBundleJson } from './serializers/ladipageBundleJsonSerializer'

// Config
export { selectLadipageTemplate } from './config/templateMap'
export { buildHtmlFragment } from './config/htmlFragmentTemplates'

// Types
export type {
  LadipageTemplateName,
  LadipageSectionTextPayload,
  LadipageSectionImagePayload,
  LadipageSectionLayout,
  LadipageSection,
  LadipageExportBundle,
  ExportableSection,
  ExportablePage,
} from './types'
