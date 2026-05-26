// ═════════════════════════════════════════════════════════════════════
// Semantic Mobile Renderer — types (P7 first visible renderer)
//
// First UI layer consuming visualSemanticsPage. Intentionally
// UGLY-BUT-CORRECT — proves scroll rhythm + emotional flow work,
// not pixel polish.
//
// MOBILE-ONLY single-column. No desktop responsiveness. No multi-column.
// No export. Preview-first validation phase.
// ═════════════════════════════════════════════════════════════════════

import type { VisualSemanticsPage, VisualSemanticsSection } from '../visualSemantics'

export type { VisualSemanticsPage, VisualSemanticsSection }

/** Props for top-level SemanticMobilePage. */
export interface SemanticMobilePageProps {
  page: VisualSemanticsPage
  /** Optional character name for image slot hints. */
  characterName?: string
}

/** Props for SemanticSection dispatcher. */
export interface SemanticSectionProps {
  section: VisualSemanticsSection
  characterName?: string
}
