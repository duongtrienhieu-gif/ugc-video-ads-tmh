# 🧭 RESEARCH MODULE — ROADMAP TỔNG QUAN
*UGC Lab · Module "Research" — AI research assistant cho seller TikTok Shop*
*Cập nhật: 2026-06-08 · Trạng thái: đã recon + chốt spec, sẵn sàng build P1*

---

## 1. MỤC ĐÍCH — Tại sao làm cái này?

**Vấn đề:** Anh (sếp newbie) + 6 nhân sự chưa rành phân tích data. Kalodata cho cả kho số liệu rồi bắt tự hiểu → tê liệt, mất thời gian, dễ chọn sai sản phẩm → lỗ.

**Lời giải:** Một module trong UGC Lab **biến data Kalodata thành "việc nên làm hôm nay"** — tự chấm điểm, đưa verdict, phát hiện cơ hội, tính sẵn giá/CPA. Người dùng chỉ **gật/lắc**, không phải phân tích.

**Câu thần chú:**
> Kalodata trả lời: *"Đây là TẤT CẢ data."*
> App mình trả lời: *"Đây là VIỆC NÊN LÀM hôm nay."*

**USP độc nhất:** Cross-market arbitrage — phát hiện sản phẩm đang nổ ở Thái/Indo/Việt mà Malaysia chưa nóng → vào sớm trước đối thủ. Không tool nào (kể cả Kalodata gốc) tự làm.

---

## 2. KẾT QUẢ CUỐI CÙNG — Khi xong, một ngày làm việc trông thế nào?

**Anh (owner), buổi sáng ~10 phút:**
1. Browse Kalodata 4 thị trường như mọi ngày (15') → data tự chảy vào app.
2. Mở Owner Dashboard → thấy 6 nhân sự đang đề xuất test sản phẩm gì → duyệt/từ chối.
3. Liếc cảnh báo hệ thống: *"Ngách khử mùi xe đang nổ ở MY, chưa ai trong team làm."*

**1 nhân sự, buổi sáng ~10 phút:**
1. Mở UGC Lab → tab Research → *"Hôm nay ngách của em có 4 cơ hội."*
2. Lướt 4 thẻ — mỗi thẻ có verdict 🟢🟡🔴 + lý do tiếng Việt.
3. Bấm thẻ xanh → Go/No-Go scorecard + giá bán & CPA tối đa đã tính sẵn.
4. Hỏi AI: *"Sao cái này nên test?"* → AI giảng như đàn anh.
5. Quyết Test/Bỏ/Để dành → chờ sếp duyệt. **Không lọc, không đọc số, không phân tích.**

---

## 3. BẢN ĐỒ DÒNG CHẢY — "Cỗ máy" gồm 4 phần

```
┌─────────────────────────────────────────────────────────────────────┐
│  1) THU THẬP             2) KHO DATA          3) BỘ NÃO              │
│  Chrome Extension   →    Supabase        →    Chấm điểm 8 tín hiệu   │
│  (anh browse             (products,           + verdict 🟢🟡🔴       │
│   Kalodata 4 market)      snapshots,          + Cross-market         │
│   tự bắt JSON             creators,            Transfer score        │
│   đẩy về kho)             videos, shops)       + lọc ngách SKU       │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4) GIAO DIỆN (trong UGC Lab — tab "Research")                      │
│  Thẻ cơ hội 🟢🟡🔴 · Máy tính giá/CPA · Chi tiết SP ·               │
│  Watchlist · Owner Dashboard · 🤖 Trợ lý AI                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Điểm mấu chốt đã kiểm chứng thật (recon 2026-06):** Kalodata trả JSON sạch, extension monkey-patch bắt được trọn; cross-market chỉ là đổi 1 tham số `country`. Đường ống KHẢ THI 100%, không còn là giả thuyết.

---

## 4. CON ĐƯỜNG 5 CHẶNG — Mỗi chặng làm gì & ANH ĐƯỢC GÌ THẬT

> **Nguyên tắc: PILOT TRƯỚC.** Build đường ống cốt lõi cho riêng anh chạy được trước, rồi mới thêm nhân sự + AI. Sai thì sửa rẻ, không nát app. (Đúng triết lý anh đang áp cho shop.)

### 🟦 P1 — Đường ống + Dashboard (chỉ owner) — *nền tảng, ~4-6 ngày*
- **Xây:** Chrome Extension capture Kalodata 4 market → đẩy Supabase; bảng DB; module Research với **thẻ sản phẩm đã chấm điểm** (8 tín hiệu + verdict + ẩn sẵn ngách nhiều SKU) + **máy tính giá/CPA** (tỷ giá fix 5500).
- **✅ KẾT QUẢ THỰC TẾ:** Anh browse Kalodata 15' → mở UGC Lab thấy 20-50 sản phẩm 4 thị trường **đã chấm điểm + verdict**, bấm 1 cái ra **giá bán + CPA tối đa** ngay. → Tự chọn hàng nhanh & chuẩn hơn Kalodata. **Đây là trái tim — chạy được là 70% giá trị.**

### 🟩 P2 — Cross-market + Creator + Chi tiết — *USP + chiều sâu, ~3-4 ngày*
- **Xây:** Matching cross-market + Transfer score; tab chi tiết sản phẩm (chart 90 ngày, ai đang bán, video thắng, shop đối thủ, creator đang đẩy); watchlist "SP của tôi".
- **✅ KẾT QUẢ THỰC TẾ:** App tự chỉ *"SP X nổ ở Thái +280%, MY mới 3 shop — vào sớm"*. Xem sâu 1 sản phẩm trong 1 màn. → **Thấy cơ hội trước đối thủ MY.**

### 🟨 P3 — Multi-tenant (anh + 6 nhân sự) — *cả team lên hệ thống, ~2-3 ngày*
- **Xây:** workspace + mời nhân sự qua email + phân ngách + watchlist riêng + Owner Dashboard duyệt đề xuất.
- **✅ KẾT QUẢ THỰC TẾ:** 6 đứa mỗi đứa login thấy ngách của mình, tự research + đề xuất; anh có 1 màn duyệt tất cả. → **Quản team bằng số, không bằng cảm tính.**

### 🟧 P4 — Trợ lý AI — *newbie không cần biết đọc số, ~2-3 ngày*
- **Xây:** Claude chat tool-calling trên data thật (key Anthropic của anh ở Settings).
- **✅ KẾT QUẢ THỰC TẾ:** Hỏi tiếng Việt *"ngách khử mùi xe MY tháng này sao, nên làm ko?"* → AI trả lời từ data thật + gợi ý sản phẩm + giải thích verdict. → **Cả team quyết như có đàn anh ngồi cạnh.**

### 🟥 P5 — Business Plan + Polish — *từ chọn hàng → kế hoạch chạy thật, ~3-4 ngày*
- **Xây:** AI tạo plan thực chiến (nhập hàng theo lô, reorder, creator, KPI, lịch rủi ro); nút auto-crawl; cảnh báo breakout.
- **✅ KẾT QUẢ THỰC TẾ:** Chọn 1 sản phẩm → ra luôn kế hoạch nhập-bán-scale. App tự cảnh báo khi sản phẩm theo dõi breakout. → **Đủ bộ: nghiên cứu → quyết định → kế hoạch.**

**Tổng ước lượng:** ~14-20 ngày build tập trung. Build từng chặng, **xong mỗi chặng dừng cho anh duyệt** rồi mới qua chặng sau.

---

## 5. BẢNG "ĐƯỢC GÌ MỚI" theo từng mốc

| Sau chặng | Anh / team làm được điều mới |
|---|---|
| P1 | Data Kalodata vào app, tự chấm điểm, tính giá/CPA — anh tự dùng |
| P2 | Phát hiện cơ hội cross-market + xem sâu sản phẩm |
| P3 | 6 nhân sự cùng dùng, anh duyệt tập trung |
| P4 | Hỏi AI tiếng Việt, được giải thích & gợi ý |
| P5 | AI lập kế hoạch kinh doanh + cảnh báo tự động |

---

## 6. RANH GIỚI — Cái này KHÔNG làm (giữ standalone)

- ❌ Không tạo content/kịch bản/caption/ảnh (đó là việc module Storytelling/Ads Content khác).
- ❌ Không gộp/đẩy data sang module khác.
- ✅ Research chỉ lo: **hiểu thị trường → chọn đúng sản phẩm → quyết định nhanh**. Hết.

---

## 7. RỦI RO & CÁCH GIẢM

| Rủi ro | Cách giảm |
|---|---|
| Kalodata đổi cấu trúc API | Monkey-patch bền hơn scrape DOM; nếu vỡ chỉ sửa lớp capture |
| Pull nhanh bị Kalodata chặn | Ưu tiên "capture khi browse" (an toàn 100%); auto-crawl chạy chậm có nhịp |
| Làm lớn quá → nát app | Pilot-first, build từng chặng, dừng duyệt mỗi chặng |
| Lộ key Anthropic | Key của anh tự nhập ở Settings (giống Gemini/KIE), không nhúng bundle |
| ToS Kalodata | Chỉ tái dùng data anh đã trả phí; giữ app nội bộ, không public |

---

## 8. CẦN GÌ TỪ ANH

- **P1:** chỉ cần thời gian browse Kalodata để có data (anh làm hằng ngày rồi).
- **P4:** 1 API key Anthropic (Claude) — đăng ký sau, chưa gấp.
- **P3:** Gmail của 6 nhân sự để mời vào workspace.
- **Xuyên suốt:** duyệt cuối mỗi chặng trước khi qua chặng kế.

---

## 9. TRẠNG THÁI HIỆN TẠI

- ✅ Recon Kalodata API (bản đồ endpoint đầy đủ, đã kiểm chứng thật)
- ✅ Chốt kiến trúc (Mô hình A, multi-tenant workspace, extension ghi thẳng Supabase)
- ✅ Soi codebase UGC Lab — biết chính xác lắp Research vào đâu
- ✅ Triết lý UX (decision-tool cho newbie)
- ⏭️ **Tiếp theo:** anh duyệt roadmap này → vào P1 (DB schema + extension + dashboard nền)

---
*Nguyên tắc làm việc: code đúng plan đã chốt, không vội; mỗi chặng dừng cho duyệt; Research standalone, không đụng module khác.*
