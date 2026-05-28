import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
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
// Brand Kit store — Supabase + localStorage hybrid (mirrors lab-content).
//
// Primary: in-memory state, mirrored to localStorage via zustand persist.
// Secondary: Supabase user_outputs (kind='brand-kit') for cross-device sync.
//
// Why hybrid:
//   • Pure localStorage hit "exceeded the quota" on busy installs.
//   • Pure Supabase fails with "Could not find table user_outputs" until
//     the user runs the migration in SUPABASE_USER_OUTPUTS_MIGRATION.md.
//   • Hybrid: save lands locally instantly; Supabase sync is fire-and-
//     forget; users without the migration still get a working app and
//     a one-time toast pointing them at the migration.
//
// Migration SQL: see SUPABASE_USER_OUTPUTS_MIGRATION.md at repo root.
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

// ── Error formatting ─────────────────────────────────────────────────────

function formatError(err: unknown): string {
  if (!err) return 'Lỗi không xác định'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object') {
    const e = err as { message?: string; error?: string; details?: string; hint?: string; code?: string }
    if (e.message) return e.message
    if (e.error) return e.error
    if (e.details) return e.details
    if (e.hint) return e.hint
    if (e.code) return `code ${e.code}`
    try { return JSON.stringify(err) } catch { return String(err) }
  }
  return String(err)
}

function isMissingTableError(err: unknown): boolean {
  const msg = formatError(err).toLowerCase()
  return msg.includes('user_outputs') && (msg.includes('schema cache') || msg.includes('does not exist'))
}

// One-shot flag so we only nag the user about the migration ONCE per session.
let warnedAboutMigration = false

function warnAboutMigrationOnce() {
  if (warnedAboutMigration) return
  warnedAboutMigration = true
  try {
    useAppStore.getState().addToast(
      'Brand Kit lưu vào máy này, chưa đồng bộ. Mở SUPABASE_USER_OUTPUTS_MIGRATION.md ở repo và chạy SQL để bật sync đa thiết bị.',
      'info',
    )
  } catch { /* appStore not ready */ }
}

function reportError(action: string, err: unknown) {
  if (isMissingTableError(err)) {
    // Don't spam the user with the same error for every CRUD. Show the
    // migration hint once; subsequent failures stay silent (local save
    // still works, sync is just disabled).
    warnAboutMigrationOnce()
    console.warn(`[brandKitStore] ${action}: table missing — running in local-only mode until migration applied.`)
    return
  }
  const msg = formatError(err)
  console.error(`[brandKitStore] ${action}:`, msg, err)
  try {
    useAppStore.getState().addToast(`${action} thất bại: ${msg}`, 'error')
  } catch { /* appStore not ready */ }
}

// ── IndexedDB-backed storage ─────────────────────────────────────────────
//
// localStorage in this app is near-quota because other UGC Lab stores
// (lab-content, super-ladipage, ads-content, settings…) compete for the
// same 5-10MB. Brand Kit saves were silently dropped on quota errors
// → kit appeared in memory, vanished on refresh.
//
// IndexedDB gives us 50MB+ per origin, on a completely separate quota
// from localStorage, so brand kit metadata writes can't be starved by
// any other store. One DB, one object store, one key per persist name.
//
// Sync getItem is impossible with IDB — we shim it by mirroring the
// last-loaded value into an in-memory cache populated on first load.
// zustand persist calls getItem at store create, async-waits on the
// returned Promise.

const IDB_NAME    = 'ugc-lab-kv'
const IDB_STORE   = 'kv'
const IDB_VERSION = 1

let idbOpenPromise: Promise<IDBDatabase> | null = null

function openIdb(): Promise<IDBDatabase> {
  if (idbOpenPromise) return idbOpenPromise
  idbOpenPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    } catch (err) {
      reject(err)
    }
  })
  return idbOpenPromise
}

async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openIdb()
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[brandKitStore] IDB get failed', err)
    return null
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openIdb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('[brandKitStore] IDB set failed', err)
  }
}

async function idbDel(key: string): Promise<void> {
  try {
    const db = await openIdb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('[brandKitStore] IDB delete failed', err)
  }
}

const idbStorage = createJSONStorage(() => ({
  getItem:    (name: string) => idbGet(name),
  setItem:    (name: string, value: string) => idbSet(name, value),
  removeItem: (name: string) => idbDel(name),
}))

// One-shot migration: copy any kits previously stuck in localStorage
// over to IDB so a hard refresh doesn't lose work. Runs at module load
// before zustand persist calls getItem, so the IDB read picks it up.
;(function migrateLegacyLocalStorage() {
  if (typeof window === 'undefined') return
  const key = 'ugc-lab:brand-kits'
  let legacy: string | null = null
  try { legacy = localStorage.getItem(key) } catch { /* silent */ }
  if (!legacy) return
  void idbGet(key).then((existing) => {
    if (existing) return
    void idbSet(key, legacy as string).then(() => {
      try { localStorage.removeItem(key) } catch { /* silent */ }
      console.info('[brandKitStore] migrated legacy localStorage entry to IndexedDB')
    })
  })
})()

// Guard against concurrent hydrate calls (React StrictMode runs effects twice)
let hydrateInFlight: Promise<void> | null = null

export const useBrandKitStore = create<BrandKitStore>()(
  persist(
    (set, get) => ({
      brandKits: [],
      hydrated: false,
      hydrating: false,

      hydrate: async () => {
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
              reportError('Tải Brand Kit', error)
              // Keep whatever is already in localStorage cache.
              set({ hydrating: false, hydrated: true })
              return
            }
            const remote = (data as UserOutputRow[]).map(rowToBrandKit)
            const local = get().brandKits
            const remoteIds = new Set(remote.map((r) => r.id))
            const localOnly = local.filter((l) => !remoteIds.has(l.id))

            // First-sync: if we have local items the cloud doesn't, push
            // them up so the next device load can see them too. Best
            // effort — failures stay local-only.
            if (localOnly.length > 0 && remote.length === 0) {
              for (const kit of localOnly) {
                await supabase
                  .from('user_outputs')
                  .insert({
                    id: kit.id,
                    user_id: user.id,
                    kind: KIND,
                    title: kit.name,
                    payload_json: kit,
                  })
                  .then(({ error: insErr }) => {
                    if (insErr) console.warn('[brandKitStore] first-sync insert failed', insErr.message)
                  })
              }
            }

            set({ brandKits: [...remote, ...localOnly], hydrating: false, hydrated: true })
          } catch (e) {
            reportError('Tải Brand Kit', e)
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
        // Local-first. The user gets immediate feedback even if the
        // cloud write fails / table is missing.
        set((s) => ({ brandKits: [next, ...s.brandKits] }))
        // Cloud sync, fire-and-forget but reportError() on failure.
        try {
          const user_id = await requireUserId()
          const { error } = await supabase
            .from('user_outputs')
            .insert({
              id,
              user_id,
              kind: KIND,
              title: next.name,
              payload_json: next,
            })
          if (error) reportError('Đồng bộ Brand Kit lên cloud', error)
        } catch (e) {
          reportError('Đồng bộ Brand Kit lên cloud', e)
        }
        return next
      },

      update: async (id, patch) => {
        const nowIso = new Date().toISOString()
        const current = get().brandKits.find((k) => k.id === id)
        if (!current) return
        const merged: BrandKit = { ...current, ...patch, id, version: 1, updatedAt: nowIso }
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
          if (error) reportError('Đồng bộ cập nhật Brand Kit', error)
        } catch (e) {
          reportError('Đồng bộ cập nhật Brand Kit', e)
        }
      },

      delete: async (id) => {
        const kit = get().brandKits.find((k) => k.id === id)
        set((s) => ({ brandKits: s.brandKits.filter((k) => k.id !== id) }))

        if (kit) {
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
          if (error) reportError('Đồng bộ xóa Brand Kit', error)
        } catch (e) {
          reportError('Đồng bộ xóa Brand Kit', e)
        }
      },
    }),
    {
      name: 'ugc-lab:brand-kits',
      storage: idbStorage,
      // Only persist the array — hydrated/hydrating flags are session state.
      partialize: (s) => ({ brandKits: s.brandKits }),
    },
  ),
)

// ── Public helper: resolve assets → blob URLs + merge localization ──────

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
