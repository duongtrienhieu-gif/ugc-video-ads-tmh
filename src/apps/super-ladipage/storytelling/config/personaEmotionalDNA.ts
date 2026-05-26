// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — PERSONA EMOTIONAL DNA (v5.1)
//
// Per-niche emotional vocabulary, hidden fears, avoidance behaviors,
// identity threats, embodied vocabulary.
//
// Same product different niches = different emotional DNA. Engine
// stops reusing same emotional language across verticals.
//
// Coverage: 5 core niches first (skincare / haircare / health-functional /
// supplement-wellness / mom-baby). Expand later post-validation.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey, PersonaEmotionalDNA } from '../types'

export const PERSONA_EMOTIONAL_DNA: Partial<Record<NicheKey, PersonaEmotionalDNA>> = {
  'haircare': {
    niche: 'haircare',
    primaryEmotions: [
      'femininity-anxiety',
      'mirror-avoidance',
      'attractiveness-fear',
      'identity-loss',
    ],
    hiddenFears: [
      'mình không còn xinh như trước',
      'chồng/bạn trai bắt đầu nhìn thấy mình khác',
      'tóc tiếp tục mỏng đi không gì cản được',
      'phải đội mũ / che tóc cả đời',
    ],
    avoidanceBehaviors: [
      'tránh ánh sáng từ trên (đèn LED phòng họp, thang máy)',
      'né photo selfie nếu không có filter',
      'không buộc tóc cao trước người lạ',
      'mặc tóc xõa che vùng đỉnh đầu',
    ],
    identityThreats: [
      'không còn nhận ra phiên bản trẻ của mình',
      'cảm giác phụ nữ trong mình đang mờ đi',
    ],
    embodiedVocabulary: [
      'nhìn tóc trên tay sau khi gội đầu',
      'tóc bám ở chân khi đi tắm',
      'phải vén tóc che vùng trán/đỉnh',
      'soi gương trong xe rồi tắt camera trước',
      'gối ngủ có tóc rụng mỗi sáng',
      'lược chải tóc đầy sợi',
      'né bạn cũ vì sợ họ nhận ra khác',
    ],
  },

  'skincare': {
    niche: 'skincare',
    primaryEmotions: [
      'self-image-anxiety',
      'social-confidence-loss',
      'age-visibility-fear',
      'avoidance-behaviors',
    ],
    hiddenFears: [
      'da xuống cấp nhanh hơn các bạn cùng tuổi',
      'người ta nhận ra mình đang già đi',
      'không còn nhận lời khen "trẻ" như trước',
      'không che được dấu vết thời gian dù chăm sóc',
    ],
    avoidanceBehaviors: [
      'né ánh sáng trắng (siêu thị, đèn phòng họp)',
      'mở camera trước rồi tắt nhiều lần',
      'chọn ảnh có filter mới đăng',
      'nghiêng đầu khi soi gương để không thấy đường nét quá rõ',
    ],
    identityThreats: [
      'cảm giác mình đang lùi dần khỏi phiên bản trẻ',
      'tự ti khi gặp người mới',
    ],
    embodiedVocabulary: [
      'soi gương buổi sáng lâu hơn cần thiết',
      'sờ vùng mắt khi mệt — quầng thâm rõ hơn',
      'chỉnh ánh sáng phòng để selfie',
      'mua thêm kem mới nhưng routine cũ vẫn không đỡ',
      'tránh chụp ảnh gần với bạn cũ',
    ],
  },

  'health-functional': {
    niche: 'health-functional',
    primaryEmotions: [
      'movement-hesitation',
      'aging-realization',
      'dependency-fear',
      'physical-limitation-shame',
    ],
    hiddenFears: [
      'cơ thể đang xuống nhanh hơn dự đoán',
      'sẽ trở thành gánh nặng cho gia đình',
      'không còn chơi với cháu/con như muốn',
      'phải vịn cầu thang vĩnh viễn',
    ],
    avoidanceBehaviors: [
      'né cầu thang ở nơi công cộng',
      'không nói đau với người nhà',
      'giả vờ buộc dây giày để ngồi nghỉ',
      'không nhận lời đi xa với bạn cũ',
    ],
    identityThreats: [
      'cảm giác cơ thể không còn phục hồi nhanh như xưa',
      'mất tự tin về sức khỏe trước mặt con cái',
    ],
    embodiedVocabulary: [
      'đầu gối nhói khi đứng dậy bất chợt',
      'tay tê khi cầm điện thoại lâu',
      'phải ngồi vài giây trước khi đứng',
      'vịn lan can lên/xuống cầu thang',
      'đi siêu thị về phải nằm ngay',
      'mở tủ lạnh xong quên định lấy gì',
    ],
  },

  'supplement-wellness': {
    niche: 'supplement-wellness',
    primaryEmotions: [
      'chronic-fatigue-shame',
      'morning-dread',
      'cognitive-fog',
      'quality-of-life-erosion',
    ],
    hiddenFears: [
      'mệt suốt nhưng không có lý do "đủ to" để nghỉ',
      'tâm trí mờ — không tập trung như xưa',
      'không thấy chiều dài đời như xưa nữa',
      'phải uống cà phê cả ngày để function',
    ],
    avoidanceBehaviors: [
      'không lên lịch đi chơi cuối tuần — sợ không có sức',
      'không kể với chồng/vợ là mỗi sáng phải lấy can đảm dậy',
      'từ chối hẹn cà phê vào 3 giờ chiều',
      'mua thêm vitamin nhưng chưa uống đủ liều',
    ],
    identityThreats: [
      'cảm giác mình không còn là người energetic ngày xưa',
      'sợ trở thành người "luôn mệt" trong mắt mọi người',
    ],
    embodiedVocabulary: [
      'tỉnh dậy mệt hơn trước khi đi ngủ',
      'mí mắt sụp lúc 8 giờ tối',
      'không nghĩ được sau 3 giờ chiều',
      'pha cà phê thứ 3 trong ngày',
      'ngồi ở bàn 5 phút mà không nhớ định làm gì',
      'bỏ ly cà phê chiều giữa chừng',
    ],
  },

  'mom-baby': {
    niche: 'mom-baby',
    primaryEmotions: [
      'identity-shift',
      'invisible-exhaustion',
      'loss-of-self',
      'silent-overwhelm',
    ],
    hiddenFears: [
      'không nhận ra phiên bản mới của mình',
      'tóc rụng không phục hồi',
      'cơ thể không quay lại được như trước sinh',
      'không có ai hiểu mình mệt thế nào',
    ],
    avoidanceBehaviors: [
      'né gặp bạn cũ chưa có con',
      'không chụp ảnh trừ ảnh con',
      'không mua áo size mình bây giờ — vẫn nghĩ "sẽ giảm cân"',
    ],
    identityThreats: [
      'sự biến mất của phiên bản trước-khi-sinh',
      'không biết mình là ai ngoài "mẹ"',
    ],
    embodiedVocabulary: [
      'tóc rụng thành nắm khi gội đầu',
      'không nhận ra mình trong gương buổi sáng',
      'khóc một mình trong nhà tắm',
      'ngồi cho con bú lúc 3 giờ sáng, không thể ngủ lại',
      'mở album hình cũ rồi tắt đi',
      'mua áo size cũ về và nhét vào ngăn dưới cùng',
    ],
  },

  'beauty-confidence': {
    niche: 'beauty-confidence',
    primaryEmotions: [
      'attractiveness-anxiety',
      'social-visibility-fear',
      'attention-loss',
      'peer-comparison-fatigue',
    ],
    hiddenFears: [
      'mình đang xuống cấp nhanh hơn bạn cùng tuổi',
      'không còn được nhìn như trước',
      'sự attractiveness của mình đang fade',
      'lần gặp lại bạn cũ — họ sẽ nhận ra',
    ],
    avoidanceBehaviors: [
      'né bữa tụ tập đông người',
      'né selfie cùng bạn trẻ hơn',
      'mở filter app trước khi chụp ảnh',
      'lùi 1 bước khi soi gương buổi sáng',
    ],
    identityThreats: [
      'mất sự attention từ chồng/bạn trai',
      'không còn cảm thấy mình "looked-at"',
    ],
    embodiedVocabulary: [
      'mở camera lên — tắt — mở lại lần nữa',
      'chuyển ánh sáng phòng để selfie sáng hơn',
      'tay che cằm khi nói chuyện',
      'nghiêng đầu khi đứng cạnh bạn trẻ hơn',
      'cảm giác da căng + thô khi vừa rửa mặt',
    ],
  },

  'relationship': {
    niche: 'relationship',
    primaryEmotions: [
      'emotional-flatness',
      'snapping-guilt',
      'overstimulation-fatigue',
      'warmth-loss',
    ],
    hiddenFears: [
      'mình đang trở thành người cộc tính',
      'chồng/bạn trai bắt đầu để ý mình thay đổi',
      'sẽ mất kết nối với con vì không có patience',
      'mình không còn là người ấm như trước',
    ],
    avoidanceBehaviors: [
      'né cuộc gọi từ mẹ hoặc bạn thân',
      'lấy cớ bận để không đi tụ tập',
      'vào phòng riêng sau bữa tối',
      'ngồi lâu trong xe trước khi vào nhà',
    ],
    identityThreats: [
      'không còn là người ấm áp như trước',
      'sẽ cô đơn dù xung quanh có người',
    ],
    embodiedVocabulary: [
      'ngồi 10 phút trong xe trước khi xuống đón con',
      'đeo tai nghe khi đi siêu thị để giảm noise',
      'cười nhanh rồi quay đi — không kéo dài',
      'thở ra dài khi nghe ai bắt đầu kể chuyện',
      'né ăn tối cùng cả nhà — viện cớ bận',
    ],
  },

  'fitness-recovery': {
    niche: 'fitness-recovery',
    primaryEmotions: [
      'mobility-loss-fear',
      'aging-body-shame',
      'capacity-erosion',
      'medication-dependency-anxiety',
    ],
    hiddenFears: [
      'không còn vận động như trước',
      'sẽ bị ràng buộc với thuốc giảm đau dài hạn',
      'không leo núi / đi xa được nữa',
      'phải phẫu thuật khớp trong tương lai gần',
    ],
    avoidanceBehaviors: [
      'không nhận lời đi du lịch dài ngày',
      'tránh mang vác đồ nặng',
      'né tham gia môn thể thao bạn rủ',
      'né cầu thang ở nơi công cộng',
    ],
    identityThreats: [
      'cảm giác cơ thể không còn phục hồi nhanh như xưa',
      'sợ trở thành "người đau ốm" trong mắt mọi người',
    ],
    embodiedVocabulary: [
      'đầu gối nhói khi xuống cầu thang',
      'phải ngồi vài giây trước khi đứng',
      'mua dầu nóng / miếng dán dự trữ',
      'tự massage đầu gối/lưng mỗi tối',
      'né đi du lịch trekking với bạn',
    ],
  },
}

/** Get DNA for niche — falls back to generic if niche not mapped. */
export function getEmotionalDnaForNiche(niche: NicheKey): PersonaEmotionalDNA | null {
  return PERSONA_EMOTIONAL_DNA[niche] ?? null
}

/** Compose DNA brief for prompt injection — compact distilled. */
export function emotionalDnaBrief(dna: PersonaEmotionalDNA): string {
  return [
    `Niche emotional DNA — ${dna.niche}:`,
    `  Primary emotions: ${dna.primaryEmotions.join(' / ')}`,
    `  Hidden fears (reader carries — rarely articulated):`,
    ...dna.hiddenFears.slice(0, 3).map((f) => `    - ${f}`),
    `  Avoidance behaviors (use 1-2 in story):`,
    ...dna.avoidanceBehaviors.slice(0, 3).map((b) => `    - ${b}`),
    `  Identity threats: ${dna.identityThreats.join(' / ')}`,
    `  Embodied vocabulary (sample 2-3 across sections, vary across packs):`,
    ...dna.embodiedVocabulary.slice(0, 5).map((v) => `    - ${v}`),
  ].join('\n')
}
