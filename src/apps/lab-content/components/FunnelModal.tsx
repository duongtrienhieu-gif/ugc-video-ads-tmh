import { useEffect, useMemo, useState } from 'react'
import {
  X, Loader2, RefreshCw, AlertCircle, Target, Copy, Check,
} from 'lucide-react'
import type { FunnelOutput, FunnelPiece, FunnelTier } from '../types'
import FunnelPieceCard from './FunnelPieceCard'

const TIER_META: Record<FunnelTier, { glyph: string; label: string; sublabel: string; bg: string; border: string; text: string; ring: string }> = {
  tofu: {
    glyph: '🟢',
    label: 'TOFU · Awareness',
    sublabel: 'Kéo người lạ chú ý · CTA mềm (follow / save / share)',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
  },
  mofu: {
    glyph: '🔵',
    label: 'MOFU · Consideration',
    sublabel: 'Thuyết phục KH đã biết · CTA cân bằng (so sánh / explain)',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
  },
  bofu: {
    glyph: '🔴',
    label: 'BOFU · Conversion',
    sublabel: 'Chốt sale · CTA mạnh (urgency / scarcity / hard ask)',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    ring: 'ring-rose-200',
  },
}

const TIER_ORDER: FunnelTier[] = ['tofu', 'mofu', 'bofu']

interface Props {
  open: boolean
  productName: string
  cachedOutput: FunnelOutput | null
  isGenerating: boolean
  error: string | null
  onClose: () => void
  onRegenerate: () => void
}

export default function FunnelModal({
  open, productName, cachedOutput, isGenerating, error, onClose, onRegenerate,
}: Props) {
  const [lang, setLang] = useState<'vi' | 'my'>('vi')
  const [batchCopied, setBatchCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const groupedPieces = useMemo(() => {
    const map: Record<FunnelTier, FunnelPiece[]> = { tofu: [], mofu: [], bofu: [] }
    if (!cachedOutput) return map
    for (const p of cachedOutput.pieces) map[p.tier].push(p)
    return map
  }, [cachedOutput])

  const handleCopyAll = async () => {
    if (!cachedOutput) return
    const sections: string[] = []
    for (const tier of TIER_ORDER) {
      const meta = TIER_META[tier]
      const pieces = groupedPieces[tier]
      if (pieces.length === 0) continue
      sections.push(`═══ ${meta.label.toUpperCase()} ═══\n`)
      pieces.forEach((p, i) => {
        const text = lang === 'vi' ? p.vietnamese : p.malay
        sections.push(`[${p.formula}] · Piece ${i + 1}\n${text}\n`)
      })
    }
    const text = sections.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setBatchCopied(true)
      setTimeout(() => setBatchCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  if (!open) return null

  const totalPieces = cachedOutput?.pieces.length ?? 0

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
        <div className="shrink-0 border-b border-violet-200 bg-gradient-to-r from-emerald-50 via-blue-50 to-rose-50 px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-violet-200">
                  <Target className="h-3.5 w-3.5 text-violet-600" />
                </div>
                <h2 className="text-sm font-bold text-violet-700">
                  Phễu Content · 3 tầng · 9 caption
                </h2>
                {cachedOutput && (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                    {totalPieces} pieces
                  </span>
                )}
              </div>
              <p className="truncate text-[12px] text-gray-600">{productName}</p>
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
                <p className="font-semibold">Tạo Phễu Content thất bại</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {isGenerating && !cachedOutput && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
              <p className="text-sm font-semibold text-gray-800">Đang dựng phễu 3 tầng…</p>
              <p className="text-[11px] text-gray-500">
                9 caption · TOFU/MOFU/BOFU · VI + MY · 60-90 giây
              </p>
            </div>
          )}

          {!isGenerating && !cachedOutput && !error && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
                <Target className="h-5 w-5 text-violet-600" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Chưa có phễu</p>
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-violet-700"
              >
                <Target className="h-3.5 w-3.5" />
                Tạo Phễu Content
              </button>
            </div>
          )}

          {cachedOutput && (
            <div className="space-y-6">
              {TIER_ORDER.map((tier) => {
                const meta = TIER_META[tier]
                const pieces = groupedPieces[tier]
                if (pieces.length === 0) return null
                return (
                  <section key={tier}>
                    <div className={`mb-3 flex items-start gap-3 rounded-2xl border ${meta.border} ${meta.bg} p-3`}>
                      <span className="text-xl leading-none">{meta.glyph}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-sm font-bold ${meta.text}`}>{meta.label}</h3>
                        <p className="text-[11px] text-gray-600">{meta.sublabel}</p>
                      </div>
                      <span className={`rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold ${meta.text}`}>
                        {pieces.length} content
                      </span>
                    </div>
                    <div className="space-y-3 pl-2">
                      {pieces.map((p, i) => (
                        <FunnelPieceCard
                          key={p.id}
                          piece={p}
                          index={i + 1}
                          lang={lang}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {cachedOutput && (
          <div className="shrink-0 border-t border-black/8 bg-white px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="hidden text-[11px] text-gray-500 sm:block">
                Đóng modal sẽ giữ phễu · "Tạo lại" mới đổi · Copy ngôn ngữ {lang === 'vi' ? '🇻🇳 VI' : '🇲🇾 MY'} đang chọn
              </p>

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-violet-700"
                >
                  {batchCopied
                    ? <><Check className="h-3.5 w-3.5" /> Copied toàn bộ phễu!</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy toàn bộ phễu</>
                  }
                </button>
                <button
                  onClick={onRegenerate}
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
