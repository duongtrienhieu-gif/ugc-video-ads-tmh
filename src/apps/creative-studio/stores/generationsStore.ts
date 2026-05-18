// ── Generations Store (P13 + P24 resilient mode) ───────────────────────────
//
// Workspace job store. Architectural change in P24:
//   • Generation NO LONGER depends on DB being available
//   • createJob/patchJob/removeJob gracefully degrade when Supabase
//     is unreachable (eg `creative_generations` table missing, RLS
//     misconfigured, network down)
//   • Failed DB ops are logged + the job continues in local-only mode
//     (id prefixed `local_`; never written to DB; lost on F5)
//   • When DB is healthy, jobs go through the full insert/update flow
//     and persist across F5 / logout
//
// History is OPTIONAL infrastructure. Generation is CORE — never blocks
// on DB issues.

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

/** True when the id was minted client-side (DB-less mode). */
function isLocalId(id: string): boolean {
  return id.startsWith('local_')
}

function mintLocalId(): string {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Store interface ──────────────────────────────────────────────────

interface GenerationsState {
  jobs: GenerationJob[]
  hydrated: boolean
  hydrating: boolean
  hydrateError: string | null

  hydrate: () => Promise<void>
  createJob: (creativeType: AssetTypeId, inputs: GenerationInputs) => Promise<GenerationJob>
  patchJob: (id: string, patch: Partial<Pick<GenerationJob, 'status' | 'progress' | 'outputs' | 'errorMessage'>>) => Promise<void>
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
      const flattened = jobs.map((j) =>
        j.status === 'generating' || j.status === 'queued'
          ? { ...j, status: 'failed' as const, errorMessage: j.errorMessage ?? 'Bị gián đoạn — thử lại' }
          : j,
      )
      set({ jobs: flattened, hydrated: true, hydrating: false })
      console.info('[generationsStore.hydrate] loaded', flattened.length, 'jobs from DB')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error('[generationsStore.hydrate] DB unavailable — local-only mode active', err)
      set({ hydrating: false, hydrated: true, hydrateError: msg, jobs: [] })
    }
  },

  // ── createJob — ALWAYS succeeds (resilient) ───────────────────────
  createJob: async (creativeType, inputs) => {
    console.info('[generationsStore.createJob] start', { creativeType, inputs })

    // Step 1: append local job immediately so UI gets a card ASAP
    const localId = mintLocalId()
    const localJob: GenerationJob = {
      id: localId,
      creativeType,
      status: 'queued',
      progress: 0,
      inputs,
      outputs: [],
      errorMessage: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((state) => ({ jobs: [localJob, ...state.jobs] }))

    // Step 2: try to upgrade to DB-backed job. If DB is unavailable,
    // keep the local job. Generation continues either way.
    try {
      const row = await insertGeneration({ creativeType, inputs })
      const dbJob = rowToJob(row)
      console.info('[generationsStore.createJob] DB insert OK', { id: dbJob.id })
      set((state) => ({
        jobs: state.jobs.map((j) => j.id === localId ? dbJob : j),
      }))
      return dbJob
    } catch (err) {
      console.warn('[generationsStore.createJob] DB insert FAILED — keeping local job', err)
      // Surface hydrateError so workspace shows the soft notice
      if (!get().hydrateError) {
        const msg = err instanceof Error ? err.message : 'DB unavailable'
        set({ hydrateError: msg })
      }
      return localJob
    }
  },

  // ── patchJob — local-only jobs skip DB; DB-backed jobs write through
  patchJob: async (id, patch) => {
    console.info('[generationsStore.patchJob]', { id, patch })
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, ...patch, updatedAt: Date.now() } : j,
      ),
    }))
    if (isLocalId(id)) return  // local-only — no DB write
    try {
      await updateGeneration(id, {
        status:       patch.status,
        progress:     patch.progress,
        outputs:      patch.outputs,
        errorMessage: patch.errorMessage,
      })
    } catch (err) {
      console.warn('[generationsStore.patchJob] DB update failed; keeping local state', err)
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
    const previousJobs = get().jobs
    set({ jobs: previousJobs.filter((j) => j.id !== id) })
    if (isLocalId(id)) return  // local-only — already removed from store
    try {
      await deleteGeneration(id)
    } catch (err) {
      console.error('[generationsStore.removeJob] DB delete failed; restoring local state', err)
      set({ jobs: previousJobs })
      throw err
    }
  },
}))
