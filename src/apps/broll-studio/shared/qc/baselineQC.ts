// ── Baseline QC (P9 — engine-agnostic) ──────────────────────────────────────
//
// A lighter QC pass that runs on EVERY engine's output (photographic /
// designed-graphic / ui-native — though ui-native still runs its
// fuller authenticityQC after this baseline).
//
// Only the engine-neutral checks live here:
//   • Blob size sanity (catches empty / corrupt outputs)
//   • JPEG SOI peek (only when caller declares JPEG required)
//   • Optional decoded-dimensions sanity vs expected
//
// Authenticity-specific rules (status bar, banned aesthetics, vision
// rubric) stay in shared/qc/authenticityQC.ts because they only make
// sense for ui-native screenshots.

import type { QCIssue, QCVerdict } from '../../types/qc'
import { runLocalHeuristics, checkDecodedDimensions } from './localHeuristics'

export interface BaselineQCInput {
  blob: Blob
  /** Expected dimensions — if 0 / undefined, skip the decoded check. */
  expectedWidth?: number
  expectedHeight?: number
  /** Whether the engine requires JPEG output (true for ui-native +
   *  designed-graphic, false for photographic which can be PNG). */
  requireJpeg: boolean
}

/**
 * Run baseline QC. Returns a QCVerdict shaped identically to the
 * fuller authenticityQC verdict so callers attach to metadata the
 * same way regardless of which tier they ran.
 *
 * Score policy is minimal: 100 with -25 per error / -8 per warning.
 * passed = no error AND overall >= 70.
 */
export async function runBaselineQC(
  input: BaselineQCInput,
): Promise<QCVerdict> {
  const issues: QCIssue[] = []

  const localIssues = await runLocalHeuristics({
    blob:             input.blob,
    expectedWidth:    input.expectedWidth ?? 0,
    expectedHeight:   input.expectedHeight ?? 0,
    requireJpeg:      input.requireJpeg,
    // No bannedAesthetics here — that's authenticity-tier work
  })
  issues.push(...localIssues)

  if (input.expectedWidth && input.expectedHeight) {
    const dimIssue = await checkDecodedDimensions(
      input.blob, input.expectedWidth, input.expectedHeight,
    )
    if (dimIssue) issues.push(dimIssue)
  }

  let score = 100
  for (const i of issues) {
    if (i.severity === 'error')        score -= 25
    else if (i.severity === 'warning') score -= 8
    else                                score -= 2
  }
  score = Math.max(0, Math.min(100, score))

  const hasError = issues.some((i) => i.severity === 'error')
  const passed = !hasError && score >= 70

  return {
    passed,
    overall: score,
    issues,
    visionPass: null,
    ranAt: Date.now(),
  }
}
