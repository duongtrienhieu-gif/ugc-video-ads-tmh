// ─────────────────────────────────────────────────────────────────────
// Session Runtime — public API barrel (P16A)
//
// Persistent landing session: per-section regen state + review +
// history snapshots + observability metrics + IndexedDB persistence.
//
// All runtime mutations are pure (return new session). Persistence is
// fail-soft (IndexedDB unavailable → in-memory only).
// ─────────────────────────────────────────────────────────────────────

// Storage
export {
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
} from './storage/indexedDbStore'

// Runtime — session lifecycle
export { createLandingSession } from './runtime/createLandingSession'
export type { CreateLandingSessionOptions } from './runtime/createLandingSession'

// Runtime — history snapshots
export { snapshotHistory, pruneHistory } from './runtime/snapshotHistory'
export type { SnapshotInput } from './runtime/snapshotHistory'

// Runtime — section state transitions
export {
  setRegenStatus,
  incrementRetry,
  recordFailure,
  setReviewVerdict,
  toggleReviewFlag,
  setReviewNote,
} from './runtime/updateSectionState'

// Runtime — observability metrics
export {
  recordGenerationEvent,
  recordRenderSample,
} from './runtime/computeSessionMetrics'
export type { GenerationEvent } from './runtime/computeSessionMetrics'

// Types
export type {
  SectionRegenStatus,
  SectionRegenTarget,
  ReviewVerdict,
  ReviewFlag,
  SectionReviewState,
  SectionSessionState,
  SessionMetrics,
  SnapshotKind,
  HistorySnapshot,
  LandingSession,
} from './types'
