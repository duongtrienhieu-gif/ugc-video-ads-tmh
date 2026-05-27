// ─────────────────────────────────────────────────────────────────────
// Image Semantics — deriveImageIntent (P9 single-section derivation)
//
// VisualSemanticsSection → ImageIntent | undefined.
// undefined when section.imageRole === 'none' (no image).
//
// Pure declarative derivation:
//   1. Start from per-sectionRole baseline profile
//   2. Overlay visualEnergy → emotionalState
//   3. Overlay visualNoiseTolerance → visualNoise
//   4. Overlay emotionalCompression → compositionTension
//   5. Overlay sectionBreathing → polishLevel
//   6. Overlay imageRole → framing/distance/proofFeel
// No AI, no prompts, no branching beyond table lookups.
// ─────────────────────────────────────────────────────────────────────

import type { VisualSemanticsSection } from '../../visualSemantics'
import type { ImageIntent } from '../types'
import { ROLE_PROFILES } from '../config/roleProfiles'
import {
  EMOTION_BY_ENERGY,
  NOISE_BY_TOLERANCE,
  COMPOSITION_BY_COMPRESSION,
  POLISH_BY_BREATHING,
  ROLE_OVERRIDES,
} from '../config/intentMaps'

export function deriveImageIntent(section: VisualSemanticsSection): ImageIntent | undefined {
  if (section.imageRole === 'none') return undefined

  const baseline = ROLE_PROFILES[section.role]
  const roleOverride = ROLE_OVERRIDES[section.imageRole]

  // ── Layer 1: baseline from sectionRole ──────────────────────────
  // ── Layer 2-5: axis-driven overlays ─────────────────────────────
  const emotionalState = EMOTION_BY_ENERGY[section.renderContract.visualEnergy]
  const visualNoise = NOISE_BY_TOLERANCE[section.visualSemantics.visualNoiseTolerance]
  const compositionTension =
    COMPOSITION_BY_COMPRESSION[section.visualSemantics.emotionalCompression]
  const polishLevel = POLISH_BY_BREATHING[section.visualSemantics.sectionBreathing]

  // ── Layer 6: imageRole override (framing/distance/proofFeel) ────
  const framingStyle = roleOverride.framingStyle ?? baseline.framingStyle
  const subjectDistance = roleOverride.subjectDistance ?? baseline.subjectDistance
  const proofFeel = roleOverride.proofFeel ?? baseline.proofFeel

  return {
    realismLevel: baseline.realismLevel,
    framingStyle,
    emotionalState,
    compositionTension,
    polishLevel,
    subjectDistance,
    proofFeel,
    visualNoise,
    lightingMood: baseline.lightingMood,
    imageRole: section.imageRole,
    intentNote: baseline.intentNote,
  }
}
