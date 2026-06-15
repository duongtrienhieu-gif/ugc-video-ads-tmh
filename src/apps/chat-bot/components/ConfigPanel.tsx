import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Tag } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import { useChatBotStore } from '../store'
import type { Market, ObjectionItem, SalesConfig } from '../types'
import { MARKET_LABELS } from '../labels'
import MediaMapEditor from './MediaMapEditor'

function emptyConfig(productId: string, title: string): SalesConfig {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    productId,
    market: 'MY',
    chatPrice: '',
    chatPromo: '',
    discountFloor: '',
    mediaMap: [],
    objectionBank: [],
    playbookNote: '',
    goldenExamples: [],
  }
}

// Màn cấu hình bán-qua-chat cho 1 sản phẩm. Fact sản phẩm đọc read-only từ bank;
// giá chat + trần giảm + media + objection + playbook nhập riêng cho kênh chat.
export default function ConfigPanel({ productId }: { productId: string }) {
  const product = useBankStore((s) => s.getProductById(productId))
  const getByProductId = useChatBotStore((s) => s.getByProductId)
  const upsert = useChatBotStore((s) => s.upsert)
  const addToast = useAppStore((s) => s.addToast)

  const [draft, setDraft] = useState<SalesConfig | null>(null)
  const [saving, setSaving] = useState(false)

  // Nạp config đã lưu của sản phẩm, hoặc khởi tạo mới khi đổi sản phẩm.
  useEffect(() => {
    const existing = getByProductId(productId)
    setDraft(existing ?? emptyConfig(productId, product?.productName ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  if (!draft) return null

  const update = (patch: Partial<SalesConfig>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  // ── Objection bank ──
  const addObjection = () =>
    update({ objectionBank: [...draft.objectionBank, { id: crypto.randomUUID(), trigger: '', guidance: '' }] })
  const updateObjection = (id: string, patch: Partial<ObjectionItem>) =>
    update({ objectionBank: draft.objectionBank.map((o) => (o.id === id ? { ...o, ...patch } : o)) })
  const removeObjection = (id: string) =>
    update({ objectionBank: draft.objectionBank.filter((o) => o.id !== id) })

  // ── Golden examples ──
  const examples = draft.goldenExamples ?? []
  const addExample = () => update({ goldenExamples: [...examples, ''] })
  const updateExample = (i: number, v: string) =>
    update({ goldenExamples: examples.map((e, idx) => (idx === i ? v : e)) })
  const removeExample = (i: number) =>
    update({ goldenExamples: examples.filter((_, idx) => idx !== i) })

  const handleSave = () => {
    if (!draft.chatPrice.trim()) {
      addToast('Cần nhập Giá chat trước khi lưu', 'error')
      return
    }
    setSaving(true)
    upsert({ ...draft, title: product?.productName ?? draft.title })
    addToast('Đã lưu cấu hình Chat Bot', 'success')
    setSaving(false)
  }


  return (
    <div className="mx-auto max-w-3xl space-y-5 px-5 py-5">
      {/* Fact sản phẩm (read-only) */}
      {product && (
        <details className="rounded-xl border border-black/8 bg-black/[0.02] p-3" open>
          <summary className="cursor-pointer text-xs font-semibold text-gray-700">
            Thông tin sản phẩm (từ bank — bot dùng để tư vấn)
          </summary>
          <div className="mt-2 space-y-1 text-xs text-gray-600">
            <Fact label="Lợi ích" value={product.benefits} />
            <Fact label="USP" value={product.usps} />
            <Fact label="Pain points" value={product.painPoints} />
            <p className="pt-1 text-[11px] text-amber-600">
              ⚠️ Giá Ladipage trong bank (offer) KHÔNG dùng cho chat — nhập giá chat riêng bên dưới.
            </p>
          </div>
        </details>
      )}

      {/* Thị trường */}
      <Field label="Thị trường / Ngôn ngữ">
        <select
          value={draft.market}
          onChange={(e) => update({ market: e.target.value as Market })}
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
        >
          {(Object.keys(MARKET_LABELS) as Market[]).map((m) => (
            <option key={m} value={m}>{MARKET_LABELS[m]}</option>
          ))}
        </select>
      </Field>

      {/* Giá chat + trần giảm */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Giá chat (riêng, KHÁC giá Ladipage)" required>
          <input
            value={draft.chatPrice}
            onChange={(e) => update({ chatPrice: e.target.value })}
            placeholder={draft.market === 'MY' ? 'vd: RM89' : 'vd: 299k'}
            className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
          />
        </Field>
        <Field label="Trần giảm giá (AI không vượt)" required>
          <input
            value={draft.discountFloor}
            onChange={(e) => update({ discountFloor: e.target.value })}
            placeholder={draft.market === 'MY' ? 'vd: RM69' : 'vd: 249k'}
            className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
          />
        </Field>
      </div>

      <Field label="Khuyến mãi khi chat (tuỳ chọn)">
        <input
          value={draft.chatPromo ?? ''}
          onChange={(e) => update({ chatPromo: e.target.value })}
          placeholder="vd: freeship + tặng quà khi chốt hôm nay"
          className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
        />
      </Field>

      {/* Media map */}
      <div className="rounded-xl border border-black/8 p-3">
        <MediaMapEditor
          productId={productId}
          value={draft.mediaMap}
          onChange={(mediaMap) => update({ mediaMap })}
        />
      </div>

      {/* Objection bank */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-700">
            Xử lý từ chối <span className="font-normal text-gray-400">({draft.objectionBank.length})</span>
          </label>
          <button onClick={addObjection} className="flex items-center gap-1 rounded-lg bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-black/10">
            <Plus className="h-3.5 w-3.5" /> Thêm
          </button>
        </div>
        <div className="space-y-2">
          {draft.objectionBank.map((o) => (
            <div key={o.id} className="flex gap-2 rounded-lg border border-black/8 p-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <input
                  value={o.trigger}
                  onChange={(e) => updateObjection(o.id, { trigger: e.target.value })}
                  placeholder="Khách nói gì (vd: chê mắc)…"
                  className="w-full rounded-md border border-black/10 px-2 py-1 text-xs outline-none focus:border-emerald-400"
                />
                <input
                  value={o.guidance}
                  onChange={(e) => updateObjection(o.id, { guidance: e.target.value })}
                  placeholder="Hướng gỡ (vd: nhấn bảo hành + tặng kèm)…"
                  className="w-full rounded-md border border-black/10 px-2 py-1 text-xs outline-none focus:border-emerald-400"
                />
              </div>
              <button onClick={() => removeObjection(o.id)} className="shrink-0 self-start rounded-md p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Golden examples */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-700">
            Hội thoại mẫu vàng <span className="font-normal text-gray-400">(dạy bot giọng của bạn)</span>
          </label>
          <button onClick={addExample} className="flex items-center gap-1 rounded-lg bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-black/10">
            <Plus className="h-3.5 w-3.5" /> Thêm
          </button>
        </div>
        <div className="space-y-2">
          {examples.map((ex, i) => (
            <div key={i} className="flex gap-2">
              <textarea
                value={ex}
                onChange={(e) => updateExample(i, e.target.value)}
                placeholder="Dán 1 đoạn chat lý tưởng (khách hỏi → bạn rep)…"
                rows={3}
                className="w-full rounded-lg border border-black/10 px-2.5 py-2 text-xs outline-none focus:border-emerald-400"
              />
              <button onClick={() => removeExample(i)} className="shrink-0 self-start rounded-md p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Playbook note */}
      <Field label="Ghi chú playbook (tone, độ 'lì' khi chốt)">
        <textarea
          value={draft.playbookNote ?? ''}
          onChange={(e) => update({ playbookNote: e.target.value })}
          placeholder="vd: thân thiện, xưng em; chốt dứt khoát nhưng không ép; ưu tiên xin SĐT sớm…"
          rows={3}
          className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
        />
      </Field>

      {/* Save */}
      <div className="sticky bottom-0 -mx-5 flex items-center justify-end gap-2 border-t border-black/10 bg-white/90 px-5 py-3 backdrop-blur">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Lưu cấu hình
        </button>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-gray-700">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null
  return (
    <p className="flex gap-1.5">
      <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-gray-500"><Tag className="h-3 w-3" />{label}:</span>
      <span className="line-clamp-2">{value}</span>
    </p>
  )
}
