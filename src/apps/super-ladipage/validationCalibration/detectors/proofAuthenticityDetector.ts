// ─────────────────────────────────────────────────────────────────────
// P13 — proofAuthenticityDetector
//
// Proof sections must feel accidental / believable / imperfect.
// Detects fake-testimonial / luxury-review / suspiciously-polished drift.
//
// Checks (per proof-bearing section):
//   1. polishLevel ≥ editorial → fake review feel
//   2. proofFeel='screenshot' AND framingStyle != 'screenshot-frame' → mismatch
//   3. proofFeel='attribution-card' AND lightingMood='warm-soft' → ad-style
//   4. compositionTension='calm-symmetric' on proof → over-designed proof
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { ValidationWarning, RiskLevel } from '../types'
import type { PolishLevel } from '../../imageSemantics'

const POLISH_ORDER: PolishLevel[] = [
  'raw-handheld',
  'low-polish',
  'considered-natural',
  'editorial',
  'high-polish',
]

export interface ProofAuthenticityDetectorResult {
  warnings: ValidationWarning[]
  proofAuthenticity: RiskLevel
}

export function proofAuthenticityDetector(
  sections: OrchestratedSection[],
): ProofAuthenticityDetectorResult {
  const warnings: ValidationWarning[] = []
  let authenticityRisk = 0

  const proofSections = sections.filter(
    (s) => s.imageIntent && s.imageIntent.proofFeel !== 'none',
  )

  if (proofSections.length === 0) {
    return { warnings, proofAuthenticity: 'low' }
  }

  for (const s of proofSections) {
    const ii = s.imageIntent!

    // ── Check 1: polish too high for proof ──────────────────────────
    const polishIdx = POLISH_ORDER.indexOf(ii.polishLevel)
    if (polishIdx >= POLISH_ORDER.indexOf('editorial')) {
      warnings.push({
        category: 'proofAuthenticity',
        severity: 'critical',
        message:
          `Proof section "${s.id}" polishLevel='${ii.polishLevel}' — too produced for proof. ` +
          `Real screenshots / testimonials are imperfect. Move to raw-handheld or low-polish.`,
        affectedSectionIds: [s.id],
      })
      authenticityRisk += 2
    }

    // ── Check 2: screenshot proofFeel without screenshot framing ────
    if (ii.proofFeel === 'screenshot' && ii.framingStyle !== 'screenshot-frame') {
      warnings.push({
        category: 'proofAuthenticity',
        severity: 'warn',
        message:
          `Proof section "${s.id}" proofFeel='screenshot' but framingStyle='${ii.framingStyle}'. ` +
          `Screenshot proof must use screenshot-frame to feel real.`,
        affectedSectionIds: [s.id],
      })
      authenticityRisk++
    }

    // ── Check 3: attribution-card + warm-soft = ad-style ────────────
    if (ii.proofFeel === 'attribution-card' && ii.lightingMood === 'warm-soft') {
      warnings.push({
        category: 'proofAuthenticity',
        severity: 'warn',
        message:
          `Proof section "${s.id}" combines attribution-card + warm-soft lighting. ` +
          `Reads as polished sponsored ad rather than genuine attribution.`,
        affectedSectionIds: [s.id],
      })
      authenticityRisk++
    }

    // ── Check 4: calm-symmetric proof composition = over-designed ──
    if (ii.compositionTension === 'calm-symmetric') {
      warnings.push({
        category: 'proofAuthenticity',
        severity: 'warn',
        message:
          `Proof section "${s.id}" compositionTension='calm-symmetric' — over-designed proof. ` +
          `Real proof is mildly off-balance, not poster-perfect.`,
        affectedSectionIds: [s.id],
      })
      authenticityRisk++
    }
  }

  return { warnings, proofAuthenticity: scoreToRisk(authenticityRisk) }
}

function scoreToRisk(score: number): RiskLevel {
  if (score === 0) return 'low'
  if (score === 1) return 'moderate'
  if (score === 2) return 'elevated'
  return 'high'
}
