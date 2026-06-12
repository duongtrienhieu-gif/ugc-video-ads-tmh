import { useState } from 'react'
import { Package, Loader2, Rocket, Globe2, X, Image as ImageIcon, Link2, ChevronDown, Check } from 'lucide-react'
import { hasFourProductImages, type Product } from '../../../stores/types'
import type { LandingGenParams, LandingLanguage, LandingForm, CompetitorInfluence, VisualMemoryItem } from '../types'
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

const FORM_OPTIONS: {
  id: LandingForm
  icon: string
  title: string
  badge: string
  badgeColor: 'violet' | 'emerald' | 'cyan' | 'amber' | 'rose'
  description: string
  audience: string
  metrics: string
  tooltip: string
}[] = [
  {
    id: 'ugc-malaysia',
    icon: '🚀',
    title: 'UGC Chuyển Đổi Nhanh',
    badge: 'Chuyển đổi nhanh',
    badgeColor: 'violet',
    description: 'Social proof, review, UGC và bố cục TikTok/Shopee style.',
    audience: 'TikTok Ads · COD · impulse products · supplement / beauty mass-market',
    metrics: '17 sections · ~36 ảnh · UGC mobile',
    tooltip: 'Form mặc định — landing page tối ưu chuyển đổi bằng social proof, review, UGC và bố cục TikTok/Shopee style. 17 section đầy đủ (hero + pain + social proof + WhatsApp + before/after + offer). Tỉ lệ chuyển đổi cao nhất cho FB Ads Malaysia.',
  },
  {
    id: 'advertorial',
    icon: '📰',
    title: 'Kể Chuyện Hành Trình',
    badge: 'Cảm xúc mạnh',
    badgeColor: 'rose',
    description: 'Một nhân vật xuyên suốt kể lại hành trình thay đổi.',
    audience: 'supplement · skincare · health · sản phẩm cần build trust trước khi sell',
    metrics: '12 sections · ~16 ảnh · cinematic lifestyle',
    tooltip: 'Form advertorial dạng kể chuyện cá nhân — một nhân vật xuyên suốt từ vấn đề → cơ duyên gặp sản phẩm → kết quả → giới thiệu người khác. 12 section emotional arc, character continuity, ~16 ảnh cinematic. Phù hợp ngách cần xây dựng cảm xúc và niềm tin trước khi chốt đơn.',
  },
  {
    id: 'chuyen-gia',
    icon: '🔬',
    title: 'Chuyên Gia / Khoa Học',
    badge: 'Độ tin cậy cao',
    badgeColor: 'cyan',
    description: 'Tập trung cơ chế sản phẩm và xây dựng niềm tin chuyên môn.',
    audience: 'medical · supplement · health tech · anti-aging · premium wellness',
    metrics: '13 sections · ~17 ảnh · editorial infographic',
    tooltip: 'Form chuyên gia / khoa học — landing page authority do một dược sĩ / bác sĩ / dietitian dẫn dắt. Tập trung mechanism + ingredient + comparison + news-proof. 13 section, ~17 ảnh editorial / infographic (không phải UGC selfie). Phù hợp ngách cần trust qua kiến thức chuyên môn.',
  },
  {
    id: 'hard-sell-cod',
    icon: '⚡',
    title: 'Chốt Đơn Mạnh',
    badge: 'CTA dày',
    badgeColor: 'amber',
    description: 'CTA dày, urgency mạnh, tối ưu COD impulse buy.',
    audience: 'COD · impulse buy · low-mid ticket · viral FB ads · audience đọc nhanh',
    metrics: '14 sections · ~35 ảnh · CTA banner',
    tooltip: 'Form chốt đơn mạnh — 14 section conversion funnel với CTA xuất hiện ở 13/14 section, urgency strip ở hero/offer/final-cta. ~35 ảnh heavy social proof (FB/TikTok/Shopee/WhatsApp) + before-after + COD delivery + promo banner. Phù hợp COD impulse buy, audience đọc nhanh.',
  },
  {
    id: 'premium',
    icon: '💎',
    title: 'Thương Hiệu Cao Cấp',
    badge: 'Lifestyle cao cấp',
    badgeColor: 'emerald',
    description: 'Premium lifestyle, thương hiệu sang trọng, brand-first.',
    audience: 'luxury skincare · beauty · premium wellness · high-AOV brand-first',
    metrics: '11 sections · ~15 ảnh · luxury editorial',
    tooltip: 'Form thương hiệu cao cấp — 11 section luxury editorial (hero cinematic → brand philosophy → lifestyle → ingredient → texture / ritual → curated testimonials → premium press → soft CTA). ~15 ảnh fashion-editorial / Aesop / Apple aesthetic. KHÔNG TikTok/Shopee/WhatsApp screenshot, KHÔNG urgency, KHÔNG discount. Phù hợp luxury skincare / premium wellness / high-AOV brand-first products.',
  },
]

const FORM_BADGE_CLASSES: Record<'violet' | 'emerald' | 'cyan' | 'amber' | 'rose', string> = {
  violet:  'bg-violet-100 text-violet-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  cyan:    'bg-cyan-100 text-cyan-700',
  amber:   'bg-amber-100 text-amber-700',
  rose:    'bg-rose-100 text-rose-700',
}

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
  const nicheHint = ''
  const [competitorUrl, setCompetitorUrl]     = useState('')
  const [competitorInfluence, setCompetitorInfluence] = useState<CompetitorInfluence>('low')
  const [expandedStep, setExpandedStep] = useState<number | null>(1)

  const selectedFormOption = FORM_OPTIONS.find((f) => f.id === form)
  const selectedLanguageOption = LANGUAGE_OPTIONS.find((l) => l.id === language)

  const resolvedProductImage = useAssetUrl(selectedProduct?.productImage)
  const hasGeminiKey = useSettingsStore((s) => s.hasGeminiKey())
  const openApp  = useAppStore((s) => s.openApp)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const productCount = useBankStore((s) => s.products.length)

  const handleOpenFinder = () => {
    sendToApp({ targetApp: 'finder', targetField: 'activeBank', data: 'products' })
    openApp('finder')
  }

  // Gate: require the product's 4 images (legacy 1-image products are blocked
  // until the user re-uploads 4 in the Product app).
  const canGenerate = !!selectedProduct && hasFourProductImages(selectedProduct) && hasGeminiKey && !isGenerating

  // Visual memory now comes straight from the product's 4 bank images — the
  // user no longer uploads per-listing references (avoids overloading the
  // vision brain with extra/conflicting images).
  const effectiveVisualMemory = (): VisualMemoryItem[] => {
    const imgs = (selectedProduct?.productImages ?? []).filter((r) => !!r && r.trim() !== '').slice(0, 4)
    const name = selectedProduct?.productName?.slice(0, 30) || 'product'
    return imgs.map((ref, i) => ({ ref, label: `${name} ${i + 1}` }))
  }

  const handleClickGenerate = () => {
    if (!canGenerate) return
    onGenerate({
      language,
      form,
      nicheHint: nicheHint.trim() || undefined,
      competitorUrl: competitorUrl.trim() || undefined,
      competitorInfluence: competitorUrl.trim() ? competitorInfluence : undefined,
      visualMemory: effectiveVisualMemory(),
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-black/8 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Rocket className="h-4 w-4 text-violet-500" />
          Super Ladipage
        </h2>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Chọn sản phẩm, chọn kiểu landing page, AI tạo toàn bộ copy + ảnh — sẵn sàng dán vào Ladipage.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 md:space-y-4">

        <Section
          step={1}
          title="Chọn sản phẩm"
          summary={selectedProduct?.productName ?? 'Chưa chọn'}
          completed={!!selectedProduct}
          expandedStep={expandedStep}
          onToggle={setExpandedStep}
        >
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

        <Section
          step={2}
          title="Ảnh sản phẩm (từ Project)"
          summary={
            !selectedProduct ? 'Chưa chọn'
              : hasFourProductImages(selectedProduct) ? `${selectedProduct.productImages.filter(Boolean).length} ảnh`
                : 'Thiếu ảnh'
          }
          completed={!!selectedProduct && hasFourProductImages(selectedProduct)}
          expandedStep={expandedStep}
          onToggle={setExpandedStep}
        >
          {!selectedProduct ? (
            <p className="text-[10px] text-gray-400">Chọn sản phẩm để dùng 4 ảnh của nó.</p>
          ) : !hasFourProductImages(selectedProduct) ? (
            <p className="text-[10px] leading-snug text-amber-600">
              Sản phẩm thiếu ảnh — cần đủ <strong>4 ảnh</strong>. Vào app Sản phẩm bổ sung đủ 4 ảnh rồi lưu mới tạo được landing.
            </p>
          ) : (
            <>
              <p className="text-[10px] text-gray-500">
                Dùng 4 ảnh từ sản phẩm để AI hiểu + giữ identity. Đổi ảnh ở app Sản phẩm.
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {selectedProduct.productImages.filter((r) => !!r && r.trim() !== '').slice(0, 4).map((ref) => (
                  <VisualMemoryThumb key={ref} item={{ ref, label: 'product' }} />
                ))}
              </div>
            </>
          )}
        </Section>

        <Section
          step={3}
          title="Ngôn ngữ landing page"
          summary={selectedLanguageOption ? `${selectedLanguageOption.flag} ${selectedLanguageOption.label}` : undefined}
          completed
          expandedStep={expandedStep}
          onToggle={setExpandedStep}
        >
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

        <Section
          step={4}
          title="Chọn kiểu landing page"
          summary={selectedFormOption ? `${selectedFormOption.icon} ${selectedFormOption.title}` : undefined}
          completed
          expandedStep={expandedStep}
          onToggle={setExpandedStep}
        >
          <p className="mb-2 text-[10px] text-gray-400">
            Mỗi kiểu là một <strong>sales psychology engine riêng</strong> — chọn theo mục tiêu marketing, không chỉ theo giao diện.
          </p>
          <div className="flex flex-col gap-2">
            {FORM_OPTIONS.map((f) => (
              <FormCard
                key={f.id}
                option={f}
                selected={form === f.id}
                onSelect={() => setForm(f.id)}
              />
            ))}
          </div>
        </Section>

        <Section
          step={5}
          title="Học từ landing page đối thủ (tuỳ chọn)"
          summary={competitorUrl.trim() ? competitorUrl.replace(/^https?:\/\//, '').slice(0, 28) + '…' : 'Bỏ qua'}
          completed={!!competitorUrl.trim()}
          expandedStep={expandedStep}
          onToggle={setExpandedStep}
        >
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

      <div className="shrink-0 sticky bottom-0 md:static border-t border-black/8 bg-white/95 md:bg-transparent backdrop-blur md:backdrop-blur-none p-3 md:p-4 z-10">
        {!hasGeminiKey && (
          <p className="mb-2 text-center text-[10px] text-red-500">Cần Gemini API key trong Cài đặt</p>
        )}
        <button
          onClick={handleClickGenerate}
          disabled={!canGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 md:py-3.5 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo landing pack...</>
          ) : (
            <><Rocket className="h-4 w-4" /> Tạo Landing Pack</>
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

function Section({
  step, title, children,
  summary, completed,
  expandedStep, onToggle,
}: {
  step: number
  title: string
  children: React.ReactNode
  summary?: string
  completed?: boolean
  expandedStep: number | null
  onToggle: (next: number | null) => void
}) {
  const isExpanded = expandedStep === step

  return (
    <div className="rounded-xl border border-transparent md:border-0 md:rounded-none">
      <button
        type="button"
        onClick={() => onToggle(isExpanded ? null : step)}
        className={`md:hidden flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
          isExpanded
            ? 'border-violet-300 bg-violet-50/40'
            : 'border-black/10 bg-white hover:bg-black/[0.02]'
        }`}
        aria-expanded={isExpanded}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              completed
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {completed ? <Check className="h-3 w-3" strokeWidth={3} /> : step}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold leading-tight text-gray-900">{title}</p>
            {summary && !isExpanded && (
              <p className="truncate text-[10px] leading-tight text-gray-500">{summary}</p>
            )}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      <p className="hidden md:block mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        Bước {step} · {title}
      </p>

      <div
        className={`space-y-1.5 ${
          isExpanded ? 'mt-2 px-1 md:mt-0 md:px-0' : 'hidden md:block'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

function FormCard({
  option,
  selected,
  onSelect,
}: {
  option: typeof FORM_OPTIONS[number]
  selected: boolean
  onSelect: () => void
}) {
  const badgeCls = FORM_BADGE_CLASSES[option.badgeColor]
  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        className={`flex w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
          selected
            ? 'border-violet-400 bg-violet-50/50 ring-2 ring-violet-200/60'
            : 'border-black/10 bg-white hover:border-black/20 hover:bg-black/[0.02]'
        }`}
      >
        <div className="flex items-start gap-2">
          <span className="text-lg leading-none">{option.icon}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-[12px] font-bold leading-tight ${selected ? 'text-violet-800' : 'text-gray-900'}`}>
              {option.title}
            </p>
            <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${badgeCls}`}>
              {option.badge}
            </span>
          </div>
        </div>

        <p className={`text-[10px] leading-snug ${selected ? 'text-violet-700' : 'text-gray-500'}`}>
          {option.description}
        </p>

        <p className="hidden md:block text-[9px] leading-snug text-gray-400">
          <span className="font-semibold text-gray-500">Phù hợp:</span> {option.audience}
        </p>

        <p className="hidden md:block text-[9px] font-medium leading-none text-gray-400">
          {option.metrics}
        </p>
      </button>

      <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden md:group-hover:block w-64 rounded-xl border border-black/10 bg-white p-3 text-[11px] leading-relaxed text-gray-600 shadow-xl">
        <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-gray-800">
          <span>{option.icon}</span>
          <span>{option.title}</span>
        </p>
        <p>{option.tooltip}</p>
      </div>
    </div>
  )
}

function VisualMemoryThumb({
  item, onRemove, onLabelChange,
}: {
  item: VisualMemoryItem
  onRemove?: () => void
  onLabelChange?: (label: string) => void
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
      {onLabelChange && (
        <input
          type="text"
          value={item.label}
          onChange={(e) => onLabelChange(e.target.value)}
          className="w-full border-t border-black/8 bg-white px-1.5 py-1 text-[10px] text-gray-700 outline-none focus:bg-violet-50"
        />
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          title="Xoá"
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-red-600"
          style={{ opacity: 1 }}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}
