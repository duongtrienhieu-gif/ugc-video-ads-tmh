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
    'Cơ chế: THIẾT BỊ VẬT LÝ ĐEO BÊN NGOÀI (đai/nẹp/brace) — hỗ trợ ổn định khớp bằng cấu trúc cơ học (lò xo, exoskeleton, dây căng).',
    'Cảm nhận: TỨC THÌ khi đeo vào — reader cảm thấy chắc chắn / nhẹ áp lực ngay lập tức.',
    'Tác dụng: giảm áp lực lên khớp khi đứng / đi / leo cầu thang. Ổn định patella / xương. KHÔNG sửa chữa sụn nội sinh. KHÔNG hấp thu hoạt chất. KHÔNG cần thời gian "ngấm".',
    'Story arc: scene-based — đeo vào → bước đi → cảm thấy khác. KHÔNG phải narrative "uống vài tuần rồi mới thấy".',
    '⚠️ TUYỆT ĐỐI tránh: "uống", "hấp thu", "từ bên trong", "nguyên nhân gốc rễ" — đây là thiết bị cơ học BÊN NGOÀI cơ thể.',
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
    'Cơ chế: viên uống chứa hoạt chất → hấp thu qua đường tiêu hóa.',
    'Cảm nhận: DẦN DẦN, sau 2-4 tuần uống đều đặn — KHÔNG tức thì.',
    'Tác dụng: cung cấp hoạt chất sinh học (vitamin / khoáng chất / hoạt chất chiết xuất).',
    'Story arc: narrative-based — "uống đều mỗi sáng, sau vài tuần thấy khác". Discovery thường qua dược sĩ / bài research / bạn bè đã uống.',
    '⚠️ Mechanism CHỈ áp dụng cho sản phẩm THỰC SỰ uống (viên / siro / drink). KHÔNG áp dụng cho bột tẩy trắng răng, kem bôi, dầu gội, xịt mũi, thuốc dán — những thứ này dùng cơ chế khác.',
  ].join(' '),

  'topical-soothe': [
    'Cơ chế: kem / dầu / gel BÔI NGOÀI DA → làm dịu / xoa dịu TẠI CHỖ. KHÔNG ăn vào.',
    'Cảm nhận: cảm giác mát/nóng/dịu TỨC THÌ khi bôi, kéo dài vài giờ.',
    'Tác dụng: giảm khó chịu TẠI VÙNG BÔI (đau cơ, ngứa, kích ứng) — KHÔNG tác động hệ thống.',
    'Story arc: scene-based — "bôi xong vài phút thấy dịu" — concrete sensation tại chỗ.',
    '⚠️ TUYỆT ĐỐI tránh: "từ bên trong", "thẩm thấu sâu", "tác động gốc rễ" — đây là sản phẩm BỀ MẶT tại chỗ.',
  ].join(' '),

  'spray-relief': [
    'Cơ chế: XỊT → hoạt chất tiếp xúc niêm mạc / da TẠI CHỖ (mũi / da / cơ). KHÔNG ăn vào.',
    'Cảm nhận: tác dụng trong vài phút (xịt mũi → thông mũi 5-15 phút).',
    'Tác dụng: giảm triệu chứng TỨC THÌ TẠI VÙNG XỊT.',
    '⚠️ TUYỆT ĐỐI tránh: "tác động hệ thống", "từ bên trong cơ thể" — xịt là cơ chế TẠI CHỖ.',
  ].join(' '),

  'patch-delivery': [
    'Cơ chế: MIẾNG DÁN phóng thích hoạt chất QUA DA liên tục trong 4-8 giờ. KHÔNG ăn vào.',
    'Cảm nhận: cảm giác mát/nóng dần lan tại vùng dán, kéo dài liên tục.',
    'Tác dụng: giảm đau / hỗ trợ TẠI CHỖ trong khoảng thời gian dán.',
    '⚠️ TUYỆT ĐỐI tránh: "uống vào", "ăn vào" — đây là dán lên da, không phải uống.',
  ].join(' '),

  'biochemical-repair': [
    'Cơ chế: viên uống bổ sung NGUYÊN LIỆU sinh học (collagen / glucosamine / chondroitin / omega) để cơ thể tự xây dựng/sửa chữa mô.',
    'Cảm nhận: CUMULATIVE — cần 4-12 tuần uống đều đặn. KHÔNG nhanh.',
    'Tác dụng: cung cấp nguyên liệu cho quá trình tự tái tạo của cơ thể (sụn / collagen da / kết cấu khớp).',
    'Story arc: long narrative — "uống vài tháng, dần dần cảm thấy khớp linh hoạt hơn / da đỡ nhăn hơn". Discovery thường qua bác sĩ / dược sĩ / research.',
    '⚠️ Mechanism CHỈ áp dụng cho viên uống SINH HỌC thực sự (collagen / glucosamine / NMN / omega). KHÔNG áp dụng cho bột tẩy trắng răng, kem bôi, dầu gội, miếng dán — những thứ này dùng cơ chế khác (topical-soothe / cosmetic-aesthetic / patch-delivery).',
    '⚠️ TUYỆT ĐỐI tránh AI fingerprint: "từ bên trong" / "nguyên nhân gốc rễ" / "tác động từ trong ra ngoài" / "căn nguyên vấn đề". Mô tả cụ thể CƠ CHẾ thực tế (e.g., "cung cấp glucosamine cho khớp", "collagen peptide cho da") — KHÔNG dùng metaphor vague.',
  ].join(' '),

  'cosmetic-aesthetic': [
    'Cơ chế: sản phẩm thẩm mỹ DÙNG TẠI CHỖ — tác động lên BỀ MẶT da/tóc/răng/móng. KHÔNG ăn vào, KHÔNG hấp thu hệ thống.',
    'Cảm nhận: cảm giác mượt/sáng/sạch tức thì hoặc sau vài lần dùng đều đặn.',
    'Tác dụng: cải thiện thẩm mỹ bề mặt (làm trắng / làm sạch / dưỡng / che khuyết điểm).',
    'Story arc: scene-based — "đánh răng buổi sáng" / "thoa lên mặt" / "gội đầu" — reader thấy effect sau vài lần dùng.',
    '⚠️ Bao gồm: kem dưỡng da, dầu gội, kem đánh răng, bột tẩy trắng răng, nước súc miệng, sữa rửa mặt, serum, mặt nạ, kem chống nắng.',
    '⚠️ TUYỆT ĐỐI tránh: "từ bên trong cơ thể", "hấp thu hoạt chất", "tác động hệ thống", "nguyên nhân gốc rễ" — đây là sản phẩm BỀ MẶT, không phải ăn/uống/hấp thu.',
  ].join(' '),
}
