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

// Color by narrative beat — visible at a glance so user can scan emotional arc
const SCENE_TYPE_STYLE: Record<string, { bg: string; labelVi: string }> = {
  hook:            { bg: 'bg-fuchsia-500/85',  labelVi: 'HOOK' },
  pain:            { bg: 'bg-slate-700/85',    labelVi: 'PAIN' },
  frustration:     { bg: 'bg-red-600/85',      labelVi: 'FRUST' },
  failed_solution: { bg: 'bg-orange-600/85',   labelVi: 'FAIL' },
  discovery:       { bg: 'bg-cyan-500/85',     labelVi: 'DISCO' },
  explanation:     { bg: 'bg-blue-500/85',     labelVi: 'EXPL' },
  recovery:        { bg: 'bg-emerald-500/85',  labelVi: 'RECOV' },
  lifestyle:       { bg: 'bg-teal-500/85',     labelVi: 'LIFE' },
  social_proof:    { bg: 'bg-amber-500/85',    labelVi: 'PROOF' },
  cta:             { bg: 'bg-pink-600/90',     labelVi: 'CTA' },
}

// Solid dot colors — readable at 8px on the compact card bottom strip
const STATUS_DOT_COLOR: Record<SceneGenItemStatus, string> = {
  'pending':           'bg-gray-300',
  'generating':        'bg-violet-500 animate-pulse',
  'auto_validating':   'bg-amber-500 animate-pulse',
  'retrying':          'bg-orange-500 animate-pulse',
  'approved':          'bg-emerald-500',
  'rejected':          'bg-pink-500',
  'failed':            'bg-red-500',
  'cancelled':         'bg-gray-400',
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
    <div className={`group relative flex flex-col overflow-hidden rounded-lg border transition-all ${
      item.status === 'approved' ? 'border-emerald-400 ring-2 ring-emerald-200/60' :
      item.status === 'failed'   ? 'border-red-300' :
      item.status === 'rejected' ? 'border-pink-300' :
      'border-black/10'
    }`}>
      {/* Image area — ~90% of card height, dominates the card */}
      <div className="relative aspect-[2/3] w-full bg-gray-100">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-violet-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="px-1 text-center text-[9px] font-medium leading-tight">
              {SCENE_STATUS_LABEL_VI[item.status]}
              {item.retryCount > 0 && ` #${item.retryCount}`}
            </span>
            {/* mini progress shimmer */}
            <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-black/5">
              <div className="h-full w-1/3 animate-pulse bg-violet-400" />
            </div>
          </div>
        ) : hasImage && displayUrl ? (
          <img src={displayUrl} alt={`Scene ${item.sceneId}`} className="h-full w-full object-cover" />
        ) : item.status === 'failed' ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="line-clamp-2 text-[9px] leading-tight">{item.error ?? 'Lỗi'}</span>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-300">
            <Sparkles className="h-5 w-5 opacity-40" />
            <span className="text-[9px]">{SCENE_STATUS_LABEL_VI[item.status]}</span>
          </div>
        )}

        {/* Scene number — top-left, always visible */}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
          #{item.sceneId}
        </span>

        {/* sceneType beat badge — directly below scene number, color-coded for emotional arc scan */}
        {item.blueprint.sceneType && SCENE_TYPE_STYLE[item.blueprint.sceneType] && (
          <span
            className={`absolute left-1.5 top-7 rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white backdrop-blur-sm ${SCENE_TYPE_STYLE[item.blueprint.sceneType].bg}`}
            title={`${item.blueprint.sceneType}${item.blueprint.narrativePurpose ? ` — ${item.blueprint.narrativePurpose}` : ''}`}
          >
            {SCENE_TYPE_STYLE[item.blueprint.sceneType].labelVi}
          </span>
        )}

        {/* QC badge — top-right when present */}
        {item.qc && hasImage && (
          <div className="absolute right-1.5 top-1.5 scale-90 origin-top-right">
            <QcBadge qc={item.qc} />
          </div>
        )}

        {/* Approved checkmark — bottom-right, always visible */}
        {item.status === 'approved' && (
          <div className="absolute right-1.5 bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
            <Check className="h-3.5 w-3.5" />
          </div>
        )}

        {/* Retry chip — bumped down to row 3 so it doesn't collide with sceneType badge */}
        {item.retryCount > 0 && hasImage && (
          <span className="absolute left-1.5 top-[3.25rem] rounded bg-violet-500/85 px-1.5 py-0.5 text-[8px] font-semibold text-white backdrop-blur-sm">
            retry {item.retryCount}
          </span>
        )}

        {/* CTA chip — bottom-left, always visible when applicable */}
        {item.blueprint.ctaFocus && (
          <span className="absolute left-1.5 bottom-1.5 rounded bg-pink-500/85 px-1.5 py-0.5 text-[8px] font-bold text-white backdrop-blur-sm">
            CTA
          </span>
        )}

        {/* Hover action overlay — appears on hover, fades smoothly */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {/* Quick regenerate */}
          <IconAction
            label="Gen lại"
            color="violet"
            disabled={isLoading}
            onClick={(e) => { e.stopPropagation(); onRegenerate(idx) }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </IconAction>

          {/* Quick approve — only when not yet approved */}
          {hasImage && item.status !== 'approved' && (
            <IconAction
              label="Duyệt"
              color="emerald"
              disabled={isLoading}
              onClick={(e) => { e.stopPropagation(); onApprove(idx) }}
            >
              <Check className="h-3.5 w-3.5" />
            </IconAction>
          )}

          {/* Quick un-approve */}
          {item.status === 'approved' && (
            <IconAction
              label="Bỏ duyệt"
              color="pink"
              disabled={isLoading}
              onClick={(e) => { e.stopPropagation(); onReject(idx) }}
            >
              <X className="h-3.5 w-3.5" />
            </IconAction>
          )}

          {/* Prompt expand */}
          <IconAction
            label="Xem prompt"
            color="black"
            disabled={!item.promptUsed}
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
          >
            <FileText className="h-3.5 w-3.5" />
          </IconAction>

          {/* Download */}
          {hasImage && displayUrl && (
            <IconAction
              label="Tải xuống"
              color="black"
              onClick={(e) => {
                e.stopPropagation()
                const a = document.createElement('a')
                a.href = displayUrl
                a.download = `scene-${item.sceneId}.png`
                a.click()
              }}
            >
              <Download className="h-3.5 w-3.5" />
            </IconAction>
          )}
        </div>
      </div>

      {/* Compact bottom strip — 1 line: status dot + scene goal truncated */}
      <div className="flex items-center gap-1.5 border-t border-black/8 bg-white px-2 py-1.5">
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_COLOR[item.status]}`} title={SCENE_STATUS_LABEL_VI[item.status]} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-gray-800" title={item.blueprint.sceneGoal}>
          {item.blueprint.sceneGoal}
        </span>
      </div>

      {/* Expanded prompt panel — toggled by hover icon */}
      {expanded && item.promptUsed && (
        <div className="border-t border-black/8 bg-gray-50 px-2 py-1.5">
          <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-gray-400">Prompt</p>
          <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded bg-white px-1.5 py-1 font-mono text-[9px] leading-snug text-gray-600">
            {item.promptUsed}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Tiny hover-overlay action button ─────────────────────────────────────
function IconAction({
  label, color, disabled, onClick, children,
}: {
  label: string
  color: 'violet' | 'emerald' | 'pink' | 'black'
  disabled?: boolean
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  const cls =
    color === 'violet'  ? 'bg-violet-500 hover:bg-violet-600' :
    color === 'emerald' ? 'bg-emerald-500 hover:bg-emerald-600' :
    color === 'pink'    ? 'bg-pink-500 hover:bg-pink-600' :
    'bg-black/75 hover:bg-black/90'
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-white shadow-md backdrop-blur-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
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

      {/* Compact 5-col gallery grid (Midjourney-style scan-and-compare layout) */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
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
