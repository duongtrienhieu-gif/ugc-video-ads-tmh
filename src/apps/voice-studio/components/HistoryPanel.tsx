import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Download, Trash2, Volume2, Save, Check } from 'lucide-react'
import type { VoiceHistoryItem } from '../../../stores/types'
import { getUrl } from '../../../utils/assetStore'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'

interface HistoryPanelProps {
  items: VoiceHistoryItem[]
  onDelete: (id: string) => void
}

const BAR_COUNT = 80

/**
 * Resolve an asset ref or URL to a playable URL.
 */
async function resolveAudioUrl(ref: string): Promise<string> {
  if (ref.startsWith('asset-')) {
    const url = await getUrl(ref)
    if (!url) throw new Error('Audio asset not found')
    return url
  }
  return ref
}

/**
 * Decode an audio URL into normalized waveform peaks (0–1).
 * Uses Web Audio API to get the actual audio data.
 */
async function decodeWaveform(audioRef: string, barCount: number): Promise<number[]> {
  const audioUrl = await resolveAudioUrl(audioRef)
  const ctx = new AudioContext()
  try {
    let arrayBuffer: ArrayBuffer

    if (audioUrl.startsWith('data:')) {
      const res = await fetch(audioUrl)
      arrayBuffer = await res.arrayBuffer()
    } else {
      const res = await fetch(audioUrl)
      arrayBuffer = await res.arrayBuffer()
    }

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    const channelData = audioBuffer.getChannelData(0)
    const samplesPerBar = Math.floor(channelData.length / barCount)
    const peaks: number[] = []

    for (let i = 0; i < barCount; i++) {
      const start = i * samplesPerBar
      const end = Math.min(start + samplesPerBar, channelData.length)
      let sum = 0
      for (let j = start; j < end; j++) {
        sum += Math.abs(channelData[j])
      }
      peaks.push(sum / (end - start))
    }

    const max = Math.max(...peaks, 0.001)
    return peaks.map((p) => p / max)
  } finally {
    ctx.close()
  }
}

/**
 * AudioWaveform — renders the real decoded waveform of an audio clip.
 */
function AudioWaveform({
  audioUrl,
  itemId,
  progress,
  isPlaying,
  onSeek,
}: {
  audioUrl: string
  itemId: string
  progress: number
  isPlaying: boolean
  onSeek: (fraction: number) => void
}) {
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    decodeWaveform(audioUrl, BAR_COUNT).then((p) => {
      if (!cancelled) setPeaks(p)
    }).catch(() => {
      if (!cancelled) setPeaks(Array.from({ length: BAR_COUNT }, () => 0.3))
    })
    return () => { cancelled = true }
  }, [audioUrl, itemId])

  const handleClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const fraction = (e.clientX - rect.left) / rect.width
    onSeek(Math.max(0, Math.min(1, fraction)))
  }

  if (!peaks) {
    return (
      <div className="mt-2.5 flex h-12 w-full items-center justify-center rounded-lg bg-gray-100">
        <div className="flex items-center gap-[3px]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-3 w-1 animate-pulse rounded-full bg-black/8"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className="mt-2.5 flex h-12 w-full cursor-pointer items-end gap-[1.5px] rounded-lg bg-gray-100 px-2 pb-1.5 pt-1.5"
    >
      {peaks.map((peak, i) => {
        const fraction = i / peaks.length
        const filled = fraction <= progress
        const minHeight = 8
        const maxHeight = 100
        const height = minHeight + peak * (maxHeight - minHeight)

        return (
          <div
            key={i}
            className={`flex-1 min-w-[1.5px] rounded-full transition-colors duration-75 ${filled
              ? isPlaying ? 'bg-indigo-400' : 'bg-indigo-400/60'
              : 'bg-black/[0.06]'
              }`}
            style={{ height: `${height}%` }}
          />
        )
      })}
    </div>
  )
}

/** Format seconds as m:ss */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function HistoryPanel({ items, onDelete }: HistoryPanelProps) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [currentTime, setCurrentTime] = useState<Record<string, number>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animRef = useRef<number>(0)
  const playingIdRef = useRef<string | null>(null)

  const addVoice = useBankStore((s) => s.addVoice)
  const addToast = useAppStore((s) => s.addToast)

  const handleSavePreset = async (item: VoiceHistoryItem) => {
    if (savedIds.has(item.id)) return
    setSavingId(item.id)
    try {
      await addVoice({
        label: item.voiceName || 'Untitled voice',
        voiceName: item.voiceName,
        gender: 'Female',
        styleInstructions: '',
        creativity: 0.8,
        ambience: 'Studio',
        linkedModelId: item.voiceId, // ElevenLabs voice_id — needed to re-generate with same voice
      })
      setSavedIds((prev) => new Set(prev).add(item.id))
      addToast(`Đã lưu "${item.voiceName}" vào PROJECT Giọng đọc`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Lưu preset thất bại: ${msg}`, 'error')
    } finally {
      setSavingId(null)
    }
  }

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    cancelAnimationFrame(animRef.current)
    setPlayingId(null)
    playingIdRef.current = null
  }, [])

  useEffect(() => {
    return () => { stopPlayback() }
  }, [stopPlayback])

  const createAudioHandlers = useCallback((audio: HTMLAudioElement, itemId: string) => {
    const updateProgress = () => {
      if (audio.duration && playingIdRef.current === itemId) {
        const prog = audio.currentTime / audio.duration
        setProgress((prev) => ({ ...prev, [itemId]: prog }))
        setCurrentTime((prev) => ({ ...prev, [itemId]: audio.currentTime }))
      }
      if (!audio.paused) {
        animRef.current = requestAnimationFrame(updateProgress)
      }
    }

    audio.onplay = () => {
      setPlayingId(itemId)
      playingIdRef.current = itemId
      updateProgress()
    }
    audio.onended = () => {
      setPlayingId(null)
      playingIdRef.current = null
      setProgress((prev) => ({ ...prev, [itemId]: 0 }))
      setCurrentTime((prev) => ({ ...prev, [itemId]: 0 }))
    }
  }, [])

  const handlePlay = async (item: VoiceHistoryItem) => {
    if (playingId === item.id) {
      stopPlayback()
      return
    }

    stopPlayback()
    const url = await resolveAudioUrl(item.audioUrl)
    const audio = new Audio(url)
    audioRef.current = audio
    playingIdRef.current = item.id
    createAudioHandlers(audio, item.id)
    audio.play()
  }

  const handleSeek = async (item: VoiceHistoryItem, fraction: number) => {
    if (audioRef.current && playingIdRef.current === item.id) {
      audioRef.current.currentTime = fraction * audioRef.current.duration
    } else {
      stopPlayback()
      const url = await resolveAudioUrl(item.audioUrl)
      const audio = new Audio(url)
      audioRef.current = audio
      playingIdRef.current = item.id

      audio.onloadedmetadata = () => {
        audio.currentTime = fraction * audio.duration
      }
      createAudioHandlers(audio, item.id)
      audio.play()
    }
  }

  const handleDownload = async (item: VoiceHistoryItem) => {
    const url = await resolveAudioUrl(item.audioUrl)
    const a = document.createElement('a')
    a.href = url
    a.download = `${item.voiceName}-${Date.now()}.wav`
    a.click()
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 bg-gradient-to-r from-slate-50/50 to-white">
          <h3 className="text-sm font-bold tracking-tight text-slate-800">Lịch sử giọng đọc</h3>
          <span className="text-[10px] text-slate-400">Chưa có bản ghi nào</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100">
            <Volume2 className="h-6 w-6 text-indigo-400" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-slate-500">Chưa có lịch sử giọng đọc</p>
          <p className="text-xs text-slate-400 text-center max-w-[260px]">Audio bạn tạo sẽ xuất hiện ở đây và lưu vĩnh viễn cho đến khi xóa</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-200 px-4 py-3 bg-gradient-to-r from-slate-50/50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-800">Lịch sử giọng đọc</h3>
            <span className="text-[10px] text-slate-400">{items.length} bản ghi</span>
          </div>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-600">
            {items.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2.5">
          {items.map((item) => {
            const isPlaying = playingId === item.id
            const prog = progress[item.id] ?? 0
            const time = currentTime[item.id] ?? 0
            const isSaved = savedIds.has(item.id)

            return (
              <div
                key={item.id}
                className={`group rounded-xl border bg-white p-3 shadow-sm transition-all hover:shadow-md ${
                  isPlaying ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${isPlaying ? 'bg-indigo-500' : 'bg-slate-100'}`}>
                      <Volume2 className={`h-3 w-3 ${isPlaying ? 'text-white' : 'text-slate-500'}`} strokeWidth={2} />
                    </div>
                    <span className="truncate text-xs font-semibold text-slate-800">{item.voiceName}</span>
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Script preview */}
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                  {item.scriptPreview}
                </p>

                {/* Real audio waveform */}
                <AudioWaveform
                  audioUrl={item.audioUrl}
                  itemId={item.id}
                  progress={prog}
                  isPlaying={isPlaying}
                  onSeek={(fraction) => handleSeek(item, fraction)}
                />

                {/* Duration */}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] font-medium tabular-nums text-slate-400">
                    {formatTime(time)} / {formatTime(item.duration)}
                  </span>
                </div>

                {/* Controls */}
                <div className="mt-2.5 flex items-center gap-1.5">
                  <button
                    onClick={() => handlePlay(item)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                      isPlaying
                        ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-[1px]" />}
                  </button>

                  <button
                    onClick={() => handleDownload(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                    title="Tải xuống"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => handleSavePreset(item)}
                    disabled={savingId === item.id || isSaved}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                      isSaved
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    } disabled:opacity-50`}
                    title="Lưu preset vào PROJECT"
                  >
                    {isSaved ? <><Check className="h-3 w-3" />Đã lưu</> : <><Save className="h-3 w-3" />Lưu preset</>}
                  </button>

                  <div className="flex-1" />

                  <button
                    onClick={() => onDelete(item.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Xóa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
