// ── QC Score Panel & Badge ───────────────────────────────────────────────────
// Two exported components:
//   • QcBadge       — compact status pill (🟢 Đạt / 🟡 Tạm ổn / 🔴 ...) for tile overlays
//   • QcScorePanel  — full detail card with 4-axis bars + Vietnamese notes
//                     + retry count + classification + recommendation
// ─────────────────────────────────────────────────────────────────────────────

import type { QcScore, QcThresholds } from '../types'
import { DEFAULT_QC_THRESHOLDS } from '../types'
import { badgeStatus, BADGE_LABEL_VI, type QcBadgeStatus } from '../services/qcEngine'

// ── Compact badge (used on image tiles) ─────────────────────────────────────

interface QcBadgeProps {
  qc: QcScore
  thresholds?: QcThresholds
  className?: string
}

const BADGE_COLOR_CLASS: Record<QcBadgeStatus, string> = {
  'pass':         'bg-emerald-500/95 text-white',
  'warn':         'bg-amber-500/95 text-white',
  'fail-product': 'bg-red-600/95 text-white',
  'fail-face':    'bg-red-600/95 text-white',
  'fail-other':   'bg-red-500/95 text-white',
}

export function QcBadge({ qc, thresholds = DEFAULT_QC_THRESHOLDS, className = '' }: QcBadgeProps) {
  const status = badgeStatus(qc, thresholds)
  const label = BADGE_LABEL_VI[status]
  return (
    <span
      title={qc.notes || qc.recommendation}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm ${BADGE_COLOR_CLASS[status]} ${className}`}
    >
      {label}
    </span>
  )
}

// ── Single score bar ────────────────────────────────────────────────────────

function ScoreBar({ label, score, threshold }: { label: string; score: number; threshold: number }) {
  const passed = score >= threshold
  const barColor = passed ? 'bg-emerald-500' : score >= threshold - 8 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className={`tabular-nums font-bold ${passed ? 'text-emerald-600' : 'text-red-600'}`}>
          {score}<span className="text-gray-400">/100</span>
          <span className="ml-1 text-[9px] text-gray-400">(min {threshold})</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
        {/* Threshold marker */}
        <div className="-mt-1.5 h-1.5 w-0.5 bg-gray-400/60" style={{ marginLeft: `${threshold}%` }} />
      </div>
    </div>
  )
}

// ── Vietnamese classification labels ────────────────────────────────────────

const CLASSIFICATION_VI: Record<QcScore['classification'], string> = {
  'ok': '✓ OK',
  'wrong-product': 'Sai sản phẩm',
  'wrong-label': 'Sai nhãn/logo',
  'redesigned-packaging': 'Bao bì bị thiết kế lại',
  'wrong-hijab': 'Sai hijab/tóc',
  'wrong-ethnicity': 'Sai sắc tộc',
  'wrong-age': 'Sai độ tuổi',
  'fake-hands': 'Tay bị méo / dị tật',
  'studio-look': 'Trông studio commercial',
  'cinematic-lighting': 'Ánh sáng cinematic',
  'stock-photo-vibe': 'Vibe stock photo',
  'plastic-skin': 'Da AI nhựa',
  'multiple-issues': 'Nhiều vấn đề',
}

// ── Full detail panel ───────────────────────────────────────────────────────

interface QcScorePanelProps {
  qc: QcScore
  thresholds?: QcThresholds
  compact?: boolean
}

export function QcScorePanel({ qc, thresholds = DEFAULT_QC_THRESHOLDS, compact = false }: QcScorePanelProps) {
  const status = badgeStatus(qc, thresholds)
  return (
    <div className={`rounded-lg border ${status === 'pass' ? 'border-emerald-200 bg-emerald-50/40' : status === 'warn' ? 'border-amber-200 bg-amber-50/40' : 'border-red-200 bg-red-50/40'} p-3`}>
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between">
        <QcBadge qc={qc} thresholds={thresholds} />
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          {qc.retryCount > 0 && (
            <span className="rounded-md bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-700">
              Retry: {qc.retryCount}
            </span>
          )}
          <span className="font-semibold">{CLASSIFICATION_VI[qc.classification] || qc.classification}</span>
        </div>
      </div>

      {/* Score bars */}
      <div className="space-y-1.5">
        <ScoreBar label="Khuôn mặt" score={qc.faceScore} threshold={thresholds.faceScore} />
        <ScoreBar label="Sản phẩm (ưu tiên cao nhất)" score={qc.productScore} threshold={thresholds.productScore} />
        <ScoreBar label="OCR nhãn/logo" score={qc.ocrScore} threshold={thresholds.ocrScore} />
        <ScoreBar label="Tính chân thực" score={qc.realismScore} threshold={thresholds.realismScore} />
      </div>

      {/* Notes (Vietnamese) */}
      {!compact && qc.notes && (
        <p className="mt-2 rounded bg-white/60 px-2 py-1.5 text-[11px] leading-relaxed text-gray-700">
          💬 {qc.notes}
        </p>
      )}

      {/* Recommendation (English, dev-facing) */}
      {!compact && qc.recommendation && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] font-semibold text-gray-500 hover:text-gray-700">
            Recommendation (dev) ▾
          </summary>
          <p className="mt-1 rounded bg-white/60 px-2 py-1 text-[10px] leading-relaxed text-gray-600">
            {qc.recommendation}
          </p>
        </details>
      )}

      {/* Failure reasons list */}
      {!compact && qc.failureReasons.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] font-semibold text-gray-500 hover:text-gray-700">
            Failure reasons ({qc.failureReasons.length}) ▾
          </summary>
          <ul className="mt-1 space-y-0.5 pl-2 text-[10px] text-gray-600">
            {qc.failureReasons.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        </details>
      )}
    </div>
  )
}
