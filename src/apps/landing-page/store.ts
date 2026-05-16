import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LandingPagePack, SavedLandingPack } from './types'

// ─────────────────────────────────────────────────────────────────────
// Local-only persistence for Landing Page packs.
// Stored in browser localStorage under `landing-page-saved-v1`.
// Migration path (same as ads-content): when the backend provisions a
// `landing_pages` table, copy items[] into a bankStore field and let
// the Supabase-backed layer take over.
// ─────────────────────────────────────────────────────────────────────

interface LandingPageStore {
  items: SavedLandingPack[]
  add: (pack: LandingPagePack, title?: string) => SavedLandingPack
  remove: (id: string) => void
  updateTitle: (id: string, title: string) => void
  clear: () => void
}

export const useLandingPageStore = create<LandingPageStore>()(
  persist(
    (set) => ({
      items: [],
      add: (pack, title) => {
        const saved: SavedLandingPack = {
          ...pack,
          id: crypto.randomUUID(),
          title: (title?.trim() || `${pack.productName} — Landing Pack`).slice(0, 160),
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
    { name: 'landing-page-saved-v1' },
  ),
)
