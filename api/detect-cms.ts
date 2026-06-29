// ── Vercel serverless — nhận diện NỀN TẢNG TRANG ĐÍCH của ad (Phase 2b) ──
// Như Dropispy/Minea: biết trang bán dựng bằng gì (LadiPage/Shopify/WooCommerce…).
// Tải HTML trang đích (server-side, né CORS) → dò chữ ký đặc trưng. 1 lần/ad khi mở modal.
// Kèm XÁC MINH link cho tab "Tìm Salepage": truyền &q=từ khóa → trả thêm
// { contains, title } (1 lần fetch dùng chung, không tốn thêm serverless function).
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
// Từ chung — bỏ khi tách token từ khóa để khỏi "khớp" lung tung.
const STOP = new Set([
  'di', 'dan', 'untuk', 'yang', 'dengan', 'atau', 'the', 'for', 'and', 'with', 'của', 'và', 'cho',
  'sp', 'beli', 'percuma', 'cod', 'promosi', 'original', 'ori', 'set', 'pack', 'pcs',
])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = typeof req.query.url === 'string' ? req.query.url : ''
  const q = typeof req.query.q === 'string' ? req.query.q : ''
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Thiếu url hợp lệ' })
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    const finalUrl = r.url || url
    const html = (await r.text()).slice(0, 400000)
    const hay = `${finalUrl}\n${html}`
    let cms = 'Khác'
    for (const s of SIGNS) { if (s.re.test(hay)) { cms = s.cms; break } }

    // Xác minh từ khóa (chỉ khi có q) — đếm token (len>=2, bỏ stopword) trong title+html.
    let contains: boolean | null = null
    let title = ''
    if (q) {
      const titleM = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
      title = titleM ? titleM[1].trim() : ''
      const lowHay = `${title}\n${html}`.toLowerCase()
      const tokens = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((tk) => tk.length >= 2 && !STOP.has(tk))
      let hit = 0
      for (const tk of tokens) if (lowHay.includes(tk)) hit++
      contains = tokens.length === 0 ? null : hit >= Math.max(1, Math.ceil(tokens.length * 0.5))
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
    return res.status(200).json({ cms, finalUrl, contains, title })
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? 'Trang đích phản hồi quá lâu' : (e as Error).message
    return res.status(200).json({ cms: 'Khác', error: msg, contains: null })
  }
}
