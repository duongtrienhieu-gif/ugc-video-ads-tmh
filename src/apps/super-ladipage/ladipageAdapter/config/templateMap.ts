// ─────────────────────────────────────────────────────────────────────
// Ladipage Adapter — templateMap (P16A)
//
// Deterministic SectionRole + mobilePattern → LadipageTemplateName.
// NO AI selection. NO "better template" logic. NO fallback intelligence.
//
// Priority order:
//   1. Proof override: any section with proofPresentation='bordered-block'
//      → TestimonialBlockTemplate (regardless of role)
//   2. Pattern-specific override (mobilePattern dictates layout)
//   3. Role baseline
// ─────────────────────────────────────────────────────────────────────

import type { SectionRole } from '../../composer'
import type { MobilePattern, ProofPresentation } from '../../renderContract'
import type { LadipageTemplateName } from '../types'

// ─── Role baseline (LOCKED) ────────────────────────────────────────

const TEMPLATE_BY_ROLE: Record<SectionRole, LadipageTemplateName> = {
  'hero-recognition':  'HeroBlockTemplate',
  'lived-experience':  'BreathingNarrativeTemplate',
  'shared-struggle':   'FrustrationFlatLayTemplate',
  'reframe-moment':    'ProblemAgitationTemplate',
  'solution-opening':  'ProductFeatureTemplate',
  'transformation':    'LifestyleUpliftTemplate',
  'close-invitation':  'FinalCTASection',
}

// ─── Mobile-pattern overrides (LOCKED) ─────────────────────────────

const TEMPLATE_BY_PATTERN: Partial<Record<MobilePattern, LadipageTemplateName>> = {
  // Patterns that DICTATE layout regardless of role
  'reframe-spotlight': 'ProblemAgitationTemplate',
  'solution-mixed':    'ProductFeatureTemplate',
  'lifestyle-uplift':  'LifestyleUpliftTemplate',
  'closing-quiet':     'FinalCTASection',
  'frustration-flat-lay': 'FrustrationFlatLayTemplate',
  'breathing-narrative':  'BreathingNarrativeTemplate',
  'impact-anchor':        'HeroBlockTemplate',
}

/** Deterministic template resolver. NO branching beyond table lookups. */
export function selectLadipageTemplate(
  role: SectionRole,
  pattern: MobilePattern,
  proofPresentation: ProofPresentation,
): LadipageTemplateName {
  // ── Priority 1: Proof spotlight always wins ────────────────────
  if (proofPresentation === 'bordered-block') {
    return 'TestimonialBlockTemplate'
  }

  // ── Priority 2: Pattern override (when pattern is decisive) ────
  const fromPattern = TEMPLATE_BY_PATTERN[pattern]
  if (fromPattern) return fromPattern

  // ── Priority 3: Role baseline ──────────────────────────────────
  return TEMPLATE_BY_ROLE[role]
}
