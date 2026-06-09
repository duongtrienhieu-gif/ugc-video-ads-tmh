// Research module — Zustand store.
// Đọc data THẬT từ Supabase (research_products); nếu chưa có / lỗi bảng → fallback
// về SAMPLE_PRODUCTS để app vẫn dùng được. UI không phải đổi.
import { create } from 'zustand'
import { supabase } from '../../lib/supabase'
import type { Market, NicheKey, ResearchProduct, ScoredProduct, SkuRisk } from './types'
import { DEFAULT_FILTERS, type ResearchFilters, type PresetKey, PRESETS } from './constants'
import { SAMPLE_PRODUCTS } from './sampleData'
import { scoreMany } from './services/scoring'
import { classifyNiche, classifySkuRisk } from './services/niche'

export interface DbVideo {
  videoId: string; market: Market; description: string; handle: string
  duration: number; views: number; gmv: number
  adRoas: number; adCpa: number; adCost: number; isAd: boolean
  productId?: string; nicheKey: NicheKey
}
export interface DbCreator {
  creatorId: string; market: Market; handle: string; nickname: string
  signature: string; mainCategory: string
  followers: number; gmv: number; engagementPct: number; views: number
  nicheKey: NicheKey
}
export interface DbShop {
  shopId: string; market: Market; name: string; sellerType: string
  mainCategory: string; revenue: number; growthRate: number
  productIds: string[]; nicheKey: NicheKey
}

type SortKey = 'score' | 'revenue' | 'growth' | 'commission'

/* DB row (research_products) → ResearchProduct.
   LƯU Ý: nicheKey + competitionShops là PLACEHOLDER cho data thật (chờ map danh mục
   + tính bão hòa ở bước sau). Các số revenue/growth/giá/hoa hồng/rating/creator map
   TRỰC TIẾP từ Kalodata để đối chiếu đúng. */
function rowToVideo(r: Record<string, unknown>): DbVideo {
  const num = (v: unknown) => (v == null ? 0 : Number(v) || 0)
  const desc = (r.description as string) ?? ''
  return {
    videoId: String(r.video_id), market: (r.market as Market) || 'MY',
    description: desc, handle: (r.handle as string) ?? '',
    duration: num(r.duration), views: num(r.views), gmv: num(r.revenue),
    adRoas: num(r.ad2_roas), adCpa: num(r.ad_cpa), adCost: num(r.ad2_cost),
    isAd: !!r.ad,
    productId: (r.product_id as string) ?? undefined,
    nicheKey: classifyNiche(desc),
  }
}
function rowToCreator(r: Record<string, unknown>): DbCreator {
  const num = (v: unknown) => (v == null ? 0 : Number(v) || 0)
  const sig = (r.signature as string) ?? ''
  const cat = (r.main_category as string) ?? ''
  return {
    creatorId: String(r.creator_id), market: (r.market as Market) || 'MY',
    handle: (r.handle as string) ?? '', nickname: (r.nickname as string) ?? '',
    signature: sig, mainCategory: cat,
    followers: num(r.followers), gmv: num(r.revenue),
    engagementPct: num(r.video_engagement_rate), views: num(r.views),
    nicheKey: classifyNiche(cat + ' ' + sig + ' ' + (r.nickname || '')),
  }
}
function rowToShop(r: Record<string, unknown>): DbShop {
  const num = (v: unknown) => (v == null ? 0 : Number(v) || 0)
  const name = (r.name as string) ?? ''
  const cat = (r.main_category as string) ?? ''
  return {
    shopId: String(r.shop_id), market: (r.market as Market) || 'MY',
    name, sellerType: (r.seller_type as string) ?? '',
    mainCategory: cat, revenue: num(r.revenue),
    growthRate: num(r.revenue_grouping_rate),
    productIds: Array.isArray(r.product_ids) ? (r.product_ids as string[]) : [],
    nicheKey: classifyNiche(name + ' ' + cat),
  }
}

function rowToProduct(r: Record<string, unknown>): ResearchProduct {
  const num = (v: unknown) => (v == null ? 0 : Number(v) || 0)
  const title = (r.product_title as string) ?? '(không tên)'
  // Phân ngách + rủi ro SKU dựa vào tên (DB có thể đã pre-classify; nếu không, làm runtime).
  const nicheKey: NicheKey = ((r.niche_key as NicheKey) || classifyNiche(title))
  const skuVarianceRisk: SkuRisk = ((r.sku_variance_risk as SkuRisk) || classifySkuRisk(title))
  return {
    productId: String(r.product_id),
    market: (r.market as Market) || 'MY',
    title,
    imageUrl: (r.image_url as string) ?? undefined,
    revenue: num(r.revenue),
    growthRate: num(r.revenue_grouping_rate),
    sale: num(r.sale),
    unitPrice: num(r.unit_price),
    minPrice: r.min_real_price != null ? Number(r.min_real_price) : undefined,
    maxPrice: r.max_real_price != null ? Number(r.max_real_price) : undefined,
    commissionRate: num(r.commission_rate),
    rating: num(r.product_rating),
    creatorNum: num(r.creator_num),
    competitionShops: 10,
    videoRevenue: num(r.video_revenue),
    nicheKey,
    skuVarianceRisk,
    revenueTrend: Array.isArray(r.revenue_trend) ? (r.revenue_trend as number[]) : undefined,
    launchDate: (r.launch_date as string) ?? undefined,
  }
}

interface ResearchStore {
  market: Market
  nicheFilter: NicheKey | 'all'
  activePreset: PresetKey | null
  filters: ResearchFilters
  sortBy: SortKey
  selectedId: string | null

  realProducts: ResearchProduct[] | null
  realVideos: DbVideo[] | null
  realCreators: DbCreator[] | null
  realShops: DbShop[] | null
  hydrated: boolean
  syncedAt: string | null

  setMarket: (m: Market) => void
  setNiche: (n: NicheKey | 'all') => void
  applyPreset: (k: PresetKey) => void
  clearPreset: () => void
  setFilter: <K extends keyof ResearchFilters>(k: K, v: ResearchFilters[K]) => void
  setSort: (s: SortKey) => void
  select: (id: string | null) => void
  hydrate: () => Promise<void>

  source: () => ResearchProduct[]
  getScored: () => ScoredProduct[]
  getSelected: () => ScoredProduct | null
  getVideosForProduct: (productId: string, nicheKey: NicheKey, market: Market) => DbVideo[]
  getCreatorsForProduct: (productId: string, nicheKey: NicheKey, market: Market) => DbCreator[]
  getShopsForNiches: (market: Market, niches: NicheKey[]) => DbShop[]
}

export const useResearchStore = create<ResearchStore>((set, get) => ({
  market: 'MY',
  nicheFilter: 'all',
  activePreset: null,
  filters: { ...DEFAULT_FILTERS },
  sortBy: 'score',
  selectedId: null,
  realProducts: null,
  realVideos: null,
  realCreators: null,
  realShops: null,
  hydrated: false,
  syncedAt: null,

  setMarket: (market) => set({ market }),
  setNiche: (nicheFilter) => set({ nicheFilter }),
  applyPreset: (k) => {
    const preset = PRESETS.find((p) => p.key === k)
    if (!preset) return
    set({ activePreset: k, filters: preset.apply({ ...DEFAULT_FILTERS }) })
  },
  clearPreset: () => set({ activePreset: null, filters: { ...DEFAULT_FILTERS } }),
  setFilter: (k, v) => set((s) => ({ activePreset: null, filters: { ...s.filters, [k]: v } })),
  setSort: (sortBy) => set({ sortBy }),
  select: (selectedId) => set({ selectedId }),

  hydrate: async () => {
    if (get().hydrated) return
    try {
      const [pRes, vRes, cRes, sRes] = await Promise.all([
        supabase.from('research_products').select('*').limit(3000),
        supabase.from('research_videos').select('*').limit(3000),
        supabase.from('research_creators').select('*').limit(3000),
        supabase.from('research_shops').select('*').limit(3000),
      ])
      const patch: Partial<ResearchStore> = { hydrated: true }
      if (!pRes.error && pRes.data && pRes.data.length) {
        const products = pRes.data.map((r) => rowToProduct(r as Record<string, unknown>))
        let synced = ''
        for (const r of pRes.data as Record<string, unknown>[]) {
          const c = r.captured_at as string
          if (c && c > synced) synced = c
        }
        patch.realProducts = products
        patch.syncedAt = synced || null
      }
      if (!vRes.error && vRes.data) patch.realVideos = vRes.data.map(rowToVideo)
      if (!cRes.error && cRes.data) patch.realCreators = cRes.data.map(rowToCreator)
      if (!sRes.error && sRes.data) patch.realShops = sRes.data.map(rowToShop)
      set(patch as ResearchStore)
    } catch {
      set({ hydrated: true })
    }
  },

  source: () => get().realProducts ?? SAMPLE_PRODUCTS,

  getVideosForProduct: (productId: string, nicheKey: NicheKey, market: Market): DbVideo[] => {
    const all = get().realVideos
    if (!all || !all.length) return []
    // 1) Video gắn trực tiếp sản phẩm cùng market
    const linked = all.filter((v) => v.market === market && v.productId === productId)
    if (linked.length) return linked.sort((a, b) => b.gmv - a.gmv).slice(0, 6)
    // 2) Cùng market + cùng ngách
    const sameMarketNiche = all.filter((v) => v.market === market && v.nicheKey === nicheKey)
    if (sameMarketNiche.length) return sameMarketNiche.sort((a, b) => b.gmv - a.gmv).slice(0, 6)
    // 3) Cùng market, bất kỳ ngách (đảm bảo không lẫn data thị trường khác)
    return all.filter((v) => v.market === market).sort((a, b) => b.gmv - a.gmv).slice(0, 6)
  },
  getCreatorsForProduct: (_productId: string, nicheKey: NicheKey, market: Market): DbCreator[] => {
    const all = get().realCreators
    if (!all || !all.length) return []
    // 1) Cùng market + cùng ngách
    const sameMarketNiche = all.filter((c) => c.market === market && c.nicheKey === nicheKey)
    if (sameMarketNiche.length) return sameMarketNiche.sort((a, b) => b.gmv - a.gmv).slice(0, 6)
    // 2) Cùng market, bất kỳ ngách (better than empty)
    return all.filter((c) => c.market === market).sort((a, b) => b.gmv - a.gmv).slice(0, 6)
  },
  getShopsForNiches: (market: Market, niches: NicheKey[]): DbShop[] => {
    const all = get().realShops
    if (!all || !all.length) return []
    const set = new Set(niches)
    return all.filter((sh) => sh.market === market && set.has(sh.nicheKey))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 30)
  },

  getScored: () => {
    const { market, nicheFilter, filters, sortBy } = get()
    let rows = get().source().filter((p) => p.market === market)
    if (nicheFilter !== 'all') rows = rows.filter((p) => p.nicheKey === nicheFilter)
    if (filters.hideHighSku) rows = rows.filter((p) => p.skuVarianceRisk !== 'high')
    rows = rows.filter((p) => p.unitPrice <= filters.priceMaxMyr)
    rows = rows.filter((p) => p.commissionRate >= filters.commissionMinPct)
    rows = rows.filter((p) => p.growthRate >= filters.growthMinPct)
    if (filters.lowSaturationOnly) rows = rows.filter((p) => p.competitionShops < 15)
    if (filters.hasCreatorOnly) rows = rows.filter((p) => p.creatorNum > 0)

    const scored = scoreMany(rows)
    scored.sort((a, b) => {
      switch (sortBy) {
        case 'revenue': return b.revenue - a.revenue
        case 'growth': return b.growthRate - a.growthRate
        case 'commission': return b.commissionRate - a.commissionRate
        default: return b.score - a.score
      }
    })
    return scored
  },

  getSelected: () => {
    const { selectedId } = get()
    if (!selectedId) return null
    const found = get().source().find((p) => p.productId === selectedId)
    return found ? scoreMany([found])[0] : null
  },
}))
