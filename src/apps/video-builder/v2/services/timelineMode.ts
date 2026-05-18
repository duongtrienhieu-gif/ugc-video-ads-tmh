// ── Timeline Mode ────────────────────────────────────────────────────────────
// Z28 — Explicit duration-mode system. Replaces the previous Z25 "always
// cap at 18 cuts regardless of voice length" behaviour, which was
// compressing 86s voiceovers into 18s intro-montage timelines and skipping
// recovery / social proof / CTA / lifestyle phases entirely.
//
// THE 3 MODES
//
//   SHORT  (15-25s output)  — 4 masters · 8-12 cuts · 1-2s/cut · ~560-840cr
//                              Default for testing + iteration. Cheapest to render.
//
//   MID    (35-50s output)  — 6 masters · 18-24 cuts · 2-3s/cut · ~1260-1680cr
//                              Standard UGC ad length. Most TikTok / Reels content.
//
//   FULL   (60-90s output)  — 8 masters · 30-40 cuts · 1.5-3.5s/cut · ~2100-2800cr
//                              Long-form storytelling — hero + pain + reveal +
//                              social proof + recovery + CTA all get airtime.
//
// AUTO-PICK
//
//   pickTimelineModeFromVoice(voiceDurationSec) bumps the mode based on the
//   voiceover script length so user doesn't have to think about it:
//     ≤ 25s  → SHORT
//     ≤ 50s  → MID
//     >  50s → FULL
//
//   Caller can always override (the mode picker UI in TimelinePlanningView
//   lets users pick manually if they want a SHORT teaser from a long script
//   or a FULL cinematic from a tight script).
//
// DEFAULT MODE
//
//   App defaults to SHORT (per Z28 spec: "DEFAULT APP MODE: SHORT TEST MODE,
//   NOT FULL MODE"). Costs $0.30-0.80 per full render in SHORT vs $1.50-2.00
//   for MID and $3.00+ for FULL. Cheap iteration wins by default.
// ─────────────────────────────────────────────────────────────────────────────

export type TimelineMode = 'SHORT' | 'MID' | 'FULL'

export interface TimelineModeConfig {
  /** Mode key */
  mode: TimelineMode
  /** Vietnamese display label */
  labelVi: string
  /** Short description shown next to the picker chip */
  descriptionVi: string
  /** Target output duration in seconds */
  targetDurationSec: { min: number; max: number }
  /** Number of master scenes to generate */
  masters: number
  /** Number of timeline cuts to produce */
  cuts: { min: number; max: number }
  /** Per-cut duration band (seconds) — used to scale PHASE_DURATION */
  durationBand: { min: number; max: number }
  /** Coverage shots per master (counts the master itself as 1) */
  shotsPerMaster: { min: number; max: number }
  /** Estimated total credit cost for a full render at ~70 credit/clip */
  estimatedCreditCost: { min: number; max: number }
}

export const TIMELINE_MODE_CONFIG: Record<TimelineMode, TimelineModeConfig> = {
  SHORT: {
    mode: 'SHORT',
    // Z29 tightened: 12 cuts → 8 cuts max (~$0.36 per full TEST_480 batch).
    // Spec: "NEW SHORT TEST MODE — 4 masters · 8 coverage shots · 8 timeline
    // cuts · target duration 12-20s. This becomes DEFAULT APP MODE."
    labelVi: 'NGẮN (test)',
    descriptionVi: '12-20s · 4 master · 8 cuts · 1-2s mỗi cut · MẶC ĐỊNH',
    targetDurationSec: { min: 12, max: 20 },
    masters: 4,
    cuts: { min: 6, max: 8 },
    durationBand: { min: 1.0, max: 2.0 },
    shotsPerMaster: { min: 2, max: 2 },
    estimatedCreditCost: { min: 360, max: 560 },  // 8 × 45-70cr (TEST/STD)
  },
  MID: {
    mode: 'MID',
    labelVi: 'TRUNG (chuẩn UGC)',
    descriptionVi: '35-50s · 6 master · 18-24 cuts · 2-3s mỗi cut',
    targetDurationSec: { min: 35, max: 50 },
    masters: 6,
    cuts: { min: 18, max: 24 },
    durationBand: { min: 2.0, max: 3.0 },
    shotsPerMaster: { min: 3, max: 4 },
    estimatedCreditCost: { min: 1260, max: 1680 },
  },
  FULL: {
    mode: 'FULL',
    labelVi: 'DÀI (cinematic)',
    descriptionVi: '60-90s · 8 master · 30-40 cuts · pacing đầy đủ',
    targetDurationSec: { min: 60, max: 90 },
    masters: 8,
    cuts: { min: 30, max: 40 },
    durationBand: { min: 1.5, max: 3.5 },
    shotsPerMaster: { min: 4, max: 5 },
    estimatedCreditCost: { min: 2100, max: 2800 },
  },
}

/** Default mode for new sessions. Spec: "DEFAULT APP MODE: SHORT TEST MODE". */
export const DEFAULT_TIMELINE_MODE: TimelineMode = 'SHORT'

/**
 * Auto-pick a mode based on the voiceover script's estimated duration.
 * Caller can override by passing an explicit mode to buildEditorialBlueprint.
 *
 * Boundaries chosen so a typical 30-word teaser → SHORT, a 90-word standard
 * UGC → MID, and a 200-word advertorial → FULL.
 */
export function pickTimelineModeFromVoice(voiceDurationSec: number): TimelineMode {
  if (voiceDurationSec <= 25) return 'SHORT'
  if (voiceDurationSec <= 50) return 'MID'
  return 'FULL'
}

/** Convenience: get the config for a mode. */
export function getModeConfig(mode: TimelineMode): TimelineModeConfig {
  return TIMELINE_MODE_CONFIG[mode]
}

/** Convenience: ordered list of all modes for picker UIs. */
export const ALL_TIMELINE_MODES: TimelineMode[] = ['SHORT', 'MID', 'FULL']
