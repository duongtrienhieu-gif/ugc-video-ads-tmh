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

  // ── Tier S extensions (2026-05-27) ──

  'sleep-insomnia': {
    id: 'restful-night-return',
    niche: 'sleep-insomnia',
    description: 'Action push toward "ngủ thật" — restful nights as foundation of waking life. NOT pharmaceutical knockout.',
    vibe: 'reader feels "tối nay tôi có thể ngủ — sáng dậy thấy như chính mình"',
    avoidPatterns: [
      'pharmaceutical-knockout tone',
      'forced-sleep narrative',
      'sleep-as-luxury framing',
    ],
  },

  'menopause': {
    id: 'identity-continuity',
    niche: 'menopause',
    description: 'Action push toward "tôi vẫn là tôi" through hormonal transition — NOT "anti-aging" or "fix what is broken".',
    vibe: 'reader feels "tôi không mất đi bản thân — đây vẫn là tôi, chỉ là phiên bản khác"',
    avoidPatterns: [
      'anti-aging miracle framing',
      'youth-recovery narrative',
      'shame-of-aging tone',
      'pathologizing menopause as disease',
    ],
  },

  'mental-health': {
    id: 'inner-calm-return',
    niche: 'mental-health',
    description: 'Action push toward emotional regulation return — NOT "fixed your mental illness". Soft restoration of inner space.',
    vibe: 'reader feels "có thể thở lại / có thể ngồi yên không thấy chật ngực"',
    avoidPatterns: [
      'depression-cured framing',
      'happy-pill tone',
      'anxiety-as-weakness narrative',
      'forced positivity ending',
    ],
  },

  'anti-aging-longevity': {
    id: 'vitality-extension',
    niche: 'anti-aging-longevity',
    description: 'Action push toward vital years extension — life-quality over life-quantity. NOT "look younger" vanity.',
    vibe: 'reader feels "tôi muốn 10-20 năm tới còn đi chơi với con/cháu, không ngồi nhà với thuốc"',
    avoidPatterns: [
      'vanity-aesthetic framing',
      'fountain-of-youth tone',
      'immortality narrative',
      'youth-obsession trope',
    ],
  },

  // ── SEA-6 extensions (2026-05-27) ──

  'dental-oral-care': {
    id: 'social-smile-return',
    niche: 'dental-oral-care',
    description: 'Action push toward confident close-distance social presence — NOT cosmetic whiteness only.',
    vibe: 'reader feels "có thể cười to trong nhóm bạn / hôn con không ngại hơi thở"',
    avoidPatterns: [
      'cosmetic-white-teeth only framing',
      'aesthetic smile-makeover tone',
      'commercial dentist promotional voice',
    ],
  },

  'diabetes-blood-sugar': {
    id: 'health-stability-recovery',
    niche: 'diabetes-blood-sugar',
    description: 'Action push toward stable numbers + food flexibility — NOT miracle cure / replacing medication.',
    vibe: 'reader feels "tôi có thể ăn cơm thoải mái lại / A1C ổn định / không sợ tiệc tùng"',
    avoidPatterns: [
      'miracle cure framing',
      'replacement-of-medication promise',
      'aggressive medical claim tone',
    ],
  },

  'liver-detox': {
    id: 'internal-cleanse-relief',
    niche: 'liver-detox',
    description: 'Action push toward internal lightness + energy return — NOT extreme detox / cleansing trend.',
    vibe: 'reader feels "có thể đi nhậu lại nhẹ nhàng / sáng dậy không thấy nặng người"',
    avoidPatterns: [
      'extreme-detox cleansing framing',
      'juice-fast tone',
      'spiritual-purification narrative',
    ],
  },

  'prostate-urology': {
    id: 'silent-vitality-return',
    niche: 'prostate-urology',
    description: 'Action push toward quiet male dignity + nighttime sleep return — NOT viagra-style bravado.',
    vibe: 'reader feels "có thể ngủ liền 7 tiếng / đi du lịch xa / không lén lút đi tiểu"',
    avoidPatterns: [
      'sexual-bravado framing',
      'viagra-style masculine performance tone',
      'youth-recovery promise',
    ],
  },

  'hemorrhoids-digestive-shame': {
    id: 'discreet-comfort-return',
    niche: 'hemorrhoids-digestive-shame',
    description: 'Action push toward discreet comfort + bathroom dignity — NOT trendy wellness tone or social-share framing.',
    vibe: 'reader feels "có thể ngồi xe máy đi xa / đi vệ sinh không đau / không phải mang đệm donut"',
    avoidPatterns: [
      'cheerful-wellness framing',
      'aspirational lifestyle tone',
      'social-share testimonial voice',
    ],
  },

  'eye-vision-care': {
    id: 'clarity-return',
    niche: 'eye-vision-care',
    description: 'Action push toward visual clarity + screen endurance — NOT aspirational "perfect vision" laser-eye marketing.',
    vibe: 'reader feels "cuối ngày mắt vẫn nhìn nổi màn hình / đọc menu không cần đưa xa"',
    avoidPatterns: [
      'perfect-vision miracle framing',
      'laser-eye-surgery promotional tone',
      'youth-restoration voice',
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
