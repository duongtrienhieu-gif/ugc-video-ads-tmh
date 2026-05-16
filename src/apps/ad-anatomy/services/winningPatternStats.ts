// Z6 — Winning Pattern Database stats.
// Aggregates over the user's saved Ad Win Templates (adTemplateStore) to
// produce benchmarks + pattern frequency stats. Pure functions — no I/O.
//
// Future: when a Supabase `winning_templates` table is added, swap the
// input source from localStorage templates to server-aggregated rows so
// stats are computed across the whole user base.

import type {
  AnalysisResult,
  AdAngleType,
  MarketAwareness,
  ScalingPotential,
} from '../types'
import type { AdWinTemplate } from '../../../stores/adTemplateStore'

/** Aggregated stats over a sample of structured analyses. */
export interface WinningPatternStats {
  sampleSize: number                                       // how many templates have structured analysis
  avgScores: Record<string, number>                        // label → avg score across templates
  angleCounts: Record<AdAngleType, number>                 // primary angle frequency
  awarenessCounts: Record<MarketAwareness, number>         // awareness level frequency
  scalingTierCounts: Record<ScalingPotential['tier'], number>
  topHookTechniques: Array<{ technique: string; count: number }>
}

const EMPTY_STATS: WinningPatternStats = {
  sampleSize: 0,
  avgScores: {},
  angleCounts: {} as Record<AdAngleType, number>,
  awarenessCounts: {} as Record<MarketAwareness, number>,
  scalingTierCounts: { HIGH: 0, MEDIUM: 0, LOW: 0 },
  topHookTechniques: [],
}

/** Build aggregated stats from saved templates. */
export function computePatternStats(templates: AdWinTemplate[]): WinningPatternStats {
  const withAnalysis = templates.filter((t): t is AdWinTemplate & { analysis: AnalysisResult } => !!t.analysis)
  if (withAnalysis.length === 0) return EMPTY_STATS

  // Score aggregation
  const scoreSums: Record<string, { sum: number; count: number }> = {}
  for (const t of withAnalysis) {
    for (const s of t.analysis.scorecard?.scores ?? []) {
      const key = s.label
      if (!scoreSums[key]) scoreSums[key] = { sum: 0, count: 0 }
      scoreSums[key].sum += s.score
      scoreSums[key].count += 1
    }
  }
  const avgScores: Record<string, number> = {}
  for (const [k, v] of Object.entries(scoreSums)) {
    avgScores[k] = Math.round((v.sum / v.count) * 10) / 10
  }

  // Angle / awareness / scaling counts
  const angleCounts = {} as Record<AdAngleType, number>
  const awarenessCounts = {} as Record<MarketAwareness, number>
  const scalingTierCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<ScalingPotential['tier'], number>
  const techniqueCounts = new Map<string, number>()

  for (const t of withAnalysis) {
    const a = t.analysis.adAngle?.primary
    if (a) angleCounts[a] = (angleCounts[a] ?? 0) + 1
    const aw = t.analysis.marketAwareness?.level
    if (aw) awarenessCounts[aw] = (awarenessCounts[aw] ?? 0) + 1
    const sc = t.analysis.scalingPotential?.tier
    if (sc) scalingTierCounts[sc] = (scalingTierCounts[sc] ?? 0) + 1
    const tech = t.analysis.hookBreakdown?.technique
    if (tech) {
      const norm = tech.trim().toLowerCase()
      techniqueCounts.set(norm, (techniqueCounts.get(norm) ?? 0) + 1)
    }
  }

  // Top 5 hook techniques
  const topHookTechniques = Array.from(techniqueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([technique, count]) => ({ technique, count }))

  return {
    sampleSize: withAnalysis.length,
    avgScores,
    angleCounts,
    awarenessCounts,
    scalingTierCounts,
    topHookTechniques,
  }
}

/** Compare a single analysis against the saved-template baseline. */
export interface BenchmarkResult {
  /** label → { current, average, delta } — delta positive = above benchmark */
  scoreDeltas: Array<{ label: string; current: number; average: number; delta: number }>
  /** how many saved templates share the same primary angle */
  matchingAngleCount: number
  /** how many share the same hook technique (normalized) */
  matchingHookCount: number
  /** how many share the same awareness level */
  matchingAwarenessCount: number
  /** % of saved templates whose overall score is BELOW this current ad */
  percentileVsSaved: number | null
}

export function computeBenchmark(
  current: AnalysisResult,
  templates: AdWinTemplate[],
): BenchmarkResult | null {
  const stats = computePatternStats(templates)
  if (stats.sampleSize === 0) return null

  const scoreDeltas = (current.scorecard?.scores ?? []).map((s) => {
    const avg = stats.avgScores[s.label] ?? s.score
    return {
      label: s.label,
      current: s.score,
      average: avg,
      delta: Math.round((s.score - avg) * 10) / 10,
    }
  })

  const a = current.adAngle?.primary
  const matchingAngleCount = a ? (stats.angleCounts[a] ?? 0) : 0

  const aw = current.marketAwareness?.level
  const matchingAwarenessCount = aw ? (stats.awarenessCounts[aw] ?? 0) : 0

  const techNorm = current.hookBreakdown?.technique?.trim().toLowerCase() ?? ''
  const matchingHookCount = stats.topHookTechniques.find((h) => h.technique === techNorm)?.count ?? 0

  // Percentile vs saved templates' Overall Execution score
  const currentOverall = current.scorecard?.scores.find((s) => s.label === 'Overall Execution')?.score ?? null
  let percentileVsSaved: number | null = null
  if (currentOverall !== null) {
    const savedOverallScores = templates
      .map((t) => t.analysis?.scorecard?.scores.find((s) => s.label === 'Overall Execution')?.score)
      .filter((s): s is number => typeof s === 'number')
    if (savedOverallScores.length > 0) {
      const below = savedOverallScores.filter((s) => s < currentOverall).length
      percentileVsSaved = Math.round((below / savedOverallScores.length) * 100)
    }
  }

  return {
    scoreDeltas,
    matchingAngleCount,
    matchingHookCount,
    matchingAwarenessCount,
    percentileVsSaved,
  }
}
