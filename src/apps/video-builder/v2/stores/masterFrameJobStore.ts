// ── Master Frame Job Store ───────────────────────────────────────────────────
// Zustand store holding the SINGLE active master-frame job at a time.
// Persists to localStorage so a page refresh recovers the in-flight task.
//
// The job pipeline (runner) updates this store as it progresses through phases.
// UI components subscribe via selectors — no React-state-prop drilling for the
// long-running pipeline.
//
// Note: only the most recent job is kept (since the app only runs one at a time).
// History of completed jobs lives in the bank store (Models with characterImage).
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import type { MasterFrameJob, MasterFrameJobStatus, MasterFrameJobAttempt, QcScore, IdentityPack, CompiledPrompt } from '../types'
import { JOB_STATUS_LABEL_VI, JOB_PROGRESS_PCT } from '../types'

const STORAGE_KEY = 'ugc-lab-v2-master-frame-job'
/** Max age before a stored job is discarded as stale (12 minutes per spec). */
const MAX_JOB_AGE_MS = 12 * 60 * 1000

interface JobStoreState {
  /** Currently-active or most-recent job (null if never started) */
  job: MasterFrameJob | null

  // ── Mutations ───────────────────────────────────────────────────────────────
  /** Create a brand-new job, replacing any previous one. Persists immediately. */
  createJob: (job: Omit<MasterFrameJob, 'createdAt' | 'updatedAt' | 'attempts' | 'statusVi' | 'progress' | 'elapsedSec'>) => void
  /** Patch fields on the current job. Auto-updates statusVi + progress from status. */
  updateJob: (patch: Partial<MasterFrameJob>) => void
  /** Move to a new status — automatically maps statusVi + progress. */
  setStatus: (status: MasterFrameJobStatus, statusViOverride?: string) => void
  /** Push a new attempt onto the attempts array. */
  addAttempt: (attempt: MasterFrameJobAttempt) => void
  /** Update the most recent attempt (e.g. when QC finishes for it). */
  patchLastAttempt: (patch: Partial<MasterFrameJobAttempt>) => void
  /** Set final result fields on completion. */
  finalize: (params: { imageUrl: string; qc?: QcScore | null; compiled?: CompiledPrompt | null }) => void
  /** Mark identity pack after extraction. */
  setIdentity: (identity: IdentityPack) => void
  /** Tick the elapsed-seconds counter (called by a UI interval). */
  tickElapsed: (sec: number) => void
  /** Clear the active job (forget). */
  clearJob: () => void
  /** Try to resume a job from localStorage on app mount. Returns true if a recoverable job was loaded. */
  tryResumeFromStorage: () => boolean
}

// ── localStorage helpers ─────────────────────────────────────────────────────

function loadFromStorage(): MasterFrameJob | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const job = JSON.parse(raw) as MasterFrameJob
    // Discard stale jobs (older than MAX_JOB_AGE)
    if (Date.now() - job.createdAt > MAX_JOB_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    // Don't auto-restore completed/failed/cancelled jobs — UI doesn't need them
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return job  // Still load — UI can decide to display final result vs clear
    }
    return job
  } catch {
    return null
  }
}

function saveToStorage(job: MasterFrameJob | null): void {
  try {
    if (job) localStorage.setItem(STORAGE_KEY, JSON.stringify(job))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {/* silent — storage may be unavailable in private mode */}
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useMasterFrameJobStore = create<JobStoreState>((set, get) => ({
  job: null,

  createJob: (input) => {
    const now = Date.now()
    const status: MasterFrameJobStatus = 'queued'
    const job: MasterFrameJob = {
      ...input,
      createdAt: now,
      updatedAt: now,
      attempts: [],
      statusVi: JOB_STATUS_LABEL_VI[status],
      progress: JOB_PROGRESS_PCT[status],
      elapsedSec: 0,
      status,
    }
    set({ job })
    saveToStorage(job)
  },

  updateJob: (patch) => {
    const cur = get().job
    if (!cur) return
    const next: MasterFrameJob = { ...cur, ...patch, updatedAt: Date.now() }
    // If status changed via patch, refresh statusVi/progress
    if (patch.status && patch.status !== cur.status) {
      next.statusVi = patch.statusVi ?? JOB_STATUS_LABEL_VI[patch.status]
      next.progress = JOB_PROGRESS_PCT[patch.status]
    }
    set({ job: next })
    saveToStorage(next)
  },

  setStatus: (status, statusViOverride) => {
    get().updateJob({
      status,
      statusVi: statusViOverride ?? JOB_STATUS_LABEL_VI[status],
    })
  },

  addAttempt: (attempt) => {
    const cur = get().job
    if (!cur) return
    get().updateJob({ attempts: [...cur.attempts, attempt] })
  },

  patchLastAttempt: (patch) => {
    const cur = get().job
    if (!cur || cur.attempts.length === 0) return
    const lastIdx = cur.attempts.length - 1
    const updatedAttempts = [...cur.attempts]
    updatedAttempts[lastIdx] = { ...updatedAttempts[lastIdx], ...patch }
    get().updateJob({ attempts: updatedAttempts })
  },

  finalize: ({ imageUrl, qc, compiled }) => {
    get().updateJob({
      status: 'completed',
      statusVi: JOB_STATUS_LABEL_VI['completed'],
      progress: 100,
      finalImageUrl: imageUrl,
      finalQc: qc ?? null,
      finalCompiled: compiled ?? null,
    })
  },

  setIdentity: (identity) => {
    get().updateJob({ identity })
  },

  tickElapsed: (sec) => {
    const cur = get().job
    if (!cur) return
    // Don't persist every tick — just in-memory update for UI
    set({ job: { ...cur, elapsedSec: sec } })
  },

  clearJob: () => {
    set({ job: null })
    saveToStorage(null)
  },

  tryResumeFromStorage: () => {
    const stored = loadFromStorage()
    if (!stored) return false
    set({ job: stored })
    return stored.status !== 'completed' && stored.status !== 'failed' && stored.status !== 'cancelled'
  },
}))
