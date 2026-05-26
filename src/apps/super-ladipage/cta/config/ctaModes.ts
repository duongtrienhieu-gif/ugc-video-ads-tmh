// ─────────────────────────────────────────────────────────────────────
// CTA — ENERGY MODES per niche (P3)
//
// CTA action push mode mapped to niche. Different niches need different
// final action energy — flat "soft healing invitation" across all niches
// = AI fingerprint.
//
// References nicheDesireArchitecture (C2) — desire = passive wanting,
// CTA energy = active action push for that desire. Aligned but distinct.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey, CtaEnergyMode, CtaEnergyModeId } from '../types'

export const CTA_ENERGY_MODES: Record<NicheKey, CtaEnergyMode> = {
  'haircare': {
    id: 'confidence-restoration',
    niche: 'haircare',
    description: 'Action push toward identity/femininity reclamation — KHÔNG calm-acceptance closure.',
    vibe: 'reader feels "đã đến lúc lấy lại bản thân" — confidence return, NOT inner peace ending',
    avoidPatterns: [
      'inner peace conclusion',
      'self-acceptance about decline',
      'gentle resignation tone',
      'generic body-system rest narrative',
    ],
  },

  'skincare': {
    id: 'age-presence-restoration',
    niche: 'skincare',
    description: 'Action push toward visibility without age-anxiety — KHÔNG inner-only resolution.',
    vibe: 'reader feels "có thể đối mặt với gương / ánh sáng / camera lại"',
    avoidPatterns: [
      'inner peace only ending',
      'self-acceptance of aging signs',
      'gentle resignation tone',
    ],
  },

  'supplement-wellness': {
    id: 'aliveness-recovery',
    niche: 'supplement-wellness',
    description: 'Action push toward feeling alive again — emotional + cognitive return, NOT just physical recovery.',
    vibe: 'reader feels "có thể trở lại là người energetic / sáng suốt" — alive again',
    avoidPatterns: [
      'just-tired-resolved trope',
      'body-aches-only narrative',
      'sleep-better-only ending',
    ],
  },

  'health-functional': {
    id: 'dignity-mobility',
    niche: 'health-functional',
    description: 'Action push toward mobility + dignity + independent capacity — NOT calm acceptance of decline.',
    vibe: 'reader feels "có thể tự chủ lại cơ thể — không phụ thuộc, không là gánh nặng"',
    avoidPatterns: [
      'gentle resignation tone',
      'emotional-only resolution',
      'inner peace without physical capacity',
    ],
  },

  'mom-baby': {
    id: 'self-reclamation',
    niche: 'mom-baby',
    description: 'Action push toward "tôi trở lại là tôi" — self-reclamation, NOT physical reset.',
    vibe: 'reader feels "có thể tồn tại as self, không chỉ là mẹ"',
    avoidPatterns: [
      'body reset narrative only',
      'tired-mom healing trope',
      'self-sacrifice celebrated tone',
    ],
  },

  'beauty-confidence': {
    id: 'attention-restoration',
    niche: 'beauty-confidence',
    description: 'Action push toward being looked-at again — attention/social presence return, NOT inner peace.',
    vibe: 'reader feels "có thể bước ra ngoài / đứng trước máy ảnh / soi gương buổi sáng lại"',
    avoidPatterns: [
      'inner peace conclusion',
      'self-acceptance ending only',
      'healing narrative without external visibility',
    ],
  },

  'relationship': {
    id: 'warmth-reconnection',
    niche: 'relationship',
    description: 'Action push toward emotional warmth + connection return — NOT physical fatigue resolved.',
    vibe: 'reader feels "có thể ấm lại với chồng/con/bố mẹ" — patience + warmth back',
    avoidPatterns: [
      'physical recovery narrative',
      'sleep restoration only',
      'energy back without emotional warmth',
    ],
  },

  'fitness-recovery': {
    id: 'activity-restoration',
    niche: 'fitness-recovery',
    description: 'Action push toward activity + capacity restoration — NOT calm acceptance of limits.',
    vibe: 'reader feels "có thể leo cầu thang / đi du lịch / không phụ thuộc thuốc giảm đau"',
    avoidPatterns: [
      'gentle resignation tone',
      'self-acceptance of decline',
      'emotional-only resolution',
    ],
  },
}

/** Get CTA energy mode for niche. */
export function getCtaModeForNiche(niche: NicheKey): CtaEnergyMode {
  return CTA_ENERGY_MODES[niche]
}

/** Get mode ID for telemetry. */
export function getCtaModeId(niche: NicheKey): CtaEnergyModeId {
  return CTA_ENERGY_MODES[niche].id
}
