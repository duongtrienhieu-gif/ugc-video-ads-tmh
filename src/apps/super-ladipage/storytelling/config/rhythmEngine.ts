// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — RHYTHM ENGINE (v5.4)
//
// Visual-native typography pacing — mobile-first reading.
//
// Forbid: uniform prose blocks (paragraph after paragraph same density).
// Force: vary sentence length, strategic short lines, emotional pauses,
// breathing rhythm, cadence variation per pacingClass.
//
// Goal: text feels READ-able on phone, not essay-formatted.
// ─────────────────────────────────────────────────────────────────────

import type { PacingClass, SectionId } from '../types'

export interface RhythmProfile {
  /** Sentence length distribution target (% of sentences in each bucket). */
  sentenceLengthMix: {
    short: number   // 3-7 words — emphasis lines
    medium: number  // 8-15 words — conversational backbone
    long: number    // 16-25 words — flowing reflective
  }
  /** Frequency of strategic short-line breaks (per ~3-4 sentences). */
  shortLineFrequency: 'rare' | 'occasional' | 'frequent'
  /** Emotional pauses — line breaks mid-thought when emotional weight. */
  emotionalPauseAllowed: boolean
  /** Paragraph density description. */
  paragraphDensity: 'tight' | 'medium' | 'airy' | 'fragmented' | 'flowing'
  /** 1-line directive for prompt injection. */
  directive: string
}

/** Rhythm profile per pacing class. v4.6 pacingClass → typography rules. */
export const RHYTHM_BY_PACING_CLASS: Record<PacingClass, RhythmProfile> = {
  'impact': {
    sentenceLengthMix: { short: 40, medium: 50, long: 10 },
    shortLineFrequency: 'frequent',
    emotionalPauseAllowed: true,
    paragraphDensity: 'tight',
    directive: 'tight rhythm. Short impactful opening lines (3-7 words) mixed with medium flow. Strategic line breaks for emotional weight. Reader feels each line land.',
  },
  'text-breathing': {
    sentenceLengthMix: { short: 20, medium: 40, long: 40 },
    shortLineFrequency: 'occasional',
    emotionalPauseAllowed: true,
    paragraphDensity: 'airy',
    directive: 'airy rhythm. Longer flowing sentences (16-25 words) for reflection. Occasional short emphasis line. Wide breathing space between paragraphs. Reader stops, ngẫm.',
  },
  'dense-narrative': {
    sentenceLengthMix: { short: 15, medium: 65, long: 20 },
    shortLineFrequency: 'occasional',
    emotionalPauseAllowed: false,
    paragraphDensity: 'medium',
    directive: 'medium-flowing rhythm. Conversational backbone (8-15 word sentences). 2-3 paragraphs naturally connected. Occasional short emphasis OK.',
  },
  'mixed': {
    sentenceLengthMix: { short: 25, medium: 50, long: 25 },
    shortLineFrequency: 'occasional',
    emotionalPauseAllowed: true,
    paragraphDensity: 'medium',
    directive: 'balanced mixed rhythm. Vary sentence length organically. 2-4 paragraphs. Occasional short line as emphasis or dialogue.',
  },
  'image-led': {
    sentenceLengthMix: { short: 50, medium: 50, long: 0 },
    shortLineFrequency: 'frequent',
    emotionalPauseAllowed: false,
    paragraphDensity: 'fragmented',
    directive: 'fragmented rhythm — testimonial fragments. Each review = 1-2 short sentences. No long flowing prose. Different voices, casual.',
  },
}

/** Per-section pacing class override map (cross-pack rhythm variety).
 *  Used by buildPackGenPrompt to fetch rhythm directive. */
export function rhythmDirectiveFor(pacingClass: PacingClass): string {
  return RHYTHM_BY_PACING_CLASS[pacingClass].directive
}

/** Per-section EXPLICIT rhythm guidance — sentence-length mix as concrete % */
export function rhythmStatsFor(pacingClass: PacingClass): string {
  const r = RHYTHM_BY_PACING_CLASS[pacingClass]
  return `sentence mix ${r.sentenceLengthMix.short}% short / ${r.sentenceLengthMix.medium}% medium / ${r.sentenceLengthMix.long}% long; paragraph density: ${r.paragraphDensity}`
}

// ═══ ANTI-PROSE-BLOCK GUARDRAIL ═══════════════════════════════════════

/** Inject into system/user prompt. Forces anti-prose-block typography. */
export const RHYTHM_ENGINE_PROMPT =
  `═══ RHYTHM ENGINE — VISUAL-NATIVE TYPOGRAPHY (v5.4) ═══

Mobile-first reading. Each section has rhythm profile per pacingClass.

GLOBAL RULES:
- Vary sentence length within paragraph — KHÔNG uniform
- Strategic short emphasis lines (3-7 words) at emotional moments
- Emotional pauses — line break mid-thought when emotional weight
- Different sections have DIFFERENT rhythm density (per pacingClass)
- Read aloud test: nghe có nhịp thở tự nhiên không

BANNED:
- Same paragraph length entire section
- All sentences medium length, no variation
- Long flowing paragraphs everywhere (essay rhythm)
- Strategic short lines too frequent (becomes choppy)
- Empty white space without purpose (vibes overcompensation)

PER-SECTION RHYTHM:
- impact (s1): tight, short impactful opening
- text-breathing (s3/5/11): airy, longer flowing for reflection
- dense-narrative (s2/9): medium-flowing conversational backbone
- mixed (s4/6/7/8): balanced organic variation
- image-led (s10): fragmented testimonial fragments

Self-test: Reader cuộn điện thoại — có dừng lại ở những moment có ý nghĩa không?
Hay scroll qua không cảm nhận? Nếu scroll lướt → rhythm fails.`

/** Section-specific rhythm hint — combined per-pacing + per-section context. */
export const SECTION_RHYTHM_HINTS: Partial<Record<SectionId, string>> = {
  'hook-interrupt':    'Open with 1-2 short impactful lines (3-7 words). Then medium flow. Reader feels snap.',
  'daily-friction':    'Conversational backbone. Embodied moments in 8-15 word sentences. 2-3 paragraphs.',
  'internal-fear':     'Airy reflective. Longer sentences (16-25 words). Emotional pauses OK. Reader ngẫm.',
  'failed-attempts':   'Mixed: list-y short clipped attempts + medium reflection. Don\'t make a bullet list.',
  'belief-shift':      'Airy reflection. Dialogue line breaks. Longer sentences for the reframe. Reader stops at the AHA line.',
  'soft-reveal':       'Conversational hesitant tone. Medium sentences. Brief.',
  'micro-reward':      'Medium-flowing. Specific recovery moments. Some longer sentences for retrospective.',
  'emotional-payoff':  'Balanced mixed. Quality-of-life details in medium sentences. Some longer reflection.',
  'reflection-trust':  'Airy reflective. Longer flowing sentences. Mature voice.',
  'trust-continuity':  'Fragmented — each quote 1-2 sentences. Different voices, casual.',
  'soft-cta':          'Airy closure. Longer flowing invitation. Calm pace.',
}

export function sectionRhythmHint(sectionId: SectionId): string | null {
  return SECTION_RHYTHM_HINTS[sectionId] ?? null
}
