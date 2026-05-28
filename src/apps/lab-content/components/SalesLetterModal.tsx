import { useEffect, useState } from 'react'
import {
  X, Loader2, RefreshCw, AlertCircle, ScrollText, Copy, Check, Sparkles,
} from 'lucide-react'
import type { ContentAngle, LabBriefResult, SalesLetterLength, SalesLetterOutput } from '../types'
import SalesLetterSectionCard from './SalesLetterSectionCard'

const LENGTH_OPTIONS: { value: SalesLetterLength; label: string; hint: string }[] = [
  { value: 1000, label: '1.000 từ', hint: 'Ngắn — landing page nhanh' },
  { value: 1500, label: '1.500 từ', hint: 'Vừa — advertorial chuẩn' },
  { value: 2000, label: '2.000 từ', hint: 'Dài — sales letter đầy đủ' },
  { value: 2500, label: '2.500 từ', hint: 'Tối đa — long-form sâu' },
]

interface Props {
  open: boolean
  result: LabBriefResult | null
  cachedOutput: SalesLetterOutput | null
  isGenerating: boolean
  error: string | null
  onClose: () => void
  /** Called when user clicks generate — parent triggers generation. */
  onGenerate: (length: SalesLetterLength, focusAngle: ContentAngle | null) => void
}

export default function SalesLetterModal({
  open, result, cachedOutput, isGenerating, error, onClose, onGenerate,
}: Props) {
  const [lang, setLang] = useState<'vi' | 'my'>('vi')
  const [targetLength, setTargetLength] = useState<SalesLetterLength>(1500)
  const [focusAngleId, setFocusAngleId] = useState<string>('')
  const [batchCopied, setBatchCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Hydrate UI state from cached output
  useEffect(() => {
    if (open && cachedOutput) {
      setTargetLength(cachedOutput.targetLength)
    }
  }, [open, cachedOutput])

  const handleGenerate = () => {
    if (!result) return
    const focusAngle = focusAngleId
      ? result.angles.find((a) => a.id === focusAngleId) ?? null
      : null
    onGenerate(targetLength, focusAngle)
  }

  const handleCopyAll = async () => {
    if (!cachedOutput) return
    const text = cachedOutput.sections
      .map((s) => {
        const body = lang === 'vi' ? s.vietnamese : s.malay
        return `═══ ${s.labelVi.toUpperCase()} ═══\n\n${body}`
      })
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setBatchCopied(true)
      setTimeout(() => setBatchCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  if (!open) return null

  const totalWords = cachedOutput
    ? (lang === 'vi' ? cachedOutput.wordCountVi : cachedOutput.wordCountMy)
    : 0

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
        <div className="shrink-0 border-b border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-amber-200">
                  <ScrollText className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <h2 className="text-sm font-bold text-amber-700">
                  Long-Form Sales Letter · 14 section
                </h2>
                {cachedOutput && (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                    {totalWords} từ · target {cachedOutput.targetLength}
                  </span>
                )}
              </div>
              <p className="truncate text-[12px] text-gray-600">{result?.productName ?? ''}</p>
            </div>

            <div className="flex shrink-0 items-center rounded-full border border-black/10 bg-white p-0.5">
              <button
                onClick={() => setLang('vi')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  lang === 'vi' ? 'bg-amber-100 text-amber-700' : 'text-gray-500'
                }`}
              >
                🇻🇳 VI
              </button>
              <button
                onClick={() => setLang('my')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  lang === 'my' ? 'bg-amber-100 text-amber-700' : 'text-gray-500'
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
          {/* Settings */}
          <section className="mb-4 rounded-2xl border border-amber-200 bg-white p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Cài đặt sinh sales letter
            </p>

            {/* Length picker */}
            <div className="mb-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Độ dài</p>
              <div className="grid grid-cols-4 gap-1.5">
                {LENGTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTargetLength(opt.value)}
                    title={opt.hint}
                    className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                      targetLength === opt.value
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-black/10 bg-white hover:bg-black/[0.03]'
                    }`}
                  >
                    <p className={`text-[11px] font-bold ${targetLength === opt.value ? 'text-amber-800' : 'text-gray-800'}`}>
                      {opt.label}
                    </p>
                    <p className="truncate text-[9px] text-gray-500">{opt.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Focus angle */}
            {result && result.angles.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Góc chủ đạo (optional)</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setFocusAngleId('')}
                    className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-colors ${
                      focusAngleId === '' ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-black/10 bg-white text-gray-700 hover:bg-black/[0.03]'
                    }`}
                  >
                    🎯 Trộn cả 3 góc
                  </button>
                  {result.angles.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() => setFocusAngleId(a.id)}
                      className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-colors ${
                        focusAngleId === a.id ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-black/10 bg-white text-gray-700 hover:bg-black/[0.03]'
                      }`}
                    >
                      Góc {i + 1} · {a.titleVi.slice(0, 30)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !result}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition-all hover:from-amber-700 hover:to-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGenerating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang viết sales letter…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> {cachedOutput ? 'Tạo lại sales letter' : 'Tạo sales letter'}</>
              )}
            </button>
          </section>

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Tạo Sales Letter thất bại</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {isGenerating && !cachedOutput && (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
              <p className="text-sm font-semibold text-gray-800">Đang viết {targetLength} từ × 2 ngôn ngữ…</p>
              <p className="text-[11px] text-gray-500">14 section · AIDA + PPPP + Storytelling · 60-120 giây</p>
            </div>
          )}

          {cachedOutput && cachedOutput.sections.length > 0 && (
            <div className="space-y-3">
              {cachedOutput.sections.map((s, idx) => (
                <SalesLetterSectionCard key={s.id} section={s} index={idx + 1} lang={lang} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cachedOutput && (
          <div className="shrink-0 border-t border-black/8 bg-white px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="hidden text-[11px] text-gray-500 sm:block">
                Đóng modal sẽ giữ output · "Tạo lại" với cài đặt khác để sinh lại
              </p>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1.5 rounded-full bg-amber-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-amber-700"
                >
                  {batchCopied
                    ? <><Check className="h-3.5 w-3.5" /> Copied toàn bộ!</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy toàn bộ sales letter</>
                  }
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-4 py-2 text-[12px] font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
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
