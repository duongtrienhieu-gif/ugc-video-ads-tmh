// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — REVIEW STYLE PROFILES (v5.7 Phase B rebuild)
//
// Per user direction after Phase C test: reviews still feel "AI clean".
// Surface formatting + psychology axes ALONE aren't enough — Gemini needs
// CONCRETE EXAMPLE QUOTES per profile to pattern-match against.
//
// CRITICAL: example quotes are NICHE-MISMATCHED. Each profile has 3
// quotes spanning different topics (sleep / haircare / supplement / etc).
// This way Gemini learns the STRUCTURAL PATTERN (uncertain attribution,
// anti-hype self-honesty, second-hand witness) without being able to copy
// any single quote verbatim — niche won't match the pack.
//
// 18 profiles span real-person archetypes:
//   - uncertain_attribution: "không biết do hợp không nhưng..."
//   - anti_hype_self_honest:  "không thần kỳ đâu nhưng mua lại"
//   - second_hand_witness:    "mẹ mình dùng chứ mình chưa, nhưng thấy mẹ đỡ"
//   - time_flat_closure:      "dùng gần tháng mới thấy á"
//   - awkward_short:          trying-to-engage but bad at it
//   - incomplete_thought:     genuinely trails off
//   - soft_positive:          warm but no hype
//
// Architecture rule: this REPLACES abstract TRUST_REALISM_PROMPT rules.
// Sampling architecture drives diversity, NOT prompt essays.
// ─────────────────────────────────────────────────────────────────────

export type ReviewPlatform =
  | 'fb-comment'
  | 'fb-group-post'
  | 'messenger-dm'
  | 'tiktok-comment'
  | 'review-thread'
  | 'text-message'
  | 'voice-note-transcript'

export type Punctuation = 'minimal' | 'casual' | 'standard' | 'overpunctuated' | 'broken'
export type Grammar = 'broken' | 'casual' | 'standard'
export type Optimism = 'guarded' | 'cautious' | 'moderate' | 'warm'
export type Skepticism = 'high' | 'medium' | 'low' | 'none'
export type TypoRate = 'none' | 'low' | 'medium' | 'high'
export type EmojiBehavior = 'none' | 'rare' | 'moderate' | 'frequent'
export type Energy = 'flat' | 'tired' | 'low' | 'moderate' | 'warm'
export type Persuasion = 'none' | 'accidental' | 'unintentional' | 'soft'
export type AgeVibe = 'gen-z' | 'millennial' | 'middle-aged-mom' | 'mid-life' | 'older-woman' | 'older-man'
export type Completeness = 'fragment' | 'one-liner' | 'partial' | 'complete' | 'trails-off'

// PSYCHOLOGY layer (v5.7 Phase B v2 — kept, now amplified by exampleQuotes)
export type EmotionalIntelligence = 'low' | 'medium' | 'high' | 'volatile'
export type SelfAwareness = 'oblivious' | 'projecting' | 'self-aware' | 'over-analytic'
export type InternetLiteracy = 'native' | 'comfortable' | 'awkward' | 'minimal'
export type WritingEffort = 'careless' | 'dashed-off' | 'considered' | 'overwrought'
export type PersuasionIntent = 'none' | 'sharing' | 'mildly-recommending' | 'evangelizing'
export type PersonalitySharpness = 'sharp-witty' | 'blunt' | 'roundabout' | 'vague' | 'flat'

// NEW in Phase B rebuild — speaks-from-position axis. Where is the reviewer
// relative to the product/experience? Drives "second-hand witness" /
// "uncertain attribution" / "personal direct" voice.
export type ReviewerStance =
  | 'personal-direct'    // I used it, I felt this
  | 'uncertain-cause'    // not sure if it's this or something else
  | 'second-hand'        // someone close to me used it
  | 'observing-self'     // I notice change but don't claim cause
  | 'anti-hype'          // it's not magic but I still ...
  | 'fence-sitter'       // I'm not endorsing, just commenting

export interface ReviewStyleProfile {
  id: string
  label: string
  platform: ReviewPlatform

  // SURFACE
  punctuation: Punctuation
  grammar: Grammar
  optimism: Optimism
  skepticism: Skepticism
  lengthRange: [number, number]
  typoRate: TypoRate
  emojiBehavior: EmojiBehavior
  energy: Energy
  persuasion: Persuasion
  ageVibe: AgeVibe
  completeness: Completeness

  // PSYCHOLOGY
  emotionalIntelligence: EmotionalIntelligence
  selfAwareness: SelfAwareness
  internetLiteracy: InternetLiteracy
  writingEffort: WritingEffort
  persuasionIntent: PersuasionIntent
  personalitySharpness: PersonalitySharpness

  // STANCE (v5.7 Phase B rebuild)
  reviewerStance: ReviewerStance

  /** Author label hints — concrete examples for Gemini to riff on. */
  authorExamples: string[]
  /** 1-line vibe summary. */
  vibe: string
  /** v5.7 Phase B rebuild — CONCRETE example quotes spanning DIFFERENT niches
   *  so Gemini learns STRUCTURE/STANCE pattern without being able to copy any
   *  quote verbatim (niche won't match the pack being generated). 3 quotes. */
  exampleQuotes: string[]
}

export const REVIEW_STYLE_PROFILES: ReviewStyleProfile[] = [
  {
    id: 'uncertain-attribution-positive',
    label: 'Uncertain attribution, soft positive',
    platform: 'fb-comment',
    punctuation: 'casual', grammar: 'casual',
    optimism: 'cautious', skepticism: 'medium',
    lengthRange: [10, 20], typoRate: 'low', emojiBehavior: 'none',
    energy: 'moderate', persuasion: 'none',
    ageVibe: 'mid-life', completeness: 'partial',
    emotionalIntelligence: 'medium', selfAwareness: 'self-aware',
    internetLiteracy: 'comfortable', writingEffort: 'dashed-off',
    persuasionIntent: 'none', personalitySharpness: 'roundabout',
    reviewerStance: 'uncertain-cause',
    authorExamples: ['Phương', 'Hạnh, 36', 'M.'],
    vibe: 'positive but won\'t commit to cause-and-effect; "không biết do hợp không nhưng..."',
    exampleQuotes: [
      'Không biết có phải tâm lý không nhưng dạo này tóc đỡ rụng hẳn rồi á.',
      'Chưa chắc do thuốc này hay do gì, nhưng bữa giờ nhẹ người hẳn.',
      'Không biết do hợp không mà sáng dậy đỡ vật vờ hơn thật.',
    ],
  },
  {
    id: 'anti-hype-self-honest',
    label: 'Anti-hype self-honest',
    platform: 'review-thread',
    punctuation: 'casual', grammar: 'casual',
    optimism: 'guarded', skepticism: 'medium',
    lengthRange: [12, 22], typoRate: 'low', emojiBehavior: 'none',
    energy: 'flat', persuasion: 'none',
    ageVibe: 'mid-life', completeness: 'complete',
    emotionalIntelligence: 'high', selfAwareness: 'self-aware',
    internetLiteracy: 'comfortable', writingEffort: 'considered',
    persuasionIntent: 'none', personalitySharpness: 'blunt',
    reviewerStance: 'anti-hype',
    authorExamples: ['Hiền, 41', 'N.', 'Anh Tuấn'],
    vibe: 'refuses to overclaim, often "không thần kỳ nhưng..."; bought again despite skepticism',
    exampleQuotes: [
      'Không thần kỳ đâu nhưng mình mua lại.',
      'Chả phải đột phá gì, dùng được thì dùng thôi.',
      'Không kỳ vọng cao nhưng vẫn dùng được cả tháng.',
    ],
  },
  {
    id: 'second-hand-witness',
    label: 'Second-hand witness',
    platform: 'fb-comment',
    punctuation: 'casual', grammar: 'casual',
    optimism: 'warm', skepticism: 'low',
    lengthRange: [15, 28], typoRate: 'low', emojiBehavior: 'rare',
    energy: 'warm', persuasion: 'unintentional',
    ageVibe: 'millennial', completeness: 'complete',
    emotionalIntelligence: 'high', selfAwareness: 'self-aware',
    internetLiteracy: 'native', writingEffort: 'dashed-off',
    persuasionIntent: 'sharing', personalitySharpness: 'sharp-witty',
    reviewerStance: 'second-hand',
    authorExamples: ['Linh', 'Mai (con của bác Hoa)', 'Hà.tr'],
    vibe: 'reviewing on behalf of someone else (mom/spouse/sibling); careful to clarify "mình chưa dùng"',
    exampleQuotes: [
      'Mẹ mình dùng chứ mình chưa. Nhưng thấy mẹ đỡ than mệt hẳn.',
      'Chồng mình uống cái này, dạo này thấy đỡ kêu đau lưng.',
      'Em gái mình kể dùng được 2 tuần là khác hẳn, mình chưa thử.',
    ],
  },
  {
    id: 'time-flat-closure',
    label: 'Time-aware flat closure',
    platform: 'review-thread',
    punctuation: 'minimal', grammar: 'casual',
    optimism: 'cautious', skepticism: 'medium',
    lengthRange: [5, 12], typoRate: 'low', emojiBehavior: 'none',
    energy: 'flat', persuasion: 'none',
    ageVibe: 'mid-life', completeness: 'one-liner',
    emotionalIntelligence: 'medium', selfAwareness: 'self-aware',
    internetLiteracy: 'comfortable', writingEffort: 'careless',
    persuasionIntent: 'none', personalitySharpness: 'flat',
    reviewerStance: 'personal-direct',
    authorExamples: ['N.', 'Tâm', 'T.H'],
    vibe: 'short factual time-anchor with no emotion; minimum-effort comment',
    exampleQuotes: [
      'Dùng gần tháng mới thấy á.',
      'Uống tuần thứ 3 bắt đầu đỡ.',
      'Mua hồi tháng trước, giờ thấy ok.',
    ],
  },
  {
    id: 'awkward-short',
    label: 'Awkward short attempt',
    platform: 'fb-comment',
    punctuation: 'broken', grammar: 'broken',
    optimism: 'moderate', skepticism: 'low',
    lengthRange: [5, 11], typoRate: 'medium', emojiBehavior: 'rare',
    energy: 'low', persuasion: 'accidental',
    ageVibe: 'middle-aged-mom', completeness: 'fragment',
    emotionalIntelligence: 'low', selfAwareness: 'oblivious',
    internetLiteracy: 'minimal', writingEffort: 'careless',
    persuasionIntent: 'sharing', personalitySharpness: 'flat',
    reviewerStance: 'personal-direct',
    authorExamples: ['Cô Bảy', 'Chị Tư', 'Một mẹ bỉm'],
    vibe: 'tries to comment but not good at it; misses punctuation, drops connector words',
    exampleQuotes: [
      'Cô cũng đang dùng đó, thấy đỡ thật',
      'Mình mua rồi nhe ok lắm',
      'cảm ơn ban share mình cũng vây',
    ],
  },
  {
    id: 'incomplete-thought',
    label: 'Truly incomplete thought',
    platform: 'fb-comment',
    punctuation: 'broken', grammar: 'casual',
    optimism: 'cautious', skepticism: 'medium',
    lengthRange: [8, 16], typoRate: 'low', emojiBehavior: 'none',
    energy: 'low', persuasion: 'none',
    ageVibe: 'mid-life', completeness: 'trails-off',
    emotionalIntelligence: 'high', selfAwareness: 'over-analytic',
    internetLiteracy: 'comfortable', writingEffort: 'considered',
    persuasionIntent: 'none', personalitySharpness: 'vague',
    reviewerStance: 'observing-self',
    authorExamples: ['M.', 'V.A'],
    vibe: 'trails off mid-thought; ellipsis or just stops; doesn\'t resolve sentence',
    exampleQuotes: [
      'Mình cũng từng vậy nên hiểu, đợt rồi dùng thử cái này thì...',
      'Khó nói lắm, mỗi người mỗi khác mà, riêng mình thì',
      'Chưa biết nói sao nhưng đỡ hơn trước là...',
    ],
  },
  {
    id: 'soft-positive',
    label: 'Soft positive warm',
    platform: 'fb-group-post',
    punctuation: 'casual', grammar: 'casual',
    optimism: 'warm', skepticism: 'low',
    lengthRange: [18, 30], typoRate: 'low', emojiBehavior: 'rare',
    energy: 'warm', persuasion: 'unintentional',
    ageVibe: 'middle-aged-mom', completeness: 'complete',
    emotionalIntelligence: 'high', selfAwareness: 'self-aware',
    internetLiteracy: 'comfortable', writingEffort: 'considered',
    persuasionIntent: 'sharing', personalitySharpness: 'roundabout',
    reviewerStance: 'personal-direct',
    authorExamples: ['Chị Hà', 'Mai mẹ Bống', 'Phương (mẹ 2 bé)'],
    vibe: 'warm without hype; concrete moments without exaggeration',
    exampleQuotes: [
      'Mình dùng được tháng rồi, cảm thấy người dễ chịu hơn, không quá rõ ràng nhưng có khác.',
      'Đỡ hơn thật chị ơi, sáng dậy không nặng đầu như trước.',
      'Cảm ơn chị share, mình cũng đang dùng, thấy ổn ổn.',
    ],
  },
  {
    id: 'messy-late-night-dm',
    label: 'Messy late-night Messenger DM',
    platform: 'messenger-dm',
    punctuation: 'minimal', grammar: 'casual',
    optimism: 'guarded', skepticism: 'medium',
    lengthRange: [10, 20], typoRate: 'medium', emojiBehavior: 'rare',
    energy: 'tired', persuasion: 'none',
    ageVibe: 'middle-aged-mom', completeness: 'fragment',
    emotionalIntelligence: 'medium', selfAwareness: 'self-aware',
    internetLiteracy: 'minimal', writingEffort: 'careless',
    persuasionIntent: 'sharing', personalitySharpness: 'roundabout',
    reviewerStance: 'personal-direct',
    authorExamples: ['Một bạn', 'Linh', 'M.'],
    vibe: 'tired mom texting at 11pm, dropped caps, missing periods, half-thoughts',
    exampleQuotes: [
      'mình cũng vậy đó chị bữa giờ uống nó thấy đỡ thiệt nhưng không nhanh đâu',
      'em dùng được 3 tuần rồi tự nhiên sáng dậy bớt mệt á',
      'mình bị giống chị mua thử thấy ok dùng tiếp xem sao',
    ],
  },
  {
    id: 'skeptical-short',
    label: 'Skeptical short reply',
    platform: 'review-thread',
    punctuation: 'standard', grammar: 'standard',
    optimism: 'guarded', skepticism: 'high',
    lengthRange: [8, 15], typoRate: 'none', emojiBehavior: 'none',
    energy: 'flat', persuasion: 'none',
    ageVibe: 'older-man', completeness: 'partial',
    emotionalIntelligence: 'low', selfAwareness: 'projecting',
    internetLiteracy: 'minimal', writingEffort: 'considered',
    persuasionIntent: 'none', personalitySharpness: 'blunt',
    reviewerStance: 'fence-sitter',
    authorExamples: ['Anh Tuấn, 46', 'D. Hùng', 'Khách'],
    vibe: 'reluctant to commit; "tạm ổn", "chưa biết nói sao"; doesn\'t recommend or reject',
    exampleQuotes: [
      'Cũng chưa biết nói sao, dùng tuần nữa xem.',
      'Tạm ổn, không như quảng cáo nhưng đỡ hơn vài cái khác.',
      'Vợ tôi bảo dùng tiếp thì tôi dùng thôi.',
    ],
  },
  {
    id: 'voice-note-runon',
    label: 'Voice-note transcript run-on',
    platform: 'voice-note-transcript',
    punctuation: 'minimal', grammar: 'casual',
    optimism: 'warm', skepticism: 'low',
    lengthRange: [30, 50], typoRate: 'low', emojiBehavior: 'none',
    energy: 'warm', persuasion: 'accidental',
    ageVibe: 'middle-aged-mom', completeness: 'complete',
    emotionalIntelligence: 'volatile', selfAwareness: 'over-analytic',
    internetLiteracy: 'awkward', writingEffort: 'dashed-off',
    persuasionIntent: 'sharing', personalitySharpness: 'roundabout',
    reviewerStance: 'personal-direct',
    authorExamples: ['Chị Lan', 'Hương mẹ Su'],
    vibe: 'run-on sentence as if speaking; "à mà" / "ờ" filler; meandering',
    exampleQuotes: [
      'à mà chị ơi mình cũng đang dùng cái này nè ban đầu cũng không tin lắm đâu mà dùng được hơn tháng thì thấy khác thật à không phải khỏe rần rần đâu mà nhẹ nhẹ thôi',
      'ờ cái này em mua hồi sinh nhật mẹ tặng mẹ á mà rồi mẹ bảo dùng được nên giờ em cũng dùng theo cũng thấy ổn',
      'mình thì cũng giống chị thôi mà mình dùng song song với mấy thứ khác nên không chắc cái nào ăn cái nào nhưng mà sáng dậy đỡ ngu ngu hơn',
    ],
  },
  {
    id: 'fb-group-sharing',
    label: 'FB group sharing reply',
    platform: 'fb-group-post',
    punctuation: 'casual', grammar: 'casual',
    optimism: 'warm', skepticism: 'low',
    lengthRange: [22, 35], typoRate: 'low', emojiBehavior: 'rare',
    energy: 'warm', persuasion: 'mildly-recommending' as PersuasionIntent === 'mildly-recommending' ? 'unintentional' : 'unintentional',
    ageVibe: 'middle-aged-mom', completeness: 'complete',
    emotionalIntelligence: 'medium', selfAwareness: 'projecting',
    internetLiteracy: 'comfortable', writingEffort: 'considered',
    persuasionIntent: 'mildly-recommending', personalitySharpness: 'roundabout',
    reviewerStance: 'personal-direct',
    authorExamples: ['Chị Hà, 38', 'Phương (mẹ 2 bé)'],
    vibe: 'group-mom voice; shares own context before opinion; community-supportive',
    exampleQuotes: [
      'Mình hồi đó cũng vậy đó chị, có bé thứ 2 xong là kiệt sức luôn. Mình uống cái này được tháng rưỡi thì đỡ hẳn cái cảm giác cạn pin buổi chiều.',
      'Chị thử coi, em dùng được khá lâu rồi, không quá nhanh nhưng yên tâm hơn vì không hóa chất.',
      'Trong nhóm mình có mấy chị cũng dùng, mình cũng đang dùng, thấy ổn nha chị.',
    ],
  },
  {
    id: 'casual-friend-peer',
    label: 'Casual friend peer-share',
    platform: 'fb-comment',
    punctuation: 'casual', grammar: 'casual',
    optimism: 'moderate', skepticism: 'medium',
    lengthRange: [10, 18], typoRate: 'low', emojiBehavior: 'rare',
    energy: 'moderate', persuasion: 'accidental',
    ageVibe: 'millennial', completeness: 'partial',
    emotionalIntelligence: 'medium', selfAwareness: 'self-aware',
    internetLiteracy: 'native', writingEffort: 'dashed-off',
    persuasionIntent: 'sharing', personalitySharpness: 'sharp-witty',
    reviewerStance: 'personal-direct',
    authorExamples: ['T.', 'Vy linh', 'Hà'],
    vibe: 'peer talking to peer; no parental/spousal hook; "mình" voice, light',
    exampleQuotes: [
      'Mình cũng đang dùng nè, không nhanh nhưng yên tâm hơn cái mình dùng trước.',
      'Em thấy cái này hợp với mình đó, dùng đều thì thấy khác.',
      'Bạn cứ thử đi, mình dùng được 2 tháng rồi không thấy gì lạ.',
    ],
  },
  {
    id: 'practical-woman',
    label: 'Practical no-narrative',
    platform: 'review-thread',
    punctuation: 'standard', grammar: 'standard',
    optimism: 'cautious', skepticism: 'medium',
    lengthRange: [20, 32], typoRate: 'none', emojiBehavior: 'none',
    energy: 'moderate', persuasion: 'none',
    ageVibe: 'mid-life', completeness: 'complete',
    emotionalIntelligence: 'medium', selfAwareness: 'projecting',
    internetLiteracy: 'comfortable', writingEffort: 'considered',
    persuasionIntent: 'none', personalitySharpness: 'blunt',
    reviewerStance: 'personal-direct',
    authorExamples: ['Chị Mai, 42', 'N. Hoa', 'Hạnh'],
    vibe: 'no story; just symptom + timeline + result; matter-of-fact',
    exampleQuotes: [
      'Mệt mỏi buổi sáng, dùng 3 tuần thấy đỡ. Không có gì kỳ diệu, dùng tiếp.',
      'Đau khớp gối khi đứng lâu, sau 1 tháng đỡ rõ. Tốt.',
      'Mất ngủ chronic, uống được 6 tuần, ngủ sâu hơn khoảng 60%. Mua lại.',
    ],
  },
  {
    id: 'oversharing-context-dump',
    label: 'Oversharing context-dump',
    platform: 'fb-group-post',
    punctuation: 'overpunctuated', grammar: 'casual',
    optimism: 'warm', skepticism: 'low',
    lengthRange: [35, 55], typoRate: 'low', emojiBehavior: 'moderate',
    energy: 'volatile' as Energy === 'tired' ? 'tired' : 'warm',
    persuasion: 'accidental',
    ageVibe: 'middle-aged-mom', completeness: 'complete',
    emotionalIntelligence: 'volatile', selfAwareness: 'over-analytic',
    internetLiteracy: 'awkward', writingEffort: 'overwrought',
    persuasionIntent: 'evangelizing', personalitySharpness: 'roundabout',
    reviewerStance: 'personal-direct',
    authorExamples: ['Lan mẹ Bin ❤️', 'Chị Hương ☺'],
    vibe: 'starts with whole life story before tiny opinion; multiple exclamations',
    exampleQuotes: [
      'Trời ơi mình kể luôn, mình sinh xong bé thứ 2 thì cứ vật vờ suốt 1 năm trời, đi khám đủ thứ mà ai cũng bảo bình thường, mình stress muốn khóc luôn ấy!!! Rồi tự nhiên em họ giới thiệu cái này, dùng đâu 1 tháng thấy nhẹ hẳn, mọi người thử xem nha ❤️',
      'Ôi mình đọc bài chị mà mình ráng kể, chồng mình hồi xưa cũng thế, mệt mỏi cáu gắt, mình cũng mệt theo... rồi anh ấy uống cái này theo lời mẹ chồng mình, giờ đỡ kêu hẳn, mừng quá!!!',
      'Các mom ơi mình mua thử cho con cái dạng vitamin ấy, ban đầu cũng nghi nghi không tin lắm vì mình hay đọc review giả lắm nhưng mà thật sự dùng xong là bé ăn ngon hẳn, mình mừng phát khóc!',
    ],
  },
  {
    id: 'tired-mom-late-night',
    label: 'Tired mom semi-incoherent',
    platform: 'messenger-dm',
    punctuation: 'broken', grammar: 'broken',
    optimism: 'cautious', skepticism: 'medium',
    lengthRange: [8, 16], typoRate: 'high', emojiBehavior: 'none',
    energy: 'tired', persuasion: 'none',
    ageVibe: 'middle-aged-mom', completeness: 'fragment',
    emotionalIntelligence: 'low', selfAwareness: 'oblivious',
    internetLiteracy: 'minimal', writingEffort: 'careless',
    persuasionIntent: 'none', personalitySharpness: 'flat',
    reviewerStance: 'personal-direct',
    authorExamples: ['Một mẹ bỉm', 'H.', 'T.'],
    vibe: 'literally tired; misspells; drops words; 2am energy',
    exampleQuotes: [
      'minh dung dc 2 thang roi tam on. con quay khoc dem nen viet luon',
      'em cũg vậy đó c em mới uống đg đỡ á',
      'mua thử đi cũg dc 30k với mua thử có lệ thôi',
    ],
  },
  {
    id: 'older-woman-formal-warm',
    label: 'Older woman formal-warm',
    platform: 'fb-comment',
    punctuation: 'standard', grammar: 'standard',
    optimism: 'warm', skepticism: 'low',
    lengthRange: [25, 40], typoRate: 'none', emojiBehavior: 'none',
    energy: 'moderate', persuasion: 'unintentional',
    ageVibe: 'older-woman', completeness: 'complete',
    emotionalIntelligence: 'medium', selfAwareness: 'oblivious',
    internetLiteracy: 'awkward', writingEffort: 'overwrought',
    persuasionIntent: 'mildly-recommending', personalitySharpness: 'roundabout',
    reviewerStance: 'personal-direct',
    authorExamples: ['Cô Thu, 58', 'Bác Hoa', 'Bà Năm'],
    vibe: 'addresses "các cháu/mọi người"; full sentences; no slang; gentle elder tone',
    exampleQuotes: [
      'Cô có dùng cái này gần 2 tháng, các cháu ạ. Đầu gối cô đỡ nhói hẳn khi đi cầu thang. Cô không quảng cáo, chỉ là cô đỡ thật.',
      'Bác cũng từng như cháu vậy, lúc chuyển mùa là khớp đau lắm. Bác uống cái này đều, giờ đỡ rất nhiều. Cảm ơn cháu đã share.',
      'Mọi người ạ, tôi 57 rồi, ngủ rất kém suốt 5 năm. Dùng cái này được 1 tháng rưỡi, ngủ sâu hơn hẳn. Tôi vẫn dùng đều.',
    ],
  },
  {
    id: 'casual-genz-short',
    label: 'Casual Gen-Z short',
    platform: 'tiktok-comment',
    punctuation: 'minimal', grammar: 'broken',
    optimism: 'moderate', skepticism: 'low',
    lengthRange: [4, 10], typoRate: 'medium', emojiBehavior: 'moderate',
    energy: 'warm', persuasion: 'accidental',
    ageVibe: 'gen-z', completeness: 'one-liner',
    emotionalIntelligence: 'medium', selfAwareness: 'self-aware',
    internetLiteracy: 'native', writingEffort: 'dashed-off',
    persuasionIntent: 'sharing', personalitySharpness: 'sharp-witty',
    reviewerStance: 'personal-direct',
    authorExamples: ['hng99', 'tr.minh', 'em.un'],
    vibe: 'all lowercase; slang ("xịn", "đỉnh"); emoji cluster; abbreviated everything',
    exampleQuotes: [
      'mom em uống đỉnh thiệt á',
      'real luôn em cũng đang dùng',
      'same e cũg bị giống chị',
    ],
  },
  {
    id: 'one-line-low-effort',
    label: 'One-line minimum effort',
    platform: 'fb-comment',
    punctuation: 'minimal', grammar: 'casual',
    optimism: 'cautious', skepticism: 'medium',
    lengthRange: [3, 7], typoRate: 'low', emojiBehavior: 'none',
    energy: 'low', persuasion: 'none',
    ageVibe: 'mid-life', completeness: 'one-liner',
    emotionalIntelligence: 'low', selfAwareness: 'oblivious',
    internetLiteracy: 'comfortable', writingEffort: 'careless',
    persuasionIntent: 'none', personalitySharpness: 'flat',
    reviewerStance: 'personal-direct',
    authorExamples: ['N.', 'H', 'Mai'],
    vibe: 'absolute minimum effort: "same", "mình cũng", done',
    exampleQuotes: [
      'same e cũg vậy',
      'mình cũng',
      'ok ổn',
    ],
  },
]

// ═══ DIVERSITY SAMPLING ═══════════════════════════════════════════════

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample N review styles with PSYCHOLOGY + STANCE diversity guarantee.
 *  Weighted scoring across 7 axes (added reviewerStance). Min threshold 5.
 *  Deterministic per seed. */
export function sampleReviewStyles(seed: string, n: number): ReviewStyleProfile[] {
  const all = REVIEW_STYLE_PROFILES
  if (n >= all.length) return all.slice(0, n)

  function diversityScore(candidate: ReviewStyleProfile, picked: ReviewStyleProfile[]): number {
    let minScore = Infinity
    for (const p of picked) {
      let score = 0
      // Surface (1 weight)
      if (p.energy !== candidate.energy) score++
      if (p.optimism !== candidate.optimism) score++
      // Psychology (2 weight — main diversity driver)
      if (p.emotionalIntelligence !== candidate.emotionalIntelligence) score += 2
      if (p.selfAwareness !== candidate.selfAwareness) score += 2
      if (p.persuasionIntent !== candidate.persuasionIntent) score += 2
      if (p.personalitySharpness !== candidate.personalitySharpness) score += 2
      // Stance (3 weight — most important diversity axis in rebuild)
      if (p.reviewerStance !== candidate.reviewerStance) score += 3
      if (score < minScore) minScore = score
    }
    return minScore
  }

  const pickedIds = new Set<string>()
  const picked: ReviewStyleProfile[] = []

  const cursor = hashSeed(`${seed}:reviewStyle:0`) % all.length
  picked.push(all[cursor])
  pickedIds.add(all[cursor].id)

  for (let i = 1; i < n; i++) {
    const probeStart = hashSeed(`${seed}:reviewStyle:${i}`) % all.length
    let best: ReviewStyleProfile | null = null
    let bestScore = -1
    const probeRange = Math.max(8, Math.floor(all.length / 2))
    for (let j = 0; j < probeRange; j++) {
      const candidate = all[(probeStart + j) % all.length]
      if (pickedIds.has(candidate.id)) continue
      const score = diversityScore(candidate, picked)
      if (score >= 5 && score > bestScore) {
        best = candidate
        bestScore = score
      }
    }
    if (!best) {
      for (const s of all) {
        if (!pickedIds.has(s.id)) { best = s; break }
      }
    }
    if (best) {
      picked.push(best)
      pickedIds.add(best.id)
    }
  }
  return picked
}

// ═══ PROMPT INJECTION ═════════════════════════════════════════════════

/** Format a single style profile as concrete data + 3 niche-mismatched example
 *  quotes per slot. Gemini learns STRUCTURE pattern from examples without
 *  being able to copy any verbatim (niche won't match the pack). */
export function reviewStyleBrief(s: ReviewStyleProfile, slotNum: number): string {
  const [lenMin, lenMax] = s.lengthRange
  const authorEx = s.authorExamples.slice(0, 2).join(' / ')
  const examples = s.exampleQuotes
    .map((q) => `  "${q}"`)
    .join('\n')
  return `── Review slot ${slotNum} [style: ${s.id}] ──
vibe: ${s.vibe}
STANCE: ${s.reviewerStance} (most important — drives voice positioning)
psychology: EI=${s.emotionalIntelligence} | self-awareness=${s.selfAwareness} | writing-effort=${s.writingEffort} | persuasion-intent=${s.persuasionIntent} | personality=${s.personalitySharpness}
surface: platform=${s.platform} | age=${s.ageVibe} | energy=${s.energy} | optimism=${s.optimism} | skepticism=${s.skepticism}
format: length=${lenMin}-${lenMax} từ | completeness=${s.completeness} | grammar=${s.grammar} | punctuation=${s.punctuation} | typos=${s.typoRate} | emoji=${s.emojiBehavior}
author label: ${authorEx}
example quotes (SHAPE-only, NEVER copy — they're from different niches):
${examples}`
}

/** Compose review block directive. Used in SEPARATE review-only Gemini call.
 *  v5.7 Phase B rebuild: shorter preamble, exampleQuotes do most of the work. */
export function buildReviewBlockDirective(styles: ReviewStyleProfile[]): string {
  const slots = styles.map((s, i) => reviewStyleBrief(s, i + 1)).join('\n\n')
  return `Generate 3 reviews. Each slot has its OWN profile below.

Match the STANCE (most important) + psychology dimensions + format constraints.
Example quotes show STRUCTURAL PATTERN per style — do NOT copy any verbatim
(they're niche-mismatched to the pack). Generate new quotes for this pack's
niche/product that match the SHAPE/STANCE pattern.

Different slots = different humans = different brains. Some reviews SHOULD
feel underwritten / fragmented / awkward / careless / flat. Real humans are
inconsistent. NEVER force all 3 into a polished voice.

${slots}

HARD CONSTRAINTS (cross-style — Vietnamese ad-copy reflexes):
- NO "5/5 sao" / star rating language
- NO "Sản phẩm rất tốt" / "rất hài lòng" / generic ad copy
- NO "Phải mua ngay" / "đáng tiền" / hard sell
- NO multiple emoji clusters (🎉🥰💕)`
}
