// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — SessionMetricsPanel (INT observability)
//
// Surfaces P16A session metrics for marketer / dev review:
//   - generation timings (total ms, mean render ms)
//   - retry count + failure count
//   - renderer distribution (gptImage / flux / sdxl)
//   - partial regen count
//   - history snapshot count
//
// Pure presentational. Reads from LandingSession.metrics + history.
// ─────────────────────────────────────────────────────────────────────

import type { LandingSession } from '../../sessionRuntime'

interface Props {
  session: LandingSession
}

export function SessionMetricsPanel({ session }: Props) {
  const m = session.metrics
  const totalSections = Object.keys(session.sections).length
  const completedSections = Object.values(session.sections).filter(
    (s) => s.regenStatus === 'completed',
  ).length
  const failedSections = Object.values(session.sections).filter(
    (s) => s.regenStatus === 'failed',
  ).length
  const approvedSections = Object.values(session.sections).filter(
    (s) => s.review.verdict === 'approved',
  ).length
  const flaggedSections = Object.values(session.sections).filter(
    (s) => s.review.flags.length > 0,
  ).length

  const rendererTotal = Object.values(m.rendererDistribution).reduce((a, b) => a + b, 0)

  return (
    <div className="px-6 py-4 border-t border-stone-200 bg-stone-100 space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wider text-stone-700">
          Session metrics · observability
        </p>
        <span className="font-mono text-[9px] text-stone-500">
          {session.sessionId.slice(0, 16)}…
        </span>
      </div>

      {/* ── Section status ──────────────────────────────────────── */}
      <div>
        <p className="mb-1 font-mono text-[10px] font-medium text-stone-600">Section status</p>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <Stat label="Total" value={totalSections} />
          <Stat label="Completed" value={completedSections} tone={completedSections > 0 ? 'emerald' : 'stone'} />
          <Stat label="Failed" value={failedSections} tone={failedSections > 0 ? 'red' : 'stone'} />
          <Stat label="Retries" value={m.totalRetries} tone={m.totalRetries > 0 ? 'amber' : 'stone'} />
        </div>
      </div>

      {/* ── Review state ────────────────────────────────────────── */}
      <div>
        <p className="mb-1 font-mono text-[10px] font-medium text-stone-600">Review</p>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <Stat label="Approved" value={approvedSections} tone={approvedSections > 0 ? 'emerald' : 'stone'} />
          <Stat label="Flagged" value={flaggedSections} tone={flaggedSections > 0 ? 'amber' : 'stone'} />
          <Stat label="History" value={session.history.length} />
          <Stat label="Regen" value={m.partialRegenCount} />
        </div>
      </div>

      {/* ── Timing ──────────────────────────────────────────────── */}
      <div>
        <p className="mb-1 font-mono text-[10px] font-medium text-stone-600">Timing</p>
        <div className="grid grid-cols-3 gap-1.5">
          <TimeStat label="Total gen" ms={m.totalGenerationMs} />
          <TimeStat label="Mean render" ms={m.meanRenderMs} />
          <Stat label="Render samples" value={m.previewRenderSamples} />
        </div>
      </div>

      {/* ── Renderer distribution ───────────────────────────────── */}
      {rendererTotal > 0 && (
        <div>
          <p className="mb-1 font-mono text-[10px] font-medium text-stone-600">
            Renderer distribution
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(m.rendererDistribution).map(([renderer, count]) => (
              <span
                key={renderer}
                className="rounded-sm bg-stone-200 px-2 py-1 font-mono text-[10px] text-stone-700"
              >
                {renderer}: <span className="font-medium">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Last activity ───────────────────────────────────────── */}
      <p className="font-mono text-[9px] italic text-stone-500">
        Last update: {new Date(session.updatedAt).toLocaleString('vi-VN')}
        {failedSections > 0 && (
          <span className="ml-2 text-red-600">
            · {failedSections} section thất bại — review per-section pill để retry
          </span>
        )}
      </p>
    </div>
  )
}

// ─── presentational helpers ─────────────────────────────────────

function Stat({
  label,
  value,
  tone = 'stone',
}: {
  label: string
  value: number
  tone?: 'stone' | 'emerald' | 'red' | 'amber'
}) {
  const toneClass =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-800' :
    tone === 'red' ? 'bg-red-50 text-red-800' :
    tone === 'amber' ? 'bg-amber-50 text-amber-800' :
    'bg-white border border-stone-200 text-stone-700'
  return (
    <div className={`rounded-sm px-2 py-1.5 ${toneClass}`}>
      <div className="font-mono text-sm font-medium tabular-nums">{value}</div>
      <div className="font-mono text-[9px] uppercase opacity-75">{label}</div>
    </div>
  )
}

function TimeStat({ label, ms }: { label: string; ms: number }) {
  const display = ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
  return (
    <div className="rounded-sm bg-white border border-stone-200 px-2 py-1.5 text-center">
      <div className="font-mono text-sm font-medium tabular-nums text-stone-700">{display}</div>
      <div className="font-mono text-[9px] uppercase text-stone-500">{label}</div>
    </div>
  )
}
