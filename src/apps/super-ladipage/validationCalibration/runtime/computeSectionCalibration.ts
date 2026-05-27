// ─────────────────────────────────────────────────────────────────────
// P13 — computeSectionCalibration
//
// Per-section calibration metrics. Pure declarative formulas. No AI.
//
//   realismDelta:       step-distance from page realism mode (0..1)
//   emotionalDrift:     mismatch with sectionRole emotional expectations (0..1)
//   proofBelievability: inverse of polish on proof sections (1 = believable)
//   framingVariance:    1 - sameNeighborFraction (1 = unique vs adjacent)
//   pacingContribution: composite of variance + alignment (0..1)
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { SectionRole } from '../../composer'
import type {
  RealismLevel,
  PolishLevel,
  ImageEmotionalState,
} from '../../imageSemantics'
import type { SectionCalibration } from '../types'

const REALISM_ORDER: RealismLevel[] = [
  'documentary-realism',
  'imperfect-realism',
  'natural-realism',
  'polished-realism',
  'stylized',
]
const POLISH_ORDER: PolishLevel[] = [
  'raw-handheld',
  'low-polish',
  'considered-natural',
  'editorial',
  'high-polish',
]

const ROLE_EXPECTED_EMOTIONS: Record<SectionRole, ImageEmotionalState[]> = {
  'hero-recognition': ['tension', 'unease'],
  'lived-experience': ['unease', 'reflection'],
  'shared-struggle': ['frustration', 'unease'],
  'reframe-moment': ['reflection', 'curiosity'],
  'solution-opening': ['curiosity', 'reflection'],
  'transformation': ['uplift', 'reassurance'],
  'close-invitation': ['silence', 'reassurance'],
}

export function computeSectionCalibration(
  section: OrchestratedSection,
  allSections: OrchestratedSection[],
  pageRealismMode: RealismLevel | null,
): SectionCalibration {
  const notes: string[] = []

  // ── realismDelta — step distance from page mode ─────────────────
  let realismDelta = 0
  if (section.imageIntent && pageRealismMode) {
    const dist = enumDistance(REALISM_ORDER, section.imageIntent.realismLevel, pageRealismMode)
    realismDelta = Math.min(1, dist / 2)  // 2 steps → max drift
    if (dist >= 2) notes.push(`realism deviates ${dist} steps from page mode '${pageRealismMode}'`)
  }

  // ── emotionalDrift — mismatch with role expectation ─────────────
  let emotionalDrift = 0
  if (section.imageIntent) {
    const expected = ROLE_EXPECTED_EMOTIONS[section.role] ?? []
    if (expected.length > 0 && !expected.includes(section.imageIntent.emotionalState)) {
      emotionalDrift = 1
      notes.push(
        `emotionalState='${section.imageIntent.emotionalState}' not in expected ` +
        `(${expected.join('/')})`,
      )
    }
  }

  // ── proofBelievability — inverse polish for proof sections ──────
  let proofBelievability = 1
  if (section.imageIntent && section.imageIntent.proofFeel !== 'none') {
    const polishIdx = POLISH_ORDER.indexOf(section.imageIntent.polishLevel)
    proofBelievability = Math.max(0, 1 - polishIdx * 0.25)
    if (polishIdx >= 3) notes.push(`proof polish too high (idx ${polishIdx})`)
  }

  // ── framingVariance — vs adjacent neighbors ────────────────────
  let framingVariance = 1
  if (section.imageIntent) {
    const idx = allSections.findIndex((s) => s.id === section.id)
    const neighbors: OrchestratedSection[] = []
    if (idx > 0) neighbors.push(allSections[idx - 1])
    if (idx < allSections.length - 1) neighbors.push(allSections[idx + 1])
    const sameFramingCount = neighbors.filter(
      (n) =>
        n.imageIntent &&
        n.imageIntent.framingStyle === section.imageIntent!.framingStyle,
    ).length
    if (neighbors.length > 0) {
      framingVariance = 1 - sameFramingCount / neighbors.length
      if (sameFramingCount === neighbors.length && neighbors.length >= 2) {
        notes.push(`framingStyle matches all neighbors — repetition`)
      }
    }
  }

  // ── pacingContribution — composite alignment + variance ─────────
  const pacingContribution = clamp01(
    0.4 * framingVariance +
    0.3 * (1 - realismDelta) +
    0.3 * (1 - emotionalDrift),
  )

  return {
    sectionId: section.id,
    realismDelta,
    emotionalDrift,
    proofBelievability,
    framingVariance,
    pacingContribution,
    notes,
  }
}

// ─── helpers ──────────────────────────────────────────────────────

function enumDistance<T>(order: readonly T[], a: T, b: T): number {
  const ia = order.indexOf(a)
  const ib = order.indexOf(b)
  if (ia === -1 || ib === -1) return 0
  return Math.abs(ia - ib)
}

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}
