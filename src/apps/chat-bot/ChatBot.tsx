import { useEffect, useState } from 'react'
import { MessageCircle, ChevronLeft } from 'lucide-react'
import { useChatBotStore } from './store'
import { useBankStore } from '../../stores/bankStore'
import ConfigPanel from './components/ConfigPanel'
import ConfigList from './components/ConfigList'
import Simulator from './components/Simulator'
import AppHeader from '../../components/shell/AppHeader'
import SegmentTabs from '../../components/shell/SegmentTabs'

type Tab = 'config' | 'simulator'

// CHAT BOT — bộ não bán hàng cho chatbot rep tin nhắn (WhatsApp MY / Pancake VN).
// productId đang chọn lưu trong store (persist) → F5 không mất chỗ.
export default function ChatBot() {
  const [tab, setTab] = useState<Tab>('config')
  const productId = useChatBotStore((s) => s.selectedProductId)
  const setProductId = useChatBotStore((s) => s.setSelectedProductId)
  const hydrate = useChatBotStore((s) => s.hydrate)
  const product = useBankStore((s) => (productId ? s.getProductById(productId) : undefined))

  // Nạp cấu hình đã lưu (Supabase + localStorage fallback) khi mở app.
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <div className="flex h-full flex-col bg-app-base">
      <AppHeader
        icon={MessageCircle}
        eyebrow="CHAT BOT · SALES BRAIN"
        title="Chat Bot"
        subtitle="Bộ não bán hàng — tư vấn & chốt đơn qua tin nhắn (WhatsApp / Pancake)"
      />

      {/* Config ↔ Simulator switcher */}
      <div className="shrink-0 border-b border-app-border px-3 py-2">
        <div className="mx-auto max-w-xs">
          <SegmentTabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'config', label: '⚙ Cấu hình' },
              { value: 'simulator', label: '▶ Mô phỏng' },
            ]}
          />
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1">
        {tab === 'config' ? (
          !productId ? (
            <div className="h-full overflow-y-auto">
              <ConfigList onPick={setProductId} />
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex shrink-0 items-center gap-2 border-b border-black/8 px-5 py-2.5">
                <button
                  onClick={() => setProductId(null)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-gray-500 transition-colors hover:bg-black/5"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Cấu hình đã lưu
                </button>
                <span className="truncate text-xs font-semibold text-gray-800">
                  {product?.productName || '(sản phẩm)'}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ConfigPanel key={productId} productId={productId} onSaved={() => setTab('simulator')} />
              </div>
            </div>
          )
        ) : productId ? (
          <Simulator key={productId} productId={productId} />
        ) : (
          <div className="py-16 text-center text-sm text-gray-400">
            Chọn một cấu hình ở tab <span className="font-semibold">Cấu hình</span> để mô phỏng chat.
          </div>
        )}
      </div>
    </div>
  )
}
