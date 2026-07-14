import { useState } from 'react'
import { Plus, Trash2, MessageCircle, ChevronRight } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useChatBotStore } from '../store'
import { MARKET_LABELS } from '../labels'
import ProductPicker from './ProductPicker'

// Danh sách cấu hình Chat Bot đã lưu (để quản lý nhiều sản phẩm/page) + tạo mới.
// Bấm 1 cấu hình → mở để sửa/mô phỏng. Bấm "Tạo mới" → chọn sản phẩm từ bank.
export default function ConfigList({ onPick }: { onPick: (productId: string) => void }) {
  const configs = useChatBotStore((s) => s.configs)
  const remove = useChatBotStore((s) => s.remove)
  const getProductById = useBankStore((s) => s.getProductById)
  const [creating, setCreating] = useState(false)

  return (
    <div className="mx-auto max-w-3xl px-5 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">
          Cấu hình đã lưu <span className="font-normal text-gray-400">({configs.length})</span>
        </h2>
        <button
          onClick={() => setCreating((v) => !v)}
          className="ui-accent-solid flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Tạo cấu hình mới
        </button>
      </div>

      {/* Chọn sản phẩm để tạo mới */}
      {creating && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-500/[0.04] p-3">
          <ProductPicker
            value={null}
            onChange={(id) => { setCreating(false); onPick(id) }}
          />
          <p className="mt-2 text-[11px] text-gray-400">Chọn sản phẩm từ bank để cấu hình bot bán cho nó.</p>
        </div>
      )}

      {/* Danh sách cấu hình */}
      {configs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 py-12 text-center text-sm text-gray-400">
          Chưa có cấu hình nào. Bấm <span className="font-semibold">Tạo cấu hình mới</span> để bắt đầu.
        </div>
      ) : (
        <div className="space-y-2">
          {configs.map((c) => {
            const product = getProductById(c.productId)
            const name = c.title || product?.productName || '(sản phẩm đã xoá)'
            return (
              <div
                key={c.id}
                className="group flex items-center gap-3 rounded-xl border border-black/8 bg-white p-3 transition-colors hover:border-emerald-300 hover:bg-emerald-500/[0.03]"
              >
                <button onClick={() => onPick(c.productId)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">{name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                      <span className="rounded bg-black/[0.05] px-1.5 py-0.5">{MARKET_LABELS[c.market]}</span>
                      {(() => {
                        const first = (c.pricingTiers ?? []).find((t) => t.price.trim())
                        const shown = first ? first.price.trim() : c.chatPrice
                        return shown ? <span>· {shown}</span> : null
                      })()}
                      <span>· {c.mediaMap.length} ảnh</span>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Xoá cấu hình bot cho "${name}"?`)) remove(c.id)
                  }}
                  className="shrink-0 rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-500/10 hover:text-red-500"
                  title="Xoá cấu hình"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
