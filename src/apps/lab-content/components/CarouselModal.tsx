import { useEffect, useState } from 'react'
import {
  X, Loader2, RefreshCw, AlertCircle, GalleryHorizontal, Copy, Check, Sparkles,
} from 'lucide-react'
import type { CarouselOutput, CarouselStructure, LabBriefResult } from '../types'
import { CAROUSEL_STRUCTURE_OPTIONS, getCarouselStructureById } from '../services/generateCarousel'
import CarouselSlideCard from './CarouselSlideCard'

interface Props {
  open: boolean
  result: LabBriefResult | null
  cachedOutput: CarouselOutput | null
  isGenerating: boolean
  error: string | null
  onClose: () => void
  onGenerate: (structureId: CarouselStructure) => void
}

export default function CarouselModal({
  open, result, cachedOutput, isGenerating, error, onClose, onGenerate,
}: Props) {
  const [lang, setLang] = useState<'vi' | 'my'>('vi')
  const [structureId, setStructureId] = useState<CarouselStructure>('problem-solution')
  const [batchCopied, setBatchCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (open && cachedOutput) {
      setStructureId(cachedOutput.structure)
    }
  }, [open, cachedOutput])

  const handleGenerate = () => {
    onGenerate(structureId)
  }

  const handleCopyAll = async () => {
    if (!cachedOutput) return
    const structure = getCarouselStructureById(cachedOutput.structure)
    const lines: string[] = []
    lines.push(`═══ CAROUSEL — ${structure?.label ?? cachedOutput.structure} ═══\n`)
    cachedOutput.slides.forEach((s) => {
      const cap = lang === 'vi' ? s.captionVi : s.captionMy
      lines.push(`SLIDE ${s.position}:\n${cap}`)
      if (s.visualDirectionVi) lines.push(`[Visual: ${s.visualDirectionVi}]`)
      if (s.backgroundSuggest) lines.push(`[Background: ${s.backgroundSuggest}]`)
      lines.push('')
    })
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
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
        <div className="shrink-0 border-b border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-pink-50 px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-fuchsia-200">
                  <GalleryHorizontal className="h-3.5 w-3.5 text-fuchsia-600" />
                </div>
                <h2 className="text-sm font-bold text-fuchsia-700">
                  Carousel Ad Generator · 6-10 slide IG/FB
                </h2>
                {cachedOutput && (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                    {cachedOutput.slides.length} slides
                  </span>
                )}
              </div>
              <p className="truncate text-[12px] text-gray-600">{result?.productName ?? ''}</p>
            </div>

            <div className="flex shrink-0 items-center rounded-full border border-black/10 bg-white p-0.5">
              <button
                onClick={() => setLang('vi')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  lang === 'vi' ? 'bg-fuchsia-100 text-fuchsia-700' : 'text-gray-500'
                }`}
              >
                🇻🇳 VI
              </button>
              <button
                onClick={() => setLang('my')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  lang === 'my' ? 'bg-fuchsia-100 text-fuchsia-700' : 'text-gray-500'
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
          {/* Structure picker */}
          <section className="mb-4 rounded-2xl border border-fuchsia-200 bg-white p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              📐 Chọn cấu trúc carousel
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {CAROUSEL_STRUCTURE_OPTIONS.map((s) => {
                const isActive = structureId === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setStructureId(s.id)}
                    title={s.hint}
                    className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      isActive ? 'border-fuchsia-400 bg-fuchsia-50' : 'border-black/10 bg-white hover:bg-black/[0.03]'
                    }`}
                  >
                    <span className="text-base leading-none">{s.glyph}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[11px] font-semibold ${isActive ? 'text-fuchsia-800' : 'text-gray-800'}`}>
                        {s.label} · {s.slideCount} slide
                      </p>
                      <p className="truncate text-[10px] text-gray-500">{s.hint}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !result}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition-all hover:from-fuchsia-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGenerating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang sinh carousel…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> {cachedOutput ? 'Tạo lại carousel' : 'Tạo carousel ad'}</>
              )}
            </button>
          </section>

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Tạo Carousel thất bại</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {isGenerating && !cachedOutput && (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-fuchsia-600" />
              <p className="text-sm font-semibold text-gray-800">Đang dựng slide sequence…</p>
              <p className="text-[11px] text-gray-500">Caption ≤ 15 từ/slide · Visual direction · Background palette</p>
            </div>
          )}

          {cachedOutput && cachedOutput.slides.length > 0 && (
            <div className="space-y-3">
              {cachedOutput.slides.map((s) => (
                <CarouselSlideCard key={s.id} slide={s} lang={lang} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cachedOutput && (
          <div className="shrink-0 border-t border-black/8 bg-white px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="hidden text-[11px] text-gray-500 sm:block">
                Đóng modal sẽ giữ output · Đổi cấu trúc + bấm "Tạo lại"
              </p>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1.5 rounded-full bg-fuchsia-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-fuchsia-700"
                >
                  {batchCopied
                    ? <><Check className="h-3.5 w-3.5" /> Copied toàn bộ!</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy toàn bộ carousel</>
                  }
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 rounded-full border border-fuchsia-300 bg-white px-4 py-2 text-[12px] font-semibold text-fuchsia-700 transition-colors hover:bg-fuchsia-50 disabled:opacity-50"
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
