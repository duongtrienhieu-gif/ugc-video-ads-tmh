// ── SceneGenGrid — 9 scene cards with controls ──────────────────────────────
// One card per blueprint. Each card shows:
//   • Generated image (or loader / pending state)
//   • Scene number + label (composition + emotion)
//   • QC badge (pass/warn/fail)
//   • Status text in Vietnamese
//   • Retry count chip
//   • Regenerate / Expand prompt / Approve / Reject buttons
//
// Subscribes to sceneGenJobStore — UI updates reactively as the queue runs.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Loader2, Check, X, RotateCcw, FileText, AlertCircle, Download, Sparkles } from 'lucide-react'
import { useSceneGenJobStore } from '../stores/sceneGenJobStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { QcBadge } from './QcScorePanel'
import { SCENE_STATUS_LABEL_VI } from '../types'
import type { SceneGenItem, SceneGenItemStatus } from '../types'

interface Props {
  onRegenerate: (idx: number) => void
  onApprove: (idx: number) => void
  onReject: (idx: number) => void
  onCancelQueue: () => void
}

// ── Vietnamese status labels by item status (used in stepper banner) ─────────
const STATUS_PILL_COLOR: Record<SceneGenItemStatus, string> = {
  'pending':           'bg-gray-100 text-gray-500',
  'generating':        'bg-violet-100 text-violet-700',
  'auto_validating':   'bg-amber-100 text-amber-700',
  'retrying':          'bg-orange-100 text-orange-700',
  'approved':          'bg-emerald-100 text-emerald-700',
  'rejected':          'bg-pink-100 text-pink-700',
  'failed':            'bg-red-100 text-red-700',
  'cancelled':         'bg-gray-100 text-gray-500',
}

// ── Single scene card ───────────────────────────────────────────────────────

function SceneCard({
  item,
  idx,
  onRegenerate,
  onApprove,
  onReject,
}: {
  item: SceneGenItem
  idx: number
  onRegenerate: (idx: number) => void
  onApprove: (idx: number) => void
  onReject: (idx: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const resolvedUrl = useAssetUrl(item.imageUrl ?? undefined)
  const displayUrl = item.imageUrl?.startsWith('http') ? item.imageUrl : resolvedUrl

  const isLoading = item.status === 'generating' || item.status === 'auto_validating' || item.status === 'retrying'
  const hasImage = !!item.imageUrl

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border-2 transition-all ${
      item.status === 'approved' ? 'border-emerald-300 bg-emerald-50/30' :
      item.status === 'failed' ? 'border-red-200 bg-red-50/20' :
      item.status === 'rejected' ? 'border-pink-200 bg-pink-50/20' :
      'border-black/10 bg-white'
    }`}>
      {/* Image area */}
      <div className="relative aspect-[2/3] w-full bg-gray-900">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-violet-300">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-[10px] font-semibold">{SCENE_STATUS_LABEL_VI[item.status]}</span>
            {item.retryCount > 0 && <span className="text-[9px] opacity-70">Retry #{item.retryCount}</span>}
          </div>
        ) : hasImage && displayUrl ? (
          <img src={displayUrl} alt={`Scene ${item.sceneId}`} className="h-full w-full object-cover" />
        ) : item.status === 'failed' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-red-300">
            <AlertCircle className="h-8 w-8" />
            <span className="text-[10px] line-clamp-3">{item.error ?? 'Lỗi không xác định'}</span>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-500">
            <Sparkles className="h-8 w-8 opacity-40" />
            <span className="text-[10px]">{SCENE_STATUS_LABEL_VI[item.status]}</span>
          </div>
        )}

        {/* Scene number overlay */}
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          Cảnh #{item.sceneId}
        </span>

        {/* QC badge */}
        {item.qc && hasImage && (
          <div className="absolute right-2 top-2">
            <QcBadge qc={item.qc} />
          </div>
        )}

        {/* Approved checkmark */}
        {item.status === 'approved' && (
          <div className="absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
            <Check className="h-4 w-4" />
          </div>
        )}

        {/* Download button (on hover) */}
        {hasImage && displayUrl && (
          <button
            onClick={() => {
              const a = document.createElement('a')
              a.href = displayUrl
              a.download = `scene-${item.sceneId}.png`
              a.click()
            }}
            className="absolute left-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover:opacity-100"
            title="Tải xuống"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Info row */}
      <div className="border-b border-black/8 px-3 py-2">
        <p className="truncate text-xs font-bold text-gray-900">{item.blueprint.sceneGoal}</p>
        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_PILL_COLOR[item.status]}`}>
            {SCENE_STATUS_LABEL_VI[item.status]}
          </span>
          {item.retryCount > 0 && (
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">
              retry {item.retryCount}
            </span>
          )}
          {item.blueprint.ctaFocus && (
            <span className="rounded bg-pink-100 px-1.5 py-0.5 text-[9px] font-bold text-pink-700">CTA</span>
          )}
        </div>
        <p className="mt-1 truncate text-[10px] text-gray-500">
          {item.blueprint.composition} · {item.blueprint.cameraAngle}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 px-2 py-2">
        <button
          onClick={() => onRegenerate(idx)}
          disabled={isLoading}
          title="Tạo lại cảnh này"
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" /> Gen lại
        </button>
        {item.status === 'rejected' && (
          <button
            onClick={() => onApprove(idx)}
            disabled={isLoading || !hasImage}
            title="Duyệt cảnh này dù QC chưa đạt"
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
          >
            <Check className="h-3 w-3" /> Duyệt
          </button>
        )}
        {item.status === 'approved' && (
          <button
            onClick={() => onReject(idx)}
            disabled={isLoading}
            title="Bỏ duyệt — gen lại sau"
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-pink-200 bg-pink-50 px-2 py-1 text-[10px] font-semibold text-pink-700 transition-colors hover:bg-pink-100 disabled:opacity-50"
          >
            <X className="h-3 w-3" /> Bỏ duyệt
          </button>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          disabled={!item.promptUsed}
          title="Xem prompt dùng để gen"
          className="flex items-center justify-center rounded-md border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold text-gray-500 transition-colors hover:bg-black/[0.04] disabled:opacity-40"
        >
          <FileText className="h-3 w-3" />
        </button>
      </div>

      {/* Expanded prompt detail */}
      {expanded && item.promptUsed && (
        <div className="border-t border-black/8 bg-gray-50 px-3 py-2">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">Prompt dùng để gen</p>
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-white px-2 py-1.5 font-mono text-[9px] leading-relaxed text-gray-600">
            {item.promptUsed}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Main grid ───────────────────────────────────────────────────────────────

export default function SceneGenGrid({ onRegenerate, onApprove, onReject, onCancelQueue }: Props) {
  const job = useSceneGenJobStore((s) => s.job)

  if (!job) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-gray-400">
        <Sparkles className="h-10 w-10 opacity-40" />
        <p className="text-sm font-semibold">Chưa có queue gen B-Roll</p>
        <p className="max-w-md text-xs">
          Cần duyệt Master Frame + có storyboard JSON trước. Sau đó SceneGenEngine sẽ tự kích hoạt.
        </p>
      </div>
    )
  }

  const total = job.items.length
  const approved = job.items.filter((it) => it.status === 'approved').length
  const failed = job.items.filter((it) => it.status === 'failed').length
  const inFlight = job.currentIdx >= 0 ? job.currentIdx + 1 : 0
  const isRunning = job.status === 'running'

  const overallPct = Math.round((approved / total) * 100)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Queue header */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50 to-pink-50 px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white shadow-md">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Bước 3: Sinh B-Roll từ Master Frame</h2>
              <p className="text-xs text-gray-500">
                {isRunning && `Đang xử lý cảnh ${inFlight}/${total}... (sequential queue)`}
                {!isRunning && job.status === 'completed' && `✓ Đã xong ${approved}/${total} cảnh${failed > 0 ? ` · ${failed} fail` : ''}`}
                {!isRunning && job.status === 'failed' && `Hoàn tất nhưng có ${failed} cảnh fail — gen lại từng cảnh nếu cần`}
                {!isRunning && job.status === 'cancelled' && `Đã hủy ở cảnh ${inFlight}/${total}`}
                {job.status === 'paused' && `Đã pause`}
              </p>
            </div>
          </div>
          {isRunning && (
            <button
              onClick={onCancelQueue}
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              <X className="h-3 w-3" /> Hủy queue
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] text-gray-500">
          {approved}/{total} duyệt · {failed} fail · low-cost mode: {job.lowCostMode ? 'BẬT (1 lần / cảnh)' : 'TẮT (QC + retry)'}
        </p>
      </div>

      {/* 9-card grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {job.items.map((item, idx) => (
            <SceneCard
              key={item.sceneId}
              item={item}
              idx={idx}
              onRegenerate={onRegenerate}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
