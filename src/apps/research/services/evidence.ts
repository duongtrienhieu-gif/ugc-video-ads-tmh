// Research module — sinh "bằng chứng" (video/creator/cross-market) cho 1 sản phẩm.
// P1: deterministic generator từ data mẫu (ổn định, không nhảy số mỗi lần mở).
// Khi nối Kalodata thật → thay bằng query research_videos / research_creators / cross-market.
import type { Market, ResearchProduct } from '../types'

export interface SampleVideo {
  id: string; caption: string; handle: string
  views: number; gmv: number; adRoas: number; durationSec: number
}
export interface SampleCreator {
  id: string; handle: string; nickname: string
  followers: number; gmv: number; engagementPct: number
}
export interface CrossMarketRow {
  market: Market; revenue: number; growthRate: number; shops: number; isCurrent: boolean
}

function seedFrom(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mkRng(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HOOK_POOL = [
  'Before/after sau 7 ngày', 'Demo dùng thử tại nhà', 'Review thật không quảng cáo',
  'Mở hộp + test ngay', 'Tại sao nhà nào cũng nên có', 'Mẹo dùng cực hay',
  'So sánh với hàng ngoài chợ', 'Khách phản hồi sau 1 tuần',
]
const NAME_POOL = ['mira', 'aisyah', 'jenn', 'farah', 'kelvin', 'nadia', 'haziq', 'yanti', 'syafiq', 'lina']

export function getVideosFor(p: ResearchProduct): SampleVideo[] {
  const rng = mkRng(seedFrom(p.productId + 'v'))
  const count = Math.min(5, Math.max(2, Math.round(p.creatorNum / 2)))
  const totalGmv = p.videoRevenue ?? p.revenue * 0.6
  const out: SampleVideo[] = []
  let remaining = totalGmv
  for (let i = 0; i < count; i++) {
    const share = i === count - 1 ? remaining : totalGmv * Math.max(0.1, 0.42 - i * 0.07) * (0.8 + rng() * 0.4)
    const gmv = Math.max(300, Math.round(share))
    remaining = Math.max(0, remaining - gmv)
    out.push({
      id: `${p.productId}-v${i}`,
      caption: HOOK_POOL[Math.floor(rng() * HOOK_POOL.length)],
      handle: '@' + NAME_POOL[Math.floor(rng() * NAME_POOL.length)] + Math.floor(rng() * 90 + 10),
      views: Math.round(gmv * (40 + rng() * 140)),
      gmv,
      adRoas: Math.round((1.5 + rng() * 3) * 10) / 10,
      durationSec: Math.floor(12 + rng() * 46),
    })
  }
  return out.sort((a, b) => b.gmv - a.gmv)
}

export function getCreatorsFor(p: ResearchProduct): SampleCreator[] {
  const rng = mkRng(seedFrom(p.productId + 'c'))
  const count = Math.min(5, Math.max(1, p.creatorNum))
  const out: SampleCreator[] = []
  for (let i = 0; i < count; i++) {
    const name = NAME_POOL[Math.floor(rng() * NAME_POOL.length)]
    out.push({
      id: `${p.productId}-c${i}`,
      handle: '@' + name + Math.floor(rng() * 900 + 100),
      nickname: name.charAt(0).toUpperCase() + name.slice(1),
      followers: Math.round((5 + rng() * 280) * 1000),
      gmv: Math.round((p.revenue / count) * (0.5 + rng())),
      engagementPct: Math.round((2 + rng() * 8) * 10) / 10,
    })
  }
  return out.sort((a, b) => b.gmv - a.gmv)
}

export function getCrossMarketFor(p: ResearchProduct): CrossMarketRow[] {
  const rng = mkRng(seedFrom(p.productId + 'x'))
  const rows: CrossMarketRow[] = [
    { market: p.market, revenue: p.revenue, growthRate: p.growthRate, shops: p.competitionShops, isCurrent: true },
  ]
  const hot = (p.hotIn ?? []).filter((m) => m !== p.market)
  for (const m of hot) {
    rows.push({
      market: m,
      revenue: Math.round(p.revenue * (1.3 + rng() * 1.6)),
      growthRate: Math.round(p.growthRate * (1.3 + rng() * 0.9)),
      shops: Math.round(p.competitionShops * (2 + rng() * 3)),
      isCurrent: false,
    })
  }
  const all: Market[] = ['MY', 'TH', 'ID', 'VN']
  for (const m of all) {
    if (rows.find((r) => r.market === m)) continue
    rows.push({
      market: m,
      revenue: Math.round(p.revenue * (0.15 + rng() * 0.5)),
      growthRate: Math.round(-15 + rng() * 45),
      shops: Math.round(p.competitionShops * (0.4 + rng())),
      isCurrent: false,
    })
  }
  return rows
}

// ── format helpers ──
export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'tr'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(Math.round(n))
}
export function formatKMyr(n: number): string {
  if (n >= 1000) return 'RM' + (n / 1000).toFixed(1) + 'k'
  return 'RM' + Math.round(n)
}
