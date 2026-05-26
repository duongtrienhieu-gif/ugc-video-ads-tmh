// ─────────────────────────────────────────────────────────────────────
// Proof System — ENTROPY RULES (P1 foundation)
//
// Anti-polish entropy axes — sampling-driven variation cho 3 proof
// pieces trong 1 pack. Mỗi piece sample 1 entropy profile khác → 3
// pieces có 3 textures khác hẳn (grammar / certainty / effort / etc.)
//
// Goal: real proof không uniform. Some pieces full grammar, some
// fragments. Some certain, some hedged. Some 1-sentence dry, some
// paragraph rambling.
//
// Anti-fake-review feel = entropy across pieces > polish per piece.
// ─────────────────────────────────────────────────────────────────────

import type {
  CertaintyLevel, EntropyGrammar, EntropyEffort, EntropyEmojiDensity,
  EntropyAuthorInfo, EntropyProfile,
} from '../types'

/** Entropy axes pools — sampled with variety enforcement across 3 pieces. */
const GRAMMAR_POOL: EntropyGrammar[] = ['full', 'casual', 'fragments']
const CERTAINTY_POOL: CertaintyLevel[] = ['hedged', 'mild', 'strong', 'uncertain']
const EFFORT_POOL: EntropyEffort[] = ['one-sentence', 'two-sentence', 'paragraph-fragment']
const EMOJI_POOL: EntropyEmojiDensity[] = ['zero', 'one-max', 'occasional']
const AUTHOR_INFO_POOL: EntropyAuthorInfo[] = ['name-age', 'nickname-only', 'generic-reader']

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 3 entropy profiles with variety enforced.
 *  Ensures the 3 profiles differ on at least grammar + effort (most visible
 *  axes), so 3 pieces don't all read the same. */
export function sampleEntropyProfiles(seed: string, count = 3): EntropyProfile[] {
  const profiles: EntropyProfile[] = []

  // For variety: pick grammar + effort with shuffled order (no repeat).
  const grammarPicks = pickWithoutRepeat(GRAMMAR_POOL, count, `${seed}:gram`)
  const effortPicks = pickWithoutRepeat(EFFORT_POOL, count, `${seed}:effort`)

  // Certainty + emoji + authorInfo can repeat — variety enforced via grammar/effort.
  for (let i = 0; i < count; i++) {
    profiles.push({
      grammar: grammarPicks[i],
      certainty: CERTAINTY_POOL[hashSeed(`${seed}:cert:${i}`) % CERTAINTY_POOL.length],
      effort: effortPicks[i],
      emojiDensity: EMOJI_POOL[hashSeed(`${seed}:emoji:${i}`) % EMOJI_POOL.length],
      authorInfoRichness: AUTHOR_INFO_POOL[hashSeed(`${seed}:author:${i}`) % AUTHOR_INFO_POOL.length],
    })
  }

  return profiles
}

/** Pick N items from pool without repeat — wraps around if pool < N. */
function pickWithoutRepeat<T>(pool: T[], n: number, seed: string): T[] {
  const remaining = [...pool]
  const picks: T[] = []
  for (let i = 0; i < n; i++) {
    if (remaining.length === 0) remaining.push(...pool)  // wrap if needed
    const idx = hashSeed(`${seed}:${i}`) % remaining.length
    picks.push(remaining[idx])
    remaining.splice(idx, 1)
  }
  return picks
}

// entropyDirective() removed — was prescriptive per-axis explanation
// (governance §5 violation: sampling > instructions). proofPrompts.ts now
// emits declarative config line: "grammar=X, certainty=Y, effort=Z, ..."
// Gemini interprets enum values naturally without per-axis rule explanation.
