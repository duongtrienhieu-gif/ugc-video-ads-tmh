// ═════════════════════════════════════════════════════════════════════
// Semantic Mobile Renderer — types (P7 + P8 + P14 + P16A)
//
// P7: First UI layer consuming visualSemanticsPage.
// P8: View modes (clean/debug/diagnostics/tuning).
// P14: + 'export' view mode + regenerate callback hooks.
// P16A: + session integration (status pill + review + fallback).
//
// MOBILE-ONLY single-column. Preview-first.
// ═════════════════════════════════════════════════════════════════════

import type { VisualSemanticsPage, VisualSemanticsSection } from '../visualSemantics'
import type {
  LandingSession,
  SectionSessionState,
  ReviewFlag,
} from '../sessionRuntime'

export type { VisualSemanticsPage, VisualSemanticsSection }

/** Validation view modes (P8 + P14). */
export type SemanticViewMode = 'clean' | 'debug' | 'diagnostics' | 'tuning' | 'export'

/** Partial-regeneration callbacks (P14). All optional — parent decides
 *  implementation. P14 ships UI hooks only; consumer wires real execution. */
export interface RegenerateCallbacks {
  onRegenerateImage?: (sectionId: string) => void
  onRegenerateSection?: (sectionId: string) => void
  onRegenerateProof?: (sectionId: string) => void
  onRegenerateCta?: (sectionId: string) => void
}

/** Session-driven callbacks (P16A). Optional — when omitted, review/status
 *  UI is hidden and section renders cleanly. */
export interface SessionCallbacks {
  onApproveSection?: (sectionId: string) => void
  onRejectSection?: (sectionId: string) => void
  onToggleReviewFlag?: (sectionId: string, flag: ReviewFlag) => void
  onRetryFailedSection?: (sectionId: string) => void
}

/** Props for top-level SemanticMobilePage. */
export interface SemanticMobilePageProps extends RegenerateCallbacks, SessionCallbacks {
  page: VisualSemanticsPage
  /** Optional character name for image slot hints. */
  characterName?: string
  /** P16A — optional session state. When provided, status + review UI
   *  becomes available in Debug + Export views. */
  session?: LandingSession
}

/** Props for SemanticSection dispatcher. */
export interface SemanticSectionProps extends RegenerateCallbacks, SessionCallbacks {
  section: VisualSemanticsSection
  characterName?: string
  /** When true, render SemanticDebugOverlay above the section (P8). */
  showDebug?: boolean
  /** When true, render SectionExportActions below the section (P14). */
  showExportActions?: boolean
  /** When true, render SectionStatusPill + SectionReviewActions (P16A). */
  showSessionUI?: boolean
  /** Per-section session state (P16A). Omitted = no session UI rendered. */
  sectionState?: SectionSessionState
}
