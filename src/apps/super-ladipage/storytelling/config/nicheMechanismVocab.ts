// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — NICHE MECHANISM VOCAB (Chunk C2)
//
// Niche-specific concrete mechanism vocabulary to PREVENT generic AI
// wellness fingerprints ("từ bên trong" / "gốc rễ" / "nuôi dưỡng" /
// "cân bằng") across packs.
//
// Each niche owns:
//   - mechanismVocab: concrete domain language (nang tóc, da đầu, nhịp
//     cơ thể, skin barrier, pin cạn) — narrator uses these naturally
//   - mechanismFrames: 3 structural frames for explaining "why this works"
//     through felt difference — sampled per pack
//   - bannedGenericPhrases: forbidden generic abstractions per niche
//
// Goal: mechanism explanation creates DISTINCT MENTAL IMAGERY +
// MEMORABILITY per niche. NOT interchangeable wellness language.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey } from '../types'

export interface NicheMechanismVocab {
  niche: NicheKey
  /** Concrete domain mechanism vocabulary (use 2-3 per pack). */
  mechanismVocab: string[]
  /** Structural frames for mechanism explanation (sampled 1 per pack). */
  mechanismFrames: string[]
  /** Generic abstractions to AVOID for this niche (validator flag if present). */
  bannedGenericPhrases: string[]
}

export const NICHE_MECHANISM_VOCAB: Record<NicheKey, NicheMechanismVocab> = {
  'haircare': {
    niche: 'haircare',
    mechanismVocab: [
      'nang tóc',
      'da đầu yếu',
      'sợi tóc mảnh dần',
      'tóc không còn bám chắc',
      'cycle of shedding',
      'phù sa nuôi tóc',
      'pH da đầu',
      'môi trường da đầu',
    ],
    mechanismFrames: [
      'không phải "kích thích mọc nhanh" — mà là làm nang tóc khỏe lại để GIỮ tóc',
      'cái yếu nằm ở da đầu, không phải sợi tóc — sợi mạnh tới đâu mà nang yếu thì vẫn rụng',
      'không che — không kích — chỉ làm môi trường nang ổn định lại',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'cân bằng cơ thể', 'phục hồi tự nhiên', 'hài hoà cơ thể',
    ],
  },

  'skincare': {
    niche: 'skincare',
    mechanismVocab: [
      'skin barrier',
      'lớp bảo vệ tự nhiên',
      'da phản ứng với stress',
      'sắc da xỉn',
      'cell turnover',
      'tone da thiếu sức sống',
      'da tự phục hồi',
    ],
    mechanismFrames: [
      'không phải "trắng da nhanh" — mà là làm lớp barrier khỏe lại để da TỰ giữ ẩm',
      'cái thiếu nằm ở barrier bị yếu — không phải kem chưa đủ — đắp thêm bao nhiêu cũng vô ích',
      'không bóc — không tẩy — chỉ làm da nhớ lại cách hoạt động bình thường',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'cân bằng cơ thể', 'phục hồi tự nhiên', 'lành mạnh từ trong ra',
    ],
  },

  'supplement-wellness': {
    niche: 'supplement-wellness',
    mechanismVocab: [
      'nhịp cơ thể',
      'dao động nội tiết',
      'hệ thống bị lệch nhịp',
      'cơ thể không còn hồi phục đúng',
      'pin cạn không recharge nổi',
      'nervous system overload',
      'wake-up fatigue',
    ],
    mechanismFrames: [
      'không phải "tăng năng lượng" — mà là cho cơ thể recharge đúng cách trong khi mình ngủ',
      'cái lệch nằm ở nhịp cơ thể, không phải thiếu năng lượng — uống thêm cà phê chỉ làm lệch thêm',
      'không kích — không ép — chỉ trả lại nhịp tự nhiên cho hệ thống đang quá tải',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'cân bằng cơ thể', 'phục hồi tự nhiên', 'tăng cường sức khỏe',
    ],
  },

  'health-functional': {
    niche: 'health-functional',
    mechanismVocab: [
      'khớp + sụn',
      'collagen type 2',
      'sự bôi trơn khớp',
      'mật độ xương',
      'phục hồi tế bào sụn',
      'cơ thể không còn tự sửa chữa nhanh',
    ],
    mechanismFrames: [
      'không phải "hết đau ngay" — mà là cho khớp đủ nguyên liệu để TỰ phục hồi sụn',
      'cái thiếu nằm ở sụn đang mòn dần, không phải đau bề mặt — uống giảm đau che chứ không sửa',
      'không tê — không lạnh — chỉ cung cấp đủ thứ cơ thể đang thiếu để tự fix',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'cân bằng cơ thể', 'phục hồi tự nhiên', 'tăng cường sức khỏe',
    ],
  },

  'mom-baby': {
    niche: 'mom-baby',
    mechanismVocab: [
      'tóc rụng postpartum',
      'nội tiết tố sau sinh',
      'cơ thể cần thời gian recalibrate',
      'thiếu hụt vi chất do cho con bú',
      'hormone shift gây rụng tóc',
    ],
    mechanismFrames: [
      'không phải "lấy lại form" — mà là cho cơ thể nguồn vi chất bị rút đi khi nuôi con',
      'cái rụng tóc sau sinh không phải lỗi của mẹ — là hormone tự nhiên đang reset',
      'không ép — không giảm cân — chỉ trả lại những thứ cơ thể đã cho con',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'cân bằng cơ thể', 'phục hồi tự nhiên',
    ],
  },

  'beauty-confidence': {
    niche: 'beauty-confidence',
    mechanismVocab: [
      'skin radiance',
      'sắc da bị stress làm xỉn',
      'da phản ứng với thiếu ngủ',
      'da không còn bắt sáng',
      'micro-inflammation skin',
      'tone da uneven',
    ],
    mechanismFrames: [
      'không phải "trắng tức thì" — mà là làm da bắt sáng lại như khi còn trẻ',
      'cái xỉn không phải do thiếu kem — mà do da đang stress + viêm vi mô từ thiếu ngủ + môi trường',
      'không che — không filter — chỉ làm da khỏe đủ để tự sáng',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'cân bằng cơ thể', 'phục hồi tự nhiên',
    ],
  },

  'relationship': {
    niche: 'relationship',
    mechanismVocab: [
      'emotional reserve',
      'overstimulation threshold',
      'patience capacity',
      'nervous system fatigue',
      'cảm xúc cạn pin',
      'không có emotional bandwidth',
    ],
    mechanismFrames: [
      'không phải "vui hơn" — mà là hồi phục emotional reserve để mình có patience trở lại',
      'cái cộc tính không phải personality — là nervous system đang quá tải kéo dài',
      'không ép — không tự trách — chỉ cho hệ thần kinh nghỉ đủ để cảm xúc hoạt động bình thường',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'cân bằng cơ thể', 'phục hồi tự nhiên', 'an yên tâm hồn',
    ],
  },

  'fitness-recovery': {
    niche: 'fitness-recovery',
    mechanismVocab: [
      'sự bôi trơn khớp',
      'sụn mòn dần',
      'inflammation khớp',
      'recovery time tăng theo tuổi',
      'cycle viêm khớp',
      'cơ phục hồi chậm',
    ],
    mechanismFrames: [
      'không phải "giảm đau ngay" — mà là cho khớp đủ nguyên liệu để TỰ giảm viêm',
      'cái đau bề mặt chỉ là dấu hiệu — sụn bên trong mới là chỗ cần được hỗ trợ',
      'không tê — không nóng — chỉ cung cấp đủ thứ cơ thể đang thiếu để recovery quay lại',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'cân bằng cơ thể', 'phục hồi tự nhiên',
    ],
  },

  // ── Tier S extensions (2026-05-27) ──

  'sleep-insomnia': {
    niche: 'sleep-insomnia',
    mechanismVocab: [
      'sleep cycle',
      'melatonin rhythm',
      'deep-sleep window',
      'mind racing pattern',
      'sleep latency (thời gian thiếp đi)',
      'REM disruption',
      'circadian shift',
      'cortisol cao đêm',
    ],
    mechanismFrames: [
      'không phải "knockout ngủ ngay" — mà là làm sleep cycle quay về tự nhiên',
      'cái khó không phải đi ngủ — mà là MIND vẫn chạy khi cơ thể đã mệt',
      'không thuốc ngủ — chỉ cho cơ thể đủ tín hiệu để chuyển sang chế độ nghỉ',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'thư giãn sâu sắc', 'cân bằng cơ thể',
    ],
  },

  'menopause': {
    niche: 'menopause',
    mechanismVocab: [
      'estrogen drop',
      'hormone fluctuation',
      'hot flash pattern',
      'sleep-mood-hormone loop',
      'phyto-estrogen',
      'adrenal support',
      'transition rhythm',
      'menstrual irregularity',
    ],
    mechanismFrames: [
      'không phải "stop menopause" — mà là làm phase transition êm hơn',
      'cái thay đổi là hormone — body không sai, chỉ là đang chuyển sang phase khác',
      'không hormone replacement — chỉ cung cấp đủ phytochemical để cơ thể tự điều chỉnh',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'thanh xuân vĩnh cửu', 'trẻ lại',
    ],
  },

  'mental-health': {
    niche: 'mental-health',
    mechanismVocab: [
      'cortisol baseline',
      'GABA pathway',
      'nervous system regulation',
      'fight-or-flight stuck on',
      'serotonin support',
      'adaptogenic response',
      'stress threshold',
      'parasympathetic activation',
    ],
    mechanismFrames: [
      'không phải "chữa lo âu" — mà là cho nervous system reset baseline',
      'cái căng không phải tâm trí — mà là cơ thể stuck trong fight-or-flight',
      'không thuốc thần kinh — chỉ cho cortisol pathway thời gian xuống',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'cân bằng tâm hồn', 'hạnh phúc bên trong',
    ],
  },

  'anti-aging-longevity': {
    niche: 'anti-aging-longevity',
    mechanismVocab: [
      'cellular senescence',
      'mitochondrial decline',
      'NAD+ depletion theo tuổi',
      'autophagy slowdown',
      'telomere shortening',
      'oxidative stress accumulation',
      'biological age vs chronological',
      'healthspan window',
    ],
    mechanismFrames: [
      'không phải "young forever" — mà là kéo dài healthspan (years lived vital)',
      'cái già không phải bề mặt — mà là cellular machinery chậm dần từ tuổi 30+',
      'không reverse aging — chỉ cung cấp đủ nguyên liệu cho cellular maintenance',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'thanh xuân vĩnh cửu', 'trẻ mãi không già',
    ],
  },

  // ── SEA-6 extensions (2026-05-27) ──

  'dental-oral-care': {
    niche: 'dental-oral-care',
    mechanismVocab: [
      'mảng bám vi khuẩn',
      'vi khuẩn yếm khí kẽ răng',
      'men răng yếu dần',
      'nướu viêm âm thầm',
      'pH miệng bị acid',
      'oral microbiome',
      'tartar / cao răng',
      'tủy răng nhạy cảm',
    ],
    mechanismFrames: [
      'không phải "trắng răng nhanh" — mà là làm môi trường miệng trở về sạch tự nhiên',
      'cái hơi thở hôi không phải do thức ăn — là vi khuẩn yếm khí kẽ răng không bàn chải nào tới được',
      'không tẩy — không bào mòn — chỉ là làm mảng bám không có chỗ bám',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'tươi mới sảng khoái', 'tỏa sáng nụ cười',
    ],
  },

  'diabetes-blood-sugar': {
    niche: 'diabetes-blood-sugar',
    mechanismVocab: [
      'glucose spike sau bữa ăn',
      'insulin resistance',
      'A1C chỉ số 3 tháng',
      'fasting glucose buổi sáng',
      'pancreas mệt mỏi',
      'inflammation chuyển hóa',
      'beta-cell function',
      'sugar baseline ổn định',
    ],
    mechanismFrames: [
      'không phải "hết tiểu đường" — mà là giúp glucose spike sau bữa ăn không bị quá cao',
      'cái thiếu không phải insulin — mà là pancreas cần hỗ trợ + giảm tải đường',
      'không thay thế thuốc — chỉ là làm cơ thể dễ xử lý đường hơn',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'chữa khỏi hoàn toàn', 'thần dược', 'sức khỏe vàng',
    ],
  },

  'liver-detox': {
    niche: 'liver-detox',
    mechanismVocab: [
      'men gan ALT / AST',
      'gan nhiễm mỡ độ 1-2',
      'phase 1 / phase 2 detox pathway',
      'gan quá tải bia rượu',
      'glutathione liver support',
      'mỡ tích trong gan',
      'liver filtration capacity',
      'milk thistle / silymarin',
    ],
    mechanismFrames: [
      'không phải "thải độc toàn cơ thể" — mà là hỗ trợ phase 2 detox của gan',
      'cái mỡ tích trong gan không hiện ra ngoài — chỉ men gan tăng âm thầm 5-7 năm',
      'không kích — không xổ — chỉ cung cấp đủ glutathione cho gan tự xử lý',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'thải độc tận gốc', 'lọc sạch cơ thể', 'tinh khiết',
    ],
  },

  'prostate-urology': {
    niche: 'prostate-urology',
    mechanismVocab: [
      'tuyến tiền liệt phì đại BPH',
      'tiểu đêm 2-3 lần',
      'tia tiểu yếu / ngắt quãng',
      'PSA chỉ số',
      'DHT chuyển hóa',
      'saw palmetto / beta-sitosterol',
      'bladder pressure',
      'urinary flow rate',
    ],
    mechanismFrames: [
      'không phải "trẻ lại sinh lý nam" — mà là làm tuyến tiền liệt không phì đại thêm',
      'cái tiểu đêm 3 lần không phải do uống nhiều nước — là tuyến tiền liệt chèn vào bàng quang',
      'không hormone — chỉ ức chế DHT chuyển hóa làm tuyến tiền liệt phì đại',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'phong độ đàn ông', 'sức mạnh nam giới', 'trở lại tuổi thanh xuân',
    ],
  },

  'hemorrhoids-digestive-shame': {
    niche: 'hemorrhoids-digestive-shame',
    mechanismVocab: [
      'búi trĩ nội / ngoại',
      'tĩnh mạch hậu môn giãn',
      'táo bón mạn 3-4 ngày',
      'phân khô + cứng',
      'rặn nhiều áp lực vùng chậu',
      'diosmin / hesperidin (vein support)',
      'pelvic floor pressure',
      'chất xơ + nước không đủ',
    ],
    mechanismFrames: [
      'không phải "hết trĩ ngay" — mà là làm tĩnh mạch hậu môn co lại + giảm viêm',
      'cái đau khi đi vệ sinh không phải vệ sinh sai — là tĩnh mạch giãn không tự co được',
      'không cắt — không đốt — chỉ là làm thành mạch khỏe để búi tự rút',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'thoải mái sảng khoái', 'tự tin trở lại',
    ],
  },

  'eye-vision-care': {
    niche: 'eye-vision-care',
    mechanismVocab: [
      'mỏi mắt screen-time',
      'khô mắt do giảm chớp',
      'lutein + zeaxanthin macular',
      'blue light damage',
      'eye fatigue pattern',
      'thoái hóa điểm vàng (AMD)',
      'tear film stability',
      'ciliary muscle căng',
    ],
    mechanismFrames: [
      'không phải "tăng thị lực" — mà là làm mắt chịu được screen-time dài hơn',
      'cái mỏi mắt cuối ngày không phải do nhìn quá nhiều — là tear film bị bay hơi vì giảm chớp',
      'không phẫu thuật — chỉ là cung cấp lutein + omega cho võng mạc',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'sáng như đèn pha', 'thị lực thần kỳ',
    ],
  },

  // ── SPEC-FIX (2026-05-27) — health-functional split ──

  'health-respiratory': {
    niche: 'health-respiratory',
    mechanismVocab: [
      'niêm mạc mũi viêm',
      'xoang bị tắc do chất nhầy',
      'vi khuẩn yếm khí trong xoang',
      'lông mao mũi (cilia) yếu',
      'allergen pollen / bụi mịn / mạt nhà',
      'histamine release',
      'nasal congestion cycle',
      'thở miệng đêm — khô họng',
    ],
    mechanismFrames: [
      'không phải "thông mũi tức thì" — mà là làm dịu niêm mạc + giảm sưng',
      'cái nghẹt không phải do mũi tắc — là niêm mạc bị viêm phồng lên chèn vào đường thở',
      'không co mạch — không gây phụ thuộc — chỉ làm sạch + dưỡng ẩm + giảm viêm',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'phục hồi tự nhiên', 'thông thoáng thần kỳ',
    ],
  },

  'health-joint': {
    niche: 'health-joint',
    mechanismVocab: [
      'sụn khớp mòn dần',
      'collagen type 2 cartilage',
      'glucosamine + chondroitin',
      'dịch khớp synovial',
      'viêm khớp osteoarthritis',
      'mật độ xương loãng',
      'compression patella tracking',
      'pelvic alignment',
    ],
    mechanismFrames: [
      'không phải "hết đau ngay" — mà là cho sụn đủ nguyên liệu để TỰ phục hồi',
      'cái đau bề mặt chỉ là dấu hiệu — sụn bên trong mới là chỗ cần được hỗ trợ',
      'không tê — không che — chỉ cung cấp đủ thứ cơ thể đang thiếu để tự fix',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'cân bằng cơ thể', 'phục hồi tự nhiên',
    ],
  },

  'health-digestive': {
    niche: 'health-digestive',
    mechanismVocab: [
      'niêm mạc dạ dày viêm',
      'acid trào ngược (GERD)',
      'vi khuẩn H. pylori',
      'gut microbiome cân bằng',
      'chậm tiêu hóa do enzyme thiếu',
      'IBS triggers',
      'lactose intolerance',
      'inflammation đường ruột',
    ],
    mechanismFrames: [
      'không phải "hết đầy bụng ngay" — mà là làm dịu niêm mạc + cân bằng acid',
      'cái đau dạ dày không phải do ăn sai — là niêm mạc đã viêm sẵn',
      'không kháng acid mạnh — chỉ là phục hồi niêm mạc + hỗ trợ enzyme',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'thanh lọc cơ thể', 'thải độc toàn diện',
    ],
  },

  'health-cardiovascular': {
    niche: 'health-cardiovascular',
    mechanismVocab: [
      'huyết áp tâm thu / tâm trương',
      'cholesterol LDL / HDL',
      'mỡ máu triglyceride',
      'mạch máu xơ vữa',
      'CoQ10 cardiac support',
      'omega-3 chống viêm mạch',
      'fibrinogen đông máu',
      'arterial elasticity',
    ],
    mechanismFrames: [
      'không phải "hạ huyết áp ngay" — mà là làm mạch máu đàn hồi lại',
      'cái huyết áp cao không phải lỗi tim — là mạch máu xơ hóa làm tim phải bóp mạnh',
      'không thay thuốc tim mạch — chỉ hỗ trợ chỉ số ổn định cùng đơn bác sĩ',
    ],
    bannedGenericPhrases: [
      'từ bên trong', 'gốc rễ vấn đề', 'nuôi dưỡng toàn diện',
      'tim mạch khỏe mạnh', 'chữa khỏi tim mạch',
    ],
  },
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 1 mechanism frame per pack — deterministic per seed. */
export function sampleMechanismFrame(seed: string, niche: NicheKey): string {
  const vocab = NICHE_MECHANISM_VOCAB[niche]
  const idx = hashSeed(`${seed}:mechFrame:${niche}`) % vocab.mechanismFrames.length
  return vocab.mechanismFrames[idx]
}

/** Compose mechanism vocab brief for prompt injection. */
export function nicheMechanismBrief(niche: NicheKey, sampledFrame: string): string {
  const vocab = NICHE_MECHANISM_VOCAB[niche]
  return [
    `═══ MECHANISM VOCAB — niche-specific (${niche}) ═══`,
    `Use 2-3 of these concrete vocab items across Phase 2-3 (NOT in Phase 1):`,
    `  ${vocab.mechanismVocab.join(' / ')}`,
    `Sampled mechanism frame (THIS pack — use in Block 10 "why-this-felt-different"):`,
    `  "${sampledFrame}"`,
    `⛔ BANNED generic phrases (NEVER use in this pack — they\'re AI fingerprints):`,
    `  ${vocab.bannedGenericPhrases.join(' / ')}`,
  ].join('\n')
}
