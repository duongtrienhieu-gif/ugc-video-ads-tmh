// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — BELIEF SHIFT ENGINE (v4.2)
//
// Belief Shift = CONVERSION CORE of storyselling. NOT product reveal.
//
// Mechanism (3 components):
//   1. EXTERNAL CATALYST — someone else triggers the thought
//      (friend asks, family member's experience, overheard, article line)
//   2. REFRAME — "Có thể vấn đề không phải [X cũ], mà là [Y mới]"
//   3. PERMISSION — internal acceptance to seek solution
//
// Section 5 (belief-shift) MUST encode all 3 components. Product
// mention is BRIEF/ABSENT here — product reveal lives in section 6.
//
// Per-niche reframe specifics (xương khớp, skincare, mất ngủ...) are
// niche-specific examples here but the PATTERN is generic. Niche DNA
// system (future) will override with niche-aware values per call.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey } from '../types'

// ═══ CATALYST TYPES ═══════════════════════════════════════════════════

export type BeliefShiftCatalystType =
  | 'friend-question'        // bạn cũ hỏi một câu khiến mình khựng lại
  | 'family-experience'      // người thân từng trải qua, chia sẻ lại
  | 'overheard-mention'      // tình cờ nghe người khác nhắc tới
  | 'article-line'           // đọc đâu đó một câu khiến mình suy nghĩ
  | 'casual-recommendation'  // ai đó hồn nhiên nhắc, không phải sales

export interface BeliefShiftCatalystSpec {
  type: BeliefShiftCatalystType
  description: string
  /** 2-3 Vietnamese example openers (style refs, NOT mandatory). */
  examples: string[]
}

export const BELIEF_SHIFT_CATALYSTS: Record<BeliefShiftCatalystType, BeliefShiftCatalystSpec> = {
  'friend-question': {
    type: 'friend-question',
    description: 'Câu hỏi từ bạn bè khiến mình khựng lại — không phải khuyên, chỉ là một câu hỏi',
    examples: [
      '"Mày có chắc đó chỉ là chuyện tuổi tác không?"',
      '"Em nghĩ thật ra lý do là gì?"',
      '"Cậu đã đi khám chưa, hay chỉ tự đoán thôi?"',
    ],
  },
  'family-experience': {
    type: 'family-experience',
    description: 'Người thân từng trải qua điều tương tự — không hùng biện, chỉ kể lại',
    examples: [
      'Em gái tôi cũng từng tưởng mình bị burnout. Sau đó nó mới biết là...',
      'Mẹ tôi ngày trước cũng vậy. Lúc đó nhà tôi cứ nghĩ là...',
      'Có lần chị họ tôi kể chuyện chị ấy cũng từng như tôi vậy.',
    ],
  },
  'overheard-mention': {
    type: 'overheard-mention',
    description: 'Tình cờ nghe người khác nhắc — feels natural, không scripted',
    examples: [
      'Hôm đó ngồi quán cà phê tôi nghe lỏm hai người ngồi bàn bên nói chuyện.',
      'Tôi tình cờ đọc một bài chia sẻ trên Facebook của một người lạ.',
      'Có lần ngồi đợi khám tôi nghe một cô lớn tuổi nhắc tới...',
    ],
  },
  'article-line': {
    type: 'article-line',
    description: 'Một câu đọc được đâu đó khiến mình ngẫm — không phải fact dump',
    examples: [
      'Tôi đọc đâu đó câu này, và nó cứ ở lại với tôi suốt mấy ngày.',
      'Có một bài viết tôi đọc tình cờ, trong đó có một câu khiến tôi giật mình.',
      'Tôi nhớ mãi một câu trong cuốn sách cũ — đại ý là...',
    ],
  },
  'casual-recommendation': {
    type: 'casual-recommendation',
    description: 'Ai đó hồn nhiên nhắc tới — KHÔNG phải sales/expert push',
    examples: [
      'Cô bạn cùng làm rủ tôi đi cà phê, vô tình kể chuyện chị ấy cũng từng như tôi.',
      'Hôm đó đứa em họ tới chơi, nó kể nó cũng từng gặp vấn đề này.',
      'Tôi đang ngồi với mấy bạn cũ, một đứa nhắc tới...',
    ],
  },
}

// ═══ REFRAME FORMULAS ════════════════════════════════════════════════

/** Core reframe pattern. Reader's old belief (X) → new frame (Y).
 *  Y mới phải open door tới solution mà KHÔNG phải miracle promise. */
export interface BeliefShiftReframe {
  /** Old assumption reader carries (X). */
  oldBelief: string
  /** New frame opening permission (Y). */
  newFrame: string
}

/** Per-niche reframe examples — these are REFERENCE patterns. Real engine
 *  should adapt to specific product + protagonist context. Niche DNA
 *  system (future) will provide canonical reframes per niche. */
export const NICHE_REFRAME_EXAMPLES: Partial<Record<NicheKey, BeliefShiftReframe>> = {
  'health-functional': {
    oldBelief: 'Đau khớp, cứng người, mệt mỏi là chuyện không tránh được khi lớn tuổi',
    newFrame: 'Không phải mình già đi quá nhanh — mà là cơ thể không còn phục hồi tốt như trước nữa',
  },
  'skincare': {
    oldBelief: 'Da xỉn màu, mất sức sống là do mình chưa skincare đủ kiểu',
    newFrame: 'Có thể vấn đề không nằm ở việc bôi thêm gì — mà là cơ thể đang thiếu một thứ gì đó nhỏ thôi, nhưng cụ thể',
  },
  'supplement-wellness': {
    oldBelief: 'Mình ngủ ít, mệt mỏi vô cớ vì stress công việc',
    newFrame: 'Có thể không phải mình stress quá — mà là cơ thể đang thiếu gì đó để giữ ổn định bên trong',
  },
  'mom-baby': {
    oldBelief: 'Mẹ bỉm thì ai cũng kiệt sức — chịu thôi, qua giai đoạn nó hết',
    newFrame: 'Có thể không phải mình yếu — mà là cơ thể sau sinh cần một số thứ rất cụ thể để phục hồi',
  },
  'haircare': {
    oldBelief: 'Tóc rụng nhiều là do di truyền, không làm gì được',
    newFrame: 'Có thể vấn đề không phải gene — mà là nang tóc đang yếu đi và vẫn có thể nuôi lại',
  },
  'fitness-recovery': {
    oldBelief: 'Mình tăng cân khó giảm vì lười không tập đủ',
    newFrame: 'Có thể không phải mình lười — mà là trao đổi chất chậm lại theo tuổi, cần hỗ trợ thêm',
  },
  'relationship': {
    oldBelief: 'Mình mệt mỏi cảm xúc vì cuộc sống đang khó khăn — qua đợt này sẽ ổn',
    newFrame: 'Có thể không phải mình yếu — mà là cơ thể đang gắng quá lâu, cần được nghỉ ngơi đúng cách',
  },
  'beauty-confidence': {
    oldBelief: 'Mình thiếu tự tin vì da/tóc/dáng không như xưa',
    newFrame: 'Có thể không phải mình "xuống" — mà là cơ thể đang cần được hỗ trợ để trở lại trạng thái nó vốn có',
  },
}

// ═══ PERMISSION PATTERNS ═════════════════════════════════════════════

export interface BeliefShiftPermission {
  /** Pattern label. */
  pattern: string
  /** Vietnamese style references. */
  examples: string[]
}

export const PERMISSION_PATTERNS: BeliefShiftPermission[] = [
  {
    pattern: 'first-time-thinking',
    examples: [
      'Lần đầu tiên tôi bắt đầu nghĩ — có lẽ tôi đã hiểu sai vấn đề suốt thời gian qua.',
      'Tôi chưa từng nhìn chuyện này theo góc đó.',
      'Câu đó làm tôi suy nghĩ mãi mấy hôm liền.',
    ],
  },
  {
    pattern: 'wrong-question-realization',
    examples: [
      'Có thể tôi đã đặt câu hỏi sai — không phải "làm sao chịu được", mà là "làm sao cho cơ thể nhẹ lại".',
      'Hóa ra tôi không cần phải cố chịu thêm.',
      'Tôi tự dưng nhận ra mình đang giải sai bài toán.',
    ],
  },
  {
    pattern: 'permission-to-care',
    examples: [
      'Có lẽ tôi nên nghe cơ thể mình một chút.',
      'Tôi nghĩ mình cũng có quyền thử một thứ gì đó khác — thay vì cứ chịu mãi.',
      'Lần đầu tiên tôi thấy có quyền dừng lại và tìm một cách khác.',
    ],
  },
]

// ═══ PROMPT DIRECTIVE FOR SECTION 5 ══════════════════════════════════

export const BELIEF_SHIFT_PROMPT =
  `Section 5 (belief-shift) — CONVERSION CORE rules:

GOAL: AHA reinterpretation moment. Reader nhận ra "có lẽ mình đã hiểu sai vấn đề".
NOT product reveal — product mention BRIEF or ABSENT here. Product reveal lives in Section 6.

PHẢI có 3 components in order:

[1] EXTERNAL CATALYST — someone else triggers the shift (KHÔNG self-realization)
    - Choose ONE catalyst type (vary across packs — không formulaic):
      • friend-question — "Mày có chắc đó chỉ là [tuổi tác] không?"
      • family-experience — "Em gái tôi cũng từng vậy. Sau đó nó mới biết là..."
      • overheard-mention — "Tôi tình cờ nghe ai đó nói..."
      • article-line — "Tôi đọc đâu đó câu này..."
      • casual-recommendation — "Đứa em họ tới chơi vô tình kể..."
    - Catalyst voice = CASUAL, KHÔNG expert/doctor authority

[2] REFRAME — "Có thể vấn đề không phải [X cũ], mà là [Y mới]"
    - X cũ = reader's current assumption (tuổi tác / do mệt / di truyền / do lười...)
    - Y mới = open door to solution (cơ thể cần hỗ trợ / không phục hồi như trước / thiếu thứ gì đó cụ thể)
    - Y mới KHÔNG được là miracle promise. Phải feel realistic + actionable.

[3] PERMISSION — internal acceptance to seek solution
    - "Lần đầu tiên tôi bắt đầu nghĩ — có lẽ tôi đã hiểu sai vấn đề suốt thời gian qua."
    - "Có lẽ tôi nên nghe cơ thể mình một chút."

TUYỆT ĐỐI KHÔNG:
- Doctor/expert authority ("Bác sĩ X nói rằng...")
- Statistics dump ("70% người sau 40 tuổi...")
- Self-realization (must be triggered EXTERNALLY by another person/text)
- Product name in this section (save for Section 6 soft-reveal)
- Miracle reframe ("hóa ra chỉ cần X là khỏi hết")
- Plot-twist energy ("bí mật bất ngờ đã được tiết lộ...")

Self-test: Sau section này, reader có nghĩ "ờ đúng rồi, có thể mình đã hiểu sai" KHÔNG? Nếu chỉ nghĩ "section này quảng cáo" → FAIL.`

/** Get reframe example for a niche — falls back to generic if niche not mapped. */
export function getReframeForNiche(niche: NicheKey): BeliefShiftReframe {
  return NICHE_REFRAME_EXAMPLES[niche] ?? {
    oldBelief: '[reader\'s current assumption based on niche]',
    newFrame: 'Có thể vấn đề không phải [X], mà là cơ thể cần được hỗ trợ đúng cách',
  }
}
