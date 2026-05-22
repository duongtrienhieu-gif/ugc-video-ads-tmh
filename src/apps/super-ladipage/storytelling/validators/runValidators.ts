// ─────────────────────────────────────────────────────────────────────
// runValidators — orchestrate all 5 detectors
//
// Returns aggregated result + feedback string for retry prompts.
// ─────────────────────────────────────────────────────────────────────

import type { SectionId } from '../types'
import type { ParsedPack } from '../runtime/parsePackResponse'
import { bioIntroDetector } from './bioIntroDetector'
import { adjacentRhythmDetector } from './adjacentRhythmDetector'
import { aiCadenceDetector } from './aiCadenceDetector'
import { bannedPhraseDetector } from './bannedPhraseDetector'
import { commercialToneDetector } from './commercialToneDetector'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

export type ValidatorName =
  | 'bioIntro'
  | 'adjacentRhythm'
  | 'aiCadence'
  | 'bannedPhrase'
  | 'commercialTone'

export interface AggregatedValidation {
  pass: boolean
  violations: Array<ValidatorViolation & { validator: ValidatorName }>
  failingSections: SectionId[]
  byValidator: Record<ValidatorName, ValidatorResult>
  /** Compact feedback string for retry prompt injection. */
  retryFeedback: string[]
}

export function runValidators(parsed: ParsedPack): AggregatedValidation {
  const byValidator: Record<ValidatorName, ValidatorResult> = {
    bioIntro:       bioIntroDetector(parsed.sections[0]),
    adjacentRhythm: adjacentRhythmDetector(parsed.sections),
    aiCadence:      aiCadenceDetector(parsed.sections),
    bannedPhrase:   bannedPhraseDetector(parsed.sections),
    commercialTone: commercialToneDetector(parsed.sections),
  }

  const violations: AggregatedValidation['violations'] = []
  const failingSet = new Set<SectionId>()
  const retryFeedback: string[] = []

  for (const [name, result] of Object.entries(byValidator) as [ValidatorName, ValidatorResult][]) {
    for (const v of result.violations) {
      violations.push({ validator: name, ...v })
      failingSet.add(v.sectionId)
      retryFeedback.push(`Section "${v.sectionId}" failed ${name}: ${v.violation}`)
    }
  }

  return {
    pass: violations.length === 0,
    violations,
    failingSections: [...failingSet],
    byValidator,
    retryFeedback,
  }
}

/** Log validator results to console — for debug. */
export function logValidationResult(result: AggregatedValidation) {
  if (result.pass) {
    console.info(`[storytelling/validators] ✓ all 5 validators passed`)
    return
  }
  console.warn(
    `[storytelling/validators] ✗ ${result.violations.length} violations across ${result.failingSections.length} sections`,
  )
  for (const v of result.violations) {
    console.warn(`  [${v.validator}] ${v.sectionId}: ${v.violation}`)
  }
}
