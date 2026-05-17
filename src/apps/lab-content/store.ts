import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedLabBrief } from './types'

// ─────────────────────────────────────────────────────────────────────────
// Local-only persistence for saved Lab Content briefs.
// Stores in browser localStorage under `lab-content-saved-v1`.
// Mirrors the Ads Content store pattern. Migration path to Supabase later.
// ─────────────────────────────────────────────────────────────────────────

interface LabContentStore {
  items: SavedLabBrief[]
  add: (item: Omit<SavedLabBrief, 'id' | 'createdAt'>) => SavedLabBrief
  remove: (id: string) => void
  updateTitle: (id: string, title: string) => void
  clear: () => void
}

export const useLabContentStore = create<LabContentStore>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => {
        const saved: SavedLabBrief = {
          ...item,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        }
        set((s) => ({ items: [saved, ...s.items] }))
        return saved
      },
      remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
      updateTitle: (id, title) => set((s) => ({
        items: s.items.map((x) => x.id === id ? { ...x, title } : x),
      })),
      clear: () => set({ items: [] }),
    }),
    { name: 'lab-content-saved-v1' },
  ),
)
