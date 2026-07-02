// ─────────────────────────────────────────────────────────────────────────
// Bảng thông tin + GIÁ CHÍNH XÁC cho 2 model tạo ảnh (nano ↔ gpt-image-1.5).
// 1 NGUỒN SỰ THẬT duy nhất — mọi UI/estimator đọc từ đây (tránh lệch số).
// Giá KIE: 1 credit = $0.005. Đã verify khóa product/avatar bằng ảnh 2026-07-01.
// ─────────────────────────────────────────────────────────────────────────
import type { ImageGenChoice } from './kieai'

export interface ImageModelMeta {
  key: ImageGenChoice
  label: string
  provider: string
  /** Credit / 1 ảnh ở tier mặc định (nano 1K, gpt-1.5 medium). */
  creditsPerImage: number
  usdPerImage: number
  speed: string
  /** 1 dòng để user biết chọn cái nào. */
  note: string
}

export const IMAGE_MODEL_INFO: Record<ImageGenChoice, ImageModelMeta> = {
  nano: {
    key: 'nano', label: 'Nano Banana 2', provider: 'Google',
    creditsPerImage: 8, usdPerImage: 0.04, speed: '~28s',
    note: 'Ổn định nhất — backend Google, chống nghẽn OpenAI. Khóa product/avatar chắc, nhanh.',
  },
  gpt15: {
    key: 'gpt15', label: 'GPT Image 1.5', provider: 'OpenAI',
    creditsPerImage: 4, usdPerImage: 0.02, speed: '~1 phút',
    note: 'Rẻ một nửa · chữ/infographic đẹp hơn · khóa tốt. Chậm hơn, có thể nghẽn khi OpenAI quá tải (tự chuyển sang Nano khi lỗi).',
  },
}

export const IMAGE_MODEL_KEYS: ImageGenChoice[] = ['nano', 'gpt15']

/** Credit CHÍNH XÁC cho `count` ảnh theo model đang chọn. */
export function imageModelCredits(model: ImageGenChoice, count = 1): number {
  return IMAGE_MODEL_INFO[model].creditsPerImage * count
}
export function imageModelUsd(model: ImageGenChoice, count = 1): number {
  return +(IMAGE_MODEL_INFO[model].usdPerImage * count).toFixed(2)
}
