// ─────────────────────────────────────────────────────────────────────
// paragraphCountDetector — SOFT WARNING (v5.7 Phase C)
//
// Flags sections where paragraphs[].length falls outside the target range
// for the section's pacing class. Surfaces structural rhythm violations
// (e.g. "mixed" pacing class section that came back as 1-paragraph wall).
//
// SOFT only — does NOT trigger retry. Connects existing RhythmProfile
// .paragraphDensity sampling data to actual output for audit visibility.
// If Gemini consistently violates → consider escalating to hard validator
// or strengthening prompt META line.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'
import { paragraphCountTargetFor } from '../config/rhythmEngine'
import { SECTION_PACING_MAP } from '../config/pacingOrchestration'

export function paragraphCountDetector(sections: ParsedSection[]): ValidatorResult {
  const violations: ValidatorViolation[] = []

  for (const s of sections) {
    // Skip trust-continuity — intentionally has 1 paragraph (intro only,
    // reviews live in separate field).
    if (s.id === 'trust-continuity') continue

    const pacingClass = SECTION_PACING_MAP[s.id]
    if (!pacingClass) continue

    const target = paragraphCountTargetFor(pacingClass)
    const actual = s.paragraphs.length

    if (actual < target.min) {
      violations.push({
        sectionId: s.id,
        violation: `paragraphs=${actual} (target ${target.min}-${target.max} for pacing="${pacingClass}") — under-broken, likely wall of text`,
      })
    } else if (actual > target.max) {
      violations.push({
        sectionId: s.id,
        violation: `paragraphs=${actual} (target ${target.min}-${target.max} for pacing="${pacingClass}") — over-fragmented`,
      })
    }
  }

  return { pass: violations.length === 0, violations }
}
