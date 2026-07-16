import { useState } from 'react'
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react'
import type { MediaSlot, MediaRole } from '../types'
import { ROLE_DEFAULT_STAGE, ROLE_LABELS, ROLE_ORDER } from '../labels'
import { describeMediaRef } from '../services/describeMedia'
import MediaThumb from './MediaThumb'
import MediaPickerModal, { type PickedMedia } from './MediaPickerModal'

// Quản lý mediaMap: gắn ảnh/video + GÁN VAI (role) + caption "GỬI KHI: tình huống".
// Khi thêm ảnh → Gemini Vision tự đọc ảnh điền role + caption (1 lần, không tốn chi
// phí chat). User sửa được. Bot chọn ảnh theo VAI + CAPTION (trục "giai đoạn" đã bỏ
// khỏi UI — 1 ảnh dùng được nhiều thời điểm, gán cứng 1 bậc chỉ trói tay bot;
// field stage vẫn set ngầm để config cũ không vỡ).
export default function MediaMapEditor({
  productId, value, onChange,
}: {
  productId: string
  value: MediaSlot[]
  onChange: (slots: MediaSlot[]) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [describing, setDescribing] = useState<Set<string>>(new Set())

  const markDescribing = (ids: string[], on: boolean) =>
    setDescribing((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })

  // Đọc ảnh tuần tự (giữ working array để cập nhật ổn định qua các await).
  async function autoDescribe(slots: MediaSlot[], base: MediaSlot[]) {
    const imgs = slots.filter((s) => s.mediaType === 'image')
    if (imgs.length === 0) return
    markDescribing(imgs.map((s) => s.id), true)
    let working = base
    for (const slot of imgs) {
      const r = await describeMediaRef(slot.assetRef).catch(() => null)
      if (r) {
        working = working.map((s) =>
          s.id === slot.id ? { ...s, role: r.role, stage: ROLE_DEFAULT_STAGE[r.role], caption: r.caption || s.caption } : s,
        )
        onChange(working)
      }
      markDescribing([slot.id], false)
    }
  }

  function addPicked(items: PickedMedia[]) {
    const newSlots: MediaSlot[] = items.map((it) => ({
      id: crypto.randomUUID(),
      assetRef: it.assetRef,
      mediaType: it.mediaType,
      role: 'feature',
      stage: 'value',
      caption: '',
    }))
    const base = [...value, ...newSlots]
    onChange(base)
    void autoDescribe(newSlots, base) // tự đọc ảnh điền role+caption
  }

  function updateSlot(id: string, patch: Partial<MediaSlot>) {
    onChange(value.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function removeSlot(id: string) {
    onChange(value.filter((s) => s.id !== id))
  }

  async function reDescribe(slot: MediaSlot) {
    markDescribing([slot.id], true)
    const r = await describeMediaRef(slot.assetRef).catch(() => null)
    if (r) updateSlot(slot.id, { role: r.role, stage: ROLE_DEFAULT_STAGE[r.role], caption: r.caption || slot.caption })
    markDescribing([slot.id], false)
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
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
      <p className="mb-2 flex items-center gap-1 text-[11px] text-gray-400">
        <Sparkles className="h-3 w-3" /> Thêm ảnh xong AI tự đọc & điền vai trò + mô tả (sửa lại được).
      </p>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 py-8 text-center text-xs text-gray-400">
          Chưa gắn ảnh/video nào. Bấm <span className="font-semibold">Thêm</span> để chọn từ Ladipage / sản phẩm / tải lên.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((slot) => {
            const busy = describing.has(slot.id)
            return (
              <div key={slot.id} className="flex gap-3 rounded-xl border border-black/8 bg-black/[0.02] p-2">
                <div className="relative h-16 w-16 shrink-0">
                  <MediaThumb assetRef={slot.assetRef} mediaType={slot.mediaType} className="h-16 w-16 rounded-lg" />
                  {busy && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex gap-1.5">
                    <select
                      value={slot.role}
                      onChange={(e) => {
                        const role = e.target.value as MediaRole
                        updateSlot(slot.id, { role, stage: ROLE_DEFAULT_STAGE[role] })
                      }}
                      className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs outline-none focus:border-emerald-400"
                      title="Vai trò nội dung"
                    >
                      {ROLE_ORDER.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                    {slot.mediaType === 'image' && (
                      <button
                        onClick={() => void reDescribe(slot)}
                        disabled={busy}
                        className="shrink-0 rounded-md p-1.5 text-violet-400 transition-colors hover:bg-violet-500/10 hover:text-violet-600 disabled:opacity-40"
                        title="AI đọc lại ảnh"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      </button>
                    )}
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
                    placeholder={busy ? 'AI đang đọc ảnh…' : 'Tả ảnh — GỬI KHI: tình huống (vd: review khách đau gối — GỬI KHI: khách do dự)'}
                    className="w-full rounded-md border border-black/10 px-2 py-1 text-xs outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            )
          })}
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
