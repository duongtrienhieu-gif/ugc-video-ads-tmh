// ImageSlot — single card in the 9-slot grid.
// Phase 2: renders via ListingCanvas (real Konva). Slot 1 gets full content;
// slots 2-9 show a placeholder until Phase 4 wires their renderers.

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Pencil, Download, Loader2 } from 'lucide-react'
import type Konva from 'konva'
import { useAppStore } from '../../../stores/appStore'
import type { ListingImage, PaletteFamily } from '../types'
import type { ResolvedBrandKit } from '../../../types/brandKit'
import { COMPOSITION_FAMILY_LABELS, ATMOSPHERE_VARIANTS } from '../constants'
import ListingCanvas from '../canvas/ListingCanvas'
import { downloadStage } from '../services/exportImage'

interface Props {
  image: ListingImage
  paletteFamily: PaletteFamily
  brandKit: ResolvedBrandKit
  fallbackSceneUrl?: string | null
}

export default function ImageSlot({ image, paletteFamily, brandKit, fallbackSceneUrl }: Props) {
  const addToast = useAppStore((s) => s.addToast)
  const stageRef = useRef<Konva.Stage | null>(null)
  const [wrapRef, displayWidth] = useElementWidth<HTMLDivElement>()

  const atmosphere = ATMOSPHERE_VARIANTS[image.config.atmosphere]

  const phaseStubAction = (kind: 'visual' | 'text') => {
    addToast(
      kind === 'visual'
        ? 'Re-roll visual — wire ở Phase 3'
        : 'Re-roll text — wire ở Phase 4',
      'info',
    )
  }

  const handleDownload = async () => {
    if (!stageRef.current) return
    try {
      // Export at native 1080×1080 regardless of display size — we ALWAYS
      // ship customers the full-res image. pixelRatio=1 because the Stage
      // is already 1080 in internal coords; we just scale up from the
      // displayed (shrunk) size back to native by dividing by the scale.
      const scale = displayWidth / 1080
      await downloadStage(stageRef.current, `tiktok-shop-slot${image.slot}`, { pixelRatio: 1 / scale })
      addToast('Đã tải ảnh xuống', 'success')
    } catch (err) {
      addToast(`Tải xuống lỗi: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  return (
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

      {/* Canvas preview — aspect 1:1 */}
      <div ref={wrapRef} className="relative aspect-square w-full overflow-hidden bg-gray-100">
        {displayWidth > 0 && (
          <ListingCanvas
            ref={stageRef}
            image={image}
            paletteFamily={paletteFamily}
            brandKit={brandKit}
            fallbackSceneUrl={fallbackSceneUrl}
            displayWidth={displayWidth}
            listening={false}
          />
        )}
        {image.status === 'generating' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-1 border-t border-gray-100 bg-white px-2 py-1.5">
        <span
          className="truncate text-[9px] text-gray-400"
          title={COMPOSITION_FAMILY_LABELS[image.config.composition]}
        >
          {COMPOSITION_FAMILY_LABELS[image.config.composition]}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn
            icon={<RefreshCw className="h-3 w-3" />}
            title="Tạo lại ảnh"
            onClick={() => phaseStubAction('visual')}
          />
          <IconBtn
            icon={<Pencil className="h-3 w-3" />}
            title="Sửa text"
            onClick={() => phaseStubAction('text')}
          />
          <IconBtn
            icon={<Download className="h-3 w-3" />}
            title="Tải xuống (1080×1080)"
            onClick={handleDownload}
          />
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

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

// Track an element's rendered width so the inner Stage can use a numeric
// width matching its container. ResizeObserver updates on column reflow.
function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width
      if (w > 0) setWidth(Math.round(w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}
