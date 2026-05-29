import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LandingPagePack, SavedLandingPack } from './types'
import {
  listProjects, createProject, updateProject, deleteProject,
} from '../landing-page/services/projectsAPI'

// ─────────────────────────────────────────────────────────────────────
// Super Ladipage — Supabase-backed persistent workspace.
//
// Shares the `landing_projects` Supabase table with Landing Page AI but
// uses `kind='super-ladipage'` so the two apps stay separated in the
// store, the UI, and the row-level queries. Persistence + sync model
// otherwise IDENTICAL to landing-page/store.ts — see that file for the
// full architectural notes.
//
// localStorage offline cache key remains `super-ladipage-saved-v1` so
// existing pre-Supabase user data continues to load on first boot.
// ─────────────────────────────────────────────────────────────────────

interface SuperLadipageStore {
  items: SavedLandingPack[]
  hydrated: boolean
  hydrating: boolean

  hydrate: () => Promise<void>
  add: (pack: LandingPagePack, title?: string) => SavedLandingPack
  update: (id: string, pack: LandingPagePack) => void
  duplicate: (id: string) => SavedLandingPack | null
  getById: (id: string) => SavedLandingPack | undefined
  remove: (id: string) => void
  updateTitle: (id: string, title: string) => void
  clear: () => void
}

const KIND = 'super-ladipage' as const

export const useSuperLadipageStore = create<SuperLadipageStore>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      hydrating: false,

      hydrate: async () => {
        if (get().hydrating) return
        set({ hydrating: true })
        try {
          const remote = await listProjects<SavedLandingPack>(KIND)
          if (remote === null) {
            set({ hydrating: false, hydrated: true })
            return
          }

          const localItems = get().items
          const remoteIds = new Set(remote.map((r) => r.id))
          const localOnly = localItems.filter((loc) => !remoteIds.has(loc.id))

          if (localOnly.length > 0 && remote.length === 0) {
            console.info(`[superLadipageStore] first-sync: uploading ${localOnly.length} local items`)
            for (const item of localOnly) {
              await createProject(KIND, item)
            }
            const refreshed = await listProjects<SavedLandingPack>(KIND)
            set({
              items: refreshed ?? localItems,
              hydrating: false,
              hydrated: true,
            })
            return
          }

          const merged = [...remote, ...localOnly]
          set({ items: merged, hydrating: false, hydrated: true })
        } catch (err) {
          console.error('[superLadipageStore] hydrate failed:', err)
          set({ hydrating: false, hydrated: true })
        }
      },

      add: (pack, title) => {
        const saved: SavedLandingPack = {
          ...pack,
          id: crypto.randomUUID(),
          title: (title?.trim() || `${pack.productName} — Landing Pack`).slice(0, 160),
          createdAt: Date.now(),
        }
        set((s) => ({ items: [saved, ...s.items] }))
        void createProject(KIND, saved)
        return saved
      },

      update: (id, pack) => {
        set((s) => ({
          items: s.items.map((x) =>
            x.id === id
              ? {
                  ...x,
                  ...pack,
                  id: x.id,
                  title: x.title,
                  createdAt: x.createdAt,
                }
              : x,
          ),
        }))
        void updateProject(KIND, id, pack)
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
        void createProject(KIND, copy)
        return copy
      },

      getById: (id) => get().items.find((x) => x.id === id),

      remove: (id) => {
        set((s) => ({ items: s.items.filter((x) => x.id !== id) }))
        void deleteProject(KIND, id)
      },

      updateTitle: (id, title) => {
        const trimmed = title.slice(0, 160)
        set((s) => ({
          items: s.items.map((x) => x.id === id ? { ...x, title: trimmed } : x),
        }))
        const item = get().items.find((x) => x.id === id)
        if (item) void updateProject(KIND, id, item, trimmed)
      },

      clear: () => set({ items: [] }),
    }),
    { name: 'super-ladipage-saved-v1' },
  ),
)
