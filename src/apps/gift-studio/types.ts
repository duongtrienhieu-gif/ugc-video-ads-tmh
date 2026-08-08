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

/** Một MỐC TẶNG (tier combo) do AI parse từ ô dán offer.
 *  2 chiều "tặng": SẢN PHẨM CHÍNH (buy X free X) + QUÀ kèm (SP khác). */
export interface GiftTier {
  /** Mua mấy sản phẩm CHÍNH. */
  buyMainQty: number
  /** Tặng kèm mấy sản phẩm CHÍNH (buy X free X). 0 nếu không. */
  freeMainQty: number
  /** Tặng mấy món QUÀ (SP khác) ở mốc này. 0 = mốc không tặng quà. */
  giftQty: number
  /** Giá bán của mốc này (RM). */
  price: number
  /** Ghi chú ship của mốc (badge trong ảnh) — vd "FREESHIP" / "+RM6 Shipping". Chỉ mode Combo giá dùng. */
  shippingNote?: string
}

export const MAX_GIFT_TIERS = 4

/** 1 MÓN QUÀ trong bộ quà tặng kèm. Cho phép NHIỀU quà (tối đa MAX_GIFTS). */
export interface GiftItem {
  /** Tên quà (user nhập — có thể tiếng Việt, sẽ localize theo lang). */
  name: string
  /** Giá trị cảm nhận 1 món (RM). */
  valueRM: number | null
  /** asset:xxx ảnh quà. */
  imageRef: string | null
}
/** gpt-4o-image tối đa 5 ref (SP + quà). Chốt 3 quà → SP còn ≥2 ref. */
export const MAX_GIFTS = 3
export function emptyGiftItem(): GiftItem { return { name: '', valueRM: null, imageRef: null } }
/** Tổng trị giá BỘ quà (RM) = Σ giá trị từng món (bỏ món chưa nhập giá). */
export function giftSetValue(gifts: GiftItem[]): number {
  return gifts.reduce((s, g) => s + (g.valueRM ?? 0), 0)
}

/** Toán giá 1 tier (app tự tính — KHÔNG bắt user nhập giá gốc).
 *  - mainUnit = giá / số SP chính mua
 *  - giáGốc gạch = round(mainUnit × tổng SP chính) + giáTrịQuà × số quà
 *  - JIMAT = giáGốc − giá (gồm SP chính free + quà)
 *  - giftTotal = giáTrịQuà × số quà (trị giá quà nhân theo số lượng) */
export interface TierPricing {
  totalMainUnits: number
  giftTotalValue: number
  originalPrice: number
  jimat: number
}

// giftValueRM = TỔNG trị giá BỘ quà (đã gồm mọi món). Mode A: mỗi mốc tặng ĐÚNG 1 BỘ,
// nên giftQty CHỈ là có/không (>0 = có tặng bộ) — KHÔNG nhân theo số món (tránh đếm trùng).
export function computeTierPricing(tier: GiftTier, giftValueRM: number | null): TierPricing {
  const buy = Math.max(1, tier.buyMainQty)
  const totalMainUnits = tier.buyMainQty + tier.freeMainQty
  const mainUnit = tier.price / buy
  const giftTotalValue = tier.giftQty > 0 ? Math.round(giftValueRM ?? 0) : 0
  const originalPrice = Math.round(mainUnit * totalMainUnits) + giftTotalValue
  const jimat = originalPrice - tier.price
  return { totalMainUnits, giftTotalValue, originalPrice, jimat }
}

/** Mini-pitch quà do Gemini suy ra từ ẢNH quà + tên (đúng ngôn ngữ đích) +
 *  lớp copy bán hàng (wow / FOMO / nhấn giá trị). User KHÔNG phải tự gõ. */
export interface GiftBenefits {
  /** 1 dòng hook gây WOW (vd "Quà xịn hơn cả tiền bạn bỏ ra!"). */
  wowHook: string
  /** 1 dòng headline ngắn cho món quà (định vị/tên hấp dẫn). */
  headline: string
  /** Tên TỪNG quà ĐÃ DỊCH sang ngôn ngữ đích (theo thứ tự gifts[] — cho nhãn "N× tên quà"). */
  giftNamesLocalized: string[]
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
  /** DANH SÁCH quà tặng kèm (1..MAX_GIFTS). Bộ quà DÙNG CHUNG cho mọi tier (mode A). */
  gifts: GiftItem[]
  /** Ô dán offer thô (bất kỳ ngôn ngữ) — AI sẽ parse ra tiers. */
  offerText: string
  /** Các mốc tặng do AI parse từ offerText. Rỗng khi chưa parse. */
  tiers: GiftTier[]
  /** Sig của (offerText, lang) mà tiers đã parse — phát hiện stale. */
  tiersSig: string
  /** Ngôn ngữ đích của chiến dịch. */
  lang: Market
}

export function emptyGiftDraft(): GiftDraft {
  return {
    productId: null,
    gifts: [emptyGiftItem()],
    offerText: '',
    tiers: [],
    tiersSig: '',
    lang: 'ms',
  }
}

/** Sig phát hiện tiers stale khi đổi ô dán / ngôn ngữ. */
export function offerSig(offerText: string, lang: Market): string {
  return `${offerText.trim()}|${lang}`
}

/** Credit nano-banana-2 @ 1K: 8/ảnh × 3 ảnh = 24. (Hằng số hiển thị cho user.) */
export const GIFT_CREDITS_PER_IMAGE = 8
export const GIFT_TOTAL_IMAGES = GIFT_IMAGE_KINDS.length
export const GIFT_TOTAL_CREDITS = GIFT_CREDITS_PER_IMAGE * GIFT_TOTAL_IMAGES
