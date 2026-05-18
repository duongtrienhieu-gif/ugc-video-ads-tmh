// ── Timeline Assembler ───────────────────────────────────────────────────────
// Z21 P18 — assembles coverage shots into a final editor-paced timeline.
//
// Replaces Z17's simple energy-based duration picker with PHASE-AWARE
// pacing: HOOK 1.0-1.4s · BODY 2-3s · EDUCATION 2.2-3.2s · RECOVERY 1.8-
// 2.6s · CTA 1.0-1.8s. Assigns editor-style cut types per scene-pair.
//
// Pure logic — no Gemini calls. Pipeline is template-driven + arithmetic.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CoverageShot, TimelineCut, EditorialTransition, EditorialCutType,
  EditorialPhase, EditorialPacingDensity, VisualRole,
} from '../types'
import type { TimelineMode } from './timelineMode'
import { getModeConfig } from './timelineMode'

// ═════════════════════════════════════════════════════════════════════════
// P5 — VOICE DURATION ESTIMATOR
// ═════════════════════════════════════════════════════════════════════════
//
// Vietnamese / Malay UGC voiceover typically lands at 140-160 wpm. We pick
// 150 wpm as a baseline. Caller can pass an explicit duration to override.

const DEFAULT_WPM = 150

export function estimateVoiceDuration(script: string): number {
  if (!script || !script.trim()) return 30  // safe default
  const words = script.trim().split(/\s+/).filter(Boolean).length
  return Math.round((words / DEFAULT_WPM) * 60)
}

// ═════════════════════════════════════════════════════════════════════════
// P5/P10 — AUTO COVERAGE COUNT
// ═════════════════════════════════════════════════════════════════════════
//
// Rules from spec:
//   15s video → 8-12 shots
//   30s video → 14-20 shots
//   60s video → 24-40 shots
//
// Linear interpolation roughly: 0.5-0.65 shots per second.

export function recommendCoverageShotCount(durationSec: number): { min: number; max: number } {
  const min = Math.max(8, Math.round(durationSec * 0.42))
  const max = Math.max(min + 4, Math.round(durationSec * 0.62))
  return { min, max }
}

// ═════════════════════════════════════════════════════════════════════════
// P6 — PHASE-AWARE CUT DENSITY
// ═════════════════════════════════════════════════════════════════════════

/** Map a 0-1 position in the timeline to its editorial phase. */
export function phaseAtPosition(pos: number, ctaStart = 0.80): EditorialPhase {
  if (pos < 0.08) return 'hook'           // 0-8% — punchy opener
  if (pos >= ctaStart) return 'cta'       // 80-100% — escalation
  if (pos >= 0.70) return 'recovery'      // 70-80% — relief / transition
  // Middle — split into body / education by simple heuristic on duration
  if (pos >= 0.40) return 'education'
  return 'body'
}

/** Target cut duration band per phase (seconds). */
const PHASE_DURATION: Record<EditorialPhase, { min: number; max: number }> = {
  hook:      { min: 1.0, max: 1.4 },   // fast pacing
  body:      { min: 2.0, max: 3.0 },   // breathing room
  education: { min: 2.2, max: 3.2 },   // info-heavy slightly slower
  recovery:  { min: 1.8, max: 2.6 },   // emotional pacing
  cta:       { min: 1.0, max: 1.8 },   // escalating energy
}

/** Pacing density per phase. */
const PHASE_DENSITY: Record<EditorialPhase, EditorialPacingDensity> = {
  hook:      'high',
  body:      'medium',
  education: 'medium',
  recovery:  'medium',
  cta:       'high',
}

/** P6 — Compute cut duration based on phase + energy.
 *  Within the phase's band, higher energy → shorter cut. */
export function computeCutDensity(phase: EditorialPhase, energy: number): number {
  const band = PHASE_DURATION[phase]
  const energyNorm = Math.max(0, Math.min(100, energy)) / 100
  // Higher energy → shorter cut (inverse mapping)
  return band.max - (band.max - band.min) * energyNorm
}

// ═════════════════════════════════════════════════════════════════════════
// P10 — ENERGY CURVE (PER-SECOND)
// ═════════════════════════════════════════════════════════════════════════
//
// HIGH → MEDIUM → HIGH → MAX CTA curve. Sample-able per second so each
// cut can read its energy at its startSec.

export function buildEnergyCurve(durationSec: number): number[] {
  const N = Math.max(1, Math.round(durationSec))
  const points: Array<[number, number]> = [
    [0.00, 92],   // hook spike — first 5s
    [0.08, 88],
    [0.10, 70],
    [0.40, 55],   // body breathing
    [0.65, 78],   // re-engagement spike
    [0.75, 62],   // recovery dip
    [0.80, 92],   // CTA escalation start
    [1.00, 100],  // final CTA peak
  ]
  const curve: number[] = []
  for (let i = 0; i < N; i++) {
    const t = i / Math.max(1, N - 1)
    let lower = points[0]
    let upper = points[points.length - 1]
    for (let p = 0; p < points.length - 1; p++) {
      if (t >= points[p][0] && t <= points[p + 1][0]) {
        lower = points[p]
        upper = points[p + 1]
        break
      }
    }
    const span = upper[0] - lower[0]
    const localT = span === 0 ? 0 : (t - lower[0]) / span
    const e = Math.round(lower[1] + (upper[1] - lower[1]) * localT)
    curve.push(Math.max(0, Math.min(100, e)))
  }
  return curve
}

// ═════════════════════════════════════════════════════════════════════════
// P7 — TRANSITION GRAPH (destination-aware)
// ═════════════════════════════════════════════════════════════════════════

/** Pick a transition between two adjacent cuts based on visualRole + phase. */
function pickTransitionByRole(
  prevRole: VisualRole | null,
  currRole: VisualRole,
  currPhase: EditorialPhase,
): EditorialTransition {
  // Destination-driven priority rules (per spec)
  if (currPhase === 'cta')           return 'flash'        // → CTA = flash impact
  if (currRole === 'hook')           return 'smash_cut'    // → hook = smash
  if (currRole === 'education' || currRole === 'credibility' || currRole === 'ingredient') {
    return 'blur_wipe'                                     // → info = blur wipe
  }
  if (currRole === 'social_proof')   return 'dissolve'     // → social proof = soft
  if (currRole === 'recovery')       return 'dissolve'     // → recovery = soft (catches both source-driven & destination-driven)
  // Source-driven fallback (currRole 'recovery' already handled above)
  if (prevRole === 'pain' && currRole === 'product_reveal') return 'smash_cut'  // pain → reveal
  return 'cut'
}

/** Map an EditorialTransition (visual FX) to an EditorialCutType (editor intent). */
function transitionToCutType(t: EditorialTransition): EditorialCutType {
  switch (t) {
    case 'smash_cut': return 'smash'
    case 'whip':      return 'whip'
    case 'dissolve':  return 'dissolve'
    case 'blur_wipe': return 'match'
    case 'flash':     return 'flash'
    case 'cut':       return 'hard'
  }
}

/** P4 — Assign cutType to each cut based on its transition. */
export function assignCutType(transition: EditorialTransition): EditorialCutType {
  return transitionToCutType(transition)
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN ASSEMBLER — buildTimelineCuts
// ═════════════════════════════════════════════════════════════════════════
//
// Picks coverage shots in narrative order (by masterSceneId then shotId),
// assigns phase-aware durations, transitions, cutType, energy. Anti-repeat
// transition rule enforced inline.

export interface BuildTimelineOptions {
  /** Total target voice duration. */
  voiceDurationSec: number
  /** CTA window start (default 0.80 = final 20%). */
  ctaStart?: number
  /**
   * Z25 MVP COST CAP — hard ceiling on number of timeline cuts.
   * Default 18 (the editorial-spec upper bound for the MVP density:
   * Hook 2-3 · Body 2-3 · Reveal 2-3 · Proof 2 · CTA 1-2 + Recovery 1-2
   * + a couple education beats). Each cut → one Kling clip → ~70 credits.
   * Set to 0 to disable the cap (legacy "Hollywood" mode).
   */
  maxCuts?: number
}

export function buildTimelineCuts(
  coverageShots: CoverageShot[],
  options: BuildTimelineOptions,
): TimelineCut[] {
  const { voiceDurationSec } = options
  const ctaStart = options.ctaStart ?? 0.80
  const maxCuts = options.maxCuts ?? 18
  if (coverageShots.length === 0 || voiceDurationSec <= 0) return []

  const energyCurve = buildEnergyCurve(voiceDurationSec)
  const cuts: TimelineCut[] = []

  // Sort coverage shots: by master scene id, then master first within each set
  const sorted = [...coverageShots].sort((a, b) => {
    if (a.masterSceneId !== b.masterSceneId) return a.masterSceneId - b.masterSceneId
    if (a.shotType === 'master' && b.shotType !== 'master') return -1
    if (b.shotType === 'master' && a.shotType !== 'master') return 1
    return a.shotId - b.shotId
  })

  let cursorSec = 0
  let cutId = 1
  let prevRole: VisualRole | null = null
  let lastTransition: EditorialTransition | null = null

  for (const shot of sorted) {
    if (cursorSec >= voiceDurationSec) break
    // Z25 MVP COST CAP — stop once we've emitted the hard ceiling number
    // of cuts even if there's voice duration / coverage shots remaining.
    if (maxCuts > 0 && cuts.length >= maxCuts) {
      console.log(`[PACING] Z25 maxCuts cap hit (${maxCuts}) — stopping assembler at cut ${cuts.length}`)
      break
    }

    const pos = cursorSec / voiceDurationSec
    const phase = phaseAtPosition(pos, ctaStart)
    const energySample = energyCurve[Math.floor(cursorSec)] ?? 60
    const baseDuration = computeCutDensity(phase, energySample)
    const remaining = voiceDurationSec - cursorSec
    const duration = Math.min(baseDuration, remaining)
    if (duration < 0.3) break

    // Pick transition with anti-repeat enforcement
    let transition = pickTransitionByRole(prevRole, shot.visualRole, phase)
    if (lastTransition && transition === lastTransition) {
      const altPool: EditorialTransition[] = ['cut', 'dissolve', 'whip', 'blur_wipe']
      const alt = altPool.find((a) => a !== transition && a !== lastTransition)
      if (alt) transition = alt
    }
    lastTransition = transition

    const cut: TimelineCut = {
      cutId: cutId++,
      coverageShotId: shot.shotId,
      masterSceneId: shot.masterSceneId,
      startSec: round1(cursorSec),
      endSec: round1(cursorSec + duration),
      durationSec: round1(duration),
      visualRole: shot.visualRole,
      energy: energySample,
      transition,
      cutType: assignCutType(transition),
      phase,
    }
    cuts.push(cut)

    prevRole = shot.visualRole
    cursorSec += duration
  }

  // Enforce pacing — anti-repeat sanity pass on the final array
  return enforcePacing(cuts)
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

// ═════════════════════════════════════════════════════════════════════════
// P6 — ENFORCE PACING (anti-repeat + phase boundary checks)
// ═════════════════════════════════════════════════════════════════════════

export function enforcePacing(cuts: TimelineCut[]): TimelineCut[] {
  if (cuts.length < 2) return cuts
  const out = cuts.map((c) => ({ ...c }))
  const altPool: EditorialTransition[] = ['cut', 'dissolve', 'whip', 'blur_wipe', 'cross_dissolve' as EditorialTransition]

  let consecutiveSame = 1
  for (let i = 1; i < out.length; i++) {
    if (out[i].transition === out[i - 1].transition) {
      consecutiveSame++
      if (consecutiveSame >= 2) {
        // Same transition 2x in a row — swap to alt
        const alt = altPool.find((a) => a !== out[i].transition) ?? 'cut'
        out[i] = { ...out[i], transition: alt, cutType: assignCutType(alt) }
        consecutiveSame = 1
        console.log(`[PACING] cut-${out[i].cutId} swap repeat transition → ${alt}`)
      }
    } else {
      consecutiveSame = 1
    }
  }
  return out
}

// ═════════════════════════════════════════════════════════════════════════
// Diagnostic helpers
// ═════════════════════════════════════════════════════════════════════════

/** Summarize phase densities for the [PACING] log. */
export function summarizePhaseDensities(cuts: TimelineCut[]): Record<EditorialPhase, EditorialPacingDensity> {
  const summary: Record<EditorialPhase, EditorialPacingDensity> = {
    hook: PHASE_DENSITY.hook,
    body: PHASE_DENSITY.body,
    education: PHASE_DENSITY.education,
    recovery: PHASE_DENSITY.recovery,
    cta: PHASE_DENSITY.cta,
  }
  // could compute observed densities from `cuts` here — for now we return
  // the configured constants as the reference values.
  void cuts
  return summary
}
