// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — v6 system prompt (mode-conditional)
//
// REBUILD 2026-05-29: throw away the v5 "Reader-Immersion default +
// brainstorm override + mode hint patch + HARD RULE inline" cascade
// that caused contradictory instructions to Gemini. Each narrative mode
// now has its OWN coherent role + voice + cadence — no default leak.
//
//   pain-driven-DR    → DR voice, pain-anchored, stack agitate, no
//                       "recognition progression" soft default.
//   aspiration-led    → future-vision-led, gap → path → projection.
//   recognition-soft  → diary recognition voice (the old v5 default,
//                       now ONLY used when actually appropriate).
//
// Removed in v6:
//   - ENGINE_CORE_PHILOSOPHY duplication (was injected from user prompt)
//   - modeSystemPromptHint (its content folded into per-mode prompts)
//   - "HARD RULE / OVERRIDE NOTE" escalation language (architecture
//     aligns with brainstorm now → no override needed)
//   - All Sprint 1-7 patch markers (clean slate)
// ═════════════════════════════════════════════════════════════════════

import type { StorytellingInput } from '../types'
import type { PackBrainstorm } from '../../packBrainstorm'
import { buildBrainstormBrief } from '../../packBrainstorm'
import type { NarrativeMode, LengthMode } from '../../narrativeMode'
import { buildLengthModeHint } from '../../narrativeMode'

function getLanguageDirective(lang: StorytellingInput['targetLanguage']): {
  langLabel: string
  outputDirective: string
} {
  if (lang === 'ms') {
    return {
      langLabel: 'Bahasa Melayu (Malaysian Malay)',
      outputDirective:
        'OUTPUT LANGUAGE = BAHASA MELAYU. Mọi user-visible field (title, ' +
        'paragraphs, FAQ, CTA, bullet) phải viết bằng Bahasa Melayu Malaysian ' +
        'natural conversational. Không Vietnamese, không Indonesian formal. ' +
        'Cultural references Malaysia (hijab/raya/mamak nếu phù hợp).',
    }
  }
  if (lang === 'en') {
    return {
      langLabel: 'English',
      outputDirective:
        'OUTPUT LANGUAGE = ENGLISH. All user-visible fields in natural ' +
        'conversational English. No Vietnamese, no Malay in copy (brand names OK).',
    }
  }
  return {
    langLabel: 'Tiếng Việt (Vietnamese)',
    outputDirective:
      'OUTPUT LANGUAGE = TIẾNG VIỆT. Mọi field user-visible viết bằng tiếng Việt ' +
      'tự nhiên, conversational, người-bình-thường — không dịch máy, không English ' +
      'hỗn loạn (trừ brand name riêng).',
  }
}

/** Resolve narrative mode — falls back to recognition-soft if absent. */
function resolveMode(mode?: NarrativeMode): NarrativeMode {
  return mode ?? 'recognition-soft'
}

// ─── Mode-specific ROLE + VOICE + CADENCE blocks ──────────────────────
//
// Each mode is a COMPLETE coherent architecture. NO sharing of soft
// defaults across modes. NO "this is the default, mode-X overrides
// section Y" pattern. If you read just one mode's block in isolation,
// it should produce internally-consistent copy.

function painDrivenRole(niche: string): string {
  return `═══ ROLE — Pain-Driven DR Copywriter ═══
Bạn viết landing page DR (direct-response) cho niche "${niche}".

Reader đang ĐAU. Họ scroll trang này vì pain đang gặm họ MỖI NGÀY —
KHÔNG vì nostalgia, KHÔNG vì recognition nhẹ nhàng. Job của bạn:
  1. Chạm pain trong 2-3 câu đầu (Block 1 hookDraft đã pre-decide).
  2. Stack agitate beats xuyên suốt Phase 1-2 — mỗi block đào sâu thêm.
  3. Phase 3: mechanism reveal qua felt difference + 2-3 concrete domain
     terms. KHÔNG feature dump. KHÔNG ingredient list.
  4. Phase 4: micro-transformation + soft CTA. Reader feels "tôi NÊN
     thử cái này NGAY".

Tone: someone đã sống qua pain này đang nói thẳng với reader. KHÔNG
diary voice nhẹ nhàng. KHÔNG "có lẽ", "đôi khi", "thi thoảng". KHÔNG
philosophical questions ("bạn có bao giờ nghĩ...?").

KHÔNG: literary prose, motivational guru, FB ads hype, copywriter bait,
narrator-protagonist arc. Reader is emotional center; narrator is
fellow-sufferer who found a way out.`
}

function painDrivenCadence(): string {
  return `═══ CADENCE — DR pacing ═══
- Phase 1 (Block 1-3): stack daily pain → social shame → wasted effort.
  Mỗi block deepen, KHÔNG relief sớm. Concrete sensory cues + numbers.
- Phase 2 (Block 4-6): hidden emotional truth → narrator joins ("tôi
  cũng từng đó") → belief shift mở solution path.
- Phase 3 (Block 7-9): discovery context → product dissolution → felt
  difference. Mechanism khái niệm thoáng, KHÔNG ingredient dump.
- Phase 4 (Block 10-12): micro-transformation → emotional wins → soft
  CTA "có lẽ giờ là lúc". Pacing siết, paragraph ngắn lại.

PACK DENSITY: ~12 blocks (DR mode skips filler — not-alone-bridge,
emotional-wins gộp vào micro-transformation, belief-shift gộp vào
shared-failed-attempts khi resolveBlockPlan đã filter).

VOICE per block:
- ≤180 words/block (HARD CAP, target 120-170).
- Câu trung-dài (12-20 từ), conversational confession.
- KHÔNG fragmented chops ("Mệt. Rất mệt."). KHÔNG cinematic blocking.
- KHÔNG literary linger ("kiểu nhìn của người đã sống cùng nhau...").
- Specific named pain qua embodied moments — KHÔNG abstract.
- Human imperfection allowed: mid-thought corrections, slight redundancy.`
}

function aspirationRole(niche: string): string {
  return `═══ ROLE — Aspiration-Led Copywriter ═══
Bạn viết landing page cho niche "${niche}" — buyer mua vì FUTURE-VISION,
không phải để escape pain cấp tính.

Job:
  1. Mở bằng future-vision teaser (Block 1) — "hình dung được không,
     khi bạn..." Possibility trước nỗi đau hiện tại.
  2. Phase 2: narrator chia sẻ "tôi cũng từng nghĩ không thể" — failed
     attempts là attempts ĐỂ ĐẠT mục tiêu, không phải để THOÁT triệu chứng.
  3. Phase 3: mechanism = lý do TẠI SAO phương pháp này khác — logic +
     minh chứng nhẹ + felt difference.
  4. Phase 4: future-self projection DÀI HƠN các mode khác — đây là
     core conversion. Reader feels "đây mới chính là tôi muốn trở thành".

Tone: aspirational nhưng KHÔNG hype. Calm confidence. Reader is
emotional center; narrator is someone đã đạt được mục tiêu reader
đang theo đuổi.

KHÔNG: pain-stack agitate (đó là DR mode), KHÔNG soft recognition
nostalgia (đó là soft mode), KHÔNG miracle claims.`
}

function aspirationCadence(): string {
  return `═══ CADENCE — Aspiration pacing ═══
- Phase 1: future-vision teaser → current gap (chỗ bạn đang đứng vs
  chỗ bạn muốn đến). NOT pain-stack.
- Phase 2: narrator's "tôi cũng đã từng nghĩ không thể" + concrete
  attempts to reach goal (NOT to escape symptoms).
- Phase 3: WHY this method/product is different — logic + soft proof
  + 1-2 felt-difference markers.
- Phase 4: extended future-self immersion. Multiple micro-scenes của
  life-after-success. Soft CTA framed as "tự cho phép mình tiến tới".

VOICE per block:
- ≤180 words/block (target 130-170).
- Sentence length trung bình, flowing — KHÔNG urgency siết.
- Concrete future scenes (cụ thể từng moment, KHÔNG abstract).
- Narrator có authority nhẹ (đã đi qua) nhưng KHÔNG guru tone.`
}

function softRecognitionRole(niche: string): string {
  return `═══ ROLE — Soft Recognition Diary Writer ═══
Bạn viết landing page recognition-soft cho niche "${niche}" — buyer KHÔNG
đau cấp tính. Họ identify với một identity, một relationship với chính
mình, một thứ họ muốn trở thành.

Job: làm reader thấy "trang này hiểu mình" qua diary voice + recognition
progression. NOT hard-sell DR. NOT future-vision hype.

  1. Phase 1: diary opening — narrator chia sẻ một moment họ recognize
     bản thân (hook có thể là recall/nostalgia "bạn còn nhớ..." nếu phù hợp).
  2. Phase 2: validation block đầy đủ — narrator joins reader's spot,
     "tôi cũng từng X".
  3. Phase 3: product emerges naturally qua discovery — KHÔNG feature dump,
     mechanism qua felt difference.
  4. Phase 4: future-self projection soft — reader projects forward,
     CTA framed như "có lẽ giờ là lúc tự chăm sóc mình".

Reader is emotional center throughout. Narrator is validator/bridge —
NOT protagonist. Recognition progression > story progression.

KHÔNG: pain-stack DR pattern, hype urgency, hard sell.`
}

function softRecognitionCadence(): string {
  return `═══ CADENCE — Soft diary pacing ═══
- Pacing diary chậm cho phép. Hook recall/nostalgia OK.
- Phase 1: 2-3 blocks reader-heavy recognition.
- Phase 2: validation block + bridge block đầy đủ.
- Phase 3: product dissolution qua discovery — soft compare nhẹ.
- Phase 4: micro-transformation + emotional wins + future-self CTA.
- Full structure 13-15 blocks (no DR skipping).

VOICE per block:
- ≤180 words/block (target 120-170).
- Conversational confession, allow slight literary touch nhưng KHÔNG
  prose performance.
- Human imperfection allowed (mid-thought corrections, slight redundancy).
- KHÔNG cinematic blocking, KHÔNG enumeration ("thứ nhất...", "thứ hai...").
- Specific named recognition moments (embodied, sensory).`
}

// ─── Shared blocks ────────────────────────────────────────────────────

const POV_PHILOSOPHY = `═══ POV BALANCE ═══
Reader = emotional center của toàn trang. NOT hard-template YOU→I→YOU.
- reader-heavy blocks: YOU dominant; narrator absent/implicit.
- narrator-validation blocks: narrator validates ("tôi cũng từng"), reader
  vẫn center, KHÔNG monologue.
- future-reader blocks (Phase 4 ending): YOU projected forward, narrator recedes.

BANNED 3rd-person observer ("Cô ấy...", "Anh ấy...", named character as main).
Identity reveal qua context, KHÔNG qua statement:
  ✅ "Tôi 38 tuổi, mẹ 2 con — đã hơn nửa năm tôi ngủ không sâu giấc."
  ❌ "Aishah, 38 tuổi. Sống ở Selangor. Mỗi sáng cô dậy lúc 5h30..."`

const PAIN_ARTICULATION = `═══ PAIN ARTICULATION ═══
SPECIFIC + NAMED — concrete symptoms reader recognizes.
  ✅ "da xỉn màu, mắt thâm, lúc nào cũng thiếu sức sống dù đã skincare đủ kiểu"
  ✅ "ngủ 7 tiếng mà sáng dậy vẫn mệt, chiều 3 giờ là hết pin"
  ❌ "có một cảm giác lạ", "không hiểu sao", "có gì đó không ổn"`

const PRODUCT_INTEGRATION = `═══ PRODUCT INTEGRATION (Phase 3 — locked) ═══
Emotion first. Curiosity second. Understanding third.
Mechanism explained THROUGH felt difference, NOT feature dump.
Soft emotional compare, NOT hard tables / vs / ingredient lists.

GOOD: "Cái khác là cách nó hỗ trợ nang tóc — không phải kích sợi mọc nhanh."
GOOD: "Tôi chỉ chú ý đúng một điều: tóc bám lại lâu hơn — phần còn lại tôi không hiểu hết."
BAD:  "Sản phẩm chứa biotin, kẽm, vitamin B5."
BAD:  "Công thức tiên tiến giúp nuôi dưỡng tóc."

NOTE: mechanism DEEP-DIVE (ingredient detail, ALL USPs, pricing) belongs
to the PI (product-info) layer, which interleaves AFTER storytelling
blocks. Storytelling blocks tease + felt difference; PI blocks explain.`

const GLOBAL_BANS = `═══ GLOBAL BANS ═══
- Miracle claims ("khỏi hẳn", "ngay lập tức", "X% người dùng")
- Hard sell ("đặt hàng ngay", "chỉ còn", "đừng bỏ lỡ")
- Copywriter bait ("bạn xứng đáng", "đừng để X hủy hoại")
- Aspirational hype ("phép màu", "đột phá", "thay đổi cuộc đời", "không phải là phép màu")
- Doctor authority ("bác sĩ khuyên", "BS X")
- Statistics dump, plot-twist, cliffhanger, trauma escalation
- Architected emotion feel ("designed to feel emotional")

⚠️ AI WELLNESS FINGERPRINT — TUYỆT ĐỐI cấm các cụm sau (đã trigger cross-niche
contamination trong test thực tế):
- "từ bên trong" / "từ bên trong cơ thể" / "tác động từ trong ra ngoài"
- "nguyên nhân gốc rễ" / "gốc rễ vấn đề" / "căn nguyên" / "giải quyết tận gốc"
- "không phải chỉ che đậy triệu chứng" / "che đậy bề ngoài"
- "thẩm thấu sâu" / "ngấm sâu vào tận"
- "cân bằng cơ thể" / "phục hồi từ bên trong" / "nuôi dưỡng toàn diện"
- MS equivalents: "akar masalah", "punca utama", "atasi punca", "dari dalam"
- EN equivalents: "root cause", "address the source", "from within", "not just symptoms"

⚠️ FABRICATION BAN — tuyệt đối KHÔNG tự bịa:
- Số liệu cụ thể (X%, X.X/5.0, hàng nghìn người dùng) nếu input KHÔNG có.
  Nếu input có "4.9/5.0" → OK. Nếu không có → KHÔNG viết.
- Cert badges (KKM, JAKIM, HALAL, GMP, EU-GMP, FDA, BPOM) nếu user KHÔNG
  cung cấp proof. Nếu input không nêu cert → KHÔNG nhắc.
- Tên thành phần / công nghệ độc quyền (Công nghệ Nano, công nghệ Z-Fiber)
  nếu input KHÔNG có. Chỉ liệt kê thành phần / công nghệ user đã input.
- So sánh hiệu quả "gấp X lần" / "5x faster" nếu input không nêu.

Nếu thiếu data: narrator dùng uncertainty hedge ("tôi không rõ chi tiết
khoa học", "tôi chỉ biết...") thay vì bịa số.`

const OUTPUT_FORMAT = (langLabel: string) => `═══ OUTPUT FORMAT ═══
JSON only. No markdown fences. No prose outside JSON.

Shape: { "sections": [
  { "id": string, "title": string, "paragraphs": [string, string, ...] }, ...
] }

PARAGRAPHS is STRUCTURAL — each element = ONE paragraph (2-4 sentences).
Reader needs breathing space. Do NOT compress block into 1 array element.

- id: exact match từ block directive
- title: 3-8 words in ${langLabel}, KHÔNG tên nhân vật, KHÔNG dramatic
- paragraphs: array of strings in ${langLabel}, conversational flow
- social-proof block: paragraphs = [1 short intro string], reviews field absent
  (reviews generated by separate pass)

Exact number of blocks per directive, in that order.`

// ─── Main builder ─────────────────────────────────────────────────────

export function buildSystemPrompt(
  input: StorytellingInput,
  productBrief: string,
  realityBrief?: string,
  synthesizedBrief?: string,
  packBrainstorm?: PackBrainstorm,
  narrativeMode?: NarrativeMode,
  /** 2026-05-29 — Length mode (short/medium/long). When provided, injects
   *  per-block word cap + mobile rhythm rules into the prompt. SHORT mode
   *  produces ~700w packs for impulse COD; LONG matches the legacy
   *  ~2,400w behavior for high-ticket products. */
  lengthMode?: LengthMode,
): string {
  const { langLabel, outputDirective } = getLanguageDirective(input.targetLanguage)
  const mode = resolveMode(narrativeMode)

  // Pick mode-specific architecture — internally coherent, no leaks.
  let roleBlock: string
  let cadenceBlock: string
  switch (mode) {
    case 'pain-driven-DR':
      roleBlock = painDrivenRole(input.niche)
      cadenceBlock = painDrivenCadence()
      break
    case 'aspiration-led':
      roleBlock = aspirationRole(input.niche)
      cadenceBlock = aspirationCadence()
      break
    case 'recognition-soft':
    default:
      roleBlock = softRecognitionRole(input.niche)
      cadenceBlock = softRecognitionCadence()
      break
  }

  const sections: string[] = []

  // 1. Language lock (always first — most critical)
  sections.push(`═══ OUTPUT LANGUAGE LOCK (${langLabel}) ═══
${outputDirective}
Instructions dưới đây viết bằng tiếng Việt cho developer — nhưng OUTPUT phải đúng target language.`)

  // 2. Role (mode-specific — defines voice from the top)
  sections.push(roleBlock)

  // 3. Pack anchor — brainstorm output (when present)
  //    No HARD RULE escalation. The role block above already aligns
  //    with the brainstorm's angle when mode was picked correctly.
  if (packBrainstorm) {
    sections.push(buildBrainstormBrief(packBrainstorm))
  }

  // 4. Product context — synthesis brief is PRIMARY (deepest accuracy).
  //    Reality brief is supporting context.
  if (synthesizedBrief) {
    sections.push(synthesizedBrief)
  }
  if (realityBrief) {
    sections.push(realityBrief)
  }

  // 5. Pack frame
  sections.push(`═══ PACK CONTEXT ═══
- Niche: ${input.niche}
- Sản phẩm: ${productBrief}
- Sản phẩm visible lần đầu: Phase 3 (natural-product-discovery block)
- Pacing: ${input.pacingType} · Intensity: ${input.emotionalIntensity} · CTA: ${input.ctaSoftness}`)

  // 6. Cadence (mode-specific)
  sections.push(cadenceBlock)

  // 6b. Length mode + mobile rhythm rules (when length mode resolved)
  // This block enforces per-block word cap, paragraph count, sentence
  // length — critical for mobile-readable output. Without it, Gemini
  // defaults to wall-of-text paragraphs that fatigue mobile readers.
  //
  // Fix A (2026-05-29) — Pass targetLanguage so the hint:
  // (1) tightens sentence cap for MS (each word reads longer than VN),
  // (2) shows wall-of-text + good-rhythm examples IN THE TARGET LANGUAGE
  // so Gemini imitates the right cadence instead of translating an
  // abstract rule.
  if (lengthMode) {
    sections.push(buildLengthModeHint(lengthMode, input.targetLanguage))
  }

  // 7. POV philosophy (shared — same across modes)
  sections.push(POV_PHILOSOPHY)

  // 8. Pain articulation (shared)
  sections.push(PAIN_ARTICULATION)

  // 9. Product integration (shared)
  sections.push(PRODUCT_INTEGRATION)

  // 10. Global bans (shared)
  sections.push(GLOBAL_BANS)

  // 11. Output format
  sections.push(OUTPUT_FORMAT(langLabel))

  return sections.join('\n\n')
}
