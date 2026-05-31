// ── Insert Timing Engine ─────────────────────────────────────────────────────
// Z33 §12 — Compute the START SECOND of each script block within the Phase 2
// voice timeline.
//
// At "Apply suggestions" time (ActionInsertsPhase), each suggested insert is
// anchored to its block's start second via this function and persisted as
// voiceTimestampSec. Phase 5's auto-edit planner (autoEditPlanner) then layers
// each insert over the creator video at that timestamp; inserts with no
// timestamp are spaced evenly there.
// ─────────────────────────────────────────────────────────────────────────────

import type { GeneratedScript, ScriptBlockId } from '../types'
import { SCRIPT_BLOCK_ORDER } from '../types'

/**
 * Compute the start-second of each script block by accumulating
 * estDurationSec in order.
 *
 * Blocks NOT present in the script map to null (not 0). 0 is a real
 * timestamp — the very start of the video — so collapsing a missing block to
 * 0 would wrongly anchor its insert at t=0. null lets the caller fall back to
 * even spacing instead.
 */
export function computeBlockStartTimestamps(
  script: GeneratedScript,
): Record<ScriptBlockId, number | null> {
  const startTimes: Partial<Record<ScriptBlockId, number>> = {}
  let cursor = 0
  for (const blockId of SCRIPT_BLOCK_ORDER) {
    const block = script.blocks.find((b) => b.id === blockId)
    if (!block) continue
    startTimes[blockId] = Number(cursor.toFixed(2))
    cursor += block.estDurationSec
  }
  return {
    hook:      startTimes.hook      ?? null,
    pain:      startTimes.pain      ?? null,
    discovery: startTimes.discovery ?? null,
    benefit:   startTimes.benefit   ?? null,
    cta:       startTimes.cta       ?? null,
  }
}
