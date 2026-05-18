// ── Creative Studio — Engine-Routed UI (P11 cutover) ────────────────────────
//
// Replaces the legacy ProductAI scene/style/4-variations UX with the
// asset-type registry pipeline:
//
//   user picks asset type
//   user picks product (required) + avatar (photographic only)
//   user adjusts engine-aware controls (locale / persona / color theme / ...)
//   user clicks "Tạo asset"
//     → generateAssets(assetTypeId, { productId, modelId, options })
//     → resolveAssetType → dispatch by engine group
//     → returns GeneratedAsset (with qcSummary in metadata)
//   typed result card appended to the result list
//
// The UI layer does NOT:
//   • build prompts
//   • call KIE or Gemini directly
//   • know which engine handles which asset type
//
// All routing happens inside the registry (P3 / P5 / P6 / P8).

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Loader2, UserRound, Package, Upload, ChevronLeft, Sliders, X as XIcon } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { saveAsset } from '../../utils/assetStore'
import BankPicker from '../../components/BankPicker'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import { useSessionPersist } from '../../services/sessionPersistence'
import type { Product, Model } from '../../stores/types'

import type { AssetTypeId } from './types/asset'
import { generateAssets } from './orchestration/generateAssets'
import AssetTypePicker from './uiCatalog/AssetTypePicker'
import AssetControls, { type AssetOptions } from './uiCatalog/AssetControls'
import ResultCard, { type ResultRow } from './uiCatalog/ResultCard'
import { findCatalogEntry } from './uiCatalog/assetCatalog'

// ── Picker tile (reusable for product + avatar) ─────────────────────────────

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

// ── Session persisted snapshot (P11 — v2 schema) ────────────────────────────
// Bumped version from 1 → 2: old v1 state (sceneId/styleId/tiles) is
// ignored automatically by useSessionPersist's version check.

interface CreativeStudioPersistedV2 {
  v: 2
  selectedAssetTypeId: AssetTypeId | null
  selectedAvatarId: string | null
  selectedProductId: string | null
  uploadedAvatarRef: string | null
  uploadedProductRef: string | null
  options: AssetOptions
  /** Saved completed asset rows. Pending rows are flattened to error. */
  results: ResultRow[]
  savedRowIds: string[]
}

// ── Main component ──────────────────────────────────────────────────────────

export default function CreativeStudio() {
  const [selectedAssetTypeId, setSelectedAssetTypeId] = useState<AssetTypeId | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState<Model | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null)
  const [uploadedProductUrl, setUploadedProductUrl] = useState<string | null>(null)
  const [pickerMode, setPickerMode] = useState<'avatar' | 'product' | null>(null)
  const [options, setOptions] = useState<AssetOptions>({ styleId: 'realistic' })
  const [results, setResults] = useState<ResultRow[]>([])
  const [savedRowIds, setSavedRowIds] = useState<Set<string>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)

  const kieApiKey    = useSettingsStore((s) => s.kieApiKey)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const addToast     = useAppStore((s) => s.addToast)
  const addBRoll     = useBankStore((s) => s.addBRoll)
  const models       = useBankStore((s) => s.models)
  const products     = useBankStore((s) => s.products)

  const catalogEntry = selectedAssetTypeId ? findCatalogEntry(selectedAssetTypeId) : null
  const isPhotographic   = catalogEntry?.group === 'photographic'
  const isUiNative       = catalogEntry?.group === 'ui-native'
  const isDesignedGraphic = catalogEntry?.group === 'designed-graphic'

  const avatarImageRef  = selectedAvatar?.characterImage  ?? uploadedAvatarUrl
  const productImageRef = selectedProduct?.productImage ?? uploadedProductUrl
  const productSelected = !!productImageRef

  // Engine-specific API key requirements
  const needsGemini = isUiNative || isDesignedGraphic  // text generation
  const needsKie    = isPhotographic || isUiNative      // image generation (avatar for ui-native)
  const apiKeysOk   =
    (!needsKie    || !!kieApiKey) &&
    (!needsGemini || !!geminiApiKey)
  const canGenerate = !!selectedAssetTypeId && productSelected && apiKeysOk && !isGenerating

  // ── Session persistence ───────────────────────────────────────────────
  const flattenPending = (rs: ResultRow[]): ResultRow[] => rs.map((r) =>
    r.status === 'pending'
      ? { ...r, status: 'error', errorMessage: 'Bị gián đoạn — thử lại' }
      : r,
  )

  const sessionApi = useSessionPersist<CreativeStudioPersistedV2>({
    moduleId: 'broll-studio',  // persistKey 'ugc-lab:broll-studio:inflight-v1' kept for back-compat
    version: 2,
    snapshot: () => ({
      v: 2,
      selectedAssetTypeId,
      selectedAvatarId: selectedAvatar?.id ?? null,
      selectedProductId: selectedProduct?.id ?? null,
      uploadedAvatarRef: uploadedAvatarUrl,
      uploadedProductRef: uploadedProductUrl,
      options,
      results: flattenPending(results),
      savedRowIds: [...savedRowIds],
    }),
    hydrate: (data) => {
      if (data.v !== 2) return  // old v1 schema — discard, user starts fresh
      setSelectedAssetTypeId(data.selectedAssetTypeId)
      if (data.selectedAvatarId) {
        const m = models.find((x) => x.id === data.selectedAvatarId)
        if (m) setSelectedAvatar(m)
      }
      if (data.selectedProductId) {
        const p = products.find((x) => x.id === data.selectedProductId)
        if (p) setSelectedProduct(p)
      }
      setUploadedAvatarUrl(data.uploadedAvatarRef)
      setUploadedProductUrl(data.uploadedProductRef)
      setOptions(data.options ?? { styleId: 'realistic' })
      setResults(flattenPending(data.results ?? []))
      setSavedRowIds(new Set(data.savedRowIds ?? []))
      addToast('✓ Đã khôi phục Creative Studio từ phiên trước', 'success')
    },
    getStatus: () => (
      isGenerating ? 'in-progress'
        : results.length > 0 ? 'paused'
        : 'completed'
    ),
    getProgressVi: () => {
      if (isGenerating) return 'Đang tạo asset...'
      if (results.length > 0) return `${results.filter((r) => r.status === 'done').length}/${results.length} asset`
      return undefined
    },
    getTitleVi: () => {
      const label = catalogEntry?.title.vi
      const product = selectedProduct?.productName
      if (label && product) return `${label} — ${product}`
      return label ?? product
    },
    shouldPersist: () =>
      results.length > 0 || !!productImageRef || !!avatarImageRef || !!selectedAssetTypeId || isGenerating,
    deps: [
      selectedAssetTypeId, selectedAvatar?.id, selectedProduct?.id,
      uploadedAvatarUrl, uploadedProductUrl, options, results, savedRowIds, isGenerating,
    ],
  })

  // ── Generation flow — ALL through generateAssets() ────────────────────
  const handleGenerate = async () => {
    if (!canGenerate || !selectedAssetTypeId || !selectedProduct) return
    const entry = catalogEntry!
    setIsGenerating(true)

    const rowId = `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const pendingRow: ResultRow = {
      rowId,
      status: 'pending',
      requestedAt: Date.now(),
      assetTypeId: selectedAssetTypeId,
    }
    setResults((prev) => [pendingRow, ...prev])

    try {
      // UI builds the payload. Registry handles routing. Engine handles
      // KIE / Gemini / canvas. No prompt logic here.
      const asset = await generateAssets(selectedAssetTypeId, {
        productId: selectedProduct.id,
        modelId: entry.group === 'photographic' ? selectedAvatar?.id : undefined,
        options: options as Record<string, unknown>,
      })
      setResults((prev) => prev.map((r) => r.rowId === rowId ? { ...r, status: 'done', asset } : r))
      addToast(`✓ Đã tạo ${entry.title.vi}`)
    } catch (err) {
      // P12-fix: hide raw technical errors from users. Full detail stays
      // in console + on the result card's errorMessage for diagnostics.
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error('[CreativeStudio] generateAssets failed:', err)
      setResults((prev) => prev.map((r) => r.rowId === rowId ? { ...r, status: 'error', errorMessage: msg } : r))
      const friendly = msg.toLowerCase().includes('api key')
        ? 'Thiếu API key — vào Cài đặt để thêm'
        : msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('insufficient')
        ? 'Hết KIE credit — nạp thêm rồi thử lại'
        : 'Tạo asset chưa thành công — vui lòng thử lại'
      addToast(friendly, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Save handler — persist generated asset into bankStore B-Roll ──────
  const handleSaveRow = async (row: ResultRow) => {
    if (!row.asset || savedRowIds.has(row.rowId)) return
    const entry = findCatalogEntry(row.assetTypeId as AssetTypeId)
    try {
      await addBRoll({
        imageUrl: row.asset.outputUrl,
        prompt: `Creative Studio — ${entry?.title.vi ?? row.assetTypeId} (${row.asset.metadata.engineGroup})`,
        productId: row.asset.metadata.productId,
        modelId: row.asset.metadata.modelId,
      })
      setSavedRowIds((prev) => new Set(prev).add(row.rowId))
      addToast('✓ Đã lưu vào Project → Creative Studio')
    } catch (err) {
      addToast(`Lưu thất bại: ${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}`, 'error')
    }
  }

  const handleDeleteRow = (rowId: string) => {
    setResults((prev) => prev.filter((r) => r.rowId !== rowId))
    setSavedRowIds((prev) => { const next = new Set(prev); next.delete(rowId); return next })
  }

  // ── File handlers (asset:// persisted refs) ───────────────────────────
  const handleSelectAvatar = (item: unknown) => {
    setSelectedAvatar(item as Model)
    setUploadedAvatarUrl(null)
    setPickerMode(null)
  }
  const handleSelectProduct = (item: unknown) => {
    setSelectedProduct(item as Product)
    setUploadedProductUrl(null)
    setPickerMode(null)
  }
  const handleUploadAvatar = async (file: File) => {
    try {
      const ref = await saveAsset(file, file.type || 'image/jpeg')
      setUploadedAvatarUrl(ref)
      setSelectedAvatar(null)
    } catch (err) {
      addToast(`Upload avatar lỗi: ${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}`, 'error')
    }
  }
  const handleUploadProduct = async (file: File) => {
    try {
      const ref = await saveAsset(file, file.type || 'image/jpeg')
      setUploadedProductUrl(ref)
      setSelectedProduct(null)
    } catch (err) {
      addToast(`Upload sản phẩm lỗi: ${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}`, 'error')
    }
  }

  // ── Mobile output-first viewport (M4) ────────────────────────────────
  //
  // Mirror of the Landing Page M3 pattern: after a result lands, the
  // input + controls panel auto-collapses on mobile so the result grid
  // owns the viewport. A floating "Tuỳ chỉnh" FAB re-opens the controls
  // when the user wants to regenerate / change settings. Desktop (lg+)
  // keeps the side-by-side layout unchanged.
  const [mobileControlsVisible, setMobileControlsVisible] = useState(true)
  const prevResultsCountRef = useRef(results.length)
  useEffect(() => {
    // Detect first result transition (0 → 1+). Auto-hide controls so
    // the user lands directly in the gallery on mobile.
    if (prevResultsCountRef.current === 0 && results.length > 0) {
      setMobileControlsVisible(false)
    }
    prevResultsCountRef.current = results.length
  }, [results.length])

  // Controls panel always visible when there are NO results yet (user
  // must fill the form to generate anything) OR on desktop.
  const showControlsOnMobile = results.length === 0 || mobileControlsVisible

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="absolute right-4 top-4 z-30">
        <AutoSaveIndicator lastSavedAt={sessionApi.lastSavedAt} lastSaveOk={sessionApi.lastSaveOk} />
      </div>

      {/* Header — compact padding + smaller title + hidden description
          on mobile. Description provides context but burns ~60px vertical
          on phones; users only need it once and can reopen the app to
          re-read. */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50 to-pink-50 px-3 md:px-6 py-2 md:py-4">
        <h1 className="text-base md:text-xl font-bold tracking-tight text-gray-900">Creative Studio</h1>
        <p className="hidden md:block mt-0.5 text-xs text-gray-500">
          AI conversion creative operating system — photographic / UI-native / designed-graphic, mỗi loại đi qua engine riêng.
        </p>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 md:p-6 pb-20 lg:pb-6 lg:flex-row lg:gap-5">
        {/* ── STEP 1: Asset type picker — full width when no selection ── */}
        {!selectedAssetTypeId ? (
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Bước 1</p>
              <h2 className="text-lg font-semibold tracking-tight text-gray-900">Chọn loại creative bạn muốn tạo</h2>
              <p className="text-xs text-gray-500">
                Mỗi loại đi qua một engine riêng (photographic / UI-native / designed-graphic) — không còn scene + style chips chung.
              </p>
            </div>
            <AssetTypePicker selectedId={null} onSelect={setSelectedAssetTypeId} />
          </div>
        ) : (
          <>
            {/* ── STEP 2+: Left panel (inputs + controls) ─────────────
                On mobile, hidden after first result lands (user can
                re-open via floating FAB). On lg+ always visible at
                the 320px sidebar width. */}
            <div className={`${showControlsOnMobile ? 'flex' : 'hidden'} lg:flex w-full shrink-0 flex-col gap-3 lg:w-80`}>
              {/* Selected asset type pill + change */}
              <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700">Đang tạo</span>
                  <span className="truncate text-sm font-semibold text-gray-900">{catalogEntry?.title.vi}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAssetTypeId(null)}
                  className="flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-100"
                >
                  <ChevronLeft className="h-3 w-3" /> Đổi loại
                </button>
              </div>

              <PickerTile
                label="Sản phẩm (bắt buộc)"
                hint="Ảnh sản phẩm rõ packaging / logo / label"
                accent="product"
                imageUrl={productImageRef}
                onSelectFromBank={() => setPickerMode('product')}
                onUpload={handleUploadProduct}
                onClear={() => { setSelectedProduct(null); setUploadedProductUrl(null) }}
              />

              {/* Avatar — only relevant for photographic */}
              {isPhotographic && (
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

              {/* Engine-aware controls */}
              {catalogEntry && (
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
              )}

              {/* Generate button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-500 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo qua engine...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Tạo asset</>
                )}
              </button>

              {/* API key warnings */}
              {needsKie && !kieApiKey && (
                <p className="text-center text-[10px] text-red-500">Cần KIE.ai API key trong Cài đặt</p>
              )}
              {needsGemini && !geminiApiKey && (
                <p className="text-center text-[10px] text-red-500">Cần Gemini API key trong Cài đặt</p>
              )}
            </div>

            {/* ── Right: typed result list ─────────────────────────── */}
            <div className="flex-1">
              {results.length === 0 ? (
                <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-dashed border-black/10 bg-white">
                  <div className="flex flex-col items-center gap-3 px-6 text-center">
                    <Sparkles className="h-10 w-10 text-gray-200" />
                    <p className="text-sm text-gray-400">Chọn Sản phẩm + cài đặt rồi nhấn "Tạo asset"</p>
                    <p className="text-xs text-gray-300">
                      Asset sẽ đi qua engine <span className="font-mono">{catalogEntry?.group}</span> — không qua legacy GPT direct call
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {results.map((row) => (
                    <ResultCard
                      key={row.rowId}
                      row={row}
                      saved={savedRowIds.has(row.rowId)}
                      onSave={() => handleSaveRow(row)}
                      onDelete={() => handleDeleteRow(row.rowId)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
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

      {/* Mobile-only floating "Tuỳ chỉnh / Đóng" FAB — same UX pattern as
          Landing Page M3. Only rendered after an asset type is picked AND
          at least one result exists, so the user has something to flip
          between. Hidden on lg+ since the side-by-side layout doesn't
          need a toggle. */}
      {selectedAssetTypeId && results.length > 0 && (
        <button
          onClick={() => setMobileControlsVisible((v) => !v)}
          aria-label={showControlsOnMobile ? 'Đóng tuỳ chỉnh' : 'Mở tuỳ chỉnh'}
          title={showControlsOnMobile ? 'Đóng tuỳ chỉnh' : 'Mở tuỳ chỉnh'}
          className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-3 text-[12px] font-bold text-white shadow-lg shadow-violet-900/30 hover:bg-violet-700 active:scale-95 transition-transform"
        >
          {showControlsOnMobile
            ? <><XIcon className="h-4 w-4" /> Đóng</>
            : <><Sliders className="h-4 w-4" /> Tuỳ chỉnh</>}
        </button>
      )}
    </div>
  )
}
