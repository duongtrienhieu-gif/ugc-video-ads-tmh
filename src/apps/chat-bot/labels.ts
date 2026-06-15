// Nhãn tiếng Việt cho các enum của CHAT BOT — dùng chung cho UI.
import type { Market, MediaRole, Stage } from './types'

export const MARKET_LABELS: Record<Market, string> = {
  VN: 'Việt Nam — Tiếng Việt (VND)',
  MY: 'Malaysia — Manglish (RM)',
}

export const STAGE_LABELS: Record<Stage, string> = {
  greeting: 'Chào mở đầu',
  value: 'Trao giá trị',
  qualify: 'Hỏi khai thác',
  advise: 'Tư vấn sâu',
  objection: 'Xử lý từ chối',
  close: 'Chốt đơn',
  followup: 'Nhắc lại',
}

export const ROLE_LABELS: Record<MediaRole, string> = {
  hook: 'Hook / Thu hút',
  pain: 'Vấn đề / Nỗi đau',
  feature: 'Tính năng / Thành phần',
  mechanism: 'Cơ chế hoạt động',
  usage: 'Hướng dẫn dùng (HDSD)',
  compare: 'So sánh / Before-After',
  proof: 'Phản hồi khách (review/WhatsApp)',
  authority: 'Báo chí / Chuyên gia',
  promo: 'Khuyến mãi / Giá',
  unboxing: 'Mở hộp / Dùng thử',
  other: 'Khác',
}

export const STAGE_ORDER: Stage[] = [
  'greeting', 'value', 'qualify', 'advise', 'objection', 'close', 'followup',
]

export const ROLE_ORDER: MediaRole[] = [
  'hook', 'pain', 'feature', 'mechanism', 'usage', 'compare', 'proof', 'authority', 'promo', 'unboxing', 'other',
]

/** Bậc gửi GỢI Ý mặc định theo vai trò — tự set khi user đổi role (vẫn sửa được).
 *  Logic: ảnh nào hợp với bước nào trong tiến trình tư vấn → chốt. */
export const ROLE_DEFAULT_STAGE: Record<MediaRole, Stage> = {
  hook: 'greeting',
  pain: 'qualify',
  feature: 'value',
  mechanism: 'advise',
  usage: 'advise',
  compare: 'objection',
  proof: 'objection',
  authority: 'objection',
  promo: 'close',
  unboxing: 'advise',
  other: 'value',
}
