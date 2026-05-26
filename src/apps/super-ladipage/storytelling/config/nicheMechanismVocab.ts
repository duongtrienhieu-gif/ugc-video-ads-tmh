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
