import { useState, useRef } from 'react'
import { Package, Loader2, LayoutTemplate, Globe2, Upload, X, Image as ImageIcon } from 'lucide-react'
import type { Product } from '../../../stores/types'
import type { LandingGenParams, LandingLanguage, VisualMemoryItem } from '../types'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import { saveAsset } from '../../../utils/assetStore'
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
  const [visualMemory, setVisualMemory] = useState<VisualMemoryItem[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      visualMemory,
    })
  }

  // ── Visual Memory upload ──────────────────────────────────────────────
  const handleFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const newItems: VisualMemoryItem[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const ref = await saveAsset(file, file.type)
        const label = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'image'
        newItems.push({ ref, label })
      }
      setVisualMemory((prev) => [...prev, ...newItems])
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeMemoryItem = (ref: string) => {
    setVisualMemory((prev) => prev.filter((m) => m.ref !== ref))
  }

  const updateMemoryLabel = (ref: string, label: string) => {
    setVisualMemory((prev) => prev.map((m) => m.ref === ref ? { ...m, label } : m))
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
          Advertorial factory: 17 sections, ảnh thật, dual-language (MY + VI). Mobile-first, conversion-first.
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

        {/* STEP 2 — Visual Memory (multi-image upload) */}
        <Section step={2} title="Visual Memory (tuỳ chọn)">
          <p className="text-[10px] text-gray-500">
            Upload ảnh sản phẩm (packaging, label, logo, screenshot Shopee/competitor…) để AI giữ identity nhất quán khi sinh ảnh. Tối đa 3 ảnh đầu sẽ được pass vào image generator.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'Đang upload…' : 'Thêm ảnh tham chiếu'}
            </button>
            <span className="text-[10px] text-gray-400">{visualMemory.length} ảnh</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFilesPicked(e.target.files)}
          />
          {visualMemory.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {visualMemory.map((m) => (
                <VisualMemoryThumb
                  key={m.ref}
                  item={m}
                  onRemove={() => removeMemoryItem(m.ref)}
                  onLabelChange={(label) => updateMemoryLabel(m.ref, label)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* STEP 3 — Language */}
        <Section step={3} title="Ngôn ngữ output">
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

        {/* STEP 4 — Niche hint (optional) */}
        <Section step={4} title="Gợi ý niche (tuỳ chọn)">
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

        {/* STEP 5 — Source URL (optional, Phase 2 = context only, no crawl) */}
        <Section step={5} title="URL tham chiếu (tuỳ chọn)">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-violet-500/40"
          />
          <p className="mt-1 text-[10px] text-amber-600">
            Phase 2: URL pass làm context cho Gemini. Auto-crawl (image scrape, section structure) sẽ ship ở Phase 3.
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
            <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo 17 sections...</>
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

// ── Visual memory thumbnail with inline label edit + remove ─────────────
function VisualMemoryThumb({
  item, onRemove, onLabelChange,
}: {
  item: VisualMemoryItem
  onRemove: () => void
  onLabelChange: (label: string) => void
}) {
  const url = useAssetUrl(item.ref)
  return (
    <div className="relative rounded-lg border border-black/10 bg-white overflow-hidden">
      <div className="aspect-square w-full bg-gray-100">
        {url ? (
          <img src={url} alt={item.label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
      </div>
      <input
        type="text"
        value={item.label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="w-full border-t border-black/8 bg-white px-1.5 py-1 text-[10px] text-gray-700 outline-none focus:bg-violet-50"
      />
      <button
        onClick={onRemove}
        title="Xoá"
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
        style={{ opacity: 1 }}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}
