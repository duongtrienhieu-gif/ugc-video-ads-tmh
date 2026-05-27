// ─────────────────────────────────────────────────────────────────────
// Proof System — TEXTURE PROFILES per niche (P1 foundation)
//
// Niche-specific proof feel — proof realism khác nhau theo niche.
// Same stance + entropy → different texture per niche.
//
// Texture decides:
//   - Typical voice age + demographic
//   - Platform feel (FB comment / DM / Shopee review / TikTok reply)
//   - Specific texture cues (haircare → counting hair detail)
//   - Anti-stereotype patterns to AVOID
//
// Goal: reader recognize "đây là proof của niche này" via texture,
// không phải generic "happy customer" voice.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey, ProofTextureProfile } from '../types'

export const PROOF_TEXTURE_PROFILES: Record<NicheKey, ProofTextureProfile> = {
  'haircare': {
    niche: 'haircare',
    typicalVoice: 'Phụ nữ 28-45, feminine FB comment / DM tone, casual emoji light (😭 ✨ tối đa 1)',
    platformFeel: 'FB comment / DM / Shopee review feminine vibe',
    textureCues: [
      'đếm số sợi tóc (gối / cống / lược)',
      'reference vùng đỉnh đầu / da đầu / chân tóc',
      'sau gội tóc — chính moment most reviews mention',
      'mention thời gian dùng "tháng thứ X" rất phổ biến',
    ],
    avoidPatterns: [
      'tone mom-baby (3am, con khóc, cho bú) — sai voice',
      'tone aging-body (đầu gối, vịn cầu thang) — sai niche',
      'pseudo-medical (nang tóc / collagen type X) — narrator không expert',
    ],
  },

  'skincare': {
    niche: 'skincare',
    typicalVoice: 'Phụ nữ 25-40, skincare community lingo casual, mention routine OK nhưng casual',
    platformFeel: 'FB skincare group comment / Shopee review',
    textureCues: [
      'sờ da / soi gương / quầng thâm reference',
      'mention "rửa mặt xong" / "buổi sáng" timing',
      'so sánh với "kem trước" (không brand name)',
      'mention "da bắt sáng lại" / "đỡ xỉn"',
    ],
    avoidPatterns: [
      'doctor-authority tone ("da liễu khuyên...")',
      'ingredient list show-off',
      'before-after photo description',
    ],
  },

  'supplement-wellness': {
    niche: 'supplement-wellness',
    typicalVoice: '35-50yo voice, mature casual, abbreviation OK (mn, ko, ko sao), kể chuyện ngắn',
    platformFeel: 'FB group sức khỏe / Zalo group / Shopee review',
    textureCues: [
      'mention "uống đều / uống được X tháng"',
      'sáng dậy / ngủ ngon reference',
      '3 giờ chiều pin reference',
      'ngày làm việc / tập trung mention',
    ],
    avoidPatterns: [
      'vanity/appearance focus',
      'feminine emoji-rich tone',
      'lifestyle aspirational language',
    ],
  },

  'health-functional': {
    niche: 'health-functional',
    typicalVoice: '45-60yo voice, thân thiện kể chuyện, family-witness OK ("mẹ tôi", "ba tôi"), Việt chuẩn ít abbreviation',
    platformFeel: 'FB caretaker comment / family chat share',
    textureCues: [
      'mention cầu thang / đứng dậy / khớp',
      'family-witness perspective phổ biến',
      'mention buổi sáng cứng / buổi tối đau',
      'reference đi siêu thị / đi chợ activity',
    ],
    avoidPatterns: [
      'young trendy slang',
      'beauty/skincare aesthetic',
      'aggressive supplement-stack language',
    ],
  },

  'mom-baby': {
    niche: 'mom-baby',
    typicalVoice: 'Mom 28-38, 3am-typing energy, tired-real tone, abbreviation + occasional typo OK',
    platformFeel: 'Mom group FB / Zalo / chat mom-to-mom',
    textureCues: [
      'mention con / cho bú / 3 giờ sáng',
      'sau sinh / postpartum reference',
      'gối tóc / áo cũ reference (postpartum body)',
      'mention chồng để ý / mẹ nhắc',
    ],
    avoidPatterns: [
      'single-woman voice / dating language',
      'gym/fitness ambition tone',
      'corporate office reference',
    ],
  },

  'beauty-confidence': {
    niche: 'beauty-confidence',
    typicalVoice: '25-40yo, vanity-honest tone, mirror moments OK, casual emoji OK',
    platformFeel: 'Beauty FB group / TikTok reply / Instagram comment',
    textureCues: [
      'mention camera / selfie / filter',
      'mention bạn cũ gặp lại / event sắp tới',
      'so sánh với bạn cùng tuổi',
      'mirror reference / makeup mention',
    ],
    avoidPatterns: [
      'maternal/family-caretaker tone',
      'medical/physical-symptom focus',
      'fatigue narrative without external visibility',
    ],
  },

  'relationship': {
    niche: 'relationship',
    typicalVoice: '28-45yo, emotional confession DM-style, short fragments OK, hedge a lot',
    platformFeel: 'DM private / Zalo confession / closed-FB-group share',
    textureCues: [
      'mention chồng / con / mẹ',
      'reference đêm khuya / về tới nhà / xe đậu trong sân',
      'mention cảm xúc phẳng / cộc / mệt với mọi người',
      'fragments OK, không phải full grammar',
    ],
    avoidPatterns: [
      'physical-symptom focus',
      'beauty/appearance language',
      'professional development tone',
    ],
  },

  'fitness-recovery': {
    niche: 'fitness-recovery',
    typicalVoice: '40-60yo COD-typical buyer, Việt-Anh mix occasional, typo OK, practical tone',
    platformFeel: 'COD landing comment / Shopee Q&A / FB Zalo casual',
    textureCues: [
      'mention đầu gối / lưng / vai',
      'reference đi bộ / du lịch / leo cầu thang',
      'mention dầu nóng / miếng dán đã thử',
      'occasional Việt-Anh mix ("recovery", "stretching")',
    ],
    avoidPatterns: [
      'urban young-professional voice',
      'beauty/aesthetic focus',
      'aspirational fitness language ("đỉnh cao", "transformation")',
    ],
  },

  // ── Tier S extensions (2026-05-27) ──

  'sleep-insomnia': {
    niche: 'sleep-insomnia',
    typicalVoice: '30-55yo urban professional / parent, quietly desperate, late-night Facebook tone',
    platformFeel: 'late-night FB group post / Zalo "có ai bị giống mình không" / Shopee review',
    textureCues: [
      'specific timestamp ("2h45 sáng nay lại mở mắt")',
      'mention thử melatonin / Calm app / loa white noise rồi',
      'reference cà phê thứ 2, thứ 3 buổi sáng',
      'mention chồng/vợ nhận xét "lại trở mình cả đêm"',
    ],
    avoidPatterns: [
      'medical clinical voice',
      'sleep hygiene lecture tone',
      'aspirational "best sleep of my life" rave',
    ],
  },

  'menopause': {
    niche: 'menopause',
    typicalVoice: '45-58yo woman, hidden shame, kín đáo, half-confession tone',
    platformFeel: 'private FB group phụ nữ U50 / Zalo nhóm bạn thân / Shopee comment',
    textureCues: [
      'mention bốc hỏa cụ thể ("giữa cuộc họp" / "trong xe ô tô")',
      'reference đồ uống/đồ ăn cẩn thận né (cay, nóng, rượu)',
      'mention chồng "không hiểu" hoặc "có chút thay đổi giữa hai vợ chồng"',
      'reference tuổi cụ thể ("năm nay 49" / "vào tuổi 52")',
    ],
    avoidPatterns: [
      'aggressive anti-aging tone',
      'young-perspective voice',
      'medical clinical lecture',
      'pathologizing framing',
    ],
  },

  'mental-health': {
    niche: 'mental-health',
    typicalVoice: '28-45yo high-functioning professional, masked exhaustion, "fine on outside" tone',
    platformFeel: 'anonymous Reddit post / FB confession group / Threads quiet share',
    textureCues: [
      'specific physical anxiety symptom ("chest tightness mở email" / "tay run cầm cốc")',
      'mention therapy / app Calm / Headspace đã thử',
      'reference "fine với người ngoài, ở nhà mới khóc"',
      'mention masked smiling / "cười không tới mắt"',
    ],
    avoidPatterns: [
      'depression-cured euphoria',
      'happy-pill testimonial tone',
      'wellness influencer voice',
      'forced gratitude framing',
    ],
  },

  'anti-aging-longevity': {
    niche: 'anti-aging-longevity',
    typicalVoice: '40-60yo health-conscious professional, Peter Attia podcast reader, biological-age aware',
    platformFeel: 'longevity Discord / FB group longevity VN / Reddit r/longevity Vietnamese',
    textureCues: [
      'mention specific biomarker ("biological age 47 so với chronological 52")',
      'reference NMN / NAD / resveratrol brands đã thử',
      'mention Peter Attia / Huberman / Sinclair khi research',
      'reference parents aging quickly là motivation',
    ],
    avoidPatterns: [
      'vanity-skincare voice',
      'beauty-confidence framing',
      'youth-obsession tone',
      'fountain-of-youth marketing voice',
    ],
  },

  // ── SEA-6 extensions (2026-05-27) ──

  'dental-oral-care': {
    niche: 'dental-oral-care',
    typicalVoice: '25-50yo working adult, casual confessional, social-anxiety undertone',
    platformFeel: 'FB nha khoa group / Shopee dental review / Tiktok reply về hơi thở',
    textureCues: [
      'mention cao răng / đi cạo vôi 6 tháng',
      'reference che miệng khi cười / không dám cười to',
      'mention con / cháu / vợ chồng phản ứng',
      'reference specific dental product đã thử (Colgate / Sensodyne)',
    ],
    avoidPatterns: [
      'cosmetic-dentist marketing voice',
      'aspirational smile-makeover tone',
      'beauty-confidence aesthetic framing',
      'aggressive medical claim',
    ],
  },

  'diabetes-blood-sugar': {
    niche: 'diabetes-blood-sugar',
    typicalVoice: '45-65yo, mature concerned voice, family-context, A1C numbers literacy',
    platformFeel: 'FB nhóm tiểu đường VN / Zalo nhóm bệnh nhân / Shopee comment',
    textureCues: [
      'mention specific number ("A1C 7.5%" / "glucose sáng 8.2")',
      'reference cơm trắng / chè / bia bị kiêng',
      'mention bác sĩ / metformin / Glucophage',
      'reference vợ/chồng nấu riêng đồ ăn',
    ],
    avoidPatterns: [
      'miracle cure marketing voice',
      'wellness influencer aspirational tone',
      'aggressive medical claim',
      'youth-fitness energetic framing',
    ],
  },

  'liver-detox': {
    niche: 'liver-detox',
    typicalVoice: '35-55yo, mostly male, post-drinking-age, silent worry tone',
    platformFeel: 'FB nhóm gan mật / Zalo nam giới sức khỏe / Shopee men gan supplement',
    textureCues: [
      'mention men gan number ("ALT 80" / "AST 95")',
      'reference siêu âm gan nhiễm mỡ độ 1-2',
      'mention nhậu / bia / tiệc tùng đã bị né',
      'reference silymarin / cây kế sữa / cardus marianus',
    ],
    avoidPatterns: [
      'extreme-detox cleansing voice',
      'juice-fast wellness tone',
      'spiritual-purification framing',
      'beauty-aesthetic narrative',
    ],
  },

  'prostate-urology': {
    niche: 'prostate-urology',
    typicalVoice: '50-70yo male, reserved-quiet, dignity-preserved voice, family-context occasional',
    platformFeel: 'FB nam giới sức khỏe / Zalo nhóm BPH / Shopee tuyến tiền liệt review',
    textureCues: [
      'mention specific number ("PSA 5.2" / "tiểu đêm 3 lần")',
      'reference saw palmetto / Tamsulosin / Avodart',
      'mention chuyến đi xa / phim dài bị né',
      'reference vợ "nhắc đi khám" / "lo lắng"',
    ],
    avoidPatterns: [
      'sexual-bravado masculine voice',
      'viagra-style performance tone',
      'aggressive masculine-power narrative',
      'youth-recovery promise voice',
    ],
  },

  'hemorrhoids-digestive-shame': {
    niche: 'hemorrhoids-digestive-shame',
    typicalVoice: '30-55yo, anonymous-feeling confession, kín đáo / xấu hổ undertone',
    platformFeel: 'anonymous FB confession / Shopee comment ẩn danh / Reddit Vietnamese',
    textureCues: [
      'mention cụ thể ("rặn 5-10 phút" / "máu giấy vệ sinh")',
      'reference không kể với ai (kể cả vợ/chồng)',
      'mention né xe máy / đệm donut / thuốc bôi',
      'reference diosmin / hesperidin / preparation H',
    ],
    avoidPatterns: [
      'cheerful-wellness voice',
      'aspirational lifestyle tone',
      'social-share testimonial framing',
      'aesthetic photogenic narrative',
      'aggressive medical claim',
    ],
  },

  'eye-vision-care': {
    niche: 'eye-vision-care',
    typicalVoice: '30-55yo office worker, screen-fatigue savvy, practical tone',
    platformFeel: 'FB nhóm dân văn phòng / Shopee mắt review / Tiktok reply về screen-time',
    textureCues: [
      'mention specific ("8 tiếng máy tính" / "cuối ngày mắt mỏi")',
      'reference nước mắt nhân tạo / Refresh / Systane',
      'mention kính chống ánh sáng xanh đã đeo',
      'reference độ cận / loạn tăng / đi đo mắt',
    ],
    avoidPatterns: [
      'perfect-vision marketing voice',
      'laser-eye-surgery promotional tone',
      'beauty-aesthetic eye narrative',
      'aspirational young-eye framing',
    ],
  },

  // ── SPEC-FIX (2026-05-27) — health-functional split ──

  'health-respiratory': {
    niche: 'health-respiratory',
    typicalVoice: '25-50yo any gender, mỗi đợt giao mùa khổ, allergy / sinus chronic',
    platformFeel: 'FB nhóm dị ứng-xoang / Shopee xịt mũi review / Zalo gia đình',
    textureCues: [
      'mention timing cụ thể ("đêm phải há miệng thở" / "sáng dậy hỉ ra mới thở")',
      'reference xịt mũi đã thử (Otrivin / Sterimar / nước muối)',
      'mention vợ/chồng nhận xét ngáy đêm',
      'reference giao mùa / đổi thời tiết / bụi mịn',
    ],
    avoidPatterns: [
      'aggressive medical claim voice',
      'generic wellness influencer tone',
      'instant-cure miracle framing',
      'aesthetic beauty voice',
    ],
  },

  'health-joint': {
    niche: 'health-joint',
    typicalVoice: '45-65yo, mature thân thiện, family-witness OK ("mẹ tôi", "ba tôi"), Việt chuẩn ít abbreviation',
    platformFeel: 'FB caretaker comment / Shopee glucosamine review / Zalo nhóm cao niên',
    textureCues: [
      'mention cụ thể ("đầu gối nhói lúc đứng dậy" / "vịn cầu thang từng bậc")',
      'reference glucosamine / chondroitin / Sustagen đã thử',
      'mention con/cháu/vợ chồng worry',
      'reference đi siêu thị / đi chợ / leo cầu thang',
    ],
    avoidPatterns: [
      'young trendy slang',
      'beauty/skincare aesthetic',
      'aggressive supplement-stack language',
      'youth-recovery framing',
    ],
  },

  'health-digestive': {
    niche: 'health-digestive',
    typicalVoice: '30-55yo office worker / stressed parent, GERD-savvy, practical food-anxious tone',
    platformFeel: 'FB nhóm dạ dày-trào ngược / Shopee omeprazole review / Zalo bệnh nhân',
    textureCues: [
      'mention timing cụ thể ("đầy bụng 1 giờ sau ăn" / "ợ chua đêm")',
      'reference omeprazole / esomeprazole / Yumangel đã uống',
      'mention kiêng cay/chua/dầu mỡ',
      'reference food triggers cụ thể (bia, cà phê đặc, đồ chiên)',
    ],
    avoidPatterns: [
      'detox / cleanse marketing voice',
      'weight-loss tone',
      'beauty aesthetic narrative',
      'fearmongering medical claim',
    ],
  },

  'health-cardiovascular': {
    niche: 'health-cardiovascular',
    typicalVoice: '50-70yo, mature concerned voice, A1C/BP-savvy, family-context, Việt chuẩn',
    platformFeel: 'FB nhóm huyết áp/tim mạch VN / Zalo bệnh nhân / Shopee CoQ10 review',
    textureCues: [
      'mention specific number ("huyết áp 150/95" / "cholesterol 4.5")',
      'reference thuốc theo đơn (Concor / Amlor / atorvastatin)',
      'mention kiêng muối / né đồ chiên / đo huyết áp 2 lần/ngày',
      'reference bác sĩ tim mạch / phòng khám tuyến cao',
    ],
    avoidPatterns: [
      'miracle cure marketing voice',
      'aggressive medical claim',
      'wellness influencer aspirational tone',
      'youth-fitness energetic framing',
    ],
  },
}

/** Get texture profile for niche. */
export function getTextureProfile(niche: NicheKey): ProofTextureProfile {
  return PROOF_TEXTURE_PROFILES[niche]
}

/** Compose texture brief for proof prompt injection. */
export function textureBrief(texture: ProofTextureProfile): string {
  return [
    `═══ NICHE TEXTURE (${texture.niche}) ═══`,
    `Typical voice: ${texture.typicalVoice}`,
    `Platform feel: ${texture.platformFeel}`,
    `Texture cues (weave 1-2 across 3 pieces):`,
    ...texture.textureCues.map((c) => `  - ${c}`),
    `⛔ AVOID (sai voice / sai niche):`,
    ...texture.avoidPatterns.map((p) => `  ✗ ${p}`),
  ].join('\n')
}
