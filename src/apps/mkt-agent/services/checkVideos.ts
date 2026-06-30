// ── MKT Agent · Dò video bán SP (lite, rip-ready) — TikTok ───────────────────
// CHỐNG DRIFT: search bằng coreTerms(TÊN SP) — KHÔNG phải niche (niche → mọi SP
// cùng ngách ra cùng video). Giống app Research (có chấm điểm liên quan brand-
// token nên lọc drift). FB KHÔNG dò ở đây: keyword FB không biết đúng SP → 90%
// rác; FB chuẩn = SO ẢNH (matchSpy) chạy ở "Phân tích sâu" cho SP đã chốt.
import type { SpCandidate, VideoCheck, VidItem } from '../store'

// Bỏ bracket + từ marketing + đơn vị → token đặc trưng. Copy coreTerms từ Research.
const TERM_STOP = new Set([
  'new', 'promo', 'sale', 'hot', 'big', 'free', 'buy', 'beli', 'murah', 'viral', 'original', 'ori', 'ready', 'stock',
  'pek', 'pcs', 'pc', 'pack', 'set', 'box', 'botol', 'bottle', 'tablet', 'tablets', 'kapsul', 'capsule', 'gummies', 'sachet',
  'untuk', 'dengan', 'dan', 'yang', 'the', 'for', 'and', 'plus', 'best', 'seller', 'halal', 'tiktok', 'shop', 'exclusive',
  'combo', 'bundle', 'isi', 'satu', 'dua', 'ml', 'gm', 'gram', 'mg', 'kg', 'official', 'store',
])
function coreTerms(title: string): string[] {
  const cleaned = title
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^A-Za-z0-9À-ɏ ]+/g, ' ')
  const out: string[] = []
  for (const raw of cleaned.split(/\s+/)) {
    const low = raw.trim().toLowerCase()
    if (low.length < 3 || TERM_STOP.has(low) || /^\d+$/.test(low) || out.includes(low)) continue
    out.push(low)
    if (out.length >= 6) break
  }
  return out
}

export async function checkProductVideos(c: SpCandidate): Promise<VideoCheck> {
  const terms = coreTerms(c.title)
  // q = token tên SP (đặc trưng) — fallback: tên đã gỡ ngoặc, 8 từ đầu.
  const joined = terms.slice(0, 6).join(' ')
  const q = joined.length >= 4
    ? joined
    : (c.title.replace(/[【[(][^】\])]*[】\])]/g, ' ').split(/[|\-–—]/)[0] || c.title).trim().split(/\s+/).filter(Boolean).slice(0, 8).join(' ')
  const termsParam = terms.join(',')

  const tk: VidItem[] = []
  try {
    const r = await fetch(`/api/research-videos?market=MY&q=${encodeURIComponent(q)}&minSec=15&maxSec=90${termsParam ? `&terms=${encodeURIComponent(termsParam)}` : ''}`)
    if (r.ok) {
      const j = (await r.json()) as { videos?: VidItem[] }
      for (const v of j.videos ?? []) tk.push({ ...v, platform: 'tiktok' })
    }
  } catch { /* lỗi → trả rỗng, không vỡ */ }
  tk.sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0))

  const maxViews = tk.reduce((m, v) => Math.max(m, Number(v.views) || 0), 0)
  return { count: tk.length, maxViews, list: tk.slice(0, 12) }
}
