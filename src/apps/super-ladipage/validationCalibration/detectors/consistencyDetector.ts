// ─────────────────────────────────────────────────────────────────────
// P13 — consistencyDetector
//
// Cross-section realism / polish / lighting universe consistency.
// Flags outlier sections that drift from the page baseline.
//
// Risk derivation:
//   - 0 outliers           → low
//   - 1 outlier            → moderate
//   - 2 outliers           → elevated
//   - 3+ outliers          → high
//
// SOFT — pure observation. No mutation.
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { RealismLevel, PolishLevel } from '../../imageSemantics'
import type { ValidationWarning, RiskLevel } from '../types'

const REALISM_ORDER: RealismLevel[] = [
  'documentary-realism',
  'imperfect-realism',
  'natural-realism',
  'polished-realism',
  'stylized',
]
const POLISH_ORDER: PolishLevel[] = [
  'raw-handheld',
  'low-polish',
  'considered-natural',
  'editorial',
  'high-polish',
]

export interface ConsistencyDetectorResult {
  warnings: ValidationWarning[]
  realismRisk: RiskLevel
  polishDrift: RiskLevel
  consistencyRisk: RiskLevel
}

export function consistencyDetector(
  sections: OrchestratedSection[],
): ConsistencyDetectorResult {
  const warnings: ValidationWarning[] = []
  const withImage = sections.filter((s) => s.imageIntent)

  if (withImage.length === 0) {
    return {
      warnings,
      realismRisk: 'low',
      polishDrift: 'low',
      consistencyRisk: 'low',
    }
  }

  const realismMode = computeMode(withImage.map((s) => s.imageIntent!.realismLevel))
  const polishMode = computeMode(withImage.map((s) => s.imageIntent!.polishLevel))
  const lightingMode = computeMode(withImage.map((s) => s.imageIntent!.lightingMood))

  let realismOutliers = 0
  let polishOutliers = 0
  let lightingOutliers = 0

  for (const s of withImage) {
    const ii = s.imageIntent!
    const realismDist = enumDistance(REALISM_ORDER, ii.realismLevel, realismMode)
    if (realismDist >= 2) {
      realismOutliers++
      warnings.push({
        category: 'realismRisk',
        severity: realismDist >= 3 ? 'critical' : 'warn',
        message:
          `Section "${s.id}" realismLevel='${ii.realismLevel}' deviates ${realismDist} steps from page mode '${realismMode}'. ` +
          `Realism universe drift — single section feels from a different ad.`,
        affectedSectionIds: [s.id],
      })
    }
    const polishDist = enumDistance(POLISH_ORDER, ii.polishLevel, polishMode)
    if (polishDist >= 2) {
      polishOutliers++
      warnings.push({
        category: 'polishDrift',
        severity: polishDist >= 3 ? 'critical' : 'warn',
        message:
          `Section "${s.id}" polishLevel='${ii.polishLevel}' deviates ${polishDist} steps from page mode '${polishMode}'. ` +
          `Polish drift — section feels over-produced or under-produced vs the rest.`,
        affectedSectionIds: [s.id],
      })
    }
    if (ii.lightingMood !== lightingMode) {
      // Lighting variance is partly intentional, only flag if EXTREME
      const harshContrast =
        (lightingMode === 'morning-clean' && ii.lightingMood === 'harsh-tension') ||
        (lightingMode === 'harsh-tension' && ii.lightingMood === 'morning-clean')
      if (harshContrast) {
        lightingOutliers++
        warnings.push({
          category: 'consistencyRisk',
          severity: 'warn',
          message:
            `Section "${s.id}" lightingMood='${ii.lightingMood}' clashes with page baseline '${lightingMode}'. ` +
            `Light universe inconsistency.`,
          affectedSectionIds: [s.id],
        })
      }
    }
  }

  // Special check: hero-recognition + high polish
  for (const s of sections) {
    if (s.role === 'hero-recognition' && s.imageIntent) {
      const idx = POLISH_ORDER.indexOf(s.imageIntent.polishLevel)
      if (idx >= POLISH_ORDER.indexOf('editorial')) {
        warnings.push({
          category: 'polishDrift',
          severity: 'critical',
          message:
            `Hero section "${s.id}" has polishLevel='${s.imageIntent.polishLevel}' — ` +
            `intentional imperfection violated. Hero must feel like real reader, not actress.`,
          affectedSectionIds: [s.id],
        })
        polishOutliers++
      }
    }
  }

  return {
    warnings,
    realismRisk: countToRisk(realismOutliers),
    polishDrift: countToRisk(polishOutliers),
    consistencyRisk: countToRisk(lightingOutliers + Math.floor(realismOutliers / 2)),
  }
}

// ─── helpers ──────────────────────────────────────────────────────

function computeMode<T extends string>(values: T[]): T {
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let maxCount = 0
  let mode = values[0]
  for (const [k, c] of counts) {
    if (c > maxCount) {
      maxCount = c
      mode = k
    }
  }
  return mode
}

function enumDistance<T>(order: readonly T[], a: T, b: T): number {
  const ia = order.indexOf(a)
  const ib = order.indexOf(b)
  if (ia === -1 || ib === -1) return 0
  return Math.abs(ia - ib)
}

function countToRisk(count: number): RiskLevel {
  if (count === 0) return 'low'
  if (count === 1) return 'moderate'
  if (count === 2) return 'elevated'
  return 'high'
}
