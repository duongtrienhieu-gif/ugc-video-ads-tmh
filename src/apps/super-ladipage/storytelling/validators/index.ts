// ─────────────────────────────────────────────────────────────────────
// Validators barrel
// ─────────────────────────────────────────────────────────────────────

export { bioIntroDetector } from './bioIntroDetector'
export { adjacentRhythmDetector } from './adjacentRhythmDetector'
export { aiCadenceDetector } from './aiCadenceDetector'
export { bannedPhraseDetector } from './bannedPhraseDetector'
export { commercialToneDetector } from './commercialToneDetector'
export { runValidators, logValidationResult } from './runValidators'

export type {
  ValidatorResult,
  ValidatorViolation,
} from './bioIntroDetector'

export type {
  ValidatorName,
  AggregatedValidation,
} from './runValidators'
