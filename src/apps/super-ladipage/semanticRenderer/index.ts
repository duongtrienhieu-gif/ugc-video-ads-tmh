// ─────────────────────────────────────────────────────────────────────
// Semantic Mobile Renderer — public API barrel (P7 + P8)
// ─────────────────────────────────────────────────────────────────────

// P7: core renderer
export { SemanticMobilePage } from './components/SemanticMobilePage'
export { SemanticSection } from './components/SemanticSection'
export { ProofCallout } from './components/ProofCallout'
export { ImageSlot } from './components/ImageSlot'

// P8: validation loop components
export { SemanticDebugOverlay } from './components/SemanticDebugOverlay'
export { DiagnosticsPanel } from './components/DiagnosticsPanel'
export { TuningPanel } from './components/TuningPanel'

// P14: export workflow components
export { SectionExportActions } from './components/SectionExportActions'
export { ExportPanel } from './components/ExportPanel'

// P16A: session-driven components (status / review / fallback)
export { SectionStatusPill } from './components/SectionStatusPill'
export { SectionReviewActions } from './components/SectionReviewActions'
export { SectionFallback } from './components/SectionFallback'

// INT: observability metrics panel
export { SessionMetricsPanel } from './components/SessionMetricsPanel'

// Types
export type {
  SemanticMobilePageProps,
  SemanticSectionProps,
  SemanticViewMode,
  RegenerateCallbacks,
  SessionCallbacks,
  VisualSemanticsPage,
  VisualSemanticsSection,
} from './types'

// P8: diagnostics (analyzer)
export { scrollDiagnostics } from './diagnostics/scrollDiagnostics'
export type {
  DiagnosticsReport,
  DiagnosticIssue,
  DiagnosticCategory,
  DiagnosticSeverity,
} from './diagnostics/types'

// P8: tuning (transformer)
export { applyTuning } from './tuning/applyTuning'
export { IDENTITY_KNOBS, isIdentityKnobs } from './tuning/types'
export type { TuningKnobs, TuningKnobValue } from './tuning/types'

// Translators (exposed for testing / future renderer variants)
export {
  spacingToMbClass,
  breathingToPyClass,
} from './translators/spacingTranslator'

export {
  headlineClasses,
  paragraphClasses,
  readableMaxWidth,
} from './translators/typographyTranslator'
