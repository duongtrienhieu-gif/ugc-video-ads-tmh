// ─────────────────────────────────────────────────────────────────────
// P13 — plausibilityDetector
//
// Mobile-scroll plausibility: rhythm variation, breathing distribution,
// image density pacing, proof spacing, CTA exposure frequency.
//
// Complements P8 scrollDiagnostics by checking ORCHESTRATION-level
// plausibility (post-routing/reference assignment), not just semantic
// rhythm. Some signals overlap with P8 — P13 surfaces them at validation
// granularity.
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { ValidationWarning, RiskLevel } from '../types'

export interface PlausibilityDetectorResult {
  warnings: ValidationWarning[]
  scrollFatigue: RiskLevel
  ctaOverexposure: RiskLevel
}

export function plausibilityDetector(
  sections: OrchestratedSection[],
): PlausibilityDetectorResult {
  const warnings: ValidationWarning[] = []
  let fatigueScore = 0
  let ctaScore = 0

  // ── Density distribution — too many image-heavy sections in a row ─
  let heavyRun = 0
  let heavyRunStart = 0
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    const isHeavy = s.scrollWeight === 'heavy'
    if (isHeavy) {
      if (heavyRun === 0) heavyRunStart = i
      heavyRun++
    } else {
      if (heavyRun >= 3) {
        const affected = sections.slice(heavyRunStart, heavyRunStart + heavyRun).map((x) => x.id)
        warnings.push({
          category: 'scrollFatigue',
          severity: heavyRun >= 4 ? 'critical' : 'warn',
          message:
            `${heavyRun} adjacent heavy-density sections (${affected.join(' → ')}). ` +
            `Mobile reader fatigue — interleave lighter section for scroll plausibility.`,
          affectedSectionIds: affected,
        })
        fatigueScore += heavyRun >= 4 ? 2 : 1
      }
      heavyRun = 0
    }
  }
  if (heavyRun >= 3) {
    const affected = sections.slice(heavyRunStart, heavyRunStart + heavyRun).map((x) => x.id)
    warnings.push({
      category: 'scrollFatigue',
      severity: 'warn',
      message:
        `${heavyRun} adjacent heavy-density sections at page end (${affected.join(' → ')}). ` +
        `Close-out should decompress, not pile density.`,
      affectedSectionIds: affected,
    })
    fatigueScore++
  }

  // ── Breathing skew — too few generous/vast sections ─────────────
  const withSem = sections.filter((s) => s.visualSemantics)
  if (withSem.length >= 5) {
    const breathingGenerous = withSem.filter((s) =>
      s.visualSemantics.sectionBreathing === 'generous' ||
      s.visualSemantics.sectionBreathing === 'vast',
    ).length
    const breathingRatio = breathingGenerous / withSem.length
    if (breathingRatio < 0.15) {
      warnings.push({
        category: 'scrollFatigue',
        severity: 'warn',
        message:
          `Only ${breathingGenerous}/${withSem.length} sections have generous/vast breathing ` +
          `(${(breathingRatio * 100).toFixed(0)}%). Reader has nowhere to exhale.`,
        affectedSectionIds: withSem
          .filter((s) =>
            s.visualSemantics.sectionBreathing !== 'generous' &&
            s.visualSemantics.sectionBreathing !== 'vast',
          )
          .map((s) => s.id),
      })
      fatigueScore += 2
    }
  }

  // ── CTA exposure frequency ───────────────────────────────────────
  const ctaVisibleSections = sections.filter(
    (s) => s.visualSemantics && s.visualSemantics.ctaAggression !== 'hidden',
  )
  if (ctaVisibleSections.length >= 5) {
    warnings.push({
      category: 'ctaOverexposure',
      severity: ctaVisibleSections.length >= 6 ? 'critical' : 'warn',
      message:
        `${ctaVisibleSections.length} sections show CTA. Mobile reader pressure — ` +
        `believable funnels keep 1-3 CTA-visible sections, not whole page.`,
      affectedSectionIds: ctaVisibleSections.map((s) => s.id),
    })
    ctaScore += ctaVisibleSections.length >= 6 ? 2 : 1
  }

  // ── Image density imbalance — first half image-heavy, second half barren ─
  const withImage = sections.filter((s) => s.imageIntent)
  if (sections.length >= 6 && withImage.length >= 3) {
    const half = Math.floor(sections.length / 2)
    const firstHalfImages = sections.slice(0, half).filter((s) => s.imageIntent).length
    const secondHalfImages = sections.slice(half).filter((s) => s.imageIntent).length
    const skew = Math.abs(firstHalfImages - secondHalfImages)
    if (skew >= 3) {
      warnings.push({
        category: 'scrollFatigue',
        severity: 'warn',
        message:
          `Image density skew: ${firstHalfImages} images in first half vs ${secondHalfImages} in second half. ` +
          `Real landing pages distribute images evenly across scroll depth.`,
        affectedSectionIds: [],
      })
      fatigueScore++
    }
  }

  return {
    warnings,
    scrollFatigue: scoreToRisk(fatigueScore),
    ctaOverexposure: scoreToRisk(ctaScore),
  }
}

function scoreToRisk(score: number): RiskLevel {
  if (score === 0) return 'low'
  if (score === 1) return 'moderate'
  if (score === 2) return 'elevated'
  return 'high'
}
