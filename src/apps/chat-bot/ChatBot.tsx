import { useEffect, useState } from 'react'
import { MessageCircle, Settings2, PlayCircle } from 'lucide-react'
import { useChatBotStore } from './store'
import ProductPicker from './components/ProductPicker'
import ConfigPanel from './components/ConfigPanel'
import Simulator from './components/Simulator'

type Tab = 'config' | 'simulator'

// CHAT BOT — bộ não bán hàng cho chatbot rep tin nhắn (WhatsApp MY / Pancake VN).
// P0: khung + store. P1: tab Cấu hình (ProductPicker + ConfigPanel). P3: Mô phỏng.
export default function ChatBot() {
  const [tab, setTab] = useState<Tab>('config')
  const [productId, setProductId] = useState<string | null>(null)
  const hydrate = useChatBotStore((s) => s.hydrate)

  // Nạp cấu hình đã lưu (Supabase + localStorage fallback) khi mở app.
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      {/* pr lớn để cụm tab không nằm dưới badge Gemini/KIE Credit (góc phải, z-50) */}
      <div className="flex shrink-0 items-center gap-3 border-b border-black/10 py-3.5 pl-5 pr-28 md:pr-64">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
          <MessageCircle className="h-5 w-5 text-emerald-600" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold leading-tight text-gray-900">CHAT BOT</h1>
          <p className="truncate text-xs text-gray-500">
            Bộ não bán hàng — tư vấn &amp; chốt đơn qua tin nhắn (WhatsApp / Pancake)
          </p>
        </div>

        {/* Tabs */}
        <div className="ml-auto flex items-center gap-1 rounded-lg bg-black/[0.04] p-1">
          <TabButton active={tab === 'config'} onClick={() => setTab('config')} icon={Settings2}>
            Cấu hình
          </TabButton>
          <TabButton active={tab === 'simulator'} onClick={() => setTab('simulator')} icon={PlayCircle}>
            Mô phỏng
          </TabButton>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1">
        {tab === 'config' ? (
          <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-black/8 px-5 py-3">
              <div className="mx-auto max-w-3xl">
                <ProductPicker value={productId} onChange={setProductId} />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {productId ? (
                <ConfigPanel key={productId} productId={productId} onSaved={() => setTab('simulator')} />
              ) : (
                <div className="py-16 text-center text-sm text-gray-400">
                  Chọn một sản phẩm để bắt đầu cấu hình bot bán hàng.
                </div>
              )}
            </div>
          </div>
        ) : productId ? (
          <Simulator key={productId} productId={productId} />
        ) : (
          <div className="py-16 text-center text-sm text-gray-400">
            Chọn một sản phẩm (ở tab Cấu hình) để mô phỏng chat.
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({
  active, onClick, icon: Icon, children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {children}
    </button>
  )
}
