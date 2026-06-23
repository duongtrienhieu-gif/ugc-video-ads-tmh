import { useState, useRef, useEffect } from 'react'
import { Package, Loader2, GraduationCap, Sparkles, Info } from 'lucide-react'
import type { Product } from '../../../stores/types'
import type {
  HookStrength, LengthSeconds, ScriptGenerationParams, ToneModifier,
} from '../types'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import BankPicker from '../../../components/BankPicker'
import { SCRIPT_PRESETS, TONE_OPTIONS, getPresetById } from '../services/presets'
import { PresetTooltip } from './PresetTooltip'

interface InputPanelProps {
  selectedProduct: Product | null
  onProductSelect: (product: Product) => void
  onGenerate: (params: Omit<ScriptGenerationParams, 'productId'>) => void
  isGenerating: boolean
  // Form state — owned by parent so it survives F5 via session persistence.
  presetId: string
  onPresetIdChange: (id: string) => void
  lengthSec: LengthSeconds
  onLengthSecChange: (n: LengthSeconds) => void
  hookStrength: HookStrength
  onHookStrengthChange: (h: HookStrength) => void
  toneModifiers: ToneModifier[]
  onToneModifiersChange: (next: ToneModifier[]) => void
  educationalMode: boolean
  onEducationalModeChange: (b: boolean) => void
}

const LENGTH_OPTIONS: { value: LengthSeconds; label: string; hint: string }[] = [
  { value: 15, label: '15s', hint: 'Hook-and-CTA' },
  { value: 30, label: '30s', hint: 'Standard' },
  { value: 45, label: '45s', hint: 'Educational' },
  { value: 60, label: '60s', hint: 'Long-form' },
]

const HOOK_STRENGTH_OPTIONS: { value: HookStrength; label: string }[] = [
  { value: 'safe',       label: 'An toàn' },
  { value: 'balanced',   label: 'Cân bằng' },
  { value: 'aggressive', label: 'Gắt' },
]

export default function InputPanel({
  selectedProduct, onProductSelect, onGenerate, isGenerating,
  presetId, onPresetIdChange: setPresetId,
  lengthSec, onLengthSecChange: setLengthSec,
  hookStrength, onHookStrengthChange: setHookStrength,
  toneModifiers, onToneModifiersChange: setToneModifiers,
  educationalMode, onEducationalModeChange: setEducationalMode,
}: InputPanelProps) {
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const resolvedProductImage = useAssetUrl(selectedProduct?.productImage)
  const hasGeminiKey = useSettingsStore((s) => s.hasGeminiKey())
  const openApp = useAppStore((s) => s.openApp)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const productCount = useBankStore((s) => s.products.length)

  const preset = getPresetById(presetId)
  const isEducationalPreset = preset?.category === 'educational'
  // Educational presets force-enable the mode in the prompt builder, so the
  // toggle is just informational when one is selected.
  const effectiveEducational = educationalMode || isEducationalPreset

  const toggleTone = (id: ToneModifier) => {
    setToneModifiers(toneModifiers.includes(id) ? toneModifiers.filter((x) => x !== id) : [...toneModifiers, id])
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
      lengthSec,
      hookStrength,
      toneModifiers,
      educationalMode,
    })
  }

  const classicPresets = SCRIPT_PRESETS.filter((p) => p.category === 'classic')
  const educationalPresets = SCRIPT_PRESETS.filter((p) => p.category === 'educational')

  return (
    <div className="flex h-full flex-col">
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
                onClick={() => setProductPickerOpen(true)}
                className="rounded-lg border border-black/10 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-black/[0.04]"
              >
                Đổi
              </button>
            </div>
          ) : (
            <button
              onClick={() => setProductPickerOpen(true)}
              className="ui-accent-soft flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-semibold"
            >
              <Package className="h-4 w-4" />
              {productCount > 0 ? 'Chọn sản phẩm từ Project' : 'Chưa có sản phẩm — tạo trong Project'}
            </button>
          )}
          {productCount === 0 && (
            <button onClick={handleOpenFinder} style={{ color: 'var(--color-accent)' }} className="text-[11px] underline">
              Mở Project để tạo sản phẩm
            </button>
          )}
        </Section>

        {/* STEP 2 — Preset */}
        <Section step={2} title="Chọn công thức script">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Direct-response classics</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {classicPresets.map((p) => (
              <PresetCard key={p.id} preset={p} active={presetId === p.id} onClick={() => setPresetId(p.id)} />
            ))}
          </div>

          <p className="mt-3 mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
            <GraduationCap className="h-3 w-3" /> Educational / Mechanism selling
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {educationalPresets.map((p) => (
              <PresetCard key={p.id} preset={p} active={presetId === p.id} onClick={() => setPresetId(p.id)} />
            ))}
          </div>
        </Section>

        {/* STEP 3 — Length */}
        <Section step={3} title="Thời lượng">
          <div className="grid grid-cols-4 gap-1.5">
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLengthSec(opt.value)}
                className={`flex flex-col items-center rounded-lg border py-2 text-xs transition-colors ${
                  lengthSec === opt.value
                    ? 'ui-accent-soft'
                    : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                }`}
              >
                <span className="font-bold">{opt.label}</span>
                <span className="text-[9px] opacity-60">{opt.hint}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Hook strength */}
        <Section step={4} title="Độ mạnh hook">
          <div className="grid grid-cols-3 gap-1.5">
            {HOOK_STRENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHookStrength(opt.value)}
                className={`rounded-lg border py-2 text-xs font-medium transition-colors ${
                  hookStrength === opt.value
                    ? opt.value === 'aggressive'
                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                      : opt.value === 'safe'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'ui-accent-soft'
                    : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Educational mode toggle */}
        <Section step={5} title="Chế độ giải thích">
          <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${
            effectiveEducational ? 'border-emerald-300 bg-emerald-50' : 'border-black/10 bg-white hover:bg-black/[0.02]'
          }`}>
            <input
              type="checkbox"
              checked={effectiveEducational}
              disabled={isEducationalPreset}
              onChange={(e) => setEducationalMode(e.target.checked)}
              className="mt-0.5 accent-emerald-600"
            />
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-900">
                Giải thích cơ chế sản phẩm
                {isEducationalPreset && <span className="ml-1 text-[10px] font-normal text-emerald-700">(bật tự động cho preset Educational)</span>}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500">
                AI sẽ giải thích vì sao vấn đề xảy ra, cơ chế ingredient, vì sao sản phẩm khác biệt — dành cho health / skincare / supplement / wellness.
              </p>
            </div>
          </label>
        </Section>

        {/* Advanced — tone modifiers */}
        <Section step={6} title="Tone (nâng cao)">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            style={{ color: 'var(--color-accent)' }}
            className="mb-2 text-[11px] hover:underline"
          >
            {showAdvanced ? '− Ẩn' : '+ Thêm tone modifiers'}
          </button>
          {showAdvanced && (
            <div className="flex flex-wrap gap-1.5">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTone(t.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    toneModifiers.includes(t.id)
                      ? 'ui-accent-soft'
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
          className="ui-accent-solid flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo kịch bản...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Tạo kịch bản UGC</>
          )}
        </button>
      </div>

      <BankPicker
        bankType="products"
        isOpen={productPickerOpen}
        onSelect={(item) => { onProductSelect(item as Product); setProductPickerOpen(false) }}
        onClose={() => setProductPickerOpen(false)}
      />
    </div>
  )
}

// ── Small helpers ───────────────────────────────────────────────────────

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5">
        <span
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
          style={{ backgroundColor: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
        >
          {step}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{title}</span>
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function PresetCard({
  preset, active, onClick,
}: {
  preset: typeof SCRIPT_PRESETS[number]
  active: boolean
  onClick: () => void
}) {
  // Anchor lives in state (callback-ref) so the tooltip can read it during
  // render — accessing useRef().current in render violates React 19 lint.
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null)
  // 'hover' = transient (mouse leave dismisses), 'tap' = sticky (close button required)
  const [tipMode, setTipMode] = useState<'hover' | 'tap' | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHoverTimer = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }

  const handleMouseEnter = () => {
    if (tipMode === 'tap') return
    clearHoverTimer()
    hoverTimer.current = setTimeout(() => setTipMode('hover'), 150)
  }
  const handleMouseLeave = () => {
    clearHoverTimer()
    if (tipMode === 'hover') setTipMode(null)
  }

  useEffect(() => () => clearHoverTimer(), [])

  // Close sticky tooltip when user clicks outside the card or the tooltip
  useEffect(() => {
    if (tipMode !== 'tap') return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (cardEl?.contains(t)) return
      // Tooltip is portaled — also check role=tooltip element
      const tooltip = document.querySelector('[role="tooltip"]')
      if (tooltip?.contains(t)) return
      setTipMode(null)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [tipMode, cardEl])

  return (
    <div
      ref={setCardEl}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
        active
          ? preset.category === 'educational'
            ? 'border-emerald-400 bg-emerald-50'
            : 'ui-accent-soft'
          : 'border-black/10 bg-white hover:bg-black/[0.03]'
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      <span className="text-lg leading-none">{preset.glyph}</span>
      <div className="min-w-0 flex-1 pr-4">
        <p className={`truncate text-[11px] font-semibold ${active ? (preset.category === 'educational' ? 'text-emerald-800' : '') : 'text-gray-800'}`}>
          {preset.label}
        </p>
        <p className="truncate text-[10px] text-gray-500">{preset.hint}</p>
      </div>

      {/* Info button — works on touch (tap to toggle sticky tooltip) and as a
          visible affordance on desktop. */}
      <button
        type="button"
        aria-label={`Xem chi tiết công thức ${preset.label}`}
        onClick={(e) => {
          e.stopPropagation()
          setTipMode((m) => (m === 'tap' ? null : 'tap'))
        }}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-black/[0.06] hover:text-gray-600"
      >
        <Info className="h-3 w-3" />
      </button>

      {tipMode && cardEl && (
        <PresetTooltip
          preset={preset}
          anchor={cardEl}
          onDismiss={() => setTipMode(null)}
          dismissible={tipMode === 'tap'}
        />
      )}
    </div>
  )
}
