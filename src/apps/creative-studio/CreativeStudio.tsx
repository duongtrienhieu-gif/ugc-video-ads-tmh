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
import { Sparkles, Loader2, UserRound, Package, Zap } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import BankPicker from '../../components/BankPicker'
import type { Product, Model } from '../../stores/types'

import type { AssetTypeId } from './types/asset'
import type { UINativeLocale } from './types/uiNative'
import { runGeneration } from './runtime/runGeneration'
import { useGenerationsStore, type GenerationJob } from './stores/generationsStore'
import AssetTypePicker from './uiCatalog/AssetTypePicker'
import ResultCard from './uiCatalog/ResultCard'
import { findCatalogEntry, requirementsFor } from './uiCatalog/assetCatalog'
import { rememberAvatarForProduct, recallAvatarForProduct } from './shared/recommendations/avatarMemory'
import { useBankStore } from '../../stores/bankStore'

// ── PickerTile (product / avatar) ──────────────────────────────────────
//
// P26 — Project-only selection. Spec: Creative Studio MUST NOT rely on
// manual upload. User selects from the Project bank; we auto-load product
// image + metadata + benefits + USPs + ingredients + audience + locale.
// Upload entry-point removed entirely.

interface PickerTileProps {
  imageUrl: string | null
  label: string
  hint: string
  accent: 'product' | 'avatar'
  /** Display name pulled from the selected bank record. */
  itemName?: string | null
  onSelectFromBank: () => void
  onClear: () => void
}

function PickerTile({ imageUrl, label, hint, accent, itemName, onSelectFromBank, onClear }: PickerTileProps) {
  const resolvedUrl = useAssetUrl(imageUrl ?? undefined)
  const display = imageUrl?.startsWith('http') || imageUrl?.startsWith('data:') || imageUrl?.startsWith('blob:') ? imageUrl : resolvedUrl
  const isAvatar = accent === 'avatar'
  const accentBorder = accent === 'product' ? 'border-rose-200' : 'border-violet-200'
  const accentBg     = accent === 'product' ? 'bg-rose-50'      : 'bg-violet-50'
  const accentText   = accent === 'product' ? 'text-rose-700'   : 'text-violet-700'

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-black/10 bg-white p-1.5">
      <div className="flex items-center justify-between">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-gray-600">
          {label}
        </p>
        {imageUrl && (
          <button type="button" onClick={onClear} className="shrink-0 text-[9px] text-gray-400 hover:text-red-500">Bỏ</button>
        )}
      </div>
      <div className="h-16 w-full overflow-hidden rounded border border-dashed border-black/10 bg-gray-50">
        {display ? (
          <img src={display} alt={label} className={`h-full w-full ${accent === 'product' ? 'object-contain p-0.5' : 'object-cover'}`} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            {isAvatar ? <UserRound className="h-5 w-5" strokeWidth={1.2} /> : <Package className="h-5 w-5" strokeWidth={1.2} />}
          </div>
        )}
      </div>
      {display && itemName && (
        <p className="line-clamp-1 text-[10px] font-semibold text-gray-700">{itemName}</p>
      )}
      {!display && hint && <p className="line-clamp-1 text-[9px] text-gray-400">{hint}</p>}
      <button
        type="button"
        onClick={onSelectFromBank}
        className={`flex w-full items-center justify-center rounded border ${accentBorder} ${accentBg} px-1 py-1 text-[10px] font-semibold ${accentText} hover:opacity-80`}
      >
        {display ? 'Đổi từ Project' : 'Chọn từ Project'}
      </button>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────

export default function CreativeStudio() {
  // ── Input panel state — left side ──────────────────────────────────
  //
  // P26 (Phase 2): project-only selection — no manual upload, no
  // optional marketing-copy inputs. Product / Avatar come from the
  // Project bank. Generation uses the full ProductKnowledge profile
  // (P25) auto-loaded from the selected product.
  const [selectedAssetTypeId, setSelectedAssetTypeId] = useState<AssetTypeId | null>(null)
  const [selectedAvatar, setSelectedAvatar]    = useState<Model | null>(null)
  const [selectedProduct, setSelectedProduct]  = useState<Product | null>(null)
  const [pickerMode, setPickerMode]            = useState<'avatar' | 'product' | null>(null)
  // P31 — user-selected locale. Persisted to localStorage so the choice
  // survives reload. Falls back to vi-VN on first visit.
  const [selectedLocale, setSelectedLocale] = useState<UINativeLocale>(() => {
    try {
      const stored = localStorage.getItem('creative-studio:locale')
      if (stored === 'vi-VN' || stored === 'my-MY' || stored === 'id-ID' || stored === 'global') return stored
    } catch { /* localStorage unavailable */ }
    return 'vi-VN'
  })
  useEffect(() => {
    try { localStorage.setItem('creative-studio:locale', selectedLocale) } catch { /* silent */ }
  }, [selectedLocale])

  // ── Bank / settings / toasts ───────────────────────────────────────
  const kieApiKey    = useSettingsStore((s) => s.kieApiKey)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const addToast     = useAppStore((s) => s.addToast)
  const allModels    = useBankStore((s) => s.models)

  // ── Generations store — DB-backed job list (right panel) ───────────
  const jobs        = useGenerationsStore((s) => s.jobs)
  const hydrate     = useGenerationsStore((s) => s.hydrate)
  const hydrated     = useGenerationsStore((s) => s.hydrated)
  const hydrating    = useGenerationsStore((s) => s.hydrating)
  const hydrateError = useGenerationsStore((s) => s.hydrateError)
  const removeJob    = useGenerationsStore((s) => s.removeJob)

  // Hydrate once on mount — pulls full history from Supabase
  useEffect(() => { void hydrate() }, [hydrate])

  // P30 — Avatar consistency memory. When the user picks an avatar
  // for a product, remember it; when they re-select the same product,
  // auto-recall the last avatar so multi-creative campaigns share
  // the same AI persona across creatives.
  useEffect(() => {
    if (selectedProduct?.id && selectedAvatar?.id) {
      rememberAvatarForProduct(selectedProduct.id, selectedAvatar.id)
    }
  }, [selectedProduct?.id, selectedAvatar?.id])

  // Recall the remembered avatar when product changes and the user
  // hasn't picked an avatar yet. Don't overwrite an explicit choice.
  useEffect(() => {
    if (!selectedProduct?.id || selectedAvatar) return
    const rememberedId = recallAvatarForProduct(selectedProduct.id)
    if (!rememberedId) return
    const found = allModels.find((m) => m.id === rememberedId)
    if (found) {
      setSelectedAvatar(found)
      console.info('[CreativeStudio] avatar consistency memory — recalled', { productId: selectedProduct.id, modelId: found.id })
    }
  }, [selectedProduct?.id, allModels, selectedAvatar])

  // P30 — input panel scroll target so suggestion clicks scroll back
  // to the top of the left panel after selecting a follow-up creative.
  const inputPanelRef = useRef<HTMLDivElement>(null)

  function handleSuggestion(id: AssetTypeId) {
    setSelectedAssetTypeId(id)
    inputPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Derived: requirements drive which input tiles to render ────────
  const catalogEntry = selectedAssetTypeId ? findCatalogEntry(selectedAssetTypeId) : null
  const reqs = useMemo(
    () => selectedAssetTypeId ? requirementsFor(selectedAssetTypeId) : null,
    [selectedAssetTypeId],
  )

  const avatarImageRef  = selectedAvatar?.characterImage ?? null
  const productImageRef = selectedProduct?.productImage ?? null

  // ── Generation gate — required inputs present + API keys configured ─
  const isPhotographic    = catalogEntry?.group === 'photographic'
  const isUiNative        = catalogEntry?.group === 'ui-native'
  const isDesignedGraphic = catalogEntry?.group === 'designed-graphic'

  const needsGemini = isUiNative || isDesignedGraphic
  const needsKie    = isPhotographic || isUiNative
  const apiKeysOk   = (!needsKie || !!kieApiKey) && (!needsGemini || !!geminiApiKey)

  const reqsMet     = !reqs || (!reqs.requireProduct || !!productImageRef)
  const isComingSoon = !!catalogEntry?.comingSoon
  const canGenerate = !!selectedAssetTypeId && apiKeysOk && reqsMet && !isComingSoon

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
    const payload = {
      creativeType: selectedAssetTypeId,
      inputs: {
        productId: selectedProduct?.id,
        modelId:   reqs?.requireAvatar ? selectedAvatar?.id : undefined,
        options:   { locale: selectedLocale },   // P31 — user-chosen locale
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

  // ── Bank handlers (P26 — project-only) ─────────────────────────────
  const handleSelectAvatar  = (item: unknown) => { setSelectedAvatar(item as Model);   setPickerMode(null) }
  const handleSelectProduct = (item: unknown) => { setSelectedProduct(item as Product); setPickerMode(null) }

  // ── Render ─────────────────────────────────────────────────────────
  const activeCount    = jobs.filter((j) => j.status === 'generating' || j.status === 'queued').length
  const completedCount = jobs.filter((j) => j.status === 'completed').length

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Header — Creative Operating System tone (P26) */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50 to-pink-50 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
            AI
          </span>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Creative Studio</h1>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Conversion creative workspace — chọn sản phẩm, chọn loại creative, render nhiều job song song.
        </p>
      </div>

      {/* Body — workspace split (P16: 1fr/2fr = 33% / 67%) */}
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] grid-cols-1 overflow-hidden lg:grid-cols-[1fr_2fr]">
        {/* ── LEFT: input panel ─────────────────────────────────
               P23: aside is a 2-region flex column with sticky top.
               P24 fix: explicit `min-h-0 overflow-hidden` on the aside
               itself — without this, the aside grows to fit its child
               content (picker is long), so the inner flex-1 scroll
               region has no constrained parent to scroll against. The
               grid-rows-[minmax(0,1fr)] on the parent forces the row
               to honor the parent's height instead of fitting content. */}
        <aside className="flex min-h-0 flex-col overflow-hidden border-b border-r-0 border-black/8 bg-white/40 lg:border-b-0 lg:border-r">
          {/* ── STICKY INPUT REGION ──────────────────────────────── */}
          <div ref={inputPanelRef} className="shrink-0 border-b border-black/8 bg-white/60 p-4 backdrop-blur-sm">
            <section>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                {reqs?.requireAvatar ? 'Sản phẩm + Avatar' : 'Sản phẩm'}
              </p>
              <div className="flex gap-2">
                <div className={reqs?.requireAvatar ? 'flex-1 min-w-0' : 'w-full'}>
                  <PickerTile
                    label="Sản phẩm"
                    hint="Chọn từ Project"
                    accent="product"
                    imageUrl={productImageRef}
                    itemName={selectedProduct?.productName}
                    onSelectFromBank={() => setPickerMode('product')}
                    onClear={() => setSelectedProduct(null)}
                  />
                </div>
                {reqs?.requireAvatar && (
                  <div className="flex-1 min-w-0">
                    <PickerTile
                      label="Avatar AI"
                      hint="Chọn từ Project"
                      accent="avatar"
                      imageUrl={avatarImageRef}
                      itemName={selectedAvatar?.name}
                      onSelectFromBank={() => setPickerMode('avatar')}
                      onClear={() => setSelectedAvatar(null)}
                    />
                  </div>
                )}
              </div>

              {/* P26 — auto-loaded project intelligence hint. Surfaces
                  that the system pulled benefits / USPs / audience /
                  locale from the Project record (P25 ProductKnowledge). */}
              {selectedProduct && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md border border-violet-100 bg-violet-50/50 px-2 py-1.5">
                  <Zap className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" strokeWidth={2.2} />
                  <p className="text-[10px] leading-snug text-violet-700">
                    Đã tải benefits · USP · pain points · audience · locale từ Project — AI dùng cho mọi creative.
                  </p>
                </div>
              )}
            </section>

            {/* P31 — Locale selector. Controls every Gemini call + Canvas
                template UI string. Persisted to localStorage. */}
            <section className="mt-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Ngôn ngữ output
              </p>
              <div className="grid grid-cols-4 gap-1">
                {([
                  { code: 'vi-VN',  flag: '🇻🇳', label: 'VN' },
                  { code: 'my-MY',  flag: '🇲🇾', label: 'MY' },
                  { code: 'id-ID',  flag: '🇮🇩', label: 'ID' },
                  { code: 'global', flag: '🌐', label: 'EN' },
                ] as const).map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setSelectedLocale(opt.code)}
                    className={`flex items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold transition-colors ${
                      selectedLocale === opt.code
                        ? 'border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-200'
                        : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.04]'
                    }`}
                  >
                    <span>{opt.flag}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* GENERATE button — premium compact action (P26)
                48px height, rounded-xl, gradient + subtle inner ring. */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 text-[13px] font-bold tracking-wide text-white shadow-[0_4px_12px_-2px_rgba(124,58,237,0.4)] ring-1 ring-inset ring-white/10 transition-all hover:from-violet-700 hover:to-fuchsia-700 hover:shadow-[0_6px_16px_-2px_rgba(124,58,237,0.55)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <Sparkles className="h-4 w-4" /> Tạo creative
            </button>

            {/* Compact inline status hints */}
            {!selectedAssetTypeId && (
              <p className="mt-1.5 text-center text-[10px] text-gray-400">
                ↓ Chọn loại creative phía dưới
              </p>
            )}
            {selectedAssetTypeId && reqs?.requireProduct && !productImageRef && (
              <p className="mt-1.5 text-center text-[10px] text-amber-600">
                ↑ Chọn sản phẩm từ Project
              </p>
            )}
            {needsKie && !kieApiKey && (
              <p className="mt-1.5 text-center text-[10px] text-red-500">Cần KIE.ai API key trong Cài đặt</p>
            )}
            {needsGemini && !geminiApiKey && (
              <p className="mt-1.5 text-center text-[10px] text-red-500">Cần Gemini API key trong Cài đặt</p>
            )}
          </div>

          {/* ── SCROLLABLE CREATIVE LIST ────────────────────────── */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <section>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                Loại creative
              </p>
              <AssetTypePicker selectedId={selectedAssetTypeId} onSelect={setSelectedAssetTypeId} />
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

          {/* P26 — soft hydrate failure notice. Single-line, neutral,
              user-facing only. Spec: never expose schema / migration /
              supabase / database. */}
          {hydrateError && (
            <div className="mx-5 mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-700">
              Không tải được lịch sử render — bạn vẫn tạo creative mới được, lịch sử sẽ tự đồng bộ lại sau.
            </div>
          )}

          {/* Workspace grid — P30: campaign auto-grouped by productId */}
          <div className="flex-1 overflow-y-auto p-5">
            {hydrated && jobs.length === 0 ? (
              <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-dashed border-black/10 bg-white">
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <Sparkles className="h-10 w-10 text-gray-200" />
                  <p className="text-sm font-semibold text-gray-500">Live creative board</p>
                  <p className="max-w-[280px] text-xs leading-relaxed text-gray-400">
                    Chọn sản phẩm + loại creative ở panel trái → bấm Tạo. Render chạy song song, kết quả hiện tại đây.
                  </p>
                </div>
              </div>
            ) : (
              <CampaignGroupedHistory
                jobs={jobs}
                onDelete={handleDeleteJob}
                onSuggest={handleSuggestion}
              />
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
  onSuggest,
}: {
  job: GenerationJob
  onDelete: () => void
  onSuggest?: (id: AssetTypeId) => void
}) {
  return <ResultCard job={job} onDelete={onDelete} onSuggest={onSuggest} />
})

// ── Campaign auto-grouped history (P30) ──────────────────────────────
//
// Groups workspace jobs by productId so multi-creative campaigns
// surface as visual clusters in the right panel. Each group renders a
// product header (thumb + name + counts) followed by its jobs in a
// responsive grid. Jobs without a product land in a "Không sản phẩm"
// bucket at the end.

function CampaignGroupedHistory({
  jobs,
  onDelete,
  onSuggest,
}: {
  jobs: GenerationJob[]
  onDelete: (id: string) => void
  onSuggest: (id: AssetTypeId) => void
}) {
  const bank = useBankStore.getState()
  const groups = useMemo(() => {
    const map = new Map<string, { productId: string | null; jobs: GenerationJob[] }>()
    for (const job of jobs) {
      const pid = job.inputs?.productId ?? null
      const key = pid ?? '__no_product__'
      const bucket = map.get(key)
      if (bucket) {
        bucket.jobs.push(job)
      } else {
        map.set(key, { productId: pid, jobs: [job] })
      }
    }
    return Array.from(map.values())
  }, [jobs])

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group, idx) => {
        const product = group.productId ? bank.getProductById(group.productId) : null
        const completed = group.jobs.filter((j) => j.status === 'completed').length
        const active    = group.jobs.filter((j) => j.status === 'generating' || j.status === 'queued').length
        return (
          <section key={group.productId ?? `no-product-${idx}`}>
            <header className="mb-2 flex items-center gap-2.5">
              {product?.productImage ? (
                <CampaignThumb assetRef={product.productImage} />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-black/15 bg-gray-50 text-gray-400">
                  <Package className="h-4 w-4" strokeWidth={1.4} />
                </div>
              )}
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <h3 className="truncate text-[13px] font-bold text-gray-800">
                  {product?.productName ?? 'Không sản phẩm'}
                </h3>
                <span className="text-[10px] text-gray-400">
                  {group.jobs.length} creative · {completed} xong
                  {active > 0 ? ` · ${active} đang chạy` : ''}
                </span>
              </div>
            </header>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {group.jobs.map((job) => (
                <JobCardWrapper
                  key={job.id}
                  job={job}
                  onDelete={() => onDelete(job.id)}
                  onSuggest={onSuggest}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function CampaignThumb({ assetRef }: { assetRef: string }) {
  const url = useAssetUrl(assetRef)
  if (!url) return (
    <div className="h-8 w-8 shrink-0 rounded-md bg-gray-100" />
  )
  return (
    <img
      src={url}
      alt=""
      className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-black/10"
    />
  )
}
