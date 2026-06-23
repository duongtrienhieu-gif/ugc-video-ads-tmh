// ImageGrid — middle column showing the 9 AI-generated listing image cards.
// Phase 6 simplified: AI handles the full image (text + product + brand),
// so the grid is just a dumb container — each ImageSlot self-manages its
// own data + re-roll logic.

import { LayoutGrid, Eye, EyeOff } from 'lucide-react'
import ImageSlot from './ImageSlot'
import ComboPanel from './ComboPanel'
import { useTikTokShopStore, buildMockListing } from '../store'
import { useResolvedBrandKit } from '../hooks/useResolvedBrandKit'
import { snapToPaletteFamily } from '../constants'

export default function ImageGrid() {
  const draft = useTikTokShopStore((s) => s.draft)
  const showMock = useTikTokShopStore((s) => s.showMockPreview)
  const toggleMock = useTikTokShopStore((s) => s.toggleMockPreview)

  // Resolve brand kit just to show the snapped palette family chip in the
  // header — actual rendering is handled by AI.
  const brandKit = useResolvedBrandKit(draft.brandKitId, draft.market)
  const paletteFamily = snapToPaletteFamily(brandKit.palette.primary)

  const output = draft.output ?? (showMock ? buildMockListing() : null)

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-900">Bộ 9 ảnh</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            {paletteFamily}
          </span>
          {!draft.brandKitId && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              brand kit demo
            </span>
          )}
        </div>

        <button
          onClick={toggleMock}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
          title="Bật/tắt mock preview để xem layout trước"
        >
          {showMock ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          Mock preview
        </button>
      </div>

      {/* Grid 3×3 + Combo panel below */}
      <div className="flex-1 overflow-y-auto">
        {output ? (
          <>
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {output.images.map((img) => (
                <ImageSlot key={img.slot} image={img} />
              ))}
            </div>
            <ComboPanel />
          </>
        ) : (
          <div className="p-5">
            <EmptyState />
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <LayoutGrid className="h-5 w-5 text-gray-400" />
        </div>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Chưa có listing nào</h3>
        <p className="text-xs text-gray-500">
          Chọn Brand Kit + sản phẩm + tải ảnh tham chiếu → bấm "Tạo Listing".
        </p>
      </div>
    </div>
  )
}
