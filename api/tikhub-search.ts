// ── Vercel serverless — TÌM CLIP nguồn (TikHub: Douyin keyword search) ──
// /api/tikhub-search?q=膝盖护具&sort=like&maxSec=60&cursor=0
// LOOP nhiều trang để gom đủ ~12 clip (lọc thời lượng nếu maxSec). Key TIKHUB_KEY (Bearer).
import type { VercelRequest, VercelResponse } from '@vercel/node'

type AnyObj = Record<string, unknown>
const TARGET = 12        // số clip muốn trả mỗi lần
const MAX_PAGES = 6      // trần số trang gọi TikHub mỗi request (1 trang = 1 credit)

function collectAwemes(node: unknown, out: AnyObj[], seen: Set<unknown>, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8 || seen.has(node)) return
  seen.add(node)
  if (Array.isArray(node)) { for (const x of node) collectAwemes(x, out, seen, depth + 1); return }
  const o = node as AnyObj
  if (o.aweme_id && (o.video || o.desc != null)) { out.push(o); return }
  if (o.aweme_info && typeof o.aweme_info === 'object') { collectAwemes(o.aweme_info, out, seen, depth + 1); return }
  for (const k in o) collectAwemes(o[k], out, seen, depth + 1)
}
const firstUrl = (x: unknown): string => {
  const list = (x as AnyObj | undefined)?.url_list as string[] | undefined
  return Array.isArray(list) && list.length ? String(list[0]) : ''
}
function deepVal(node: unknown, re: RegExp, depth = 0): unknown {
  if (!node || typeof node !== 'object' || depth > 6) return undefined
  const o = node as AnyObj
  for (const k in o) { const v = o[k]; if (re.test(k) && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')) return v }
  for (const k in o) { const v = o[k]; if (v && typeof v === 'object') { const f = deepVal(v, re, depth + 1); if (f !== undefined) return f } }
  return undefined
}

interface Clip { id: string; videoUrl: string; cover: string; desc: string; author: string; likes: number; durationSec: number; shareUrl: string; platform: string }
function mapClips(data: AnyObj): Clip[] {
  const awemes: AnyObj[] = []
  collectAwemes(data, awemes, new Set())
  return awemes.map((a) => {
    const v = (a.video as AnyObj) || {}
    const vurl = firstUrl(v.play_addr) || firstUrl(v.play_addr_h264) || firstUrl(v.download_addr) || firstUrl(v.play_addr_265)
    const author = (a.author as AnyObj) || {}
    const stats = (a.statistics as AnyObj) || {}
    const id = String(a.aweme_id ?? '')
    return {
      id, videoUrl: vurl,
      cover: firstUrl(v.cover) || firstUrl(v.origin_cover) || firstUrl(v.dynamic_cover),
      desc: String(a.desc ?? '').slice(0, 160),
      author: String(author.nickname ?? author.unique_id ?? ''),
      likes: Number(stats.digg_count ?? 0) || 0,
      durationSec: Math.round((Number(v.duration ?? 0) || 0) / 1000),
      shareUrl: String(a.share_url ?? (id ? `https://www.douyin.com/video/${id}` : '')),
      platform: 'douyin',
    }
  }).filter((c) => c.id && c.videoUrl)
}

async function fetchPage(key: string, q: string, sort: string, cursor: number): Promise<{ ok: boolean; status: number; body: string; data?: AnyObj }> {
  const payload = JSON.stringify({ keyword: q, cursor, sort_type: sort, publish_time: '0', filter_duration: '0', content_type: '1' })
  for (const u of ['https://api.tikhub.io/api/v1/douyin/search/fetch_video_search_v1', 'https://api.tikhub.io/api/v1/douyin/search/fetch_video_search_v2']) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(u, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'ugc-lab' }, body: payload })
        const body = await r.text()
        if (r.ok) { try { return { ok: true, status: 200, body, data: JSON.parse(body) as AnyObj } } catch { return { ok: false, status: 502, body } } }
        if (r.status === 401 || r.status === 403 || r.status === 402 || r.status === 429) return { ok: false, status: r.status, body }
        if (r.status >= 400 && r.status < 500) break  // thử URL kia
      } catch { /* retry */ }
    }
  }
  return { ok: false, status: 0, body: '' }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.TIKHUB_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu TIKHUB_KEY (đặt trên Vercel)' })
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) return res.status(400).json({ error: 'Cần q (từ khóa)' })
  const sort = req.query.sort === 'latest' ? '2' : req.query.sort === 'general' ? '0' : '1'
  const maxSec = typeof req.query.maxSec === 'string' ? Number(req.query.maxSec) || 0 : 0
  let cursor = typeof req.query.cursor === 'string' ? Number(req.query.cursor) || 0 : 0
  const debug = req.query.debug === '1'

  const out: Clip[] = []
  const seen = new Set<string>()
  let pages = 0
  let hasMore = false
  let firstErr: { status: number; body: string } | null = null

  // LOOP: gom đủ TARGET clip (đã lọc maxSec) hoặc hết trang.
  while (out.length < TARGET && pages < MAX_PAGES) {
    const p = await fetchPage(key, q, sort, cursor)
    pages++
    if (!p.ok || !p.data) {
      if (pages === 1) { firstErr = { status: p.status, body: p.body } }
      break
    }
    for (const c of mapClips(p.data)) {
      if (seen.has(c.id)) continue
      if (maxSec && c.durationSec > 0 && c.durationSec > maxSec) continue
      seen.add(c.id); out.push(c)
    }
    const next = deepVal(p.data, /^cursor$/i)
    const hm = deepVal(p.data, /has_more|hasmore/i)
    hasMore = (hm === true || hm === 1 || hm === '1' || hm === 'true') && next != null
    if (!hasMore || next == null || Number(next) === cursor) { break }
    cursor = Number(next)
  }

  if (firstErr) {
    const s = firstErr.status
    if (s === 401 || s === 403) return res.status(502).json({ error: `TikHub auth lỗi ${s} — kiểm tra TIKHUB_KEY/scope`, detail: firstErr.body.slice(0, 200) })
    if (s === 402) return res.status(502).json({ error: 'TikHub 402 — hết balance (nạp tiền TikHub)', detail: firstErr.body.slice(0, 160) })
    if (s === 429) return res.status(502).json({ error: 'TikHub 429 — hết quota/balance' })
    return res.status(502).json({ error: `TikHub lỗi ${s || '(no response)'}`, detail: firstErr.body.slice(0, 200) })
  }

  out.sort((a, b) => b.likes - a.likes)
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900')
  return res.status(200).json({
    clips: out,
    count: out.length,
    cursor: String(cursor),
    hasMore,
    ...(debug ? { pages } : {}),
    note: out.length ? undefined : 'no clip (đổi từ khóa hoặc bỏ lọc <60s)',
  })
}
