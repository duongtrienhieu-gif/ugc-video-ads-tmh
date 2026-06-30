// ── MKT Agent · Dò video bán SP (lite, rip-ready) ────────────────────────────
// 1 call /api/research-videos để biết SP có VIDEO BÁN sẵn (đối thủ đang đẩy) —
// kèm downloadUrl KHÔNG watermark để tải về chạy ads luôn. RẺ (1 credit/SP), chỉ
// chạy cho top-N sau quét → xếp SP-có-video lên đầu (không phải cả cục Soi sâu).
import type { SpCandidate, VideoCheck, VidItem } from '../store'

export async function checkProductVideos(c: SpCandidate): Promise<VideoCheck> {
  // q = ngách (generic, ra nhiều video) hoặc 4 từ đầu của tên. terms = token đặc
  // trưng để API chấm liên quan (đúng SP nổi lên, bớt drift).
  const q = (c.niche && c.niche.trim()) ? c.niche.trim() : c.title.split(/\s+/).slice(0, 4).join(' ')
  const terms = c.title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2).slice(0, 4).join(',')
  const u = `/api/research-videos?market=MY&q=${encodeURIComponent(q)}&minSec=15&maxSec=90${terms ? `&terms=${encodeURIComponent(terms)}` : ''}`
  const r = await fetch(u)
  if (!r.ok) return { count: 0, maxViews: 0, list: [] }
  const j = (await r.json()) as { videos?: VidItem[] }
  const list = (Array.isArray(j.videos) ? j.videos : []).sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0))
  const maxViews = list.reduce((m, v) => Math.max(m, Number(v.views) || 0), 0)
  return { count: list.length, maxViews, list: list.slice(0, 12) }
}
