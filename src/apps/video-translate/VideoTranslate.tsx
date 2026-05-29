import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Languages, Upload, Link2, Play, Pause, Download, Trash2,
  Loader2, AlertTriangle, CheckCircle2, ChevronDown, X,
  Globe, ArrowRight, FileVideo, Info, Sliders, Mic, Film,
} from 'lucide-react'
import {
  createDubbing, getDubbedMedia, pollDubbingUntilDone, deleteDubbing,
} from '../../utils/elevenlabs'
import { submitLatentSync, pollLatentSyncUntilDone } from '../../utils/falai'
import { muxAudioIntoVideo } from './muxAudioVideo'
import { saveAsset, getUrl, getBlob } from '../../utils/assetStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useVideoTranslateStore } from '../../stores/videoTranslateStore'
import {
  SOURCE_LANGUAGES, TARGET_LANGUAGES, VALID_SOURCE_CODES, VALID_TARGET_CODES,
  type TranslationItem, type TranslationStatus, type TranslationMode,
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
  const spinner = <Loader2 className="h-2.5 w-2.5 animate-spin" />
  const map: Record<TranslationStatus, { label: string; className: string; icon?: React.ReactNode }> = {
    pending:    { label: 'Đang chờ',       className: 'bg-slate-100 text-slate-500' },
    extracting: { label: 'Upload nguồn',   className: 'bg-slate-100 text-slate-600', icon: spinner },
    dubbing:    { label: 'Đang dịch',      className: 'bg-teal-500/15 text-teal-600', icon: spinner },
    lipsyncing: { label: 'Đang lip-sync',  className: 'bg-indigo-500/15 text-indigo-600', icon: spinner },
    dubbed:     { label: 'Hoàn thành',     className: 'bg-emerald-500/15 text-emerald-600', icon: <CheckCircle2 className="h-2.5 w-2.5" /> },
    failed:     { label: 'Thất bại',       className: 'bg-red-500/15 text-red-500' },
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

/**
 * Phase C — Timing expansion profile per target language.
 *
 * `expansion` = approximate audio length change vs typical source. Negative
 * = target is shorter, positive = longer. Rough averages from real-world
 * ElevenLabs dubbing across thousands of videos; actual results vary with
 * source language pair and speech density.
 *
 * `risk` drives the banner color + recommendation:
 *  - 'low':    +/- ≤ 12%, ElevenLabs auto-adjust handles cleanly
 *  - 'medium': ±13-22%, lip-sync may speed up audibly; voice-only OK
 *  - 'high':   > 22%, risk of CUT content tail; recommend voice-only mode
 */
const LANG_TIMING_PROFILE: Record<string, { expansion: number; risk: 'low' | 'medium' | 'high'; note?: string }> = {
  en: { expansion: 0,    risk: 'low' },
  ms: { expansion: 0.08, risk: 'low' },
  id: { expansion: 0.08, risk: 'low' },
  hi: { expansion: 0.08, risk: 'low' },
  ar: { expansion: 0.10, risk: 'low' },
  es: { expansion: 0.12, risk: 'low' },
  de: { expansion: 0.12, risk: 'low' },
  pt: { expansion: 0.08, risk: 'low' },
  vi: { expansion: 0.12, risk: 'medium' },
  ru: { expansion: 0.15, risk: 'medium' },
  fr: { expansion: 0.18, risk: 'medium' },
  ko: { expansion: 0.20, risk: 'medium' },
  ja: { expansion: 0.30, risk: 'high',  note: 'Tiếng Nhật giãn nhiều — video nói nhanh dễ bị cut cuối' },
  zh: { expansion: -0.10, risk: 'low',   note: 'Tiếng Trung ngắn hơn — có thể có khoảng lặng cuối' },
}

export default function VideoTranslate() {
  // ── Input state ──────────────────────────────────────────────────────
  const [inputMode, setInputMode]       = useState<InputMode>('file')
  // Pipeline mode — default 'lip-sync' to preserve existing UX for current users.
  // 'voice-only' skips fal.ai (faster, cheaper, only needs ElevenLabs key).
  const [mode, setMode]                 = useState<TranslationMode>('lip-sync')
  // Phase B — voice mode. false = clone original speaker's voice (current default,
  // foreigner accent). true = use ElevenLabs Voice Library native voice for
  // target language (authentic accent, slot quota applies).
  const [useNativeVoice, setUseNativeVoice] = useState(false)
  const [file, setFile]                 = useState<File | null>(null)
  // Phase C — measured duration of uploaded video/audio (seconds). null = unknown
  // (URL mode, or metadata not yet loaded). Drives the timing expansion estimate banner.
  const [fileDuration, setFileDuration] = useState<number | null>(null)
  const [sourceUrl, setSourceUrl]       = useState('')
  // Phase 1: default source = 'vi' (most common for VN-MY workflows). User
  // must explicitly pick. No more auto-detect.
  const [sourceLang, setSourceLang]     = useState('vi')
  const [targetLang, setTargetLang]     = useState('en')
  const [numSpeakers, setNumSpeakers]   = useState(0)
  const [dragOver, setDragOver]         = useState(false)
  const fileInputRef                    = useRef<HTMLInputElement>(null)

  // ── Translation state ────────────────────────────────────────────────
  const history     = useVideoTranslateStore((s) => s.history)
  const addItem     = useVideoTranslateStore((s) => s.addItem)
  const updateItemInStore = useVideoTranslateStore((s) => s.updateItem)
  const removeItem  = useVideoTranslateStore((s) => s.removeItem)
  const clearAll    = useVideoTranslateStore((s) => s.clearAll)

  const [isTranslating, setIsTranslating] = useState(false)
  const [playingId, setPlayingId]       = useState<string | null>(null)
  const audioRef                        = useRef<HTMLVideoElement | null>(null)

  const addToast         = useAppStore((s) => s.addToast)
  const elevenLabsApiKey = useSettingsStore((s) => s.elevenLabsApiKey)
  const falApiKey        = useSettingsStore((s) => s.falApiKey)

  // ── Restore videoUrl from assetId after reload ───────────────────────
  useEffect(() => {
    history.forEach((item) => {
      if (item.assetId && !item.videoUrl) {
        getUrl(item.assetId).then((url) => {
          if (url) updateItemInStore(item.id, { videoUrl: url })
        }).catch(() => {})
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Phase 5: resume in-flight jobs after F5 ──────────────────────────
  // Only runs ONCE on mount. For each job stuck in 'dubbing' or 'lipsyncing'
  // with the right id persisted, resume polling from where it left off.
  // 'extracting' = mid-upload to Supabase — can't resume, mark failed.
  // 'pending' = never even reached API — mark failed.
  const resumedRef = useRef(false)
  useEffect(() => {
    if (resumedRef.current) return
    resumedRef.current = true
    if (!elevenLabsApiKey) return

    history.forEach(async (item) => {
      const patch = (u: Partial<TranslationItem>) => updateItemInStore(item.id, u)

      // Cannot recover from these in-flight stages — mark failed cleanly
      if (item.status === 'extracting' || item.status === 'pending') {
        patch({ status: 'failed', errorMessage: 'Bị gián đoạn ở bước upload — chạy lại video này' })
        return
      }

      // Resume ElevenLabs dubbing polling
      if (item.status === 'dubbing' && item.dubbingId) {
        // Fallback to 'lip-sync' for old items created before `mode` field existed.
        const itemMode: TranslationMode = item.mode ?? 'lip-sync'
        console.info('[video-translate] resuming dubbing poll for', item.dubbingId, '· mode=', itemMode)
        try {
          const result = await pollDubbingUntilDone({
            apiKey: elevenLabsApiKey,
            dubbingId: item.dubbingId,
            timeoutMs: 20 * 60 * 1000,
          })
          if (result.status === 'failed') {
            patch({ status: 'failed', errorMessage: result.error ?? 'Dubbing thất bại sau resume' })
            return
          }

          if (itemMode === 'voice-only') {
            // Voice-only resume: try /video; on 404 fall back to /audio + mux
            // with the source video (cached in imageAssetId).
            let finalVideoBlob: Blob
            try {
              finalVideoBlob = await getDubbedMedia(elevenLabsApiKey, item.dubbingId, item.targetLang, 'video')
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              if (!msg.includes('(404)')) throw err
              console.warn('[video-translate] /video 404 on resume — fallback to audio + mux')
              const dubAudioBlob = await getDubbedMedia(elevenLabsApiKey, item.dubbingId, item.targetLang, 'audio')
              const srcVideoBlob = item.imageAssetId ? await getBlob(item.imageAssetId) : null
              if (!srcVideoBlob) throw new Error('Không tìm thấy video gốc đã cache để mux — chạy lại job')
              finalVideoBlob = await muxAudioIntoVideo({ videoBlob: srcVideoBlob, audioBlob: dubAudioBlob })
            }
            const assetId = await saveAsset(finalVideoBlob, finalVideoBlob.type || 'video/mp4')
            const videoUrl = await getUrl(assetId)
            patch({ status: 'dubbed', assetId, videoUrl })
            addToast(`✓ Đã hoàn tất "${item.name}" sau khi resume (voice-only)`, 'success')
          } else {
            // Lip-sync resume: download audio, but lip-sync stage needs sourceVideoUrl
            // which is gone after refresh → mark failed, user must re-run.
            const dubBlob = await getDubbedMedia(elevenLabsApiKey, item.dubbingId, item.targetLang, 'audio')
            const audioAssetId = await saveAsset(dubBlob, dubBlob.type || 'audio/mpeg')
            patch({ audioAssetId })
            patch({
              status: 'failed',
              errorMessage: 'Dubbing đã xong, nhưng cần chạy lại lip-sync (sourceVideoUrl đã hết hạn)',
            })
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.warn('[video-translate] resume failed:', msg)
          patch({ status: 'failed', errorMessage: `Resume failed: ${msg}` })
        }
      }

      // Resume fal.ai lip-sync polling
      if (item.status === 'lipsyncing' && item.lipSyncRequestId && falApiKey) {
        console.info('[video-translate] resuming lip-sync poll for', item.lipSyncRequestId)
        try {
          const result = await pollLatentSyncUntilDone({
            apiKey: falApiKey,
            requestId: item.lipSyncRequestId,
            timeoutMs: 25 * 60 * 1000,
          })
          const finalRes = await fetch(result.videoUrl)
          const finalBlob = await finalRes.blob()
          const assetId = await saveAsset(finalBlob, finalBlob.type || 'video/mp4')
          const videoUrl = await getUrl(assetId)
          patch({ status: 'dubbed', assetId, videoUrl })
          addToast(`✓ Đã hoàn tất "${item.name}" sau khi resume`, 'success')
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.warn('[video-translate] lip-sync resume failed:', msg)
          patch({ status: 'failed', errorMessage: `Lip-sync resume failed: ${msg}` })
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevenLabsApiKey, falApiKey])

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
    setFileDuration(null)  // reset; effect below will re-measure
  }

  // Phase C — read duration metadata from uploaded file via off-DOM <video>.
  // Works for both video and audio files (audio file in <video> tag still
  // reports duration). Skips for URL mode (no File object). Cleans up the
  // blob URL on unmount or file change to prevent memory leaks.
  useEffect(() => {
    if (!file) { setFileDuration(null); return }
    const blobUrl = URL.createObjectURL(file)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      URL.revokeObjectURL(blobUrl)
    }
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        setFileDuration(Math.round(probe.duration))
      }
      cleanup()
    }
    probe.onerror = cleanup
    probe.src = blobUrl
    return cleanup
  }, [file])

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
    // Phase 2: whitelist validation — reject anything outside known ISO codes
    if (!sourceLang || !VALID_SOURCE_CODES.has(sourceLang)) {
      addToast('Chọn ngôn ngữ gốc hợp lệ', 'error'); return
    }
    if (!targetLang || !VALID_TARGET_CODES.has(targetLang)) {
      addToast('Chọn ngôn ngữ đích hợp lệ', 'error'); return
    }
    if (!elevenLabsApiKey) { addToast('Cài ElevenLabs API key trong Cài đặt', 'error'); return }
    // fal.ai only required for lip-sync mode. Voice-only mode uses ElevenLabs' /video
    // endpoint directly (already has dubbed audio mixed into original video).
    if (mode === 'lip-sync' && !falApiKey) {
      addToast('Mode Khớp môi cần fal.ai API key trong Cài đặt — hoặc chuyển sang Chỉ giọng', 'error'); return
    }
    if (sourceLang === targetLang) {
      addToast('Ngôn ngữ gốc và đích không được trùng nhau', 'error'); return
    }

    setIsTranslating(true)

    // Capture current mode + voice settings — protects against user toggling
    // during async run (state would mutate, but currentMode/currentUseNative
    // stay consistent for this job).
    const currentMode: TranslationMode = mode
    const currentUseNative: boolean = useNativeVoice

    const localId = crypto.randomUUID()
    const displayName = inputMode === 'file' ? (file?.name ?? 'video') : sourceUrl.split('/').pop() ?? 'video'

    const newItem: TranslationItem = {
      id:                  localId,
      dubbingId:           '',
      name:                displayName,
      sourceLang,
      targetLang,
      mode:                currentMode,
      disableVoiceCloning: currentUseNative,
      status:              'pending',
      videoUrl:            null,
      assetId:             null,
      audioAssetId:        null,
      imageAssetId:        null,
      createdAt:           Date.now(),
    }
    addItem(newItem)

    const patch = (updates: Partial<TranslationItem>) => updateItemInStore(localId, updates)

    try {
      // ── Stage 1: Upload source video to Supabase (for fal.ai access) ──
      patch({ status: 'extracting' })
      let sourceVideoUrl: string
      if (inputMode === 'file' && file) {
        const srcAssetId = await saveAsset(file, file.type || 'video/mp4')
        const url = await getUrl(srcAssetId)
        if (!url) throw new Error('Không lấy được URL video nguồn sau khi upload')
        sourceVideoUrl = url
        patch({ imageAssetId: srcAssetId })  // reuse imageAssetId to track source video
      } else {
        sourceVideoUrl = sourceUrl.trim()
      }

      // ── Stage 2: ElevenLabs Dubbing — dịch audio giữ giọng gốc ────────
      patch({ status: 'dubbing' })
      // Phase 3: log full payload before API call so we can debug failed runs
      console.info('[video-translate] createDubbing →', {
        sourceLang, targetLang, numSpeakers,
        inputMode, fileName: file?.name, fileSize: file?.size,
      })
      const { dubbingId, expectedDurationSec } = await createDubbing({
        apiKey:              elevenLabsApiKey,
        file:                inputMode === 'file' ? (file ?? undefined) : undefined,
        sourceUrl:           inputMode === 'url' ? sourceUrl.trim() : undefined,
        targetLang,
        sourceLang,
        name:                displayName,
        numSpeakers,
        highestResolution:   true,
        disableVoiceCloning: currentUseNative,
      })
      console.info('[video-translate] dubbing created:', { dubbingId, expectedDurationSec })
      patch({ dubbingId, expectedDurationSec })

      const result = await pollDubbingUntilDone({
        apiKey:    elevenLabsApiKey,
        dubbingId,
        timeoutMs: 20 * 60 * 1000,
      })
      if (result.status === 'failed') {
        throw new Error(result.error ?? 'Dịch thất bại — thử lại hoặc kiểm tra video')
      }

      // ── Branch by mode ──────────────────────────────────────────────────
      if (currentMode === 'voice-only') {
        // Voice-only: try ElevenLabs' /video endpoint first (has dubbed audio
        // pre-mixed into the original video). If it 404s — happens reliably
        // with disable_voice_cloning=true / Native voice mode where EL skips
        // the video render — fall back to fetching /audio and muxing client-
        // side with ffmpeg.wasm. Skip fal.ai either way.
        let finalVideoBlob: Blob
        try {
          finalVideoBlob = await getDubbedMedia(elevenLabsApiKey, dubbingId, targetLang, 'video')
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (!msg.includes('(404)')) throw err
          console.warn('[video-translate] /video 404 — falling back to audio + ffmpeg mux')
          addToast('ElevenLabs không render video — đang mux audio vào video gốc...', 'info')
          const dubAudioBlob = await getDubbedMedia(elevenLabsApiKey, dubbingId, targetLang, 'audio')
          const srcVideoBlob = file ?? (inputMode === 'url'
            ? await fetch(sourceVideoUrl).then((r) => r.blob())
            : null)
          if (!srcVideoBlob) throw new Error('Không lấy được video gốc để mux audio đã dịch')
          finalVideoBlob = await muxAudioIntoVideo({ videoBlob: srcVideoBlob, audioBlob: dubAudioBlob })
        }
        const assetId   = await saveAsset(finalVideoBlob, finalVideoBlob.type || 'video/mp4')
        const videoUrl  = await getUrl(assetId)
        patch({ status: 'dubbed', assetId, videoUrl })
        addToast(`Dịch voice hoàn tất: ${displayName}`)
      } else {
        // Lip-sync: fetch dubbed AUDIO + send through fal.ai LatentSync
        // to re-sync mouth movement with the new language audio.
        const dubBlob       = await getDubbedMedia(elevenLabsApiKey, dubbingId, targetLang, 'audio')
        const audioMime     = dubBlob.type || 'audio/mpeg'
        const audioAssetId  = await saveAsset(dubBlob, audioMime)
        const dubbedAudioUrl = await getUrl(audioAssetId)
        if (!dubbedAudioUrl) throw new Error('Không lấy được URL audio đã dịch')
        patch({ audioAssetId })

        // ── Stage 3: fal.ai LatentSync — video-to-video lip-sync ──────────
        patch({ status: 'lipsyncing' })
        const { requestId } = await submitLatentSync({
          apiKey:    falApiKey,
          videoUrl:  sourceVideoUrl,
          audioUrl:  dubbedAudioUrl,
        })
        console.info('[video-translate] lip-sync requestId:', requestId)
        // Phase 5: persist requestId so refresh-resume can pick it up
        patch({ lipSyncRequestId: requestId })

        const lipSyncResult = await pollLatentSyncUntilDone({
          apiKey:    falApiKey,
          requestId,
          timeoutMs: 25 * 60 * 1000,
        })

        // Download lip-synced video + save permanently
        const finalRes  = await fetch(lipSyncResult.videoUrl)
        const finalBlob = await finalRes.blob()
        const assetId   = await saveAsset(finalBlob, finalBlob.type || 'video/mp4')
        const videoUrl  = await getUrl(assetId)

        patch({ status: 'dubbed', assetId, videoUrl })
        addToast(`Dịch + khớp môi hoàn tất: ${displayName}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Phase 3: log full error context for diagnostics
      console.error('[video-translate] FAIL', {
        sourceLang, targetLang, error: msg,
        useNativeVoice: currentUseNative,
        stack: err instanceof Error ? err.stack : undefined,
      })
      // Phase B: specialize error messages around voice library failures so
      // user knows what to do (toggle back to clone mode, or upgrade plan).
      const lower = msg.toLowerCase()
      let toast: string
      if (msg === 'TIMEOUT') {
        toast = 'Quá thời gian xử lý — thử video ngắn hơn'
      } else if (currentUseNative && (lower.includes('voice') && (lower.includes('limit') || lower.includes('quota') || lower.includes('slot')))) {
        toast = 'Voice native: hết quota custom voices của workspace. Xoá bớt voice cũ trên ElevenLabs hoặc dùng "Giữ giọng gốc (clone)" thay thế.'
      } else if (currentUseNative && lower.includes('permission')) {
        toast = 'Voice native: workspace của bạn chưa có quyền "add_voice_from_voice_library". Upgrade ElevenLabs plan hoặc dùng "Giữ giọng gốc (clone)".'
      } else {
        toast = `Thất bại: ${msg}`
      }
      addToast(toast, 'error')
      // Phase 4: persist FULL raw error so user can see it on the card
      patch({ status: 'failed', errorMessage: msg, rawErrorBody: msg })
    } finally {
      setIsTranslating(false)
    }
  }

  const handleDelete = async (item: TranslationItem) => {
    if (item.dubbingId && elevenLabsApiKey) {
      deleteDubbing(elevenLabsApiKey, item.dubbingId).catch(() => {})
    }
    removeItem(item.id)
  }

  const handleDownload = async (item: TranslationItem) => {
    if (!item.videoUrl) return
    const isAudio  = item.videoUrl.includes('.mp3') || item.videoUrl.includes('audio')
    const ext      = isAudio ? 'mp3' : 'mp4'
    const mimeType = isAudio ? 'audio/mpeg' : 'video/mp4'
    const filename = `translated-${item.targetLang}-${Date.now()}.${ext}`

    try {
      // Fetch and re-wrap as blob with correct MIME type so the browser saves
      // it as .mp4 (not octet-stream). Supabase signed URLs serve as
      // application/octet-stream and browsers ignore <a download> filename
      // on cross-origin responses — wrapping in a same-origin blob URL fixes this.
      const res = await fetch(item.videoUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const rawBlob = await res.blob()
      const blob    = new Blob([rawBlob], { type: mimeType })
      const blobUrl = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href     = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      // Fallback to direct link if fetch fails (CORS, network, etc.)
      console.error('[download] fetch failed:', err)
      const a = document.createElement('a')
      a.href     = item.videoUrl
      a.download = filename
      a.target   = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
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
    !!sourceLang && VALID_SOURCE_CODES.has(sourceLang) &&
    !!targetLang && VALID_TARGET_CODES.has(targetLang) &&
    sourceLang !== targetLang &&
    !!elevenLabsApiKey &&
    !isTranslating

  // Mobile output-first (M5): once a translation lands in history, collapse
  // the input form so the user actually sees the result. FAB re-opens form.
  const [mobileFormVisible, setMobileFormVisible] = useState(true)
  const prevHistoryLenRef = useRef(history.length)
  useEffect(() => {
    if (prevHistoryLenRef.current === 0 && history.length > 0) {
      setMobileFormVisible(false)
    }
    prevHistoryLenRef.current = history.length
  }, [history.length])
  const showInputOnMobile = history.length === 0 || mobileFormVisible

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
      <div className={`${showInputOnMobile ? 'flex' : 'hidden'} lg:flex w-full shrink-0 flex-col border-b border-black/8 lg:w-[340px] lg:border-b-0 lg:border-r`}>
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

            {/* API key warning — mode-aware */}
            {!elevenLabsApiKey && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-[11px] leading-relaxed text-amber-700">
                  Cần ElevenLabs API key trong <strong>Cài đặt</strong>. Yêu cầu gói <strong>Creator ($22/mo)</strong> trở lên.
                </p>
              </div>
            )}
            {mode === 'lip-sync' && elevenLabsApiKey && !falApiKey && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-[11px] leading-relaxed text-amber-700">
                  Mode <strong>Khớp môi</strong> còn cần fal.ai key. Chuyển sang <strong>Chỉ giọng</strong> nếu chỉ muốn dịch audio (không cần fal.ai).
                </p>
              </div>
            )}

            {/* Pipeline mode tabs — Lip-Sync vs Voice-Only */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Kiểu dịch</p>
              <div className="flex gap-1 rounded-xl border border-black/8 bg-black/[0.02] p-1">
                <button
                  onClick={() => setMode('lip-sync')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-medium transition-all ${
                    mode === 'lip-sync'
                      ? 'bg-white shadow-sm text-teal-700 border border-teal-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Film className="h-3 w-3" /> Khớp môi
                </button>
                <button
                  onClick={() => setMode('voice-only')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-medium transition-all ${
                    mode === 'voice-only'
                      ? 'bg-white shadow-sm text-teal-700 border border-teal-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Mic className="h-3 w-3" /> Chỉ giọng
                </button>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-gray-400">
                {mode === 'lip-sync'
                  ? 'Đồng bộ môi với audio mới — phù hợp video có người nói trên camera (UGC, talking head).'
                  : 'Chỉ thay audio, giữ video gốc — phù hợp voiceover, sản phẩm, screen recording, video không có mặt người.'}
              </p>
            </div>

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

            {/* Phase B — Voice selection: clone original speaker vs use native voice.
                Default false (clone). Important: native voice mode uses ElevenLabs Voice
                Library which counts toward workspace's custom voice quota. */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Giọng output
              </p>
              <div className="flex gap-1 rounded-xl border border-black/8 bg-black/[0.02] p-1">
                <button
                  onClick={() => setUseNativeVoice(false)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-medium transition-all ${
                    !useNativeVoice
                      ? 'bg-white shadow-sm text-teal-700 border border-teal-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Giữ giọng gốc (clone)
                </button>
                <button
                  onClick={() => setUseNativeVoice(true)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-medium transition-all ${
                    useNativeVoice
                      ? 'bg-white shadow-sm text-teal-700 border border-teal-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Voice native ngôn ngữ đích
                </button>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-gray-400">
                {useNativeVoice
                  ? 'ElevenLabs auto-pick voice native cho ngôn ngữ đích — accent chuẩn người bản địa, GIỌNG NGƯỜI khác giọng gốc. ⚠️ Voice từ library tính vào quota custom voices của workspace.'
                  : 'Clone giọng nhân vật gốc, chuyển sang ngôn ngữ đích — giữ voice gốc nhưng accent nghe như foreigner nói tiếng đích.'}
              </p>
            </div>

            {/* Phase C — timing expansion estimate banner.
                Shows when target lang is known + different from source. Risk-aware
                color: orange for high-risk pairs (audio likely exceeds video),
                blue for informational notes. Recommends voice-only for high-risk
                when user is in lip-sync mode. */}
            {(() => {
              if (!targetLang || targetLang === sourceLang) return null
              const profile = LANG_TIMING_PROFILE[targetLang]
              if (!profile) return null
              const isExpansion = profile.expansion > 0
              const pct = Math.round(Math.abs(profile.expansion) * 100)
              const highRisk = profile.risk === 'high'
              const mediumLipSync = profile.risk === 'medium' && mode === 'lip-sync'
              const showWarning = highRisk || mediumLipSync
              const targetLabel = getLangLabel(targetLang)
              const sourceLabel = getLangLabel(sourceLang)
              const estimatedSec = fileDuration ? Math.round(fileDuration * (1 + profile.expansion)) : null
              return (
                <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 ${
                  showWarning
                    ? 'border-orange-200 bg-orange-50/60'
                    : 'border-blue-100 bg-blue-50/40'
                }`}>
                  {showWarning
                    ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
                    : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />}
                  <p className="text-[10px] leading-relaxed text-gray-700">
                    <strong>Timing:</strong> Bản dịch {targetLabel} thường{' '}
                    {pct === 0
                      ? 'có thời lượng tương đương'
                      : (isExpansion ? `dài hơn ~${pct}%` : `ngắn hơn ~${pct}%`)}{' '}
                    so với {sourceLabel}.
                    {profile.note && <> {profile.note}.</>}
                    {fileDuration && estimatedSec && (
                      <> Video gốc <strong>{fileDuration}s</strong> → ước tính bản dịch <strong>~{estimatedSec}s</strong>.</>
                    )}
                    {showWarning && mode === 'lip-sync' && (
                      <> Nếu video nói nhanh, ElevenLabs có thể cut cuối hoặc sound rushed —{' '}
                        cân nhắc <strong>chuyển sang "Chỉ giọng"</strong> để có flexibility timing.</>
                    )}
                  </p>
                </div>
              )
            })()}

            {/* Info note */}
            <div className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
              <p className="text-[10px] leading-relaxed text-teal-700">
                {mode === 'lip-sync' ? (
                  <><strong>Pipeline 2 bước:</strong> ElevenLabs dịch giọng giữ giọng gốc → fal.ai LatentSync tái tạo khớp môi cho video. <strong>Giữ nguyên cảnh, body, chuyển động</strong> — chỉ thay lip + audio. Thời gian ~3–6 phút/phút video.</>
                ) : (
                  <><strong>Pipeline 1 bước:</strong> ElevenLabs dịch giọng + ghép vào video gốc. <strong>Không khớp môi</strong> nhưng nhanh + rẻ hơn (không cần fal.ai). Thời gian ~1–3 phút/phút video.</>
                )}
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
                Đang xử lý...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {mode === 'lip-sync' ? <Film className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {mode === 'lip-sync' ? 'Dịch + Khớp môi Video' : 'Dịch Voice (giữ video gốc)'}
              </span>
            )}
          </button>
          {/* Helper text — only flag the keys actually needed for current mode */}
          {!elevenLabsApiKey && (
            <p className="mt-2 text-center text-[10px] text-gray-400">
              Cần ElevenLabs Creator plan
              {mode === 'lip-sync' ? ' + fal.ai key' : ''}
            </p>
          )}
          {elevenLabsApiKey && mode === 'lip-sync' && !falApiKey && (
            <p className="mt-2 text-center text-[10px] text-gray-400">
              Cần fal.ai key (hoặc chuyển sang Chỉ giọng)
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
              onClick={() => clearAll()}
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
            {/* Permanent save info */}
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <p className="text-[11px] leading-relaxed text-emerald-700">
                Video đã được lưu vĩnh viễn trên Supabase. Giữ nguyên sau khi reload trang.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {history.map((item) => {
                const isActive = playingId === item.id
                const isProcessing = item.status === 'pending'
                  || item.status === 'extracting'
                  || item.status === 'dubbing'
                  || item.status === 'lipsyncing'

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
                            {item.status === 'extracting' && 'Đang upload video nguồn...'}
                            {item.status === 'dubbing'    && 'ElevenLabs đang phiên âm và dịch giọng...'}
                            {item.status === 'lipsyncing' && 'fal.ai LatentSync đang tái tạo khớp môi cho video...'}
                            {item.status === 'pending'    && 'Đang chuẩn bị...'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Failed state — Phase 4: show FULL raw error (no truncation) */}
                    {item.status === 'failed' && (
                      <div className="flex items-start gap-3 bg-red-50 px-4 py-3">
                        <X className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-red-700">Dịch thất bại</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-red-600">
                            {item.errorMessage ?? item.rawErrorBody ?? '(không có chi tiết lỗi)'}
                          </p>
                          {item.errorMessage && item.rawErrorBody && item.rawErrorBody !== item.errorMessage && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-[10px] font-semibold text-red-500 hover:text-red-700">
                                Raw API response
                              </summary>
                              <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-red-100/50 p-1.5 text-[10px] text-red-700">
                                {item.rawErrorBody}
                              </pre>
                            </details>
                          )}
                        </div>
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

                      {/* Language route + mode badge */}
                      <div className="mb-3 flex items-center gap-1.5 text-[11px] text-gray-500">
                        <span>{getLangFlag(item.sourceLang)} {getLangLabel(item.sourceLang)}</span>
                        <ArrowRight className="h-3 w-3 text-gray-300" />
                        <span className="font-semibold text-teal-600">{getLangFlag(item.targetLang)} {getLangLabel(item.targetLang)}</span>
                        {/* Mode badge — fallback to 'lip-sync' for old items without `mode` field */}
                        <span className="flex items-center gap-0.5 rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-semibold text-gray-500">
                          {(item.mode ?? 'lip-sync') === 'voice-only'
                            ? <><Mic className="h-2.5 w-2.5" /> Chỉ giọng</>
                            : <><Film className="h-2.5 w-2.5" /> Khớp môi</>}
                        </span>
                        {/* Voice badge — only show if explicitly using native voice */}
                        {item.disableVoiceCloning && (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 border border-emerald-200">
                            Native
                          </span>
                        )}
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

      {history.length > 0 && (
        <button
          onClick={() => setMobileFormVisible((v) => !v)}
          aria-label={showInputOnMobile ? 'Đóng cấu hình' : 'Sửa cấu hình'}
          title={showInputOnMobile ? 'Đóng cấu hình' : 'Sửa cấu hình'}
          className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-3 text-[12px] font-bold text-white shadow-lg shadow-violet-900/30 hover:bg-violet-700 active:scale-95 transition-transform"
        >
          {showInputOnMobile
            ? <><X className="h-4 w-4" /> Đóng</>
            : <><Sliders className="h-4 w-4" /> Sửa</>}
        </button>
      )}
    </div>
  )
}
