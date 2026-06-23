import { useState } from 'react'
import { Trash2, Sparkles, Save } from 'lucide-react'
import type { TabId, CharacterProfile } from '../types'
import { TABS, generateRandomUGCProfile, createEmptyProfile, COUNTRY_OPTIONS } from '../types'
import { useBankStore } from '../../../stores/bankStore'
import { buildJsonPrompt } from '../services/generateCharacter'
import ChipField from './ChipField'

interface ControlsPanelProps {
  profile: CharacterProfile
  onProfileChange: (profile: CharacterProfile) => void
  activeTab: TabId
}

export default function ControlsPanel({ profile, onProfileChange, activeTab }: ControlsPanelProps) {
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saved, setSaved] = useState(false)
  // Selected nationality drives the cultural random fill (Việt Nam → người Việt).
  const [country, setCountry] = useState('vn')

  // Pick a country → fill all fields (Vietnamese) for that culture. UGC Creator
  // re-rolls another instance within the same country.
  const selectCountry = (key: string) => {
    setCountry(key)
    onProfileChange(generateRandomUGCProfile(key))
  }

  const addModel = useBankStore((s) => s.addModel)

  const currentTab = TABS.find((t) => t.id === activeTab)!

  const setField = (key: string, value: string) => {
    onProfileChange({ ...profile, [key]: value })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Presets, load, clear */}
      <div className="border-b border-black/8 px-3 py-2">
        <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-widest text-gray-400">Người nước nào (văn hoá)</span>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {COUNTRY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => selectCountry(opt.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${country === opt.key ? 'ui-accent-solid' : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.06] hover:text-gray-800'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-widest text-gray-400">Preset & PROJECT</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onProfileChange(generateRandomUGCProfile(country))}
            className="flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-black/[0.06] hover:text-gray-800"
          >
            <Sparkles className="h-3 w-3" />
            UGC Creator
          </button>

          <div className="flex-1" />

          {showSaveForm ? (
            <div className="flex items-center gap-1.5">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && saveName.trim()) {
                    addModel({
                      name: saveName.trim(),
                      characterImage: '',
                      notes: '',
                      source: 'character-studio',
                      jsonProfile: buildJsonPrompt(profile) as Record<string, unknown>
                    })
                    setShowSaveForm(false)
                    setSaveName('')
                    setSaved(true)
                    setTimeout(() => setSaved(false), 2000)
                  }
                  if (e.key === 'Escape') {
                    setShowSaveForm(false)
                    setSaveName('')
                  }
                }}
                autoFocus
                placeholder="Tên preset..."
                className="w-32 rounded-full border border-black/10 bg-transparent px-2.5 py-1 text-[11px] text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-sky-500/30"
              />
              <button
                onClick={() => {
                  if (saveName.trim()) {
                    addModel({
                      name: saveName.trim(),
                      characterImage: '',
                      notes: '',
                      source: 'character-studio',
                      jsonProfile: buildJsonPrompt(profile) as Record<string, unknown>
                    })
                    setShowSaveForm(false)
                    setSaveName('')
                    setSaved(true)
                    setTimeout(() => setSaved(false), 2000)
                  }
                }}
                disabled={!saveName.trim()}
                className="ui-accent-solid rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-40"
              >
                Lưu
              </button>
              <button
                onClick={() => { setShowSaveForm(false); setSaveName('') }}
                className="rounded-full px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveForm(true)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${saved ? 'bg-green-500/10 text-green-400' : 'bg-black/[0.04] text-gray-600 hover:bg-[var(--color-accent-dim)] hover:text-[var(--color-accent)]'}`}
            >
              <Save className="h-3 w-3" />
              {saved ? 'Đã lưu!' : 'Lưu preset'}
            </button>
          )}

          <button
            onClick={() => onProfileChange(createEmptyProfile())}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
            Xóa tất cả
          </button>
        </div>
      </div>

      {/* Tab label header */}
      <div className="border-b border-black/8 px-4 py-2">
        <span className="text-xs font-semibold tracking-tight text-gray-700">{currentTab.label}</span>
        <span className="ml-2 text-[10px] tabular-nums text-gray-400">
          {currentTab.fields.filter((f) => (profile[f.key] ?? '').trim() !== '').length}/{currentTab.fields.length}
        </span>
      </div>

      {/* Scrollable parameter fields */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-5">
          {currentTab.fields.map((field) => (
            <ChipField
              key={field.key}
              fieldKey={field.key}
              label={field.label}
              value={profile[field.key] ?? ''}
              chips={field.chips}
              onChange={(v) => setField(field.key, v)}
              placeholder={field.placeholder}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
