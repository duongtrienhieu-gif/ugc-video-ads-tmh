// ── Voice + Creator Matcher ──────────────────────────────────────────────────
// Z31 §8 — auto-suggest the best voice category for a given avatar +
// ad angle. Heuristic only — looks at avatar metadata (name, notes,
// jsonProfile if structured) plus the picked ad angle.
//
// Returns a SINGLE recommended VoiceCategoryId. User can override in the
// picker. The matcher is deliberately fuzzy — it's better to suggest
// something reasonable and let the user confirm than to refuse to suggest.
//
// Logic priority:
//   1. Explicit gender in jsonProfile or notes → narrows male/female axis
//   2. Niche keywords (skincare / gym / fitness / mom / etc) → bias
//   3. Ad angle voiceHints → tiebreaker
//   4. Fallback → 'energetic_creator' (safest TikTok-native default)
// ─────────────────────────────────────────────────────────────────────────────

import type { Model } from '../../../../stores/types'
import type { AdAngle, VoiceCategoryId } from '../types'
import { AD_ANGLES } from './adAngles'

/** Lowercased keyword sets per category — checked against avatar text. */
const CATEGORY_KEYWORDS: Record<VoiceCategoryId, string[]> = {
  emotional_mom: [
    'mom', 'mum', 'mommy', 'mama', 'mẹ', 'mother', 'parent', 'parenting',
    'baby', 'em bé', 'gia đình', 'family',
  ],
  skincare_influencer: [
    'skincare', 'skin', 'beauty', 'cosmetic', 'mỹ phẩm', 'makeup', 'serum',
    'cleanser', 'glow', 'aesthetic', 'beauty influencer',
  ],
  gym_creator: [
    'gym', 'fitness', 'workout', 'muscle', 'bodybuilding', 'trainer', 'pt',
    'coach', 'huấn luyện', 'thể hình', 'tập gym', 'athletic', 'sport',
  ],
  authority_male: [
    'doctor', 'pharmacist', 'expert', 'specialist', 'bác sĩ', 'dược sĩ',
    'chuyên gia', 'tư vấn', 'phd', 'md', 'consultant',
  ],
  calm_female: [
    'wellness', 'yoga', 'meditation', 'mindful', 'thiền', 'chăm sóc',
    'lifestyle', 'self-care', 'wellbeing',
  ],
  energetic_creator: [
    'tiktok', 'creator', 'viral', 'trending', 'influencer', 'youtuber',
    'streamer', 'reaction', 'energy',
  ],
}

/** Genders inferred from text */
function inferGender(text: string): 'male' | 'female' | null {
  const t = text.toLowerCase()
  if (/\b(male|man|guy|coach|trainer|nam|anh|ông|sir)\b/.test(t)) return 'male'
  if (/\b(female|woman|girl|lady|mom|mum|chị|cô|bà|miss)\b/.test(t)) return 'female'
  return null
}

/** Collect all searchable text from an avatar Model record. */
function collectAvatarText(avatar: Model): string {
  const fromProfile = avatar.jsonProfile
    ? Object.entries(avatar.jsonProfile)
        .map(([k, v]) => `${k}:${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(' ')
    : ''
  return `${avatar.name ?? ''} ${avatar.notes ?? ''} ${fromProfile}`.toLowerCase()
}

/**
 * Score how well each voice category fits the avatar + angle.
 * Returns scores in [0, ∞) — higher is better.
 */
function scoreCategories(
  avatar: Model | null,
  angle: AdAngle,
): Map<VoiceCategoryId, number> {
  const scores = new Map<VoiceCategoryId, number>()
  for (const cat of Object.keys(CATEGORY_KEYWORDS) as VoiceCategoryId[]) {
    scores.set(cat, 0)
  }

  const text = avatar ? collectAvatarText(avatar) : ''

  // 1. Keyword matching against avatar metadata
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [VoiceCategoryId, string[]][]) {
    let hits = 0
    for (const kw of keywords) {
      if (text.includes(kw)) hits++
    }
    if (hits > 0) {
      scores.set(cat, (scores.get(cat) ?? 0) + hits * 2)
    }
  }

  // 2. Gender filter — if we can infer it, penalise mismatches
  const inferred = inferGender(text)
  if (inferred === 'male') {
    // Penalise female-presenting categories
    for (const c of ['calm_female', 'emotional_mom', 'skincare_influencer'] as VoiceCategoryId[]) {
      scores.set(c, (scores.get(c) ?? 0) - 5)
    }
  } else if (inferred === 'female') {
    for (const c of ['authority_male', 'gym_creator'] as VoiceCategoryId[]) {
      scores.set(c, (scores.get(c) ?? 0) - 3)
    }
  }

  // 3. Angle voiceHints bonus
  const angleHints = AD_ANGLES[angle].voiceHints
  for (const hint of angleHints) {
    if (scores.has(hint as VoiceCategoryId)) {
      scores.set(hint as VoiceCategoryId, (scores.get(hint as VoiceCategoryId) ?? 0) + 3)
    }
  }

  return scores
}

/**
 * Z31 §8 — Suggest a single voice category for the given avatar + angle.
 * Returns the highest-scoring category; ties broken by the angle's first
 * voiceHint; fallback to 'energetic_creator'.
 *
 * NOTE: matcher is INTENTIONALLY soft — it never refuses to suggest.
 * The user can always override via the voice picker in the UI.
 */
export function matchVoiceForAvatar(
  avatar: Model | null,
  angle: AdAngle,
): VoiceCategoryId {
  const scores = scoreCategories(avatar, angle)
  // Find the highest scorer
  let best: VoiceCategoryId = 'energetic_creator'
  let bestScore = -Infinity
  for (const [cat, score] of scores) {
    if (score > bestScore) {
      bestScore = score
      best = cat
    }
  }

  // If everything tied at 0 (no signal), fall back to the angle's first hint
  if (bestScore <= 0) {
    const angleHints = AD_ANGLES[angle].voiceHints
    if (angleHints.length > 0) return angleHints[0] as VoiceCategoryId
    return 'energetic_creator'
  }

  return best
}

/** Diagnostic — returns scored breakdown for the UI debug panel. */
export function debugVoiceMatch(
  avatar: Model | null,
  angle: AdAngle,
): Array<{ category: VoiceCategoryId; score: number }> {
  const scores = scoreCategories(avatar, angle)
  return Array.from(scores.entries())
    .map(([category, score]) => ({ category, score }))
    .sort((a, b) => b.score - a.score)
}
