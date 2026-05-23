// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — section 1 hooks (v4.1 PATTERN INTERRUPT)
//
// v4 target: pattern interrupt + emotional snap. NOT smooth confession.
// Reader must feel internal recognition + fear within 3 lines.
//
// GOOD examples (user-locked):
//   "Tôi bắt đầu ghét buổi sáng."
//   "Có sáng tôi đứng cạnh mép giường gần 3 phút để lấy can đảm bước xuống."
//
// BAD (banned):
//   "Dạo gần đây tôi cảm thấy cơ thể hơi mệt..." — too smooth
//   "Có một thời gian tôi gần như không dám nhìn vào gương..." — too literary
//   "Aishah, 38 tuổi, sống ở..." — bio CV
//
// Style refs are EXAMPLES, NOT mandatory templates. Gemini chooses
// natural phrasing per niche.
// ─────────────────────────────────────────────────────────────────────

import type { HookPattern, SectionId } from '../types'

export interface HookPatternSpec {
  pattern: HookPattern
  description: string
  /** Vietnamese style references — show TONE only, do NOT copy verbatim. */
  examples: string[]
}

export const HOOK_PATTERNS: Record<HookPattern, HookPatternSpec> = {
  'emotional-rejection': {
    pattern: 'emotional-rejection',
    description: 'Direct emotional rejection statement — "Tôi bắt đầu ghét X" — instant pattern interrupt',
    examples: [
      'Tôi bắt đầu ghét buổi sáng.',
      'Tôi không còn thấy thoải mái khi soi gương như trước.',
      'Tôi bắt đầu sợ những cuộc gọi rủ đi chơi xa.',
    ],
  },

  'specific-fear-moment': {
    pattern: 'specific-fear-moment',
    description: 'Single concrete moment of internal fear — short, embodied, specific',
    examples: [
      'Có sáng tôi đứng cạnh mép giường gần ba phút chỉ để lấy can đảm bước xuống đất.',
      'Tôi đã đứng yên 30 giây giữa bếp chỉ vì không nhớ mình định lấy gì.',
      'Có lần đang bê giỏ đồ ngoài siêu thị, đầu gối nhói lên khiến tôi đứng khựng giữa lối đi.',
    ],
  },

  'physical-immediacy': {
    pattern: 'physical-immediacy',
    description: 'Body sensation in the present — sharp, immediate, sensory',
    examples: [
      'Sáng nay đầu gối tôi lại nhói lên như có ai siết chặt bên trong.',
      'Tay tôi tê tới mức cầm điện thoại cũng thấy khó.',
      'Lúc thức dậy người tôi nặng như đeo chì — chân muốn nhấc lên nhưng không nổi.',
    ],
  },

  'internal-confession': {
    pattern: 'internal-confession',
    description: 'Silent admission carried alone — "Tôi không nói với ai" tone',
    examples: [
      'Tôi không nói điều đó với ai. Nhưng cảm giác bất an cứ lớn dần mỗi ngày.',
      'Có những chuyện tôi giữ trong đầu cả tháng nay — vì kể ra cũng chẳng biết bắt đầu thế nào.',
      'Suốt mấy tháng nay tôi giả vờ mọi thứ vẫn ổn. Chỉ tôi biết là không phải.',
    ],
  },

  'pattern-disruption': {
    pattern: 'pattern-disruption',
    description: 'Sudden change in established pattern noticed',
    examples: [
      'Trước đây tôi không để ý — nhưng dạo này tự nhiên đi cầu thang phải vịn tay.',
      'Tôi vẫn làm những việc tôi vẫn làm mỗi ngày. Chỉ là không còn cùng cách như trước.',
      'Tôi đã quen với guồng quay này hơn mười năm. Cho tới sáng hôm đó.',
    ],
  },

  'self-question': {
    pattern: 'self-question',
    description: 'Internal question reader can ask of themselves',
    examples: [
      'Có ai giống tôi không — sáng dậy mệt hơn cả lúc đêm trước?',
      'Bạn có từng nhìn bàn tay mình rồi tự hỏi: cơ thể đang xuống nhanh vậy sao?',
      'Có ai từng đứng ở bếp 3-5 phút mà quên mình định làm gì không?',
    ],
  },
}

/** Banned opening styles — observer mode, bio, copywriter, smooth-literary. */
export const BANNED_HOOK_PATTERNS = [
  '3rd-person-observer',     // "Cô ấy bước vào...", "Aishah ngồi ở..."
  'name-age-bio',            // "Aishah, 38 tuổi, sống ở..."
  'location-bio',
  'routine-bio',
  'job-bio',
  'family-bio',
  'personality-label-bio',
  'copywriter-bait',         // "Bạn xứng đáng..."
  'motivational-guru',       // "Hãy tin vào bản thân..."
  'fake-empathy',            // "Tôi hiểu cảm giác của bạn..."
  'smooth-descriptive',      // "Dạo gần đây tôi cảm thấy..." — too gentle, no snap
  'literary-confession',     // "Có một thời gian tôi gần như..." — too writerly
  'formulaic-template',      // same opener every pack
] as const

/** Inject vào pack-gen prompt cho section 1 (hook-interrupt) only. */
export const HOOK_ENFORCEMENT_PROMPT =
  `Section 1 (hook-interrupt) — PATTERN INTERRUPT rules:

GOAL: Within first 3 lines, reader thinks "ờ đúng rồi, mình cũng vậy" — recognition + fear.

VOICE: 1st person "tôi", direct, emotional snap.

PHẢI có:
- Pattern interrupt opening (emotional rejection / specific fear / physical immediacy / etc.)
- Concrete embodied detail (đầu gối, vịn cầu thang, đứng cạnh giường, đôi tay tê...)
- Internal fear hint within 3 lines
- 1st person voice ("tôi", "mình")

TUYỆT ĐỐI KHÔNG:
- Smooth descriptive opener ("Dạo gần đây tôi cảm thấy hơi mệt..." → BAD)
- Literary confession ("Có một thời gian tôi gần như..." → too writerly)
- 3rd person observer ("Cô ấy...", "Anh ấy...", named character)
- Bio CV ("Tôi 38 tuổi, sống ở Selangor..." as standalone — only OK nếu flow vào pain ngay)
- Copywriter bait ("Bạn xứng đáng...", "Đừng để X hủy hoại...")
- Motivational ("Hãy tin vào bản thân...")
- Fake empathy ("Tôi hiểu cảm giác của bạn...")
- Formula spam — same opener across packs

Self-test: Câu mở đầu có gây 'snap' / 'ờ mình cũng vậy' / 'oh trùng' cho reader không? Nếu chỉ gây 'mượt quá nhỉ' → FAIL.`

/** Section IDs có hook enforcement (chỉ section 1 hiện tại). */
export const HOOK_REQUIRED_SECTIONS: SectionId[] = ['hook-interrupt']
