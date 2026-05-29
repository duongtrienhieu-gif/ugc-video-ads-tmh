// Voice picker modal — lets user choose a TTS voice for the smart-condense
// voice-only pipeline. Two tabs:
//   1. "Giọng của bạn" — voices on the user's ElevenLabs account
//      (cloned from voice-studio + any premade ones they own)
//   2. "Native bản địa" — voices from ElevenLabs Voice Library filtered
//      by target language label (e.g. ms → Malay native voices)
//
// Each row has a play-preview button and a select button. Selecting closes
// the modal and returns { voiceId, voiceName }.

import { useEffect, useState, useRef } from 'react'
import { X, Play, Pause, Loader2, RefreshCw, Mic, Globe, User } from 'lucide-react'
import {
  listVoices, listSharedVoices,
  type ElevenLabsVoice, type SharedVoice,
} from '../../../utils/elevenlabs'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'

export interface PickedVoice {
  voiceId: string
  voiceName: string
}

interface Props {
  open: boolean
  targetLang: string
  currentVoiceId?: string
  onClose: () => void
  onPick: (picked: PickedVoice) => void
}

interface VoiceRow {
  voiceId: string
  name: string
  subtitle: string         // gender + category + accent
  previewUrl?: string
  source: 'user' | 'library'
}

// ── Language label → ElevenLabs library filter ─────────────────────────────
// ElevenLabs shared-voices API accepts both ISO code and English label;
// label is more reliable for some languages where their internal locale code
// differs from ISO-639-1.
const LIB_LANG_QUERY: Record<string, string> = {
  ms: 'malay',
  id: 'indonesian',
  vi: 'vietnamese',
  zh: 'chinese',
  ja: 'japanese',
  ko: 'korean',
  es: 'spanish',
  fr: 'french',
  de: 'german',
  pt: 'portuguese',
  ru: 'russian',
  ar: 'arabic',
  hi: 'hindi',
  en: 'english',
}

function mapUserVoice(v: ElevenLabsVoice): VoiceRow {
  const gender = v.labels?.gender ? v.labels.gender.toLowerCase() : ''
  const accent = v.labels?.accent ?? ''
  const cat =
    v.category === 'cloned' ? 'Cloned' :
    v.category === 'professional' ? 'Pro' :
    v.category === 'generated' ? 'Generated' : 'Premade'
  const bits = [cat, gender, accent].filter(Boolean)
  return {
    voiceId: v.voice_id,
    name: v.name,
    subtitle: bits.join(' · '),
    previewUrl: v.preview_url,
    source: 'user',
  }
}

function mapSharedVoice(v: SharedVoice): VoiceRow {
  const bits = [v.accent, v.gender, v.age].filter(Boolean) as string[]
  return {
    voiceId: v.voice_id,
    name: v.name,
    subtitle: bits.join(' · ') || 'Library',
    previewUrl: v.preview_url,
    source: 'library',
  }
}

export default function VoicePickerModal({ open, targetLang, currentVoiceId, onClose, onPick }: Props) {
  const [tab, setTab]                 = useState<'user' | 'library'>('user')
  const [userVoices, setUserVoices]   = useState<VoiceRow[]>([])
  const [libraryVoices, setLibVoices] = useState<VoiceRow[]>([])
  const [loadingUser, setLoadingUser] = useState(false)
  const [loadingLib, setLoadingLib]   = useState(false)
  const [playingId, setPlayingId]     = useState<string | null>(null)
  const audioRef                      = useRef<HTMLAudioElement | null>(null)

  const hasKey   = useSettingsStore((s) => s.hasElevenLabsKey())
  const addToast = useAppStore((s) => s.addToast)

  // ── Fetch on open / tab switch / target lang change ──────────────────────
  useEffect(() => {
    if (!open || !hasKey) return
    const apiKey = useSettingsStore.getState().getElevenLabsApiKey()

    if (tab === 'user' && userVoices.length === 0) {
      setLoadingUser(true)
      listVoices(apiKey)
        .then((list) => setUserVoices(list.map(mapUserVoice)))
        .catch((err) => addToast(`Không tải được giọng của bạn: ${err instanceof Error ? err.message : String(err)}`, 'error'))
        .finally(() => setLoadingUser(false))
    }

    if (tab === 'library' && libraryVoices.length === 0) {
      setLoadingLib(true)
      const langQuery = LIB_LANG_QUERY[targetLang] ?? targetLang
      listSharedVoices({ apiKey, language: langQuery, pageSize: 60, sort: 'cloned_by_count' })
        .then((list) => setLibVoices(list.map(mapSharedVoice)))
        .catch((err) => addToast(`Không tải được Voice Library: ${err instanceof Error ? err.message : String(err)}`, 'error'))
        .finally(() => setLoadingLib(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, targetLang, hasKey])

  // ── Stop preview audio when modal closes ─────────────────────────────────
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingId(null)
    }
  }, [open])

  const togglePreview = (row: VoiceRow) => {
    if (!row.previewUrl) return
    if (playingId === row.voiceId) {
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingId(null)
      return
    }
    audioRef.current?.pause()
    const audio = new Audio(row.previewUrl)
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => { setPlayingId(null); addToast('Không phát được preview', 'error') }
    audio.play().catch(() => setPlayingId(null))
    audioRef.current = audio
    setPlayingId(row.voiceId)
  }

  const handlePick = (row: VoiceRow) => {
    audioRef.current?.pause()
    audioRef.current = null
    setPlayingId(null)
    onPick({ voiceId: row.voiceId, voiceName: row.name })
  }

  const refresh = () => {
    if (tab === 'user') {
      setUserVoices([])
    } else {
      setLibVoices([])
    }
  }

  if (!open) return null

  const rows = tab === 'user' ? userVoices : libraryVoices
  const loading = tab === 'user' ? loadingUser : loadingLib

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/8 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-gray-800">Chọn giọng đọc</h3>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
              {LIB_LANG_QUERY[targetLang]?.toUpperCase() ?? targetLang.toUpperCase()}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-black/8 px-5 pt-3">
          <button
            onClick={() => setTab('user')}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
              tab === 'user' ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-500' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="h-3.5 w-3.5" /> Giọng của bạn
          </button>
          <button
            onClick={() => setTab('library')}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
              tab === 'library' ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-500' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe className="h-3.5 w-3.5" /> Native bản địa
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="ml-auto mb-1 rounded-lg p-1.5 text-gray-400 hover:bg-black/5 disabled:opacity-40"
            title="Tải lại"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3">
          {!hasKey && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
              Cần ElevenLabs API key trong Cài đặt để tải danh sách giọng.
            </div>
          )}
          {hasKey && loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
            </div>
          )}
          {hasKey && !loading && rows.length === 0 && (
            <div className="px-4 py-8 text-center text-[12px] text-gray-400">
              {tab === 'user'
                ? 'Bạn chưa có giọng nào. Sang app Voice Studio để clone hoặc add từ Voice Library.'
                : `Không tìm thấy giọng Library nào cho ${targetLang.toUpperCase()}. Thử lại sau.`}
            </div>
          )}
          {hasKey && !loading && rows.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {rows.map((row) => {
                const isSelected = row.voiceId === currentVoiceId
                const isPlaying  = playingId === row.voiceId
                return (
                  <div
                    key={row.voiceId}
                    className={`group flex items-center gap-2.5 rounded-xl border p-2.5 transition-all cursor-pointer ${
                      isSelected ? 'border-teal-300 bg-teal-50 ring-2 ring-teal-100' : 'border-black/8 bg-white hover:border-teal-200 hover:bg-teal-50/40'
                    }`}
                    onClick={() => handlePick(row)}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePreview(row) }}
                      disabled={!row.previewUrl}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                        isPlaying ? 'bg-teal-500 text-white' : 'bg-teal-100 text-teal-600 hover:bg-teal-200'
                      }`}
                      title={row.previewUrl ? 'Nghe thử' : 'Không có preview'}
                    >
                      {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-px" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-gray-800">{row.name}</p>
                      <p className="truncate text-[10px] text-gray-500">{row.subtitle}</p>
                    </div>
                    {isSelected && (
                      <span className="rounded-full bg-teal-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                        Đang chọn
                      </span>
                    )}
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
