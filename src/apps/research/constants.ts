// Research module — hằng số: thị trường, ngách, ngưỡng chấm điểm, phí, verdict.
import type { Market, NicheKey, Verdict } from './types'

// ── Tỷ giá FIX 5500 (business intent — KHÔNG sửa thành tỷ giá thật) ──
export const EXCHANGE_RATE_VND_PER_MYR = 5500

// ── Phí sàn MY mặc định (từ settlement thực: 3.78 + 10.26 + 4.85 ≈ 18.9%) ──
export const DEFAULT_FEES = {
  transactionPct: 0.0378,
  commissionPct: 0.1026,
  bxpPct: 0.0485,
}
export const DEFAULT_TOTAL_FEE_PCT =
  DEFAULT_FEES.transactionPct + DEFAULT_FEES.commissionPct + DEFAULT_FEES.bxpPct

export const DEFAULT_OPS_PCT = 0.15           // vận hành fix cứng 15%
export const DEFAULT_AFFILIATE_PCT = 0.20     // hoa hồng affiliate gợi ý
export const DEFAULT_PROFIT_PCT = 0.15        // lợi nhuận mong muốn mặc định

// Hệ số giá combo (combo rẻ hơn mua lẻ chút để kích combo)
export const COMBO_MULTIPLIERS: Record<number, number> = { 1: 1, 2: 1.85, 3: 2.6 }

// ── Thị trường ──
export const MARKETS: { key: Market; label: string; flag: string; primary?: boolean }[] = [
  { key: 'MY', label: 'Malaysia', flag: '🇲🇾', primary: true },
  { key: 'TH', label: 'Thái Lan', flag: '🇹🇭' },
  { key: 'ID', label: 'Indonesia', flag: '🇮🇩' },
  { key: 'VN', label: 'Việt Nam', flag: '🇻🇳' },
  { key: 'PH', label: 'Philippines', flag: '🇵🇭' },
]

// ── 7 vùng săn (ngách) ↔ nhân sự ──
export const NICHES: { key: NicheKey; label: string; owner: string; emoji: string }[] = [
  { key: 'skincare', label: 'Chăm sóc da/tóc', owner: 'Hà', emoji: '🧴' },
  { key: 'home-repair', label: 'Gia dụng & dụng cụ sửa chữa', owner: 'Tuấn', emoji: '🔧' },
  { key: 'car-acc', label: 'Phụ kiện ô tô', owner: 'Anh', emoji: '🚗' },
  { key: 'health-nonfood', label: 'Sức khỏe (không uống)', owner: 'Duy', emoji: '💪' },
  { key: 'kitchen', label: 'Đồ dùng nhà bếp', owner: 'Khánh', emoji: '🍳' },
  { key: 'home-problem', label: 'Gia dụng giải quyết vấn đề', owner: 'Phy', emoji: '🧯' },
  { key: 'personal-care', label: 'Đồ vệ sinh cá nhân', owner: 'Uyn', emoji: '🪥' },
]

export function nicheLabel(key: NicheKey): string {
  return NICHES.find((n) => n.key === key)?.label ?? key
}

// ── Verdict ──
export const VERDICT_META: Record<Verdict, { label: string; emoji: string; color: string; bg: string }> = {
  go: { label: 'Nên test', emoji: '🟢', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  consider: { label: 'Cân nhắc', emoji: '🟡', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  avoid: { label: 'Tránh', emoji: '🔴', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
}

// Ngưỡng điểm → verdict
export const VERDICT_THRESHOLDS = { go: 72, consider: 50 }

// ── Trọng số 8 tín hiệu (tổng = 100) ──
export const SIGNAL_WEIGHTS = {
  growth: 25,
  saturation: 15,
  price: 10,
  commission: 15,
  rating: 10,
  creators: 10,
  videoAngle: 5,
  crossMarket: 10,
}

// ── Bộ lọc mặc định ──
export interface ResearchFilters {
  priceMaxMyr: number
  commissionMinPct: number     // %
  growthMinPct: number         // %
  lowSaturationOnly: boolean
  hasCreatorOnly: boolean
  hideHighSku: boolean
}
export const DEFAULT_FILTERS: ResearchFilters = {
  priceMaxMyr: 60,
  commissionMinPct: 0,
  growthMinPct: -100,
  lowSaturationOnly: false,
  hasCreatorOnly: false,
  hideHighSku: true,           // ẩn ngách nhiều SKU mặc định
}

// ── Preset "chọn nhanh" ──
export type PresetKey = 'hot' | 'cross' | 'profit' | 'new'
export const PRESETS: { key: PresetKey; label: string; emoji: string; apply: (f: ResearchFilters) => ResearchFilters }[] = [
  { key: 'hot', label: 'Đang nổ', emoji: '🔥', apply: (f) => ({ ...f, growthMinPct: 50, hasCreatorOnly: true }) },
  { key: 'cross', label: 'Cross-market', emoji: '🌏', apply: (f) => ({ ...f, growthMinPct: 0, lowSaturationOnly: true }) },
  { key: 'profit', label: 'Lời tốt + ít cạnh tranh', emoji: '💰', apply: (f) => ({ ...f, commissionMinPct: 20, lowSaturationOnly: true }) },
  { key: 'new', label: 'Mới lên', emoji: '🆕', apply: (f) => ({ ...f, growthMinPct: 100 }) },
]
