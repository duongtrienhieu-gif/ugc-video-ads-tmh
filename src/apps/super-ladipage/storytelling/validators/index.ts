// ─────────────────────────────────────────────────────────────────────
// Validators barrel
// ─────────────────────────────────────────────────────────────────────

export { bioIntroDetector } from './bioIntroDetector'
export { adjacentRhythmDetector } from './adjacentRhythmDetector'
export { aiCadenceDetector } from './aiCadenceDetector'
export { bannedPhraseDetector } from './bannedPhraseDetector'
export { commercialToneDetector } from './commercialToneDetector'
export { selfInsertionDetector } from './selfInsertionDetector'
export { paragraphCountDetector } from './paragraphCountDetector'
export { narratorCentricDetector } from './narratorCentricDetector'
export { nicheContaminationDetector } from './nicheContaminationDetector'
export { genericWellnessDensityDetector } from './genericWellnessDensityDetector'
export { memoryAnchorDetector } from './memoryAnchorDetector'
export { emotionalFlatteningDetector } from './emotionalFlatteningDetector'
export { runValidators, logValidationResult } from './runValidators'

export type {
  ValidatorResult,
  ValidatorViolation,
} from './bioIntroDetector'

export type {
  ValidatorName,
  AggregatedValidation,
} from './runValidators'
