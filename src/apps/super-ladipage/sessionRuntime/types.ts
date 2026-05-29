// ═════════════════════════════════════════════════════════════════════
// Session Runtime — type definitions (P16A productization)
//
// Persistent landing session: tracks per-section regen state, history
// snapshots, review actions, observability metrics, tuning state.
//
// LOCKED: NO autonomous mutation. State changes only via explicit
// updateSectionState / snapshotHistory calls. Snapshots are
// append-only for rollback safety.
// ═════════════════════════════════════════════════════════════════════

import type { TuningKnobs } from '../semanticRenderer'
import type { ExportablePage } from '../exportPipeline'

// ─── Per-section regen lifecycle ───────────────────────────────────

export type SectionRegenStatus =
  | 'idle'         // ready, no regen pending
  | 'queued'       // regen requested, awaiting executor
  | 'generating'   // executor in progress
  | 'completed'    // regen succeeded
  | 'failed'       // regen failed, allow retry
  | 'rejected'     // user rejected output, awaiting re-action

export type SectionRegenTarget =
  | 'image'
  | 'section'
  | 'proof'
  | 'cta'

// ─── Review actions per section ────────────────────────────────────

export type ReviewVerdict = 'pending' | 'approved' | 'rejected'

export type ReviewFlag =
  | 'realism-drift'
  | 'polish-drift'
  | 'fake-feel'
  | 'off-brand'
  | 'broken-image'
  | 'other'

export interface SectionReviewState {
  verdict: ReviewVerdict
  flags: ReviewFlag[]
  /** Optional marketer note. */
  note?: string
  /** ISO timestamp of last review action. */
  lastReviewedAt?: string
}

// ─── Per-section session state ─────────────────────────────────────

export interface SectionSessionState {
  sectionId: string
  regenStatus: SectionRegenStatus
  /** Which target was most recently regenerated. */
  lastRegenTarget?: SectionRegenTarget
  /** Total retry count for this section across the session. */
  retryCount: number
  /** Last error message if regenStatus === 'failed'. */
  lastFailureReason?: string
  /** Review state per section. */
  review: SectionReviewState
  /** Timestamp ms — last status transition. */
  updatedAt: number
}

// ─── Observability metrics (per session, aggregated) ───────────────

export interface SessionMetrics {
  /** Total time spent generating images across all sections (ms). */
  totalGenerationMs: number
  /** Sum of retries across all sections. */
  totalRetries: number
  /** Count of sections that have failed at least once. */
  failedSectionCount: number
  /** Renderer distribution: how many sections used each renderer. */
  rendererDistribution: Record<string, number>
  /** Number of partial regenerations performed in session. */
  partialRegenCount: number
  /** Number of full preview renders (timing samples). */
  previewRenderSamples: number
  /** Mean render time ms (rolling average over samples). */
  meanRenderMs: number
}

// ─── History snapshot (append-only rollback support) ───────────────

export type SnapshotKind =
  | 'initial'           // first capture at session create
  | 'pre-tuning'        // before knob change
  | 'post-tuning'       // after knob change
  | 'pre-regen'         // before partial regen
  | 'post-regen'        // after partial regen
  | 'export'            // snapshot before user exports

export interface HistorySnapshot {
  snapshotId: string
  kind: SnapshotKind
  /** ISO timestamp. */
  takenAt: string
  /** Tuning knob state at snapshot time. */
  tuning: TuningKnobs
  /** Optional human note. */
  note?: string
  /** Section IDs affected by the change that triggered this snapshot. */
  affectedSectionIds: string[]
}

// ─── Landing session top-level (user-spec shape) ───────────────────

export interface LandingSession {
  /** Generated when session is created. */
  sessionId: string
  /** ISO timestamp. */
  createdAt: string
  /** Last persisted timestamp. */
  updatedAt: string
  /** Pack identity for traceability (product name + niche + sourcePackBlockCount). */
  packIdentity: {
    productName?: string
    niche?: string
    sourcePackBlockCount?: number
  }
  /** Current tuning knob state. */
  tuning: TuningKnobs
  /** Per-section state (keyed by section ID). */
  sections: Record<string, SectionSessionState>
  /** Append-only history snapshots for rollback. */
  history: HistorySnapshot[]
  /** Aggregated observability. */
  metrics: SessionMetrics
}

// ─── Re-exports for convenience ────────────────────────────────────

export type { TuningKnobs, ExportablePage }
