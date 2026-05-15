import { useEffect, useState, useCallback } from 'react'
import { FolderOpen, Headphones, DoorOpen, Mic, RefreshCw, Trash2, Loader2, Library } from 'lucide-react'
import type { VoiceSettings, Gender, Ambience, VoiceOption } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { listVoices, deleteVoice, type ElevenLabsVoice } from '../../../utils/elevenlabs'

interface ControlsSidebarProps {
  settings: VoiceSettings
  onSettingsChange: (settings: VoiceSettings) => void
  onLoadPreset: () => void
  onOpenClone: () => void
  onOpenLibrary: () => void
  refreshKey: number       // bump to trigger re-fetch (e.g. after clone)
}

function mapVoice(v: ElevenLabsVoice): VoiceOption {
  const gender: Gender = (v.labels?.gender?.toLowerCase() === 'male') ? 'Male' : 'Female'
  const style =
    v.category === 'cloned' ? 'CLONED' :
    v.category === 'professional' ? 'PRO' :
    v.labels?.accent?.toUpperCase() ?? v.category?.toUpperCase() ?? 'PREMADE'
  return {
    voiceId: v.voice_id,
    name: v.name,
    gender,
    style,
    category: v.category,
    previewUrl: v.preview_url,
  }
}

export default function ControlsSidebar({ settings, onSettingsChange, onLoadPreset, onOpenClone, onOpenLibrary, refreshKey }: ControlsSidebarProps) {
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const hasElevenLabsKey = useSettingsStore((s) => s.hasElevenLabsKey())
  const addToast = useAppStore((s) => s.addToast)

  const fetchVoices = useCallback(async () => {
    if (!hasElevenLabsKey) return
    setIsLoading(true)
    try {
      const apiKey = useSettingsStore.getState().getElevenLabsApiKey()
      const list = await listVoices(apiKey)
      // Sort: cloned first, then professional, then premade
      const sorted = list.sort((a, b) => {
        const order: Record<string, number> = { cloned: 0, professional: 1, generated: 2, premade: 3 }
        return (order[a.category] ?? 9) - (order[b.category] ?? 9)
      })
      const mapped = sorted.map(mapVoice)
      setVoices(mapped)

      // Auto-select first matching gender if nothing selected
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
      {/* Top actions */}
      <div className="border-b border-black/8 p-4 flex flex-col gap-2">
        <button
          onClick={onOpenLibrary}
          disabled={!hasElevenLabsKey}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-violet-500 px-6 py-3 text-[13px] font-medium tracking-tight text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Library className="h-4 w-4" />
          Thư viện giọng
        </button>
        <div className="flex gap-2">
          <button
            onClick={onOpenClone}
            disabled={!hasElevenLabsKey}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-[11px] font-medium tracking-tight text-indigo-500 transition-colors hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Mic className="h-3.5 w-3.5" />
            Clone từ mẫu
          </button>
          <button
            onClick={onLoadPreset}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-[11px] font-medium tracking-tight text-indigo-500 transition-colors hover:bg-indigo-500/20"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Preset
          </button>
        </div>
      </div>

      {/* Creativity slider */}
      <div className="border-b border-black/8 px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400">Độ sáng tạo</span>
          <span className="text-xs tabular-nums text-indigo-400">{settings.creativity.toFixed(1)}</span>
        </div>
        <div className="relative mt-3 h-2 w-full rounded-full bg-black/[0.05]">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-indigo-500/40"
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
            className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-indigo-400 border-2 border-white pointer-events-none"
            style={{ left: `calc(${(settings.creativity / 2) * 100}% - 8px)` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-gray-300">
          <span>Ổn định</span>
          <span>Biểu cảm</span>
        </div>
      </div>

      {/* Room Ambience (used for style hint via styleInstructions) */}
      <div className="border-b border-black/8 px-4 py-4">
        <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400">Âm thanh môi trường</span>
        <div className="mt-3 flex gap-2">
          {([
            { value: 'Studio' as Ambience, icon: Headphones, label: 'Phòng thu' },
            { value: 'Small Room' as Ambience, icon: DoorOpen, label: 'Phòng nhỏ' },
          ]).map(({ value, icon: Icon, label }) => {
            const isActive = settings.ambience === value
            return (
              <button
                key={value}
                onClick={() => setField('ambience', value)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 transition-colors ${isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-black/[0.03] text-gray-500 hover:bg-black/[0.05] hover:text-gray-700'
                  }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Voice Selection */}
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400">Giọng đọc</span>
          <button
            onClick={fetchVoices}
            disabled={isLoading || !hasElevenLabsKey}
            className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600 disabled:opacity-40"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Gender sliding toggle */}
        <div className="relative mt-2 flex h-8 rounded-full bg-black/[0.04] p-0.5">
          <div
            className={`absolute top-0.5 h-[calc(100%-4px)] w-[calc(50%-2px)] rounded-full bg-black/[0.06] transition-transform duration-200 ease-out ${isMale ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
              }`}
          />
          {(['Female', 'Male'] as Gender[]).map((g) => (
            <button
              key={g}
              onClick={() => handleGenderSwitch(g)}
              className={`relative z-10 flex-1 text-xs font-medium transition-colors duration-200 ${settings.gender === g ? 'text-gray-800' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              {g === 'Female' ? 'Nữ' : 'Nam'}
            </button>
          ))}
        </div>

        {/* Voice list */}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/[0.06]">
          {!hasElevenLabsKey ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-xs text-gray-400">Chưa có ElevenLabs API key</p>
              <p className="text-[10px] text-gray-300">Vào Cài đặt → ElevenLabs để thêm key</p>
            </div>
          ) : isLoading && voices.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            </div>
          ) : filteredVoices.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-xs text-gray-400">Chưa có giọng {settings.gender === 'Female' ? 'nữ' : 'nam'}</p>
              <p className="text-[10px] text-gray-300">Bấm "Clone giọng mới" để tạo</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 p-1">
              {filteredVoices.map((voice) => {
                const isActive = settings.voiceId === voice.voiceId
                const isCloned = voice.category === 'cloned'
                return (
                  <button
                    key={voice.voiceId}
                    onClick={() => selectVoice(voice)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors group ${isActive
                        ? 'bg-indigo-500/20'
                        : 'hover:bg-black/[0.04]'
                      }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${isActive ? 'bg-indigo-400' : isCloned ? 'bg-emerald-400' : 'bg-gray-300 group-hover:bg-indigo-400/50'
                        }`}
                    />
                    <span className={`text-xs font-medium truncate transition-colors ${isActive ? 'text-gray-800' : 'text-gray-500 group-hover:text-gray-700'}`}>
                      {voice.name}
                    </span>
                    <span className={`ml-auto shrink-0 text-[10px] tracking-wide transition-colors ${isCloned ? 'text-emerald-500/80' : isActive ? 'text-indigo-400/70' : 'text-gray-300 group-hover:text-gray-600/60'}`}>
                      {voice.style}
                    </span>
                    {isCloned && (
                      <button
                        onClick={(e) => handleDeleteVoice(e, voice)}
                        className="shrink-0 rounded p-0.5 text-gray-300 transition-colors hover:bg-red-500/10 hover:text-red-500"
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
    </div>
  )
}
