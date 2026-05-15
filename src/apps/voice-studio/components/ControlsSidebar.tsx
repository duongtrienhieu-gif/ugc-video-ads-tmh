import { useEffect, useState, useCallback } from 'react'
import { FolderOpen, Mic, RefreshCw, Trash2, Loader2, Library, Sliders, ChevronDown, RotateCcw, AudioLines } from 'lucide-react'
import type { VoiceSettings, Gender, VoiceOption } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { listVoices, deleteVoice, type ElevenLabsVoice } from '../../../utils/elevenlabs'

interface ControlsSidebarProps {
  settings: VoiceSettings
  onSettingsChange: (settings: VoiceSettings) => void
  onLoadPreset: () => void
  onOpenClone: () => void
  onOpenLibrary: () => void
  refreshKey: number
}

function mapVoice(v: ElevenLabsVoice): VoiceOption {
  const gender: Gender = (v.labels?.gender?.toLowerCase() === 'male') ? 'Male' : 'Female'
  const accent = v.labels?.accent?.toUpperCase()
  const style =
    accent && accent !== 'AMERICAN' && accent !== 'BRITISH' && accent !== 'AUSTRALIAN' ? accent :
    v.category === 'cloned' ? 'CLONED' :
    v.category === 'professional' ? 'PRO' :
    accent ?? v.category?.toUpperCase() ?? 'PREMADE'
  return {
    voiceId: v.voice_id,
    name: v.name,
    gender,
    style,
    category: v.category,
    previewUrl: v.preview_url,
  }
}

function isMalaysian(voice: ElevenLabsVoice): boolean {
  const accent = voice.labels?.accent?.toLowerCase() ?? ''
  const lang = voice.labels?.language?.toLowerCase() ?? ''
  const descr = (voice.labels?.description ?? voice.description ?? '').toLowerCase()
  return (
    accent.includes('malay') || lang === 'ms' || lang === 'malay' ||
    descr.includes('malay') || descr.includes('malaysian')
  )
}

export default function ControlsSidebar({ settings, onSettingsChange, onLoadPreset, onOpenClone, onOpenLibrary, refreshKey }: ControlsSidebarProps) {
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const hasElevenLabsKey = useSettingsStore((s) => s.hasElevenLabsKey())
  const addToast = useAppStore((s) => s.addToast)

  const fetchVoices = useCallback(async () => {
    if (!hasElevenLabsKey) return
    setIsLoading(true)
    try {
      const apiKey = useSettingsStore.getState().getElevenLabsApiKey()
      const list = await listVoices(apiKey)
      const sorted = list.sort((a, b) => {
        if (a.category === 'cloned' && b.category !== 'cloned') return -1
        if (b.category === 'cloned' && a.category !== 'cloned') return 1
        const aMy = isMalaysian(a) ? 0 : 1
        const bMy = isMalaysian(b) ? 0 : 1
        if (aMy !== bMy) return aMy - bMy
        const order: Record<string, number> = { cloned: 0, professional: 1, generated: 2, premade: 3 }
        return (order[a.category] ?? 9) - (order[b.category] ?? 9)
      })
      const mapped = sorted.map(mapVoice)
      setVoices(mapped)

      if (!settings.voiceId && mapped.length > 0) {
        const first = mapped.find((v) => v.gender === settings.gender) ?? mapped[0]
        onSettingsChange({ ...settings, voiceId: first.voiceId, voiceName: first.name, gender: first.gender })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Không tải được danh sách giọng: ${msg}`, 'error')
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasElevenLabsKey])

  useEffect(() => {
    fetchVoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasElevenLabsKey, refreshKey])

  const setField = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  const selectVoice = (voice: VoiceOption) => {
    onSettingsChange({ ...settings, voiceId: voice.voiceId, voiceName: voice.name, gender: voice.gender })
  }

  const handleGenderSwitch = (gender: Gender) => {
    if (gender === settings.gender) return
    const firstVoice = voices.find((v) => v.gender === gender)
    if (firstVoice) {
      onSettingsChange({ ...settings, gender, voiceId: firstVoice.voiceId, voiceName: firstVoice.name })
    } else {
      onSettingsChange({ ...settings, gender })
    }
  }

  const handleDeleteVoice = async (e: React.MouseEvent, voice: VoiceOption) => {
    e.stopPropagation()
    if (voice.category !== 'cloned') return
    if (!confirm(`Xóa giọng clone "${voice.name}"?`)) return
    try {
      const apiKey = useSettingsStore.getState().getElevenLabsApiKey()
      await deleteVoice(apiKey, voice.voiceId)
      addToast(`Đã xóa giọng "${voice.name}"`)
      fetchVoices()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Xóa giọng thất bại: ${msg}`, 'error')
    }
  }

  const filteredVoices = voices.filter((v) => v.gender === settings.gender)
  const isMale = settings.gender === 'Male'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 px-4 py-3 bg-gradient-to-r from-indigo-50/50 to-violet-50/50">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-sm">
            <AudioLines className="h-4 w-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-800">Voice Studio</h2>
            <p className="text-[10px] text-slate-500">ElevenLabs · Multilingual</p>
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="shrink-0 border-b border-slate-200 px-3 py-3">
        <button
          onClick={onOpenLibrary}
          disabled={!hasElevenLabsKey}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-2.5 text-[12px] font-semibold text-white shadow-sm shadow-violet-500/20 transition-all hover:shadow-md hover:shadow-violet-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
        >
          <Library className="h-3.5 w-3.5" />
          Thư viện giọng
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onOpenClone}
            disabled={!hasElevenLabsKey}
            className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Mic className="h-3 w-3" />
            Clone
          </button>
          <button
            onClick={onLoadPreset}
            className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <FolderOpen className="h-3 w-3" />
            Preset
          </button>
        </div>
      </div>

      {/* Voice Selection — takes most of the space */}
      <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Giọng đọc</span>
          <button
            onClick={fetchVoices}
            disabled={isLoading || !hasElevenLabsKey}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Gender toggle */}
        <div className="relative mb-2 flex h-8 rounded-lg bg-slate-100 p-0.5">
          <div
            className={`absolute top-0.5 h-[calc(100%-4px)] w-[calc(50%-2px)] rounded-md bg-white shadow-sm transition-transform duration-200 ease-out ${isMale ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`}
          />
          {(['Female', 'Male'] as Gender[]).map((g) => (
            <button
              key={g}
              onClick={() => handleGenderSwitch(g)}
              className={`relative z-10 flex-1 text-[11px] font-semibold transition-colors duration-200 ${settings.gender === g ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {g === 'Female' ? 'Nữ' : 'Nam'}
            </button>
          ))}
        </div>

        {/* Voice list */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/30">
          {!hasElevenLabsKey ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
              <p className="text-xs font-medium text-slate-500">Chưa có ElevenLabs key</p>
              <p className="text-[10px] text-slate-400">Vào Cài đặt để thêm</p>
            </div>
          ) : isLoading && voices.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            </div>
          ) : filteredVoices.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
              <p className="text-xs font-medium text-slate-500">Chưa có giọng {settings.gender === 'Female' ? 'nữ' : 'nam'}</p>
              <p className="text-[10px] text-slate-400">Thêm từ Thư viện giọng</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 p-1">
              {filteredVoices.map((voice) => {
                const isActive = settings.voiceId === voice.voiceId
                const isCloned = voice.category === 'cloned'
                const isMyAccent = ['MALAYSIAN', 'MALAY', 'MS'].some((a) => voice.style.includes(a))
                return (
                  <button
                    key={voice.voiceId}
                    onClick={() => selectVoice(voice)}
                    className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all ${
                      isActive
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'hover:bg-white'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                        isActive
                          ? 'bg-white'
                          : isCloned ? 'bg-emerald-400' : isMyAccent ? 'bg-amber-400' : 'bg-slate-300'
                      }`}
                    />
                    <span className={`min-w-0 flex-1 truncate text-[11px] font-medium ${isActive ? 'text-white' : 'text-slate-700'}`}>
                      {voice.name}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : isCloned ? 'bg-emerald-100 text-emerald-700'
                          : isMyAccent ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {voice.style}
                    </span>
                    {isCloned && (
                      <button
                        onClick={(e) => handleDeleteVoice(e, voice)}
                        className={`shrink-0 rounded p-0.5 transition-colors ${
                          isActive ? 'text-white/60 hover:bg-white/20 hover:text-white' : 'text-slate-300 hover:bg-red-100 hover:text-red-500'
                        }`}
                        title="Xóa giọng clone"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Settings card */}
      <div className="shrink-0 border-t border-slate-200 bg-slate-50/30 p-3">
        {/* Creativity — always visible */}
        <div className="mb-2 rounded-lg bg-white p-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Độ sáng tạo</span>
            <span className="text-[11px] font-bold tabular-nums text-indigo-500">{settings.creativity.toFixed(1)}</span>
          </div>
          <div className="relative mt-2 h-1.5 w-full rounded-full bg-slate-100">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400"
              style={{ width: `${(settings.creativity / 2) * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={settings.creativity}
              onChange={(e) => setField('creativity', parseFloat(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div
              className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-500 shadow-sm"
              style={{ left: `calc(${(settings.creativity / 2) * 100}% - 7px)` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-slate-400">
            <span>Ổn định</span>
            <span>Biểu cảm</span>
          </div>
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg bg-white px-2.5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
        >
          <span className="flex items-center gap-1.5">
            <Sliders className="h-3 w-3" />
            Tùy chọn nâng cao
          </span>
          <ChevronDown className={`h-3 w-3 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
        </button>

        {advancedOpen && (
          <div className="mt-2 space-y-2 rounded-lg bg-white p-2.5 shadow-sm">
            <SliderRow
              label="Tốc độ đọc"
              value={settings.speed}
              min={0.7} max={1.2} step={0.05}
              format={(v) => `${v.toFixed(2)}x`}
              onChange={(v) => setField('speed', v)}
              hintLeft="Chậm" hintRight="Nhanh"
            />
            <SliderRow
              label="Giống giọng gốc"
              value={settings.similarity}
              min={0} max={1} step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => setField('similarity', v)}
              hintLeft="Tự nhiên" hintRight="Bám sát"
            />
            <SliderRow
              label="Cường độ phong cách"
              value={settings.styleExaggeration}
              min={0} max={1} step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => setField('styleExaggeration', v)}
              hintLeft="Nhẹ" hintRight="Mạnh"
            />

            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-700">Tăng cường giọng</span>
                <span className="text-[9px] text-slate-400">Speaker Boost</span>
              </div>
              <button
                onClick={() => setField('useSpeakerBoost', !settings.useSpeakerBoost)}
                className={`relative h-4 w-7 rounded-full transition-colors ${settings.useSpeakerBoost ? 'bg-indigo-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${settings.useSpeakerBoost ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <button
              onClick={() => onSettingsChange({
                ...settings,
                speed: 1.0,
                similarity: 0.75,
                styleExaggeration: 0.3,
                useSpeakerBoost: true,
              })}
              className="flex w-full items-center justify-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-50"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Mặc định
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
  hintLeft?: string
  hintRight?: string
}

function SliderRow({ label, value, min, max, step, format, onChange, hintLeft, hintRight }: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-600">{label}</span>
        <span className="text-[10px] font-bold tabular-nums text-indigo-500">{format(value)}</span>
      </div>
      <div className="relative mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div
          className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-500 shadow-sm"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      {(hintLeft || hintRight) && (
        <div className="mt-0.5 flex justify-between text-[9px] text-slate-400">
          <span>{hintLeft}</span>
          <span>{hintRight}</span>
        </div>
      )}
    </div>
  )
}
