// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — SectionReviewActions (P16A)
//
// Per-section marketer review actions: approve / reject / flag drift.
// Pure presentational — calls back into session via parent handlers.
// ─────────────────────────────────────────────────────────────────────

import { ThumbsUp, ThumbsDown, Flag } from 'lucide-react'
import type { SectionReviewState, ReviewFlag } from '../../sessionRuntime'

interface Props {
  review: SectionReviewState
  onApprove?: () => void
  onReject?: () => void
  onToggleFlag?: (flag: ReviewFlag) => void
}

const FLAG_LABEL: Record<ReviewFlag, string> = {
  'realism-drift': 'Realism drift',
  'polish-drift':  'Polish drift',
  'fake-feel':     'Fake feel',
  'off-brand':     'Off-brand',
  'broken-image':  'Broken image',
  'other':         'Khác',
}

const FLAG_KEYS: ReviewFlag[] = [
  'realism-drift',
  'polish-drift',
  'fake-feel',
  'off-brand',
  'broken-image',
]

export function SectionReviewActions({
  review,
  onApprove,
  onReject,
  onToggleFlag,
}: Props) {
  return (
    <div className="mx-2 my-2 rounded border border-stone-200 bg-white px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {onApprove && (
          <button
            onClick={onApprove}
            className={
              review.verdict === 'approved'
                ? 'flex items-center gap-1 rounded-sm bg-emerald-100 border border-emerald-300 px-2 py-1 font-mono text-[10px] text-emerald-800'
                : 'flex items-center gap-1 rounded-sm border border-stone-300 bg-white px-2 py-1 font-mono text-[10px] text-stone-700 hover:bg-emerald-50'
            }
          >
            <ThumbsUp className="h-3 w-3" />
            {review.verdict === 'approved' ? 'Đã duyệt' : 'Duyệt'}
          </button>
        )}
        {onReject && (
          <button
            onClick={onReject}
            className={
              review.verdict === 'rejected'
                ? 'flex items-center gap-1 rounded-sm bg-red-100 border border-red-300 px-2 py-1 font-mono text-[10px] text-red-800'
                : 'flex items-center gap-1 rounded-sm border border-stone-300 bg-white px-2 py-1 font-mono text-[10px] text-stone-700 hover:bg-red-50'
            }
          >
            <ThumbsDown className="h-3 w-3" />
            {review.verdict === 'rejected' ? 'Đã loại' : 'Loại'}
          </button>
        )}
      </div>
      {onToggleFlag && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Flag className="h-3 w-3 text-stone-400" />
          <span className="font-mono text-[9px] uppercase text-stone-400">Flag:</span>
          {FLAG_KEYS.map((f) => (
            <button
              key={f}
              onClick={() => onToggleFlag(f)}
              className={
                review.flags.includes(f)
                  ? 'rounded-sm bg-amber-100 border border-amber-300 px-1.5 py-0.5 font-mono text-[9px] text-amber-800'
                  : 'rounded-sm border border-stone-200 bg-white px-1.5 py-0.5 font-mono text-[9px] text-stone-500 hover:bg-stone-50'
              }
              title={`Toggle ${FLAG_LABEL[f]}`}
            >
              {FLAG_LABEL[f]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
