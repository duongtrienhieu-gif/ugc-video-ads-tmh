import type { ScriptPreset, ToneOption } from '../types'

// ─────────────────────────────────────────────────────────────────────────
// 10 COD HARDSELL frameworks (direct-response advertiser voice — NOT creator
// review). Voice = the ADVERTISER talking straight to the customer ("bạn"),
// never first-person "tôi/mình". Trimmed from 22 → 10 so MKT staff aren't
// paralysed by choice. Each preset's 5 fields are injected verbatim into the
// Gemini prompt — they shape hook structure, pacing, emotional angle, CTA tone
// and proof style. The overall sell-arc (vấn đề → nỗi đau → SP → lợi ích SP →
// thành phần → cơ chế → LỢI ÍCH KH → proof → CTA) lives in the SYSTEM_PROMPT.
// ─────────────────────────────────────────────────────────────────────────

const CLASSIC_PRESETS: ScriptPreset[] = [
  {
    id: 'problem-solution',
    label: 'Vấn đề → Giải pháp ⭐',
    hint: 'Bạn đang khổ vì… → đây là cách dứt điểm',
    glyph: '⚡',
    category: 'classic',
    hookFormula: 'Open by naming the customer\'s exact problem as a sharp call-out ("Bạn vẫn đang bị X mỗi ngày?") so the viewer feels seen in the first 2 seconds, then immediately promise the product ends it. Advertiser-to-customer voice — address "bạn", never "tôi/mình".',
    pacingNote: 'Fast. Problem call-out → one short pain twist → product as the fix, all inside the first 5 seconds. Short clipped sentences.',
    emotionalAngle: 'Recognition then relief — "đúng cái mình đang gặp" → "hoá ra có cách dứt điểm".',
    ctaStyle: 'Direct command to buy now — "Đặt ngay hôm nay, hết X dứt điểm."',
    proofStyle: 'One concrete result the product delivers (a number, a timeframe). State it as fact the product produces, never as a personal "tôi đã thử".',
    detailVi: {
      mechanism: 'Gọi thẳng vấn đề khách đang gặp → xoáy nỗi đau ngắn → tung sản phẩm là lời giải, tất cả trong 5 giây đầu. Giọng nhà quảng cáo nói thẳng với khách.',
      goals: ['Hook trực diện đúng nỗi đau', 'Đẩy nhanh xuống giải pháp', 'Tập trung chuyển đổi, không kể lể'],
      useCase: ['Sản phẩm giải quyết nỗi đau rõ ràng', 'Khách đã nhận ra vấn đề', 'Cold traffic 15-30 giây'],
      example: '"Đầy hơi, ợ chua sau mỗi bữa ăn? Đây là thứ giúp bạn dứt điểm chỉ sau 7 ngày."',
    },
  },
  {
    id: 'before-after',
    label: 'Trước / Sau ⭐',
    hint: 'Tình trạng này → sau X ngày thành thế này',
    glyph: '↔',
    category: 'classic',
    hookFormula: 'Open on the customer\'s "trước" state (the painful starting point) then hard-cut to the "sau" result the product delivers. Frame it as the result the CUSTOMER will get / real customers got — third-person proof, never "tôi đã từng".',
    pacingNote: 'Contrast-driven. Paint the before fast → name the turning point (the product) → land the after with one observable change and a timeframe.',
    emotionalAngle: 'Hope and proof — "nếu khách khác làm được thì mình cũng làm được".',
    ctaStyle: 'Empathetic push — "Nếu bạn đang ở giai đoạn TRƯỚC, đặt ngay để có kết quả SAU."',
    proofStyle: 'Before/after with one specific marker (số ngày, một thay đổi quan sát được). Attribute to real customers, not the narrator.',
    detailVi: {
      mechanism: 'Đặt cạnh nhau trạng thái TRƯỚC (đau) và SAU (kết quả). Bằng chứng chuyển hoá của khách → khách mới tin "mình cũng được vậy".',
      goals: ['Chứng minh kết quả qua thời gian', 'Giảm rào cản tin tưởng', 'Tạo khát khao kết quả'],
      useCase: ['Sản phẩm có chuyển hoá rõ (da, dáng, tiêu hoá)', 'Cần bằng chứng trực quan', 'Quảng cáo 30-60 giây'],
      example: '"Da sần sùi, thâm mụn chi chít — sau 14 ngày dùng đều, đây là kết quả thật của khách."',
    },
  },
  {
    id: 'consequence-warning',
    label: 'Cảnh báo hệ quả',
    hint: 'Nếu kệ vấn đề này, hậu quả là…',
    glyph: '⚠',
    category: 'classic',
    hookFormula: 'Open with a sharp warning about what happens if the customer keeps ignoring the problem ("Đừng để X kéo dài — đây là cái giá bạn sẽ trả"). Contrarian, scroll-stopping, advertiser authority.',
    pacingNote: 'Urgent and escalating. Each sentence raises the stake, then the product is positioned as the way to avoid the consequence.',
    emotionalAngle: 'Fear of inaction converted into motivation to act now.',
    ctaStyle: 'Authoritative — "Xử lý ngay trước khi quá muộn. Đặt hàng hôm nay."',
    proofStyle: 'One cause→consequence chain that makes the risk feel real, then the product as the circuit-breaker.',
    detailVi: {
      mechanism: 'Cảnh báo hệ quả nếu khách tiếp tục mặc kệ vấn đề → định vị sản phẩm là cách chặn hậu quả đó. Khai thác nỗi sợ trì hoãn.',
      goals: ['Chặn scroll bằng cảnh báo', 'Tạo cấp bách để hành động ngay', 'Định vị uy quyền cho thương hiệu'],
      useCase: ['Vấn đề sức khoẻ tích tụ theo thời gian', 'Khách hay trì hoãn', 'Advertorial gay gắt'],
      example: '"Để đầy hơi kéo dài, đường ruột bạn sẽ ngày càng yếu đi — đừng đợi đến lúc đó mới lo."',
    },
  },
  {
    id: 'comparison',
    label: 'So sánh hơn thua',
    hint: 'Sản phẩm thường vs sản phẩm này',
    glyph: '⚖',
    category: 'classic',
    hookFormula: 'Open with a direct contrast ("Sản phẩm thường chỉ làm được X — loại này làm được Y") so the customer instantly sees why this one wins.',
    pacingNote: 'Direct contrast. Generic/old option vs this product, with one clear, undeniable winning attribute.',
    emotionalAngle: 'Informed choice — the customer feels smart for picking the better one.',
    ctaStyle: 'Direct — "Chọn loại thật sự hiệu quả — đặt ngay."',
    proofStyle: 'Side-by-side on one decisive attribute (số liệu, thành phần, công nghệ) where this product clearly beats the category default.',
    detailVi: {
      mechanism: 'Đặt sản phẩm cạnh loại thường để lộ rõ điểm hơn hẳn. Khách thấy mình thông minh khi chọn loại tốt hơn.',
      goals: ['Đối đầu trực tiếp loại đang phổ biến', 'Làm nổi USP', 'Cho khách cảm giác đang nâng cấp'],
      useCase: ['Ngành đông đối thủ', 'Sản phẩm có USP rõ ràng', 'Re-targeting / mid-funnel'],
      example: '"Men thường chỉ 1 tỷ lợi khuẩn — loại này 20 tỷ, sống tới tận ruột. Khác biệt nằm ở đó."',
    },
  },
  {
    id: 'benefit-stack',
    label: 'Lợi ích dồn dập ⭐',
    hint: 'Bắn liên tiếp lợi ích khách nhận được',
    glyph: '🎯',
    category: 'classic',
    hookFormula: 'Open with the single biggest benefit the customer gets, then rapid-fire stack the rest. This is the CUSTOMER-BENEFIT framework — the most important block of all: everything is framed as what BẠN nhận được.',
    pacingNote: 'Rapid-fire. Short benefit lines back-to-back, building momentum — "hết X, được Y, thêm Z" — then snap to CTA.',
    emotionalAngle: 'Desire and value — the customer feels they get a LOT for a little.',
    ctaStyle: 'High-energy close — "Tất cả chỉ với 1 viên mỗi sáng — đặt ngay."',
    proofStyle: 'Let the stacked customer-benefits BE the proof; anchor 1-2 of them to the real ingredient/mechanism so it stays believable.',
    detailVi: {
      mechanism: 'Bắn dồn dập các lợi ích KHÁCH HÀNG nhận được — khối quan trọng nhất. Mọi thứ quy về "bạn được gì", tạo cảm giác đáng giá.',
      goals: ['Nhấn mạnh lợi ích khách (ưu tiên số 1)', 'Tạo cảm giác giá trị cao', 'Đẩy momentum tới CTA'],
      useCase: ['Sản phẩm đa lợi ích', 'Cần làm bật value cho giá', 'Mọi giai đoạn phễu'],
      example: '"Hết đầy hơi, ăn ngon miệng, bụng nhẹ tênh, da sáng hơn — chỉ với 1 viên mỗi sáng."',
    },
  },
  {
    id: 'secret-reveal',
    label: 'Bí mật / Khám phá',
    hint: 'Điều ít ai nói cho bạn về…',
    glyph: '🤫',
    category: 'classic',
    hookFormula: 'Open a curiosity loop ("Có 1 lý do khiến bạn mãi không X — và hầu như không ai nói cho bạn") then slow-reveal toward the product as the answer.',
    pacingNote: 'Conspiratorial. Build the curiosity, pause before the payoff, then resolve with the product.',
    emotionalAngle: 'Curiosity plus insider feeling — the customer feels let in on something hidden.',
    ctaStyle: 'Resolution-driven — "Giờ bạn đã biết — đặt ngay để thử."',
    proofStyle: 'Insider framing — reveal the overlooked mechanism/ingredient that explains why nothing else worked.',
    detailVi: {
      mechanism: 'Mở vòng tò mò về điều ít người biết → tiết lộ dần → sản phẩm là lời giải. Khách phải xem hết để biết "bí mật".',
      goals: ['Tăng thời gian xem nhờ tò mò', 'CTR cao nhờ yếu tố bí ẩn', 'Tiết lộ → dẫn về CTA'],
      useCase: ['Sản phẩm có cơ chế lạ ít người biết', 'Ngành cạnh tranh cao', 'Khách thích mẹo "trong cuộc"'],
      example: '"Có 1 lý do khiến bạn giảm cân mãi không xong — và hầu như không ai nói cho bạn biết."',
    },
  },
  {
    id: 'offer-closer',
    label: 'Ưu đãi sốc / Chốt nhanh',
    hint: 'Tung ưu đãi → chốt đơn gấp',
    glyph: '🔥',
    category: 'classic',
    hookFormula: 'Lead with the offer itself as the hook ("Hôm nay mua 2 tặng 1, freeship") and pair it with scarcity/urgency to trigger an immediate decision.',
    pacingNote: 'Speed-run. Minimal pain setup, maximum offer + urgency. Ideal under 15-20 seconds. No wasted words.',
    emotionalAngle: 'Urgency and FOMO — the customer feels they must act before the deal ends.',
    ctaStyle: 'Hard close — "Số lượng có hạn, chốt đơn ngay hôm nay."',
    proofStyle: 'Skip long proof — the match-to-need + the deal are the trigger. One quick credibility line max.',
    detailVi: {
      mechanism: 'Lấy ưu đãi làm hook, ghép khan hiếm/cấp bách để khách quyết ngay. Chốt đơn nhanh cho khách đã warm.',
      goals: ['CTR + chốt đơn tối đa', 'Re-target đáy phễu', 'Phản hồi trực tiếp, không vòng vo'],
      useCase: ['Flash sale / khuyến mãi gấp', 'Re-targeting khách đã tương tác', 'Đã có proof từ quảng cáo trước'],
      example: '"Hôm nay mua 2 tặng 1, freeship toàn quốc — số lượng có hạn, chốt đơn ngay kẻo lỡ."',
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────
// 3 EDUCATIONAL / MECHANISM presets — for health / skincare / supplement COD
// where conversion depends on the customer UNDERSTANDING why it works. Still
// ADVERTISER voice (selling, not lecturing) — they automatically trigger
// educationalMode behaviour in the prompt.
// ─────────────────────────────────────────────────────────────────────────

const EDUCATIONAL_PRESETS: ScriptPreset[] = [
  {
    id: 'mechanism-ingredient',
    label: 'Cơ chế & Thành phần',
    hint: 'Vì sao sản phẩm này hiệu quả thật',
    glyph: '⚙',
    category: 'educational',
    hookFormula: 'Open by promising to explain WHY this works ("Lý do thật sự sản phẩm này hiệu quả nằm ở thành phần X") then break down the key ingredient and its mechanism in plain language — to justify the purchase, not to lecture.',
    pacingNote: 'Calm explainer rhythm but still selling. Name the hero ingredient → explain how it works with a simple analogy → tie it straight to the customer benefit.',
    emotionalAngle: 'Trust through understanding — the customer buys because they finally "get" why it works.',
    ctaStyle: 'Reasoned close — "Hiểu cơ chế rồi thì đừng chần chừ — đặt ngay."',
    proofStyle: 'Plain-language mechanism with the real ingredient(s) named specifically. Use a familiar analogy. No medical jargon, no cure claims.',
    detailVi: {
      mechanism: 'Giải thích thành phần + cơ chế bằng ngôn ngữ đời thường để hợp lý hoá việc mua. Gộp Thành phần + Khoa học + Cơ chế làm một.',
      goals: ['Niềm tin nhờ hiểu rõ', 'Hợp lý hoá mức giá', 'Neo cơ chế vào lợi ích khách'],
      useCase: ['TPCN / sức khoẻ', 'Skincare có công bố thành phần', 'Đơn hàng giá cao cần niềm tin'],
      example: '"Thành phần Inulin nuôi lợi khuẩn đường ruột — đó là lý do bụng bạn hết đầy hơi từ gốc."',
    },
  },
  {
    id: 'expert-authority',
    label: 'Bác sĩ / Chuyên gia',
    hint: 'Chuyên gia khuyên dùng vì…',
    glyph: '🩺',
    category: 'educational',
    hookFormula: 'Lead with expert authority ("Chuyên gia tiêu hoá khuyên:..." / "Nghiên cứu chỉ ra rằng...") to borrow credibility, then connect that authority to why the customer needs this product.',
    pacingNote: 'Measured and credible, but still a sell. No corporate marketing, no yelling — authority that lands on a clear recommendation to buy.',
    emotionalAngle: 'Trust earned through authority and specificity.',
    ctaStyle: 'Confident recommendation — "Làm theo lời chuyên gia — đặt ngay."',
    proofStyle: 'Specific authority signal (expert role, study finding, percentage). Avoid vague "nghiên cứu cho thấy" with no specifics. No fake certifications.',
    detailVi: {
      mechanism: 'Mượn uy tín chuyên gia / nghiên cứu để tăng độ tin, rồi nối uy tín đó với lý do khách cần sản phẩm.',
      goals: ['Tăng độ tin tưởng', 'Định vị có cơ sở khoa học', 'Giảm rào cản giá cao'],
      useCase: ['Supplement / sức khoẻ', 'Skincare hoạt chất', 'Sản phẩm cần niềm tin cao'],
      example: '"Chuyên gia tiêu hoá khuyên: muốn hết đầy hơi phải bổ sung đúng chủng lợi khuẩn này."',
    },
  },
  {
    id: 'myth-bust',
    label: 'Đập tan lầm tưởng',
    hint: 'Bạn đang hiểu sai về…',
    glyph: '❌',
    category: 'educational',
    hookFormula: 'Open by smashing a common misbelief the customer holds ("Không phải cứ X là hết Y — sự thật là...") then position this product as the one that addresses the real cause.',
    pacingNote: 'Contrarian setup → clear correction → differentiate this product from the category default.',
    emotionalAngle: 'Informed superiority — the customer feels smarter than the average buyer and avoids a mistake.',
    ctaStyle: 'Smart-choice close — "Đừng mua nhầm nữa — loại đúng là đây. Đặt ngay."',
    proofStyle: 'Category vs specific product contrast — show why the generic belief fails and how this formula is different. Ground it in the real mechanism.',
    detailVi: {
      mechanism: 'Phá niềm tin sai phổ biến → định vị sản phẩm là loại xử lý đúng nguyên nhân. Khách thấy mình là "người mua hiểu biết".',
      goals: ['Khác biệt hoá rõ ràng', 'Cảm giác "mình biết hơn người khác"', 'Kích hoạt lựa chọn thông minh'],
      useCase: ['Ngành bị thương mại hoá tràn lan', 'Có USP kỹ thuật rõ', 'Khách đã ngán ngành hàng'],
      example: '"Không phải men tiêu hoá nào cũng giúp hết đầy hơi — đa số chết trước khi tới được ruột."',
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
