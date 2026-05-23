// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — NARRATOR ARCHETYPES (v5.1)
//
// 12 distinct narrator identities. Selected per pack — drives wording,
// pacing, shame, lifestyle, CTA tone, visual environment.
//
// Each archetype has CONTRADICTIONS (humans are emotionally inconsistent)
// + SOCIAL CONTEXT preferences (different worlds surface different stories).
//
// Same product can run through 12 archetypes = 12 distinct "human worlds".
// ─────────────────────────────────────────────────────────────────────

import type { NarratorArchetype } from '../types'

export const NARRATOR_ARCHETYPES: NarratorArchetype[] = [
  // ═══ Female archetypes ═══
  {
    id: 'female-housewife-suburban-38',
    label: 'Nữ nội trợ ngoại ô, 38 tuổi',
    gender: 'female',
    ageRange: '35-45',
    occupation: 'Nội trợ kiêm bán hàng nhỏ tại nhà',
    lifestyle: 'Suburban, gia đình 2 con, chồng đi làm văn phòng',
    personalityVibe: 'warm-maternal',
    wordingTendency: 'reserved, indirect, hay "thật ra...", "có lẽ..." — không complain trực tiếp',
    shamePatterns: [
      'cảm giác xuống sức nhanh hơn các bà mẹ khác',
      'tránh chụp ảnh chung với con',
      'không muốn chồng thấy mình ngồi nghỉ giữa chừng',
    ],
    contradictions: [
      'nói "mình không có gì để than" nhưng tối nào cũng ngồi yên trước bàn trang điểm',
      'bảo "tuổi này phải vậy thôi" nhưng vẫn google kiểm tra triệu chứng đêm khuya',
    ],
    socialContextPreference: ['family-centered', 'solitary-internal'],
    compatibleNiches: ['health-functional', 'skincare', 'haircare', 'supplement-wellness'],
  },

  {
    id: 'female-office-vain-32',
    label: 'Nữ văn phòng vain, 32 tuổi',
    gender: 'female',
    ageRange: '25-35',
    occupation: 'Văn phòng / marketing / sales',
    lifestyle: 'Urban apartment, độc thân hoặc partnered no kids',
    personalityVibe: 'practical-direct',
    wordingTendency: 'casual, dùng từ tiếng Anh thỉnh thoảng, hay viết short sentences',
    shamePatterns: [
      'đồng nghiệp khen "vẫn trẻ trung" — bị ám ảnh từ ấy',
      'tránh ánh sáng đèn LED phòng họp',
      'mở camera trước rồi tắt đi nhiều lần trước khi chụp ảnh chính thức',
    ],
    contradictions: [
      'tự nhận "không quan tâm bề ngoài" nhưng skincare routine ngày càng dài',
      'nói "đến đâu thì đến" nhưng đọc review thâu đêm',
    ],
    socialContextPreference: ['work-centered', 'public-self-conscious'],
    compatibleNiches: ['skincare', 'haircare', 'supplement-wellness', 'beauty-confidence'],
  },

  {
    id: 'female-mom-postpartum-30',
    label: 'Mẹ bỉm sau sinh, 30 tuổi',
    gender: 'female',
    ageRange: '25-35',
    occupation: 'Nghỉ ở nhà chăm con (hoặc work-from-home part-time)',
    lifestyle: 'Apartment, con < 2 tuổi, chồng đi làm cả ngày',
    personalityVibe: 'warm-maternal',
    wordingTendency: 'fragmented khi mệt, hay xuống dòng, dùng "tự nhiên...", "có hôm..."',
    shamePatterns: [
      'không nhận ra mình khi soi gương buổi sáng',
      'ngại gặp bạn cũ chưa có con',
      'tóc rụng thành nắm khi gội đầu',
    ],
    contradictions: [
      'biết ơn có con nhưng nhớ phiên bản cũ của mình',
      'nói "ổn rồi" với chồng nhưng khóc trong nhà tắm',
    ],
    socialContextPreference: ['family-centered', 'solitary-internal'],
    compatibleNiches: ['mom-baby', 'supplement-wellness', 'haircare', 'skincare'],
  },

  {
    id: 'female-perfectionist-vanity-42',
    label: 'Nữ chuyên nghiệp cầu toàn, 42 tuổi',
    gender: 'female',
    ageRange: '35-45',
    occupation: 'Senior office, chủ doanh nghiệp nhỏ, hoặc freelance creative',
    lifestyle: 'Urban, established, partnered/single — high standards',
    personalityVibe: 'reserved-thoughtful',
    wordingTendency: 'measured, đầy đủ câu, hay analyzing — "tôi quan sát thấy...", "tôi nhận ra..."',
    shamePatterns: [
      'nhìn ảnh 3 năm trước thấy khác hẳn — không kể với ai',
      'so sánh ảnh selfie cùng filter với năm trước',
      'tránh photo phòng họp với đèn từ trên',
    ],
    contradictions: [
      'tự gọi mình "không vanity" nhưng đầu tư mỹ phẩm cao cấp',
      'nói "tuổi này phải chấp nhận" nhưng đêm khuya đọc bài về collagen',
    ],
    socialContextPreference: ['work-centered', 'solitary-internal'],
    compatibleNiches: ['skincare', 'supplement-wellness', 'haircare', 'beauty-confidence'],
  },

  {
    id: 'female-perimenopause-48',
    label: 'Nữ tiền mãn kinh, 48 tuổi',
    gender: 'female',
    ageRange: '45-55',
    occupation: 'Established — văn phòng/teacher/business owner',
    lifestyle: 'Suburban hoặc urban, con đã lớn (teen hoặc đang học đại học)',
    personalityVibe: 'reserved-thoughtful',
    wordingTendency: 'philosophical lời lẽ, hay "có một giai đoạn...", "tôi đã sống đủ để biết..."',
    shamePatterns: [
      'bốc hỏa giữa buổi họp — phải đi ra ngoài',
      'tóc bạc lộ rõ hơn — phải nhuộm thường xuyên hơn',
      'không còn ngủ sâu như xưa, không kể với chồng',
    ],
    contradictions: [
      'chấp nhận già đi nhưng phản kháng với từng dấu hiệu cụ thể',
      'nói "đỡ stress hơn" sau khi con lớn nhưng cơ thể vẫn căng',
    ],
    socialContextPreference: ['family-centered', 'work-centered', 'community-social'],
    compatibleNiches: ['supplement-wellness', 'skincare', 'health-functional', 'haircare'],
  },

  {
    id: 'female-rural-traditional-55',
    label: 'Nữ nông thôn truyền thống, 55 tuổi',
    gender: 'female',
    ageRange: '55+',
    occupation: 'Nông nghiệp / bán hàng nhỏ / nghỉ hưu sớm',
    lifestyle: 'Rural / suburban tỉnh lẻ, gia đình đa thế hệ, ít công nghệ',
    personalityVibe: 'gentle-introvert',
    wordingTendency: 'mộc mạc, dùng nhiều thành ngữ, hay "ngày xưa...", "mẹ tôi ngày trước..."',
    shamePatterns: [
      'phải vịn cửa khi đứng dậy từ ghế thấp',
      'đi chợ về phải nghỉ giữa đường',
      'không nói con cái biết mình đau khớp lâu rồi',
    ],
    contradictions: [
      'tin thuốc bắc gia truyền nhưng quietly thử sản phẩm hiện đại',
      'gọi mình "già rồi không cần làm đẹp" nhưng vẫn để ý làn da',
    ],
    socialContextPreference: ['family-centered', 'community-social'],
    compatibleNiches: ['health-functional', 'supplement-wellness'],
  },

  // ═══ Male archetypes ═══
  {
    id: 'male-driver-fatigue-45',
    label: 'Nam tài xế / công nhân, 45 tuổi',
    gender: 'male',
    ageRange: '35-45',
    occupation: 'Tài xế / công nhân / blue collar',
    lifestyle: 'Suburban, gia đình, ngủ ít, ngồi lái lâu',
    personalityVibe: 'practical-direct',
    wordingTendency: 'ngắn, blunt, hay "thằng bạn tôi cũng vậy", "ai mà chẳng thế"',
    shamePatterns: [
      'khớp gối nhói khi xuống xe trước mặt khách',
      'ngồi trong xe vài phút chưa muốn xuống vì người mỏi',
      'tay tê khi cầm vô lăng lâu',
    ],
    contradictions: [
      'nói "đàn ông không kêu" nhưng để ý từng triệu chứng',
      'bảo vợ "không sao" nhưng xoay người tìm tư thế ngủ thoải mái cả tối',
    ],
    socialContextPreference: ['work-centered', 'public-self-conscious', 'family-centered'],
    compatibleNiches: ['health-functional', 'supplement-wellness'],
  },

  {
    id: 'male-startup-burnout-38',
    label: 'Nam startup burnout, 38 tuổi',
    gender: 'male',
    ageRange: '35-45',
    occupation: 'Tech / startup / founder / senior IT',
    lifestyle: 'Urban, high-stress, sedentary cả ngày, ngủ ít',
    personalityVibe: 'reserved-thoughtful',
    wordingTendency: 'analytical, hay metric/data references, "tôi nhận ra pattern...", "data của cơ thể..."',
    shamePatterns: [
      'không thể tập trung sau 3 giờ chiều — phải uống cà phê thứ 4',
      'họp 1 giờ là người mỏi rã',
      'mất 30 phút để rời khỏi giường buổi sáng',
    ],
    contradictions: [
      'tự bảo "burnout là bình thường startup" nhưng đêm khuya tìm sản phẩm bổ sung',
      'nói "không cần thuốc" nhưng tủ đầy vitamin',
    ],
    socialContextPreference: ['work-centered', 'solitary-internal'],
    compatibleNiches: ['supplement-wellness', 'health-functional'],
  },

  {
    id: 'male-introvert-quiet-44',
    label: 'Nam introvert quiet, 44 tuổi',
    gender: 'male',
    ageRange: '35-45',
    occupation: 'Văn phòng / kế toán / engineer',
    lifestyle: 'Urban / suburban, gia đình hoặc độc thân, ít socialize',
    personalityVibe: 'gentle-introvert',
    wordingTendency: 'careful, hay observation thay vì statement, "tôi để ý thấy..."',
    shamePatterns: [
      'đứng dậy sau cuộc họp dài, đầu gối kêu — đồng nghiệp nghe được',
      'ngồi café với bạn cũ, không kể được lý do mình mệt',
      'tóc rụng trên gối — sáng nào cũng quét đi',
    ],
    contradictions: [
      'nói "không quan tâm" nhưng note triệu chứng vào điện thoại',
      'gọi mình "vẫn ổn" nhưng quietly so sánh ảnh 5 năm trước',
    ],
    socialContextPreference: ['solitary-internal', 'work-centered'],
    compatibleNiches: ['supplement-wellness', 'health-functional', 'haircare'],
  },

  {
    id: 'male-family-provider-46',
    label: 'Nam gia trưởng provider, 46 tuổi',
    gender: 'male',
    ageRange: '35-45',
    occupation: 'Quản lý / chủ doanh nghiệp / sales senior',
    lifestyle: 'Suburban, gia đình 2-3 con, chu cấp cả nhà',
    personalityVibe: 'practical-direct',
    wordingTendency: 'practical, family-protective, "vì con", "vì gia đình"',
    shamePatterns: [
      'không kể vợ chuyện mệt — sợ vợ lo',
      'đi cầu thang chậm lại sau khi tụi nhỏ đã lên',
      'tự nhận trông già hơn ảnh năm ngoái',
    ],
    contradictions: [
      'lo cho cả nhà nhưng bỏ bê chính mình — biết nhưng chưa đổi',
      'nói "chưa cần khám" nhưng đêm khuya search triệu chứng',
    ],
    socialContextPreference: ['family-centered', 'work-centered'],
    compatibleNiches: ['supplement-wellness', 'health-functional'],
  },

  // ═══ Cross-niche ═══
  {
    id: 'female-empty-nest-50',
    label: 'Nữ empty-nest, 50 tuổi',
    gender: 'female',
    ageRange: '45-55',
    occupation: 'Bán part-time / retired / volunteer',
    lifestyle: 'Suburban, con đã đi học xa hoặc lấy chồng',
    personalityVibe: 'warm-maternal',
    wordingTendency: 'reflective, hay nostalgia references, "ngày con còn nhỏ..."',
    shamePatterns: [
      'soi gương buổi sáng, không nhận ra phiên bản này của mình',
      'né các bữa họp lớp vì sợ so sánh',
      'mở album cũ rồi tắt đi',
    ],
    contradictions: [
      'nhẹ nhõm khi con đi nhưng cũng cảm thấy trống',
      'tự bảo "phải sống cho mình" nhưng chưa biết bắt đầu từ đâu',
    ],
    socialContextPreference: ['solitary-internal', 'community-social'],
    compatibleNiches: ['skincare', 'supplement-wellness', 'health-functional', 'haircare'],
  },

  {
    id: 'female-sales-sedentary-40',
    label: 'Nữ sales/retail sedentary, 40 tuổi',
    gender: 'female',
    ageRange: '35-45',
    occupation: 'Sales / receptionist / cashier — đứng hoặc ngồi cả ngày',
    lifestyle: 'Urban, lifestyle cố định, gia đình hoặc độc thân',
    personalityVibe: 'practical-direct',
    wordingTendency: 'task-focused, hay "tới chiều", "tới tối", grounded trong daily routine',
    shamePatterns: [
      'đứng ở quầy 4-5 tiếng — về nhà nằm ngay không nấu ăn nổi',
      'khớp gối kêu khi đứng dậy giữa khách',
      'tóc mệt đến mức không buộc lên được',
    ],
    contradictions: [
      'nói "công việc nào cũng vậy" nhưng cơ thể đang report khác',
      'tự bảo "trẻ chán" nhưng đi siêu thị xong phải ngồi nghỉ',
    ],
    socialContextPreference: ['work-centered', 'public-self-conscious'],
    compatibleNiches: ['health-functional', 'supplement-wellness', 'skincare'],
  },
]

/** Filter archetypes compatible với niche. */
export function archetypesForNiche(niche: string): NarratorArchetype[] {
  return NARRATOR_ARCHETYPES.filter((a) => (a.compatibleNiches as string[]).includes(niche))
}

/** Compose narrator brief for prompt injection — compact, distilled. */
export function narratorBrief(archetype: NarratorArchetype): string {
  const lines = [
    `${archetype.label} — ${archetype.gender}, ${archetype.ageRange}`,
    `Lifestyle: ${archetype.lifestyle}`,
    `Occupation: ${archetype.occupation}`,
    `Personality: ${archetype.personalityVibe}`,
    `Voice tendency: ${archetype.wordingTendency}`,
    `Shame patterns (use 1-2 lived moments):`,
    ...archetype.shamePatterns.slice(0, 3).map((s) => `  - ${s}`),
    `Micro-contradictions (humans are inconsistent — embody these):`,
    ...archetype.contradictions.map((c) => `  - ${c}`),
    `Social-context preference: ${archetype.socialContextPreference.join(' / ')}`,
  ]
  return lines.join('\n')
}
