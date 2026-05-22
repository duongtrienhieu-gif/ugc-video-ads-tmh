// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — text pacing rules
//
// Micro-breathing config — short emotional lines, pause lines, unfinished
// thoughts, conversational rhythm. Anti AI-essay-tone guardrail.
// ─────────────────────────────────────────────────────────────────────

import type { PacingRules } from '../types'

export const PACING_RULES: PacingRules = {
  paragraphDensity: {
    /** Max câu liên tục trong 1 paragraph trước khi break. Vượt = "giant paragraph" = ban. */
    maxSentencesPerParagraph: 5,
    /** Mỗi section ít nhất 1 dòng breathing (short emotional line / pause line). */
    minBreathingLines: 1,
  },

  rhythmElements: {
    /** Câu 1 dòng cô đọng giữa các đoạn dài. vd "Tôi không nhớ chính xác khi nào nó bắt đầu." */
    shortEmotionalLine:   'required',
    /** Câu đơn ngắn 3-7 chữ. vd "Lần nữa." / "Tôi đã thử." */
    pauseLine:            'recommended',
    /** Câu kết đoạn để người đọc dừng. vd "Có lẽ cơ thể tôi đang nói điều gì đó." */
    oneLineReflection:    'recommended',
    /** Câu kết bằng dấu "…" — open loop / unfinished thought. */
    unfinishedThought:    'optional',
    /** Như nói chuyện, không phải essay. */
    conversationalRhythm: true,
  },

  /** Patterns runtime prompt MUST instruct LLM to avoid. */
  bannedPatterns: [
    'firstly-secondly',
    'bullet-spam',
    'statistical-claim',
    'doctor-testimonial',
    'generic-motivational',
    'miracle-transformation',
    'overdramatic-trauma',
    'hard-sell',
    'fake-urgency',
    'giant-paragraph',
    'ai-essay-tone',
  ],

  diarySelfTestPrompt:
    'Đọc đoạn này lên tiếng — nó nghe như nhật ký một người 35 tuổi, hay như AI viết essay? Nếu essay — viết lại.',
}
