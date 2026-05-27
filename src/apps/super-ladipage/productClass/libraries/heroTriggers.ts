// ─────────────────────────────────────────────────────────────────────
// Product Class — hero recognition triggers library
//
// Per-MechanismFamily concrete self-recognition signals for the hero
// opening (chương 1). These are physical / sensory specifics the reader
// of THIS product type immediately recognizes about their own life.
//
// USAGE: storytelling Gemini prompt receives 3-5 triggers as POSITIVE
// recognition vocabulary for the hero opening — Gemini incorporates them
// into the first 1-2 paragraphs. NOT a rule list, just relevant context.
// ─────────────────────────────────────────────────────────────────────

import type { MechanismFamily } from '../types'

export const HERO_TRIGGERS: Record<MechanismFamily, string[]> = {
  'physical-stabilization': [
    'leo cầu thang chậm dần — đến tầng hai là phải dừng nghỉ',
    'đứng dậy từ ghế thấp phải vịn vào bàn',
    'tiếng "rắc" khi gập đầu gối lúc ngồi xổm',
    'đi bộ xa hơn 200m là đầu gối kêu mỏi',
    'sáng dậy đứng lên là khớp cứng vài phút mới đi được',
    'cầm tay vịn lan can mỗi lần xuống cầu thang',
    'ngồi xổm khó / không đứng dậy được',
    'đầu gối "mềm" khi đi xuống dốc',
  ],

  'wearable-support': [
    'cuối ngày bắp chân nặng như chì',
    'đứng quầy tính tiền 6 tiếng là chân sưng',
    'vớ tất hằn vào da khi tháo ra cuối ngày',
    'đi giày cao 2 tiếng là gân chân đau',
    'ngồi máy bay xa là bắp chân nhức',
  ],

  'mechanical-aid': [
    'gù lưng sau 4 tiếng ngồi máy tính',
    'vai cứng / cổ đau cuối ngày làm việc',
    'đứng lên thấy cột sống "khá khá"',
    'tư thế ngồi tự động sụp xuống không kiểm soát',
  ],

  'oral-bioactive': [
    'sáng dậy mở mắt mà thấy mệt như chưa ngủ',
    'cà phê thứ hai trong ngày không còn tỉnh táo',
    'mí mắt nặng 3-4 giờ chiều, đầu óc mơ hồ',
    'làm vài việc nhỏ đã thấy đuối',
    'mất ngủ lúc 2-3h sáng rồi không ngủ lại được',
  ],

  'topical-soothe': [
    'da chỗ đau ngứa râm ran cả ngày',
    'cọ phải áo là buốt',
    'bôi nóng tay nhưng chỉ đỡ vài phút',
    'mỗi tối phải xoa bóp thì mới ngủ được',
  ],

  'spray-relief': [
    'sáng dậy mũi nghẹt cứng — phải hỉ mạnh mới thở được',
    'thay đổi thời tiết là hắt hơi liên tục',
    'gặp mùi lạ là chảy nước mũi không kiểm soát',
    'ngủ thở bằng miệng vì mũi bị tắc',
    'phải mang khăn giấy đi đâu cũng vậy',
  ],

  'patch-delivery': [
    'tối đến đau lưng nằm không yên',
    'làm việc 2-3 tiếng là phải ngừng vì đau',
    'phải uống thuốc giảm đau mỗi 6 tiếng',
  ],

  'biochemical-repair': [
    'da xỉn dần — soi gương thấy "mình khác hồi xưa"',
    'khớp kêu khi ngồi xổm — biết là đến lúc rồi',
    'tóc rụng nhiều hơn trên gối / sàn nhà',
    'da khô / móng dễ gãy / nếp nhăn xuất hiện sớm',
    'cảm giác cơ thể "đang đi xuống dần"',
  ],

  'cosmetic-aesthetic': [
    'soi gương thấy da xỉn / lỗ chân lông to',
    'ánh đèn flash chiếu vào thấy nếp nhăn',
    'tóc khô xơ — sờ vào không mượt',
    'da xạm khi đi ngoài nắng 30 phút',
  ],
}
