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

### 🔒 Storytelling Engine — FROZEN STATE (post-Chunk D, commit `cd05722`)

Sau 6 chunks rebuild (A → B1 → B2 → C → C2 → D), storytelling-core architecture
đạt điểm cân bằng tốt. **LOCK** — no more storytelling-core expansion.

**Architecture state đạt được**:
- Reader immersion (reader = emotional center, narrator = validator/bridge)
- Niche separation (8 niches × 7 categorized pools, anti-contamination)
- Mechanism-through-emotion (per-niche concrete vocab, no generic wellness)
- Commercial memory anchors (sharp differentiator + echo block)
- Believable product integration (Block 9 dissolution + Block 10 3-beat + Block 11 soft compare)
- 5 hard validators + 7 soft validators (anti-feature-dump scoped Block 10/11)
- Human imperfection preserved (anti-architecture lock)

**3 INTENTIONAL TRADE-OFFS — KHÔNG được "fix sạch tuyệt đối"**:

1. **Mild fatigue/wellness leakage into hair-loss** — chấp nhận. Fix tuyệt đối sẽ buộc
   thêm anti-rules vào prompt → flatten output. Current niche domain lock + contamination
   detector đủ ngưỡng. Future agent KHÔNG ép Gemini chống leakage 100% — sẽ phá spontaneity.

2. **Slight AI-poetic phrasing residue** — chấp nhận. Cố hoàn toàn loại bỏ poetic
   phrasing sẽ rơi vào "designed to feel emotional" trap. Current Human Imperfection
   rule cho phép slight messiness > polished symmetry. Future agent KHÔNG add poetic-
   phrasing detector hay banned-phrase expansion.

3. **Sales momentum softer than aggressive DR copy** — chấp nhận. Storytelling là
   conversion-via-recognition, không phải hard-sell DR. Sharper sales tension sẽ phá
   immersion (reader exit mode). Nếu cần aggressive DR vibe, đó là JOB của Proof System
   (next priority) — KHÔNG phải storytelling layer.

### 🚫 DO NOT EXPAND (moratorium)

Future iterations KHÔNG được làm:
- Thêm validator layers cho storytelling
- Build emotional meta-systems / narrative governance
- Expand compare architectures
- Add more sampling pools cho narrator/persona/payoff
- "Fix" 3 trade-offs trên
- Optimize "writing prettier"

Lý do: marginal gain → high risk of "designed to feel emotional" drift + spontaneity
loss + AI fingerprint increase.

### ✅ Allowed touch (storytelling layer)

- Bug fixes (Gemini API errors, JSON parse, validator false-positive)
- Adding new NicheKey nếu user request (full niche pool: domainLock + mechanism + desire + DNA)
- Adding new NarratorArchetype to sampling pool (preserves diversity)
- Memory snapshots niche pool expansion (more concrete data, không structural change)
- Per-niche data refinement (tighten forbiddenLeak lists, etc.)

Anything beyond → cần explicit user approval + governance audit.

### 📍 Current priority shift

Storytelling engine = MATURE. Next bottleneck = **Proof System**:
- Believable screenshot logic
- Social proof hierarchy
- Objection-handling proof
- Before-after narrative logic
- Anti-fake-review feel
- Proof pacing

Đây là layer storytelling KHÔNG cover. Conversion thực tế phụ thuộc proof credibility
hiện đang yếu hơn storytelling layer.

### 📚 Reference docs (off-git)

- `../STORYTELLING_HANDOFF.md` — comprehensive state snapshot for machine transfer + agent handoff
- `../../Desktop/CLAUDE_PROJECT_RULES/ENGINE_GOVERNANCE.md.txt` — engineering governance (AUDIT → PRUNE → REBUILD → VERIFY)

---

## TikTok Shop App — Listing Generator (Phase 1-5 complete, 2026-05-28)

App `src/apps/tiktok-shop/` — generates a 9-image conversion-arc listing +
11-block product description for TikTok Shop Malaysia/Vietnam. Niche-locked
to TPCN (health supplements) in Phase 1.

### Architecture (3-tier consistency engine)

- **Tier 1 — Brand Signature (LOCKED identical across all 9 slots)**: logo
  position/size, typography (Plus Jakarta Sans), trust footer bar, header
  strip, 8px grid, palette pool. Built once in `<ListingFrame>` (HeaderStrip
  + FooterTrustBar).
- **Tier 2 — Brand Atmosphere (3 background variants per palette family)**:
  `classic` (slot 1, 4), `soft` (slot 2, 5, 6, 9), `energetic` (slot 3, 7, 8).
  Implemented in `AtmosphereBackground.tsx`.
- **Tier 3 — Slot content (varies per slot)**: composition, overlay text,
  AI scene vs canvas-only mode. 8 slot renderers in `canvas/slots/`.

### Hard rules (DO NOT VIOLATE — see memory rules linked below)

- **No fake certs** — never auto-render Halal/KKM/GMP/FDA badges; only render
  badges user explicitly uploaded in Brand Kit. See `[[feedback-no-fake-certs]]`.
- **Language isolation** — 1 output language per generate (default Bahasa
  Malaysia per `[[project-target-market]]`); prompt hard-locks language 2x
  per slot (system + body). See `[[feedback-language-isolation]]`.
- **Master template consistency** — every slot prompt prepends the same
  locked-style block; QA gate validates 2 random slots look like same brand.
  See `[[feedback-master-template-consistency]]`.
- **No raw ref in preview** — never nest user-uploaded reference photos into
  the final canvas preview; show clean placeholder rect until AI generates.
  See `[[feedback-no-raw-ref-in-preview]]`.

### Generation pipeline (Phase 4)

```
User → "Tạo Listing (9 ảnh + mô tả)" → CostEstimator confirms (~43 credits)
  ↓
initializeListingOutput → 9 ListingImage stubs
  ↓ parallel:
  ├─ generateDescription (Gemini Flash JSON, ~5s)
  └─ generateAllSlots (max 3 concurrent, ~2-3min)
       ├─ slot 1 Hero (2K), 2 Pain, 3 Result, 4 USP, 6 Usage, 7 Compare, 8 Offer (2K)
       └─ skips slot 5 (canvas-only quote card) + 9 (canvas-only FAQ)
  ↓
Each slot: kie.ai gpt-image-2 with refs + prompt → poll → save to Supabase Storage
  ↓ assetId set → ListingCanvas renders AI scene as bg + canvas overlays
```

### Persistence (Phase 5)

- Table: `user_outputs` with `kind = 'tiktok-shop-listing'`
- Store: `apps/tiktok-shop/listingsStore.ts` (mirrors brand-kit pattern)
- Auto-save: debounced 2s on `draft.output` change (in `TikTokShop.tsx`)
- Restore: on mount, load most-recent listing into draft so refresh = no work lost

### What NOT to change without explicit user approval

- The 9-slot arc intent map in `constants.ts SLOT_MAP` — locked conversion framework
- The TPCN palette families (`TPCN_PALETTES`) — 4 fixed options the brand kit snaps to
- The font whitelist (mirrors Brand Kit's `FONT_WHITELIST`)
- The trust footer assurance items — service claims only, never cert claims

### Allowed to touch

- Per-slot prompt refinements (`services/promptBuilder.ts`) — tune output quality
- Per-slot canvas layout tweaks (overlay positions, font sizes) for readability
- Adding slot 5/9 variants (different testimonial card style, FAQ accordion)
- Bug fixes (canvas render glitches, kie.ai polling edge cases)
- Cost-optimization (caching, skip-re-gen-if-same-input)

Anything beyond → discuss + audit before touching.
