// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — REVIEW STYLE PROFILES (v5.7 / Phase B)
//
// Per user direction after first real CLI test:
//
//   "Reviews section is the MOST repetitive part right now — even when
//    main story improves, reviews still expose the AI pattern immediately.
//
//    Current reviews feel like: 'AI trying to sound human'.
//    Goal: 'humans accidentally sounding human'.
//
//    Build reviewVariationEngine as separate generation subsystem,
//    NOT as a tiny extension of storytelling prose."
//
// SAMPLING ARCHITECTURE:
//   - 15 discrete ReviewStyleProfile objects (this file).
//   - selectNarratorDna samples 3 per pack via seed (diversity guarantee:
//     spread across energy + optimism axes — no 3 same-feel reviews).
//   - Prompt injects ONLY the 3 picked style objects as concrete data
//     per review slot — NOT a list of "use casual tone" abstract rules.
//   - Some styles intentionally produce incomplete / awkward / flat /
//     underwritten / too-short reviews (real humans are inconsistent).
//
// Critical: this REPLACES TRUST_REALISM_PROMPT static directive in
// trustRealismLibrary.ts (which was 27 lines of abstract rules causing
// all reviews to converge to "polished human-but-AI" voice).
// ─────────────────────────────────────────────────────────────────────

export type ReviewPlatform =
  | 'fb-comment'           // Facebook public comment
  | 'fb-group-post'        // Facebook group post (slightly longer, mom-vibe)
  | 'messenger-dm'         // Private DM, intimate
  | 'tiktok-comment'       // Very short, Gen-Z energy
  | 'review-thread'        // Shopee/Lazada comment thread (often skeptical)
  | 'text-message'         // SMS/Zalo text (very casual, fragmented)
  | 'voice-note-transcript' // Transcribed voice note (run-on, conversational)

export type Punctuation = 'minimal' | 'casual' | 'standard' | 'overpunctuated' | 'broken'
export type Grammar = 'broken' | 'casual' | 'standard'
export type Optimism = 'guarded' | 'cautious' | 'moderate' | 'warm'
export type Skepticism = 'high' | 'medium' | 'low' | 'none'
export type TypoRate = 'none' | 'low' | 'medium' | 'high'
export type EmojiBehavior = 'none' | 'rare' | 'moderate' | 'frequent'
export type Energy = 'flat' | 'tired' | 'low' | 'moderate' | 'warm'
export type Persuasion = 'none' | 'accidental' | 'unintentional' | 'soft'
export type AgeVibe = 'gen-z' | 'millennial' | 'middle-aged-mom' | 'mid-life' | 'older-woman' | 'older-man'
export type Completeness = 'fragment' | 'one-liner' | 'partial' | 'complete'

// v5.7 Phase B v2 — PSYCHOLOGY LAYER.
// Per user direction: surface formatting variation alone produces "same psychology
// wearing different clothes". Add 6 orthogonal psychology dimensions so each style
// has a distinct UNDERLYING BRAIN, not just different formatting.

export type EmotionalIntelligence = 'low' | 'medium' | 'high' | 'volatile'
// low = doesn't recognize own feelings clearly
// medium = recognizes obvious states
// high = nuanced self-understanding
// volatile = reactive ups/downs, inconsistent across same review

export type SelfAwareness = 'oblivious' | 'projecting' | 'self-aware' | 'over-analytic'
// oblivious = doesn't see own patterns
// projecting = blames external factors / others
// self-aware = recognizes own patterns honestly
// over-analytic = navel-gazes, over-explains motivations

export type InternetLiteracy = 'native' | 'comfortable' | 'awkward' | 'minimal'
// native = uses memes / slang / conventions fluently
// comfortable = normal social media user
// awkward = uses internet conventions wrong (over-formal in casual space, etc)
// minimal = uses it like SMS, no platform awareness

export type WritingEffort = 'careless' | 'dashed-off' | 'considered' | 'overwrought'
// careless = doesn't proofread, doesn't care
// dashed-off = quick reply, minimal but coherent
// considered = took a moment to phrase it
// overwrought = tried too hard, awkward result

export type PersuasionIntent = 'none' | 'sharing' | 'mildly-recommending' | 'evangelizing'

export type PersonalitySharpness = 'sharp-witty' | 'blunt' | 'roundabout' | 'vague' | 'flat'
// sharp-witty = quick punchy observations
// blunt = direct without polish
// roundabout = takes long path to point
// vague = gestures at meaning without landing
// flat = no personality coloring at all

export interface ReviewStyleProfile {
  /** Unique style ID. */
  id: string
  /** Human-readable label. */
  label: string
  /** Where this review would naturally appear. */
  platform: ReviewPlatform

  // ── SURFACE formatting layer ──
  punctuation: Punctuation
  grammar: Grammar
  optimism: Optimism
  skepticism: Skepticism
  /** Words per quote — Gemini targets within range. */
  lengthRange: [number, number]
  typoRate: TypoRate
  emojiBehavior: EmojiBehavior
  energy: Energy
  persuasion: Persuasion
  ageVibe: AgeVibe
  completeness: Completeness

  // ── PSYCHOLOGY layer (v5.7 Phase B v2) ──
  emotionalIntelligence: EmotionalIntelligence
  selfAwareness: SelfAwareness
  internetLiteracy: InternetLiteracy
  writingEffort: WritingEffort
  persuasionIntent: PersuasionIntent
  personalitySharpness: PersonalitySharpness

  /** Author label template — concrete examples for Gemini to pattern-match. */
  authorExamples: string[]
  /** 1-line vibe summary. Drives quote feel. */
  vibe: string
}

/** 16 distinct style profiles per user spec. Intentionally includes
 *  underwritten / incomplete / fragment styles so output feels human-inconsistent. */
export const REVIEW_STYLE_PROFILES: ReviewStyleProfile[] = [
  {
    id: 'messy-messenger-dm',
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
    authorExamples: ['Một bạn', 'Linh', 'M.'],
    vibe: 'tired mom texting at 11pm, dropped capitalization, missing periods, half-thoughts',
  },
  {
    id: 'short-tiktok-comment',
    label: 'Short TikTok comment',
    platform: 'tiktok-comment',
    punctuation: 'minimal', grammar: 'casual',
    optimism: 'moderate', skepticism: 'low',
    lengthRange: [4, 10], typoRate: 'low', emojiBehavior: 'moderate',
    energy: 'warm', persuasion: 'accidental',
    ageVibe: 'gen-z', completeness: 'one-liner',
    emotionalIntelligence: 'low', selfAwareness: 'oblivious',
    internetLiteracy: 'native', writingEffort: 'dashed-off',
    persuasionIntent: 'sharing', personalitySharpness: 'flat',
    authorExamples: ['hng', 'tracyy', '@vy.linh'],
    vibe: 'Gen-Z casual, lowercase only, emoji-light, "same here" energy',
  },
  {
    id: 'fb-group-mom-comment',
    label: 'Facebook mom-group comment',
    platform: 'fb-group-post',
    punctuation: 'casual', grammar: 'casual',
    optimism: 'warm', skepticism: 'low',
    lengthRange: [20, 35], typoRate: 'low', emojiBehavior: 'rare',
    energy: 'warm', persuasion: 'unintentional',
    ageVibe: 'middle-aged-mom', completeness: 'complete',
    emotionalIntelligence: 'medium', selfAwareness: 'projecting',
    internetLiteracy: 'comfortable', writingEffort: 'considered',
    persuasionIntent: 'mildly-recommending', personalitySharpness: 'roundabout',
    authorExamples: ['Chị Hà, 38', 'Mai mẹ Bống', 'Phương (mẹ 2 bé)'],
    vibe: 'supportive group-mom voice, shares personal context unprompted, slightly longer',
  },
  {
    id: 'late-night-texting',
    label: 'Late-night texting fragments',
    platform: 'text-message',
    punctuation: 'broken', grammar: 'casual',
    optimism: 'cautious', skepticism: 'medium',
    lengthRange: [8, 18], typoRate: 'medium', emojiBehavior: 'none',
    energy: 'tired', persuasion: 'none',
    ageVibe: 'millennial', completeness: 'fragment',
    emotionalIntelligence: 'volatile', selfAwareness: 'self-aware',
    internetLiteracy: 'native', writingEffort: 'careless',
    persuasionIntent: 'none', personalitySharpness: 'blunt',
    authorExamples: ['H.', 'Trang'],
    vibe: 'sent in 2-3 separate messages combined, no caps, ellipses or no punctuation',
  },
  {
    id: 'quiet-factual',
    label: 'Quiet factual review',
    platform: 'review-thread',
    punctuation: 'standard', grammar: 'standard',
    optimism: 'cautious', skepticism: 'medium',
    lengthRange: [25, 40], typoRate: 'none', emojiBehavior: 'none',
    energy: 'flat', persuasion: 'none',
    ageVibe: 'mid-life', completeness: 'complete',
    emotionalIntelligence: 'high', selfAwareness: 'self-aware',
    internetLiteracy: 'comfortable', writingEffort: 'considered',
    persuasionIntent: 'none', personalitySharpness: 'blunt',
    authorExamples: ['Cô Yến, 48', 'N. Hoa'],
    vibe: 'matter-of-fact, no emoji, gives timeframe + specific result, no enthusiasm',
  },
  {
    id: 'emotionally-oversharing',
    label: 'Emotionally oversharing comment',
    platform: 'fb-group-post',
    punctuation: 'overpunctuated', grammar: 'casual',
    optimism: 'warm', skepticism: 'low',
    lengthRange: [30, 50], typoRate: 'low', emojiBehavior: 'moderate',
    energy: 'warm', persuasion: 'accidental',
    ageVibe: 'middle-aged-mom', completeness: 'complete',
    emotionalIntelligence: 'volatile', selfAwareness: 'over-analytic',
    internetLiteracy: 'awkward', writingEffort: 'overwrought',
    persuasionIntent: 'evangelizing', personalitySharpness: 'roundabout',
    authorExamples: ['Lan mẹ Bin', 'Chị Hương ☺'],
    vibe: 'starts with own story before the review, multiple exclamations, heart emoji',
  },
  {
    id: 'skeptical-husband',
    label: 'Skeptical husband reluctantly converted',
    platform: 'fb-comment',
    punctuation: 'standard', grammar: 'standard',
    optimism: 'guarded', skepticism: 'high',
    lengthRange: [20, 35], typoRate: 'none', emojiBehavior: 'none',
    energy: 'moderate', persuasion: 'none',
    ageVibe: 'older-man', completeness: 'complete',
    emotionalIntelligence: 'low', selfAwareness: 'projecting',
    internetLiteracy: 'minimal', writingEffort: 'considered',
    persuasionIntent: 'none', personalitySharpness: 'blunt',
    authorExamples: ['Anh Tuấn, 46', 'D. Hùng'],
    vibe: 'comments on wife/partner using it, low-key admits it works without endorsing',
  },
  {
    id: 'daughter-about-mom',
    label: 'Daughter talking about mom',
    platform: 'fb-comment',
    punctuation: 'casual', grammar: 'casual',
    optimism: 'warm', skepticism: 'low',
    lengthRange: [18, 30], typoRate: 'low', emojiBehavior: 'rare',
    energy: 'warm', persuasion: 'unintentional',
    ageVibe: 'millennial', completeness: 'complete',
    emotionalIntelligence: 'high', selfAwareness: 'self-aware',
    internetLiteracy: 'native', writingEffort: 'considered',
    persuasionIntent: 'sharing', personalitySharpness: 'sharp-witty',
    authorExamples: ['Linh', 'Mai', 'Hà.linh'],
    vibe: 'shares for mother, observational ("mẹ em đỡ hẳn"), grateful tone',
  },
  {
    id: 'exhausted-office-worker',
    label: 'Exhausted office worker',
    platform: 'fb-comment',
    punctuation: 'casual', grammar: 'casual',
    optimism: 'cautious', skepticism: 'medium',
    lengthRange: [15, 25], typoRate: 'low', emojiBehavior: 'rare',
    energy: 'tired', persuasion: 'accidental',
    ageVibe: 'millennial', completeness: 'partial',
    emotionalIntelligence: 'medium', selfAwareness: 'over-analytic',
    internetLiteracy: 'comfortable', writingEffort: 'dashed-off',
    persuasionIntent: 'none', personalitySharpness: 'sharp-witty',
    authorExamples: ['T.', 'Phương office'],
    vibe: 'mentions deadline / 3pm slump / cà phê, trails off, "same" energy',
  },
  {
    id: 'casual-genz',
    label: 'Casual Gen-Z wording',
    platform: 'tiktok-comment',
    punctuation: 'minimal', grammar: 'broken',
    optimism: 'moderate', skepticism: 'low',
    lengthRange: [6, 14], typoRate: 'medium', emojiBehavior: 'frequent',
    energy: 'warm', persuasion: 'accidental',
    ageVibe: 'gen-z', completeness: 'one-liner',
    emotionalIntelligence: 'medium', selfAwareness: 'self-aware',
    internetLiteracy: 'native', writingEffort: 'dashed-off',
    persuasionIntent: 'sharing', personalitySharpness: 'sharp-witty',
    authorExamples: ['hng99', 'tr.minh', 'em ún'],
    vibe: 'slang ("xịn xò", "đỉnh nóc"), no caps, emoji clusters, abbreviated everything',
  },
  {
    id: 'older-woman-wording',
    label: 'Older woman formal-warm wording',
    platform: 'fb-comment',
    punctuation: 'standard', grammar: 'standard',
    optimism: 'warm', skepticism: 'low',
    lengthRange: [25, 40], typoRate: 'none', emojiBehavior: 'none',
    energy: 'moderate', persuasion: 'unintentional',
    ageVibe: 'older-woman', completeness: 'complete',
    emotionalIntelligence: 'medium', selfAwareness: 'oblivious',
    internetLiteracy: 'awkward', writingEffort: 'overwrought',
    persuasionIntent: 'mildly-recommending', personalitySharpness: 'roundabout',
    authorExamples: ['Cô Thu, 58', 'Bác Hoa'],
    vibe: 'addresses "các cháu" or "mọi người", formal-warm, full sentences, no slang',
  },
  {
    id: 'fragmented-sentence',
    label: 'Fragmented sentence style',
    platform: 'fb-comment',
    punctuation: 'broken', grammar: 'casual',
    optimism: 'guarded', skepticism: 'medium',
    lengthRange: [10, 20], typoRate: 'low', emojiBehavior: 'none',
    energy: 'low', persuasion: 'none',
    ageVibe: 'mid-life', completeness: 'fragment',
    emotionalIntelligence: 'high', selfAwareness: 'over-analytic',
    internetLiteracy: 'comfortable', writingEffort: 'considered',
    persuasionIntent: 'none', personalitySharpness: 'vague',
    authorExamples: ['M.', 'V.A'],
    vibe: 'broken-up thoughts. comma where period should be. trails. no neat ending.',
  },
  {
    id: 'voice-note-transcript',
    label: 'Voice note transcript vibe',
    platform: 'voice-note-transcript',
    punctuation: 'minimal', grammar: 'casual',
    optimism: 'warm', skepticism: 'low',
    lengthRange: [30, 50], typoRate: 'low', emojiBehavior: 'none',
    energy: 'warm', persuasion: 'accidental',
    ageVibe: 'middle-aged-mom', completeness: 'complete',
    emotionalIntelligence: 'volatile', selfAwareness: 'over-analytic',
    internetLiteracy: 'awkward', writingEffort: 'dashed-off',
    persuasionIntent: 'sharing', personalitySharpness: 'roundabout',
    authorExamples: ['Chị Lan', 'Hương mẹ Su'],
    vibe: 'run-on sentence as if spoken, "à mà" / "ờ" filler, conversational meandering',
  },
  {
    id: 'tired-semi-incoherent',
    label: 'Tired semi-incoherent late-night',
    platform: 'messenger-dm',
    punctuation: 'broken', grammar: 'broken',
    optimism: 'cautious', skepticism: 'medium',
    lengthRange: [8, 16], typoRate: 'high', emojiBehavior: 'none',
    energy: 'tired', persuasion: 'none',
    ageVibe: 'middle-aged-mom', completeness: 'fragment',
    emotionalIntelligence: 'low', selfAwareness: 'oblivious',
    internetLiteracy: 'minimal', writingEffort: 'careless',
    persuasionIntent: 'none', personalitySharpness: 'flat',
    authorExamples: ['Một mẹ bỉm', 'H.'],
    vibe: 'literally tired, misspells, drops words, sounds like 2am with crying baby',
  },
  {
    id: 'one-line-same-here',
    label: 'One-line "same here" reply',
    platform: 'fb-comment',
    punctuation: 'minimal', grammar: 'casual',
    optimism: 'cautious', skepticism: 'medium',
    lengthRange: [3, 8], typoRate: 'low', emojiBehavior: 'rare',
    energy: 'low', persuasion: 'none',
    ageVibe: 'mid-life', completeness: 'one-liner',
    emotionalIntelligence: 'low', selfAwareness: 'oblivious',
    internetLiteracy: 'comfortable', writingEffort: 'careless',
    persuasionIntent: 'none', personalitySharpness: 'flat',
    authorExamples: ['N.', 'H', 'Mai'],
    vibe: 'absolute minimum effort. "same em cũng vậy". "mình cũng". done.',
  },
  {
    id: 'low-effort-internet-reply',
    label: 'Low-effort internet reply',
    platform: 'review-thread',
    punctuation: 'minimal', grammar: 'broken',
    optimism: 'moderate', skepticism: 'low',
    lengthRange: [5, 12], typoRate: 'medium', emojiBehavior: 'none',
    energy: 'flat', persuasion: 'none',
    ageVibe: 'mid-life', completeness: 'fragment',
    emotionalIntelligence: 'low', selfAwareness: 'projecting',
    internetLiteracy: 'minimal', writingEffort: 'careless',
    persuasionIntent: 'none', personalitySharpness: 'vague',
    authorExamples: ['Khách', 'NM', 'Trần V.'],
    vibe: 'half-thought, doesn\'t finish sentence, "dùng cũng đc" energy',
  },
]

// ═══ DIVERSITY SAMPLING ═══════════════════════════════════════════════

/** Simple deterministic hash. */
function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample N review styles from library with PSYCHOLOGY-AWARE diversity guarantee.
 *
 *  v5.7 Phase B v2 — diversity now spreads across SIX axes, not just 2.
 *  Picks must differ on energy AND optimism AND at least ONE psychology axis
 *  (emotionalIntelligence / selfAwareness / persuasionIntent / personalitySharpness).
 *
 *  Reason: spreading on surface only (energy/optimism) produced "same psychology
 *  wearing different clothes" — 3 reviews with same underlying brain just looked
 *  different. Adding psychology spread = each review has a distinct REVIEWER.
 *
 *  Deterministic per seed. */
export function sampleReviewStyles(seed: string, n: number): ReviewStyleProfile[] {
  const all = REVIEW_STYLE_PROFILES
  if (n >= all.length) return all.slice(0, n)

  // Compute diversity score between a candidate and already-picked set.
  // Lower score = more similar (avoid). Higher = better spread.
  function diversityScore(candidate: ReviewStyleProfile, picked: ReviewStyleProfile[]): number {
    let minScore = Infinity
    for (const p of picked) {
      let score = 0
      // Surface axes (each different = +1)
      if (p.energy !== candidate.energy) score++
      if (p.optimism !== candidate.optimism) score++
      // Psychology axes (weighted higher — these are the new "real diversity")
      if (p.emotionalIntelligence !== candidate.emotionalIntelligence) score += 2
      if (p.selfAwareness !== candidate.selfAwareness) score += 2
      if (p.persuasionIntent !== candidate.persuasionIntent) score += 2
      if (p.personalitySharpness !== candidate.personalitySharpness) score += 2
      if (score < minScore) minScore = score
    }
    return minScore
  }

  const pickedIds = new Set<string>()
  const picked: ReviewStyleProfile[] = []

  // 1. Initial pick from full pool.
  const cursor = hashSeed(`${seed}:reviewStyle:0`) % all.length
  picked.push(all[cursor])
  pickedIds.add(all[cursor].id)

  // 2. Subsequent picks: linear probe but score each candidate, keep best score.
  //    Visit ~half the unused pool then commit to best diversity.
  for (let i = 1; i < n; i++) {
    const probeStart = hashSeed(`${seed}:reviewStyle:${i}`) % all.length
    let best: ReviewStyleProfile | null = null
    let bestScore = -1
    const probeRange = Math.max(6, Math.floor(all.length / 2))
    for (let j = 0; j < probeRange; j++) {
      const candidate = all[(probeStart + j) % all.length]
      if (pickedIds.has(candidate.id)) continue
      const score = diversityScore(candidate, picked)
      // Require minimum baseline diversity (avoid clones).
      if (score >= 4 && score > bestScore) {
        best = candidate
        bestScore = score
      }
    }
    // Fallback: take any unused if no candidate met threshold.
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

/** Format a single style profile as concrete data injected into prompt.
 *  ~10-12 lines per review slot. v5.7 Phase B v2 now includes PSYCHOLOGY layer
 *  so Gemini gets a brief describing both HOW the reviewer writes AND how their
 *  brain works (EI / self-awareness / writing effort / persuasion intent / etc). */
export function reviewStyleBrief(s: ReviewStyleProfile, slotNum: number): string {
  const [lenMin, lenMax] = s.lengthRange
  const authorEx = s.authorExamples.slice(0, 2).join(' / ')
  return `Review ${slotNum} [style: ${s.id}]
  vibe: ${s.vibe}
  PSYCHOLOGY: EI=${s.emotionalIntelligence} | self-awareness=${s.selfAwareness} | internet-literacy=${s.internetLiteracy} | writing-effort=${s.writingEffort} | persuasion-intent=${s.persuasionIntent} | personality=${s.personalitySharpness}
  SURFACE: platform=${s.platform} | age=${s.ageVibe} | energy=${s.energy} | optimism=${s.optimism} | skepticism=${s.skepticism}
  FORMAT: length=${lenMin}-${lenMax} từ | completeness=${s.completeness} | grammar=${s.grammar} | punctuation=${s.punctuation} | typos=${s.typoRate} | emoji=${s.emojiBehavior}
  author label format: ${authorEx}`
}

/** Compose the full review block directive used in the SEPARATE review-only
 *  Gemini call (runtime/generateReviews.ts). Replaces old TRUST_REALISM_PROMPT
 *  abstract rules + old in-pack section 10 directive. */
export function buildReviewBlockDirective(styles: ReviewStyleProfile[]): string {
  const slots = styles.map((s, i) => reviewStyleBrief(s, i + 1)).join('\n\n')
  return `Generate 3 mini reviews — each with its OWN concrete profile below.

Each reviewer is a DIFFERENT HUMAN with different psychology, not just different
formatting. Match the PSYCHOLOGY axes (EI / self-awareness / writing effort /
persuasion intent / personality sharpness) — not just the surface formatting.
Some reviews should feel underwritten / fragmented / awkward / careless /
flat / not persuasive. Real humans are inconsistent. NEVER force all 3 into
a polished "AI-trying-to-sound-human" voice.

${slots}

HARD BANS (cross-style):
- "5/5 sao" / star rating language
- "Sản phẩm rất tốt" / "rất hài lòng" — generic ad copy
- "Phải mua ngay" / "đáng tiền" — hard sell
- Multiple emojis in one quote (🎉🥰💕 cluster)
- Formal testimonial paragraph structure
- Storytelling-prose voice (this is a comment/DM, NOT a mini essay)
- Authoritative tone (no reviewer is an expert here)`
}
