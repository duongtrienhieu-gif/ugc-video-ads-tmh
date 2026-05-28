// ─────────────────────────────────────────────────────────────────────
// Visual Semantics — deriveVisualSemantics (P6 per section)
//
// RenderContractedSection → VisualSemantics. 8-axis derivation with
// override logic where layout/pattern combinations need adjustment.
//
// Pure function. Renderer-agnostic.
// ─────────────────────────────────────────────────────────────────────

import type { RenderContractedSection } from '../../renderContract'
import type { VisualSemantics } from '../types'
import {
  HIERARCHY_BY_DOMINANCE,
  hierarchyOverrideForPattern,
  EYEFLOW_BY_LAYOUT,
  eyeFlowOverrideForPattern,
  TEMPO_BY_PATTERN,
  BREATHING_BY_SPACING,
  COMPRESSION_BY_ENERGY,
  NOISE_BY_PATTERN,
  PROOF_WEIGHT_BY_PRESENTATION,
  CTA_AGGRESSION_BY_PLACEMENT,
  PSYCHOLOGY_NOTE_BY_PATTERN,
} from '../config/semanticMaps'

/** Derive visual semantics for a section. */
export function deriveVisualSemantics(section: RenderContractedSection): VisualSemantics {
  const rc = section.renderContract

  // ── 1. VisualHierarchy ─────────────────────────────────────────
  const hierarchyOverride = hierarchyOverrideForPattern(rc.mobilePattern)
  const visualHierarchy = hierarchyOverride ?? HIERARCHY_BY_DOMINANCE[rc.typographyDominance]

  // ── 2. EyeFlow ────────────────────────────────────────────────
  const eyeFlowOverride = eyeFlowOverrideForPattern(rc.mobilePattern, rc.layoutType)
  const eyeFlow = eyeFlowOverride ?? EYEFLOW_BY_LAYOUT[rc.layoutType]

  // ── 3. ReadingTempo ───────────────────────────────────────────
  const readingTempo = TEMPO_BY_PATTERN[rc.mobilePattern]

  // ── 4. SectionBreathing ───────────────────────────────────────
  const sectionBreathing = BREATHING_BY_SPACING[rc.spacingPreset]

  // ── 5. EmotionalCompression ──────────────────────────────────
  const emotionalCompression = COMPRESSION_BY_ENERGY[rc.visualEnergy]

  // ── 6. VisualNoiseTolerance ──────────────────────────────────
  const visualNoiseTolerance = NOISE_BY_PATTERN[rc.mobilePattern]

  // ── 7. ProofWeight ───────────────────────────────────────────
  const proofWeight = PROOF_WEIGHT_BY_PRESENTATION[rc.proofPresentation]

  // ── 8. CtaAggression ─────────────────────────────────────────
  const ctaAggression = CTA_AGGRESSION_BY_PLACEMENT[rc.ctaPlacement]

  return {
    visualHierarchy,
    eyeFlow,
    readingTempo,
    sectionBreathing,
    emotionalCompression,
    visualNoiseTolerance,
    proofWeight,
    ctaAggression,
    psychologyNote: PSYCHOLOGY_NOTE_BY_PATTERN[rc.mobilePattern],
  }
}
