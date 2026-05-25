// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — READER MIRROR MOMENTS (Reader-Immersion architecture)
//
// Each block whose samplingHooks.readerMirrorBeat = true gets 1 SAMPLED
// mirror moment — a question that addresses reader directly ("Bạn có
// từng X?") woven into the block's narrative.
//
// Reader-Immersion rebuild: keys are now BlockId (post-v5.8) instead of
// legacy SectionId. Phase 1 blocks lean heavy on mirror beats (reader is
// emotional center); Phase 2 blocks use them sparingly as narrator joins
// reader; Phase 3-4 use them at strategic projection moments.
//
// Per engineering rule: SAMPLING OBJECT with concrete niche-mismatched data,
// NOT prose advisory. Same anti-leak pattern as reviewStyleProfiles +
// performanceHookLayer.
// ─────────────────────────────────────────────────────────────────────

import type { BlockId } from '../types'

export interface ReaderMirrorBeat {
  id: string
  /** Which block this beat fits into. */
  block: BlockId
  /** Structural posture of the mirror beat. */
  posture: 'recognition' | 'memory-recall' | 'comparison' | 'permission' | 'absence-aware' | 'projection'
  /** 1-line vibe summary of when this beat lands. */
  vibe: string
  /** 3 niche-mismatched example questions — teach SHAPE not phrase. */
  exampleQuestions: string[]
}

/** Pool of mirror beats per block. Sampler picks 1 per block per pack.
 *  Coverage: 6 blocks have beats. Blocks without beats → sampler returns
 *  null gracefully (no beat injected). Pool can expand per phase later. */
export const READER_MIRROR_BEATS: ReaderMirrorBeat[] = [
  // ─── Phase 1 — daily-micro-friction (block 2) ─────────────────────
  {
    id: 'p1-friction-recognition',
    block: 'daily-micro-friction',
    posture: 'recognition',
    vibe: 'name a daily micro-moment reader knows from inside',
    exampleQuestions: [
      'Bạn có từng phải ngồi yên vài giây mới đứng dậy nổi từ ghế thấp?',
      'Bạn có từng đi cầu thang chậm lại đoạn cuối vì sợ hụt hơi giữa chừng?',
      'Bạn có từng vén tóc lên rồi nhanh tay đặt xuống vì sợ thấy rõ vùng đỉnh đầu?',
    ],
  },
  {
    id: 'p1-friction-absence',
    block: 'daily-micro-friction',
    posture: 'absence-aware',
    vibe: 'highlight what reader stopped doing without noticing',
    exampleQuestions: [
      'Bao lâu rồi bạn không bê được túi đồ ngoài siêu thị về tới nhà mà không phải đặt xuống nghỉ?',
      'Bao lâu rồi bạn không soi gương buổi sáng mà không tự lùi lại nửa bước?',
      'Bao lâu rồi bạn không ngồi xuống sàn chơi với con mà không nghĩ "lúc lên sẽ đau"?',
    ],
  },

  // ─── Phase 1 — hidden-emotional-truth (block 3) ───────────────────
  {
    id: 'p1-truth-memory-recall',
    block: 'hidden-emotional-truth',
    posture: 'memory-recall',
    vibe: 'surface a private night-time fear reader carries silently',
    exampleQuestions: [
      'Có những đêm bạn nằm nhìn trần nhà rồi tự hỏi: cơ thể mình có đang xuống nhanh quá không?',
      'Có những đêm bạn lén google triệu chứng của mình lúc 2 giờ sáng — không kể ai biết, đúng không?',
      'Có những đêm bạn nghĩ "không sao đâu" rồi sáng dậy vẫn thấy y nguyên cái lo đó, đúng không?',
    ],
  },
  {
    id: 'p1-truth-projection',
    block: 'hidden-emotional-truth',
    posture: 'projection',
    vibe: 'surface the fear without naming it directly',
    exampleQuestions: [
      'Có khi nào bạn nhìn ảnh mình 3 năm trước rồi tắt điện thoại đi không?',
      'Có khi nào bạn đứng cạnh bạn cùng tuổi rồi thấy mình khác hẳn — mà không kể ai?',
      'Có khi nào bạn chợt nghĩ "không lẽ chỉ có mình mình mệt thế này"?',
    ],
  },

  // ─── Phase 1 — not-alone-bridge (block 4) ─────────────────────────
  {
    id: 'p1-not-alone-recognition',
    block: 'not-alone-bridge',
    posture: 'recognition',
    vibe: 'frame the shared experience as relief, not statistic',
    exampleQuestions: [
      'Bạn có từng nghĩ "chỉ mỗi mình mình bị thế" — rồi vô tình đọc được câu chuyện của người khác y chang mình?',
      'Bạn có từng giấu chuyện này lâu đến mức quên mất có thể có ai đó cũng đang sống y vậy?',
      'Bạn có từng cảm thấy nhẹ đi một chút chỉ vì biết người khác cũng đang trải qua điều đó?',
    ],
  },

  // ─── Phase 2 — narrator-validation-entry (block 5) ────────────────
  {
    id: 'p2-validation-recognition',
    block: 'narrator-validation-entry',
    posture: 'recognition',
    vibe: 'narrator joins reader by naming the exact felt moment',
    exampleQuestions: [
      'Bạn cũng từng đứng đó đúng không — tự nhủ "có lẽ là do thời tiết" rồi quay đi?',
      'Bạn cũng từng pha ly cà phê thứ 3 lúc 3 giờ chiều rồi tự thuyết phục mình "không sao đâu"?',
      'Bạn cũng từng nhìn ngăn kéo đầy vitamin chưa uống hết rồi nghĩ "lần này chắc cũng vậy" đúng không?',
    ],
  },

  // ─── Phase 2 — shared-failed-attempts (block 6) ───────────────────
  {
    id: 'p2-failed-companion',
    block: 'shared-failed-attempts',
    posture: 'recognition',
    vibe: 'validate reader\'s past attempts as not-their-fault',
    exampleQuestions: [
      'Bạn cũng đã thử đủ thứ rồi đúng không — đổi dầu gội, mua serum đắt, uống vitamin đều — mà tóc vẫn rụng?',
      'Bạn cũng từng đi bộ buổi sáng, tập yoga, ngủ sớm — mà chiều đến vẫn cạn pin đúng không?',
      'Bạn cũng đã cố ngủ sớm, tránh cà phê chiều, không xem điện thoại trước giờ ngủ — mà 3 giờ sáng vẫn thức đúng không?',
    ],
  },

  // ─── Phase 2 — belief-shift (block 8) ─────────────────────────────
  {
    id: 'p2-belief-permission',
    block: 'belief-shift',
    posture: 'permission',
    vibe: 'invite reader to question their own assumption',
    exampleQuestions: [
      'Có khi nào bạn tự hỏi: liệu mình có đang hiểu sai vấn đề suốt thời gian qua không?',
      'Có khi nào bạn nghĩ: không lẽ tuổi này là phải vậy thôi, không có cách nào khác?',
      'Có khi nào bạn cảm thấy mình đang tìm sai chỗ — vấn đề không nằm ở đó mà nằm ở chỗ khác?',
    ],
  },

  // ─── Phase 4 — emotional-wins (block 13) ──────────────────────────
  {
    id: 'p4-wins-absence-aware',
    block: 'emotional-wins',
    posture: 'absence-aware',
    vibe: 'name what reader has been living without',
    exampleQuestions: [
      'Đã bao lâu rồi bạn không thấy mình thật sự nhẹ nhõm khi thức dậy?',
      'Đã bao lâu rồi bạn không soi gương mà mỉm cười nhẹ một chút?',
      'Đã bao lâu rồi bạn không ngồi yên 30 phút mà không cảm thấy đang lãng phí thời gian?',
    ],
  },
  {
    id: 'p4-wins-comparison',
    block: 'emotional-wins',
    posture: 'comparison',
    vibe: 'invite reader to project to their own potential later-self',
    exampleQuestions: [
      'Bạn có từng nhìn lại mình cách đây vài tháng và thấy mình khác hẳn không?',
      'Bạn có từng đọc lại một dòng note tự ghi cho mình cách đây 6 tháng và thấy nó như là người khác viết không?',
      'Bạn có từng tự nhủ "không biết 3 tháng nữa mình sẽ ra sao" — và rồi thật sự khác?',
    ],
  },
]

// ═══ SAMPLING ═════════════════════════════════════════════════════════

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 1 mirror beat for a given block. Deterministic per seed.
 *  Returns null if block has no beats — caller skips injection. */
export function sampleMirrorBeat(seed: string, block: BlockId): ReaderMirrorBeat | null {
  const candidates = READER_MIRROR_BEATS.filter((b) => b.block === block)
  if (candidates.length === 0) return null
  const idx = hashSeed(`${seed}:mirror:${block}`) % candidates.length
  return candidates[idx]
}

/** Per-block directive injection. Compact — shape + 1 example.
 *  Inject 1 line per block telling Gemini to weave a reader-mirror beat. */
export function readerMirrorBeatDirective(beat: ReaderMirrorBeat): string {
  const ex = beat.exampleQuestions[0]
  return `READER MIRROR BEAT (weave 1 question + transition back to narrator voice if appropriate):
  posture: ${beat.posture} — ${beat.vibe}
  shape example (NEVER copy — niche-mismatched): "${ex}"
  Generate new question fitting THIS pack's niche + narrator pain.`
}
