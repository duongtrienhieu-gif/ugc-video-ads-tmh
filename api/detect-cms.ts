// ── Vercel serverless — nhận diện NỀN TẢNG TRANG ĐÍCH + xác minh link salepage ──
// GET  /api/detect-cms?url=...                 → { cms }                       (modal ad cũ)
// GET  /api/detect-cms?url=...&q=key            → { cms, contains, title }     (verify từ khóa, tab Tìm Salepage)
// POST /api/detect-cms  { url, refImage, apiKey } → { cms, contains, match }   (ĐỐI CHIẾU ẢNH: cùng SP không)
// Tải HTML server-side (né CORS). Đối chiếu ảnh: lấy ảnh hero trên salepage (jina-html vì
// LadiPage giấu ảnh trong CSS/JS) rồi nhờ Gemini so với ảnh SP user upload → "cùng mã hàng?".
import type { VercelRequest, VercelResponse } from '@vercel/node'

const SIGNS: { cms: string; re: RegExp }[] = [
  { cms: 'LadiPage', re: /ladipage|ladicdn\.com|ldp-|window\.LadiPageScript/i },
  { cms: 'Shopify', re: /cdn\.shopify\.com|Shopify\.theme|myshopify\.com|x-shopid/i },
  { cms: 'WooCommerce', re: /woocommerce|wp-content\/plugins\/woocommerce/i },
  { cms: 'Sapo', re: /sapo|bizweb\.dktcdn/i },
  { cms: 'Haravan', re: /haravan|hstatic\.net/i },
  { cms: 'Wix', re: /wix\.com|wixstatic|_wixCssStates/i },
  { cms: 'Webflow', re: /webflow\.io|wf-/i },
  { cms: 'WordPress', re: /wp-content|wp-includes/i },
  { cms: 'Pancake', re: /pancake\.vn|pages\.fm/i },
]
const STOP = new Set([
  'di', 'dan', 'untuk', 'yang', 'dengan', 'atau', 'the', 'for', 'and', 'with', 'của', 'và', 'cho',
  'sp', 'beli', 'percuma', 'cod', 'promosi', 'original', 'ori', 'set', 'pack', 'pcs',
])

function detectCms(hay: string): string {
  for (const s of SIGNS) { if (s.re.test(hay)) return s.cms }
  return 'Khác'
}
function checkContains(html: string, title: string, q: string): boolean | null {
  if (!q) return null
  const low = `${title}\n${html}`.toLowerCase()
  const tokens = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((tk) => tk.length >= 2 && !STOP.has(tk))
  if (!tokens.length) return null
  let hit = 0
  for (const tk of tokens) if (low.includes(tk)) hit++
  return hit >= Math.max(1, Math.ceil(tokens.length * 0.5))
}
// Rút URL ảnh "hero/nội dung" từ HTML (ladicdn + img src + background-image), bỏ logo/icon/tracking.
function extractImages(html: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const junk = /logo|icon|favicon|sprite|avatar|pixel|spacer|loading|placeholder|1x1|tracking|facebook\.com\/tr/i
  const re = /https?:\/\/[^\s"'()<>\\]+?\.(?:jpe?g|png|webp)(?:\?[^\s"'()<>\\]*)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < 40) {
    const u = m[0]
    if (seen.has(u) || junk.test(u)) continue
    seen.add(u); out.push(u)
  }
  // Ưu tiên ảnh nội dung LadiPage (w.ladicdn.com) lên đầu.
  out.sort((a, b) => (/ladicdn\.com/i.test(b) ? 1 : 0) - (/ladicdn\.com/i.test(a) ? 1 : 0))
  return out.slice(0, 4)
}
async function fetchHtml(url: string, viaJina: boolean): Promise<{ html: string; finalUrl: string }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), viaJina ? 15000 : 8000)
  try {
    const target = viaJina ? `https://r.jina.ai/${url}` : url
    const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    if (viaJina) headers['X-Return-Format'] = 'html'
    const r = await fetch(target, { headers, signal: ctrl.signal, redirect: 'follow' })
    const html = (await r.text()).slice(0, 500000)
    return { html, finalUrl: viaJina ? url : (r.url || url) }
  } finally { clearTimeout(t) }
}
async function fetchImageB64(url: string): Promise<{ mime: string; data: string } | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: ctrl.signal })
    clearTimeout(t)
    if (!r.ok) return null
    const mime = r.headers.get('content-type') || 'image/jpeg'
    if (!/^image\//i.test(mime)) return null
    const ab = await r.arrayBuffer()
    if (ab.byteLength < 1500 || ab.byteLength > 6_000_000) return null   // bỏ ảnh quá nhỏ (icon) / quá to
    return { mime: mime.split(';')[0], data: Buffer.from(ab).toString('base64') }
  } catch { return null }
}
// Gemini vision: 2 ảnh có CÙNG sản phẩm vật lý không (bỏ qua khác brand/nhãn/góc chụp).
async function geminiSameProduct(apiKey: string, ref: { mime: string; data: string }, cand: { mime: string; data: string }): Promise<boolean> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
  const body = {
    contents: [{ parts: [
      { text: 'Ảnh 1 là SẢN PHẨM GỐC. Ảnh 2 lấy từ 1 landing page. Hai ảnh có phải CÙNG MỘT sản phẩm vật lý không — cùng kiểu dáng/bao bì/công năng? BỎ QUA khác tên thương hiệu/nhãn dán, khác góc chụp, khác nền. Trả JSON: {"match": true hoặc false}.' },
      { inlineData: { mimeType: ref.mime, data: ref.data } },
      { inlineData: { mimeType: cand.mime, data: cand.data } },
    ] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 80, thinkingConfig: { thinkingBudget: 0 } },
  }
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`gemini ${r.status}`)
  const d = await r.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const txt = d.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  try { return !!(JSON.parse(txt) as { match?: boolean }).match } catch { return false }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── POST: đối chiếu ảnh SP (cùng mã hàng không) ──
  if (req.method === 'POST') {
    const body = (req.body || {}) as { url?: string; refImage?: string; apiKey?: string; q?: string }
    const url = String(body.url || '')
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Thiếu url' })
    const refM = String(body.refImage || '').match(/^data:([^;]+);base64,(.+)$/)
    if (!refM || !body.apiKey) return res.status(400).json({ error: 'Thiếu refImage/apiKey' })
    try {
      const { html } = await fetchHtml(url, true)   // jina-html: render JS → bắt được ảnh LadiPage
      const cms = detectCms(`${url}\n${html}`)
      const contains = checkContains(html, '', String(body.q || ''))
      const ref = { mime: refM[1], data: refM[2] }
      const candidates = extractImages(html)
      let match: boolean | null = candidates.length ? false : null
      for (const cu of candidates.slice(0, 2)) {       // thử tối đa 2 ảnh hero
        const cand = await fetchImageB64(cu)
        if (!cand) continue
        if (await geminiSameProduct(body.apiKey, ref, cand)) { match = true; break }
      }
      return res.status(200).json({ cms, contains, match })
    } catch (e) {
      return res.status(200).json({ cms: 'Khác', contains: null, match: null, error: (e as Error).message.slice(0, 120) })
    }
  }

  // ── GET: nhận diện CMS (+ verify từ khóa nếu có q) ──
  const url = typeof req.query.url === 'string' ? req.query.url : ''
  const q = typeof req.query.q === 'string' ? req.query.q : ''
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Thiếu url hợp lệ' })
  try {
    const { html, finalUrl } = await fetchHtml(url, false)
    const cms = detectCms(`${finalUrl}\n${html}`)
    const titleM = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
    const title = titleM ? titleM[1].trim() : ''
    const contains = checkContains(html, title, q)
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
    return res.status(200).json({ cms, finalUrl, contains, title })
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? 'Trang đích phản hồi quá lâu' : (e as Error).message
    return res.status(200).json({ cms: 'Khác', error: msg, contains: null })
  }
}
