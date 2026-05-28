// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — SectionStatusPill (P16A)
//
// Compact per-section status indicator. Reads SectionRegenStatus from
// session and renders a small chip with appropriate color.
//
// Pure presentational. Action handlers are passed by parent.
// ─────────────────────────────────────────────────────────────────────

import { Loader2, AlertCircle, Check, Clock, RotateCcw } from 'lucide-react'
import type { SectionSessionState } from '../../sessionRuntime'

interface Props {
  state: SectionSessionState
  onRetry?: () => void
}

const STATUS_LABEL: Record<SectionSessionState['regenStatus'], string> = {
  idle: '',
  queued: 'Đang xếp hàng',
  generating: 'Đang tạo',
  completed: 'Đã hoàn thành',
  failed: 'Thất bại',
  rejected: 'Đã từ chối',
}

export function SectionStatusPill({ state, onRetry }: Props) {
  // Idle status without retries is the default — render nothing.
  if (state.regenStatus === 'idle' && state.retryCount === 0) return null

  const tone = toneFor(state.regenStatus)
  const Icon = iconFor(state.regenStatus)

  return (
    <div className="mx-2 mb-2 flex items-center gap-2">
      <span
        className={`flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[10px] ${tone}`}
      >
        <Icon className={iconClass(state.regenStatus)} />
        {STATUS_LABEL[state.regenStatus] || 'Trạng thái'}
        {state.retryCount > 0 && (
          <span className="ml-1 opacity-75">· retry {state.retryCount}</span>
        )}
      </span>
      {state.regenStatus === 'failed' && onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 rounded-sm border border-stone-300 bg-white px-2 py-0.5 font-mono text-[10px] text-stone-700 hover:bg-stone-100"
        >
          <RotateCcw className="h-3 w-3" />
          Thử lại
        </button>
      )}
      {state.regenStatus === 'failed' && state.lastFailureReason && (
        <span className="font-mono text-[9px] italic text-red-600">
          {state.lastFailureReason}
        </span>
      )}
    </div>
  )
}

// ─── helpers ────────────────────────────────────────────────────

function toneFor(s: SectionSessionState['regenStatus']): string {
  switch (s) {
    case 'queued':     return 'bg-stone-200 text-stone-700'
    case 'generating': return 'bg-blue-100 text-blue-800'
    case 'completed':  return 'bg-emerald-100 text-emerald-800'
    case 'failed':     return 'bg-red-100 text-red-800'
    case 'rejected':   return 'bg-amber-100 text-amber-800'
    case 'idle':       return 'bg-stone-100 text-stone-600'
  }
}

function iconFor(s: SectionSessionState['regenStatus']): typeof Loader2 {
  switch (s) {
    case 'queued':     return Clock
    case 'generating': return Loader2
    case 'completed':  return Check
    case 'failed':     return AlertCircle
    case 'rejected':   return AlertCircle
    case 'idle':       return Clock
  }
}

function iconClass(s: SectionSessionState['regenStatus']): string {
  if (s === 'generating') return 'h-3 w-3 animate-spin'
  return 'h-3 w-3'
}
