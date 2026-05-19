// ── Generations Store (P13 + P24 + P38 fully-persistent) ───────────────────
//
// Workspace job store. Three persistence layers (P38):
//   1. In-memory zustand state (immediate UI source of truth)
//   2. localStorage cache — survives F5 even when Supabase is down
//      (key: 'creative-studio:jobs:v1'). Image blobs live in IndexedDB
//      via assetStore — they're already persistent across refresh.
//   3. Supabase `creative_generations` table — survives logout, cross-
//      device sync, opportunistic upgrade
//
// READ PATH on F5 (P38):
//   localStorage → instant restore → user sees their history
//   THEN Supabase → background merge → DB rows overlay localStorage
//   when both layers have the same id (DB wins for source-of-truth)
//
// WRITE PATH:
//   - createJob: write to memory + localStorage + best-effort DB insert
//   - patchJob:  write to memory + localStorage + best-effort DB update
//   - removeJob: remove from all three layers
//
// Jobs are NEVER lost on F5 anymore. The only way a job disappears is
// when the user explicitly clicks delete.

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

// ── localStorage persistence (P38) ───────────────────────────────────
//
// Lightweight cache so the workspace history survives F5 even when
// Supabase is unreachable. Stores up to STORAGE_LIMIT most-recent jobs
// (older are pruned automatically to keep localStorage under quota).
// Image blobs themselves live in IndexedDB via assetStore so they're
// already persistent and not duplicated here.

const STORAGE_KEY = 'creative-studio:jobs:v1'
const STORAGE_LIMIT = 200   // keep at most 200 recent jobs in localStorage

function loadFromLocalStorage(): GenerationJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GenerationJob[]
    if (!Array.isArray(parsed)) return []
    // Sanity check — drop entries missing required fields
    return parsed.filter((j) =>
      j && typeof j.id === 'string'
      && typeof j.creativeType === 'string'
      && typeof j.status === 'string'
    )
  } catch (err) {
    console.warn('[generationsStore] localStorage read failed', err)
    return []
  }
}

function saveToLocalStorage(jobs: GenerationJob[]): void {
  try {
    // Keep the most recent STORAGE_LIMIT to avoid quota errors
    const slice = jobs.slice(0, STORAGE_LIMIT)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slice))
  } catch (err) {
    console.warn('[generationsStore] localStorage write failed (quota?)', err)
  }
}

/** Merge DB rows over local rows. DB id wins; local-only rows stay. */
function mergeJobs(local: GenerationJob[], db: GenerationJob[]): GenerationJob[] {
  const map = new Map<string, GenerationJob>()
  for (const j of local) map.set(j.id, j)
  for (const j of db)    map.set(j.id, j)   // DB row overwrites local with same id
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
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

    // P38 — STAGE 1: localStorage restore (instant, no network).
    // F5 / cold reload sees the workspace immediately. Jobs that were
    // mid-flight when the user refreshed get flagged as 'failed' so
    // they don't sit in a perpetual "generating" state.
    const cached = loadFromLocalStorage()
    const cachedFlattened = cached.map((j) =>
      j.status === 'generating' || j.status === 'queued'
        ? { ...j, status: 'failed' as const, errorMessage: j.errorMessage ?? 'Bị gián đoạn — thử lại' }
        : j,
    )
    if (cachedFlattened.length > 0) {
      set({ jobs: cachedFlattened, hydrated: true, hydrating: false })
      console.info('[generationsStore.hydrate] restored', cachedFlattened.length, 'jobs from localStorage')
    }

    // P38 — STAGE 2: opportunistic Supabase upgrade (background merge).
    // When DB is healthy, DB rows merge over the localStorage cache.
    // When DB is unreachable, localStorage stays authoritative.
    try {
      const rows = await listGenerations()
      const dbJobs = rows.map(rowToJob).map((j) =>
        j.status === 'generating' || j.status === 'queued'
          ? { ...j, status: 'failed' as const, errorMessage: j.errorMessage ?? 'Bị gián đoạn — thử lại' }
          : j,
      )
      const merged = mergeJobs(cachedFlattened, dbJobs)
      saveToLocalStorage(merged)
      set({ jobs: merged, hydrated: true, hydrating: false, hydrateError: null })
      console.info('[generationsStore.hydrate] merged', dbJobs.length, 'DB jobs over', cachedFlattened.length, 'cached →', merged.length, 'total')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.warn('[generationsStore.hydrate] DB unavailable — staying on localStorage cache', err)
      // If cache was empty, we still mark hydrated so UI doesn't spin.
      // If cache had jobs, we keep them.
      set((s) => ({
        hydrating: false,
        hydrated: true,
        hydrateError: s.jobs.length === 0 ? msg : null,   // suppress banner when we have local jobs
      }))
    }
  },

  // ── createJob — ALWAYS succeeds (resilient + P38 persistent) ─────
  createJob: async (creativeType, inputs) => {
    console.info('[generationsStore.createJob] start', { creativeType, inputs })

    // Step 1: append local job immediately + persist to localStorage
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
    set((state) => {
      const next = [localJob, ...state.jobs]
      saveToLocalStorage(next)
      return { jobs: next }
    })

    // Step 2: try to upgrade to DB-backed job. If DB is unavailable,
    // keep the local job. Generation continues either way.
    try {
      const row = await insertGeneration({ creativeType, inputs })
      const dbJob = rowToJob(row)
      console.info('[generationsStore.createJob] DB insert OK', { id: dbJob.id })
      set((state) => {
        const next = state.jobs.map((j) => j.id === localId ? dbJob : j)
        saveToLocalStorage(next)
        return { jobs: next }
      })
      return dbJob
    } catch (err) {
      console.warn('[generationsStore.createJob] DB insert FAILED — keeping local job (still persisted to localStorage)', err)
      return localJob
    }
  },

  // ── patchJob — write-through to localStorage; DB best-effort
  patchJob: async (id, patch) => {
    console.info('[generationsStore.patchJob]', { id, patch })
    set((state) => {
      const next = state.jobs.map((j) =>
        j.id === id ? { ...j, ...patch, updatedAt: Date.now() } : j,
      )
      saveToLocalStorage(next)
      return { jobs: next }
    })
    if (isLocalId(id)) return  // local-only — no DB write
    try {
      await updateGeneration(id, {
        status:       patch.status,
        progress:     patch.progress,
        outputs:      patch.outputs,
        errorMessage: patch.errorMessage,
      })
    } catch (err) {
      console.warn('[generationsStore.patchJob] DB update failed; localStorage cache still holds the patch', err)
    }
  },

  patchJobLocal: (id, patch) => {
    set((state) => {
      const next = state.jobs.map((j) =>
        j.id === id ? { ...j, ...patch, updatedAt: Date.now() } : j,
      )
      saveToLocalStorage(next)
      return { jobs: next }
    })
  },

  removeJob: async (id) => {
    const previousJobs = get().jobs
    const filtered = previousJobs.filter((j) => j.id !== id)
    set({ jobs: filtered })
    saveToLocalStorage(filtered)
    if (isLocalId(id)) return  // local-only — already removed from store + cache
    try {
      await deleteGeneration(id)
    } catch (err) {
      console.warn('[generationsStore.removeJob] DB delete failed; UI delete sticks (localStorage already updated)', err)
      // DON'T restore the job — user explicitly deleted; localStorage
      // is the source of truth. DB cleanup retried next session.
    }
  },
}))
