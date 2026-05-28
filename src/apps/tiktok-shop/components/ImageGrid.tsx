// ImageGrid — middle column showing the 9 listing image cards in 3×3.

import { LayoutGrid, Eye, EyeOff } from 'lucide-react'
import ImageSlot from './ImageSlot'
import { useTikTokShopStore, buildMockListing } from '../store'

export default function ImageGrid() {
  const draft = useTikTokShopStore((s) => s.draft)
  const showMock = useTikTokShopStore((s) => s.showMockPreview)
  const toggleMock = useTikTokShopStore((s) => s.toggleMockPreview)

  const output = draft.output ?? (showMock ? buildMockListing() : null)

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-900">Bộ 9 ảnh</h2>
          {output && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              {output.paletteFamily}
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

      {/* Grid 3×3 */}
      <div className="flex-1 overflow-y-auto p-5">
        {output ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {output.images.map((img) => (
              <ImageSlot key={img.slot} image={img} paletteFamily={output.paletteFamily} />
            ))}
          </div>
        ) : (
          <EmptyState />
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
        <p className="mt-3 text-[11px] text-gray-400">
          (Hoặc bật "Mock preview" ở trên để xem layout)
        </p>
      </div>
    </div>
  )
}
