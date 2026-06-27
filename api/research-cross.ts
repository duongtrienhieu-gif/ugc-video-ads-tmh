// ── Vercel serverless — CROSS-MARKET: 1 từ khóa quét 5 nước, so số bán ──────
// Frontend: /api/research-cross?q=collagen&markets=MY,ID,TH,VN,PH
// Trả tóm tắt mỗi nước: tổng số bán (top 30), top SP, #SP → bảng nhiệt arbitrage.
import type { VercelRequest, VercelResponse } from '@vercel/node'

const ALL = ['MY', 'ID', 'TH', 'VN', 'PH']

interface ScProduct {
  product_id?: string | number
  title?: string
  image?: { url_list?: string[] }
  sold_info?: { sold_count?: number }
  product_price_info?: { sale_price_format?: string }
  seo_url?: string | { canonical_url?: string }
}
interface ScResp { products?: ScProduct[]; credits_remaining?: number; error?: string; message?: string }

async function search(key: string, q: string, region: string, amount: number): Promise<ScResp> {
  const u = `https://api.scrapecreators.com/v1/tiktok/shop/search?query=${encodeURIComponent(q)}&amount=${amount}&region=${region}`
  const r = await fetch(u, { headers: { 'x-api-key': key } })
  return (await r.json()) as ScResp
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.SC_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu SC_KEY' })

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) return res.status(400).json({ error: 'Cần q (từ khóa)' })
  const markets = (typeof req.query.markets === 'string' ? req.query.markets : ALL.join(','))
    .split(',').map((s) => s.trim().toUpperCase()).filter((m) => ALL.includes(m))
  const amount = Math.min(parseInt(typeof req.query.amount === 'string' ? req.query.amount : '30', 10) || 30, 50)

  const rows: unknown[] = []
  let credits: number | null = null
  const errors: string[] = []

  for (const region of markets) {
    try {
      const d = await search(key, q, region, amount)
      if (d.credits_remaining != null) credits = d.credits_remaining
      const products = Array.isArray(d.products) ? d.products : []
      const sold = products.map((p) => Number(p.sold_info?.sold_count ?? 0) || 0)
      const totalSold = sold.reduce((a, b) => a + b, 0)
      // Top 4 SP theo số bán → board arbitrage (xem SP nào nổ ở nước nào).
      const ranked = products
        .map((p) => ({ p, s: Number(p.sold_info?.sold_count ?? 0) || 0 }))
        .sort((a, b) => b.s - a.s)
      const top = ranked[0]?.p ?? null
      const topSold = ranked[0]?.s ?? 0
      const topProducts = ranked.slice(0, 4).map(({ p, s }) => ({
        title: p.title ?? '',
        image: p.image?.url_list?.[0] ?? '',
        sold: s,
        price: p.product_price_info?.sale_price_format ?? '',
        url: typeof p.seo_url === 'string' ? p.seo_url : (p.seo_url?.canonical_url ?? ''),
      }))
      rows.push({
        market: region,
        count: products.length,
        totalSold,
        topSold: top ? topSold : 0,
        topTitle: top?.title ?? '',
        topImage: top?.image?.url_list?.[0] ?? '',
        topProducts,
      })
      if (!products.length) errors.push(`${region}: ${d.error || d.message || 'no products'}`)
    } catch (e) {
      errors.push(`${region}: ${(e as Error).message}`)
      rows.push({ market: region, count: 0, totalSold: 0, topSold: 0, topTitle: '', topImage: '', topProducts: [] })
    }
  }

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900')
  return res.status(200).json({ q, markets: rows, credits, errors })
}
