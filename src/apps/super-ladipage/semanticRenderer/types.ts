// ═════════════════════════════════════════════════════════════════════
// Semantic Mobile Renderer — types (P7 + P8 + P14)
//
// P7: First UI layer consuming visualSemanticsPage. UGLY-BUT-CORRECT.
// P8: View modes (clean/debug/diagnostics/tuning) for validation loop.
// P14: + 'export' view mode + regenerate callback hooks.
//
// MOBILE-ONLY single-column. No desktop responsiveness. No multi-column.
// Preview-first validation phase. Marketer remains layout controller.
// ═════════════════════════════════════════════════════════════════════

import type { VisualSemanticsPage, VisualSemanticsSection } from '../visualSemantics'

export type { VisualSemanticsPage, VisualSemanticsSection }

/** Validation view modes (P8 + P14). */
export type SemanticViewMode = 'clean' | 'debug' | 'diagnostics' | 'tuning' | 'export'

/** Partial-regeneration callbacks (P14). All optional — parent decides
 *  implementation. P14 ships UI hooks only; consumer wires real execution. */
export interface RegenerateCallbacks {
  onRegenerateImage?: (sectionId: string) => void
  onRegenerateSection?: (sectionId: string) => void
  onRegenerateProof?: (sectionId: string) => void
}

/** Props for top-level SemanticMobilePage. */
export interface SemanticMobilePageProps extends RegenerateCallbacks {
  page: VisualSemanticsPage
  /** Optional character name for image slot hints. */
  characterName?: string
}

/** Props for SemanticSection dispatcher. */
export interface SemanticSectionProps extends RegenerateCallbacks {
  section: VisualSemanticsSection
  characterName?: string
  /** When true, render SemanticDebugOverlay above the section (P8). */
  showDebug?: boolean
  /** When true, render SectionExportActions below the section (P14). */
  showExportActions?: boolean
}
