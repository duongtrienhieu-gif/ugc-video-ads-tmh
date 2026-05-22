// ─────────────────────────────────────────────────────────────────────
// runValidators — orchestrate all detectors (P0.5.4 realignment)
//
// 6 validators total. 5 = strict (trigger retry on violation). 1 =
// soft warning (informational only, doesn't trigger retry).
//
// Soft warning philosophy: stylistic finesse comes from prompt + Gemini
// judgment. Validators are SAFETY NET catching obvious failures, NOT
// drivers shaping every output.
// ─────────────────────────────────────────────────────────────────────

import type { SectionId } from '../types'
import type { ParsedPack } from '../runtime/parsePackResponse'
import { bioIntroDetector } from './bioIntroDetector'
import { adjacentRhythmDetector } from './adjacentRhythmDetector'
import { aiCadenceDetector } from './aiCadenceDetector'
import { bannedPhraseDetector } from './bannedPhraseDetector'
import { commercialToneDetector } from './commercialToneDetector'
import { selfInsertionDetector } from './selfInsertionDetector'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

export type ValidatorName =
  | 'bioIntro'
  | 'adjacentRhythm'
  | 'aiCadence'
  | 'bannedPhrase'
  | 'commercialTone'
  | 'selfInsertion'    // soft warning — does NOT trigger retry

/** Soft validators — flagged for visibility, not enforcement. */
const SOFT_VALIDATORS: ReadonlySet<ValidatorName> = new Set(['selfInsertion'])

export interface AggregatedValidation {
  pass: boolean
  violations: Array<ValidatorViolation & { validator: ValidatorName }>
  /** Soft warnings — informational, don't affect retry logic. */
  softWarnings: Array<ValidatorViolation & { validator: ValidatorName }>
  failingSections: SectionId[]
  byValidator: Record<ValidatorName, ValidatorResult>
  /** Compact feedback string for retry prompt injection — only from HARD violations. */
  retryFeedback: string[]
}

export function runValidators(parsed: ParsedPack): AggregatedValidation {
  const byValidator: Record<ValidatorName, ValidatorResult> = {
    bioIntro:       bioIntroDetector(parsed.sections[0]),
    adjacentRhythm: adjacentRhythmDetector(parsed.sections),
    aiCadence:      aiCadenceDetector(parsed.sections),
    bannedPhrase:   bannedPhraseDetector(parsed.sections),
    commercialTone: commercialToneDetector(parsed.sections),
    selfInsertion:  selfInsertionDetector(parsed.sections[0]),
  }

  const violations: AggregatedValidation['violations'] = []
  const softWarnings: AggregatedValidation['softWarnings'] = []
  const failingSet = new Set<SectionId>()
  const retryFeedback: string[] = []

  for (const [name, result] of Object.entries(byValidator) as [ValidatorName, ValidatorResult][]) {
    const isSoft = SOFT_VALIDATORS.has(name)
    for (const v of result.violations) {
      if (isSoft) {
        softWarnings.push({ validator: name, ...v })
      } else {
        violations.push({ validator: name, ...v })
        failingSet.add(v.sectionId)
        retryFeedback.push(`Section "${v.sectionId}" failed ${name}: ${v.violation}`)
      }
    }
  }

  return {
    pass: violations.length === 0,  // soft warnings don't affect pass
    violations,
    softWarnings,
    failingSections: [...failingSet],
    byValidator,
    retryFeedback,
  }
}

/** Log validator results to console — for debug. */
export function logValidationResult(result: AggregatedValidation) {
  if (result.pass && result.softWarnings.length === 0) {
    console.info(`[storytelling/validators] ✓ all 5 hard validators passed, 0 soft warnings`)
    return
  }
  if (result.pass) {
    console.info(
      `[storytelling/validators] ✓ all 5 hard validators passed, ${result.softWarnings.length} soft warnings`,
    )
    for (const w of result.softWarnings) {
      console.info(`  [soft:${w.validator}] ${w.sectionId}: ${w.violation}`)
    }
    return
  }
  console.warn(
    `[storytelling/validators] ✗ ${result.violations.length} violations across ${result.failingSections.length} sections (+ ${result.softWarnings.length} soft warnings)`,
  )
  for (const v of result.violations) {
    console.warn(`  [${v.validator}] ${v.sectionId}: ${v.violation}`)
  }
  for (const w of result.softWarnings) {
    console.info(`  [soft:${w.validator}] ${w.sectionId}: ${w.violation}`)
  }
}
