# CHAT BOT — Kế hoạch từng Phase

> App tên **CHAT BOT** (id/folder `chat-bot`). Module standalone trong UGC Lab.
> Provider: Gemini (key free dùng chung → tiết kiệm call, xem SPEC.md mục 2).
> Mỗi phase: Mục tiêu · Mình làm gì · Kết quả bạn thấy · Cách dùng & nghiệm thu.

---

## P0 — Khung app + Lưu trữ + Đăng ký (nền móng)

**Mục tiêu:** Có app "CHAT BOT" hiện trong sidebar, mở ra chạy được (khung trống), có chỗ lưu dữ liệu.

**Mình làm gì:**
- Tạo folder `src/apps/chat-bot/` + `types.ts` (SalesConfig, ActionPacket, Stage…).
- `store.ts` (zustand): `loadAll / getByProductId / upsert / remove`, scoped `user_id`, localStorage fallback.
- Bảng Supabase `sales_brain_configs` (SQL mình đưa bạn chạy trên Supabase).
- Đăng ký 3 chỗ: `App.tsx` (APP_COMPONENTS + APP_BOUNDARY_META), `Sidebar.tsx` (NavItem "CHAT BOT").
- `ChatBot.tsx` khung 2 tab: **Cấu hình** | **Mô phỏng** (trống).

**Kết quả bạn thấy:** Sidebar có mục **CHAT BOT**. Bấm vào mở ra 2 tab trống, không lỗi.

**Cách dùng & nghiệm thu:** `npm run build` xanh; mở app thấy CHAT BOT trong sidebar, click vào không vỡ.

---

## P1 — Màn Cấu hình (nhập "kho đạn" cho bot)

**Mục tiêu:** Bạn setup được 1 sản phẩm cho bot bán, lưu lại.

**Mình làm gì:**
- `ProductPicker`: chọn sản phẩm từ product bank → preview fact (read-only).
- `ConfigPanel`: form nhập **riêng cho chat** — `market` (VN/MY), `chatPrice`, `chatPromo`,
  `discountFloor` (trần giảm), `playbookNote`, `objectionBank`.
- `MediaMapEditor`: gắn ảnh/video (từ `productImages` của bank hoặc dán URL) theo bậc hội thoại.
- Lưu/đọc qua store P0.

**Kết quả bạn thấy:** Form đầy đủ; chọn SP → tự hiện fact; nhập giá chat + trần giảm + gắn ảnh → bấm Lưu → tải lại vẫn còn.

**Cách dùng & nghiệm thu:** Tạo config cho "Knee Support Booster" (market=MY, giá RM, trần giảm), lưu, F5, dữ liệu còn nguyên. Giá Ladipage trong bank KHÔNG bị đụng.

---

## P2 — Engine bộ não (1 call Gemini → gói hành động)

**Mục tiêu:** Đưa 1 tin khách vào → bot trả về "gói hành động" đúng bậc, song ngữ, đúng giá đã set.

**Mình làm gì:**
- `playbook.ts`: text playbook bậc thang (sửa-in-place, không chồng layer).
- `compilePrompt.ts`: ghép playbook + Sales Config + few-shot **gọn** (history cắt 8 lượt).
- `salesBrainEngine.ts`: **1 call Gemini** qua kie.ai → parse `ActionPacket`
  (`messages` MY+VN gloss, `awaitCustomer`, `nextStage`, `intent`, `captured`, `handover`).
  Lỗi JSON → `repairJson` (0 call), re-call tối đa 1 lần.

**Kết quả bạn thấy:** (chạy nội bộ, chưa có UI đẹp) — gọi engine với "harga?" → nhận JSON: lời chào + giá + câu hỏi nối, `awaitCustomer:true`, đúng giá chat, không vượt trần.

**Cách dùng & nghiệm thu:** Mình chạy vài input mẫu, dán JSON kết quả cho bạn soi: đúng bậc? đúng giá? có kết bằng câu hỏi? có bịa không? Tinh chỉnh playbook tới khi ưng.

---

## P3 — Simulator (trái tim QC)

**Mục tiêu:** Bạn chat thử với bot như khách thật, ngay trong app, thấy song ngữ + ảnh/video.

**Mình làm gì:**
- `Simulator`: khung chat, gõ như khách → bot diễn bậc 0→6 (mỗi lượt = 1 call, chỉ khi bấm Gửi).
- `ChatBubble`: render **contentTarget + contentVi** (market=MY); market=VN 1 dòng; hiện ảnh/video từ mediaMap.
- `DebugSidebar`: stage, intent, captured, handover, **số call Gemini đã dùng**.

**Kết quả bạn thấy:** Cửa sổ chat thật. Gõ "iphone berapa ah" → bot rep Manglish + dòng VN bên dưới, gửi ảnh, hỏi nối, chờ bạn. Sidebar đếm "đã dùng 1 call".

**Cách dùng & nghiệm thu:** Đóng vai khách chạy 4–5 đoạn, xem bot có "đời", đúng giá, đúng nhịp chờ. Đây là lúc bạn kiểm soát chất lượng trước khi nghĩ tới nối kênh.

---

## P4 — Ca khó + Hội thoại mẫu vàng (nâng chất)

**Mục tiêu:** Stress-test bot trước ca khó + dạy bot giọng riêng của bạn.

**Mình làm gì:**
- `hardScenarios.ts`: nút preset trong simulator — hỏi dồn / chê mắc / đòi giảm sâu / im lặng / trộn lóng.
- `goldenExamples`: ô dán 1–2 đoạn chat lý tưởng (VN) → AI bắt chước tone/cách chốt.

**Kết quả bạn thấy:** Bấm "Chê mắc" → bot tự nhận tin khó, xử lý không phá trần. Dán mẫu vàng → giọng bot đổi theo đúng chất bạn muốn.

**Cách dùng & nghiệm thu:** Chạy hết các nút ca khó, không ca nào làm bot bịa/phá giá/đơ. Hài lòng → CHAT BOT MVP coi như xong, sẵn sàng bàn bước nối kênh (phase sau, ngoài MVP).

---

## Quy ước chung
- Sau mỗi phase: `npm run build`/`tsc -b` xanh rồi commit + push (auto-deploy Vercel).
- STOP & hỏi nếu phát sinh ngoài spec. Playbook sửa-in-place. Không nối respond.io/Pancake trong MVP.
