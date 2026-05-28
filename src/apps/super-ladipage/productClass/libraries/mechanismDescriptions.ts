// ─────────────────────────────────────────────────────────────────────
// Product Class — mechanism descriptions library
//
// POSITIVE injection text per MechanismFamily. Describes the ACTUAL
// product mechanism so Gemini doesn't drift into wrong-class semantic.
//
// LOCKED: positive descriptions only — what the product DOES.
// NO "do not say X" rules. Gemini follows accurate description naturally.
// ─────────────────────────────────────────────────────────────────────

import type { MechanismFamily } from '../types'

export const MECHANISM_DESCRIPTIONS: Record<MechanismFamily, string> = {
  'physical-stabilization': [
    'Cơ chế: thiết bị vật lý đeo bên ngoài (đai/nẹp/brace) — hỗ trợ ổn định khớp bằng cấu trúc cơ học (lò xo, exoskeleton, dây căng).',
    'Cảm nhận: TỨC THÌ khi đeo vào — reader cảm thấy chắc chắn / nhẹ áp lực ngay lập tức.',
    'Tác dụng: giảm áp lực lên khớp khi đứng / đi / leo cầu thang. Ổn định patella / xương. KHÔNG sửa chữa sụn từ bên trong. KHÔNG hấp thu hoạt chất. KHÔNG cần thời gian "ngấm".',
    'Story arc: scene-based — đeo vào → bước đi → cảm thấy khác. KHÔNG phải narrative "uống vài tuần rồi mới thấy".',
  ].join(' '),

  'wearable-support': [
    'Cơ chế: băng / vớ y khoa / sleeve — tạo áp lực nhẹ đều quanh vùng cần hỗ trợ.',
    'Cảm nhận: tức thì khi đeo, áp lực nhẹ giúp tuần hoàn + giảm sưng.',
    'Tác dụng: chống mỏi khi đứng/đi lâu, hỗ trợ phục hồi. KHÔNG phải uống vào, KHÔNG biochemical.',
  ].join(' '),

  'mechanical-aid': [
    'Cơ chế: dụng cụ cơ học (ghế chỉnh dáng / posture corrector / massager) — tác động cơ học bên ngoài.',
    'Cảm nhận: cảm nhận tư thế / áp lực thay đổi ngay khi sử dụng.',
    'Tác dụng: chỉnh tư thế dài hạn qua việc dùng đều đặn.',
  ].join(' '),

  'oral-bioactive': [
    'Cơ chế: viên uống chứa hoạt chất → hấp thu qua đường tiêu hóa → tác động hệ thống.',
    'Cảm nhận: DẦN DẦN, sau 2-4 tuần uống đều đặn — KHÔNG tức thì.',
    'Tác dụng: cung cấp hoạt chất sinh học cho cơ thể (vitamin / khoáng chất / hoạt chất chiết xuất).',
    'Story arc: narrative-based — "uống đều mỗi sáng, sau vài tuần thấy khác". Discovery thường qua dược sĩ / bài research / bạn bè đã uống.',
  ].join(' '),

  'topical-soothe': [
    'Cơ chế: kem / dầu / gel bôi ngoài da → làm dịu / xoa dịu tại chỗ.',
    'Cảm nhận: cảm giác mát/nóng/dịu tức thì khi bôi, kéo dài vài giờ.',
    'Tác dụng: giảm khó chịu tại vùng bôi (đau cơ, ngứa, kích ứng).',
  ].join(' '),

  'spray-relief': [
    'Cơ chế: xịt → hấp thu nhanh tại chỗ (mũi / da / cơ).',
    'Cảm nhận: tác dụng trong vài phút (xịt mũi → thông mũi 5-15 phút).',
    'Tác dụng: giảm triệu chứng tức thì tại vùng xịt.',
  ].join(' '),

  'patch-delivery': [
    'Cơ chế: miếng dán phóng thích hoạt chất qua da liên tục trong 4-8 giờ.',
    'Cảm nhận: cảm giác mát/nóng dần lan tại vùng dán, kéo dài liên tục.',
    'Tác dụng: giảm đau / hỗ trợ tại chỗ trong khoảng thời gian dán.',
  ].join(' '),

  'biochemical-repair': [
    'Cơ chế: viên uống bổ sung NGUYÊN LIỆU sinh học (collagen / glucosamine / chondroitin / omega) để cơ thể tự xây dựng/sửa chữa mô.',
    'Cảm nhận: CUMULATIVE — cần 4-12 tuần uống đều đặn. KHÔNG nhanh.',
    'Tác dụng: cung cấp nguyên liệu cho quá trình tự sửa chữa nội sinh.',
    'Story arc: long narrative — "uống vài tháng, dần dần thấy khác từ bên trong". Discovery thường qua bác sĩ / dược sĩ / research.',
  ].join(' '),

  'cosmetic-aesthetic': [
    'Cơ chế: mỹ phẩm bề mặt — tác động lên da/tóc/móng để cải thiện thẩm mỹ.',
    'Cảm nhận: cảm giác mềm/mượt/sáng tức thì hoặc sau vài lần dùng.',
    'Tác dụng: cải thiện thẩm mỹ bề mặt (KHÔNG y khoa, KHÔNG y tế).',
  ].join(' '),
}
