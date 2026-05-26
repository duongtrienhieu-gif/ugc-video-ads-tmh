// ─────────────────────────────────────────────────────────────────────
// Visual Semantics System — public API barrel (P6 visual psychology)
//
// Single entry: deriveVisualSemanticsPage. Output: VisualSemanticsPage
// (renderer-agnostic, implementation-free).
// ─────────────────────────────────────────────────────────────────────

// Entry — main derive fn
export { deriveVisualSemanticsPage } from './runtime/deriveVisualSemanticsPage'
export { deriveVisualSemantics } from './runtime/deriveVisualSemantics'

// Types
export type {
  VisualHierarchy,
  EyeFlow,
  ReadingTempo,
  SectionBreathing,
  EmotionalCompression,
  VisualNoiseTolerance,
  ProofWeight,
  CtaAggression,
  VisualSemantics,
  VisualSemanticsSection,
  VisualSemanticsPage,
} from './types'

// Config (read-only — for QA + future renderer)
export {
  HIERARCHY_BY_DOMINANCE,
  hierarchyOverrideForPattern,
  EYEFLOW_BY_LAYOUT,
  eyeFlowOverrideForPattern,
  TEMPO_BY_PATTERN,
  BREATHING_BY_SPACING,
  COMPRESSION_BY_ENERGY,
  NOISE_BY_PATTERN,
  PROOF_WEIGHT_BY_PRESENTATION,
  CTA_AGGRESSION_BY_PLACEMENT,
  PSYCHOLOGY_NOTE_BY_PATTERN,
} from './config/semanticMaps'

// Validator (standalone — surfaces via deriveVisualSemanticsPage)
export { visualSemanticsCoherenceDetector } from './validators/visualSemanticsCoherenceDetector'
