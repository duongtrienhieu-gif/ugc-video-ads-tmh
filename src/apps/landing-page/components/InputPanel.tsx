import { useState, useRef } from 'react'
import { Package, Loader2, LayoutTemplate, Globe2, Upload, X, Image as ImageIcon, Link2 } from 'lucide-react'
import type { Product } from '../../../stores/types'
import type { LandingGenParams, LandingLanguage, LandingForm, CompetitorInfluence, VisualMemoryItem } from '../types'
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

const FORM_OPTIONS: {
  id: LandingForm
  icon: string
  title: string
  tagline: string
  tooltip: string
}[] = [
  {
    id: 'ugc-malaysia',
    icon: '🚀',
    title: 'UGC Malaysia',
    tagline: 'Default — chuẩn chuyển đổi',
    tooltip: 'Form mặc định. 17 section chuẩn MY Ecommerce: hero + pain + social proof + WhatsApp + before/after + offer. Tỉ lệ chuyển đổi cao nhất cho FB Ads Malaysia.',
  },
  {
    id: 'advertorial',
    icon: '📰',
    title: 'Advertorial / Review',
    tagline: 'Storytelling, trust-building',
    tooltip: 'Viết theo dạng bài báo / review dài. Câu chuyện cá nhân → vấn đề → khám phá sản phẩm → kết quả. Phù hợp ngách y tế, sức khỏe, supplement cao cấp.',
  },
  {
    id: 'premium',
    icon: '💎',
    title: 'Premium Brand',
    tagline: 'Clean, lifestyle, ít hard-sell',
    tooltip: 'Tone sang trọng, hình ảnh lifestyle, ít urgency. Phù hợp skincare cao cấp, sản phẩm giá cao (>RM200). Brand-building hơn conversion-first.',
  },
  {
    id: 'hard-sell-cod',
    icon: '⚡',
    title: 'Hard Sell COD',
    tagline: 'Urgency mạnh, chốt nhanh',
    tooltip: 'Urgency tối đa, scarcity, nhiều CTA. Tối ưu cho COD, budget thấp, niche tiêu dùng nhanh. Mục tiêu chốt đơn trong vòng 60 giây đọc trang.',
  },
  // Phase 2 — NEW form added, stub for now (delegates to UGC default).
  // Phase 4 will replace with real expert / scientific engine.
  {
    id: 'chuyen-gia',
    icon: '🔬',
    title: 'Chuyên Gia / Khoa Học',
    tagline: 'Bác sĩ, cơ chế, nghiên cứu',
    tooltip: 'Landing page xây dựng niềm tin bằng chuyên gia, cơ chế sản phẩm, nghiên cứu và case study. Phù hợp niche medical / supplement / health tech. (Phase 2 stub — output tạm giống form UGC Malaysia, Phase 4 sẽ có engine riêng).',
  },
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

const INFLUENCE_OPTIONS: { id: CompetitorInfluence; icon: string; label: string; desc: string }[] = [
  { id: 'low',    icon: '🟢', label: 'Thấp',       desc: 'Chỉ học tone / giọng văn' },
  { id: 'medium', icon: '🟡', label: 'Trung bình', desc: 'Học style + ý tưởng section' },
  { id: 'high',   icon: '🔴', label: 'Cao',         desc: 'Adapt mạnh structure đối thủ' },
]

export default function InputPanel({
  selectedProduct, onProductSelect, onGenerate, isGenerating,
}: InputPanelProps) {
  const [pickerOpen, setPickerOpen]           = useState(false)
  const [language, setLanguage]               = useState<LandingLanguage>('ms')
  const [form, setForm]                       = useState<LandingForm>('ugc-malaysia')
  const [nicheHint, setNicheHint]             = useState('')
  const [competitorUrl, setCompetitorUrl]     = useState('')
  const [competitorInfluence, setCompetitorInfluence] = useState<CompetitorInfluence>('low')
  const [visualMemory, setVisualMemory]       = useState<VisualMemoryItem[]>([])
  const [uploading, setUploading]             = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resolvedProductImage = useAssetUrl(selectedProduct?.productImage)
  const hasGeminiKey = useSettingsStore((s) => s.hasGeminiKey())
  const openApp  = useAppStore((s) => s.openApp)
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
      form,
      nicheHint: nicheHint.trim() || undefined,
      competitorUrl: competitorUrl.trim() || undefined,
      competitorInfluence: competitorUrl.trim() ? competitorInfluence : undefined,
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

        {/* STEP 2 — Visual Memory */}
        <Section step={2} title="Visual Memory (tuỳ chọn)">
          <p className="text-[10px] text-gray-500">
            Upload ảnh sản phẩm (packaging, label, logo…) để AI giữ identity nhất quán khi sinh ảnh. Tối đa 3 ảnh đầu được pass vào image generator.
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
            Toàn bộ copy, headline, bullet, FAQ sẽ được viết HOÀN TOÀN bằng ngôn ngữ đã chọn.
          </p>
        </Section>

        {/* STEP 4 — Form selector */}
        <Section step={4} title="Chọn form landing page">
          <div className="grid grid-cols-2 gap-1.5">
            {FORM_OPTIONS.map((f) => (
              <FormCard
                key={f.id}
                option={f}
                selected={form === f.id}
                onSelect={() => setForm(f.id)}
              />
            ))}
          </div>

          {/* Niche hint — compact sub-field within Step 4 */}
          <div className="mt-2">
            <p className="mb-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Gợi ý niche (tuỳ chọn)</p>
            <input
              type="text"
              value={nicheHint}
              onChange={(e) => setNicheHint(e.target.value)}
              placeholder='vd: "supplement gut health"'
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-violet-500/40"
            />
            <div className="mt-1 flex flex-wrap gap-1">
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
          </div>
        </Section>

        {/* STEP 5 — Competitor URL (AI học từ đối thủ) */}
        <Section step={5} title="AI học từ landing page đối thủ (tuỳ chọn)">
          <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <input
              type="url"
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              placeholder="Dán link landing page đối thủ hoặc sản phẩm tương tự…"
              className="flex-1 bg-transparent text-xs text-gray-800 placeholder-gray-400 outline-none"
            />
            {competitorUrl && (
              <button onClick={() => setCompetitorUrl('')} className="text-gray-300 hover:text-gray-500">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Influence strength — only show when URL is entered */}
          {competitorUrl.trim() && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">AI Influence Strength</p>
              <div className="grid grid-cols-3 gap-1">
                {INFLUENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setCompetitorInfluence(opt.id)}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border py-2 text-[10px] transition-colors ${
                      competitorInfluence === opt.id
                        ? 'border-violet-400 bg-violet-50 text-violet-700'
                        : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                    }`}
                  >
                    <span className="text-sm leading-none">{opt.icon}</span>
                    <span className="font-semibold">{opt.label}</span>
                    <span className="text-center text-[9px] leading-tight text-gray-400">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-amber-600">
                AI chỉ học style/structure từ URL này. Tên sản phẩm, giá, ngôn ngữ và 17-section không bao giờ bị thay đổi.
              </p>
            </div>
          )}

          {!competitorUrl.trim() && (
            <p className="text-[10px] text-gray-400">
              Dán link landing page đối thủ để AI học style, tone, và cấu trúc — không bao giờ copy thông tin sản phẩm hay giá.
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
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo landing pack...</>
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

// ── Helper components ─────────────────────────────────────────────────

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

// Form card with hover tooltip
function FormCard({
  option,
  selected,
  onSelect,
}: {
  option: typeof FORM_OPTIONS[number]
  selected: boolean
  onSelect: () => void
}) {
  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
          selected
            ? 'border-violet-400 bg-violet-50'
            : 'border-black/10 bg-white hover:bg-black/[0.02]'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{option.icon}</span>
          <span className={`text-[11px] font-bold leading-tight ${selected ? 'text-violet-700' : 'text-gray-800'}`}>
            {option.title}
          </span>
        </div>
        <p className={`mt-0.5 text-[9px] leading-tight ${selected ? 'text-violet-500' : 'text-gray-400'}`}>
          {option.tagline}
        </p>
      </button>
      {/* Hover tooltip */}
      <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden w-52 rounded-lg border border-black/10 bg-white p-2.5 text-[10px] leading-relaxed text-gray-600 shadow-lg group-hover:block">
        <p className="mb-1 font-semibold text-gray-800">{option.icon} {option.title}</p>
        {option.tooltip}
      </div>
    </div>
  )
}

// Visual memory thumbnail with inline label edit + remove
function VisualMemoryThumb({
  item, onRemove, onLabelChange,
}: {
  item: VisualMemoryItem
  onRemove: () => void
  onLabelChange: (label: string) => void
}) {
  const url = useAssetUrl(item.ref)
  return (
    <div className="relative overflow-hidden rounded-lg border border-black/10 bg-white">
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
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-red-600"
        style={{ opacity: 1 }}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}
