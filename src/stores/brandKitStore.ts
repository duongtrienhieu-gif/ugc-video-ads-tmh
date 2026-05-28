import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  FONT_WHITELIST,
  type BrandKit,
  type Market,
  type ResolvedBrandKit,
  type WhitelistedFont,
} from '../types/brandKit'
import { getUrl, deleteAsset } from '../utils/assetStore'

// localStorage key per spec section 8: `ugc-lab:brand-kits`.
// The list itself is metadata; logo / badge images live in the asset store.
const STORAGE_KEY = 'ugc-lab:brand-kits'

interface BrandKitStore {
  brandKits: BrandKit[]

  getById: (id: string) => BrandKit | undefined
  getActiveForMarket: (market: Market) => BrandKit[]
  create: (
    kit: Omit<BrandKit, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ) => Promise<BrandKit>
  update: (id: string, patch: Partial<BrandKit>) => Promise<void>
  delete: (id: string) => Promise<void>
}

export const useBrandKitStore = create<BrandKitStore>()(
  persist(
    (set, get) => ({
      brandKits: [],

      getById: (id) => get().brandKits.find((k) => k.id === id),

      getActiveForMarket: (market) =>
        get().brandKits.filter((k) => k.markets.includes(market)),

      create: async (kit) => {
        const now = new Date().toISOString()
        const next: BrandKit = {
          ...kit,
          id: crypto.randomUUID(),
          version: 1,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ brandKits: [next, ...s.brandKits] }))
        return next
      },

      update: async (id, patch) => {
        const now = new Date().toISOString()
        set((s) => ({
          brandKits: s.brandKits.map((k) =>
            k.id === id ? { ...k, ...patch, id: k.id, version: 1, updatedAt: now } : k,
          ),
        }))
      },

      delete: async (id) => {
        const kit = get().brandKits.find((k) => k.id === id)
        if (kit) {
          // Best-effort clean-up of orphaned assets. Errors swallowed —
          // the metadata removal MUST proceed even if the asset store
          // can't be reached (offline / quota / RLS).
          const ids = [
            kit.logoAssetId,
            kit.logoMonoAssetId,
            ...kit.badges.map((b) => b.assetId),
          ].filter((v): v is string => !!v)
          await Promise.all(ids.map((aid) => deleteAsset(aid).catch(() => {})))
        }
        set((s) => ({ brandKits: s.brandKits.filter((k) => k.id !== id) }))
      },
    }),
    { name: STORAGE_KEY },
  ),
)

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
    // Apply per-market localization on top
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
//
// TikTok Shop disables "Generate" when ready === false and shows the
// missing fields to the user. Keep the messages user-friendly in Vietnamese.
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
