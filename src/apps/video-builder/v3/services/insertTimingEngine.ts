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

// ── Z42 — sentence-level timeline anchoring ─────────────────────────────────
// The block-start map above only gives 5 coarse anchor points (one per block),
// so multiple scenes in the same block pile up at the same second. The Scene
// Director now returns the VERBATIM line of dialogue ("quote") each scene
// illustrates. This function locates that quote inside the running voice
// timeline and returns the precise second it is spoken — so scenes land where
// the words actually are, not at the block boundary.
//
// Timing model is the same word-count/WPM basis as computeBlockStartTimestamps:
// each block occupies [blockStart, blockStart + estDurationSec], and we
// linearly interpolate the quote's character offset within its block to a time.
// Returns null when the quote can't be located — the caller then falls back to
// the block-start anchor (and finally to even spacing).

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export function computeQuoteTimestamp(
  script: GeneratedScript,
  quote: string | undefined | null,
): number | null {
  const normQuote = quote ? normalizeForMatch(quote) : ''
  if (normQuote.length < 4) return null  // too short to locate reliably

  // Build the running timeline of present blocks, recording each block's
  // char-offset inside the concatenated normalized transcript.
  interface Seg { start: number; dur: number; charStart: number; charLen: number }
  const segs: Seg[] = []
  const parts: string[] = []
  let cursorTime = 0
  let cursorChar = 0
  for (const blockId of SCRIPT_BLOCK_ORDER) {
    const block = script.blocks.find((b) => b.id === blockId)
    if (!block) continue
    const norm = normalizeForMatch(block.text)
    segs.push({
      start: cursorTime,
      dur: block.estDurationSec,
      charStart: cursorChar,
      charLen: norm.length,
    })
    parts.push(norm)
    cursorTime += block.estDurationSec
    cursorChar += norm.length + 1  // +1 for the join separator space
  }
  if (segs.length === 0) return null

  const full = parts.join(' ')

  // Exact substring first; loose probe on the first ~40 chars as a fallback
  // (handles the director quoting a line with minor punctuation differences).
  let idx = full.indexOf(normQuote)
  if (idx < 0) {
    const probe = normQuote.slice(0, 40).trim()
    if (probe.length >= 6) idx = full.indexOf(probe)
  }
  if (idx < 0) return null

  // Find the block segment that contains this char offset.
  const seg = segs.find((s) => idx >= s.charStart && idx < s.charStart + s.charLen + 1)
    ?? segs[segs.length - 1]
  const fraction = seg.charLen > 0
    ? Math.max(0, Math.min(1, (idx - seg.charStart) / seg.charLen))
    : 0
  const time = seg.start + fraction * seg.dur
  return Number(time.toFixed(2))
}
