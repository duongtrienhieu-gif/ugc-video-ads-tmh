import { useState } from 'react'
import { Package, Loader2, Megaphone, GraduationCap } from 'lucide-react'
import type { Product } from '../../../stores/types'
import type {
  AdsContentGenParams, CtaStrength, LengthMode, PlatformId, ToneId,
} from '../types'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import BankPicker from '../../../components/BankPicker'
import {
  ADS_PRESETS, PLATFORM_OPTIONS, LENGTH_OPTIONS, TONE_OPTIONS,
  getAdsPresetById,
} from '../services/presets'

interface InputPanelProps {
  selectedProduct: Product | null
  onProductSelect: (p: Product) => void
  onGenerate: (params: Omit<AdsContentGenParams, 'productId'>) => void
  isGenerating: boolean
  // Form state — owned by parent so it survives F5 via session persistence.
  presetId: string
  onPresetIdChange: (id: string) => void
  platform: PlatformId
  onPlatformChange: (p: PlatformId) => void
  lengthMode: LengthMode
  onLengthModeChange: (l: LengthMode) => void
  toneIds: ToneId[]
  onToneIdsChange: (next: ToneId[]) => void
  ctaStrength: CtaStrength
  onCtaStrengthChange: (c: CtaStrength) => void
  educationalMode: boolean
  onEducationalModeChange: (b: boolean) => void
}

const CTA_OPTIONS: { value: CtaStrength; label: string; color: string }[] = [
  { value: 'soft',     label: 'Mềm',       color: 'emerald' },
  { value: 'balanced', label: 'Cân bằng',  color: 'blue' },
  { value: 'hard',     label: 'Mạnh',      color: 'rose' },
]

export default function InputPanel({
  selectedProduct, onProductSelect, onGenerate, isGenerating,
  presetId, onPresetIdChange: setPresetId,
  platform, onPlatformChange: setPlatform,
  lengthMode, onLengthModeChange: setLengthMode,
  toneIds, onToneIdsChange: setToneIds,
  ctaStrength, onCtaStrengthChange: setCtaStrength,
  educationalMode, onEducationalModeChange: setEducationalMode,
}: InputPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showTones, setShowTones] = useState(false)

  const resolvedProductImage = useAssetUrl(selectedProduct?.productImage)
  const hasGeminiKey = useSettingsStore((s) => s.hasGeminiKey())
  const openApp = useAppStore((s) => s.openApp)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const productCount = useBankStore((s) => s.products.length)

  const preset = getAdsPresetById(presetId)
  const isMechanismPreset = preset?.category === 'mechanism'
  const effectiveEducational = educationalMode || isMechanismPreset

  const toggleTone = (id: ToneId) => {
    setToneIds(toneIds.includes(id) ? toneIds.filter((x) => x !== id) : [...toneIds, id])
  }

  const handleOpenFinder = () => {
    sendToApp({ targetApp: 'finder', targetField: 'activeBank', data: 'products' })
    openApp('finder')
  }

  const canGenerate = !!selectedProduct && hasGeminiKey && !isGenerating

  const handleClickGenerate = () => {
    if (!canGenerate) return
    onGenerate({
      presetId,
      platform,
      lengthMode,
      toneIds,
      ctaStrength,
      educationalMode,
    })
  }

  // Group presets by category for visual organisation
  const presetsByCategory = {
    hook:      ADS_PRESETS.filter((p) => p.category === 'hook'),
    story:     ADS_PRESETS.filter((p) => p.category === 'story'),
    mechanism: ADS_PRESETS.filter((p) => p.category === 'mechanism'),
    social:    ADS_PRESETS.filter((p) => p.category === 'social'),
    format:    ADS_PRESETS.filter((p) => p.category === 'format'),
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
          Caption text cho Facebook / TikTok / Instagram ads — không phải voice-over.
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

        {/* STEP 2 — Preset (grouped) */}
        <Section step={2} title="Dạng content ads">
          <CategoryGrid label="Hook / Attention" presets={presetsByCategory.hook} active={presetId} onSelect={setPresetId} />
          <CategoryGrid label="Storytelling / Experience" presets={presetsByCategory.story} active={presetId} onSelect={setPresetId} />
          <CategoryGrid label="Mechanism / Education" presets={presetsByCategory.mechanism} active={presetId} onSelect={setPresetId} accent="emerald" />
          <CategoryGrid label="Social proof" presets={presetsByCategory.social} active={presetId} onSelect={setPresetId} />
          <CategoryGrid label="Platform / Format" presets={presetsByCategory.format} active={presetId} onSelect={setPresetId} />
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

        {/* STEP 4 — Length */}
        <Section step={4} title="Độ dài content">
          <div className="grid grid-cols-4 gap-1.5">
            {LENGTH_OPTIONS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLengthMode(l.id)}
                className={`flex flex-col items-center gap-0.5 rounded-lg border py-2 text-[10px] transition-colors ${
                  lengthMode === l.id
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                }`}
              >
                <span className="text-base leading-none">{l.glyph}</span>
                <span className="font-medium">{l.label}</span>
                <span className="text-[9px] opacity-60">~{l.targetWords}w</span>
              </button>
            ))}
          </div>
        </Section>

        {/* STEP 5 — CTA strength */}
        <Section step={5} title="Độ mạnh CTA">
          <div className="grid grid-cols-3 gap-1.5">
            {CTA_OPTIONS.map((c) => (
              <button
                key={c.value}
                onClick={() => setCtaStrength(c.value)}
                className={`rounded-lg border py-2 text-xs font-medium transition-colors ${
                  ctaStrength === c.value
                    ? c.color === 'rose'
                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                      : c.color === 'emerald'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Section>

        {/* STEP 6 — Educational mode */}
        <Section step={6} title="Mechanism selling">
          <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${
            effectiveEducational ? 'border-emerald-300 bg-emerald-50' : 'border-black/10 bg-white hover:bg-black/[0.02]'
          }`}>
            <input
              type="checkbox"
              checked={effectiveEducational}
              disabled={isMechanismPreset}
              onChange={(e) => setEducationalMode(e.target.checked)}
              className="mt-0.5 accent-emerald-600"
            />
            <div className="flex-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                <GraduationCap className="h-3.5 w-3.5 text-emerald-600" />
                Giải thích cơ chế sản phẩm
                {isMechanismPreset && <span className="ml-1 text-[10px] font-normal text-emerald-700">(auto on)</span>}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500">
                AI sẽ giải thích vì sao vấn đề xảy ra, cơ chế ingredient, vì sao sản phẩm khác — quan trọng cho health / supplement / skincare.
              </p>
            </div>
          </label>
        </Section>

        {/* Advanced — tones */}
        <Section step={7} title="Tone (nâng cao)">
          <button
            onClick={() => setShowTones((v) => !v)}
            className="mb-2 text-[11px] text-pink-600 hover:underline"
          >
            {showTones ? '− Ẩn' : '+ Thêm tone modifiers'}
          </button>
          {showTones && (
            <div className="flex flex-wrap gap-1.5">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTone(t.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    toneIds.includes(t.id)
                      ? 'border-pink-400 bg-pink-50 text-pink-700'
                      : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
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

function CategoryGrid({
  label, presets, active, onSelect, accent = 'pink',
}: {
  label: string
  presets: typeof ADS_PRESETS
  active: string
  onSelect: (id: string) => void
  accent?: 'pink' | 'emerald'
}) {
  if (presets.length === 0) return null
  return (
    <div className="mb-2">
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map((p) => {
          const isActive = active === p.id
          const activeBorder = accent === 'emerald' ? 'border-emerald-400 bg-emerald-50' : 'border-pink-400 bg-pink-50'
          const activeText = accent === 'emerald' ? 'text-emerald-800' : 'text-pink-800'
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              title={`${p.label} — ${p.hint}`}
              className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                isActive ? activeBorder : 'border-black/10 bg-white hover:bg-black/[0.03]'
              }`}
            >
              <span className="text-base leading-none">{p.glyph}</span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[11px] font-semibold ${isActive ? activeText : 'text-gray-800'}`}>
                  {p.label}
                </p>
                <p className="truncate text-[10px] text-gray-500">{p.hint}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
