// ComboPanel — Phase 7B. Manage variant/combo thumbnails for the TikTok Shop
// option picker. Each combo is an independent 1024×1024 image showing the
// product configuration only. Same brand style as the main 9 slots.

import { useEffect, useState } from 'react'
import {
  Plus, RefreshCw, Download, Loader2, Trash2, Package, Flame, Sparkles, ImageOff,
} from 'lucide-react'
import { useAppStore } from '../../../stores/appStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { getUrl } from '../../../utils/assetStore'
import { getKieCredits } from '../../../utils/kieai'
import { useTikTokShopStore } from '../store'
import { useResolvedBrandKit } from '../hooks/useResolvedBrandKit'
import { snapToPaletteFamily, CREDIT_COST_PER_COMBO, MAX_COMBOS } from '../constants'
import { generateComboImage } from '../services/generateCombo'
import { friendlyErrorMessage } from '../services/generateSlot'
import { downloadAssetAsImage } from '../services/exportImage'
import type { ComboOption } from '../types'

export default function ComboPanel() {
  const draft        = useTikTokShopStore((s) => s.draft)
  const addCombo     = useTikTokShopStore((s) => s.addCombo)

  const combos = draft.output?.combos ?? []
  const hasOutput = !!draft.output
  const canAddMore = combos.length < MAX_COMBOS

  if (!hasOutput) {
    // Hide the panel entirely when there's no listing yet — combos build
    // on top of a generated main listing.
    return null
  }

  function handleAdd() {
    const n = combos.length + 1
    addCombo({
      name: `Combo ${n}`,
      isHot: false,
      productCount: 1,
    })
  }

  return (
    <div className="border-t border-gray-200 bg-[#FAFAFA] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-900">Ảnh Combo / Tùy chọn</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            {combos.length}/{MAX_COMBOS}
          </span>
          <span className="text-[11px] text-gray-400">
            · {CREDIT_COST_PER_COMBO} credit / ảnh
          </span>
        </div>
        <button
          onClick={handleAdd}
          disabled={!canAddMore}
          className="flex items-center gap-1.5 rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Thêm combo
        </button>
      </div>

      {combos.length === 0 ? (
        <EmptyState onAdd={handleAdd} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {combos.map((combo) => (
            <ComboCard key={combo.id} combo={combo} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <Package className="mb-2 h-8 w-8 text-gray-300" />
      <p className="text-xs font-medium text-gray-700">Chưa có combo nào</p>
      <p className="mt-1 max-w-xs text-[11px] leading-snug text-gray-500">
        Thêm các tùy chọn variant (1 sản phẩm, combo 2 sản phẩm…) để khách
        chọn trên TikTok Shop với thumbnail riêng.
      </p>
      <button
        onClick={onAdd}
        className="mt-3 flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-violet-700"
      >
        <Plus className="h-3 w-3" />
        Thêm combo đầu tiên
      </button>
    </div>
  )
}

// ── Combo card — form + thumbnail + actions ─────────────────────────────

function ComboCard({ combo }: { combo: ComboOption }) {
  const addToast       = useAppStore((s) => s.addToast)
  const draft          = useTikTokShopStore((s) => s.draft)
  const updateCombo    = useTikTokShopStore((s) => s.updateCombo)
  const removeCombo    = useTikTokShopStore((s) => s.removeCombo)
  const setComboStatus = useTikTokShopStore((s) => s.setComboStatus)
  const setComboImage  = useTikTokShopStore((s) => s.setComboImage)
  const kieApiKey      = useSettingsStore((s) => s.kieApiKey)
  const setKieCredits  = useSettingsStore((s) => s.setKieCredits)
  const brandKit       = useResolvedBrandKit(draft.brandKitId, draft.market)
  const paletteFamily  = snapToPaletteFamily(brandKit.palette.primary)

  const [imgUrl, setImgUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!combo.imageAssetId) { setImgUrl(null); return }
    let alive = true
    getUrl(combo.imageAssetId)
      .then((u) => { if (alive) setImgUrl(u) })
      .catch(() => { if (alive) setImgUrl(null) })
    return () => { alive = false }
  }, [combo.imageAssetId])

  const isGenerating = combo.status === 'generating'
  // Description is now OPTIONAL — productCount alone tells AI how many to
  // render. User can add description for finer control (e.g. "1 jar + 1
  // spray") but isn't forced to.
  const canGenerate = combo.name.trim() !== ''

  async function handleGenerate() {
    if (!canGenerate) {
      addToast('Cần điền Tên combo trước khi tạo', 'error')
      return
    }
    if (draft.referenceImageAssetIds.length < 1) {
      addToast('Cần ít nhất 1 ảnh tham chiếu sản phẩm', 'error')
      return
    }
    setComboStatus(combo.id, 'generating')
    try {
      const { assetId, prompt } = await generateComboImage({
        apiKey: kieApiKey,
        brandKit,
        combo,
        paletteFamily,
        language: draft.market,
        referenceImageAssetIds: draft.referenceImageAssetIds,
        brief: draft.productBrief ?? undefined,
      })
      setComboImage(combo.id, assetId, prompt)
      addToast(`Đã tạo ${combo.name}`, 'success')
      try {
        const c = await getKieCredits(kieApiKey)
        setKieCredits(c)
      } catch { /* silent */ }
    } catch (err) {
      const msg = friendlyErrorMessage(err)
      setComboStatus(combo.id, 'failed', msg)
      addToast(`${combo.name} lỗi: ${msg}`, 'error')
    }
  }

  async function handleDownload() {
    if (!combo.imageAssetId) { addToast('Chưa có ảnh', 'error'); return }
    try {
      await downloadAssetAsImage(combo.imageAssetId, `tiktok-combo-${combo.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`)
      addToast('Đã tải ảnh', 'success')
    } catch (err) {
      addToast(`Tải lỗi: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      {/* Form fields */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={combo.name}
            onChange={(e) => updateCombo(combo.id, { name: e.target.value })}
            placeholder="Tên combo (vd: Combo 1: 1 kem + 1 xịt)"
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-900 focus:border-violet-400 focus:outline-none"
          />
          <button
            onClick={() => updateCombo(combo.id, { isHot: !combo.isHot })}
            title={combo.isHot ? 'Bỏ Hot' : 'Đánh dấu Hot'}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              combo.isHot ? 'bg-red-100 text-red-600' : 'bg-gray-50 text-gray-300 hover:bg-gray-100'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => removeCombo(combo.id)}
            title="Xóa combo"
            className="flex h-7 w-7 items-center justify-center rounded bg-gray-50 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-500">Số lượng sản phẩm</span>
          <input
            type="number"
            min={1}
            max={10}
            value={combo.productCount ?? 1}
            onChange={(e) => updateCombo(combo.id, { productCount: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            title="Số lượng sản phẩm trong combo — AI sẽ render đúng số này"
            className="w-14 rounded border border-violet-200 bg-violet-50 px-1 py-1 text-center text-[11px] font-bold text-violet-700 focus:border-violet-400 focus:outline-none"
          />
        </div>

      </div>

      {/* Image preview */}
      <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg bg-gradient-to-br from-violet-50 to-pink-50">
        {imgUrl ? (
          <img src={imgUrl} alt={combo.name} className="h-full w-full object-cover" loading="lazy" />
        ) : isGenerating ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-violet-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[10px]">Đang tạo...</span>
          </div>
        ) : combo.status === 'failed' ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center text-red-500">
            <ImageOff className="h-6 w-6" />
            <span className="text-[10px] leading-tight">{combo.error ?? 'Lỗi'}</span>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-violet-300">
            <Sparkles className="h-6 w-6" />
            <span className="text-[10px]">Chưa tạo</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-violet-700 disabled:bg-gray-300"
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : combo.imageAssetId ? (
            <RefreshCw className="h-3 w-3" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {isGenerating ? 'Đang tạo' : combo.imageAssetId ? 'Tạo lại' : 'Tạo ảnh'}
        </button>
        <button
          onClick={handleDownload}
          disabled={!imgUrl}
          title="Tải xuống"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-30"
        >
          <Download className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
