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
  AdStructure, VoiceAlignment,
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

/**
 * Z98 B2 — cheap deterministic hash of (full script text + voiceId). Shared by the
 * Step-2 trigger (which stamps a generated voice) and the Step-3 render (which only
 * reuses that voice when the sig still matches — i.e. the script/voice are unchanged).
 */
export function scriptVoiceSig(scriptText: string, voiceId: string | null | undefined): string {
  const s = `${scriptText}|${voiceId ?? ''}`
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `${h}:${s.length}`
}

/**
 * Z98 B2 — VOICE-FIRST recalibration. Once the REAL voice is synthesized, replace
 * the 215-wpm estimate with the measured truth so the director splits B-roll over
 * the actual length (the estimate could be ~40% off, which squeezed all the
 * B-roll into the front of a longer real video).
 *
 * With a per-character alignment (#6) we set each block's estDurationSec to the
 * REAL spoken span of its text. Without one we scale every block proportionally
 * so at least the TOTAL matches the measured audio. Either way
 * script.totalDurationSec becomes the real number the director reads.
 */
export function recalibrateScriptToRealVoice(
  script: GeneratedScript,
  measuredDurationSec: number,
  voiceAlignment?: VoiceAlignment,
): GeneratedScript {
  const measured = measuredDurationSec > 0 ? measuredDurationSec : script.totalDurationSec

  // No alignment → proportional scale (real total, blocks keep their ratio).
  if (!voiceAlignment || !voiceAlignment.text || voiceAlignment.charStartSecs.length === 0) {
    const estTotal = script.blocks.reduce((sum, b) => sum + b.estDurationSec, 0)
    const factor = estTotal > 0 ? measured / estTotal : 1
    const blocks = script.blocks.map((b) => ({
      ...b,
      estDurationSec: Number((b.estDurationSec * factor).toFixed(2)),
    }))
    return { ...script, blocks, totalDurationSec: Number(measured.toFixed(2)) }
  }

  // Alignment present → real per-block durations. Each block's text appears in the
  // transcript (alignment.text === blocks joined by ' '); locate it sequentially
  // and read the spoken second of its first character.
  const { text, charStartSecs } = voiceAlignment
  const realStartAt = (charIdx: number): number | null => {
    if (charIdx < 0) return null
    const s = charStartSecs[Math.min(charIdx, charStartSecs.length - 1)]
    return Number.isFinite(s) ? s : null
  }
  const startIdx: number[] = []
  let cursor = 0
  for (const b of script.blocks) {
    const at = text.indexOf(b.text, cursor)
    if (at >= 0) { startIdx.push(at); cursor = at + b.text.length }
    else startIdx.push(-1)
  }
  const blocks = script.blocks.map((b, i) => {
    const start = realStartAt(startIdx[i])
    if (start == null) return { ...b }  // couldn't locate → keep its estimate
    const nextStart = i + 1 < script.blocks.length ? realStartAt(startIdx[i + 1]) : measured
    const end = nextStart ?? measured
    const dur = Math.max(0.1, Number((end - start).toFixed(2)))
    return { ...b, estDurationSec: dur }
  })
  return { ...script, blocks, totalDurationSec: Number(measured.toFixed(2)) }
}
