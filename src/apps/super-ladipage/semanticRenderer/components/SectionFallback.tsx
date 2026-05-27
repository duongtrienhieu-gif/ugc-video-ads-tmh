// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — SectionFallback (P16A)
//
// Graceful degradation when a section fails to render properly.
// Variants:
//   - 'failed-image'   — image generation failed, allow retry
//   - 'loading'        — section is currently regenerating
//   - 'error'          — generic catch-all (rendering threw)
// ─────────────────────────────────────────────────────────────────────

import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  variant: 'failed-image' | 'loading' | 'error'
  sectionId: string
  message?: string
  onRetry?: () => void
}

export function SectionFallback({ variant, sectionId, message, onRetry }: Props) {
  if (variant === 'loading') {
    return (
      <div className="mx-2 my-3 flex flex-col items-center justify-center rounded border border-dashed border-stone-300 bg-stone-50 px-6 py-8">
        <Loader2 className="h-5 w-5 animate-spin text-stone-500" />
        <p className="mt-2 font-mono text-[10px] text-stone-500">
          Đang tạo lại section "{sectionId}"...
        </p>
      </div>
    )
  }

  if (variant === 'failed-image') {
    return (
      <div className="mx-2 my-3 rounded border border-amber-300 bg-amber-50 px-4 py-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-medium text-amber-900">
              Ảnh chưa tạo được
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-amber-700">
              {message ?? `Section "${sectionId}" gặp lỗi khi tạo ảnh.`}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2 flex items-center gap-1 rounded-sm border border-amber-400 bg-white px-2 py-1 font-mono text-[10px] text-amber-900 hover:bg-amber-100"
              >
                <RotateCcw className="h-3 w-3" />
                Thử lại
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 'error' — generic
  return (
    <div className="mx-2 my-3 rounded border border-red-300 bg-red-50 px-4 py-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-medium text-red-900">
            Section "{sectionId}" gặp lỗi
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-red-700">
            {message ?? 'Section không render được. Các section khác vẫn hoạt động bình thường.'}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 flex items-center gap-1 rounded-sm border border-red-400 bg-white px-2 py-1 font-mono text-[10px] text-red-900 hover:bg-red-100"
            >
              <RotateCcw className="h-3 w-3" />
              Thử lại
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
