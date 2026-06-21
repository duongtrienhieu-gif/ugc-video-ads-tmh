// ─────────────────────────────────────────────────────────────────────
// Form BG Studio — Xưởng Nền Form Đặt Hàng (standalone).
//
// Tạo ẢNH NỀN cho khu form đặt hàng LadiPage: header marketing đẹp +
// VÙNG FORM TRỐNG ở giữa (user tải về, đè widget form thật lên) + footer
// trust. KHÔNG vẽ ô input/nút vào vùng form.
//
// 3 preset art-direction (đã chốt với user):
//   • editorial      — Bìa tạp chí uy tín (tem chuyên gia, sạch)
//   • abundance      — Mâm quà thịnh soạn (SP + quà + combo, cần ảnh quà)
//   • transformation — Lát cắt Trước–Sau (vấn đề→kết quả)
//
// AI tự: đọc 4 ảnh SP → chọn ảnh hero hợp nhất + trích palette từ SP +
// sinh copy MY/VN bản địa theo preset. Render gpt-4o-image (i2i giữ
// identity), xuất 2 BIẾN THỂ. Ngôn ngữ ms (chính) / vi (phụ).
// ─────────────────────────────────────────────────────────────────────

import type { Market } from '../../types/brandKit'

export type { Market }

export type FormBgPreset = 'editorial' | 'abundance' | 'transformation'

export interface PresetMeta {
  id: FormBgPreset
  label: string
  hint: string
  /** Cần ảnh quà mới hợp lý (abundance). */
  needsGift: boolean
}

export const FORM_BG_PRESETS: PresetMeta[] = [
  { id: 'editorial', label: 'Bìa tạp chí uy tín', hint: 'Editorial + tem chuyên gia — thắng khách hoài nghi', needsGift: false },
  { id: 'abundance', label: 'Mâm quà thịnh soạn', hint: 'SP + quà + combo đầy ắp — tâm lý được nhiều', needsGift: true },
  { id: 'transformation', label: 'Lát cắt Trước–Sau', hint: 'Vấn đề → kết quả — bằng chứng là hook', needsGift: false },
]

/** Xuất 2 biến thể mỗi lần (user chốt). */
export const FORM_BG_VARIANTS = 2

export type FormBgStatus = 'idle' | 'generating' | 'completed' | 'failed'

/** Mỗi biến thể = 1 ẢNH dọc 2:3 chứa: header + dải FOMO (có Ô TRỐNG cho đồng
 *  hồ) + khu form trống (nền phẳng palette.bg) + footer. User tự cắt header/
 *  footer, set nền section = palette.bg, nhét đồng hồ + form vào ô trống. */
export interface FormBgImage {
  index: number
  status: FormBgStatus
  assetRef?: string
  error?: string
}

/** Palette AI trích từ sản phẩm (hex). */
export interface FormBgPalette {
  bg: string
  primary: string
  accent: string
  onColor: string
}

/** Kết quả "art-direction" do Gemini vision sinh ra (chọn ảnh + màu + copy). */
export interface ProductDirection {
  /** Index ảnh SP (0..3) AI chọn làm hero. */
  heroImageIndex: number
  palette: FormBgPalette
  /** Mô tả ngắn SP (ENG) để grounding prompt ảnh. */
  productLabel: string
  headline: string
  subhead: string
  ctaWord: string
  scarcity: string
  trust: string
  /** Dải FOMO (đi với đồng hồ). */
  fomoTitle: string
  /** POOL 3-4 dòng FOMO khác cơ chế (deadline/giá bật lại · khan hiếm ·
   *  chỉ dành cho người mua đầu · sợ bỏ lỡ). Mỗi biến thể lấy khác nhau. */
  fomoLines: string[]
  /** Cho preset editorial. */
  testimonial?: string
  /** Cho preset abundance (khi có quà). */
  giftTeaser?: string
  lang: Market
  preset: FormBgPreset
  sig: string
}

export interface FormBgDraft {
  productId: string | null
  /** asset:xxx ảnh quà — chỉ cần cho preset abundance. */
  giftImageRef: string | null
  preset: FormBgPreset
  lang: Market
}

export function emptyFormBgDraft(): FormBgDraft {
  return { productId: null, giftImageRef: null, preset: 'editorial', lang: 'ms' }
}

/** Sig phát hiện direction stale. */
export function directionSig(d: { productId: string | null; preset: FormBgPreset; lang: Market; giftImageRef: string | null }): string {
  // v2: đổi schema FOMO (fomoLine → fomoLines pool) → invalidate cache cũ.
  return `v2|${d.productId ?? ''}|${d.preset}|${d.lang}|${d.giftImageRef ? 'g' : 'n'}`
}

/** Palette mặc định (fallback khi vision lỗi) theo preset. */
export function defaultPalette(preset: FormBgPreset): FormBgPalette {
  switch (preset) {
    case 'abundance':      return { bg: '#FFE9CE', primary: '#C0392B', accent: '#1D9E75', onColor: '#FFFFFF' }
    case 'transformation': return { bg: '#FFFFFF', primary: '#15A05E', accent: '#5F6E7C', onColor: '#FFFFFF' }
    case 'editorial':
    default:               return { bg: '#F6F1E7', primary: '#1F2A33', accent: '#0F6E56', onColor: '#FFFFFF' }
  }
}

export const FORM_BG_CREDITS_PER_IMAGE = 6
export const FORM_BG_TOTAL_CREDITS = FORM_BG_CREDITS_PER_IMAGE * FORM_BG_VARIANTS
