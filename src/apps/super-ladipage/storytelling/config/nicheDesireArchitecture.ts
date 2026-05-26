// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — NICHE DESIRE ARCHITECTURE (Chunk C2)
//
// Per-niche EMOTIONAL GRAVITY + buying psychology pressure axes.
// Counters "tired/healing default" flattening across niches.
//
// Different niches have FUNDAMENTALLY DIFFERENT emotional gravity:
//   - haircare → femininity + identity (NOT body fatigue)
//   - supplement-wellness → aliveness + emotional stability (NOT just rest)
//   - beauty-confidence → attractiveness + social presence (NOT inner calm)
//   - relationship → patience + warmth + connection (NOT physical recovery)
//   - health-functional → mobility + dignity + capacity (NOT calm)
//   - fitness-recovery → activity restoration + dignity (NOT rest)
//   - mom-baby → self-reclamation + recognition (NOT physical reset)
//   - skincare → age-presence + visibility (NOT inner peace)
//
// Inject per-pack at top of user prompt — narrator's emotional destination
// LOCKED. Phase 4 ending must NOT default to "healing + tired-out" trope.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey } from '../types'

export interface NicheDesireArchitecture {
  niche: NicheKey
  /** Primary desire force — what buyer ACTUALLY wants emotionally. */
  primaryDesire: string
  /** Specific desire tensions (3-5) — emotional forces driving purchase. */
  desireTensions: string[]
  /** Emotional gravity description for prompt injection. */
  emotionalGravity: string
  /** Forbidden default emotional resolutions — anti-flattening. */
  forbiddenDefaults: string[]
}

export const NICHE_DESIRE_ARCHITECTURE: Record<NicheKey, NicheDesireArchitecture> = {
  'haircare': {
    niche: 'haircare',
    primaryDesire: 'identity restoration / femininity reclamation',
    desireTensions: [
      'attractiveness anxiety (sợ không còn xinh)',
      'aging-via-hair-loss fear (tóc rụng = già đi rõ)',
      'mirror avoidance habit (không soi gương buổi sáng)',
      'identity erosion (không nhận ra phiên bản trước)',
    ],
    emotionalGravity: 'femininity + identity (NOT generic body fatigue/healing)',
    forbiddenDefaults: [
      'tired and healing tone',
      'body-system-rest narrative',
      'generic self-care resolution',
      'calm inner peace ending without external visibility',
    ],
  },

  'skincare': {
    niche: 'skincare',
    primaryDesire: 'age-presence restoration / visibility without anxiety',
    desireTensions: [
      'age-visibility fear (sợ người ta thấy mình già)',
      'social-confidence loss (né camera, né selfie)',
      'self-image anxiety (so sánh với bạn cùng tuổi)',
      'unable to hide signs of time (kem mới chưa đủ)',
    ],
    emotionalGravity: 'age-presence + social visibility (NOT inner peace alone)',
    forbiddenDefaults: [
      'inner peace conclusion only',
      'self-acceptance without external presence',
      'healing narrative without visibility shift',
      'generic confidence boost',
    ],
  },

  'supplement-wellness': {
    niche: 'supplement-wellness',
    primaryDesire: 'emotional stability / feeling alive again / self return',
    desireTensions: [
      'emotional flatness fear (không vui không buồn)',
      'self-disappearance anxiety (mình đang biến mất)',
      'cognitive decline fear (sương mù não tăng)',
      'aliveness loss (không còn energetic như xưa)',
    ],
    emotionalGravity: 'aliveness + emotional stability (NOT physical-recovery narrative)',
    forbiddenDefaults: [
      'just tired-resolved trope',
      'body aches resolved (wrong domain)',
      'physical capacity narrative without emotional return',
      'sleep-better-only ending',
    ],
  },

  'health-functional': {
    niche: 'health-functional',
    primaryDesire: 'mobility restoration / dignity / not-a-burden',
    desireTensions: [
      'mobility loss fear (vịn cầu thang vĩnh viễn)',
      'becoming a burden fear (gánh nặng cho con)',
      'capacity loss (không chơi với cháu được)',
      'aging body shame (cơ thể xuống nhanh hơn dự đoán)',
    ],
    emotionalGravity: 'mobility + dignity + independent capacity (NOT calm-inner-peace)',
    forbiddenDefaults: [
      'inner peace without mobility return',
      'self-acceptance of decline',
      'gentle resignation tone',
      'emotional-only resolution without physical capacity',
    ],
  },

  'mom-baby': {
    niche: 'mom-baby',
    primaryDesire: 'self-reclamation / "tôi trở lại làm tôi" / being seen as self not just mom',
    desireTensions: [
      'identity loss (mình là ai ngoài "mẹ")',
      'invisible exhaustion (không ai hiểu mình mệt thế nào)',
      'loss of pre-baby self (cơ thể không quay lại)',
      'silent overwhelm (giấu mệt vì là mẹ)',
    ],
    emotionalGravity: 'self-reclamation + visibility-as-self (NOT just physical reset)',
    forbiddenDefaults: [
      'body reset narrative only',
      'tired mom healing trope',
      'self-sacrifice celebrated tone',
      'physical-recovery-only ending',
    ],
  },

  'beauty-confidence': {
    niche: 'beauty-confidence',
    primaryDesire: 'attention restoration / wanting to be looked at again',
    desireTensions: [
      'social-visibility anxiety (né camera, né selfie chung)',
      'attractiveness tension (sự attractiveness đang fade)',
      'lighting/camera avoidance (lùi 1 bước khi soi gương)',
      'peer comparison fatigue (so với bạn cùng tuổi)',
      'lost the "looked-at" feeling',
    ],
    emotionalGravity: 'attractiveness + external presence (NOT calm-inner-peace)',
    forbiddenDefaults: [
      'inner peace conclusion',
      'self-acceptance ending only',
      'healing narrative without external visibility',
      'gentle resignation about aging',
    ],
  },

  'relationship': {
    niche: 'relationship',
    primaryDesire: 'emotional presence / patience restored / warmth returns',
    desireTensions: [
      'snapping at family guilt (cộc với con/chồng)',
      'overstimulation fatigue (mệt khi đám đông)',
      'wanting warmth back (không còn ấm như trước)',
      'avoiding home (ngồi 10p trong xe trước khi vào nhà)',
      'cười cho có (không cảm thấy thật)',
    ],
    emotionalGravity: 'patience + warmth + emotional presence (NOT physical fatigue resolved)',
    forbiddenDefaults: [
      'physical recovery narrative',
      'sleep restoration only',
      'energy back without emotional warmth',
      'tired-mom healing trope',
    ],
  },

  'fitness-recovery': {
    niche: 'fitness-recovery',
    primaryDesire: 'activity restoration / not-locked-out / dignity in body',
    desireTensions: [
      'activity loss fear (không leo núi / đi xa được)',
      'medication dependency anxiety (gắn với thuốc giảm đau dài hạn)',
      'aging body shame (xuống nhanh hơn bạn cùng tuổi)',
      'capacity erosion (đi siêu thị về phải nằm)',
    ],
    emotionalGravity: 'activity + capacity restoration (NOT calm-acceptance of limits)',
    forbiddenDefaults: [
      'gentle resignation tone',
      'self-acceptance of decline',
      'emotional-only resolution',
      'inner peace without physical capacity return',
    ],
  },
}

/** Get desire architecture for niche — never null (8 niches covered). */
export function getDesireForNiche(niche: NicheKey): NicheDesireArchitecture {
  return NICHE_DESIRE_ARCHITECTURE[niche]
}

/** Compose desire brief for prompt injection. */
export function nicheDesireBrief(desire: NicheDesireArchitecture): string {
  return [
    `═══ DESIRE GRAVITY — niche-specific (${desire.niche}) ═══`,
    `Primary desire: ${desire.primaryDesire}`,
    `Emotional gravity (Phase 4 ending MUST land here): ${desire.emotionalGravity}`,
    `Desire tensions (use 1-2 in Phase 1-2 to surface):`,
    ...desire.desireTensions.map((t) => `  - ${t}`),
    `⛔ FORBIDDEN Phase-4 defaults (anti-flattening — NEVER end pack with these):`,
    ...desire.forbiddenDefaults.map((d) => `  ✗ ${d}`),
  ].join('\n')
}
