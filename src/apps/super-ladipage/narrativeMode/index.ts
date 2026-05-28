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
export { buildModeHint } from './modeSystemPromptHint'
