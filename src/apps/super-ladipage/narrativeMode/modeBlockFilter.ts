// ─────────────────────────────────────────────────────────────────────
// Narrative Mode — modeBlockFilter (REBUILD Sprint 2, 2026-05-28)
//
// Per-mode rules for which blocks to skip from the canonical pack outline.
// Applied AFTER resolveBlockPlan's standard required/optional logic so we
// can cull filler chapters for pain-driven-DR packs without touching the
// canonical BLOCK_POOL definitions.
//
// pain-driven-DR:
//   ⨯ not-alone-bridge         — soft "you are not alone" filler
//                                 (DR doesn't need it after the agitate beats)
//   ⨯ belief-shift             — philosophical reframe ("maybe you were
//                                 focusing on the wrong thing") — gets
//                                 folded into shared-failed-attempts via
//                                 the brainstorm reframe beat
//   ⨯ emotional-wins           — quality-of-life-shift filler. Redundant
//                                 next to micro-transformation in DR mode.
//
// aspiration-led:
//   (no skips — keep full structure, the future-vision blocks ARE the spine)
//
// recognition-soft:
//   (no skips — current default behavior preserved exactly)
// ─────────────────────────────────────────────────────────────────────

import type { BlockId } from '../storytelling/types'
import type { NarrativeMode } from './detectNarrativeMode'

const MODE_BLOCK_SKIP: Record<NarrativeMode, ReadonlySet<BlockId>> = {
  'pain-driven-DR': new Set<BlockId>([
    'not-alone-bridge',
    'belief-shift',
    'emotional-wins',
  ]),
  'aspiration-led': new Set<BlockId>(),
  'recognition-soft': new Set<BlockId>(),
}

/** Return true when the block should be culled for the given mode. */
export function isBlockSkippedForMode(blockId: BlockId, mode: NarrativeMode): boolean {
  return MODE_BLOCK_SKIP[mode].has(blockId)
}

/** Snapshot of skipped IDs for telemetry / log lines. */
export function getSkippedBlocksForMode(mode: NarrativeMode): BlockId[] {
  return Array.from(MODE_BLOCK_SKIP[mode])
}
