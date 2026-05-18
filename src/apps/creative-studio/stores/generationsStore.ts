// ── Generations Store (P13) ────────────────────────────────────────────────
//
// Workspace-style job store, modeled after Midjourney / Krea / Leonardo:
//   • Append-only — every "Tạo" click creates a new GenerationJob
//   • Async — jobs progress through queued → generating → completed/failed
//     without blocking the UI; user can fire more jobs while previous
//     ones run
//   • Persistent — hydrate from Supabase on mount, write through on
//     every state change
//
// ARCHITECTURE RULE (per P13 spec §"Creative Studio và Landing Page"):
//   • Does NOT share state with landing-page
//   • Does NOT share store with landing-page
//   • Does NOT share DB schema with landing-page
//   • Tách hoàn toàn — this file lives entirely inside
//     src/apps/creative-studio/

import { create } from 'zustand'
import type { GeneratedAsset } from '../types/asset'
import type { AssetTypeId } from '../types/asset'
import {
  listGenerations,
  insertGeneration,
  updateGeneration,
  deleteGeneration,
  type GenerationRow,
  type GenerationInputs,
  type GenerationStatus,
} from '../services/generationsAPI'

// ── Job model ────────────────────────────────────────────────────────

export interface GenerationJob {
  id: string
  creativeType: AssetTypeId
  status: GenerationStatus
  progress: number
  inputs: GenerationInputs
  outputs: GeneratedAsset[]
  errorMessage: string | null
  createdAt: number
  updatedAt: number
}

function rowToJob(row: GenerationRow): GenerationJob {
  return {
    id: row.id,
    creativeType: row.creative_type,
    status: row.status,
    progress: row.progress ?? 0,
    inputs: row.inputs_json ?? {},
    outputs: row.outputs_json?.assets ?? [],
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

// ── Store interface ──────────────────────────────────────────────────

interface GenerationsState {
  /** Newest first. */
  jobs: GenerationJob[]
  hydrated: boolean
  hydrating: boolean
  hydrateError: string | null

  // ── Actions ────────────────────────────────────────────────────
  hydrate: () => Promise<void>
  createJob: (creativeType: AssetTypeId, inputs: GenerationInputs) => Promise<GenerationJob>
  patchJob: (id: string, patch: Partial<Pick<GenerationJob, 'status' | 'progress' | 'outputs' | 'errorMessage'>>) => Promise<void>
  /** In-memory only patch — used during the high-frequency rendering
   *  loop where we don't want a DB roundtrip per progress tick. */
  patchJobLocal: (id: string, patch: Partial<Pick<GenerationJob, 'status' | 'progress' | 'outputs' | 'errorMessage'>>) => void
  removeJob: (id: string) => Promise<void>
}

export const useGenerationsStore = create<GenerationsState>((set, get) => ({
  jobs: [],
  hydrated: false,
  hydrating: false,
  hydrateError: null,

  hydrate: async () => {
    if (get().hydrated || get().hydrating) return
    set({ hydrating: true, hydrateError: null })
    try {
      const rows = await listGenerations()
      const jobs = rows.map(rowToJob)
      // Any rows left in 'generating' / 'queued' from a previous tab
      // crash are flattened to 'failed' so the UI doesn't render them
      // as spinners forever.
      const flattened = jobs.map((j) =>
        j.status === 'generating' || j.status === 'queued'
          ? { ...j, status: 'failed' as const, errorMessage: j.errorMessage ?? 'Bị gián đoạn — thử lại' }
          : j,
      )
      set({ jobs: flattened, hydrated: true, hydrating: false })
    } catch (err) {
      // P19 — failure must NEVER cascade to UI tree. Mark hydrated:true
      // so the workspace shows the empty state + error banner instead of
      // spinning forever. Input panel + creative picker continue to work
      // regardless of history-load failure.
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error('[generationsStore.hydrate]', err)
      set({ hydrating: false, hydrated: true, hydrateError: msg, jobs: [] })
    }
  },

  createJob: async (creativeType, inputs) => {
    const row = await insertGeneration({ creativeType, inputs })
    const job = rowToJob(row)
    set((state) => ({ jobs: [job, ...state.jobs] }))
    return job
  },

  patchJob: async (id, patch) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, ...patch, updatedAt: Date.now() } : j,
      ),
    }))
    // Fire-and-forget DB write — local UI already reflects the patch
    try {
      await updateGeneration(id, {
        status:       patch.status,
        progress:     patch.progress,
        outputs:      patch.outputs,
        errorMessage: patch.errorMessage,
      })
    } catch (err) {
      console.error('[generationsStore.patchJob db write failed]', err)
    }
  },

  patchJobLocal: (id, patch) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, ...patch, updatedAt: Date.now() } : j,
      ),
    }))
  },

  removeJob: async (id) => {
    // Optimistic remove
    const previousJobs = get().jobs
    set({ jobs: previousJobs.filter((j) => j.id !== id) })
    try {
      await deleteGeneration(id)
    } catch (err) {
      console.error('[generationsStore.removeJob db delete failed; restoring]', err)
      set({ jobs: previousJobs })
      throw err
    }
  },
}))
