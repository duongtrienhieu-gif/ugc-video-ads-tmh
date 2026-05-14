# UGC Lab (Bản Tiếng Việt) -- Đặc Tả Sản Phẩm

## 1. Tổng Quan

UGC Lab là một ứng dụng web phong cách macOS tích hợp 6 công cụ AI để tạo quảng cáo UGC (User-Generated Content). Bản tiếng Việt này giữ nguyên toàn bộ tính năng, kiến trúc, và thiết kế của bản gốc — chỉ dịch toàn bộ giao diện người dùng sang tiếng Việt, bao gồm nhãn, nút, placeholder, thông báo lỗi, tiêu đề, và nội dung tĩnh.

Mục tiêu: Người dùng Việt Nam có thể sử dụng app một cách tự nhiên mà không cần đọc tiếng Anh.

## 2. Tech Stack

| Thành phần | Công nghệ |
|-----------|-----------|
| Framework | React 19.2 + TypeScript 5.9 |
| Styling | Tailwind CSS 4.1 (dark mode) |
| State | Zustand 5.0 (global) + React useState (local) |
| Build | Vite 7.3 |
| Icons | Lucide React |
| Font | DM Sans |
| AI API | Google Gemini (text, image, video, TTS) |
| Storage | localStorage (banks, settings) + IndexedDB (assets) |

## 3. Shell Ứng Dụng / Điều Hướng

Giao diện mô phỏng macOS. Luôn hiển thị:
- **Menu Bar** (trên cùng): Đồng hồ, tên app đang mở, nút Cài đặt
- **Desktop** (giữa): 5 thư mục ngân hàng dữ liệu với badge đếm số lượng
- **Dock** (dưới cùng): 7 icon ứng dụng

### Thuật Ngữ Tiếng Việt (dùng nhất quán)

| Tiếng Anh | Tiếng Việt |
|-----------|------------|
| Bank | Ngân hàng |
| Products Bank | Ngân hàng Sản phẩm |
| Models Bank | Ngân hàng Nhân vật |
| Scripts Bank | Ngân hàng Kịch bản |
| Voices Bank | Ngân hàng Giọng đọc |
| B-Rolls Bank | Ngân hàng B-Roll |
| Settings | Cài đặt |
| Save | Lưu |
| Cancel | Hủy |
| Delete | Xóa |
| Edit | Chỉnh sửa |
| Generate | Tạo |
| Copy | Sao chép |
| Send to | Gửi tới |
| Loading | Đang tải |
| Error | Lỗi |
| Success | Thành công |
| Close | Đóng |
| Add | Thêm |
| New | Mới |
| Preview | Xem trước |
| Download | Tải xuống |
| Upload | Tải lên |
| Select | Chọn |
| Search | Tìm kiếm |
| Name | Tên |
| Description | Mô tả |
| Tags | Thẻ |
| Notes | Ghi chú |

## 4. Hệ Thống Chia Sẻ Dữ Liệu (Shared Banks)

5 ngân hàng dữ liệu dùng chung giữa các app:

| Ngân hàng | Dữ liệu lưu trữ |
|-----------|----------------|
| Sản phẩm | Tên, mô tả, lợi ích, URL ảnh |
| Nhân vật | Hồ sơ nhân vật UGC (JSON + ảnh) |
| Kịch bản | Script quảng cáo đã tạo |
| Giọng đọc | File audio TTS đã tạo |
| B-Roll | Ảnh/video B-roll đã tạo |

Dữ liệu lưu trong localStorage. Ảnh/audio/video lưu trong IndexedDB.

## 5. Ứng Dụng Finder (Trình Duyệt Ngân Hàng)

**Mục đích:** Xem, thêm, sửa, xóa tất cả mục trong các ngân hàng.

**Bố cục:** Sidebar trái (chọn ngân hàng) + vùng nội dung phải (danh sách + form)

**Nhãn tiếng Việt:**
- Tiêu đề sidebar: "Ngân hàng dữ liệu"
- Nút thêm mới: "Thêm [tên ngân hàng]"
- Trạng thái rỗng: "Chưa có [tên mục] nào. Nhấn nút bên trên để thêm mới."
- Xác nhận xóa: "Bạn có chắc muốn xóa mục này không?"

## 6. UGC Character Studio (Studio Nhân Vật)

**Mục đích:** Tạo nhân vật UGC bằng AI từ hồ sơ 5 tab.

**Nhãn tiếng Việt:**
- Tên app: "Studio Nhân Vật UGC"
- Tab 1: "Ngoại hình" (Physical)
- Tab 2: "Phong cách" (Style)
- Tab 3: "Bối cảnh" (Scene)
- Tab 4: "Tư thế" (Pose)
- Tab 5: "Máy quay" (Camera)
- Nút tạo ảnh: "Tạo nhân vật"
- Nút lưu: "Lưu vào ngân hàng nhân vật"

## 7. Image DNA Extractor (Trích Xuất DNA Ảnh)

**Mục đích:** Tải ảnh lên → AI phân tích thành JSON hồ sơ nhân vật.

**Nhãn tiếng Việt:**
- Tên app: "Trích Xuất DNA Ảnh"
- Nút tải ảnh: "Tải ảnh lên"
- Placeholder kéo thả: "Kéo thả ảnh vào đây hoặc nhấn để chọn"
- Nút phân tích: "Phân tích ảnh"
- Kết quả: "Hồ sơ nhân vật"
- Nút lưu: "Lưu vào ngân hàng nhân vật"

## 8. Ad Anatomy Pro (Phân Tích Quảng Cáo)

**Mục đích:** Phân tích khung video quảng cáo thành cấu trúc (hook, offer, CTA...).

**Nhãn tiếng Việt:**
- Tên app: "Phân Tích Quảng Cáo Pro"
- Nút tải video: "Tải video lên"
- Nút phân tích: "Phân tích quảng cáo"
- Kết quả sections: "Hook", "Đề nghị", "Kêu gọi hành động", "Chuyển cảnh", "Âm nhạc"
- Nút gửi: "Gửi tới Script Architect"

## 9. Script Architect Pro (Kiến Trúc Kịch Bản)

**Mục đích:** Tạo kịch bản quảng cáo từ transcript thắng + thông tin sản phẩm.

**Nhãn tiếng Việt:**
- Tên app: "Kiến Trúc Kịch Bản Pro"
- Field transcript: "Transcript quảng cáo mẫu"
- Field sản phẩm: "Thông tin sản phẩm"
- Nút tạo: "Tạo kịch bản"
- Nút lưu: "Lưu vào ngân hàng kịch bản"

## 10. Voice Studio Pro (Studio Giọng Đọc)

**Mục đích:** Tạo file audio từ kịch bản bằng TTS.

**Nhãn tiếng Việt:**
- Tên app: "Studio Giọng Đọc Pro"
- Chọn giọng: "Chọn giọng đọc"
- Field kịch bản: "Nhập kịch bản"
- Nút tạo: "Tạo giọng đọc"
- Lịch sử: "Lịch sử giọng đọc"
- Nút lưu: "Lưu vào ngân hàng giọng đọc"
- Nút tải xuống: "Tải xuống audio"

## 11. B-Roll Studio Pro (Studio B-Roll)

**Mục đích:** Tạo ảnh và video B-roll từ prompt AI.

**Nhãn tiếng Việt:**
- Tên app: "Studio B-Roll Pro"
- Nút tạo ảnh: "Tạo ảnh"
- Nút tạo video: "Tạo video"
- Prompt ảnh: "Mô tả cảnh quay"
- Nút lưu: "Lưu vào ngân hàng B-Roll"
- Trạng thái video: "Đang tạo video... (có thể mất vài phút)"

## 12. Kiến Trúc

```
src/
├── App.tsx                     # Shell macOS
├── components/
│   ├── MenuBar.tsx             # Menu bar trên
│   ├── Desktop.tsx             # Desktop với folder icons
│   ├── Dock.tsx                # Dock dưới
│   ├── BankPicker.tsx          # Chọn mục từ ngân hàng
│   ├── BankItemCard.tsx        # Card hiển thị mục ngân hàng
│   ├── SettingsModal.tsx       # Modal cài đặt API key
│   └── Toast.tsx               # Thông báo
├── apps/
│   ├── finder/
│   ├── character-studio/
│   ├── image-dna/
│   ├── ad-anatomy/
│   ├── script-architect/
│   ├── voice-studio/
│   └── broll-studio/
├── stores/
│   ├── bankStore.ts
│   ├── appStore.ts
│   └── settingsStore.ts
└── utils/
    ├── gemini.ts
    ├── assetStore.ts
    └── constants.ts
```

## 13. Hệ Thống Thiết Kế

Giữ nguyên 100% thiết kế bản gốc:
- Dark mode (nền #050505–#0A0A0A)
- Font: DM Sans
- Màu text: thang zinc
- Hiệu ứng: backdrop-blur, transition 200–300ms ease-out
- Không thay đổi bất kỳ class Tailwind, màu sắc, hay layout nào
