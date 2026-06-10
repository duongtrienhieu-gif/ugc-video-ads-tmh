// ListingHistoryModal — Phase R8. Modal liệt kê tất cả TikTok Shop listings
// đã auto-save vào Supabase. Click "Mở" để load lại listing cũ vào workspace
// (qua loadSavedOutput → 9 ảnh + mô tả + combos + brief cache đều quay lại).

import { useEffect, useState } from 'react'
import { X, Eye, Trash2, History, Package } from 'lucide-react'
import { useTikTokShopListingsStore } from '../listingsStore'
import { useTikTokShopStore } from '../store'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import { getUrl } from '../../../utils/assetStore'
import type { ListingOutput } from '../types'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ListingHistoryModal({ open, onClose }: Props) {
  const listings = useTikTokShopListingsStore((s) => s.listings)
  const deleteListing = useTikTokShopListingsStore((s) => s.delete)
  const loadSavedOutput = useTikTokShopStore((s) => s.loadSavedOutput)
  const currentDraftId = useTikTokShopStore((s) => s.draft.output?.id)
  const getProductById = useBankStore((s) => s.getProductById)
  const addToast = useAppStore((s) => s.addToast)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const sorted = [...listings].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  function handleOpen(listing: ListingOutput) {
    loadSavedOutput(listing)
    addToast('Đã mở listing', 'success')
    onClose()
  }

  async function handleDelete(id: string) {
    await deleteListing(id)
    addToast('Đã xoá listing', 'success')
    setConfirmDelete(null)
  }

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[201] flex max-h-[85vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-gradient-to-br from-violet-50 to-pink-50 px-5 py-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-violet-600" />
            <h2 className="text-sm font-bold text-gray-900">Lịch sử listings</h2>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
              {listings.length}
            </span>
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100" title="Đóng (ESC)">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {sorted.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sorted.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isCurrent={listing.id === currentDraftId}
                  productName={getProductById(listing.productId)?.productName ?? '(Không rõ sản phẩm)'}
                  onOpen={() => handleOpen(listing)}
                  onAskDelete={() => setConfirmDelete(listing.id)}
                  pendingDelete={confirmDelete === listing.id}
                  onConfirmDelete={() => handleDelete(listing.id)}
                  onCancelDelete={() => setConfirmDelete(null)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
          <span>Listings tự lưu vào cloud sau mỗi 2 giây khi có thay đổi.</span>
          <span>ESC để đóng</span>
        </div>
      </div>
    </>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <History className="mb-3 h-12 w-12 text-gray-300" />
      <p className="text-sm font-medium text-gray-700">Chưa có listing nào được lưu</p>
      <p className="mt-1 text-xs text-gray-500">Listing sẽ tự lưu sau khi bạn tạo xong 9 ảnh + mô tả.</p>
    </div>
  )
}

interface ListingCardProps {
  listing: ListingOutput
  isCurrent: boolean
  productName: string
  onOpen: () => void
  onAskDelete: () => void
  pendingDelete: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

function ListingCard({
  listing,
  isCurrent,
  productName,
  onOpen,
  onAskDelete,
  pendingDelete,
  onConfirmDelete,
  onCancelDelete,
}: ListingCardProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const slot1AssetId = listing.images.find((i) => i.slot === 1)?.imageAssetId

  useEffect(() => {
    if (!slot1AssetId) { setThumbUrl(null); return }
    let alive = true
    getUrl(slot1AssetId)
      .then((u) => { if (alive) setThumbUrl(u) })
      .catch(() => { if (alive) setThumbUrl(null) })
    return () => { alive = false }
  }, [slot1AssetId])

  const updatedAt = new Date(listing.updatedAt)
  const dateStr = updatedAt.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
  const completedCount = listing.images.filter((i) => i.status === 'completed').length

  return (
    <div className={`rounded-lg border bg-white p-3 transition-colors ${
      isCurrent ? 'border-violet-400 ring-1 ring-violet-200' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-violet-100 to-pink-100">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-300">
              <Package className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{productName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-semibold">
              {listing.market === 'ms' ? '🇲🇾 MY' : '🇻🇳 VN'}
            </span>
            <span className="rounded bg-violet-50 px-1.5 py-0.5 font-medium text-violet-600">
              {completedCount}/9 ảnh
            </span>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">{dateStr}</p>
          {isCurrent && (
            <p className="mt-1 text-[10px] font-semibold text-violet-600">● Đang mở</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {pendingDelete ? (
          <>
            <button
              onClick={onConfirmDelete}
              className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
            >
              Xác nhận xoá
            </button>
            <button
              onClick={onCancelDelete}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Hủy
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onOpen}
              disabled={isCurrent}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:bg-gray-300"
            >
              <Eye className="h-3 w-3" />
              {isCurrent ? 'Đang mở' : 'Mở'}
            </button>
            <button
              onClick={onAskDelete}
              title="Xoá listing"
              className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
