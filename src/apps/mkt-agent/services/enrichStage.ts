// ── MKT Agent · Kiểm chứng SP ────────────────────────────────────────────────
// Tầng 1 (FREE, 0 credit): link mở SP ở nền tảng khác cho người mắt-kiểm.
// Tầng 2 (Soi sâu, tốn credit, on-demand/SP): kéo số thật cho người + bot chấm:
//   research-videos (# video + view) · fb-ads (# ads đối thủ + scale) ·
//   rapid-1688 (khớp 1688 + giá vốn). Tất cả allSettled → 1 nguồn lỗi không vỡ.
import type { SpCandidate, DeepDive } from '../store'

// Từ khóa search ad: ƯU TIÊN NGÁCH khớp ("minyak urut") — generic, FB/TikTok ra
// kết quả. Tên SP dài/đặc thù ("Minyak 1001 Khasiat JUNGLE GIRL") → FB Ads rỗng.
// Fallback (không có niche): lọc tên → 3 từ cốt lõi, bỏ số/khuyến mãi/ngoặc.
const NOISE_RE = /\b(original|hq|flash\s*sales?|promosi|terhad|ready\s*stock|cod|free\s*shipping|next-day\s*delivery|borong|botol|vegan|sale)\b/gi
export function searchKeyword(c: { title: string; niche?: string }): string {
  if (c.niche && c.niche.trim()) return c.niche.trim()
  const cleaned = c.title
    .replace(/[[(（【][^\])）】]*[\])）】]/g, ' ')
    .replace(NOISE_RE, ' ')
    .replace(/\d+/g, ' ')
    .split(/[|–—•·/]/)[0]
    .trim()
  const kw = cleaned.split(/\s+/).filter(Boolean).slice(0, 3).join(' ').trim()
  return kw || c.title.slice(0, 30)
}

export interface VerifyLinks {
  tiktokShop: string
  googleLens: string
  fbAds: string
  tiktokVideo: string
}

export function buildVerifyLinks(c: SpCandidate): VerifyLinks {
  const kw = encodeURIComponent(searchKeyword(c))
  const img = c.imageUrl ? encodeURIComponent(c.imageUrl) : ''
  return {
    tiktokShop: c.url && /^https?:/i.test(c.url) ? c.url : `https://www.tiktok.com/search?q=${kw}`,
    googleLens: img ? `https://lens.google.com/uploadbyurl?url=${img}` : '',
    fbAds: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=MY&q=${kw}&search_type=keyword_unordered`,
    tiktokVideo: `https://www.tiktok.com/search?q=${kw}`,
  }
}

async function getJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const r = await fetch(url, init)
  if (!r.ok) throw new Error(`${r.status}`)
  return (await r.json()) as Record<string, unknown>
}

export async function deepDive(c: SpCandidate): Promise<DeepDive> {
  const kw = searchKeyword(c)
  const [vids, ads, s1688] = await Promise.allSettled([
    getJson(`/api/research-videos?market=MY&q=${encodeURIComponent(kw)}&minSec=15`),
    getJson(`/api/fb-ads?q=${encodeURIComponent(kw)}&country=MY&status=ACTIVE`),
    c.imageUrl
      ? getJson('/api/rapid-1688', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: c.imageUrl }) })
      : Promise.resolve({ products: [] as unknown[] }),
  ])

  let videoCount = 0, maxViews = 0
  if (vids.status === 'fulfilled') {
    const list = (vids.value.videos as { views?: number }[] | undefined) ?? []
    videoCount = list.length
    maxViews = list.reduce((m, v) => Math.max(m, Number(v.views) || 0), 0)
  }

  let adCount = 0, adTopDays = 0, adTopScale = 0
  if (ads.status === 'fulfilled') {
    const list = (ads.value.ads as { daysRunning?: number; advertiserAds?: number }[] | undefined) ?? []
    adCount = list.length
    adTopDays = list.reduce((m, a) => Math.max(m, Number(a.daysRunning) || 0), 0)
    adTopScale = list.reduce((m, a) => Math.max(m, Number(a.advertiserAds) || 0), 0)
  }

  let on1688 = false, count1688 = 0, cost1688 = '', link1688 = ''
  if (s1688.status === 'fulfilled') {
    const list = (s1688.value.products as { itemId?: string; price?: string }[] | undefined) ?? []
    count1688 = list.length
    on1688 = count1688 > 0
    const prices = list.map((p) => parseFloat(String(p.price ?? '')) || 0).filter((n) => n > 0).sort((a, b) => a - b)
    if (prices.length) cost1688 = String(prices[0])
    const first = list.find((p) => p.itemId)
    if (first?.itemId) link1688 = `https://detail.1688.com/offer/${first.itemId}.html`
  }

  return { videoCount, maxViews, adCount, adTopDays, adTopScale, on1688, count1688, cost1688, link1688 }
}
