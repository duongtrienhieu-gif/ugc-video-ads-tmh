// ── Timeline Render Job Store ───────────────────────────────────────────────
// Z26 — Persists the cut-level TimelineRenderJob (one item per timeline cut)
// across reloads. Adds the LOCK + SKIP semantics on top of the basic queue
// runner so users can preview-test individual clips, lock the good ones, and
// bulk-render only the remaining cuts without burning credit on the locked
// set.
//
// Resume semantics:
//   • 'generating' → 'pending'   — runner re-submits cleanly (no taskId yet
//     in this v1; future v2 could re-attach if we persist taskId)
//   • 'queued'     → 'pending'   — same logic, treat as un-launched
//   • 'completed'  → kept as-is  (has videoRef)
//   • 'locked'     → kept as-is  (CRITICAL: locks MUST survive refresh)
//   • 'skipped'    → kept as-is  (user intent persists)
//   • 'failed'     → kept as-is  (user retries explicitly)
//
// The runner reads from this store and writes status patches back. Lock and
// skip are pure store operations — no network — so they're instant.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import type {
  TimelineRenderJob, TimelineRenderItem, TimelineRenderStatus,
} from '../types'

const STORAGE_KEY = 'ugc-lab-v2-timeline-render-job'

interface TimelineRenderStoreState {
  job: TimelineRenderJob | null

  /** Initialize a new render job (overwrites any existing). Used when
   *  the planning phase produces a fresh blueprint. */
  createJob: (job: TimelineRenderJob) => void

  /** Patch one item by cutId. Persists. */
  patchItem: (cutId: number, patch: Partial<TimelineRenderItem>) => void

  /** Patch the top-level job. */
  setJobState: (patch: Partial<Pick<TimelineRenderJob, 'isRunning' | 'isPaused'>>) => void

  // ── Z26 lock/skip operations (cheap, no network) ────────────────────────

  /** Lock a completed cut so it survives all bulk operations. Only works
   *  on items that have a videoRef (i.e. status was 'completed'). */
  lockCut: (cutId: number) => void
  /** Release a lock — cut returns to 'completed' (still has videoRef). */
  unlockCut: (cutId: number) => void
  /** Mark a cut as skipped (exclude from bulk renders). */
  skipCut: (cutId: number) => void
  /** Remove the skip flag — cut returns to 'pending'. */
  unskipCut: (cutId: number) => void

  // ── Z28 approve / reject (cheap, no network) ────────────────────────────

  /** User verdict OK. Only valid when item has videoRef. Excluded from
   *  bulk auto-render; per-card rerender still works. */
  approveCut: (cutId: number) => void
  /** Reverse approval — returns to 'completed'. */
  unapproveCut: (cutId: number) => void
  /** User verdict NO. Only valid when item has videoRef. Excluded from
   *  bulk auto-render; per-card rerender still works (so user can take
   *  a fresh take without burning credit on the rest of the batch). */
  rejectCut: (cutId: number) => void
  /** Reverse rejection — returns to 'completed'. */
  unrejectCut: (cutId: number) => void

  // ── Resume + clear ──────────────────────────────────────────────────────

  /** Try to resume from localStorage. Returns true if a job exists with
   *  any non-terminal item (caller may want to ping the renderer). */
  tryResumeFromStorage: () => boolean
  /** Wipe the store + localStorage. */
  clearJob: () => void
}

function loadFromStorage(): TimelineRenderJob | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const job = JSON.parse(raw) as TimelineRenderJob
    // Resume cleanup — in-flight statuses go back to pending. Lock/skip/
    // completed/failed survive verbatim (the whole point of Z26).
    job.items = job.items.map((item) => {
      if (item.status === 'generating' || item.status === 'queued') {
        return { ...item, status: 'pending' as TimelineRenderStatus }
      }
      return item
    })
    if (job.isRunning) job.isRunning = false
    job.isPaused = true
    return job
  } catch { return null }
}

function saveToStorage(job: TimelineRenderJob | null): void {
  try {
    if (job) localStorage.setItem(STORAGE_KEY, JSON.stringify(job))
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* silent */ }
}

function findItemIdx(job: TimelineRenderJob, cutId: number): number {
  return job.items.findIndex((it) => it.cutId === cutId)
}

export const useTimelineRenderJobStore = create<TimelineRenderStoreState>((set, get) => ({
  job: null,

  createJob: (job) => {
    set({ job })
    saveToStorage(job)
  },

  patchItem: (cutId, patch) => {
    const cur = get().job
    if (!cur) return
    const idx = findItemIdx(cur, cutId)
    if (idx === -1) return
    const items = [...cur.items]
    items[idx] = { ...items[idx], ...patch }
    const next: TimelineRenderJob = { ...cur, items }
    set({ job: next })
    saveToStorage(next)
  },

  setJobState: (patch) => {
    const cur = get().job
    if (!cur) return
    const next: TimelineRenderJob = { ...cur, ...patch }
    set({ job: next })
    saveToStorage(next)
  },

  lockCut: (cutId) => {
    const cur = get().job
    if (!cur) return
    const idx = findItemIdx(cur, cutId)
    if (idx === -1) return
    const item = cur.items[idx]
    // Only completed cuts (with videoRef) can be locked. Silently noop
    // for other states — caller's UI should disable the button anyway.
    if (!item.videoRef) {
      console.warn(`[TIMELINE_RENDER] lockCut cutId=${cutId} skipped — no videoRef`)
      return
    }
    const items = [...cur.items]
    items[idx] = { ...item, status: 'locked', lockedAt: Date.now() }
    const next: TimelineRenderJob = { ...cur, items }
    set({ job: next })
    saveToStorage(next)
    console.log(`[TIMELINE_RENDER] cut-${cutId} LOCKED`)
  },

  unlockCut: (cutId) => {
    const cur = get().job
    if (!cur) return
    const idx = findItemIdx(cur, cutId)
    if (idx === -1) return
    const item = cur.items[idx]
    if (item.status !== 'locked') return
    const items = [...cur.items]
    items[idx] = { ...item, status: 'completed', lockedAt: undefined }
    const next: TimelineRenderJob = { ...cur, items }
    set({ job: next })
    saveToStorage(next)
    console.log(`[TIMELINE_RENDER] cut-${cutId} UNLOCKED`)
  },

  skipCut: (cutId) => {
    const cur = get().job
    if (!cur) return
    const idx = findItemIdx(cur, cutId)
    if (idx === -1) return
    const item = cur.items[idx]
    if (item.status === 'locked' || item.status === 'generating') return
    const items = [...cur.items]
    items[idx] = { ...item, status: 'skipped', skippedAt: Date.now() }
    const next: TimelineRenderJob = { ...cur, items }
    set({ job: next })
    saveToStorage(next)
    console.log(`[TIMELINE_RENDER] cut-${cutId} SKIPPED`)
  },

  unskipCut: (cutId) => {
    const cur = get().job
    if (!cur) return
    const idx = findItemIdx(cur, cutId)
    if (idx === -1) return
    const item = cur.items[idx]
    if (item.status !== 'skipped') return
    // Return to pending if no videoRef, completed otherwise.
    const items = [...cur.items]
    items[idx] = {
      ...item,
      status: item.videoRef ? 'completed' : 'pending',
      skippedAt: undefined,
    }
    const next: TimelineRenderJob = { ...cur, items }
    set({ job: next })
    saveToStorage(next)
    console.log(`[TIMELINE_RENDER] cut-${cutId} UNSKIPPED`)
  },

  // ── Z28 approve / reject ────────────────────────────────────────────

  approveCut: (cutId) => {
    const cur = get().job
    if (!cur) return
    const idx = findItemIdx(cur, cutId)
    if (idx === -1) return
    const item = cur.items[idx]
    if (!item.videoRef) {
      console.warn(`[TIMELINE_RENDER Z28] approveCut cutId=${cutId} skipped — no videoRef`)
      return
    }
    if (item.status === 'locked' || item.status === 'skipped' || item.status === 'generating') return
    const items = [...cur.items]
    items[idx] = { ...item, status: 'approved', approvedAt: Date.now(), rejectedAt: undefined }
    const next: TimelineRenderJob = { ...cur, items }
    set({ job: next })
    saveToStorage(next)
    console.log(`[TIMELINE_RENDER Z28] cut-${cutId} APPROVED`)
  },

  unapproveCut: (cutId) => {
    const cur = get().job
    if (!cur) return
    const idx = findItemIdx(cur, cutId)
    if (idx === -1) return
    const item = cur.items[idx]
    if (item.status !== 'approved') return
    const items = [...cur.items]
    items[idx] = { ...item, status: 'completed', approvedAt: undefined }
    const next: TimelineRenderJob = { ...cur, items }
    set({ job: next })
    saveToStorage(next)
    console.log(`[TIMELINE_RENDER Z28] cut-${cutId} UN-APPROVED`)
  },

  rejectCut: (cutId) => {
    const cur = get().job
    if (!cur) return
    const idx = findItemIdx(cur, cutId)
    if (idx === -1) return
    const item = cur.items[idx]
    if (!item.videoRef) {
      console.warn(`[TIMELINE_RENDER Z28] rejectCut cutId=${cutId} skipped — no videoRef`)
      return
    }
    if (item.status === 'locked' || item.status === 'skipped' || item.status === 'generating') return
    const items = [...cur.items]
    items[idx] = { ...item, status: 'rejected', rejectedAt: Date.now(), approvedAt: undefined }
    const next: TimelineRenderJob = { ...cur, items }
    set({ job: next })
    saveToStorage(next)
    console.log(`[TIMELINE_RENDER Z28] cut-${cutId} REJECTED`)
  },

  unrejectCut: (cutId) => {
    const cur = get().job
    if (!cur) return
    const idx = findItemIdx(cur, cutId)
    if (idx === -1) return
    const item = cur.items[idx]
    if (item.status !== 'rejected') return
    const items = [...cur.items]
    items[idx] = { ...item, status: 'completed', rejectedAt: undefined }
    const next: TimelineRenderJob = { ...cur, items }
    set({ job: next })
    saveToStorage(next)
    console.log(`[TIMELINE_RENDER Z28] cut-${cutId} UN-REJECTED`)
  },

  tryResumeFromStorage: () => {
    const job = loadFromStorage()
    if (!job) return false
    set({ job })
    // Z28 — approved + rejected are terminal user verdicts; treat like completed
    // for the "is there pending work?" check.
    return job.items.some((i) =>
      i.status !== 'completed' && i.status !== 'locked' && i.status !== 'cancelled' &&
      i.status !== 'skipped' && i.status !== 'approved' && i.status !== 'rejected'
    )
  },

  clearJob: () => {
    set({ job: null })
    saveToStorage(null)
  },
}))

// ── Selectors / utilities ──────────────────────────────────────────────────

/** Z26 — how much would it cost to render every PENDING item right now?
 *  Excludes locked, skipped, completed, failed (separate retry). */
export function countPendingCuts(job: TimelineRenderJob | null): number {
  if (!job) return 0
  return job.items.filter((it) => it.status === 'pending').length
}

export function countFailedCuts(job: TimelineRenderJob | null): number {
  if (!job) return 0
  return job.items.filter((it) => it.status === 'failed').length
}

export function countLockedCuts(job: TimelineRenderJob | null): number {
  if (!job) return 0
  return job.items.filter((it) => it.status === 'locked').length
}

/** Counts ANYTHING with a rendered videoRef — completed / approved / rejected / locked. */
export function countCompletedCuts(job: TimelineRenderJob | null): number {
  if (!job) return 0
  return job.items.filter((it) =>
    it.status === 'completed' || it.status === 'locked' ||
    it.status === 'approved' || it.status === 'rejected'
  ).length
}

export function countSkippedCuts(job: TimelineRenderJob | null): number {
  if (!job) return 0
  return job.items.filter((it) => it.status === 'skipped').length
}

/** Z28 — counts approved-verdict cuts (still has videoRef, immune to bulk). */
export function countApprovedCuts(job: TimelineRenderJob | null): number {
  if (!job) return 0
  return job.items.filter((it) => it.status === 'approved').length
}

/** Z28 — counts rejected-verdict cuts (user said no, still has videoRef). */
export function countRejectedCuts(job: TimelineRenderJob | null): number {
  if (!job) return 0
  return job.items.filter((it) => it.status === 'rejected').length
}
