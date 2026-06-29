// ── Vercel serverless — XÁC MINH 1 link salepage/ladipage (cho tab Tìm Salepage) ──
// /api/check-link?url=https://...&q=collagen sakit lutut
// 1 lần fetch trang đích → trả: CMS (LadiPage/Shopify/…) + có chứa từ khóa SP không + title.
// Né CORS (server-side). Lưu ý: trang JS-render (LadiPage) có thể không lộ chữ trong HTML thô
// → contains=false KHÔNG chắc là không liên quan (client không ẩn cứng, chỉ gắn nhãn).
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
    const t = setTimeout(() => ctrl.abort(), 9000)
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    const finalUrl = r.url || url
    const html = (await r.text()).slice(0, 400000)
    const hay = `${finalUrl}\n${html}`

    let cms = 'Khác'
    for (const s of SIGNS) { if (s.re.test(hay)) { cms = s.cms; break } }

    const titleM = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
    const title = titleM ? titleM[1].trim() : ''

    // Có chứa từ khóa? Tách token (len>=2, bỏ stopword) → đếm token xuất hiện trong HTML+title.
    const lowHay = `${title}\n${html}`.toLowerCase()
    const tokens = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((tk) => tk.length >= 2 && !STOP.has(tk))
    let hit = 0
    for (const tk of tokens) if (lowHay.includes(tk)) hit++
    const contains = tokens.length === 0 ? null : hit >= Math.max(1, Math.ceil(tokens.length * 0.5))

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
    return res.status(200).json({ cms, contains, title, finalUrl, hit, tokens: tokens.length })
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? 'Trang phản hồi quá lâu' : (e as Error).message
    return res.status(200).json({ cms: 'Khác', contains: null, error: msg })
  }
}
