// ── Vercel serverless — chi tiết SP 1688 (RapidAPI) lấy VIDEO + ẢNH gốc nhà bán ──
// Source Finder: itemId (từ search-image) → ảnh gallery + video nhà máy = nguyên liệu khớp hình.
import type { VercelRequest, VercelResponse } from '@vercel/node'

const HOST = 'taobao-1688-api1.p.rapidapi.com'
type AnyObj = Record<string, unknown>

// Deep-scan mọi URL: .mp4/.m3u8 = video; ảnh = jpg/png/webp.
function collectUrls(node: unknown, vids: Set<string>, imgs: Set<string>, seen: Set<unknown>, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8 || seen.has(node)) return
  seen.add(node)
  if (Array.isArray(node)) { for (const x of node) collectUrls(x, vids, imgs, seen, depth + 1); return }
  const o = node as AnyObj
  for (const k in o) {
    const v = o[k]
    if (typeof v === 'string') {
      if (/\.mp4(\?|$)/i.test(v) || /\.m3u8/i.test(v)) vids.add(v.startsWith('//') ? 'https:' + v : v)
      else if (/^(https?:)?\/\/.+\.(jpg|jpeg|png|webp)/i.test(v)) imgs.add(v.startsWith('//') ? 'https:' + v : v)
    } else if (v && typeof v === 'object') collectUrls(v, vids, imgs, seen, depth + 1)
  }
}
function deepFind(node: unknown, re: RegExp, depth = 0): string {
  if (!node || typeof node !== 'object' || depth > 6) return ''
  const o = node as AnyObj
  for (const k in o) { const v = o[k]; if (typeof v === 'string' && re.test(k) && v) return v }
  for (const k in o) { const v = o[k]; if (v && typeof v === 'object') { const f = deepFind(v, re, depth + 1); if (f) return f } }
  return ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.RAPIDAPI_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu RAPIDAPI_KEY' })
  const itemId = typeof req.query.itemId === 'string' ? req.query.itemId.trim() : ''
  if (!itemId) return res.status(400).json({ error: 'Cần itemId' })
  const debug = req.query.debug === '1'
  try {
    const r = await fetch(`https://${HOST}/1688/detail?itemId=${encodeURIComponent(itemId)}`, { headers: { 'x-rapidapi-host': HOST, 'x-rapidapi-key': key } })
    const t = await r.text()
    if (!r.ok) return res.status(502).json({ error: `Detail lỗi ${r.status}`, detail: t.slice(0, 200) })
    const d = JSON.parse(t) as AnyObj
    const vids = new Set<string>(); const imgs = new Set<string>()
    collectUrls(d, vids, imgs, new Set())
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
    return res.status(200).json({
      videos: [...vids].slice(0, 10),
      images: [...imgs].slice(0, 40),
      shop: deepFind(d.data ?? d, /loginid|shopname|nick|seller.?name/i),
      title: deepFind(d.data ?? d, /^(subject|title)$/i),
      ...(debug ? { rawTop: Object.keys((d.data as AnyObj) || d) } : {}),
    })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
