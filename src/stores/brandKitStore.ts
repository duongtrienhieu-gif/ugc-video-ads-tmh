import { create } from 'zustand'
import {
  FONT_WHITELIST,
  type BrandKit,
  type Market,
  type ResolvedBrandKit,
  type WhitelistedFont,
} from '../types/brandKit'
import { getUrl, deleteAsset } from '../utils/assetStore'
import { supabase, requireUserId } from '../lib/supabase'
import { useAppStore } from './appStore'

// ─────────────────────────────────────────────────────────────────────────
// Brand Kit store — Supabase-backed (user_outputs table, kind='brand-kit').
//
// We DO NOT persist to localStorage. Earlier version used zustand persist
// which led to "Setting the value of 'ugc-lab:brand-kits' exceeded the
// quota" when localStorage was already nearly full from other UGC Lab
// stores (lab-content, super-ladipage…). Supabase is the single source of
// truth; in-memory state hydrates on login, gets rewritten on every CRUD.
//
// Pattern mirrors src/apps/lab-content/store.ts.
// ─────────────────────────────────────────────────────────────────────────

const KIND = 'brand-kit' as const

interface BrandKitStore {
  brandKits: BrandKit[]
  hydrated: boolean
  hydrating: boolean

  hydrate: () => Promise<void>
  getById: (id: string) => BrandKit | undefined
  getActiveForMarket: (market: Market) => BrandKit[]
  create: (
    kit: Omit<BrandKit, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ) => Promise<BrandKit>
  update: (id: string, patch: Partial<BrandKit>) => Promise<void>
  delete: (id: string) => Promise<void>
}

// ── Supabase row helpers ─────────────────────────────────────────────────

interface UserOutputRow {
  id: string
  user_id: string
  kind: string
  title: string | null
  payload_json: unknown
  created_at: string
  updated_at: string
}

function rowToBrandKit(row: UserOutputRow): BrandKit {
  const payload = (row.payload_json ?? {}) as Partial<BrandKit>
  return {
    // Row-level fields win over payload
    id: row.id,
    name: payload.name ?? row.title ?? '',
    category: payload.category ?? 'other',
    isExistingBrand: !!payload.isExistingBrand,
    version: 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    logoAssetId: payload.logoAssetId ?? '',
    logoMonoAssetId: payload.logoMonoAssetId,
    palette: payload.palette ?? { primary: '', secondary: '', cta: '' },
    typography: payload.typography ?? { display: 'Inter', body: 'Inter' },
    badges: payload.badges ?? [],
    flagOrigin: payload.flagOrigin,
    storeName: payload.storeName ?? '',
    tagline: payload.tagline,
    voice: payload.voice ?? {},
    cta: payload.cta,
    markets: payload.markets ?? ['ms'],
    allowSecondaryLanguage: payload.allowSecondaryLanguage ?? null,
    localizations: payload.localizations,
  }
}

function reportError(action: string, error: { message?: string } | null) {
  if (!error) return
  const msg = error.message ?? String(error)
  console.error(`[brandKitStore] ${action}:`, msg)
  try {
    useAppStore.getState().addToast(`${action} thất bại: ${msg}`, 'error')
  } catch { /* appStore not ready */ }
}

// Guard against concurrent hydrate calls (React StrictMode runs effects twice)
let hydrateInFlight: Promise<void> | null = null

export const useBrandKitStore = create<BrandKitStore>((set, get) => ({
  brandKits: [],
  hydrated: false,
  hydrating: false,

  hydrate: async () => {
    if (hydrateInFlight) return hydrateInFlight
    hydrateInFlight = (async () => {
      set({ hydrating: true })
      // One-shot cleanup of the deprecated zustand-persist key from the
      // localStorage-only version. Frees quota for users who saw the
      // 'exceeded the quota' error. Safe to delete: data was never
      // persisting beyond this tab (or was failing to save outright).
      try { localStorage.removeItem('ugc-lab:brand-kits') } catch { /* silent */ }
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
          reportError('Tải Brand Kit', error)
          set({ hydrating: false, hydrated: true })
          return
        }
        const kits = (data as UserOutputRow[]).map(rowToBrandKit)
        set({ brandKits: kits, hydrating: false, hydrated: true })
      } catch (e) {
        reportError('Tải Brand Kit', { message: e instanceof Error ? e.message : String(e) })
        set({ hydrating: false, hydrated: true })
      } finally {
        hydrateInFlight = null
      }
    })()
    return hydrateInFlight
  },

  getById: (id) => get().brandKits.find((k) => k.id === id),

  getActiveForMarket: (market) =>
    get().brandKits.filter((k) => k.markets.includes(market)),

  create: async (kit) => {
    const id = crypto.randomUUID()
    const nowIso = new Date().toISOString()
    const next: BrandKit = {
      ...kit,
      id,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    // Optimistic insert
    set((s) => ({ brandKits: [next, ...s.brandKits] }))
    try {
      const user_id = await requireUserId()
      const { data: row, error } = await supabase
        .from('user_outputs')
        .insert({
          id,
          user_id,
          kind: KIND,
          title: next.name,
          payload_json: next,
        })
        .select()
        .single()
      if (error) {
        reportError('Lưu Brand Kit', error)
        // Roll back optimistic state so the user can retry / see the
        // error rather than thinking the save succeeded.
        set((s) => ({ brandKits: s.brandKits.filter((k) => k.id !== id) }))
        throw error
      } else if (row) {
        const persisted = rowToBrandKit(row as UserOutputRow)
        set((s) => ({
          brandKits: s.brandKits.map((k) => (k.id === id ? persisted : k)),
        }))
        return persisted
      }
    } catch (e) {
      reportError('Lưu Brand Kit', { message: e instanceof Error ? e.message : String(e) })
      set((s) => ({ brandKits: s.brandKits.filter((k) => k.id !== id) }))
      throw e
    }
    return next
  },

  update: async (id, patch) => {
    const nowIso = new Date().toISOString()
    const current = get().brandKits.find((k) => k.id === id)
    if (!current) return
    const merged: BrandKit = { ...current, ...patch, id, version: 1, updatedAt: nowIso }
    // Optimistic
    set((s) => ({
      brandKits: s.brandKits.map((k) => (k.id === id ? merged : k)),
    }))
    try {
      const user_id = await requireUserId()
      const { error } = await supabase
        .from('user_outputs')
        .update({ title: merged.name, payload_json: merged })
        .eq('id', id)
        .eq('user_id', user_id)
        .eq('kind', KIND)
      if (error) {
        reportError('Cập nhật Brand Kit', error)
        set((s) => ({
          brandKits: s.brandKits.map((k) => (k.id === id ? current : k)),
        }))
      }
    } catch (e) {
      reportError('Cập nhật Brand Kit', { message: e instanceof Error ? e.message : String(e) })
    }
  },

  delete: async (id) => {
    const kit = get().brandKits.find((k) => k.id === id)
    // Optimistic remove
    set((s) => ({ brandKits: s.brandKits.filter((k) => k.id !== id) }))

    if (kit) {
      // Best-effort clean-up of orphaned assets. Errors swallowed —
      // the metadata removal MUST proceed even if the asset store
      // can't be reached.
      const ids = [
        kit.logoAssetId,
        kit.logoMonoAssetId,
        ...kit.badges.map((b) => b.assetId),
      ].filter((v): v is string => !!v)
      await Promise.all(ids.map((aid) => deleteAsset(aid).catch(() => {})))
    }

    try {
      const user_id = await requireUserId()
      const { error } = await supabase
        .from('user_outputs')
        .delete()
        .eq('id', id)
        .eq('user_id', user_id)
        .eq('kind', KIND)
      if (error) {
        reportError('Xóa Brand Kit', error)
        if (kit) set((s) => ({ brandKits: [kit, ...s.brandKits] }))
      }
    } catch (e) {
      reportError('Xóa Brand Kit', { message: e instanceof Error ? e.message : String(e) })
      if (kit) set((s) => ({ brandKits: [kit, ...s.brandKits] }))
    }
  },
}))

// ── Public helper: resolve assets → blob URLs + merge localization ──────
//
// TikTok Shop app (separate session) calls this when it needs to render
// a kit. Returns ResolvedBrandKit with signed URLs ready for <img>.
//
// Falls back to empty string URLs for assets that can't be resolved —
// caller should run `isBrandKitReady` first to surface those gaps to user.
export async function getResolvedBrandKit(
  id: string,
  market: Market,
): Promise<ResolvedBrandKit> {
  const kit = useBrandKitStore.getState().getById(id)
  if (!kit) throw new Error(`Không tìm thấy Brand Kit: ${id}`)

  const [logoUrl, logoMonoUrl, ...badgeUrls] = await Promise.all([
    getUrl(kit.logoAssetId),
    kit.logoMonoAssetId ? getUrl(kit.logoMonoAssetId) : Promise.resolve(null),
    ...kit.badges.map((b) => getUrl(b.assetId)),
  ])

  const loc = kit.localizations?.[market] ?? {}

  const resolved: ResolvedBrandKit = {
    ...kit,
    logo: { blobUrl: logoUrl ?? '', width: 0, height: 0 },
    logoMono: logoMonoUrl
      ? { blobUrl: logoMonoUrl, width: 0, height: 0 }
      : undefined,
    badges: kit.badges.map((b, i) => ({
      name: b.name,
      blobUrl: badgeUrls[i] ?? '',
      width: 0,
      height: 0,
    })),
    market,
    tagline: loc.tagline ?? kit.tagline,
    voice: {
      tone: kit.voice.tone,
      vocabulary: loc.voice?.vocabulary ?? kit.voice.vocabulary,
      samplePhrases: loc.voice?.samplePhrases ?? kit.voice.samplePhrases,
    },
    cta: loc.cta ?? kit.cta,
  }
  return resolved
}

// ── Validation ───────────────────────────────────────────────────────────

export function isBrandKitReady(kit: BrandKit): { ready: boolean; missing: string[] } {
  const missing: string[] = []

  if (!kit.logoAssetId) missing.push('Logo')

  if (!isValidHex(kit.palette?.primary))   missing.push('Màu chính (primary)')
  if (!isValidHex(kit.palette?.secondary)) missing.push('Màu phụ (secondary)')
  if (!isValidHex(kit.palette?.cta))       missing.push('Màu CTA')

  const fonts = FONT_WHITELIST as readonly string[]
  if (!fonts.includes(kit.typography?.display as WhitelistedFont)) missing.push('Font display')
  if (!fonts.includes(kit.typography?.body    as WhitelistedFont)) missing.push('Font body')

  if (!kit.storeName || !kit.storeName.trim()) missing.push('Tên cửa hàng')
  if (!Array.isArray(kit.markets) || kit.markets.length < 1) missing.push('Thị trường')

  return { ready: missing.length === 0, missing }
}

function isValidHex(s: string | undefined): boolean {
  if (!s) return false
  return /^#[0-9A-Fa-f]{6}$/.test(s.trim())
}
