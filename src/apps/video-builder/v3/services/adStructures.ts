// ── Ad Structures (P3g rewrite) ──────────────────────────────────────────────
// 8 frameworks in TWO GROUPS — see types.ts AdStructure.
//
//   GROUP 1 · INSTANT (vào thẳng sản phẩm) — product is named / shown in the hook
//     (~0-2s): VISUAL_HAND, RAPID_REASONS, UNEXPECTED_DISCOVERY, POV_FOR_YOU.
//   GROUP 2 · LEAD (dẫn dắt sản phẩm) — product is revealed mid-script (~30-40%):
//     STORY_CONFESSION, AUTHORITY_EXPERT, SOCIAL_PROOF, PROBLEM_SOLUTION.
//
// Every framework carries a HARD `hookPattern` (the template every hook MUST
// follow) + a `productRevealRule` (when the product is allowed on screen). The
// hook generator and body generator both inject these so the script is bound to
// the chosen framework end-to-end — no more "all frameworks generate the same
// hook" / "the body drifts off the framework" drift.
// ─────────────────────────────────────────────────────────────────────────────

import type { AdStructure, ScriptBlockId } from '../types'

export type AdGroup = 'instant' | 'lead'

export interface AdStructureConfig {
  id: AdStructure
  /** Picker grouping. */
  group: AdGroup
  labelVi: string
  descriptionVi: string
  emoji: string
  tone: 'violet' | 'rose' | 'emerald' | 'amber' | 'sky' | 'pink'
  /** Per-block target weights — drives the duration estimator. */
  blockWeights: Record<ScriptBlockId, number>
  /** HARD hook template for this framework — every hook MUST follow this pattern
   *  (with the brackets filled). Different hooks vary the TONE / USP / detail,
   *  never the pattern. Drilled into the hook prompt as a non-negotiable rule. */
  hookPattern: string
  /** 6 distinct ANGLES the 6 generated hooks should each take, so they aren't
   *  paraphrases of the same line. Each entry is one short directive. */
  hookAngleHints: string[]
  /** When the product is allowed on screen / in the script — drives both the
   *  body prompt and the director downstream. Plain rule, plain English. */
  productRevealRule: string
  /** System-prompt fragment fed to Gemini — describes HOW to write the body in
   *  this framework's specific shape. Tight, no fluff. */
  systemPrompt: string
  bestFor: string[]
}

export const AD_STRUCTURES: Record<AdStructure, AdStructureConfig> = {
  // ── Group 1 · INSTANT ─────────────────────────────────────────────────────
  VISUAL_HAND: {
    id: 'VISUAL_HAND',
    group: 'instant',
    labelVi: 'Sản phẩm trong tay',
    descriptionVi: 'Hook = cầm/khoe sản phẩm + 1 USP gây bất ngờ — visual-first, vào sản phẩm giây 0.',
    emoji: '🎯',
    tone: 'violet',
    blockWeights: { hook: 0.20, pain: 0.05, discovery: 0.30, benefit: 0.30, cta: 0.15 },
    hookPattern: 'Cái [TÊN/loại sản phẩm] mình đang cầm đây — [1 USP/đặc tính bất ngờ trong 1 câu].',
    hookAngleHints: [
      'nhấn TEXTURE / cảm giác cầm (cận tay)',
      'nhấn 1 CON SỐ / thông số nổi bật ngay sau tên',
      'nhấn KÍCH THƯỚC / so sánh thị giác bất ngờ',
      'nhấn 1 THÀNH PHẦN / chi tiết "trong" sản phẩm',
      'nhấn GIÁ rẻ bất ngờ so với chất lượng cầm thấy',
      'nhấn KHOẢNH KHẮC dùng (mở gói, bóc, bẻ, xịt) ngay câu đầu',
    ],
    productRevealRule:
      'Tên/cầm sản phẩm PHẢI xuất hiện trong HOOK. Trong block discovery + benefit, mọi câu đều giữ sản phẩm trong khung (cầm, cận, dùng). KHÔNG có block pain dài >1 câu.',
    systemPrompt:
      'Write a TikTok-native ad where the PRODUCT IS IN THE FRAME from the very first second. ' +
      'The HOOK has the creator holding / showing the product + one surprising USP. The body ' +
      'flows DIRECTLY from that visual moment — every block keeps the product visible (close-up, ' +
      'usage, ingredient detail, result). NO long pain block (max 1 short sentence of empathy). ' +
      'Sound like a real first-person review held up to camera, never an ad pitch.',
    bestFor: ['food', 'cosmetic', 'gadget', 'accessory'],
  },

  RAPID_REASONS: {
    id: 'RAPID_REASONS',
    group: 'instant',
    labelVi: '3 lý do mua ngay',
    descriptionVi: 'Hook = "3 lý do tôi mua [TÊN]" rồi liệt nhanh — rhythm-first, sản phẩm xuất hiện ngay giây 0.',
    emoji: '⚡',
    tone: 'amber',
    blockWeights: { hook: 0.15, pain: 0.05, discovery: 0.40, benefit: 0.25, cta: 0.15 },
    hookPattern: '[Số] lý do mình mua [TÊN sản phẩm] [thời điểm/dịp gần] — [hint 1 từ về phần sau].',
    hookAngleHints: [
      'số 3 — chuẩn TikTok',
      'số 2 — khô hơn, gấp gáp hơn',
      'cấu trúc đảo "Mình mua [TÊN] vì 3 lý do…"',
      'thêm "ai cũng nên biết" sau tên sản phẩm',
      'nhấn "tuần này / hôm nay" để cảm giác mới mẻ',
      'thêm 1 hint cụ thể cuối hook (vd "lý do thứ 3 mới khủng")',
    ],
    productRevealRule:
      'Tên sản phẩm PHẢI ở trong HOOK. Block discovery = đúng 3 (hoặc N) lý do, MỖI lý do 1 câu ngắn, mỗi câu gắn 1 đặc tính/USP cụ thể của sản phẩm. KHÔNG block pain. CTA gọn.',
    systemPrompt:
      'Write a TikTok-native LISTICLE ad: the HOOK is "N reasons I bought this", then the body ' +
      'is the N reasons spoken back-to-back as short cuts. Each reason is ONE punchy sentence ' +
      'naming a real product trait (ingredient, spec, result, feel, price). Active verbs, present ' +
      'tense, no empathy block, no pain-build. Wrap with a one-line summary + CTA.',
    bestFor: ['gadget', 'cosmetic', 'food', 'health'],
  },

  UNEXPECTED_DISCOVERY: {
    id: 'UNEXPECTED_DISCOVERY',
    group: 'instant',
    labelVi: 'Phát hiện bất ngờ',
    descriptionVi: 'Hook = "Tưởng [X thông thường] mà [TÊN] hoá ra [Y bất ngờ]" — curiosity-first, vào sản phẩm giây 0.',
    emoji: '🤯',
    tone: 'sky',
    blockWeights: { hook: 0.20, pain: 0.05, discovery: 0.30, benefit: 0.30, cta: 0.15 },
    hookPattern: 'Tưởng [X thông thường về loại sản phẩm] mà [TÊN] này hoá ra [Y bất ngờ].',
    hookAngleHints: [
      'phản trực giác về CẢM GIÁC khi dùng (vd: tưởng đắng, hoá ra ngọt)',
      'phản trực giác về GIÁ (tưởng đắt, hoá ra…)',
      'phản trực giác về CÔNG DỤNG / kết quả',
      'phản trực giác về THÀNH PHẦN / cấu tạo',
      'phản trực giác về ĐỐI TƯỢNG dùng (tưởng chỉ cho A, hoá ra…)',
      'phản trực giác về KÍCH THƯỚC / hiệu năng',
    ],
    productRevealRule:
      'Tên sản phẩm PHẢI ở trong HOOK. Body BẮT ĐẦU bằng giải thích "tại sao bất ngờ thật" (1-2 câu), rồi chuyển sang USP / cách dùng để chứng minh. KHÔNG có pain block dài.',
    systemPrompt:
      'Write a TikTok-native ad opening with a CONTRARIAN twist about the product itself. The ' +
      'HOOK is the "thought X, turns out Y" line. The body PROVES the unexpected angle: short ' +
      'discovery block (the real reason it surprises), benefit block (what you actually get), ' +
      'tight CTA. No pain build-up, no empathy block. Sounds like a real "wait what?" reaction.',
    bestFor: ['any niche', 'innovative', 'misunderstood product'],
  },

  POV_FOR_YOU: {
    id: 'POV_FOR_YOU',
    group: 'instant',
    labelVi: 'Dành cho ai...',
    descriptionVi: 'Hook = "Nếu bạn [persona], thì [TÊN] là dành cho bạn" — identity-first, vào sản phẩm giây 1.',
    emoji: '🙋',
    tone: 'pink',
    blockWeights: { hook: 0.20, pain: 0.05, discovery: 0.25, benefit: 0.30, cta: 0.20 },
    hookPattern: 'Nếu bạn [persona / pain rất cụ thể], thì [TÊN sản phẩm] này là dành cho bạn.',
    hookAngleHints: [
      'persona theo NGHỀ / vai trò (vd: dân văn phòng, mẹ bỉm…)',
      'persona theo THÓI QUEN (vd: hay quên ăn sáng…)',
      'persona theo PAIN cụ thể (vd: hay đau đầu sau 3h chiều)',
      'persona theo SỞ THÍCH (vd: thích ngọt nhưng sợ tăng cân)',
      'persona theo TÌNH HUỐNG (vd: chuẩn bị đi du lịch xa)',
      'persona theo MONG MUỐN (vd: muốn da khỏe mà lười skincare)',
    ],
    productRevealRule:
      'Tên sản phẩm PHẢI ở trong HOOK (sau persona). Block discovery + benefit chứng minh "đúng là dành cho persona đó" bằng đặc tính sản phẩm. Pain chỉ gói trong persona ở hook, không kéo dài.',
    systemPrompt:
      'Write a TikTok-native ad addressing a specific viewer PERSONA in the hook, then handing ' +
      'them the product. Body proves "yes this is for you" through 1-2 product traits that ' +
      'directly answer that persona\'s need. Stays personal, second-person ("you"), warm. NO ' +
      'long pain block — the persona line already names the pain.',
    bestFor: ['lifestyle', 'health', 'beauty', 'targeted niches'],
  },

  // ── Group 2 · LEAD ────────────────────────────────────────────────────────
  STORY_CONFESSION: {
    id: 'STORY_CONFESSION',
    group: 'lead',
    labelVi: 'Kể chuyện / Tự thú',
    descriptionVi: 'Câu chuyện cá nhân "tôi đã sai về..." — sản phẩm xuất hiện như bước ngoặt giữa video.',
    emoji: '🤫',
    tone: 'rose',
    blockWeights: { hook: 0.15, pain: 0.30, discovery: 0.25, benefit: 0.20, cta: 0.10 },
    hookPattern: '[Mình/Tôi/Em] đã [thừa nhận sai lầm hoặc nỗi khổ trong ngách], cho đến khi…',
    hookAngleHints: [
      'thú nhận một thói quen sai trong nhiều năm',
      'thú nhận từng nghĩ giải pháp X là đủ',
      'thú nhận từng tốn nhiều tiền sai cách',
      'thú nhận từng giấu vì xấu hổ',
      'thú nhận từng bỏ cuộc vì nản',
      'thú nhận từng thử nhiều nhãn đều thất bại',
    ],
    productRevealRule:
      'Sản phẩm KHÔNG xuất hiện trong hook. Pain block kể tiếp nỗi khổ thật (~1/3 video). Discovery block = KHOẢNH KHẮC tìm ra sản phẩm (~giây 15-25 cho video 60s). Benefit = thay đổi sau khi dùng.',
    systemPrompt:
      'Write a TikTok-native ad as a personal CONFESSION story. Hook is the admission, no ' +
      'product. Pain block widens the confession with concrete moments (no abstract feelings). ' +
      'Discovery block is the TURNING POINT — the product enters as the thing that broke the ' +
      'cycle. Benefit shows the new life. Conversational, vulnerable, voice-memo register.',
    bestFor: ['beauty', 'wellness', 'parenting', 'emotional niches'],
  },

  AUTHORITY_EXPERT: {
    id: 'AUTHORITY_EXPERT',
    group: 'lead',
    labelVi: 'Chuyên gia / Am hiểu',
    descriptionVi: 'Mở đầu bằng vai trò am hiểu — sản phẩm xuất hiện trong block kiến thức ở giữa video.',
    emoji: '🎓',
    tone: 'sky',
    blockWeights: { hook: 0.10, pain: 0.20, discovery: 0.35, benefit: 0.20, cta: 0.15 },
    hookPattern: 'Là [vai trò / nghề / người làm trong ngành nhiều năm], mình nói thẳng: [1 sự thật ít người biết về ngách].',
    hookAngleHints: [
      'vai trò = người làm nghề liên quan trực tiếp',
      'vai trò = người đã dùng lâu năm trong ngách',
      'vai trò = người trong ngành sản xuất / phân phối',
      'sự thật về sai lầm phổ biến của người mua',
      'sự thật về cách chọn đúng sản phẩm trong ngách',
      'sự thật về một chi tiết kỹ thuật ai cũng bỏ qua',
    ],
    productRevealRule:
      'Sản phẩm KHÔNG có trong hook. Pain block = sai lầm phổ biến (~10-15s). Discovery block = giải thích insider TÊN sản phẩm là cái đúng (~giây 12-20). Benefit gắn vào kiến thức đó.',
    systemPrompt:
      'Write a TikTok-native ad in AUTHORITY voice — first-person of someone with hands-on ' +
      'expertise. Hook drops one specific insider truth. Pain block = the common mistake people ' +
      'make. Discovery block = the product enters as "the one that actually does it right", ' +
      'with one believable technical detail. NO medical / clinical claims unless real.',
    bestFor: ['any niche', 'tech', 'specialty product', 'services'],
  },

  SOCIAL_PROOF: {
    id: 'SOCIAL_PROOF',
    group: 'lead',
    labelVi: 'Bằng chứng xã hội',
    descriptionVi: 'Hook bằng quy mô / dòng người mua — sản phẩm reveal sau đó với chứng cứ cụ thể.',
    emoji: '⭐',
    tone: 'pink',
    blockWeights: { hook: 0.15, pain: 0.15, discovery: 0.20, benefit: 0.35, cta: 0.15 },
    hookPattern: '[Số / dòng người / mức độ viral] đang [mua / nói về] một [loại sản phẩm] tháng này — [mình cũng thử / lý do tò mò].',
    hookAngleHints: [
      'con số người mua / đặt hàng tuần này',
      'cảnh dòng người xếp hàng / bán hết liên tục',
      'số review / số rating cao bất thường',
      'người nổi tiếng / KOL trong ngách đã review',
      'hashtag / trend viral đang nhắc',
      'tốc độ bán hết tồn kho',
    ],
    productRevealRule:
      'Hook nêu BẰNG CHỨNG quy mô nhưng CHƯA nêu tên sản phẩm cụ thể. Pain ngắn (~5s). Discovery = "sản phẩm đó là [TÊN]" (~giây 8-15). Benefit dày bằng review thật, paraphrased.',
    systemPrompt:
      'Write a TikTok-native ad leaning on SOCIAL PROOF. Hook hints at scale/trend without ' +
      'naming the product. Discovery block reveals the product. Benefit block paraphrases real ' +
      'reviewer language (no fake quotes). Use rough numbers only if believable. The voice is ' +
      'curious-friend ("I had to try it too"), not corporate.',
    bestFor: ['cosmetics', 'fashion', 'COD', 'best-seller'],
  },

  PROBLEM_SOLUTION: {
    id: 'PROBLEM_SOLUTION',
    group: 'lead',
    labelVi: 'Vấn đề → Giải pháp',
    descriptionVi: 'Hook hỏi/nêu pain cụ thể — sản phẩm xuất hiện ở khoảng giữa video như đáp án.',
    emoji: '🧩',
    tone: 'violet',
    blockWeights: { hook: 0.15, pain: 0.25, discovery: 0.20, benefit: 0.25, cta: 0.15 },
    hookPattern: 'Bị [pain rất cụ thể trong ngách] hoài thì xem cái này.',
    hookAngleHints: [
      'pain liên quan TRIỆU CHỨNG cơ thể cụ thể',
      'pain liên quan TRẢI NGHIỆM thất bại hoặc lặp lại',
      'pain liên quan THỜI ĐIỂM (sáng / tối / sau ăn / cuối tuần)',
      'pain liên quan TIỀN BẠC tốn vô ích',
      'pain liên quan QUAN HỆ / xã hội (xấu hổ, ngại)',
      'pain liên quan THỜI GIAN bị mất',
    ],
    productRevealRule:
      'Hook nêu pain, KHÔNG nêu tên sản phẩm. Pain block kể chi tiết hơn (~8-15s). Discovery block reveal sản phẩm như đáp án (~giây 12-20 cho video 60s). Benefit + CTA cụ thể.',
    systemPrompt:
      'Write a TikTok-native ad in PROBLEM-SOLUTION format. Hook calls out the pain so specific ' +
      'it feels like the algorithm read the viewer\'s mind. Pain block stays in that pain. ' +
      'Discovery block reveals the product as the unexpected fix with one concrete mechanism. ' +
      'First-person, casual spoken register. No corporate adjectives, no script-y phrasing.',
    bestFor: ['supplement', 'skincare', 'health', 'problem-aware'],
  },
}

// Display order in the picker: Group 1 (instant) first, then Group 2 (lead).
export const AD_STRUCTURE_ORDER: AdStructure[] = [
  'VISUAL_HAND',
  'RAPID_REASONS',
  'UNEXPECTED_DISCOVERY',
  'POV_FOR_YOU',
  'STORY_CONFESSION',
  'AUTHORITY_EXPERT',
  'SOCIAL_PROOF',
  'PROBLEM_SOLUTION',
]

// Quick-gen picker shows all 8 (the "old/listicle/before-after/demo/pain-hook"
// curation is retired — the new INSTANT group covers their use cases better).
export const QUICK_GEN_FRAMEWORKS: AdStructure[] = AD_STRUCTURE_ORDER

/** Per-group ordering — used by the picker to render two sections. */
export const AD_STRUCTURES_BY_GROUP: Record<AdGroup, AdStructure[]> = {
  instant: AD_STRUCTURE_ORDER.filter((id) => AD_STRUCTURES[id].group === 'instant'),
  lead:    AD_STRUCTURE_ORDER.filter((id) => AD_STRUCTURES[id].group === 'lead'),
}
