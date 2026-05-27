// ─────────────────────────────────────────────────────────────────────
// P13 — fakeAiDetector
//
// Soft heuristics for "designed by AI" / Pinterest-moodboard / over-
// staging drift. NO computer vision. NO model fine-tuning. Pure
// pattern matching against semantic intent fields.
//
// 4 heuristic checks:
//   1. 3+ sections with calm-symmetric composition AND editorial polish
//      → Pinterest moodboard feel
//   2. ZERO documentary-realism sections in pack
//      → over-staging, no real-life anchor
//   3. ALL sections same lightingMood
//      → flat AI uniformity
//   4. ALL sections same compositionTension
//      → AI rhythm flatness
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { ValidationWarning, RiskLevel } from '../types'

export interface FakeAiDetectorResult {
  warnings: ValidationWarning[]
  realismRisk: RiskLevel
}

export function fakeAiDetector(sections: OrchestratedSection[]): FakeAiDetectorResult {
  const warnings: ValidationWarning[] = []
  const withImage = sections.filter((s) => s.imageIntent)

  if (withImage.length === 0) {
    return { warnings, realismRisk: 'low' }
  }

  let aiScore = 0

  // ── Check 1: Pinterest moodboard feel ───────────────────────────
  const moodboardSections = withImage.filter((s) => {
    const ii = s.imageIntent!
    return (
      ii.compositionTension === 'calm-symmetric' && ii.polishLevel === 'editorial'
    )
  })
  if (moodboardSections.length >= 3) {
    warnings.push({
      category: 'realismRisk',
      severity: 'critical',
      message:
        `${moodboardSections.length} sections combine calm-symmetric composition + editorial polish ` +
        `(${moodboardSections.map((s) => s.id).join(', ')}). Pinterest moodboard feel — pack reads as AI taste.`,
      affectedSectionIds: moodboardSections.map((s) => s.id),
    })
    aiScore += 2
  }

  // ── Check 2: zero documentary-realism in pack ───────────────────
  const documentaryCount = withImage.filter(
    (s) => s.imageIntent!.realismLevel === 'documentary-realism',
  ).length
  if (documentaryCount === 0 && withImage.length >= 4) {
    warnings.push({
      category: 'realismRisk',
      severity: 'warn',
      message:
        `Pack contains 0 documentary-realism sections out of ${withImage.length} image-bearing sections. ` +
        `No real-life anchor — entire pack feels staged.`,
      affectedSectionIds: withImage.map((s) => s.id),
    })
    aiScore++
  }

  // ── Check 3: lighting uniformity ────────────────────────────────
  const lightingValues = new Set(withImage.map((s) => s.imageIntent!.lightingMood))
  if (lightingValues.size === 1 && withImage.length >= 4) {
    const onlyLight = withImage[0].imageIntent!.lightingMood
    warnings.push({
      category: 'realismRisk',
      severity: 'warn',
      message:
        `All ${withImage.length} image-bearing sections use lightingMood='${onlyLight}'. ` +
        `AI uniformity — real photographers vary lighting across moments.`,
      affectedSectionIds: withImage.map((s) => s.id),
    })
    aiScore++
  }

  // ── Check 4: composition tension flatness ───────────────────────
  const tensionValues = new Set(withImage.map((s) => s.imageIntent!.compositionTension))
  if (tensionValues.size === 1 && withImage.length >= 4) {
    const onlyTension = withImage[0].imageIntent!.compositionTension
    warnings.push({
      category: 'realismRisk',
      severity: 'warn',
      message:
        `All ${withImage.length} image-bearing sections share compositionTension='${onlyTension}'. ` +
        `AI rhythm flatness — story arc requires emotional composition variance.`,
      affectedSectionIds: withImage.map((s) => s.id),
    })
    aiScore++
  }

  return { warnings, realismRisk: scoreToRisk(aiScore) }
}

function scoreToRisk(score: number): RiskLevel {
  if (score === 0) return 'low'
  if (score === 1) return 'moderate'
  if (score === 2) return 'elevated'
  return 'high'
}
