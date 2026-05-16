import { useState, useEffect, useRef } from 'react'
import {
  Film, Download, Loader2, CheckCircle2,
  AlertTriangle, ChevronRight, Trash2,
  Mic, Sparkles, FileText, User, Package,
  Check, ChevronDown, ChevronUp, Upload, X,
  RotateCcw, SkipForward, Coins,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import { getUrl, isAssetRef, saveAsset } from '../../utils/assetStore'
import { directGeminiVision } from '../../utils/gemini'
import { listVoices, textToSpeechSmooth } from '../../utils/elevenlabs'
import { generateLipSync, pollLipSyncUntilDone, generateVideoJob, getVideoJobStatus, generateImage, pollImageUntilDone } from '../../utils/kieai'
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

  // Detect product mentions heuristically (works for most languages — checks uppercase brand names + common product keywords)
  const PRODUCT_HINTS = /\b(infinity|probiotic|dental|herbal|shilajit|product|produc|produk|sản phẩm|chai|tube|bottle|jar|gel|cream|serum|capsul|tablet|pill|supplement)\b/i
  const hasUppercaseBrand = (t: string) => /\b[A-Z]{2,}(?:\s+[A-Z][A-Z0-9]+)*\b/.test(t)

  let cursor = 0
  const segments: ScriptSegment[] = buckets.map((text, index) => {
    const dur = Math.max(3, text.length / 14)  // ~14 chars/sec
    const isProductSeg = PRODUCT_HINTS.test(text) || hasUppercaseBrand(text)

    const brollPrompt = isProductSeg
      ? `Cinematic vertical 9:16 close-up UGC ad shot: a friendly content creator (matching reference avatar) holding and showing the product (matching reference product image) with natural hand gestures. Lifestyle home setting, soft natural window lighting, warm tones, shallow depth of field. Focus on the product. No text overlay.`
      : `Cinematic vertical 9:16 lifestyle B-roll: ${text.slice(0, 80)}. Real-world setting (kitchen, bathroom, bedroom, daily activity). Warm natural lighting, authentic UGC feel. No text overlay.`

    const seg: ScriptSegment = {
      index,
      text,
      durationSec: dur,
      startSec: cursor,
      brollPrompt,
      avatarPosition: index % 2 === 0 ? 'right' : 'left',
      useProduct: isProductSeg,
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
  const handleDownload = async () => {
    if (!job.videoUrl) return
    const filename = `ugc-video-${Date.now()}.mp4`
    try {
      // Re-wrap as same-origin video/mp4 blob — Supabase serves octet-stream,
      // which browsers ignore the <a download> filename for on cross-origin URLs.
      const res = await fetch(job.videoUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const rawBlob = await res.blob()
      const blob    = new Blob([rawBlob], { type: 'video/mp4' })
      const blobUrl = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href     = blobUrl
      a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch {
      const a = document.createElement('a')
      a.href = job.videoUrl
      a.download = filename
      a.target = '_blank'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    }
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
  | 'running-parse'     | 'review-parse'
  | 'running-voice'     | 'review-voice'
  | 'running-resolve'
  | 'running-avatar'    | 'review-avatar'
  | 'running-brollimg'  | 'review-brollimg'
  | 'running-broll'     | 'review-broll'
  | 'running-bg'        | 'review-bg'
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
  brollImageUrls: (string | null)[]   // static images (step 5)
  brollResults: (string | null)[]      // videos animated from images (step 6)
  avatarFinalUrl: string
  finalVideoUrl: string
  finalAssetId: string
}

// Step labels for the running/review panel header
const STEP_INFO: Record<string, { num: number; label: string; subLabel: string; cost: string }> = {
  voice:    { num: 1, label: 'Voiceover',           subLabel: 'TTS toàn bộ script → audio file (1.1x speed)', cost: '~$0.30 · ElevenLabs' },
  parse:    { num: 2, label: 'Storyboard',          subLabel: 'Gemini Pro phân tích voice → cảnh quay chi tiết', cost: 'Miễn phí' },
  resolve:  { num: 3, label: 'Chuẩn bị tài nguyên', subLabel: 'Upload audio + resolve URL ảnh',           cost: 'Miễn phí' },
  avatar:   { num: 4, label: 'Avatar Lip-sync',     subLabel: 'Kling Avatar: ảnh + audio → video nói',    cost: '~624 KIE credit' },
  brollimg: { num: 5, label: 'B-roll Images',       subLabel: 'Gen ảnh tĩnh từ storyboard — review trước khi animate', cost: '~64 KIE credit' },
  broll:    { num: 6, label: 'B-roll Videos',       subLabel: 'Image-to-video: ảnh tĩnh → clip chuyển động', cost: '~560 KIE credit' },
  bg:       { num: 7, label: 'Xóa nền Avatar',      subLabel: 'Tách nền để overlay trong suốt',           cost: '~$0.50 · fal.ai' },
  assemble: { num: 8, label: 'Ghép video',          subLabel: 'Layer B-roll + avatar + captions',         cost: '~$0.50 · Shotstack' },
}

function getStepFromPhase(phase: PipelinePhase): string | null {
  if (phase === 'idle' || phase === 'done' || phase === 'failed') return null
  const m = phase.match(/(?:running|review)-(\w+)/)
  return m ? m[1] : null
}

/** Returns step number from phase, or 99 if not in pipeline. Useful for ordering. */
function getActiveStepNum(phase: PipelinePhase): number {
  if (phase === 'done') return 99   // all steps complete
  const step = getStepFromPhase(phase)
  return step ? (STEP_INFO[step]?.num ?? 0) : 0
}

// ── Completed step card (collapsible history item) ────────────────────────────

function CompletedStepCard({ stepId, summary, children }: {
  stepId: string
  summary: string
  children?: React.ReactNode
}) {
  const info = STEP_INFO[stepId]
  if (!info) return null
  return (
    <details className="group overflow-hidden rounded-xl border border-emerald-200/70 bg-emerald-50/40">
      <summary className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-emerald-50">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
          {info.num}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-3 w-3" /> {info.label}
          </p>
          <p className="truncate text-[10px] text-emerald-600">{summary}</p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-emerald-500 transition-transform group-open:rotate-180" />
      </summary>
      {children && (
        <div className="border-t border-emerald-100 bg-white/70 p-3">{children}</div>
      )}
    </details>
  )
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
              Bước {info.num}/8 · {info.cost}
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
            <Coins className="h-3 w-3" />
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
  const [previewBrollImageUrls, setPreviewBrollImageUrls] = useState<(string | null)[]>([])
  const [regeneratingImageIndices, setRegeneratingImageIndices] = useState<Set<number>>(new Set())
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
    // Validate file types (only accept images)
    const invalid = files.filter((f) => !f.type.startsWith('image/'))
    if (invalid.length > 0) {
      addToast(`${invalid.length} file không phải ảnh — đã bỏ qua`, 'error')
    }
    const valid = files.filter((f) => f.type.startsWith('image/'))
    // Warn on large files
    const tooLarge = valid.filter((f) => f.size > 10 * 1024 * 1024)
    if (tooLarge.length > 0) {
      addToast(`${tooLarge.length} ảnh > 10MB — có thể upload chậm`, 'error')
    }
    if (valid.length === 0) { e.target.value = ''; return }

    setManualProducts((prev) => [
      ...prev,
      ...valid.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ''),
        blobUrl: URL.createObjectURL(file),
      })),
    ])
    addToast(`✓ Đã tải lên ${valid.length} ảnh sản phẩm`)
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
    setPreviewBrollImageUrls([])
    setRegeneratingImageIndices(new Set())
    setPreviewBrollUrls([])
    setPreviewBgUrl(null)
  }

  // ── Step 2: Storyboard from audio + script ────────────────────────────────
  // Runs AFTER voice so we have real audio duration and segments time exactly.
  // Uses cinematic-director prompt to generate VISUALLY SPECIFIC scene prompts
  // matching the actual content of each voice line.

  const runParse = async () => {
    const audioDuration = pipeRef.current.audioDuration
    if (!audioDuration) { setPhaseError('Thiếu audio — chạy lại bước Voice'); setPhase('failed'); return }

    setPhase('running-parse')
    setPhaseError(null)
    setPhaseDetail('Gemini Pro phân tích voice → storyboard chi tiết...')

    const parsePrompt = `You are a senior UGC video director creating a cinematic storyboard.

The voiceover is ${audioDuration.toFixed(1)} seconds long. Split the script into 8-12 segments matching natural pause/sentence boundaries. Each segment should be 4-8 seconds.

For EACH segment, produce a HIGHLY SPECIFIC visual storyboard prompt (brollPrompt, English, 60-100 words) that VISUALLY MATCHES what the speaker is saying at that exact moment. The image generator will use this prompt to create a still photo, which will then be animated into a 5-second video clip.

brollPrompt MUST describe:
1. AVATAR ACTION: specific physical action the avatar (friendly content creator) is doing — matched to the voice content
2. SETTING: specific real-world location matching the context (kitchen / bathroom / park / desk / dining table / pharmacy / outdoor / etc.)
3. EMOTION: facial expression / body language matching what the speaker feels in that line (frustrated / relieved / joyful / energetic / confident / nostalgic)
4. SHOT TYPE: close-up macro / medium shot / wide / over-shoulder / POV
5. CAMERA MOVEMENT: slow zoom-in / gentle pan / static / handheld / tracking
6. LIGHTING & MOOD: warm golden hour / soft daylight / clinical white / dramatic side-light
7. PRODUCT (if mentioned): describe product appearance — bottle shape, label color, capsule/liquid form
8. CINEMATIC STYLE: hyperrealistic UGC ad, shallow depth of field, no text overlay, vertical 9:16

EXAMPLES (study these carefully — your prompts must be this specific):

Voice: "Cơ sở khoa học của sản phẩm rất vững chắc"
→ "Macro close-up of two hands holding a probiotic supplement bottle, label clearly visible showing scientific iconography. Clean white desk surface with a notebook in soft focus. Side window daylight, professional documentary aesthetic, shallow depth of field. Camera slowly pushes in on the label. Vertical 9:16, hyperrealistic photography, no text overlay."

Voice: "Tôi có thể thưởng thức đồ ăn trở lại"
→ "Medium shot of cheerful young woman at sunny breakfast table, taking a satisfying bite of pasta with closed-eye genuine pleasure. Warm golden morning light streams through kitchen window. Plate of healthy food, fresh orange juice nearby. Camera at eye level with slight handheld feel. Authentic UGC vibe, fork lifts toward mouth. Vertical 9:16, hyperrealistic."

Voice: "Tôi cảm thấy tràn đầy năng lượng"
→ "Wide low-angle tracking shot of confident woman walking briskly through morning park path, arms swinging naturally, bright empowered smile. Sunlight flares through trees, dappled light on her face. Vibrant green nature background. Camera matches her energetic pace. Vertical 9:16, vivid color, hyperrealistic, no text overlay."

Voice: "INFINITY PROBIOTICS PLUS thực sự đã thay đổi cuộc đời tôi"
→ "Hero close-up product shot: avatar's hands present the INFINITY PROBIOTICS PLUS bottle directly toward camera, label fully readable. Soft natural living-room background blurred. Gentle smile partially visible above. Warm honey-toned lighting, premium commercial feel, slight camera push-in. Vertical 9:16, hyperrealistic, no text overlay."

Other rules:
- avatarPosition: alternate "left" / "right" each segment
- useProduct: true if segment mentions/references the product (by name, benefit, mechanism, or transformation result)
- durationSec + startSec: distribute proportionally to text length, MUST sum to exactly ${audioDuration.toFixed(1)} seconds
- text: the exact original-language voice text for this segment (Vietnamese / Malay / English — DO NOT translate)
- brollPrompt: always in English (image model works best in English)

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

    // Attempt 1: Gemini Pro (best creative reasoning) with schema
    if (geminiApiKey) {
      try {
        const raw = await directGeminiVision({
          apiKey: geminiApiKey,
          parts: [{ text: parsePrompt }],
          model: 'gemini-2.5-pro',          // Pro = better cinematic storyboarding
          maxOutputTokens: 16384,            // detailed prompts use more tokens
          responseMimeType: 'application/json',
          responseSchema: parseSchema,
        })
        parsed = JSON.parse(extractJson(raw)) as ParseResult
      } catch (e1) {
        console.warn('[parse] Pro attempt failed, falling back to Flash:', e1)
        setPhaseDetail('Pro bận → thử Flash...')

        // Attempt 2: Gemini Flash (faster fallback) with schema
        try {
          const raw = await directGeminiVision({
            apiKey: geminiApiKey,
            parts: [{ text: parsePrompt }],
            maxOutputTokens: 16384,
            responseMimeType: 'application/json',
            responseSchema: parseSchema,
          })
          parsed = JSON.parse(extractJson(raw)) as ParseResult
        } catch (e2) {
          console.warn('[parse] Flash attempt failed:', e2)
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

    // Re-time segments from REAL audio duration (not Gemini's estimate)
    // Distribute time proportionally to character count of each segment
    const totalChars = parsed.segments.reduce((s, seg) => s + seg.text.length, 0)
    let cursor = 0
    const timedSegments: ScriptSegment[] = parsed.segments.map((seg) => {
      const ratio    = totalChars > 0 ? seg.text.length / totalChars : 1 / parsed!.segments.length
      const duration = audioDuration * ratio
      const ts = { ...seg, startSec: cursor, durationSec: duration }
      cursor += duration
      return ts
    })

    pipeRef.current.segments = timedSegments
    pipeRef.current.timedSegments = timedSegments
    pipeRef.current.totalEstimatedSec = audioDuration
    setPreviewSegments([...timedSegments])

    if (usedFallback) {
      addToast('Đã dùng phân tích offline (Gemini không phản hồi). Bạn có thể chỉnh sửa segments.', 'error')
    }

    setPhase('review-parse')
  }

  // Update a single segment's text in the review UI
  const handleEditSegmentText = (index: number, newText: string) => {
    setPreviewSegments((prev) => prev.map((s, i) => i === index ? { ...s, text: newText } : s))
  }

  // ── Step 1: Generate voiceover (NEW first step) ──────────────────────────
  // Voice runs BEFORE storyboarding so the AI director knows the real audio
  // duration and can time segments precisely without estimating.

  const runVoice = async () => {
    if (!elevenLabsApiKey) { setPhaseError('Cần ElevenLabs API key'); setPhase('failed'); return }

    // Initialize job metadata on first run (moved here since voice is step 1)
    if (!pipeRef.current.jobId) {
      const voiceName = voices.find((v) => v.voice_id === selectedVoiceId)?.name ?? selectedVoiceId
      const jobName = (scripts.find((s) => s.id === selectedScriptId)?.title || script.slice(0, 40)).trim()
      pipeRef.current.jobId = crypto.randomUUID()
      pipeRef.current.jobName = jobName
      pipeRef.current.voiceName = voiceName
    }

    setPhase('running-voice')
    setPhaseError(null)
    setPhaseDetail('')

    try {
      // textToSpeechSmooth: chunked + context continuity for consistent quality
      // on long scripts. 192kbps MP3 (falls back to 128 if plan blocks it),
      // stability 0.75 for steadier voice, 1.2x speed for snappier UGC pace.
      const audioBuffer = await textToSpeechSmooth({
        apiKey: elevenLabsApiKey,
        voiceId: selectedVoiceId,
        text: script,
        modelId: 'eleven_multilingual_v2',
        stability: 0.75,
        similarity: 0.75,
        speed: 1.1,
        outputFormat: 'mp3_44100_192',
        chunkSize: 400,
        onProgress: (done, total) => {
          setPhaseDetail(`Tạo audio: ${done}/${total} chunks (1.1x speed, chất lượng cao)...`)
        },
      })
      const audioDuration = await getAudioDuration(audioBuffer)
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })

      pipeRef.current.audioDuration = audioDuration
      pipeRef.current.audioBlob = audioBlob

      // Local preview URL (upload to Supabase happens in resolve step)
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
        prompt: 'A confident UGC content creator speaking naturally and energetically to camera, expressive facial gestures, natural blinking, authentic emotion, soft natural lighting, looks like a real person filming a vertical TikTok/Reels video at home',
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

  // ── Step 5: B-roll Static Images ─────────────────────────────────────────
  // Why: cheap ($0.04/image) and reviewable BEFORE committing to expensive
  // video generation ($0.35/clip). User can regen bad images individually.

  const buildImagePrompt = (seg: ScriptSegment, hasAvatar: boolean, hasProduct: boolean): string => {
    const useProd = seg.useProduct && hasProduct
    if (useProd) {
      return `${seg.brollPrompt}. Photorealistic cinematic 9:16 vertical UGC ad shot. ${
        hasAvatar ? 'A friendly content creator (matching avatar style) ' : ''
      }holding/showing the product clearly. Lifestyle home setting, soft natural window lighting, warm tones, shallow depth of field. Hyper-realistic, professional photography, no text overlay, no watermark.`
    }
    return `${seg.brollPrompt}. Photorealistic cinematic 9:16 vertical lifestyle B-roll image. Authentic real-world setting, warm natural lighting, professional photography quality. No text overlay, no watermark.`
  }

  // Generate ONE image for a given segment index (used by both initial run + per-image regen)
  const generateOneImage = async (i: number, seg: ScriptSegment): Promise<string | null> => {
    const { avatarImageUrl, productImageUrls } = pipeRef.current
    const prompt = buildImagePrompt(seg, !!avatarImageUrl, !!(productImageUrls && productImageUrls.length))
    try {
      const { taskId } = await generateImage({
        apiKey: kieApiKey!,
        model: 'nano-banana-2',
        prompt,
        resolution: '1K',
        aspectRatio: '9:16',
      })
      return await pollImageUntilDone({ apiKey: kieApiKey!, taskId, timeoutMs: 3 * 60 * 1000 })
    } catch (err) {
      console.error(`[brollImage ${i}] failed:`, err)
      return null
    }
  }

  const runBrollImages = async () => {
    if (!kieApiKey) { setPhaseError('Cần KIE.ai API key'); setPhase('failed'); return }
    const { timedSegments } = pipeRef.current
    if (!timedSegments?.length) { setPhaseError('Thiếu segments'); setPhase('failed'); return }

    setPhase('running-brollimg')
    setPhaseError(null)
    setPhaseDetail(`Gen ${timedSegments.length} ảnh tĩnh song song (~30-60s)...`)

    try {
      const results: (string | null)[] = new Array(timedSegments.length).fill(null)
      await Promise.all(timedSegments.map(async (seg, i) => {
        results[i] = await generateOneImage(i, seg)
      }))

      pipeRef.current.brollImageUrls = results
      setPreviewBrollImageUrls([...results])
      setPhase('review-brollimg')
    } catch (err) {
      setPhaseError(err instanceof Error ? err.message : String(err))
      setPhase('failed')
    }
  }

  // Regenerate just one image (called from review screen)
  const regenerateOneImage = async (i: number) => {
    if (!kieApiKey) return
    const { timedSegments } = pipeRef.current
    if (!timedSegments?.[i]) return

    setRegeneratingImageIndices((prev) => new Set(prev).add(i))
    try {
      const newUrl = await generateOneImage(i, timedSegments[i])
      if (newUrl) {
        setPreviewBrollImageUrls((prev) => {
          const next = [...prev]
          next[i] = newUrl
          // Persist back to pipeRef
          if (pipeRef.current.brollImageUrls) pipeRef.current.brollImageUrls[i] = newUrl
          return next
        })
      } else {
        addToast(`Ảnh #${i + 1} gen lại thất bại`, 'error')
      }
    } finally {
      setRegeneratingImageIndices((prev) => {
        const next = new Set(prev)
        next.delete(i)
        return next
      })
    }
  }

  // ── Step 6: B-roll Videos (image-to-video) ───────────────────────────────
  // Uses the approved static images as starting reference for video generation.
  // Much better than pure text-to-video because the AI starts from a known image.

  const runBroll = async () => {
    if (!kieApiKey) { setPhaseError('Cần KIE.ai API key'); setPhase('failed'); return }
    const { timedSegments, brollImageUrls } = pipeRef.current
    if (!timedSegments?.length) { setPhaseError('Thiếu segments'); setPhase('failed'); return }

    setPhase('running-broll')
    setPhaseError(null)
    setPhaseDetail(`Animate ${timedSegments.length} ảnh thành video clips...`)

    try {
      const brollResults: (string | null)[] = new Array(timedSegments.length).fill(null)

      await Promise.all(timedSegments.map(async (seg, i) => {
        const startImage = brollImageUrls?.[i]
        if (!startImage) {
          // Skip segments without a valid image (fallback: stays null → avatar fullscreen)
          return
        }

        // Motion prompt: describe HOW the camera/scene moves (image already shows WHAT)
        const motionPrompt = `${seg.brollPrompt}. Smooth cinematic camera movement: slow zoom in or gentle pan, natural subtle motion. No static shots, no jitter. Maintain photorealistic UGC ad style throughout.`

        try {
          const { taskId } = await generateVideoJob({
            apiKey: kieApiKey,
            jobModelId: 'kling-3.0/video',
            prompt: motionPrompt,
            aspectRatio: '9:16',
            resolution: '720p',
            duration: 5,
            // Pass the generated image as the reference — Kling treats first
            // image as the start frame, giving us proper image-to-video.
            referenceImageUrls: [startImage],
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
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                    ✓ {manualProducts.length} ảnh đã tải lên — AI sẽ tham khảo khi gen B-roll
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {manualProducts.map((mp) => (
                    <div
                      key={mp.id}
                      className="group relative flex flex-col items-center gap-1 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-1.5"
                    >
                      {/* Thumbnail */}
                      <div className="relative">
                        <img src={mp.blobUrl} alt={mp.name} className="h-12 w-12 rounded-lg object-cover border border-emerald-100" />
                        {/* Green check badge — clearly marks "uploaded successfully" */}
                        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 shadow ring-2 ring-white">
                          <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                        </div>
                      </div>
                      <p className="w-full truncate text-center text-[10px] font-medium text-gray-700">{mp.name}</p>
                      {/* Delete button — only on hover, neutral gray (not red) */}
                      <button
                        onClick={() => !isBuilding && setManualProducts((prev) => prev.filter((p) => p.id !== mp.id))}
                        disabled={isBuilding}
                        title="Xóa ảnh này"
                        className="absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center rounded-md bg-white/90 text-gray-400 opacity-0 shadow transition-opacity group-hover:opacity-100 hover:text-red-500 disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" />
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
              onClick={runVoice}
              disabled={!canStart}
              className="relative w-full overflow-hidden rounded-xl py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: canStart ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : undefined,
                backgroundColor: !canStart ? '#d1d5db' : undefined,
              }}
            >
              <span className="flex items-center justify-center gap-2"><Sparkles className="h-4 w-4" />Bắt đầu Build (Bước 1: Voice ~$0.30)</span>
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
            {isIdle ? 'Pipeline 8 bước · ~1,248 KIE credit + ~$1.30 (EL+fal+SS)' : `Đang chạy · ~1,248 KIE credit + ~$1.30 ngoài KIE`}
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

          {/* Completed steps history (collapsible cards) — shown so user
              can refer back to any step they've already approved */}
          {!isIdle && (() => {
            const activeNum = getActiveStepNum(phase)
            const cards: React.ReactNode[] = []

            // Step 1: Voice
            if (previewVoiceUrl && (activeNum > 1 || phase === 'done')) {
              cards.push(
                <CompletedStepCard
                  key="voice"
                  stepId="voice"
                  summary={`${formatDuration(pipeRef.current.audioDuration ?? 0)} · ${Math.round((pipeRef.current.audioBlob?.size ?? 0) / 1024)} KB · 1.1x speed`}
                >
                  <audio controls src={previewVoiceUrl} className="w-full" />
                </CompletedStepCard>
              )
            }

            // Step 2: Storyboard
            if (previewSegments.length > 0 && (activeNum > 2 || phase === 'done')) {
              cards.push(
                <CompletedStepCard
                  key="parse"
                  stepId="parse"
                  summary={`${previewSegments.length} cảnh quay · ${formatDuration(pipeRef.current.audioDuration ?? 0)}`}
                >
                  <div className="max-h-48 space-y-1.5 overflow-y-auto">
                    {previewSegments.map((seg, i) => (
                      <div key={i} className="rounded-md bg-gray-50 px-2 py-1.5">
                        <p className="text-[10px] font-bold text-violet-600">Đoạn {i + 1} · {seg.durationSec.toFixed(1)}s</p>
                        <p className="text-[11px] text-gray-700">{seg.text}</p>
                      </div>
                    ))}
                  </div>
                </CompletedStepCard>
              )
            }

            // Step 3: Resolve (always shown as completed once past — minimal preview)
            if (pipeRef.current.voiceUrl && (activeNum > 3 || phase === 'done')) {
              const productCount = pipeRef.current.productImageUrls?.length ?? 0
              cards.push(
                <CompletedStepCard
                  key="resolve"
                  stepId="resolve"
                  summary={`Audio uploaded · 1 avatar · ${productCount} ảnh sản phẩm`}
                />
              )
            }

            // Step 4: Avatar Lip-sync
            if (previewAvatarUrl && (activeNum > 4 || phase === 'done')) {
              cards.push(
                <CompletedStepCard
                  key="avatar"
                  stepId="avatar"
                  summary={`Lip-sync video · ${formatDuration(pipeRef.current.audioDuration ?? 0)} · 720p`}
                >
                  <video controls src={previewAvatarUrl} playsInline className="w-full max-h-64 rounded-lg bg-black object-contain" />
                </CompletedStepCard>
              )
            }

            // Step 5: B-roll Images
            if (previewBrollImageUrls.length > 0 && (activeNum > 5 || phase === 'done')) {
              const successCount = previewBrollImageUrls.filter(Boolean).length
              cards.push(
                <CompletedStepCard
                  key="brollimg"
                  stepId="brollimg"
                  summary={`${successCount}/${previewBrollImageUrls.length} ảnh tĩnh đã duyệt`}
                >
                  <div className="grid grid-cols-4 gap-1.5">
                    {previewBrollImageUrls.map((url, i) => (
                      <div key={i} className="relative overflow-hidden rounded-md border border-emerald-100">
                        {url
                          ? <img src={url} alt={`#${i + 1}`} className="h-20 w-full object-cover" />
                          : <div className="flex h-20 items-center justify-center bg-red-50"><X className="h-4 w-4 text-red-400" /></div>
                        }
                        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white">#{i + 1}</span>
                      </div>
                    ))}
                  </div>
                </CompletedStepCard>
              )
            }

            // Step 6: B-roll Videos
            if (previewBrollUrls.length > 0 && (activeNum > 6 || phase === 'done')) {
              const successCount = previewBrollUrls.filter(Boolean).length
              cards.push(
                <CompletedStepCard
                  key="broll"
                  stepId="broll"
                  summary={`${successCount}/${previewBrollUrls.length} video clips đã animate`}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {previewBrollUrls.map((url, i) => (
                      <div key={i} className="relative overflow-hidden rounded-md border border-emerald-100">
                        {url
                          ? <video src={url} muted loop autoPlay playsInline className="h-24 w-full object-cover" />
                          : <div className="flex h-24 items-center justify-center bg-red-50"><X className="h-4 w-4 text-red-400" /></div>
                        }
                        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white">#{i + 1}</span>
                      </div>
                    ))}
                  </div>
                </CompletedStepCard>
              )
            }

            // Step 7: BG removal
            if (previewBgUrl && (activeNum > 7 || phase === 'done')) {
              cards.push(
                <CompletedStepCard
                  key="bg"
                  stepId="bg"
                  summary="Avatar đã xóa nền"
                >
                  <video
                    controls src={previewBgUrl} playsInline
                    className="w-full max-h-48 rounded-lg object-contain"
                    style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%) 50% / 16px 16px' }}
                  />
                </CompletedStepCard>
              )
            }

            return cards.length > 0 ? <div className="mb-3 space-y-2">{cards}</div> : null
          })()}

          {/* Phase header (shown during all phases except idle/done/failed) */}
          {!isIdle && phase !== 'done' && phase !== 'failed' && <PhaseHeader phase={phase} />}

          {/* Running states */}
          {phase.startsWith('running-') && <RunningPanel phase={phase} detail={phaseDetail} />}

          {/* ─── Review: Storyboard (was Parse, now step 2) ─── */}
          {phase === 'review-parse' && (
            <ReviewCard
              onRetry={runParse}
              onContinue={runResolve}
              continueLabel="Tiếp tục → Avatar"
              continueCost={STEP_INFO.avatar.cost}
            >
              <p className="mb-3 text-xs text-gray-500">
                <strong className="text-emerald-600">{previewSegments.length} cảnh quay</strong> · {formatDuration(pipeRef.current.audioDuration ?? 0)} (timed từ audio thật) · Bạn có thể sửa text trực tiếp
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
                    <details className="mt-1.5 text-[10px] text-violet-600">
                      <summary className="cursor-pointer font-semibold hover:underline">
                        🎬 Storyboard cảnh quay (click để xem chi tiết)
                      </summary>
                      <p className="mt-1 rounded bg-violet-50 p-2 italic leading-relaxed text-gray-700">
                        {seg.brollPrompt}
                      </p>
                    </details>
                  </div>
                ))}
              </div>
            </ReviewCard>
          )}

          {/* ─── Review: Voice (now step 1) ─── */}
          {phase === 'review-voice' && (
            <ReviewCard
              onRetry={runVoice}
              onContinue={runParse}
              continueLabel="Tiếp tục → Storyboard"
              continueCost={STEP_INFO.parse.cost}
            >
              <p className="mb-2 text-xs text-gray-500">
                Nghe thử voiceover. Tiếp theo Gemini Pro sẽ phân tích chi tiết từng câu để gen storyboard cảnh quay khớp với voice.
              </p>
              <audio controls src={previewVoiceUrl ?? ''} className="w-full" />
              <p className="mt-2 text-xs text-gray-400">
                Thời lượng: <strong>{formatDuration(pipeRef.current.audioDuration ?? 0)}</strong> · Kích thước: {Math.round((pipeRef.current.audioBlob?.size ?? 0) / 1024)} KB · 1.1x speed
              </p>
            </ReviewCard>
          )}

          {/* ─── Review: Avatar ─── */}
          {phase === 'review-avatar' && (
            <ReviewCard
              onRetry={runAvatar}
              onContinue={runBrollImages}
              retryLabel="Tạo lại (~624 cr)"
              continueLabel="Tiếp tục → B-roll Images"
              continueCost={STEP_INFO.brollimg.cost}
            >
              <p className="mb-2 text-xs text-gray-500">
                Xem avatar nói có khớp môi và tự nhiên không. Tạo lại = ~624 KIE credit. Tiếp theo gen ảnh tĩnh trước (~64 cr, rẻ), review xong mới animate.
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

          {/* ─── Review: B-roll Static Images ─── */}
          {phase === 'review-brollimg' && (
            <ReviewCard
              onRetry={runBrollImages}
              onContinue={runBroll}
              retryLabel={`Tạo lại tất cả (~${previewBrollImageUrls.length * 8} cr)`}
              continueLabel="Tiếp tục → Animate"
              continueCost={STEP_INFO.broll.cost}
              disabled={regeneratingImageIndices.size > 0}
            >
              <p className="mb-3 text-xs text-gray-500">
                <strong className="text-emerald-600">{previewBrollImageUrls.filter(Boolean).length}/{previewBrollImageUrls.length}</strong> ảnh thành công.
                Click vào ảnh để gen lại từng cái (~8 KIE credit) — rẻ hơn nhiều so với gen lại video.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {previewBrollImageUrls.map((url, i) => {
                  const isRegen = regeneratingImageIndices.has(i)
                  return (
                    <div
                      key={i}
                      className={`group relative overflow-hidden rounded-lg border ${url ? 'border-emerald-200' : 'border-red-200 bg-red-50'} ${isRegen ? 'opacity-60' : ''}`}
                    >
                      {url ? (
                        <img src={url} alt={`Đoạn ${i + 1}`} className="h-32 w-full object-cover" />
                      ) : (
                        <div className="flex h-32 items-center justify-center">
                          <X className="h-5 w-5 text-red-400" />
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">#{i + 1}</span>
                      {isRegen ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                        </div>
                      ) : (
                        <button
                          onClick={() => regenerateOneImage(i)}
                          title={`Gen lại ảnh #${i + 1} (~8 KIE credit)`}
                          className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity hover:bg-violet-600 group-hover:opacity-100"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </ReviewCard>
          )}

          {/* ─── Review: B-roll Videos ─── */}
          {phase === 'review-broll' && (
            <ReviewCard
              onRetry={runBroll}
              onContinue={runBg}
              retryLabel={`Tạo lại tất cả (~${previewBrollUrls.length * 70} cr)`}
              continueLabel="Tiếp tục → Xóa nền"
              continueCost={STEP_INFO.bg.cost}
            >
              <p className="mb-3 text-xs text-gray-500">
                <strong className="text-emerald-600">{previewBrollUrls.filter(Boolean).length}/{previewBrollUrls.length}</strong> clips thành công (animate từ ảnh tĩnh đã duyệt). Clips lỗi sẽ bị bỏ qua.
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
              retryLabel="Tạo lại (~$0.50 fal.ai)"
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
                <p className="text-base font-semibold text-gray-500">Pipeline thủ công · 8 bước</p>
                <p className="mt-1.5 max-w-sm text-center text-sm leading-relaxed text-gray-400">
                  Voice trước (1.1x speed) → Gemini Pro phân tích từng câu thành storyboard cinematic → ảnh tĩnh review → animate → ghép cuối.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-400">
                {['$0.30 EL ① Voice', 'Free ② Storyboard', '624 cr ④ Avatar', '64 cr ⑤ Images', '560 cr ⑥ Videos', '$0.50 fal ⑦ BG', '$0.50 SS ⑧ Render'].map((t) => (
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
