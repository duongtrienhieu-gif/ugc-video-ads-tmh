// Research module — core types.
// Khớp với schema Supabase (migrations/research.sql) để sau này thay
// data mẫu → data Kalodata thật chỉ là đổi nguồn, không đổi type.

export type Market = 'MY' | 'TH' | 'ID' | 'VN'
export type Verdict = 'go' | 'consider' | 'avoid'
export type SkuRisk = 'low' | 'mid' | 'high'

export type NicheKey =
  | 'skincare'
  | 'home-repair'
  | 'car-acc'
  | 'health-nonfood'
  | 'kitchen'
  | 'home-problem'
  | 'personal-care'
  | 'other'

export interface ResearchProduct {
  productId: string
  market: Market
  title: string
  imageUrl?: string
  revenue: number          // RM
  growthRate: number       // % tăng trưởng doanh thu
  sale: number             // số lượng bán
  unitPrice: number        // RM
  minPrice?: number
  maxPrice?: number
  commissionRate: number   // %
  rating: number           // 0-5
  creatorNum: number
  competitionShops: number // số shop bán tương tự (proxy độ bão hòa)
  videoRevenue?: number    // có video đang đẩy?
  nicheKey: NicheKey
  skuVarianceRisk: SkuRisk
  revenueTrend?: number[]  // sparkline
  hotIn?: Market[]         // đang nổ ở market nào (cross-market hint)
  launchDate?: string
}

export interface SignalResult {
  key: string
  label: string
  display: string                     // giá trị hiển thị
  status: 'pass' | 'warn' | 'fail'
  detail: string                      // giải thích tiếng Việt
}

export interface ScoredProduct extends ResearchProduct {
  score: number                       // 0-100
  verdict: Verdict
  signals: SignalResult[]
  reasons: string[]                   // 2-3 lý do gọn cho thẻ
}

// ── Pricing ──────────────────────────────────────────────
export interface PricingInput {
  capitalVnd: number
  sellingPriceMyr: number             // giá bán 1 sản phẩm (combo suy ra)
  feeRatePct: number                  // tổng phí sàn (decimal, vd 0.189)
  affiliateRatePct: number            // decimal
  opsRatePct: number                  // decimal (0.15)
  profitTargetPct: number             // decimal (0.10-0.20)
  exchangeRate: number                // VND/MYR (fix 5500)
}

export interface ComboPricing {
  n: number
  revenueMyr: number
  capitalMyr: number
  feeMyr: number
  affiliateMyr: number
  opsMyr: number
  profitMyr: number
  cpaMaxMyr: number
  cpaMaxVnd: number
  profitVnd: number
  marginPct: number                   // decimal
  ok: boolean                         // còn cửa chạy ads?
}
