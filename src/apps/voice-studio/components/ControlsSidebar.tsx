import { useEffect, useState, useCallback } from 'react'
import {
  FolderOpen, Mic, RefreshCw, Trash2, Loader2,
  Library, Sliders, RotateCcw, AudioLines, Plus,
} from 'lucide-react'
import type { VoiceSettings, Gender, VoiceOption } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import {
  listVoices, listSharedVoices, addSharedVoice, deleteVoice,
  type ElevenLabsVoice, type SharedVoice,
} from '../../../utils/elevenlabs'

interface ControlsSidebarProps {
  settings: VoiceSettings
  onSettingsChange: (settings: VoiceSettings) => void
  onLoadPreset: () => void
  onOpenClone: () => void
  onOpenLibrary: () => void
  refreshKey: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMalaysianVoice(v: ElevenLabsVoice): boolean {
  const accent = (v.labels?.accent ?? '').toLowerCase()
  const lang   = (v.labels?.language ?? '').toLowerCase()
  const descr  = ((v.labels?.description ?? '') + ' ' + (v.description ?? '')).toLowerCase()
  return accent.includes('malay') || lang === 'ms' || lang === 'malay' ||
    descr.includes('malay') || descr.includes('malaysian')
}

function isMalaysianShared(v: SharedVoice): boolean {
  const accent = (v.accent ?? '').toLowerCase()
  const lang   = (v.language ?? '').toLowerCase()
  const descr  = (v.description ?? '').toLowerCase()
  return accent.includes('malay') || lang === 'ms' || lang === 'malay' ||
    descr.includes('malay') || descr.includes('malaysian')
}

function mapUserVoice(v: ElevenLabsVoice): VoiceOption {
  const gender: Gender = v.labels?.gender?.toLowerCase() === 'male' ? 'Male' : 'Female'
  const accent = (v.labels?.accent ?? '').toUpperCase()
  const style =
    v.category === 'cloned' ? 'CLONED' :
    v.category === 'professional' ? 'PRO' :
    accent || v.category?.toUpperCase() || 'PREMADE'
  return { voiceId: v.voice_id, name: v.name, gender, style, category: v.category, previewUrl: v.preview_url }
}

function mapSharedVoice(v: SharedVoice): VoiceOption {
  const gender: Gender = (v.gender ?? '').toLowerCase() === 'male' ? 'Male' : 'Female'
  return {
    voiceId: v.voice_id,
    name: v.name,
    gender,
    style: 'MALAYSIAN',
    category: 'library',
    previewUrl: v.preview_url,
    isLibraryVoice: true,
    publicOwnerId: v.public_owner_id,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ControlsSidebar({
  settings, onSettingsChange, onLoadPreset, onOpenClone, onOpenLibrary, refreshKey,
}: ControlsSidebarProps) {
  const [userVoices, setUserVoices]       = useState<VoiceOption[]>([])
  const [libraryVoices, setLibraryVoices] = useState<VoiceOption[]>([])
  const [isLoading, setIsLoading]         = useState(false)
  const [addingVoiceId, setAddingVoiceId] = useState<string | null>(null)

  const hasElevenLabsKey = useSettingsStore((s) => s.hasElevenLabsKey())
  const addToast = useAppStore((s) => s.addToast)

  // ── Fetch user's Malaysian voices ──────────────────────────────────────────
  const fetchUserVoices = useCallback(async () => {
    if (!hasElevenLabsKey) return
    setIsLoading(true)
    try {
      const apiKey = useSettingsStore.getState().getElevenLabsApiKey()
      const list   = await listVoices(apiKey)

      // Keep only: cloned voices + Malaysian accent voices (hide American/British/etc.)
      const filtered = list.filter((v) =>
        v.category === 'cloned' || isMalaysianVoice(v)
      )

      const sorted = filtered.sort((a, b) => {
        if (a.category === 'cloned' && b.category !== 'cloned') return -1
        if (b.category === 'cloned' && a.category !== 'cloned') return 1
        const order: Record<string, number> = { cloned: 0, professional: 1, generated: 2, premade: 3 }
        return (order[a.category] ?? 9) - (order[b.category] ?? 9)
      })

      const mapped = sorted.map(mapUserVoice)
      setUserVoices(mapped)

      if (!settings.voiceId && mapped.length > 0) {
        const first = mapped.find((v) => v.gender === settings.gender) ?? mapped[0]
        onSettingsChange({ ...settings, voiceId: first.voiceId, voiceName: first.name, gender: first.gender })
      }
    } catch (err) {
      addToast(`Không tải được danh sách giọng: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasElevenLabsKey])

  // ── Auto-fetch Malaysian library voices ────────────────────────────────────
  const fetchLibraryVoices = useCallback(async () => {
    if (!hasElevenLabsKey) return
    try {
      const apiKey = useSettingsStore.getState().getElevenLabsApiKey()
      // Fetch by language 'ms' and accent 'malaysian' — combine & deduplicate
      const [byLang, byAccent] = await Promise.allSettled([
        listSharedVoices({ apiKey, language: 'ms', pageSize: 50 }),
        listSharedVoices({ apiKey, accent: 'malaysian', pageSize: 50 }),
      ])

      const merged = new Map<string, SharedVoice>()
      const addIfMalaysian = (v: SharedVoice) => {
        if (isMalaysianShared(v)) merged.set(v.voice_id, v)
      }
      if (byLang.status === 'fulfilled')   byLang.value.forEach(addIfMalaysian)
      if (byAccent.status === 'fulfilled') byAccent.value.forEach(addIfMalaysian)

      const mapped = Array.from(merged.values()).map(mapSharedVoice)
      setLibraryVoices(mapped)
    } catch { /* silent — library is optional */ }
  }, [hasElevenLabsKey])

  useEffect(() => {
    void fetchUserVoices()
    void fetchLibraryVoices()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasElevenLabsKey, refreshKey])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const setField = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  const selectVoice = (voice: VoiceOption) => {
    onSettingsChange({ ...settings, voiceId: voice.voiceId, voiceName: voice.name, gender: voice.gender })
  }

  const handleGenderSwitch = (gender: Gender) => {
    if (gender === settings.gender) return
    const allVoices = [...userVoices, ...libraryVoices]
    const first = allVoices.find((v) => v.gender === gender && !v.isLibraryVoice)
      ?? allVoices.find((v) => v.gender === gender)
    if (first && !first.isLibraryVoice) {
      onSettingsChange({ ...settings, gender, voiceId: first.voiceId, voiceName: first.name })
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
      void fetchUserVoices()
    } catch (err) {
      addToast(`Xóa giọng thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  // Add a library voice to user's account, then select it
  const handleAddLibraryVoice = async (voice: VoiceOption) => {
    if (!voice.publicOwnerId) return
    setAddingVoiceId(voice.voiceId)
    try {
      const apiKey  = useSettingsStore.getState().getElevenLabsApiKey()
      const newId   = await addSharedVoice({ apiKey, publicOwnerId: voice.publicOwnerId, voiceId: voice.voiceId, newName: voice.name })
      addToast(`Đã thêm "${voice.name}" vào tài khoản`)
      await fetchUserVoices()
      // Select the newly-added voice
      onSettingsChange({ ...settings, voiceId: newId, voiceName: voice.name, gender: voice.gender })
    } catch (err) {
      addToast(`Thêm giọng thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setAddingVoiceId(null)
    }
  }

  // ── Derived lists ──────────────────────────────────────────────────────────

  const userIds    = new Set(userVoices.map((v) => v.voiceId))
  const filteredUser    = userVoices.filter((v) => v.gender === settings.gender)
  const filteredLibrary = libraryVoices.filter(
    (v) => v.gender === settings.gender && !userIds.has(v.voiceId),
  )
  const isMale = settings.gender === 'Male'

  // ── Render ─────────────────────────────────────────────────────────────────

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
            <p className="text-[10px] text-slate-500">ElevenLabs · Malaysian</p>
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

      {/* Voice list — Malaysian accent only */}
      <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Giọng Malaysian
          </span>
          <button
            onClick={() => { void fetchUserVoices(); void fetchLibraryVoices() }}
            disabled={isLoading || !hasElevenLabsKey}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            title="Tải lại"
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
          ) : isLoading && userVoices.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            </div>
          ) : filteredUser.length === 0 && filteredLibrary.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
              <p className="text-xs font-medium text-slate-500">
                Chưa có giọng Malaysian {settings.gender === 'Female' ? 'nữ' : 'nam'}
              </p>
              <p className="text-[10px] text-slate-400">Thêm từ Thư viện giọng hoặc Clone</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 p-1">
              {/* User's voices (cloned + Malaysian already added) */}
              {filteredUser.map((voice) => {
                const isActive  = settings.voiceId === voice.voiceId
                const isCloned  = voice.category === 'cloned'
                return (
                  <button
                    key={voice.voiceId}
                    onClick={() => selectVoice(voice)}
                    className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all ${
                      isActive ? 'bg-indigo-500 text-white shadow-sm' : 'hover:bg-white'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      isActive ? 'bg-white' : isCloned ? 'bg-emerald-400' : 'bg-amber-400'
                    }`} />
                    <span className={`min-w-0 flex-1 truncate text-[11px] font-medium ${isActive ? 'text-white' : 'text-slate-700'}`}>
                      {voice.name}
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${
                      isActive ? 'bg-white/20 text-white' :
                      isCloned ? 'bg-emerald-100 text-emerald-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {isCloned ? 'CLONE' : 'MALAYSIAN'}
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

              {/* Separator before library voices */}
              {filteredUser.length > 0 && filteredLibrary.length > 0 && (
                <div className="mx-2 my-1 flex items-center gap-1">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Thư viện</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
              )}

              {/* Library voices — need to be added to account first */}
              {filteredLibrary.map((voice) => {
                const isAdding = addingVoiceId === voice.voiceId
                return (
                  <div
                    key={voice.voiceId}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-500">
                      {voice.name}
                    </span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-slate-400">
                      LIBRARY
                    </span>
                    <button
                      onClick={() => handleAddLibraryVoice(voice)}
                      disabled={isAdding}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-indigo-200 bg-indigo-50 text-indigo-500 transition-colors hover:bg-indigo-100 disabled:opacity-40"
                      title="Thêm vào tài khoản"
                    >
                      {isAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Settings — always visible (no toggle) */}
      <div className="shrink-0 border-t border-slate-200 bg-slate-50/30 p-3">
        {/* Creativity */}
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
              type="range" min={0} max={2} step={0.1}
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
            <span>Ổn định</span><span>Biểu cảm</span>
          </div>
        </div>

        {/* Advanced settings — ALWAYS VISIBLE */}
        <div className="rounded-lg bg-white p-2.5 shadow-sm">
          <div className="mb-2 flex items-center gap-1.5">
            <Sliders className="h-3 w-3 text-slate-400" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tùy chọn nâng cao</span>
          </div>
          <div className="space-y-2">
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
              onClick={() => onSettingsChange({ ...settings, speed: 1.0, similarity: 0.75, styleExaggeration: 0.3, useSpeakerBoost: true })}
              className="flex w-full items-center justify-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-50"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Mặc định
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SliderRow ────────────────────────────────────────────────────────────────

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
        <div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" style={{ width: `${pct}%` }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
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
          <span>{hintLeft}</span><span>{hintRight}</span>
        </div>
      )}
    </div>
  )
}
