# ROLLBACK_HANDOFF — Form 1 ugc-malaysia (LandingPage AI)

> Tài liệu handoff sang phiên Claude Code mới. Đây là **source of truth** — phiên mới chỉ cần đọc file này + `git log` + JSON reference là đủ. KHÔNG cần đọc tab chat cũ.

---

## 1. Mục tiêu

Form 1 `ugc-malaysia` (LandingPage AI) hiện đang gặp vấn đề:
- WhatsApp section output xấu ("bẹp gí"), không giống screenshot thật.
- Tốc độ sinh ảnh chậm hơn mong muốn ở 1 số khía cạnh.
- Before-After identity lock quá cứng.
- Social-proof không còn 4:5 đơn giản như trước.

**Đích đến**: đưa các phần trên về trạng thái **JSON tham chiếu** (sinh lúc ~03:30 18/5/26), **NHƯNG VẪN GIỮ** logic niche-aware (auto theo ngách sản phẩm) cho 6 section nội dung, **VÀ GIỮ** section 10 = Chuyên gia feedback (niche-aware).

**Không phải rollback toàn bộ. Là rollback có chọn lọc.**

### File JSON tham chiếu
```
C:\Users\Vip\Downloads\INFINITY_PROBIOTICS_Landing_Pack.json
```
Pack này sinh khi:
- WhatsApp prompt dạng đơn giản `"WhatsApp screenshot authentic 1-4"`
- aspect 4:5 cho WhatsApp + social-proof
- `runChatProofRender` canvas hybrid STILL ACTIVE
- concurrency 8, poll interval 2000ms
- KHÔNG có field `comparisonData` trong schema
- KHÔNG có section 10 (sẽ thêm — xem mục 5 bên dưới)
- 5 pain scene cứng (office/bathroom/sleepless/dining/scale) — **CÁI NÀY KHÔNG GIỮ**, sẽ ghi đè bằng niche-aware

---

## 2. Bảng commit cần REVERT

| SHA | Mô tả | Lý do revert |
|---|---|---|
| `139e0b0` | `fix(landing-page): whatsapp section — bypass canvas hybrid, strengthen prompt → full authentic screenshot UI` | Bypass `runChatProofRender` + spec WhatsApp tăng cường gây output xấu. Cần bật lại canvas hybrid + dùng spec đơn giản như JSON. |
| `d393ca5` | `perf(landing-page): bump throughput — concurrency 8→12 + poll interval 2000→1000ms` | Đưa về 8 / 2000ms như JSON cũ. |
| `d0cf6eb` | `feat(landing-page): Phase 4 - strengthened B/A identity lock + section validation layer` | Chỉ revert phần **strengthened B/A identity lock** (về bản nhẹ). **GIỮ section validation layer** vì non-fatal, vô hại. → Có thể cần manual edit thay vì revert thuần. |

**Lưu ý**: commit `d0cf6eb` chứa 2 thứ. Phiên mới phải đọc diff và **chỉ revert phần B/A lock**, KHÔNG xóa section validation layer.

---

## 3. Bảng commit phải GIỮ (KHÔNG revert)

| SHA | Mô tả | Lý do giữ |
|---|---|---|
| `8cef7b6` | defensive poll 429/5xx | Phòng thủ kỹ thuật, không đổi prompt. |
| `decbb09` | 6 sections niche-driven (hero/why-happens/failed/mechanism/comparison/social-proof/before-after) | **CỐT LÕI**: niche-aware logic phải giữ. |
| `20789bc` | pain section (2) niche-driven | **CỐT LÕI**: thay 5 scene cứng → tự sinh theo ngách. |
| `8af3168` | Phase 2 Dynamic Product Intelligence System | File `productIntelligence.ts` + `buildIntelligencePromptBlock()` — nguồn 13 ngách. KHÔNG được xóa. |
| `9b98eb4` | revert form 1 ugc-malaysia về JSON style + keep section 10 | Đã là baseline. |

---

## 4. Cái phải GIỮ ngoài commit

- **Phase 1 stability**: AbortController, `cancelInFlight()`, `clearGhostInFlightStates()`, `friendlyError()`, `debugStore` — không đụng output, chỉ UX.
- **MALAY_UI_VOCAB_LOCK** trong `generateImages.ts` — đã active tại thời điểm JSON sinh.
- **Section validation layer** (`validatePackSections`) — non-fatal, chỉ log.
- **5 form khác**: `premium`, `advertorial`, `chuyen-gia`, `hard-sell-cod` + bất kỳ form nào khác — TUYỆT ĐỐI KHÔNG ĐỤNG (per-form isolation rule).
- **Creative Studio, video-builder v3, lab-content, avatar-ai**: KHÔNG ĐỤNG.

---

## 5. Section 10 = Chuyên gia Feedback (GIỮ + có thể tinh chỉnh)

JSON tham chiếu (18/5) KHÔNG có section 10. Hiện tại đã có. **Giữ.**

Yêu cầu section 10:
- **Format**: feedback từ chuyên gia có thẩm quyền về sản phẩm.
- **Niche-aware**: loại chuyên gia tự đổi theo ngách qua `productIntelligence.ts`:
  - joint-pain → bác sĩ chỉnh hình / vật lý trị liệu
  - digestive-gut → chuyên gia dinh dưỡng / bác sĩ tiêu hóa
  - skincare → bác sĩ da liễu
  - weight-loss → chuyên gia dinh dưỡng / endocrinologist
  - hair-care → trichologist / bác sĩ da liễu
  - vision → bác sĩ nhãn khoa
  - cardio → bác sĩ tim mạch
  - diabetes → endocrinologist
  - women-health → bác sĩ phụ khoa
  - men-vitality → urologist / nam khoa
  - immunity-general → bác sĩ đa khoa / miễn dịch
  - sleep-stress → bác sĩ thần kinh / chuyên gia giấc ngủ
  - dental-oral → nha sĩ
- **Output JSON**: giữ field hiện tại trong SYSTEM_PROMPT của `generateLandingPack.ts`.

Phiên mới đọc lại spec section 10 hiện tại trong `src/apps/landing-page/services/generateLandingPack.ts` để xác nhận đã đúng map ngách → loại chuyên gia. Nếu chưa, mới sửa.

---

## 6. Pack mới sẽ có gì sau rollback

Khi user bấm **"Tạo lại pack"** (KHÔNG phải chỉ "Sinh ảnh"), pack JSON mới phải đạt:

- Section 1 Hero: demographic + setting theo ngách (KHÔNG còn fix cứng).
- Section 2 Pain: 5 scene **theo ngách sản phẩm** (KHÔNG còn office/bathroom/sleepless/dining/scale nếu sản phẩm không phải gut/probiotics).
- Section 3 Mechanism diagram: cơ chế theo ngách.
- Section 4 Failed solutions: sản phẩm fail theo ngách.
- Section 7 Ingredient cards: niche-aware.
- Section 9 Comparison: niche-aware row selection.
- Section 10 Chuyên gia feedback: loại chuyên gia theo ngách.
- Section 11 WhatsApp: prompt đơn giản `"WhatsApp screenshot authentic 1/2/3/4"`, aspect 4:5, canvas hybrid `runChatProofRender` chạy.
- Section 12 Social-proof: aspect 4:5, prompt đơn giản.
- Section 14 Before-After: niche-aware transformation, identity lock nhẹ (không khóa cứng).
- Tổng số section: **11+** (JSON cũ 10, thêm section 10).

---

## 7. Quy trình thực hiện (BẮT BUỘC theo thứ tự)

1. **Tạo branch**: `git checkout -b rollback-form1-2026-05-18`
2. **Xác nhận lại với user 3 SHA cần revert** trước khi chạy bất kỳ `git revert` nào.
3. **Revert `139e0b0`**: `git revert 139e0b0 --no-edit`. Resolve conflict nếu có (giữ logic niche-aware ở section 11 WhatsApp nếu commit này có đụng — đọc diff trước).
4. **Revert `d393ca5`**: `git revert d393ca5 --no-edit`.
5. **`d0cf6eb` — KHÔNG revert thuần**. Đọc diff: `git show d0cf6eb`. Identify phần B/A identity lock strengthening. Manual edit `generateImages.ts` để đưa `BEFORE_AFTER_IDENTITY_LOCK_DIRECTIVE` (hoặc tên tương đương) về bản nhẹ. GIỮ phần section validation layer. Commit với message: `revert(landing-page): soften B/A identity lock, keep section validation`.
6. **Build check**: `npm run build`. Phải pass. Nếu fail → đọc lỗi, fix tối thiểu, KHÔNG đụng scope ngoài form 1.
7. **Lint check** (nếu repo có): `npm run lint` hoặc `npx tsc --noEmit`.
8. **Push branch**: `git push -u origin rollback-form1-2026-05-18`.
9. **Báo user test trên Vercel preview** trước khi merge main.
10. **CHỈ MERGE MAIN KHI USER OK**. Auto-push main → Vercel auto-deploy.

---

## 8. Checklist verify (user test trên Vercel preview)

User sẽ chạy form 1 ugc-malaysia với **sản phẩm khớp xương** (joint-pain niche). Pack mới phải có:

- [ ] Section 2 Pain: 5 scene mô tả người đau khớp (leo cầu thang khó / đứng dậy đau / không bế cháu được / mất ngủ vì đau / không đi bộ được) — **KHÔNG** office/bathroom/sleepless-bloated/dining/scale.
- [ ] Section 10: chuyên gia chỉnh hình / vật lý trị liệu (KHÔNG phải bác sĩ tiêu hóa).
- [ ] Section 11 WhatsApp: 4 ảnh, aspect 4:5, trông như screenshot WhatsApp thật (không "bẹp gí"). Canvas hybrid render được dùng.
- [ ] Section 12 Social-proof: aspect 4:5, prompt đơn giản.
- [ ] Tốc độ sinh ảnh: ~0.5–1.0 ảnh/phút (chậm hơn hiện tại có chủ đích, đổi lấy chất lượng).
- [ ] Section 14 Before-After: 2 ảnh ba_01 + ba_02 cùng identity, nhưng không bị over-constrain.
- [ ] Không có lỗi build, không có console error.

---

## 9. Rủi ro đã biết

1. **IndexedDB cache**: Pack user đã lưu trước đó KHÔNG tự đổi prompt. Phải bấm **"Tạo lại pack"** (không phải chỉ "Sinh ảnh") để Gemini sinh prompt theo SYSTEM_PROMPT mới.
2. **Tốc độ chậm lại**: 12→8 concurrency + poll 1s→2s ⇒ chậm hơn ~30–50%. Đây là đánh đổi có chủ đích.
3. **`comparisonData` schema**: JSON cũ không có. Nếu code hiện tại có validator yêu cầu field → để optional, KHÔNG yêu cầu bắt buộc.
4. **runChatProofRender bypass code**: Trong `generateImages.ts` có thể có comment `// @ts-expect-error` hoặc `// eslint-disable` quanh đoạn bypass. Khi un-bypass, gỡ luôn comment đó.
5. **`d0cf6eb` mixed concern**: phải tách revert tay, không revert thuần (xem step 5).
6. **Conflict khi revert `139e0b0`**: vì sau commit này còn `d393ca5` + `8cef7b6` đụng cùng file `kieai.ts` / `generateImages.ts`. Đọc kỹ conflict, không xóa nhầm phần `decbb09` (niche-aware).

---

## 10. Constraint bất biến (KHÔNG được vi phạm)

- ❌ KHÔNG đụng Creative Studio app.
- ❌ KHÔNG đụng video-builder v3, lab-content, avatar-ai.
- ❌ KHÔNG đụng 4 form khác trong landing-page (premium / advertorial / chuyen-gia / hard-sell-cod).
- ❌ KHÔNG đổi image model — phải là `gpt-image-2-text-to-image` @ 1K @ 6 credits.
- ✅ Auto-push main sau khi user OK (Vercel auto-deploy).
- ✅ Per-form isolation: tất cả thay đổi nằm trong scope form 1 ugc-malaysia.
- ✅ Lab Content self-contained (không liên quan rollback này, chỉ nhắc để không đụng).

---

## 11. File chính sẽ đụng

- `src/apps/landing-page/services/generateLandingPack.ts` — SYSTEM_PROMPT form 1, section specs.
- `src/apps/landing-page/services/generateImages.ts` — buildFinalPrompt, runWithCreditSafeRetry, B/A lock, WhatsApp routing.
- `src/utils/kieai.ts` — poll interval (về 2000ms).
- `src/apps/landing-page/LandingPageAI.tsx` — concurrency param (12→8).
- (Có thể) `src/apps/landing-page/services/productIntelligence.ts` — chỉ ĐỌC, không sửa trừ khi spec section 10 chuyên gia cần map ngách bổ sung.

KHÔNG đụng file ngoài danh sách trên.

---

## 12. Khi xong

- Báo user: 3 commit revert + 1 commit manual edit B/A lock.
- Đưa link branch + diff summary.
- ĐỢI user test Vercel preview.
- Sau khi user OK → merge main → push.
