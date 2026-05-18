// ── Creative Studio — Workspace Layout (P13 rebuild) ───────────────────────
//
// AI workspace inspired by Midjourney / Krea / Leonardo:
//   • LEFT PANEL always usable — config inputs + controls + Generate
//   • RIGHT PANEL — render history (queued / generating / completed / failed)
//   • Async non-blocking — clicking "Tạo asset" creates a job + returns
//     immediately; user can change creative type, queue more jobs,
//     delete old ones while previous jobs render in background
//   • PERSISTENT via Supabase — F5 / logout / new browser restores
//     the full history (image blobs in IndexedDB; metadata in DB)
//
// State boundaries (per P13 spec §"Architecture Rule"):
//   • generationsStore is Creative Studio-only — does NOT share state
//     with landing-page (which has its own landingPageStore)
//   • generationsAPI hits a dedicated `creative_generations` table —
//     does NOT share DB schema with landing-page
//   • No imports from landing-page anywhere in this file

import { useState, useRef, useEffect, useMemo, memo } from 'react'
import { Sparkles, Loader2, UserRound, Package, Upload } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { saveAsset } from '../../utils/assetStore'
import BankPicker from '../../components/BankPicker'
import type { Product, Model } from '../../stores/types'

import type { AssetTypeId } from './types/asset'
import { runGeneration } from './runtime/runGeneration'
import { useGenerationsStore, type GenerationJob } from './stores/generationsStore'
import AssetTypePicker from './uiCatalog/AssetTypePicker'
import ResultCard from './uiCatalog/ResultCard'
import { findCatalogEntry, requirementsFor } from './uiCatalog/assetCatalog'

// ── PickerTile (product / avatar) ──────────────────────────────────────

interface PickerTileProps {
  imageUrl: string | null
  label: string
  hint: string
  accent: 'product' | 'avatar'
  onSelectFromBank: () => void
  onUpload: (file: File) => void
  onClear: () => void
}

function PickerTile({ imageUrl, label, hint, accent, onSelectFromBank, onUpload, onClear }: PickerTileProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const resolvedUrl = useAssetUrl(imageUrl ?? undefined)
  const display = imageUrl?.startsWith('http') || imageUrl?.startsWith('data:') || imageUrl?.startsWith('blob:') ? imageUrl : resolvedUrl
  const isAvatar = accent === 'avatar'
  const accentBorder = accent === 'product' ? 'border-rose-200' : 'border-violet-200'
  const accentBg     = accent === 'product' ? 'bg-rose-50'      : 'bg-violet-50'
  const accentText   = accent === 'product' ? 'text-rose-700'   : 'text-violet-700'

  // P20 — COMPACT layout: image strip aspect-[4/3], combined
  // micro-buttons row, no verbose hint text. Optimized for side-by-side
  // rendering in a 33% left panel.
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-black/10 bg-white p-2">
      <div className="flex items-center justify-between">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-gray-600">
          {label}
        </p>
        {imageUrl && (
          <button type="button" onClick={onClear} className="shrink-0 text-[9px] text-gray-400 hover:text-red-500">Bỏ</button>
        )}
      </div>
      <div className="aspect-[4/3] w-full overflow-hidden rounded-md border border-dashed border-black/10 bg-gray-50">
        {display ? (
          <img src={display} alt={label} className={`h-full w-full ${accent === 'product' ? 'object-contain p-1' : 'object-cover'}`} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            {isAvatar ? <UserRound className="h-7 w-7" strokeWidth={1.2} /> : <Package className="h-7 w-7" strokeWidth={1.2} />}
          </div>
        )}
      </div>
      {hint && <p className="line-clamp-1 text-[9px] text-gray-400">{hint}</p>}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onSelectFromBank}
          className={`flex flex-1 items-center justify-center rounded border ${accentBorder} ${accentBg} px-1.5 py-1 text-[10px] font-semibold ${accentText} hover:opacity-80`}
        >
          Project
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-1 rounded border border-black/10 bg-white px-1.5 py-1 text-[10px] font-semibold text-gray-700 hover:bg-black/[0.04]"
        >
          <Upload className="h-3 w-3" /> Upload
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
      />
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────

export default function CreativeStudio() {
  // ── Input panel state — left side ──────────────────────────────────
  const [selectedAssetTypeId, setSelectedAssetTypeId] = useState<AssetTypeId | null>(null)
  const [selectedAvatar, setSelectedAvatar]    = useState<Model | null>(null)
  const [selectedProduct, setSelectedProduct]  = useState<Product | null>(null)
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null)
  const [uploadedProductUrl, setUploadedProductUrl] = useState<string | null>(null)
  // P23 — referenceRefs kept on state for back-compat with runtime
  // payload; setter unused since the picker UI was removed. setter
  // eslint-disabled via destructure rename.
  const [referenceRefs] = useState<string[]>([])
  const [pickerMode, setPickerMode]            = useState<'avatar' | 'product' | null>(null)

  // P16 — optional marketing inputs (only used when the creative type
  // benefits from them, eg cta-banner / infographic). System decides
  // realism / mood / camera automatically from the Creative Config DNA.
  const [optHeadline, setOptHeadline] = useState('')
  const [optCta, setOptCta]           = useState('')
  const [optNotes, setOptNotes]       = useState('')
  const [optExpanded, setOptExpanded] = useState(false)

  // ── Bank / settings / toasts ───────────────────────────────────────
  const kieApiKey    = useSettingsStore((s) => s.kieApiKey)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const addToast     = useAppStore((s) => s.addToast)

  // ── Generations store — DB-backed job list (right panel) ───────────
  const jobs        = useGenerationsStore((s) => s.jobs)
  const hydrate     = useGenerationsStore((s) => s.hydrate)
  const hydrated     = useGenerationsStore((s) => s.hydrated)
  const hydrating    = useGenerationsStore((s) => s.hydrating)
  const hydrateError = useGenerationsStore((s) => s.hydrateError)
  const removeJob    = useGenerationsStore((s) => s.removeJob)

  // Hydrate once on mount — pulls full history from Supabase
  useEffect(() => { void hydrate() }, [hydrate])

  // ── Derived: requirements drive which input tiles to render ────────
  const catalogEntry = selectedAssetTypeId ? findCatalogEntry(selectedAssetTypeId) : null
  const reqs = useMemo(
    () => selectedAssetTypeId ? requirementsFor(selectedAssetTypeId) : null,
    [selectedAssetTypeId],
  )

  const avatarImageRef  = selectedAvatar?.characterImage  ?? uploadedAvatarUrl
  const productImageRef = selectedProduct?.productImage ?? uploadedProductUrl

  // ── Generation gate — required inputs present + API keys configured ─
  const isPhotographic    = catalogEntry?.group === 'photographic'
  const isUiNative        = catalogEntry?.group === 'ui-native'
  const isDesignedGraphic = catalogEntry?.group === 'designed-graphic'

  const needsGemini = isUiNative || isDesignedGraphic
  const needsKie    = isPhotographic || isUiNative
  const apiKeysOk   = (!needsKie || !!kieApiKey) && (!needsGemini || !!geminiApiKey)

  const reqsMet     = !reqs || (!reqs.requireProduct || !!productImageRef)
  const canGenerate = !!selectedAssetTypeId && apiKeysOk && reqsMet

  // ── Fire a generation job (non-blocking) ───────────────────────────
  //
  // P17 fix: full pre-validation + structured error logging + specific
  // Vietnamese error messages instead of generic "kiểm tra kết nối".
  // Debounced via inFlightRef so spam-clicking doesn't double-create.

  const inFlightRef = useRef(false)

  // P23 — toast debounce: suppress identical error toasts within 10s
  // window. Prevents the 5+ stacked "Workspace chưa sẵn sàng" cascade
  // when user spam-clicks Tạo while DB is unreachable.
  const lastToastRef = useRef<{ msg: string; time: number } | null>(null)
  function showErrorOnce(msg: string) {
    const now = Date.now()
    const last = lastToastRef.current
    if (last && last.msg === msg && now - last.time < 10000) return
    lastToastRef.current = { msg, time: now }
    addToast(msg, 'error')
  }

  async function handleGenerate() {
    // ── Debounce: prevent double-create on rapid clicks ──────────
    if (inFlightRef.current) {
      console.warn('[CreativeStudio] generate already in-flight, ignoring click')
      return
    }

    // ── Pre-validation: tell user EXACTLY what's missing ─────────
    if (!selectedAssetTypeId) {
      showErrorOnce('Vui lòng chọn loại creative phía dưới')
      return
    }
    if (reqs?.requireProduct && !productImageRef) {
      showErrorOnce('Vui lòng tải sản phẩm phía trên')
      return
    }
    if (needsKie && !kieApiKey) {
      showErrorOnce('Thiếu KIE.ai API key — vào Cài đặt để thêm')
      return
    }
    if (needsGemini && !geminiApiKey) {
      showErrorOnce('Thiếu Gemini API key — vào Cài đặt để thêm')
      return
    }

    // ── Build payload + log it for debug ─────────────────────────
    const options: Record<string, unknown> = {}
    if (optHeadline.trim()) options.customHeadline = optHeadline.trim()
    if (optCta.trim())      options.customCta      = optCta.trim()
    if (optNotes.trim())    options.userNotes      = optNotes.trim()

    const payload = {
      creativeType: selectedAssetTypeId,
      inputs: {
        productId:     selectedProduct?.id,
        modelId:       reqs?.requireAvatar ? selectedAvatar?.id : undefined,
        referenceRefs: reqs?.requireReference ? referenceRefs : undefined,
        options,
      },
    }
    console.info('[CreativeStudio] createJob payload', payload)

    inFlightRef.current = true
    try {
      await runGeneration(payload)
      addToast(`Đã thêm vào hàng đợi: ${catalogEntry?.title.vi ?? selectedAssetTypeId}`, 'success')
    } catch (err) {
      // Log FULL error to console; toast user-friendly message via debounce
      console.error('[CreativeStudio] CREATE JOB ERROR', err)
      showErrorOnce(translateJobError(err))
    } finally {
      inFlightRef.current = false
    }
  }

  // ── Per-job delete (DB + store) ────────────────────────────────────
  async function handleDeleteJob(jobId: string) {
    try {
      await removeJob(jobId)
    } catch {
      addToast('Xoá thất bại — thử lại', 'error')
    }
  }

  // ── File / bank handlers ───────────────────────────────────────────
  const handleSelectAvatar  = (item: unknown) => { setSelectedAvatar(item as Model); setUploadedAvatarUrl(null); setPickerMode(null) }
  const handleSelectProduct = (item: unknown) => { setSelectedProduct(item as Product); setUploadedProductUrl(null); setPickerMode(null) }
  const handleUploadAvatar  = async (file: File) => {
    try { const ref = await saveAsset(file, file.type || 'image/jpeg'); setUploadedAvatarUrl(ref); setSelectedAvatar(null) }
    catch (err) { addToast(`Upload avatar lỗi: ${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}`, 'error') }
  }
  const handleUploadProduct = async (file: File) => {
    try { const ref = await saveAsset(file, file.type || 'image/jpeg'); setUploadedProductUrl(ref); setSelectedProduct(null) }
    catch (err) { addToast(`Upload sản phẩm lỗi: ${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}`, 'error') }
  }

  // ── Render ─────────────────────────────────────────────────────────
  const activeCount    = jobs.filter((j) => j.status === 'generating' || j.status === 'queued').length
  const completedCount = jobs.filter((j) => j.status === 'completed').length

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50 to-pink-50 px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">Creative Studio</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          AI workspace — chọn loại creative, bấm Tạo, kết quả xuất hiện bên phải. UI không block khi đang render.
        </p>
      </div>

      {/* Body — workspace split (P16: 1fr/2fr = 33% / 67%) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_2fr]">
        {/* ── LEFT: input panel ─────────────────────────────────
               P23: aside is now a 2-region flex column:
                 • TOP — sticky inputs (Product / Avatar / Tạo button)
                   shrink-0, never scrolls out of view
                 • BOTTOM — scrollable creative picker + optional copy
               User can scroll the creative list while Tạo + inputs
               stay locked in view. */}
        <aside className="flex flex-col border-b border-r-0 border-black/8 bg-white/40 lg:border-b-0 lg:border-r">
          {/* ── STICKY INPUT REGION ──────────────────────────────── */}
          <div className="shrink-0 border-b border-black/8 bg-white/60 p-4 backdrop-blur-sm">
            <section>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                {reqs?.requireAvatar ? 'Sản phẩm + Avatar' : 'Sản phẩm'}
              </p>
              <div className="flex gap-2">
                <div className={reqs?.requireAvatar ? 'flex-1 min-w-0' : 'w-full'}>
                  <PickerTile
                    label="Sản phẩm"
                    hint="Ảnh rõ packaging"
                    accent="product"
                    imageUrl={productImageRef}
                    onSelectFromBank={() => setPickerMode('product')}
                    onUpload={handleUploadProduct}
                    onClear={() => { setSelectedProduct(null); setUploadedProductUrl(null) }}
                  />
                </div>
                {reqs?.requireAvatar && (
                  <div className="flex-1 min-w-0">
                    <PickerTile
                      label="Avatar AI"
                      hint="Khuyến nghị cho loại này"
                      accent="avatar"
                      imageUrl={avatarImageRef}
                      onSelectFromBank={() => setPickerMode('avatar')}
                      onUpload={handleUploadAvatar}
                      onClear={() => { setSelectedAvatar(null); setUploadedAvatarUrl(null) }}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* GENERATE button — primary action, always reachable */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-500 px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" /> Tạo asset
            </button>

            {/* Compact inline status hints */}
            {!selectedAssetTypeId && (
              <p className="mt-1.5 text-center text-[10px] text-gray-400">
                ↓ Chọn loại creative phía dưới
              </p>
            )}
            {selectedAssetTypeId && reqs?.requireProduct && !productImageRef && (
              <p className="mt-1.5 text-center text-[10px] text-amber-600">
                ↑ Thêm sản phẩm phía trên
              </p>
            )}
            {needsKie && !kieApiKey && (
              <p className="mt-1.5 text-center text-[10px] text-red-500">Cần KIE.ai API key trong Cài đặt</p>
            )}
            {needsGemini && !geminiApiKey && (
              <p className="mt-1.5 text-center text-[10px] text-red-500">Cần Gemini API key trong Cài đặt</p>
            )}
          </div>

          {/* ── SCROLLABLE CREATIVE LIST + OPTIONAL ──────────────── */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <section>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                Loại creative
              </p>
              <AssetTypePicker selectedId={selectedAssetTypeId} onSelect={setSelectedAssetTypeId} />
            </section>

            {/* OPTIONAL marketing copy (collapsible, at bottom) */}
            <section className="rounded-xl border border-black/10 bg-black/[0.02]">
              <button
                type="button"
                onClick={() => setOptExpanded((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Nội dung tuỳ chọn
                </span>
                <span className="text-[10px] text-gray-400">{optExpanded ? '▾' : '▸'}</span>
              </button>
              {optExpanded && (
              <div className="flex flex-col gap-2 px-3 pb-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-gray-600">Headline (tuỳ chọn)</span>
                  <input
                    type="text"
                    value={optHeadline}
                    onChange={(e) => setOptHeadline(e.target.value)}
                    placeholder="VD: Giải pháp mất ngủ — hiệu quả sau 14 ngày"
                    className="rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[12px] text-gray-800"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-gray-600">CTA (tuỳ chọn)</span>
                  <input
                    type="text"
                    value={optCta}
                    onChange={(e) => setOptCta(e.target.value)}
                    placeholder="VD: Đặt ngay"
                    className="rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[12px] text-gray-800"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-gray-600">Ghi chú cho AI (tuỳ chọn)</span>
                  <textarea
                    value={optNotes}
                    onChange={(e) => setOptNotes(e.target.value)}
                    placeholder="VD: nhấn mạnh tự nhiên, hữu cơ, không chứa hoá chất"
                    rows={3}
                    className="resize-none rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[12px] text-gray-800"
                  />
                </label>
                <p className="text-[10px] text-gray-400">
                  System tự quyết định realism / mood / lighting dựa trên loại creative — bạn chỉ cần viết content.
                </p>
              </div>
            )}
            </section>
          </div>
        </aside>

        {/* ── RIGHT: output workspace ──────────────────────────── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Workspace toolbar */}
          <div className="flex shrink-0 items-center gap-3 border-b border-black/8 bg-white/60 px-5 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
              Lịch sử render
            </span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
              {jobs.length} job
            </span>
            {activeCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> {activeCount} đang chạy
              </span>
            )}
            {completedCount > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                ✓ {completedCount} xong
              </span>
            )}
            {hydrating && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-gray-400">
                <Loader2 className="h-3 w-3 animate-spin" /> Đang load history...
              </span>
            )}
          </div>

          {/* P22 — soft hydrate failure notice. Single-line, neutral,
              no exposed DB / SQL / migration text. Tech detail stays
              in console. */}
          {hydrateError && (
            <div className="mx-5 mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-700">
              Workspace tạm thời chưa đồng bộ — bạn vẫn dùng được, lịch sử sẽ load lại sau.
            </div>
          )}

          {/* Workspace grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {hydrated && jobs.length === 0 ? (
              <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-dashed border-black/10 bg-white">
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <Sparkles className="h-10 w-10 text-gray-200" />
                  <p className="text-sm text-gray-400">Workspace trống</p>
                  <p className="text-xs text-gray-300">
                    Chọn loại creative ở panel trái → cấu hình → bấm "Tạo asset"
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {jobs.map((job) => (
                  <JobCardWrapper key={job.id} job={job} onDelete={() => handleDeleteJob(job.id)} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Bank pickers */}
      <BankPicker
        bankType="models"
        isOpen={pickerMode === 'avatar'}
        onSelect={handleSelectAvatar}
        onClose={() => setPickerMode(null)}
      />
      <BankPicker
        bankType="products"
        isOpen={pickerMode === 'product'}
        onSelect={handleSelectProduct}
        onClose={() => setPickerMode(null)}
      />
    </div>
  )
}

// ── Error translation (P17 fix) ──────────────────────────────────────
//
// Map raw Supabase / API errors → actionable Vietnamese toast text.
// Full error stays in console.error for diagnostic.

function translateJobError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const low = msg.toLowerCase()

  // P22 — collapse all DB-setup errors into a single user-friendly
  // message. Tech detail (PGRST205 / 42P01 / "Could not find the
  // table") stays in console; user just sees a soft retry hint.
  if (
    low.includes('pgrst205')
    || (low.includes('could not find') && low.includes('table'))
    || (low.includes('relation') && low.includes('does not exist'))
    || low.includes('42p01')
  ) {
    return 'Workspace chưa sẵn sàng — thử lại sau ít phút'
  }
  // RLS / permission
  if (low.includes('row-level security') || low.includes('rls')) {
    return 'Quyền truy cập DB bị từ chối — kiểm tra Supabase RLS policy của creative_generations'
  }
  // Auth
  if (low.includes('phiên đăng nhập') || low.includes('jwt') || low.includes('not authenticated')) {
    return 'Phiên đăng nhập đã hết — đăng nhập lại'
  }
  // API key
  if (low.includes('api key')) {
    return 'Thiếu API key — vào Cài đặt'
  }
  // Credit
  if (low.includes('credit') || low.includes('insufficient')) {
    return 'Hết KIE credit — nạp thêm rồi thử lại'
  }
  // Network
  if (low.includes('network') || low.includes('fetch') || low.includes('timeout')) {
    return `Lỗi mạng khi tạo job — thử lại (${msg.slice(0, 60)})`
  }
  // Validation
  if (low.includes('null value') || low.includes('not-null') || low.includes('violates check')) {
    return `Payload thiếu trường — ${msg.slice(0, 80)}`
  }
  // Default: surface raw message (clipped) — never the generic "kiểm tra kết nối"
  return `Tạo job thất bại: ${msg.slice(0, 100)}`
}

// ── Job card wrapper — memoized so unrelated state changes don't re-render
//    every card in the workspace ────────────────────────────────────────

const JobCardWrapper = memo(function JobCardWrapper({
  job,
  onDelete,
}: {
  job: GenerationJob
  onDelete: () => void
}) {
  return <ResultCard job={job} onDelete={onDelete} />
})
