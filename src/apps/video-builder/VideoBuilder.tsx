import { useState, useEffect } from 'react'
import {
  Film, Download, Loader2, CheckCircle2,
  AlertTriangle, ChevronRight, Trash2, RefreshCw,
  Mic, Sparkles, FileText, User, Package,
  Check, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import { getUrl, isAssetRef } from '../../utils/assetStore'
import { directGeminiVision } from '../../utils/gemini'
import { listVoices, textToSpeech } from '../../utils/elevenlabs'
import { generateLipSync, pollLipSyncUntilDone, generateVideoJob, getVideoJobStatus } from '../../utils/kieai'
import { removeVideoBackground } from '../../utils/falai'
import { buildUGCVideo, pollRenderUntilDone } from '../../utils/shotstack'
import { saveAsset } from '../../utils/assetStore'
import type { ElevenLabsVoice } from '../../utils/elevenlabs'
import type { ScriptSegment, BuildStep, BuildStepStatus, VideoBuilderJob } from './types'
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

async function resolveImageUrl(ref: string): Promise<string | null> {
  if (!ref) return null
  if (isAssetRef(ref)) return getUrl(ref)
  return ref  // already a direct URL
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepRow({ step }: { step: BuildStep }) {
  const icons: Record<BuildStepStatus, React.ReactNode> = {
    idle:    <div className="h-4 w-4 rounded-full border-2 border-gray-200" />,
    running: <Loader2 className="h-4 w-4 animate-spin text-violet-500" />,
    done:    <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    failed:  <div className="h-4 w-4 rounded-full bg-red-400 flex items-center justify-center"><span className="text-white text-[8px] font-bold">✕</span></div>,
    skipped: <div className="h-4 w-4 rounded-full bg-gray-200" />,
  }
  return (
    <div className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
      step.status === 'running' ? 'bg-violet-50 border border-violet-100' :
      step.status === 'done'    ? 'bg-emerald-50/60 border border-emerald-100/60' :
      step.status === 'failed'  ? 'bg-red-50 border border-red-100' :
      'border border-transparent'
    }`}>
      <div className="mt-0.5 shrink-0">{icons[step.status]}</div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold ${
          step.status === 'running' ? 'text-violet-700' :
          step.status === 'done'    ? 'text-emerald-700' :
          step.status === 'failed'  ? 'text-red-600' :
          'text-gray-400'
        }`}>{step.label}</p>
        {step.detail && step.status !== 'idle' && (
          <p className="mt-0.5 text-[10px] text-gray-400 leading-relaxed">{step.detail}</p>
        )}
      </div>
    </div>
  )
}

// ── Script picker ─────────────────────────────────────────────────────────────

function ScriptPicker({ scripts, selectedId, onSelect }: {
  scripts: Script[]
  selectedId: string
  onSelect: (id: string, text: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const selected = scripts.find((s) => s.id === selectedId)

  if (scripts.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-black/10 bg-black/[0.01] px-4 py-4 text-center">
        <p className="text-xs text-gray-400">Chưa có kịch bản nào trong Project</p>
        <p className="mt-0.5 text-[10px] text-gray-300">Tạo kịch bản tại app <strong>Kịch bản</strong> trước</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
          selected ? 'border-violet-200 bg-violet-50/40' : 'border-black/10 bg-white hover:bg-black/[0.02]'
        }`}
      >
        <FileText className={`h-4 w-4 shrink-0 ${selected ? 'text-violet-500' : 'text-gray-300'}`} />
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              <p className="text-xs font-semibold text-violet-800 truncate">{selected.title || 'Kịch bản không có tiêu đề'}</p>
              <p className="text-[10px] text-violet-500 truncate">{selected.scriptText.slice(0, 60)}...</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Chọn kịch bản từ Project...</p>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
      </button>

      {expanded && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl max-h-64 overflow-y-auto">
          {scripts.map((s) => (
            <button
              key={s.id}
              onClick={() => { onSelect(s.id, s.scriptText); setExpanded(false) }}
              className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-violet-50 ${
                s.id === selectedId ? 'bg-violet-50' : ''
              }`}
            >
              {s.id === selectedId && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />}
              {s.id !== selectedId && <div className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{s.title || 'Không có tiêu đề'}</p>
                <p className="mt-0.5 text-[10px] text-gray-400 line-clamp-2">{s.scriptText.slice(0, 100)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Model picker (avatar) ─────────────────────────────────────────────────────

function ModelPicker({ models, selectedId, onSelect }: {
  models: Model[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  if (models.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-black/10 bg-black/[0.01] px-4 py-4 text-center">
        <p className="text-xs text-gray-400">Chưa có Avatar AI nào trong Project</p>
        <p className="mt-0.5 text-[10px] text-gray-300">Tạo Avatar AI tại app <strong>Avatar AI</strong> trước</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {models.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-all ${
            m.id === selectedId
              ? 'border-violet-400 bg-violet-50 shadow-sm'
              : 'border-black/8 bg-white hover:border-violet-200 hover:bg-violet-50/40'
          }`}
        >
          {m.characterImage ? (
            <img
              src={isAssetRef(m.characterImage) ? undefined : m.characterImage}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              alt={m.name}
              className="h-14 w-14 rounded-lg object-cover border border-black/8"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100">
              <User className="h-6 w-6 text-gray-300" />
            </div>
          )}
          <p className="w-full truncate text-center text-[10px] font-semibold text-gray-700">{m.name || 'Avatar AI'}</p>
          {m.id === selectedId && (
            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500">
              <Check className="h-2.5 w-2.5 text-white" />
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Product picker ────────────────────────────────────────────────────────────

function ProductPicker({ products, selectedIds, onToggle }: {
  products: Product[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  if (products.length === 0) {
    return (
      <p className="text-[11px] text-gray-400 italic">Chưa có sản phẩm — bỏ qua hoặc thêm tại app Sản phẩm</p>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {products.map((p) => {
        const selected = selectedIds.includes(p.id)
        return (
          <button
            key={p.id}
            onClick={() => onToggle(p.id)}
            disabled={!selected && selectedIds.length >= 5}
            className={`relative flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-all disabled:opacity-40 ${
              selected
                ? 'border-violet-400 bg-violet-50'
                : 'border-black/8 bg-white hover:border-violet-200'
            }`}
          >
            {p.productImage ? (
              <img
                src={isAssetRef(p.productImage) ? undefined : p.productImage}
                alt={p.productName}
                className="h-10 w-10 rounded-lg object-cover border border-black/8"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <Package className="h-4 w-4 text-gray-300" />
              </div>
            )}
            <p className="w-full truncate text-center text-[9px] font-medium text-gray-600">{p.productName}</p>
            {selected && (
              <div className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-500">
                <Check className="h-2 w-2 text-white" />
              </div>
            )}
          </button>
        )
      })}
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
          <p className="text-[11px] text-red-600">{job.errorMessage?.slice(0, 200) ?? 'Build thất bại'}</p>
        </div>
      )}
      <div className="p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="truncate text-xs font-semibold text-gray-700">{job.name}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            job.status === 'done'   ? 'bg-emerald-100 text-emerald-700' :
            job.status === 'failed' ? 'bg-red-100 text-red-600' :
            'bg-violet-100 text-violet-600'
          }`}>
            {job.status === 'done' ? 'Hoàn thành' : job.status === 'failed' ? 'Thất bại' : 'Đang xử lý'}
          </span>
        </div>
        <p className="mb-3 text-[10px] text-gray-400">
          {job.voiceName} · {job.totalDuration ? formatDuration(job.totalDuration) : '--'} · {new Date(job.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <div className="flex items-center gap-1.5">
          {job.status === 'done' && job.videoUrl && (
            <button onClick={handleDownload} className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100">
              <Download className="h-3 w-3" /> Tải xuống
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onDelete} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step definitions ──────────────────────────────────────────────────────────

const INITIAL_STEPS: BuildStep[] = [
  { id: 'parse',    label: '① Phân tích kịch bản (Gemini)',      detail: 'Chia script thành segments + B-roll prompts', status: 'idle' },
  { id: 'voice',    label: '② Tạo voiceover (ElevenLabs)',        detail: 'TTS toàn bộ script → audio file', status: 'idle' },
  { id: 'resolve',  label: '③ Chuẩn bị tài nguyên',              detail: 'Resolve URL ảnh Avatar AI và sản phẩm', status: 'idle' },
  { id: 'avatar',   label: '④ Tạo avatar lip-sync (KIE.ai)',      detail: 'Kling Avatar: ảnh + audio → video nói', status: 'idle' },
  { id: 'broll',    label: '⑤ Tạo B-roll clips (KIE.ai Kling)',   detail: 'Gen video minh họa song song cho mỗi đoạn', status: 'idle' },
  { id: 'bg',       label: '⑥ Xóa nền avatar (fal.ai)',           detail: 'Tách nền để overlay trong suốt lên B-roll', status: 'idle' },
  { id: 'assemble', label: '⑦ Ghép video (Shotstack)',            detail: 'Layer B-roll + avatar + captions → 9:16 MP4', status: 'idle' },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function VideoBuilder() {
  const { kieApiKey, elevenLabsApiKey, falApiKey, shotstackApiKey, geminiApiKey } = useSettingsStore()
  const addToast = useAppStore((s) => s.addToast)
  const { scripts, models, products } = useBankStore()

  // ── Input state ──────────────────────────────────────────────────────────
  const [selectedScriptId, setSelectedScriptId] = useState('')
  const [script, setScript] = useState('')          // editable after selection
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState('')
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([])
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [scriptExpanded, setScriptExpanded] = useState(false)

  // ── Build state ──────────────────────────────────────────────────────────
  const [isBuilding, setIsBuilding] = useState(false)
  const [steps, setSteps] = useState<BuildStep[]>(INITIAL_STEPS)
  const [history, setHistory] = useState<VideoBuilderJob[]>([])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

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

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectScript = (id: string, text: string) => {
    setSelectedScriptId(id)
    setScript(text)
  }

  const handleToggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 5)
    )
  }

  const setStep = (id: string, status: BuildStepStatus, detail?: string) => {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, status, detail: detail ?? s.detail } : s))
  }

  // ── Build pipeline ───────────────────────────────────────────────────────

  const handleBuild = async () => {
    if (!script.trim())       { addToast('Chọn hoặc nhập kịch bản', 'error'); return }
    if (!selectedModelId)     { addToast('Chọn Avatar AI', 'error'); return }
    if (!selectedVoiceId)     { addToast('Chọn giọng đọc', 'error'); return }
    if (!elevenLabsApiKey)    { addToast('Cần ElevenLabs API key', 'error'); return }
    if (!kieApiKey)           { addToast('Cần KIE.ai API key', 'error'); return }
    if (!falApiKey)           { addToast('Cần fal.ai API key', 'error'); return }
    if (!shotstackApiKey)     { addToast('Cần Shotstack API key', 'error'); return }
    if (!geminiApiKey)        { addToast('Cần Gemini API key', 'error'); return }

    const jobId     = crypto.randomUUID()
    const model     = models.find((m) => m.id === selectedModelId)
    const voiceName = voices.find((v) => v.voice_id === selectedVoiceId)?.name ?? selectedVoiceId
    const jobName   = (scripts.find((s) => s.id === selectedScriptId)?.title || script.slice(0, 40)).trim()

    setIsBuilding(true)
    setActiveJobId(jobId)
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'idle' })))

    const newJob: VideoBuilderJob = {
      id: jobId, name: jobName, status: 'parsing', errorMessage: null,
      script, voiceId: selectedVoiceId, voiceName,
      videoUrl: null, assetId: null, totalDuration: null, createdAt: Date.now(),
    }
    setHistory((h) => [newJob, ...h])
    const patchJob = (updates: Partial<VideoBuilderJob>) =>
      setHistory((h) => h.map((j) => j.id === jobId ? { ...j, ...updates } : j))

    try {
      // ── Step 1: Parse script with Gemini ──────────────────────────────────
      setStep('parse', 'running')
      const parsePrompt = `Bạn là AI phân tích kịch bản video quảng cáo UGC. Phân tích script sau và trả về JSON:
{
  "segments": [
    {
      "index": 0,
      "text": "nội dung đoạn nguyên văn",
      "durationSec": 5.0,
      "startSec": 0.0,
      "brollPrompt": "cinematic scene description in English, vertical 9:16, no text",
      "avatarPosition": "right",
      "useProduct": false
    }
  ],
  "totalEstimatedSec": 55.0
}
Quy tắc: chia 6-10 đoạn (4-8s/đoạn) · durationSec theo tốc độ đọc ~130 từ/phút · avatarPosition luân phiên left/right · useProduct=true nếu đoạn đề cập sản phẩm · trả về JSON thuần, không markdown.
SCRIPT:\n${script}`

      const parseResult = await directGeminiVision({ apiKey: geminiApiKey, parts: [{ text: parsePrompt }], maxOutputTokens: 2048 })
      let parsed: { segments: ScriptSegment[]; totalEstimatedSec: number }
      try {
        const clean = parseResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        parsed = JSON.parse(clean) as { segments: ScriptSegment[]; totalEstimatedSec: number }
      } catch { throw new Error('Gemini không trả về JSON hợp lệ — thử lại') }

      const segments = parsed.segments
      setStep('parse', 'done', `${segments.length} segments · ~${formatDuration(parsed.totalEstimatedSec)}`)

      // ── Step 2: Generate voiceover ────────────────────────────────────────
      setStep('voice', 'running')
      const audioBuffer   = await textToSpeech({ apiKey: elevenLabsApiKey, voiceId: selectedVoiceId, text: script, modelId: 'eleven_multilingual_v2' })
      const audioDuration = await getAudioDuration(audioBuffer)
      const audioBlob     = new Blob([audioBuffer], { type: 'audio/mpeg' })
      const audioAssetId  = await saveAsset(audioBlob, 'audio/mpeg')
      const voiceUrl      = await getUrl(audioAssetId)
      if (!voiceUrl) throw new Error('Không lấy được URL audio sau khi upload')

      // Recalculate timing based on actual audio duration
      const totalChars = segments.reduce((s, seg) => s + seg.text.length, 0)
      let cursor = 0
      const timedSegments = segments.map((seg) => {
        const ratio    = totalChars > 0 ? seg.text.length / totalChars : 1 / segments.length
        const duration = audioDuration * ratio
        const s        = { ...seg, startSec: cursor, durationSec: duration }
        cursor += duration
        return s
      })
      setStep('voice', 'done', `${formatDuration(audioDuration)} · ${Math.round(audioBlob.size / 1024)} KB`)
      patchJob({ totalDuration: audioDuration })

      // ── Step 3: Resolve URLs from Project assets ──────────────────────────
      setStep('resolve', 'running')
      const avatarImageUrl = await resolveImageUrl(model?.characterImage ?? '')
      if (!avatarImageUrl) throw new Error('Không lấy được URL ảnh Avatar AI — kiểm tra Avatar AI trong Project')

      const productImageUrls: string[] = []
      for (const pid of selectedProductIds) {
        const prod = products.find((p) => p.id === pid)
        if (!prod?.productImage) continue
        const url = await resolveImageUrl(prod.productImage)
        if (url) productImageUrls.push(url)
      }
      setStep('resolve', 'done', `avatar: ${model?.name ?? '?'} · ${productImageUrls.length} sản phẩm`)

      // ── Step 4: Avatar lip-sync (Kling Avatar Standard) ──────────────────
      setStep('avatar', 'running')
      patchJob({ status: 'avatar' })
      const { taskId: avatarTaskId } = await generateLipSync({
        apiKey: kieApiKey,
        modelId: 'kling/ai-avatar-standard',
        imageUrl: avatarImageUrl,
        audioUrl: voiceUrl,
        prompt: 'A confident UGC content creator speaking naturally to camera, professional look, clean background',
      })
      const avatarRawUrl = await pollLipSyncUntilDone({ apiKey: kieApiKey, taskId: avatarTaskId, timeoutMs: 15 * 60 * 1000 })
      setStep('avatar', 'done', 'Kling Avatar Standard hoàn thành')

      // ── Step 5: B-roll generation (parallel) ─────────────────────────────
      setStep('broll', 'running')
      patchJob({ status: 'broll' })
      const brollResults: (string | null)[] = new Array(timedSegments.length).fill(null)

      await Promise.all(timedSegments.map(async (seg, i) => {
        const refImages = (seg.useProduct && productImageUrls.length > 0) ? [productImageUrls[0]] : undefined
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

      const successCount = brollResults.filter(Boolean).length
      setStep('broll', successCount > 0 ? 'done' : 'skipped', `${successCount}/${timedSegments.length} clips thành công`)

      // ── Step 6: Remove avatar background ─────────────────────────────────
      setStep('bg', 'running')
      patchJob({ status: 'removing-bg' })
      let avatarFinalUrl = avatarRawUrl
      try {
        avatarFinalUrl = await removeVideoBackground({ apiKey: falApiKey, videoUrl: avatarRawUrl, outputFormat: 'mp4' })
        setStep('bg', 'done', 'Nền avatar đã được xóa')
      } catch (bgErr) {
        setStep('bg', 'skipped', `Bỏ qua: ${bgErr instanceof Error ? bgErr.message.slice(0, 60) : 'lỗi không xác định'}`)
      }

      // ── Step 7: Shotstack assembly ────────────────────────────────────────
      setStep('assemble', 'running')
      patchJob({ status: 'assembling' })

      const renderId = await buildUGCVideo({
        apiKey: shotstackApiKey,
        voiceUrl,
        avatarVideoUrl: avatarFinalUrl,
        totalDuration: audioDuration,
        segments: timedSegments.map((seg, i) => ({
          text: seg.text,
          startSec: seg.startSec,
          durationSec: seg.durationSec,
          brollUrl: brollResults[i],
          avatarPosition: seg.avatarPosition,
        })),
      })

      const finalVideoUrl = await pollRenderUntilDone({
        apiKey: shotstackApiKey,
        renderId,
        onStatusChange: (s) => setStep('assemble', 'running', `Shotstack: ${s}...`),
        timeoutMs: 15 * 60 * 1000,
      })

      // Save to Supabase
      const finalRes   = await fetch(finalVideoUrl)
      const finalBlob  = await finalRes.blob()
      const finalAsset = await saveAsset(finalBlob, 'video/mp4')
      const savedUrl   = await getUrl(finalAsset) ?? finalVideoUrl

      setStep('assemble', 'done', 'Video hoàn chỉnh sẵn sàng')
      patchJob({ status: 'done', videoUrl: savedUrl, assetId: finalAsset })
      addToast('🎬 UGC Video đã build xong!')

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      patchJob({ status: 'failed', errorMessage: msg })
      addToast(`Build thất bại: ${msg.slice(0, 80)}`, 'error')
      setSteps((prev) => prev.map((s) => s.status === 'running' ? { ...s, status: 'failed' } : s))
    } finally {
      setIsBuilding(false)
    }
  }

  const canBuild = !!script.trim() && !!selectedModelId && !!selectedVoiceId && !isBuilding
    && !!elevenLabsApiKey && !!kieApiKey && !!falApiKey && !!shotstackApiKey && !!geminiApiKey

  const missingKeys = [
    !geminiApiKey && 'Gemini', !elevenLabsApiKey && 'ElevenLabs',
    !kieApiKey && 'KIE.ai', !falApiKey && 'fal.ai', !shotstackApiKey && 'Shotstack',
  ].filter(Boolean) as string[]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col lg:flex-row bg-gradient-to-br from-violet-50/30 via-white to-purple-50/20">

      {/* ── Left panel ── */}
      <div className="flex w-full shrink-0 flex-col border-b border-black/8 lg:w-[360px] lg:border-b-0 lg:border-r">
        {/* Header */}
        <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Film className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">UGC Video Builder</h2>
              <p className="text-[11px] text-white/70">Project → Script · Avatar AI · Sản phẩm → Video</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Missing keys warning */}
          {missingKeys.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <p className="text-[11px] text-amber-700">Thiếu API key: <strong>{missingKeys.join(', ')}</strong></p>
            </div>
          )}

          {/* ── Script from Project ── */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <FileText className="h-3 w-3" /> Kịch bản
              </label>
              {script && (
                <button
                  onClick={() => setScriptExpanded(!scriptExpanded)}
                  className="flex items-center gap-0.5 text-[10px] text-violet-500 hover:text-violet-700"
                >
                  {scriptExpanded ? 'Thu gọn' : 'Xem / Sửa'}
                  {scriptExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
            </div>
            <ScriptPicker scripts={scripts} selectedId={selectedScriptId} onSelect={handleSelectScript} />
            {/* Editable preview */}
            {script && scriptExpanded && (
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={6}
                className="mt-2 w-full resize-none rounded-xl border border-violet-200 bg-violet-50/30 px-3 py-2.5 text-xs text-gray-700 outline-none transition-colors focus:border-violet-300"
              />
            )}
            {script && !scriptExpanded && (
              <p className="mt-1 text-[10px] text-gray-400">
                {script.length} ký tự · ~{formatDuration(Math.round(script.length / 12.5))}
              </p>
            )}
          </div>

          {/* ── Avatar AI from Project ── */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <User className="h-3 w-3" /> Avatar AI
            </label>
            <ModelPicker models={models} selectedId={selectedModelId} onSelect={setSelectedModelId} />
            {selectedModelId && (
              <p className="mt-1 text-[10px] text-emerald-600">
                ✓ {models.find((m) => m.id === selectedModelId)?.name} đã chọn
              </p>
            )}
          </div>

          {/* ── Products from Project ── */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <Package className="h-3 w-3" /> Sản phẩm (tùy chọn · tối đa 5)
            </label>
            <ProductPicker products={products} selectedIds={selectedProductIds} onToggle={handleToggleProduct} />
            {selectedProductIds.length > 0 && (
              <p className="mt-1 text-[10px] text-violet-500">{selectedProductIds.length} sản phẩm đã chọn</p>
            )}
          </div>

          {/* ── Voice ── */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <Mic className="h-3 w-3" /> Giọng đọc (ElevenLabs)
            </label>
            {!elevenLabsApiKey ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-600">Cần ElevenLabs API key</p>
            ) : loadingVoices ? (
              <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                <span className="text-sm text-gray-400">Đang tải giọng...</span>
              </div>
            ) : (
              <select
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-violet-300"
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

        {/* Build button */}
        <div className="shrink-0 border-t border-black/8 p-4">
          <button
            onClick={handleBuild}
            disabled={!canBuild}
            className="relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: canBuild ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : undefined,
              backgroundColor: !canBuild ? '#d1d5db' : undefined,
            }}
          >
            {isBuilding ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Đang build...</span>
            ) : (
              <span className="flex items-center justify-center gap-2"><Sparkles className="h-4 w-4" />Build UGC Video</span>
            )}
          </button>
          <p className="mt-1.5 text-center text-[10px] text-gray-400">~5–10 phút · Giữ tab mở khi đang xử lý</p>
        </div>
      </div>

      {/* ── Right panel: Progress + History ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-black/8 bg-white/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-semibold text-gray-700">Kết quả</span>
            {history.length > 0 && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-600">{history.length}</span>
            )}
          </div>
          {history.length > 0 && !isBuilding && (
            <button onClick={() => setHistory([])} className="text-[11px] text-gray-400 transition-colors hover:text-red-400">Xóa tất cả</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isBuilding && (
            <div className="mb-4 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold text-violet-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />Đang build video...
              </p>
              <div className="space-y-1.5">
                {steps.map((step) => <StepRow key={step.id} step={step} />)}
              </div>
              <div className="mt-3 flex items-center gap-1 text-[10px] text-gray-400">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" />Vui lòng giữ tab mở trong suốt quá trình
              </div>
            </div>
          )}

          {history.length === 0 && !isBuilding ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100">
                <Film className="h-10 w-10 text-violet-400" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-500">Chưa có video nào được build</p>
                <p className="mt-1 max-w-xs text-center text-xs leading-relaxed text-gray-400">
                  Chọn kịch bản + Avatar AI từ Project, chọn giọng đọc → Build UGC Video
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-[10px] text-gray-400">
                {['🎬 3-layer video', '🗣 Lip-sync avatar', '📹 Auto B-roll', '📝 Auto captions'].map((t) => (
                  <span key={t} className="rounded-full border border-black/8 bg-black/[0.02] px-2.5 py-1">{t}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((job) => (
                <div key={job.id}>
                  {job.id === activeJobId && !isBuilding && (job.status === 'done' || job.status === 'failed') && (
                    <div className="mb-2 rounded-xl border border-black/6 bg-white p-3">
                      <div className="space-y-1">{steps.map((step) => <StepRow key={step.id} step={step} />)}</div>
                    </div>
                  )}
                  <HistoryCard job={job} onDelete={() => setHistory((h) => h.filter((j) => j.id !== job.id))} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-black/6 bg-white/60 px-5 py-2.5">
          <div className="flex items-center justify-between text-[10px] text-gray-400">
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
