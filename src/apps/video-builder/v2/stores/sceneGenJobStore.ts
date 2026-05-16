// ── Scene Gen Job Store ──────────────────────────────────────────────────────
// Zustand store holding the active 9-scene generation queue. Each scene is a
// SceneGenItem with its own status/image/qc. Runner updates the store as it
// progresses through the queue sequentially.
//
// Persisted to localStorage so refresh resumes (we keep KIE-completed images;
// in-flight items revert to 'pending' on resume so the queue restarts cleanly).
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import type { SceneGenJob, SceneGenItem, SceneGenItemStatus } from '../types'
import { SCENE_STATUS_LABEL_VI } from '../types'

const STORAGE_KEY = 'ugc-lab-v2-scene-gen-job'

interface SceneGenStoreState {
  job: SceneGenJob | null

  /** Initialize a new queue from inputs (overwrites any existing). */
  createQueue: (job: SceneGenJob) => void
  /** Patch one item by index. Persists. */
  patchItem: (idx: number, patch: Partial<SceneGenItem>) => void
  /** Set the queue's currentIdx + status. */
  setQueueState: (patch: Partial<Pick<SceneGenJob, 'currentIdx' | 'status'>>) => void
  /** Approve / reject a scene. */
  setSceneStatus: (idx: number, status: SceneGenItemStatus) => void
  /** Try to resume from localStorage. Returns true if a non-completed queue was found. */
  tryResumeFromStorage: () => boolean
  /** Clear the active queue. */
  clearJob: () => void
}

function loadFromStorage(): SceneGenJob | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const job = JSON.parse(raw) as SceneGenJob
    // Resume cleanup: any in-flight items revert to pending
    job.items = job.items.map((item) => {
      if (item.status === 'generating' || item.status === 'auto_validating' || item.status === 'retrying') {
        return { ...item, status: 'pending' as SceneGenItemStatus, retryCount: 0 }
      }
      return item
    })
    if (job.status === 'running') job.status = 'paused'
    return job
  } catch { return null }
}

function saveToStorage(job: SceneGenJob | null): void {
  try {
    if (job) localStorage.setItem(STORAGE_KEY, JSON.stringify(job))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {/* silent */}
}

export const useSceneGenJobStore = create<SceneGenStoreState>((set, get) => ({
  job: null,

  createQueue: (job) => {
    set({ job })
    saveToStorage(job)
  },

  patchItem: (idx, patch) => {
    const cur = get().job
    if (!cur) return
    if (idx < 0 || idx >= cur.items.length) return
    const items = [...cur.items]
    items[idx] = { ...items[idx], ...patch }
    const next: SceneGenJob = { ...cur, items }
    set({ job: next })
    saveToStorage(next)
  },

  setQueueState: (patch) => {
    const cur = get().job
    if (!cur) return
    const next: SceneGenJob = { ...cur, ...patch }
    set({ job: next })
    saveToStorage(next)
  },

  setSceneStatus: (idx, status) => {
    get().patchItem(idx, { status })
  },

  tryResumeFromStorage: () => {
    const stored = loadFromStorage()
    if (!stored) return false
    set({ job: stored })
    return stored.status !== 'completed' && stored.status !== 'failed'
  },

  clearJob: () => {
    set({ job: null })
    saveToStorage(null)
  },
}))

// Export for consumers that want the VN status label directly
export { SCENE_STATUS_LABEL_VI }
