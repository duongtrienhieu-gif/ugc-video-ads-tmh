// ── Session Persistence — shared types ──────────────────────────────────────
// Foundation for the global "Khôi phục phiên trước?" recovery system.
// Phase R1 spec.
//
// Architecture:
//   - Each module wraps its in-flight state in a `SnapshotEnvelope<T>` and
//     writes it to localStorage under a known key on every change (debounced).
//   - On app mount, the global RestoreSessionModal scans every registered key,
//     parses envelopes, filters in-flight ones, and shows a unified list.
//   - User clicks [Khôi phục] → data stays in localStorage; when user opens
//     the module, its `useSessionPersist` hook reads the data and hydrates.
//   - User clicks [Bỏ] → all listed keys are cleared.
//
// Large blobs (generated images, uploaded refs) are NOT stored here —
// they continue going through `utils/assetStore.ts` (Supabase-backed).
// Snapshots only persist *asset references* + lightweight state.
// ─────────────────────────────────────────────────────────────────────────────

/** Status of an in-flight session — drives modal display + filter rules. */
export type SessionStatus =
  | 'in-progress'   // actively generating (likely interrupted by refresh)
  | 'paused'        // user explicitly paused or has pending work
  | 'completed'     // done — kept briefly in registry then archived
  | 'failed'        // hard error

/**
 * Envelope wrapping any module's snapshot data. The `data` field is the
 * module's own state shape; the metadata fields drive the unified modal.
 */
export interface SnapshotEnvelope<T = unknown> {
  /** Schema version — bump when module's data shape changes (drops old data) */
  version: number
  /** Module identifier (matches APP_COMPONENTS key in App.tsx) */
  moduleId: string
  /** Vietnamese label shown in modal */
  moduleNameVi: string
  /** Lifecycle status */
  status: SessionStatus
  /** ms timestamp — when this work started */
  startedAt: number
  /** ms timestamp — last save */
  updatedAt: number
  /** Optional: short VN progress text ('8/14 sections completed') */
  progressVi?: string
  /** Optional: project title for sub-line display */
  titleVi?: string
  /** Actual module state */
  data: T
}

/** Lightweight metadata extracted from an envelope — for modal list. */
export interface SessionMeta {
  moduleId: string
  moduleNameVi: string
  status: SessionStatus
  startedAt: number
  updatedAt: number
  progressVi?: string
  titleVi?: string
  /** The localStorage key — modal uses this to discard or accept */
  persistKey: string
}

/**
 * Registration entry describing one persistable module.
 * The RestoreSessionModal scans all entries on mount.
 */
export interface ModuleRegistration {
  /** Matches App.tsx APP_COMPONENTS key */
  moduleId: string
  /** Vietnamese name shown in modal */
  moduleNameVi: string
  /** localStorage key where the snapshot envelope lives */
  persistKey: string
  /** Current schema version — older versions are dropped */
  version: number
  /** Snapshot is considered stale if updatedAt is older than this */
  maxAgeMs: number
}
