// ── Cinematic Diagnostics ────────────────────────────────────────────────────
// Z14 — Test + observability layer for the Z11/Z12/Z13 cinematic engine.
//
// Pure analyze function — runs over a fully-processed SceneBlueprint[] (after
// normalize → preset → cinematic assignment → timeline director) and reports:
//
//   • per-scene table data (already on blueprint, just convenience selectors)
//   • cinematic warnings (rules that R1-R9 either skipped or couldn't fix)
//   • aggregate stats (average energy, variance, diversity counts)
//   • energy curve (per-scene values for graph rendering)
//
// NO UI logic in here — pure data. The CinematicDebugPanel component renders
// what this service produces.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SceneBlueprint, SubjectFocus, VisualMotif, CameraGrammar,
  CinematicIntent, SocialMotionPreset, SceneTransition, SceneType,
} from '../types'

// ─── Public output shapes ────────────────────────────────────────────────────

export type DiagnosticLevel = 'error' | 'warning' | 'info'

export interface CinematicDiagnostic {
  level: DiagnosticLevel
  /** Stable code for filtering / grouping in UI (e.g. 'W7_LOW_MOTIF_DIVERSITY'). */
  code: string
  /** Vietnamese message shown to user. */
  message: string
  /** 1-indexed scene IDs the warning applies to (empty if global). */
  scenes: number[]
}

export interface CinematicStats {
  totalScenes: number
  /** Average energyScore across all scenes (0-100). */
  averageEnergy: number
  /** Population stddev of energyScore — low value = flat pacing curve. */
  energyVariance: number
  /** Per-scene energyScore array — drives the curve graph. */
  energyCurve: number[]
  /** Average energy in the final 20% (CTA window) — measures CTA escalation. */
  ctaWindowEnergy: number

  // ── Distribution counters ─────────────────────────────────────────────
  subjectFocusMix: Record<SubjectFocus, number>
  visualMotifMix:  Partial<Record<VisualMotif, number>>
  cameraGrammarMix: Partial<Record<CameraGrammar, number>>
  cinematicIntentMix: Partial<Record<CinematicIntent, number>>
  socialPresetMix:    Partial<Record<SocialMotionPreset, number>>
  transitionMix:      Partial<Record<SceneTransition, number>>
  sceneTypeMix:       Partial<Record<SceneType, number>>

  /** Unique-value counts for the diversity checks. */
  visualMotifUniqueCount: number
  cameraGrammarUniqueCount: number
  transitionUniqueCount: number
  subjectFocusUniqueCount: number

  warnings: CinematicDiagnostic[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stddev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function countBy<K extends string>(values: Array<K | undefined>): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {}
  for (const v of values) {
    if (!v) continue
    out[v] = (out[v] ?? 0) + 1
  }
  return out
}

function countSubjectFocus(values: Array<SubjectFocus | undefined>): Record<SubjectFocus, number> {
  const base: Record<SubjectFocus, number> = {
    person: 0, product: 0, infographic: 0, ingredient: 0, lifestyle: 0,
  }
  for (const v of values) {
    if (v) base[v]++
  }
  return base
}

// ─── Main analyzer ───────────────────────────────────────────────────────────

const HIGH_ENERGY_THRESHOLD = 75
const LOW_VARIANCE_THRESHOLD = 12 // stddev below this = flat pacing
const MIN_MOTIF_UNIQUE = 4

export function analyzeCinematics(blueprints: SceneBlueprint[]): CinematicStats {
  const N = blueprints.length
  const warnings: CinematicDiagnostic[] = []

  // ── Energy stats ─────────────────────────────────────────────────────
  const energyCurve = blueprints.map((b) => b.energyScore ?? 0)
  const averageEnergy = average(energyCurve)
  const energyVariance = stddev(energyCurve)

  const ctaStart = Math.floor(N * 0.8)
  const ctaWindow = energyCurve.slice(ctaStart)
  const ctaWindowEnergy = average(ctaWindow)

  // ── Distributions ────────────────────────────────────────────────────
  const subjectFocusMix = countSubjectFocus(blueprints.map((b) => b.subjectFocus))
  const visualMotifMix     = countBy(blueprints.map((b) => b.visualMotif))
  const cameraGrammarMix   = countBy(blueprints.map((b) => b.cameraGrammar))
  const cinematicIntentMix = countBy(blueprints.map((b) => b.cinematicIntent))
  const socialPresetMix    = countBy(blueprints.map((b) => b.socialPreset))
  const transitionMix      = countBy(blueprints.map((b) => b.transitionOut))
  const sceneTypeMix       = countBy(blueprints.map((b) => b.sceneType))

  const visualMotifUniqueCount   = Object.keys(visualMotifMix).length
  const cameraGrammarUniqueCount = Object.keys(cameraGrammarMix).length
  const transitionUniqueCount    = Object.keys(transitionMix).length
  const subjectFocusUniqueCount  = Object.values(subjectFocusMix).filter((c) => c > 0).length

  // ─────────────────────────────────────────────────────────────────────
  // RULE CHECKS — these run AFTER the timeline director has already
  // mutated. Anything reported here is a residual issue R1-R9 either
  // skipped (e.g. CTA window high-energy is intentional) or couldn't fix.
  // ─────────────────────────────────────────────────────────────────────

  // W1 — 3+ high-energy back-to-back (only flag OUTSIDE CTA window — final
  // escalation is intentional high-energy)
  for (let i = 2; i < N; i++) {
    const inCta = (i - 1) >= ctaStart
    if (inCta) continue
    if (
      (blueprints[i - 2].energyScore ?? 0) >= HIGH_ENERGY_THRESHOLD &&
      (blueprints[i - 1].energyScore ?? 0) >= HIGH_ENERGY_THRESHOLD &&
      (blueprints[i].energyScore     ?? 0) >= HIGH_ENERGY_THRESHOLD
    ) {
      warnings.push({
        level: 'warning',
        code: 'W1_HIGH_ENERGY_RUN',
        message: `3 cảnh năng lượng cao liên tiếp (≥${HIGH_ENERGY_THRESHOLD}) ngoài CTA window — viewer dễ mệt`,
        scenes: [i - 1, i, i + 1],
      })
    }
  }

  // W2 — repeated transition back-to-back
  for (let i = 1; i < N - 1; i++) {
    const prev = blueprints[i - 1].transitionOut
    const cur  = blueprints[i].transitionOut
    if (prev && cur && prev === cur) {
      warnings.push({
        level: 'warning',
        code: 'W2_REPEAT_TRANSITION',
        message: `Transition "${cur}" lặp 2 lần liên tiếp ở scene ${i} → ${i + 1}`,
        scenes: [i, i + 1],
      })
    }
  }

  // W3 — repeated composition back-to-back
  for (let i = 1; i < N; i++) {
    const prev = (blueprints[i - 1].composition ?? '').toLowerCase().trim()
    const cur  = (blueprints[i].composition ?? '').toLowerCase().trim()
    if (prev && cur && prev === cur) {
      warnings.push({
        level: 'warning',
        code: 'W3_REPEAT_COMPOSITION',
        message: `Composition "${cur}" lặp back-to-back ở scene ${i} và ${i + 1}`,
        scenes: [i, i + 1],
      })
    }
  }

  // W4 — repeated cameraGrammar back-to-back (NEW — Z13 doesn't currently
  // enforce this; this is the warning that surfaces it)
  for (let i = 1; i < N; i++) {
    const prev = blueprints[i - 1].cameraGrammar
    const cur  = blueprints[i].cameraGrammar
    if (prev && cur && prev === cur) {
      warnings.push({
        level: 'warning',
        code: 'W4_REPEAT_CAMERA_GRAMMAR',
        message: `Camera grammar "${cur}" lặp back-to-back ở scene ${i} và ${i + 1}`,
        scenes: [i, i + 1],
      })
    }
  }

  // W5 — weak CTA ending
  const lastScene = blueprints[N - 1]
  if (lastScene) {
    const finalEnergy = lastScene.energyScore ?? 0
    const finalIntent = lastScene.cinematicIntent
    const isWeakCta =
      finalEnergy < 85 ||
      (finalIntent !== 'conversion' && finalIntent !== 'urgency') ||
      !lastScene.ctaFocus
    if (isWeakCta) {
      const reasons: string[] = []
      if (finalEnergy < 85) reasons.push(`energy ${finalEnergy} < 85`)
      if (finalIntent !== 'conversion' && finalIntent !== 'urgency') reasons.push(`intent="${finalIntent}" (cần conversion/urgency)`)
      if (!lastScene.ctaFocus) reasons.push('ctaFocus=false')
      warnings.push({
        level: 'error',
        code: 'W5_WEAK_CTA_ENDING',
        message: `Scene cuối thiếu CTA impact: ${reasons.join(' · ')}`,
        scenes: [N],
      })
    }
  }

  // W6 — low pacing variance (flat curve)
  if (energyVariance < LOW_VARIANCE_THRESHOLD && N >= 4) {
    warnings.push({
      level: 'warning',
      code: 'W6_LOW_PACING_VARIANCE',
      message: `Pacing quá phẳng — stddev=${energyVariance.toFixed(1)} < ${LOW_VARIANCE_THRESHOLD}. Viewer mất hứng.`,
      scenes: [],
    })
  }

  // W7 — low motif diversity
  if (visualMotifUniqueCount < MIN_MOTIF_UNIQUE && N >= 6) {
    warnings.push({
      level: 'warning',
      code: 'W7_LOW_MOTIF_DIVERSITY',
      message: `Chỉ ${visualMotifUniqueCount}/${MIN_MOTIF_UNIQUE} motif khác nhau — quá đồng nhất`,
      scenes: [],
    })
  }

  // W8 — low subjectFocus diversity
  if (subjectFocusUniqueCount < 3 && N >= 6) {
    warnings.push({
      level: 'warning',
      code: 'W8_LOW_FOCUS_DIVERSITY',
      message: `Chỉ ${subjectFocusUniqueCount} loại subjectFocus được dùng — slideshow risk cao`,
      scenes: [],
    })
  }

  // W9 — 3+ consecutive person scenes (R1 should fix; if still here, surface it)
  for (let i = 2; i < N; i++) {
    if (
      blueprints[i - 2].subjectFocus === 'person' &&
      blueprints[i - 1].subjectFocus === 'person' &&
      blueprints[i].subjectFocus     === 'person'
    ) {
      warnings.push({
        level: 'warning',
        code: 'W9_PERSON_RUN',
        message: `3 cảnh "person" liên tiếp ở ${i - 1} → ${i + 1} — nên xen kẽ product/infographic`,
        scenes: [i - 1, i, i + 1],
      })
    }
  }

  // W10 — CTA-flagged scene before final 20%
  for (let i = 0; i < ctaStart; i++) {
    if (blueprints[i].ctaFocus || blueprints[i].sceneType === 'cta') {
      warnings.push({
        level: 'warning',
        code: 'W10_EARLY_CTA',
        message: `Scene ${i + 1} có ctaFocus/cta nhưng nằm trước CTA window (cutoff=${ctaStart + 1})`,
        scenes: [i + 1],
      })
    }
  }

  // W11 — CTA window energy too low (R9 should escalate; if still low, surface it)
  if (ctaWindow.length > 0 && ctaWindowEnergy < 80) {
    warnings.push({
      level: 'error',
      code: 'W11_LOW_CTA_WINDOW_ENERGY',
      message: `CTA window energy trung bình ${ctaWindowEnergy.toFixed(0)} < 80 — thiếu BUY NOW momentum`,
      scenes: Array.from({ length: ctaWindow.length }, (_, k) => ctaStart + k + 1),
    })
  }

  // Info — clean run, no warnings
  if (warnings.length === 0) {
    warnings.push({
      level: 'info',
      code: 'I0_CLEAN',
      message: '✓ Tất cả rules đều pass — pipeline cinematic clean.',
      scenes: [],
    })
  }

  return {
    totalScenes: N,
    averageEnergy,
    energyVariance,
    energyCurve,
    ctaWindowEnergy,
    subjectFocusMix,
    visualMotifMix,
    cameraGrammarMix,
    cinematicIntentMix,
    socialPresetMix,
    transitionMix,
    sceneTypeMix,
    visualMotifUniqueCount,
    cameraGrammarUniqueCount,
    transitionUniqueCount,
    subjectFocusUniqueCount,
    warnings,
  }
}

// ─── Export helper for the "Export Test JSON" button ────────────────────────

export interface CinematicExportPayload {
  generatedAt: string
  scriptHash: string  // short hash for matching the export to its source
  totalScenes: number
  stats: CinematicStats
  blueprints: SceneBlueprint[]
}

function shortHash(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h) + input.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h).toString(36).slice(0, 8)
}

/**
 * Build the full debug payload for download. Includes stats + warnings +
 * the fully-processed blueprints so the next phase (renderer) can consume
 * the same shape we're validating here.
 */
export function buildCinematicExport(blueprints: SceneBlueprint[], scriptSource: string): CinematicExportPayload {
  const stats = analyzeCinematics(blueprints)
  return {
    generatedAt: new Date().toISOString(),
    scriptHash: shortHash(scriptSource),
    totalScenes: blueprints.length,
    stats,
    blueprints,
  }
}
