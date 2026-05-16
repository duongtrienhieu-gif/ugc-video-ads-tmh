// ── Video Gen Job Store ─────────────────────────────────────────────────────
// Zustand store holding the active per-scene video-clip generation queue.
// Mirrors sceneGenJobStore but for image-to-video (Kling 3.0).
//
// Persists to localStorage so refresh resumes: in-flight items revert to
// 'queued' on resume so the runner can re-poll if a clip is still cooking
// on KIE's side (it keeps the taskId so polling re-attaches cleanly).
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import type { VideoGenJob, VideoGenItem, VideoGenItemStatus } from '../types'

const STORAGE_KEY = 'ugc-lab-v2-video-gen-job'

interface VideoGenStoreState {
  job: VideoGenJob | null

  /** Initialize a new queue (overwrites). */
  createQueue: (job: VideoGenJob) => void
  /** Patch one item by index. Persists. */
  patchItem: (idx: number, patch: Partial<VideoGenItem>) => void
  /** Set runner-level flags. */
  setQueueState: (patch: Partial<Pick<VideoGenJob, 'isRunning' | 'isPaused'>>) => void
  /** Try to resume from localStorage. Returns true if a non-completed queue was found. */
  tryResumeFromStorage: () => boolean
  /** Clear the active queue. */
  clearJob: () => void
}

function loadFromStorage(): VideoGenJob | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const job = JSON.parse(raw) as VideoGenJob
    // Resume cleanup: in-flight items revert to queued so the runner can
    // re-attach to the same KIE taskId if still alive. Kept videoRef intact
    // for items that completed before the crash.
    job.items = job.items.map((item) => {
      if (item.status === 'generating') {
        return { ...item, status: 'queued' as VideoGenItemStatus }
      }
      return item
    })
    if (job.isRunning) job.isRunning = false
    job.isPaused = true
    return job
  } catch { return null }
}

function saveToStorage(job: VideoGenJob | null): void {
  try {
    if (job) localStorage.setItem(STORAGE_KEY, JSON.stringify(job))
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* silent */ }
}

export const useVideoGenJobStore = create<VideoGenStoreState>((set, get) => ({
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
    const next: VideoGenJob = { ...cur, items }
    set({ job: next })
    saveToStorage(next)
  },

  setQueueState: (patch) => {
    const cur = get().job
    if (!cur) return
    const next: VideoGenJob = { ...cur, ...patch }
    set({ job: next })
    saveToStorage(next)
  },

  tryResumeFromStorage: () => {
    const job = loadFromStorage()
    if (!job) return false
    set({ job })
    return job.items.some((i) => i.status !== 'completed' && i.status !== 'cancelled')
  },

  clearJob: () => {
    set({ job: null })
    saveToStorage(null)
  },
}))
