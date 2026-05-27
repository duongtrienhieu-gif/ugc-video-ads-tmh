// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — applyTuning (P8 + P14)
//
// Pure deterministic page transformer. (page, knobs) → tunedPage.
// Knob = integer in [-2, +2]. 0 = identity. Negative = down-shift,
// positive = up-shift along each axis's existing enum order.
//
// P8: density / breathing / proofVisibility / ctaAggression / imageFrequency
// P14: + realismLevel / polishLevel (shift imageIntent fields when present)
//
// Generic over input page type — preserves subtype on output, so callers
// passing OrchestratedPage / ExportablePage get the same shape back.
//
// LOCKED: only shifts EXISTING enum values. No paragraph mutation,
// no new derivation, no prompt change. Immutable output.
// ─────────────────────────────────────────────────────────────────────

import type {
  VisualSemanticsPage,
  VisualSemanticsSection,
} from '../types'
import type {
  SectionBreathing,
  ProofWeight,
  CtaAggression,
} from '../../visualSemantics'
import type {
  SectionDensity,
  ImageRole,
} from '../../composer'
import type {
  TextChunking,
  ProofPresentation,
  CtaPlacement,
  SpacingPreset,
} from '../../renderContract'
import type { ImageIntent } from '../../imageSemantics'
import { isIdentityKnobs, type TuningKnobs } from './types'

// ─── ordered enum tables (low → high on each axis) ────────────────

const DENSITY_ORDER: SectionDensity[] = ['airy', 'medium', 'tight', 'fragmented']
const CHUNKING_ORDER: TextChunking[] = [
  'long-flowing',
  'medium-paragraph',
  'small-paragraph',
  'fragmented-lines',
]
const BREATHING_ORDER: SectionBreathing[] = ['cramped', 'comfortable', 'generous', 'vast']
const SPACING_ORDER: SpacingPreset[] = ['snug', 'comfortable', 'airy', 'expansive']
const PROOF_WEIGHT_ORDER: ProofWeight[] = ['invisible', 'whisper', 'standard', 'spotlight']
const PROOF_PRESENTATION_ORDER: ProofPresentation[] = [
  'none',
  'subtle-attribution',
  'inline-quote-callout',
  'bordered-block',
]
const CTA_AGGRESSION_ORDER: CtaAggression[] = [
  'hidden',
  'inline-gentle',
  'clear',
  'urgent-foot',
]
const CTA_PLACEMENT_ORDER: CtaPlacement[] = [
  'none',
  'inline-soft',
  'footer-emphasis',
  'sticky-low-friction',
]
// REALISM_ORDER / POLISH_ORDER removed POST-REBUILD (2026-05-27) —
// the 9-axis imageIntent system was deleted. Tuning knobs for visual
// realism/polish are no-ops now; per-image visual genre is locked via
// imageSceneSynthesis system instruction.

// ─── shift helper (clamped, no wrap) ──────────────────────────────

function shift<T>(order: readonly T[], current: T, delta: number): T {
  const idx = order.indexOf(current)
  if (idx === -1) return current
  const next = Math.max(0, Math.min(order.length - 1, idx + delta))
  return order[next]
}

// ─── main entry (generic — preserves subtype) ──────────────────────

export function applyTuning<P extends VisualSemanticsPage>(
  page: P,
  knobs: TuningKnobs,
): P {
  if (isIdentityKnobs(knobs)) return page

  const tunedSections = page.sections.map((s, idx) =>
    tuneSection(s as VisualSemanticsSection & { imageIntent?: ImageIntent }, knobs, idx, page.sections.length),
  )

  return {
    ...page,
    sections: tunedSections,
  } as P
}

function tuneSection(
  s: VisualSemanticsSection & { imageIntent?: ImageIntent },
  knobs: TuningKnobs,
  idx: number,
  total: number,
): VisualSemanticsSection & { imageIntent?: ImageIntent } {
  // ── density knob → SectionDensity + TextChunking ─────────────────
  const newDensity =
    knobs.density !== 0 ? shift(DENSITY_ORDER, s.density, knobs.density) : s.density
  const newChunking =
    knobs.density !== 0
      ? shift(CHUNKING_ORDER, s.renderContract.textChunking, knobs.density)
      : s.renderContract.textChunking

  // ── breathing knob → SectionBreathing + SpacingPreset ───────────
  const newBreathing =
    knobs.breathing !== 0
      ? shift(BREATHING_ORDER, s.visualSemantics.sectionBreathing, knobs.breathing)
      : s.visualSemantics.sectionBreathing
  const newSpacing =
    knobs.breathing !== 0
      ? shift(SPACING_ORDER, s.renderContract.spacingPreset, knobs.breathing)
      : s.renderContract.spacingPreset

  // ── proofVisibility knob → ProofWeight + ProofPresentation ──────
  const newProofWeight =
    knobs.proofVisibility !== 0
      ? shift(PROOF_WEIGHT_ORDER, s.visualSemantics.proofWeight, knobs.proofVisibility)
      : s.visualSemantics.proofWeight
  const newProofPresentation =
    knobs.proofVisibility !== 0
      ? shift(
          PROOF_PRESENTATION_ORDER,
          s.renderContract.proofPresentation,
          knobs.proofVisibility,
        )
      : s.renderContract.proofPresentation

  // ── ctaAggression knob → CtaAggression + CtaPlacement ───────────
  const newCtaAggression =
    knobs.ctaAggression !== 0
      ? shift(CTA_AGGRESSION_ORDER, s.visualSemantics.ctaAggression, knobs.ctaAggression)
      : s.visualSemantics.ctaAggression
  const newCtaPlacement =
    knobs.ctaAggression !== 0
      ? shift(CTA_PLACEMENT_ORDER, s.renderContract.ctaPlacement, knobs.ctaAggression)
      : s.renderContract.ctaPlacement

  // ── imageFrequency knob → ImageRole muting / promotion ──────────
  const newImageRole = applyImageFrequency(
    s.imageRole,
    knobs.imageFrequency,
    idx,
    total,
  )
  const newRecommendedImageCount =
    newImageRole === 'none' ? 0 : Math.max(1, s.renderContract.recommendedImageCount)

  // POST-REBUILD: realismLevel/polishLevel knobs no-op'd — visual genre
  // is locked via imageSceneSynthesis system instruction. imageIntent now
  // only carries imageRole through the pipeline.
  const newImageIntent: ImageIntent | undefined = s.imageIntent

  const tuned = {
    ...s,
    density: newDensity,
    imageRole: newImageRole,
    visualSemantics: {
      ...s.visualSemantics,
      sectionBreathing: newBreathing,
      proofWeight: newProofWeight,
      ctaAggression: newCtaAggression,
    },
    renderContract: {
      ...s.renderContract,
      textChunking: newChunking,
      spacingPreset: newSpacing,
      proofPresentation: newProofPresentation,
      ctaPlacement: newCtaPlacement,
      recommendedImageCount: newRecommendedImageCount,
    },
  } as VisualSemanticsSection & { imageIntent?: ImageIntent }

  if (newImageIntent) {
    tuned.imageIntent = newImageIntent
  }
  return tuned
}

function applyImageFrequency(
  role: ImageRole,
  knob: number,
  idx: number,
  total: number,
): ImageRole {
  if (knob === 0) return role
  const isHero = idx === 0
  const isClose = idx === total - 1

  if (knob < 0) {
    if (isHero) return role
    if (knob === -1) {
      if (role === 'mood-supporting' || role === 'lifestyle-context') return 'none'
      return role
    }
    if (role === 'hero-anchor' || role === 'proof-callout') return role
    return 'none'
  }

  if (role === 'none' && !isClose) {
    if (knob === 1) {
      if (idx > 0 && idx < total - 2) return 'mood-supporting'
      return role
    }
    return 'mood-supporting'
  }
  return role
}
