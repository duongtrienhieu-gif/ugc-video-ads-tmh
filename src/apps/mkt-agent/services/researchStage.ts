// ── MKT Agent · Stage 0 — Research (tìm SP win, MY) ──────────────────────────
// Quét TikTok Shop MY qua /api/research → SpCandidate. Tín hiệu TIN CẬY = số bán
// (sort theo đây). Giá parse robust (sale_price_format chập chờn). Branding +
// 1688-verify (test được?) làm ở bước riêng (brandingFilter / sourcing1688).
import type { SpCandidate } from '../store'

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

// Giá có thể là DẢI (biến thể): "RM1.00 - RM18.50" — trong đó số nhỏ (RM1) thường
// là option rác/đặt cọc (vd "Lalai") → lấy số đầu sẽ SAI. Cách đúng: bỏ giá quá
// thấp (<RM3, gần như luôn là đặt cọc/sample) rồi lấy giá "từ" (min còn lại);
// nếu tất cả đều thấp thì lấy max (SP giá rẻ thật).
function parsePrice(s: string | number | undefined): number {
  const nums = String(s ?? '').match(/\d[\d,]*\.?\d*/g)
  if (!nums) return 0
  const vals = nums.map((n) => parseFloat(n.replace(/,/g, '')) || 0).filter((n) => n > 0)
  if (!vals.length) return 0
  const real = vals.filter((v) => v >= 3)
  return real.length ? Math.min(...real) : Math.max(...vals)
}

export interface ScanResult {
  candidates: SpCandidate[]
  credits: number
  errors: string[]
}

export async function scanWinningProducts(niches: string[], amount = 30): Promise<ScanResult> {
  const q = niches.map((s) => s.trim()).filter(Boolean).join(',')
  if (!q) return { candidates: [], credits: 0, errors: ['Chưa nhập ngách nào.'] }
  const r = await fetch(`/api/research?market=MY&niches=${encodeURIComponent(q)}&amount=${amount}`)
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`Research API lỗi ${r.status}${body ? ` — ${body.slice(0, 120)}` : ''}`)
  }
  const j = (await r.json()) as { products?: ApiProduct[]; credits?: number; errors?: string[] }
  const candidates: SpCandidate[] = (j.products ?? []).map((p) => {
    const sale = Number(p.sale) || 0
    const price = parsePrice(p.unitPrice)
    return {
      productId: String(p.productId),
      title: p.title || '(không tên)',
      imageUrl: p.imageUrl || undefined,
      seller: p.seller || undefined,
      url: p.url || undefined,
      sale,
      price,
      revenue: Math.round(sale * price),
      rating: Number(p.rating) || 0,
      niche: p.niche || undefined,
      shipFrom: p.ship || undefined,
      source: 'tiktok' as const,
    }
  }).sort((a, b) => b.sale - a.sale)
  return { candidates, credits: j.credits ?? 0, errors: j.errors ?? [] }
}
