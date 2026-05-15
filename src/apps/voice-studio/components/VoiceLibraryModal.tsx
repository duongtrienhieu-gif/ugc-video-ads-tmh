import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, Play, Pause, Plus, Loader2, Library, Check } from 'lucide-react'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { listSharedVoices, addSharedVoice, type SharedVoice } from '../../../utils/elevenlabs'

interface VoiceLibraryModalProps {
  open: boolean
  onClose: () => void
  onAdded: (voiceId: string) => void
}

// Language options (top picks for UGC)
const LANGUAGES = [
  { value: 'ms', label: 'Malay' },
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Indonesian' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'th', label: 'Thai' },
  { value: '',   label: 'Tất cả' },
]

const ACCENTS = [
  { value: 'malaysian', label: 'Malaysian' },
  { value: 'american',  label: 'American'  },
  { value: 'british',   label: 'British'   },
  { value: 'australian',label: 'Australian'},
  { value: 'indian',    label: 'Indian'    },
  { value: '',          label: 'Tất cả'    },
]

const GENDERS: { value: 'male' | 'female' | ''; label: string }[] = [
  { value: '',       label: 'Tất cả' },
  { value: 'female', label: 'Nữ'     },
  { value: 'male',   label: 'Nam'    },
]

export default function VoiceLibraryModal({ open, onClose, onAdded }: VoiceLibraryModalProps) {
  const [language, setLanguage] = useState('ms')
  const [accent, setAccent] = useState('malaysian')
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [search, setSearch] = useState('')
  const [voices, setVoices] = useState<SharedVoice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const addToast = useAppStore((s) => s.addToast)

  const fetchVoices = useCallback(async () => {
    setIsLoading(true)
    try {
      const apiKey = useSettingsStore.getState().getElevenLabsApiKey()
      const list = await listSharedVoices({
        apiKey,
        language: language || undefined,
        accent: accent || undefined,
        gender: gender || undefined,
        search: search.trim() || undefined,
        pageSize: 30,
      })
      setVoices(list)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Tải Voice Library thất bại: ${msg}`, 'error')
      setVoices([])
    } finally {
      setIsLoading(false)
    }
  }, [language, accent, gender, search, addToast])

  // Fetch on open + filter changes
  useEffect(() => {
    if (!open) return
    fetchVoices()
  }, [open, language, accent, gender, fetchVoices])

  // Debounced search
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => fetchVoices(), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Cleanup audio on close
  useEffect(() => {
    if (!open) {
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingId(null)
    }
  }, [open])

  const handlePreview = (voice: SharedVoice) => {
    if (!voice.preview_url) return
    if (playingId === voice.voice_id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    audioRef.current?.pause()
    const audio = new Audio(voice.preview_url)
    audio.onended = () => setPlayingId(null)
    audio.play().catch(() => setPlayingId(null))
    audioRef.current = audio
    setPlayingId(voice.voice_id)
  }

  const handleAdd = async (voice: SharedVoice) => {
    setAddingId(voice.voice_id)
    try {
      const apiKey = useSettingsStore.getState().getElevenLabsApiKey()
      const newId = await addSharedVoice({
        apiKey,
        publicOwnerId: voice.public_owner_id,
        voiceId: voice.voice_id,
        newName: voice.name,
      })
      setAddedIds((prev) => new Set(prev).add(voice.voice_id))
      addToast(`Đã thêm "${voice.name}" vào danh sách giọng`)
      onAdded(newId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Thêm giọng thất bại: ${msg}`, 'error')
    } finally {
      setAddingId(null)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-black/10 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/8 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
              <Library className="h-4.5 w-4.5 text-violet-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-gray-900">Thư viện giọng ElevenLabs</h2>
              <p className="text-[11px] text-gray-400">Duyệt và thêm giọng từ Voice Library — gói Free dùng được</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="shrink-0 border-b border-black/8 p-5 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc mô tả..."
              className="w-full rounded-lg border border-black/10 bg-black/[0.02] py-2 pl-9 pr-3 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-violet-300 focus:bg-white"
            />
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Group label="Ngôn ngữ" items={LANGUAGES} value={language} onChange={setLanguage} />
            <Group label="Giọng vùng" items={ACCENTS} value={accent} onChange={setAccent} />
            <Group label="Giới tính" items={GENDERS} value={gender} onChange={(v) => setGender(v as 'male' | 'female' | '')} />
          </div>
        </div>

        {/* Voice list */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            </div>
          ) : voices.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-gray-400">
              <p className="text-sm">Không tìm thấy giọng nào</p>
              <p className="text-xs">Thử bỏ bớt filter hoặc đổi từ khóa tìm kiếm</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {voices.map((v) => {
                const isPlaying = playingId === v.voice_id
                const isAdding = addingId === v.voice_id
                const isAdded = addedIds.has(v.voice_id)
                return (
                  <div
                    key={v.voice_id}
                    className="flex flex-col gap-2 rounded-xl border border-black/8 bg-black/[0.01] p-3 transition-colors hover:border-violet-200"
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => handlePreview(v)}
                        disabled={!v.preview_url}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-500 transition-colors hover:bg-violet-500/20 disabled:opacity-30"
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800">{v.name}</p>
                        <p className="truncate text-[11px] text-gray-500">
                          {[v.accent, v.gender, v.age].filter(Boolean).join(' · ') || v.language}
                        </p>
                      </div>
                    </div>

                    {v.description && (
                      <p className="line-clamp-2 text-[11px] leading-relaxed text-gray-500">{v.description}</p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        {v.use_case && <span className="rounded-full bg-black/[0.04] px-2 py-0.5">{v.use_case}</span>}
                        {v.cloned_by_count !== undefined && (
                          <span>{v.cloned_by_count.toLocaleString('en-US')} users</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleAdd(v)}
                        disabled={isAdding || isAdded}
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                          isAdded
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : 'bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-50'
                        }`}
                      >
                        {isAdding ? (
                          <><Loader2 className="h-3 w-3 animate-spin" />Đang thêm...</>
                        ) : isAdded ? (
                          <><Check className="h-3 w-3" />Đã thêm</>
                        ) : (
                          <><Plus className="h-3 w-3" />Thêm</>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface GroupProps<T extends string> {
  label: string
  items: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}

function Group<T extends string>({ label, items, value, onChange }: GroupProps<T>) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-400 uppercase tracking-widest">{label}:</span>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => {
          const active = value === it.value
          return (
            <button
              key={it.value || 'all'}
              onClick={() => onChange(it.value)}
              className={`rounded-full px-2.5 py-1 transition-colors ${
                active ? 'bg-violet-500 text-white' : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.08]'
              }`}
            >
              {it.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
