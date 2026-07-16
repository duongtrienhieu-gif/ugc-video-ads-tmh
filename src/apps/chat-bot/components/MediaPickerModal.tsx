import { useEffect, useMemo, useState } from 'react'
import { X, Upload, Link2, Loader2, Check } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import { useTikTokShopListingsStore } from '../../tiktok-shop/listingsStore'
import { useLandingPageStore } from '../../landing-page/store'
import { useSuperLadipageStore } from '../../super-ladipage/store'
import { saveAsset } from '../../../utils/assetStore'
import MediaThumb from './MediaThumb'

export interface PickedMedia {
  assetRef: string
  mediaType: 'image' | 'video'
}

type Source = 'ladipage' | 'tiktok' | 'bank' | 'upload'

/** Tách 2 nhóm: ảnh khớp đúng sản phẩm đang chọn, và toàn bộ ảnh có sẵn.
 *  Khi khớp = rỗng (productId khác / không gắn SP) vẫn cho xem "tất cả". */
interface RefBuckets {
  matched: string[]
  all: string[]
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)))
}

// Modal chọn ảnh/video cho mediaMap. Nguồn: Ladipage/super-ladipage, TikTok Shop,
// product bank, tải lên/URL. Đọc ảnh Ladipage + TikTok từ store (có cache localStorage)
// nên không phụ thuộc 1 lần fetch Supabase. Lọc theo productId HOẶC tên SP; fallback "tất cả".
export default function MediaPickerModal({
  productId, onClose, onPick,
}: {
  productId: string
  onClose: () => void
  onPick: (items: PickedMedia[]) => void
}) {
  const product = useBankStore((s) => s.getProductById(productId))
  const addToast = useAppStore((s) => s.addToast)
  const tiktokListings = useTikTokShopListingsStore((s) => s.listings)
  const landingItems = useLandingPageStore((s) => s.items)
  const superItems = useSuperLadipageStore((s) => s.items)

  const [source, setSource] = useState<Source>('ladipage')
  const [onlyThisProduct, setOnlyThisProduct] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [urlValue, setUrlValue] = useState('')
  const [uploading, setUploading] = useState(false)

  const productName = (product?.productName ?? '').trim().toLowerCase()

  // Đảm bảo store đã hydrate (login thường đã chạy; gọi lại cho chắc, idempotent).
  useEffect(() => {
    void useLandingPageStore.getState().hydrate()
    void useSuperLadipageStore.getState().hydrate()
    void useTikTokShopListingsStore.getState().hydrate()
  }, [])

  // Ladipage + super-ladipage (gộp 2 store).
  const ladi: RefBuckets = useMemo(() => {
    const packs = [...landingItems, ...superItems]
    const matched: string[] = []
    const all: string[] = []
    for (const pack of packs) {
      const isMatch =
        pack.productId === productId ||
        (!!productName && (pack.productName ?? '').trim().toLowerCase() === productName)
      for (const sec of pack.sections ?? []) {
        for (const ip of sec.imagePrompts ?? []) {
          if (!ip.generatedAssetRef) continue
          all.push(ip.generatedAssetRef)
          if (isMatch) matched.push(ip.generatedAssetRef)
        }
      }
    }
    return { matched: dedupe(matched), all: dedupe(all) }
  }, [landingItems, superItems, productId, productName])

  // TikTok Shop listings.
  const tiktok: RefBuckets = useMemo(() => {
    const matched: string[] = []
    const all: string[] = []
    for (const l of tiktokListings) {
      const isMatch = l.productId === productId
      const refs = [
        ...(l.images ?? []).map((i) => i.imageAssetId),
        ...(l.combos ?? []).map((c) => c.imageAssetId),
      ].filter((r): r is string => !!r)
      for (const r of refs) {
        all.push(r)
        if (isMatch) matched.push(r)
      }
    }
    return { matched: dedupe(matched), all: dedupe(all) }
  }, [tiktokListings, productId])

  const bankImages = dedupe(product?.productImages ?? [])

  function bucketRefs(b: RefBuckets): string[] {
    return onlyThisProduct && b.matched.length > 0 ? b.matched : b.all
  }

  function toggle(ref: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return next
    })
  }

  function confirmMulti() {
    if (selected.size === 0) return
    onPick([...selected].map((assetRef) => ({ assetRef, mediaType: 'image' as const })))
    onClose()
  }

  async function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    // CHỌN NHIỀU FILE 1 LƯỢT (Ctrl/Shift-click) — upload tuần tự rồi trả cả cụm.
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    try {
      const picked: PickedMedia[] = []
      for (const file of files) {
        const ref = await saveAsset(file, file.type)
        picked.push({ assetRef: ref, mediaType: file.type.startsWith('video') ? 'video' : 'image' })
      }
      onPick(picked)
      onClose()
    } catch (err) {
      addToast(`Tải lên thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  function addUrl() {
    const v = urlValue.trim()
    if (!v) return
    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(v)
    onPick([{ assetRef: v, mediaType: isVideo ? 'video' : 'image' }])
    onClose()
  }

  const showMatchedToggle = source === 'ladipage' || source === 'tiktok'
  const activeBucket = source === 'ladipage' ? ladi : source === 'tiktok' ? tiktok : null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-5 py-3">
          <h3 className="text-sm font-bold text-gray-900">Chọn ảnh / video</h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source tabs */}
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-black/10 px-3 py-2">
          {([['ladipage', 'Từ Ladipage'], ['tiktok', 'Từ TikTok Shop'], ['bank', 'Từ sản phẩm'], ['upload', 'Tải lên / URL']] as [Source, string][]).map(
            ([s, label]) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  source === s ? 'bg-emerald-500/10 text-emerald-700' : 'text-gray-500 hover:bg-black/5'
                }`}
              >
                {label}
              </button>
            ),
          )}
          {showMatchedToggle && (
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-gray-500">
              <input
                type="checkbox"
                checked={onlyThisProduct}
                onChange={(e) => setOnlyThisProduct(e.target.checked)}
                className="accent-emerald-500"
              />
              Chỉ sản phẩm này
            </label>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeBucket && (() => {
            const refs = bucketRefs(activeBucket)
            if (refs.length === 0) {
              return (
                <p className="py-10 text-center text-sm text-gray-400">
                  {activeBucket.all.length === 0
                    ? `Chưa có ảnh ${source === 'ladipage' ? 'Ladipage' : 'TikTok Shop'} nào. Tạo bên app đó trước nhé.`
                    : 'Không có ảnh gắn đúng sản phẩm này. Bỏ tick "Chỉ sản phẩm này" để xem tất cả.'}
                </p>
              )
            }
            return (
              <>
                {onlyThisProduct && activeBucket.matched.length === 0 && (
                  <p className="mb-2 text-[11px] text-amber-600">
                    Không khớp đúng sản phẩm — đang hiện tất cả ảnh.
                  </p>
                )}
                <SelectableGrid refs={refs} selected={selected} onToggle={toggle} />
              </>
            )
          })()}

          {source === 'bank' && (
            bankImages.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">Sản phẩm chưa có ảnh trong bank.</p>
            ) : (
              <SelectableGrid refs={bankImages} selected={selected} onToggle={toggle} />
            )
          )}

          {source === 'upload' && (
            <div className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 py-10 text-gray-500 transition-colors hover:border-emerald-400 hover:text-emerald-600">
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                <span className="text-sm font-semibold">{uploading ? 'Đang tải lên…' : 'Chọn ảnh/video từ máy'}</span>
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onUploadFile} disabled={uploading} />
              </label>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">Hoặc dán URL ảnh/video</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={urlValue}
                      onChange={(e) => setUrlValue(e.target.value)}
                      placeholder="https://…"
                      className="w-full rounded-lg border border-black/10 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                  <button
                    onClick={addUrl}
                    className="rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
                  >
                    Thêm
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer (multi-select confirm) */}
        {source !== 'upload' && (
          <div className="flex shrink-0 items-center justify-between border-t border-black/10 px-5 py-3">
            <span className="text-xs text-gray-500">Đã chọn {selected.size}</span>
            <button
              onClick={confirmMulti}
              disabled={selected.size === 0}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Thêm {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SelectableGrid({
  refs, selected, onToggle,
}: {
  refs: string[]
  selected: Set<string>
  onToggle: (ref: string) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {refs.map((ref) => {
        const on = selected.has(ref)
        return (
          <button
            key={ref}
            onClick={() => onToggle(ref)}
            className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
              on ? 'border-emerald-500' : 'border-transparent hover:border-black/10'
            }`}
          >
            <MediaThumb assetRef={ref} className="h-full w-full" />
            {on && (
              <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
