// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — text pacing rules (P0.5.4 realignment)
//
// Storyselling target: conversational confession voice — sounds like a
// Vietnamese friend casually sharing. NOT literary fragmentation, NOT
// generic copywriting.
//
// Read-aloud test is the single arbiter: "Does this sound like a real
// person talking, or a screenplay / essay / FB ad?"
// ─────────────────────────────────────────────────────────────────────

import type { PacingRules } from '../types'

export const PACING_RULES: PacingRules = {
  paragraphDensity: {
    /** Conversational paragraphs hold more than fragmented chops. 5 sentences max. */
    maxSentencesPerParagraph: 5,
    /** Optional breathing — rare emphasis, not pattern. */
    minBreathingLines: 1,
  },

  rhythmElements: {
    /** Short emotional lines: SPARINGLY OK as emphasis among flowing context. NOT pattern. */
    shortEmotionalLine:   'optional',
    /** Pause lines (3-7 words): rare emphasis only. */
    pauseLine:            'optional',
    /** End-of-section reflection: natural, recommended. */
    oneLineReflection:    'recommended',
    /** Trailing "…": rare — too many becomes literary device. */
    unfinishedThought:    'optional',
    /** CORE: sentences flow like talking with a friend. */
    conversationalRhythm: true,
  },

  /** Patterns runtime prompt MUST instruct LLM to avoid. */
  bannedPatterns: [
    // Keep — AI essay structure (still bad)
    'firstly-secondly',
    'bullet-spam',
    'statistical-claim',
    'doctor-testimonial',
    'miracle-transformation',
    'overdramatic-trauma',
    'hard-sell',
    'fake-urgency',
    'giant-paragraph',
    'ai-essay-tone',

    // P0.5.4 storyselling adds — extremes
    'fragmented-cinematic',     // "Mệt. Rất mệt. Lại một đêm nữa." — screenplay chop
    'cinematic-blocking',       // "Vặn vòi nước. Quay lại bàn." — novelistic
    'observer-3rd-person',      // 3rd-person named character as main subject
    'copywriter-template',      // "Bạn xứng đáng...", "Đừng bỏ lỡ..."
    'motivational-guru',        // "Hãy tin vào bản thân..."
    'fake-empathy-script',      // "Tôi hiểu cảm giác của bạn..."
    'formulaic-hook-spam',      // same "Bạn đã từng..." opener every pack
  ],

  diarySelfTestPrompt:
    'Đọc đoạn này lên tiếng — nghe như một người Việt thật đang casually share trải nghiệm với bạn thân (PASS), hay như AI viết essay / screenplay / FB ad (FAIL)?',
}
