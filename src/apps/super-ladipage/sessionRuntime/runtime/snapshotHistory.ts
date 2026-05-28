// ─────────────────────────────────────────────────────────────────────
// Session Runtime — snapshotHistory (P16A)
//
// Append-only history snapshots. Captures session state at key
// moments (pre/post tuning, pre/post regen, export). Marketer can
// rollback to a snapshot via consumer-controlled UI.
//
// Returns a new LandingSession (immutable). Pure function.
// ─────────────────────────────────────────────────────────────────────

import type { LandingSession, HistorySnapshot, SnapshotKind } from '../types'
import { generateSnapshotId } from './createLandingSession'

export interface SnapshotInput {
  session: LandingSession
  kind: SnapshotKind
  note?: string
  affectedSectionIds?: string[]
}

export function snapshotHistory(input: SnapshotInput): LandingSession {
  const snapshot: HistorySnapshot = {
    snapshotId: generateSnapshotId(),
    kind: input.kind,
    takenAt: new Date().toISOString(),
    tuning: { ...input.session.tuning },
    note: input.note,
    affectedSectionIds: input.affectedSectionIds ?? [],
  }
  return {
    ...input.session,
    history: [...input.session.history, snapshot],
    updatedAt: new Date().toISOString(),
  }
}

/** Limit history to last N entries (prevent unbounded growth).
 *  Always preserves the 'initial' snapshot at index 0. */
export function pruneHistory(session: LandingSession, maxEntries = 30): LandingSession {
  if (session.history.length <= maxEntries) return session
  const initial = session.history[0]
  const recent = session.history.slice(-(maxEntries - 1))
  return {
    ...session,
    history: [initial, ...recent],
  }
}
