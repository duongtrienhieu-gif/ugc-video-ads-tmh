import { useEffect, useMemo, useState } from 'react'
import {
  X, Loader2, RefreshCw, AlertCircle, MessageSquare, Copy, Check, Sparkles,
} from 'lucide-react'
import type { BaitType, EngagementOutput, LabBriefResult } from '../types'
import { BAIT_TYPE_OPTIONS } from '../services/generateEngagement'
import EngagementPostCard from './EngagementPostCard'

type BaitFilter = 'all' | BaitType

interface Props {
  open: boolean
  result: LabBriefResult | null
  cachedOutput: EngagementOutput | null
  isGenerating: boolean
  error: string | null
  onClose: () => void
  onGenerate: () => void
}

export default function EngagementModal({
  open, result, cachedOutput, isGenerating, error, onClose, onGenerate,
}: Props) {
  const [lang, setLang] = useState<'vi' | 'my'>('vi')
  const [baitFilter, setBaitFilter] = useState<BaitFilter>('all')
  const [batchCopied, setBatchCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const visiblePosts = useMemo(() => {
    if (!cachedOutput) return []
    if (baitFilter === 'all') return cachedOutput.posts
    return cachedOutput.posts.filter((p) => p.baitType === baitFilter)
  }, [cachedOutput, baitFilter])

  // Bait types that have at least 1 post (for filter chip)
  const availableBaits = useMemo(() => {
    if (!cachedOutput) return new Set<BaitType>()
    return new Set(cachedOutput.posts.map((p) => p.baitType))
  }, [cachedOutput])

  const handleCopyAll = async () => {
    if (!cachedOutput) return
    const target = visiblePosts.length > 0 ? visiblePosts : cachedOutput.posts
    const lines: string[] = []
    target.forEach((p, i) => {
      const text = lang === 'vi' ? p.vietnamese : p.malay
      lines.push(`═══ POST ${i + 1} · ${p.baitLabelVi.toUpperCase()} ═══\n${text}`)
    })
    try {
      await navigator.clipboard.writeText(lines.join('\n\n────\n\n'))
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
        <div className="shrink-0 border-b border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-emerald-200">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <h2 className="text-sm font-bold text-emerald-700">
                  Comment Bait · Engagement Posts
                </h2>
                {cachedOutput && (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                    {visiblePosts.length}/{cachedOutput.posts.length} hiển thị
                  </span>
                )}
              </div>
              <p className="truncate text-[12px] text-gray-600">{result?.productName ?? ''}</p>
            </div>

            <div className="flex shrink-0 items-center rounded-full border border-black/10 bg-white p-0.5">
              <button
                onClick={() => setLang('vi')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  lang === 'vi' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500'
                }`}
              >
                🇻🇳 VI
              </button>
              <button
                onClick={() => setLang('my')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  lang === 'my' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500'
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

          {/* Bait filter */}
          {cachedOutput && availableBaits.size > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-emerald-200 pt-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Lọc bait</span>
              <button
                onClick={() => setBaitFilter('all')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  baitFilter === 'all' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-emerald-50'
                }`}
              >
                Tất cả
              </button>
              {BAIT_TYPE_OPTIONS.filter((b) => availableBaits.has(b.id)).map((b) => {
                const isActive = baitFilter === b.id
                return (
                  <button
                    key={b.id}
                    onClick={() => setBaitFilter(b.id)}
                    title={b.hint}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      isActive ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-emerald-50'
                    }`}
                  >
                    <span>{b.glyph}</span>
                    {b.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-5 py-4">
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Tạo Engagement Posts thất bại</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {isGenerating && !cachedOutput && (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-sm font-semibold text-gray-800">Đang sinh 12 engagement post…</p>
              <p className="text-[11px] text-gray-500">8 bait mechanic · trải đều · VI + MY · 45-75 giây</p>
            </div>
          )}

          {!isGenerating && !cachedOutput && !error && (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <MessageSquare className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Chưa có Engagement Posts</p>
              <p className="max-w-md text-[11px] text-gray-500">
                Sinh 12 post engineered để EARN COMMENT (algo signal mạnh nhất). Warm up audience trước khi chạy paid ads → giảm CPM.
              </p>
              <button
                onClick={onGenerate}
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-emerald-700"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Sinh 12 engagement posts
              </button>
            </div>
          )}

          {cachedOutput && visiblePosts.length > 0 && (
            <div className="space-y-3">
              {visiblePosts.map((p, idx) => (
                <EngagementPostCard key={p.id} post={p} index={idx + 1} lang={lang} />
              ))}
            </div>
          )}

          {cachedOutput && visiblePosts.length === 0 && (
            <div className="flex h-32 items-center justify-center text-[12px] text-gray-500">
              Không có post nào khớp filter này.
            </div>
          )}
        </div>

        {/* Footer */}
        {cachedOutput && (
          <div className="shrink-0 border-t border-black/8 bg-white px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="hidden text-[11px] text-gray-500 sm:block">
                Đóng modal sẽ giữ output · "Tạo lại" sinh 12 post mới
              </p>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  {batchCopied
                    ? <><Check className="h-3.5 w-3.5" /> Copied!</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy {visiblePosts.length} post</>
                  }
                </button>
                <button
                  onClick={onGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-4 py-2 text-[12px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
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
