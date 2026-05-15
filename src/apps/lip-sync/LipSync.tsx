import { useState, useRef, useEffect } from 'react'
import {
  Mic, Video, Upload, Database, Play, Pause,
  Loader2, Download, Trash2, User, AlertTriangle,
  ChevronDown, Star, Sparkles, X, RefreshCw, Info,
} from 'lucide-react'
import {
  listVoices, listSharedVoices, textToSpeech,
  type ElevenLabsVoice,
} from '../../utils/elevenlabs'
import {
  generateLipSync, pollLipSyncUntilDone,
  LIPSYNC_MODELS, type VideoStatus,
} from '../../utils/kieai'
import { directGeminiText } from '../../utils/gemini'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { saveAsset, getUrl, isAssetRef } from '../../utils/assetStore'
import BankPicker from '../../components/BankPicker'
import type { Model } from '../../stores/types'
import type { LipSyncHistoryItem } from './types'

// ── Emotion tags ──────────────────────────────────────────────────────────────

const EMOTION_TAGS = [
  { label: 'Vui vẻ',     tag: '[happy]' },
  { label: 'Phấn khích', tag: '[excited]' },
  { label: 'Buồn',       tag: '[sad]' },
  { label: 'Tức giận',   tag: '[angry]' },
  { label: 'Thì thầm',  tag: '[whispers]' },
  { label: 'Cười',       tag: '[laughing]' },
]

const EMOTION_TAG_NAMES = EMOTION_TAGS.map((e) => e.tag.replace(/[\[\]]/g, ''))

// Strip [emotion] tags before sending to ElevenLabs TTS so they are not read aloud
function stripEmotionTags(text: string): string {
  const pattern = new RegExp(`\\[(${EMOTION_TAG_NAMES.join('|')})\\]`, 'gi')
  return text.replace(pattern, ' ').replace(/\s{2,}/g, ' ').trim()
}

// AI system instruction for emotion suggestion
const EMOTION_SUGGEST_INSTRUCTION = `You are a voice acting director. Given a script in any language (Vietnamese, English, Malay, or mixed), insert emotion/tone tags at appropriate places to guide voice expression.

Available tags: [happy] [excited] [sad] [angry] [whispers] [laughing]

Rules:
- Insert tags BEFORE the word or phrase they apply to (e.g. "Tôi [happy]rất vui được gặp bạn!")
- Use tags sparingly — only where the emotional tone clearly changes or needs emphasis
- NEVER add, remove, or modify any original words — only INSERT tags
- Do NOT add explanations, notes, or markdown — return ONLY the modified script text`

// ── Detect content-moderation failure from Kling ─────────────────────────────
function isContentViolation(msg: string): boolean {
  const lower = msg.toLowerCase()
  return (
    lower.includes('community guidelines') ||
    lower.includes('violate') ||
    lower.includes('content policy') ||
    lower.includes('inappropriate') ||
    lower.includes('unsafe')
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VideoStatus }) {
  const map: Record<VideoStatus, { label: string; className: string }> = {
    pending:    { label: 'Đang chờ',    className: 'bg-gray-200 text-gray-500' },
    processing: { label: 'Đang tạo',   className: 'bg-indigo-500/20 text-indigo-400' },
    completed:  { label: 'Hoàn thành', className: 'bg-emerald-500/20 text-emerald-400' },
    failed:     { label: 'Thất bại',   className: 'bg-red-500/20 text-red-400' },
  }
  const { label, className } = map[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {status === 'processing' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {label}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LipSync() {
  // ── Character image ──────────────────────────────────────────────────
  const [characterAssetId, setCharacterAssetId]       = useState<string | null>(null)
  const [characterDisplayUrl, setCharacterDisplayUrl] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen]                   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Voice ────────────────────────────────────────────────────────────
  const [voices, setVoices]               = useState<ElevenLabsVoice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<ElevenLabsVoice | null>(null)
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false)

  // ── Script & emotion suggestion ──────────────────────────────────────
  const [scriptText, setScriptText]                     = useState('')
  const [isSuggestingEmotions, setIsSuggestingEmotions] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Audio ────────────────────────────────────────────────────────────
  const [audioAssetId, setAudioAssetId]       = useState<string | null>(null)
  const [audioDisplayUrl, setAudioDisplayUrl] = useState<string | null>(null)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [isPlaying, setIsPlaying]             = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  // ── Model / resolution ───────────────────────────────────────────────
  const [selectedModelId, setSelectedModelId]     = useState('kling-avatar-std')
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [resolution, setResolution]               = useState<'480p' | '720p'>('720p')

  // ── Video generation ─────────────────────────────────────────────────
  const [history, setHistory]           = useState<LipSyncHistoryItem[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress]         = useState(0)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const addToast         = useAppStore((s) => s.addToast)
  const elevenLabsApiKey = useSettingsStore((s) => s.elevenLabsApiKey)
  const kieApiKey        = useSettingsStore((s) => s.kieApiKey)
  const geminiApiKey     = useSettingsStore((s) => s.geminiApiKey)

  const selectedModel = LIPSYNC_MODELS.find((m) => m.id === selectedModelId) ?? LIPSYNC_MODELS[0]

  // ── Load voices: cloned (user) + Malaysian library ───────────────────
  useEffect(() => {
    if (!elevenLabsApiKey) return
    setVoicesLoading(true)

    Promise.all([
      listVoices(elevenLabsApiKey),
      listSharedVoices({ apiKey: elevenLabsApiKey, language: 'ms',        pageSize: 50 }),
      listSharedVoices({ apiKey: elevenLabsApiKey, accent: 'malaysian',   pageSize: 50 }),
    ])
      .then(([userVoices, msVoices, accentVoices]) => {
        // Keep only cloned voices from user account
        const cloned = userVoices.filter((v) => v.category === 'cloned')

        // Merge & deduplicate Malaysian library voices
        const libMap = new Map<string, (typeof msVoices)[0]>()
        for (const v of [...msVoices, ...accentVoices]) {
          libMap.set(v.voice_id, v)
        }

        // Convert SharedVoice → ElevenLabsVoice shape
        const libraryVoices: ElevenLabsVoice[] = Array.from(libMap.values()).map((v) => ({
          voice_id:    v.voice_id,
          name:        v.name,
          category:    'professional' as const,
          labels:      { gender: v.gender ?? '', accent: 'malaysian', language: 'ms' },
          preview_url: v.preview_url,
        }))

        // Cloned first, then Malaysian library
        setVoices([...cloned, ...libraryVoices])
      })
      .catch(() => addToast('Không tải được danh sách giọng ElevenLabs', 'error'))
      .finally(() => setVoicesLoading(false))
  }, [elevenLabsApiKey, addToast])

  // ── Fake progress bar ────────────────────────────────────────────────
  useEffect(() => {
    if (isGenerating) {
      setProgress(0)
      progressRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 92) return prev
          const inc = prev < 30 ? 2 : prev < 65 ? 0.8 : 0.2
          return Math.min(prev + inc, 92)
        })
      }, 800)
    } else {
      if (progressRef.current) clearInterval(progressRef.current)
      if (progress > 0) {
        setProgress(100)
        setTimeout(() => setProgress(0), 600)
      }
    }
    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating])

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleBankSelect = async (item: unknown) => {
    const model = item as Model
    setPickerOpen(false)
    if (!model.characterImage) {
      addToast('Nhân vật này chưa có ảnh — upload ảnh trong Character Studio trước', 'error')
      return
    }
    setCharacterAssetId(model.characterImage)
    if (isAssetRef(model.characterImage)) {
      const url = await getUrl(model.characterImage)
      setCharacterDisplayUrl(url)
    } else {
      setCharacterDisplayUrl(model.characterImage)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setCharacterAssetId(dataUrl)
      setCharacterDisplayUrl(dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const insertEmotionTag = (tag: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setScriptText((prev) => `${prev}${tag} `)
      return
    }
    const start = textarea.selectionStart
    const end   = textarea.selectionEnd
    const next  = scriptText.slice(0, start) + tag + ' ' + scriptText.slice(end)
    setScriptText(next)
    setTimeout(() => {
      textarea.selectionStart = start + tag.length + 1
      textarea.selectionEnd   = start + tag.length + 1
      textarea.focus()
    }, 0)
  }

  // AI emotion suggestion
  const handleSuggestEmotions = async () => {
    if (!scriptText.trim()) { addToast('Nhập kịch bản trước khi gợi ý biểu cảm', 'error'); return }
    if (!geminiApiKey)       { addToast('Cần Gemini API key trong Cài đặt để dùng tính năng này', 'error'); return }

    setIsSuggestingEmotions(true)
    try {
      const result = await directGeminiText({
        apiKey: geminiApiKey,
        prompt: `Script:\n${scriptText}`,
        systemInstruction: EMOTION_SUGGEST_INSTRUCTION,
      })
      const cleaned = result.trim()
      if (cleaned) {
        setScriptText(cleaned)
        addToast('Đã bổ sung biểu cảm vào kịch bản')
      } else {
        addToast('AI không trả về kết quả — thử lại', 'error')
      }
    } catch (err) {
      addToast(`Gợi ý biểu cảm thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setIsSuggestingEmotions(false)
    }
  }

  const handleGenerateAudio = async () => {
    if (!scriptText.trim()) { addToast('Nhập kịch bản trước khi tạo audio', 'error'); return }
    if (!selectedVoice)     { addToast('Chọn giọng đọc trước', 'error'); return }
    if (!elevenLabsApiKey)  { addToast('Cài ElevenLabs API key trong Cài đặt', 'error'); return }

    setIsGeneratingAudio(true)
    setAudioAssetId(null)
    setAudioDisplayUrl(null)
    setIsPlaying(false)

    try {
      // Strip [emotion] tags so they are NOT read aloud — voice expresses emotion through inflection
      const cleanText = stripEmotionTags(scriptText)
      const buffer    = await textToSpeech({
        apiKey:        elevenLabsApiKey,
        voiceId:       selectedVoice.voice_id,
        text:          cleanText,
        style:         0.35,  // moderate style exaggeration for expressiveness
        useSpeakerBoost: true,
      })
      const blob    = new Blob([buffer], { type: 'audio/mpeg' })
      const assetId = await saveAsset(blob, 'audio/mpeg')
      const display = await getUrl(assetId)
      setAudioAssetId(assetId)
      setAudioDisplayUrl(display)
      addToast('Audio đã sẵn sàng')
    } catch (err) {
      addToast(`Tạo audio thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!characterAssetId) { addToast('Chọn ảnh nhân vật trước', 'error'); return }
    if (!audioAssetId)     { addToast('Tạo audio trước khi tạo video', 'error'); return }
    if (!kieApiKey)        { addToast('Cài kie.ai API key trong Cài đặt', 'error'); return }

    setIsGenerating(true)

    const historyId = crypto.randomUUID()
    const newItem: LipSyncHistoryItem = {
      id:         historyId,
      imageUrl:   characterDisplayUrl ?? '',
      audioUrl:   audioDisplayUrl ?? '',
      videoUrl:   null,
      scriptText,
      voiceName:  selectedVoice?.name ?? '',
      modelName:  selectedModel.name,
      status:     'pending',
      taskId:     '',
      createdAt:  Date.now(),
    }
    setHistory((prev) => [newItem, ...prev])

    try {
      // Resolve character image to public URL
      let imagePublicUrl: string
      if (isAssetRef(characterAssetId)) {
        const url = await getUrl(characterAssetId)
        if (!url) throw new Error('Không lấy được URL ảnh nhân vật')
        imagePublicUrl = url
      } else if (characterAssetId.startsWith('data:')) {
        const resp    = await fetch(characterAssetId)
        const blob    = await resp.blob()
        const savedId = await saveAsset(blob, blob.type || 'image/jpeg')
        const url     = await getUrl(savedId)
        if (!url) throw new Error('Không lấy được URL ảnh sau khi lưu')
        setCharacterAssetId(savedId)
        imagePublicUrl = url
      } else {
        imagePublicUrl = characterAssetId
      }

      // Resolve audio to public URL
      const audioPublicUrl = await getUrl(audioAssetId)
      if (!audioPublicUrl) throw new Error('Không lấy được URL audio')

      // Submit lip-sync job
      const { taskId } = await generateLipSync({
        apiKey:     kieApiKey,
        modelId:    selectedModel.modelId,
        imageUrl:   imagePublicUrl,
        audioUrl:   audioPublicUrl,
        prompt:     'Natural lip-sync, realistic facial expressions, smooth head motion, high quality',
        resolution: selectedModel.supportsResolution ? resolution : undefined,
      })

      setHistory((prev) =>
        prev.map((h) => (h.id === historyId ? { ...h, taskId, status: 'processing' as VideoStatus } : h)),
      )

      const videoUrl = await pollLipSyncUntilDone({
        apiKey:    kieApiKey,
        taskId,
        onStatusChange: (status) => {
          setHistory((prev) => prev.map((h) => (h.id === historyId ? { ...h, status } : h)))
        },
        timeoutMs: 8 * 60 * 1000,
      })

      setHistory((prev) =>
        prev.map((h) => (h.id === historyId ? { ...h, videoUrl, status: 'completed' as VideoStatus } : h)),
      )
      addToast('Tạo video lip-sync thành công!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      let toastMsg = `Tạo video thất bại: ${msg}`
      if (msg === 'INSUFFICIENT_CREDITS') toastMsg = 'Không đủ Credit kie.ai'
      if (msg === 'TIMEOUT')              toastMsg = 'Quá thời gian tạo video — thử lại sau'
      if (isContentViolation(msg))        toastMsg = 'Kling từ chối nội dung — xem gợi ý bên dưới kết quả'
      addToast(toastMsg, 'error')
      setHistory((prev) =>
        prev.map((h) => (h.id === historyId ? { ...h, status: 'failed' as VideoStatus, errorMessage: msg } : h)),
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleTogglePlay = () => {
    const audio = audioRef.current
    if (!audio || !audioDisplayUrl) return
    if (isPlaying) { audio.pause() } else { void audio.play() }
    setIsPlaying(!isPlaying)
  }

  const handleDownload = (item: LipSyncHistoryItem) => {
    if (!item.videoUrl) return
    const a = document.createElement('a')
    a.href = item.videoUrl
    a.download = `lipsync-${Date.now()}.mp4`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Retry a failed item with a different model (e.g. InfiniteTalk after Kling fails)
  const handleRetryWithModel = async (failedItem: LipSyncHistoryItem, modelId: string) => {
    if (!characterAssetId || !audioAssetId || !kieApiKey) return
    const retryModel = LIPSYNC_MODELS.find((m) => m.id === modelId)
    if (!retryModel) return

    setIsGenerating(true)
    const historyId = crypto.randomUUID()
    const newItem: LipSyncHistoryItem = {
      id: historyId,
      imageUrl:   failedItem.imageUrl,
      audioUrl:   failedItem.audioUrl,
      videoUrl:   null,
      scriptText: failedItem.scriptText,
      voiceName:  failedItem.voiceName,
      modelName:  retryModel.name,
      status:     'pending',
      taskId:     '',
      createdAt:  Date.now(),
    }
    setHistory((prev) => [newItem, ...prev])

    try {
      // Resolve image URL
      let imagePublicUrl: string
      if (isAssetRef(characterAssetId)) {
        const url = await getUrl(characterAssetId)
        if (!url) throw new Error('Không lấy được URL ảnh nhân vật')
        imagePublicUrl = url
      } else if (characterAssetId.startsWith('data:')) {
        const resp    = await fetch(characterAssetId)
        const blob    = await resp.blob()
        const savedId = await saveAsset(blob, blob.type || 'image/jpeg')
        const url     = await getUrl(savedId)
        if (!url) throw new Error('Không lấy được URL ảnh sau khi lưu')
        setCharacterAssetId(savedId)
        imagePublicUrl = url
      } else {
        imagePublicUrl = characterAssetId
      }

      const audioPublicUrl = await getUrl(audioAssetId)
      if (!audioPublicUrl) throw new Error('Không lấy được URL audio')

      const { taskId } = await generateLipSync({
        apiKey:     kieApiKey,
        modelId:    retryModel.modelId,
        imageUrl:   imagePublicUrl,
        audioUrl:   audioPublicUrl,
        prompt:     'Natural lip-sync, realistic facial expressions, smooth head motion, high quality',
        resolution: retryModel.supportsResolution ? '720p' : undefined,
      })

      setHistory((prev) =>
        prev.map((h) => (h.id === historyId ? { ...h, taskId, status: 'processing' as VideoStatus } : h)),
      )

      const videoUrl = await pollLipSyncUntilDone({
        apiKey: kieApiKey,
        taskId,
        onStatusChange: (status) => {
          setHistory((prev) => prev.map((h) => (h.id === historyId ? { ...h, status } : h)))
        },
        timeoutMs: 8 * 60 * 1000,
      })

      setHistory((prev) =>
        prev.map((h) => (h.id === historyId ? { ...h, videoUrl, status: 'completed' as VideoStatus } : h)),
      )
      addToast('Tạo video lip-sync thành công!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Tạo video thất bại: ${msg}`, 'error')
      setHistory((prev) =>
        prev.map((h) => (h.id === historyId ? { ...h, status: 'failed' as VideoStatus, errorMessage: msg } : h)),
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const canGenerateVideo = !!characterAssetId && !!audioAssetId && !isGenerating

  // Partition voices: cloned vs library Malaysian
  const clonedVoices  = voices.filter((v) => v.category === 'cloned')
  const libraryVoices = voices.filter((v) => v.category !== 'cloned')

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileUpload} />
      {audioDisplayUrl && (
        <audio ref={audioRef} src={audioDisplayUrl} onEnded={() => setIsPlaying(false)} />
      )}

      {/* ── Left panel — controls ── */}
      <div className="flex w-full shrink-0 flex-col border-b border-black/8 lg:w-1/3 lg:border-b-0 lg:border-r">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-5">

            {/* 1. Character image */}
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-gray-400">Ảnh nhân vật</p>
              {characterDisplayUrl ? (
                /* Compact thumbnail — full image visible, not cropped */
                <div className="group relative flex items-center gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-2">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-black/8 bg-black/5">
                    <img
                      src={characterDisplayUrl}
                      alt="Nhân vật"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700">Ảnh đã chọn</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-0.5 text-[10px] text-indigo-500 hover:underline"
                    >
                      Đổi ảnh
                    </button>
                  </div>
                  <button
                    onClick={() => { setCharacterAssetId(null); setCharacterDisplayUrl(null) }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-gray-500 transition-colors hover:bg-red-500/15 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/12 bg-black/[0.02] py-7 text-gray-500 transition-colors hover:border-black/20 hover:bg-black/[0.04] hover:text-gray-700"
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-[11px]">Tải ảnh lên</span>
                  </button>
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/12 bg-black/[0.02] py-7 text-gray-500 transition-colors hover:border-black/20 hover:bg-black/[0.04] hover:text-gray-700"
                  >
                    <Database className="h-5 w-5" />
                    <span className="text-[11px]">Chọn từ Nhân vật</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2. Voice selector — cloned + Malaysian library only */}
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-gray-400">Giọng ElevenLabs</p>
              {!elevenLabsApiKey ? (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <p className="text-[11px] text-amber-700">Cài ElevenLabs API key trong Cài đặt</p>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setVoiceDropdownOpen(!voiceDropdownOpen)}
                    className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-3 text-left transition-colors hover:bg-black/[0.04]"
                  >
                    <Mic className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      {voicesLoading ? (
                        <span className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Loader2 className="h-3 w-3 animate-spin" /> Đang tải giọng...
                        </span>
                      ) : selectedVoice ? (
                        <>
                          <span className="block truncate text-sm font-medium text-gray-800">{selectedVoice.name}</span>
                          <span className="text-[10px] text-gray-400">
                            {selectedVoice.category === 'cloned' ? 'Giọng đã clone' : 'Giọng thư viện Malaysian'}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-400">Chọn giọng đọc...</span>
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${voiceDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {voiceDropdownOpen && voices.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-black/10 bg-white shadow-xl">
                      {/* Cloned voices section */}
                      {clonedVoices.length > 0 && (
                        <>
                          <div className="sticky top-0 bg-white px-3 py-1.5 border-b border-black/5">
                            <span className="text-[9px] font-semibold uppercase tracking-widest text-violet-500">Giọng đã clone</span>
                          </div>
                          {clonedVoices.map((v) => (
                            <button
                              key={v.voice_id}
                              onClick={() => { setSelectedVoice(v); setVoiceDropdownOpen(false) }}
                              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-black/5 ${selectedVoice?.voice_id === v.voice_id ? 'bg-indigo-50' : ''}`}
                            >
                              <div className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                              <span className="flex-1 truncate text-xs font-medium text-gray-700">{v.name}</span>
                              <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-semibold text-violet-600">Clone</span>
                            </button>
                          ))}
                        </>
                      )}
                      {/* Malaysian library voices section */}
                      {libraryVoices.length > 0 && (
                        <>
                          <div className={`sticky top-0 bg-white px-3 py-1.5 border-b border-black/5 ${clonedVoices.length > 0 ? 'border-t' : ''}`}>
                            <span className="text-[9px] font-semibold uppercase tracking-widest text-indigo-500">Thư viện Malaysian</span>
                          </div>
                          {libraryVoices.map((v) => (
                            <button
                              key={v.voice_id}
                              onClick={() => { setSelectedVoice(v); setVoiceDropdownOpen(false) }}
                              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-black/5 ${selectedVoice?.voice_id === v.voice_id ? 'bg-indigo-50' : ''}`}
                            >
                              <div className="h-2 w-2 shrink-0 rounded-full bg-indigo-300" />
                              <span className="flex-1 truncate text-xs font-medium text-gray-700">{v.name}</span>
                              <span className="shrink-0 text-[9px] text-gray-400">
                                {v.labels?.gender === 'male' ? '♂' : v.labels?.gender === 'female' ? '♀' : ''}
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                      {voices.length === 0 && !voicesLoading && (
                        <div className="px-3 py-4 text-center text-xs text-gray-400">Không tìm được giọng Malaysian</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Script + emotion tags + AI suggestion */}
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-gray-400">Kịch bản</p>

              {/* AI suggest button */}
              <button
                onClick={handleSuggestEmotions}
                disabled={isSuggestingEmotions || !scriptText.trim()}
                className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 py-1.5 text-[11px] font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                title={!geminiApiKey ? 'Cần Gemini API key trong Cài đặt' : ''}
              >
                {isSuggestingEmotions ? (
                  <><Loader2 className="h-3 w-3 animate-spin" />Đang gợi ý biểu cảm...</>
                ) : (
                  <><Sparkles className="h-3 w-3" />Gợi ý biểu cảm</>
                )}
              </button>

              {/* Manual emotion tag buttons */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                {EMOTION_TAGS.map(({ label, tag }) => (
                  <button
                    key={tag}
                    onClick={() => insertEmotionTag(tag)}
                    className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-medium text-violet-600 transition-colors hover:bg-violet-100"
                  >
                    + {label}
                  </button>
                ))}
              </div>

              <textarea
                ref={textareaRef}
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                rows={5}
                placeholder="Nhập kịch bản... Dùng nút cảm xúc hoặc 'Gợi ý biểu cảm' để thêm tag [happy], [excited]..."
                className="w-full resize-none rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-gray-300 outline-none transition-colors focus:border-black/15"
              />
              <p className="mt-1 text-[10px] text-gray-400">
                Các tag biểu cảm sẽ được bỏ khi phát âm — giọng tự thể hiện qua ngữ điệu
              </p>
            </div>

            {/* 4. Generate audio */}
            <div>
              <button
                onClick={handleGenerateAudio}
                disabled={isGeneratingAudio || !scriptText.trim() || !selectedVoice || !elevenLabsApiKey}
                className="w-full rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGeneratingAudio ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tạo audio...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Mic className="h-3.5 w-3.5" /> Tạo audio từ kịch bản
                  </span>
                )}
              </button>

              {/* Audio player */}
              {audioDisplayUrl && (
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-black/8 bg-black/[0.02] px-3 py-2.5">
                  <button
                    onClick={handleTogglePlay}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white transition-colors hover:bg-violet-600"
                  >
                    {isPlaying ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5 translate-x-px" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-gray-700">Audio đã sẵn sàng</span>
                    <span className="text-[10px] text-gray-400">{selectedVoice?.name ?? 'ElevenLabs'}</span>
                  </div>
                  <span className="shrink-0 text-sm text-emerald-500">✓</span>
                </div>
              )}
            </div>

            {/* 5. Lip-sync model */}
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-gray-400">Model Lip-Sync</p>
              <button
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-3 transition-colors hover:bg-black/[0.04]"
              >
                <Video className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800">{selectedModel.name}</span>
                    {selectedModel.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                  </div>
                  <span className="text-[10px] text-gray-400">{selectedModel.resolution} · tối đa {selectedModel.maxDuration}</span>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {modelDropdownOpen && (
                <div className="mt-1 overflow-hidden rounded-xl border border-black/10 bg-white">
                  {LIPSYNC_MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedModelId(m.id); setModelDropdownOpen(false) }}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-black/5 ${selectedModelId === m.id ? 'bg-indigo-50' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-medium ${selectedModelId === m.id ? 'text-indigo-600' : 'text-gray-700'}`}>
                            {m.name}
                          </span>
                          {m.starred && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />}
                        </div>
                        <span className="text-[10px] text-gray-400">{m.resolution} · {m.maxDuration}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Kling Avatar Standard requirements tip */}
              {selectedModel.id === 'kling-avatar-std' && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <p className="text-[10px] leading-relaxed text-amber-700">
                    Kling yêu cầu <strong>ảnh mặt thẳng, rõ nét</strong>. Ảnh góc nghiêng, đeo kính, hoặc mờ sẽ bị từ chối và <strong>vẫn tốn credit</strong>. Không chắc → dùng InfiniteTalk.
                  </p>
                </div>
              )}

              {/* Resolution (InfiniteTalk only) */}
              {selectedModel.supportsResolution && (
                <div className="mt-2">
                  <p className="mb-1 text-[10px] text-gray-400">Độ phân giải</p>
                  <div className="flex gap-2">
                    {(['480p', '720p'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setResolution(r)}
                        className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                          resolution === r
                            ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-500'
                            : 'border-black/10 text-gray-500 hover:border-black/15'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Generate video button */}
        <div className="border-t border-black/8 p-4">
          {!characterAssetId && (
            <p className="mb-2 text-center text-[11px] text-gray-400">Chưa có ảnh nhân vật</p>
          )}
          {characterAssetId && !audioAssetId && (
            <p className="mb-2 text-center text-[11px] text-gray-400">Cần tạo audio trước</p>
          )}
          <button
            onClick={handleGenerateVideo}
            disabled={!canGenerateVideo}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo video...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Video className="h-4 w-4" /> Tạo video Lip-Sync
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Right panel — library grid ── */}
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-50/40">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/8 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Thư viện Lip-Sync</span>
            {history.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                {history.length}
              </span>
            )}
          </div>
          {history.length > 0 && (
            <button
              onClick={() => setHistory([])}
              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-gray-400 transition-colors hover:bg-red-50 hover:text-red-400"
            >
              Xóa tất cả
            </button>
          )}
        </div>

        {history.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
              <User className="h-8 w-8 text-indigo-200" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-gray-400">Thư viện trống</p>
            <p className="max-w-xs text-center text-xs text-gray-300 leading-relaxed">
              1. Chọn ảnh nhân vật → 2. Chọn giọng & nhập kịch bản → 3. Tạo audio → 4. Tạo video
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3">
            {/* Warning bar */}
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/80 px-3 py-2">
              <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
              <p className="text-[10px] text-amber-500/90">
                kie.ai lưu media 14 ngày — tải xuống trước khi hết hạn
              </p>
            </div>

            {/* ── Grid ── */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
              {history.map((item) => {
                const isItemGenerating = item.status === 'pending' || item.status === 'processing'
                const isViolation = item.status === 'failed' && !!item.errorMessage && isContentViolation(item.errorMessage)

                return (
                  <div
                    key={item.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm transition-all hover:shadow-md hover:border-indigo-200"
                  >
                    {/* ── Media area ── */}
                    <div className="relative aspect-video w-full overflow-hidden bg-black">
                      {isItemGenerating ? (
                        /* Processing overlay */
                        <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-indigo-950 to-black px-4">
                          <div className="relative">
                            <div className="h-10 w-10 rounded-full border-2 border-white/10" />
                            <Loader2 className="absolute inset-0 h-10 w-10 animate-spin text-indigo-400" />
                          </div>
                          <div className="w-full">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-[9px] text-white/30">Đang tạo...</span>
                              <span className="text-[9px] font-bold tabular-nums text-indigo-400">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-indigo-400 transition-all duration-700"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : item.videoUrl ? (
                        <video
                          key={item.id}
                          src={item.videoUrl}
                          controls
                          playsInline
                          className="h-full w-full object-contain"
                        />
                      ) : isViolation ? (
                        /* Content violation */
                        <div className="flex h-full flex-col items-center justify-center gap-2 bg-amber-950/40 px-3 text-center">
                          <AlertTriangle className="h-6 w-6 text-amber-400" />
                          <p className="text-[9px] font-medium leading-tight text-amber-200">
                            Kling từ chối nội dung
                          </p>
                        </div>
                      ) : (
                        /* Generic failed */
                        <div className="flex h-full items-center justify-center bg-red-950/20">
                          <span className="text-4xl text-red-200/40">✕</span>
                        </div>
                      )}

                      {/* Status badge — top-left overlay */}
                      <div className="absolute left-2 top-2">
                        <StatusBadge status={item.status} />
                      </div>

                      {/* Time — top-right overlay */}
                      <div className="absolute right-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] tabular-nums text-white/60 backdrop-blur-sm">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {/* ── Info + actions ── */}
                    <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                      {/* Model + voice */}
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[10px] font-semibold text-gray-700">{item.modelName}</span>
                        {item.voiceName && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="truncate text-[10px] text-gray-400">{item.voiceName}</span>
                          </>
                        )}
                      </div>

                      {/* Script preview */}
                      <p className="line-clamp-2 text-[10px] leading-relaxed text-gray-400">
                        {item.scriptText}
                      </p>

                      {/* Content violation retry */}
                      {isViolation && item.modelName !== 'InfiniteTalk' && (
                        <button
                          onClick={() => handleRetryWithModel(item, 'infinitalk')}
                          disabled={isGenerating}
                          className="mt-0.5 flex items-center justify-center gap-1 rounded-lg bg-amber-50 border border-amber-200 py-1.5 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                        >
                          <RefreshCw className="h-2.5 w-2.5" />
                          Thử với InfiniteTalk
                        </button>
                      )}

                      {/* Non-violation error */}
                      {item.status === 'failed' && item.errorMessage && !isViolation && (
                        <p className="rounded-md bg-red-50 px-2 py-1 text-[9px] leading-relaxed text-red-500 line-clamp-2">
                          {item.errorMessage}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="mt-auto flex items-center gap-1.5 pt-1">
                        {item.videoUrl && (
                          <button
                            onClick={() => handleDownload(item)}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 py-1.5 text-[10px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-100"
                          >
                            <Download className="h-2.5 w-2.5" /> Tải xuống
                          </button>
                        )}
                        <button
                          onClick={() => setHistory((prev) => prev.filter((h) => h.id !== item.id))}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400"
                          title="Xóa"
                        >
                          <Trash2 className="h-3 w-3" />
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

      {/* Model picker */}
      <BankPicker
        bankType="models"
        isOpen={pickerOpen}
        onSelect={handleBankSelect}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  )
}
