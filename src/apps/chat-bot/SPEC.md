# Sales Brain — Module Spec v1.0

> Module standalone trong UGC Lab: setup "bộ não bán hàng" cho chatbot rep tin nhắn khách
> từ FB ads (Messenger VN / WhatsApp MY), kèm **simulator** để QC trước khi nối kênh thật.
> CHƯA nối respond.io/Pancake ở giai đoạn này.

---

## 1. Phạm vi

**Trong phạm vi (MVP):**
- Màn cấu hình "Bộ não bán hàng" theo từng sản phẩm (đọc product bank + Sales Config riêng cho chat).
- Engine sinh "gói hành động" hội thoại bằng Gemini (1 call / lượt khách).
- Simulator chat trong app (song ngữ MY-gửi + VN-gloss), test ca khó, panel debug.
- Lưu config vào Supabase (scoped user_id) + localStorage fallback.

**Giai đoạn sau MVP — CAM KẾT làm (mục tiêu cuối, xem PHASES.md P5–P6):**
- **P5:** Backend (Vercel Serverless Functions `api/`) + nối **WhatsApp LIVE (MY)** — bot chat khách thật.
- **P6:** nối **Pancake LIVE (VN / test Mess MY)** + Follow-up cron 72h/24h, lưu hội thoại Supabase.
- → Engine P2 thiết kế **channel-agnostic**: Simulator/WhatsApp/Pancake là adapter cắm vào cùng engine, không làm lại.

**Ngoài phạm vi (chưa làm):**
- Template marketing ngoài cửa sổ, CAPI, dashboard analytics, cross-sell nhiều SP, nhớ khách cũ.

---

## 2. ⚡ NGUYÊN TẮC TIẾT KIỆM GEMINI (bắt buộc — key free dùng chung)

Đây là ràng buộc thiết kế **cứng**, mọi quyết định khác phải tuân theo:

1. **1 lượt khách = ĐÚNG 1 call Gemini.** Một prompt duy nhất trả về *tất cả*: câu trả lời (MY + VN gloss) + intent + next_stage + captured + cờ handover + gợi ý follow-up. **Cấm** tách thành nhiều call (không call riêng để "detect intent", không call riêng để "dịch").
2. **Không vòng lặp QC tự động.** Không bắt chước `video-builder/qcRetry`. Parse JSON lỗi → thử `repairJson()` (local, **không** tốn call). Chỉ re-call **tối đa 1 lần** nếu hoàn toàn không cứu được.
3. **History cắt ngắn**: chỉ gửi `MAX_HISTORY_TURNS = 8` lượt gần nhất vào prompt, không gửi cả hội thoại dài.
4. **System prompt compile 1 lần / phiên**, giữ gọn (playbook + Sales Config sản phẩm + few-shot tối giản). Không nhồi dữ liệu thừa.
5. **`maxOutputTokens` thấp** (mặc định `1024`) — reply chat vốn ngắn.
6. **Simulator chỉ call khi user bấm Gửi**, không call theo từng phím gõ, không auto-preview.
7. **Đếm & hiện số call** trong panel debug để user thấy mức tiêu thụ.

---

## 3. Mô hình dữ liệu

### 3.1. Đọc từ product bank (KHÔNG sửa bank)
Dùng `useBankStore.getState().getProductById(id)`. Lấy: `productName, productDescription,
benefits, usps, painPoints, ingredients, usageGuide, productImages[], targetMarket`.

> ⛔ **KHÔNG dùng field `offer` của bank làm giá chat.** `offer` là giá chuyển đổi cho Ladipage
> (bán 1 chạm), khác hẳn giá bán qua chat. Giá chat nhập riêng ở Sales Config.

### 3.2. Sales Config (MỚI — nhập riêng cho kênh chat)
`src/apps/chat-bot/types.ts` — ✅ P0 DONE (xem file types thực tế; bản dưới là tóm tắt)

```typescript
export type Market = 'VN' | 'MY'

export interface SalesConfig {
  id: string
  productId: string            // FK tới product bank
  market: Market               // VN → tiếng Việt + VND; MY → Manglish + RM
  // --- GIÁ CHAT (riêng, KHÁC giá Ladipage trong bank) ---
  chatPrice: string            // user gõ tự do, vd "RM89" hoặc "299k"
  chatPromo?: string           // ưu đãi khi chat, vd "freeship + tặng ốp"
  discountFloor: string        // TRẦN giảm giá cứng — AI không vượt
  // --- BÁN HÀNG ---
  mediaMap: MediaSlot[]        // gắn ảnh/video (từ productImages hoặc URL) theo bậc
  objectionBank: ObjectionItem[]  // câu từ chối hay gặp + hướng gỡ (user viết VN)
  playbookNote?: string        // tone, độ "lì" khi chốt (user viết VN)
  goldenExamples?: string[]    // 1-2 đoạn hội thoại mẫu vàng (few-shot, user dán)
  updatedAt: number
}

export interface MediaSlot {
  assetRef: string             // asset-UUID (KHÔNG lưu signed URL — hết hạn 1h);
                               // resolve link tươi bằng assetStore.getUrl() lúc gửi/hiển thị
  role: MediaRole              // NHÃN nội dung: 'feature'|'mechanism'|'promo'|'feedback'|'unboxing'|'compare'|'other'
  stage: Stage                 // bậc nên gửi
  caption?: string             // mô tả ngắn (VN) — đưa vào prompt để AI biết khi nào dùng
}
export type MediaRole = 'feature'|'mechanism'|'promo'|'feedback'|'unboxing'|'compare'|'other'

// NGUỒN ảnh/video cho MediaMapEditor (P1):
//  1. Ladipage/super-ladipage: listProjects('landing-page'|'super-ladipage') → lọc productId
//     → sections[].imagePrompts[].generatedAssetRef
//  2. product bank: product.productImages[]
//  3. tiktok-shop: useTikTokShopListingsStore → listings.filter(productId) → images[].imageAssetId
//  4. upload/URL thủ công → assetStore.saveAsset() (cùng bucket 'assets')
// AI KHÔNG "xem" ảnh lúc chat — chỉ đọc role+caption (text) để chọn gửi đúng bậc.
// Nhãn role: user chọn dropdown (mặc định) hoặc nút "AI gợi ý nhãn" = 1 vision call/ảnh LÚC SETUP (không lặp lúc chat).

export interface ObjectionItem { trigger: string; guidance: string }  // cả 2 viết VN
```

### 3.3. Persistence — ✅ P0 DONE
- **KHÔNG tạo bảng mới.** Tái dùng bảng `user_outputs` có sẵn, `kind='chat-bot-config'`
  (đã thêm vào `OutputKind` trong `services/userOutputsAPI.ts`). User không phải chạy SQL.
- Store `src/apps/chat-bot/store.ts` = `useChatBotStore` (zustand + `persist` localStorage
  `'chat-bot-configs-v1'`) theo đúng pattern `ads-content/store.ts`:
  `hydrate()`, `upsert(config)`, `remove(id)`, `getById(id)`, `getByProductId(productId)`.
- Dùng `userOutputsAPI` (`listOutputs/createOutput/updateOutput/deleteOutput`) — đã scope
  `user_id` qua `requireUserId()`, graceful-degrade khi offline/chưa migrate (giữ cache local).
- `hydrate()` gọi onLogin trong `App.tsx` + khi mở ChatBot.

---

## 4. Hợp đồng AI (1 call → gói hành động)

`src/apps/chat-bot/services/salesBrainEngine.ts`

**Input gửi Gemini (1 lần):**
- `systemInstruction` = playbook bậc thang + Sales Config sản phẩm + few-shot (đã compile gọn).
- `contents` = `MAX_HISTORY_TURNS` lượt gần nhất + tin khách mới.
- `generationConfig` = `{ temperature: 0.7, maxOutputTokens: 1024 }`.
- Gọi Gemini qua kie.ai theo đúng pattern `ad-anatomy/analyzeAd.ts`; parse bằng
  `parseAnalysisJson()` + `repairJson()` (tái dùng/clone từ utils sẵn có).

**Output — Action Packet (JSON):**
```typescript
export type Stage =
  | 'greeting' | 'value' | 'qualify' | 'advise'
  | 'objection' | 'close' | 'followup'

export interface BotMessage {
  type: 'text' | 'image' | 'video'
  contentTarget?: string   // text gửi khách (VN hoặc Manglish theo market)
  contentVi?: string       // VN gloss cho operator — KHÔNG gửi (bỏ khi market=VN)
  assetUrl?: string        // khi type=image/video
}

export interface ActionPacket {
  messages: BotMessage[]
  awaitCustomer: boolean   // true = gửi xong DỪNG, chờ khách rep
  nextStage: Stage
  intent: string           // vd 'ask_price' | 'objection_price' | 'ready_to_buy'
  captured: Record<string, string>   // SĐT/địa chỉ/màu... bot moi được
  handover: boolean        // true = chuyển cho người
  suggestedFollowup?: { afterMinutes: number; note: string }  // chỉ GỢI Ý, chưa chạy thật
}
```

---

## 5. Stage machine (kim chỉ nam, AI tự nhảy bậc)

`greeting → value+anchor → qualify(chờ) → advise → objection+promo(chờ) → close(chờ) → followup`

Quy tắc cứng (đưa vào playbook):
- Mở đầu: cho giá nhưng **bọc giá trị + ảnh/video**, **LUÔN kết bằng câu hỏi**, chừa KM sâu cho bậc sau.
- `awaitCustomer:true` sau khi trao info/hỏi → DỪNG chờ khách.
- Giảm giá **không vượt `discountFloor`**.
- Thiếu fact (giá/chính sách) → hỏi lại hoặc `handover:true`, **cấm bịa**.
- Ca khó/đơn lớn/khiếu nại → `handover:true`.
- Khách hỏi dồn → trả lời gọn các ý, vẫn kết bằng câu chốt/nối (nhảy bậc linh hoạt).

---

## 6. UI

### 6.1. Màn Setup (trái: chọn SP + form Sales Config; phải: tóm tắt)
- Chọn product từ bank (dropdown) → pre-fill fact sản phẩm (read-only preview).
- Form Sales Config: `market`, `chatPrice`, `chatPromo`, `discountFloor`, mediaMap (gắn ảnh từ
  `productImages` hoặc URL), objectionBank, playbookNote, goldenExamples.
- User chỉ nhập fact cứng; phần "ăn nói" để AI lo.

### 6.2. Simulator (trái tim QC)
- Khung chat: gõ thử như khách (Manglish/lóng VN) → bot diễn bậc 0→6.
- Mỗi bóng bot hiện **contentTarget + contentVi** (market=MY); market=VN chỉ 1 dòng.
- Hiển thị ảnh/video thật từ mediaMap.
- **Nút "ca khó"** preset: hỏi dồn / chê mắc / đòi giảm sâu / im lặng / trộn lóng.
- Panel debug (sidebar): stage hiện tại, intent, captured, handover, **số call Gemini đã dùng**.
- Call Gemini **chỉ khi bấm Gửi**.

---

## 7. Cấu trúc file & đăng ký module

```
src/apps/chat-bot/
├── ChatBot.tsx                    # ✅ P0 — entry (tab Cấu hình | Mô phỏng)
├── types.ts                       # ✅ P0
├── store.ts                       # ✅ P0 — useChatBotStore (zustand persist + userOutputsAPI)
├── components/                    # P1+
│   ├── ConfigPanel.tsx            # form Sales Config
│   ├── ProductPicker.tsx
│   ├── MediaMapEditor.tsx
│   ├── Simulator.tsx              # khung chat QC
│   ├── ChatBubble.tsx             # render song ngữ + media
│   └── DebugSidebar.tsx
├── services/                      # P2+
│   ├── salesBrainEngine.ts        # 1 call Gemini → ActionPacket
│   ├── compilePrompt.ts           # ghép playbook + config + few-shot (gọn)
│   ├── playbook.ts                # text playbook bậc thang (sửa-in-place)
│   └── hardScenarios.ts           # preset ca khó cho simulator
├── SPEC.md                        # file này
└── PHASES.md                      # kế hoạch từng phase
```

**Đăng ký (3 chỗ) — ✅ P0 DONE:**
- `src/App.tsx`: import `ChatBot`; `'chat-bot': ChatBot` trong `APP_COMPONENTS`;
  `'chat-bot': { name: 'Chat Bot', resetKeys: ['chat-bot-configs-v1'] }` trong `APP_BOUNDARY_META`;
  `useChatBotStore.getState().hydrate()` trong onLogin.
- `src/components/Sidebar.tsx`: NavItem `{ id: 'chat-bot', label: 'Chat Bot', icon: MessageCircle }`
  trong nhóm mới **"Bán hàng"**.

---

## 8. Guardrails (chống bịa / an toàn)
- Giá/KM/chính sách chỉ từ Sales Config; thiếu → hỏi lại / handover, không tự chế.
- Giảm giá ≤ `discountFloor`.
- Không hứa tồn kho/ship ngoài dữ liệu.
- `handover` cho ca khó.
- Mọi dữ liệu scoped `user_id` (đa tenant).

---

## 9. Lộ trình code
- **P0**: types + store + bảng Supabase + đăng ký module (khung trống chạy được).
- **P1**: ConfigPanel + ProductPicker + MediaMapEditor (đọc bank, lưu config).
- **P2**: playbook + compilePrompt + salesBrainEngine (1 call → ActionPacket).
- **P3**: Simulator + ChatBubble (song ngữ) + DebugSidebar + đếm call.
- **P4**: hardScenarios (nút ca khó) + goldenExamples few-shot.
- Verify: `npm run build` / `tsc -b` (project refs) trước khi push.

---

## 10. Convention bám theo repo
TS strict, Zustand, Tailwind 4, no barrel export, services là pure function (dùng `getState()`),
Gemini qua kie.ai + key từ `settingsStore`, parse JSON bằng `parseAnalysisJson()/repairJson()`,
auth scope `user_id` + `requireUserId()`. Playbook sửa-in-place (không chồng layer prompt).
