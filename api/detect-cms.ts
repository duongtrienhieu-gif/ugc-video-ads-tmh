// ── Vercel serverless — nhận diện NỀN TẢNG TRANG ĐÍCH của ad (Phase 2b) ──
// Như Dropispy/Minea: biết trang bán dựng bằng gì (LadiPage/Shopify/WooCommerce…).
// Tải HTML trang đích (server-side, né CORS) → dò chữ ký đặc trưng. 1 lần/ad khi mở modal.
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = typeof req.query.url === 'string' ? req.query.url : ''
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Thiếu url hợp lệ' })
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    const finalUrl = r.url || url
    const html = (await r.text()).slice(0, 300000)
    const hay = `${finalUrl}\n${html}`
    let cms = 'Khác'
    for (const s of SIGNS) { if (s.re.test(hay)) { cms = s.cms; break } }
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
    return res.status(200).json({ cms, finalUrl })
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? 'Trang đích phản hồi quá lâu' : (e as Error).message
    return res.status(200).json({ cms: 'Khác', error: msg })
  }
}
