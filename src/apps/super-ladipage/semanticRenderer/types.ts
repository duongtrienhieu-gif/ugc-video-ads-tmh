// ═════════════════════════════════════════════════════════════════════
// Semantic Mobile Renderer — types (P7 + P8)
//
// P7: First UI layer consuming visualSemanticsPage. UGLY-BUT-CORRECT.
// P8: View modes (clean/debug/diagnostics/tuning) for validation loop.
//
// MOBILE-ONLY single-column. No desktop responsiveness. No multi-column.
// No export. Preview-first validation phase.
// ═════════════════════════════════════════════════════════════════════

import type { VisualSemanticsPage, VisualSemanticsSection } from '../visualSemantics'

export type { VisualSemanticsPage, VisualSemanticsSection }

/** Validation view modes (P8). */
export type SemanticViewMode = 'clean' | 'debug' | 'diagnostics' | 'tuning'

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
  /** When true, render SemanticDebugOverlay above the section (P8). */
  showDebug?: boolean
}
