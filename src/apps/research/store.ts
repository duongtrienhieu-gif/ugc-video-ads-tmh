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

type SortKey = 'score' | 'revenue' | 'growth' | 'commission'

/* DB row (research_products) → ResearchProduct.
   LƯU Ý: nicheKey + competitionShops là PLACEHOLDER cho data thật (chờ map danh mục
   + tính bão hòa ở bước sau). Các số revenue/growth/giá/hoa hồng/rating/creator map
   TRỰC TIẾP từ Kalodata để đối chiếu đúng. */
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
}

export const useResearchStore = create<ResearchStore>((set, get) => ({
  market: 'MY',
  nicheFilter: 'all',
  activePreset: null,
  filters: { ...DEFAULT_FILTERS },
  sortBy: 'score',
  selectedId: null,
  realProducts: null,
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
      const { data, error } = await supabase.from('research_products').select('*').limit(2000)
      if (error) { set({ hydrated: true }); return } // bảng chưa tạo / RLS → giữ data mẫu
      if (data && data.length) {
        const products = data.map((r) => rowToProduct(r as Record<string, unknown>))
        let synced = ''
        for (const r of data as Record<string, unknown>[]) {
          const c = r.captured_at as string
          if (c && c > synced) synced = c
        }
        set({ realProducts: products, syncedAt: synced || null, hydrated: true })
      } else {
        set({ hydrated: true })
      }
    } catch {
      set({ hydrated: true })
    }
  },

  source: () => get().realProducts ?? SAMPLE_PRODUCTS,

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
