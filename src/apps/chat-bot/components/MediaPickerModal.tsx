import { useEffect, useState } from 'react'
import { X, Upload, Link2, Loader2, Check } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import { listProjects } from '../../landing-page/services/projectsAPI'
import type { SavedLandingPack } from '../../landing-page/types'
import { saveAsset } from '../../../utils/assetStore'
import MediaThumb from './MediaThumb'

export interface PickedMedia {
  assetRef: string
  mediaType: 'image' | 'video'
}

type Source = 'ladipage' | 'bank' | 'upload'

// Modal chọn ảnh/video cho mediaMap. 4 nguồn (P1):
//   • Ladipage/super-ladipage (ảnh đã tạo, lọc theo sản phẩm)
//   • product bank (productImages)
//   • Tải lên file
//   • Dán URL
export default function MediaPickerModal({
  productId, onClose, onPick,
}: {
  productId: string
  onClose: () => void
  onPick: (items: PickedMedia[]) => void
}) {
  const product = useBankStore((s) => s.getProductById(productId))
  const addToast = useAppStore((s) => s.addToast)

  const [source, setSource] = useState<Source>('ladipage')
  const [ladiRefs, setLadiRefs] = useState<string[] | null>(null) // null = đang tải
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [urlValue, setUrlValue] = useState('')
  const [uploading, setUploading] = useState(false)

  // Tải ảnh Ladipage đã tạo cho sản phẩm này (landing-page + super-ladipage).
  useEffect(() => {
    let cancelled = false
    setLadiRefs(null)
    ;(async () => {
      const [lp, sl] = await Promise.all([
        listProjects<SavedLandingPack>('landing-page'),
        listProjects<SavedLandingPack>('super-ladipage'),
      ])
      const packs = [...(lp ?? []), ...(sl ?? [])].filter((p) => p.productId === productId)
      const refs: string[] = []
      for (const pack of packs) {
        for (const sec of pack.sections ?? []) {
          for (const ip of sec.imagePrompts ?? []) {
            if (ip.generatedAssetRef) refs.push(ip.generatedAssetRef)
          }
        }
      }
      if (!cancelled) setLadiRefs(Array.from(new Set(refs)))
    })()
    return () => { cancelled = true }
  }, [productId])

  const bankImages = product?.productImages ?? []

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
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ref = await saveAsset(file, file.type)
      onPick([{ assetRef: ref, mediaType: file.type.startsWith('video') ? 'video' : 'image' }])
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
        <div className="flex shrink-0 gap-1 border-b border-black/10 px-3 py-2">
          {([['ladipage', 'Từ Ladipage'], ['bank', 'Từ sản phẩm'], ['upload', 'Tải lên / URL']] as [Source, string][]).map(
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
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {source === 'ladipage' && (
            ladiRefs === null ? (
              <div className="flex h-32 items-center justify-center text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : ladiRefs.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                Chưa có ảnh Ladipage nào cho sản phẩm này. Tạo ở Landing Page AI / Super Ladipage trước nhé.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {ladiRefs.map((ref) => {
                  const on = selected.has(ref)
                  return (
                    <button
                      key={ref}
                      onClick={() => toggle(ref)}
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
          )}

          {source === 'bank' && (
            bankImages.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">Sản phẩm chưa có ảnh trong bank.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {bankImages.map((ref) => {
                  const on = selected.has(ref)
                  return (
                    <button
                      key={ref}
                      onClick={() => toggle(ref)}
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
          )}

          {source === 'upload' && (
            <div className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 py-10 text-gray-500 transition-colors hover:border-emerald-400 hover:text-emerald-600">
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                <span className="text-sm font-semibold">{uploading ? 'Đang tải lên…' : 'Chọn ảnh/video từ máy'}</span>
                <input type="file" accept="image/*,video/*" className="hidden" onChange={onUploadFile} disabled={uploading} />
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

        {/* Footer (multi-select confirm cho ladipage/bank) */}
        {(source === 'ladipage' || source === 'bank') && (
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
