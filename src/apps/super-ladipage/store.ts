import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LandingPagePack, SavedLandingPack } from './types'

// ─────────────────────────────────────────────────────────────────────
// Super Ladipage — Canva/Figma-style persistent workspace.
// Stored in browser localStorage under `super-ladipage-saved-v1` —
// HOÀN TOÀN TÁCH BIỆT với Landing Page AI cũ (`landing-page-saved-v1`).
//
// Workflow:
//   1. User generate pack → useSessionPersist auto-save trong khi đang chạy
//   2. User click "Lưu LandingPage" → add() tạo SavedLandingPack mới
//   3. Mọi edit sau đó tự sync qua update(id, pack)
//   4. User có thể quay lại bất kỳ lúc nào qua "Tiếp tục chỉnh sửa"
// ─────────────────────────────────────────────────────────────────────

interface SuperLadipageStore {
  items: SavedLandingPack[]
  add: (pack: LandingPagePack, title?: string) => SavedLandingPack
  update: (id: string, pack: LandingPagePack) => void
  duplicate: (id: string) => SavedLandingPack | null
  getById: (id: string) => SavedLandingPack | undefined
  remove: (id: string) => void
  updateTitle: (id: string, title: string) => void
  clear: () => void
}

export const useSuperLadipageStore = create<SuperLadipageStore>()(
  persist(
    (set, get) => ({
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
      update: (id, pack) => set((s) => ({
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
      })),
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
        return copy
      },
      getById: (id) => get().items.find((x) => x.id === id),
      remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
      updateTitle: (id, title) => set((s) => ({
        items: s.items.map((x) => x.id === id ? { ...x, title: title.slice(0, 160) } : x),
      })),
      clear: () => set({ items: [] }),
    }),
    { name: 'super-ladipage-saved-v1' },
  ),
)
