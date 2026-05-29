// TikTok Shop listings store — Supabase-backed CRUD for saved listings.
// Mirrors the brand-kit pattern (user_outputs table, kind discriminator).
//
// Storage shape:
//   user_outputs row: { id, user_id, kind='tiktok-shop-listing', title, payload_json: ListingOutput }
//
// Auto-save on draft.output change is wired in TikTokShop.tsx via a debounced
// useEffect. Manual save/delete is available for the "history" panel (Phase 6).

import { create } from 'zustand'
import { supabase, requireUserId } from '../../lib/supabase'
import { useAppStore } from '../../stores/appStore'
import type { ListingOutput } from './types'

const KIND = 'tiktok-shop-listing' as const

interface UserOutputRow {
  id: string
  user_id: string
  kind: string
  title: string | null
  payload_json: unknown
  created_at: string
  updated_at: string
}

function rowToListing(row: UserOutputRow): ListingOutput | null {
  const payload = row.payload_json as Partial<ListingOutput> | null
  if (!payload || !payload.images || !payload.description) return null
  // Trust the saved shape — schema migrations can live here later.
  return {
    ...(payload as ListingOutput),
    id: row.id,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

function reportError(action: string, error: { message?: string } | null) {
  if (!error) return
  const msg = error.message ?? String(error)
  console.error(`[tiktokShopListings] ${action}:`, msg)
  try {
    useAppStore.getState().addToast(`${action} thất bại: ${msg}`, 'error')
  } catch { /* appStore not ready */ }
}

// Detect the specific "missing user_outputs table" error so we can
// downgrade it to a silent local-only-mode warning instead of toasting
// the user every few minutes on token refresh. Matches the pattern
// brandKitStore uses.
function isTableMissingError(error: { message?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? String(error)).toLowerCase()
  return msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('user_outputs')
}

interface ListingsStore {
  listings: ListingOutput[]
  hydrated: boolean
  hydrating: boolean

  hydrate: () => Promise<void>
  /** Insert or update (uses id as primary key). */
  save: (listing: ListingOutput) => Promise<void>
  delete: (id: string) => Promise<void>
  getById: (id: string) => ListingOutput | undefined
  /** Most-recently-updated listing — used to restore draft on app open. */
  getMostRecent: () => ListingOutput | undefined
}

// Guard against concurrent hydrates (StrictMode double-invokes effects)
let hydrateInFlight: Promise<void> | null = null

export const useTikTokShopListingsStore = create<ListingsStore>((set, get) => ({
  listings: [],
  hydrated: false,
  hydrating: false,

  hydrate: async () => {
    // Skip if already hydrated this session — Supabase fires onLogin on every
    // token refresh (~hourly), and we don't want to re-fetch + re-toast on
    // every refresh. Caller can manually force-rehydrate by resetting hydrated.
    if (get().hydrated) return
    if (hydrateInFlight) return hydrateInFlight
    hydrateInFlight = (async () => {
      set({ hydrating: true })
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          set({ hydrating: false, hydrated: true })
          return
        }
        const { data, error } = await supabase
          .from('user_outputs')
          .select('*')
          .eq('user_id', user.id)
          .eq('kind', KIND)
          .order('updated_at', { ascending: false })
        if (error) {
          // Silent fallback when the table simply isn't migrated yet — user
          // can still use the app in-memory; saves will just not persist
          // until they run migrations/user_outputs.sql in Supabase.
          if (isTableMissingError(error)) {
            console.warn('[tiktokShopListings] table missing — running in local-only mode until migrations/user_outputs.sql is applied')
          } else {
            reportError('Tải listing', error)
          }
          set({ hydrating: false, hydrated: true })
          return
        }
        const rows = (data ?? []) as UserOutputRow[]
        const listings = rows.map(rowToListing).filter((l): l is ListingOutput => l !== null)
        set({ listings, hydrating: false, hydrated: true })
      } catch (e) {
        const err = { message: e instanceof Error ? e.message : String(e) }
        if (isTableMissingError(err)) {
          console.warn('[tiktokShopListings] table missing — running in local-only mode')
        } else {
          reportError('Tải listing', err)
        }
        set({ hydrating: false, hydrated: true })
      } finally {
        hydrateInFlight = null
      }
    })()
    return hydrateInFlight
  },

  save: async (listing) => {
    // Optimistic upsert in-memory
    const wasExisting = !!get().listings.find((l) => l.id === listing.id)
    set((s) => {
      const next = wasExisting
        ? s.listings.map((l) => (l.id === listing.id ? listing : l))
        : [listing, ...s.listings]
      return { listings: next }
    })

    try {
      const user_id = await requireUserId()
      const title = listing.images.find((i) => i.slot === 1)?.overlay?.headline?.slice(0, 80)
        ?? `Listing ${listing.market.toUpperCase()}`

      // P6-fix: mirror brandKitStore pattern — UPSERT via Supabase was hitting
      // "Could not find the table in the schema cache" when PostgREST couldn't
      // resolve the onConflict target. Switch to explicit insert-OR-update.
      if (wasExisting) {
        const { error } = await supabase
          .from('user_outputs')
          .update({
            title,
            payload_json: listing,
            updated_at: new Date().toISOString(),
          })
          .eq('id', listing.id)
          .eq('user_id', user_id)
          .eq('kind', KIND)
        if (error) {
          if (isTableMissingError(error)) {
            console.warn('[tiktokShopListings] update skipped — table missing (local-only mode)')
          } else {
            reportError('Cập nhật listing', error)
          }
        }
      } else {
        const { error } = await supabase
          .from('user_outputs')
          .insert({
            id: listing.id,
            user_id,
            kind: KIND,
            title,
            payload_json: listing,
          })
        if (error) {
          if (isTableMissingError(error)) {
            console.warn('[tiktokShopListings] insert skipped — table missing (local-only mode)')
          } else {
            reportError('Lưu listing', error)
          }
        }
      }
    } catch (e) {
      reportError('Lưu listing', { message: e instanceof Error ? e.message : String(e) })
    }
  },

  delete: async (id) => {
    const prev = get().listings
    set({ listings: prev.filter((l) => l.id !== id) })
    try {
      const user_id = await requireUserId()
      const { error } = await supabase
        .from('user_outputs')
        .delete()
        .eq('id', id)
        .eq('user_id', user_id)
        .eq('kind', KIND)
      if (error) {
        reportError('Xóa listing', error)
        set({ listings: prev })  // rollback
      }
    } catch (e) {
      reportError('Xóa listing', { message: e instanceof Error ? e.message : String(e) })
      set({ listings: prev })
    }
  },

  getById: (id) => get().listings.find((l) => l.id === id),
  getMostRecent: () => get().listings[0],  // already sorted desc by updated_at
}))
