// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — READER MIRROR MOMENTS (v5.8)
//
// Per user direction: "Reader mirror moments xuyên suốt" + "1 câu chuyện
// hoàn chỉnh có nhiều hơn sự tương tác, liên kết giữa 'bạn' và 'tôi'."
//
// Each non-reveal body section gets 1 SAMPLED mirror beat — a moment where
// narrator addresses reader directly ("Bạn có từng X?") then continues their
// own story. Keeps reader emotionally hooked beyond section 1.
//
// SAMPLING:
//   - 1 mirror beat type per section (sections 2,3,4,5,7,8,9,11 — skip s6+s10)
//   - Sampled deterministically per pack via seed
//   - Each beat has STRUCTURAL TEMPLATE + 3 niche-mismatched example questions
//
// SKIP sections:
//   - s6 (soft-reveal): mirror beat would feel weird mid-product-mention
//   - s10 (trust-continuity): handled by separate review-only call
//
// Per engineering rule: SAMPLING OBJECT with concrete niche-mismatched data,
// NOT prose advisory. Same anti-leak pattern as Chunk 1 reviewStyleProfiles +
// performanceHookLayer.
// ─────────────────────────────────────────────────────────────────────

import type { SectionId } from '../types'

export interface ReaderMirrorBeat {
  id: string
  /** Which section this beat fits into. */
  section: SectionId
  /** Structural posture of the mirror beat. */
  posture: 'recognition' | 'memory-recall' | 'comparison' | 'permission' | 'absence-aware' | 'projection'
  /** 1-line vibe summary of when this beat lands. */
  vibe: string
  /** 3 niche-mismatched example questions — teach SHAPE not phrase. */
  exampleQuestions: string[]
}

/** Pool of mirror beats per section. Sampler picks 1 per section per pack. */
export const READER_MIRROR_BEATS: ReaderMirrorBeat[] = [
  // ─── Section 2 — daily-friction ───────────────────────────────────
  {
    id: 's2-daily-recognition-1',
    section: 'daily-friction',
    posture: 'recognition',
    vibe: 'name a daily micro-moment reader knows from inside',
    exampleQuestions: [
      'Bạn có từng phải ngồi yên vài giây mới đứng dậy nổi từ ghế thấp?',
      'Bạn có từng đi cầu thang chậm lại đoạn cuối vì sợ hụt hơi giữa chừng?',
      'Bạn có từng vén tóc lên rồi nhanh tay đặt xuống vì sợ thấy rõ vùng đỉnh đầu?',
    ],
  },
  {
    id: 's2-daily-recognition-2',
    section: 'daily-friction',
    posture: 'absence-aware',
    vibe: 'highlight what reader stopped doing without noticing',
    exampleQuestions: [
      'Bao lâu rồi bạn không bê được túi đồ ngoài siêu thị về tới nhà mà không phải đặt xuống nghỉ?',
      'Bao lâu rồi bạn không soi gương buổi sáng mà không tự lùi lại nửa bước?',
      'Bao lâu rồi bạn không ngồi xuống sàn chơi với con mà không nghĩ "lúc lên sẽ đau"?',
    ],
  },

  // ─── Section 3 — internal-fear ────────────────────────────────────
  {
    id: 's3-fear-memory-recall',
    section: 'internal-fear',
    posture: 'memory-recall',
    vibe: 'surface a private night-time fear reader carries silently',
    exampleQuestions: [
      'Có những đêm bạn nằm nhìn trần nhà rồi tự hỏi: cơ thể mình có đang xuống nhanh quá không?',
      'Có những đêm bạn lén google triệu chứng của mình lúc 2 giờ sáng — không kể ai biết, đúng không?',
      'Có những đêm bạn nghĩ "không sao đâu" rồi sáng dậy vẫn thấy y nguyên cái lo đó, đúng không?',
    ],
  },
  {
    id: 's3-fear-projection',
    section: 'internal-fear',
    posture: 'projection',
    vibe: 'surface the fear without naming it directly',
    exampleQuestions: [
      'Có khi nào bạn nhìn ảnh mình 3 năm trước rồi tắt điện thoại đi không?',
      'Có khi nào bạn đứng cạnh bạn cùng tuổi rồi thấy mình khác hẳn — mà không kể ai?',
      'Có khi nào bạn chợt nghĩ "không lẽ chỉ có mình mình mệt thế này"?',
    ],
  },

  // ─── Section 4 — failed-attempts ──────────────────────────────────
  {
    id: 's4-failed-companion',
    section: 'failed-attempts',
    posture: 'recognition',
    vibe: 'validate reader\'s past attempts as not-their-fault',
    exampleQuestions: [
      'Bạn cũng đã thử đủ thứ rồi đúng không — đổi dầu gội, mua serum đắt, uống vitamin đều — mà tóc vẫn rụng?',
      'Bạn cũng từng đi bộ buổi sáng, tập yoga, ngủ sớm — mà chiều đến vẫn cạn pin đúng không?',
      'Bạn cũng đã cố ngủ sớm, tránh cà phê chiều, không xem điện thoại trước giờ ngủ — mà 3 giờ sáng vẫn thức đúng không?',
    ],
  },

  // ─── Section 5 — belief-shift ─────────────────────────────────────
  {
    id: 's5-belief-permission',
    section: 'belief-shift',
    posture: 'permission',
    vibe: 'invite reader to question their own assumption',
    exampleQuestions: [
      'Có khi nào bạn tự hỏi: liệu mình có đang hiểu sai vấn đề suốt thời gian qua không?',
      'Có khi nào bạn nghĩ: không lẽ tuổi này là phải vậy thôi, không có cách nào khác?',
      'Có khi nào bạn cảm thấy mình đang tìm sai chỗ — vấn đề không nằm ở đó mà nằm ở chỗ khác?',
    ],
  },

  // ─── Section 7 — micro-reward ─────────────────────────────────────
  {
    id: 's7-micro-comparison',
    section: 'micro-reward',
    posture: 'memory-recall',
    vibe: 'invite reader to remember pre-decline state',
    exampleQuestions: [
      'Bạn còn nhớ cảm giác sáng dậy không nặng đầu là thế nào không?',
      'Bạn còn nhớ lần cuối tóc bạn không rụng nắm khi gội đầu là khi nào không?',
      'Bạn còn nhớ cảm giác đứng dậy mà không phải vịn vào đâu là như thế nào không?',
    ],
  },

  // ─── Section 8 — emotional-payoff ─────────────────────────────────
  {
    id: 's8-payoff-absence-aware',
    section: 'emotional-payoff',
    posture: 'absence-aware',
    vibe: 'name what reader has been living without',
    exampleQuestions: [
      'Đã bao lâu rồi bạn không thấy mình thật sự nhẹ nhõm khi thức dậy?',
      'Đã bao lâu rồi bạn không soi gương mà mỉm cười nhẹ một chút?',
      'Đã bao lâu rồi bạn không ngồi yên 30 phút mà không cảm thấy đang lãng phí thời gian?',
    ],
  },

  // ─── Section 9 — reflection-trust ─────────────────────────────────
  {
    id: 's9-reflection-comparison',
    section: 'reflection-trust',
    posture: 'comparison',
    vibe: 'invite reader to project to their own potential later-self',
    exampleQuestions: [
      'Bạn có từng nhìn lại mình cách đây vài tháng và thấy mình khác hẳn không?',
      'Bạn có từng đọc lại một dòng note tự ghi cho mình cách đây 6 tháng và thấy nó như là người khác viết không?',
      'Bạn có từng tự nhủ "không biết 3 tháng nữa mình sẽ ra sao" — và rồi thật sự khác?',
    ],
  },

  // ─── Section 11 — soft-cta ────────────────────────────────────────
  {
    id: 's11-cta-projection',
    section: 'soft-cta',
    posture: 'projection',
    vibe: 'invite reader to imagine being in narrator\'s current state',
    exampleQuestions: [
      'Nếu bạn cũng đang ở giai đoạn đó — chỉ cần một thay đổi nhỏ thôi cũng đủ để thấy khác.',
      'Nếu bạn cũng đang cảm thấy giống tôi 6 tháng trước — thì có lẽ đã đến lúc thử một cách khác.',
      'Nếu bạn cũng đang đếm từng ngày chờ cảm giác nhẹ nhõm trở lại — thì bạn không phải đợi mãi.',
    ],
  },
]

// ═══ SAMPLING ═════════════════════════════════════════════════════════

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 1 mirror beat for a given section. Deterministic per seed.
 *  Returns null if section has no beats (e.g. soft-reveal s6, trust-continuity s10). */
export function sampleMirrorBeat(seed: string, section: SectionId): ReaderMirrorBeat | null {
  const candidates = READER_MIRROR_BEATS.filter((b) => b.section === section)
  if (candidates.length === 0) return null
  const idx = hashSeed(`${seed}:mirror:${section}`) % candidates.length
  return candidates[idx]
}

/** Per-section directive injection. Compact — shape + 1 example.
 *  Inject 1 line per section telling Gemini to weave a reader-mirror beat
 *  in this section's structural pattern. */
export function readerMirrorBeatDirective(beat: ReaderMirrorBeat): string {
  const ex = beat.exampleQuestions[0]
  return `READER MIRROR BEAT (weave 1 question + transition back to tôi voice):
  posture: ${beat.posture} — ${beat.vibe}
  shape example (NEVER copy — niche-mismatched): "${ex}"
  Generate new question fitting THIS pack's niche + narrator pain, then continue tôi voice.`
}
