// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — TRUST REALISM LIBRARY (v5.5)
//
// DM/FB-comment language patterns for section 10 (trust-continuity).
//
// Goal: testimonial quotes feel like REAL DMs / FB comments — casual,
// imperfect, emoji-light, sometimes typos, abbreviated words.
//
// Forbid: formal "testimonial ad copy" — clean grammar, complete
// sentences, polished sentiment, star ratings vibe.
// ─────────────────────────────────────────────────────────────────────

export type TrustRealismStyle =
  | 'short-validation'        // "Em cũng đang dùng đây ạ. Đỡ hẳn 2-3 tuần đầu."
  | 'specific-detail'         // "Sáng nay không phải bấm 'ngủ thêm 10p' nữa lol"
  | 'hesitant-comparison'     // "Mình lúc đầu cũng nghi, mà giờ thấy ổn hơn thật"
  | 'family-mention'          // "Mẹ mình đỡ lắm đó chị, cảm ơn chị share"
  | 'casual-confession'       // "Mình bị y chang vậy luôn 😭"
  | 'short-affirmation'       // "Mình recommend nha mn"
  | 'time-specific'           // "Tuần thứ 3 bắt đầu thấy khác"

export interface TrustRealismExample {
  style: TrustRealismStyle
  /** Example Vietnamese DM/comment-style quote. */
  example: string
  /** Suggested author label. */
  authorHint: string
}

export const TRUST_REALISM_EXAMPLES: TrustRealismExample[] = [
  {
    style: 'short-validation',
    example: 'Em cũng đang dùng đây ạ. Đỡ hẳn 2-3 tuần đầu rồi.',
    authorHint: 'Hà, 28',
  },
  {
    style: 'specific-detail',
    example: 'Sáng nay không cần bấm "ngủ thêm 10 phút" nữa, ai từng vậy mới hiểu lol',
    authorHint: 'Thảo, 35',
  },
  {
    style: 'hesitant-comparison',
    example: 'Mình lúc đầu cũng nghi nghi, mà giờ thấy người nhẹ hơn thật. Chưa dám khẳng định nhưng tin tưởng dần.',
    authorHint: 'Chị Lan, 42',
  },
  {
    style: 'family-mention',
    example: 'Mẹ em đỡ lắm rồi chị ơi, đi cầu thang không phải vịn tay nữa. Cảm ơn chị share câu chuyện.',
    authorHint: 'Linh, 30',
  },
  {
    style: 'casual-confession',
    example: 'Đọc xong tui mới biết mình ko phải mỗi mình bị 😭 cảm ơn chị viết',
    authorHint: 'Một bạn đọc',
  },
  {
    style: 'short-affirmation',
    example: 'Mình recommend nha mn, chỉ cần kiên trì tuần đầu thôi.',
    authorHint: 'Trang, 38',
  },
  {
    style: 'time-specific',
    example: 'Tuần thứ 3 bắt đầu thấy khác thật. Tóc rụng ít hẳn khi gội đầu.',
    authorHint: 'My, 34',
  },
  {
    style: 'short-validation',
    example: 'Ko hết ngay đâu mn nhé. Nhưng cải thiện từ từ thật. Mình uống được 2 tháng rồi.',
    authorHint: 'Hương, 45',
  },
  {
    style: 'specific-detail',
    example: 'Chiều 3h ko còn cảm giác hết pin như trước nữa. Lạ mà thật.',
    authorHint: 'Phương, 36',
  },
  {
    style: 'casual-confession',
    example: 'Đầu gối mình hồi xưa nhói khi đứng dậy ghê lắm. Giờ thì nhẹ hơn rất nhiều.',
    authorHint: 'Cô Yến, 52',
  },
]

// ═══ TRUST REALISM PROMPT DIRECTIVE ═══════════════════════════════════

export const TRUST_REALISM_PROMPT =
  `═══ TRUST REALISM RULES (section 10 — trust-continuity) ═══

PHẢI có:
- 3 mini quotes, DIFFERENT VOICES (different ages/relationships)
- Casual imperfect Vietnamese — typos OK, abbreviations OK (mn, ko, lol)
- Slight grammar shortcuts OK (real FB comments aren't polished)
- Specific details over generic praise ("đỡ 2-3 tuần đầu" > "rất tốt")
- 1 quote can have light emoji (😭 ✨ tối đa 1)
- Each quote 1-2 sentences max
- author label: short Vietnamese descriptor ("Hà, 28" / "Chị Lan, 42" / "Một bạn đọc")

TUYỆT ĐỐI KHÔNG:
- "Sản phẩm rất tốt" / "Mình rất hài lòng" — generic ad copy
- "5/5 sao" / star rating vibe
- Complete formal sentences với perfect grammar
- Multiple emojis (🎉🥰💕)
- Hard-sell phrases ("phải mua ngay", "đáng tiền")
- Long testimonial paragraphs

STYLE references (sample 3 different styles):
- short-validation: "Em cũng đang dùng đây ạ. Đỡ hẳn 2-3 tuần đầu rồi."
- specific-detail: "Sáng nay không cần bấm 'ngủ thêm 10p' nữa, ai từng vậy mới hiểu lol"
- hesitant-comparison: "Mình lúc đầu cũng nghi nghi, mà giờ thấy người nhẹ hơn thật"
- family-mention: "Mẹ em đỡ lắm rồi chị ơi"
- casual-confession: "Đọc xong tui mới biết mình ko phải mỗi mình bị 😭"
- short-affirmation: "Mình recommend nha mn"
- time-specific: "Tuần thứ 3 bắt đầu thấy khác thật"`
