import type { ScriptPreset, ToneOption } from '../types'

// ─────────────────────────────────────────────────────────────────────────
// 10 COD HARDSELL frameworks (direct-response advertiser voice — NOT creator
// review). Voice = the ADVERTISER talking straight to the customer ("bạn"),
// never first-person "tôi/mình". Trimmed from 22 → 10 so MKT staff aren't
// paralysed by choice. Each preset's 5 fields are injected verbatim into the
// Gemini prompt — they shape hook structure, pacing, emotional angle, CTA tone
// and proof style. The overall sell-arc (vấn đề → nỗi đau → SP → lợi ích SP →
// thành phần → cơ chế → LỢI ÍCH KH → proof → CTA ĐA TẦNG) + the "NỔ ARSENAL"
// (nổ số / kịch tính / số đông / neo giá / khan hiếm / đòn COD) live in the
// SYSTEM_PROMPT. These preset fields are tuned MAX-NỔ to match.
// ─────────────────────────────────────────────────────────────────────────

const CLASSIC_PRESETS: ScriptPreset[] = [
  {
    id: 'problem-solution',
    label: 'Vấn đề → Giải pháp ⭐',
    hint: 'Bạn đang khổ vì… → đây là cách dứt điểm',
    glyph: '⚡',
    category: 'classic',
    hookFormula: 'Slam the customer\'s exact problem as a sharp shock call-out ("Bạn vẫn đang bị X mỗi ngày mà không biết nó đang âm thầm phá đời sống của bạn?") so they feel exposed in the first 2 seconds, then immediately hit them that the product ends it. Advertiser→customer, "bạn", never "tôi/mình".',
    pacingNote: 'Fast and hard. Shock problem call-out → one brutal pain twist → product as the fix, all inside the first 5 seconds. Short clipped sentences, no warm-up.',
    emotionalAngle: 'Exposure then relief — "trời, đúng cái mình đang bị" → "hoá ra dứt điểm được thật".',
    ctaStyle: 'Hard multi-lever close — order command + urgency + COD risk-reversal: "Đặt ngay hôm nay, nhận hàng kiểm tra tận tay rồi mới trả tiền — số lượng có hạn, hết X dứt điểm."',
    proofStyle: 'One sharp SPECIFIC result with a number/timeframe stated as what the product delivers ("hơn 8.000 người dứt điểm sau 7 ngày"), never a personal "tôi đã thử".',
    detailVi: {
      mechanism: 'Gọi thẳng vấn đề khách đang gặp như một cú sốc → xoáy nỗi đau ngắn → tung sản phẩm là lời giải, tất cả trong 5 giây đầu. Giọng nhà quảng cáo nói thẳng với khách.',
      goals: ['Hook trực diện đúng nỗi đau', 'Đẩy nhanh xuống giải pháp', 'Chốt đơn đa tầng, không kể lể'],
      useCase: ['Sản phẩm giải quyết nỗi đau rõ ràng', 'Khách đã nhận ra vấn đề', 'Cold traffic 15-30 giây'],
      example: '"Đầy hơi, ợ chua sau mỗi bữa — bạn chịu đựng nó bao lâu rồi? Hơn 8.000 người đã dứt điểm sau 7 ngày, nhận hàng kiểm tra mới trả tiền."',
    },
  },
  {
    id: 'before-after',
    label: 'Trước / Sau ⭐',
    hint: 'Tình trạng này → sau X ngày thành thế này',
    glyph: '↔',
    category: 'classic',
    hookFormula: 'Open on the customer\'s "trước" state at its ugliest (vivid, painful), then hard-cut to a dramatic "sau" result a real named customer got — third-person proof with a specific persona, never "tôi đã từng".',
    pacingNote: 'Contrast-driven and punchy. Paint the before vivid and painful → name the turning point (the product) → land the after with one observable change + a hard timeframe.',
    emotionalAngle: 'Hope through proof — "người khác bê bết hơn mình còn làm được thì mình chắc chắn được".',
    ctaStyle: 'Empathetic hard push + COD safety — "Bạn đang ở giai đoạn TRƯỚC? Đặt ngay, nhận hàng kiểm tra mới trả tiền để có kết quả SAU — deal chỉ còn hôm nay."',
    proofStyle: 'Before/after with a specific named persona (tên, tuổi, quận) + an exact marker (số ngày, thay đổi quan sát được). Attribute to real customers, dramatize the gap.',
    detailVi: {
      mechanism: 'Đặt cạnh nhau trạng thái TRƯỚC (đau, kịch tính) và SAU (kết quả). Bằng chứng chuyển hoá của khách có tên-tuổi → khách mới tin "mình cũng được vậy".',
      goals: ['Chứng minh kết quả qua thời gian', 'Giảm rào cản tin tưởng', 'Tạo khát khao kết quả'],
      useCase: ['Sản phẩm có chuyển hoá rõ (da, dáng, tiêu hoá)', 'Cần bằng chứng trực quan', 'Quảng cáo 30-60 giây'],
      example: '"Da chị Lan sần sùi, thâm mụn chi chít, đi đâu cũng cúi mặt — 14 ngày sau, đây là kết quả thật. Hơn 5.000 chị đã đổi đời cái mặt như vậy."',
    },
  },
  {
    id: 'consequence-warning',
    label: 'Cảnh báo hệ quả',
    hint: 'Nếu kệ vấn đề này, hậu quả là…',
    glyph: '⚠',
    category: 'classic',
    hookFormula: 'Open with a sharp, almost alarming warning about what happens if they keep ignoring the problem ("Cứ kệ X đi, rồi bạn sẽ trả cái giá này…"). Contrarian, fear-driven, advertiser authority.',
    pacingNote: 'Urgent and escalating — each line raises the stake higher, then the product as the only circuit-breaker.',
    emotionalAngle: 'Fear of inaction weaponized into "phải xử lý ngay hôm nay".',
    ctaStyle: 'Authoritative hard close + COD — "Đừng đợi đến lúc quá muộn. Đặt ngay, nhận hàng kiểm tra mới trả tiền — số lượng có hạn."',
    proofStyle: 'One vivid cause→consequence chain that makes the risk feel real and near, then the product (with a specific proof number) as the way out.',
    detailVi: {
      mechanism: 'Cảnh báo hệ quả nếu khách tiếp tục mặc kệ vấn đề → định vị sản phẩm là cách chặn hậu quả đó. Khai thác nỗi sợ trì hoãn, đẩy cấp bách.',
      goals: ['Chặn scroll bằng cảnh báo', 'Tạo cấp bách để hành động ngay', 'Định vị uy quyền cho thương hiệu'],
      useCase: ['Vấn đề sức khoẻ tích tụ theo thời gian', 'Khách hay trì hoãn', 'Advertorial gay gắt'],
      example: '"Để đầy hơi kéo dài, đường ruột bạn rệu rã từng ngày — đến lúc viêm loét thì hối không kịp. 9.000 người đã chặn nó ngay từ sớm."',
    },
  },
  {
    id: 'comparison',
    label: 'So sánh hơn thua',
    hint: 'Sản phẩm thường vs sản phẩm này',
    glyph: '⚖',
    category: 'classic',
    hookFormula: 'Open with a brutal direct contrast ("Loại thường vứt tiền qua cửa sổ — loại này mới làm được điều bạn cần") so the customer instantly sees why this one wins and the other is a waste.',
    pacingNote: 'Direct, confrontational contrast. Generic/old option vs this product on one undeniable winning attribute — make the loser look pathetic.',
    emotionalAngle: 'Smart-buyer superiority — "mua loại kia là phí tiền, mình khôn hơn".',
    ctaStyle: 'Direct hard close + COD — "Đừng phí tiền loại thường nữa. Đặt loại thật sự hiệu quả, nhận hàng kiểm tra mới trả tiền — hôm nay còn deal."',
    proofStyle: 'Side-by-side on one decisive attribute (số liệu, thành phần, công nghệ) where this product crushes the category default — back it with a hard number.',
    detailVi: {
      mechanism: 'Đặt sản phẩm cạnh loại thường để lộ rõ điểm hơn hẳn, dìm loại kia. Khách thấy mình thông minh khi chọn loại tốt hơn.',
      goals: ['Đối đầu trực tiếp loại đang phổ biến', 'Làm nổi USP', 'Cho khách cảm giác đang nâng cấp'],
      useCase: ['Ngành đông đối thủ', 'Sản phẩm có USP rõ ràng', 'Re-targeting / mid-funnel'],
      example: '"Men thường 1 tỷ lợi khuẩn, chết gần hết trước khi tới ruột. Loại này 20 tỷ, sống tới tận ruột — bảo sao 8.000 người bỏ loại cũ."',
    },
  },
  {
    id: 'benefit-stack',
    label: 'Lợi ích dồn dập ⭐',
    hint: 'Bắn liên tiếp lợi ích khách nhận được',
    glyph: '🎯',
    category: 'classic',
    hookFormula: 'Open with the single biggest benefit as a punchy promise, then rapid-fire stack the rest. This is the CUSTOMER-BENEFIT framework — the most important: everything is what BẠN get, hit fast and hit hard.',
    pacingNote: 'Rapid-fire machine-gun. Short benefit lines back-to-back building momentum — "hết X, được Y, thêm Z" — then snap into the loaded CTA.',
    emotionalAngle: 'Desire + value greed — "được nhiều như vậy mà chừng đó tiền, dại gì không mua".',
    ctaStyle: 'High-energy hard close + value + COD — "Tất cả chỉ với 1 viên mỗi sáng, rẻ hơn ly cà phê — đặt ngay, kiểm tra hàng mới trả tiền."',
    proofStyle: 'Let the stacked customer-benefits BE the proof; anchor 1-2 of them to the real ingredient/mechanism + one volume number so it stays believable.',
    detailVi: {
      mechanism: 'Bắn dồn dập các lợi ích KHÁCH HÀNG nhận được — khối quan trọng nhất. Mọi thứ quy về "bạn được gì", tạo cảm giác đáng giá.',
      goals: ['Nhấn mạnh lợi ích khách (ưu tiên số 1)', 'Tạo cảm giác giá trị cao', 'Đẩy momentum tới CTA'],
      useCase: ['Sản phẩm đa lợi ích', 'Cần làm bật value cho giá', 'Mọi giai đoạn phễu'],
      example: '"Hết đầy hơi, ăn ngon miệng, bụng nhẹ tênh, da sáng hơn — 1 viên mỗi sáng, rẻ hơn ly trà sữa. 10.000 người đang dùng mỗi ngày."',
    },
  },
  {
    id: 'secret-reveal',
    label: 'Bí mật / Khám phá',
    hint: 'Điều ít ai nói cho bạn về…',
    glyph: '🤫',
    category: 'classic',
    hookFormula: 'Open a tight curiosity loop ("Có 1 lý do khiến bạn mãi không X — và mấy chỗ bán giấu kỹ vì sợ mất khách") then slow-reveal toward the product as the answer they were never told.',
    pacingNote: 'Conspiratorial and baiting. Build the curiosity, pause before the payoff, then resolve with the product as the hidden key.',
    emotionalAngle: 'Curiosity plus insider feeling — "mình vừa biết thứ người khác không biết".',
    ctaStyle: 'Resolution + urgency + COD — "Giờ bạn đã biết bí mật — đặt ngay thử đi, nhận hàng kiểm tra mới trả tiền, deal này không kéo dài."',
    proofStyle: 'Insider framing — reveal the overlooked mechanism/ingredient that explains why nothing else worked, then a number to seal it.',
    detailVi: {
      mechanism: 'Mở vòng tò mò về điều ít người biết → tiết lộ dần → sản phẩm là lời giải. Khách phải xem hết để biết "bí mật".',
      goals: ['Tăng thời gian xem nhờ tò mò', 'CTR cao nhờ yếu tố bí ẩn', 'Tiết lộ → dẫn về CTA'],
      useCase: ['Sản phẩm có cơ chế lạ ít người biết', 'Ngành cạnh tranh cao', 'Khách thích mẹo "trong cuộc"'],
      example: '"Có 1 lý do bạn giảm cân mãi không xong — và mấy chỗ bán giấu kỹ vì sợ mất khách. 7.000 người biết ra là sút liền."',
    },
  },
  {
    id: 'offer-closer',
    label: 'Ưu đãi sốc / Chốt nhanh',
    hint: 'Tung ưu đãi → chốt đơn gấp',
    glyph: '🔥',
    category: 'classic',
    hookFormula: 'Lead with the offer itself as the hook ("Hôm nay mua 2 tặng 1, freeship, giá gạch còn một nửa") slammed together with scarcity so they decide in the first 3 seconds.',
    pacingNote: 'Speed-run. Minimal pain setup, maximum offer + anchoring + urgency. Ideal under 15-20 seconds. No wasted words.',
    emotionalAngle: 'FOMO + greed — "không chốt giờ là mất deal, tiếc đứt ruột".',
    ctaStyle: 'Hard close, everything stacked — "Giá gạch còn nửa, mua 2 tặng 1, số lượng có hạn — nhận hàng kiểm tra mới trả tiền, chốt ngay kẻo hết."',
    proofStyle: 'Skip long proof — the match-to-need + the stacked deal + one volume line ("cháy hàng 3 lần rồi") are the trigger.',
    detailVi: {
      mechanism: 'Lấy ưu đãi làm hook, ghép neo giá + khan hiếm để khách quyết ngay. Chốt đơn nhanh cho khách đã warm.',
      goals: ['CTR + chốt đơn tối đa', 'Re-target đáy phễu', 'Phản hồi trực tiếp, không vòng vo'],
      useCase: ['Flash sale / khuyến mãi gấp', 'Re-targeting khách đã tương tác', 'Đã có proof từ quảng cáo trước'],
      example: '"Hôm nay mua 2 tặng 1, freeship, giá gạch còn một nửa — cháy hàng 3 lần rồi, nhận hàng kiểm tra mới trả tiền. Chốt ngay kẻo lỡ."',
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 3 EDUCATIONAL / MECHANISM presets — for health / skincare / supplement COD
// where conversion depends on the customer UNDERSTANDING why it works. Still
// ADVERTISER voice (selling, not lecturing) — they automatically trigger
// educationalMode behaviour in the prompt. Sell symptom relief + results, never
// disease-cure / guarantee claims, never fake certs.
// ─────────────────────────────────────────────────────────────────────────

const EDUCATIONAL_PRESETS: ScriptPreset[] = [
  {
    id: 'mechanism-ingredient',
    label: 'Cơ chế & Thành phần',
    hint: 'Vì sao sản phẩm này hiệu quả thật',
    glyph: '⚙',
    category: 'educational',
    hookFormula: 'Open by promising to expose WHY this actually works ("Lý do thật loại này hiệu quả nằm ở thành phần X mà 90% người mua không để ý") then break down the hero ingredient + mechanism in plain language — to justify the buy, not lecture.',
    pacingNote: 'Calm explainer rhythm but still selling hard. Name the hero ingredient → explain how it works with a vivid simple analogy → slam it straight into the customer benefit.',
    emotionalAngle: 'Trust through "à há" understanding — "giờ mới hiểu vì sao mấy loại kia vô dụng".',
    ctaStyle: 'Reasoned hard close + COD — "Hiểu cơ chế rồi thì còn chần chừ gì — đặt ngay, nhận hàng kiểm tra mới trả tiền, giá ưu đãi còn hôm nay."',
    proofStyle: 'Plain-language mechanism with the real ingredient(s) named specifically + one specific number. Use a familiar analogy. No medical jargon, no disease-cure claims.',
    detailVi: {
      mechanism: 'Giải thích thành phần + cơ chế bằng ngôn ngữ đời thường để hợp lý hoá việc mua. Gộp Thành phần + Khoa học + Cơ chế làm một.',
      goals: ['Niềm tin nhờ hiểu rõ', 'Hợp lý hoá mức giá', 'Neo cơ chế vào lợi ích khách'],
      useCase: ['TPCN / sức khoẻ', 'Skincare có công bố thành phần', 'Đơn hàng giá cao cần niềm tin'],
      example: '"Inulin nuôi lợi khuẩn như tưới nước cho cây — đó là lý do 9.000 người hết đầy hơi từ gốc chứ không phải đỡ tạm."',
    },
  },
  {
    id: 'expert-authority',
    label: 'Bác sĩ / Chuyên gia',
    hint: 'Chuyên gia khuyên dùng vì…',
    glyph: '🩺',
    category: 'educational',
    hookFormula: 'Lead with hard expert authority ("Chuyên gia tiêu hoá nói thẳng:…" / "Nghiên cứu trên X người chỉ ra…") to borrow credibility, then nail it to why the customer needs this now.',
    pacingNote: 'Measured and credible, but still a sell. No corporate fluff, no yelling — authority that lands on a clear, confident command to buy.',
    emotionalAngle: 'Trust through authority + specificity — "chuyên gia đã nói thì khỏi cãi".',
    ctaStyle: 'Confident recommendation + COD — "Làm theo lời chuyên gia — đặt ngay, nhận hàng kiểm tra mới trả tiền, đừng để cơ thể đợi thêm."',
    proofStyle: 'Specific authority signal (expert role, study finding, percentage) + a volume number. Avoid vague "nghiên cứu cho thấy" with no specifics. No fake certifications, no disease-cure claims.',
    detailVi: {
      mechanism: 'Mượn uy tín chuyên gia / nghiên cứu để tăng độ tin, rồi nối uy tín đó với lý do khách cần sản phẩm.',
      goals: ['Tăng độ tin tưởng', 'Định vị có cơ sở khoa học', 'Giảm rào cản giá cao'],
      useCase: ['Supplement / sức khoẻ', 'Skincare hoạt chất', 'Sản phẩm cần niềm tin cao'],
      example: '"Chuyên gia tiêu hoá nói thẳng: muốn hết đầy hơi phải đúng chủng lợi khuẩn này — 8.000 người làm theo đã thấy khác sau 1 tuần."',
    },
  },
  {
    id: 'myth-bust',
    label: 'Đập tan lầm tưởng',
    hint: 'Bạn đang hiểu sai về…',
    glyph: '❌',
    category: 'educational',
    hookFormula: 'Open by smashing a belief the customer holds ("Không phải cứ X là hết Y — bạn bị lừa bao lâu rồi?") then position this product as the only one hitting the real cause.',
    pacingNote: 'Contrarian punch → sharp correction → differentiate this product from the worthless category default.',
    emotionalAngle: 'Informed superiority + mild anger — "hoá ra mình bị lừa, lần này mua đúng".',
    ctaStyle: 'Smart-choice hard close + COD — "Đừng mua nhầm nữa — loại đúng là đây. Đặt ngay, nhận hàng kiểm tra mới trả tiền."',
    proofStyle: 'Category vs specific product contrast — why the generic belief fails, how this formula is different, grounded in the real mechanism + a number. No disease-cure claims.',
    detailVi: {
      mechanism: 'Phá niềm tin sai phổ biến → định vị sản phẩm là loại xử lý đúng nguyên nhân. Khách thấy mình là "người mua hiểu biết".',
      goals: ['Khác biệt hoá rõ ràng', 'Cảm giác "mình biết hơn người khác"', 'Kích hoạt lựa chọn thông minh'],
      useCase: ['Ngành bị thương mại hoá tràn lan', 'Có USP kỹ thuật rõ', 'Khách đã ngán ngành hàng'],
      example: '"Không phải men nào cũng hết đầy hơi — đa số chết trước khi tới ruột. Đó là lý do bạn uống mãi không đỡ, và vì sao 8.000 người đổi sang loại này."',
    },
  },
]

export const SCRIPT_PRESETS: ScriptPreset[] = [...CLASSIC_PRESETS, ...EDUCATIONAL_PRESETS]

export function getPresetById(id: string): ScriptPreset | undefined {
  return SCRIPT_PRESETS.find((p) => p.id === id)
}

// ── Tone modifier chips ─────────────────────────────────────────────────

export const TONE_OPTIONS: ToneOption[] = [
  { id: 'hard-sell',         label: 'Hard sell',          promptHint: 'aggressive sales energy with urgency and direct asks' },
  { id: 'soft-sell',         label: 'Soft sell',          promptHint: 'lower-pressure advertiser tone — confident but not shouty' },
  { id: 'emotional',         label: 'Cảm xúc',            promptHint: 'lean into the customer\'s emotional pain and the relief of solving it' },
  { id: 'scientific',        label: 'Khoa học',           promptHint: 'cite mechanism and ingredients with plain-language science' },
  { id: 'funny',             label: 'Hài hước',           promptHint: 'light humour in the hook — never cringe, never undercut the sell' },
  { id: 'luxury',            label: 'Sang trọng',         promptHint: 'premium aspirational tone, refined word choice, calm pacing' },
  { id: 'aggressive-hook',   label: 'Hook gắt',           promptHint: 'sharper, more provocative hook that interrupts the scroll' },
  { id: 'female-audience',   label: 'Nữ',                 promptHint: 'addressing a female customer — pain points and language framed for her' },
  { id: 'male-audience',     label: 'Nam',                promptHint: 'addressing a male customer — direct, no-fluff, results-focused' },
  { id: 'older-audience',    label: 'Trung niên',         promptHint: 'older customer (35+) — slower pacing, trust signals, less slang' },
  { id: 'young-tiktok',      label: 'Gen Z TikTok',       promptHint: 'Gen Z TikTok voice — fast cuts, slang, native rhythm' },
]
