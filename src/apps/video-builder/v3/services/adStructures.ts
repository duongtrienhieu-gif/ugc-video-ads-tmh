// ── Ad Structures (P3j) ──────────────────────────────────────────────────────
// Collapsed from 8 sub-frameworks → 2 GROUPS. Hook tone is now decided by
// mix-matching the 3 POOLs in `hookViralPatterns.ts` — the entries below only
// carry what's structural (block weights / product reveal timing / per-block
// body guides / banned openings / banned symptom vocabulary).
//
//   INSTANT — product is in the hook (~0-2s). Cold-reach scroll-stop. The pain
//             block is a single transition sentence; product stays in frame.
//   LEAD    — product is revealed mid-script (~30-40%). Pain block is longer
//             and concrete; product enters the discovery block as the answer.
// ─────────────────────────────────────────────────────────────────────────────

import type { AdStructure, ScriptBlockId } from '../types'

export type AdGroup = 'instant' | 'lead'

export interface AdStructureConfig {
  id: AdStructure
  group: AdGroup
  labelVi: string
  descriptionVi: string
  emoji: string
  tone: 'violet' | 'rose' | 'emerald' | 'amber' | 'sky' | 'pink'
  /** Per-block target weights — drives the duration estimator. */
  blockWeights: Record<ScriptBlockId, number>
  /** When the product is allowed on screen / in the script — drives both the
   *  body prompt and the director downstream. Plain rule, plain English. */
  productRevealRule: string
  /** Per-block guides — what each non-hook block must do in this group. Injected
   *  into the body prompt so the schema's generic "pain block" doesn't make
   *  Gemini fall back to a default pain-question opening. */
  blockGuides: { pain: string; discovery: string; benefit: string; cta: string }
  /** Phrases / openings BANNED from the body in this group. Prevents the
   *  trained-in pain-question / wrong-shape openings. */
  bodyAntiPatterns: string[]
  /** Vocabulary banned in the pain block (INSTANT only — the pain block is a
   *  1-sentence transition, NOT a symptom report). Prevents Gemini from sneaking
   *  in "đau dạ dày / mệt mỏi / khó tập trung" — which collapses an INSTANT
   *  script into Problem-Solution shape. LEAD allows symptoms (pain is real). */
  symptomBans: string[]
  /** System-prompt fragment fed to Gemini — describes HOW to write the body in
   *  this group's specific shape. Tight, no fluff. */
  systemPrompt: string
  bestFor: string[]
}

const SYMPTOM_BANS_INSTANT = [
  'đau dạ dày', 'đau đầu', 'đau bụng', 'chóng mặt', 'mệt mỏi', 'kiệt sức',
  'khó tập trung', 'khó chịu', 'đầy hơi', 'ợ chua', 'táo bón', 'mất ngủ',
  'stress', 'căng thẳng', 'hư da', 'da xấu', 'da tổn thương', 'rụng tóc',
  'gãy rụng', 'lờ đờ', 'uể oải', 'sa sút', 'kém tập trung',
]

export const AD_STRUCTURES: Record<AdStructure, AdStructureConfig> = {
  INSTANT: {
    id: 'INSTANT',
    group: 'instant',
    labelVi: 'Vào thẳng sản phẩm',
    descriptionVi: 'Hook nêu tên / cho thấy sản phẩm ngay giây 0-2. Cold-reach scroll-stop mạnh nhất, hợp đại đa số sản phẩm.',
    emoji: '🚀',
    tone: 'violet',
    blockWeights: { hook: 0.20, pain: 0.05, discovery: 0.35, benefit: 0.25, cta: 0.15 },
    productRevealRule:
      'Tên sản phẩm PHẢI xuất hiện trong HOOK. Block pain CHỈ 1 câu transition nối tiếp từ hook — KHÔNG kể triệu chứng, KHÔNG đặt câu hỏi pain. Block discovery + benefit giữ sản phẩm trong khung. CTA endorse với sản phẩm trên tay.',
    blockGuides: {
      pain:
        'CHỈ 1 câu TRANSITION nối tiếp từ hook — mở rộng chính cảm giác / chi tiết / khoảnh khắc đã ' +
        'nêu trong hook. PHẢI reuse ÍT NHẤT 1 từ chính (literal) từ hook. ' +
        'CẤM TUYỆT ĐỐI: đặt câu hỏi pain ("Bạn có hay…?"), kể triệu chứng, mention các từ trong ' +
        'symptomBans, mở bằng "Tôi từng / Trước đây tôi / Bạn có biết". ' +
        'Câu này dài ~3-5s nói thôi.',
      discovery:
        'Phần thân chính — tả sản phẩm cụ thể: thành phần / cấu tạo / USP / cách dùng. ' +
        'Lồng TỐI THIỂU 1 sensory beat THẬT (vị / kết cấu / mùi / cảm giác trên da / cảm giác cầm / ' +
        'âm thanh — pick chiều phù hợp loại sản phẩm). Có thể thêm 1 point-of-contact đời thường ' +
        '(giờ giấc / chỗ / hành động cụ thể) nếu hợp.',
      benefit:
        'Kết quả sau khi dùng + LẶP LẠI khoảnh khắc/cảm giác từ hook ở trạng thái mới ' +
        '(empathy echo — đóng vòng cảm xúc).',
      cta:
        '1-2 câu, KHÔNG lan man. Sản phẩm vẫn trong tay creator. Phải có ' +
        'ÍT NHẤT 1 đòn bẩy mua hàng cụ thể (chọn 1 trong các loại, tuỳ brief): ' +
        'SCARCITY ("kẻo hết hàng / chỉ còn vài hộp / cuối tuần này thôi"), ' +
        'URGENCY ("hốt lẹ / nhanh tay / trong 24h / sale hôm nay"), ' +
        'SOCIAL PROOF ("đã 10k người đặt / 2.3k đánh giá 5 sao"), ' +
        'RISK REVERSAL ("đổi trả 30 ngày / không thích hoàn tiền"). ' +
        'KHÔNG dùng câu CTA flat kiểu "Mua ngay tại link bio" — thiếu đòn bẩy.',
    },
    bodyAntiPatterns: [
      'Bạn có hay', 'Bạn đã bao giờ', 'Có khi nào bạn', 'Dạo này bạn có',
      'Tôi từng nghĩ', 'Trước đây tôi', 'Bạn có biết',
      'Ai mà chưa biết', 'Có ai như mình',
    ],
    symptomBans: SYMPTOM_BANS_INSTANT,
    systemPrompt:
      'Write a TikTok-native ad where the PRODUCT IS IN THE FRAME / NAMED from the very first ' +
      'second. The body flows DIRECTLY from that visual moment — every block keeps the product ' +
      'visible (close-up, usage, ingredient detail, result). NO long pain block — pain is one ' +
      'transition sentence at most. NO body-symptom vocabulary in pain. Sound like a real ' +
      'first-person review held up to camera, never an ad pitch.',
    bestFor: ['food', 'cosmetic', 'gadget', 'accessory', 'apparel', 'tech', 'best-seller'],
  },

  LEAD: {
    id: 'LEAD',
    group: 'lead',
    labelVi: 'Dẫn dắt sản phẩm',
    descriptionVi: 'Hook xây cảm xúc / story / pain — sản phẩm reveal giữa video sau khi viewer được "neo". Tốt cho sản phẩm cần build trust.',
    emoji: '📖',
    tone: 'rose',
    blockWeights: { hook: 0.15, pain: 0.25, discovery: 0.25, benefit: 0.25, cta: 0.10 },
    productRevealRule:
      'Tên sản phẩm KHÔNG xuất hiện trong HOOK. Pain block dài hơn (~25% video) kể cụ thể với khoảnh khắc đời thường. Discovery block REVEAL sản phẩm như đáp án / bước ngoặt (~giây 15-25 cho video 60s). Benefit lặp moment từ hook (empathy echo).',
    blockGuides: {
      pain:
        'Mở rộng câu chuyện / cảm xúc / pain từ hook — thêm KHOẢNH KHẮC ĐỜI THƯỜNG RẤT CỤ THỂ ' +
        '(giờ giấc / chỗ ngồi / hành động / câu nội tâm). PHẢI reuse ÍT NHẤT 1 từ chính từ hook. ' +
        'Tone đời sống thật, không khoa trương. Phần này là điểm chạm chính, kéo người xem đồng cảm.',
      discovery:
        'KHOẢNH KHẮC tìm ra / nhận ra / thử sản phẩm — kiểu "tình cờ thấy review" / "bạn cho thử" / ' +
        '"mua đại". Nêu TÊN sản phẩm + 1 đặc tính / cơ chế cụ thể đáp pain trên. Lồng 1 sensory ' +
        'beat thật khi thử lần đầu.',
      benefit:
        'Thay đổi sau khi dùng + LẶP LẠI khoảnh khắc đã nêu trong hook + pain ở trạng thái mới ' +
        '(giờ với cảm giác mới — empathy echo).',
      cta:
        '1-2 câu nhẹ nhàng, tone narrative tiếp nối câu chuyện ở trên — không bán cứng. ' +
        'Phải có ÍT NHẤT 1 đòn bẩy mua hàng cụ thể (chọn loại hợp tone story): ' +
        'SOCIAL PROOF mềm ("ai dùng rồi cũng quay lại / 10k người đã thử"), ' +
        'RISK REVERSAL ("đổi trả 30 ngày / không thích hoàn tiền"), ' +
        'SCARCITY mềm ("đợt giảm tuần này thôi"), ' +
        'INVITATION ("nếu bạn cũng đang ở đó, thử coi"). ' +
        'KHÔNG dùng câu CTA flat kiểu "Mua ngay tại link bio".',
    },
    bodyAntiPatterns: [
      'Cái này mình đang cầm', 'Mình vừa mở',
      'Tưởng X mà', '3 lý do mình',
      'Mua 1 tặng 1 ngay', 'Sale 50% hôm nay',
    ],
    symptomBans: [],   // LEAD allows real pain block — symptoms are honest
    systemPrompt:
      'Write a TikTok-native ad as a STORY / CONFESSION / AUTHORITY DROP / SOCIAL PROOF that ' +
      'BUILDS BEFORE THE PRODUCT IS NAMED. Hook is emotion / story / claim — NO product mention. ' +
      'Pain block widens that emotion with CONCRETE moments (no abstract feelings). Discovery is ' +
      'the TURNING POINT where the product enters. Benefit closes the emotional loop from the ' +
      'hook. Conversational, voice-memo register.',
    bestFor: ['beauty', 'wellness', 'supplement', 'parenting', 'health', 'emotional niches'],
  },
}

// Display order in the picker: INSTANT (default, stronger cold-reach) first.
export const AD_STRUCTURE_ORDER: AdStructure[] = ['INSTANT', 'LEAD']

export const QUICK_GEN_FRAMEWORKS: AdStructure[] = AD_STRUCTURE_ORDER

/** Per-group ordering — kept so the picker UI back-compat doesn't break. */
export const AD_STRUCTURES_BY_GROUP: Record<AdGroup, AdStructure[]> = {
  instant: ['INSTANT'],
  lead:    ['LEAD'],
}
