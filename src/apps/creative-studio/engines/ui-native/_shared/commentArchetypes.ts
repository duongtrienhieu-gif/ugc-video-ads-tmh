// ── Comment Archetype Engine (P12 authenticity overhaul) ───────────────────
//
// Real social-media comment threads are MESSY:
//   • mixed-length comments (one-word reactions next to long questions)
//   • typos / Vietnamese tone-mark drops ("ko" → "không", "vay" → "vậy")
//   • emoji-heavy replies / emoji-only reactions
//   • short skeptic comments next to long testimonials
//   • casual nested replies
//
// This module produces an ARCHETYPE SEQUENCE — a list like
// ['question', 'testimonial', 'emoji', 'short_reaction', 'reply', 'skeptic']
// — that the Gemini text generator weaves into the prompt so each
// comment exhibits a distinct register. Result: threads stop looking
// like "8 variations of the same caption".

export type CommentArchetype =
  | 'question'         // "có ship Hà Nội ko ạ?", "shipping cost?"
  | 'testimonial'      // 2-3 sentences with a specific result detail
  | 'short_reaction'   // 1-4 words "wow", "đỉnh nha", "where to buy"
  | 'emoji'            // 1-3 emoji only, sometimes paired with one word
  | 'skeptic'          // "real ko đây", "is this paid?" — pushback
  | 'reply'            // looks like a reply to a previous comment
  | 'tag_friend'       // "@minh xem cái này", "@em ơi"

export interface ArchetypeRules {
  archetype: CommentArchetype
  /** Word count guidance for the LLM. */
  wordRange: [number, number]
  /** Emoji density 0-1: 0 = never, 1 = always. */
  emojiDensity: number
  /** Allow typos / slang / abbreviation. */
  allowMessy: boolean
  /** Short LLM-facing description that goes in the prompt. */
  promptHint: string
}

export const ARCHETYPE_RULES: Record<CommentArchetype, ArchetypeRules> = {
  question: {
    archetype: 'question',
    wordRange: [4, 12],
    emojiDensity: 0.1,
    allowMessy: true,
    promptHint: 'a buyer question — short, casual, may use abbreviations (eg "có ship Hà Nội ko ạ?", "bao nhiêu vậy?"). End with "?".',
  },
  testimonial: {
    archetype: 'testimonial',
    wordRange: [14, 30],
    emojiDensity: 0.2,
    allowMessy: false,
    promptHint: 'a real buyer testimonial — 2 sentences, mentions a specific result detail (time frame, body part, daily moment).',
  },
  short_reaction: {
    archetype: 'short_reaction',
    wordRange: [1, 5],
    emojiDensity: 0.3,
    allowMessy: true,
    promptHint: 'a one-line reaction like "wow", "đỉnh", "want one", "need this" — 1-4 words.',
  },
  emoji: {
    archetype: 'emoji',
    wordRange: [0, 3],
    emojiDensity: 1.0,
    allowMessy: false,
    promptHint: 'just 1-3 emojis, optionally with one word (eg "🔥🔥", "muốn quá 😍").',
  },
  skeptic: {
    archetype: 'skeptic',
    wordRange: [3, 10],
    emojiDensity: 0.0,
    allowMessy: true,
    promptHint: 'a skeptical short comment — questioning authenticity (eg "real ko đây", "is this paid?", "có chắc ko"). NOT mean, just doubting.',
  },
  reply: {
    archetype: 'reply',
    wordRange: [4, 14],
    emojiDensity: 0.15,
    allowMessy: true,
    promptHint: 'looks like a reply to a previous comment — starts with "@username" or "yeah" / "đúng rồi" / "same". Use isReply: true.',
  },
  tag_friend: {
    archetype: 'tag_friend',
    wordRange: [2, 7],
    emojiDensity: 0.1,
    allowMessy: false,
    promptHint: 'tagging a friend — eg "@minh xem này", "@em ơi cái này hay nè". Start with @<short-name>.',
  },
}

// ── Mix builder ──────────────────────────────────────────────────────

const MIX_PRESETS: Record<'tiktok' | 'facebook', CommentArchetype[]> = {
  tiktok: [
    'short_reaction', 'emoji', 'question', 'short_reaction',
    'testimonial', 'tag_friend', 'short_reaction', 'skeptic',
    'emoji', 'reply', 'question', 'testimonial',
  ],
  facebook: [
    'question', 'testimonial', 'short_reaction', 'reply',
    'question', 'skeptic', 'testimonial', 'tag_friend',
  ],
}

/** Build a sequence of archetypes for N comments, varied per platform. */
export function buildArchetypeMix(
  platform: 'tiktok' | 'facebook',
  count: number,
  seed: string,
): CommentArchetype[] {
  const pool = MIX_PRESETS[platform]
  const rng = mulberry32(hashSeed(seed))
  const out: CommentArchetype[] = []
  // Shuffle the pool deterministically and tile to fill count
  const shuffled = [...pool].sort(() => rng() - 0.5)
  for (let i = 0; i < count; i++) {
    out.push(shuffled[i % shuffled.length])
  }
  return out
}

/** Build the LLM-facing per-comment instruction list for a mix.
 *  Returned string gets spliced into the system prompt. */
export function describeMix(mix: CommentArchetype[]): string {
  return mix
    .map((a, i) => {
      const rules = ARCHETYPE_RULES[a]
      return `  Comment #${i + 1} (${a}, ${rules.wordRange[0]}-${rules.wordRange[1]} words, emoji ${Math.round(rules.emojiDensity * 100)}%${rules.allowMessy ? ', messy ok' : ''}): ${rules.promptHint}`
    })
    .join('\n')
}

// ── Seeded PRNG ──────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
