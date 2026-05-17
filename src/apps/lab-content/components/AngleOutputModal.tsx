import { useEffect, useState } from 'react'
import { X, Loader2, RefreshCw, Megaphone, PenLine, AlertCircle } from 'lucide-react'
import type { ContentAngle, CaptionOutput, ScriptOutput } from '../types'
import CaptionOutputView from './CaptionOutput'
import ScriptOutputView from './ScriptOutput'

export type OutputMode = 'caption' | 'script'

interface Props {
  open: boolean
  mode: OutputMode
  angle: ContentAngle | null
  /** Cached output (or null if never generated yet). */
  cachedOutput: CaptionOutput | ScriptOutput | null
  isGenerating: boolean
  error: string | null
  onClose: () => void
  /** Triggered when user clicks Tạo lại — parent forces regeneration. */
  onRegenerate: () => void
}

export default function AngleOutputModal({
  open, mode, angle, cachedOutput, isGenerating, error,
  onClose, onRegenerate,
}: Props) {
  const [lang, setLang] = useState<'vi' | 'my'>('vi')

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !angle) return null

  const isCaption = mode === 'caption'
  const titleText = isCaption ? 'Caption' : 'Kịch bản UGC'
  const Icon = isCaption ? Megaphone : PenLine
  const accentBorder = isCaption ? 'border-pink-200' : 'border-blue-200'
  const accentBg = isCaption ? 'bg-pink-50' : 'bg-blue-50'
  const accentText = isCaption ? 'text-pink-700' : 'text-blue-700'
  const accentRing = isCaption ? 'ring-pink-200' : 'ring-blue-200'
  const accentButton = isCaption
    ? 'bg-pink-600 text-white hover:bg-pink-700'
    : 'bg-blue-600 text-white hover:bg-blue-700'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`shrink-0 border-b ${accentBorder} ${accentBg} px-5 py-3`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ${accentRing}`}>
                  <Icon className={`h-3.5 w-3.5 ${accentText}`} />
                </div>
                <h2 className={`text-sm font-bold ${accentText}`}>
                  {titleText} · 2 variations
                </h2>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-gray-700">
                  {angle.recommendedFormula}
                </span>
              </div>
              <p className="truncate text-[13px] font-semibold text-gray-800">{angle.titleVi}</p>
              <p className="line-clamp-1 text-[11px] text-gray-500">{angle.descriptionVi}</p>
            </div>

            {/* Language toggle */}
            <div className="flex shrink-0 items-center rounded-full border border-black/10 bg-white p-0.5">
              <button
                onClick={() => setLang('vi')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  lang === 'vi' ? `${accentBg} ${accentText}` : 'text-gray-500'
                }`}
              >
                🇻🇳 VI
              </button>
              <button
                onClick={() => setLang('my')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  lang === 'my' ? `${accentBg} ${accentText}` : 'text-gray-500'
                }`}
              >
                🇲🇾 MY
              </button>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded-lg border border-black/10 bg-white p-1.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
              title="Đóng (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-5 py-4">
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Tạo {titleText.toLowerCase()} thất bại</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {isGenerating && !cachedOutput && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className={`h-8 w-8 animate-spin ${accentText}`} />
              <p className="text-sm font-semibold text-gray-800">
                Đang tạo {titleText.toLowerCase()}…
              </p>
              <p className="text-[11px] text-gray-500">
                2 variations · ngôn ngữ VI + MY · tối đa 30s
              </p>
            </div>
          )}

          {!isGenerating && !cachedOutput && !error && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${accentBg}`}>
                <Icon className={`h-5 w-5 ${accentText}`} />
              </div>
              <p className="text-sm font-semibold text-gray-800">Chưa có output</p>
              <button
                onClick={onRegenerate}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold ${accentButton}`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tạo {titleText.toLowerCase()}
              </button>
            </div>
          )}

          {cachedOutput && (
            isCaption
              ? <CaptionOutputView output={cachedOutput as CaptionOutput} lang={lang} />
              : <ScriptOutputView output={cachedOutput as ScriptOutput} lang={lang} />
          )}
        </div>

        {/* Footer */}
        {cachedOutput && (
          <div className="shrink-0 border-t border-black/8 bg-white px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-gray-500">
                Đã tạo lúc {new Date(cachedOutput.generatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                {' · '}
                Đóng + mở lại sẽ hiện kết quả cũ. Bấm <b>Tạo lại</b> để sinh phiên bản mới.
              </p>
              <button
                onClick={onRegenerate}
                disabled={isGenerating}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50 ${accentButton}`}
              >
                {isGenerating ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tạo lại…</>
                ) : (
                  <><RefreshCw className="h-3.5 w-3.5" /> Tạo lại</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
