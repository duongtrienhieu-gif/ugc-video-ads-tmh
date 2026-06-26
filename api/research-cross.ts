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
      let top: ScProduct | null = null
      let topSold = -1
      for (const p of products) {
        const s = Number(p.sold_info?.sold_count ?? 0) || 0
        if (s > topSold) { topSold = s; top = p }
      }
      rows.push({
        market: region,
        count: products.length,
        totalSold,
        topSold: top ? topSold : 0,
        topTitle: top?.title ?? '',
        topImage: top?.image?.url_list?.[0] ?? '',
      })
      if (!products.length) errors.push(`${region}: ${d.error || d.message || 'no products'}`)
    } catch (e) {
      errors.push(`${region}: ${(e as Error).message}`)
      rows.push({ market: region, count: 0, totalSold: 0, topSold: 0, topTitle: '', topImage: '' })
    }
  }

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900')
  return res.status(200).json({ q, markets: rows, credits, errors })
}
