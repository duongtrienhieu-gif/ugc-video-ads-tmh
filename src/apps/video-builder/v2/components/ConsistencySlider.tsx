// ── Consistency Slider — Module 5 ────────────────────────────────────────────
// Range 80-95. Drives the entire pipeline's strictness:
//   • Prompt Compiler language tier (creative / balanced / strict)
//   • QC pass thresholds (per-axis)
//   • Smart-retry budget (1 / 2 / 3 retries)
//   • Negative prompt density
//   • Product lock extra-strict escalation
//
// UI: slider + tier badge + tooltip + 3 quick presets (TikTok / Landing / Ecommerce).
// All Vietnamese — labels, tooltip, preset names.
// ─────────────────────────────────────────────────────────────────────────────

import { Info, Zap } from 'lucide-react'
import {
  CONSISTENCY_PRESETS,
  TIER_LABEL_VI,
  TIER_DESC_VI,
  getStrengthTierName,
  computeQcThresholds,
  type StrengthTierName,
} from '../types'

interface Props {
  strength: number
  onChange: (strength: number) => void
  /** Compact = inline header version, full = standalone block with debug rows */
  variant?: 'compact' | 'full'
}

// Tier-driven color tokens
const TIER_COLOR: Record<StrengthTierName, { bg: string; text: string; ring: string; accent: string }> = {
  'creative': { bg: 'bg-sky-50',     text: 'text-sky-700',     ring: 'ring-sky-300/50',     accent: '#0ea5e9' },
  'balanced': { bg: 'bg-violet-50',  text: 'text-violet-700',  ring: 'ring-violet-300/50',  accent: '#7c3aed' },
  'strict':   { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-300/50', accent: '#10b981' },
}

export default function ConsistencySlider({ strength, onChange, variant = 'full' }: Props) {
  const tier = getStrengthTierName(strength)
  const colors = TIER_COLOR[tier]
  const maxRetries = strength >= 90 ? 3 : strength >= 85 ? 2 : 1
  const thresholds = computeQcThresholds(strength)

  return (
    <div className={`${variant === 'full' ? 'rounded-xl border border-black/10 bg-white p-4 shadow-sm' : ''}`}>
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className={`h-3.5 w-3.5 ${colors.text}`} />
          <p className={`text-[11px] font-bold uppercase tracking-widest ${colors.text}`}>
            Độ nhất quán
          </p>
          <span
            title="Mức cao sẽ giữ sản phẩm và khuôn mặt ổn định hơn nhưng giảm độ sáng tạo. Mức thấp cho phép biến tấu composition đa dạng hơn nhưng dễ drift mặt/packaging."
            className="cursor-help text-gray-400 hover:text-gray-700"
          >
            <Info className="h-3 w-3" />
          </span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 ${colors.bg} ${colors.text}`}>
          <span className="text-[10px] font-bold uppercase tracking-widest">{TIER_LABEL_VI[tier]}</span>
          <span className="rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">{strength}</span>
        </div>
      </div>

      {/* Slider */}
      <div className="relative mb-2">
        <input
          type="range"
          min={80}
          max={95}
          step={1}
          value={strength}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-sky-200 via-violet-200 to-emerald-200"
          style={{ height: 6, accentColor: colors.accent }}
        />
        {/* Tick marks 80 / 85 / 90 / 95 */}
        <div className="mt-1 flex justify-between text-[9px] tabular-nums text-gray-400">
          <span>80</span>
          <span className="ml-1">85</span>
          <span className="ml-1">90</span>
          <span>95</span>
        </div>
      </div>

      {/* Tier description */}
      <p className={`mb-2 rounded-md px-2 py-1 text-[10px] leading-relaxed ${colors.bg} ${colors.text}`}>
        💡 {TIER_DESC_VI[tier]}
      </p>

      {/* Quick presets */}
      <div className="mb-2">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Preset nhanh</p>
        <div className="flex flex-wrap gap-1.5">
          {CONSISTENCY_PRESETS.map((preset) => {
            const active = strength === preset.strength
            return (
              <button
                key={preset.id}
                onClick={() => onChange(preset.strength)}
                title={preset.hintVi}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                  active
                    ? `${colors.bg} border-current ${colors.text}`
                    : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                }`}
              >
                <span>{preset.emoji}</span>
                <span>{preset.labelVi}</span>
                <span className="rounded bg-black/[0.08] px-1 text-[9px] tabular-nums text-gray-700">
                  {preset.strength}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Debug info (only in full variant) */}
      {variant === 'full' && (
        <details className="mt-2 rounded-md border border-black/8 bg-black/[0.015]">
          <summary className="cursor-pointer px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-700">
            Cấu hình chi tiết ▾
          </summary>
          <div className="space-y-1 border-t border-black/5 px-2.5 py-2 text-[10px]">
            <DebugRow k="Strength tier" v={`${tier} (${strength})`} />
            <DebugRow k="Retry budget" v={`${maxRetries} lần`} />
            <DebugRow k="QC: face min" v={`≥ ${thresholds.faceScore}`} />
            <DebugRow k="QC: product min" v={`≥ ${thresholds.productScore} (priority cao nhất)`} highlight />
            <DebugRow k="QC: OCR min" v={`≥ ${thresholds.ocrScore}`} />
            <DebugRow k="QC: realism min" v={`≥ ${thresholds.realismScore}`} />
            <DebugRow k="Product lock" v={strength >= 90 ? 'cực mạnh + anti-redesign negatives' : 'mạnh (mặc định)'} />
            <DebugRow k="Identity lock" v={tier === 'strict' ? 'MUST EXACTLY match' : tier === 'balanced' ? 'must closely match' : 'should closely resemble'} />
            <DebugRow k="Negative density" v={strength >= 90 ? 'dày (+anti-stock-photo + label-rotate-ban)' : 'tiêu chuẩn'} />
          </div>
        </details>
      )}
    </div>
  )
}

function DebugRow({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500">{k}</span>
      <span className={`tabular-nums ${highlight ? 'font-bold text-pink-600' : 'font-semibold text-gray-700'}`}>{v}</span>
    </div>
  )
}
