// ── Analytics Panel — internal data-driven tuning view ──────────────────────
// Reads the last N completed/failed/cancelled jobs from masterFrameJobStore
// history and aggregates them into actionable metrics for OPTIMIZATION phase.
//
// Metrics (per spec Task 8):
//   • usable rate (≥75 product, ≥72 face score = usable)
//   • fail reasons (top classification breakdown)
//   • retry average
//   • most failed / most successful preset
//   • average QC scores per axis
//   • best consistency strength (highest usable rate)
//
// Read-only — no mutations except "Clear history".
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react'
import { BarChart3, Trash2, TrendingUp, AlertTriangle, X } from 'lucide-react'
import { useMasterFrameJobStore } from '../stores/masterFrameJobStore'
import type { MasterFrameJob, FailureClassification, QcScore } from '../types'

interface Props {
  open: boolean
  onClose: () => void
}

// ── Aggregations ────────────────────────────────────────────────────────────

interface Aggregates {
  total: number
  completed: number
  failed: number
  cancelled: number
  usableCount: number  // completed jobs with productScore≥75 + faceScore≥72
  usableRate: number  // 0-100
  avgRetries: number
  avgFinalQc: { face: number; product: number; ocr: number; realism: number } | null
  failureBreakdown: Array<{ classification: FailureClassification; count: number }>
  bestStrength: { strength: number; usableRate: number; sampleSize: number } | null
  worstStrength: { strength: number; usableRate: number; sampleSize: number } | null
  byStrength: Array<{ strength: number; total: number; usable: number; rate: number }>
}

function isUsable(qc: QcScore | null | undefined): boolean {
  if (!qc) return false
  return qc.productScore >= 75 && qc.faceScore >= 72
}

function aggregate(history: MasterFrameJob[]): Aggregates {
  const total = history.length
  const completed = history.filter((h) => h.status === 'completed').length
  const failed = history.filter((h) => h.status === 'failed').length
  const cancelled = history.filter((h) => h.status === 'cancelled').length

  const completedJobs = history.filter((h) => h.status === 'completed')
  const usableCount = completedJobs.filter((h) => isUsable(h.finalQc)).length
  const usableRate = total > 0 ? Math.round((usableCount / total) * 100) : 0

  const retryTotals = history.map((h) => h.attempts.length).filter((n) => n > 0)
  const avgRetries = retryTotals.length > 0
    ? Math.round((retryTotals.reduce((a, b) => a + b, 0) / retryTotals.length - 1) * 10) / 10
    : 0  // subtract 1 because first attempt isn't a "retry"

  // Average final QC scores (only from jobs that have finalQc)
  const scoredJobs = completedJobs.filter((h) => h.finalQc)
  const avgFinalQc = scoredJobs.length > 0 ? {
    face: Math.round(scoredJobs.reduce((sum, h) => sum + (h.finalQc?.faceScore ?? 0), 0) / scoredJobs.length),
    product: Math.round(scoredJobs.reduce((sum, h) => sum + (h.finalQc?.productScore ?? 0), 0) / scoredJobs.length),
    ocr: Math.round(scoredJobs.reduce((sum, h) => sum + (h.finalQc?.ocrScore ?? 0), 0) / scoredJobs.length),
    realism: Math.round(scoredJobs.reduce((sum, h) => sum + (h.finalQc?.realismScore ?? 0), 0) / scoredJobs.length),
  } : null

  // Failure breakdown — count by classification (across all attempts, not just final)
  const classCount: Record<string, number> = {}
  for (const job of history) {
    for (const attempt of job.attempts) {
      if (attempt.qc?.classification && attempt.qc.classification !== 'ok') {
        classCount[attempt.qc.classification] = (classCount[attempt.qc.classification] ?? 0) + 1
      }
    }
  }
  const failureBreakdown = Object.entries(classCount)
    .map(([classification, count]) => ({ classification: classification as FailureClassification, count }))
    .sort((a, b) => b.count - a.count)

  // Best / worst consistency strength
  const strengthBuckets: Map<number, { total: number; usable: number }> = new Map()
  for (const job of history) {
    const s = job.inputs.consistencyStrength
    const bucket = strengthBuckets.get(s) ?? { total: 0, usable: 0 }
    bucket.total++
    if (job.status === 'completed' && isUsable(job.finalQc)) bucket.usable++
    strengthBuckets.set(s, bucket)
  }
  const byStrength = Array.from(strengthBuckets.entries())
    .map(([strength, b]) => ({ strength, total: b.total, usable: b.usable, rate: b.total > 0 ? Math.round((b.usable / b.total) * 100) : 0 }))
    .sort((a, b) => a.strength - b.strength)

  // Only consider strengths with at least 3 samples (statistical significance)
  const significantStrengths = byStrength.filter((s) => s.total >= 3)
  const bestStrength = significantStrengths.length > 0
    ? significantStrengths.reduce((best, cur) => (cur.rate > best.rate ? cur : best))
    : null
  const worstStrength = significantStrengths.length > 0
    ? significantStrengths.reduce((worst, cur) => (cur.rate < worst.rate ? cur : worst))
    : null

  return {
    total, completed, failed, cancelled,
    usableCount, usableRate, avgRetries, avgFinalQc, failureBreakdown,
    bestStrength: bestStrength ? { strength: bestStrength.strength, usableRate: bestStrength.rate, sampleSize: bestStrength.total } : null,
    worstStrength: worstStrength ? { strength: worstStrength.strength, usableRate: worstStrength.rate, sampleSize: worstStrength.total } : null,
    byStrength,
  }
}

const CLASSIFICATION_VI: Record<string, string> = {
  'wrong-product': 'Sai sản phẩm',
  'wrong-label': 'Sai nhãn/logo',
  'redesigned-packaging': 'Bao bì bị thiết kế lại',
  'wrong-hijab': 'Sai hijab/tóc',
  'wrong-ethnicity': 'Sai sắc tộc',
  'wrong-age': 'Sai độ tuổi',
  'fake-hands': 'Tay bị méo',
  'studio-look': 'Studio commercial',
  'cinematic-lighting': 'Ánh sáng cinematic',
  'stock-photo-vibe': 'Vibe stock photo',
  'plastic-skin': 'Da AI nhựa',
  'multiple-issues': 'Nhiều vấn đề',
}

// ── UI components ───────────────────────────────────────────────────────────

function Stat({ label, value, sub, color = 'gray' }: { label: string; value: string; sub?: string; color?: 'gray' | 'green' | 'red' | 'amber' | 'violet' }) {
  const colorClass = {
    'gray': 'border-gray-200 bg-white text-gray-900',
    'green': 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'red': 'border-red-200 bg-red-50 text-red-700',
    'amber': 'border-amber-200 bg-amber-50 text-amber-700',
    'violet': 'border-violet-200 bg-violet-50 text-violet-700',
  }[color]
  return (
    <div className={`rounded-lg border px-3 py-2 ${colorClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[10px] opacity-60">{sub}</p>}
    </div>
  )
}

export default function AnalyticsPanel({ open, onClose }: Props) {
  const history = useMasterFrameJobStore((s) => s.history)
  const clearHistory = useMasterFrameJobStore((s) => s.clearHistory)
  const stats = useMemo(() => aggregate(history), [history])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/8 bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3.5 text-white">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <div>
              <h2 className="text-sm font-bold">Analytics — Tuning panel</h2>
              <p className="text-[10px] text-white/60">
                Tổng hợp {history.length} jobs gần đây · data-driven optimization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 hover:bg-white/25"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-gray-400">
              <BarChart3 className="h-10 w-10 opacity-30" />
              <p className="text-sm font-semibold">Chưa có data</p>
              <p className="max-w-sm text-xs">
                Tạo vài Master Frame jobs trong v2 — analytics sẽ tự động tổng hợp ở đây để bạn tune strength + preset.
              </p>
            </div>
          ) : (
            <>
              {/* Top-line metrics */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat
                  label="Usable rate"
                  value={`${stats.usableRate}%`}
                  sub={`${stats.usableCount}/${stats.total} jobs đạt`}
                  color={stats.usableRate >= 70 ? 'green' : stats.usableRate >= 50 ? 'amber' : 'red'}
                />
                <Stat
                  label="Avg retries"
                  value={stats.avgRetries.toFixed(1)}
                  sub="retry/job"
                  color={stats.avgRetries < 1.5 ? 'green' : stats.avgRetries < 2.5 ? 'amber' : 'red'}
                />
                <Stat
                  label="Completed"
                  value={String(stats.completed)}
                  sub={`Fail: ${stats.failed} · Cancel: ${stats.cancelled}`}
                  color="violet"
                />
                <Stat
                  label="Total jobs"
                  value={String(stats.total)}
                  sub="50 gần nhất"
                  color="gray"
                />
              </div>

              {/* Avg QC scores */}
              {stats.avgFinalQc && (
                <div className="rounded-xl border border-black/10 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-gray-600">
                    <TrendingUp className="h-3 w-3" /> Average QC scores (jobs đã completed)
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Face" value={String(stats.avgFinalQc.face)} sub="≥72 để usable" color={stats.avgFinalQc.face >= 72 ? 'green' : 'red'} />
                    <Stat label="Product ⭐" value={String(stats.avgFinalQc.product)} sub="≥88 chuẩn" color={stats.avgFinalQc.product >= 88 ? 'green' : stats.avgFinalQc.product >= 75 ? 'amber' : 'red'} />
                    <Stat label="OCR label" value={String(stats.avgFinalQc.ocr)} sub="≥82" color={stats.avgFinalQc.ocr >= 82 ? 'green' : 'red'} />
                    <Stat label="Realism" value={String(stats.avgFinalQc.realism)} sub="≥75" color={stats.avgFinalQc.realism >= 75 ? 'green' : 'red'} />
                  </div>
                </div>
              )}

              {/* Best / worst strength */}
              {stats.bestStrength && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                  <p className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-violet-700">
                    🎯 Best consistency strength
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat
                      label={`Strength ${stats.bestStrength.strength}`}
                      value={`${stats.bestStrength.usableRate}%`}
                      sub={`n=${stats.bestStrength.sampleSize} usable rate (NHẤT)`}
                      color="green"
                    />
                    {stats.worstStrength && stats.worstStrength.strength !== stats.bestStrength.strength && (
                      <Stat
                        label={`Strength ${stats.worstStrength.strength}`}
                        value={`${stats.worstStrength.usableRate}%`}
                        sub={`n=${stats.worstStrength.sampleSize} usable rate (THẤP)`}
                        color="red"
                      />
                    )}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[10px] font-semibold text-violet-700">Phân bố theo strength ▾</summary>
                    <div className="mt-1 space-y-0.5">
                      {stats.byStrength.map((s) => (
                        <div key={s.strength} className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-gray-600">strength {s.strength}</span>
                          <span className="tabular-nums">
                            <strong className={`${s.rate >= 70 ? 'text-emerald-600' : s.rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{s.rate}%</strong>
                            <span className="ml-1 text-gray-400">({s.usable}/{s.total})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {/* Failure breakdown */}
              {stats.failureBreakdown.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/30 p-3">
                  <p className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-red-700">
                    <AlertTriangle className="h-3 w-3" /> Top failure reasons (across all attempts)
                  </p>
                  <div className="space-y-1">
                    {stats.failureBreakdown.slice(0, 8).map((f) => {
                      const pct = stats.total > 0 ? Math.round((f.count / stats.total) * 100) : 0
                      return (
                        <div key={f.classification} className="flex items-center gap-2 text-[11px]">
                          <span className="w-44 shrink-0 font-medium text-gray-700">
                            {CLASSIFICATION_VI[f.classification] ?? f.classification}
                          </span>
                          <div className="flex-1 overflow-hidden rounded-full bg-white">
                            <div className="h-3 bg-red-400" style={{ width: `${Math.min(pct * 4, 100)}%` }} />
                          </div>
                          <span className="w-12 shrink-0 text-right tabular-nums text-red-700">
                            {f.count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Footer actions */}
              <div className="flex items-center justify-end">
                <button
                  onClick={() => {
                    if (confirm('Xóa toàn bộ analytics history? Hành động này không thể hoàn tác.')) {
                      clearHistory()
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" /> Xóa history
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
