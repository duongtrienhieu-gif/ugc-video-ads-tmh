// ImageSlot — Phase 6 (full AI). Renders plain <img> from Supabase signed URL.
// AI handles the entire image including text + brand + trust bar.
// No more Konva canvas.

import { useEffect, useState } from 'react'
import { RefreshCw, Download, Loader2, ImageOff, Sparkles, FileText, X, Copy } from 'lucide-react'
import { useAppStore } from '../../../stores/appStore'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { getUrl } from '../../../utils/assetStore'
import { getKieCredits } from '../../../utils/kieai'
import type { ListingImage } from '../types'
import { ATMOSPHERE_VARIANTS, snapToPaletteFamily, TPCN_PALETTES } from '../constants'
import { useResolvedBrandKit } from '../hooks/useResolvedBrandKit'
import { useTikTokShopStore } from '../store'
import { generateSlotImage, friendlyErrorMessage } from '../services/generateSlot'
import { downloadAssetAsImage } from '../services/exportImage'

interface Props {
  image: ListingImage
}

export default function ImageSlot({ image }: Props) {
  const addToast = useAppStore((s) => s.addToast)

  const draft          = useTikTokShopStore((s) => s.draft)
  const setSlotStatus  = useTikTokShopStore((s) => s.setSlotStatus)
  const setSlotImage   = useTikTokShopStore((s) => s.setSlotImage)
  const getProductById = useBankStore((s) => s.getProductById)
  const kieApiKey      = useSettingsStore((s) => s.kieApiKey)
  const setKieCredits  = useSettingsStore((s) => s.setKieCredits)

  const resolvedBrandKit = useResolvedBrandKit(draft.brandKitId, draft.market)
  const paletteFamily = snapToPaletteFamily(resolvedBrandKit.palette.primary)

  const atmosphere = ATMOSPHERE_VARIANTS[image.config.atmosphere]
  const palette = TPCN_PALETTES[paletteFamily]
  const isGenerating = image.status === 'generating'
  const isFailed = image.status === 'failed'

  // Resolve image URL when assetId is set
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  useEffect(() => {
    if (!image.imageAssetId) { setImgUrl(null); return }
    let alive = true
    getUrl(image.imageAssetId)
      .then((u) => { if (alive) setImgUrl(u) })
      .catch(() => { if (alive) setImgUrl(null) })
    return () => { alive = false }
  }, [image.imageAssetId])

  async function handleRerollVisual() {
    if (!draft.brandKitId || !draft.productId) {
      addToast('Cần chọn Brand Kit + Sản phẩm trước khi re-roll', 'error')
      return
    }
    const product = getProductById(draft.productId)
    if (!product) { addToast('Không tìm thấy sản phẩm', 'error'); return }
    if (draft.referenceImageAssetIds.length < 2) {
      addToast('Cần ít nhất 2 ảnh tham chiếu', 'error')
      return
    }

    setSlotStatus(image.slot, 'generating')
    try {
      const { assetId, prompt } = await generateSlotImage({
        apiKey: kieApiKey,
        brandKit: resolvedBrandKit,
        product,
        slotConfig: image.config,
        paletteFamily,
        language: draft.market,
        referenceImageAssetIds: draft.referenceImageAssetIds,
        brief: draft.productBrief ?? undefined,
      })
      setSlotImage(image.slot, assetId, prompt)
      addToast(`Đã tạo lại Slot ${image.slot}`, 'success')
      try {
        const c = await getKieCredits(kieApiKey)
        setKieCredits(c)
      } catch { /* silent */ }
    } catch (err) {
      const msg = friendlyErrorMessage(err)
      setSlotStatus(image.slot, 'failed', msg)
      addToast(`Slot ${image.slot} lỗi: ${msg}`, 'error')
    }
  }

  async function handleDownload() {
    if (!image.imageAssetId) {
      addToast('Chưa có ảnh để tải', 'error')
      return
    }
    try {
      await downloadAssetAsImage(image.imageAssetId, `tiktok-shop-slot${image.slot}`)
      addToast('Đã tải ảnh xuống', 'success')
    } catch (err) {
      addToast(`Tải xuống lỗi: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  function handleCopyPrompt() {
    if (!image.aiGenPrompt) return
    navigator.clipboard.writeText(image.aiGenPrompt)
      .then(() => addToast('Đã copy prompt', 'success'))
      .catch(() => addToast('Copy thất bại', 'error'))
  }

  return (
    <>
    {showPrompt && image.aiGenPrompt && (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16"
        onClick={(e) => { if (e.target === e.currentTarget) setShowPrompt(false) }}
      >
        <div className="flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <span className="text-sm font-semibold text-gray-800">
              Prompt Slot {image.slot} — {image.config.intentLabel}
            </span>
            <button
              onClick={() => setShowPrompt(false)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-4">
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-700">
              {image.aiGenPrompt}
            </pre>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2">
            <span className="text-[10px] text-gray-400">{image.aiGenPrompt.length} ký tự</span>
            <button
              onClick={handleCopyPrompt}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-violet-600 hover:bg-violet-50 hover:text-violet-800"
            >
              <Copy className="h-3 w-3" />
              Copy prompt
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Slot label header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
            {image.slot}
          </span>
          <span className="text-[11px] font-semibold text-gray-700">{image.config.intentLabel}</span>
        </div>
        <span className="text-[9px] font-medium uppercase tracking-wide text-gray-400">
          {atmosphere.label}
        </span>
      </div>

      {/* Image preview area — aspect 1:1 */}
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={`Slot ${image.slot} ${image.config.intentLabel}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : isGenerating ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-2"
            style={{ background: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.secondary} 100%)` }}
          >
            <Loader2 className="h-7 w-7 animate-spin text-white" />
            <span className="text-[11px] font-medium text-white/85">Đang tạo...</span>
          </div>
        ) : isFailed ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-red-50 text-red-600">
            <ImageOff className="h-7 w-7" />
            <span className="px-3 text-center text-[10px] leading-tight">
              {image.error ?? 'Lỗi gen'}
            </span>
          </div>
        ) : (
          <EmptyPlaceholder paletteFamily={paletteFamily} />
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-1 border-t border-gray-100 bg-white px-2 py-1.5">
        <span className="truncate text-[9px] text-gray-400">
          Slot {image.slot}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn
            icon={isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            title="Tạo lại ảnh"
            onClick={handleRerollVisual}
            disabled={isGenerating}
          />
          <IconBtn
            icon={<FileText className="h-3 w-3" />}
            title="Xem prompt"
            onClick={() => setShowPrompt(true)}
            disabled={!image.aiGenPrompt}
          />
          <IconBtn
            icon={<Download className="h-3 w-3" />}
            title="Tải xuống"
            onClick={handleDownload}
            disabled={!imgUrl}
          />
        </div>
      </div>
    </div>
    </>
  )
}

function IconBtn({ icon, title, onClick, disabled }: {
  icon: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
    >
      {icon}
    </button>
  )
}

function EmptyPlaceholder({ paletteFamily }: { paletteFamily: ReturnType<typeof snapToPaletteFamily> }) {
  const palette = TPCN_PALETTES[paletteFamily]
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center"
      style={{ background: `linear-gradient(135deg, ${palette.primary}22 0%, ${palette.secondary} 100%)` }}
    >
      <Sparkles className="h-6 w-6 opacity-40" style={{ color: palette.primary }} />
      <p className="text-[10px] leading-snug opacity-60" style={{ color: palette.primary }}>
        Bấm "Tạo Listing" để AI tạo ảnh
      </p>
    </div>
  )
}
