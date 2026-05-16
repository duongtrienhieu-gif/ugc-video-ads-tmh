import { useState } from 'react'
import { Package, Loader2, LayoutTemplate, Globe2 } from 'lucide-react'
import type { Product } from '../../../stores/types'
import type { LandingGenParams, LandingLanguage } from '../types'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import BankPicker from '../../../components/BankPicker'

interface InputPanelProps {
  selectedProduct: Product | null
  onProductSelect: (p: Product) => void
  onGenerate: (params: Omit<LandingGenParams, 'productId'>) => void
  isGenerating: boolean
}

const LANGUAGE_OPTIONS: { id: LandingLanguage; label: string; flag: string; hint: string }[] = [
  { id: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾', hint: 'Native Malaysia (mặc định)' },
  { id: 'vi', label: 'Tiếng Việt',     flag: '🇻🇳', hint: 'Ecommerce Vietnam' },
  { id: 'en', label: 'English',        flag: '🇬🇧', hint: 'SEA English' },
]

const NICHE_PRESETS = [
  'supplement gut health',
  'supplement collagen / beauty',
  'skincare anti-aging',
  'skincare acne',
  'weight-loss patch',
  'haircare / hair growth',
  'detox / cleanse',
]

export default function InputPanel({
  selectedProduct, onProductSelect, onGenerate, isGenerating,
}: InputPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [language, setLanguage] = useState<LandingLanguage>('ms')
  const [nicheHint, setNicheHint] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')

  const resolvedProductImage = useAssetUrl(selectedProduct?.productImage)
  const hasGeminiKey = useSettingsStore((s) => s.hasGeminiKey())
  const openApp = useAppStore((s) => s.openApp)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const productCount = useBankStore((s) => s.products.length)

  const handleOpenFinder = () => {
    sendToApp({ targetApp: 'finder', targetField: 'activeBank', data: 'products' })
    openApp('finder')
  }

  const canGenerate = !!selectedProduct && hasGeminiKey && !isGenerating

  const handleClickGenerate = () => {
    if (!canGenerate) return
    onGenerate({
      language,
      nicheHint: nicheHint.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-black/8 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <LayoutTemplate className="h-4 w-4 text-violet-500" />
          Landing Page AI
        </h2>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Advertorial pack copy + image prompts để paste vào Ladipage. Mobile-first, conversion-first.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* STEP 1 — Product */}
        <Section step={1} title="Chọn sản phẩm">
          {selectedProduct ? (
            <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-2.5">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {resolvedProductImage ? (
                  <img src={resolvedProductImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                    <Package className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{selectedProduct.productName}</p>
                <p className="truncate text-[10px] text-gray-400">{selectedProduct.targetMarket || 'Chưa rõ market'}</p>
              </div>
              <button
                onClick={() => setPickerOpen(true)}
                className="rounded-lg border border-black/10 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-black/[0.04]"
              >
                Đổi
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100"
            >
              <Package className="h-4 w-4" />
              {productCount > 0 ? 'Chọn sản phẩm từ Project' : 'Chưa có sản phẩm'}
            </button>
          )}
          {productCount === 0 && (
            <button onClick={handleOpenFinder} className="text-[11px] text-violet-600 underline">
              Mở Project để tạo sản phẩm
            </button>
          )}
        </Section>

        {/* STEP 2 — Language */}
        <Section step={2} title="Ngôn ngữ output">
          <div className="grid grid-cols-3 gap-1.5">
            {LANGUAGE_OPTIONS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLanguage(l.id)}
                title={l.hint}
                className={`flex flex-col items-center gap-0.5 rounded-lg border py-2 text-[11px] transition-colors ${
                  language === l.id
                    ? 'border-violet-400 bg-violet-50 text-violet-700'
                    : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                }`}
              >
                <span className="text-base leading-none">{l.flag}</span>
                <span className="font-medium">{l.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-gray-400">
            <Globe2 className="mr-1 inline h-3 w-3" />
            "Hướng dẫn layout" luôn là Tiếng Việt cho dù chọn ngôn ngữ nào.
          </p>
        </Section>

        {/* STEP 3 — Niche hint (optional) */}
        <Section step={3} title="Gợi ý niche (tuỳ chọn)">
          <input
            type="text"
            value={nicheHint}
            onChange={(e) => setNicheHint(e.target.value)}
            placeholder='vd: "supplement gut health"'
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-violet-500/40"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {NICHE_PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => setNicheHint(n)}
                className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] text-gray-500 hover:bg-violet-50 hover:text-violet-700"
              >
                {n}
              </button>
            ))}
          </div>
        </Section>

        {/* STEP 4 — Source URL (optional, Phase 1 = context only, no crawl) */}
        <Section step={4} title="URL tham chiếu (tuỳ chọn)">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-violet-500/40"
          />
          <p className="mt-1 text-[10px] text-amber-600">
            Phase 1: URL được pass làm context text, chưa auto-crawl. Phase 2 sẽ crawl section + image URLs.
          </p>
        </Section>
      </div>

      {/* Bottom CTA */}
      <div className="shrink-0 border-t border-black/8 p-4">
        {!hasGeminiKey && (
          <p className="mb-2 text-center text-[10px] text-red-500">Cần Gemini API key trong Cài đặt</p>
        )}
        <button
          onClick={handleClickGenerate}
          disabled={!canGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo 10 sections...</>
          ) : (
            <><LayoutTemplate className="h-4 w-4" /> Tạo Landing Pack</>
          )}
        </button>
      </div>

      <BankPicker
        bankType="products"
        isOpen={pickerOpen}
        onSelect={(item) => { onProductSelect(item as Product); setPickerOpen(false) }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        Bước {step} · {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}
