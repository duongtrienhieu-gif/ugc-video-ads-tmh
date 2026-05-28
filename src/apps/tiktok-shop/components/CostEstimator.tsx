// CostEstimator — confirmation modal before generation.
// Shows cost in credits + current balance + scope explainer.
// Phase 3 always scopes to Slot 1 only (the other 8 land in Phase 4).

import { X, Sparkles, AlertCircle, Info } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  estimatedCredits: number
  currentBalance: number | null
  scope: 'slot-1' | 'all-slots' | 'reroll'
  busy?: boolean
}

const SCOPE_LABELS: Record<Props['scope'], { title: string; subtitle: string }> = {
  'slot-1':    { title: 'Tạo Slot 1 (Hero Hook)', subtitle: 'Phase 3 — test pipeline end-to-end với 1 slot trước.' },
  'all-slots': { title: 'Tạo 9 ảnh listing',       subtitle: 'Bao gồm toàn bộ 9 conversion slots.' },
  'reroll':    { title: 'Tạo lại ảnh',             subtitle: 'Re-generate slot này với prompt hiện tại.' },
}

export default function CostEstimator({
  open,
  onClose,
  onConfirm,
  estimatedCredits,
  currentBalance,
  scope,
  busy,
}: Props) {
  if (!open) return null

  const meta = SCOPE_LABELS[scope]
  const insufficient = currentBalance !== null && currentBalance < estimatedCredits
  const after = currentBalance !== null ? currentBalance - estimatedCredits : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <h3 className="text-sm font-semibold text-gray-900">{meta.title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 p-5">
          <p className="text-xs text-gray-600">{meta.subtitle}</p>

          {/* Cost breakdown */}
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-indigo-700">Chi phí ước tính</span>
              <span className="text-2xl font-extrabold text-indigo-700 tabular-nums">
                {estimatedCredits.toLocaleString('vi-VN')}
                <span className="ml-1 text-xs font-medium">credit</span>
              </span>
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-indigo-500">
              <span>Số dư hiện tại</span>
              <span className="tabular-nums">
                {currentBalance !== null ? currentBalance.toLocaleString('vi-VN') : '—'}
              </span>
            </div>
            {after !== null && (
              <div className="mt-1 flex justify-between text-[11px] text-indigo-500">
                <span>Sau khi tạo</span>
                <span className={`tabular-nums ${after < 0 ? 'text-red-600 font-semibold' : ''}`}>
                  {after.toLocaleString('vi-VN')}
                </span>
              </div>
            )}
          </div>

          {/* Insufficient warning */}
          {insufficient && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Không đủ credit. Nạp thêm trên kie.ai trước khi tạo.
              </span>
            </div>
          )}

          {/* Time hint */}
          {!insufficient && (
            <div className="flex items-start gap-2 text-[11px] text-gray-500">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                {scope === 'slot-1' || scope === 'reroll'
                  ? 'Mỗi ảnh ~30-60s. Có thể huỷ nếu bị stuck.'
                  : 'Tổng ~3-5 phút cho 9 ảnh (parallel).'}
              </span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            onClick={onConfirm}
            disabled={insufficient || busy}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:bg-gray-300"
          >
            <Sparkles className="h-3 w-3" />
            {busy ? 'Đang tạo...' : 'Tiếp tục'}
          </button>
        </div>
      </div>
    </div>
  )
}
