import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LandingPagePack, SavedLandingPack } from './types'

// ─────────────────────────────────────────────────────────────────────
// Landing Page Projects — Canva/Figma-style persistent workspace.
// Stored in browser localStorage under `landing-page-saved-v1`.
//
// Workflow:
//   1. User generates pack → uses useSessionPersist (in-flight auto-save)
//   2. User clicks "Lưu LandingPage" → add() creates a new SavedLandingPack
//   3. From then on, edits auto-sync via update(id, pack) — no manual save needed
//   4. User can return any time via "Tiếp tục chỉnh sửa" → loaded back as active
//   5. Duplicate / Export JSON / Rename available per project
//
// Migration: when backend provisions a `landing_pages` table, copy items[]
// into a bankStore field and let the Supabase-backed layer take over.
// ─────────────────────────────────────────────────────────────────────

interface LandingPageStore {
  items: SavedLandingPack[]
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
}

export const useLandingPageStore = create<LandingPageStore>()(
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
                // Carry pack content over but preserve identity fields (id/title/createdAt)
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
    { name: 'landing-page-saved-v1' },
  ),
)
