// ─────────────────────────────────────────────────────────────────────
// computeSectionCalibration — POST-REBUILD slim
//
// The 9-axis calibration (realism delta, emotional drift, polish vs
// proof, framing variance) is no longer computable — those axes were
// removed when fragment-stacking pipeline was deleted (2026-05-27).
//
// Returns identity metrics. Per-section calibration is now derived
// structurally by imageSceneSynthesis (locked visual genre + anchor
// reference flow).
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { SectionCalibration } from '../types'

export function computeSectionCalibration(
  section: OrchestratedSection,
  _allSections: OrchestratedSection[],
  _pageRealismMode: null = null,
): SectionCalibration {
  return {
    sectionId: section.id,
    realismDelta: 0,
    emotionalDrift: 0,
    proofBelievability: 1,
    framingVariance: 1,
    pacingContribution: 1,
    notes: [],
  }
}
