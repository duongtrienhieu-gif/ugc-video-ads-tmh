import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedLabBrief } from './types'
import {
  listOutputs, createOutput, updateOutput, deleteOutput,
} from '../../services/userOutputsAPI'

// ─────────────────────────────────────────────────────────────────────────
// Lab Content store — Supabase-backed for cross-device sync.
//
// Persistence layers:
//   1. zustand persist → localStorage `lab-content-saved-v1` (offline cache)
//   2. Supabase `user_outputs` table with kind='lab-content' (source of truth)
//
// Same sync pattern as Landing Page projects — hydrate() on login, first-
// sync upload local-only items, fire-and-forget writes for create/update/
// delete. Falls back to localStorage-only mode if Supabase is unreachable.
// ─────────────────────────────────────────────────────────────────────────

const KIND = 'lab-content' as const

interface LabContentStore {
  items: SavedLabBrief[]
  hydrated: boolean
  hydrating: boolean

  hydrate: () => Promise<void>
  add: (item: Omit<SavedLabBrief, 'id' | 'createdAt'>) => SavedLabBrief
  remove: (id: string) => void
  updateTitle: (id: string, title: string) => void
  clear: () => void
}

export const useLabContentStore = create<LabContentStore>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      hydrating: false,

      hydrate: async () => {
        if (get().hydrating) return
        set({ hydrating: true })
        try {
          const remote = await listOutputs<SavedLabBrief>(KIND)
          if (remote === null) {
            set({ hydrating: false, hydrated: true })
            return
          }
          const local = get().items
          const remoteIds = new Set(remote.map((r) => r.id))
          const localOnly = local.filter((l) => !remoteIds.has(l.id))

          if (localOnly.length > 0 && remote.length === 0) {
            console.info(`[labContentStore] first-sync: uploading ${localOnly.length} local items`)
            for (const item of localOnly) {
              await createOutput(KIND, item, item.title)
            }
            const refreshed = await listOutputs<SavedLabBrief>(KIND)
            set({ items: refreshed ?? local, hydrating: false, hydrated: true })
            return
          }

          set({ items: [...remote, ...localOnly], hydrating: false, hydrated: true })
        } catch (err) {
          console.error('[labContentStore] hydrate failed:', err)
          set({ hydrating: false, hydrated: true })
        }
      },

      add: (item) => {
        const saved: SavedLabBrief = {
          ...item,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        } as SavedLabBrief
        set((s) => ({ items: [saved, ...s.items] }))
        void createOutput(KIND, saved, saved.title)
        return saved
      },

      remove: (id) => {
        set((s) => ({ items: s.items.filter((x) => x.id !== id) }))
        void deleteOutput(KIND, id)
      },

      updateTitle: (id, title) => {
        const trimmed = title.slice(0, 160)
        set((s) => ({
          items: s.items.map((x) => x.id === id ? { ...x, title: trimmed } : x),
        }))
        const item = get().items.find((x) => x.id === id)
        if (item) void updateOutput(KIND, id, item, trimmed)
      },

      clear: () => set({ items: [] }),
    }),
    { name: 'lab-content-saved-v1' },
  ),
)
