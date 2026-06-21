// ─────────────────────────────────────────────────────────────────────
// Re-Branding Sản phẩm — Mode 3 của "Xưởng Ảnh".
//
// White-label/rebrand cho COD: lấy SP gốc (ảnh upload + thông tin từ bank)
// + kích thước thật (cm) → AI tạo brand mới (giữ tông màu gốc, đặt tên mới
// hợp thị trường), xuất 4 ảnh:
//   • label-front : nhãn mặt trước, kích thước thật (canvas, chữ nét, để IN)
//   • label-back  : nhãn mặt sau (thành phần/HDSD), để IN
//   • product     : SP gốc đeo nhãn mới (AI i2i, ảnh bán)
//   • set         : hộp + SP thật bên trong, nhãn mới (AI i2i, ảnh bán)
//
// Thị trường: vi → nhãn TIẾNG VIỆT, ms → nhãn TIẾNG ANH (gu export MY).
// ─────────────────────────────────────────────────────────────────────

import type { Market } from '../../types/brandKit'

export type { Market }

export type RebrandImageKind = 'label' | 'product' | 'set'
export const REBRAND_IMAGE_KINDS: RebrandImageKind[] = ['label', 'product', 'set']

/** Kiểu dán nhãn — quyết định bố cục nhãn gộp.
 *  flat  = dán 1 mặt (túi/hộp phẳng): gộp front+back lên 1 mặt.
 *  round = quấn quanh lọ/hộp tròn: nhãn dài [front · gap giữa · back]. */
export type PackagingType = 'flat' | 'round'

/** Model render NHÃN: gpt4o (1K, bám ref tốt, look quen) / nano4k (4K nét, để in). */
export type LabelModel = 'gpt4o' | 'nano4k'

export type RebrandStatus = 'idle' | 'generating' | 'completed' | 'failed'

export interface RebrandImage {
  kind: RebrandImageKind
  status: RebrandStatus
  assetRef?: string
  error?: string
}

export interface RebrandPalette {
  bg: string
  primary: string
  accent: string
  onColor: string
  /** 5-6 màu chủ đạo trích từ bản gốc (giàu vibe, không chỉ 2 màu). */
  colors: string[]
}

/** Kết quả AI phân tích bản gốc + đặt tên (Gemini vision). */
export interface RebrandIdentity {
  /** 3 tên brand đề xuất. */
  names: string[]
  palette: RebrandPalette
  /** Mô tả ENG form sản phẩm (tube/jar/bottle/sachet…) để i2i giữ form. */
  productForm: string
  /** Loại sản phẩm ngắn (ENG) — dùng cho prompt. */
  productType: string
  /** Tagline ngắn (theo ngôn ngữ nhãn). */
  tagline: string
  /** 2-3 lợi ích ngắn (theo ngôn ngữ nhãn) cho mặt trước. */
  benefits: string[]
  /** Khối lượng/dung tích lấy từ bản gốc nếu thấy (vd "30ml"). */
  netWeight: string
  /** Thành phần (theo ngôn ngữ nhãn) cho mặt sau. */
  ingredients: string
  /** Hướng dẫn dùng (theo ngôn ngữ nhãn) cho mặt sau. */
  usage: string
  /** Lưu ý/bảo quản ngắn (theo ngôn ngữ nhãn). */
  caution: string
  /** Bảng dinh dưỡng/100g (AI ước lượng — user phải verify trước khi in). */
  nutrition: string
  /** Mô tả vibe bản gốc (phong cách nền/cảnh + tâm trạng + hoạ tiết) để bám ~75%. */
  vibe: string
  market: Market
  sig: string
}

export interface RebrandDraft {
  productId: string | null
  /** Ảnh gốc user upload (SP/bao bì/hộp) — asset refs. */
  originalImageRefs: string[]
  /** Kích thước nhãn thật (cm). flat = nhãn; round = chu vi × cao. */
  widthCm: number | null
  heightCm: number | null
  /** Kiểu dán nhãn. */
  packagingType: PackagingType
  /** Model render nhãn. */
  labelModel: LabelModel
  market: Market
  /** Tên brand user đã chọn từ identity.names. */
  chosenName: string | null
}

export function emptyRebrandDraft(): RebrandDraft {
  return { productId: null, originalImageRefs: [], widthCm: null, heightCm: null, packagingType: 'flat', labelModel: 'gpt4o', market: 'vi', chosenName: null }
}

export const MAX_ORIGINAL_IMAGES = 4
export const REBRAND_PRINT_DPI = 300

/** cm → px @ DPI (cho file in). Cap để tránh canvas khổng lồ. */
export function cmToPx(cm: number, dpi = REBRAND_PRINT_DPI, maxPx = 2400): number {
  const px = Math.round((cm / 2.54) * dpi)
  return Math.max(64, Math.min(maxPx, px))
}

export function labelLangName(market: Market): string {
  return market === 'vi' ? 'Tiếng Việt' : 'English'
}

/** Sig phát hiện identity stale. */
export function rebrandSig(d: { productId: string | null; originalImageRefs: string[]; market: Market }): string {
  return `v3|${d.productId ?? ''}|${d.market}|${d.originalImageRefs.join(',')}`
}

/** 3 ảnh (nhãn gộp + product + set) đều qua gpt-4o-image (6 mỗi ảnh). */
export const REBRAND_AI_IMAGES = 3
export const REBRAND_TOTAL_CREDITS = 6 * REBRAND_AI_IMAGES
