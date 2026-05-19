import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LandingPagePack, SavedLandingPack } from './types'
import {
  listProjects, createProject, updateProject, deleteProject,
} from './services/projectsAPI'

// ─────────────────────────────────────────────────────────────────────
// Landing Page Projects — Supabase-backed Canva/Figma-style workspace.
//
// Persistence layers (lowest to highest priority):
//   1. zustand persist → localStorage key `landing-page-saved-v1`
//      Acts as an OFFLINE CACHE so the app boots with last-known
//      projects visible immediately, even before Supabase responds.
//   2. Supabase table `landing_projects` (kind='landing-page')
//      Source of truth. Cross-device. Per-user via RLS.
//
// Sync model:
//   • On login → hydrate(): listProjects(...) replaces items[] with the
//     server state. If the server is empty but localStorage has items
//     (first-sync after upgrade), local items are uploaded to Supabase.
//   • add() / update() / remove() / duplicate() / updateTitle() all
//     write through to Supabase fire-and-forget; localStorage stays in
//     sync via the zustand persist middleware so quick reloads work
//     without waiting for the network round-trip.
//
// Degradation:
//   • If Supabase is unreachable / table missing / user not logged in,
//     all calls return null/false. The app continues working off the
//     localStorage cache — same UX as the pre-Supabase version. The
//     SUPABASE_LANDING_PROJECTS_MIGRATION.md doc explains the required
//     migration; until run, cross-device sync is disabled but in-browser
//     UX is unchanged.
// ─────────────────────────────────────────────────────────────────────

interface LandingPageStore {
  items: SavedLandingPack[]
  /** True after the first hydrate() attempt has completed (success OR fail). */
  hydrated: boolean
  /** True while a hydrate() call is in flight — used to dedupe parallel mounts. */
  hydrating: boolean

  /** Pull projects from Supabase and reconcile with local cache. Idempotent.
   *  Caller should invoke this once after auth resolves (App.tsx does this). */
  hydrate: () => Promise<void>
  add: (pack: LandingPagePack, title?: string) => SavedLandingPack
  update: (id: string, pack: LandingPagePack) => void
  duplicate: (id: string) => SavedLandingPack | null
  getById: (id: string) => SavedLandingPack | undefined
  remove: (id: string) => void
  updateTitle: (id: string, title: string) => void
  clear: () => void
}

const KIND = 'landing-page' as const

export const useLandingPageStore = create<LandingPageStore>()(
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
            // Supabase fetch failed — keep localStorage state intact and
            // continue. User still sees their projects on this device;
            // they just won't sync until the network / table is ready.
            set({ hydrating: false, hydrated: true })
            return
          }

          const localItems = get().items
          const remoteIds = new Set(remote.map((r) => r.id))
          const localOnly = localItems.filter((loc) => !remoteIds.has(loc.id))

          // First-sync upload — when the user upgrades, their existing
          // localStorage projects need to be uploaded once. We trigger
          // this only when remote is empty AND local has items (otherwise
          // we'd duplicate every login on a multi-device account).
          if (localOnly.length > 0 && remote.length === 0) {
            console.info(`[landingPageStore] first-sync: uploading ${localOnly.length} local items`)
            for (const item of localOnly) {
              // Sequential to keep order stable + avoid RLS rate limits
              await createProject(KIND, item)
            }
            // Re-fetch so the createdAt timestamps reflect Supabase's
            // values; ordering then follows updated_at DESC.
            const refreshed = await listProjects<SavedLandingPack>(KIND)
            set({
              items: refreshed ?? localItems,
              hydrating: false,
              hydrated: true,
            })
            return
          }

          // Normal merge — remote wins on conflict; any local-only items
          // (offline writes not yet synced) are kept in front so the user
          // doesn't lose unsynced work. They'll get uploaded next time a
          // write triggers (or via the same first-sync path if remote
          // becomes empty again).
          const merged = [...remote, ...localOnly]
          set({ items: merged, hydrating: false, hydrated: true })
        } catch (err) {
          console.error('[landingPageStore] hydrate failed:', err)
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
        // Fire-and-forget Supabase write — localStorage already updated.
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
        // Send the full pack so Supabase has the latest body too, not
        // just the title in isolation. Avoids drift between local and
        // remote when this is the only call between two updates.
        const item = get().items.find((x) => x.id === id)
        if (item) void updateProject(KIND, id, item, trimmed)
      },

      clear: () => set({ items: [] }),
    }),
    { name: 'landing-page-saved-v1' },
  ),
)
