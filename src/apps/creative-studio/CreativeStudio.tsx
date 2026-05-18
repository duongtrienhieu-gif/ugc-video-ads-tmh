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
import AssetControls, { type AssetOptions } from './uiCatalog/AssetControls'
import ResultCard from './uiCatalog/ResultCard'
import ReferencePicker from './uiCatalog/ReferencePicker'
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

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-black/[0.02] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
        {imageUrl && (
          <button type="button" onClick={onClear} className="text-[10px] text-gray-400 hover:text-red-500">Bỏ chọn</button>
        )}
      </div>
      <div className="aspect-square w-full overflow-hidden rounded-lg border border-dashed border-black/10 bg-white">
        {display ? (
          <img src={display} alt={label} className={`h-full w-full ${accent === 'product' ? 'object-contain p-2' : 'object-cover'}`} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            {isAvatar ? <UserRound className="h-10 w-10" strokeWidth={1.2} /> : <Package className="h-10 w-10" strokeWidth={1.2} />}
          </div>
        )}
      </div>
      <p className="text-[10px] text-gray-400">{hint}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSelectFromBank}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border ${accentBorder} ${accentBg} px-3 py-2 text-xs font-semibold ${accentText} hover:opacity-80`}
        >
          Từ Project
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-black/[0.04]"
        >
          <Upload className="h-3.5 w-3.5" /> Tải lên
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
  const [referenceRefs, setReferenceRefs]      = useState<string[]>([])
  const [pickerMode, setPickerMode]            = useState<'avatar' | 'product' | null>(null)
  const [options, setOptions]                  = useState<AssetOptions>({ styleId: 'realistic' })

  // ── Bank / settings / toasts ───────────────────────────────────────
  const kieApiKey    = useSettingsStore((s) => s.kieApiKey)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const addToast     = useAppStore((s) => s.addToast)

  // ── Generations store — DB-backed job list (right panel) ───────────
  const jobs        = useGenerationsStore((s) => s.jobs)
  const hydrate     = useGenerationsStore((s) => s.hydrate)
  const hydrated    = useGenerationsStore((s) => s.hydrated)
  const hydrating   = useGenerationsStore((s) => s.hydrating)
  const removeJob   = useGenerationsStore((s) => s.removeJob)

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
  async function handleGenerate() {
    if (!canGenerate || !selectedAssetTypeId) return
    try {
      await runGeneration({
        creativeType: selectedAssetTypeId,
        inputs: {
          productId:     selectedProduct?.id,
          modelId:       reqs?.requireAvatar ? selectedAvatar?.id : undefined,
          referenceRefs: reqs?.requireReference ? referenceRefs : undefined,
          options:       options as Record<string, unknown>,
        },
      })
      addToast(`Đã thêm vào hàng đợi: ${catalogEntry?.title.vi ?? selectedAssetTypeId}`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      addToast(msg.includes('Phiên đăng nhập') ? msg : 'Không tạo được job — kiểm tra kết nối', 'error')
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

      {/* Body — split workspace */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── LEFT: input panel (always usable) ─────────────────── */}
        <aside className="flex w-full max-w-[360px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-black/8 bg-white/40 p-4">
          {/* Step 1 — pick creative type */}
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">Loại creative</p>
            <AssetTypePicker selectedId={selectedAssetTypeId} onSelect={setSelectedAssetTypeId} />
          </section>

          {/* Step 2+ — dynamic inputs per requirements */}
          {catalogEntry && reqs && (
            <>
              {reqs.requireProduct && (
                <PickerTile
                  label="Sản phẩm (bắt buộc)"
                  hint="Ảnh sản phẩm rõ packaging / logo / label"
                  accent="product"
                  imageUrl={productImageRef}
                  onSelectFromBank={() => setPickerMode('product')}
                  onUpload={handleUploadProduct}
                  onClear={() => { setSelectedProduct(null); setUploadedProductUrl(null) }}
                />
              )}

              {reqs.requireAvatar && (
                <PickerTile
                  label="Avatar AI (tuỳ chọn)"
                  hint="Có thể bỏ trống — không cần người"
                  accent="avatar"
                  imageUrl={avatarImageRef}
                  onSelectFromBank={() => setPickerMode('avatar')}
                  onUpload={handleUploadAvatar}
                  onClear={() => { setSelectedAvatar(null); setUploadedAvatarUrl(null) }}
                />
              )}

              {reqs.requireReference && (
                <ReferencePicker
                  refs={referenceRefs}
                  onAdd={(ref) => setReferenceRefs((prev) => [...prev, ref])}
                  onRemove={(ref) => setReferenceRefs((prev) => prev.filter((r) => r !== ref))}
                />
              )}

              {/* Engine-aware controls */}
              <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Cài đặt — {catalogEntry.group}
                </p>
                <AssetControls
                  group={catalogEntry.group}
                  options={options}
                  onChange={(patch) => setOptions((prev) => ({ ...prev, ...patch }))}
                />
              </div>

              {/* Generate button — always usable, never disabled while jobs run */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-500 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" /> Tạo asset
              </button>

              {needsKie && !kieApiKey && (
                <p className="text-center text-[10px] text-red-500">Cần KIE.ai API key trong Cài đặt</p>
              )}
              {needsGemini && !geminiApiKey && (
                <p className="text-center text-[10px] text-red-500">Cần Gemini API key trong Cài đặt</p>
              )}
            </>
          )}
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
