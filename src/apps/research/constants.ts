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

// ── Tiền tệ theo thị trường (live TikTok Shop) ──
export const MARKET_CURRENCY: Record<Market, string> = { MY: 'RM', ID: 'Rp', TH: '฿', VN: '₫', PH: '₱' }

// ── Ngưỡng giá MỒI: SP để giá ~0 (teaser, giá thật ở variant) bị ẩn khi bật hideTeaser.
// Theo tiền tệ từng nước (RM 0.01 / Rp vài trăm…). SP có giá > 0 nhưng < floor = mồi.
export const MARKET_PRICE_FLOOR: Record<Market, number> = { MY: 1, ID: 1000, TH: 5, VN: 5000, PH: 5 }

// ── Ngách-preset cho QUÉT LIVE: chọn 1 cái → tự điền từ khóa → quét ngay ──
// Từ khóa kiểu universal/Malay-English (TikTok Shop search fuzzy, chạy được cả 5 nước).
// Ngách-preset: ưu tiên hàng TIÊU DÙNG NHANH, dễ UPSALE (mua nhiều/combo), dễ win COD.
// Mỗi ngách 10 từ khóa, trộn 4 lớp: (a) category English (b) từ Malay bản địa
// (c) triệu chứng/lợi ích (d) dạng sản phẩm — để bắt RỘNG, list SP đa dạng.
// ⚠️ 1 từ khóa = 1 credit/lần quét (10 kw → ~10 credit/ngách/thị trường).
export const NICHE_PRESETS: { label: string; emoji: string; keywords: string[] }[] = [
  { label: 'TPCN / Vitamin', emoji: '💊', keywords: ['vitamin', 'suplemen', 'multivitamin', 'omega 3', 'probiotik', 'vitamin c', 'zinc', 'immune booster', 'daya tahan badan', 'kesihatan'] },
  { label: 'Collagen / Đẹp da', emoji: '🌸', keywords: ['collagen', 'glutathione', 'whitening drink', 'beauty drink', 'kolagen', 'collagen drink', 'skin booster', 'awet muda', 'glowing skin', 'vitamin kulit'] },
  { label: 'Giảm cân / Detox', emoji: '🔥', keywords: ['slimming', 'detox', 'diet drink', 'fat burner', 'lemon detox', 'kurus', 'pelangsing', 'slim drink', 'fiber drink', 'buang lemak'] },
  { label: 'Sinh lý / Sức khỏe nam', emoji: '💪', keywords: ['tongkat ali', 'testosterone', 'maca', 'kuat tenaga', 'stamina lelaki', 'suplemen lelaki', 'tenaga batin', 'vitality men', 'booster lelaki', 'kesihatan lelaki'] },
  { label: 'Tóc / Rụng tóc', emoji: '💇', keywords: ['hair serum', 'hair growth', 'rambut gugur', 'anti hairfall', 'serum rambut', 'hair tonic', 'kebotakan', 'hair oil', 'rambut tebal', 'scalp treatment'] },
  { label: 'Skincare', emoji: '🧴', keywords: ['serum', 'sunscreen', 'face mask', 'moisturizer', 'toner', 'pelembap', 'krim muka', 'skincare set', 'niacinamide', 'hyaluronic'] },
  { label: 'Răng miệng', emoji: '🦷', keywords: ['teeth whitening', 'pemutih gigi', 'mouthwash', 'oral care', 'gigi putih', 'toothpaste', 'ubat gigi', 'fresh breath', 'gum care', 'dental kit'] },
  { label: 'Mẹ & bé', emoji: '🤰', keywords: ['baby vitamin', 'prenatal', 'vitamin kanak', 'susu kanak', 'baby care', 'ibu mengandung', 'baby skincare', 'milk booster', 'vitamin anak', 'produk bayi'] },
  { label: 'Dụng cụ sức khỏe', emoji: '🩹', keywords: ['massage gun', 'knee support', 'posture corrector', 'pain relief patch', 'alat urut', 'koyo', 'neck massager', 'back support', 'support lutut', 'alat terapi'] },
  { label: 'Đồ ăn vặt / Snack', emoji: '🍿', keywords: ['snack viral', 'kerepek', 'keripik', 'cookies', 'snek', 'makanan ringan', 'coklat', 'biskut', 'snack sihat', 'kuih viral'] },
  { label: 'Xương khớp / Đau nhức', emoji: '🦴', keywords: ['joint', 'sendi', 'sakit lutut', 'pain relief', 'urut', 'sakit sendi', 'glucosamine', 'sakit badan', 'sakit belakang', 'koyo panas'] },
  { label: 'Tiêu hóa / Dạ dày / Gan', emoji: '🌿', keywords: ['gastrik', 'probiotik usus', 'perut', 'detox usus', 'liver detox', 'sakit perut', 'pencernaan', 'gut health', 'enzyme', 'ubat gastrik'] },
  { label: 'Mắt / Thị lực', emoji: '👁️', keywords: ['lutein', 'eye vitamin', 'mata', 'penglihatan', 'eye care', 'vitamin mata', 'mata kabur', 'bilberry eye', 'eye supplement', 'kesihatan mata'] },
  { label: 'Ngủ ngon / Giảm stress', emoji: '😴', keywords: ['sleep', 'insomnia', 'magnesium', 'stress relief', 'susah tidur', 'melatonin', 'tidur lena', 'relax', 'anti stress', 'calm mind'] },
  { label: 'Vệ sinh PN / Trắng body', emoji: '🌺', keywords: ['feminine wash', 'body whitening', 'deodoran', 'ketiak', 'miss v', 'pemutih badan', 'bau badan', 'lotion pemutih', 'intimate wash', 'underarm'] },
  { label: 'Trang điểm / Son', emoji: '💄', keywords: ['lipstick', 'cushion', 'makeup', 'gincu', 'foundation', 'lip tint', 'bedak', 'mascara', 'eyeliner', 'mekap'] },
  { label: 'Đường huyết / Tim mạch', emoji: '🩸', keywords: ['diabetes', 'kolesterol', 'darah tinggi', 'gula darah', 'blood pressure', 'jantung', 'kawal gula', 'lemak darah', 'sugar control', 'kesihatan jantung'] },
  { label: 'Trị mụn / Trị nám', emoji: '🧖', keywords: ['acne', 'jerawat', 'dark spot', 'melasma', 'rawatan jerawat', 'parut jerawat', 'pigmentation', 'anti acne', 'kulit berjerawat', 'spot corrector'] },
]

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
  hideTeaser: boolean          // ẩn SP giá mồi (~0) — chỉ áp ở chế độ live
}
export const DEFAULT_FILTERS: ResearchFilters = {
  priceMaxMyr: 60,
  commissionMinPct: 0,
  growthMinPct: -100,
  lowSaturationOnly: false,
  hasCreatorOnly: false,
  hideHighSku: true,           // ẩn ngách nhiều SKU mặc định
  hideTeaser: true,            // ẩn SP giá mồi mặc định
}

// ── Preset "chọn nhanh" ──
export type PresetKey = 'hot' | 'cross' | 'profit' | 'new'
export const PRESETS: { key: PresetKey; label: string; emoji: string; apply: (f: ResearchFilters) => ResearchFilters }[] = [
  { key: 'hot', label: 'Đang nổ', emoji: '🔥', apply: (f) => ({ ...f, growthMinPct: 50, hasCreatorOnly: true }) },
  { key: 'cross', label: 'Cross-market', emoji: '🌏', apply: (f) => ({ ...f, growthMinPct: 0, lowSaturationOnly: true }) },
  { key: 'profit', label: 'Lời tốt + ít cạnh tranh', emoji: '💰', apply: (f) => ({ ...f, commissionMinPct: 20, lowSaturationOnly: true }) },
  { key: 'new', label: 'Mới lên', emoji: '🆕', apply: (f) => ({ ...f, growthMinPct: 100 }) },
]
