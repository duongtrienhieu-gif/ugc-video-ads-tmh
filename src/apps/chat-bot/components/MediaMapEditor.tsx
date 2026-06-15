import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { MediaSlot, MediaRole, Stage } from '../types'
import { ROLE_LABELS, ROLE_ORDER, STAGE_LABELS, STAGE_ORDER } from '../labels'
import MediaThumb from './MediaThumb'
import MediaPickerModal, { type PickedMedia } from './MediaPickerModal'

// Quản lý mediaMap: gắn ảnh/video + GÁN NHÃN (role) + bậc gửi (stage) + caption.
// Lúc chat AI đọc nhãn (text) để chọn gửi đúng bậc — không xem pixel.
export default function MediaMapEditor({
  productId, value, onChange,
}: {
  productId: string
  value: MediaSlot[]
  onChange: (slots: MediaSlot[]) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  function addPicked(items: PickedMedia[]) {
    const newSlots: MediaSlot[] = items.map((it) => ({
      id: crypto.randomUUID(),
      assetRef: it.assetRef,
      mediaType: it.mediaType,
      role: 'feature',
      stage: 'value',
      caption: '',
    }))
    onChange([...value, ...newSlots])
  }

  function updateSlot(id: string, patch: Partial<MediaSlot>) {
    onChange(value.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function removeSlot(id: string) {
    onChange(value.filter((s) => s.id !== id))
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700">
          Kho ảnh / video <span className="font-normal text-gray-400">({value.length})</span>
        </label>
        <button
          onClick={() => setPickerOpen(true)}
          disabled={!productId}
          className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Thêm
        </button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 py-8 text-center text-xs text-gray-400">
          Chưa gắn ảnh/video nào. Bấm <span className="font-semibold">Thêm</span> để chọn từ Ladipage / sản phẩm / tải lên.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((slot) => (
            <div key={slot.id} className="flex gap-3 rounded-xl border border-black/8 bg-black/[0.02] p-2">
              <MediaThumb assetRef={slot.assetRef} mediaType={slot.mediaType} className="h-16 w-16 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex gap-1.5">
                  <select
                    value={slot.role}
                    onChange={(e) => updateSlot(slot.id, { role: e.target.value as MediaRole })}
                    className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs outline-none focus:border-emerald-400"
                    title="Vai trò nội dung"
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <select
                    value={slot.stage}
                    onChange={(e) => updateSlot(slot.id, { stage: e.target.value as Stage })}
                    className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs outline-none focus:border-emerald-400"
                    title="Bậc nên gửi"
                  >
                    {STAGE_ORDER.map((s) => (
                      <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeSlot(slot.id)}
                    className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
                    title="Xóa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  value={slot.caption ?? ''}
                  onChange={(e) => updateSlot(slot.id, { caption: e.target.value })}
                  placeholder="Mô tả ngắn (VN) — để AI biết khi nào gửi…"
                  className="w-full rounded-md border border-black/10 px-2 py-1 text-xs outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <MediaPickerModal
          productId={productId}
          onClose={() => setPickerOpen(false)}
          onPick={addPicked}
        />
      )}
    </div>
  )
}
