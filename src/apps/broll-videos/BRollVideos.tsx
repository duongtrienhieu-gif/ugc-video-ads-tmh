import { useState, useRef, useCallback } from 'react'
import {
  ChevronDown, Upload, Database, X, Plus, Film,
  Download, Save, Trash2, Loader2, Star,
} from 'lucide-react'
import {
  VIDEO_MODELS,
  generateVideo,
  pollVideoUntilDone,
  type AspectRatio,
  type Resolution,
  type VideoStatus,
} from '../../utils/kieai'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import { getUrl } from '../../utils/assetStore'
import BankPicker from '../../components/BankPicker'
import type { BRoll } from '../../stores/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface SlotState {
  modelId: string
  prompt: string
  aspectRatio: AspectRatio
  resolution: Resolution
  startFrameUrl: string | null
  endFrameUrl: string | null
  referenceImageUrls: string[]
}

interface VideoHistoryItem {
  id: string
  taskId: string
  modelId: string
  modelName: string
  prompt: string
  videoUrl: string | null
  aspectRatio: AspectRatio
  status: VideoStatus
  errorMessage?: string
  createdAt: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const createSlot = (): SlotState => ({
  modelId: 'veo3_fast',
  prompt: '',
  aspectRatio: '16:9',
  resolution: '720p',
  startFrameUrl: null,
  endFrameUrl: null,
  referenceImageUrls: [],
})

const SLOTS = 4

// ── Provider icon SVGs ────────────────────────────────────────────────────────

function ProviderIcon({ provider, size = 'md' }: { provider: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7'
  const svgDim = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  if (provider === 'Google') {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 ${dim}`}>
        <svg viewBox="0 0 24 24" className={svgDim}>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      </span>
    )
  }

  if (provider === 'OpenAI') {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-lg bg-[#000] ${dim}`}>
        <svg viewBox="0 0 24 24" className={svgDim} fill="white">
          <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9 5.98 5.98 0 0 0-4.5-2.01 6.05 6.05 0 0 0-5.77 4.19 5.98 5.98 0 0 0-3.99 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.51 2.9A5.98 5.98 0 0 0 13.26 24a6.05 6.05 0 0 0 5.77-4.2 5.99 5.99 0 0 0 3.99-2.9 6.05 6.05 0 0 0-.74-7.08zM13.26 22.4a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.8.8 0 0 0 .39-.68V11.5l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.49 4.1zM3.6 18.27a4.47 4.47 0 0 1-.53-3.01l.14.08 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06l-4.84 2.8A4.5 4.5 0 0 1 3.6 18.27zm-1.27-9.84A4.49 4.49 0 0 1 4.7 6.49V11.6a.77.77 0 0 0 .39.68l5.81 3.35-2.02 1.17a.08.08 0 0 1-.07 0L3.98 13.9a4.5 4.5 0 0 1-1.65-5.47zm16.6 3.86-5.84-3.37 2.02-1.17a.08.08 0 0 1 .07 0l4.83 2.79a4.49 4.49 0 0 1-.68 8.1V13.1a.79.79 0 0 0-.4-.81zm2.01-3.02-.14-.08-4.77-2.78a.78.78 0 0 0-.79 0L9.41 9.78V7.45a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.67zM8.31 12.86 6.29 11.7a.08.08 0 0 1-.04-.06V6.08a4.5 4.5 0 0 1 7.38-3.45l-.14.08-4.78 2.76a.8.8 0 0 0-.39.68l-.01 6.71zm1.1-2.37 2.6-1.5 2.6 1.5v2.99l-2.6 1.5-2.6-1.5V10.5z"/>
        </svg>
      </span>
    )
  }

  if (provider === 'ByteDance') {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#FE2C55] to-[#FF6B35] ${dim}`}>
        <svg viewBox="0 0 24 24" className={svgDim} fill="white">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.28 8.28 0 0 0 4.84 1.55V6.78a4.85 4.85 0 0 1-1.07-.09z"/>
        </svg>
      </span>
    )
  }

  if (provider === 'Kling AI') {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-lg bg-[#1A1A2E] ${dim}`}>
        <svg viewBox="0 0 24 24" className={svgDim} fill="white">
          <path d="M4 4h4v7.5l6.5-7.5H19l-7 8 7.5 8H14l-6-7V20H4V4z"/>
        </svg>
      </span>
    )
  }

  if (provider === 'Alibaba Tongyi') {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-lg bg-[#FF6A00] ${dim}`}>
        <svg viewBox="0 0 24 24" className={svgDim} fill="white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          <path d="M8 10.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v3c0 .83-.67 1.5-1.5 1.5S8 14.33 8 13.5v-3zm5 0c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v3c0 .83-.67 1.5-1.5 1.5S13 14.33 13 13.5v-3z"/>
        </svg>
      </span>
    )
  }

  // fallback
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg bg-gray-200 text-[10px] font-bold text-gray-600 ${dim}`}>
      {provider[0]}
    </span>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VideoStatus }) {
  const map: Record<VideoStatus, { label: string; className: string }> = {
    pending:    { label: 'Đang chờ',    className: 'bg-gray-200 text-gray-500' },
    processing: { label: 'Đang tạo',   className: 'bg-indigo-500/20 text-indigo-400' },
    completed:  { label: 'Hoàn thành', className: 'bg-emerald-500/20 text-emerald-400' },
    failed:     { label: 'Thất bại',   className: 'bg-red-500/20 text-red-400' },
  }
  const { label, className } = map[status]
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {status === 'processing' && <Loader2 className="mr-1 inline h-2.5 w-2.5 animate-spin" />}
      {label}
    </span>
  )
}

function ImageThumbnail({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-black/10">
      <img src={url} alt="" className="h-full w-full object-cover" />
      <button
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BRollVideos() {
  const [slots, setSlots] = useState<SlotState[]>(() =>
    Array.from({ length: SLOTS }, createSlot),
  )
  const [activeSlot, setActiveSlot] = useState(0)
  const [history, setHistory] = useState<VideoHistoryItem[]>([])
  const [previewItem, setPreviewItem] = useState<VideoHistoryItem | null>(null)
  const [activeRightTab, setActiveRightTab] = useState<'history' | 'preview'>('history')
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [generatingSlots, setGeneratingSlots] = useState<Record<number, boolean>>({})

  // Picker: 'startFrame' | 'endFrame' | 'reference' | null
  const [pickerMode, setPickerMode] = useState<'startFrame' | 'endFrame' | 'reference' | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<'startFrame' | 'endFrame' | 'reference'>('startFrame')

  const addToast = useAppStore((s) => s.addToast)
  const addBRoll = useBankStore((s) => s.addBRoll)

  const currentSlot = slots[activeSlot]

  const updateSlot = useCallback((index: number, updates: Partial<SlotState>) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)))
  }, [])

  // ── File upload ──────────────────────────────────────────────────────────

  const triggerUpload = (target: 'startFrame' | 'endFrame' | 'reference') => {
    uploadTargetRef.current = target
    if (fileInputRef.current) {
      fileInputRef.current.multiple = target === 'reference'
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const target = uploadTargetRef.current

    const readFile = (file: File): Promise<string> =>
      new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target?.result as string)
        reader.readAsDataURL(file)
      })

    Promise.all(files.map(readFile)).then((dataUrls) => {
      if (target === 'startFrame') {
        updateSlot(activeSlot, { startFrameUrl: dataUrls[0] })
      } else if (target === 'endFrame') {
        updateSlot(activeSlot, { endFrameUrl: dataUrls[0] })
      } else {
        setSlots((prev) =>
          prev.map((s, i) => {
            if (i !== activeSlot) return s
            const remaining = 3 - s.referenceImageUrls.length
            return { ...s, referenceImageUrls: [...s.referenceImageUrls, ...dataUrls.slice(0, remaining)] }
          }),
        )
      }
    })
    e.target.value = ''
  }

  // ── Bank picker ──────────────────────────────────────────────────────────

  const handleBankSelect = async (item: unknown) => {
    const broll = item as BRoll
    let url = broll.imageUrl
    if (url.startsWith('asset-')) {
      const resolved = await getUrl(url)
      if (resolved) url = resolved
    }
    if (pickerMode === 'startFrame') {
      updateSlot(activeSlot, { startFrameUrl: url })
    } else if (pickerMode === 'endFrame') {
      updateSlot(activeSlot, { endFrameUrl: url })
    } else if (pickerMode === 'reference') {
      setSlots((prev) =>
        prev.map((s, i) => {
          if (i !== activeSlot || s.referenceImageUrls.length >= 3) return s
          return { ...s, referenceImageUrls: [...s.referenceImageUrls, url] }
        }),
      )
    }
    setPickerMode(null)
  }

  // ── Generate ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    const slot = slots[activeSlot]
    if (!slot.prompt.trim()) {
      addToast('Vui lòng nhập nội dung prompt', 'error')
      return
    }
    const apiKey = useSettingsStore.getState().kieApiKey
    if (!apiKey) {
      addToast('Vui lòng nhập kie.ai API key trong Cài đặt', 'error')
      return
    }

    const modelConfig = VIDEO_MODELS.find((m) => m.id === slot.modelId)!
    const historyId = crypto.randomUUID()
    const newItem: VideoHistoryItem = {
      id: historyId,
      taskId: '',
      modelId: slot.modelId,
      modelName: modelConfig.name,
      prompt: slot.prompt,
      videoUrl: null,
      aspectRatio: slot.aspectRatio,
      status: 'pending',
      createdAt: Date.now(),
    }

    setHistory((prev) => [newItem, ...prev])
    setGeneratingSlots((prev) => ({ ...prev, [activeSlot]: true }))
    setActiveRightTab('history')

    try {
      const params = {
        apiKey,
        model: slot.modelId,
        prompt: slot.prompt,
        aspectRatio: slot.aspectRatio,
        resolution: slot.resolution,
        ...(slot.startFrameUrl && slot.endFrameUrl
          ? { startFrameUrl: slot.startFrameUrl, endFrameUrl: slot.endFrameUrl }
          : {}),
        ...(slot.referenceImageUrls.length > 0 ? { referenceImageUrls: slot.referenceImageUrls } : {}),
      }

      const { taskId } = await generateVideo(params)
      setHistory((prev) =>
        prev.map((h) => (h.id === historyId ? { ...h, taskId, status: 'processing' } : h)),
      )

      const videoUrl = await pollVideoUntilDone({
        apiKey,
        taskId,
        onStatusChange: (status) => {
          setHistory((prev) => prev.map((h) => (h.id === historyId ? { ...h, status } : h)))
        },
      })

      const completed: VideoHistoryItem = { ...newItem, taskId, videoUrl, status: 'completed' }
      setHistory((prev) => prev.map((h) => (h.id === historyId ? completed : h)))
      setPreviewItem(completed)
      setActiveRightTab('preview')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      let toastMsg = `Tạo video thất bại: ${msg}`
      if (msg === 'INSUFFICIENT_CREDITS') toastMsg = 'Không đủ Credit'
      if (msg === 'TIMEOUT') toastMsg = 'Tạo video quá thời gian. Vui lòng thử lại.'

      addToast(toastMsg, 'error')
      setHistory((prev) =>
        prev.map((h) => (h.id === historyId ? { ...h, status: 'failed', errorMessage: msg } : h)),
      )
    } finally {
      setGeneratingSlots((prev) => ({ ...prev, [activeSlot]: false }))
    }
  }

  const handleSaveToBank = (item: VideoHistoryItem) => {
    if (!item.videoUrl) return
    addBRoll({ imageUrl: '', prompt: item.prompt, videoUrl: item.videoUrl })
    addToast('Đã lưu vào PROJECT B-Roll')
  }

  const handleDownload = (item: VideoHistoryItem) => {
    if (!item.videoUrl) return
    const a = document.createElement('a')
    a.href = item.videoUrl
    a.download = `video-${Date.now()}.mp4`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const isGenerating = generatingSlots[activeSlot] ?? false
  const selectedModel = VIDEO_MODELS.find((m) => m.id === currentSlot.modelId) ?? VIDEO_MODELS[0]

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Left panel ── */}
      <div className="flex w-full shrink-0 flex-col border-b border-black/8 lg:w-1/3 lg:border-b-0 lg:border-r">
        {/* Slot tabs */}
        <div className="flex items-center gap-1 border-b border-black/10 px-4">
          {Array.from({ length: SLOTS }, (_, i) => (
            <button
              key={i}
              onClick={() => setActiveSlot(i)}
              className={`-mb-[1px] flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm transition-colors ${
                activeSlot === i
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${activeSlot === i ? 'bg-gray-900' : 'bg-gray-400'}`} />
              Slot {i + 1}
            </button>
          ))}
        </div>

        {/* Form scroll area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">

            {/* Model selector */}
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-gray-400">Model</p>
              <button
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-3 transition-colors hover:bg-black/[0.04]"
              >
                <ProviderIcon provider={selectedModel.provider} size="md" />
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800">{selectedModel.name}</span>
                    {selectedModel.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                  </div>
                  <span className="text-[11px] text-gray-400">{selectedModel.provider} · {selectedModel.credits} Credit</span>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {modelDropdownOpen && (
                <div className="mt-1 overflow-hidden rounded-xl border border-black/10 bg-white">
                  {VIDEO_MODELS.map((m) => {
                    const isActive = currentSlot.modelId === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => { updateSlot(activeSlot, { modelId: m.id }); setModelDropdownOpen(false) }}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 transition-colors hover:bg-black/5 ${isActive ? 'bg-indigo-500/10' : ''}`}
                      >
                        <ProviderIcon provider={m.provider} size="sm" />
                        <div className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-1">
                            <span className={`text-xs font-medium ${isActive ? 'text-indigo-300' : 'text-gray-700'}`}>{m.name}</span>
                            {m.starred && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />}
                          </div>
                          <span className="text-[10px] text-gray-400">{m.provider}</span>
                        </div>
                        <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{m.credits} Credit</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Start / End frames */}
            <div className="grid grid-cols-2 gap-3">
              {/* KHUNG ĐẦU */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400">
                  KHUNG ĐẦU{' '}
                  <span className="normal-case tracking-normal text-gray-300">— tùy chọn</span>
                </span>
                {currentSlot.startFrameUrl ? (
                  <div className="group relative h-20 w-full overflow-hidden rounded-lg border border-black/10">
                    <img src={currentSlot.startFrameUrl} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => updateSlot(activeSlot, { startFrameUrl: null })}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => triggerUpload('startFrame')}
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-black/12 bg-black/[0.02] py-5 text-gray-500 transition-colors hover:border-white/25 hover:bg-black/[0.04] hover:text-gray-700"
                    >
                      <Upload className="h-4 w-4" />
                      <span className="text-[11px]">Tải ảnh lên</span>
                    </button>
                    <button
                      onClick={() => setPickerMode('startFrame')}
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-black/12 bg-black/[0.02] py-5 text-gray-500 transition-colors hover:border-white/25 hover:bg-black/[0.04] hover:text-gray-700"
                    >
                      <Database className="h-4 w-4" />
                      <span className="text-[11px]">Chọn từ Project</span>
                    </button>
                  </div>
                )}
              </div>

              {/* KHUNG CUỐI */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400">
                  KHUNG CUỐI{' '}
                  <span className="normal-case tracking-normal text-gray-300">— tùy chọn</span>
                </span>
                {currentSlot.endFrameUrl ? (
                  <div className="group relative h-20 w-full overflow-hidden rounded-lg border border-black/10">
                    <img src={currentSlot.endFrameUrl} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => updateSlot(activeSlot, { endFrameUrl: null })}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => triggerUpload('endFrame')}
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-black/12 bg-black/[0.02] py-5 text-gray-500 transition-colors hover:border-white/25 hover:bg-black/[0.04] hover:text-gray-700"
                    >
                      <Upload className="h-4 w-4" />
                      <span className="text-[11px]">Tải ảnh lên</span>
                    </button>
                    <button
                      onClick={() => setPickerMode('endFrame')}
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-black/12 bg-black/[0.02] py-5 text-gray-500 transition-colors hover:border-white/25 hover:bg-black/[0.04] hover:text-gray-700"
                    >
                      <Database className="h-4 w-4" />
                      <span className="text-[11px]">Chọn từ Project</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Reference images */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400">
                ẢNH THAM CHIẾU ({currentSlot.referenceImageUrls.length}/3){' '}
                <span className="normal-case tracking-normal text-gray-300">— tùy chọn</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {currentSlot.referenceImageUrls.map((url, idx) => (
                  <ImageThumbnail
                    key={idx}
                    url={url}
                    onRemove={() =>
                      updateSlot(activeSlot, {
                        referenceImageUrls: currentSlot.referenceImageUrls.filter((_, i) => i !== idx),
                      })
                    }
                  />
                ))}
                {currentSlot.referenceImageUrls.length < 3 && (
                  <button
                    onClick={() => triggerUpload('reference')}
                    className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-black/12 bg-black/[0.02] text-gray-400 transition-colors hover:border-white/25 hover:text-gray-600"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-gray-400">Prompt</p>
              <textarea
                value={currentSlot.prompt}
                onChange={(e) => updateSlot(activeSlot, { prompt: e.target.value })}
                rows={4}
                placeholder="Mô tả video bạn muốn tạo..."
                className="w-full resize-none rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-zinc-700 outline-none transition-colors focus:border-black/15"
              />
            </div>

            {/* Aspect ratio & Resolution */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-gray-400">Tỷ lệ</p>
                <div className="flex gap-1">
                  {(['16:9', '9:16'] as AspectRatio[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => updateSlot(activeSlot, { aspectRatio: r })}
                      className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                        currentSlot.aspectRatio === r
                          ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                          : 'border-black/10 text-gray-500 hover:border-black/15 hover:text-gray-700'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-gray-400">Độ phân giải</p>
                <div className="flex gap-1">
                  {(['720p', '1080p', '4k'] as Resolution[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => updateSlot(activeSlot, { resolution: r })}
                      className={`flex-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
                        currentSlot.resolution === r
                          ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                          : 'border-black/10 text-gray-500 hover:border-black/15 hover:text-gray-700'
                      }`}
                    >
                      {r === '4k' ? '4K' : r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Generate button */}
        <div className="border-t border-black/8 p-4">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !currentSlot.prompt.trim()}
            className="w-full rounded-xl bg-purple-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex items-center justify-center gap-2">
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tạo video...
                </>
              ) : (
                <>
                  <Film className="h-4 w-4" />
                  Tạo video ({selectedModel.credits} Credit)
                </>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tab header */}
        <div className="flex border-b border-black/8">
          {(['history', 'preview'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveRightTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeRightTab === tab
                  ? 'border-b-2 border-violet-500 text-gray-800'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'history' ? 'Lịch sử' : 'Xem trước'}
            </button>
          ))}
        </div>

        {/* History tab */}
        {activeRightTab === 'history' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {history.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
                <Film className="h-12 w-12 text-gray-200" strokeWidth={1.5} />
                <p className="text-sm font-medium text-gray-400">Chưa có video nào</p>
                <p className="text-center text-xs text-gray-300">Mỗi video bạn tạo sẽ xuất hiện ở đây</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4">
                {/* Warning banner */}
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5">
                  <span className="mt-0.5 shrink-0 text-amber-400">⚠</span>
                  <p className="text-[11px] leading-relaxed text-amber-400/80">
                    Lưu ý: kie.ai lưu media trong 14 ngày. Hãy tải xuống hoặc lưu vào PROJECT.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-black/8 bg-black/[0.02] p-3"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700">{item.modelName}</span>
                            <StatusBadge status={item.status} />
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-gray-400">
                            {item.prompt}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] tabular-nums text-gray-300">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Video thumbnail / player link */}
                      {item.videoUrl && (
                        <button
                          onClick={() => { setPreviewItem(item); setActiveRightTab('preview') }}
                          className="mt-2.5 flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-black/8 bg-black/40 transition-colors hover:border-black/10"
                        >
                          <video
                            src={item.videoUrl}
                            className="h-full w-full object-contain"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        </button>
                      )}

                      {/* Controls */}
                      <div className="mt-2.5 flex items-center gap-1.5">
                        {item.videoUrl && (
                          <>
                            <button
                              onClick={() => handleDownload(item)}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 text-gray-600 transition-colors hover:bg-black/8 hover:text-gray-800"
                              title="Tải xuống"
                            >
                              <Download className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleSaveToBank(item)}
                              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
                            >
                              <Save className="h-3 w-3" />
                              Lưu vào PROJECT
                            </button>
                          </>
                        )}
                        <div className="flex-1" />
                        <button
                          onClick={() => setHistory((prev) => prev.filter((h) => h.id !== item.id))}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title="Xóa"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview tab */}
        {activeRightTab === 'preview' && (
          <div className="flex flex-1 items-center justify-center overflow-hidden bg-black p-4">
            {previewItem?.videoUrl ? (
              <video
                key={previewItem.id}
                src={previewItem.videoUrl}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-lg"
                style={{ aspectRatio: previewItem.aspectRatio.replace(':', '/') }}
              />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Film className="h-12 w-12 text-gray-200" strokeWidth={1.5} />
                <p className="text-sm text-gray-400">Chưa có video để xem trước</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bank picker for images */}
      <BankPicker
        bankType="brolls"
        isOpen={pickerMode !== null}
        onSelect={handleBankSelect}
        onClose={() => setPickerMode(null)}
      />
    </div>
  )
}
