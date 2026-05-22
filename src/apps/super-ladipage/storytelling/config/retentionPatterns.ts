// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — retention micro-mechanics
//
// Lightweight pull devices. Reader retention từ RECOGNITION + subtle
// tension, KHÔNG phải shocking reveals / drama / fake suspense /
// cliffhanger spam.
//
// Restraint guardrail: "không đọc thì tiếc" — không phải "drama nên
// phải đọc".
// ─────────────────────────────────────────────────────────────────────

import type { RetentionMechanic } from '../types'

export interface RetentionMechanicSpec {
  mechanic: RetentionMechanic
  description: string
  /** Vietnamese example closing lines that embody this mechanic. */
  examples: string[]
  /** 1-line instruction for prompt injection. */
  instruction: string
}

export const RETENTION_MECHANICS: Record<RetentionMechanic, RetentionMechanicSpec> = {
  'section-end-pull': {
    mechanic: 'section-end-pull',
    description: 'Last line creates quiet continuation — không phải hook drama',
    examples: [
      'Đêm đó cô tra Google.',
      'Cô không trả lời ngay. Nhưng cô đã nhớ.',
      'Sau này khi nhắc lại, cô vẫn không biết tại sao mình gật đầu.',
    ],
    instruction: 'closing line creates quiet forward motion, no dramatic announcement',
  },
  'reveal-delay': {
    mechanic: 'reveal-delay',
    description: 'Info dripped, not dumped — facts emerge across sections',
    examples: [
      'Phải nhiều tuần sau, cô mới hiểu câu đó có ý gì.',
      'Anh không nhớ — Aishah hỏi lại và anh không nhớ.',
      'Lúc đó cô chưa biết. Phải đến tháng sau mới biết.',
    ],
    instruction: 'withhold detail that would normally be stated — let reader carry the gap',
  },
  'curiosity-debt': {
    mechanic: 'curiosity-debt',
    description: 'Subtle unanswered question carried forward — không loud',
    examples: [
      'Chỉ ngồi.',
      'Có những thứ — bạn không nói ra — không có nghĩa là nó không có.',
      'Câu hỏi đó vẫn ở đó. Cô chỉ chưa sẵn sàng trả lời.',
    ],
    instruction: 'plant an unanswered question without flagging it',
  },
  'emotional-contrast': {
    mechanic: 'emotional-contrast',
    description: 'Small mismatch — calm tone + unsettled fact, hoặc ngược lại',
    examples: [
      'Cô đồng ý với họ.',
      'Người ta vẫn nói cô may mắn. Chồng tốt. Con ngoan. Việc làm linh hoạt. Không có lý do gì để phàn nàn.',
      'Có lẽ vấn đề không nằm ở chỗ cô chưa đủ cố gắng.',
    ],
    instruction: 'pair calm voice with unsettled fact — let dissonance create pull',
  },
  'micro-question': {
    mechanic: 'micro-question',
    description: 'Implicit reader question formed — never asked directly',
    examples: [
      'Cô không hiểu vì sao mình nhớ mãi câu đó.',
      'Điều lạ là — chuyện này lặp lại mỗi ngày, và cô vẫn không nói ai biết.',
      'Có lẽ điều đó cũng giải thích nhiều chuyện khác.',
    ],
    instruction: 'form a question in reader\'s mind via observation — do not voice it',
  },
}

/** Banned patterns — runtime semantic gate sẽ reject nếu detect. */
export const BANNED_RETENTION_PATTERNS = [
  'shocking-reveal',          // "Nhưng rồi một bí mật kinh hoàng được tiết lộ..."
  'hard-cliffhanger',         // "Cô không biết rằng — chỉ vài giờ sau..."
  'fake-suspense',            // "Điều cô sắp khám phá sẽ thay đổi tất cả..."
  'secret-tease',             // "Có một bí mật cô chưa từng kể..."
  'plot-twist-promise',       // "Câu chuyện này có một twist mà bạn không ngờ..."
  'binge-fiction-energy',     // serialized fiction hook spam
  'netflix-pacing',           // every-section-ends-with-bombshell
  'every-section-cliffhanger', // mọi section đều kết kiểu hook
] as const

/** Restraint guardrail — inject vào pack-gen prompt globally. */
export const RETENTION_RESTRAINT_PROMPT =
  `Retention rules:
- Pull comes from RECOGNITION + subtle tension, NOT drama
- Reader should think "không đọc thì tiếc", NOT "drama nên phải đọc"
- Tone: diary / confession / documentary — NEVER serialized fiction
- BANNED: shocking reveals, hard cliffhangers, fake suspense, secret-tease,
  plot-twist promises, binge-fiction energy
- Each section ends with quiet pull (assigned retention mechanic) — never
  loud announcement
- Curiosity emerges from observation / behavior / omission / emotional
  mismatch / tiny anomalies — NEVER from secrets / dramatic reveals`

/** 1-line instruction for prompt injection per section. */
export function retentionInstructionFor(mechanic: RetentionMechanic | null): string {
  if (!mechanic) return 'no retention pull — section is closure/settled'
  return RETENTION_MECHANICS[mechanic].instruction
}
