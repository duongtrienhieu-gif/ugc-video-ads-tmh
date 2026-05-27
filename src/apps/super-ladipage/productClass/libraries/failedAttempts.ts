// ─────────────────────────────────────────────────────────────────────
// Product Class — failed attempts library
//
// What did the reader REALISTICALLY try before this product?
// Per MechanismFamily — these are the "đã thử đủ cách" list reader
// recognizes as their own past failed attempts.
//
// Bug v1: knee brace pack mentioned "bôi kem nọ" — readers of knee
// braces don't try creams, they try pills/heat/braces/physiotherapy.
// ─────────────────────────────────────────────────────────────────────

import type { MechanismFamily } from '../types'

export const FAILED_ATTEMPTS: Record<MechanismFamily, string[]> = {
  'physical-stabilization': [
    'thuốc giảm đau (uống mỗi khi đau, không phải giải pháp dài hạn)',
    'dầu nóng xoa bóp (đỡ vài giờ, mai lại như cũ)',
    'đai khác đã mua trên Shopee — chật / lỏng / không đúng cấu trúc',
    'vật lý trị liệu (hiệu quả nhưng mất thời gian + tiền)',
    'glucosamine / collagen uống — uống vài tháng rồi ngưng',
    'chườm nóng / chườm đá',
  ],

  'wearable-support': [
    'vớ y khoa thường (lỏng / không vừa)',
    'thuốc giảm sưng tạm thời',
    'massage cuối ngày',
  ],

  'mechanical-aid': [
    'đệm lưng / gối tựa thường',
    'tập yoga / stretching đứt đoạn',
    'tự dặn mình ngồi thẳng nhưng quên ngay',
  ],

  'oral-bioactive': [
    'vitamin tổng hợp ở siêu thị (uống vài tuần rồi ngưng)',
    'cà phê mạnh hơn (tăng liều dần)',
    'thực phẩm chức năng khác đã thử',
    'thay đổi chế độ ăn nhưng không kiên trì',
  ],

  'topical-soothe': [
    'thuốc bôi không kê toa khác (đỡ vài giờ)',
    'dầu nóng truyền thống',
    'thuốc uống giảm triệu chứng',
    'gel làm dịu mua online (không hiệu quả)',
  ],

  'spray-relief': [
    'thuốc uống chống dị ứng (gây buồn ngủ)',
    'xông mũi bằng tinh dầu',
    'rửa mũi nước muối (mất công, không tiện)',
    'thuốc xịt khác (gây khô / khó chịu)',
  ],

  'patch-delivery': [
    'thuốc giảm đau uống (gây hại dạ dày)',
    'dầu nóng bôi (mùi mạnh, không tiện)',
    'massage / vật lý trị liệu',
  ],

  'biochemical-repair': [
    'collagen uống thương hiệu khác (không thấy hiệu quả)',
    'vitamin tổng hợp',
    'kem bôi ngoài da (chỉ tác động bề mặt)',
    'thay đổi ăn uống không đều đặn',
    'tiêm filler / treatment ở spa (đắt, tạm thời)',
  ],

  'cosmetic-aesthetic': [
    'mỹ phẩm khác đã thử (kem / serum / dầu gội)',
    'facial spa định kỳ (tốn kém, không bền)',
    'masks dùng vài lần rồi quên',
    'thay đổi sữa rửa mặt liên tục',
  ],
}
