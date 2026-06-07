# UGC Lab — Kalodata Sync (Chrome Extension)

Bắt dữ liệu Kalodata khi bạn browse và đẩy thẳng về UGC Lab (Supabase) → module Research hiện data thật.

## Cách hoạt động
1. Cài extension (load unpacked — bên dưới).
2. Bấm icon extension → **đăng nhập bằng tài khoản UGC Lab** (email/mật khẩu).
3. Vào **kalodata.com** browse như bình thường (mục **Sản phẩm** / Khám phá).
4. Extension tự bắt response `/product/queryList` → đẩy lên Supabase (`research_products`).
5. Mở app UGC Lab → tab **Research** → thấy data thật (badge "✓ Data thật").

> Chỉ chạy khi bạn đang mở Kalodata. Đổi thị trường (MY/TH/ID/VN) trên Kalodata → đẩy data thị trường đó.

## Cài đặt (load unpacked) — làm 1 lần
1. Mở Chrome → gõ `chrome://extensions` vào thanh địa chỉ → Enter.
2. Bật **Developer mode** (góc trên phải).
3. Bấm **Load unpacked** → chọn thư mục `extension/` này.
4. Extension xuất hiện. Ghim nó (icon 🧩 → ghim "UGC Lab — Kalodata Sync").

## Yêu cầu trước
- Bảng Supabase đã tạo (chạy `migrations/research.sql`).
- Có tài khoản UGC Lab (email/mật khẩu) — dùng để đăng nhập trong popup extension.

## Trạng thái / lỗi
Bấm icon extension để xem: lần đồng bộ cuối, thị trường, số sản phẩm đã đẩy, tổng cộng, và lỗi (nếu có).

## Lưu ý
- Anon key trong `config.js` là public (đúng key app đang dùng) — an toàn, bảo mật bằng RLS.
- Nội bộ — không đăng lên Chrome Web Store.
