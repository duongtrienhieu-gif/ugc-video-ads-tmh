// ── TimelineRenderGrid ──────────────────────────────────────────────────────
// Z26 — Per-cut render grid with INCREMENTAL controls.
//
// Replaces the old "Render all 50 clips at once" pattern with a
// preview-first workflow:
//
//   1. User lands here with all cuts in 'pending' state — zero KIE spend.
//   2. Click [Render] on 1-3 cuts to preview-test motion / continuity.
//   3. [Lock 🔒] the good ones so they survive any future bulk operation.
//   4. [Render N pending] in the footer to batch the rest.
//   5. [Skip] removes cuts you don't want to render at all.
//
// Card buttons (context-aware label):
//   pending          → [Render]   [Skip]
//   generating       → spinner only (cancel via footer)
//   completed/failed → [Rerender] [Lock 🔒] [Skip]
//   locked           → [Mở khoá] (unlock) — no other actions
//   skipped          → [Bỏ skip]
//
// Footer summary: pending · completed · locked · skipped · failed · running
// + [Render N pending] · [Retry M failed] · [Huỷ] (only while running)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react'
import {
  Loader2, AlertCircle, RotateCcw, Lock, Unlock, SkipForward, Undo2, Play,
  Sparkles, ChevronsRight, X,
} from 'lucide-react'
import {
  useTimelineRenderJobStore,
  countPendingCuts, countFailedCuts, countLockedCuts,
  countCompletedCuts, countSkippedCuts,
} from '../stores/timelineRenderJobStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { TIMELINE_RENDER_STATUS_LABEL_VI } from '../types'
import type { TimelineRenderItem } from '../types'

// ── Motion verb chip colours ───────────────────────────────────────────────
const MOTION_BG: Record<string, string> = {
  zoom_in:    'bg-violet-500/85',
  zoom_out:   'bg-violet-400/85',
  pan_left:   'bg-sky-500/85',
  pan_right:  'bg-sky-500/85',
  tilt_up:    'bg-cyan-500/85',
  tilt_down:  'bg-cyan-500/85',
  dolly_in:   'bg-fuchsia-500/85',
  dolly_out:  'bg-fuchsia-400/85',
  static:     'bg-slate-500/85',
  handheld:   'bg-amber-500/85',
}

const STATUS_DOT: Record<string, string> = {
  pending:    'bg-slate-300',
  queued:     'bg-slate-400 animate-pulse',
  generating: 'bg-violet-500 animate-pulse',
  completed:  'bg-emerald-500',
  locked:     'bg-blue-600',
  skipped:    'bg-gray-400',
  failed:     'bg-red-500',
  cancelled:  'bg-gray-400',
}

interface TimelineRenderGridProps {
  /** Render a single cut (per-card button). */
  onRenderCut: (cutId: number) => void
  /** Bulk-render all pending cuts. */
  onRenderRemaining: () => void
  /** Retry all failed cuts. */
  onRetryFailed: () => void
  /** Cancel the running batch. */
  onCancelRun: () => void
  /** Estimated credit per Kling clip (for cost preview labels). */
  creditPerClip: number
}

export default function TimelineRenderGrid(props: TimelineRenderGridProps) {
  const job = useTimelineRenderJobStore((s) => s.job)
  const lockCut = useTimelineRenderJobStore((s) => s.lockCut)
  const unlockCut = useTimelineRenderJobStore((s) => s.unlockCut)
  const skipCut = useTimelineRenderJobStore((s) => s.skipCut)
  const unskipCut = useTimelineRenderJobStore((s) => s.unskipCut)

  if (!job) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <Sparkles className="h-6 w-6 text-gray-300" />
        <p className="text-sm font-semibold text-gray-500">Chưa có timeline render job</p>
        <p className="max-w-md text-xs text-gray-400">
          Quay lại bước "Coverage &amp; Timeline" để build planning trước, rồi mới sang đây render từng clip.
        </p>
      </div>
    )
  }

  const total      = job.items.length
  const pending    = countPendingCuts(job)
  const completed  = countCompletedCuts(job)  // includes locked
  const locked     = countLockedCuts(job)
  const skipped    = countSkippedCuts(job)
  const failed     = countFailedCuts(job)
  const running    = job.items.filter((i) => i.status === 'generating' || i.status === 'queued').length

  const pendingCost = pending * props.creditPerClip
  const failedCost  = failed  * props.creditPerClip

  return (
    <div className="flex h-full flex-col">
      {/* ── Sticky banner — Z26 preview-first ────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-black/8 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">
              Bước 7: Render từng clip <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">PREVIEW-FIRST</span>
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Render lẻ 1-3 clip để test motion & nhân vật trước. Lock các clip tốt — chúng sẽ <strong>không bị render lại</strong> khi bạn nhấn "Render phần còn lại".
            </p>
          </div>
          {job.isRunning && (
            <button
              onClick={props.onCancelRun}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
            >
              <X className="h-3 w-3" /> Huỷ
            </button>
          )}
        </div>

        {/* KPI strip */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <Chip label="Tổng cuts"   value={total}     dot="bg-slate-300" />
          <Chip label="Chưa render" value={pending}   dot="bg-slate-300" emphasise={pending > 0 && !job.isRunning} />
          <Chip label="Đang chạy"   value={running}   dot="bg-violet-500 animate-pulse" hideIfZero />
          <Chip label="Đã xong"     value={completed} dot="bg-emerald-500" />
          <Chip label="Đã khoá"     value={locked}    dot="bg-blue-600" hideIfZero />
          <Chip label="Đã skip"     value={skipped}   dot="bg-gray-400" hideIfZero />
          <Chip label="Thất bại"    value={failed}    dot="bg-red-500" hideIfZero emphasise={failed > 0} />
        </div>

        {/* Bulk actions */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={props.onRenderRemaining}
            disabled={pending === 0 || job.isRunning}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm transition-colors hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
            {pending === 0 ? 'Đã render hết phần chưa khoá' : `Render ${pending} clip còn lại (~${pendingCost.toLocaleString()} credit)`}
          </button>
          {failed > 0 && (
            <button
              onClick={props.onRetryFailed}
              disabled={job.isRunning}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Thử lại {failed} clip lỗi (~{failedCost.toLocaleString()} credit)
            </button>
          )}
        </div>
      </div>

      {/* ── Card grid (4-col compact on lg, 2 on md) ──────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {job.items.map((item) => (
            <CutCard
              key={item.cutId}
              item={item}
              creditPerClip={props.creditPerClip}
              onRender={() => props.onRenderCut(item.cutId)}
              onLock={() => lockCut(item.cutId)}
              onUnlock={() => unlockCut(item.cutId)}
              onSkip={() => skipCut(item.cutId)}
              onUnskip={() => unskipCut(item.cutId)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Small KPI chip used in banner row ──────────────────────────────────────
function Chip({
  label, value, dot, hideIfZero, emphasise,
}: {
  label: string; value: number; dot: string; hideIfZero?: boolean; emphasise?: boolean
}) {
  if (hideIfZero && value === 0) return null
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
      emphasise ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-700'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <strong className="font-bold">{value}</strong>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
    </span>
  )
}

// ── Per-cut card ───────────────────────────────────────────────────────────
function CutCard({
  item, creditPerClip,
  onRender, onLock, onUnlock, onSkip, onUnskip,
}: {
  item: TimelineRenderItem
  creditPerClip: number
  onRender: () => void
  onLock: () => void
  onUnlock: () => void
  onSkip: () => void
  onUnskip: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const resolvedKeyframe = useAssetUrl(item.parentKeyframeRef ?? undefined)
  const resolvedVideo    = useAssetUrl(item.videoRef ?? undefined)
  const keyframeUrl = item.parentKeyframeRef?.startsWith('http') ? item.parentKeyframeRef : resolvedKeyframe
  const videoUrl    = item.videoRef?.startsWith('http')         ? item.videoRef          : resolvedVideo

  const isLoading = item.status === 'generating' || item.status === 'queued'
  const hasVideo  = !!videoUrl
  const isLocked  = item.status === 'locked'
  const isSkipped = item.status === 'skipped'

  const togglePlay = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {})
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  const borderCls =
    isLocked  ? 'border-blue-400 ring-2 ring-blue-200/60' :
    isSkipped ? 'border-gray-300 opacity-60' :
    item.status === 'completed' ? 'border-emerald-300' :
    item.status === 'failed'    ? 'border-red-300' :
    'border-black/10'

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${borderCls}`}>
      {/* ── Media area (video > keyframe placeholder) ───────────────────── */}
      <div className="relative aspect-[9/16] w-full bg-gray-100">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-violet-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[10px] font-medium">{TIMELINE_RENDER_STATUS_LABEL_VI[item.status]}</span>
          </div>
        ) : hasVideo && videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              className="h-full w-full object-cover"
              playsInline
              muted
              loop
              onClick={togglePlay}
              onEnded={() => setIsPlaying(false)}
            />
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/30 text-white opacity-0 transition-opacity hover:opacity-100"
                title="Play / Pause"
              >
                <Play className="h-8 w-8 fill-white" />
              </button>
            )}
          </>
        ) : item.status === 'failed' ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="line-clamp-3 text-[10px] leading-tight">{item.error ?? 'Render lỗi'}</span>
          </div>
        ) : keyframeUrl ? (
          // No rendered video yet → show the source keyframe as preview
          <img src={keyframeUrl} alt={`Cut ${item.cutId}`} className="h-full w-full object-cover opacity-90" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <Sparkles className="h-5 w-5 opacity-40" />
          </div>
        )}

        {/* Cut id badge — top-left */}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          #{item.cutId}
        </span>

        {/* Motion verb chip — top-right */}
        <span className={`absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm ${MOTION_BG[item.klingMotion] ?? 'bg-slate-500/85'}`}>
          {item.klingMotion.replace('_', ' ')}
        </span>

        {/* Lock badge overlay */}
        {isLocked && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-blue-600/90 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <Lock className="h-3 w-3" /> Đã khoá — an toàn khỏi bulk render
          </div>
        )}
        {isSkipped && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gray-700/85 py-1 text-[10px] font-bold text-white">
            <SkipForward className="h-3 w-3" /> Đã bỏ qua
          </div>
        )}
      </div>

      {/* ── Meta row (status dot + duration + cost) ─────────────────────── */}
      <div className="flex items-center justify-between gap-1.5 border-t border-black/5 px-2.5 py-1.5 text-[10px]">
        <span className="flex items-center gap-1.5 text-gray-600">
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[item.status]}`} />
          {TIMELINE_RENDER_STATUS_LABEL_VI[item.status]}
        </span>
        <span className="text-gray-400">
          {item.durationSec.toFixed(1)}s · ~{creditPerClip}cr
        </span>
      </div>

      {/* ── Action buttons — context-aware ──────────────────────────────── */}
      <div className="flex flex-wrap gap-1 border-t border-black/5 bg-gray-50 px-1.5 py-1.5">
        {isLocked ? (
          <button
            onClick={onUnlock}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-blue-300 bg-white px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
          >
            <Unlock className="h-3 w-3" /> Mở khoá
          </button>
        ) : isSkipped ? (
          <button
            onClick={onUnskip}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-100"
          >
            <Undo2 className="h-3 w-3" /> Bỏ skip
          </button>
        ) : isLoading ? (
          <span className="flex-1 px-2 py-1 text-center text-[10px] italic text-gray-400">đang render...</span>
        ) : (
          <>
            <button
              onClick={onRender}
              title={hasVideo ? 'Render lại (đè videoRef cũ)' : 'Render clip này (test trước khi bulk)'}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-violet-700"
            >
              {hasVideo ? <RotateCcw className="h-3 w-3" /> : <Play className="h-3 w-3 fill-white" />}
              {hasVideo ? 'Render lại' : 'Render'}
            </button>
            {hasVideo && (
              <button
                onClick={onLock}
                title="Khoá clip — không bị render lại khi bulk"
                className="flex items-center justify-center gap-1 rounded-md border border-blue-300 bg-white px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
              >
                <Lock className="h-3 w-3" /> Khoá
              </button>
            )}
            <button
              onClick={onSkip}
              title="Bỏ qua clip — không render trong bulk"
              className="flex items-center justify-center rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-100"
            >
              <SkipForward className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
