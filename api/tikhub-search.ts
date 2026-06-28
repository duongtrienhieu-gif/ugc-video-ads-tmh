// ── Vercel serverless — TÌM CLIP nguồn (TikHub: Douyin keyword search) ──
// Source Finder gọi: /api/tikhub-search?q=膝盖护具&platform=douyin&sort=like
// Trả clip ngắn để cắt ghép. Key server-side TIKHUB_KEY (Bearer). 1 req ~$0.001.
// Shape Douyin web search hay đổi wrapper → parser DEFENSIVE (deep-collect aweme).
import type { VercelRequest, VercelResponse } from '@vercel/node'

type AnyObj = Record<string, unknown>

// Đào sâu JSON, gom mọi object trông như 1 video Douyin (có aweme_id + video).
function collectAwemes(node: unknown, out: AnyObj[], seen: Set<unknown>, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8 || seen.has(node)) return
  seen.add(node)
  if (Array.isArray(node)) { for (const x of node) collectAwemes(x, out, seen, depth + 1); return }
  const o = node as AnyObj
  if ((o.aweme_id || o.aweme_id) && (o.video || o.desc != null)) { out.push(o); return }
  if (o.aweme_info && typeof o.aweme_info === 'object') { collectAwemes(o.aweme_info, out, seen, depth + 1); return }
  for (const k in o) collectAwemes(o[k], out, seen, depth + 1)
}

const firstUrl = (x: unknown): string => {
  const o = x as AnyObj | undefined
  const list = o?.url_list as string[] | undefined
  return Array.isArray(list) && list.length ? String(list[0]) : ''
}

// Tìm value đầu tiên có KEY khớp regex (cho cursor / has_more phân trang).
function deepVal(node: unknown, re: RegExp, depth = 0): unknown {
  if (!node || typeof node !== 'object' || depth > 6) return undefined
  const o = node as AnyObj
  for (const k in o) { const v = o[k]; if (re.test(k) && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')) return v }
  for (const k in o) { const v = o[k]; if (v && typeof v === 'object') { const f = deepVal(v, re, depth + 1); if (f !== undefined) return f } }
  return undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.TIKHUB_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu TIKHUB_KEY (đặt trên Vercel)' })
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) return res.status(400).json({ error: 'Cần q (từ khóa)' })
  const sort = req.query.sort === 'latest' ? '2' : req.query.sort === 'general' ? '0' : '1' // mặc định 1 = nhiều like
  const cursor = typeof req.query.cursor === 'string' ? Number(req.query.cursor) || 0 : 0
  const debug = req.query.debug === '1'

  // Douyin search video — POST + JSON body (xác minh từ OpenAPI spec).
  // sort_type: 0 tổng hợp / 1 nhiều like / 2 mới nhất. content_type 1 = chỉ video. cursor = phân trang.
  const payload = JSON.stringify({ keyword: q, cursor, sort_type: sort, publish_time: '0', filter_duration: '0', content_type: '1' })
  const candidates = [
    'https://api.tikhub.io/api/v1/douyin/search/fetch_video_search_v1',
    'https://api.tikhub.io/api/v1/douyin/search/fetch_video_search_v2',
  ]
  let body = ''
  let ok = false
  let lastStatus = 0
  let usedUrl = ''
  for (const u of candidates) {
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      try {
        const r = await fetch(u, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'ugc-lab' }, body: payload })
        lastStatus = r.status; body = await r.text(); usedUrl = u
        if (r.ok) { ok = true; break }
        if (r.status === 401 || r.status === 403) return res.status(502).json({ error: `TikHub auth lỗi ${r.status} — kiểm tra TIKHUB_KEY/scope`, detail: body.slice(0, 200) })
        if (r.status === 429) return res.status(502).json({ error: 'TikHub 429 — hết quota/balance' })
        if (r.status >= 400 && r.status < 500) break   // 4xx: thử URL khác, không retry
      } catch { /* network → retry */ }
    }
    if (ok) break
  }
  if (!ok) return res.status(502).json({ error: `TikHub lỗi ${lastStatus || '(no response)'}`, detail: body.slice(0, 300), tried: candidates.length })

  let data: AnyObj
  try { data = JSON.parse(body) as AnyObj } catch { return res.status(502).json({ error: 'TikHub trả về không phải JSON', detail: body.slice(0, 200) }) }

  const awemes: AnyObj[] = []
  collectAwemes(data, awemes, new Set())

  const seenId = new Set<string>()
  const clips = awemes.map((a) => {
    const v = (a.video as AnyObj) || {}
    const playUrl = firstUrl(v.play_addr) || firstUrl(v.play_addr_h264) || firstUrl(v.download_addr) || firstUrl(v.play_addr_265)
    const cover = firstUrl(v.cover) || firstUrl(v.origin_cover) || firstUrl(v.dynamic_cover)
    const author = (a.author as AnyObj) || {}
    const stats = (a.statistics as AnyObj) || {}
    const id = String(a.aweme_id ?? a.aweme_id ?? '')
    return {
      id,
      videoUrl: playUrl,
      cover,
      desc: String(a.desc ?? '').slice(0, 160),
      author: String(author.nickname ?? author.unique_id ?? ''),
      likes: Number(stats.digg_count ?? 0) || 0,
      durationSec: Math.round((Number(v.duration ?? 0) || 0) / 1000),
      shareUrl: String(a.share_url ?? (id ? `https://www.douyin.com/video/${id}` : '')),
      platform: 'douyin',
    }
  }).filter((c) => {
    if (!c.id || !c.videoUrl || seenId.has(c.id)) return false
    seenId.add(c.id); return true
  }).sort((x, y) => y.likes - x.likes)

  const nextCursor = deepVal(data, /^cursor$/i)
  const hasMoreVal = deepVal(data, /has_more|hasmore/i)
  const hasMore = (hasMoreVal === true || hasMoreVal === 1 || hasMoreVal === '1' || hasMoreVal === 'true') && nextCursor != null

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900')
  return res.status(200).json({
    clips,
    count: clips.length,
    cursor: nextCursor != null ? String(nextCursor) : null,
    hasMore,
    ...(debug ? { usedUrl, nextCursor, hasMoreVal, rawKeys: Object.keys(data), awemeCount: awemes.length, sample: awemes[0] ? Object.keys(awemes[0]) : [], videoKeys: awemes[0]?.video ? Object.keys(awemes[0].video as object) : [] } : {}),
    note: clips.length ? undefined : 'no douyin clips (đổi từ khóa, hoặc xem debug=1 để soi shape)',
  })
}
