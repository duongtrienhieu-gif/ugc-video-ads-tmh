// ─────────────────────────────────────────────────────────────────────
// Narrative Mode — barrel (REBUILD Sprint 2, 2026-05-28)
//
// Per-pack narrative mode detector + chapter outline filter. Lets the
// engine compose dense (10-12 blocks) DR packs for health/sleep/debt
// niches while preserving the full (15-17 blocks) recognition-soft
// flow for beauty/lifestyle niches — universal across all products.
// ─────────────────────────────────────────────────────────────────────

export { detectNarrativeMode } from './detectNarrativeMode'
export type {
  NarrativeMode,
  NarrativeModeDecision,
  DetectNarrativeModeInput,
} from './detectNarrativeMode'

export { isBlockSkippedForMode, getSkippedBlocksForMode } from './modeBlockFilter'

// 2026-05-29 — Length Mode (adaptive pack length)
// Fix A (2026-05-29) — `getLengthModeSpec(mode, language?)` returns the
// spec adjusted per output language (MS/EN tighten sentence caps because
// each word reads longer than VN). Callers that need language-aware
// cadence should prefer this over the LENGTH_MODE_SPEC const.
export {
  detectLengthMode,
  isBlockSkippedForLength,
  getSkippedBlocksForLength,
  buildLengthModeHint,
  LENGTH_MODE_SPEC,
  getLengthModeSpec,
} from './lengthMode'
export type { LengthMode, LengthModeSpec } from './lengthMode'
