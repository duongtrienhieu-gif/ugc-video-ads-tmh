import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LandingPagePack, SavedLandingPack } from './types'
import {
  fetchAllProjects, upsertProject, deleteProject as supaDelete,
  renameProject as supaRename, mergeProjects, checkTableExists,
} from './services/landingProjectsSupabase'

// ─────────────────────────────────────────────────────────────────────
// Landing Page Projects — Canva/Figma-style persistent workspace.
//
// Phase H2 — Local-first + Supabase sync architecture:
//   • localStorage is the SOURCE OF TRUTH for reads — UI never waits on network
//   • Every mutation writes to localStorage IMMEDIATELY, then fires a
//     background Supabase upsert (debounced 2s for batched edits)
//   • On app boot, syncFromCloud() pulls all rows and merges by createdAt
//   • If Supabase is unavailable (table missing / offline / logged out),
//     the app degrades silently to localStorage-only — no UI breakage
//
// Workflow:
//   1. User generates pack → useSessionPersist auto-saves in-flight state
//   2. User clicks "Lưu LandingPage" → add() creates a SavedLandingPack
//      → localStorage updated → Supabase upsert queued
//   3. From then on, edits auto-sync via update(id, pack)
//      → localStorage updates → Supabase upsert queued
//   4. User logs in on different device → boot pulls projects from Supabase
//      → merges into localStorage → projects appear in sidebar
//   5. Duplicate / Archive / Export / Rename — all sync to cloud
//
// See SUPABASE_LANDING_PROJECTS_MIGRATION.md for the SQL to enable cloud sync.
// ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

interface LandingPageStore {
  items: SavedLandingPack[]
  /** H2: sync state across all projects. Drives the UI indicator. */
  syncStatus: SyncStatus
  /** H2: epoch ms of last successful sync. null if never synced. */
  lastSyncedAt: number | null
  /** H2: error message from the last failed sync — for the user-facing toast. */
  syncError: string | null
  /** Create a new saved project from a generated pack. */
  add: (pack: LandingPagePack, title?: string) => SavedLandingPack
  /** Update an existing project — used for auto-sync after edits. */
  update: (id: string, pack: LandingPagePack) => void
  /** Clone an existing project under a new id + title. */
  duplicate: (id: string) => SavedLandingPack | null
  /** Get a project by id (used when re-loading into the editor). */
  getById: (id: string) => SavedLandingPack | undefined
  remove: (id: string) => void
  updateTitle: (id: string, title: string) => void
  clear: () => void
  /** H2: pull all rows from Supabase and merge into localStorage. */
  syncFromCloud: () => Promise<void>
}

// ── H2: debounced Supabase upsert queue ────────────────────────────────────
// Batched per-project — if user mashes save 10x in 2s, only the last write
// hits the network. Keeps the upsert call count low without sacrificing
// data freshness across devices.

const UPSERT_DEBOUNCE_MS = 2000
const upsertTimers = new Map<string, ReturnType<typeof setTimeout>>()

function queueUpsert(pack: SavedLandingPack, setStatus: (s: SyncStatus, err?: string | null) => void): void {
  const existing = upsertTimers.get(pack.id)
  if (existing) clearTimeout(existing)
  upsertTimers.set(pack.id, setTimeout(async () => {
    upsertTimers.delete(pack.id)
    setStatus('syncing')
    const result = await upsertProject(pack)
    if (result.skipped) {
      setStatus('offline', null)
      return
    }
    if (result.ok) {
      setStatus('synced', null)
    } else {
      setStatus('error', result.error ?? 'Sync thất bại')
    }
  }, UPSERT_DEBOUNCE_MS))
}

export const useLandingPageStore = create<LandingPageStore>()(
  persist(
    (set, get) => {
      const setStatus = (status: SyncStatus, error: string | null = null): void => {
        set({
          syncStatus: status,
          syncError: error,
          lastSyncedAt: status === 'synced' ? Date.now() : get().lastSyncedAt,
        })
      }

      return {
        items: [],
        syncStatus: 'idle' as SyncStatus,
        lastSyncedAt: null,
        syncError: null,

        add: (pack, title) => {
          const saved: SavedLandingPack = {
            ...pack,
            id: crypto.randomUUID(),
            title: (title?.trim() || `${pack.productName} — Landing Pack`).slice(0, 160),
            createdAt: Date.now(),
          }
          set((s) => ({ items: [saved, ...s.items] }))
          queueUpsert(saved, setStatus)
          return saved
        },

        update: (id, pack) => {
          let updated: SavedLandingPack | null = null
          set((s) => ({
            items: s.items.map((x) => {
              if (x.id !== id) return x
              const next: SavedLandingPack = {
                ...x,
                ...pack,
                id: x.id,
                title: x.title,
                createdAt: x.createdAt,
              }
              updated = next
              return next
            }),
          }))
          if (updated) queueUpsert(updated, setStatus)
        },

        duplicate: (id) => {
          const original = get().items.find((x) => x.id === id)
          if (!original) return null
          const copy: SavedLandingPack = {
            ...original,
            id: crypto.randomUUID(),
            title: `${original.title} (bản sao)`.slice(0, 160),
            createdAt: Date.now(),
          }
          set((s) => ({ items: [copy, ...s.items] }))
          queueUpsert(copy, setStatus)
          return copy
        },

        getById: (id) => get().items.find((x) => x.id === id),

        remove: (id) => {
          // Clear any pending upsert for this project
          const pending = upsertTimers.get(id)
          if (pending) { clearTimeout(pending); upsertTimers.delete(id) }
          set((s) => ({ items: s.items.filter((x) => x.id !== id) }))
          // Fire delete to Supabase — no need to wait
          supaDelete(id).then((r) => {
            if (r.ok && !r.skipped) setStatus('synced')
          }).catch(() => {/* silent */})
        },

        updateTitle: (id, title) => {
          const clipped = title.slice(0, 160)
          set((s) => ({
            items: s.items.map((x) => x.id === id ? { ...x, title: clipped } : x),
          }))
          supaRename(id, clipped).then((r) => {
            if (r.ok && !r.skipped) setStatus('synced')
          }).catch(() => {/* silent */})
        },

        clear: () => {
          // Note: doesn't clear cloud rows — local-only reset.
          // Use remove(id) per project if you want cloud cleanup too.
          set({ items: [] })
        },

        syncFromCloud: async () => {
          // Skip if no table available
          const exists = await checkTableExists()
          if (!exists) {
            setStatus('offline')
            return
          }
          setStatus('syncing')
          const result = await fetchAllProjects()
          if (result.skipped) {
            setStatus('offline')
            return
          }
          if (!result.ok || !result.data) {
            setStatus('error', result.error ?? 'Fetch thất bại')
            return
          }
          // Merge cloud rows with local — newer wins by createdAt
          const merged = mergeProjects(get().items, result.data)
          set({ items: merged })
          setStatus('synced', null)
        },
      }
    },
    {
      name: 'landing-page-saved-v1',
      // Persist only the items array; sync state is ephemeral
      partialize: (state) => ({ items: state.items }),
    },
  ),
)
