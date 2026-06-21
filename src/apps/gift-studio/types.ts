// ─────────────────────────────────────────────────────────────────────
// Gift Studio — Xưởng Quà Tặng Kèm (standalone).
//
// Mode bổ sung CHẠY RIÊNG, không đụng super-ladipage. Input: 1 sản phẩm
// (từ bank) + ảnh quà upload + tên quà + giá trị quà (RM) + các MỐC TẶNG
// (tier: mua X SP → tặng Y quà, giá bán/giá gốc) + ngôn ngữ.
//
// Output: 3 ảnh AI infographic giàu chữ/FOMO (chữ nướng trong ảnh — full
// AI, no canvas, theo pipeline gpt-4o-image đã proven ở TikTok Shop /
// Super Ladipage):
//   1. banner — poster mở đầu: hook WOW + quà nổi bật + giá trị quà to
//   2. combo  — infographic 9:16 xếp chồng tier (port combo-vertical),
//               mỗi tier kèm số quà tặng + JIMAT
//   3. info   — thẻ thông tin quà: quà hero + tên + Bernilai RMxx +
//               2-3 công dụng + dòng FOMO
//
// Ngôn ngữ: ms (Malaysia — chính, mặc định) / vi (phụ).
// ─────────────────────────────────────────────────────────────────────

import type { Market } from '../../types/brandKit'

export type { Market }

/** Ba loại ảnh sinh ra cho mỗi cấu hình quà. */
export type GiftImageKind = 'banner' | 'combo' | 'info'

export const GIFT_IMAGE_KINDS: GiftImageKind[] = ['banner', 'combo', 'info']

export type GiftImageStatus = 'idle' | 'generating' | 'completed' | 'failed'

/** Một ô ảnh trong lưới kết quả. */
export interface GiftImage {
  kind: GiftImageKind
  status: GiftImageStatus
  /** asset:xxx của ảnh đã sinh — undefined khi chưa có. */
  assetRef?: string
  /** Prompt đã gửi (lưu để debug / re-roll). */
  prompt?: string
  error?: string
}

/** Một MỐC TẶNG (tier combo): mua X sản phẩm → tặng Y quà ở mức giá này. */
export interface GiftTier {
  id: string
  /** Mua mấy sản phẩm. */
  buyQty: number
  /** Giá bán của mốc này (RM). */
  price: number
  /** Giá gốc (RM) — optional; nếu > price thì auto tính JIMAT. */
  originalPrice: number | null
  /** Tặng mấy món quà ở mốc này. */
  giftQty: number
}

export const MAX_GIFT_TIERS = 4

export function newGiftTier(buyQty = 1, giftQty = 1): GiftTier {
  return {
    id: `tier-${crypto.randomUUID().slice(0, 8)}`,
    buyQty,
    price: 0,
    originalPrice: null,
    giftQty,
  }
}

/** Mini-pitch quà do Gemini suy ra từ ẢNH quà + tên (đúng ngôn ngữ đích) +
 *  lớp copy bán hàng (wow / FOMO / nhấn giá trị). User KHÔNG phải tự gõ. */
export interface GiftBenefits {
  /** 1 dòng hook gây WOW (vd "Quà xịn hơn cả tiền bạn bỏ ra!"). */
  wowHook: string
  /** 1 dòng headline ngắn cho món quà (định vị/tên hấp dẫn). */
  headline: string
  /** 2-3 gạch đầu dòng công dụng ngắn. */
  bullets: string[]
  /** 1-2 dòng FOMO / khan hiếm / sợ bỏ lỡ. */
  fomoLines: string[]
  /** 1 dòng nhấn GIÁ TRỊ quà ("Bạn nhận thêm RM__ hoàn toàn miễn phí"). */
  valueLine: string
  /** Ngôn ngữ benefits đã sinh. */
  lang: Market
  /** Hash input (giftImageRef + name + lang) lúc sinh — phát hiện stale. */
  sig: string
}

/** Toàn bộ cấu hình + kết quả của 1 phiên Gift Studio (lưu localStorage). */
export interface GiftDraft {
  /** Sản phẩm chính lấy từ bank. */
  productId: string | null
  /** Tên quà (nguồn user nhập — có thể tiếng Việt, sẽ localize theo lang). */
  giftName: string
  /** Giá trị cảm nhận của 1 món quà, đơn vị RM (số nguyên, vd 49). */
  giftValueRM: number | null
  /** asset:xxx của ảnh quà user upload. */
  giftImageRef: string | null
  /** Các mốc tặng (1-4 tier). */
  tiers: GiftTier[]
  /** Ngôn ngữ đích của chiến dịch. */
  lang: Market
}

export function emptyGiftDraft(): GiftDraft {
  return {
    productId: null,
    giftName: '',
    giftValueRM: null,
    giftImageRef: null,
    tiers: [newGiftTier(1, 1)],
    lang: 'ms',
  }
}

/** Credit gpt-4o-image: 6/ảnh × 3 ảnh = 18. (Hằng số hiển thị cho user.) */
export const GIFT_CREDITS_PER_IMAGE = 6
export const GIFT_TOTAL_IMAGES = GIFT_IMAGE_KINDS.length
export const GIFT_TOTAL_CREDITS = GIFT_CREDITS_PER_IMAGE * GIFT_TOTAL_IMAGES
