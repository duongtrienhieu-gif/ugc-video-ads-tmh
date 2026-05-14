# CLAUDE.md -- UGC Lab (Bản Tiếng Việt)

## Mô Tả Dự Án

Dịch toàn bộ giao diện của UGC Lab sang tiếng Việt. Đây là app macOS-style tích hợp 6 công cụ AI tạo quảng cáo UGC, dùng Google Gemini API. Không thay đổi tính năng, kiến trúc, hay thiết kế — chỉ thay thế text tiếng Anh bằng tiếng Việt.

## Vai Trò

Làm việc như một kỹ sư frontend senior. Dịch chính xác, tự nhiên, không dịch máy. Giữ nguyên mọi logic, style, và cấu trúc file.

## Quy Tắc Cốt Lõi

### Quy Tắc Dịch Thuật
- Dịch TẤT CẢ text hiển thị cho người dùng: nhãn, nút, placeholder, tiêu đề, thông báo lỗi, tooltip, trạng thái rỗng, loading text.
- KHÔNG dịch: tên biến, tên hàm, tên file, comment code, key trong object/JSON, tên model AI, tên API.
- KHÔNG dịch: các thuật ngữ kỹ thuật giữ nguyên tiếng Anh khi không có từ Việt tự nhiên (ví dụ: "B-Roll", "hook", "UGC", "TTS").
- Dùng bảng thuật ngữ trong SPEC.md — nhất quán xuyên suốt toàn app.
- Văn phong: thân thiện, chuyên nghiệp. Dùng "bạn" (không dùng "quý khách").

### Quy Tắc Code
- Không thay đổi bất kỳ class Tailwind nào.
- Không thay đổi logic, store, hook, hoặc utility functions.
- Không refactor hay tái cấu trúc — chỉ thay text.
- Giữ nguyên tất cả TypeScript types, interfaces, và schemas.
- Không thêm file mới, không xóa file cũ.

### Quy Tắc Kiến Trúc
- Không thay đổi cách state flow: component → store action → service.
- Không thay đổi cách assets được lưu vào IndexedDB.
- Không thay đổi cách Gemini API được gọi.

## Tài Liệu Dự Án
- SPEC.md — Bảng thuật ngữ và nhãn tiếng Việt cho từng app. Đọc phần liên quan trước khi dịch từng app.
- CLAUDE.md (file này) — Quy tắc làm việc.

## Known Issues và Quy Tắc Học Được
[Để trống. Thêm vào đây khi phát hiện pattern lặp lại hoặc bug.]
