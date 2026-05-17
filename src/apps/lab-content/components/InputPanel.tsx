import { useState } from 'react'
import { Package, Loader2, Sparkles, Tag, ChevronDown, ChevronRight } from 'lucide-react'
import type { Product } from '../../../stores/types'
import type { Goal, LabBriefParams, PricingInfo, PricingStrategy, ToneId } from '../types'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import BankPicker from '../../../components/BankPicker'
import { GOAL_OPTIONS, PRICING_STRATEGY_OPTIONS, TONE_OPTIONS } from '../services/presets'

interface InputPanelProps {
  selectedProduct: Product | null
  onProductSelect: (p: Product) => void
  onGenerate: (params: Omit<LabBriefParams, 'productId'>) => void
  isGenerating: boolean
  goal: Goal
  onGoalChange: (g: Goal) => void
  toneId: ToneId
  onToneIdChange: (t: ToneId) => void
  customToneNote: string
  onCustomToneNoteChange: (s: string) => void
  pricing: PricingInfo
  onPricingChange: (p: PricingInfo) => void
}

export default function InputPanel({
  selectedProduct, onProductSelect, onGenerate, isGenerating,
  goal, onGoalChange,
  toneId, onToneIdChange,
  customToneNote, onCustomToneNoteChange,
  pricing, onPricingChange,
}: InputPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pricingExpanded, setPricingExpanded] = useState(false)

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
      goal,
      toneId,
      customToneNote: toneId === 'custom' ? customToneNote.trim() : undefined,
      pricing: pricing.enabled ? pricing : undefined,
    })
  }

  const togglePricingStrategy = (id: PricingStrategy) => {
    const exists = pricing.preferredStrategies.includes(id)
    onPricingChange({
      ...pricing,
      preferredStrategies: exists
        ? pricing.preferredStrategies.filter((x) => x !== id)
        : [...pricing.preferredStrategies, id],
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-black/8 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Lab Content — Cố Vấn chiến lược
        </h2>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Brainstorm 5 nỗi đau + 3 góc + 7 hook trước khi viết — bilingual VI/MY.
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

        {/* STEP 2 — Goal */}
        <Section step={2} title="Mục tiêu campaign">
          <div className="grid grid-cols-2 gap-1.5">
            {GOAL_OPTIONS.map((g) => {
              const isActive = goal === g.id
              return (
                <button
                  key={g.id}
                  onClick={() => onGoalChange(g.id)}
                  title={g.hint}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    isActive ? 'border-violet-400 bg-violet-50' : 'border-black/10 bg-white hover:bg-black/[0.03]'
                  }`}
                >
                  <span className="text-base leading-none">{g.glyph}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[11px] font-semibold ${isActive ? 'text-violet-800' : 'text-gray-800'}`}>
                      {g.label}
                    </p>
                    <p className="truncate text-[10px] text-gray-500">{g.hint}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* STEP 3 — Tone */}
        <Section step={3} title="Giọng văn (tone)">
          <div className="space-y-1.5">
            {TONE_OPTIONS.map((t) => {
              const isActive = toneId === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => onToneIdChange(t.id)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    isActive ? 'border-violet-400 bg-violet-50' : 'border-black/10 bg-white hover:bg-black/[0.03]'
                  }`}
                >
                  <span className="text-base leading-none">{t.glyph}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[11px] font-semibold ${isActive ? 'text-violet-800' : 'text-gray-800'}`}>
                      {t.label}
                    </p>
                    <p className="truncate text-[10px] text-gray-500">{t.hint}</p>
                  </div>
                </button>
              )
            })}
          </div>
          {toneId === 'custom' && (
            <textarea
              value={customToneNote}
              onChange={(e) => onCustomToneNoteChange(e.target.value)}
              placeholder="Mô tả tone bạn muốn (vd: vibe Gen-Z hài hước, dùng nhiều câu ngắn, không emoji)…"
              rows={3}
              className="mt-2 w-full resize-none rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[12px] placeholder:text-gray-400 focus:border-violet-400 focus:outline-none"
            />
          )}
        </Section>

        {/* STEP 4 — Pricing layer (optional, collapsible) */}
        <Section step={4} title="Pricing layer (tùy chọn)">
          <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${
            pricing.enabled ? 'border-amber-300 bg-amber-50' : 'border-black/10 bg-white hover:bg-black/[0.02]'
          }`}>
            <input
              type="checkbox"
              checked={pricing.enabled}
              onChange={(e) => onPricingChange({ ...pricing, enabled: e.target.checked })}
              className="mt-0.5 accent-amber-600"
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                <Tag className="h-3.5 w-3.5 text-amber-600" />
                Bật chiến lược giá cho BOFU caption
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500">
                Inject pricing facts + 7 chiến lược neo tâm lý (Anchoring, Daily Cost, Value Stacking...) vào Caption / Phễu / Hook BOFU.
              </p>
            </div>
          </label>

          {pricing.enabled && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-white p-3">
              {/* Prices */}
              <div className="grid grid-cols-2 gap-2">
                <PriceField
                  label="Giá hiện tại"
                  value={pricing.currentPrice}
                  placeholder="490000"
                  onChange={(v) => onPricingChange({ ...pricing, currentPrice: v })}
                />
                <PriceField
                  label="Giá gốc / so sánh"
                  value={pricing.anchorPrice}
                  placeholder="990000"
                  onChange={(v) => onPricingChange({ ...pricing, anchorPrice: v })}
                />
              </div>

              {/* Offer + bonus */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Mô tả ưu đãi (optional)
                </label>
                <textarea
                  value={pricing.offerDescription}
                  onChange={(e) => onPricingChange({ ...pricing, offerDescription: e.target.value })}
                  placeholder="vd: Mua 2 tặng 1, freeship toàn quốc, COD"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[11px] placeholder:text-gray-400 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Bonus tặng kèm (optional)
                </label>
                <textarea
                  value={pricing.bonusDescription}
                  onChange={(e) => onPricingChange({ ...pricing, bonusDescription: e.target.value })}
                  placeholder="vd: Tặng ebook 'Lộ trình giảm cân 30 ngày' trị giá 990K"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[11px] placeholder:text-gray-400 focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* Strategy selection */}
              <div>
                <button
                  onClick={() => setPricingExpanded((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Chiến lược ưu tiên {pricing.preferredStrategies.length > 0 ? `(${pricing.preferredStrategies.length})` : '· AI tự chọn'}
                  </span>
                  {pricingExpanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                </button>
                {pricingExpanded && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {PRICING_STRATEGY_OPTIONS.map((s) => {
                      const isActive = pricing.preferredStrategies.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          onClick={() => togglePricingStrategy(s.id)}
                          title={s.hint}
                          className={`flex items-start gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                            isActive ? 'border-amber-400 bg-amber-50' : 'border-black/10 bg-white hover:bg-black/[0.03]'
                          }`}
                        >
                          <span className="text-sm leading-none">{s.glyph}</span>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-[10px] font-semibold ${isActive ? 'text-amber-800' : 'text-gray-800'}`}>
                              {s.label}
                            </p>
                            <p className="truncate text-[9px] text-gray-500">{s.hint}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
                {pricing.preferredStrategies.length === 0 && (
                  <p className="mt-1.5 text-[10px] italic text-gray-500">
                    Bỏ trống = AI tự chọn 2-3 chiến lược phù hợp nhất.
                  </p>
                )}
              </div>
            </div>
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
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Đang phân tích chiến lược...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Tạo Strategic Brief</>
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

function PriceField({ label, value, placeholder, onChange }: {
  label: string
  value: number
  placeholder: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </label>
      <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 focus-within:border-amber-400">
        <input
          type="number"
          min={0}
          value={value === 0 ? '' : value}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[11px] placeholder:text-gray-300 focus:outline-none"
        />
        <span className="shrink-0 text-[10px] font-semibold text-gray-400">đ</span>
      </div>
    </div>
  )
}
