// ── Emotional Beats Library (P4) ────────────────────────────────────────────
//
// Static beat presets covering the 5-phase narrative arc (hook → body →
// education → recovery → cta). Photographic modules can opt in by
// accepting a beatId in their options and asking the engine to bake the
// mood + face directive into the final prompt.
//
// Vocabulary kept identical to video-builder v2 SceneType + ShotEnergy
// so a cross-tool flow (photographic still → video animation) stays
// emotionally coherent — see src/apps/video-builder/v2/types.ts:156,172
// for the upstream source.
//
// P4 ships the library only. Wiring into _buildModule.ts is intentionally
// deferred to a later phase so the existing 9 photographic modules
// remain byte-stable.

import type { EmotionalBeat, EditorialPhase } from '../../types/emotionalBeat'

export const EMOTIONAL_BEATS: EmotionalBeat[] = [
  // ── HOOK PHASE — pattern interrupt, attention grab ────────────────────
  {
    id: 'hook-curiosity',
    label: { vi: 'Mở đầu — Tò mò', en: 'Hook — Curiosity' },
    phase: 'hook',
    shotEnergy: 'dynamic',
    moodDirective:
      'Pattern-interrupt opening shot. Slightly off-axis composition. Subject mid-action, not '
      + 'posed for camera. Soft tension of "wait, what is happening here". Eye-line off-camera or '
      + 'glancing at something just out of frame.',
    faceExpressionDirective:
      'Mildly surprised, eyebrows lifted, mouth slightly parted. NOT smiling, NOT promotional.',
  },
  {
    id: 'hook-shock',
    label: { vi: 'Mở đầu — Sốc', en: 'Hook — Shock' },
    phase: 'hook',
    shotEnergy: 'tension',
    moodDirective:
      'High-tension grab shot. Wide eyes, sudden discovery moment. Hand frozen mid-gesture. '
      + 'Slightly desaturated palette to amplify the unease. Strong negative space on one side.',
    faceExpressionDirective:
      'Eyes wide, brows raised high, mouth open in a small unscripted "oh". Genuine reaction face, '
      + 'NOT theatrical, NOT TikTok-thumbnail.',
  },

  // ── BODY PHASE — show the problem, build the pain ────────────────────
  {
    id: 'body-pain',
    label: { vi: 'Vấn đề — Đau khổ', en: 'Body — Pain' },
    phase: 'body',
    shotEnergy: 'emotional',
    moodDirective:
      'Quiet pain scene. Subject alone, in own space, dealing with the discomfort. Low ambient '
      + 'light, slightly darker color grade. Body language closed (slumped shoulders, hand on '
      + 'forehead, holding stomach, etc.). NO product in frame.',
    faceExpressionDirective:
      'Tired, slightly pained. Eyes downcast or closed. Brow furrowed. NOT smiling, NOT looking '
      + 'at camera.',
  },
  {
    id: 'body-frustration',
    label: { vi: 'Vấn đề — Bực dọc', en: 'Body — Frustration' },
    phase: 'body',
    shotEnergy: 'tension',
    moodDirective:
      'Peak-frustration moment. Subject mid-sigh or rubbing temples. Cluttered context (messy desk, '
      + 'pile of failed products, late-night setting). Cooler color cast.',
    faceExpressionDirective:
      'Tight jaw, lips pressed, slight eye-roll or eyes closed in exasperation. NOT angry-shouting, '
      + 'NOT theatrical.',
  },

  // ── EDUCATION PHASE — discovery + understanding ──────────────────────
  {
    id: 'education-discovery',
    label: { vi: 'Giải pháp — Khám phá', en: 'Education — Discovery' },
    phase: 'education',
    shotEnergy: 'calm',
    moodDirective:
      'First-encounter shot. Subject inspecting the product with genuine curiosity. Product clearly '
      + 'in frame but not hero-style — held casually like a real first-time pickup. Even neutral '
      + 'daylight. Composition balanced.',
    faceExpressionDirective:
      'Soft attentive interest, eyes on the product label. Slight gentle smile but NOT promotional. '
      + 'Reading-the-package energy.',
  },
  {
    id: 'education-mechanism',
    label: { vi: 'Giải pháp — Cơ chế', en: 'Education — Mechanism' },
    phase: 'education',
    shotEnergy: 'calm',
    moodDirective:
      'Explanatory framing. Subject mid-explanation gesture — pointing at the product, or holding '
      + 'it up to the camera lens. Clean credible background. Bright even light. Slight talking-'
      + 'head feel.',
    faceExpressionDirective:
      'Engaged, mid-sentence mouth shape, focused eyes either to camera or to product. Trustworthy '
      + 'expert-friend tone, NOT salesy.',
  },

  // ── RECOVERY PHASE — post-use result + relief ────────────────────────
  {
    id: 'recovery-relief',
    label: { vi: 'Kết quả — Nhẹ nhõm', en: 'Recovery — Relief' },
    phase: 'recovery',
    shotEnergy: 'relief',
    moodDirective:
      'Post-result scene. Subject relaxed, doing a normal pleasant activity (sipping tea, lying on '
      + 'couch, in soft sunlight). Warmer color grade. Open relaxed body language. Product may be '
      + 'visible peripherally but not held up.',
    faceExpressionDirective:
      'Calm soft smile that reaches the eyes. Relaxed jaw. Looking off into middle distance or at '
      + 'something natural. Authentic contented mood.',
  },
  {
    id: 'recovery-confidence',
    label: { vi: 'Kết quả — Tự tin', en: 'Recovery — Confidence' },
    phase: 'recovery',
    shotEnergy: 'energetic',
    moodDirective:
      'After-transformation lifestyle shot. Subject active and engaged — walking, meeting friends, '
      + 'working productively. Bright daylight. Brighter color grade. Slight wide-frame to show '
      + 'the social / lifestyle context.',
    faceExpressionDirective:
      'Confident gentle smile, eyes alert and open, posture upright. Authentic "I feel good '
      + 'today" — NOT influencer pose.',
  },

  // ── CTA PHASE — closing direct ask ───────────────────────────────────
  {
    id: 'cta-urgency',
    label: { vi: 'Kêu gọi — Khẩn cấp', en: 'CTA — Urgency' },
    phase: 'cta',
    shotEnergy: 'dynamic',
    moodDirective:
      'Closing direct-ask shot. Subject holds product clearly to camera. Eye contact with lens. '
      + 'Punchier composition (slightly tighter framing). Product label fully readable.',
    faceExpressionDirective:
      'Direct confident eye contact, gentle smile, slight head tilt. NOT shouting, NOT exaggerated.',
  },
  {
    id: 'cta-aspiration',
    label: { vi: 'Kêu gọi — Khát vọng', en: 'CTA — Aspiration' },
    phase: 'cta',
    shotEnergy: 'calm',
    moodDirective:
      'Aspirational closing shot. Subject living the after-state confidently — quiet aspirational '
      + 'framing rather than hard-sell. Product softly visible. Warm cinematic light. Premium '
      + 'feel without luxury fashion gloss.',
    faceExpressionDirective:
      'Serene small smile, eyes calm and looking forward. Composed gentle confidence.',
  },
]

/** Look up an emotional beat by id. Returns null on miss (strict —
 *  beat mis-match = wrong mood = wasted render). */
export function findEmotionalBeat(id: string): EmotionalBeat | null {
  return EMOTIONAL_BEATS.find((b) => b.id === id) ?? null
}

/** All beats for a given editorial phase. Used by UI pickers grouped by phase. */
export function listBeatsByPhase(phase: EditorialPhase): EmotionalBeat[] {
  return EMOTIONAL_BEATS.filter((b) => b.phase === phase)
}
