// ─────────────────────────────────────────────────────────────────────
// Gift Studio — Xưởng Quà Tặng Kèm (standalone).
//
// Mode bổ sung CHẠY RIÊNG, không đụng super-ladipage. Input: 1 sản phẩm
// (từ bank) + ảnh quà upload + tên quà + giá trị quà (RM) + ngôn ngữ.
// Output: 3 ảnh AI (chữ nướng trong ảnh — full AI, no canvas, theo đúng
// pipeline đã proven ở TikTok Shop / Super Ladipage qua gpt-4o-image):
//   1. banner — sản phẩm hero + teaser "tặng kèm [quà]"
//   2. combo  — combo giá: sản phẩm + quà + offer callout
//   3. info   — thẻ thông tin quà: quà hero + tên + Bernilai/Trị giá RMxx
//               + 2-3 công dụng (AI suy ra từ ảnh quà + tên)
//
// Ngôn ngữ: ms (Malaysia — thị trường chính, mặc định) / vi (phụ).
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

/** Mini-pitch quà do Gemini suy ra từ ẢNH quà + tên (đúng ngôn ngữ đích).
 *  Đây là nguồn "quà là gì / tác dụng" — user KHÔNG phải tự gõ. */
export interface GiftBenefits {
  /** 1 dòng headline ngắn cho món quà (vd "Túi đựng mỹ phẩm chống thấm"). */
  headline: string
  /** 2-3 gạch đầu dòng công dụng ngắn. */
  bullets: string[]
  /** Ngôn ngữ benefits đã sinh — để biết có cần sinh lại khi đổi lang. */
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
  /** Giá trị cảm nhận của quà, đơn vị RM (số nguyên, vd 49). */
  giftValueRM: number | null
  /** asset:xxx của ảnh quà user upload. */
  giftImageRef: string | null
  /** Ngôn ngữ đích của chiến dịch. */
  lang: Market
}

export function emptyGiftDraft(): GiftDraft {
  return {
    productId: null,
    giftName: '',
    giftValueRM: null,
    giftImageRef: null,
    lang: 'ms',
  }
}

/** Credit gpt-4o-image: 6/ảnh × 3 ảnh = 18. (Hằng số hiển thị cho user.) */
export const GIFT_CREDITS_PER_IMAGE = 6
export const GIFT_TOTAL_IMAGES = GIFT_IMAGE_KINDS.length
export const GIFT_TOTAL_CREDITS = GIFT_CREDITS_PER_IMAGE * GIFT_TOTAL_IMAGES
