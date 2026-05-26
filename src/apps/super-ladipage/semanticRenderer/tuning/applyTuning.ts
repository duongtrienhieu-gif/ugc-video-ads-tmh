// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — applyTuning (P8 validation loop)
//
// Pure deterministic page transformer. (page, knobs) → tunedPage.
// Knob = integer in [-2, +2]. 0 = identity. Negative = down-shift,
// positive = up-shift along each axis's existing enum order.
//
// LOCKED: only shifts EXISTING enum values. No paragraph mutation,
// no new derivation, no prompt change. Immutable output.
//
// Tuning is intentionally CLAMPED. Values fall off the enum end stay
// at the boundary (no wrap). Identity knobs return the original page
// reference unchanged (perf shortcut).
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

// ─── shift helper (clamped, no wrap) ──────────────────────────────

function shift<T>(order: readonly T[], current: T, delta: number): T {
  const idx = order.indexOf(current)
  if (idx === -1) return current
  const next = Math.max(0, Math.min(order.length - 1, idx + delta))
  return order[next]
}

// ─── main entry ───────────────────────────────────────────────────

export function applyTuning(
  page: VisualSemanticsPage,
  knobs: TuningKnobs,
): VisualSemanticsPage {
  if (isIdentityKnobs(knobs)) return page

  const tunedSections: VisualSemanticsSection[] = page.sections.map((s, idx) =>
    tuneSection(s, knobs, idx, page.sections.length),
  )

  return {
    ...page,
    sections: tunedSections,
  }
}

function tuneSection(
  s: VisualSemanticsSection,
  knobs: TuningKnobs,
  idx: number,
  total: number,
): VisualSemanticsSection {
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
  // Negative = mute non-hero images. Positive = promote 'none' to mood.
  // Hero section (idx 0) is never muted — identity-lock.
  const newImageRole = applyImageFrequency(
    s.imageRole,
    knobs.imageFrequency,
    idx,
    total,
  )
  const newRecommendedImageCount =
    newImageRole === 'none' ? 0 : Math.max(1, s.renderContract.recommendedImageCount)

  return {
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
  }
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
    // Mute non-hero, non-proof images progressively
    if (isHero) return role
    if (knob === -1) {
      // Mute 'mood-supporting' and 'lifestyle-context' only
      if (role === 'mood-supporting' || role === 'lifestyle-context') return 'none'
      return role
    }
    // knob === -2: mute everything except hero-anchor + proof-callout
    if (role === 'hero-anchor' || role === 'proof-callout') return role
    return 'none'
  }

  // knob > 0: promote 'none' to mood-supporting (except close)
  if (role === 'none' && !isClose) {
    if (knob === 1) {
      // Only promote middle sections
      if (idx > 0 && idx < total - 2) return 'mood-supporting'
      return role
    }
    // knob === 2: promote everything except close
    return 'mood-supporting'
  }
  return role
}
