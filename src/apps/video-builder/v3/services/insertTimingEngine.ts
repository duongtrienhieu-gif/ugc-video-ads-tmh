// ── Insert Timing Engine ─────────────────────────────────────────────────────
// Z33 §12 — Anchor each action insert to a TIMESTAMP within the voice
// timeline (Phase 2 master timeline).
//
// Strategy:
//   1. For inserts that came from the keyword suggester, anchor at the
//      START SECOND of the block where the keyword first appeared.
//   2. For manually-added inserts (no scriptKeyword / no anchorBlock),
//      space them evenly across the script duration.
//
// The timestamps become the input to Phase 5's ffmpeg auto-edit — each
// insert layers over the main creator video at its assigned timestamp.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ActionInsertClip, GeneratedScript, ScriptBlockId,
} from '../types'
import { SCRIPT_BLOCK_ORDER } from '../types'

/**
 * Compute the start-second of each script block by accumulating
 * estDurationSec in order.
 *
 * Returns Record<blockId, startSec>.
 */
export function computeBlockStartTimestamps(
  script: GeneratedScript,
): Record<ScriptBlockId, number> {
  const startTimes: Partial<Record<ScriptBlockId, number>> = {}
  let cursor = 0
  for (const blockId of SCRIPT_BLOCK_ORDER) {
    const block = script.blocks.find((b) => b.id === blockId)
    if (!block) continue
    startTimes[blockId] = Number(cursor.toFixed(2))
    cursor += block.estDurationSec
  }
  // Fill any missing blocks with the last cursor
  const final: Record<ScriptBlockId, number> = {
    hook:      startTimes.hook      ?? 0,
    pain:      startTimes.pain      ?? 0,
    discovery: startTimes.discovery ?? 0,
    benefit:   startTimes.benefit   ?? 0,
    cta:       startTimes.cta       ?? 0,
  }
  return final
}

/**
 * Z33 — Assign a voiceTimestampSec to each insert. If the insert has a
 * scriptKeyword + anchor block, place it at that block's start. Otherwise
 * space evenly across the timeline.
 *
 * Mutates the input array's voiceTimestampSec field and returns the
 * updated array. Idempotent — safe to call multiple times.
 */
export function assignInsertTimestamps(
  inserts: ActionInsertClip[],
  script: GeneratedScript,
  anchorBlockByInsert: Map<number, ScriptBlockId | null>,
): ActionInsertClip[] {
  if (inserts.length === 0) return inserts
  const blockStarts = computeBlockStartTimestamps(script)
  const totalDuration = script.totalDurationSec

  // Split inserts into anchored vs unanchored
  const anchored: ActionInsertClip[] = []
  const unanchored: ActionInsertClip[] = []
  for (const insert of inserts) {
    const block = anchorBlockByInsert.get(insert.insertId)
    if (block) {
      anchored.push(insert)
    } else {
      unanchored.push(insert)
    }
  }

  // Place anchored inserts at their block's start
  const updated: ActionInsertClip[] = []
  for (const insert of anchored) {
    const block = anchorBlockByInsert.get(insert.insertId)
    if (!block) continue
    const ts = blockStarts[block] ?? 0
    updated.push({ ...insert, voiceTimestampSec: ts })
  }

  // Space unanchored inserts evenly across the timeline, avoiding the
  // first 1s (let the hook land first) and the last 1s (don't cover CTA).
  if (unanchored.length > 0) {
    const usableStart = 1
    const usableEnd = Math.max(usableStart + 1, totalDuration - 1)
    const span = usableEnd - usableStart
    const stepCount = unanchored.length + 1
    for (let i = 0; i < unanchored.length; i++) {
      const ts = usableStart + ((i + 1) / stepCount) * span
      updated.push({ ...unanchored[i], voiceTimestampSec: Number(ts.toFixed(2)) })
    }
  }

  // Sort by voiceTimestampSec ASC + assign order field
  updated.sort((a, b) => (a.voiceTimestampSec ?? 0) - (b.voiceTimestampSec ?? 0))
  return updated.map((insert, i) => ({ ...insert, order: i }))
}

/**
 * Quick diagnostic — returns inserts grouped by which script block they
 * anchor to. Used by the UI's "Inserts theo block" debug view.
 */
export function groupInsertsByBlock(
  inserts: ActionInsertClip[],
  script: GeneratedScript,
): Record<ScriptBlockId, ActionInsertClip[]> {
  const blockStarts = computeBlockStartTimestamps(script)
  const result: Record<ScriptBlockId, ActionInsertClip[]> = {
    hook: [], pain: [], discovery: [], benefit: [], cta: [],
  }

  for (const insert of inserts) {
    const ts = insert.voiceTimestampSec ?? 0
    // Find which block contains this timestamp
    let containingBlock: ScriptBlockId = 'hook'
    for (let i = SCRIPT_BLOCK_ORDER.length - 1; i >= 0; i--) {
      const blockId = SCRIPT_BLOCK_ORDER[i]
      if (ts >= blockStarts[blockId]) {
        containingBlock = blockId
        break
      }
    }
    result[containingBlock].push(insert)
  }
  return result
}
