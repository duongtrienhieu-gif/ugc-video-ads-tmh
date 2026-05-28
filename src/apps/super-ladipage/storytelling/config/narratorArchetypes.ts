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
    psychologyDriver: 'reflective-acceptance',
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
    psychologyDriver: 'vanity-sensitive',
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
    psychologyDriver: 'emotionally-tired',
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
    psychologyDriver: 'driven-ambitious',
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
    psychologyDriver: 'bitter-resentful',
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
    psychologyDriver: 'reflective-acceptance',
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
    psychologyDriver: 'blunt-cộc',
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
    psychologyDriver: 'driven-ambitious',
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
    psychologyDriver: 'socially-anxious',
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
    psychologyDriver: 'practical-no-bullshit',
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
    psychologyDriver: 'reflective-acceptance',
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
    psychologyDriver: 'practical-no-bullshit',
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

  // ═══ v5.7 Chunk 3 — new psychology-driven archetypes ═══════════════
  // Per user direction: existing 12 all defaulted to reflective-acceptance feel.
  // These 10 cover psychology drivers that weren't represented.

  {
    id: 'female-skeptical-defensive-37',
    label: 'Nữ skeptical/defensive, 37 tuổi',
    gender: 'female',
    ageRange: '35-45',
    occupation: 'HR / kế toán / customer service',
    lifestyle: 'Urban, partnered, đã thử nhiều sản phẩm và thất vọng',
    personalityVibe: 'practical-direct',
    psychologyDriver: 'skeptical-defensive',
    wordingTendency: 'tests every claim, hay "trước giờ tôi đã thử...", "đừng tin quảng cáo, tôi thử mới biết"',
    shamePatterns: [
      'kệ tủ thuốc đầy lọ chưa dùng xong từ những lần trước',
      'không kể chồng mua thêm cái mới vì sợ bị nói "lại nữa hả"',
      'reorder cùng 1 sản phẩm rồi tự hỏi "có phải mình bị placebo"',
    ],
    contradictions: [
      'tự gọi mình "đã hết tin sản phẩm" nhưng vẫn đọc review 2-3 tiếng tối',
      'bảo "đang dùng chai cuối" rồi mua thêm 2 chai dự trữ',
    ],
    socialContextPreference: ['solitary-internal', 'work-centered'],
    compatibleNiches: ['skincare', 'supplement-wellness', 'haircare', 'health-functional'],
  },

  {
    id: 'female-oversharing-anxious-34',
    label: 'Nữ oversharing/anxious, 34 tuổi',
    gender: 'female',
    ageRange: '25-35',
    occupation: 'Freelancer / kinh doanh online',
    lifestyle: 'Urban, partnered, social-media-active',
    personalityVibe: 'warm-maternal',
    psychologyDriver: 'oversharing-anxious',
    wordingTendency: 'dumps full context, hay "thật ra chuyện này dài dòng lắm", "kể cho mọi người nghe luôn..."',
    shamePatterns: [
      'kể chuyện cơ thể với bạn không thân, sau đó cảm thấy mình share quá',
      'screenshot triệu chứng gửi nhóm chat hỏi đủ người',
      'post FB ẩn về sức khỏe, comment tự reply tự an ủi',
    ],
    contradictions: [
      'nói "không muốn ai biết" nhưng kể nửa giờ với người mới gặp',
      'bảo "không nhạy cảm đâu" rồi khóc khi đọc bài chia sẻ của người lạ',
    ],
    socialContextPreference: ['community-social', 'family-centered'],
    compatibleNiches: ['mom-baby', 'supplement-wellness', 'skincare', 'relationship'],
  },

  {
    id: 'female-bitter-resentful-43',
    label: 'Nữ bitter/resentful, 43 tuổi',
    gender: 'female',
    ageRange: '35-45',
    occupation: 'Đã ngừng làm, hoặc làm việc kém hấp dẫn',
    lifestyle: 'Suburban, partnered có con, cảm giác bị "stuck"',
    personalityVibe: 'reserved-thoughtful',
    psychologyDriver: 'bitter-resentful',
    wordingTendency: 'đắng cay nhẹ, hay "đáng lẽ tôi đã...", "không ai nói cho tôi biết..."',
    shamePatterns: [
      'so sánh thầm với bạn cùng lớp giờ đã thành công hơn',
      'né các cuộc họp lớp / sự kiện gặp bạn cũ',
      'tự nhủ "chấp nhận thôi" rồi 11 giờ đêm vẫn nằm tức',
    ],
    contradictions: [
      'nói "không quan tâm so sánh" nhưng follow secretly profile của họ',
      'tự bảo "mình hài lòng" nhưng đêm khuya tìm cách reset cuộc đời',
    ],
    socialContextPreference: ['solitary-internal', 'family-centered'],
    compatibleNiches: ['skincare', 'supplement-wellness', 'health-functional', 'beauty-confidence'],
  },

  {
    id: 'female-emotionally-detached-39',
    label: 'Nữ emotionally detached, 39 tuổi',
    gender: 'female',
    ageRange: '35-45',
    occupation: 'Doctor / engineer / data analyst — analytical job',
    lifestyle: 'Urban, partnered or single, ít socialize, observes self from outside',
    personalityVibe: 'reserved-thoughtful',
    psychologyDriver: 'emotionally-detached',
    wordingTendency: 'observational, hay "tôi nhận thấy bản thân...", "có vẻ như cơ thể đang...", treats self as case study',
    shamePatterns: [
      'không cảm thấy gì khi đọc một câu chuyện cảm động — tự lo lắng',
      'báo bác sĩ "đau" nhưng trong đầu không thực sự cảm thấy',
      'chồng hỏi "có sao không" trả lời "không" mà thật sự không biết',
    ],
    contradictions: [
      'tự gọi mình "không cảm xúc" nhưng khóc 5 phút trong xe rồi quên',
      'bảo "phân tích là cách tốt nhất" nhưng đêm khuya body shuts down',
    ],
    socialContextPreference: ['solitary-internal', 'work-centered'],
    compatibleNiches: ['supplement-wellness', 'health-functional', 'skincare'],
  },

  {
    id: 'female-insecure-doubting-29',
    label: 'Nữ insecure/doubting, 29 tuổi',
    gender: 'female',
    ageRange: '25-35',
    occupation: 'Junior office / vừa ra trường vài năm',
    lifestyle: 'Urban, single hoặc partnered no kids, comparing self constantly',
    personalityVibe: 'soft-spoken-caring',
    psychologyDriver: 'insecure-doubting',
    wordingTendency: 'qualifies everything, hay "không biết có phải mình quá nhạy không", "có thể là tôi tưởng tượng..."',
    shamePatterns: [
      'so sánh ảnh mình với coworker, sau đó xóa ảnh tự chụp',
      'mua thêm sản phẩm dù không cần — vì influencer dùng',
      'tự hỏi "có khi nào ai đó để ý mình..." mà thật sự không ai',
    ],
    contradictions: [
      'tự bảo "đừng so sánh" nhưng scroll IG 2 tiếng/đêm',
      'nói "không tự ti" nhưng deletes 7 selfies cho 1 cái',
    ],
    socialContextPreference: ['public-self-conscious', 'solitary-internal'],
    compatibleNiches: ['skincare', 'haircare', 'beauty-confidence', 'supplement-wellness'],
  },

  {
    id: 'male-bitter-passed-over-47',
    label: 'Nam bitter/passed-over, 47 tuổi',
    gender: 'male',
    ageRange: '45-55',
    occupation: 'Middle-management — career stuck',
    lifestyle: 'Suburban, partnered, đã chứng kiến đồng nghiệp trẻ vượt mình',
    personalityVibe: 'practical-direct',
    psychologyDriver: 'bitter-resentful',
    wordingTendency: 'sarcastic edge, hay "tuổi này còn cần gì nữa", "ai mà chẳng đi qua giai đoạn này"',
    shamePatterns: [
      'kẹp tay dưới bàn họp khi nghe trẻ nói "anh có nhớ thời 2010..."',
      'nhìn ảnh năm 2015 thấy người khác hẳn',
      'không kể bạn rằng đã đi khám tổng quát',
    ],
    contradictions: [
      'bảo "chấp nhận già" nhưng tự đo eo mỗi tuần',
      'nói "không cạnh tranh nữa" nhưng đọc về thằng đồng nghiệp được thăng chức',
    ],
    socialContextPreference: ['work-centered', 'solitary-internal'],
    compatibleNiches: ['supplement-wellness', 'health-functional'],
  },

  {
    id: 'male-emotionally-tired-50',
    label: 'Nam emotionally-tired, 50 tuổi',
    gender: 'male',
    ageRange: '45-55',
    occupation: 'Quản lý lâu năm, làm việc đều đặn không hứng thú',
    lifestyle: 'Suburban, gia đình con đã lớn, "auto-pilot mode"',
    personalityVibe: 'gentle-introvert',
    psychologyDriver: 'emotionally-tired',
    wordingTendency: 'flat tone, hay "dạo này tôi cũng không biết nói gì", "mọi thứ vẫn vậy thôi"',
    shamePatterns: [
      'ngồi xe vài phút trước khi vào nhà, không lý do',
      'không hứng thú với weekend dù tự nhủ "phải tận hưởng"',
      'vợ hỏi "có sao không" — trả lời "không" mà không biết thật sự ra sao',
    ],
    contradictions: [
      'tự bảo "mọi thứ ổn" nhưng zone out giữa bữa cơm gia đình',
      'nói "không cần nghỉ" nhưng nghỉ phép cũng không thấy refresh',
    ],
    socialContextPreference: ['solitary-internal', 'family-centered'],
    compatibleNiches: ['supplement-wellness', 'health-functional'],
  },

  {
    id: 'female-ego-driven-image-36',
    label: 'Nữ ego-driven/image, 36 tuổi',
    gender: 'female',
    ageRange: '35-45',
    occupation: 'Sales senior / business owner / influencer side',
    lifestyle: 'Urban, partnered, image-aware, social-media-active',
    personalityVibe: 'practical-direct',
    psychologyDriver: 'ego-driven-image',
    wordingTendency: 'confident surface, hay "tôi vẫn ổn lắm", "không như mọi người nghĩ", maintains-image tone',
    shamePatterns: [
      'né các sự kiện vì không tìm được outfit phù hợp dáng mới',
      'từ chối lời mời ăn trưa của bạn cũ vì sợ so sánh',
      'edit ảnh trước khi gửi cho gia đình',
    ],
    contradictions: [
      'public Instagram tươi tắn nhưng đêm về soi gương khóc nhẹ',
      'nói "không quan tâm người khác nghĩ" nhưng theo dõi reaction từng post',
    ],
    socialContextPreference: ['public-self-conscious', 'work-centered'],
    compatibleNiches: ['skincare', 'haircare', 'beauty-confidence', 'supplement-wellness'],
  },

  {
    id: 'female-blunt-cộc-46',
    label: 'Nữ blunt/cộc, 46 tuổi',
    gender: 'female',
    ageRange: '45-55',
    occupation: 'Tiểu thương / chủ cửa hàng / đầu bếp',
    lifestyle: 'Urban hoặc thị xã, working-class hands-on',
    personalityVibe: 'practical-direct',
    psychologyDriver: 'blunt-cộc',
    wordingTendency: 'cứng, no-softening, hay "tao bảo rồi", "thẳng tuột thôi", không vòng vo',
    shamePatterns: [
      'đứng quầy 8 tiếng, khớp đau, không kêu — sợ bị bảo "yếu"',
      'tự nhủ "đàn bà phải cứng" rồi đêm về khóc 1 mình',
      'không kể con cái mệt — sợ chúng lo',
    ],
    contradictions: [
      'gọi mình "không sợ gì" nhưng tránh đi khám sức khỏe định kỳ',
      'bảo "chuyện vặt" rồi sáng dậy không nhấc nổi tay',
    ],
    socialContextPreference: ['work-centered', 'family-centered'],
    compatibleNiches: ['health-functional', 'supplement-wellness'],
  },

  {
    id: 'female-vanity-sensitive-29',
    label: 'Nữ vanity-sensitive, 29 tuổi',
    gender: 'female',
    ageRange: '25-35',
    occupation: 'Marketing / branding / fashion',
    lifestyle: 'Urban, lifestyle image-aware, ám ảnh aging early',
    personalityVibe: 'soft-spoken-caring',
    psychologyDriver: 'vanity-sensitive',
    wordingTendency: 'sensitive to appearance language, hay "tôi biết nghe có vẻ nông cạn nhưng...", protects-vanity-as-real-stake',
    shamePatterns: [
      'soi gương 3 lần buổi sáng — phát hiện nếp nhăn dưới mắt',
      'so ảnh năm trước với năm nay — đếm thay đổi cụ thể',
      'mua skincare đắt sau khi nghe đồng nghiệp khen "vẫn trẻ trung"',
    ],
    contradictions: [
      'tự nhận "vanity không sai" rồi vẫn xin lỗi khi nói chuyện appearance',
      'bảo "không sợ già" nhưng tránh ảnh chụp nắng trực diện',
    ],
    socialContextPreference: ['public-self-conscious', 'work-centered'],
    compatibleNiches: ['skincare', 'haircare', 'beauty-confidence', 'supplement-wellness'],
  },
]

/** Filter archetypes compatible với niche. */
export function archetypesForNiche(niche: string): NarratorArchetype[] {
  return NARRATOR_ARCHETYPES.filter((a) => (a.compatibleNiches as string[]).includes(niche))
}

/** Compose narrator brief for prompt injection — compact, distilled.
 *  v5.7 Chunk 3: PSYCHOLOGY DRIVER surfaced prominently (most important field).
 *  Drives meaning of all other narrator fields. */
export function narratorBrief(archetype: NarratorArchetype): string {
  const lines = [
    `${archetype.label} — ${archetype.gender}, ${archetype.ageRange}`,
    `🎯 ROLE: VALIDATOR / BRIDGE — narrator joins reader from lived experience.`,
    `   NOT protagonist. NOT main character. Reader is emotional center, not narrator.`,
    `   Strongest in Phase 2 (narrator-validation blocks). Implicit/absent in Phase 1`,
    `   (reader-heavy blocks). Recedes in late Phase 4 (future-reader projection).`,
    `🧠 PSYCHOLOGY DRIVER (shapes voice when narrator surfaces): ${archetype.psychologyDriver}`,
    `Lifestyle: ${archetype.lifestyle}`,
    `Occupation: ${archetype.occupation}`,
    `Personality vibe (surface): ${archetype.personalityVibe}`,
    `Voice tendency: ${archetype.wordingTendency}`,
    `Shame patterns (use 1-2 lived moments to validate reader's similar experience):`,
    ...archetype.shamePatterns.slice(0, 3).map((s) => `  - ${s}`),
    `Micro-contradictions (humans are inconsistent — embody these):`,
    ...archetype.contradictions.map((c) => `  - ${c}`),
    `Social-context preference: ${archetype.socialContextPreference.join(' / ')}`,
  ]
  return lines.join('\n')
}
