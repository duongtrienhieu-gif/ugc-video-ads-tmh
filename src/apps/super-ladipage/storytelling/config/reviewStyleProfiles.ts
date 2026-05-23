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

export interface ReviewStyleProfile {
  /** Unique style ID. */
  id: string
  /** Human-readable label. */
  label: string
  /** Where this review would naturally appear. */
  platform: ReviewPlatform
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
    punctuation: 'minimal',
    grammar: 'casual',
    optimism: 'guarded',
    skepticism: 'medium',
    lengthRange: [10, 20],
    typoRate: 'medium',
    emojiBehavior: 'rare',
    energy: 'tired',
    persuasion: 'none',
    ageVibe: 'middle-aged-mom',
    completeness: 'fragment',
    authorExamples: ['Một bạn', 'Linh', 'M.'],
    vibe: 'tired mom texting at 11pm, dropped capitalization, missing periods, half-thoughts',
  },
  {
    id: 'short-tiktok-comment',
    label: 'Short TikTok comment',
    platform: 'tiktok-comment',
    punctuation: 'minimal',
    grammar: 'casual',
    optimism: 'moderate',
    skepticism: 'low',
    lengthRange: [4, 10],
    typoRate: 'low',
    emojiBehavior: 'moderate',
    energy: 'warm',
    persuasion: 'accidental',
    ageVibe: 'gen-z',
    completeness: 'one-liner',
    authorExamples: ['hng', 'tracyy', '@vy.linh'],
    vibe: 'Gen-Z casual, lowercase only, emoji-light, "same here" energy',
  },
  {
    id: 'fb-group-mom-comment',
    label: 'Facebook mom-group comment',
    platform: 'fb-group-post',
    punctuation: 'casual',
    grammar: 'casual',
    optimism: 'warm',
    skepticism: 'low',
    lengthRange: [20, 35],
    typoRate: 'low',
    emojiBehavior: 'rare',
    energy: 'warm',
    persuasion: 'unintentional',
    ageVibe: 'middle-aged-mom',
    completeness: 'complete',
    authorExamples: ['Chị Hà, 38', 'Mai mẹ Bống', 'Phương (mẹ 2 bé)'],
    vibe: 'supportive group-mom voice, shares personal context unprompted, slightly longer',
  },
  {
    id: 'late-night-texting',
    label: 'Late-night texting fragments',
    platform: 'text-message',
    punctuation: 'broken',
    grammar: 'casual',
    optimism: 'cautious',
    skepticism: 'medium',
    lengthRange: [8, 18],
    typoRate: 'medium',
    emojiBehavior: 'none',
    energy: 'tired',
    persuasion: 'none',
    ageVibe: 'millennial',
    completeness: 'fragment',
    authorExamples: ['H.', 'Trang'],
    vibe: 'sent in 2-3 separate messages combined, no caps, ellipses or no punctuation',
  },
  {
    id: 'quiet-factual',
    label: 'Quiet factual review',
    platform: 'review-thread',
    punctuation: 'standard',
    grammar: 'standard',
    optimism: 'cautious',
    skepticism: 'medium',
    lengthRange: [25, 40],
    typoRate: 'none',
    emojiBehavior: 'none',
    energy: 'flat',
    persuasion: 'none',
    ageVibe: 'mid-life',
    completeness: 'complete',
    authorExamples: ['Cô Yến, 48', 'N. Hoa'],
    vibe: 'matter-of-fact, no emoji, gives timeframe + specific result, no enthusiasm',
  },
  {
    id: 'emotionally-oversharing',
    label: 'Emotionally oversharing comment',
    platform: 'fb-group-post',
    punctuation: 'overpunctuated',
    grammar: 'casual',
    optimism: 'warm',
    skepticism: 'low',
    lengthRange: [30, 50],
    typoRate: 'low',
    emojiBehavior: 'moderate',
    energy: 'warm',
    persuasion: 'accidental',
    ageVibe: 'middle-aged-mom',
    completeness: 'complete',
    authorExamples: ['Lan mẹ Bin', 'Chị Hương ☺'],
    vibe: 'starts with own story before the review, multiple exclamations, heart emoji',
  },
  {
    id: 'skeptical-husband',
    label: 'Skeptical husband reluctantly converted',
    platform: 'fb-comment',
    punctuation: 'standard',
    grammar: 'standard',
    optimism: 'guarded',
    skepticism: 'high',
    lengthRange: [20, 35],
    typoRate: 'none',
    emojiBehavior: 'none',
    energy: 'moderate',
    persuasion: 'none',
    ageVibe: 'older-man',
    completeness: 'complete',
    authorExamples: ['Anh Tuấn, 46', 'D. Hùng'],
    vibe: 'comments on wife/partner using it, low-key admits it works without endorsing',
  },
  {
    id: 'daughter-about-mom',
    label: 'Daughter talking about mom',
    platform: 'fb-comment',
    punctuation: 'casual',
    grammar: 'casual',
    optimism: 'warm',
    skepticism: 'low',
    lengthRange: [18, 30],
    typoRate: 'low',
    emojiBehavior: 'rare',
    energy: 'warm',
    persuasion: 'unintentional',
    ageVibe: 'millennial',
    completeness: 'complete',
    authorExamples: ['Linh', 'Mai', 'Hà.linh'],
    vibe: 'shares for mother, observational ("mẹ em đỡ hẳn"), grateful tone',
  },
  {
    id: 'exhausted-office-worker',
    label: 'Exhausted office worker',
    platform: 'fb-comment',
    punctuation: 'casual',
    grammar: 'casual',
    optimism: 'cautious',
    skepticism: 'medium',
    lengthRange: [15, 25],
    typoRate: 'low',
    emojiBehavior: 'rare',
    energy: 'tired',
    persuasion: 'accidental',
    ageVibe: 'millennial',
    completeness: 'partial',
    authorExamples: ['T.', 'Phương office'],
    vibe: 'mentions deadline / 3pm slump / cà phê, trails off, "same" energy',
  },
  {
    id: 'casual-genz',
    label: 'Casual Gen-Z wording',
    platform: 'tiktok-comment',
    punctuation: 'minimal',
    grammar: 'broken',
    optimism: 'moderate',
    skepticism: 'low',
    lengthRange: [6, 14],
    typoRate: 'medium',
    emojiBehavior: 'frequent',
    energy: 'warm',
    persuasion: 'accidental',
    ageVibe: 'gen-z',
    completeness: 'one-liner',
    authorExamples: ['hng99', 'tr.minh', 'em ún'],
    vibe: 'slang ("xịn xò", "đỉnh nóc"), no caps, emoji clusters, abbreviated everything',
  },
  {
    id: 'older-woman-wording',
    label: 'Older woman formal-warm wording',
    platform: 'fb-comment',
    punctuation: 'standard',
    grammar: 'standard',
    optimism: 'warm',
    skepticism: 'low',
    lengthRange: [25, 40],
    typoRate: 'none',
    emojiBehavior: 'none',
    energy: 'moderate',
    persuasion: 'unintentional',
    ageVibe: 'older-woman',
    completeness: 'complete',
    authorExamples: ['Cô Thu, 58', 'Bác Hoa'],
    vibe: 'addresses "các cháu" or "mọi người", formal-warm, full sentences, no slang',
  },
  {
    id: 'fragmented-sentence',
    label: 'Fragmented sentence style',
    platform: 'fb-comment',
    punctuation: 'broken',
    grammar: 'casual',
    optimism: 'guarded',
    skepticism: 'medium',
    lengthRange: [10, 20],
    typoRate: 'low',
    emojiBehavior: 'none',
    energy: 'low',
    persuasion: 'none',
    ageVibe: 'mid-life',
    completeness: 'fragment',
    authorExamples: ['M.', 'V.A'],
    vibe: 'broken-up thoughts. comma where period should be. trails. no neat ending.',
  },
  {
    id: 'voice-note-transcript',
    label: 'Voice note transcript vibe',
    platform: 'voice-note-transcript',
    punctuation: 'minimal',
    grammar: 'casual',
    optimism: 'warm',
    skepticism: 'low',
    lengthRange: [30, 50],
    typoRate: 'low',
    emojiBehavior: 'none',
    energy: 'warm',
    persuasion: 'accidental',
    ageVibe: 'middle-aged-mom',
    completeness: 'complete',
    authorExamples: ['Chị Lan', 'Hương mẹ Su'],
    vibe: 'run-on sentence as if spoken, "à mà" / "ờ" filler, conversational meandering',
  },
  {
    id: 'tired-semi-incoherent',
    label: 'Tired semi-incoherent late-night',
    platform: 'messenger-dm',
    punctuation: 'broken',
    grammar: 'broken',
    optimism: 'cautious',
    skepticism: 'medium',
    lengthRange: [8, 16],
    typoRate: 'high',
    emojiBehavior: 'none',
    energy: 'tired',
    persuasion: 'none',
    ageVibe: 'middle-aged-mom',
    completeness: 'fragment',
    authorExamples: ['Một mẹ bỉm', 'H.'],
    vibe: 'literally tired, misspells, drops words, sounds like 2am with crying baby',
  },
  {
    id: 'one-line-same-here',
    label: 'One-line "same here" reply',
    platform: 'fb-comment',
    punctuation: 'minimal',
    grammar: 'casual',
    optimism: 'cautious',
    skepticism: 'medium',
    lengthRange: [3, 8],
    typoRate: 'low',
    emojiBehavior: 'rare',
    energy: 'low',
    persuasion: 'none',
    ageVibe: 'mid-life',
    completeness: 'one-liner',
    authorExamples: ['N.', 'H', 'Mai'],
    vibe: 'absolute minimum effort. "same em cũng vậy". "mình cũng". done.',
  },
  {
    id: 'low-effort-internet-reply',
    label: 'Low-effort internet reply',
    platform: 'review-thread',
    punctuation: 'minimal',
    grammar: 'broken',
    optimism: 'moderate',
    skepticism: 'low',
    lengthRange: [5, 12],
    typoRate: 'medium',
    emojiBehavior: 'none',
    energy: 'flat',
    persuasion: 'none',
    ageVibe: 'mid-life',
    completeness: 'fragment',
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

/** Sample N review styles from library with diversity guarantee:
 *  the picks should span energy + optimism axes (no 3 same-feel reviews
 *  that would converge to "polished AI-trying-to-sound-human" output).
 *  Deterministic per seed for reproducibility. */
export function sampleReviewStyles(seed: string, n: number): ReviewStyleProfile[] {
  const all = REVIEW_STYLE_PROFILES
  if (n >= all.length) return all.slice(0, n)

  // 1. Initial pick from full pool.
  const pickedIds = new Set<string>()
  const picked: ReviewStyleProfile[] = []
  let cursor = hashSeed(`${seed}:reviewStyle:0`) % all.length
  picked.push(all[cursor])
  pickedIds.add(all[cursor].id)

  // 2. Subsequent picks enforce diversity: avoid same energy AND same optimism.
  //    Linear probe through hash space if a candidate violates.
  for (let i = 1; i < n; i++) {
    let probe = hashSeed(`${seed}:reviewStyle:${i}`) % all.length
    let attempts = 0
    while (attempts < all.length) {
      const candidate = all[probe]
      if (!pickedIds.has(candidate.id)) {
        const conflicts = picked.some(
          (p) => p.energy === candidate.energy && p.optimism === candidate.optimism,
        )
        if (!conflicts) {
          picked.push(candidate)
          pickedIds.add(candidate.id)
          break
        }
      }
      probe = (probe + 1) % all.length
      attempts++
    }
    // Fallback: if diversity impossible (rare), just take any unused.
    if (picked.length === i) {
      for (const s of all) {
        if (!pickedIds.has(s.id)) {
          picked.push(s)
          pickedIds.add(s.id)
          break
        }
      }
    }
  }
  return picked
}

// ═══ PROMPT INJECTION ═════════════════════════════════════════════════

/** Format a single style profile as concrete data injected into prompt.
 *  ~8-10 lines per review slot. Gemini sees this as a brief for ONE specific
 *  voice, not abstract "casual tone" guidance. */
export function reviewStyleBrief(s: ReviewStyleProfile, slotNum: number): string {
  const [lenMin, lenMax] = s.lengthRange
  const authorEx = s.authorExamples.slice(0, 2).join(' / ')
  return `Review ${slotNum} [style: ${s.id}]
  vibe: ${s.vibe}
  platform: ${s.platform} | age: ${s.ageVibe} | energy: ${s.energy} | optimism: ${s.optimism} | skepticism: ${s.skepticism}
  length: ${lenMin}-${lenMax} từ | completeness: ${s.completeness} | grammar: ${s.grammar} | punctuation: ${s.punctuation}
  typos: ${s.typoRate} | emoji: ${s.emojiBehavior} | persuasion: ${s.persuasion}
  author label format: ${authorEx}`
}

/** Compose the full review block directive for section 10 prompt.
 *  Replaces the old TRUST_REALISM_PROMPT abstract rule wall. */
export function buildReviewBlockDirective(styles: ReviewStyleProfile[]): string {
  const slots = styles.map((s, i) => reviewStyleBrief(s, i + 1)).join('\n\n')
  return `📋 REVIEWS — 3 mini quotes with FIXED style assignments per pack.
Each review slot has its OWN concrete style profile below. Match each profile
exactly — different platform, different age, different energy, different
completeness. Some reviews should feel underwritten, fragmented, or "low-effort"
because real humans are inconsistent. NEVER force all 3 into a polished
"AI-trying-to-sound-human" voice.

${slots}

OUTPUT JSON shape for trust-continuity section:
{ id: "trust-continuity", title, copy: "[5-15 từ intro]", reviews: [
  { quote: "...", author: "...", meta?: "..." },
  { quote: "...", author: "...", meta?: "..." },
  { quote: "...", author: "...", meta?: "..." }
]}

HARD BANS (cross-style):
- "5/5 sao" / star rating language
- "Sản phẩm rất tốt" / "rất hài lòng" — generic ad copy
- "Phải mua ngay" / "đáng tiền" — hard sell
- Multiple emojis in one quote (🎉🥰💕 cluster)
- Formal testimonial paragraph structure`
}
