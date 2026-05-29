// ─────────────────────────────────────────────────────────────────────
// P13 — recommendedKnobMap
//
// Advisory mapping: risk category + level → calibration knob adjustment.
// P13 does NOT apply these. Human or future P14 layer decides.
//
// User-locked knob list: realismLevel / polishLevel / visualNoise /
// imageFrequency / breathing / proofVisibility.
//
// Some risks have NO direct knob match (consistencyRisk, sectionAlignment,
// ctaOverexposure) — those produce notes only via detector warnings.
// ─────────────────────────────────────────────────────────────────────

import type {
  CalibrationKnob,
  KnobDirection,
  RiskCategory,
  RiskLevel,
  RecommendedKnobAdjustment,
} from '../types'

interface KnobRule {
  knob: CalibrationKnob
  direction: KnobDirection
  reasonTemplate: string
}

// risk-category → knob rule (when triggered at elevated/high)
const KNOB_RULES_BY_CATEGORY: Partial<Record<RiskCategory, KnobRule>> = {
  realismRisk: {
    knob: 'realismLevel',
    direction: -1,
    reasonTemplate: 'Pack drifts toward AI-staged feel — shift realism toward documentary anchor.',
  },
  polishDrift: {
    knob: 'polishLevel',
    direction: -2,
    reasonTemplate: 'Polish over-produced for mobile ad context — drop toward raw-handheld feel.',
  },
  proofAuthenticity: {
    knob: 'proofVisibility',
    direction: -1,
    reasonTemplate: 'Proof reads as sponsored/fake — reduce spotlight to restore accidental feel.',
  },
  scrollFatigue: {
    knob: 'breathing',
    direction: +1,
    reasonTemplate: 'Reader has nowhere to exhale — increase section breathing.',
  },
  repetitionRisk: {
    knob: 'imageFrequency',
    direction: -1,
    reasonTemplate: 'Framing/emotion repeats — fewer images reduces repetition surface.',
  },
  // consistencyRisk: no global knob — outliers need per-section attention (handled via warnings)
  // sectionAlignment: structural mismatch — no knob can fix; warnings advise manual review
  // ctaOverexposure:  no knob in user list covers CTA — warnings advise manual review
}

/** Risk levels that trigger a knob recommendation. */
const TRIGGERING_LEVELS: RiskLevel[] = ['elevated', 'high']

export function buildKnobRecommendations(
  risks: Record<RiskCategory, RiskLevel>,
): RecommendedKnobAdjustment[] {
  const recommendations: RecommendedKnobAdjustment[] = []
  for (const [category, level] of Object.entries(risks) as Array<[RiskCategory, RiskLevel]>) {
    if (!TRIGGERING_LEVELS.includes(level)) continue
    const rule = KNOB_RULES_BY_CATEGORY[category]
    if (!rule) continue
    recommendations.push({
      knob: rule.knob,
      direction: rule.direction,
      reason: `[${level}] ${rule.reasonTemplate}`,
      triggeredBy: category,
    })
  }
  return recommendations
}
