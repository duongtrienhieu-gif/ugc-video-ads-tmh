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
  /** SHAPE of the hook (not a literal template). Describes the 2-3 elements every
   *  hook for this framework must contain — but the WORDS, sentence structure,
   *  rhythm, opening, and closing phrase vary every hook. The hook prompt enforces
   *  this shape alongside `hookExamples` + the anti-repetition rule. */
  hookShape: string
  /** 3 reference examples — DIFFERENT sentence structures, different openings,
   *  different products / niches — so Gemini learns "shape-bound + word-free"
   *  instead of mass-producing 6 copies of one template. */
  hookExamples: string[]
  /** 6 distinct ANGLES the 6 generated hooks should each take, so they aren't
   *  paraphrases of the same line. Each entry is one short directive. */
  hookAngleHints: string[]
  /** When the product is allowed on screen / in the script — drives both the
   *  body prompt and the director downstream. Plain rule, plain English. */
  productRevealRule: string
  /** Per-block guides — exactly WHAT each non-hook block should do in this
   *  framework. Injected into the body prompt so the schema's generic "pain block"
   *  doesn't make Gemini fall back to a default pain-question opening. */
  blockGuides: { pain: string; discovery: string; benefit: string; cta: string }
  /** Phrases / openings BANNED from the body in this framework. Prevents the
   *  trained-in "Bạn có hay…?" pain-question opening that drifts an INSTANT
   *  framework into a Problem-Solution shape. */
  bodyAntiPatterns: string[]
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
    hookShape:
      'Hook gồm 2 nhịp: (1) sản phẩm xuất hiện rõ — tay cầm/khoe/mở/bẻ/cắn/xịt + nêu tên ' +
      'sản phẩm trong câu, (2) một chi tiết bất ngờ ngay tại khoảnh khắc đó (cảm giác cầm / ' +
      'con số / thành phần thấy được / mùi / giá). Hai nhịp có thể đảo thứ tự.',
    hookExamples: [
      'Mình vừa mở gói Bánh Bijan Fig Walnut — sung với óc chó nhiều hơn cả phần bánh á.',
      'Cầm thử cây son Romand mới xong, nhẹ tênh mà gắn tag giá có 99k thôi đó.',
      'Đây nè — túi trà Lipton Cold Brew, một viên pha được nguyên bình to luôn.',
    ],
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
    blockGuides: {
      pain:
        'CHỈ 1 câu TRANSITION nối tiếp từ hook — mở rộng chính cái cảm giác/chi tiết của khoảnh khắc ' +
        'cầm (vd "cắn thử cái mới biết..." / "vừa mở ra đã thấy..."). KHÔNG đặt câu hỏi pain, ' +
        'KHÔNG kể triệu chứng, KHÔNG bắt đầu bằng "Bạn có...". Phải dùng ít nhất 1 từ chính từ hook.',
      discovery:
        'Tả tiếp về sản phẩm — thành phần / cấu tạo / cách dùng cụ thể. Sản phẩm vẫn trong khung tay. ' +
        'Lồng 1 cảm nhận sensory thật (vị / kết cấu / mùi / cảm giác trên da / cảm giác cầm).',
      benefit:
        'Kết quả sau khi dùng + LẶP LẠI khoảnh khắc/cảm giác từ hook ở trạng thái mới ' +
        '(empathy echo). Người xem cần thấy vòng cảm xúc khép lại.',
      cta:
        'Mời mua + offer ngắn. 1-2 câu, không lan man.',
    },
    bodyAntiPatterns: [
      'Bạn có hay', 'Bạn đã bao giờ', 'Có khi nào bạn', 'Dạo này bạn có',
      'Tôi từng nghĩ', 'Trước đây tôi', 'Bạn có biết',
    ],
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
    hookShape:
      'Hook gồm 2 yếu tố: (1) cụm "N lý do" (N = 2/3/5 tuỳ), (2) gắn vào hành động mua/chọn + ' +
      'tên sản phẩm. Có thể thêm 1 hint cuối nhưng KHÔNG bắt buộc, KHÔNG lặp đúng cụm hint giữa ' +
      'các hook. Tránh cụm đóng câu "lý do thứ 3 mới khủng" lặp đi lặp lại.',
    hookExamples: [
      '3 lý do mình nghiện trà ô long Phúc Long tuần này, ai uống cũng hiểu.',
      'Có 2 lý do thôi mà khiến mình bỏ hẳn skincare cũ — kem dưỡng Skin1004 đây.',
      'Mua đúng 4 hộp Sữa Hạt TH một lượt, kể bạn nghe sao luôn.',
    ],
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
    blockGuides: {
      pain:
        'CHỈ 1 câu TRANSITION mở danh sách — kiểu "Đầu tiên..." / "Lý do số 1..." / "Cái khiến ' +
        'mình mua đầu tiên..." / "Bắt đầu từ...". KHÔNG câu hỏi pain, KHÔNG kể nỗi khổ, ' +
        'KHÔNG bắt đầu bằng "Bạn có...". Phải nối tiếp ý từ hook.',
      discovery:
        'ĐÚNG N lý do, mỗi lý do 1 câu ngắn. Mỗi câu nêu 1 đặc tính CỤ THỂ của sản phẩm ' +
        '(thành phần / spec / cảm giác / kết quả). Lồng tối thiểu 1 sensory beat (vị / kết cấu / mùi / cảm giác).',
      benefit:
        '1-2 câu tóm tổng tác động — sau khi liệt N lý do, vì sao đáng mua. ' +
        'LẶP LẠI 1 từ chính từ hook (empathy echo nhẹ).',
      cta:
        'Mời mua + offer, ngắn gọn.',
    },
    bodyAntiPatterns: [
      'Bạn có hay', 'Có ai như mình', 'Đã bao giờ bạn', 'Tôi từng',
      'Trước đây tôi nghĩ', 'Bạn có biết', 'Có khi nào',
    ],
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
    hookShape:
      'Hook chứa nghịch lý: kỳ vọng phổ biến X vs thực tế Y bất ngờ về sản phẩm. Cách nối ' +
      'X-Y KHÔNG cố định ("tưởng X mà Y" / "cứ nghĩ X đâu ngờ Y" / "X rồi đó mà Y luôn" / ' +
      '"tin X mà Y"). Phải nêu tên sản phẩm trong hook.',
    hookExamples: [
      'Mình cứ nghĩ kem chống nắng nội địa Hàn không lên top, đâu ngờ Centellian24 vượt mặt Anessa.',
      'Tưởng Bánh Lú phải đắng vì 100% sô-cô-la, ai dè ngọt thanh tự nhiên luôn.',
      'Máy ép Hurom 7 triệu mà chạy ra nước cốt nhiều hơn cả máy 20 triệu, bất ngờ thật.',
    ],
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
    blockGuides: {
      pain:
        'CHỈ 1 câu TRANSITION lý giải cái bất ngờ — kiểu "Hoá ra..." / "Sao mà..." / ' +
        '"Lý do là vì...". KHÔNG xây pain, KHÔNG đặt câu hỏi pain, KHÔNG bắt đầu bằng "Bạn có...". ' +
        'Phải nối từ cụm Y bất ngờ trong hook.',
      discovery:
        'Giải thích CỤ THỂ tại sao bất ngờ thật — cơ chế / thành phần / spec chứng minh được. ' +
        'Lồng 1 sensory beat (cảm giác/vị/mùi) làm cái bất ngờ "feel" sống động.',
      benefit:
        'Kết quả khi dùng, ngắn gọn. LẶP LẠI cảm giác "đáng bất ngờ" theo cách mới.',
      cta:
        'Mời mua + offer, ngắn gọn.',
    },
    bodyAntiPatterns: [
      'Bạn có hay', 'Bạn có nhớ', 'Có khi nào', 'Tôi từng',
      'Bạn đã bao giờ', 'Có ai như mình',
    ],
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
    hookShape:
      'Hook định danh persona/pain cụ thể của người xem + nối tới sản phẩm. Cách nối KHÔNG cố ' +
      'định và CẤM lặp đúng cụm đóng câu "là dành cho bạn" giữa các hook. Có thể dùng nhiều dạng: ' +
      '"Mẹ bỉm/Dân X mà chưa biết [TÊN] thì..." / "[Persona] á? [TÊN] đây này." / "Ai mà [pain], ' +
      'thử [TÊN] đi" / "Đứa nào [hành động/tình huống], cái [TÊN] này...". Mỗi hook DÙNG MỘT CÁCH ' +
      'NỐI KHÁC NHAU.',
    hookExamples: [
      'Mẹ bỉm nào hay quên uống nước á, cái bình Stanley này là cứu tinh luôn.',
      'Dân văn phòng 3 giờ chiều mỏi mắt, thử nước mắt nhân tạo Refresh đi, khác hẳn.',
      'Ai mà lười skincare như mình, cái kem Cetaphil All-in-one này vỗ 2 cái là xong.',
    ],
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
    blockGuides: {
      pain:
        'CHỈ 1 câu mở rộng PERSONA từ hook — thêm 1 KHOẢNH KHẮC ĐỜI THƯỜNG RẤT CỤ THỂ ' +
        '(giờ giấc / chỗ ngồi / hành động / câu nội tâm) mà persona đó trải qua. ' +
        'KHÔNG kể nhiều triệu chứng, KHÔNG đặt câu hỏi pain, KHÔNG bắt đầu bằng "Bạn có...".',
      discovery:
        'Tả sản phẩm + 1-2 đặc tính trực tiếp ĐÁP cái persona/pain trong hook. ' +
        'Lồng 1 sensory beat (cảm giác cụ thể khi dùng).',
      benefit:
        'Kết quả persona đó nhận được + LẶP LẠI khoảnh khắc đời thường trong block pain ' +
        '(giờ đã đổi sau khi dùng — empathy echo).',
      cta:
        'Mời mua nhẹ nhàng, đúng tone "dành cho bạn".',
    },
    bodyAntiPatterns: [
      'Bạn có hay', 'Bạn có biết', 'Có ai như mình', 'Tôi từng nghĩ',
      'Bạn đã bao giờ', 'Có khi nào',
    ],
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
    hookShape:
      'Hook là 1 lời thú nhận cá nhân về sai lầm / nỗi khổ trong ngách — CHƯA nêu tên sản phẩm. ' +
      'Kết hook gợi mở (dấu "..." / "cho đến khi…" / "rồi mới biết..."). Tone vulnerable, ' +
      'không bi kịch hoá.',
    hookExamples: [
      'Mình giấu chuyện rụng tóc cả 2 năm trời, ai hỏi cũng chối — cho đến tháng trước.',
      'Tốn gần 8 triệu mua đủ loại serum, mà da vẫn xỉn — bỏ cuộc luôn rồi á.',
      'Cứ nghĩ tự uống nước cam là đủ vitamin C, ai dè bác sĩ phán câu xanh mặt.',
    ],
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
    blockGuides: {
      pain:
        'Mở rộng câu chuyện thú nhận — thêm chi tiết CỤ THỂ (giờ giấc, hành động, ' +
        'cảm xúc nội tâm, người xung quanh nói gì). Tone đời sống thật, không khoa trương. ' +
        'Đây là phần dài nhất, để người xem đồng cảm.',
      discovery:
        'KHOẢNH KHẮC tìm ra sản phẩm — kiểu "tình cờ thấy review" / "bạn cho thử" / ' +
        '"mua đại". Nêu TÊN sản phẩm + 1 đặc tính/thành phần. Lồng 1 sensory beat khi thử lần đầu.',
      benefit:
        'Thay đổi sau khi dùng + LẶP LẠI khoảnh khắc đã thú nhận trong hook ' +
        '(giờ với cảm giác mới — empathy echo).',
      cta:
        'Mời thử, nhẹ nhàng. Không bán cứng.',
    },
    bodyAntiPatterns: [
      '3 lý do', 'Nếu bạn', 'Cái này mình đang cầm', 'Tưởng X mà',
      '30k đơn', 'Là chuyên gia',
    ],
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
    hookShape:
      'Hook gồm 2 phần: (1) vai trò am hiểu cụ thể (nghề / số năm dùng / insider), ' +
      '(2) 1 sự thật ít người biết về ngách. CHƯA nêu sản phẩm. Tone tự tin nhưng không khoe.',
    hookExamples: [
      'Là bartender 8 năm, mình nói thật — 90% chai cocktail premix bán shopee là pha loãng.',
      'Làm beauty consultant ở Seoul 3 năm, kem chống nắng nội địa Hàn đáng tiền tôi đếm trên đầu ngón tay.',
      'Bố là đầu bếp lâu năm bảo: nồi áp suất không phải cứ đắt là tốt, có 1 chi tiết ai cũng bỏ qua.',
    ],
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
    blockGuides: {
      pain:
        'Mở rộng cái sai lầm phổ biến trong ngách — kiểu "Nhiều người mua nhầm vì X" / ' +
        '"Đa phần chọn theo Y, mà thực ra...". Có thể dài, vì đây là pain insider.',
      discovery:
        'Sản phẩm xuất hiện như "cái đúng" — nêu TÊN + 1 detail kỹ thuật cụ thể (cơ chế / spec / ' +
        'thành phần) đáp pain trên. Lồng 1 sensory beat thật (vd cảm giác khi dùng / mùi / âm thanh).',
      benefit:
        'Kết quả khi chọn đúng + reiterate insider tone. LẶP LẠI nét "tự tin" từ hook.',
      cta:
        'Mời mua, tự tin, dứt khoát.',
    },
    bodyAntiPatterns: [
      'Mẹ bỉm', '3 lý do', 'Nếu bạn', 'Cái này mình đang cầm',
      'Tưởng X mà', '30k đơn', 'Mình giấu',
    ],
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
    hookShape:
      'Hook nêu QUY MÔ / TRENDS quanh 1 LOẠI sản phẩm — CHƯA nêu tên cụ thể. Có thể là số ' +
      'người mua / dòng người xếp hàng / số review / KOL nhắc / hashtag / tốc độ cháy hàng.',
    hookExamples: [
      '30k đơn trong tuần, tự nhiên cái máy nén bụi mini bùng lên TikTok luôn.',
      'Đi đâu cũng thấy mấy bạn beauty review xài chung 1 loại serum Hàn — tò mò ghê.',
      'Bán hết sạch 3 lần liên tiếp trong 1 tháng, anh chị review xếp hàng hỏi cái khẩu trang gì vậy.',
    ],
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
    blockGuides: {
      pain:
        'NGẮN (~1 câu) — 1 câu băn khoăn "sao trend dữ vậy" hoặc "mình cũng hơi nghi". ' +
        'KHÔNG xây pain mạnh, KHÔNG đặt câu hỏi pain về triệu chứng.',
      discovery:
        'REVEAL TÊN cụ thể: "Hoá ra là..." / "Là [TÊN] đó luôn". Nêu 1 đặc tính giải thích vì ' +
        'sao viral (USP / cảm giác khi dùng).',
      benefit:
        'Paraphrase 2-3 review thật (KHÔNG quote giả). 1 câu nói cảm nhận của reviewer + ' +
        '1 sensory beat thật. LẶP LẠI cái "mình cũng tò mò thử" từ hook.',
      cta:
        'Mời mua + "mình cũng đặt rồi" / "kẻo lại hết hàng".',
    },
    bodyAntiPatterns: [
      'Là bartender', '3 lý do', 'Cái này mình đang cầm', 'Nếu bạn',
      'Mình giấu', 'Tưởng X mà',
    ],
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
    hookShape:
      'Hook nêu PAIN rất cụ thể. Có thể dạng câu hỏi ("Tóc rụng cả nắm mỗi sáng gội mà chưa biết do đâu?"), ' +
      'kể chuyện ("3 giờ chiều ngồi máy tính, đầu nặng trĩu..."), hoặc statement ("Mua đồ ăn ' +
      'cho con mà cứ phải đọc nhãn 30 phút"). CHƯA nêu sản phẩm.',
    hookExamples: [
      'Tóc rụng cả nắm mỗi sáng gội mà chưa biết do đâu? Đọc tới hết rồi mới biết á.',
      '3 giờ chiều ngồi máy tính, đầu nặng trĩu, mắt như mọng nước — cái này mình từng bị 4 tháng.',
      'Mua đồ ăn cho con mà cứ phải đọc nhãn 30 phút? Mình tổng kết 1 nguyên tắc thôi.',
    ],
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
    blockGuides: {
      pain:
        'Kể chi tiết hơn pain trong hook — thêm KHOẢNH KHẮC ĐỜI THƯỜNG CỤ THỂ ' +
        '(giờ giấc / cảm giác cơ thể / hành động / câu nội tâm). Mở rộng cái đau, lý do ' +
        'phải tìm giải pháp. Có thể dài, đây là điểm chạm chính của framework này.',
      discovery:
        'Sản phẩm xuất hiện như đáp án — nêu TÊN + cơ chế CỤ THỂ giải quyết pain trên. ' +
        'Lồng 1 sensory beat thật (cảm giác đầu tiên khi dùng).',
      benefit:
        'Kết quả sau dùng + LẶP LẠI khoảnh khắc pain trong hook ' +
        '(giờ đã đổi sau khi dùng — empathy echo).',
      cta:
        'Mời mua + offer cụ thể.',
    },
    bodyAntiPatterns: [
      'Là bartender', '3 lý do', 'Cái này mình đang cầm', '30k đơn trong tuần',
      'Mẹ bỉm', 'Tưởng X mà',
    ],
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
