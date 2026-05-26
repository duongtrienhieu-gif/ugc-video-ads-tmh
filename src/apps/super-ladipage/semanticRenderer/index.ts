// ─────────────────────────────────────────────────────────────────────
// Semantic Mobile Renderer — public API barrel (P7)
// ─────────────────────────────────────────────────────────────────────

export { SemanticMobilePage } from './components/SemanticMobilePage'
export { SemanticSection } from './components/SemanticSection'
export { ProofCallout } from './components/ProofCallout'
export { ImageSlot } from './components/ImageSlot'

export type {
  SemanticMobilePageProps,
  SemanticSectionProps,
  VisualSemanticsPage,
  VisualSemanticsSection,
} from './types'

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
