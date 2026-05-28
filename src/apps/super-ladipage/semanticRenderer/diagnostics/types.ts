// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — Diagnostics types (P8 validation loop)
//
// Aggregate scroll-level diagnostics complementing per-page validators:
//   - heavy section clustering
//   - proof clustering
//   - visual monotony (eyeFlow / mobilePattern / visualEnergy)
//   - CTA overexposure
//   - breathing collapse
//   - fatigue spikes (consecutive compressed-tension)
//
// READ-ONLY. No new derivation logic — pure observation of existing
// VisualSemanticsPage data.
// ─────────────────────────────────────────────────────────────────────

export type DiagnosticCategory =
  | 'heavy-clustering'
  | 'proof-clustering'
  | 'visual-monotony'
  | 'cta-overexposure'
  | 'breathing-collapse'
  | 'fatigue-spike'

export type DiagnosticSeverity = 'info' | 'warn' | 'critical'

export interface DiagnosticIssue {
  category: DiagnosticCategory
  severity: DiagnosticSeverity
  /** Human-readable message describing the issue. */
  message: string
  /** Section IDs implicated by this issue (renderer can highlight). */
  affectedSectionIds: string[]
}

export interface DiagnosticsReport {
  issues: DiagnosticIssue[]
  /** Counts per category — quick scan summary. */
  countsByCategory: Record<DiagnosticCategory, number>
  /** Counts per severity. */
  countsBySeverity: Record<DiagnosticSeverity, number>
  /** Total issue count. */
  totalIssues: number
}
