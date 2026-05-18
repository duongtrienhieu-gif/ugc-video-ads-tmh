// ── Engine-Aware Controls (P11) ─────────────────────────────────────────────
//
// Renders different control panels per engine group. The UI layer
// produces a typed AssetOptions payload — never builds prompts or
// touches GPT directly. The orchestrator's generateAssets(id, params)
// is the single entry from UI → registry.

import type { EngineGroup } from '../types/engine'
import { PERSONA_LIBRARY } from '../shared/metadata/personaLibrary'
import { EMOTIONAL_BEATS } from '../shared/metadata/emotionalBeats'
import { COLOR_THEMES } from '../shared/design-system/colorThemes'

export type LocaleId = 'vi-VN' | 'my-MY' | 'id-ID' | 'global'

/** Caller-facing options payload — passed to generateAssets() as options. */
export interface AssetOptions {
  // ── Photographic ────────────────────────────────────────────────
  styleId?: string
  personaId?: string
  beatId?: string

  // ── UI-Native ───────────────────────────────────────────────────
  locale?: LocaleId
  messageCount?: number
  tone?: string
  runVisionQC?: boolean

  // ── Designed-Graphic ────────────────────────────────────────────
  colorThemeId?: string
}

const LOCALE_LABEL: Record<LocaleId, string> = {
  'vi-VN':  'Tiếng Việt',
  'my-MY':  'Bahasa Melayu',
  'id-ID':  'Bahasa Indonesia',
  'global': 'English',
}

const PHOTO_STYLES = [
  { id: 'realistic', label: 'Realistic',  swatch: '#94a3b8' },
  { id: 'iphone',    label: 'iPhone',     swatch: '#60a5fa' },
  { id: 'ecommerce', label: 'Ecommerce',  swatch: '#e2e8f0' },
  { id: 'luxury',    label: 'Luxury',     swatch: '#d4b483' },
  { id: 'beauty',    label: 'Beauty',     swatch: '#f9a8d4' },
  { id: 'clinical',  label: 'Clinical',   swatch: '#67e8f9' },
]

interface AssetControlsProps {
  group: EngineGroup
  options: AssetOptions
  onChange: (patch: Partial<AssetOptions>) => void
}

export default function AssetControls({ group, options, onChange }: AssetControlsProps) {
  if (group === 'photographic')      return <PhotographicControls   options={options} onChange={onChange} />
  if (group === 'ui-native')         return <UINativeControls       options={options} onChange={onChange} />
  if (group === 'designed-graphic')  return <DesignedGraphicControls options={options} onChange={onChange} />
  return null
}

// ── Photographic ────────────────────────────────────────────────────

function PhotographicControls({ options, onChange }: { options: AssetOptions; onChange: (p: Partial<AssetOptions>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <ControlSection label="Realism preset">
        <div className="flex flex-wrap gap-1.5">
          {PHOTO_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange({ styleId: s.id })}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                (options.styleId ?? 'realistic') === s.id
                  ? 'border-violet-400 bg-violet-50 text-violet-800'
                  : 'border-black/10 bg-white text-gray-700 hover:bg-black/[0.03]'
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: s.swatch }} />
              {s.label}
            </button>
          ))}
        </div>
      </ControlSection>

      <ControlSection label="Avatar continuity (tuỳ chọn)" hint="Lock archetype text — bổ sung cho avatar image">
        <PersonaSelect
          value={options.personaId ?? null}
          onChange={(personaId) => onChange({ personaId: personaId ?? undefined })}
        />
      </ControlSection>

      <ControlSection label="Emotional beat (tuỳ chọn)" hint="Mood + face expression cho từng shot">
        <BeatSelect
          value={options.beatId ?? null}
          onChange={(beatId) => onChange({ beatId: beatId ?? undefined })}
        />
      </ControlSection>
    </div>
  )
}

// ── UI-Native ──────────────────────────────────────────────────────

function UINativeControls({ options, onChange }: { options: AssetOptions; onChange: (p: Partial<AssetOptions>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <ControlSection label="Ngôn ngữ">
        <select
          value={options.locale ?? 'vi-VN'}
          onChange={(e) => onChange({ locale: e.target.value as LocaleId })}
          className="w-full rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[12px] text-gray-800"
        >
          {Object.entries(LOCALE_LABEL).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </ControlSection>

      <ControlSection label="Persona (tuỳ chọn)" hint="Voice character của testimonial author">
        <PersonaSelect
          value={options.personaId ?? null}
          onChange={(personaId) => onChange({ personaId: personaId ?? undefined })}
        />
      </ControlSection>

      <ControlSection label="Tone hint (tuỳ chọn)">
        <input
          type="text"
          value={options.tone ?? ''}
          onChange={(e) => onChange({ tone: e.target.value || undefined })}
          placeholder="natural-warm / sceptical-then-convinced / ..."
          className="w-full rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[12px] text-gray-800"
        />
      </ControlSection>

      <ControlSection label="Số lượng tin nhắn / comment" hint="Để trống → mặc định theo platform">
        <input
          type="number"
          min={1}
          max={20}
          value={options.messageCount ?? ''}
          onChange={(e) => onChange({ messageCount: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="auto"
          className="w-24 rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[12px] text-gray-800"
        />
      </ControlSection>

      <ControlSection label="Vision QC (Gemini check)" hint="Tốn thêm Gemini call. Off mặc định.">
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gray-700">
          <input
            type="checkbox"
            checked={!!options.runVisionQC}
            onChange={(e) => onChange({ runVisionQC: e.target.checked })}
            className="accent-violet-600"
          />
          Chạy vision rubric sau khi render
        </label>
      </ControlSection>
    </div>
  )
}

// ── Designed-Graphic ───────────────────────────────────────────────

function DesignedGraphicControls({ options, onChange }: { options: AssetOptions; onChange: (p: Partial<AssetOptions>) => void }) {
  const themes = Object.keys(COLOR_THEMES)
  return (
    <div className="flex flex-col gap-3">
      <ControlSection label="Color theme">
        <div className="flex flex-wrap gap-1.5">
          {themes.map((id) => {
            const theme = COLOR_THEMES[id]
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ colorThemeId: id })}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                  options.colorThemeId === id
                    ? 'border-violet-400 bg-violet-50 text-violet-800'
                    : 'border-black/10 bg-white text-gray-700 hover:bg-black/[0.03]'
                }`}
              >
                <span className="flex h-3 w-3 overflow-hidden rounded-full">
                  <span className="w-1/2" style={{ background: theme.primary }} />
                  <span className="w-1/2" style={{ background: theme.accent }} />
                </span>
                {id}
              </button>
            )
          })}
        </div>
      </ControlSection>

      <ControlSection label="Ngôn ngữ">
        <select
          value={options.locale ?? 'vi-VN'}
          onChange={(e) => onChange({ locale: e.target.value as LocaleId })}
          className="w-full rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[12px] text-gray-800"
        >
          {Object.entries(LOCALE_LABEL).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </ControlSection>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────

function ControlSection({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
      {children}
    </div>
  )
}

function PersonaSelect({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[12px] text-gray-800"
    >
      <option value="">Auto / không lock archetype</option>
      {PERSONA_LIBRARY.map((p) => (
        <option key={p.id} value={p.id}>{p.label.vi}</option>
      ))}
    </select>
  )
}

function BeatSelect({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[12px] text-gray-800"
    >
      <option value="">Không gắn mood cụ thể</option>
      {EMOTIONAL_BEATS.map((b) => (
        <option key={b.id} value={b.id}>
          [{b.phase}] {b.label.vi}
        </option>
      ))}
    </select>
  )
}
