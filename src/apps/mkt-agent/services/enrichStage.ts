// ── MKT Agent · Kiểm chứng SP ────────────────────────────────────────────────
// Tầng 1 (FREE, 0 credit): link mở SP ở nền tảng khác cho người mắt-kiểm.
// Tầng 2 (Soi sâu, tốn credit, on-demand/SP): kéo số thật cho người + bot chấm:
//   research-videos (# video + view) · fb-ads (# ads đối thủ + scale) ·
//   rapid-1688 (khớp 1688 + giá vốn). Tất cả allSettled → 1 nguồn lỗi không vỡ.
import type { SpCandidate, DeepDive, SpyAd } from '../store'
import { expandSearchTerms } from './expandTerms'

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

export async function deepDive(c: SpCandidate, geminiApiKey?: string): Promise<DeepDive> {
  // Bung từ khóa (Gemini) → search rộng nhiều góc; không có key thì 1 từ.
  const terms = geminiApiKey ? await expandSearchTerms(geminiApiKey, c) : [searchKeyword(c)]
  const adTerms = terms.slice(0, 2).length ? terms.slice(0, 2) : [searchKeyword(c)]

  // Mỗi từ (top 2) × FB + TikTok ads → gộp khử trùng. 1 từ cho video.
  const adFetches = adTerms.flatMap((t) => [
    getJson(`/api/fb-ads?q=${encodeURIComponent(t)}&country=MY&status=ACTIVE`),
    getJson(`/api/tiktok-ads?q=${encodeURIComponent(t)}&country=MY`),
  ])
  const settled = await Promise.allSettled([
    getJson(`/api/research-videos?market=MY&q=${encodeURIComponent(terms[0] ?? searchKeyword(c))}&minSec=15`),
    c.imageUrl
      ? getJson('/api/rapid-1688', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: c.imageUrl }) })
      : Promise.resolve({ products: [] } as Record<string, unknown>),
    ...adFetches,
  ])
  const vids = settled[0]
  const s1688 = settled[1]
  const adsResults = settled.slice(2)

  let videoCount = 0, maxViews = 0
  if (vids.status === 'fulfilled') {
    const list = (vids.value.videos as { views?: number }[] | undefined) ?? []
    videoCount = list.length
    maxViews = list.reduce((m, v) => Math.max(m, Number(v.views) || 0), 0)
  }

  // Gộp ads FB + TikTok × các từ → khử trùng theo id, GIỮ ad-list thật (nguồn lọc).
  // adsResults thứ tự: [fb(t0), tiktok(t0), fb(t1), tiktok(t1)...] → chẵn=fb, lẻ=tiktok.
  const adMap = new Map<string, SpyAd>()
  adsResults.forEach((r, idx) => {
    if (r.status !== 'fulfilled') return
    const platform: 'fb' | 'tiktok' = idx % 2 === 0 ? 'fb' : 'tiktok'
    const list = (r.value.ads as { id?: string; cover?: string; videoUrl?: string; text?: string; daysRunning?: number; advertiserAds?: number }[] | undefined) ?? []
    for (const a of list) {
      const id = String(a.id ?? '')
      if (!id) continue
      const days = Number(a.daysRunning) || 0
      const scale = Number(a.advertiserAds) || 0
      const prev = adMap.get(id)
      if (prev) { prev.days = Math.max(prev.days, days); prev.scale = Math.max(prev.scale, scale) }
      else adMap.set(id, { id, platform, cover: String(a.cover ?? ''), videoUrl: String(a.videoUrl ?? ''), text: String(a.text ?? ''), days, scale })
    }
  })
  const adCount = adMap.size
  let adTopDays = 0, adTopScale = 0
  for (const v of adMap.values()) { adTopDays = Math.max(adTopDays, v.days); adTopScale = Math.max(adTopScale, v.scale) }
  // Chỉ giữ ad có cover + video (để lọc ảnh + tải sau), cap 30.
  const rawAds = [...adMap.values()].filter((a) => a.cover && a.videoUrl).slice(0, 30)

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

  return { videoCount, maxViews, adCount, adTopDays, adTopScale, on1688, count1688, cost1688, link1688, terms, rawAds }
}
