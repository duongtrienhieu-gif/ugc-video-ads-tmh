import { useState, useEffect, useRef } from 'react'
import {
  Film, Download, Loader2, CheckCircle2,
  AlertTriangle, ChevronRight, ChevronLeft, Trash2,
  Mic, Sparkles, FileText, User, Package,
  Check, ChevronDown, ChevronUp, Upload, X,
  RotateCcw, SkipForward, Coins, Sliders,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import { useAdTemplateStore } from '../../stores/adTemplateStore'
import { getUrl, isAssetRef, saveAsset } from '../../utils/assetStore'
import { directGeminiVision } from '../../utils/gemini'
import { listVoices, listSharedVoices, textToSpeechSmooth } from '../../utils/elevenlabs'
import { generateLipSync, pollLipSyncUntilDone, generateVideoJob, getVideoJobStatus, generateGpt4oImage } from '../../utils/kieai'
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
 * Read an image reference (asset:// / blob: / https://) and return its bytes
 * as base64 + mime type. Used to feed images directly into Gemini Vision so
 * the AI can visually analyze the product/avatar before writing prompts.
 * Does NOT upload anywhere — read-only conversion.
 */
async function getImageBytes(ref: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    let fetchUrl: string | null = null
    if (isAssetRef(ref))        fetchUrl = await getUrl(ref)
    else if (ref.startsWith('blob:')) fetchUrl = ref
    else                              fetchUrl = ref
    if (!fetchUrl) return null

    const res = await fetch(fetchUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    const mime = blob.type || 'image/jpeg'

    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1] ?? ''
        resolve({ base64, mimeType: mime })
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.error('[getImageBytes] failed for ref:', ref, err)
    return null
  }
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
  audioBlob: Blob                       // in-memory only; NOT persisted (use audioAssetId)
  audioAssetId: string                  // Supabase asset ID — survives reload
  voiceUrl: string                      // Supabase signed URL (refreshed from assetId on reload)
  avatarImageUrl: string
  avatarVariantUrls: string[]           // resolved URLs of avatar's angle variants
  productImageUrls: string[]
  avatarDescription: string             // Gemini-generated locked physical description
  productDescription: string            // Gemini-generated locked product description
  avatarRawUrl: string
  brollImageUrls: (string | null)[]    // static images (step 3)
  brollResults: (string | null)[]      // videos animated from images (step 4)
  avatarFinalUrl: string
  finalVideoUrl: string
  finalAssetId: string
}

// ── Persistence ─────────────────────────────────────────────────────────────
const CACHE_KEY = 'ugc-builder-state-v1'

interface PersistedState {
  version: number
  savedAt: number
  // Inputs
  selectedScriptId: string
  script: string
  selectedModelId: string
  selectedProductId: string
  selectedVoiceId: string
  // Pipeline state
  phase: PipelinePhase
  phaseError: string | null
  // Pipe data (Blob field stripped — not JSON-serializable)
  pipeData: Omit<Partial<PipeData>, 'audioBlob'>
  // Preview URLs (blob: URLs will be filtered on restore — they don't survive reload)
  previewSegments: ScriptSegment[]
  previewVoiceUrl: string | null
  previewAvatarUrl: string | null
  previewBrollImageUrls: (string | null)[]
  previewBrollUrls: (string | null)[]
  previewBgUrl: string | null
  // Reference ad analysis (text only — file itself not persisted, user re-uploads if needed)
  refVideoAnalysis: string | null
  refVideoName: string
  selectedTemplateId: string
  // Completed jobs
  history: VideoBuilderJob[]
}

// Step labels for the running/review panel header
const STEP_INFO: Record<string, { num: number; label: string; subLabel: string; cost: string }> = {
  parse:    { num: 1, label: 'Storyboard',          subLabel: 'Gemini Pro phân tích script → cảnh quay (timing ước lượng từ char count)', cost: 'Miễn phí' },
  resolve:  { num: 2, label: 'Chuẩn bị tài nguyên', subLabel: 'Resolve URL ảnh avatar + sản phẩm',         cost: 'Miễn phí' },
  brollimg: { num: 3, label: 'B-roll Images',       subLabel: 'KIE GPT Image 2 — avatar + product image references for identity/product lock', cost: '~54 KIE credit' },
  broll:    { num: 4, label: 'B-roll Videos',       subLabel: 'Seedance 2 Fast 480p — UGC motion, tiết kiệm credit', cost: '~850 KIE credit' },
  voice:    { num: 5, label: 'Voiceover',           subLabel: 'eleven_v3 expressive — sau khi B-roll OK (re-time segments theo audio thật)', cost: '~$0.30 · ElevenLabs' },
  avatar:   { num: 6, label: 'Avatar Lip-sync',     subLabel: 'Kling Avatar: ảnh + audio → video nói (bước đắt nhất)', cost: '~624 KIE credit' },
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

// ── Running panel (spinner + progress bar) ────────────────────────────────────

function RunningPanel({ phase, detail, progress }: {
  phase: PipelinePhase
  detail: string
  progress: number    // 0-100
}) {
  const step = getStepFromPhase(phase)
  const label = step && STEP_INFO[step] ? `Đang ${STEP_INFO[step].label.toLowerCase()}...` : 'Đang xử lý...'
  const pct = Math.max(0, Math.min(100, progress))

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative">
        <div className="h-14 w-14 rounded-full border-4 border-violet-100" />
        <Loader2 className="absolute inset-0 m-auto h-14 w-14 animate-spin text-violet-500" />
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-gray-700">{label}</p>
        {detail && <p className="mt-1 text-xs text-gray-400">{detail}</p>}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Tiến độ</span>
          <span className="text-xs font-bold tabular-nums text-violet-600">{Math.round(pct)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 shadow-sm transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <p className="text-[11px] text-gray-300">Vui lòng giữ tab mở</p>
    </div>
  )
}

// ── Review card (wraps each step's review UI) ─────────────────────────────────

function ReviewCard({
  onRetry, onContinue, onSkip, onBack,
  retryLabel = 'Tạo lại',
  continueLabel = 'Tiếp tục',
  continueCost,
  skipLabel,
  backLabel = 'Quay lại',
  children,
  disabled = false,
}: {
  onRetry: () => void
  onContinue: () => void
  onSkip?: () => void
  onBack?: () => void           // hide back button if not provided (e.g. step 1)
  retryLabel?: string
  continueLabel?: string
  continueCost?: string
  skipLabel?: string
  backLabel?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm">
      <div className="p-4">{children}</div>

      <div className="flex flex-wrap items-center gap-2 border-t border-black/6 bg-gray-50/60 px-4 py-3">
        {onBack && (
          <button
            onClick={onBack}
            disabled={disabled}
            title="Quay lại bước trước (giữ nguyên dữ liệu)"
            className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {backLabel}
          </button>
        )}

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

// ── Outer dispatcher: routes to v1 (stable) or v2 (AI Director beta) ────────
import VideoBuilderV2 from './v2/VideoBuilderV2'

export default function VideoBuilder() {
  const pipelineVersion = useSettingsStore((s) => s.pipelineVersion)
  const setPipelineVersion = useSettingsStore((s) => s.setPipelineVersion)

  if (pipelineVersion === 'v2') {
    return <VideoBuilderV2 onSwitchToV1={() => setPipelineVersion('v1')} />
  }
  return <VideoBuilderV1 onSwitchToV2={() => setPipelineVersion('v2')} />
}

function VideoBuilderV1({ onSwitchToV2 }: { onSwitchToV2: () => void }) {
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

  // ── Reference winning ad — Ad Win Template picker ────────────────────────
  // Replaces the old "upload video for analysis" flow. Users analyze ads ONCE
  // in Phân tích QC, save as named templates, then pick from a dropdown here.
  // Way faster than re-uploading + re-analyzing the same video repeatedly.
  const adTemplates = useAdTemplateStore((s) => s.templates)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [refVideoAnalysis, setRefVideoAnalysis] = useState<string | null>(null)
  const [refVideoName, setRefVideoName] = useState('')

  // ── Pipeline state ───────────────────────────────────────────────────────
  const [phase, setPhase] = useState<PipelinePhase>('idle')
  const [phaseDetail, setPhaseDetail] = useState('')
  const [phaseProgress, setPhaseProgress] = useState(0)   // 0-100 for current step
  const [phaseError, setPhaseError] = useState<string | null>(null)
  const pipeRef = useRef<Partial<PipeData>>({})

  /**
   * Time-based progress estimator. For steps where we don't get granular
   * status from the underlying API (KIE polling, fal.ai, Shotstack), we
   * creep the progress bar up toward 95% over the estimated duration.
   * Returns a cleanup function to stop the timer when work completes.
   */
  const startTimedProgress = (estimatedMs: number): (() => void) => {
    setPhaseProgress(0)
    const startTime = Date.now()
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime
      const pct = Math.min((elapsed / estimatedMs) * 95, 95)
      setPhaseProgress(pct)
    }, 400)
    return () => clearInterval(id)
  }

  // Preview states (for review UI)
  const [previewSegments, setPreviewSegments] = useState<ScriptSegment[]>([])
  const [previewVoiceUrl, setPreviewVoiceUrl] = useState<string | null>(null)
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null)
  const [previewBrollImageUrls, setPreviewBrollImageUrls] = useState<(string | null)[]>([])
  const [regeneratingImageIndices, setRegeneratingImageIndices] = useState<Set<number>>(new Set())
  const [previewBrollUrls, setPreviewBrollUrls] = useState<(string | null)[]>([])
  const [generatingBrollIndices, setGeneratingBrollIndices] = useState<Set<number>>(new Set())
  const [previewBgUrl, setPreviewBgUrl] = useState<string | null>(null)

  // History
  const [history, setHistory] = useState<VideoBuilderJob[]>([])

  // Load voices: ONLY cloned (user's account) + Malaysian library voices.
  // Skip American/other accents — UGC ads here target Malaysian/Vietnamese
  // markets, so non-Malaysian premade voices clutter the dropdown.
  useEffect(() => {
    if (!elevenLabsApiKey) return
    setLoadingVoices(true)

    Promise.all([
      listVoices(elevenLabsApiKey),
      listSharedVoices({ apiKey: elevenLabsApiKey, language: 'ms',      pageSize: 50 }),
      listSharedVoices({ apiKey: elevenLabsApiKey, accent: 'malaysian', pageSize: 50 }),
    ])
      .then(([userVoices, msVoices, accentVoices]) => {
        // Only cloned voices from user account (skip premade like Rachel/Adam etc.)
        const cloned = userVoices.filter((v) => v.category === 'cloned')

        // Merge + dedupe Malaysian library voices (by language=ms + accent=malaysian)
        const libMap = new Map<string, (typeof msVoices)[0]>()
        for (const v of [...msVoices, ...accentVoices]) libMap.set(v.voice_id, v)

        const libraryVoices: ElevenLabsVoice[] = Array.from(libMap.values()).map((v) => ({
          voice_id:    v.voice_id,
          name:        v.name,
          category:    'professional' as const,
          labels:      { gender: v.gender ?? '', accent: 'malaysian', language: 'ms' },
          preview_url: v.preview_url,
        }))

        // Cloned first (user-owned), then Malaysian library
        const allVoices = [...cloned, ...libraryVoices]
        setVoices(allVoices)
        if (!selectedVoiceId && allVoices.length > 0) setSelectedVoiceId(allVoices[0].voice_id)
      })
      .catch((err) => {
        console.error('[loadVoices] failed:', err)
        addToast('Không tải được danh sách giọng — kiểm tra ElevenLabs key', 'error')
      })
      .finally(() => setLoadingVoices(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevenLabsApiKey])

  // Cleanup blob URLs on unmount
  useEffect(() => () => {
    if (previewVoiceUrl?.startsWith('blob:')) URL.revokeObjectURL(previewVoiceUrl)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Persistence: restore on mount ─────────────────────────────────────────
  // Loads saved pipeline state from localStorage. Skips blob: URLs (they die
  // on reload). For phases that were mid-task (running-*), converts to 'failed'
  // so user can retry that specific step rather than losing all upstream work.
  useEffect(() => {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as PersistedState
      if (saved.version !== 1) { localStorage.removeItem(CACHE_KEY); return }

      setSelectedScriptId(saved.selectedScriptId || '')
      setScript(saved.script || '')
      setSelectedModelId(saved.selectedModelId || '')
      setSelectedProductId(saved.selectedProductId || '')
      if (saved.selectedVoiceId) setSelectedVoiceId(saved.selectedVoiceId)

      // Filter out blob: URLs (invalid after reload) from preview state
      const safeUrl = (u: string | null | undefined) => (u && !u.startsWith('blob:') ? u : null)
      setPreviewSegments(saved.previewSegments ?? [])
      setPreviewVoiceUrl(safeUrl(saved.previewVoiceUrl))
      setPreviewAvatarUrl(safeUrl(saved.previewAvatarUrl))
      setPreviewBrollImageUrls((saved.previewBrollImageUrls ?? []).map(safeUrl))
      setPreviewBrollUrls((saved.previewBrollUrls ?? []).map(safeUrl))
      setPreviewBgUrl(safeUrl(saved.previewBgUrl))
      setRefVideoAnalysis(saved.refVideoAnalysis ?? null)
      setRefVideoName(saved.refVideoName ?? '')
      setSelectedTemplateId(saved.selectedTemplateId ?? '')
      setHistory(saved.history ?? [])

      // Restore pipeData (Blob field excluded — re-fetch via assetId if needed)
      pipeRef.current = saved.pipeData as Partial<PipeData>

      // Restore phase. If we were mid-task, convert to 'failed' so user retries
      // just that step instead of the pipeline being half-broken.
      let restoredPhase = saved.phase
      if (restoredPhase.startsWith('running-')) {
        setPhaseError('Tab đã được reload giữa chừng — bấm "Tạo lại" để chạy lại bước này.')
        restoredPhase = 'failed'
      }
      setPhase(restoredPhase)

      // Async: refresh expired Supabase signed URLs from their assetIds
      const p = pipeRef.current
      if (p.audioAssetId) {
        getUrl(p.audioAssetId).then((url) => {
          if (url) {
            pipeRef.current.voiceUrl = url
            if (!safeUrl(saved.previewVoiceUrl)) setPreviewVoiceUrl(url)
          }
        }).catch(() => {})
      }
      if (p.finalAssetId) {
        getUrl(p.finalAssetId).then((url) => {
          if (url) pipeRef.current.finalVideoUrl = url
        }).catch(() => {})
      }
    } catch (err) {
      console.error('[restore] failed, clearing cache:', err)
      localStorage.removeItem(CACHE_KEY)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Persistence: save on every meaningful state change ────────────────────
  useEffect(() => {
    // Skip writing when nothing has happened yet (idle + empty state)
    if (phase === 'idle' && previewSegments.length === 0 && history.length === 0 && !script) return

    try {
      // Strip audioBlob — Blob isn't JSON-serializable and the data is on
      // Supabase via audioAssetId anyway
      const pipeDataCopy: Omit<Partial<PipeData>, 'audioBlob'> = { ...pipeRef.current }
      // @ts-expect-error — explicit drop of Blob field
      delete pipeDataCopy.audioBlob

      const state: PersistedState = {
        version:  1,
        savedAt:  Date.now(),
        selectedScriptId, script, selectedModelId, selectedProductId, selectedVoiceId,
        phase, phaseError,
        pipeData: pipeDataCopy,
        previewSegments, previewVoiceUrl, previewAvatarUrl,
        previewBrollImageUrls, previewBrollUrls, previewBgUrl,
        refVideoAnalysis, refVideoName, selectedTemplateId,
        history,
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(state))
    } catch (err) {
      console.error('[saveCache] failed:', err)
    }
  }, [
    phase, phaseError,
    previewSegments, previewVoiceUrl, previewAvatarUrl,
    previewBrollImageUrls, previewBrollUrls, previewBgUrl,
    refVideoAnalysis, refVideoName, selectedTemplateId,
    history,
    selectedScriptId, script, selectedModelId, selectedProductId, selectedVoiceId,
  ])

  // ── Input handlers ───────────────────────────────────────────────────────

  const handleSelectScript = (id: string, text: string) => {
    setSelectedScriptId(id)
    setScript(text)
  }

  const handleToggleProduct = (id: string) => {
    setSelectedProductId((prev) => prev === id ? '' : id)
  }

  // ── Ad Win Template picker ──────────────────────────────────────────────

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (!templateId) {
      setRefVideoAnalysis(null)
      setRefVideoName('')
      return
    }
    const template = adTemplates.find((t) => t.id === templateId)
    if (template) {
      setRefVideoAnalysis(template.analysisText)
      setRefVideoName(template.name)
      addToast(`✓ Đã chọn Mẫu ADS Win "${template.name}"`)
    }
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

  // Navigate back to the previous review state. All prior results stay in
  // pipeRef + preview states, so the previous step's full preview reappears.
  const goBackToPreviousReview = () => {
    if (phase === 'review-brollimg')      setPhase('review-parse')
    else if (phase === 'review-broll')    setPhase('review-brollimg')
    else if (phase === 'review-voice')    setPhase('review-broll')
    else if (phase === 'review-avatar')   setPhase('review-voice')
    else if (phase === 'review-bg')       setPhase('review-avatar')
  }

  const handleReset = () => {
    if (previewVoiceUrl?.startsWith('blob:')) URL.revokeObjectURL(previewVoiceUrl)
    localStorage.removeItem(CACHE_KEY)   // wipe persisted pipeline state
    pipeRef.current = {}
    setPhase('idle')
    setPhaseDetail('')
    setPhaseProgress(0)
    setPhaseError(null)
    setPreviewSegments([])
    setPreviewVoiceUrl(null)
    setPreviewAvatarUrl(null)
    setPreviewBrollImageUrls([])
    setRegeneratingImageIndices(new Set())
    setPreviewBrollUrls([])
    setGeneratingBrollIndices(new Set())
    setPreviewBgUrl(null)
    // Reference video stays — user can build multiple videos with same reference
  }

  // ── Step 2: Storyboard from audio + script ────────────────────────────────
  // Runs AFTER voice so we have real audio duration and segments time exactly.
  // Uses cinematic-director prompt to generate VISUALLY SPECIFIC scene prompts
  // matching the actual content of each voice line.

  const runParse = async () => {
    // Voice now runs LATER (after B-roll). We estimate audio duration from
    // char count (~14 chars/sec at 1.1x speed for Malay/Vietnamese). The
    // voice step will RE-TIME segments based on actual audio duration later.
    const audioDuration = script.length / 14
    if (!script.trim()) { setPhaseError('Thiếu script'); setPhase('failed'); return }

    // Initialize job metadata on first run (moved here since parse is now step 1)
    if (!pipeRef.current.jobId) {
      const voiceName = voices.find((v) => v.voice_id === selectedVoiceId)?.name ?? selectedVoiceId
      const jobName = (scripts.find((s) => s.id === selectedScriptId)?.title || script.slice(0, 40)).trim()
      pipeRef.current.jobId = crypto.randomUUID()
      pipeRef.current.jobName = jobName
      pipeRef.current.voiceName = voiceName
    }

    setPhase('running-parse')
    setPhaseError(null)
    setPhaseDetail('Đang đọc ảnh avatar + sản phẩm...')
    const stopProgress = startTimedProgress(30 * 1000) // ~30s estimate for Pro vision call

    // ── Collect reference images so Gemini Vision can SEE the actual product
    //    appearance (capsule/tablet/bottle/sachet/cream/etc.) and avatar style
    //    before writing prompts. Without this, the AI guesses based on script
    //    wording and often hallucinates the wrong product form.
    const referenceImages: Array<{ inlineData: { mimeType: string; data: string } }> = []
    const refLabels: string[] = []   // for the prompt text — tells Gemini what each image is

    // Avatar reference (always present — required by canStart)
    const model = models.find((m) => m.id === selectedModelId)
    const avatarSrc = manualAvatarUrl ?? model?.characterImage ?? ''
    if (avatarSrc) {
      const img = await getImageBytes(avatarSrc)
      if (img) {
        referenceImages.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } })
        refLabels.push('AVATAR (the content creator who appears in the video)')
      }
    }

    // Product references (single bank + up to 4 manual uploads)
    const productRefs: string[] = []
    const bankProduct = selectedProductId ? products.find((p) => p.id === selectedProductId) : null
    if (bankProduct?.productImage) productRefs.push(bankProduct.productImage)
    for (const mp of manualProducts) productRefs.push(mp.blobUrl)

    for (const ref of productRefs.slice(0, 4)) {
      const img = await getImageBytes(ref)
      if (img) {
        referenceImages.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } })
        refLabels.push('PRODUCT photo — analyze form factor, packaging, color, branding')
      }
    }

    // Rich product marketing context (only if user picked from bank — manual
    // uploads have no metadata). Gives Gemini the WHY behind each scene:
    // not just "what does product look like" but "what pain does it solve,
    // who buys it, what's the offer". Storyboard quality jumps significantly.
    const productContextBlock = bankProduct ? `
═══════════════════════════════════════════════════════════════
PRODUCT MARKETING CONTEXT (use this to inform every shot's emotional beat)
═══════════════════════════════════════════════════════════════
Product name: ${bankProduct.productName}
${bankProduct.productDescription ? `Description: ${bankProduct.productDescription}` : ''}
${bankProduct.targetMarket       ? `Target market: ${bankProduct.targetMarket}` : ''}
${bankProduct.painPoints         ? `Pain points the product solves: ${bankProduct.painPoints}` : ''}
${bankProduct.usps               ? `Unique selling points: ${bankProduct.usps}` : ''}
${bankProduct.benefits           ? `Benefits to user: ${bankProduct.benefits}` : ''}
${bankProduct.offer              ? `Offer / pricing: ${bankProduct.offer}` : ''}
${bankProduct.ingredients        ? `Key ingredients / active components: ${bankProduct.ingredients}` : ''}

USE THIS CONTEXT TO:
- For "pain point" segments: visualize the SPECIFIC pain points listed above
  (don't invent generic pain — match the documented ones)
- For "transformation" segments: visualize the SPECIFIC benefits listed above
- For "product reveal" segments: highlight the documented USPs visually
- For "social proof / closing" segments: hint at the offer urgency if relevant
- Match the avatar's demographic to the target market (age, lifestyle context)

═══════════════════════════════════════════════════════════════
` : ''


    setPhaseDetail(`Gemini Pro analyzing ${referenceImages.length} ảnh + script → storyboard...`)

    const imageManifest = refLabels.length > 0
      ? `Reference images attached (in order):\n${refLabels.map((l, i) => `[Image ${i + 1}] ${l}`).join('\n')}\n\nCRITICAL: First, look carefully at the product image(s). Identify the EXACT form factor (capsule / tablet / powder sachet / liquid bottle / cream tube / spray / etc.), packaging style, color, and branding. Your prompts MUST describe the product as it ACTUALLY APPEARS in the image — do not invent a different form even if the script's wording is ambiguous.\n\nExample: If you see capsules in a bottle but the script says "sachet", your prompt should still describe a BOTTLE of CAPSULES (the script may be loosely translated or using a generic term).\n\nFor avatar: every shot featuring a person should match the avatar's apparent age, ethnicity, style, and clothing as seen in the reference image.\n\n`
      : ''

    // If user uploaded a winning ad reference, inject its analysis as the
    // PRIMARY style guide — Gemini must match this proven format exactly,
    // adapted to the new product + Malaysian market context.
    const referenceStyleBlock = refVideoAnalysis ? `
═══════════════════════════════════════════════════════════════════
🏆 WINNING AD STYLE REFERENCE (user uploaded a proven UGC ad to mimic)
═══════════════════════════════════════════════════════════════════
The user wants the generated UGC video to MATCH the visual style, composition,
pacing, and emotional arc of this proven winning ad. The reference ad may be
in English/Vietnamese/Malay — extract STYLE only, ignore the original product.

REFERENCE AD ANALYSIS:
${refVideoAnalysis}

YOUR JOB: Mirror this winning ad's style exactly:
- Use the same SHOT TYPES, AVATAR POSITIONING, FRAMING for each beat
- Match the PACING (segment lengths and cut frequency)
- Replicate the EMOTIONAL ARC progression
- Adopt the CAMERA MOVEMENT style
- Use the same LIGHTING aesthetic
- Apply same CAPTION/OVERLAY style cues

ADAPT to the NEW context:
- Product: ${products.find((p) => p.id === selectedProductId)?.productName ?? 'the selected product (see reference images)'}
- Market: Malaysia / SEA — adapt to Malaysian female lifestyle, hijab-friendly settings
- Avatar: matches the uploaded reference avatar image
- Language of dialogue: Malay (keep the script's original language)
═══════════════════════════════════════════════════════════════════

` : ''

    const parsePrompt = `${imageManifest}${productContextBlock}${referenceStyleBlock}You are a senior UGC video director creating a cinematic storyboard.

The voiceover is ${audioDuration.toFixed(1)} seconds long. Split the script into 8-12 segments matching natural pause/sentence boundaries. Each segment should be 4-8 seconds.

═══════════════════════════════════════════════════════════════════
B-ROLL COMPOSITION (hybrid format — avatar in main frame + lip-sync overlay)
═══════════════════════════════════════════════════════════════════
The final video has TWO visual layers composited by Shotstack:

  LAYER 1 (main B-roll, full-screen): the avatar (matching reference image)
    performing actions, showing expressions, holding the product — visually
    illustrating what the voiceover is saying at that moment.

  LAYER 2 (small corner inset, bottom-right): the same avatar's TALKING
    HEAD lip-syncing to the voice precisely (generated separately by Kling
    Avatar in step 6). This is the credibility anchor.

YOUR JOB: write the B-roll prompt for LAYER 1 only.

EVERY B-roll image must include the avatar (matching the reference image)
doing the specific action / showing the specific expression the script is
describing at that moment. Examples:
- Pain segment → avatar holding stomach, painful face, food untouched
- Failed-solutions → avatar examining medication bottles, frustrated
- Discovery → avatar holding the product, hopeful smile
- Transformation → avatar eating happily, energetic walk
- CTA → avatar holding product, confident smile to camera

DO NOT add the avatar in a corner — that's the lip-sync overlay added later.
The B-roll image should be full-frame composition with the avatar as the
main subject performing the action.

IDENTITY: Always describe the avatar as "young Asian woman in beige hijab,
matching reference" (or similar, per the actual reference). The avatar's
physical traits will be locked via a separate description injected later.

═══════════════════════════════════════════════════════════════════
STRUCTURAL ARC (most successful UGC supplement ads follow this beat order)
═══════════════════════════════════════════════════════════════════
1. HOOK (0-4s):      Discovery teaser → curiosity + main product
2. PAIN (4-14s):     Personal pain story → user emotionally suffering
3. FAILED (14-21s):  What user tried before that didn't work
4. DISCOVERY (21-28s): Found THIS product → turning point reveal
5. HOW-IT-WORKS (28-37s): Mechanism + first positive result
6. SCIENCE (37-46s): Authority/credibility → benefits explained
7. TRANSFORM (46-54s): Life change — user thriving now
8. CTA (54-60s):     Hero product close + transformation summary

Match each script segment to the closest beat. The script may be loosely
adapted — your job is to recognize which beat each segment is fulfilling.

═══════════════════════════════════════════════════════════════════
EXAMPLES — avatar (matching reference) doing actions in main frame
═══════════════════════════════════════════════════════════════════
Voice "Dulu perut saya sakit sangat-sangat, sampai tak boleh nak enjoy makan dah"
→ "Medium close-up of a young Asian woman in a beige hijab (matching reference avatar) sitting at a wooden dining table, one hand pressed firmly on her stomach with a clearly pained expression, brow furrowed. A plate of untouched curry and rice in soft focus foreground. Warm evening tungsten lighting. Authentic UGC documentary aesthetic, photorealistic, vertical 9:16."

Voice "Tiap kali makan, rasa seksa sangat"
→ "Over-the-shoulder medium shot of the same young Asian woman in beige hijab pushing away a half-eaten plate at a restaurant table, head slightly tilted down in defeat. Warm restaurant lighting, blurred diners in background. Genuine emotional UGC moment, photorealistic, vertical 9:16."

Voice "Macam-macam saya dah cuba: ubat gastrik, ubah diet"
→ "Medium shot of the same young Asian woman in beige hijab standing at a bathroom counter examining a cluttered row of gastric medicine bottles, antacid blister packs, and diet books, with a frustrated tired expression. Cool fluorescent overhead lighting. Documentary realism, photorealistic, vertical 9:16."

Voice "Tapi semua berubah bila saya jumpa satu benda ni: INFINITY PROBIOTICS PLUS"
→ "Hero close-up: the same young Asian woman in beige hijab smiling brightly and holding up an INFINITY PROBIOTICS PLUS supplement bottle (matching reference product) towards the camera with both hands. Bright modern kitchen background, soft natural window daylight catching the label. Hopeful turning-point moment, premium UGC aesthetic, photorealistic, vertical 9:16."

Voice "Sekarang? Saya dah boleh enjoy makanan balik"
→ "Medium shot of the same young Asian woman in beige hijab at a sunny breakfast table, taking a satisfying bite of healthy food with closed-eye genuine pleasure. Warm golden morning light through kitchen window. Authentic UGC vibe, photorealistic, vertical 9:16."

Voice "Saya rasa lebih bertenaga pulak sekarang"
→ "Wide low-angle shot of the same young Asian woman in beige hijab walking briskly through a sunny morning park path, arms swinging naturally, bright empowered smile. Sun-flares through trees, vibrant green nature background. Vivid empowered ending shot, photorealistic, vertical 9:16."

Voice "INFINITY PROBIOTICS PLUS ni memang betul-betul dah ubah hidup saya"
→ "Final hero close-up: the same young Asian woman in beige hijab holding the INFINITY PROBIOTICS PLUS bottle (matching reference product) toward the camera, gentle confident smile, label fully readable. Warm honey-toned living-room lighting, blurred home background. Premium commercial UGC feel, photorealistic, vertical 9:16."

═══════════════════════════════════════════════════════════════════
RULES FOR YOUR brollPrompt OUTPUT
═══════════════════════════════════════════════════════════════════
- ALWAYS in English (image generator performs best in English)
- 60-120 words per prompt
- The AVATAR (matching reference image) is the main subject in EVERY shot —
  doing the action / showing the expression the script is describing
- Reference the avatar consistently: "young Asian woman in beige hijab"
  (or whatever matches the reference — adapt to the actual avatar)
- Reference the actual product when the segment mentions/handles it:
  "INFINITY PROBIOTICS PLUS supplement bottle (matching reference product)"
- DO NOT place avatar in a corner — that's the lip-sync overlay added later.
  Avatar = main subject, full-frame composition.
- "Photorealistic", "vertical 9:16" suffix on every prompt
  (captions will be added later by Shotstack)
- Match the segment's beat:
  HOOK → curious / discovery composition
  PAIN → avatar showing physical pain / frustration / sadness
  FAILED → avatar examining failed remedies, defeated
  DISCOVERY → avatar holding product with hope
  HOW-IT-WORKS → avatar taking the product / showing benefits
  SCIENCE → avatar with clean clinical aesthetic / examining label
  TRANSFORM → avatar happy, eating, active, smiling
  CTA → avatar hero shot holding product with confidence

Other rules:
- avatarPosition: alternate "left" / "right" each segment (Shotstack uses
  this for the lip-sync overlay placement when compositing)
- useProduct: true if segment mentions/references the product
- durationSec + startSec: distribute proportionally to text length, MUST
  sum to exactly ${audioDuration.toFixed(1)} seconds
- text: the EXACT original-language voice text for this segment
  (Vietnamese / Malay / English — DO NOT translate)

SCRIPT TO ADAPT:
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

    // Build parts: images FIRST so Gemini analyzes them before reading the prompt
    const parts = [...referenceImages, { text: parsePrompt }]

    // Attempt 1: Gemini Pro Vision (best creative reasoning + image analysis)
    if (geminiApiKey) {
      try {
        const raw = await directGeminiVision({
          apiKey: geminiApiKey,
          parts,
          model: 'gemini-2.5-pro',
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
          responseSchema: parseSchema,
        })
        parsed = JSON.parse(extractJson(raw)) as ParseResult
      } catch (e1) {
        console.warn('[parse] Pro attempt failed, falling back to Flash:', e1)
        setPhaseDetail('Pro bận → thử Flash...')

        try {
          const raw = await directGeminiVision({
            apiKey: geminiApiKey,
            parts,
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
      stopProgress()
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

    stopProgress()
    setPhaseProgress(100)
    setPhase('review-parse')
  }

  // Update a single segment's text in the review UI
  const handleEditSegmentText = (index: number, newText: string) => {
    setPreviewSegments((prev) => prev.map((s, i) => i === index ? { ...s, text: newText } : s))
  }

  // ── Helper: Gemini-powered expression injection ───────────────────────────
  // Adds ElevenLabs v3 audio tags + natural pacing markers to make the voice
  // sound human + emotional, not monotone. Tags like [excited], [sad],
  // [sighs], pauses with "..." and "—" for emphasis.

  const preprocessScriptForExpression = async (rawScript: string): Promise<string> => {
    if (!geminiApiKey) return rawScript

    const prompt = `You are a voice acting director for an authentic UGC product review video.
The script below will be voiced by AI. Currently it sounds monotone. Your job: insert ElevenLabs v3 audio tags + natural pacing markers so it sounds like a genuine human review with emotional variation.

INLINE RULES:
- Insert tags BEFORE the phrase: e.g. "[excited] This is amazing!"
- Available tags: [excited] [happy] [sad] [curious] [sighs] [chuckles] [whispers] [exclaims] [pauses]
- Use sparingly — only where emotion clearly shifts (every 1-3 sentences max, NOT every sentence)
- Natural pacing: use "..." for thoughtful pauses, "," for short breaths, "—" for emphasis
- DO NOT change actual words. Only ADD tags + pacing markers.
- Keep the original language exactly (Vietnamese / Malay / English / mixed)
- DO NOT translate

UGC AD ARC GUIDE (apply emotions based on context):
- Hook (intro/discovery teaser): [curious] or [excited]
- Pain story (suffering, frustration): [sad] or [sighs]
- Failed attempts: [sighs] frustrated tone
- Discovery (turning point): [excited]
- How it works (mechanism): [curious] or calm (no tag)
- Science / authority: calm (no tag)
- Transformation (relief, joy): [excited] [happy]
- CTA: confident, [excited]

ORIGINAL SCRIPT:
${rawScript}

Return ONLY the tagged script. No explanation, no markdown, no preamble.`

    try {
      const result = await directGeminiVision({
        apiKey: geminiApiKey,
        parts: [{ text: prompt }],
        model: 'gemini-2.5-flash',     // simple task — Flash is enough
        maxOutputTokens: 4096,
      })
      const cleaned = result.trim()
      // Sanity check: result should be roughly the same length (just with tags added)
      if (cleaned.length < rawScript.length * 0.8 || cleaned.length > rawScript.length * 2.5) {
        console.warn('[preprocessScript] suspicious output length, using original')
        return rawScript
      }
      return cleaned
    } catch (err) {
      console.warn('[preprocessScript] failed, using original:', err)
      return rawScript
    }
  }

  // ── Step 5: Generate voiceover (moved AFTER B-roll so user can test
  //   cheap B-roll quality before committing to TTS + Avatar lip-sync cost).
  //   After audio is generated, segments are re-timed based on actual
  //   audio duration (was previously estimated from char count in parse).

  const runVoice = async () => {
    if (!elevenLabsApiKey) { setPhaseError('Cần ElevenLabs API key'); setPhase('failed'); return }
    if (!pipeRef.current.segments) { setPhaseError('Thiếu segments — chạy Storyboard trước'); setPhase('failed'); return }

    setPhase('running-voice')
    setPhaseError(null)
    setPhaseDetail('Đang phân tích cảm xúc + thêm ngắt nghỉ tự nhiên...')
    setPhaseProgress(5)

    try {
      // Step 1a: Gemini Flash injects emotion tags + pacing markers into the
      // raw script so the v3 model has signals for natural expression.
      const expressiveScript = await preprocessScriptForExpression(script)
      setPhaseProgress(15)
      setPhaseDetail('Tạo voiceover với eleven_v3 (expressive)...')

      // Step 1b: TTS with eleven_v3 — supports inline audio tags, much more
      // expressive than v2. Lower stability (0.5) + style (0.4) for natural
      // emotional variation instead of robotic flat reading.
      // chunkSize 5000 ≈ ElevenLabs max-per-call → 99% scripts run single call.
      const { buffer: audioBuffer, mimeType } = await textToSpeechSmooth({
        apiKey: elevenLabsApiKey,
        voiceId: selectedVoiceId,
        text: expressiveScript,
        modelId: 'eleven_v3',                // new model — interprets audio tags
        stability: 0.5,                       // lower = more dynamic (was 0.75)
        similarity: 0.75,
        style: 0.4,                           // raised from 0 — expressive (was 0)
        speed: 1.1,
        outputFormat: 'mp3_44100_192',
        chunkSize: 5000,
        onProgress: (done, total) => {
          const pct = 15 + (done / total) * 75
          setPhaseProgress(pct)
          setPhaseDetail(total > 1
            ? `Tạo audio: ${done}/${total} chunks (eleven_v3, expressive)...`
            : `Tạo audio (eleven_v3 single call, cảm xúc tự nhiên)...`)
        },
      })
      setPhaseProgress(93)
      setPhaseDetail('Đang decode audio duration + upload Supabase (để survive F5)...')
      const audioDuration = await getAudioDuration(audioBuffer)
      const audioBlob = new Blob([audioBuffer], { type: mimeType })

      // Upload to Supabase IMMEDIATELY (was in resolve step). This way the
      // audio survives F5 / logout — we can fetch it back via audioAssetId.
      const audioAssetId = await saveAsset(audioBlob, mimeType)
      const voiceUrl = await getUrl(audioAssetId)
      if (!voiceUrl) throw new Error('Không lấy được URL audio sau khi upload Supabase')

      pipeRef.current.audioDuration = audioDuration
      pipeRef.current.audioBlob = audioBlob       // in-memory only
      pipeRef.current.audioAssetId = audioAssetId // persisted across reload
      pipeRef.current.voiceUrl = voiceUrl         // refreshable via assetId

      // Re-time segments based on REAL audio duration (previously estimated
      // from char count in parse step). Distribute proportionally to text length.
      const segments = pipeRef.current.segments ?? []
      const totalChars = segments.reduce((s, seg) => s + seg.text.length, 0)
      let cursor = 0
      const timedSegments: ScriptSegment[] = segments.map((seg) => {
        const ratio    = totalChars > 0 ? seg.text.length / totalChars : 1 / segments.length
        const duration = audioDuration * ratio
        const ts = { ...seg, startSec: cursor, durationSec: duration }
        cursor += duration
        return ts
      })
      pipeRef.current.timedSegments = timedSegments
      pipeRef.current.totalEstimatedSec = audioDuration
      setPreviewSegments([...timedSegments])

      // Preview URL: Supabase signed URL (persists vs blob: URL which dies on reload)
      if (previewVoiceUrl?.startsWith('blob:')) URL.revokeObjectURL(previewVoiceUrl)
      setPreviewVoiceUrl(voiceUrl)

      setPhaseProgress(100)
      setPhase('review-voice')
    } catch (err) {
      setPhaseError(err instanceof Error ? err.message : String(err))
      setPhase('failed')
    }
  }

  // ── Step 3: Resolve URLs (automatic, no review) ─────────────────────────

  const runResolve = async () => {
    if (!pipeRef.current.segments) { setPhaseError('Thiếu segments — chạy Storyboard trước'); setPhase('failed'); return }

    setPhase('running-resolve')
    setPhaseError(null)
    setPhaseDetail('Resolve URL ảnh avatar...')
    setPhaseProgress(20)

    try {
      // Voice now runs LATER (step 5), so this step only handles image URLs.
      // Audio upload happens in runVoice after the user approves B-roll quality.
      setPhaseProgress(40)

      // Resolve avatar image (20%)
      const model = models.find((m) => m.id === selectedModelId)
      const avatarSrc = manualAvatarUrl ?? model?.characterImage ?? ''
      const avatarImageUrl = await resolveImageUrl(avatarSrc)
      if (!avatarImageUrl) throw new Error('Không lấy được URL ảnh Avatar AI')
      pipeRef.current.avatarImageUrl = avatarImageUrl

      // Resolve avatar VARIANTS (if any) — these are alternate angles of the
      // same avatar used as additional reference images for identity-lock
      // during B-roll image gen. Only present for bank-picked avatars; manual
      // uploads don't have variants.
      const avatarVariantUrls: string[] = []
      if (model?.variants && model.variants.length > 0) {
        for (const v of model.variants) {
          const url = await resolveImageUrl(v.imageUrl)
          if (url) avatarVariantUrls.push(url)
        }
      }
      pipeRef.current.avatarVariantUrls = avatarVariantUrls
      if (avatarVariantUrls.length > 0) {
        console.log(`[resolve] Avatar has ${avatarVariantUrls.length} variants — using as identity-lock references`)
      }

      setPhaseProgress(60)
      setPhaseDetail('Resolve URL ảnh sản phẩm...')

      // Resolve product images — track progress per image
      const productImageUrls: string[] = []
      const allProductRefs: string[] = []
      if (selectedProductId) {
        const prod = products.find((p) => p.id === selectedProductId)
        if (prod?.productImage) allProductRefs.push(prod.productImage)
      }
      for (const mp of manualProducts) allProductRefs.push(mp.blobUrl)

      let manualFailCount = 0
      for (let i = 0; i < allProductRefs.length; i++) {
        const url = await resolveImageUrl(allProductRefs[i])
        if (url) productImageUrls.push(url)
        else manualFailCount++
        // 60% → 95% over product image count
        setPhaseProgress(60 + ((i + 1) / Math.max(allProductRefs.length, 1)) * 35)
      }
      if (manualFailCount > 0) {
        addToast(`${manualFailCount} ảnh đính kèm không upload được`, 'error')
      }
      pipeRef.current.productImageUrls = productImageUrls
      setPhaseProgress(70)

      // Lock physical descriptions via Gemini Vision — these exact texts get
      // injected into every B-roll image prompt to keep BOTH the avatar AND
      // the product visually consistent across all generated images.
      // (Without this, GPT Image 2 drifts: 9 different faces, 9 different
      // product variants — destroying UGC review authenticity.)
      if (geminiApiKey) {
        // 1) Avatar description (the person who appears full-frame in B-roll)
        setPhaseDetail('Phân tích chi tiết avatar (lock face/clothing)...')
        try {
          const avatarImg = await getImageBytes(avatarImageUrl)
          if (avatarImg) {
            const avatarDescRaw = await directGeminiVision({
              apiKey: geminiApiKey,
              parts: [
                { inlineData: { mimeType: avatarImg.mimeType, data: avatarImg.base64 } },
                { text: `You are a casting director writing a precise physical description of this avatar for image-generation continuity. This SAME person must appear IDENTICALLY in 9 different generated images of a UGC product review.

Describe the avatar's physical appearance in 2-3 concise sentences. Include:
- Approximate age, ethnicity, gender
- Face shape and complexion (skin tone, distinguishing features like dimples, freckles, eye shape)
- Hair OR hijab (if any) — exact color, style, coverage / length
- Eye color, eyebrow style
- Wardrobe in the reference shot — exact colors, neckline, fabric vibe (this same wardrobe should appear across all shots for continuity)
- Any accessories (glasses, earrings if visible)

Return ONLY the description as plain text, no preamble, no markdown. Write it in a way image-gen models can use directly — concrete physical adjectives.` },
              ],
              model: 'gemini-2.5-flash',
              maxOutputTokens: 512,
            })
            pipeRef.current.avatarDescription = avatarDescRaw.trim()
            console.log('[resolve] avatar description locked:', pipeRef.current.avatarDescription)
          }
        } catch (err) {
          console.warn('[resolve] avatar description analysis failed:', err)
        }
        setPhaseProgress(85)

        // 2) Product description (when the avatar is handling / showing product)
        if (productImageUrls.length > 0) {
          setPhaseDetail('Phân tích chi tiết sản phẩm (lock bottle/label)...')
          try {
            const productImg = await getImageBytes(productImageUrls[0])
            if (productImg) {
              const productDescRaw = await directGeminiVision({
                apiKey: geminiApiKey,
                parts: [
                  { inlineData: { mimeType: productImg.mimeType, data: productImg.base64 } },
                  { text: `You are a casting director writing a precise physical description for image-generation continuity. This product will appear in multiple generated images and must look IDENTICAL each time.

Describe the product's physical appearance in 2-3 concise sentences. Include:
- Container type (bottle / jar / box / sachet) — exact material and color (e.g. "dark amber glass", "white matte plastic")
- Label design — colors, dominant text (product name, capsule count if visible), logo placement, any country flags or certification icons
- Capsule/tablet visibility — color, count visible if any
- Any accompanying retail box and its appearance
- Distinguishing features that must NOT be invented away

Return ONLY the description as plain text, no preamble, no markdown.` },
                ],
                model: 'gemini-2.5-flash',
                maxOutputTokens: 512,
              })
              pipeRef.current.productDescription = productDescRaw.trim()
              console.log('[resolve] product description locked:', pipeRef.current.productDescription)
            }
          } catch (err) {
            console.warn('[resolve] product description analysis failed:', err)
          }
        }
      }
      setPhaseProgress(100)

      // Auto-proceed to B-roll Images (cheap, test-first cost optimization)
      await runBrollImages()
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
    const stopProgress = startTimedProgress(4 * 60 * 1000)  // ~4 min estimate

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
      stopProgress()
      setPhaseProgress(100)
      setPhase('review-avatar')
    } catch (err) {
      stopProgress()
      setPhaseError(err instanceof Error ? err.message : String(err))
      setPhase('failed')
    }
  }

  // ── Step 5: B-roll Static Images ─────────────────────────────────────────
  // Why: cheap ($0.04/image) and reviewable BEFORE committing to expensive
  // video generation ($0.35/clip). User can regen bad images individually.

  // ── B-Roll prompt builder for KIE GPT-4o Image API ───────────────────────
  // Endpoint: /gpt4o-image/generate with filesUrl = [PRODUCT, AVATAR].
  // Prompt explicitly references "FIRST reference image" (= product) and
  // "SECOND reference image" (= avatar) so the model knows what to copy from
  // each input. Without this explicit indexing, gpt-image-1 often invents
  // a different person + product from imagination.
  const buildImagePromptGPT = (seg: ScriptSegment): string => {
    const avatarDesc  = pipeRef.current.avatarDescription
    const productDesc = pipeRef.current.productDescription
    const bankProduct = selectedProductId ? products.find((p) => p.id === selectedProductId) : null
    const actualProductName = bankProduct?.productName ?? 'the product'
    const hasProductRef = (pipeRef.current.productImageUrls?.length ?? 0) > 0

    // Strip Ad Win Template brand mentions so the model doesn't lock onto the wrong product
    let scene = seg.brollPrompt
    if (hasProductRef && bankProduct) {
      scene = scene
        .replace(/\bINFINITY\s+PROBIOTICS(?:\s+PLUS)?\b/gi, actualProductName)
        .replace(/\bsupplement\s+bottle\b/gi, 'product container')
        .replace(/\bprobiotic\s+bottle\b/gi, 'product container')
        .replace(/\bbottle\s+of\s+\w+\b/gi, 'product container')
    }

    const characterDesc = avatarDesc
      ? avatarDesc.split('\n').slice(0, 4).join(', ')
      : 'young Malaysian woman in her late 20s, warm beige hijab, modest casual outfit, warm tan skin'

    // Explicit image-index references — critical for gpt-image-1 edit endpoint
    const sceneInvolvesProduct = (seg.useProduct || /product|hold|show|bottle|jar|container/i.test(seg.brollPrompt)) && hasProductRef

    const head = sceneInvolvesProduct
      ? `IMAGE-EDITING TASK: Combine the two attached reference images into one new photo.

THE PERSON IS: the woman from the SECOND attached reference image. KEEP HER FACE EXACTLY (same face shape, eyes, eyebrows, nose, lips, jawline, skin tone, hijab/hair, age). Recognizably the same individual — not a similar-looking different person. Additional locked description: ${characterDesc}.

THE PRODUCT IS: the EXACT product from the FIRST attached reference image (named "${actualProductName}"). KEEP THE PRODUCT EXACTLY: same container type (jar/box/bottle/tube as shown in the reference), same shape proportions, same colors, same label, same branding text and logo. Do NOT substitute any other product. Do NOT invent a generic supplement bottle.${productDesc ? ` Locked product description: ${productDesc}` : ''}

SCENE: ${scene}`
      : `IMAGE-EDITING TASK: Use the attached reference image as the subject for a new photo.

THE PERSON IS: the woman from the attached reference image. KEEP HER FACE EXACTLY (same face shape, eyes, nose, mouth, skin tone, hijab/hair, age). Same individual. Additional locked description: ${characterDesc}.

SCENE: ${scene}`

    const style = `

STYLE: Authentic UGC smartphone video frame (shot on iPhone), vertical framing, completely unedited natural look, sharp focus across the entire frame, zero bokeh, zero depth of field, natural ambient lighting (window light / room light), no professional studio lighting, no AI-generated sheen, no watermarks, no text overlay, photorealistic, film-quality realism.`

    return head + style
  }

  // Generate ONE B-Roll image via KIE.ai's GPT Image 2 (same model as Avatar AI)
  // Avatar + product images are passed as referenceImageUrls for identity lock.
  // THROWS on error — callers must catch and decide how to surface the message.
  const generateOneImage = async (_i: number, seg: ScriptSegment): Promise<string> => {
    if (!kieApiKey.trim()) {
      throw new Error('Thiếu KIE.ai API key — vào Cài đặt → KIE.AI để thêm.')
    }

    const prompt = buildImagePromptGPT(seg)

    // ── Reference images (filesUrl) for GPT-4o image-edit endpoint ──────
    // Order MATTERS — filesUrl[0] = PRODUCT (priority anchor for product identity)
    //                 filesUrl[1] = AVATAR (face identity)
    // The new prompt explicitly says "FIRST reference image = product, SECOND =
    // person". Max 5 references — we use 2 for stronger per-slot weight.
    const { avatarImageUrl, productImageUrls } = pipeRef.current
    const filesUrl: string[] = []
    if (productImageUrls && productImageUrls.length > 0) {
      filesUrl.push(productImageUrls[0])
    }
    if (avatarImageUrl) filesUrl.push(avatarImageUrl)

    // Note: GPT-4o image endpoint supports only 1:1, 3:2, 2:3 — we use 2:3 for
    // vertical 9:16-ish framing (closest available).
    const remoteUrl = await generateGpt4oImage({
      apiKey: kieApiKey,
      prompt,
      filesUrl: filesUrl.length > 0 ? filesUrl : undefined,
      size: '2:3',
      timeoutMs: 4 * 60 * 1000,
    })

    // Persist to asset store so the URL doesn't expire mid-pipeline
    const fetchRes = await fetch(remoteUrl)
    const blob = await fetchRes.blob()
    const assetId = await saveAsset(blob, blob.type || 'image/png')
    const publicUrl = await getUrl(assetId)
    if (!publicUrl) throw new Error('Không lấy được URL từ asset store')
    return publicUrl
  }

  const runBrollImages = async () => {
    if (!kieApiKey) { setPhaseError('Cần KIE.ai API key'); setPhase('failed'); return }
    const { timedSegments } = pipeRef.current
    if (!timedSegments?.length) { setPhaseError('Thiếu segments'); setPhase('failed'); return }

    setPhase('running-brollimg')
    setPhaseError(null)
    setPhaseProgress(0)
    setPhaseDetail(`Gen 0/${timedSegments.length} ảnh tĩnh song song (~30-60s)...`)

    try {
      const results: (string | null)[] = new Array(timedSegments.length).fill(null)
      let completed = 0
      const firstErrors: string[] = []   // collect distinct error reasons for user
      await Promise.all(timedSegments.map(async (seg, i) => {
        try {
          results[i] = await generateOneImage(i, seg)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[brollImage ${i}] failed:`, msg)
          if (!firstErrors.includes(msg)) firstErrors.push(msg)
          results[i] = null
        }
        completed++
        const pct = (completed / timedSegments.length) * 100
        setPhaseProgress(pct)
        setPhaseDetail(`Gen ${completed}/${timedSegments.length} ảnh tĩnh...`)
      }))

      // If all/most failed, surface the FIRST distinct error message so user sees why
      const successCount = results.filter(Boolean).length
      if (successCount === 0 && firstErrors.length > 0) {
        addToast(`Tất cả ${results.length} ảnh fail: ${firstErrors[0].slice(0, 150)}`, 'error')
      } else if (successCount < results.length && firstErrors.length > 0) {
        addToast(`${results.length - successCount}/${results.length} ảnh fail: ${firstErrors[0].slice(0, 100)}`, 'error')
      }

      pipeRef.current.brollImageUrls = results
      setPreviewBrollImageUrls([...results])
      setPhaseProgress(100)
      setPhase('review-brollimg')
    } catch (err) {
      setPhaseError(err instanceof Error ? err.message : String(err))
      setPhase('failed')
    }
  }

  // Regenerate just one image (called from review screen)
  const regenerateOneImage = async (i: number) => {
    const { timedSegments } = pipeRef.current
    if (!timedSegments?.[i]) return

    setRegeneratingImageIndices((prev) => new Set(prev).add(i))
    try {
      const newUrl = await generateOneImage(i, timedSegments[i])
      setPreviewBrollImageUrls((prev) => {
        const next = [...prev]
        next[i] = newUrl
        if (pipeRef.current.brollImageUrls) pipeRef.current.brollImageUrls[i] = newUrl
        return next
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[regenerateOneImage ${i}] failed:`, msg)
      addToast(`Ảnh #${i + 1}: ${msg.slice(0, 150)}`, 'error')
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

  /** Build the motion prompt for a given segment — visible to user before they
   *  trigger per-clip generation. */
  const buildMotionPrompt = (seg: ScriptSegment): string => {
    return `${seg.brollPrompt}.
MOTION: Gentle cinematic camera motion only — slow push-in on key detail, or smooth slow pan across the setting. NO static frozen frames, NO jitter, NO sudden cuts. Maintain photorealistic UGC ad style. The avatar/speaker will be overlaid separately later — keep this scene without any visible speaker.`
  }

  /** Seedance 2 Fast supports clip durations of 5 / 8 / 10 / 12 seconds.
   *  Round to the NEAREST supported duration (not round-up) for cost
   *  optimization. Shotstack handles minor 0.3-0.5s mismatches gracefully:
   *  - clip shorter than segment → freeze-frame on last frame for the gap
   *  - clip longer than segment → trim the excess
   *  Both effects are imperceptible at < 0.5s, and we save ~50 cr per clip.
   *
   *  Breakpoints (midpoints between supported durations):
   *  - < 6.5s → 5    (4s segment closer to 5 than 8)
   *  - < 9s   → 8    (7s segment closer to 8 than 10)
   *  - < 11s  → 10   (10s segment exactly 10)
   *  - ≥ 11s  → 12   (max)
   */
  const pickClipDuration = (segmentDuration: number): 5 | 8 | 10 | 12 => {
    if (segmentDuration < 6.5) return 5
    if (segmentDuration < 9)   return 8
    if (segmentDuration < 11)  return 10
    return 12   // max for Seedance Fast
  }

  /** Approximate KIE credit cost for a Seedance 2 Fast 480p clip of N seconds.
   *  Scaling is roughly linear with duration. */
  const estimateClipCost = (clipDuration: 5 | 8 | 10 | 12): number => {
    const table = { 5: 85, 8: 135, 10: 170, 12: 205 }
    return table[clipDuration]
  }

  /** Generate ONE B-roll video clip for a given segment. Used by per-clip
   *  manual generation in review-broll — user clicks Gen on each card
   *  individually instead of all 9 firing in parallel. */
  const generateOneBrollVideo = async (i: number): Promise<void> => {
    if (!kieApiKey) { addToast('Cần KIE.ai API key', 'error'); return }
    const { timedSegments, brollImageUrls } = pipeRef.current
    if (!timedSegments?.[i]) { addToast(`Thiếu segment #${i + 1}`, 'error'); return }

    const seg = timedSegments[i]
    const startImage = brollImageUrls?.[i]
    if (!startImage) { addToast(`Đoạn #${i + 1} chưa có ảnh tĩnh — bỏ qua`, 'error'); return }

    setGeneratingBrollIndices((prev) => new Set(prev).add(i))
    const motionPrompt = buildMotionPrompt(seg)
    const clipDuration = pickClipDuration(seg.durationSec)   // 5 / 8 / 10 / 12

    try {
      const { taskId } = await generateVideoJob({
        apiKey: kieApiKey,
        jobModelId: 'bytedance/seedance-2-fast',
        prompt: motionPrompt,
        aspectRatio: '9:16',
        resolution: '480p',
        duration: clipDuration,
        startFrameUrl: startImage,
      })
      const start = Date.now()
      let resultUrl: string | null = null
      while (Date.now() - start < 8 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 5000))
        const s = await getVideoJobStatus({ apiKey: kieApiKey, taskId })
        if (s.status === 'completed' && s.videoUrl) { resultUrl = s.videoUrl; break }
        if (s.status === 'failed') break
      }

      if (resultUrl) {
        setPreviewBrollUrls((prev) => {
          const next = [...prev]
          next[i] = resultUrl
          return next
        })
        if (!pipeRef.current.brollResults) pipeRef.current.brollResults = []
        pipeRef.current.brollResults[i] = resultUrl
        addToast(`✓ Clip #${i + 1} đã gen xong`)
      } else {
        addToast(`Clip #${i + 1} gen thất bại — thử lại`, 'error')
      }
    } catch (err) {
      console.error(`[brollVideo ${i}] failed:`, err)
      addToast(`Clip #${i + 1} lỗi: ${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}`, 'error')
    } finally {
      setGeneratingBrollIndices((prev) => {
        const next = new Set(prev)
        next.delete(i)
        return next
      })
    }
  }

  const runBroll = async () => {
    const { timedSegments } = pipeRef.current
    if (!timedSegments?.length) { setPhaseError('Thiếu segments'); setPhase('failed'); return }

    // NO auto-generation — user generates each clip manually via the review UI.
    // Initialize empty results array and transition straight to review state.
    const empty: (string | null)[] = new Array(timedSegments.length).fill(null)
    pipeRef.current.brollResults = empty
    setPreviewBrollUrls(empty)
    setPhaseProgress(100)
    setPhase('review-broll')
  }

  // ── Step 6: Background removal ───────────────────────────────────────────

  const runBg = async () => {
    if (!falApiKey) { setPhaseError('Cần fal.ai API key'); setPhase('failed'); return }
    const { avatarRawUrl } = pipeRef.current
    if (!avatarRawUrl) { setPhaseError('Thiếu avatar video'); setPhase('failed'); return }

    setPhase('running-bg')
    setPhaseError(null)
    setPhaseDetail('fal.ai đang xóa nền (~1-2 phút)...')
    const stopProgress = startTimedProgress(90 * 1000)  // ~1.5 min estimate

    try {
      const finalUrl = await removeVideoBackground({ apiKey: falApiKey, videoUrl: avatarRawUrl, outputFormat: 'mp4' })
      pipeRef.current.avatarFinalUrl = finalUrl
      setPreviewBgUrl(finalUrl)
      stopProgress()
      setPhaseProgress(100)
      setPhase('review-bg')
    } catch (err) {
      stopProgress()
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
    const stopProgress = startTimedProgress(3 * 60 * 1000)  // ~3 min estimate

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

      stopProgress()
      setPhaseProgress(100)
      setPhase('done')
      addToast('🎬 UGC Video đã build xong!')
    } catch (err) {
      stopProgress()
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

  // Mobile output-first (M5): once a build lands in history, collapse the
  // long left config panel so the user actually sees the pipeline / final
  // video. FAB re-opens config for re-tweaks between builds.
  const [mobileFormVisible, setMobileFormVisible] = useState(true)
  const prevHistoryLenRef = useRef(history.length)
  useEffect(() => {
    if (prevHistoryLenRef.current === 0 && history.length > 0) {
      setMobileFormVisible(false)
    }
    prevHistoryLenRef.current = history.length
  }, [history.length])
  const showInputOnMobile = history.length === 0 || mobileFormVisible

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col lg:flex-row bg-gradient-to-br from-violet-50/30 via-white to-purple-50/20">

      {/* ══ Left panel ══ */}
      <div className={`${showInputOnMobile ? 'flex' : 'hidden'} lg:flex w-full shrink-0 flex-col border-b border-black/8 lg:w-[440px] lg:border-b-0 lg:border-r`}>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/8 bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Film className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">UGC Video Builder</h2>
              <p className="text-xs text-white/70">Pipeline thủ công · review từng bước · tiết kiệm chi phí</p>
            </div>
          </div>
          <button
            onClick={onSwitchToV2}
            title="Thử Pipeline v2 BETA — AI Director với Master Frame workflow, giảm drift mặt/sản phẩm"
            className="flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Thử v2 BETA
          </button>
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

          {/* ─── Mẫu ADS Win đã lưu (replaces upload feature) ─── */}
          <div>
            <SectionLabel icon={Film}>Mẫu ADS Win đã lưu (tùy chọn)</SectionLabel>

            {adTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/30 px-3 py-4 text-center">
                <p className="text-xs text-violet-600">Chưa có Mẫu ADS Win nào</p>
                <p className="mt-1 text-[10px] text-violet-500">
                  Vào <strong>Phân tích QC</strong> → upload video ad win → click <strong>"Lưu thành Mẫu ADS Win"</strong>
                </p>
              </div>
            ) : (
              <>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  disabled={isBuilding}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-violet-300 disabled:opacity-50"
                >
                  <option value="">-- Không dùng template --</option>
                  {adTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                {refVideoAnalysis && (
                  <details className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-2 text-[10px]">
                    <summary className="cursor-pointer font-semibold text-emerald-700">
                      ✓ Đang dùng "{refVideoName}" — click để xem analysis sẽ inject vào storyboard
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-[9px] leading-relaxed text-gray-700">
                      {refVideoAnalysis}
                    </pre>
                  </details>
                )}
              </>
            )}

            <p className="mt-1.5 text-[10px] text-gray-400">
              Chọn 1 Mẫu ADS Win đã phân tích trước. AI sẽ đọc style + composition + pacing → áp dụng vào storyboard cho video Malaysia bạn build.
            </p>
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
              <>
                <select
                  value={selectedVoiceId}
                  onChange={(e) => setSelectedVoiceId(e.target.value)}
                  disabled={isBuilding}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-violet-300 disabled:opacity-50"
                >
                  <option value="">Chọn giọng đọc...</option>
                  {voices.filter((v) => v.category === 'cloned').length > 0 && (
                    <optgroup label="✨ Giọng đã clone (của bạn)">
                      {voices.filter((v) => v.category === 'cloned').map((v) => (
                        <option key={v.voice_id} value={v.voice_id}>
                          {v.name}{v.labels?.gender ? ` (${v.labels.gender})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {voices.filter((v) => v.category !== 'cloned').length > 0 && (
                    <optgroup label="🇲🇾 Thư viện giọng Malaysian">
                      {voices.filter((v) => v.category !== 'cloned').map((v) => (
                        <option key={v.voice_id} value={v.voice_id}>
                          {v.name}{v.labels?.gender ? ` (${v.labels.gender})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="mt-1 text-[10px] text-gray-400">
                  Chỉ hiện giọng đã clone + accent Malaysian. Đã ẩn American/other accents.
                </p>
              </>
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
              <span className="flex items-center justify-center gap-2"><Sparkles className="h-4 w-4" />Bắt đầu Build (Bước 1: Storyboard — Miễn phí)</span>
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
            {isIdle ? 'Pipeline 8 bước · ~1,474 KIE credit + ~$1.66 (EL+fal FLUX Ultra+fal BG+SS) · face lock 95%' : `Đang chạy · ~1,474 KIE credit + ~$1.66 ngoài KIE`}
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

            // Step 1: Storyboard (moved earlier)
            if (previewSegments.length > 0 && (activeNum > 1 || phase === 'done')) {
              cards.push(
                <CompletedStepCard
                  key="parse"
                  stepId="parse"
                  summary={`${previewSegments.length} cảnh quay · ${formatDuration(pipeRef.current.audioDuration ?? 0)} (ước lượng / re-timed sau Voice)`}
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

            // Step 2: Resolve (image URLs only — audio uploaded in voice step now)
            if (pipeRef.current.avatarImageUrl && (activeNum > 2 || phase === 'done')) {
              const productCount = pipeRef.current.productImageUrls?.length ?? 0
              cards.push(
                <CompletedStepCard
                  key="resolve"
                  stepId="resolve"
                  summary={`1 avatar + ${productCount} ảnh sản phẩm đã resolve URL`}
                />
              )
            }

            // Step 4: B-roll Images (was step 5, now runs BEFORE avatar)
            if (previewBrollImageUrls.length > 0 && (activeNum > 4 || phase === 'done')) {
              const successCount = previewBrollImageUrls.filter(Boolean).length
              cards.push(
                <CompletedStepCard
                  key="brollimg"
                  stepId="brollimg"
                  summary={`${successCount}/${previewBrollImageUrls.length} ảnh tĩnh đã duyệt`}
                >
                  <div className="grid grid-cols-4 gap-1.5">
                    {previewBrollImageUrls.map((url, i) => (
                      <div key={i} className="relative aspect-[9/16] w-full overflow-hidden rounded-md border border-emerald-100 bg-gray-900">
                        {url
                          ? <img src={url} alt={`#${i + 1}`} className="h-full w-full object-contain" />
                          : <div className="flex h-full items-center justify-center bg-red-50"><X className="h-4 w-4 text-red-400" /></div>
                        }
                        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white">#{i + 1}</span>
                      </div>
                    ))}
                  </div>
                </CompletedStepCard>
              )
            }

            // Step 5: B-roll Videos (was step 6, now runs BEFORE avatar)
            if (previewBrollUrls.length > 0 && (activeNum > 5 || phase === 'done')) {
              const successCount = previewBrollUrls.filter(Boolean).length
              cards.push(
                <CompletedStepCard
                  key="broll"
                  stepId="broll"
                  summary={`${successCount}/${previewBrollUrls.length} video clips đã animate`}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {previewBrollUrls.map((url, i) => (
                      <div key={i} className="relative aspect-[9/16] w-full overflow-hidden rounded-md border border-emerald-100 bg-gray-900">
                        {url
                          ? <video src={url} muted loop autoPlay playsInline className="h-full w-full object-contain" />
                          : <div className="flex h-full items-center justify-center bg-red-50"><X className="h-4 w-4 text-red-400" /></div>
                        }
                        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white">#{i + 1}</span>
                      </div>
                    ))}
                  </div>
                </CompletedStepCard>
              )
            }

            // Step 5: Voice (moved here from step 1 — runs AFTER B-roll passes)
            if (previewVoiceUrl && (activeNum > 5 || phase === 'done')) {
              cards.push(
                <CompletedStepCard
                  key="voice"
                  stepId="voice"
                  summary={`${formatDuration(pipeRef.current.audioDuration ?? 0)} · ${Math.round((pipeRef.current.audioBlob?.size ?? 0) / 1024)} KB · eleven_v3 1.1x`}
                >
                  <audio controls src={previewVoiceUrl} className="w-full" />
                </CompletedStepCard>
              )
            }

            // Step 6: Avatar Lip-sync (runs AFTER Voice passes)
            if (previewAvatarUrl && (activeNum > 6 || phase === 'done')) {
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
          {phase.startsWith('running-') && <RunningPanel phase={phase} detail={phaseDetail} progress={phaseProgress} />}

          {/* ─── Review: Storyboard (step 1 — first review) ─── */}
          {phase === 'review-parse' && (
            <ReviewCard
              onRetry={runParse}
              onContinue={runResolve}
              continueLabel="Tiếp tục → B-roll Images (GPT Image 2)"
              continueCost={STEP_INFO.brollimg.cost}
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

          {/* ─── Review: Voice (now step 5 — AFTER B-roll, BEFORE Avatar) ─── */}
          {phase === 'review-voice' && (
            <ReviewCard
              onRetry={runVoice}
              onContinue={runAvatar}
              onBack={goBackToPreviousReview}
              backLabel="← B-roll Videos"
              continueLabel="Tiếp tục → Avatar Lip-sync"
              continueCost={STEP_INFO.avatar.cost}
            >
              <p className="mb-2 text-xs text-gray-500">
                Nghe thử voiceover. Đã re-time segments theo audio thật. Tiếp theo Avatar lip-sync (~624 cr — bước đắt nhất).
              </p>
              <audio controls src={previewVoiceUrl ?? ''} className="w-full" />
              <p className="mt-2 text-xs text-gray-400">
                Thời lượng: <strong>{formatDuration(pipeRef.current.audioDuration ?? 0)}</strong> · Kích thước: {Math.round((pipeRef.current.audioBlob?.size ?? 0) / 1024)} KB · 1.1x speed · eleven_v3 expressive
              </p>
            </ReviewCard>
          )}

          {/* ─── Review: Avatar (step 6 — last big spend before final compose) ─── */}
          {phase === 'review-avatar' && (
            <ReviewCard
              onRetry={runAvatar}
              onContinue={runBg}
              onBack={goBackToPreviousReview}
              backLabel="← Voiceover"
              retryLabel="Tạo lại (~624 cr)"
              continueLabel="Tiếp tục → Xóa nền"
              continueCost={STEP_INFO.bg.cost}
            >
              <p className="mb-2 text-xs text-gray-500">
                Bước cuối tốn KIE credit lớn — bạn đã duyệt B-roll OK rồi nên giờ chỉ cần check lip-sync. Tạo lại = ~624 KIE credit.
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

          {/* ─── Review: B-roll Static Images (step 4 — cheap test) ─── */}
          {phase === 'review-brollimg' && (
            <ReviewCard
              onRetry={runBrollImages}
              onContinue={runBroll}
              onBack={goBackToPreviousReview}
              backLabel="← Storyboard"
              retryLabel={`Tạo lại tất cả (~$${(previewBrollImageUrls.length * 0.04).toFixed(2)})`}
              continueLabel="Tiếp tục → Animate"
              continueCost={STEP_INFO.broll.cost}
              disabled={regeneratingImageIndices.size > 0}
            >
              <p className="mb-3 text-xs text-gray-500">
                <strong className="text-emerald-600">{previewBrollImageUrls.filter(Boolean).length}/{previewBrollImageUrls.length}</strong> ảnh thành công.
                Click vào ảnh để gen lại từng cái (~6 KIE credit, GPT Image 2 với avatar + product reference) — rẻ hơn ~10x so với gen lại video.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {previewBrollImageUrls.map((url, i) => {
                  const isRegen = regeneratingImageIndices.has(i)
                  return (
                    <div
                      key={i}
                      className={`group relative aspect-[9/16] w-full overflow-hidden rounded-lg border bg-gray-900 ${url ? 'border-emerald-200' : 'border-red-200 bg-red-50'} ${isRegen ? 'opacity-60' : ''}`}
                    >
                      {url ? (
                        <img src={url} alt={`Đoạn ${i + 1}`} className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
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
                          title={`Gen lại ảnh #${i + 1} (~6 KIE credit · GPT Image 2)`}
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

          {/* ─── Review: B-roll Videos — PER-CLIP MANUAL generation ─── */}
          {phase === 'review-broll' && (() => {
            const doneCount = previewBrollUrls.filter(Boolean).length
            // Estimate spent based on which clips are done (each clip's cost depends on its segment duration)
            const totalSpent = previewBrollUrls.reduce((sum, url, i) => {
              if (!url) return sum
              const seg = previewSegments[i]
              if (!seg) return sum
              return sum + estimateClipCost(pickClipDuration(seg.durationSec))
            }, 0)
            // Estimate of total cost if user gens all remaining clips
            const totalEstimate = previewSegments.reduce((sum, seg) => sum + estimateClipCost(pickClipDuration(seg.durationSec)), 0)
            const isAnyGenerating = generatingBrollIndices.size > 0
            return (
              <ReviewCard
                onRetry={() => addToast('Click nút "Gen" trên từng clip để tạo riêng từng cái', 'error')}
                onContinue={runVoice}
                onBack={goBackToPreviousReview}
                backLabel="← B-roll Images"
                retryLabel="Hướng dẫn"
                continueLabel={doneCount === 0 ? 'Tiếp tục (skip B-roll)' : `Tiếp tục → Voiceover (${doneCount}/${previewBrollUrls.length} clips)`}
                continueCost={STEP_INFO.voice.cost}
                disabled={isAnyGenerating}
              >
                <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                  <p className="text-xs text-violet-700">
                    📌 <strong>Gen từng clip riêng</strong> — mỗi clip duration auto-match segment (5/8/10/12s). Cost mỗi clip thay đổi theo độ dài.
                  </p>
                  <p className="mt-1 text-[11px] text-violet-600">
                    Đã gen: <strong>{doneCount}/{previewBrollUrls.length}</strong> clips · Đã tốn: <strong>{totalSpent} cr (${(totalSpent * 0.005).toFixed(2)})</strong> · Tổng nếu gen hết: ~{totalEstimate} cr (${(totalEstimate * 0.005).toFixed(2)})
                  </p>
                </div>

                <div className="space-y-3">
                  {previewSegments.map((seg, i) => {
                    const videoUrl = previewBrollUrls[i]
                    const imageUrl = previewBrollImageUrls[i]
                    const isGen = generatingBrollIndices.has(i)
                    const motionPrompt = buildMotionPrompt(seg)
                    const clipDur = pickClipDuration(seg.durationSec)
                    const clipCost = estimateClipCost(clipDur)
                    return (
                      <div key={i} className="overflow-hidden rounded-lg border border-black/10 bg-white">
                        <div className="flex gap-3 p-2">
                          {/* Preview: video if generated, else static image */}
                          <div className="relative aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-md border border-black/8 bg-gray-900">
                            {videoUrl ? (
                              <video src={videoUrl} muted loop autoPlay playsInline className="h-full w-full object-contain" />
                            ) : imageUrl ? (
                              <img src={imageUrl} alt={`#${i + 1}`} className="h-full w-full object-contain opacity-70" />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <X className="h-4 w-4 text-red-400" />
                              </div>
                            )}
                            <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-bold text-white">#{i + 1}</span>
                            {isGen && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                              </div>
                            )}
                          </div>

                          {/* Right side: text + prompt + button */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600">
                                Đoạn {i + 1} · Segment {seg.durationSec.toFixed(1)}s
                              </p>
                              <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">
                                → Clip {clipDur}s
                              </span>
                              {(() => {
                                const diff = seg.durationSec - clipDur
                                if (Math.abs(diff) < 0.1) return null
                                if (diff > 0) {
                                  // segment longer than clip → Shotstack freeze-frame the gap
                                  return (
                                    <span className="text-[9px] text-amber-500" title={`Segment dài hơn clip ${diff.toFixed(1)}s — Shotstack freeze-frame phần đuôi`}>
                                      ⏸ freeze {diff.toFixed(1)}s
                                    </span>
                                  )
                                }
                                // clip longer than segment → trim
                                return (
                                  <span className="text-[9px] text-gray-400" title={`Clip dài hơn segment ${Math.abs(diff).toFixed(1)}s — Shotstack trim đuôi`}>
                                    ✂ trim {Math.abs(diff).toFixed(1)}s
                                  </span>
                                )
                              })()}
                            </div>
                            <p className="line-clamp-2 text-xs text-gray-700">{seg.text}</p>

                            <details className="mt-1 text-[10px] text-violet-600">
                              <summary className="cursor-pointer font-semibold hover:underline">
                                🎬 Motion prompt (click để xem trước khi gen)
                              </summary>
                              <p className="mt-1 rounded bg-violet-50 p-2 italic leading-relaxed text-gray-700">
                                {motionPrompt}
                              </p>
                            </details>

                            <div className="mt-1.5 flex items-center gap-2">
                              <button
                                onClick={() => generateOneBrollVideo(i)}
                                disabled={isGen || !imageUrl}
                                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                  videoUrl
                                    ? 'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                                    : 'bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow hover:shadow-md'
                                }`}
                              >
                                {isGen ? (
                                  <><Loader2 className="h-3 w-3 animate-spin" /> Đang gen...</>
                                ) : videoUrl ? (
                                  <><RotateCcw className="h-3 w-3" /> Tạo lại {clipDur}s (~{clipCost} cr)</>
                                ) : (
                                  <><Sparkles className="h-3 w-3" /> Gen clip {clipDur}s (~{clipCost} cr)</>
                                )}
                              </button>
                              {videoUrl && <span className="text-[10px] text-emerald-600 font-semibold">✓ Đã gen</span>}
                              {!imageUrl && <span className="text-[10px] text-red-400">Thiếu ảnh tĩnh</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ReviewCard>
            )
          })()}

          {/* ─── Review: BG removal ─── */}
          {phase === 'review-bg' && (
            <ReviewCard
              onRetry={runBg}
              onContinue={runAssemble}
              onSkip={handleSkipBg}
              onBack={goBackToPreviousReview}
              backLabel="← Avatar"
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
                  Storyboard (timing ước lượng) → B-roll Images → B-roll Videos → Voice (re-time chính xác) → Avatar → BG → Ghép. Test B-roll trước khi commit Voice + Avatar.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-400">
                {['Free ① Storyboard', '$0.36 fal ③ Images (FLUX Ultra 9/10)', '850 cr ④ Videos (Seedance 480p)', '$0.30 EL ⑤ Voice', '624 cr ⑥ Avatar', '$0.50 fal ⑦ BG', '$0.50 SS ⑧ Render'].map((t) => (
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

      {history.length > 0 && (
        <button
          onClick={() => setMobileFormVisible((v) => !v)}
          aria-label={showInputOnMobile ? 'Đóng cấu hình' : 'Mở cấu hình'}
          title={showInputOnMobile ? 'Đóng cấu hình' : 'Mở cấu hình'}
          className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-3 text-[12px] font-bold text-white shadow-lg shadow-violet-900/30 hover:bg-violet-700 active:scale-95 transition-transform"
        >
          {showInputOnMobile
            ? <><X className="h-4 w-4" /> Đóng</>
            : <><Sliders className="h-4 w-4" /> Cấu hình</>}
        </button>
      )}
    </div>
  )
}
