// ── Authenticity QC Orchestrator (P7) ───────────────────────────────────────
//
// Top-level QC entry. Composes:
//   1. Local heuristics (always)
//   2. Decoded-dimensions check (always — has its own slot)
//   3. Vision QC (opt-in via QCRunOptions.runVisionQC)
//
// Returns a single QCVerdict. The ui-native dispatcher calls this after
// post-process + before the final saveAsset → metadata embedding.

import type { QCIssue, QCRunOptions, QCVerdict } from '../../types/qc'
import type { UINativeAuthenticity, UINativePlatform } from '../../types/uiNative'
import { runLocalHeuristics, checkDecodedDimensions } from './localHeuristics'
import { runVisionQC } from './visionQC'

export interface AuthenticityQCInput {
  blob: Blob
  /** Expected output dimensions from the module's template. */
  expectedWidth: number
  expectedHeight: number
  /** UI-native authenticity ruleset (modules declare). */
  authenticity: UINativeAuthenticity
  /** Platform — drives vision rubric. */
  platform: UINativePlatform
  /** Optional canvas peek for pre-encode checks (transparency etc). */
  canvasPeek?: HTMLCanvasElement | null
  /** Caller QC opts (runVisionQC, minPassScore, geminiApiKey). */
  options?: QCRunOptions
}

/** Default minimum overall score to mark passed=true. */
const DEFAULT_MIN_PASS_SCORE = 70

/**
 * Score policy:
 *   start from 100, subtract per-issue penalty:
 *     local error    → -25
 *     local warning  → -8
 *     local info     → -2
 *     vision error   → -20
 *     vision warning → -6
 *     vision info    → -1
 *   if vision QC ran, its returned score is averaged with the local-derived score.
 *   passed = no error-severity issues AND overall >= minPassScore.
 */
function scoreIssues(issues: QCIssue[]): number {
  let score = 100
  for (const i of issues) {
    if (i.tier === 'local') {
      if (i.severity === 'error')   score -= 25
      else if (i.severity === 'warning') score -= 8
      else if (i.severity === 'info')    score -= 2
    } else {
      if (i.severity === 'error')   score -= 20
      else if (i.severity === 'warning') score -= 6
      else if (i.severity === 'info')    score -= 1
    }
  }
  return Math.max(0, Math.min(100, score))
}

export async function runAuthenticityQC(
  input: AuthenticityQCInput,
): Promise<QCVerdict> {
  const allIssues: QCIssue[] = []

  // ── Tier 1: local heuristics ───────────────────────────────────────
  const localIssues = await runLocalHeuristics({
    blob:             input.blob,
    expectedWidth:    input.expectedWidth,
    expectedHeight:   input.expectedHeight,
    requireJpeg:      input.authenticity.requireJpegCompression,
    bannedAesthetics: input.authenticity.bannedAesthetics,
    canvasPeek:       input.canvasPeek,
  })
  allIssues.push(...localIssues)

  // ── Tier 1.5: decoded-dimensions check ─────────────────────────────
  const dimIssue = await checkDecodedDimensions(input.blob, input.expectedWidth, input.expectedHeight)
  if (dimIssue) allIssues.push(dimIssue)

  // ── Tier 2: vision QC (opt-in) ─────────────────────────────────────
  let visionPass: boolean | null = null
  let visionScore: number | null = null
  if (input.options?.runVisionQC && input.options.geminiApiKey) {
    const v = await runVisionQC({
      apiKey: input.options.geminiApiKey,
      blob: input.blob,
      platform: input.platform,
      authenticity: input.authenticity,
    })
    visionPass = v.visionPass
    visionScore = v.score
    allIssues.push(...v.issues)
  }

  // ── Compute overall ────────────────────────────────────────────────
  const localScore = scoreIssues(allIssues)
  const overall = visionScore != null
    ? Math.round((localScore + visionScore) / 2)
    : localScore

  const hasError = allIssues.some((i) => i.severity === 'error')
  const minPass = input.options?.minPassScore ?? DEFAULT_MIN_PASS_SCORE
  const passed = !hasError && overall >= minPass
    && (visionPass === null || visionPass === true)

  return {
    passed,
    overall,
    issues: allIssues,
    visionPass,
    ranAt: Date.now(),
  }
}
