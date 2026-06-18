import { useState } from 'react'
import { Package, Loader2, Megaphone } from 'lucide-react'
import type { Product } from '../../../stores/types'
import type { AdsContentGenParams, LangMode, PlatformId } from '../types'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import BankPicker from '../../../components/BankPicker'
import { ADS_ANGLES, PLATFORM_OPTIONS } from '../services/presets'

interface InputPanelProps {
  selectedProduct: Product | null
  onProductSelect: (p: Product) => void
  onGenerate: (params: Omit<AdsContentGenParams, 'productId'>) => void
  isGenerating: boolean
  // Form state — owned by parent so it survives F5 via session persistence.
  presetId: string                      // holds an ADS_ANGLES id
  onPresetIdChange: (id: string) => void
  platform: PlatformId
  onPlatformChange: (p: PlatformId) => void
  langMode: LangMode
  onLangModeChange: (l: LangMode) => void
}

const LANG_OPTIONS: { value: LangMode; label: string; glyph: string }[] = [
  { value: 'ms',   label: 'Bahasa Malaysia', glyph: '🇲🇾' },
  { value: 'vi',   label: 'Tiếng Việt',       glyph: '🇻🇳' },
  { value: 'both', label: 'Cả hai',           glyph: '🌏' },
]

export default function InputPanel({
  selectedProduct, onProductSelect, onGenerate, isGenerating,
  presetId, onPresetIdChange: setPresetId,
  platform, onPlatformChange: setPlatform,
  langMode, onLangModeChange: setLangMode,
}: InputPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

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
    // Length / CTA / educational are derived from the chosen angle inside the
    // engine — we pass harmless defaults here so the param shape stays intact.
    onGenerate({
      presetId,
      platform,
      langMode,
      lengthMode: 'medium',
      toneIds: [],
      ctaStrength: 'balanced',
      educationalMode: false,
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-black/8 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Megaphone className="h-4 w-4 text-pink-500" />
          Ads Content — Caption thực chiến
        </h2>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Caption + tiêu đề cho Facebook / TikTok / IG ads — chọn 3 bước là xong.
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
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-pink-300 bg-pink-50 px-4 py-3 text-sm font-semibold text-pink-700 hover:bg-pink-100"
            >
              <Package className="h-4 w-4" />
              {productCount > 0 ? 'Chọn sản phẩm từ Project' : 'Chưa có sản phẩm'}
            </button>
          )}
          {productCount === 0 && (
            <button onClick={handleOpenFinder} className="text-[11px] text-pink-600 underline">
              Mở Project để tạo sản phẩm
            </button>
          )}
        </Section>

        {/* STEP 2 — Angle */}
        <Section step={2} title="Góc tiếp cận">
          <div className="grid grid-cols-1 gap-1.5">
            {ADS_ANGLES.map((a) => {
              const isActive = presetId === a.id
              return (
                <button
                  key={a.id}
                  onClick={() => setPresetId(a.id)}
                  title={a.hint}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive ? 'border-pink-400 bg-pink-50' : 'border-black/10 bg-white hover:bg-black/[0.03]'
                  }`}
                >
                  <span className="text-lg leading-none">{a.glyph}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-semibold ${isActive ? 'text-pink-800' : 'text-gray-800'}`}>
                      {a.label}
                    </p>
                    <p className="text-[10px] text-gray-500">{a.hint}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* STEP 3 — Platform */}
        <Section step={3} title="Nền tảng ads">
          <div className="grid grid-cols-5 gap-1.5">
            {PLATFORM_OPTIONS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                title={p.hint}
                className={`flex flex-col items-center gap-0.5 rounded-lg border py-2 text-[10px] transition-colors ${
                  platform === p.id
                    ? 'border-pink-400 bg-pink-50 text-pink-700'
                    : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                }`}
              >
                <span className="text-base leading-none">{p.glyph}</span>
                <span className="font-medium">{p.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* STEP 4 — Language */}
        <Section step={4} title="Ngôn ngữ output">
          <div className="grid grid-cols-3 gap-1.5">
            {LANG_OPTIONS.map((l) => (
              <button
                key={l.value}
                onClick={() => setLangMode(l.value)}
                className={`flex flex-col items-center gap-0.5 rounded-lg border py-2.5 text-[10px] transition-colors ${
                  langMode === l.value
                    ? 'border-pink-400 bg-pink-50 text-pink-700'
                    : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                }`}
              >
                <span className="text-base leading-none">{l.glyph}</span>
                <span className="font-medium">{l.label}</span>
              </button>
            ))}
          </div>
          {langMode === 'ms' && (
            <p className="mt-1.5 text-[10px] text-gray-400">
              Bản Malay sẽ kèm bản dịch VN sát nghĩa để bạn đọc hiểu.
            </p>
          )}
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
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-600 to-rose-600 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:from-pink-700 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo 3 variations...</>
          ) : (
            <><Megaphone className="h-4 w-4" /> Tạo content</>
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

// ── Helpers ─────────────────────────────────────────────────────────────

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
