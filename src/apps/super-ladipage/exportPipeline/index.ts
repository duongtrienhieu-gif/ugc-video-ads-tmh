// ─────────────────────────────────────────────────────────────────────
// Export Pipeline — public API barrel (P14)
//
// Single entry: deriveExportPipelinePage. Output: ExportablePage with
// per-section ExportGuide. Serializers consume ExportablePage.
// ─────────────────────────────────────────────────────────────────────

// Entry
export { deriveExportPipelinePage } from './runtime/deriveExportPipelinePage'
export { deriveExportGuide } from './runtime/deriveExportGuide'

// Serializers
export { serializeToMarkdown } from './serializers/markdownSerializer'
export type { MarkdownExportOptions } from './serializers/markdownSerializer'
export { serializeToJson, serializeToJsonString } from './serializers/jsonSerializer'
export type { JsonExportPayload, JsonExportSection } from './serializers/jsonSerializer'
export { serializeToLadipageGuidance } from './serializers/ladipageGuidanceSerializer'

// Config (read-only — for QA / direct lookup)
export {
  PADDING_BY_SPACING,
  SPACING_BY_SPACING,
  TEXT_WIDTH_BY_CHUNKING,
  PROOF_STYLE_BY_PRESENTATION,
  isStickyCtaRecommended,
} from './config/exportGuideMap'

// Types
export type {
  SuggestedPadding,
  TextWidthMode,
  RecommendedSpacing,
  ProofStyle,
  ExportGuide,
  ExportableSection,
  ExportablePage,
} from './types'
