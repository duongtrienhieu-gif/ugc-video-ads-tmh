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
