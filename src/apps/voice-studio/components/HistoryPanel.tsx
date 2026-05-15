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
      <div className="relative flex h-full flex-col items-center justify-center gap-3 p-6">
        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1">
          <span className="text-[9px] font-medium uppercase tracking-widest text-gray-400">Powered by</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-green-400">Gemini</span>
        </div>
        <Volume2 className="h-10 w-10 text-gray-200" strokeWidth={1.5} />
        <p className="text-sm text-gray-300">Chưa có lịch sử giọng đọc</p>
        <p className="text-xs text-gray-200">Audio được tạo sẽ hiển thị ở đây</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-black/8 px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight text-gray-800">Lịch sử giọng đọc</h3>
        <span className="text-[10px] text-gray-300">{items.length} bản ghi</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const isPlaying = playingId === item.id
            const prog = progress[item.id] ?? 0
            const time = currentTime[item.id] ?? 0

            return (
              <div
                key={item.id}
                className="rounded-xl border border-black/8 bg-black/[0.02] p-3"
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">{item.voiceName}</span>
                    <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] text-gray-400">
                      {item.modelId}
                    </span>
                  </div>
                  <span className="text-[10px] tabular-nums text-gray-300">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Script preview */}
                <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400 line-clamp-2">
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
                  <span className="text-[10px] tabular-nums text-gray-300">
                    {formatTime(time)} / {formatTime(item.duration)}
                  </span>
                </div>

                {/* Controls */}
                <div className="mt-2.5 flex items-center gap-1.5">
                  <button
                    onClick={() => handlePlay(item)}
                    className={`flex h-9 w-9 lg:h-7 lg:w-7 items-center justify-center rounded-full transition-colors ${isPlaying
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'bg-black/5 text-gray-600 hover:bg-black/8 hover:text-gray-800'
                      }`}
                  >
                    {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </button>

                  <button
                    onClick={() => handleDownload(item)}
                    className="flex h-9 w-9 lg:h-7 lg:w-7 items-center justify-center rounded-full bg-black/5 text-gray-600 transition-colors hover:bg-black/8 hover:text-gray-800"
                    title="Tải xuống WAV"
                  >
                    <Download className="h-3 w-3" />
                  </button>

                  <button
                    onClick={() => handleSavePreset(item)}
                    disabled={savingId === item.id || savedIds.has(item.id)}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      savedIds.has(item.id)
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : 'border border-indigo-500/20 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20'
                    } disabled:opacity-50`}
                    title="Lưu preset vào PROJECT Giọng đọc"
                  >
                    {savedIds.has(item.id) ? (
                      <><Check className="h-3 w-3" />Đã lưu</>
                    ) : (
                      <><Save className="h-3 w-3" />Lưu preset</>
                    )}
                  </button>

                  <div className="flex-1" />

                  <button
                    onClick={() => onDelete(item.id)}
                    className="flex h-9 w-9 lg:h-7 lg:w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Xóa"
                  >
                    <Trash2 className="h-3 w-3" />
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
