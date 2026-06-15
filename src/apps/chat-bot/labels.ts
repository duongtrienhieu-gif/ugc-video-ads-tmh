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
  feature: 'Tính năng',
  mechanism: 'Cơ chế hoạt động',
  promo: 'Khuyến mãi',
  feedback: 'Phản hồi / Bằng chứng',
  unboxing: 'Mở hộp / Dùng thử',
  compare: 'So sánh / Before-After',
  other: 'Khác',
}

export const STAGE_ORDER: Stage[] = [
  'greeting', 'value', 'qualify', 'advise', 'objection', 'close', 'followup',
]

export const ROLE_ORDER: MediaRole[] = [
  'feature', 'mechanism', 'promo', 'feedback', 'unboxing', 'compare', 'other',
]
