import { useState, useEffect, useRef } from 'react'
import {
  Film, Download, Loader2, CheckCircle2,
  AlertTriangle, ChevronRight, Trash2,
  Mic, Sparkles, FileText, User, Package,
  Check, ChevronDown, ChevronUp, Upload, X,
  RotateCcw, SkipForward, DollarSign,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import { getUrl, isAssetRef, saveAsset } from '../../utils/assetStore'
import { directGeminiVision } from '../../utils/gemini'
import { listVoices, textToSpeech } from '../../utils/elevenlabs'
import { generateLipSync, pollLipSyncUntilDone, generateVideoJob, getVideoJobStatus } from '../../utils/kieai'
import { removeVideoBackground } from '../../utils/falai'
import { buildUGCVideo, pollRenderUntilDone } from '../../utils/shotstack'
import type { ElevenLabsVoice } from '../../utils/elevenlabs'
import type { ScriptSegment, VideoBuilderJob } from './types'
import type { Script, Model, Product } from '../../stores/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAudioDuration(buffer: ArrayBuffer): Promise<number> {
  return new Promise((resolve) => {
    try {
      const ctx = new AudioContext()
      ctx.decodeAudioData(buffer.slice(0), (decoded) => {
        resolve(decoded.duration)
        ctx.close()
      }, () => resolve(60))
    } catch { resolve(60) }
  })
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Resolve any image ref (asset://, blob:, or direct URL) to a public URL */
async function resolveImageUrl(ref: string): Promise<string | null> {
  if (!ref) return null
  if (isAssetRef(ref)) return getUrl(ref)
  if (ref.startsWith('blob:')) {
    try {
      const resp = await fetch(ref)
      if (!resp.ok) throw new Error(`fetch blob failed: ${resp.status}`)
      const blob = await resp.blob()
      const mimeType = blob.type || 'image/jpeg'
      const assetId = await saveAsset(blob, mimeType)
      const url = await getUrl(assetId)
      if (!url) throw new Error('getUrl trả về null sau khi upload')
      return url
    } catch (err) {
      console.error('[resolveImageUrl] blob upload failed:', err)
      return null
    }
  }
  return ref
}

/** Robust JSON extractor — handles markdown fences and surrounding text */
function extractJson(raw: string): string {
  let s = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim()
  const start = s.indexOf('{')
  const end   = s.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1)
  return s
}

/**
 * Client-side script splitter — fallback when Gemini fails.
 * Splits script into 4-8 second segments based on sentence boundaries.
 * Works with any language (Malay, Vietnamese, English, etc.).
 */
function splitScriptClientSide(script: string): { segments: ScriptSegment[]; totalEstimatedSec: number } {
  const sentences = script
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const TARGET_CHARS = 90  // ~5-7 sec at conversational pace
  const buckets: string[] = []
  let buffer = ''

  for (const sentence of sentences) {
    const combined = buffer ? `${buffer} ${sentence}` : sentence
    if (combined.length >= TARGET_CHARS && buffer) {
      buckets.push(buffer)
      buffer = sentence
    } else {
      buffer = combined
    }
  }
  if (buffer.trim()) buckets.push(buffer)

  // Edge case: very short script with no punctuation
  if (buckets.length === 0 && script.trim()) buckets.push(script.trim())

  let cursor = 0
  const segments: ScriptSegment[] = buckets.map((text, index) => {
    const dur = Math.max(3, text.length / 14)  // ~14 chars/sec
    const seg: ScriptSegment = {
      index,
      text,
      durationSec: dur,
      startSec: cursor,
      brollPrompt: `Cinematic vertical 9:16 lifestyle scene related to: ${text.slice(0, 80)}. No people, no text overlay, professional UGC ad style, soft natural lighting.`,
      avatarPosition: index % 2 === 0 ? 'right' : 'left',
      useProduct: false,
    }
    cursor += dur
    return seg
  })

  return { segments, totalEstimatedSec: cursor }
}

// ── Avatar card — resolves asset:// URLs ──────────────────────────────────────

function AvatarCard({ model, selected, onSelect }: {
  model: Model
  selected: boolean
  onSelect: () => void
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!model.characterImage) { setImgSrc(null); return }
    if (isAssetRef(model.characterImage)) {
      getUrl(model.characterImage).then((url) => setImgSrc(url ?? null))
    } else {
      setImgSrc(model.characterImage)
    }
  }, [model.characterImage])

  return (
    <button
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-2.5 transition-all ${
        selected
          ? 'border-violet-400 bg-violet-50 shadow-md shadow-violet-100'
          : 'border-black/8 bg-white hover:border-violet-200 hover:bg-violet-50/40'
      }`}
    >
      {imgSrc ? (
        <img src={imgSrc} alt={model.name} className="h-16 w-16 rounded-lg object-cover border border-black/8" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100">
          <User className="h-7 w-7 text-gray-300" />
        </div>
      )}
      <p className="w-full truncate text-center text-xs font-semibold text-gray-700">{model.name || 'Avatar AI'}</p>
      {selected && (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 shadow">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
    </button>
  )
}

// ── Product card — resolves asset:// URLs ─────────────────────────────────────

function ProductCard({ product, selected, onToggle }: {
  product: Product
  selected: boolean
  onToggle: () => void
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!product.productImage) { setImgSrc(null); return }
    if (isAssetRef(product.productImage)) {
      getUrl(product.productImage).then((url) => setImgSrc(url ?? null))
    } else {
      setImgSrc(product.productImage)
    }
  }, [product.productImage])

  return (
    <button
      onClick={onToggle}
      className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-all ${
        selected ? 'border-violet-400 bg-violet-50' : 'border-black/8 bg-white hover:border-violet-200'
      }`}
    >
      {imgSrc ? (
        <img src={imgSrc} alt={product.productName} className="h-14 w-14 rounded-lg object-cover border border-black/8" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100">
          <Package className="h-5 w-5 text-gray-300" />
        </div>
      )}
      <p className="w-full truncate text-center text-xs font-medium text-gray-600">{product.productName}</p>
      {selected && (
        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500">
          <Check className="h-2.5 w-2.5 text-white" />
        </div>
      )}
    </button>
  )
}

// ── Script picker dropdown ────────────────────────────────────────────────────

function ScriptPicker({ scripts, selectedId, onSelect }: {
  scripts: Script[]
  selectedId: string
  onSelect: (id: string, text: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const selected = scripts.find((s) => s.id === selectedId)

  if (scripts.length === 0) return null

  return (
    <div className="relative mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
          selected ? 'border-violet-200 bg-violet-50/60' : 'border-black/10 bg-white hover:bg-black/[0.02]'
        }`}
      >
        <FileText className={`h-4 w-4 shrink-0 ${selected ? 'text-violet-500' : 'text-gray-300'}`} />
        <div className="flex-1 min-w-0">
          {selected ? (
            <p className="text-sm font-semibold text-violet-800 truncate">{selected.title || 'Kịch bản không có tiêu đề'}</p>
          ) : (
            <p className="text-sm text-gray-400">Chọn từ Project kịch bản...</p>
          )}
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        }
      </button>

      {expanded && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-black/10 bg-white shadow-xl max-h-56 overflow-y-auto">
          {scripts.map((s) => (
            <button
              key={s.id}
              onClick={() => { onSelect(s.id, s.scriptText); setExpanded(false) }}
              className={`flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors hover:bg-violet-50 ${
                s.id === selectedId ? 'bg-violet-50' : ''
              }`}
            >
              <div className="mt-0.5 h-3.5 w-3.5 shrink-0">
                {s.id === selectedId && <Check className="h-3.5 w-3.5 text-violet-500" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{s.title || 'Không có tiêu đề'}</p>
                <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{s.scriptText.slice(0, 100)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── History card ──────────────────────────────────────────────────────────────

function HistoryCard({ job, onDelete }: { job: VideoBuilderJob; onDelete: () => void }) {
  const handleDownload = () => {
    if (!job.videoUrl) return
    const a = document.createElement('a')
    a.href = job.videoUrl
    a.download = `ugc-video-${Date.now()}.mp4`
    a.target = '_blank'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm">
      {job.status === 'done' && job.videoUrl && (
        <div className="bg-black">
          <video src={job.videoUrl} controls playsInline className="max-h-64 w-full object-contain" />
        </div>
      )}
      {job.status === 'failed' && (
        <div className="flex items-start gap-2 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-xs text-red-600">{job.errorMessage?.slice(0, 200) ?? 'Build thất bại'}</p>
        </div>
      )}
      <div className="p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-gray-700">{job.name}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            job.status === 'done'   ? 'bg-emerald-100 text-emerald-700' :
            job.status === 'failed' ? 'bg-red-100 text-red-600' :
            'bg-violet-100 text-violet-600'
          }`}>
            {job.status === 'done' ? 'Hoàn thành' : job.status === 'failed' ? 'Thất bại' : 'Đang xử lý'}
          </span>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          {job.voiceName} · {job.totalDuration ? formatDuration(job.totalDuration) : '--'} · {new Date(job.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <div className="flex items-center gap-1.5">
          {job.status === 'done' && job.videoUrl && (
            <button onClick={handleDownload} className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100">
              <Download className="h-3.5 w-3.5" /> Tải xuống
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Manual product type ───────────────────────────────────────────────────────

interface ManualProduct {
  id: string
  name: string
  blobUrl: string
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </label>
  )
}

// ── Upload button ─────────────────────────────────────────────────────────────

function UploadBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-black/12 bg-black/[0.01] py-2.5 text-xs font-medium text-gray-500 transition-colors hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-600"
    >
      <Upload className="h-3.5 w-3.5" />
      {children}
    </button>
  )
}

// ── Pipeline phase + data ─────────────────────────────────────────────────────

type PipelinePhase =
  | 'idle'
  | 'running-parse'    | 'review-parse'
  | 'running-voice'    | 'review-voice'
  | 'running-resolve'
  | 'running-avatar'   | 'review-avatar'
  | 'running-broll'    | 'review-broll'
  | 'running-bg'       | 'review-bg'
  | 'running-assemble'
  | 'done'
  | 'failed'

interface PipeData {
  jobId: string
  jobName: string
  voiceName: string
  segments: ScriptSegment[]
  totalEstimatedSec: number
  timedSegments: ScriptSegment[]
  audioDuration: number
  audioBlob: Blob
  voiceUrl: string
  avatarImageUrl: string
  productImageUrls: string[]
  avatarRawUrl: string
  brollResults: (string | null)[]
  avatarFinalUrl: string
  finalVideoUrl: string
  finalAssetId: string
}

// Step labels for the running/review panel header
const STEP_INFO: Record<string, { num: number; label: string; subLabel: string; cost: string }> = {
  parse:    { num: 1, label: 'Phân tích kịch bản',  subLabel: 'Chia script thành đoạn + B-roll prompts', cost: 'Miễn phí' },
  voice:    { num: 2, label: 'Voiceover',           subLabel: 'TTS toàn bộ script → audio file',         cost: '~$0.30' },
  resolve:  { num: 3, label: 'Chuẩn bị tài nguyên', subLabel: 'Resolve URL ảnh',                          cost: 'Miễn phí' },
  avatar:   { num: 4, label: 'Avatar Lip-sync',     subLabel: 'Kling Avatar: ảnh + audio → video nói',    cost: '~$3.00' },
  broll:    { num: 5, label: 'B-roll Clips',        subLabel: 'Gen video minh họa cho mỗi đoạn',          cost: '~$0.38' },
  bg:       { num: 6, label: 'Xóa nền Avatar',      subLabel: 'Tách nền để overlay trong suốt',           cost: '~$0.50' },
  assemble: { num: 7, label: 'Ghép video',          subLabel: 'Layer B-roll + avatar + captions',         cost: '~$0.50' },
}

function getStepFromPhase(phase: PipelinePhase): string | null {
  if (phase === 'idle' || phase === 'done' || phase === 'failed') return null
  const m = phase.match(/(?:running|review)-(\w+)/)
  return m ? m[1] : null
}

// ── Phase progress header ─────────────────────────────────────────────────────

function PhaseHeader({ phase }: { phase: PipelinePhase }) {
  const step = getStepFromPhase(phase)
  if (!step) return null
  const info = STEP_INFO[step]
  if (!info) return null
  const isReview = phase.startsWith('review-')

  return (
    <div className="mb-3 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50/80 to-purple-50/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-md ${
          isReview ? 'bg-emerald-500' : 'bg-violet-500'
        }`}>
          {info.num}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-800 truncate">
              {isReview ? `✓ ${info.label}` : info.label}
            </p>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
              Bước {info.num}/7 · {info.cost}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 truncate">{info.subLabel}</p>
        </div>
      </div>
    </div>
  )
}

// ── Running panel (spinner during a step) ─────────────────────────────────────

function RunningPanel({ phase, detail }: { phase: PipelinePhase; detail: string }) {
  const step = getStepFromPhase(phase)
  const label = step && STEP_INFO[step] ? `Đang ${STEP_INFO[step].label.toLowerCase()}...` : 'Đang xử lý...'

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-violet-100" />
        <Loader2 className="absolute inset-0 m-auto h-16 w-16 animate-spin text-violet-500" />
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-gray-700">{label}</p>
        {detail && <p className="mt-1 text-xs text-gray-400">{detail}</p>}
      </div>
      <p className="text-[11px] text-gray-300">Vui lòng giữ tab mở</p>
    </div>
  )
}

// ── Review card (wraps each step's review UI) ─────────────────────────────────

function ReviewCard({
  onRetry, onContinue, onSkip,
  retryLabel = 'Tạo lại',
  continueLabel = 'Tiếp tục',
  continueCost,
  skipLabel,
  children,
  disabled = false,
}: {
  onRetry: () => void
  onContinue: () => void
  onSkip?: () => void
  retryLabel?: string
  continueLabel?: string
  continueCost?: string
  skipLabel?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm">
      <div className="p-4">{children}</div>

      <div className="flex flex-wrap items-center gap-2 border-t border-black/6 bg-gray-50/60 px-4 py-3">
        <button
          onClick={onRetry}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {retryLabel}
        </button>

        {onSkip && skipLabel && (
          <button
            onClick={onSkip}
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-40"
          >
            <SkipForward className="h-3.5 w-3.5" />
            {skipLabel}
          </button>
        )}

        <div className="flex-1" />

        {continueCost && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-400">
            <DollarSign className="h-3 w-3" />
            {continueCost}
          </span>
        )}

        <button
          onClick={onContinue}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-200 transition-all hover:shadow-violet-300 disabled:opacity-40"
        >
          {continueLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VideoBuilder() {
  const { kieApiKey, elevenLabsApiKey, falApiKey, shotstackApiKey, geminiApiKey } = useSettingsStore()
  const addToast = useAppStore((s) => s.addToast)
  const { scripts, models, products } = useBankStore()

  // ── Input state ──────────────────────────────────────────────────────────
  const [selectedScriptId, setSelectedScriptId] = useState('')
  const [script, setScript] = useState('')
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedVoiceId, setSelectedVoiceId] = useState('')
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([])
  const [loadingVoices, setLoadingVoices] = useState(false)

  // ── Manual upload state ──────────────────────────────────────────────────
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const productFileRef = useRef<HTMLInputElement>(null)
  const [manualAvatarUrl, setManualAvatarUrl] = useState<string | null>(null)
  const [manualAvatarName, setManualAvatarName] = useState('')
  const [manualProducts, setManualProducts] = useState<ManualProduct[]>([])

  // ── Pipeline state ───────────────────────────────────────────────────────
  const [phase, setPhase] = useState<PipelinePhase>('idle')
  const [phaseDetail, setPhaseDetail] = useState('')
  const [phaseError, setPhaseError] = useState<string | null>(null)
  const pipeRef = useRef<Partial<PipeData>>({})

  // Preview states (for review UI)
  const [previewSegments, setPreviewSegments] = useState<ScriptSegment[]>([])
  const [previewVoiceUrl, setPreviewVoiceUrl] = useState<string | null>(null)
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null)
  const [previewBrollUrls, setPreviewBrollUrls] = useState<(string | null)[]>([])
  const [previewBgUrl, setPreviewBgUrl] = useState<string | null>(null)

  // History
  const [history, setHistory] = useState<VideoBuilderJob[]>([])

  // Load voices
  useEffect(() => {
    if (!elevenLabsApiKey) return
    setLoadingVoices(true)
    listVoices(elevenLabsApiKey)
      .then((v) => { setVoices(v); if (!selectedVoiceId && v.length > 0) setSelectedVoiceId(v[0].voice_id) })
      .catch(() => {})
      .finally(() => setLoadingVoices(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevenLabsApiKey])

  // Cleanup blob URLs on unmount
  useEffect(() => () => {
    if (previewVoiceUrl?.startsWith('blob:')) URL.revokeObjectURL(previewVoiceUrl)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Input handlers ───────────────────────────────────────────────────────

  const handleSelectScript = (id: string, text: string) => {
    setSelectedScriptId(id)
    setScript(text)
  }

  const handleToggleProduct = (id: string) => {
    setSelectedProductId((prev) => prev === id ? '' : id)
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setManualAvatarUrl(URL.createObjectURL(file))
    setManualAvatarName(file.name.replace(/\.[^.]+$/, ''))
    setSelectedModelId('')
    e.target.value = ''
  }

  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (manualProducts.length + files.length > 8) {
      addToast('Tối đa 8 ảnh đính kèm sản phẩm', 'error'); return
    }
    setManualProducts((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ''),
        blobUrl: URL.createObjectURL(file),
      })),
    ])
    e.target.value = ''
  }

  // ── Reset pipeline ───────────────────────────────────────────────────────

  const handleReset = () => {
    if (previewVoiceUrl?.startsWith('blob:')) URL.revokeObjectURL(previewVoiceUrl)
    pipeRef.current = {}
    setPhase('idle')
    setPhaseDetail('')
    setPhaseError(null)
    setPreviewSegments([])
    setPreviewVoiceUrl(null)
    setPreviewAvatarUrl(null)
    setPreviewBrollUrls([])
    setPreviewBgUrl(null)
  }

  // ── Step 1: Parse script ─────────────────────────────────────────────────

  const runParse = async () => {
    setPhase('running-parse')
    setPhaseError(null)
    setPhaseDetail('Đang gọi Gemini...')

    // Initialize job metadata on first run
    if (!pipeRef.current.jobId) {
      const voiceName = voices.find((v) => v.voice_id === selectedVoiceId)?.name ?? selectedVoiceId
      const jobName = (scripts.find((s) => s.id === selectedScriptId)?.title || script.slice(0, 40)).trim()
      pipeRef.current.jobId = crypto.randomUUID()
      pipeRef.current.jobName = jobName
      pipeRef.current.voiceName = voiceName
    }

    const parsePrompt = `Split this UGC video script into 6-10 segments (4-8 seconds each).

Rules:
- Split at natural sentence/pause boundaries
- durationSec: estimate from ~130 words/min reading speed
- startSec: always 0.0 (recalculated later)
- avatarPosition: alternate "left" and "right" each segment
- useProduct: true if segment mentions a product by name
- brollPrompt: vivid cinematic English description, no people, no text overlay, vertical 9:16

SCRIPT:
${script}`

    const parseSchema: Record<string, unknown> = {
      type: 'object',
      properties: {
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index:          { type: 'integer' },
              text:           { type: 'string' },
              durationSec:    { type: 'number' },
              startSec:       { type: 'number' },
              brollPrompt:    { type: 'string' },
              avatarPosition: { type: 'string', enum: ['left', 'right'] },
              useProduct:     { type: 'boolean' },
            },
            required: ['index', 'text', 'durationSec', 'startSec', 'brollPrompt', 'avatarPosition', 'useProduct'],
          },
        },
        totalEstimatedSec: { type: 'number' },
      },
      required: ['segments', 'totalEstimatedSec'],
    }

    type ParseResult = { segments: ScriptSegment[]; totalEstimatedSec: number }
    let parsed: ParseResult | null = null
    let usedFallback = false

    // Attempt 1: Gemini with schema
    if (geminiApiKey) {
      try {
        const raw = await directGeminiVision({
          apiKey: geminiApiKey,
          parts: [{ text: parsePrompt }],
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: parseSchema,
        })
        parsed = JSON.parse(extractJson(raw)) as ParseResult
      } catch (e1) {
        console.warn('[parse] Gemini attempt 1 failed:', e1)
        setPhaseDetail('Thử lại Gemini...')

        // Attempt 2: Gemini without schema
        try {
          const raw = await directGeminiVision({
            apiKey: geminiApiKey,
            parts: [{ text: parsePrompt }],
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          })
          parsed = JSON.parse(extractJson(raw)) as ParseResult
        } catch (e2) {
          console.warn('[parse] Gemini attempt 2 failed:', e2)
        }
      }
    }

    // Fallback: client-side split (never fails)
    if (!parsed?.segments?.length) {
      setPhaseDetail('Gemini không phản hồi — dùng phân tích offline...')
      parsed = splitScriptClientSide(script)
      usedFallback = true
    }

    if (!parsed?.segments?.length) {
      setPhaseError('Không tạo được segments — script có thể quá ngắn')
      setPhase('failed')
      return
    }

    pipeRef.current.segments = parsed.segments
    pipeRef.current.totalEstimatedSec = parsed.totalEstimatedSec
    setPreviewSegments([...parsed.segments])

    if (usedFallback) {
      addToast('Đã dùng phân tích offline (Gemini không phản hồi). Bạn có thể chỉnh sửa segments.', 'error')
    }

    setPhase('review-parse')
  }

  // Update a single segment's text in the review UI
  const handleEditSegmentText = (index: number, newText: string) => {
    setPreviewSegments((prev) => prev.map((s, i) => i === index ? { ...s, text: newText } : s))
  }

  // ── Step 2: Generate voiceover ───────────────────────────────────────────

  const runVoice = async () => {
    // Persist any edits the user made to segments
    pipeRef.current.segments = [...previewSegments]

    if (!elevenLabsApiKey) { setPhaseError('Cần ElevenLabs API key'); setPhase('failed'); return }

    setPhase('running-voice')
    setPhaseError(null)
    setPhaseDetail('')

    try {
      const audioBuffer = await textToSpeech({
        apiKey: elevenLabsApiKey,
        voiceId: selectedVoiceId,
        text: script,
        modelId: 'eleven_multilingual_v2',
      })
      const audioDuration = await getAudioDuration(audioBuffer)
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })

      // Recalculate per-segment timing from real audio duration
      const segments = pipeRef.current.segments ?? []
      const totalChars = segments.reduce((s, seg) => s + seg.text.length, 0)
      let cursor = 0
      const timedSegments: ScriptSegment[] = segments.map((seg) => {
        const ratio    = totalChars > 0 ? seg.text.length / totalChars : 1 / segments.length
        const duration = audioDuration * ratio
        const s = { ...seg, startSec: cursor, durationSec: duration }
        cursor += duration
        return s
      })

      pipeRef.current.audioDuration = audioDuration
      pipeRef.current.audioBlob = audioBlob
      pipeRef.current.timedSegments = timedSegments

      // Local preview URL (we upload to Supabase only when user continues)
      if (previewVoiceUrl?.startsWith('blob:')) URL.revokeObjectURL(previewVoiceUrl)
      setPreviewVoiceUrl(URL.createObjectURL(audioBlob))

      setPhase('review-voice')
    } catch (err) {
      setPhaseError(err instanceof Error ? err.message : String(err))
      setPhase('failed')
    }
  }

  // ── Step 3: Resolve URLs (automatic, no review) ─────────────────────────

  const runResolve = async () => {
    if (!pipeRef.current.audioBlob) { setPhaseError('Thiếu audio'); setPhase('failed'); return }

    setPhase('running-resolve')
    setPhaseError(null)
    setPhaseDetail('Upload audio + resolve ảnh...')

    try {
      // Upload audio to Supabase
      const audioAssetId = await saveAsset(pipeRef.current.audioBlob, 'audio/mpeg')
      const voiceUrl = await getUrl(audioAssetId)
      if (!voiceUrl) throw new Error('Không lấy được URL audio sau khi upload')
      pipeRef.current.voiceUrl = voiceUrl

      // Resolve avatar image
      const model = models.find((m) => m.id === selectedModelId)
      const avatarSrc = manualAvatarUrl ?? model?.characterImage ?? ''
      const avatarImageUrl = await resolveImageUrl(avatarSrc)
      if (!avatarImageUrl) throw new Error('Không lấy được URL ảnh Avatar AI')
      pipeRef.current.avatarImageUrl = avatarImageUrl

      // Resolve product images (single bank + manual uploads)
      const productImageUrls: string[] = []
      if (selectedProductId) {
        const prod = products.find((p) => p.id === selectedProductId)
        if (prod?.productImage) {
          const url = await resolveImageUrl(prod.productImage)
          if (url) productImageUrls.push(url)
        }
      }
      let manualFailCount = 0
      for (const mp of manualProducts) {
        const url = await resolveImageUrl(mp.blobUrl)
        if (url) productImageUrls.push(url)
        else manualFailCount++
      }
      if (manualFailCount > 0) {
        addToast(`${manualFailCount} ảnh đính kèm không upload được`, 'error')
      }
      pipeRef.current.productImageUrls = productImageUrls

      // Auto-proceed to avatar generation
      await runAvatar()
    } catch (err) {
      setPhaseError(err instanceof Error ? err.message : String(err))
      setPhase('failed')
    }
  }

  // ── Step 4: Avatar lip-sync ──────────────────────────────────────────────

  const runAvatar = async () => {
    if (!kieApiKey) { setPhaseError('Cần KIE.ai API key'); setPhase('failed'); return }
    const { avatarImageUrl, voiceUrl } = pipeRef.current
    if (!avatarImageUrl || !voiceUrl) { setPhaseError('Thiếu ảnh avatar hoặc audio'); setPhase('failed'); return }

    setPhase('running-avatar')
    setPhaseError(null)
    setPhaseDetail('Kling Avatar đang gen video (~3-5 phút)...')

    try {
      const { taskId } = await generateLipSync({
        apiKey: kieApiKey,
        modelId: 'kling/ai-avatar-standard',
        imageUrl: avatarImageUrl,
        audioUrl: voiceUrl,
        prompt: 'A confident UGC content creator speaking naturally to camera, professional look, clean background',
      })
      const avatarRawUrl = await pollLipSyncUntilDone({ apiKey: kieApiKey, taskId, timeoutMs: 15 * 60 * 1000 })

      pipeRef.current.avatarRawUrl = avatarRawUrl
      setPreviewAvatarUrl(avatarRawUrl)
      setPhase('review-avatar')
    } catch (err) {
      setPhaseError(err instanceof Error ? err.message : String(err))
      setPhase('failed')
    }
  }

  // ── Step 5: B-roll generation ────────────────────────────────────────────

  const runBroll = async () => {
    if (!kieApiKey) { setPhaseError('Cần KIE.ai API key'); setPhase('failed'); return }
    const { timedSegments, productImageUrls } = pipeRef.current
    if (!timedSegments?.length) { setPhaseError('Thiếu segments'); setPhase('failed'); return }

    setPhase('running-broll')
    setPhaseError(null)
    setPhaseDetail(`Đang gen ${timedSegments.length} clips song song...`)

    try {
      const brollResults: (string | null)[] = new Array(timedSegments.length).fill(null)

      await Promise.all(timedSegments.map(async (seg, i) => {
        const refImages = (seg.useProduct && productImageUrls && productImageUrls.length > 0)
          ? productImageUrls.slice(0, 3)
          : undefined
        try {
          const { taskId } = await generateVideoJob({
            apiKey: kieApiKey,
            jobModelId: 'kling-3.0/video',
            prompt: seg.brollPrompt + '. Vertical 9:16, cinematic, no text overlay.',
            aspectRatio: '9:16',
            resolution: '720p',
            duration: 5,
            referenceImageUrls: refImages,
          })
          const brollStart = Date.now()
          while (Date.now() - brollStart < 8 * 60 * 1000) {
            await new Promise((r) => setTimeout(r, 5000))
            const s = await getVideoJobStatus({ apiKey: kieApiKey, taskId })
            if (s.status === 'completed' && s.videoUrl) { brollResults[i] = s.videoUrl; break }
            if (s.status === 'failed') break
          }
        } catch { brollResults[i] = null }
      }))

      pipeRef.current.brollResults = brollResults
      setPreviewBrollUrls([...brollResults])
      setPhase('review-broll')
    } catch (err) {
      setPhaseError(err instanceof Error ? err.message : String(err))
      setPhase('failed')
    }
  }

  // ── Step 6: Background removal ───────────────────────────────────────────

  const runBg = async () => {
    if (!falApiKey) { setPhaseError('Cần fal.ai API key'); setPhase('failed'); return }
    const { avatarRawUrl } = pipeRef.current
    if (!avatarRawUrl) { setPhaseError('Thiếu avatar video'); setPhase('failed'); return }

    setPhase('running-bg')
    setPhaseError(null)
    setPhaseDetail('fal.ai đang xóa nền (~1-2 phút)...')

    try {
      const finalUrl = await removeVideoBackground({ apiKey: falApiKey, videoUrl: avatarRawUrl, outputFormat: 'mp4' })
      pipeRef.current.avatarFinalUrl = finalUrl
      setPreviewBgUrl(finalUrl)
      setPhase('review-bg')
    } catch (err) {
      // Allow user to skip bg removal on failure
      setPhaseError(`Xóa nền thất bại: ${err instanceof Error ? err.message.slice(0, 100) : 'lỗi'}`)
      setPhase('failed')
    }
  }

  // Skip bg removal → use raw avatar
  const handleSkipBg = () => {
    pipeRef.current.avatarFinalUrl = pipeRef.current.avatarRawUrl ?? ''
    addToast('Đã bỏ qua xóa nền', 'error')
    runAssemble()
  }

  // ── Step 7: Final assembly ───────────────────────────────────────────────

  const runAssemble = async () => {
    if (!shotstackApiKey) { setPhaseError('Cần Shotstack API key'); setPhase('failed'); return }
    const {
      voiceUrl, avatarFinalUrl, audioDuration,
      timedSegments, brollResults, jobId, jobName, voiceName,
    } = pipeRef.current
    if (!voiceUrl || !avatarFinalUrl || !audioDuration || !timedSegments) {
      setPhaseError('Thiếu dữ liệu để ghép video'); setPhase('failed'); return
    }

    setPhase('running-assemble')
    setPhaseError(null)
    setPhaseDetail('Shotstack đang render...')

    try {
      const renderId = await buildUGCVideo({
        apiKey: shotstackApiKey,
        voiceUrl,
        avatarVideoUrl: avatarFinalUrl,
        totalDuration: audioDuration,
        segments: timedSegments.map((seg, i) => ({
          text: seg.text,
          startSec: seg.startSec,
          durationSec: seg.durationSec,
          brollUrl: brollResults?.[i] ?? null,
          avatarPosition: seg.avatarPosition,
        })),
      })

      const finalVideoUrl = await pollRenderUntilDone({
        apiKey: shotstackApiKey,
        renderId,
        onStatusChange: (s) => setPhaseDetail(`Shotstack: ${s}...`),
        timeoutMs: 15 * 60 * 1000,
      })

      // Save to Supabase
      const finalRes   = await fetch(finalVideoUrl)
      const finalBlob  = await finalRes.blob()
      const finalAsset = await saveAsset(finalBlob, 'video/mp4')
      const savedUrl   = await getUrl(finalAsset) ?? finalVideoUrl

      pipeRef.current.finalVideoUrl = savedUrl
      pipeRef.current.finalAssetId = finalAsset

      // Add to history
      const newJob: VideoBuilderJob = {
        id: jobId ?? crypto.randomUUID(),
        name: jobName ?? 'UGC Video',
        status: 'done',
        errorMessage: null,
        script,
        voiceId: selectedVoiceId,
        voiceName: voiceName ?? '?',
        videoUrl: savedUrl,
        assetId: finalAsset,
        totalDuration: audioDuration,
        createdAt: Date.now(),
      }
      setHistory((h) => [newJob, ...h])

      setPhase('done')
      addToast('🎬 UGC Video đã build xong!')
    } catch (err) {
      setPhaseError(err instanceof Error ? err.message : String(err))
      setPhase('failed')

      const failedJob: VideoBuilderJob = {
        id: jobId ?? crypto.randomUUID(),
        name: jobName ?? 'UGC Video',
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
        script,
        voiceId: selectedVoiceId,
        voiceName: voiceName ?? '?',
        videoUrl: null,
        assetId: null,
        totalDuration: audioDuration ?? null,
        createdAt: Date.now(),
      }
      setHistory((h) => [failedJob, ...h])
    }
  }

  // ── Computed ─────────────────────────────────────────────────────────────

  const isIdle = phase === 'idle'
  const isBuilding = !isIdle && phase !== 'done' && phase !== 'failed'

  const hasAvatar = !!selectedModelId || !!manualAvatarUrl
  const canStart = !!script.trim() && hasAvatar && !!selectedVoiceId && isIdle
    && !!elevenLabsApiKey && !!kieApiKey && !!falApiKey && !!shotstackApiKey && !!geminiApiKey

  const missingKeys = [
    !geminiApiKey && 'Gemini', !elevenLabsApiKey && 'ElevenLabs',
    !kieApiKey && 'KIE.ai', !falApiKey && 'fal.ai', !shotstackApiKey && 'Shotstack',
  ].filter(Boolean) as string[]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col lg:flex-row bg-gradient-to-br from-violet-50/30 via-white to-purple-50/20">

      {/* ══ Left panel ══ */}
      <div className="flex w-full shrink-0 flex-col border-b border-black/8 lg:w-[440px] lg:border-b-0 lg:border-r">

        {/* Header */}
        <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Film className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">UGC Video Builder</h2>
              <p className="text-xs text-white/70">Pipeline thủ công · review từng bước · tiết kiệm chi phí</p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Missing keys warning */}
          {missingKeys.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-700">Thiếu API key: <strong>{missingKeys.join(', ')}</strong></p>
            </div>
          )}

          {/* ─── Kịch bản ─── */}
          <div>
            <SectionLabel icon={FileText}>Kịch bản</SectionLabel>
            <ScriptPicker scripts={scripts} selectedId={selectedScriptId} onSelect={handleSelectScript} />
            <textarea
              value={script}
              onChange={(e) => { setScript(e.target.value); setSelectedScriptId('') }}
              disabled={isBuilding}
              placeholder={scripts.length > 0
                ? 'Kịch bản từ Project sẽ hiển thị ở đây, hoặc nhập thủ công...'
                : 'Nhập kịch bản thủ công vào đây...'
              }
              rows={6}
              className="w-full resize-none rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-violet-300 focus:ring-2 focus:ring-violet-100 disabled:opacity-50"
            />
            {script && (
              <p className="mt-1.5 text-xs text-gray-400">
                {script.length} ký tự · ~{formatDuration(Math.round(script.length / 12.5))}
              </p>
            )}
          </div>

          {/* ─── Avatar AI ─── */}
          <div>
            <SectionLabel icon={User}>Avatar AI</SectionLabel>

            {manualAvatarUrl && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border-2 border-violet-300 bg-violet-50 p-3">
                <img src={manualAvatarUrl} alt={manualAvatarName} className="h-14 w-14 shrink-0 rounded-lg object-cover border border-violet-200" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{manualAvatarName || 'Ảnh tự tải lên'}</p>
                  <p className="text-xs text-violet-500">Ảnh avatar thủ công</p>
                </div>
                <button
                  onClick={() => { setManualAvatarUrl(null); setManualAvatarName('') }}
                  disabled={isBuilding}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-400 disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {models.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-black/10 bg-black/[0.01] px-4 py-5 text-center">
                <User className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                <p className="text-sm text-gray-400">Chưa có Avatar AI nào trong Project</p>
                <p className="mt-0.5 text-xs text-gray-300">Tạo tại app <strong>Avatar AI</strong> hoặc tải ảnh lên bên dưới</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {models.map((m) => (
                  <AvatarCard
                    key={m.id}
                    model={m}
                    selected={!manualAvatarUrl && m.id === selectedModelId}
                    onSelect={() => { if (!isBuilding) { setSelectedModelId(m.id); setManualAvatarUrl(null); setManualAvatarName('') } }}
                  />
                ))}
              </div>
            )}

            <UploadBtn onClick={() => !isBuilding && avatarFileRef.current?.click()}>
              Tải ảnh avatar lên thủ công
            </UploadBtn>
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* ─── Sản phẩm ─── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel icon={Package}>Sản phẩm (chọn 1)</SectionLabel>
              {selectedProductId && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-600">
                  ✓ đã chọn
                </span>
              )}
            </div>

            {products.length > 0 ? (
              <div className="grid grid-cols-3 gap-2.5">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    selected={selectedProductId === p.id}
                    onToggle={() => !isBuilding && handleToggleProduct(p.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Chưa có sản phẩm trong Project — bỏ qua hoặc đính kèm ảnh bên dưới</p>
            )}

            {manualProducts.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Ảnh đính kèm ({manualProducts.length}) — AI dùng làm tham khảo
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {manualProducts.map((mp) => (
                    <div
                      key={mp.id}
                      className="relative flex flex-col items-center gap-1 rounded-xl border border-violet-200 bg-violet-50/60 p-1.5"
                    >
                      <img src={mp.blobUrl} alt={mp.name} className="h-12 w-12 rounded-lg object-cover border border-violet-100" />
                      <p className="w-full truncate text-center text-[10px] font-medium text-gray-600">{mp.name}</p>
                      <button
                        onClick={() => !isBuilding && setManualProducts((prev) => prev.filter((p) => p.id !== mp.id))}
                        disabled={isBuilding}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-400 shadow disabled:opacity-40"
                      >
                        <X className="h-2.5 w-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {manualProducts.length < 8 && (
              <UploadBtn onClick={() => !isBuilding && productFileRef.current?.click()}>
                {manualProducts.length === 0
                  ? 'Đính kèm ảnh sản phẩm (AI tham khảo khi gen B-roll)'
                  : `Thêm ảnh đính kèm (${manualProducts.length}/8)`}
              </UploadBtn>
            )}
            <input
              ref={productFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={handleProductUpload}
            />
          </div>

          {/* ─── Giọng đọc ─── */}
          <div>
            <SectionLabel icon={Mic}>Giọng đọc (ElevenLabs)</SectionLabel>
            {!elevenLabsApiKey ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-600">Cần ElevenLabs API key trong Cài đặt</p>
            ) : loadingVoices ? (
              <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                <span className="text-sm text-gray-400">Đang tải giọng...</span>
              </div>
            ) : (
              <select
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                disabled={isBuilding}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-violet-300 disabled:opacity-50"
              >
                <option value="">Chọn giọng đọc...</option>
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name}{v.labels?.gender ? ` (${v.labels.gender})` : ''}{v.labels?.accent ? ` · ${v.labels.accent}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

        </div>

        {/* Start button */}
        <div className="shrink-0 border-t border-black/8 p-4">
          {isIdle ? (
            <button
              onClick={runParse}
              disabled={!canStart}
              className="relative w-full overflow-hidden rounded-xl py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: canStart ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : undefined,
                backgroundColor: !canStart ? '#d1d5db' : undefined,
              }}
            >
              <span className="flex items-center justify-center gap-2"><Sparkles className="h-4 w-4" />Bắt đầu Build (Bước 1: Miễn phí)</span>
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
            >
              {phase === 'done' ? 'Build video mới' : phase === 'failed' ? 'Bắt đầu lại' : 'Hủy & Bắt đầu lại'}
            </button>
          )}
          <p className="mt-2 text-center text-xs text-gray-400">
            {isIdle ? 'Mỗi bước cần duyệt thủ công · tiết kiệm chi phí' : `Tổng ước tính: ~$4-6/video`}
          </p>
        </div>
      </div>

      {/* ══ Right panel: Pipeline ══ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-black/8 bg-white/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-semibold text-gray-700">
              {isIdle ? 'Pipeline' : phase === 'done' ? 'Hoàn thành ✓' : phase === 'failed' ? 'Thất bại' : 'Đang xử lý...'}
            </span>
            {history.length > 0 && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-600">{history.length}</span>
            )}
          </div>
          {history.length > 0 && isIdle && (
            <button onClick={() => setHistory([])} className="text-xs text-gray-400 transition-colors hover:text-red-400">Xóa lịch sử</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">

          {/* Phase header (shown during all phases except idle/done/failed) */}
          {!isIdle && phase !== 'done' && phase !== 'failed' && <PhaseHeader phase={phase} />}

          {/* Running states */}
          {phase.startsWith('running-') && <RunningPanel phase={phase} detail={phaseDetail} />}

          {/* ─── Review: Parse ─── */}
          {phase === 'review-parse' && (
            <ReviewCard
              onRetry={runParse}
              onContinue={runVoice}
              continueLabel="Tiếp tục → Voiceover"
              continueCost={STEP_INFO.voice.cost}
            >
              <p className="mb-3 text-xs text-gray-500">
                <strong className="text-emerald-600">{previewSegments.length} đoạn</strong> · ~{formatDuration(pipeRef.current.totalEstimatedSec ?? 0)} · Bạn có thể sửa text trực tiếp
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {previewSegments.map((seg, i) => (
                  <div key={i} className="rounded-lg border border-black/8 bg-gray-50 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wide">
                      <span className="font-bold text-violet-600">Đoạn {i + 1}</span>
                      <span className="text-gray-400">{seg.durationSec.toFixed(1)}s · avatar {seg.avatarPosition}{seg.useProduct ? ' · 📦' : ''}</span>
                    </div>
                    <textarea
                      value={seg.text}
                      onChange={(e) => handleEditSegmentText(i, e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-md border border-black/8 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-violet-300"
                    />
                    <p className="mt-1.5 line-clamp-2 text-[10px] italic text-violet-500">B-roll: {seg.brollPrompt}</p>
                  </div>
                ))}
              </div>
            </ReviewCard>
          )}

          {/* ─── Review: Voice ─── */}
          {phase === 'review-voice' && (
            <ReviewCard
              onRetry={runVoice}
              onContinue={runResolve}
              continueLabel="Tiếp tục → Avatar"
              continueCost={STEP_INFO.avatar.cost}
            >
              <p className="mb-2 text-xs text-gray-500">
                Nghe thử voiceover trước khi commit cost lớn nhất (~$3 cho Avatar)
              </p>
              <audio controls src={previewVoiceUrl ?? ''} className="w-full" />
              <p className="mt-2 text-xs text-gray-400">
                Thời lượng: <strong>{formatDuration(pipeRef.current.audioDuration ?? 0)}</strong> · Kích thước: {Math.round((pipeRef.current.audioBlob?.size ?? 0) / 1024)} KB
              </p>
            </ReviewCard>
          )}

          {/* ─── Review: Avatar ─── */}
          {phase === 'review-avatar' && (
            <ReviewCard
              onRetry={runAvatar}
              onContinue={runBroll}
              retryLabel="Tạo lại (~$3)"
              continueLabel="Tiếp tục → B-roll"
              continueCost={STEP_INFO.broll.cost}
            >
              <p className="mb-2 text-xs text-gray-500">
                Xem avatar nói có khớp môi và tự nhiên không. Nếu xấu, "Tạo lại" sẽ tốn thêm ~$3.
              </p>
              {previewAvatarUrl ? (
                <video
                  controls
                  src={previewAvatarUrl}
                  playsInline
                  className="w-full max-h-80 rounded-lg bg-black object-contain"
                />
              ) : (
                <p className="text-sm text-gray-400">Đang tải video...</p>
              )}
            </ReviewCard>
          )}

          {/* ─── Review: B-roll ─── */}
          {phase === 'review-broll' && (
            <ReviewCard
              onRetry={runBroll}
              onContinue={runBg}
              retryLabel={`Tạo lại tất cả (~$${(previewBrollUrls.length * 0.125).toFixed(2)})`}
              continueLabel="Tiếp tục → Xóa nền"
              continueCost={STEP_INFO.bg.cost}
            >
              <p className="mb-3 text-xs text-gray-500">
                <strong className="text-emerald-600">{previewBrollUrls.filter(Boolean).length}/{previewBrollUrls.length}</strong> clips thành công. Clips lỗi sẽ bị bỏ qua (avatar fullscreen).
              </p>
              <div className="grid grid-cols-3 gap-2">
                {previewBrollUrls.map((url, i) => (
                  <div key={i} className={`relative overflow-hidden rounded-lg border ${url ? 'border-emerald-200' : 'border-red-200 bg-red-50'}`}>
                    {url ? (
                      <video src={url} muted loop autoPlay playsInline className="h-28 w-full object-cover" />
                    ) : (
                      <div className="flex h-28 items-center justify-center">
                        <X className="h-5 w-5 text-red-400" />
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">#{i + 1}</span>
                  </div>
                ))}
              </div>
            </ReviewCard>
          )}

          {/* ─── Review: BG removal ─── */}
          {phase === 'review-bg' && (
            <ReviewCard
              onRetry={runBg}
              onContinue={runAssemble}
              onSkip={handleSkipBg}
              skipLabel="Bỏ qua xóa nền"
              retryLabel="Tạo lại (~$0.50)"
              continueLabel="Tiếp tục → Ghép video"
              continueCost={STEP_INFO.assemble.cost}
            >
              <p className="mb-2 text-xs text-gray-500">
                Avatar đã tách nền — kiểm tra xem viền có sạch không. Nếu xấu, có thể bỏ qua (giữ nền gốc).
              </p>
              {previewBgUrl ? (
                <video
                  controls
                  src={previewBgUrl}
                  playsInline
                  className="w-full max-h-80 rounded-lg object-contain"
                  style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%) 50% / 20px 20px' }}
                />
              ) : (
                <p className="text-sm text-gray-400">Đang tải video...</p>
              )}
            </ReviewCard>
          )}

          {/* ─── Done ─── */}
          {phase === 'done' && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <p className="text-base font-bold text-emerald-700">🎬 Video hoàn thành!</p>
              </div>
              {pipeRef.current.finalVideoUrl && (
                <video
                  controls
                  src={pipeRef.current.finalVideoUrl}
                  playsInline
                  className="w-full max-h-96 rounded-xl bg-black object-contain"
                />
              )}
              <button
                onClick={handleReset}
                className="mt-3 text-xs font-semibold text-violet-600 hover:underline"
              >
                Build video mới →
              </button>
            </div>
          )}

          {/* ─── Failed ─── */}
          {phase === 'failed' && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 mt-0.5 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-700">Bước thất bại</p>
                  <p className="text-xs text-red-600 mt-1">{phaseError}</p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                Bắt đầu lại
              </button>
            </div>
          )}

          {/* ─── Idle empty state ─── */}
          {isIdle && history.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100">
                <Film className="h-10 w-10 text-violet-400" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-gray-500">Pipeline thủ công · 7 bước</p>
                <p className="mt-1.5 max-w-sm text-center text-sm leading-relaxed text-gray-400">
                  Mỗi bước chạy xong → bạn duyệt kết quả → bấm "Tiếp tục →" để qua bước tiếp.
                  Nếu không OK → "Tạo lại ↺" để retry. Tránh tốn tiền oan.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-400">
                {['Free ① Parse', '$0.30 ② Voice', '$3.00 ④ Avatar', '$0.38 ⑤ B-roll', '$0.50 ⑥ BG', '$0.50 ⑦ Render'].map((t) => (
                  <span key={t} className="rounded-full border border-black/8 bg-black/[0.02] px-3 py-1.5">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* ─── History (always shown below) ─── */}
          {history.length > 0 && (
            <div className={`space-y-3 ${!isIdle ? 'mt-4 pt-4 border-t border-black/8' : ''}`}>
              {!isIdle && <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Lịch sử</p>}
              {history.map((job) => (
                <HistoryCard key={job.id} job={job} onDelete={() => setHistory((h) => h.filter((j) => j.id !== job.id))} />
              ))}
            </div>
          )}

        </div>

        <div className="shrink-0 border-t border-black/6 bg-white/60 px-5 py-2.5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Gemini · ElevenLabs · KIE.ai Kling · fal.ai · Shotstack
            </span>
            <span>9:16 · 1080p · MP4</span>
          </div>
        </div>
      </div>
    </div>
  )
}
