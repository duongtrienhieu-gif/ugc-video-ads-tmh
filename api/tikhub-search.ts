// ── Vercel serverless — TÌM CLIP nguồn đa nền tảng (TikHub) ──
// /api/tikhub-search?q=膝盖护具&platform=douyin|xhs|kuaishou&sort=like&maxSec=60&cursor=0
// LOOP nhiều trang để gom đủ ~12 clip (lọc thời lượng nếu maxSec). Key TIKHUB_KEY (Bearer).
// Douyin = bản chạy ổn cũ (POST). RED(小红书)/Kuaishou(快手) = thêm mới (GET), mapper deep-scan
// phòng thủ vì shape response TikHub không công bố — có ?debug=1 để soi khi cần chỉnh field.
import type { VercelRequest, VercelResponse } from '@vercel/node'

type AnyObj = Record<string, unknown>
type Platform = 'douyin' | 'xhs' | 'kuaishou'
const TARGET = 12        // số clip muốn trả mỗi lần
const MAX_PAGES = 6      // trần số trang gọi TikHub mỗi request (1 trang = 1 credit)

interface Clip { id: string; videoUrl: string; cover: string; desc: string; author: string; likes: number; durationSec: number; shareUrl: string; platform: string }
interface PageResult { ok: boolean; status: number; body: string; data?: AnyObj }
interface NextCursor { cursor: string | null; hasMore: boolean }

// ── helpers chung ──
const truthy = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true'
function deepVal(node: unknown, re: RegExp, depth = 0): unknown {
  if (!node || typeof node !== 'object' || depth > 6) return undefined
  const o = node as AnyObj
  for (const k in o) { const v = o[k]; if (re.test(k) && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')) return v }
  for (const k in o) { const v = o[k]; if (v && typeof v === 'object') { const f = deepVal(v, re, depth + 1); if (f !== undefined) return f } }
  return undefined
}
// rút URL từ nhiều shape: string | {url} | {url_list:[]} | [{url}] | [string]
function asUrl(v: unknown, depth = 0): string {
  if (!v || depth > 5) return ''
  if (typeof v === 'string') return /^https?:\/\//i.test(v) ? v : ''
  if (Array.isArray(v)) { for (const x of v) { const u = asUrl(x, depth + 1); if (u) return u } return '' }
  const o = v as AnyObj
  if (typeof o.url === 'string' && /^https?:/i.test(o.url)) return o.url
  if (typeof o.master_url === 'string' && /^https?:/i.test(o.master_url)) return o.master_url
  if (typeof o.masterUrl === 'string' && /^https?:/i.test(o.masterUrl)) return o.masterUrl
  if (o.url_list) return asUrl(o.url_list, depth + 1)
  if (o.urlList) return asUrl(o.urlList, depth + 1)
  return ''
}
// đếm "1.2万"/"999+"/number → number
function parseCount(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  if (typeof v === 'string') {
    const s = v.trim()
    const w = s.match(/^([\d.]+)\s*万/); if (w) return Math.round(parseFloat(w[1]) * 1e4)
    const y = s.match(/^([\d.]+)\s*亿/); if (y) return Math.round(parseFloat(y[1]) * 1e8)
    const n = parseInt(s.replace(/[^\d]/g, ''), 10); return Number.isNaN(n) ? 0 : n
  }
  return 0
}
// deep tìm 1 url video (.mp4 hoặc field master_url/play) — cứu cho XHS/Kuaishou shape lạ
function deepVideoUrl(node: unknown, depth = 0): string {
  if (!node || typeof node !== 'object' || depth > 7) return ''
  const o = node as AnyObj
  for (const k in o) {
    const v = o[k]
    if (typeof v === 'string' && /^https?:/i.test(v)) {
      if (/master_url|masterurl|play_url|playurl|main_mv|h265|h264/i.test(k)) return v
      if (/\.mp4(\?|$)/i.test(v)) return v
    }
  }
  for (const k in o) { const v = o[k]; if (v && typeof v === 'object') { const f = deepVideoUrl(v, depth + 1); if (f) return f } }
  return ''
}
const durSec = (raw: unknown): number => { const n = Number(raw) || 0; return n > 1000 ? Math.round(n / 1000) : Math.round(n) }
// gom node theo điều kiện (không đệ quy vào node đã khớp → tránh trùng lồng nhau)
function collectBy(node: unknown, pred: (o: AnyObj) => boolean, out: AnyObj[], seen: Set<unknown>, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8 || seen.has(node)) return
  seen.add(node)
  if (Array.isArray(node)) { for (const x of node) collectBy(x, pred, out, seen, depth + 1); return }
  const o = node as AnyObj
  if (pred(o)) { out.push(o); return }
  for (const k in o) collectBy(o[k], pred, out, seen, depth + 1)
}

// ── DOUYIN (giữ nguyên logic cũ đã chạy ổn) ──
function collectAwemes(node: unknown, out: AnyObj[], seen: Set<unknown>, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8 || seen.has(node)) return
  seen.add(node)
  if (Array.isArray(node)) { for (const x of node) collectAwemes(x, out, seen, depth + 1); return }
  const o = node as AnyObj
  if (o.aweme_id && (o.video || o.desc != null)) { out.push(o); return }
  if (o.aweme_info && typeof o.aweme_info === 'object') { collectAwemes(o.aweme_info, out, seen, depth + 1); return }
  for (const k in o) collectAwemes(o[k], out, seen, depth + 1)
}
function mapDouyin(data: AnyObj): Clip[] {
  const awemes: AnyObj[] = []
  collectAwemes(data, awemes, new Set())
  return awemes.map((a) => {
    const v = (a.video as AnyObj) || {}
    const vurl = asUrl(v.play_addr) || asUrl(v.play_addr_h264) || asUrl(v.download_addr) || asUrl(v.play_addr_265)
    const author = (a.author as AnyObj) || {}
    const stats = (a.statistics as AnyObj) || {}
    const id = String(a.aweme_id ?? '')
    return {
      id, videoUrl: vurl,
      cover: asUrl(v.cover) || asUrl(v.origin_cover) || asUrl(v.dynamic_cover),
      desc: String(a.desc ?? '').slice(0, 160),
      author: String(author.nickname ?? author.unique_id ?? ''),
      likes: Number(stats.digg_count ?? 0) || 0,
      durationSec: durSec(v.duration),
      shareUrl: String(a.share_url ?? (id ? `https://www.douyin.com/video/${id}` : '')),
      platform: 'douyin',
    }
  }).filter((c) => c.id && c.videoUrl)
}
async function pageDouyin(key: string, q: string, sort: string, cursor: string): Promise<PageResult> {
  const cur = Number(cursor) || 0
  const payload = JSON.stringify({ keyword: q, cursor: cur, sort_type: sort, publish_time: '0', filter_duration: '0', content_type: '1' })
  for (const u of ['https://api.tikhub.io/api/v1/douyin/search/fetch_video_search_v1', 'https://api.tikhub.io/api/v1/douyin/search/fetch_video_search_v2']) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(u, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'ugc-lab' }, body: payload })
        const body = await r.text()
        if (r.ok) { try { return { ok: true, status: 200, body, data: JSON.parse(body) as AnyObj } } catch { return { ok: false, status: 502, body } } }
        if (r.status === 401 || r.status === 403 || r.status === 402 || r.status === 429) return { ok: false, status: r.status, body }
        if (r.status >= 400 && r.status < 500) break
      } catch { /* retry */ }
    }
  }
  return { ok: false, status: 0, body: '' }
}
function nextDouyin(data: AnyObj, cursor: string): NextCursor {
  const next = deepVal(data, /^cursor$/i)
  const hm = deepVal(data, /has_more|hasmore/i)
  if (next == null || String(next) === cursor) return { cursor: null, hasMore: false }
  return { cursor: String(next), hasMore: truthy(hm) }
}

// ── GET chung cho XHS/Kuaishou ──
async function tikGet(key: string, url: string): Promise<PageResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'ugc-lab' } })
      const body = await r.text()
      if (r.ok) { try { return { ok: true, status: 200, body, data: JSON.parse(body) as AnyObj } } catch { return { ok: false, status: 502, body } } }
      if (r.status === 401 || r.status === 403 || r.status === 402 || r.status === 429) return { ok: false, status: r.status, body }
      if (r.status >= 400 && r.status < 500) return { ok: false, status: r.status, body }
    } catch { /* retry */ }
  }
  return { ok: false, status: 0, body: '' }
}

// ── XIAOHONGSHU / RED (小红书) — search notes, chỉ note video ──
function mapXhs(data: AnyObj): Clip[] {
  const items: AnyObj[] = []
  collectBy(data, (o) => (o.note_card != null && typeof o.note_card === 'object') || (o.note_id != null && (o.display_title != null || o.desc != null)), items, new Set())
  return items.map((w) => {
    const nc = (typeof w.note_card === 'object' && w.note_card ? w.note_card : w) as AnyObj
    const user = (nc.user as AnyObj) || {}
    const interact = (nc.interact_info as AnyObj) || {}
    const id = String(w.id ?? w.note_id ?? nc.note_id ?? nc.id ?? '')
    const videoUrl = deepVideoUrl(nc)
    const cover = asUrl(nc.cover) || asUrl(nc.image_list) || asUrl(nc.images_list)
    const tok = w.xsec_token ? `?xsec_token=${String(w.xsec_token)}&xsec_source=pc_search` : ''
    return {
      id, videoUrl, cover,
      desc: String(nc.display_title ?? nc.title ?? nc.desc ?? '').slice(0, 160),
      author: String(user.nickname ?? user.nick_name ?? user.name ?? ''),
      likes: parseCount(interact.liked_count ?? interact.liked ?? nc.likes),
      durationSec: durSec(deepVal(nc, /duration/i)),
      shareUrl: id ? `https://www.xiaohongshu.com/explore/${id}${tok}` : '',
      platform: 'xhs',
    }
  }).filter((c) => c.id && c.videoUrl)
}
function pageXhs(key: string, q: string, sort: string, cursor: string): Promise<PageResult> {
  const page = Number(cursor) || 1
  const s = sort === 'latest' ? 'time_descending' : sort === 'general' ? 'general' : 'popularity_descending'
  const url = `https://api.tikhub.io/api/v1/xiaohongshu/web_v3/fetch_search_notes?keyword=${encodeURIComponent(q)}&page=${page}&sort=${s}&note_type=2`
  return tikGet(key, url)
}
function nextXhs(data: AnyObj, cursor: string): NextCursor {
  const page = Number(cursor) || 1
  const hm = deepVal(data, /has_more|hasmore/i)
  // has_more thiếu → suy đoán còn trang nếu trang này có item (driver tự dừng ở MAX_PAGES)
  const more = hm === undefined ? true : truthy(hm)
  return { cursor: String(page + 1), hasMore: more }
}

// ── KUAISHOU (快手) — search video v2 ──
function mapKuaishou(data: AnyObj): Clip[] {
  const items: AnyObj[] = []
  collectBy(data, (o) => (o.photo_id != null || o.photoId != null) && (o.caption != null || o.main_mv_urls != null || o.mainMvUrls != null || o.playUrl != null || o.photoUrl != null), items, new Set())
  return items.map((o) => {
    const user = (o.user as AnyObj) || {}
    const id = String(o.photo_id ?? o.photoId ?? '')
    const videoUrl = asUrl(o.main_mv_urls) || asUrl(o.mainMvUrls) || asUrl(o.playUrl) || asUrl(o.photoUrl) || deepVideoUrl(o)
    const cover = asUrl(o.cover_thumbnail_urls) || asUrl(o.coverThumbnailUrls) || asUrl(o.cover_thumbnail_url) || asUrl(o.thumbnailUrl) || asUrl(o.coverUrls) || asUrl(o.cover)
    return {
      id, videoUrl, cover,
      desc: String(o.caption ?? o.desc ?? '').slice(0, 160),
      author: String(o.user_name ?? o.userName ?? user.name ?? user.user_name ?? user.nickname ?? ''),
      likes: parseCount(o.like_count ?? o.likeCount ?? o.liked_count ?? o.realLikeCount),
      durationSec: durSec(o.duration ?? deepVal(o, /duration/i)),
      shareUrl: id ? `https://www.kuaishou.com/short-video/${id}` : '',
      platform: 'kuaishou',
    }
  }).filter((c) => c.id && c.videoUrl)
}
function pageKuaishou(key: string, q: string, _sort: string, cursor: string): Promise<PageResult> {
  const url = `https://api.tikhub.io/api/v1/kuaishou/app/search_video_v2?keyword=${encodeURIComponent(q)}&pcursor=${encodeURIComponent(cursor || '')}`
  return tikGet(key, url)
}
function nextKuaishou(data: AnyObj, cursor: string): NextCursor {
  const pc = deepVal(data, /^pcursor$/i)
  const s = pc == null ? '' : String(pc)
  if (!s || s === 'no_more' || s === cursor) return { cursor: null, hasMore: false }
  return { cursor: s, hasMore: true }
}

const PLATFORMS: Record<Platform, { page: (k: string, q: string, s: string, c: string) => Promise<PageResult>; map: (d: AnyObj) => Clip[]; next: (d: AnyObj, c: string) => NextCursor; start: string }> = {
  douyin: { page: pageDouyin, map: mapDouyin, next: nextDouyin, start: '0' },
  xhs: { page: pageXhs, map: mapXhs, next: nextXhs, start: '1' },
  kuaishou: { page: pageKuaishou, map: mapKuaishou, next: nextKuaishou, start: '' },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.TIKHUB_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu TIKHUB_KEY (đặt trên Vercel)' })
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) return res.status(400).json({ error: 'Cần q (từ khóa)' })
  const platform: Platform = req.query.platform === 'xhs' ? 'xhs' : req.query.platform === 'kuaishou' ? 'kuaishou' : 'douyin'
  const sort = req.query.sort === 'latest' ? '2' : req.query.sort === 'general' ? '0' : '1'   // mã douyin; xhs/kuaishou tự map từ tên
  const sortName = req.query.sort === 'latest' ? 'latest' : req.query.sort === 'general' ? 'general' : 'like'
  const maxSec = typeof req.query.maxSec === 'string' ? Number(req.query.maxSec) || 0 : 0
  const debug = req.query.debug === '1'
  const cfg = PLATFORMS[platform]
  let cursor = typeof req.query.cursor === 'string' && req.query.cursor !== '' ? req.query.cursor : cfg.start

  const out: Clip[] = []
  const seen = new Set<string>()
  let pages = 0
  let hasMore = false
  let firstErr: { status: number; body: string } | null = null

  // LOOP: gom đủ TARGET clip (đã lọc maxSec) hoặc hết trang.
  while (out.length < TARGET && pages < MAX_PAGES) {
    const p = await cfg.page(key, q, platform === 'douyin' ? sort : sortName, cursor)
    pages++
    if (!p.ok || !p.data) { if (pages === 1) firstErr = { status: p.status, body: p.body }; break }
    for (const c of cfg.map(p.data)) {
      if (seen.has(c.id)) continue
      if (maxSec && c.durationSec > 0 && c.durationSec > maxSec) continue
      seen.add(c.id); out.push(c)
    }
    const nx = cfg.next(p.data, cursor)
    hasMore = nx.hasMore && nx.cursor != null
    if (!hasMore || nx.cursor == null) break
    cursor = nx.cursor
  }

  if (firstErr) {
    const s = firstErr.status
    if (s === 401 || s === 403) return res.status(502).json({ error: `TikHub auth lỗi ${s} — kiểm tra TIKHUB_KEY/scope`, detail: firstErr.body.slice(0, 200) })
    if (s === 402) return res.status(502).json({ error: 'TikHub 402 — hết balance (nạp tiền TikHub)', detail: firstErr.body.slice(0, 160) })
    if (s === 429) return res.status(502).json({ error: 'TikHub 429 — hết quota/balance' })
    return res.status(502).json({ error: `TikHub lỗi ${s || '(no response)'} (${platform})`, detail: firstErr.body.slice(0, 200) })
  }

  out.sort((a, b) => b.likes - a.likes)
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900')
  return res.status(200).json({
    clips: out,
    count: out.length,
    cursor: String(cursor),
    hasMore,
    platform,
    ...(debug ? { pages } : {}),
    note: out.length ? undefined : `Không có clip ${platform} — đổi từ khóa${maxSec ? ' hoặc bỏ lọc <60s' : ''}`,
  })
}
