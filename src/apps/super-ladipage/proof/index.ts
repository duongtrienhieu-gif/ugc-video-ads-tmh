// ─────────────────────────────────────────────────────────────────────
// Proof System — public API barrel
//
// Sandbox riêng cho proof layer. Independent conversion system, NOT
// storytelling accessory. Consumer (currently storytelling retryWithFeedback)
// only needs generateProofSet + buildStoryContextLine.
// ─────────────────────────────────────────────────────────────────────

// Entry point — separate Gemini call for proof generation.
export {
  generateProofSet,
  buildStoryContextLine,
} from './runtime/generateProofSet'

export type {
  GenerateProofSetArgs,
  GenerateProofSetResult,
} from './runtime/generateProofSet'

// Types (re-export for consumers needing proof shape)
export type {
  ProofPiece,
  ProofStance,
  ProofStanceId,
  ProofPhase,
  ProofTextureProfile,
  ObjectionEntry,
  NicheObjections,
  ProofPieceConfig,
  ProofConfig,
  EntropyProfile,
  EntropyGrammar,
  EntropyEffort,
  CertaintyLevel,
} from './types'

// Config (read-only data — exposed for QA/debugging)
export {
  PROOF_STANCES,
  sampleStances,
} from './config/proofStances'

export {
  PROOF_TEXTURE_PROFILES,
  getTextureProfile,
  textureBrief,
} from './config/proofTextureProfiles'

export {
  NICHE_OBJECTIONS,
  sampleObjections,
} from './config/objectionPatterns'

export {
  sampleEntropyProfiles,
  entropyDirective,
} from './config/proofEntropyRules'

// Runtime helpers
export { sampleProofConfig } from './runtime/sampleProofConfig'
