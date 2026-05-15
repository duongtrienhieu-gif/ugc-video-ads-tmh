import { useState, useRef, useCallback } from 'react'
import {
  Languages, Upload, Link2, Play, Pause, Download, Trash2,
  Loader2, AlertTriangle, CheckCircle2, ChevronDown, X,
  Globe, ArrowRight, FileVideo, Info,
} from 'lucide-react'
import {
  createDubbing, getDubbedMedia, pollDubbingUntilDone, deleteDubbing,
} from '../../utils/elevenlabs'
import { saveAsset, getUrl } from '../../utils/assetStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import {
  SOURCE_LANGUAGES, TARGET_LANGUAGES,
  type TranslationItem, type TranslationStatus,
} from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getLangLabel(code: string): string {
  return (
    [...SOURCE_LANGUAGES, ...TARGET_LANGUAGES].find((l) => l.code === code)?.label
    ?? code.toUpperCase()
  )
}
function getLangFlag(code: string): string {
  return [...SOURCE_LANGUAGES, ...TARGET_LANGUAGES].find((l) => l.code === code)?.flag ?? '🌐'
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TranslationStatus }) {
  const map: Record<TranslationStatus, { label: string; className: string; icon?: React.ReactNode }> = {
    pending:    { label: 'Đang chờ',    className: 'bg-slate-100 text-slate-500' },
    processing: {
      label: 'Đang dịch',
      className: 'bg-teal-500/15 text-teal-600',
      icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
    },
    dubbed:   { label: 'Hoàn thành',  className: 'bg-emerald-500/15 text-emerald-600', icon: <CheckCircle2 className="h-2.5 w-2.5" /> },
    failed:   { label: 'Thất bại',    className: 'bg-red-500/15 text-red-500' },
  }
  const { label, className, icon } = map[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${className}`}>
      {icon}
      {label}
    </span>
  )
}

// ── Language Selector ─────────────────────────────────────────────────────────

function LangSelect<T extends { code: string; label: string; flag: string }>({
  options,
  value,
  onChange,
  placeholder = 'Chọn ngôn ngữ',
}: {
  options: T[]
  value: string
  onChange: (code: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.code === value)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-left transition-colors hover:bg-black/[0.02]"
      >
        <span className="text-lg leading-none">{selected?.flag ?? '🌐'}</span>
        <span className={`flex-1 text-sm font-medium ${selected ? 'text-gray-800' : 'text-gray-400'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-black/10 bg-white shadow-xl">
          {options.map((o) => (
            <button
              key={o.code}
              onClick={() => { onChange(o.code); setOpen(false) }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-teal-50 ${value === o.code ? 'bg-teal-50 text-teal-700' : 'text-gray-700'}`}
            >
              <span className="text-base leading-none">{o.flag}</span>
              <span className="font-medium">{o.label}</span>
              {o.label.includes('⚠️') && (
                <span className="ml-auto text-[10px] text-amber-500">thử nghiệm</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type InputMode = 'file' | 'url'

export default function VideoTranslate() {
  // ── Input state ──────────────────────────────────────────────────────
  const [inputMode, setInputMode]       = useState<InputMode>('file')
  const [file, setFile]                 = useState<File | null>(null)
  const [sourceUrl, setSourceUrl]       = useState('')
  const [sourceLang, setSourceLang]     = useState('auto')
  const [targetLang, setTargetLang]     = useState('en')
  const [numSpeakers, setNumSpeakers]   = useState(0)
  const [dragOver, setDragOver]         = useState(false)
  const fileInputRef                    = useRef<HTMLInputElement>(null)

  // ── Translation state ────────────────────────────────────────────────
  const [history, setHistory]           = useState<TranslationItem[]>([])
  const [isTranslating, setIsTranslating] = useState(false)
  const [playingId, setPlayingId]       = useState<string | null>(null)
  const audioRef                        = useRef<HTMLVideoElement | null>(null)

  const addToast         = useAppStore((s) => s.addToast)
  const elevenLabsApiKey = useSettingsStore((s) => s.elevenLabsApiKey)

  // ── File handling ────────────────────────────────────────────────────

  const acceptFile = (f: File) => {
    if (!f.type.startsWith('video/') && !f.type.startsWith('audio/')) {
      addToast('Chỉ hỗ trợ file video/audio (MP4, MOV, WebM, MP3, WAV…)', 'error')
      return
    }
    if (f.size > 1024 * 1024 * 1024) {
      addToast('File quá lớn (tối đa 1GB)', 'error')
      return
    }
    setFile(f)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) acceptFile(f)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Translation ──────────────────────────────────────────────────────

  const handleTranslate = async () => {
    if (inputMode === 'file' && !file) { addToast('Chọn file video trước', 'error'); return }
    if (inputMode === 'url' && !sourceUrl.trim()) { addToast('Nhập URL video trước', 'error'); return }
    if (!targetLang) { addToast('Chọn ngôn ngữ đích', 'error'); return }
    if (!elevenLabsApiKey) { addToast('Cài ElevenLabs API key trong Cài đặt', 'error'); return }
    if (sourceLang === targetLang && sourceLang !== 'auto') {
      addToast('Ngôn ngữ gốc và đích không được trùng nhau', 'error'); return
    }

    setIsTranslating(true)

    const localId = crypto.randomUUID()
    const displayName = inputMode === 'file' ? (file?.name ?? 'video') : sourceUrl.split('/').pop() ?? 'video'

    const newItem: TranslationItem = {
      id:          localId,
      dubbingId:   '',
      name:        displayName,
      sourceLang,
      targetLang,
      status:      'pending',
      videoUrl:    null,
      assetId:     null,
      createdAt:   Date.now(),
    }
    setHistory((prev) => [newItem, ...prev])

    const updateItem = (patch: Partial<TranslationItem>) =>
      setHistory((prev) => prev.map((h) => (h.id === localId ? { ...h, ...patch } : h)))

    try {
      // 1. Submit dubbing job
      const { dubbingId, expectedDurationSec } = await createDubbing({
        apiKey:            elevenLabsApiKey,
        file:              inputMode === 'file' ? (file ?? undefined) : undefined,
        sourceUrl:         inputMode === 'url' ? sourceUrl.trim() : undefined,
        targetLang,
        sourceLang:        sourceLang === 'auto' ? 'auto' : sourceLang,
        name:              displayName,
        numSpeakers,
        highestResolution: true,
      })

      updateItem({ dubbingId, expectedDurationSec, status: 'processing' })

      // 2. Poll until done
      const result = await pollDubbingUntilDone({
        apiKey:    elevenLabsApiKey,
        dubbingId,
        onStatusChange: (status) => updateItem({ status }),
        timeoutMs: 20 * 60 * 1000,
      })

      if (result.status === 'failed') {
        throw new Error(result.error ?? 'Dịch thất bại — thử lại hoặc kiểm tra video')
      }

      // 3. Download dubbed media
      updateItem({ status: 'processing' })
      const blob    = await getDubbedMedia(elevenLabsApiKey, dubbingId, targetLang)
      const mimeType = blob.type || 'video/mp4'
      const assetId  = await saveAsset(blob, mimeType)
      const videoUrl = await getUrl(assetId)

      updateItem({ status: 'dubbed', assetId, videoUrl })
      addToast(`Dịch thành công: ${displayName}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const toast = msg === 'TIMEOUT'
        ? 'Quá thời gian dịch — thử lại với video ngắn hơn'
        : `Dịch thất bại: ${msg}`
      addToast(toast, 'error')
      updateItem({ status: 'failed', errorMessage: msg })
    } finally {
      setIsTranslating(false)
    }
  }

  const handleDelete = async (item: TranslationItem) => {
    // Cleanup on ElevenLabs (best-effort)
    if (item.dubbingId && elevenLabsApiKey) {
      deleteDubbing(elevenLabsApiKey, item.dubbingId).catch(() => {})
    }
    setHistory((prev) => prev.filter((h) => h.id !== item.id))
  }

  const handleDownload = (item: TranslationItem) => {
    if (!item.videoUrl) return
    const ext  = item.videoUrl.includes('.mp3') || item.videoUrl.includes('audio') ? 'mp3' : 'mp4'
    const a    = document.createElement('a')
    a.href     = item.videoUrl
    a.download = `translated-${item.targetLang}-${Date.now()}.${ext}`
    a.target   = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleTogglePlay = (item: TranslationItem) => {
    if (!item.videoUrl) return
    if (playingId === item.id) {
      audioRef.current?.pause()
      setPlayingId(null)
    } else {
      audioRef.current?.pause()
      setPlayingId(item.id)
    }
  }

  const canTranslate =
    ((inputMode === 'file' && !!file) || (inputMode === 'url' && !!sourceUrl.trim())) &&
    !!targetLang &&
    !!elevenLabsApiKey &&
    !isTranslating

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col lg:flex-row bg-gradient-to-br from-teal-50/30 via-white to-emerald-50/20">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); e.target.value = '' }}
      />

      {/* ── Left panel ── */}
      <div className="flex w-full shrink-0 flex-col border-b border-black/8 lg:w-[340px] lg:border-b-0 lg:border-r">
        {/* Header */}
        <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Languages className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Dịch Video</h2>
              <p className="text-[11px] text-white/70">ElevenLabs Dubbing · 29 ngôn ngữ</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">

            {/* API key warning */}
            {!elevenLabsApiKey && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-[11px] leading-relaxed text-amber-700">
                  Cần ElevenLabs API key trong <strong>Cài đặt</strong>. Tính năng này yêu cầu gói <strong>Creator ($22/mo)</strong> trở lên.
                </p>
              </div>
            )}

            {/* Input mode tabs */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Nguồn video</p>
              <div className="flex gap-1 rounded-xl border border-black/8 bg-black/[0.02] p-1">
                <button
                  onClick={() => setInputMode('file')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-medium transition-all ${
                    inputMode === 'file'
                      ? 'bg-white shadow-sm text-teal-700 border border-teal-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Upload className="h-3 w-3" /> Tải lên
                </button>
                <button
                  onClick={() => setInputMode('url')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-medium transition-all ${
                    inputMode === 'url'
                      ? 'bg-white shadow-sm text-teal-700 border border-teal-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Link2 className="h-3 w-3" /> Dán link
                </button>
              </div>
            </div>

            {/* File drop zone */}
            {inputMode === 'file' ? (
              file ? (
                <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
                    <FileVideo className="h-5 w-5 text-teal-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-teal-800">{file.name}</p>
                    <p className="text-[10px] text-teal-600">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-teal-400 hover:bg-teal-200 hover:text-teal-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-all ${
                    dragOver
                      ? 'border-teal-400 bg-teal-50/80'
                      : 'border-black/12 bg-black/[0.01] hover:border-teal-300 hover:bg-teal-50/40'
                  }`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
                    dragOver ? 'bg-teal-100' : 'bg-black/[0.04]'
                  }`}>
                    <Upload className={`h-6 w-6 ${dragOver ? 'text-teal-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">
                      {dragOver ? 'Thả file vào đây' : 'Kéo thả hoặc click để chọn'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-gray-400">MP4, MOV, WebM, MKV · Tối đa 1GB</p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col gap-1.5">
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                />
                <p className="text-[10px] text-gray-400">URL trực tiếp đến file video (không phải link YouTube)</p>
              </div>
            )}

            {/* Language settings */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Ngôn ngữ gốc</p>
              <LangSelect
                options={SOURCE_LANGUAGES}
                value={sourceLang}
                onChange={setSourceLang}
                placeholder="Tự động nhận diện"
              />
            </div>

            {/* Arrow divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-black/8" />
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100">
                <ArrowRight className="h-3.5 w-3.5 text-teal-600" />
              </div>
              <div className="h-px flex-1 bg-black/8" />
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Ngôn ngữ đích</p>
              <LangSelect
                options={TARGET_LANGUAGES}
                value={targetLang}
                onChange={setTargetLang}
                placeholder="Chọn ngôn ngữ đích"
              />
            </div>

            {/* Speakers (advanced) */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Số người nói
              </p>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumSpeakers(n)}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                      numSpeakers === n
                        ? 'border-teal-400 bg-teal-50 text-teal-700'
                        : 'border-black/10 text-gray-500 hover:border-black/20'
                    }`}
                  >
                    {n === 0 ? 'Tự động' : n}
                  </button>
                ))}
              </div>
            </div>

            {/* Info note */}
            <div className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
              <p className="text-[10px] leading-relaxed text-teal-700">
                ElevenLabs Dubbing tự động phiên âm, dịch và lồng tiếng giữ nguyên giọng nhân vật. Thời gian xử lý ~1–3 phút/phút video.
              </p>
            </div>

          </div>
        </div>

        {/* Translate button */}
        <div className="shrink-0 border-t border-black/8 p-4">
          <button
            onClick={handleTranslate}
            disabled={!canTranslate}
            className="relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-teal-500/40 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: canTranslate
                ? 'linear-gradient(135deg, #0d9488, #10b981)'
                : undefined,
              backgroundColor: !canTranslate ? '#d1d5db' : undefined,
            }}
          >
            {isTranslating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang dịch video...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Globe className="h-4 w-4" />
                Dịch Video
              </span>
            )}
          </button>
          {!elevenLabsApiKey && (
            <p className="mt-2 text-center text-[10px] text-gray-400">
              Cần ElevenLabs Creator plan
            </p>
          )}
        </div>
      </div>

      {/* ── Right panel — results ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Panel header */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/8 bg-white/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-teal-500" />
            <span className="text-sm font-semibold text-gray-700">Kết quả dịch</span>
            {history.length > 0 && (
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-600">
                {history.length}
              </span>
            )}
          </div>
          {history.length > 0 && (
            <button
              onClick={() => setHistory([])}
              className="text-[11px] text-gray-400 transition-colors hover:text-red-400"
            >
              Xóa tất cả
            </button>
          )}
        </div>

        {history.length === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-100 to-emerald-100">
              <Languages className="h-10 w-10 text-teal-400" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-500">Chưa có video nào được dịch</p>
              <p className="mt-1 max-w-xs text-center text-xs leading-relaxed text-gray-400">
                Tải video lên → chọn ngôn ngữ → nhấn Dịch Video. Hỗ trợ 29 ngôn ngữ với giọng AI tự nhiên.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-[11px] text-gray-400">
              {['🇺🇸 English', '🇲🇾 Malay', '🇨🇳 Trung', '🇯🇵 Nhật', '🇰🇷 Hàn', '🇪🇸 Tây Ban Nha'].map((lang) => (
                <span key={lang} className="rounded-full border border-black/8 bg-black/[0.02] px-2.5 py-1">{lang}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {/* Expiry warning */}
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <p className="text-[11px] leading-relaxed text-amber-600">
                Video đã dịch được lưu tạm trong app. Tải xuống trước khi reload trang.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {history.map((item) => {
                const isActive = playingId === item.id
                const isProcessing = item.status === 'pending' || item.status === 'processing'

                return (
                  <div
                    key={item.id}
                    className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all ${
                      isActive ? 'border-teal-300 ring-2 ring-teal-100' : 'border-black/8'
                    }`}
                  >
                    {/* Video player (when done) */}
                    {item.status === 'dubbed' && item.videoUrl && (
                      <div className="bg-black">
                        <video
                          key={item.id}
                          src={item.videoUrl}
                          controls
                          playsInline
                          className="max-h-64 w-full object-contain"
                          onPlay={() => setPlayingId(item.id)}
                          onPause={() => setPlayingId(null)}
                          onEnded={() => setPlayingId(null)}
                        />
                      </div>
                    )}

                    {/* Processing state */}
                    {isProcessing && (
                      <div className="flex items-center gap-4 bg-gradient-to-r from-teal-900/90 to-emerald-900/90 px-5 py-6">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-500/20">
                          <Loader2 className="h-6 w-6 animate-spin text-teal-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white">{item.name}</p>
                          <p className="mt-0.5 text-[11px] text-teal-300/80">
                            {getLangFlag(item.sourceLang)} {getLangLabel(item.sourceLang)} →{' '}
                            {getLangFlag(item.targetLang)} {getLangLabel(item.targetLang)}
                          </p>
                          <p className="mt-1.5 text-[10px] text-white/40 animate-pulse">
                            ElevenLabs đang phiên âm và lồng tiếng...
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Failed state */}
                    {item.status === 'failed' && (
                      <div className="flex items-center gap-3 bg-red-50 px-4 py-3">
                        <X className="h-5 w-5 shrink-0 text-red-400" />
                        <p className="text-[11px] leading-relaxed text-red-500">
                          {item.errorMessage?.slice(0, 200) ?? 'Dịch thất bại'}
                        </p>
                      </div>
                    )}

                    {/* Info row */}
                    <div className="p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileVideo className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="truncate text-xs font-semibold text-gray-700">{item.name}</span>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>

                      {/* Language route */}
                      <div className="mb-3 flex items-center gap-1.5 text-[11px] text-gray-500">
                        <span>{getLangFlag(item.sourceLang)} {getLangLabel(item.sourceLang)}</span>
                        <ArrowRight className="h-3 w-3 text-gray-300" />
                        <span className="font-semibold text-teal-600">{getLangFlag(item.targetLang)} {getLangLabel(item.targetLang)}</span>
                        <span className="ml-auto text-[10px] tabular-nums text-gray-400">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        {item.status === 'dubbed' && item.videoUrl && (
                          <>
                            <button
                              onClick={() => handleTogglePlay(item)}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                                isActive ? 'bg-teal-500 text-white' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                              }`}
                            >
                              {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-px" />}
                            </button>
                            <button
                              onClick={() => handleDownload(item)}
                              className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-[11px] font-semibold text-teal-700 transition-colors hover:bg-teal-100"
                            >
                              <Download className="h-3 w-3" /> Tải xuống
                            </button>
                          </>
                        )}
                        <div className="flex-1" />
                        <button
                          onClick={() => handleDelete(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400"
                          title="Xóa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
