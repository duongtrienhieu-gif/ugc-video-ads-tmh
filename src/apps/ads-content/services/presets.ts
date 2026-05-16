import type {
  AdsContentPreset, PlatformOption, LengthOption, ToneOption,
} from '../types'

// ──────────────────────────────────────────────────────────────────────
// 27 ads-content presets organised by category. Each preset's `briefEn`
// is injected into the Gemini prompt — that's what makes the copy shape
// shift, not just the wording. detailVi powers the hover tooltip.
// ──────────────────────────────────────────────────────────────────────

export const ADS_PRESETS: AdsContentPreset[] = [
  // ── HOOK / ATTENTION ────────────────────────────────────────────────
  {
    id: 'viral-hook', label: 'Viral Hook', hint: 'Mở đầu giật scroll',
    glyph: '🔥', category: 'hook',
    briefEn: 'Open with a scroll-stopping, polarizing or hyper-curious line in the FIRST sentence. The opener earns the rest.',
    detailVi: {
      mechanism: 'Câu mở đầu thiết kế chỉ để chặn scroll trên feed dày đặc. Đầu tư hết energy vào dòng 1.',
      goals: ['Stop the scroll trong 1s', 'Trigger curiosity ngay', 'Earn line-2 attention'],
      useCase: ['Cold traffic', 'Niche cạnh tranh cao', 'Brand mới cần break-in'],
      example: '"Mình không tin nổi đây là sản phẩm chỉ 199k…"',
    },
  },
  {
    id: 'curiosity-hook', label: 'Curiosity Hook', hint: 'Mở loop tò mò',
    glyph: '🧠', category: 'hook',
    briefEn: 'Open a tight curiosity loop — promise a payoff, hint at the why, but only resolve it later in the body.',
    detailVi: {
      mechanism: 'Mở curiosity loop ("Có 1 điều rất ít người để ý…"). Khán giả phải đọc hết để biết.',
      goals: ['Tăng read-through rate', 'Tăng time-on-post', 'Mời CTA cuối'],
      useCase: ['Sản phẩm có mechanism độc đáo', 'Educational content', 'Long-form post'],
      example: '"Có 1 lý do bạn vẫn bị đầy hơi dù đã thử đủ loại men vi sinh…"',
    },
  },
  {
    id: 'pattern-interrupt', label: 'Nobody Told Me', hint: 'Không ai nói cho bạn…',
    glyph: '🤫', category: 'hook',
    briefEn: 'Insider-secret framing — "Nobody told me this…" / "I only found out by accident…". Reveal feels earned.',
    detailVi: {
      mechanism: 'Framing insider-secret — khán giả cảm thấy mình "trong cuộc".',
      goals: ['Tăng cảm giác value', 'Trust qua insider tone', 'Reveal-driven retention'],
      useCase: ['Ingredient không phổ biến', 'Mechanism ít người biết', 'Audience thích insider tips'],
      example: '"Không ai nói cho mình điều này về men vi sinh — cho đến khi mình bị đầy hơi 1 tháng."',
    },
  },
  {
    id: 'three-mistakes', label: '3 Mistakes', hint: '3 sai lầm mọi người mắc',
    glyph: '❌', category: 'hook',
    briefEn: 'Listicle hook — "3 mistakes most people make about X". Numbered list scaffolds the body.',
    detailVi: {
      mechanism: 'Listicle hook — 3 sai lầm mọi người mắc. Format dễ đọc, dễ scan.',
      goals: ['High readability', 'Educational tone', 'Set up sản phẩm là solution'],
      useCase: ['Niche có nhiều myth', 'Audience research kỹ', 'Mid-funnel awareness'],
      example: '"3 sai lầm hầu hết mọi người mắc khi chọn men vi sinh — bạn có đang mắc cái nào không?"',
    },
  },

  // ── STORY / EXPERIENCE ──────────────────────────────────────────────
  {
    id: 'storytelling', label: 'Storytelling', hint: 'Kể chuyện cảm xúc',
    glyph: '📖', category: 'story',
    briefEn: 'Long-form narrative arc — set the scene, build the struggle, deliver the turning point, land the result.',
    detailVi: {
      mechanism: 'Narrative arc: bối cảnh → struggle → turning point → kết quả. Cảm xúc dẫn dắt.',
      goals: ['Deep emotional engagement', 'Long retention', 'Brand love'],
      useCase: ['Sản phẩm liên quan tự tin / hạnh phúc', 'Female audience 25-45', 'Long-form post'],
      example: '"Năm 2023 mình gần như không ra khỏi nhà vì da mặt…"',
    },
  },
  {
    id: 'almost-gave-up', label: 'I Almost Gave Up', hint: 'Tôi gần như đã bỏ cuộc',
    glyph: '😩', category: 'story',
    briefEn: 'Rock-bottom story — narrator was about to give up, then discovered the product. Emotional rescue arc.',
    detailVi: {
      mechanism: 'Rock-bottom story — nhân vật gần bỏ cuộc thì gặp sản phẩm. Cảm xúc rescue cao.',
      goals: ['Maximum empathy', 'Hope signal', 'Trigger try-it impulse'],
      useCase: ['Audience đã thử nhiều thứ thất bại', 'Sản phẩm AOV cao cần emotional push', 'Storytelling-heavy niche'],
      example: '"Mình suýt nữa thì bỏ luôn ý định chữa đầy hơi — thì 1 đứa bạn gửi cho cái này…"',
    },
  },
  {
    id: 'pov-experience', label: 'POV Experience', hint: 'Góc nhìn người dùng',
    glyph: '🎥', category: 'story',
    briefEn: 'First-person POV moment — describe what it feels like to be using the product right now.',
    detailVi: {
      mechanism: 'Góc nhìn POV người dùng — "Đây là cảm giác lần đầu mình dùng…". Immersive, sensorial.',
      goals: ['Visual imagination', 'Trigger trial desire', 'Native TikTok feel'],
      useCase: ['Sản phẩm có trải nghiệm rõ (texture, scent, taste)', 'Beauty / wellness', 'Gen Z audience'],
      example: '"POV: lần đầu bạn cảm nhận bụng nhẹ tênh sau 3 ngày dùng men vi sinh này…"',
    },
  },
  {
    id: 'emotional-pain', label: 'Emotional Pain', hint: 'Đau cảm xúc sâu',
    glyph: '😫', category: 'story',
    briefEn: 'Open with the deepest emotional pain point — not just symptom but identity-level frustration.',
    detailVi: {
      mechanism: 'Mở bằng pain sâu — không chỉ triệu chứng mà còn identity/đời sống bị ảnh hưởng.',
      goals: ['Sympathy trigger', 'Audience feel seen', 'Justify giải pháp emotional'],
      useCase: ['Sản phẩm liên quan tự tin / quan hệ / công việc', 'Audience đã tổn thương lâu', 'Female 30-45'],
      example: '"Mình từng từ chối ăn cùng đồng nghiệp vì sợ ngại lúc bị đầy hơi giữa buổi…"',
    },
  },

  // ── PROBLEM / SOLUTION ──────────────────────────────────────────────
  {
    id: 'problem-solution', label: 'Problem → Solution', hint: 'Pain → solution',
    glyph: '⚠', category: 'hook',
    briefEn: 'Direct pain match in line 1, agitate briefly, pivot to product as the clean solution. No fluff.',
    detailVi: {
      mechanism: 'Pain match câu đầu → agitate ngắn → pivot sản phẩm. Conversion-focused.',
      goals: ['Match-to-pain rõ ràng', 'Fast conversion', 'Cold traffic friendly'],
      useCase: ['Pain phổ biến + nhận thức cao', 'Sản phẩm AOV thấp/trung', 'Quick wins'],
      example: '"Bị đầy hơi sau mỗi bữa? Đây là lý do…"',
    },
  },
  {
    id: 'before-after', label: 'Before / After', hint: 'Trước & sau',
    glyph: '📈', category: 'story',
    briefEn: 'Transformation arc with specific timeline ("after 14 days…"). Concrete before vs after observations.',
    detailVi: {
      mechanism: 'Transformation timeline cụ thể ("Sau 14 ngày…"). Trước-sau quan sát được.',
      goals: ['Earned credibility', 'Realistic expectation', 'Visual proof story'],
      useCase: ['Sản phẩm cần thời gian thấy kết quả', 'Skincare / supplement / fitness', 'Higher AOV'],
      example: '"Trước khi dùng / Sau 14 ngày dùng — đây là tất cả những gì mình quan sát được…"',
    },
  },
  {
    id: 'comparison', label: 'Comparison', hint: 'So sánh thẳng',
    glyph: '⚖', category: 'story',
    briefEn: 'Side-by-side comparison with what the reader is currently using or considering. Position as clear upgrade.',
    detailVi: {
      mechanism: 'So sánh trực tiếp sản phẩm mới vs. cũ. Audience cảm thấy mình đang upgrade.',
      goals: ['Differentiation rõ', 'Audience feel informed', 'Trigger switching'],
      useCase: ['Category đông đối thủ', 'Re-targeting', 'Có USP technical rõ'],
      example: '"Mình đã so sánh 3 loại men vi sinh phổ biến — và đây là lý do mình chỉ còn dùng 1 loại…"',
    },
  },

  // ── MECHANISM / EDUCATION ───────────────────────────────────────────
  {
    id: 'ingredient-education', label: 'Ingredient Education', hint: 'Giải thích ingredient',
    glyph: '🧪', category: 'mechanism',
    briefEn: 'Educate around 1-2 hero ingredients — explain what they are, how they work, why they matter. Conversational, not medical.',
    detailVi: {
      mechanism: 'Education về 1-2 hero ingredient — what / how / why. Conversational, không jargon.',
      goals: ['Trust qua hiểu biết', 'Justify giá cao', 'Empowered understanding'],
      useCase: ['Sản phẩm có ingredient đặc biệt', 'Health / supplement / skincare', 'Audience research kỹ'],
      example: '"Inulin nghe có vẻ phức tạp — nhưng thực ra nó chỉ là thức ăn cho lợi khuẩn trong ruột bạn."',
    },
  },
  {
    id: 'why-this-works', label: 'Why This Works', hint: 'Tại sao hiệu quả',
    glyph: '🔍', category: 'mechanism',
    briefEn: 'Mechanism-first content — explain the chain from cause → effect → product role → result. Each step short.',
    detailVi: {
      mechanism: 'Mechanism-first — cause → effect → product role → result. Mỗi bước ngắn, link rõ.',
      goals: ['Logical confidence', 'Justify why this and not others', 'Educational credibility'],
      useCase: ['Sản phẩm có cơ chế khoa học rõ', 'Audience kỹ tính / older', 'Advertorial style'],
      example: '"Đây là lý do men vi sinh này khác với loại bạn đã thử…"',
    },
  },
  {
    id: 'doctor-style', label: 'Doctor Style', hint: 'Góc nhìn bác sĩ',
    glyph: '🩺', category: 'mechanism',
    briefEn: 'Doctor/expert voice — cite mechanism, study results, or expert opinion. Calm, credible, no shouting.',
    detailVi: {
      mechanism: 'Voice tone bác sĩ / chuyên gia. Trích nghiên cứu, mechanism, expert opinion.',
      goals: ['High credibility', 'Trust signal', 'Justify giá cao'],
      useCase: ['Supplement / health', 'Skincare có claim khoa học', 'Older audience'],
      example: '"Nghiên cứu 2023 chỉ ra 80% trường hợp đầy hơi đến từ mất cân bằng vi sinh đường ruột…"',
    },
  },

  // ── SOCIAL PROOF ────────────────────────────────────────────────────
  {
    id: 'social-proof', label: 'Social Proof', hint: 'Nhiều người đã dùng',
    glyph: '👥', category: 'social',
    briefEn: 'Lead with mass adoption — number of users, ratings, repeat-buyer rate. Bandwagon + FOMO.',
    detailVi: {
      mechanism: 'Bandwagon — dẫn số liệu users / reviews / repeat rate. Khán giả cảm thấy chậm chân.',
      goals: ['Mass trust signal', 'Reduce skepticism', 'Trigger FOMO'],
      useCase: ['Brand đã có volume', 'Scaling phase', 'Re-launch'],
      example: '"10,000+ người Malaysia đã đổi sang công thức men vi sinh này — đây là lý do…"',
    },
  },
  {
    id: 'comment-style', label: 'Comment Style', hint: 'Style comment thật',
    glyph: '💬', category: 'social',
    briefEn: 'Write as if it\'s a real organic comment under a post — natural, conversational, slightly informal. Stealth ad feel.',
    detailVi: {
      mechanism: 'Viết như comment thật dưới post viral. Stealth ad feel — không có "vibe quảng cáo".',
      goals: ['Native blend', 'Authenticity tối đa', 'Bypass ad blindness'],
      useCase: ['TikTok / FB organic-feel ads', 'Whitelisted creator ads', 'Audience cảnh giác'],
      example: '"Trời ơi mình cũng đang dùng cái này luôn nè, tự nhiên thấy đỡ đầy hơi nhiều thật á 🥲"',
    },
  },
  {
    id: 'review-style', label: 'Review Style', hint: 'Style review chân thật',
    glyph: '⭐', category: 'social',
    briefEn: 'Honest 4-5 star review tone — list what you liked, what you didn\'t, the overall verdict. Believable, not gushing.',
    detailVi: {
      mechanism: 'Review chân thật — what I liked / didn\'t like / verdict. Không over-promise.',
      goals: ['Earned credibility', 'Reduce skepticism', 'Mid-funnel decision'],
      useCase: ['Audience scrutiny cao', 'AOV trung-cao', 'Beauty / supplement'],
      example: '"Review thật sau 3 tuần dùng. Có 2 điểm mình thích và 1 điểm mình không thích — nói thẳng…"',
    },
  },
  {
    id: 'testimonial', label: 'Testimonial Style', hint: 'Lời chứng từ user',
    glyph: '❤', category: 'social',
    briefEn: 'First-person testimonial with timeline + specific observable change. Emotional gratitude, not hype.',
    detailVi: {
      mechanism: 'Testimonial với timeline cụ thể + observable change. Cảm xúc biết ơn, không phóng đại.',
      goals: ['Emotional credibility', 'Story-based proof', 'Long-form trust'],
      useCase: ['Transformation products', 'AOV cao', 'Female audience'],
      example: '"Sau 21 ngày dùng — mình chỉ muốn cảm ơn người bạn đã giới thiệu cho mình…"',
    },
  },

  // ── SOFT / HARD SELL ────────────────────────────────────────────────
  {
    id: 'soft-sell', label: 'Soft Sell', hint: 'Bán mềm tự nhiên',
    glyph: '🛒', category: 'hook',
    briefEn: 'Low-pressure recommendation tone — share an experience, recommend casually, no urgency. Sounds like a friend.',
    detailVi: {
      mechanism: 'Tone bạn-tới-bạn — chia sẻ trải nghiệm, gợi ý nhẹ. Không urgency, không hype.',
      goals: ['Reduce ad-feel', 'Trust building', 'Long-funnel awareness'],
      useCase: ['Top-of-funnel', 'Audience đã từng tương tác', 'Lifestyle / beauty product'],
      example: '"Chia sẻ thôi nhé — mình thấy cái này hợp với mấy bạn hay bị đầy hơi như mình…"',
    },
  },
  {
    id: 'hard-sell', label: 'Hard Sell', hint: 'Bán mạnh, urgency cao',
    glyph: '🚨', category: 'hook',
    briefEn: 'Urgent direct sales tone — strong CTA, urgency cues, scarcity if available. Conversion speed-run.',
    detailVi: {
      mechanism: 'Urgent direct sales — CTA mạnh, urgency + scarcity nếu có. Conversion-focused.',
      goals: ['Max CTR', 'Push consideration → action', 'Bottom-funnel re-target'],
      useCase: ['Flash sale / promo', 'Re-targeting warm audience', 'Có offer mạnh'],
      example: '"Chỉ còn 50 hộp giá sale — sau hôm nay là về giá gốc. Tap ngay 👇"',
    },
  },
  {
    id: 'cta-heavy', label: 'CTA Heavy', hint: 'CTA dày đặc',
    glyph: '📣', category: 'format',
    briefEn: 'CTA-dense format — sprinkle 2-3 micro-CTAs through the body, end with one hard CTA. For warm audiences.',
    detailVi: {
      mechanism: 'CTA dày đặc — 2-3 micro-CTA xuyên suốt, kết bằng CTA mạnh. Warm audience.',
      goals: ['Max conversion friction reduction', 'Multiple action points', 'Direct response'],
      useCase: ['Re-targeting audience đã warm', 'Promo content', 'Comment-to-DM funnel'],
      example: '"…link ở bio 👆 / Tap shop ngay 👇 / Nhắn shop để được tư vấn…"',
    },
  },

  // ── LIFESTYLE / AESTHETIC ───────────────────────────────────────────
  {
    id: 'lifestyle', label: 'Lifestyle', hint: 'Lifestyle aspirational',
    glyph: '✨', category: 'story',
    briefEn: 'Aspirational lifestyle integration — the product appears naturally as part of a desirable routine. Show, don\'t sell.',
    detailVi: {
      mechanism: 'Aspirational lifestyle — sản phẩm xuất hiện tự nhiên trong morning routine / day-in-life.',
      goals: ['Lifestyle envy', 'Brand love', 'Top-of-funnel awareness'],
      useCase: ['Premium / aesthetic product', 'Female lifestyle audience', 'Brand campaigns'],
      example: '"Morning routine của mình mấy tuần nay — cà phê, ánh nắng, và 1 viên này lúc 8h sáng ☀️"',
    },
  },

  // ── PLATFORM-NATIVE STYLES ──────────────────────────────────────────
  {
    id: 'tiktok-native', label: 'TikTok Native', hint: 'Vibe TikTok thuần',
    glyph: '📱', category: 'format',
    briefEn: 'Native TikTok creator voice — slangy, fast, lowercase, parenthetical asides, "ok wait", "no but actually". Gen Z rhythm.',
    detailVi: {
      mechanism: 'Voice creator TikTok thuần — slangy, fast, lowercase, "ok wait", "no but actually".',
      goals: ['Native blend feed TikTok', 'Gen Z engagement', 'Authenticity'],
      useCase: ['TikTok ads / organic', 'Audience 18-28', 'Lifestyle / beauty'],
      example: '"ok wait — đây là điều mình mới phát hiện mà cả TikTok chưa ai nói…"',
    },
  },
  {
    id: 'facebook-native', label: 'Facebook Native', hint: 'Vibe Facebook post',
    glyph: '📘', category: 'format',
    briefEn: 'Native Facebook long-post voice — chunky paragraphs, personal share tone, calm pacing. Family-friendly.',
    detailVi: {
      mechanism: 'Voice Facebook long-post — chunky paragraphs, personal share, calm pacing.',
      goals: ['Native blend FB feed', 'Older audience comfort', 'Long-form retention'],
      useCase: ['FB ads cho audience 30+', 'Long-form story', 'Advertorial-lite'],
      example: '"Tuần trước mình có chia sẻ trên trang chuyện bị đầy hơi… nay có vài bạn nhắn hỏi sản phẩm là gì."',
    },
  },
  {
    id: 'advertorial', label: 'Advertorial', hint: 'Bài viết PR dài',
    glyph: '📰', category: 'format',
    briefEn: 'Long-form advertorial — feels like a magazine health article. Education-heavy, story-driven, soft CTA at the end.',
    detailVi: {
      mechanism: 'Bài viết advertorial dài — như bài health magazine. Education + story → soft CTA cuối.',
      goals: ['Deep trust building', 'High-AOV conversion', 'Pre-sell landing-page traffic'],
      useCase: ['Health / supplement AOV cao', 'Audience 35+', 'Cold traffic cần education'],
      example: '"Câu chuyện về một loại lợi khuẩn từ Đan Mạch — và lý do nó đang thay đổi cách người Việt nhìn về tiêu hoá."',
    },
  },
  {
    id: 'long-form-sales', label: 'Long-form Sales', hint: 'Sales letter dài',
    glyph: '📚', category: 'format',
    briefEn: 'Long-form sales letter — hook, agitate, story, mechanism, social proof, offer, multiple CTAs, FAQs answered inline.',
    detailVi: {
      mechanism: 'Sales letter dài — hook → agitate → story → mechanism → proof → offer → CTA. Full funnel trong 1 post.',
      goals: ['Cold → buyer trong 1 chạm', 'High-AOV conversion', 'Pre-sell heavy'],
      useCase: ['AOV cao cần education sâu', 'Direct-response media buyer', 'Niche complex'],
      example: '"Nếu bạn đang đầy hơi sau mỗi bữa và đã thử qua nhiều loại men — đọc 2 phút này trước khi mua thêm cái mới."',
    },
  },
  {
    id: 'short-punchy', label: 'Short Punchy', hint: 'Ngắn, đập thẳng',
    glyph: '⚡', category: 'format',
    briefEn: 'Ultra-short, punchy ad copy — hook in line 1, problem in line 2, solution in line 3, CTA in line 4. Done.',
    detailVi: {
      mechanism: 'Cực ngắn, mỗi câu 1 hit. Hook → problem → solution → CTA trong 4-6 dòng.',
      goals: ['High mobile readability', 'Reels / Story format', 'Fast scroll catch'],
      useCase: ['Reels / Story ads', 'Re-targeting warm', 'CPC-focused campaigns'],
      example: '"Đầy hơi sau ăn? // Là vi sinh đường ruột mất cân bằng. // Đây là công thức 6 chủng đang fix nó. // Link 👇"',
    },
  },
]

export function getAdsPresetById(id: string): AdsContentPreset | undefined {
  return ADS_PRESETS.find((p) => p.id === id)
}

// ── Platforms ─────────────────────────────────────────────────────────────
export const PLATFORM_OPTIONS: PlatformOption[] = [
  {
    id: 'facebook-feed', label: 'Facebook Feed', glyph: '📘',
    hint: 'Long-form personal-share',
    promptHint: 'Optimize for Facebook Feed: medium-to-long body, chunky paragraphs, personal-share voice, suitable for 30+ audience, "see more" expansion-friendly hook in the first 2 lines.',
  },
  {
    id: 'facebook-reels', label: 'Facebook Reels', glyph: '🎬',
    hint: 'Short punchy caption',
    promptHint: 'Optimize for Facebook Reels caption: short, punchy, video-supporting (the visual carries weight). Hook in line 1, 1-2 supporting lines, fast CTA. Treat as a teaser for the video.',
  },
  {
    id: 'instagram', label: 'Instagram', glyph: '📸',
    hint: 'Visual-led, less text',
    promptHint: 'Optimize for Instagram Feed caption: visually paced, aesthetic emojis at line starts, shorter overall than Facebook, end with a soft CTA. Aspirational tone where natural.',
  },
  {
    id: 'tiktok', label: 'TikTok', glyph: '🎵',
    hint: 'Native creator voice',
    promptHint: 'Optimize for TikTok caption: native Gen-Z creator rhythm, lowercase okay, slang okay ("ok wait", "no but actually"), brief, hook-heavy, treat as enhancement to the video — not stand-alone.',
  },
  {
    id: 'advertorial', label: 'Advertorial Landing', glyph: '📰',
    hint: 'Long-form magazine-style',
    promptHint: 'Optimize for an advertorial landing-page block: long-form magazine voice, story + mechanism + proof + soft CTA. Reader-first, education-heavy. Section breaks and clear pacing are allowed.',
  },
]

export function getPlatformById(id: string): PlatformOption | undefined {
  return PLATFORM_OPTIONS.find((p) => p.id === id)
}

// ── Length modes ──────────────────────────────────────────────────────────
export const LENGTH_OPTIONS: LengthOption[] = [
  { id: 'short',       label: 'Ngắn',       glyph: '⚡', targetWords: 60 },
  { id: 'medium',      label: 'Vừa',        glyph: '📝', targetWords: 150 },
  { id: 'long',        label: 'Dài',        glyph: '📚', targetWords: 300 },
  { id: 'advertorial', label: 'Advertorial', glyph: '📰', targetWords: 500 },
]

// ── Tone modifiers ────────────────────────────────────────────────────────
export const TONE_OPTIONS: ToneOption[] = [
  { id: 'soft-sell',         label: 'Soft sell',        promptHint: 'low-pressure helpful-friend energy' },
  { id: 'hard-sell',         label: 'Hard sell',        promptHint: 'aggressive urgency with direct asks' },
  { id: 'emotional',         label: 'Cảm xúc',          promptHint: 'lean into emotional storytelling and vulnerability' },
  { id: 'curiosity',         label: 'Tò mò',            promptHint: 'open and resolve curiosity loops; tease then pay off' },
  { id: 'scientific',        label: 'Khoa học',         promptHint: 'cite mechanism and ingredients in plain language' },
  { id: 'funny',             label: 'Hài hước',         promptHint: 'light humour and self-aware moments; never cringe' },
  { id: 'luxury',            label: 'Sang trọng',       promptHint: 'premium aspirational tone; refined word choice' },
  { id: 'female-audience',   label: 'Nữ',               promptHint: 'framed for a female reader — her pain points and language' },
  { id: 'male-audience',     label: 'Nam',              promptHint: 'framed for a male reader — direct, results-focused' },
  { id: 'older-audience',    label: 'Trung niên',       promptHint: 'older audience 35+ — slower pacing, less slang, more trust signals' },
  { id: 'young-gen-z',       label: 'Gen Z',            promptHint: 'Gen Z TikTok voice — lowercase, slang, native rhythm' },
]
