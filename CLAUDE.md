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

## TikTok Shop App — Listing Generator (Phase 1-6 complete, 2026-05-28)

App `src/apps/tiktok-shop/` — generates a 9-image conversion-arc listing +
11-block product description for TikTok Shop Malaysia/Vietnam. Niche-locked
to TPCN (health supplements) in Phase 1.

### Architecture pivot (Phase 6): Full AI, no canvas

**Earlier (Phase 2-5)**: 3-tier canvas overlay system (Konva-based) layered
text + brand + logo on top of AI-generated background scenes. Got to ~60%
quality. Failed at:
- Product fidelity (gpt-image-2 drifted from references — purple jar became
  white/orange bottle)
- Text contrast (white-on-white invisible overlays on soft atmosphere)
- "Stuck-on" feel of overlay vs integrated designer typography

**Now (Phase 6)**: full-AI generation per slot. One prompt to Nano Banana 2
(Gemini 3.1 Flash Image) renders the ENTIRE image — product + text + brand
identity + trust bar — all integrated. Canvas folder + Konva deleted.

Reason for pivot:
- Nano Banana 2 specializes in strong reference preservation (the main miss
  with gpt-image-2)
- Modern image gen handles Latin text rendering well (BM is Latin) — VN dấu
  is secondary market risk
- Cost only ~73 credits/listing (~$0.37) — affordable for TPCN margin
- Simpler codebase (~3000 lines of canvas deleted)
- Better "designer feel" — integrated typography vs overlay watermark feel

### Hard rules (DO NOT VIOLATE — see memory rules linked below)

- **Product fidelity NON-NEGOTIABLE** — AI MUST replicate the exact product
  from reference images (color, shape, label, brand name). NO drift, NO
  reinterpretation. Use Nano Banana 2 (preservation-strong) over gpt-image-2
  (drift-prone). Drop "matte plastic / editorial / premium catalog" aesthetic
  prescriptions — they conflict with actual product appearance and cause
  drift. See `[[feedback-product-fidelity-mandate]]`.
- **No fake certs** — never auto-render Halal/KKM/GMP/FDA badges; only render
  badges user explicitly uploaded in Brand Kit. See `[[feedback-no-fake-certs]]`.
- **Language isolation** — 1 output language per generate (default Bahasa
  Malaysia per `[[project-target-market]]`); prompt hard-locks language. See
  `[[feedback-language-isolation]]`.
- **Master template consistency** — every slot prompt prepends the same brand
  identity + trust bar block so all 9 images share the same seller voice. See
  `[[feedback-master-template-consistency]]`.
- **No raw ref in preview** — never nest user-uploaded reference photos into
  the final canvas preview; show clean placeholder until AI generates. See
  `[[feedback-no-raw-ref-in-preview]]`.

### Generation pipeline (Phase 6 — full AI with GPT-4o image edit)

```
User → "Tạo Listing (9 ảnh + mô tả)" → CostEstimator confirms (~55 credits)
  ↓
initializeListingOutput → 9 ListingImage stubs
  ↓ parallel:
  ├─ generateDescription (Gemini Flash JSON, ~5s, ~1 credit)
  └─ generateAllSlots (max 3 concurrent, ~3-5min, 9 × 6 credits)
       └─ slots 1-9 ALL go through gpt-4o-image (i2i) with full-text prompts
  ↓
Each slot: kie.ai /gpt4o-image/generate with filesUrl refs + detailed prompt
  (embedded text + brand + trust bar) → poll → save to Supabase Storage
  ↓ assetId set → ImageSlot renders plain <img src={signedUrl} />
```

### Model choice rationale (lesson learned the hard way)

We initially built with `gpt-image-2-text-to-image` (6 credits, looks like the
right model) — but it SILENTLY IGNORES `image_urls`. Product fidelity failed
completely (purple jar → white pharmacy bottle). The kie.ai docstring in
`utils/kieai.ts` warns about this explicitly.

We then tried `nano-banana-2` (8 credits) thinking it was an upgrade. But
the actual right answer was `gpt-4o-image` (the `/gpt4o-image/generate`
endpoint), which is **also 6 credits** on kie.ai but does TRUE image-to-image
editing with strong reference preservation. Super Ladipage has been using it
in production since Phase 1 (see `apps/super-ladipage/providers/kieGptImage1.ts`).

Rule going forward: **for any feature that needs to "preserve this product,
just change the scene", default to `gpt-4o-image` (filesUrl)**, NOT
`gpt-image-2` (text-only) or `nano-banana-2`. Same 6 credit cost, dramatically
better ref preservation. Only switch to nano-banana models if testing shows
gpt-4o-image fails on specific edge cases.

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
