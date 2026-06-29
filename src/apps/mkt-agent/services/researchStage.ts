// ── MKT Agent · Stage 0 — Research (tìm SP win, thị trường MY) ────────────────
// Tái dùng engine Research có sẵn: gọi /api/research (TikTok Shop MY qua
// ScrapeCreators) → map sang ResearchProduct (giống liveToProduct trong
// research/store) → scoreProduct (8 tín hiệu) → sort theo điểm. KHÔNG phụ thuộc
// Research store/UI — agent gọi headless được.
import type { ResearchProduct, ScoredProduct } from '../../research/types'
import { scoreProduct } from '../../research/services/scoring'
import { classifyNiche, classifySkuRisk } from '../../research/services/niche'

interface ApiProduct {
  productId: string | number
  title?: string
  imageUrl?: string
  sale?: number | string
  unitPrice?: string | number
  rating?: number | string
  ship?: string
  seller?: string
  url?: string
  niche?: string
}

// Giống research/store.liveToProduct (giữ default khớp để điểm số nhất quán).
function toResearchProduct(p: ApiProduct): ResearchProduct {
  const unitPrice = parseFloat(String(p.unitPrice ?? '').replace(/[^\d.]/g, '')) || 0
  const sale = Number(p.sale) || 0
  const title = p.title || '(không tên)'
  return {
    productId: String(p.productId),
    market: 'MY',
    title,
    imageUrl: p.imageUrl || undefined,
    revenue: Math.round(sale * unitPrice),
    growthRate: 0,
    sale,
    unitPrice,
    commissionRate: 0,
    rating: Number(p.rating) || 0,
    creatorNum: 0,
    competitionShops: 10,
    nicheKey: classifyNiche(title),
    skuVarianceRisk: classifySkuRisk(title),
    shipFrom: p.ship || undefined,
    seller: p.seller || undefined,
  }
}

export interface ScanResult {
  products: ScoredProduct[]
  credits: number
  errors: string[]
}

/** Quét SP win cho thị trường MY theo danh sách ngách. */
export async function scanWinningProducts(niches: string[], amount = 30): Promise<ScanResult> {
  const q = niches.map((s) => s.trim()).filter(Boolean).join(',')
  if (!q) return { products: [], credits: 0, errors: ['Chưa nhập ngách nào.'] }
  const r = await fetch(`/api/research?market=MY&niches=${encodeURIComponent(q)}&amount=${amount}`)
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`Research API lỗi ${r.status}${body ? ` — ${body.slice(0, 120)}` : ''}`)
  }
  const j = (await r.json()) as { products?: ApiProduct[]; credits?: number; errors?: string[] }
  const products = (j.products ?? [])
    .map(toResearchProduct)
    .map(scoreProduct)
    .sort((a, b) => b.score - a.score)
  return { products, credits: j.credits ?? 0, errors: j.errors ?? [] }
}
