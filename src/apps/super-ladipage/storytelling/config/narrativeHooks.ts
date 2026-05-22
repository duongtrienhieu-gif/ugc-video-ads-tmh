// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — section 1 hooks (P0.5.4 realignment)
//
// REALIGNED for storyselling: hooks are SELF-INSERTION devices —
// reader must instantly recognize themselves within first 3 lines.
//
// 1st person "tôi" is primary. "Bạn" mixed naturally when fits.
//
// Important: these are STYLE references, NOT mandatory templates.
// Gemini chọn phrasing tự nhiên cho protagonist + niche — KHÔNG
// repeat the same opener across every pack.
// ─────────────────────────────────────────────────────────────────────

import type { HookPattern, SectionId } from '../types'

export interface HookPatternSpec {
  pattern: HookPattern
  description: string
  /** Vietnamese style references — show TONE only, do NOT copy verbatim. */
  examples: string[]
}

export const HOOK_PATTERNS: Record<HookPattern, HookPatternSpec> = {
  // Storyselling self-insertion hooks. We reuse the existing HookPattern
  // enum keys but reinterpret each as a self-insertion style. New keys
  // would require type union changes — we keep keys, change meaning.

  'observation-first': {
    pattern: 'observation-first',
    description: 'confession opener — 1st person sharing a vulnerable observation about self',
    examples: [
      'Có một thời gian tôi gần như không dám nhìn vào gương mỗi sáng.',
      'Tôi không nhớ chính xác từ khi nào mình bắt đầu mệt như vậy.',
      'Mỗi sáng tôi ngồi ở bàn cả 5-10 phút mà không làm gì.',
    ],
  },

  'anomaly-first': {
    pattern: 'anomaly-first',
    description: 'shared experience — "tôi cũng từng cảm thấy thế này" tone',
    examples: [
      'Tôi từng nghĩ chuyện này chỉ là do mình mệt thôi — sau này mới biết không phải.',
      'Tôi cũng từng tự thuyết phục mình rằng mọi thứ vẫn ổn.',
      'Trước đây tôi nghĩ đây là chuyện ai cũng gặp ở tuổi 40.',
    ],
  },

  'negative-space': {
    pattern: 'negative-space',
    description: 'vulnerable confession via what reader avoids/hides',
    examples: [
      'Không biết có ai giống tôi không — tôi gần như tránh nhắc chuyện này với chồng.',
      'Tôi chưa từng nói thẳng với ai chuyện mình lúc nào cũng mệt.',
      'Có những thứ tôi không nói ra — vì nói ra rồi cũng không biết làm gì.',
    ],
  },

  'time-blur': {
    pattern: 'time-blur',
    description: 'time-anchored confession — when it started',
    examples: [
      'Sau tuổi 35 tôi bắt đầu để ý — sáng dậy mệt hơn, da xỉn màu hơn dù skincare đủ kiểu.',
      'Khoảng 6 tháng trở lại đây tôi cứ mệt suốt, dù chẳng làm gì nặng.',
      'Từ sau khi sinh đứa thứ hai, tôi cảm giác cơ thể mình không còn như trước.',
    ],
  },

  'subtle-detail': {
    pattern: 'subtle-detail',
    description: 'specific concrete pain detail opening — reader recognizes symptom',
    examples: [
      'Tôi 38 tuổi, mẹ 2 đứa con — và đã hơn nửa năm nay tôi ngủ không sâu giấc.',
      'Cứ khoảng 3 giờ chiều mỗi ngày, tôi lại thấy như cơ thể mình hết pin.',
      'Da tôi xỉn màu, mắt thâm rõ, lúc nào cũng như thiếu sức sống — dù tôi đã cố ngủ sớm.',
    ],
  },

  'third-person-witness': {
    pattern: 'third-person-witness',
    description: 'someone close mentioned it — bridges 1st person internal with external observation',
    examples: [
      'Tuần trước chồng tôi hỏi: "Em ngủ không ngon à?" — và tôi giật mình nhận ra anh ấy đã hỏi câu này nhiều lần.',
      'Em gái tôi nhắc một câu — và tôi mới chịu nhìn lại mấy tháng vừa qua.',
      'Có lần con gái hỏi sao mẹ lúc nào cũng mệt — câu đó tôi nhớ mãi.',
    ],
  },
}

/** Banned opening styles — these create observer mode or sales template feel. */
export const BANNED_HOOK_PATTERNS = [
  '3rd-person-observer',     // "Cô ấy bước vào phòng" — observer mode
  'name-age-bio',            // "Aishah, 38 tuổi, sống ở..."
  'location-bio',            // "Sống ở Selangor..."
  'routine-bio',             // "Mỗi sáng cô dậy lúc..."
  'job-bio',                 // "Cô là chủ cửa hàng..."
  'family-bio',              // "Cô có 2 con..."
  'personality-label-bio',   // "Cô là kiểu người..."
  'copywriter-bait',         // "Bạn xứng đáng với phiên bản tốt hơn..."
  'motivational-guru',       // "Hãy tin vào bản thân..."
  'fake-empathy',            // "Tôi hiểu cảm giác của bạn..."
  'formulaic-template',      // every pack opens "Bạn đã từng..." — banned spam
] as const

/** Inject vào pack-gen prompt cho section 1. Self-insertion enforcement. */
export const HOOK_ENFORCEMENT_PROMPT =
  `Section 1 opening rules (storyselling self-insertion):

GOAL: Within first 3 lines, reader thinks "ờ giống mình, đúng là tôi cũng vậy".

POV: 1st person "tôi" primary. Optional "bạn" mixed naturally — NOT formula.

PHẢI có:
- 1st person voice ("tôi", "mình")
- Specific concrete pain hinted (named symptoms — không abstract)
- Conversational tone (như nói chuyện với bạn thân)

KHÔNG được:
- 3rd person observer mode ("Cô ấy...", "Anh ấy...", named character)
- Bio CV intro ("Tôi 38 tuổi, sống ở..., làm...") as standalone — only OK nếu flow vào pain ngay
- Copywriter bait ("Bạn xứng đáng...", "Đừng để X hủy hoại...")
- Motivational guru tone
- Formula spam — same opener across packs

CHỌN style tự nhiên cho protagonist + niche. KHÔNG copy examples literally.

Self-test: Nếu đọc lên có cảm giác "đây là một người bạn đang kể cho mình nghe", section 1 OK.`

/** Section IDs có hook (chỉ section 1 hiện tại). */
export const HOOK_REQUIRED_SECTIONS: SectionId[] = ['intro-portrait']
