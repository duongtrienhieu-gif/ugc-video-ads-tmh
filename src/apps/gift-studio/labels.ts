// ─────────────────────────────────────────────────────────────────────
// Gift Studio — nhãn cố định song ngữ (ms chính / vi phụ).
//
// Đây là CHỮ sẽ được AI "nướng" vào ảnh, nên phải localize chuẩn theo
// ngôn ngữ đích. Gemini lo phần văn (tên/công dụng/FOMO quà); module này
// lo các nhãn/badge cố định để prompt luôn nhất quán.
// ─────────────────────────────────────────────────────────────────────

import type { Market } from '../../types/brandKit'

export interface GiftLabels {
  /** Tên ngôn ngữ (đưa vào prompt để hard-lock chữ trong ảnh). */
  langName: string
  /** Badge "quà tặng kèm". */
  freeGiftBadge: string
  /** Từ "MIỄN PHÍ" / "PERCUMA". */
  free: string
  /** "Trị giá RM{n}" / "Bernilai RM{n}". */
  valueLabel: (rm: number) => string
  /** Tiêu đề khối thông tin quà. */
  giftInfoTitle: string
  /** Tiêu đề poster combo. */
  comboTitle: string
  /** Câu CTA ngắn dán trên banner. */
  bannerCta: string
  /** Nhãn tier "deal label": mua X → tặng Y quà. */
  tierDealLabel: (buyQty: number, giftQty: number) => string
  /** Badge gói ở mép trái mỗi tier (PAKEJ 1 / GÓI 1). */
  packageBadge: (i: number) => string
  /** "JIMAT RM{n}" / "TIẾT KIỆM RM{n}". */
  savingsLabel: (rm: number) => string
}

const MS: GiftLabels = {
  langName: 'Bahasa Malaysia',
  freeGiftBadge: 'HADIAH PERCUMA',
  free: 'PERCUMA',
  valueLabel: (rm) => `Bernilai RM${rm}`,
  giftInfoTitle: 'Hadiah Anda',
  comboTitle: 'TAWARAN COMBO HARI INI',
  bannerCta: 'Order hari ini',
  tierDealLabel: (b, g) => `BELI ${b} HADIAH ${g} PERCUMA`,
  packageBadge: (i) => `PAKEJ ${i}`,
  savingsLabel: (rm) => `JIMAT RM${rm}`,
}

const VI: GiftLabels = {
  langName: 'Tiếng Việt',
  freeGiftBadge: 'QUÀ TẶNG KÈM',
  free: 'MIỄN PHÍ',
  valueLabel: (rm) => `Trị giá RM${rm}`,
  giftInfoTitle: 'Quà tặng của bạn',
  comboTitle: 'COMBO ƯU ĐÃI HÔM NAY',
  bannerCta: 'Đặt ngay hôm nay',
  tierDealLabel: (b, g) => `MUA ${b} TẶNG ${g} QUÀ`,
  packageBadge: (i) => `GÓI ${i}`,
  savingsLabel: (rm) => `TIẾT KIỆM RM${rm}`,
}

export function giftLabels(lang: Market): GiftLabels {
  return lang === 'vi' ? VI : MS
}

export function langDisplayName(lang: Market): string {
  return lang === 'vi' ? 'Tiếng Việt' : 'Bahasa Malaysia'
}

/** Badge góc theo thứ hạng tier (đã rated đẹp ở ảnh mẫu). Giữ tiếng Anh
 *  (universal, dễ đọc trong ảnh) cho cả 2 ngôn ngữ. */
export const TIER_CORNER_BADGES = ['', 'HOT DEAL', 'BEST SELLER', 'MAX VALUE'] as const

/** Màu phân tier (đưa vào prompt để AI tô khác nhau giữa các mốc). */
export const TIER_COLORS = [
  'blue/teal',
  'red/orange',
  'amber/gold',
  'purple/violet',
] as const
