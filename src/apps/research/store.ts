// Research module — Zustand store.
// P1: chạy trên DATA MẪU (SAMPLE_PRODUCTS). Sau này getScored() đổi nguồn
// sang Supabase (research_products) — UI không phải đổi.
import { create } from 'zustand'
import type { Market, NicheKey, ScoredProduct } from './types'
import { DEFAULT_FILTERS, type ResearchFilters, type PresetKey, PRESETS } from './constants'
import { SAMPLE_PRODUCTS } from './sampleData'
import { scoreMany } from './services/scoring'

type SortKey = 'score' | 'revenue' | 'growth' | 'commission'

interface ResearchStore {
  market: Market
  nicheFilter: NicheKey | 'all'
  activePreset: PresetKey | null
  filters: ResearchFilters
  sortBy: SortKey
  selectedId: string | null

  setMarket: (m: Market) => void
  setNiche: (n: NicheKey | 'all') => void
  applyPreset: (k: PresetKey) => void
  clearPreset: () => void
  setFilter: <K extends keyof ResearchFilters>(k: K, v: ResearchFilters[K]) => void
  setSort: (s: SortKey) => void
  select: (id: string | null) => void

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

  getScored: () => {
    const { market, nicheFilter, filters, sortBy } = get()
    let rows = SAMPLE_PRODUCTS.filter((p) => p.market === market)
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
    const found = SAMPLE_PRODUCTS.find((p) => p.productId === selectedId)
    return found ? scoreMany([found])[0] : null
  },
}))
