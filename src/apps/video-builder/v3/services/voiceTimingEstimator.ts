// ── Voice Timing Estimator ───────────────────────────────────────────────────
// Z31 §6 — VOICE is the MASTER TIMELINE. Everything renders to sync with
// the voice duration. This module estimates per-block voice duration
// BEFORE the TTS call so the UI can show "your 30s script lands at 28.4s"
// and the user can tweak before paying for TTS.
//
// Baseline: 215 wpm — Z65 raised the TTS to speed 1.2 + lower style (fewer
// pauses) for a snappier pace, so the effective read rate rose (~200→~215 wpm).
// The estimate is still approximate (it varies by voice/run) — the auto-edit
// planner (Z57) re-scales insert timestamps to the ACTUAL measured voice
// duration, and the UI shows the REAL measured duration after "Nghe thử giọng"
// (Z64), so final timing + the displayed number are correct regardless.
//
// The estimator is purely arithmetic — no network, no Gemini, runs on
// every script edit.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GeneratedScript, ScriptBlock, ScriptBlockId, ScriptTargetDurationSec,
  AdStructure,
} from '../types'
import { AD_STRUCTURES } from './adStructures'

const DEFAULT_WPM = 215

/** Count words — supports Vietnamese (space-tokenized) + English. */
export function countWords(text: string): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Estimate read duration for a piece of text at a given WPM. */
export function estimateReadDurationSec(text: string, wpm: number = DEFAULT_WPM): number {
  const words = countWords(text)
  if (words === 0) return 0
  return Number(((words / wpm) * 60).toFixed(2))
}

/** Estimate duration at the engine-default pace. */
export function estimateReadDurationForVoice(text: string): number {
  return estimateReadDurationSec(text, DEFAULT_WPM)
}

/**
 * Compute the per-block target duration allocation given a structure
 * and total target duration. The structure's blockWeights drive the
 * split (e.g. SOCIAL_PROOF puts 40% on BENEFIT block).
 *
 * Returns a Record<ScriptBlockId, number> of target SECONDS per block.
 * These are the budgets the script generator is asked to hit.
 */
export function allocateBlockBudgets(
  structure: AdStructure,
  targetDurationSec: ScriptTargetDurationSec,
): Record<ScriptBlockId, number> {
  const weights = AD_STRUCTURES[structure].blockWeights
  return {
    hook:      Number((targetDurationSec * weights.hook).toFixed(1)),
    pain:      Number((targetDurationSec * weights.pain).toFixed(1)),
    discovery: Number((targetDurationSec * weights.discovery).toFixed(1)),
    benefit:   Number((targetDurationSec * weights.benefit).toFixed(1)),
    cta:       Number((targetDurationSec * weights.cta).toFixed(1)),
  }
}

/**
 * Recompute every block's estimated duration in a script (called after
 * the user edits text or swaps voice category).
 *
 * Mutates the input blocks (in-place) and returns a fresh GeneratedScript
 * with the updated totalDurationSec.
 */
export function recomputeBlockDurations(script: GeneratedScript): GeneratedScript {
  const wpm = DEFAULT_WPM
  const updatedBlocks: ScriptBlock[] = script.blocks.map((b) => ({
    ...b,
    estDurationSec: estimateReadDurationSec(b.text, wpm),
  }))
  const total = updatedBlocks.reduce((sum, b) => sum + b.estDurationSec, 0)
  return {
    ...script,
    blocks: updatedBlocks,
    totalDurationSec: Number(total.toFixed(2)),
  }
}

/**
 * Compute the variance between estimated total and target — used by the
 * UI to flash a warning when the script is way over/under target.
 *
 * Returns a positive percentage where 0 = perfect match, positive = over,
 * negative = under.
 */
export function computeDurationVariance(
  script: GeneratedScript,
): { deltaSec: number; deltaPct: number; status: 'on-target' | 'over' | 'under' } {
  const target = script.targetDurationSec
  const actual = script.totalDurationSec
  const deltaSec = Number((actual - target).toFixed(2))
  const deltaPct = Number(((deltaSec / target) * 100).toFixed(1))
  let status: 'on-target' | 'over' | 'under' = 'on-target'
  if (Math.abs(deltaPct) <= 10) status = 'on-target'
  else if (deltaPct > 10) status = 'over'
  else status = 'under'
  return { deltaSec, deltaPct, status }
}

/**
 * Per-block target — used by the UI to render "HOOK · target 3s · est 3.2s"
 * tooltips.
 */
export function blockTargetDuration(
  blockId: ScriptBlockId,
  structure: AdStructure,
  targetDurationSec: ScriptTargetDurationSec,
): number {
  const budgets = allocateBlockBudgets(structure, targetDurationSec)
  return budgets[blockId]
}
