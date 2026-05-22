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
    description: 'Closing line creates quiet forward motion — confession voice, không dramatic',
    examples: [
      'Tối đó tôi mới ngồi xuống tra thử cái tên đó.',
      'Tôi không trả lời ngay. Nhưng câu nói đó ở lại với tôi cả tuần.',
      'Tôi không biết tại sao mình gật đầu — nhưng tôi đã gật.',
    ],
    instruction: 'closing line creates quiet forward motion, 1st person, no dramatic announcement',
  },
  'reveal-delay': {
    mechanic: 'reveal-delay',
    description: 'Info dripped via 1st person — facts emerge naturally across sections',
    examples: [
      'Phải nhiều tuần sau tôi mới hiểu câu đó có ý gì.',
      'Tuần trước chồng tôi nhắc tôi nhớ — tôi mới giật mình.',
      'Lúc đó tôi chưa biết. Phải đến tháng sau tôi mới biết.',
    ],
    instruction: 'withhold detail naturally — 1st person tells gradually, không dumping',
  },
  'curiosity-debt': {
    mechanic: 'curiosity-debt',
    description: 'Subtle unanswered question carried forward — 1st person voice',
    examples: [
      'Có những điều tôi không kể với ai — vì kể rồi cũng không biết làm gì.',
      'Tôi vẫn chưa thật sự ngồi xuống tự trả lời câu đó.',
      'Câu hỏi đó vẫn ở đó. Tôi chỉ chưa sẵn sàng nhìn vào.',
    ],
    instruction: 'plant unanswered question in 1st person voice without flagging it',
  },
  'emotional-contrast': {
    mechanic: 'emotional-contrast',
    description: 'Small mismatch — calm 1st person tone + unsettled fact, or reverse',
    examples: [
      'Mọi người vẫn nói tôi may mắn. Tôi cũng đồng ý.',
      'Cuộc sống không có gì để than phiền — chỉ là tôi vẫn không hiểu sao lúc nào cũng mệt.',
      'Có lẽ vấn đề không nằm ở chỗ tôi chưa đủ cố gắng.',
    ],
    instruction: 'pair calm 1st-person voice with unsettled fact — dissonance creates pull',
  },
  'micro-question': {
    mechanic: 'micro-question',
    description: 'Implicit reader question formed via 1st person observation',
    examples: [
      'Tôi không hiểu vì sao mình nhớ mãi câu hỏi đó.',
      'Điều lạ là — chuyện này lặp lại mỗi ngày, và tôi vẫn không nói ai biết.',
      'Có lẽ điều đó cũng giải thích nhiều chuyện khác trong cuộc sống tôi.',
    ],
    instruction: 'form question in reader\'s mind via 1st-person observation — do not voice it',
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
