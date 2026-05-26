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
