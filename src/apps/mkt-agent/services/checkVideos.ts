// ── MKT Agent · Dò video bán SP (lite, rip-ready) — TikTok + FB ──────────────
// CHỐNG DRIFT: search bằng coreTerms(TÊN SP) — KHÔNG phải niche (niche → mọi SP
// cùng ngách ra cùng video). Giống app Research. Lấy CẢ 2 nguồn:
//   • TikTok (research-videos): video bán SP, có downloadUrl no-watermark → tải rip.
//   • FB Ad Library (fb-ads): ad đối thủ đang chạy (mở link xem). RẺ ~2 call/SP.
import type { SpCandidate, VideoCheck, VidItem } from '../store'

// Bỏ bracket + từ marketing + đơn vị → token đặc trưng (token[0] ~ brand). Copy
// nguyên logic coreTerms của app Research để khớp video ĐÚNG SP, không drift.
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

interface FbAd { id?: string; page?: string; cover?: string; videoUrl?: string; daysRunning?: number }

export async function checkProductVideos(c: SpCandidate): Promise<VideoCheck> {
  const terms = coreTerms(c.title)
  // q = token tên SP (đặc trưng) — fallback: tên đã gỡ ngoặc, 8 từ đầu.
  const joined = terms.slice(0, 6).join(' ')
  const q = joined.length >= 4
    ? joined
    : (c.title.replace(/[【[(][^】\])]*[】\])]/g, ' ').split(/[|\-–—]/)[0] || c.title).trim().split(/\s+/).filter(Boolean).slice(0, 8).join(' ')
  const termsParam = terms.join(',')

  // TikTok — video bán SP (rip-ready)
  const tk: VidItem[] = []
  try {
    const r = await fetch(`/api/research-videos?market=MY&q=${encodeURIComponent(q)}&minSec=15&maxSec=90${termsParam ? `&terms=${encodeURIComponent(termsParam)}` : ''}`)
    if (r.ok) {
      const j = (await r.json()) as { videos?: VidItem[] }
      for (const v of j.videos ?? []) tk.push({ ...v, platform: 'tiktok' })
    }
  } catch { /* TikTok lỗi → bỏ qua, vẫn còn FB */ }
  tk.sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0))

  // FB Ad Library — ad đối thủ đang chạy (mở link)
  const fb: VidItem[] = []
  try {
    const r = await fetch(`/api/fb-ads?q=${encodeURIComponent(terms.slice(0, 2).join(' ') || q)}&country=MY&status=ACTIVE`)
    if (r.ok) {
      const j = (await r.json()) as { ads?: FbAd[] }
      for (const a of j.ads ?? []) {
        if (!a.videoUrl || !a.cover) continue
        fb.push({
          id: 'fb_' + String(a.id ?? Math.random()), platform: 'fb',
          cover: String(a.cover), downloadUrl: '', url: String(a.videoUrl),
          views: 0, desc: String(a.page ?? ''), author: String(a.page ?? ''), durationSec: 0, days: Number(a.daysRunning) || 0,
        })
      }
    }
  } catch { /* FB lỗi → bỏ qua */ }
  fb.sort((a, b) => (b.days ?? 0) - (a.days ?? 0))

  const maxViews = tk.reduce((m, v) => Math.max(m, Number(v.views) || 0), 0)
  // TikTok trước (rip-ready) rồi FB (intel) — cap mỗi nguồn.
  const list = [...tk.slice(0, 10), ...fb.slice(0, 6)]
  return { count: list.length, maxViews, list }
}
