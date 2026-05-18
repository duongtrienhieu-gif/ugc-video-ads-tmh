import { useEffect, useState } from 'react'
import {
  X, Loader2, RefreshCw, AlertCircle, Layers3, Copy, Check, Sparkles,
} from 'lucide-react'
import type { LabBriefResult, MultiAngleOutput } from '../types'
import MultiAngleAdCard from './MultiAngleAdCard'

interface Props {
  open: boolean
  result: LabBriefResult | null
  cachedOutput: MultiAngleOutput | null
  isGenerating: boolean
  error: string | null
  onClose: () => void
  onGenerate: () => void
}

export default function MultiAngleModal({
  open, result, cachedOutput, isGenerating, error, onClose, onGenerate,
}: Props) {
  const [lang, setLang] = useState<'vi' | 'my'>('vi')
  const [batchCopied, setBatchCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleCopyAll = async () => {
    if (!cachedOutput) return
    const sections: string[] = []
    cachedOutput.ads.forEach((ad, i) => {
      const hook = lang === 'vi' ? ad.hookVi : ad.hookMy
      const body = lang === 'vi' ? ad.bodyVi : ad.bodyMy
      const cta  = lang === 'vi' ? ad.ctaVi  : ad.ctaMy
      sections.push(`═══ AD #${i + 1} · ${ad.angleLabelVi.toUpperCase()} ═══\n\n${hook}\n\n${body}\n\n👉 ${cta}\n\n[Visual: ${ad.visualDirectionVi}]`)
    })
    try {
      await navigator.clipboard.writeText(sections.join('\n\n────────────\n\n'))
      setBatchCopied(true)
      setTimeout(() => setBatchCopied(false), 2000)
    } catch { /* clipboard blocked */ }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-violet-200 bg-gradient-to-r from-blue-50 via-violet-50 to-rose-50 px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-violet-200">
                  <Layers3 className="h-3.5 w-3.5 text-violet-600" />
                </div>
                <h2 className="text-sm font-bold text-violet-700">
                  Multi-Angle Ad Pack · 5 góc khác nhau
                </h2>
                {cachedOutput && (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                    {cachedOutput.ads.length} ads
                  </span>
                )}
              </div>
              <p className="truncate text-[12px] text-gray-600">{result?.productName ?? ''}</p>
            </div>

            <div className="flex shrink-0 items-center rounded-full border border-black/10 bg-white p-0.5">
              <button
                onClick={() => setLang('vi')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  lang === 'vi' ? 'bg-violet-100 text-violet-700' : 'text-gray-500'
                }`}
              >
                🇻🇳 VI
              </button>
              <button
                onClick={() => setLang('my')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  lang === 'my' ? 'bg-violet-100 text-violet-700' : 'text-gray-500'
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
                <p className="font-semibold">Tạo Multi-Angle Ad Pack thất bại</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {isGenerating && !cachedOutput && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
              <p className="text-sm font-semibold text-gray-800">Đang sinh 5 góc ad…</p>
              <p className="text-[11px] text-gray-500">
                Logical · Emotional · Social Proof · Fear · Aspirational
              </p>
            </div>
          )}

          {!isGenerating && !cachedOutput && !error && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
                <Layers3 className="h-5 w-5 text-violet-600" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Chưa có Multi-Angle Pack</p>
              <p className="max-w-md text-[11px] text-gray-500">
                Sinh 5 ad ready-to-run, mỗi cái 1 góc tâm lý khác — đủ để Meta/TikTok algo test winner.
              </p>
              <button
                onClick={onGenerate}
                className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-violet-700"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Sinh 5 ads
              </button>
            </div>
          )}

          {cachedOutput && cachedOutput.ads.length > 0 && (
            <div className="space-y-3">
              {cachedOutput.ads.map((ad, idx) => (
                <MultiAngleAdCard key={ad.id} ad={ad} index={idx + 1} lang={lang} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cachedOutput && (
          <div className="shrink-0 border-t border-black/8 bg-white px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="hidden text-[11px] text-gray-500 sm:block">
                Đóng modal sẽ giữ output · "Tạo lại" sinh 5 ads mới
              </p>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-violet-700"
                >
                  {batchCopied
                    ? <><Check className="h-3.5 w-3.5" /> Copied 5 ads!</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy toàn bộ 5 ads</>
                  }
                </button>
                <button
                  onClick={onGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 rounded-full border border-violet-300 bg-white px-4 py-2 text-[12px] font-semibold text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tạo…</>
                  ) : (
                    <><RefreshCw className="h-3.5 w-3.5" /> Tạo lại</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
