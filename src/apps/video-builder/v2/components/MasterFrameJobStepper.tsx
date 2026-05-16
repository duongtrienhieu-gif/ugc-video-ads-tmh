// ── Master Frame Job Stepper ─────────────────────────────────────────────────
// Replaces the old blocking-loader UI. Shows a live stepper with phase indicators
// + Vietnamese status text + elapsed time + cancel button + structured failure
// info. Subscribes to the masterFrameJobStore — UI updates reactively as the
// pipeline progresses through phases.
//
// Stepper visual:
//   [✓] Xếp hàng
//   [✓] Phân tích avatar + sản phẩm
//   [●] Đang tạo ảnh (45s)
//   [ ] Kiểm tra QC
//   [ ] Hoàn thành
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { Check, Loader2, AlertCircle, RotateCcw, X } from 'lucide-react'
import { useMasterFrameJobStore } from '../stores/masterFrameJobStore'
import { cancelMasterFrameJob, clearMasterFrameJob } from '../services/masterFrameJobRunner'
import { QcScorePanel } from './QcScorePanel'
import type { MasterFrameJobStatus } from '../types'

// Phase grouping for the stepper visual (collapses retry_1/2/3 into one bucket)
type PhaseId = 'queue' | 'identity' | 'gen' | 'qc' | 'done'

const PHASES_FULL: { id: PhaseId; labelVi: string; mapsFrom: MasterFrameJobStatus[] }[] = [
  { id: 'queue',    labelVi: 'Chuẩn bị',              mapsFrom: ['queued'] },
  { id: 'identity', labelVi: 'Phân tích avatar + SP', mapsFrom: ['extracting_identity'] },
  { id: 'gen',      labelVi: 'Tạo ảnh',               mapsFrom: ['generating', 'retrying_1', 'retrying_2', 'retrying_3'] },
  { id: 'qc',       labelVi: 'Kiểm tra chất lượng',   mapsFrom: ['auto_validating'] },
  { id: 'done',     labelVi: 'Xong',                  mapsFrom: ['completed'] },
]

// Speed-first variant: hide the QC step when the user didn't enable it
const PHASES_FAST: typeof PHASES_FULL = PHASES_FULL.filter((p) => p.id !== 'qc')

function getPhaseState(currentStatus: MasterFrameJobStatus, phaseId: PhaseId): 'done' | 'active' | 'pending' {
  if (currentStatus === 'failed' || currentStatus === 'cancelled') {
    // Mark up to the last reached phase as done, then leave the rest pending
    const phaseOrder: PhaseId[] = ['queue', 'identity', 'gen', 'qc', 'done']
    return phaseOrder.indexOf(phaseId) === 0 ? 'done' : 'pending'
  }
  const order: PhaseId[] = ['queue', 'identity', 'gen', 'qc', 'done']
  // Find which phase the currentStatus maps to
  const activePhase = PHASES_FULL.find((p) => (p.mapsFrom as string[]).includes(currentStatus))?.id ?? 'queue'
  const activeIdx = order.indexOf(activePhase)
  const thisIdx = order.indexOf(phaseId)
  if (thisIdx < activeIdx) return 'done'
  if (thisIdx === activeIdx) return currentStatus === 'completed' ? 'done' : 'active'
  return 'pending'
}

interface Props {
  /** Called when the job hits 'completed' — parent may want to push the result into bank/state. */
  onCompleted?: () => void
}

export default function MasterFrameJobStepper({ onCompleted }: Props) {
  const job = useMasterFrameJobStore((s) => s.job)
  const tickElapsed = useMasterFrameJobStore((s) => s.tickElapsed)

  // Tick the elapsed counter while job is running
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return
    const id = setInterval(() => {
      tickElapsed(Math.round((Date.now() - job.createdAt) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [job, tickElapsed])

  // Notify parent on completion
  useEffect(() => {
    if (job?.status === 'completed' && onCompleted) onCompleted()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status])

  if (!job) return null

  const isRunning = job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled'
  const elapsed = job.elapsedSec
  // Speed-first thresholds: 60s = soft warning, 90s = strong warning
  const elapsedWarn = elapsed > 90 ? 'text-red-600' : elapsed > 60 ? 'text-amber-600' : 'text-gray-500'

  // If QC was never run on any attempt, use the fast variant (hide QC step)
  const qcEverRan = job.attempts.some((a) => a.qc !== undefined && a.qc !== null)
  const phases = qcEverRan ? PHASES_FULL : PHASES_FAST

  return (
    <div className="space-y-3">
      {/* Status banner */}
      <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        job.status === 'failed' ? 'border-red-200 bg-red-50' :
        job.status === 'cancelled' ? 'border-gray-200 bg-gray-50' :
        job.status === 'completed' ? 'border-emerald-200 bg-emerald-50' :
        'border-violet-200 bg-violet-50'
      }`}>
        <div className="flex items-center gap-3">
          {isRunning ? (
            <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          ) : job.status === 'completed' ? (
            <Check className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <div>
            <p className="text-sm font-bold text-gray-900">{job.statusVi}</p>
            <p className="text-[10px] text-gray-500">Job ID: {job.jobId.slice(0, 16)}...</p>
          </div>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2">
            <span className={`tabular-nums text-xs font-bold ${elapsedWarn}`}>{elapsed}s</span>
            <button
              onClick={cancelMasterFrameJob}
              className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
            >
              <X className="h-3 w-3" /> Hủy
            </button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full transition-all duration-500 ${
            job.status === 'failed' ? 'bg-red-500' :
            job.status === 'completed' ? 'bg-emerald-500' :
            'bg-gradient-to-r from-violet-500 to-purple-500'
          }`}
          style={{ width: `${job.progress}%` }}
        />
      </div>

      {/* Phase stepper — simplified, hides QC step when QC off */}
      <div className="space-y-1.5">
        {phases.map((phase, idx) => {
          const phaseState = getPhaseState(job.status, phase.id)
          return (
            <div key={phase.id} className="flex items-center gap-3">
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                phaseState === 'done' ? 'bg-emerald-500 text-white' :
                phaseState === 'active' ? 'bg-violet-600 text-white ring-2 ring-violet-200' :
                'bg-gray-200 text-gray-400'
              }`}>
                {phaseState === 'done' ? <Check className="h-3 w-3" /> :
                 phaseState === 'active' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                 <span className="text-[9px] font-bold tabular-nums">{idx + 1}</span>}
              </div>
              <span className={`text-xs ${
                phaseState === 'done' ? 'text-emerald-700 font-medium' :
                phaseState === 'active' ? 'text-violet-700 font-bold' :
                'text-gray-400'
              }`}>
                {phase.labelVi}
              </span>
            </div>
          )
        })}
      </div>

      {/* Slow-server warning (60s+) — speed-first threshold */}
      {isRunning && elapsed > 60 && elapsed <= 90 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-700">
          ⏳ Server AI đang chậm hơn bình thường ({elapsed}s) — vui lòng đợi thêm chút hoặc bấm Hủy + thử lại.
        </div>
      )}

      {/* Stuck warning (90s+) */}
      {isRunning && elapsed > 90 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          ⚠ Task đã chạy {elapsed}s — server AI có vẻ bị stuck. Bấm "Hủy" để abort + thử lại ngay.
        </div>
      )}

      {/* Failure detail */}
      {job.status === 'failed' && job.failure && (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-[11px] font-bold text-red-700">
            Loại lỗi: {job.failure.failureType}
          </p>
          <p className="text-[11px] text-red-700">{job.failure.message}</p>
          {job.failure.retryHistory.length > 0 && (
            <details className="text-[10px] text-red-600">
              <summary className="cursor-pointer font-semibold">Lịch sử {job.failure.retryHistory.length} attempt ▾</summary>
              <ul className="mt-1 space-y-0.5 pl-2">
                {job.failure.retryHistory.map((h, i) => (
                  <li key={i}>
                    Lần {h.attemptIdx + 1}: {h.classification ?? 'không có QC'} {h.failureReasons ? `— ${h.failureReasons.join(', ')}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            onClick={clearMasterFrameJob}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
          >
            <RotateCcw className="h-3 w-3" /> Bỏ qua + thử lại
          </button>
        </div>
      )}

      {/* Final QC panel on completed */}
      {job.status === 'completed' && job.finalQc && (
        <QcScorePanel qc={job.finalQc} />
      )}
    </div>
  )
}
