// ─────────────────────────────────────────────────────────────────────
// P13 — repetitionDetector
//
// Detect framing / angle / emotional-beat / subject-distance reuse.
// Scroll freshness governance.
//
// Checks:
//   1. 2+ adjacent same framingStyle
//   2. 3+ same compositionTension (anywhere)
//   3. ALL hero/lifestyle sections share subjectDistance
//   4. 3+ same emotionalState anywhere
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { ValidationWarning, RiskLevel } from '../types'

export interface RepetitionDetectorResult {
  warnings: ValidationWarning[]
  repetitionRisk: RiskLevel
}

export function repetitionDetector(
  sections: OrchestratedSection[],
): RepetitionDetectorResult {
  const warnings: ValidationWarning[] = []
  let repScore = 0

  const withImage = sections.filter((s) => s.imageIntent)
  if (withImage.length < 2) {
    return { warnings, repetitionRisk: 'low' }
  }

  // ── Check 1: adjacent same framingStyle (run >= 2) ─────────────
  let runStart = 0
  for (let i = 1; i <= withImage.length; i++) {
    const prev = withImage[i - 1].imageIntent!.framingStyle
    const cur = i < withImage.length ? withImage[i].imageIntent!.framingStyle : null
    if (cur !== prev) {
      const runLen = i - runStart
      if (runLen >= 2) {
        const affected = withImage.slice(runStart, i).map((s) => s.id)
        warnings.push({
          category: 'repetitionRisk',
          severity: runLen >= 3 ? 'critical' : 'warn',
          message:
            `${runLen} adjacent sections share framingStyle='${prev}' (${affected.join(' → ')}). ` +
            `Reader scroll feels repetitive — vary framing.`,
          affectedSectionIds: affected,
        })
        repScore += runLen >= 3 ? 2 : 1
      }
      runStart = i
    }
  }

  // ── Check 2: 3+ same compositionTension anywhere ────────────────
  const tensionCounts = new Map<string, OrchestratedSection[]>()
  for (const s of withImage) {
    const t = s.imageIntent!.compositionTension
    if (!tensionCounts.has(t)) tensionCounts.set(t, [])
    tensionCounts.get(t)!.push(s)
  }
  for (const [tension, group] of tensionCounts) {
    if (group.length >= 4 && group.length / withImage.length > 0.6) {
      warnings.push({
        category: 'repetitionRisk',
        severity: 'warn',
        message:
          `${group.length}/${withImage.length} image-bearing sections share compositionTension='${tension}'. ` +
          `Composition rhythm collapse — emotional arc requires tension variance.`,
        affectedSectionIds: group.map((s) => s.id),
      })
      repScore++
    }
  }

  // ── Check 3: hero/lifestyle uniform subjectDistance ─────────────
  const heroLifestyle = withImage.filter(
    (s) => s.role === 'hero-recognition' || s.role === 'transformation',
  )
  if (heroLifestyle.length >= 2) {
    const distances = new Set(heroLifestyle.map((s) => s.imageIntent!.subjectDistance))
    if (distances.size === 1) {
      warnings.push({
        category: 'repetitionRisk',
        severity: 'info',
        message:
          `Hero + lifestyle sections share subjectDistance — visual distance uniformity. ` +
          `Real ads vary close vs wide for emotional contrast.`,
        affectedSectionIds: heroLifestyle.map((s) => s.id),
      })
      repScore++
    }
  }

  // ── Check 4: 3+ same emotionalState anywhere ────────────────────
  const emotionCounts = new Map<string, OrchestratedSection[]>()
  for (const s of withImage) {
    const e = s.imageIntent!.emotionalState
    if (!emotionCounts.has(e)) emotionCounts.set(e, [])
    emotionCounts.get(e)!.push(s)
  }
  for (const [emotion, group] of emotionCounts) {
    if (group.length >= 3 && group.length / withImage.length > 0.5) {
      warnings.push({
        category: 'repetitionRisk',
        severity: 'warn',
        message:
          `${group.length}/${withImage.length} sections share emotionalState='${emotion}'. ` +
          `Emotional monotony — reader feels same beat across scroll.`,
        affectedSectionIds: group.map((s) => s.id),
      })
      repScore++
    }
  }

  return { warnings, repetitionRisk: scoreToRisk(repScore) }
}

function scoreToRisk(score: number): RiskLevel {
  if (score === 0) return 'low'
  if (score === 1) return 'moderate'
  if (score === 2) return 'elevated'
  return 'high'
}
