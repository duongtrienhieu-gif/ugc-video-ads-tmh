// ── Vercel serverless — REVERSE-IMAGE 1688 (RapidAPI Taobao 1688 API) ──
// Source Finder Tab 1: ảnh SP → tìm ĐÚNG SP trên 1688 (khớp hình, không từ khóa).
// Luồng: thử search-image?imgUrl=<public> ; nếu trống → upload base64 → imgId → search-image.
// Key server-side RAPIDAPI_KEY. Host cố định.
import type { VercelRequest, VercelResponse } from '@vercel/node'

const HOST = 'taobao-1688-api1.p.rapidapi.com'
type AnyObj = Record<string, unknown>
const headers = (key: string) => ({ 'x-rapidapi-host': HOST, 'x-rapidapi-key': key })

// Tìm value đầu tiên có KEY khớp regex (deep).
function deepFind(node: unknown, re: RegExp, depth = 0): string {
  if (!node || typeof node !== 'object' || depth > 6) return ''
  const o = node as AnyObj
  for (const k in o) { const v = o[k]; if ((typeof v === 'string' || typeof v === 'number') && re.test(k) && String(v)) return String(v) }
  for (const k in o) { const v = o[k]; if (v && typeof v === 'object') { const f = deepFind(v, re, depth + 1); if (f) return f } }
  return ''
}

// Map kết quả search-image: data.data[] (shape đã verify).
function mapItems(d: AnyObj) {
  const arr = (((d.data as AnyObj) || {}).data as AnyObj[]) || []
  return (Array.isArray(arr) ? arr : []).map((p) => ({
    itemId: String(p.offerId ?? p.offer_id ?? p.id ?? ''),
    title: String(p.title ?? p.translateTitle ?? ''),
    titleVi: String(p.translateTitle ?? ''),
    image: String(p.imageUrl ?? p.image ?? ''),
    price: String(p.targetLowPrice ?? p.lowPrice ?? ''),
    priceHigh: String(p.targetHighPrice ?? p.highPrice ?? ''),
    sold: String(p.days90SoldOut ?? ''),
    score: String(p.goodsScore ?? ''),
  })).filter((x) => x.itemId && x.image)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.RAPIDAPI_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu RAPIDAPI_KEY (đặt trên Vercel)' })
  const debug = req.query.debug === '1'

  let imageUrl = ''
  let base64 = ''
  if (req.method === 'POST') {
    const b = (typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body) } catch { return {} } })() : req.body) || {}
    imageUrl = String((b as AnyObj).imageUrl ?? '')
    base64 = String((b as AnyObj).base64 ?? '')
  } else {
    imageUrl = typeof req.query.imageUrl === 'string' ? req.query.imageUrl : ''
  }
  if (!imageUrl && !base64) return res.status(400).json({ error: 'Cần imageUrl hoặc base64' })

  try {
    // 1) Ảnh công khai (http) → thử imgUrl thẳng.
    if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
      const r = await fetch(`https://${HOST}/1688/search-image?imgUrl=${encodeURIComponent(imageUrl)}&page=0`, { headers: headers(key) })
      if (r.ok) {
        const d = (await r.json()) as AnyObj
        const items = mapItems(d)
        if (items.length) return res.status(200).json({ products: items, via: 'imgUrl', ...(debug ? { rawTop: Object.keys(d) } : {}) })
      }
    }
    // 2) Upload base64 → imgId → search.
    let b64 = base64
    if (!b64 && imageUrl) { const ir = await fetch(imageUrl); b64 = Buffer.from(await ir.arrayBuffer()).toString('base64') }
    b64 = b64.replace(/^data:[^,]+,/, '')
    if (!b64) return res.status(400).json({ error: 'Không đọc được ảnh' })

    const up = await fetch(`https://${HOST}/1688/upload-image`, { method: 'POST', headers: { ...headers(key), 'Content-Type': 'application/json' }, body: JSON.stringify({ base64: b64 }) })
    const upText = await up.text()
    let upd: AnyObj = {}
    try { upd = JSON.parse(upText) as AnyObj } catch { /* */ }
    if (!up.ok || upd.success === false) return res.status(502).json({ error: 'Upload ảnh lên 1688 lỗi', detail: upText.slice(0, 200) })
    const imgId = deepFind(upd, /img.?id|image.?id|imageurl|^id$|pic/i)
    if (!imgId) return res.status(502).json({ error: 'Upload không trả imgId', detail: upText.slice(0, 200), ...(debug ? { uploadKeys: Object.keys(upd) } : {}) })

    const q = /^https?:/i.test(imgId) ? `imgUrl=${encodeURIComponent(imgId)}` : `imgId=${encodeURIComponent(imgId)}`
    const r2 = await fetch(`https://${HOST}/1688/search-image?${q}&page=0`, { headers: headers(key) })
    const t2 = await r2.text()
    if (!r2.ok) return res.status(502).json({ error: `Search-image lỗi ${r2.status}`, detail: t2.slice(0, 200) })
    const d2 = JSON.parse(t2) as AnyObj
    const items = mapItems(d2)
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
    return res.status(200).json({ products: items, via: 'upload', ...(debug ? { rawTop: Object.keys(d2), uploadKeys: Object.keys(upd) } : {}), note: items.length ? undefined : 'không tìm thấy SP khớp ảnh (thử ảnh nền sạch hơn)' })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
