// ─────────────────────────────────────────────────────────────────────
// runValidators — orchestrate all detectors
//
// 12 validators total. 5 hard (trigger retry on violation). 7 soft
// (informational, don't trigger retry).
//
// Soft warning philosophy: stylistic finesse comes from prompt + Gemini
// judgment. Validators are SAFETY NET catching obvious failures, NOT
// drivers shaping every output. C2 added 4 philosophy-enforcement
// detectors (all soft): nicheContamination, genericWellnessDensity,
// memoryAnchor, emotionalFlattening.
// ─────────────────────────────────────────────────────────────────────

import type { BlockId, NicheKey } from '../types'
import type { ParsedPack } from '../runtime/parsePackResponse'
import { bioIntroDetector } from './bioIntroDetector'
import { adjacentRhythmDetector } from './adjacentRhythmDetector'
import { aiCadenceDetector } from './aiCadenceDetector'
import { bannedPhraseDetector } from './bannedPhraseDetector'
import { commercialToneDetector } from './commercialToneDetector'
import { selfInsertionDetector } from './selfInsertionDetector'
import { paragraphCountDetector } from './paragraphCountDetector'
import { narratorCentricDetector } from './narratorCentricDetector'
import { nicheContaminationDetector } from './nicheContaminationDetector'
import { genericWellnessDensityDetector } from './genericWellnessDensityDetector'
import { memoryAnchorDetector } from './memoryAnchorDetector'
import { emotionalFlatteningDetector } from './emotionalFlatteningDetector'
import { aggressiveSalesDetector } from '../../cta/validators/aggressiveSalesDetector'
import { phaseOneSpecificityDetector } from './phaseOneSpecificityDetector'
import { duplicateContentDetector } from './duplicateContentDetector'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

export type ValidatorName =
  | 'bioIntro'
  | 'adjacentRhythm'
  | 'aiCadence'
  | 'bannedPhrase'
  | 'commercialTone'
  | 'phaseOneSpecificity'        // hard — SPEC-FIX 2026-05-27
  | 'duplicateContent'           // hard — SPEC-FIX 2026-05-27
  | 'selfInsertion'              // soft
  | 'paragraphCount'             // soft
  | 'narratorCentric'            // soft — Chunk C
  | 'nicheContamination'         // soft — Chunk C2
  | 'genericWellnessDensity'     // soft — Chunk C2
  | 'memoryAnchor'               // soft — Chunk C2
  | 'emotionalFlattening'        // soft — Chunk C2
  | 'aggressiveSales'            // soft — Chunk P3

/** Soft validators — flagged for visibility, not enforcement. */
const SOFT_VALIDATORS: ReadonlySet<ValidatorName> = new Set([
  'selfInsertion', 'paragraphCount', 'narratorCentric',
  'nicheContamination', 'genericWellnessDensity', 'memoryAnchor', 'emotionalFlattening',
  'aggressiveSales',
])

export interface AggregatedValidation {
  pass: boolean
  violations: Array<ValidatorViolation & { validator: ValidatorName }>
  /** Soft warnings — informational, don't affect retry logic. */
  softWarnings: Array<ValidatorViolation & { validator: ValidatorName }>
  failingSections: BlockId[]
  byValidator: Record<ValidatorName, ValidatorResult>
  /** Compact feedback string for retry prompt injection — only from HARD violations. */
  retryFeedback: string[]
}

export function runValidators(
  parsed: ParsedPack,
  niche?: NicheKey,
  /** SPEC-FIX (2026-05-27) — synthesis-derived product-specific symptoms.
   *  When provided, phaseOneSpecificityDetector hard-checks that Phase 1-2
   *  sections anchor to these terms (no abstract emotional drift). */
  readerSpecificSymptoms?: string[],
): AggregatedValidation {
  const byValidator: Record<ValidatorName, ValidatorResult> = {
    bioIntro:                bioIntroDetector(parsed.sections[0]),
    adjacentRhythm:          adjacentRhythmDetector(parsed.sections),
    aiCadence:               aiCadenceDetector(parsed.sections),
    bannedPhrase:            bannedPhraseDetector(parsed.sections),
    commercialTone:          commercialToneDetector(parsed.sections),
    phaseOneSpecificity:     readerSpecificSymptoms
      ? phaseOneSpecificityDetector(parsed.sections, readerSpecificSymptoms)
      : { pass: true, violations: [] },
    duplicateContent:        duplicateContentDetector(parsed.sections),
    selfInsertion:           selfInsertionDetector(parsed.sections[0]),
    paragraphCount:          paragraphCountDetector(parsed.sections),
    narratorCentric:         narratorCentricDetector(parsed.sections),
    nicheContamination:      niche
      ? nicheContaminationDetector(parsed.sections, niche)
      : { pass: true, violations: [] },
    genericWellnessDensity:  genericWellnessDensityDetector(parsed.sections),
    memoryAnchor:            memoryAnchorDetector(parsed.sections),
    emotionalFlattening:     niche
      ? emotionalFlatteningDetector(parsed.sections, niche)
      : { pass: true, violations: [] },
    aggressiveSales:         aggressiveSalesDetector(parsed.sections),
  }

  const violations: AggregatedValidation['violations'] = []
  const softWarnings: AggregatedValidation['softWarnings'] = []
  const failingSet = new Set<BlockId>()
  const retryFeedback: string[] = []

  for (const [name, result] of Object.entries(byValidator) as [ValidatorName, ValidatorResult][]) {
    const isSoft = SOFT_VALIDATORS.has(name)
    for (const v of result.violations) {
      if (isSoft) {
        softWarnings.push({ validator: name, ...v })
      } else {
        violations.push({ validator: name, ...v })
        failingSet.add(v.sectionId as BlockId)
        retryFeedback.push(`Block "${v.sectionId}" failed ${name}: ${v.violation}`)
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
  const softLabel = '(paragraphCount + selfInsertion + narratorCentric + nicheContamination + genericWellnessDensity + memoryAnchor + emotionalFlattening = soft)'
  if (result.pass && result.softWarnings.length === 0) {
    console.info(`[storytelling/validators] ✓ all 5 hard validators passed ${softLabel}, 0 soft warnings`)
    return
  }
  if (result.pass) {
    console.info(
      `[storytelling/validators] ✓ all 5 hard validators passed ${softLabel}, ${result.softWarnings.length} soft warnings`,
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
