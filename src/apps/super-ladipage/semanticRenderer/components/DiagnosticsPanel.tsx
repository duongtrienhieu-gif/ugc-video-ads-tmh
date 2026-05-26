// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — DiagnosticsPanel (P8 validation loop)
//
// Renders scrollDiagnostics report. Groups issues by category.
// Severity color: info = stone, warn = amber, critical = red.
//
// UGLY-BUT-CORRECT: utility panel, no polish.
// ─────────────────────────────────────────────────────────────────────

import type { DiagnosticsReport, DiagnosticCategory, DiagnosticSeverity } from '../diagnostics/types'

interface Props {
  report: DiagnosticsReport
}

const CATEGORY_LABELS: Record<DiagnosticCategory, string> = {
  'heavy-clustering': 'Heavy clustering',
  'proof-clustering': 'Proof clustering',
  'visual-monotony': 'Visual monotony',
  'cta-overexposure': 'CTA overexposure',
  'breathing-collapse': 'Breathing collapse',
  'fatigue-spike': 'Fatigue spike',
}

const SEVERITY_BADGE: Record<DiagnosticSeverity, string> = {
  info: 'bg-stone-200 text-stone-700',
  warn: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
}

export function DiagnosticsPanel({ report }: Props) {
  if (report.totalIssues === 0) {
    return (
      <div className="px-6 py-4 border-t border-stone-200 bg-emerald-50">
        <p className="font-mono text-[11px] uppercase tracking-wider text-emerald-700">
          ✓ No scroll diagnostics issues detected
        </p>
        <p className="mt-1 font-mono text-[10px] text-emerald-600">
          Page rhythm passes all 6 aggregate checks (clustering / monotony / overexposure / breathing / fatigue).
        </p>
      </div>
    )
  }

  return (
    <div className="px-6 py-4 border-t border-stone-200 bg-stone-100 space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wider text-stone-700">
          Scroll diagnostics · {report.totalIssues} issue{report.totalIssues > 1 ? 's' : ''}
        </p>
        <div className="flex gap-1.5 font-mono text-[9px]">
          {report.countsBySeverity.critical > 0 && (
            <span className="rounded-sm bg-red-100 px-1.5 py-0.5 text-red-800">
              {report.countsBySeverity.critical} critical
            </span>
          )}
          {report.countsBySeverity.warn > 0 && (
            <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-amber-800">
              {report.countsBySeverity.warn} warn
            </span>
          )}
          {report.countsBySeverity.info > 0 && (
            <span className="rounded-sm bg-stone-200 px-1.5 py-0.5 text-stone-700">
              {report.countsBySeverity.info} info
            </span>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {report.issues.map((issue, i) => (
          <li key={i} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-sm px-1.5 py-0.5 font-mono text-[9px] uppercase ${SEVERITY_BADGE[issue.severity]}`}
              >
                {issue.severity}
              </span>
              <span className="font-mono text-[10px] font-medium text-stone-700">
                {CATEGORY_LABELS[issue.category]}
              </span>
            </div>
            <p className="font-mono text-[10px] leading-snug text-stone-600">
              {issue.message}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
