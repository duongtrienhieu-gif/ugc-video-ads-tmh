import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedAdsContent } from './types'

// ─────────────────────────────────────────────────────────────────────────
// Local-only persistence for Ads Content (Project → Ads Content section).
// Stores in browser localStorage under `ads-content-saved-v1`. This is
// intentionally NOT wired into the Supabase-backed bankStore yet — the
// `ads_content` table would need to be provisioned on the backend first.
// Migration path: copy items[] into bankStore.adsContent and let bankStore
// take over.
// ─────────────────────────────────────────────────────────────────────────

interface AdsContentStore {
  items: SavedAdsContent[]
  add: (item: Omit<SavedAdsContent, 'id' | 'createdAt'>) => SavedAdsContent
  remove: (id: string) => void
  updateTitle: (id: string, title: string) => void
  clear: () => void
}

export const useAdsContentStore = create<AdsContentStore>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => {
        const saved: SavedAdsContent = {
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
    { name: 'ads-content-saved-v1' },
  ),
)
