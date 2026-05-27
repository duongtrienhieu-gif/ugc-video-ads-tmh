// ─────────────────────────────────────────────────────────────────────
// P13 — alignmentDetector
//
// Ensure image tone matches sectionRole psychology. Sections are NOT
// interchangeable aesthetic vessels — hero needs tension, close needs
// decompression, etc.
//
// Per-role expected emotional + lighting + composition signatures.
// Mismatch → alignment risk.
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { SectionRole } from '../../composer'
import type {
  ImageEmotionalState,
  CompositionTension,
  LightingMood,
} from '../../imageSemantics'
import type { ValidationWarning, RiskLevel } from '../types'

interface RoleExpectations {
  emotionalStates: ImageEmotionalState[]
  compositionTensions: CompositionTension[]
  lightingMoods: LightingMood[]
}

// Per-sectionRole expected signatures (from P9 roleProfiles canon)
const ROLE_EXPECTATIONS: Record<SectionRole, RoleExpectations> = {
  'hero-recognition': {
    emotionalStates: ['tension', 'unease'],
    compositionTensions: ['high-tension-asymmetric', 'mild-tension'],
    lightingMoods: ['harsh-tension', 'natural-flat'],
  },
  'lived-experience': {
    emotionalStates: ['unease', 'reflection'],
    compositionTensions: ['balanced', 'mild-tension'],
    lightingMoods: ['natural-flat', 'neutral'],
  },
  'shared-struggle': {
    emotionalStates: ['frustration', 'unease'],
    compositionTensions: ['mild-tension', 'balanced'],
    lightingMoods: ['natural-flat', 'harsh-tension'],
  },
  'reframe-moment': {
    emotionalStates: ['reflection', 'curiosity'],
    compositionTensions: ['calm-symmetric', 'balanced'],
    lightingMoods: ['morning-clean', 'neutral'],
  },
  'solution-opening': {
    emotionalStates: ['curiosity', 'reflection'],
    compositionTensions: ['balanced', 'mild-tension'],
    lightingMoods: ['warm-soft', 'natural-flat'],
  },
  'transformation': {
    emotionalStates: ['uplift', 'reassurance'],
    compositionTensions: ['released', 'balanced'],
    lightingMoods: ['warm-soft', 'evening-warm'],
  },
  'close-invitation': {
    emotionalStates: ['silence', 'reassurance'],
    compositionTensions: ['released', 'calm-symmetric'],
    lightingMoods: ['morning-clean', 'neutral'],
  },
}

export interface AlignmentDetectorResult {
  warnings: ValidationWarning[]
  sectionAlignment: RiskLevel
}

export function alignmentDetector(
  sections: OrchestratedSection[],
): AlignmentDetectorResult {
  const warnings: ValidationWarning[] = []
  let misalignmentCount = 0

  for (const s of sections) {
    if (!s.imageIntent) continue
    const expect = ROLE_EXPECTATIONS[s.role]
    if (!expect) continue
    const ii = s.imageIntent

    const checks: Array<[string, string, string[]]> = [
      ['emotionalState', ii.emotionalState, expect.emotionalStates],
      ['compositionTension', ii.compositionTension, expect.compositionTensions],
      ['lightingMood', ii.lightingMood, expect.lightingMoods],
    ]

    const misalignments = checks.filter(([_, actual, expected]) => !expected.includes(actual))

    if (misalignments.length >= 2) {
      misalignmentCount++
      const detail = misalignments
        .map(([axis, actual, expected]) => `${axis}='${actual}' (expected ${expected.join(' / ')})`)
        .join('; ')
      warnings.push({
        category: 'sectionAlignment',
        severity: misalignments.length >= 3 ? 'critical' : 'warn',
        message:
          `Section "${s.id}" (role='${s.role}') misaligned on ${misalignments.length} axes — ${detail}. ` +
          `Image tone contradicts section psychology.`,
        affectedSectionIds: [s.id],
      })
    } else if (misalignments.length === 1) {
      const [axis, actual, expected] = misalignments[0]
      warnings.push({
        category: 'sectionAlignment',
        severity: 'info',
        message:
          `Section "${s.id}" (role='${s.role}') has ${axis}='${actual}' but role typically uses ${expected.join(' / ')}. ` +
          `Mild alignment drift — verify intentional.`,
        affectedSectionIds: [s.id],
      })
    }
  }

  return { warnings, sectionAlignment: countToRisk(misalignmentCount) }
}

function countToRisk(count: number): RiskLevel {
  if (count === 0) return 'low'
  if (count === 1) return 'moderate'
  if (count === 2) return 'elevated'
  return 'high'
}
