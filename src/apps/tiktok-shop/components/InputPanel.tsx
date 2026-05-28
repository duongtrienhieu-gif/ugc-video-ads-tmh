// InputPanel — left column of TikTok Shop app.
// Brand Kit picker + Product picker + reference image upload + language toggle
// + cost estimate + generate button.
// Phase 3: Generate runs real kie.ai pipeline for Slot 1 (others land Phase 4).

import { useEffect, useRef, useState } from 'react'
import {
  Palette, Package, Upload, X, Globe, Sparkles, Loader2, AlertCircle, Info,
} from 'lucide-react'
import { useBrandKitStore, isBrandKitReady } from '../../../stores/brandKitStore'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { MARKET_LABELS, type Market } from '../../../types/brandKit'
import { saveAsset, getUrl } from '../../../utils/assetStore'
import { getKieCredits } from '../../../utils/kieai'
import { useTikTokShopStore, checkDraftReadiness } from '../store'
import {
  CREDIT_COST_PER_IMAGE_1K,
  CREDIT_COST_PER_IMAGE_2K,
  SLOT_MAP,
  snapToPaletteFamily,
} from '../constants'
import { useResolvedBrandKit } from '../canvas/useResolvedBrandKit'
import { generateSlotImage, friendlyErrorMessage } from '../services/generateSlot'
import CostEstimator from './CostEstimator'

export default function InputPanel() {
  const draft         = useTikTokShopStore((s) => s.draft)
  const selectBrandKit = useTikTokShopStore((s) => s.selectBrandKit)
  const selectProduct  = useTikTokShopStore((s) => s.selectProduct)
  const setLanguage    = useTikTokShopStore((s) => s.setLanguage)
  const addRef         = useTikTokShopStore((s) => s.addReferenceImage)
  const removeRef      = useTikTokShopStore((s) => s.removeReferenceImage)
  const initializeOutput = useTikTokShopStore((s) => s.initializeListingOutput)
  const setSlotStatus    = useTikTokShopStore((s) => s.setSlotStatus)
  const setSlotImage     = useTikTokShopStore((s) => s.setSlotImage)
  const setIsGenerating  = useTikTokShopStore((s) => s.setIsGenerating)
  const isGenerating     = useTikTokShopStore((s) => s.draft.isGenerating)

  const brandKits   = useBrandKitStore((s) => s.brandKits)
  const products    = useBankStore((s) => s.products)
  const getProductById = useBankStore((s) => s.getProductById)
  const hasApiKey   = useSettingsStore((s) => s.hasApiKey())
  const kieApiKey   = useSettingsStore((s) => s.kieApiKey)
  const kieCredits  = useSettingsStore((s) => s.kieCredits)
  const setKieCredits = useSettingsStore((s) => s.setKieCredits)
  const openApp     = useAppStore((s) => s.openApp)
  const addToast    = useAppStore((s) => s.addToast)

  const [uploading, setUploading] = useState(false)
  const [costModalOpen, setCostModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filter brand kits by selected market — only show kits that target the
  // current language so user doesn't accidentally use a VN kit for an MS listing.
  const availableBrandKits = brandKits.filter((k) => k.markets.includes(draft.market))
  const selectedKit = brandKits.find((k) => k.id === draft.brandKitId)
  const kitReady    = selectedKit ? isBrandKitReady(selectedKit).ready : false

  // Resolve brand kit + palette for generation (falls back to mock when no
  // brand kit selected, but Generate is blocked until one is)
  const resolvedBrandKit = useResolvedBrandKit(draft.brandKitId, draft.market)
  const paletteFamily = snapToPaletteFamily(resolvedBrandKit.palette.primary)

  const readiness = checkDraftReadiness(draft, kitReady, hasApiKey)

  // Phase 3: only Slot 1 generates → cost is just that one image.
  // Phase 4 will switch to full-9-slot cost via estimateListingCredits().
  const slot1Config = SLOT_MAP[0]
  const estimatedCost = slot1Config.highRes ? CREDIT_COST_PER_IMAGE_2K : CREDIT_COST_PER_IMAGE_1K

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    if (draft.referenceImageAssetIds.length + files.length > 5) {
      addToast('Tối đa 5 ảnh tham chiếu', 'error')
      return
    }
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          addToast(`${file.name} không phải ảnh — bỏ qua`, 'error')
          continue
        }
        const assetId = await saveAsset(file, file.type)
        addRef(assetId)
      }
    } catch (err) {
      addToast(`Tải ảnh thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleGenerate() {
    if (!readiness.ready) return
    setCostModalOpen(true)
  }

  async function handleConfirmGenerate() {
    setCostModalOpen(false)
    if (!draft.brandKitId || !draft.productId) return
    const product = getProductById(draft.productId)
    if (!product) {
      addToast('Không tìm thấy sản phẩm', 'error')
      return
    }

    // 1. Initialize 9-slot output (Phase 3 only fills slot 1; others stay pending)
    initializeOutput({
      productId: draft.productId,
      brandKitId: draft.brandKitId,
      brandKitVersion: selectedKit?.version ?? 1,
      market: draft.market,
      paletteFamily,
    })
    setIsGenerating(true)
    setSlotStatus(1, 'generating')

    try {
      const { assetId, prompt } = await generateSlotImage({
        apiKey: kieApiKey,
        brandKit: resolvedBrandKit,
        product,
        slotConfig: slot1Config,
        paletteFamily,
        language: draft.market,
        referenceImageAssetIds: draft.referenceImageAssetIds,
        onStatus: (s) => console.log('[tiktok-shop] slot 1 status:', s),
      })
      setSlotImage(1, assetId, prompt)
      addToast('Đã tạo Slot 1 — kiểm tra grid giữa', 'success')

      // Refresh credit balance so the sidebar number updates
      try {
        const newCredits = await getKieCredits(kieApiKey)
        setKieCredits(newCredits)
      } catch { /* silent — UI just shows stale number */ }
    } catch (err) {
      const msg = friendlyErrorMessage(err)
      setSlotStatus(1, 'failed', msg)
      addToast(`Slot 1 lỗi: ${msg}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-gray-200 bg-[#FAFAFA] p-4">
      {/* ── Language toggle ─────────────────────────────────────────── */}
      <Section icon={<Globe className="h-4 w-4" />} title="Ngôn ngữ output">
        <div className="flex gap-2">
          {(['ms', 'vi'] as Market[]).map((m) => (
            <button
              key={m}
              onClick={() => setLanguage(m)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                draft.market === m
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {m === 'ms' ? '🇲🇾' : '🇻🇳'} {MARKET_LABELS[m]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-gray-500">
          Chỉ 1 ngôn ngữ mỗi listing — tránh trộn lẫn.
        </p>
      </Section>

      {/* ── Brand Kit picker ────────────────────────────────────────── */}
      <Section icon={<Palette className="h-4 w-4" />} title="Brand Kit">
        {availableBrandKits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3">
            <p className="text-xs text-gray-600">
              Chưa có Brand Kit cho thị trường {MARKET_LABELS[draft.market]}.
            </p>
            <button
              onClick={() => openApp('studio-brand-kit')}
              className="mt-2 text-xs font-semibold text-violet-600 hover:text-violet-700"
            >
              Mở Studio Brand Kit →
            </button>
          </div>
        ) : (
          <select
            value={draft.brandKitId ?? ''}
            onChange={(e) => selectBrandKit(e.target.value || null)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900"
          >
            <option value="">-- Chọn Brand Kit --</option>
            {availableBrandKits.map((k) => (
              <option key={k.id} value={k.id}>{k.name} — {k.storeName}</option>
            ))}
          </select>
        )}
        {selectedKit && !kitReady && (
          <p className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-600">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Brand Kit thiếu thông tin — vào Studio Brand Kit để bổ sung.</span>
          </p>
        )}
      </Section>

      {/* ── Product picker ──────────────────────────────────────────── */}
      <Section icon={<Package className="h-4 w-4" />} title="Sản phẩm">
        {products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3">
            <p className="text-xs text-gray-600">Chưa có sản phẩm nào.</p>
            <button
              onClick={() => openApp('finder')}
              className="mt-2 text-xs font-semibold text-violet-600 hover:text-violet-700"
            >
              Mở Project →
            </button>
          </div>
        ) : (
          <select
            value={draft.productId ?? ''}
            onChange={(e) => selectProduct(e.target.value || null)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900"
          >
            <option value="">-- Chọn sản phẩm --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.productName || '(Không tên)'}</option>
            ))}
          </select>
        )}
      </Section>

      {/* ── Reference images ────────────────────────────────────────── */}
      <Section
        icon={<Upload className="h-4 w-4" />}
        title={`Ảnh tham chiếu (${draft.referenceImageAssetIds.length}/5)`}
      >
        <p className="mb-2 text-[11px] leading-snug text-gray-500">
          Tối thiểu 2 ảnh: hero + label. Khuyến nghị 4 ảnh để chất lượng tốt hơn.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {draft.referenceImageAssetIds.map((assetId) => (
            <ReferenceThumb key={assetId} assetId={assetId} onRemove={() => removeRef(assetId)} />
          ))}
          {draft.referenceImageAssetIds.length < 5 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-gray-400 transition-colors hover:border-violet-400 hover:text-violet-500 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </Section>

      {/* ── Cost estimate ───────────────────────────────────────────── */}
      <Section icon={<Info className="h-4 w-4" />} title="Ước tính chi phí">
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-indigo-600">~{estimatedCost} credit</span>
            <span className="text-[11px] text-indigo-400">
              {kieCredits !== null ? `Còn ${kieCredits.toLocaleString('vi-VN')}` : '—'}
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-indigo-500">
            Phase 3: chỉ Slot 1 (Hero Hook, 2K). Re-roll tốn thêm credit.
          </p>
        </div>
      </Section>

      {/* ── Generate button ─────────────────────────────────────────── */}
      <div className="mt-auto space-y-2">
        {!readiness.ready && readiness.missing.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
            <p className="text-[11px] font-semibold text-amber-700">Còn thiếu:</p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-amber-600">
              {readiness.missing.map((m) => <li key={m}>• {m}</li>)}
            </ul>
          </div>
        )}
        {readiness.warnings.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-2.5">
            {readiness.warnings.map((w) => (
              <p key={w} className="text-[11px] text-yellow-700">⚠️ {w}</p>
            ))}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!readiness.ready || isGenerating}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:bg-gray-300 disabled:text-gray-500"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isGenerating ? 'Đang tạo Slot 1...' : 'Tạo Slot 1'}
        </button>
        <p className="text-center text-[10px] text-gray-400">
          Phase 3: chỉ Slot 1 — Phase 4 sẽ scale 9 slot
        </p>
      </div>

      {/* ── Cost confirmation modal ─────────────────────────────────── */}
      <CostEstimator
        open={costModalOpen}
        onClose={() => setCostModalOpen(false)}
        onConfirm={handleConfirmGenerate}
        estimatedCredits={estimatedCost}
        currentBalance={kieCredits}
        scope="slot-1"
        busy={isGenerating}
      />
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  )
}

function ReferenceThumb({ assetId, onRemove }: { assetId: string; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null)

  // Lazy-load the signed URL from Supabase Storage
  useEffect(() => {
    let cancelled = false
    getUrl(assetId)
      .then((u) => { if (!cancelled) setUrl(u) })
      .catch(() => { if (!cancelled) setUrl(null) })
    return () => { cancelled = true }
  }, [assetId])

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
      {url ? (
        <img src={url} alt="ref" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-gray-300">
          <Loader2 className="h-3 w-3 animate-spin" />
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
        title="Xóa"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
