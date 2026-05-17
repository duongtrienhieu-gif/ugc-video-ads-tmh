import { useEffect, useMemo, useState } from 'react'
import {
  X, Loader2, RefreshCw, AlertCircle, Sparkles, Copy, Check, ChevronDown, ChevronRight,
} from 'lucide-react'
import type { HookLabOutput, LabHook } from '../types'
import HookCardLab from './HookCardLab'

type AngleFilter = 'all' | 1 | 2 | 3

interface Props {
  open: boolean
  productName: string
  cachedOutput: HookLabOutput | null
  isGenerating: boolean
  error: string | null
  onClose: () => void
  onRegenerate: () => void
}

export default function HookLabModal({
  open, productName, cachedOutput, isGenerating, error, onClose, onRegenerate,
}: Props) {
  const [lang, setLang] = useState<'vi' | 'my'>('vi')
  const [angleFilter, setAngleFilter] = useState<AngleFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [collapsedFormulas, setCollapsedFormulas] = useState<Set<string>>(new Set())
  const [batchCopied, setBatchCopied] = useState(false)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Reset selection when modal opens fresh (new generation)
  useEffect(() => {
    if (cachedOutput) {
      // Drop any selected IDs that aren't in the current output
      setSelectedIds((prev) => {
        const valid = new Set(cachedOutput.hooks.map((h) => h.id))
        const next = new Set<string>()
        prev.forEach((id) => { if (valid.has(id)) next.add(id) })
        return next
      })
    }
  }, [cachedOutput])

  // Group hooks by formula
  const groupedHooks = useMemo(() => {
    if (!cachedOutput) return new Map<string, LabHook[]>()
    const filtered = angleFilter === 'all'
      ? cachedOutput.hooks
      : cachedOutput.hooks.filter((h) => h.angleIndex === angleFilter)

    const groups = new Map<string, LabHook[]>()
    for (const h of filtered) {
      const key = h.formula || 'Khác'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(h)
    }
    // Sort groups by hook count descending (heaviest formula first)
    return new Map(
      [...groups.entries()].sort((a, b) => b[1].length - a[1].length),
    )
  }, [cachedOutput, angleFilter])

  const totalHooks = cachedOutput?.hooks.length ?? 0
  const visibleHooks = useMemo(
    () => Array.from(groupedHooks.values()).reduce((sum, arr) => sum + arr.length, 0),
    [groupedHooks],
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleFormulaCollapse = (formula: string) => {
    setCollapsedFormulas((prev) => {
      const next = new Set(prev)
      if (next.has(formula)) next.delete(formula)
      else next.add(formula)
      return next
    })
  }

  const handleCopySelected = async () => {
    if (!cachedOutput || selectedIds.size === 0) return
    const selected = cachedOutput.hooks.filter((h) => selectedIds.has(h.id))
    const text = selected
      .map((h) => (lang === 'vi' ? h.vietnamese : h.malay))
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setBatchCopied(true)
      setTimeout(() => setBatchCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  const handleClearSelection = () => setSelectedIds(new Set())
  const handleSelectAllVisible = () => {
    const visibleIds = new Set<string>()
    groupedHooks.forEach((arr) => arr.forEach((h) => visibleIds.add(h.id)))
    setSelectedIds(visibleIds)
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
        <div className="shrink-0 border-b border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-violet-200">
                  <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                </div>
                <h2 className="text-sm font-bold text-violet-700">
                  Hook Lab · 30 hook ứng viên
                </h2>
                {cachedOutput && (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                    {visibleHooks}/{totalHooks} hiển thị
                  </span>
                )}
              </div>
              <p className="truncate text-[12px] text-gray-600">{productName}</p>
            </div>

            {/* Language toggle */}
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

          {/* Filter row */}
          {cachedOutput && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-violet-200 pt-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Lọc theo góc</span>
              {(['all', 1, 2, 3] as AngleFilter[]).map((a) => {
                const label = a === 'all' ? 'Tất cả' : `Góc ${a}`
                const isActive = angleFilter === a
                return (
                  <button
                    key={String(a)}
                    onClick={() => setAngleFilter(a)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      isActive
                        ? 'bg-violet-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-violet-50'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleSelectAllVisible}
                  className="text-[11px] text-violet-600 hover:underline"
                >
                  Chọn tất cả
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleClearSelection}
                    className="text-[11px] text-gray-500 hover:underline"
                  >
                    Bỏ chọn
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-5 py-4">
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Tạo Hook Lab thất bại</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {isGenerating && !cachedOutput && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
              <p className="text-sm font-semibold text-gray-800">Đang phân tích & sinh 30 hook…</p>
              <p className="text-[11px] text-gray-500">
                14 công thức · 3 góc · 2 ngôn ngữ · 30-60 giây
              </p>
            </div>
          )}

          {!isGenerating && !cachedOutput && !error && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
                <Sparkles className="h-5 w-5 text-violet-600" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Chưa có Hook Lab</p>
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-violet-700"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Sinh 30 hook
              </button>
            </div>
          )}

          {cachedOutput && groupedHooks.size === 0 && (
            <div className="flex h-32 items-center justify-center text-[12px] text-gray-500">
              Không có hook nào khớp filter này.
            </div>
          )}

          {cachedOutput && groupedHooks.size > 0 && (
            <div className="space-y-4">
              {Array.from(groupedHooks.entries()).map(([formula, hooks]) => {
                const isCollapsed = collapsedFormulas.has(formula)
                return (
                  <section key={formula}>
                    <button
                      onClick={() => toggleFormulaCollapse(formula)}
                      className="mb-2 flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left transition-colors hover:bg-gray-50"
                    >
                      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                      <span className="rounded-full bg-violet-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                        {formula}
                      </span>
                      <span className="text-[12px] font-semibold text-gray-800">
                        {hooks.length} hook
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-1.5 pl-4">
                        {hooks.map((h) => (
                          <HookCardLab
                            key={h.id}
                            hook={h}
                            lang={lang}
                            selected={selectedIds.has(h.id)}
                            onToggleSelect={() => toggleSelect(h.id)}
                          />
                        ))}
                      </div>
                    )}
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
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
                  ⭐ Đã chọn {selectedIds.size}
                </div>
                <p className="hidden text-[11px] text-gray-500 sm:block">
                  Đóng modal sẽ giữ kết quả · "Tạo lại" mới đổi hook
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySelected}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
                >
                  {batchCopied
                    ? <><Check className="h-3.5 w-3.5" /> Copied!</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy {selectedIds.size} hook</>
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
