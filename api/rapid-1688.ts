// ── Vercel serverless — RapidAPI "Taobao 1688 API" (gộp search-by-image + item-detail) ──
// Gộp 2 chức năng vào 1 function để né giới hạn 12 Serverless Functions (Hobby).
//   ?action=search  (POST {imageUrl|base64}) → reverse-image → SP khớp hình
//   ?action=detail&itemId=...               → ảnh + video gốc nhà bán
// Key server-side RAPIDAPI_KEY. Host cố định.
import type { VercelRequest, VercelResponse } from '@vercel/node'

const HOST = 'taobao-1688-api1.p.rapidapi.com'
type AnyObj = Record<string, unknown>
const rapidHeaders = (key: string) => ({ 'x-rapidapi-host': HOST, 'x-rapidapi-key': key })

function deepFind(node: unknown, re: RegExp, depth = 0): string {
  if (!node || typeof node !== 'object' || depth > 6) return ''
  const o = node as AnyObj
  for (const k in o) { const v = o[k]; if ((typeof v === 'string' || typeof v === 'number') && re.test(k) && String(v)) return String(v) }
  for (const k in o) { const v = o[k]; if (v && typeof v === 'object') { const f = deepFind(v, re, depth + 1); if (f) return f } }
  return ''
}
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

async function handleSearch(req: VercelRequest, res: VercelResponse, key: string, debug: boolean) {
  let imageUrl = ''
  let base64 = ''
  const b = (typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body) } catch { return {} } })() : req.body) || {}
  imageUrl = String((b as AnyObj).imageUrl ?? (typeof req.query.imageUrl === 'string' ? req.query.imageUrl : ''))
  base64 = String((b as AnyObj).base64 ?? '')
  if (!imageUrl && !base64) return res.status(400).json({ error: 'Cần imageUrl hoặc base64' })

  // imgUrl-direct CHỈ khi là ảnh alicdn (ảnh ngoài 1688 phải upload).
  if (imageUrl && /alicdn/i.test(imageUrl)) {
    const r = await fetch(`https://${HOST}/1688/search-image?imgUrl=${encodeURIComponent(imageUrl)}&page=0`, { headers: rapidHeaders(key) })
    if (r.ok) {
      const d = (await r.json()) as AnyObj
      const items = mapItems(d)
      if (items.length) return res.status(200).json({ products: items, via: 'imgUrl', ...(debug ? { rawTop: Object.keys(d) } : {}) })
    }
  }
  // Base64: client GỬI ẢNH ĐÃ RESIZE (canvas) qua field base64. Fallback: fetch thẳng URL.
  let b64 = ''
  let srcType = ''
  if (base64) {
    b64 = base64.replace(/^data:[^,]+,/, '')
  } else if (imageUrl) {
    const ir = await fetch(imageUrl); srcType = ir.headers.get('content-type') || ''
    b64 = Buffer.from(await ir.arrayBuffer()).toString('base64')
  }
  if (!b64) return res.status(400).json({ error: 'Không đọc được ảnh' })
  if (srcType && !/image\//i.test(srcType)) return res.status(502).json({ error: `Ảnh tải về không phải ảnh (content-type: ${srcType}) — link ảnh bị chặn`, b64head: b64.slice(0, 24) })

  // 1688 upload CẦN dạng data-URI (base64 thuần → "图片64编码异常"). Đã verify.
  const mime = srcType && /image\//i.test(srcType) ? srcType : 'image/jpeg'
  const payload = `data:${mime};base64,${b64}`
  const up = await fetch(`https://${HOST}/1688/upload-image`, { method: 'POST', headers: { ...rapidHeaders(key), 'Content-Type': 'application/json' }, body: JSON.stringify({ base64: payload }) })
  const upText = await up.text()
  let upd: AnyObj = {}
  try { upd = JSON.parse(upText) as AnyObj } catch { /* */ }
  // imgId nằm ở field `data` (đã verify: data = token số dài; data="0" = ảnh lỗi/quá lớn).
  const dataVal = upd.data != null ? String(upd.data) : ''
  const imgId = dataVal && dataVal !== '0' ? dataVal : deepFind(upd, /img.?id|image.?id|imageurl/i)
  if (!up.ok || upd.success === false || !imgId || imgId === '0') {
    return res.status(502).json({ error: 'Upload ảnh lên 1688 lỗi (ảnh quá lớn/không hợp lệ)', detail: upText.slice(0, 160), srcType, b64len: b64.length })
  }

  const q = /^https?:/i.test(imgId) ? `imgUrl=${encodeURIComponent(imgId)}` : `imgId=${encodeURIComponent(imgId)}`
  const r2 = await fetch(`https://${HOST}/1688/search-image?${q}&page=0`, { headers: rapidHeaders(key) })
  const t2 = await r2.text()
  if (!r2.ok) return res.status(502).json({ error: `Search-image lỗi ${r2.status}`, detail: t2.slice(0, 200) })
  const d2 = JSON.parse(t2) as AnyObj
  const items = mapItems(d2)
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
  return res.status(200).json({ products: items, via: 'upload', ...(debug ? { rawTop: Object.keys(d2), uploadKeys: Object.keys(upd) } : {}), note: items.length ? undefined : 'không tìm thấy SP khớp ảnh (thử ảnh nền sạch hơn)' })
}

async function handleDetail(req: VercelRequest, res: VercelResponse, key: string, debug: boolean) {
  const itemId = typeof req.query.itemId === 'string' ? req.query.itemId.trim() : ''
  if (!itemId) return res.status(400).json({ error: 'Cần itemId' })
  const r = await fetch(`https://${HOST}/1688/detail?itemId=${encodeURIComponent(itemId)}`, { headers: rapidHeaders(key) })
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
}

// ── PROBE TẠM THỜI: dò đúng "hợp đồng" của /1688/upload-image (xoá sau khi tìm ra) ──
// 1 ảnh PNG 1×1 (≈68 byte) → loại trừ hẳn nguyên nhân "ảnh quá lớn". Thử nhiều method/field.
async function handleProbe(res: VercelResponse, key: string) {
  const rawB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const dataUri = `data:image/png;base64,${rawB64}`
  const U = `https://${HOST}/1688/upload-image`
  const jsonHdr = { ...rapidHeaders(key), 'Content-Type': 'application/json' }
  const post = (o: object): RequestInit => ({ method: 'POST', headers: jsonHdr, body: JSON.stringify(o) })
  const get = (): RequestInit => ({ method: 'GET', headers: rapidHeaders(key) })
  type Trial = { label: string; url: string; init: RequestInit }
  const trials: Trial[] = [
    { label: 'POST json base64=dataURI', url: U, init: post({ base64: dataUri }) },
    { label: 'POST json base64=raw', url: U, init: post({ base64: rawB64 }) },
    { label: 'POST json image=raw', url: U, init: post({ image: rawB64 }) },
    { label: 'POST json image=dataURI', url: U, init: post({ image: dataUri }) },
    { label: 'POST json img=raw', url: U, init: post({ img: rawB64 }) },
    { label: 'POST json imageBase64=raw', url: U, init: post({ imageBase64: rawB64 }) },
    { label: 'GET ?base64=raw', url: `${U}?base64=${encodeURIComponent(rawB64)}`, init: get() },
    { label: 'GET ?image=raw', url: `${U}?image=${encodeURIComponent(rawB64)}`, init: get() },
    { label: 'GET ?img=raw', url: `${U}?img=${encodeURIComponent(rawB64)}`, init: get() },
  ]
  const out: { label: string; status: number; body: string }[] = []
  for (const t of trials) {
    try { const r = await fetch(t.url, t.init); out.push({ label: t.label, status: r.status, body: (await r.text()).slice(0, 140) }) }
    catch (e) { out.push({ label: t.label, status: -1, body: (e as Error).message }) }
  }
  return res.status(200).json({ probe: 'upload-image', host: HOST, results: out })
}

// ── PROBE2 TẠM: format ĐÚNG (POST json base64=dataURI) ở các cỡ payload tăng dần ──
// Tìm ngưỡng body-size lật 200→400. 1 ảnh thật (~600px) để xác nhận ảnh thường ra token thật.
// Có delay 1.3s/call né rate-limit/giây của gói PRO.
async function handleProbe2(res: VercelResponse, key: string) {
  const U = `https://${HOST}/1688/upload-image`
  const jsonHdr = { ...rapidHeaders(key), 'Content-Type': 'application/json' }
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const callUpload = async (b64: string) => {
    const r = await fetch(U, { method: 'POST', headers: jsonHdr, body: JSON.stringify({ base64: `data:image/jpeg;base64,${b64}` }) })
    return { status: r.status, body: (await r.text()).slice(0, 120) }
  }
  const out: { label: string; bodyKB: number; status: number; body: string }[] = []
  // 1) ảnh JPEG thật ~600px (xác nhận ảnh thường → token thật, không phải "0")
  try {
    const ir = await fetch('https://picsum.photos/seed/probe1688/600/600.jpg')
    const realB64 = Buffer.from(await ir.arrayBuffer()).toString('base64')
    const r = await callUpload(realB64)
    out.push({ label: 'ảnh thật ~600px', bodyKB: Math.round(realB64.length / 1024), ...r })
  } catch (e) { out.push({ label: 'ảnh thật ~600px', bodyKB: 0, status: -1, body: (e as Error).message }) }
  // 2) blob base64 cỡ tăng dần (không phải ảnh thật) — chỉ để dò ngưỡng size:
  //    còn nhỏ → 500 "图片编码异常" (qua được size, lỗi giải mã); vượt ngưỡng → 400 "bad request".
  for (const kb of [120, 280, 500]) {
    await sleep(1300)
    const r = await callUpload('A'.repeat(kb * 1024))
    out.push({ label: `blob ${kb}KB`, bodyKB: kb, ...r })
  }
  return res.status(200).json({ probe: 'upload-image-size', results: out })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.RAPIDAPI_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu RAPIDAPI_KEY (đặt trên Vercel)' })
  const action = typeof req.query.action === 'string' ? req.query.action : (req.method === 'POST' ? 'search' : 'detail')
  const debug = req.query.debug === '1'
  try {
    if (action === 'probe') return await handleProbe(res, key)
    if (action === 'probe2') return await handleProbe2(res, key)
    if (action === 'detail') return await handleDetail(req, res, key, debug)
    return await handleSearch(req, res, key, debug)
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
