// ── Vercel serverless — Research SP Win qua TikTok Shop (ScrapeCreators) ──────
// Frontend (module Research) gọi: /api/research?market=MY&niches=kw1,kw2&amount=30
// Key để SERVER-SIDE (process.env.SC_KEY trên Vercel) — không lộ ra browser.
// region map 1-1 với market: MY/TH/ID/VN/PH (các sàn TikTok Shop SEA).
//
// Response (200): { market, credits, count, errors[], products[] }
//   products[]: { productId, title, imageUrl, sale, unitPrice, rating, ship, seller, url, niche }
// Response (400/500): { error }

import type { VercelRequest, VercelResponse } from '@vercel/node'

const VALID_REGIONS = new Set(['MY', 'TH', 'ID', 'VN', 'PH'])

interface ScProduct {
  product_id?: string | number
  title?: string
  image?: { url_list?: string[] }
  sold_info?: { sold_count?: number }
  product_price_info?: { sale_price_format?: string }
  rate_info?: { rate_score?: number; score?: number }
  ship_from?: string
  seller_info?: { name?: string; seller_name?: string }
  seo_url?: string
}
interface ScResponse {
  products?: ScProduct[]
  credits_remaining?: number
  error?: string
  message?: string
}
interface LiveProduct {
  productId: string; title: string; imageUrl: string
  sale: number; unitPrice: string; rating: number
  ship: string; seller: string; url: string; niche: string
}

async function shopSearch(key: string, q: string, amount: number, region: string): Promise<ScResponse> {
  const u = `https://api.scrapecreators.com/v1/tiktok/shop/search?query=${encodeURIComponent(q)}&amount=${amount}&region=${region}`
  const r = await fetch(u, { headers: { 'x-api-key': key } })
  return (await r.json()) as ScResponse
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.SC_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu SC_KEY (đặt biến môi trường trên Vercel)' })

  const marketRaw = typeof req.query.market === 'string' ? req.query.market.toUpperCase() : 'MY'
  const region = VALID_REGIONS.has(marketRaw) ? marketRaw : 'MY'
  const niches = (typeof req.query.niches === 'string' ? req.query.niches : '')
    .split(',').map((s) => s.trim()).filter(Boolean).slice(0, 25)
  const amount = Math.min(parseInt(typeof req.query.amount === 'string' ? req.query.amount : '30', 10) || 30, 50)
  if (!niches.length) return res.status(400).json({ error: 'Cần ít nhất 1 từ khóa (niches)' })

  const map = new Map<string, LiveProduct>()
  let credits: number | null = null
  const errors: string[] = []

  for (const q of niches) {
    try {
      const d = await shopSearch(key, q, amount, region)
      if (d && d.credits_remaining != null) credits = d.credits_remaining
      const products = Array.isArray(d?.products) ? d.products : []
      if (!products.length) { errors.push(`${q}: ${d?.error || d?.message || 'no products'}`); continue }
      for (const p of products) {
        const lp: LiveProduct = {
          productId: String(p.product_id ?? ''),
          title: String(p.title ?? ''),
          imageUrl: p.image?.url_list?.[0] ?? '',
          sale: Number(p.sold_info?.sold_count ?? 0) || 0,
          unitPrice: String(p.product_price_info?.sale_price_format ?? ''),
          rating: Number(p.rate_info?.rate_score ?? p.rate_info?.score ?? 0) || 0,
          ship: p.ship_from ?? '',
          seller: p.seller_info?.name ?? p.seller_info?.seller_name ?? '',
          url: p.seo_url ?? '',
          niche: q,
        }
        if (!lp.productId) continue
        const ex = map.get(lp.productId)
        if (!ex || lp.sale > ex.sale) map.set(lp.productId, lp)
      }
    } catch (e) {
      errors.push(`${q}: ${(e as Error).message}`)
    }
  }

  const products = [...map.values()].sort((a, b) => b.sale - a.sale)
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900')
  return res.status(200).json({ market: region, credits, count: products.length, errors, products })
}
