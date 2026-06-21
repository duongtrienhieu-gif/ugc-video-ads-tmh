// ─────────────────────────────────────────────────────────────────────
// Gift Studio — nhãn cố định song ngữ (ms chính / vi phụ).
//
// Đây là CHỮ sẽ được AI "nướng" vào ảnh, nên phải localize chuẩn theo
// ngôn ngữ đích. Gemini lo phần văn (tên/công dụng quà); module này lo
// các nhãn/badge cố định để prompt luôn nhất quán.
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
  /** Nhãn "COMBO" / khuyến mãi. */
  comboLabel: string
  /** Câu CTA ngắn dán trên banner. */
  bannerCta: string
}

const MS: GiftLabels = {
  langName: 'Bahasa Malaysia',
  freeGiftBadge: 'HADIAH PERCUMA',
  free: 'PERCUMA',
  valueLabel: (rm) => `Bernilai RM${rm}`,
  giftInfoTitle: 'Hadiah Anda',
  comboLabel: 'COMBO JIMAT',
  bannerCta: 'Order hari ini',
}

const VI: GiftLabels = {
  langName: 'Tiếng Việt',
  freeGiftBadge: 'QUÀ TẶNG KÈM',
  free: 'MIỄN PHÍ',
  valueLabel: (rm) => `Trị giá RM${rm}`,
  giftInfoTitle: 'Quà tặng của bạn',
  comboLabel: 'COMBO ƯU ĐÃI',
  bannerCta: 'Đặt ngay hôm nay',
}

export function giftLabels(lang: Market): GiftLabels {
  return lang === 'vi' ? VI : MS
}

export function langDisplayName(lang: Market): string {
  return lang === 'vi' ? 'Tiếng Việt' : 'Bahasa Malaysia'
}
