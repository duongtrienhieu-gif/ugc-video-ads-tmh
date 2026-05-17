import { useEffect, useState } from 'react'
import {
  X, Loader2, RefreshCw, AlertCircle, Layers, Copy, Check, Sparkles,
} from 'lucide-react'
import type { CocOutput, LabBriefResult } from '../types'
import { COC_FORMAT_OPTIONS } from '../services/presets'
import CocMicroCard from './CocMicroCard'

interface Props {
  open: boolean
  result: LabBriefResult | null
  cachedOutput: CocOutput | null
  isGenerating: boolean
  error: string | null
  onClose: () => void
  /** Called when user clicks "Tạo 7 micro-content" — parent triggers generation. */
  onGenerate: (pillarText: string) => void
}

const PILLAR_SUGGESTIONS_LIMIT = 6

export default function CocModal({
  open, result, cachedOutput, isGenerating, error, onClose, onGenerate,
}: Props) {
  const [lang, setLang] = useState<'vi' | 'my'>('vi')
  const [pillarText, setPillarText] = useState('')
  const [batchCopied, setBatchCopied] = useState(false)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Hydrate textarea from cached pillar when modal opens
  useEffect(() => {
    if (open && cachedOutput && !pillarText) {
      setPillarText(cachedOutput.pillarText)
    }
  }, [open, cachedOutput, pillarText])

  // Build quick-fill suggestions from existing outputs (funnel + captions)
  const suggestions = (() => {
    if (!result) return []
    const items: { label: string; text: string }[] = []

    // Funnel pieces first (best pillar candidates because they're full captions)
    if (result.funnelOutput) {
      result.funnelOutput.pieces.forEach((p, i) => {
        const tierLabel = p.tier.toUpperCase()
        items.push({
          label: `Phễu ${tierLabel} #${i + 1} (${p.formula})`,
          text: lang === 'vi' ? p.vietnamese : p.malay,
        })
      })
    }
    // Then caption variations from each angle
    if (result.angleOutputs) {
      Object.entries(result.angleOutputs).forEach(([angleId, slot]) => {
        if (!slot.caption) return
        const angle = result.angles.find((a) => a.id === angleId)
        const angleLabel = angle?.titleVi?.slice(0, 30) ?? 'Góc'
        slot.caption.variations.forEach((v, i) => {
          items.push({
            label: `Caption · ${angleLabel} · V${i + 1}`,
            text: lang === 'vi' ? v.vietnamese : v.malay,
          })
        })
      })
    }

    return items.slice(0, PILLAR_SUGGESTIONS_LIMIT)
  })()

  const handleQuickFill = (text: string) => {
    setPillarText(text)
  }

  const handleGenerate = () => {
    if (!pillarText.trim()) return
    onGenerate(pillarText.trim())
  }

  const handleCopyAll = async () => {
    if (!cachedOutput) return
    const sections: string[] = []
    cachedOutput.micros.forEach((m) => {
      const fmt = COC_FORMAT_OPTIONS.find((f) => f.id === m.format)
      const text = lang === 'vi' ? m.vietnamese : m.malay
      sections.push(`═══ ${fmt?.glyph ?? ''} ${fmt?.label ?? m.format} ═══\n${text}\n`)
    })
    try {
      await navigator.clipboard.writeText(sections.join('\n'))
      setBatchCopied(true)
      setTimeout(() => setBatchCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  if (!open) return null

  const pillarTooShort = pillarText.trim().length < 20
  const canGenerate = !pillarTooShort && !isGenerating && !!result

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
        <div className="shrink-0 border-b border-cyan-200 bg-gradient-to-r from-cyan-50 to-teal-50 px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-cyan-200">
                  <Layers className="h-3.5 w-3.5 text-cyan-600" />
                </div>
                <h2 className="text-sm font-bold text-cyan-700">
                  COC Multiplier · 1 pillar → 7 micro-content
                </h2>
                {cachedOutput && (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                    {cachedOutput.micros.length} micros
                  </span>
                )}
              </div>
              <p className="truncate text-[12px] text-gray-600">{result?.productName ?? ''}</p>
            </div>

            <div className="flex shrink-0 items-center rounded-full border border-black/10 bg-white p-0.5">
              <button
                onClick={() => setLang('vi')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  lang === 'vi' ? 'bg-cyan-100 text-cyan-700' : 'text-gray-500'
                }`}
              >
                🇻🇳 VI
              </button>
              <button
                onClick={() => setLang('my')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  lang === 'my' ? 'bg-cyan-100 text-cyan-700' : 'text-gray-500'
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
          {/* Pillar input */}
          <section className="mb-4 rounded-2xl border border-cyan-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                📝 Pillar content (nguồn để nhân ra 7 micro)
              </p>
              <span className={`text-[10px] ${pillarTooShort ? 'text-red-500' : 'text-emerald-600'}`}>
                {pillarText.trim().length} ký tự · cần ≥ 20
              </span>
            </div>
            <textarea
              value={pillarText}
              onChange={(e) => setPillarText(e.target.value)}
              placeholder="Paste 1 caption pillar bạn muốn nhân thành 7 micro-content cho FB / IG / TikTok / Threads / Zalo / Email / Story…"
              rows={5}
              className="w-full resize-none rounded-xl border border-black/10 bg-gray-50 px-3 py-2 text-[13px] leading-relaxed placeholder:text-gray-400 focus:border-cyan-400 focus:outline-none"
            />

            {suggestions.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  ⚡ Quick fill — lấy từ output đã tạo
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickFill(s.text)}
                      title={s.text.slice(0, 120) + '…'}
                      className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-700 transition-colors hover:bg-cyan-100"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition-all hover:from-cyan-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGenerating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang nhân content…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> {cachedOutput ? 'Tạo lại 7 micro-content' : 'Tạo 7 micro-content'}</>
              )}
            </button>
          </section>

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Tạo COC thất bại</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {isGenerating && !cachedOutput && (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
              <p className="text-sm font-semibold text-gray-800">Đang nhân thành 7 micro-content…</p>
              <p className="text-[11px] text-gray-500">
                7 nền tảng · ngôn ngữ VI + MY · 45-75 giây
              </p>
            </div>
          )}

          {cachedOutput && cachedOutput.micros.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                🎁 7 Platform-native micro-content
              </p>
              {cachedOutput.micros.map((m) => (
                <CocMicroCard key={m.id} micro={m} lang={lang} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cachedOutput && (
          <div className="shrink-0 border-t border-black/8 bg-white px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="hidden text-[11px] text-gray-500 sm:block">
                Đóng modal sẽ giữ output · Đổi pillar + bấm "Tạo lại" để sinh lại từ pillar mới
              </p>

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1.5 rounded-full bg-cyan-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-cyan-700"
                >
                  {batchCopied
                    ? <><Check className="h-3.5 w-3.5" /> Copied toàn bộ!</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy toàn bộ 7 micros</>
                  }
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="flex items-center gap-1.5 rounded-full border border-cyan-300 bg-white px-4 py-2 text-[12px] font-semibold text-cyan-700 transition-colors hover:bg-cyan-50 disabled:opacity-50"
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
