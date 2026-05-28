// ─────────────────────────────────────────────────────────────────────
// runValidators — v6 (2026-05-29)
//
// REBUILD: trimmed hard-validator set to 5 (was 7). The 2 that moved to
// soft (phaseOneSpecificity, duplicateContent) were retry-storm drivers
// — they fired because the v5 prompt didn't prevent the patterns upfront.
// In v6 the mode-conditional system prompt + brainstorm beat assignment
// enforce these constraints at generation time, so the detectors are
// safety net (warn) not enforcement (retry).
//
// Removed: selfInsertionDetector (low signal, audit confirmed).
//
// Hard validators (5) — trigger retry + fallback if violated:
//   bioIntro, adjacentRhythm, aiCadence, bannedPhrase, commercialTone
//
// Soft validators (8) — log only, no retry:
//   paragraphCount, narratorCentric, nicheContamination, crossNicheVocab,
//   genericWellnessDensity, memoryAnchor, emotionalFlattening, aggressiveSales,
//   phaseOneSpecificity (v6 demoted), duplicateContent (v6 demoted)
// ─────────────────────────────────────────────────────────────────────

import type { BlockId, NicheKey } from '../types'
import type { ParsedPack } from '../runtime/parsePackResponse'
import { bioIntroDetector } from './bioIntroDetector'
import { adjacentRhythmDetector } from './adjacentRhythmDetector'
import { aiCadenceDetector } from './aiCadenceDetector'
import { bannedPhraseDetector } from './bannedPhraseDetector'
import { commercialToneDetector } from './commercialToneDetector'
import { paragraphCountDetector } from './paragraphCountDetector'
import { narratorCentricDetector } from './narratorCentricDetector'
import { nicheContaminationDetector } from './nicheContaminationDetector'
import { crossNicheVocabDetector } from './crossNicheVocabDetector'
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
  | 'phaseOneSpecificity'        // soft (v6 — was hard in v5)
  | 'duplicateContent'           // soft (v6 — was hard in v5)
  | 'paragraphCount'             // soft
  | 'narratorCentric'            // soft
  | 'nicheContamination'         // soft
  | 'crossNicheVocab'            // soft
  | 'genericWellnessDensity'     // soft
  | 'memoryAnchor'               // soft
  | 'emotionalFlattening'        // soft
  | 'aggressiveSales'            // soft

/** Soft validators — log warnings, do NOT trigger retry. */
const SOFT_VALIDATORS: ReadonlySet<ValidatorName> = new Set([
  'paragraphCount', 'narratorCentric',
  'nicheContamination', 'crossNicheVocab',
  'genericWellnessDensity', 'memoryAnchor', 'emotionalFlattening',
  'aggressiveSales',
  'phaseOneSpecificity',   // v6 demoted
  'duplicateContent',      // v6 demoted
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
    paragraphCount:          paragraphCountDetector(parsed.sections),
    narratorCentric:         narratorCentricDetector(parsed.sections),
    nicheContamination:      niche
      ? nicheContaminationDetector(parsed.sections, niche)
      : { pass: true, violations: [] },
    crossNicheVocab:         niche
      ? crossNicheVocabDetector(parsed.sections, niche)
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
    `[storytelling/validators] ✗ ${result.violations.length} hard violations across ${result.failingSections.length} sections (+ ${result.softWarnings.length} soft warnings)`,
  )
  for (const v of result.violations) {
    console.warn(`  [${v.validator}] ${v.sectionId}: ${v.violation}`)
  }
  for (const w of result.softWarnings) {
    console.info(`  [soft:${w.validator}] ${w.sectionId}: ${w.violation}`)
  }
}
