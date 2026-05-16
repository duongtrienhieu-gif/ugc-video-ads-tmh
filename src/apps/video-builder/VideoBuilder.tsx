import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Film, Upload, X, Download, Loader2, CheckCircle2,
  AlertTriangle, ChevronRight, Trash2, RefreshCw, Mic,
  ImageIcon, User, FileText, Sparkles,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { saveAsset, getUrl } from '../../utils/assetStore'
import { directGeminiVision } from '../../utils/gemini'
import { listVoices, textToSpeech } from '../../utils/elevenlabs'
import { generateLipSync, pollLipSyncUntilDone, generateVideoJob, getVideoJobStatus } from '../../utils/kieai'
import { removeVideoBackground } from '../../utils/falai'
import { buildUGCVideo, pollRenderUntilDone } from '../../utils/shotstack'
import type { ElevenLabsVoice } from '../../utils/elevenlabs'
import type { ScriptSegment, BuildStep, BuildStepStatus, VideoBuilderJob } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAudioDuration(buffer: ArrayBuffer): Promise<number> {
  return new Promise((resolve) => {
    try {
      const ctx = new AudioContext()
      ctx.decodeAudioData(buffer.slice(0), (decoded) => {
        resolve(decoded.duration)
        ctx.close()
      }, () => resolve(60))  // fallback 60s
    } catch {
      resolve(60)
    }
  })
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepRow({ step }: { step: BuildStep }) {
  const icons: Record<BuildStepStatus, React.ReactNode> = {
    idle:    <div className="h-4 w-4 rounded-full border-2 border-gray-200" />,
    running: <Loader2 className="h-4 w-4 animate-spin text-violet-500" />,
    done:    <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    failed:  <X className="h-4 w-4 text-red-400" />,
    skipped: <div className="h-4 w-4 rounded-full bg-gray-100" />,
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
          <p className="mt-0.5 text-[10px] text-gray-400 truncate">{step.detail}</p>
        )}
      </div>
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
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm">
      {job.status === 'done' && job.videoUrl && (
        <div className="bg-black">
          <video
            src={job.videoUrl}
            controls
            playsInline
            className="max-h-64 w-full object-contain"
          />
        </div>
      )}
      {job.status === 'failed' && (
        <div className="flex items-start gap-2 bg-red-50 px-4 py-3">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-[11px] text-red-600">{job.errorMessage?.slice(0, 200) ?? 'Build thất bại'}</p>
        </div>
      )}
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
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
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100"
            >
              <Download className="h-3 w-3" /> Tải xuống
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const INITIAL_STEPS: BuildStep[] = [
  { id: 'parse',    label: 'Phân tích kịch bản',          detail: 'Gemini AI chia script thành segments + B-roll prompts', status: 'idle' },
  { id: 'voice',    label: 'Tạo giọng đọc (Voiceover)',   detail: 'ElevenLabs TTS toàn bộ script', status: 'idle' },
  { id: 'upload',   label: 'Upload tài nguyên',            detail: 'Upload ảnh lên Supabase để lấy URL', status: 'idle' },
  { id: 'avatar',   label: 'Tạo avatar lip-sync',          detail: 'KIE.ai Kling Avatar: ảnh chân dung + audio → video', status: 'idle' },
  { id: 'broll',    label: 'Tạo B-roll clips',             detail: 'KIE.ai Kling 3.0: gen video minh họa mỗi đoạn', status: 'idle' },
  { id: 'bg',       label: 'Xóa nền avatar',               detail: 'fal.ai: tách nền để overlay lên B-roll', status: 'idle' },
  { id: 'assemble', label: 'Ghép video (Shotstack)',        detail: '3 layer: B-roll + avatar overlay + captions', status: 'idle' },
]

export default function VideoBuilder() {
  const { kieApiKey, elevenLabsApiKey, falApiKey, shotstackApiKey, geminiApiKey } = useSettingsStore()
  const addToast = useAppStore((s) => s.addToast)

  // ── Input state ──────────────────────────────────────────────────────────
  const [script, setScript] = useState('')
  const [productFiles, setProductFiles] = useState<File[]>([])
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [productPreviews, setProductPreviews] = useState<string[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState('')
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([])
  const [loadingVoices, setLoadingVoices] = useState(false)

  // ── Build state ──────────────────────────────────────────────────────────
  const [isBuilding, setIsBuilding] = useState(false)
  const [steps, setSteps] = useState<BuildStep[]>(INITIAL_STEPS)
  const [history, setHistory] = useState<VideoBuilderJob[]>([])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const productInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef  = useRef<HTMLInputElement>(null)

  // ── Load voices when key available ──────────────────────────────────────
  useEffect(() => {
    if (!elevenLabsApiKey) return
    setLoadingVoices(true)
    listVoices(elevenLabsApiKey)
      .then((v) => {
        setVoices(v)
        if (!selectedVoiceId && v.length > 0) setSelectedVoiceId(v[0].voice_id)
      })
      .catch(() => {})
      .finally(() => setLoadingVoices(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevenLabsApiKey])

  // ── File handlers ────────────────────────────────────────────────────────

  const handleProductFiles = useCallback((files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/')).slice(0, 5)
    setProductFiles((prev) => [...prev, ...images].slice(0, 5))
    images.forEach((f) => {
      const url = URL.createObjectURL(f)
      setProductPreviews((prev) => [...prev, url].slice(0, 5))
    })
  }, [])

  const handleAvatarFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }, [])

  const removeProduct = (idx: number) => {
    setProductFiles((p) => p.filter((_, i) => i !== idx))
    setProductPreviews((p) => p.filter((_, i) => i !== idx))
  }

  // ── Step helpers ─────────────────────────────────────────────────────────

  const setStep = (id: string, status: BuildStepStatus, detail?: string) => {
    setSteps((prev) => prev.map((s) =>
      s.id === id ? { ...s, status, detail: detail ?? s.detail } : s
    ))
  }

  // ── Build pipeline ───────────────────────────────────────────────────────

  const handleBuild = async () => {
    if (!script.trim()) { addToast('Nhập script trước', 'error'); return }
    if (!avatarFile)    { addToast('Upload ảnh avatar trước', 'error'); return }
    if (!selectedVoiceId) { addToast('Chọn giọng đọc', 'error'); return }
    if (!elevenLabsApiKey) { addToast('Cần ElevenLabs API key', 'error'); return }
    if (!kieApiKey)        { addToast('Cần KIE.ai API key', 'error'); return }
    if (!falApiKey)        { addToast('Cần fal.ai API key', 'error'); return }
    if (!shotstackApiKey)  { addToast('Cần Shotstack API key', 'error'); return }
    if (!geminiApiKey)     { addToast('Cần Gemini API key', 'error'); return }

    const jobId   = crypto.randomUUID()
    const voiceName = voices.find((v) => v.voice_id === selectedVoiceId)?.name ?? selectedVoiceId
    const jobName   = script.slice(0, 40).trim() + (script.length > 40 ? '...' : '')

    setIsBuilding(true)
    setActiveJobId(jobId)
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'idle' })))

    const newJob: VideoBuilderJob = {
      id: jobId, name: jobName, status: 'parsing', errorMessage: null,
      script, voiceId: selectedVoiceId, voiceName,
      videoUrl: null, assetId: null, totalDuration: null, createdAt: Date.now(),
    }
    setHistory((h) => [newJob, ...h])

    const patchJob = (updates: Partial<VideoBuilderJob>) => {
      setHistory((h) => h.map((j) => j.id === jobId ? { ...j, ...updates } : j))
    }

    try {
      // ── Step 1: Parse script with Gemini ──────────────────────────────────
      setStep('parse', 'running')
      const parsePrompt = `Bạn là AI phân tích kịch bản video quảng cáo UGC.

Phân tích script sau và trả về JSON với cấu trúc chính xác như sau:
{
  "segments": [
    {
      "index": 0,
      "text": "nội dung đoạn (nguyên văn từ script)",
      "durationSec": 5.0,
      "startSec": 0.0,
      "brollPrompt": "mô tả cảnh B-roll bằng tiếng Anh (chi tiết, cinematic, vertical 9:16)",
      "avatarPosition": "right",
      "useProduct": false
    }
  ],
  "totalEstimatedSec": 55.0
}

Quy tắc:
- Chia script thành 6-10 đoạn ngắn (mỗi đoạn 4-8 giây)
- durationSec = ước tính thời gian đọc (~130 từ/phút)
- startSec = tổng durationSec của các đoạn trước
- brollPrompt: mô tả cảnh quay phù hợp nội dung (tiếng Anh, chi tiết)
- avatarPosition: luân phiên "left"/"right" giữa các đoạn
- useProduct: true nếu đoạn đề cập sản phẩm, nguyên liệu, kết quả
- Trả về JSON thuần túy, không markdown

SCRIPT:
${script}`

      const parseResult = await directGeminiVision({
        apiKey: geminiApiKey,
        parts: [{ text: parsePrompt }],
        maxOutputTokens: 2048,
      })

      let parsed: { segments: ScriptSegment[]; totalEstimatedSec: number }
      try {
        const clean = parseResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        parsed = JSON.parse(clean) as { segments: ScriptSegment[]; totalEstimatedSec: number }
      } catch {
        throw new Error('Gemini không trả về JSON hợp lệ — thử lại')
      }

      const segments = parsed.segments
      setStep('parse', 'done', `${segments.length} segments · ~${formatDuration(parsed.totalEstimatedSec)}`)

      // ── Step 2: Generate voiceover ────────────────────────────────────────
      setStep('voice', 'running')
      const audioBuffer = await textToSpeech({
        apiKey: elevenLabsApiKey,
        voiceId: selectedVoiceId,
        text: script,
        modelId: 'eleven_multilingual_v2',
      })
      const audioDuration = await getAudioDuration(audioBuffer)
      const audioBlob     = new Blob([audioBuffer], { type: 'audio/mpeg' })
      const audioAssetId  = await saveAsset(audioBlob, 'audio/mpeg')
      const voiceUrl      = await getUrl(audioAssetId)
      if (!voiceUrl) throw new Error('Không lấy được URL audio sau khi upload')

      // Recalculate segment timings based on actual audio duration
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

      // ── Step 3: Upload avatar + product images ────────────────────────────
      setStep('upload', 'running')
      const avatarAssetId  = await saveAsset(avatarFile, avatarFile.type)
      const avatarImageUrl = await getUrl(avatarAssetId)
      if (!avatarImageUrl) throw new Error('Không lấy được URL avatar')

      const productImageUrls: string[] = []
      for (const pf of productFiles) {
        const aid = await saveAsset(pf, pf.type)
        const url = await getUrl(aid)
        if (url) productImageUrls.push(url)
      }
      setStep('upload', 'done', `avatar + ${productImageUrls.length} ảnh sản phẩm`)

      // ── Step 4: Avatar lip-sync (Kling Avatar Standard) ──────────────────
      setStep('avatar', 'running')
      patchJob({ status: 'avatar' })
      const { taskId: avatarTaskId } = await generateLipSync({
        apiKey: kieApiKey,
        modelId: 'kling/ai-avatar-standard',
        imageUrl: avatarImageUrl,
        audioUrl: voiceUrl,
        prompt: 'A confident UGC content creator speaking naturally to camera, professional lighting, clean background',
      })

      const avatarRawUrl = await pollLipSyncUntilDone({
        apiKey: kieApiKey,
        taskId: avatarTaskId,
        timeoutMs: 15 * 60 * 1000,
      })
      setStep('avatar', 'done', 'Kling Avatar Standard hoàn thành')

      // ── Step 5: B-roll generation (parallel) ─────────────────────────────
      setStep('broll', 'running')
      patchJob({ status: 'broll' })

      const brollResults: (string | null)[] = new Array(timedSegments.length).fill(null)

      // Generate all B-roll clips in parallel (max 5 concurrent)
      const brollJobs = timedSegments.map(async (seg, i) => {
        const refImages = (seg.useProduct && productImageUrls.length > 0)
          ? [productImageUrls[0]]
          : undefined

        try {
          const { taskId } = await generateVideoJob({
            apiKey: kieApiKey,
            jobModelId: 'kling-3.0/video',
            prompt: seg.brollPrompt + '. Vertical 9:16 video, cinematic quality, no text overlay.',
            aspectRatio: '9:16',
            resolution: '720p',
            duration: 5,
            referenceImageUrls: refImages,
          })

          // Poll B-roll
          const brollTimeout = 8 * 60 * 1000
          const brollStart   = Date.now()
          let brollUrl: string | null = null

          while (Date.now() - brollStart < brollTimeout) {
            await new Promise((r) => setTimeout(r, 5000))
            const s = await getVideoJobStatus({ apiKey: kieApiKey, taskId })
            if (s.status === 'completed' && s.videoUrl) { brollUrl = s.videoUrl; break }
            if (s.status === 'failed') break
          }

          brollResults[i] = brollUrl
        } catch {
          brollResults[i] = null  // skip failed clips
        }
      })

      await Promise.all(brollJobs)
      const successCount = brollResults.filter(Boolean).length
      setStep('broll', successCount > 0 ? 'done' : 'skipped', `${successCount}/${timedSegments.length} clips thành công`)

      // ── Step 6: Remove avatar background ─────────────────────────────────
      setStep('bg', 'running')
      patchJob({ status: 'removing-bg' })

      let avatarNoBgUrl = avatarRawUrl  // fallback to original if removal fails
      try {
        avatarNoBgUrl = await removeVideoBackground({
          apiKey: falApiKey,
          videoUrl: avatarRawUrl,
          outputFormat: 'mp4',
        })
        setStep('bg', 'done', 'Nền đã được xóa thành công')
      } catch (bgErr) {
        // Non-critical: continue without background removal
        const bgMsg = bgErr instanceof Error ? bgErr.message : 'Unknown'
        setStep('bg', 'skipped', `Bỏ qua xóa nền: ${bgMsg.slice(0, 60)}`)
      }

      // ── Step 7: Shotstack assembly ────────────────────────────────────────
      setStep('assemble', 'running')
      patchJob({ status: 'assembling' })

      const segmentTimings = timedSegments.map((seg, i) => ({
        text: seg.text,
        startSec: seg.startSec,
        durationSec: seg.durationSec,
        brollUrl: brollResults[i],
        avatarPosition: seg.avatarPosition,
      }))

      const renderId = await buildUGCVideo({
        apiKey: shotstackApiKey,
        voiceUrl,
        avatarVideoUrl: avatarNoBgUrl,
        totalDuration: audioDuration,
        segments: segmentTimings,
      })

      const finalVideoUrl = await pollRenderUntilDone({
        apiKey: shotstackApiKey,
        renderId,
        onStatusChange: (s) => setStep('assemble', 'running', `Shotstack: ${s}...`),
        timeoutMs: 15 * 60 * 1000,
      })

      // Save final video to Supabase
      const finalRes   = await fetch(finalVideoUrl)
      const finalBlob  = await finalRes.blob()
      const finalAsset = await saveAsset(finalBlob, 'video/mp4')
      const savedUrl   = await getUrl(finalAsset) ?? finalVideoUrl

      setStep('assemble', 'done', 'Video hoàn chỉnh đã sẵn sàng')
      patchJob({ status: 'done', videoUrl: savedUrl, assetId: finalAsset })
      addToast('🎬 UGC Video đã build xong!', 'success')

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      patchJob({ status: 'failed', errorMessage: msg })
      addToast(`Build thất bại: ${msg.slice(0, 80)}`, 'error')
      // Mark current running step as failed
      setSteps((prev) => prev.map((s) =>
        s.status === 'running' ? { ...s, status: 'failed' } : s
      ))
    } finally {
      setIsBuilding(false)
    }
  }

  const canBuild = !!script.trim() && !!avatarFile && !!selectedVoiceId && !isBuilding
    && !!elevenLabsApiKey && !!kieApiKey && !!falApiKey && !!shotstackApiKey && !!geminiApiKey

  const missingKeys = [
    !geminiApiKey     && 'Gemini',
    !elevenLabsApiKey && 'ElevenLabs',
    !kieApiKey        && 'KIE.ai',
    !falApiKey        && 'fal.ai',
    !shotstackApiKey  && 'Shotstack',
  ].filter(Boolean) as string[]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col lg:flex-row bg-gradient-to-br from-violet-50/30 via-white to-purple-50/20">

      {/* ── Left panel: Inputs ── */}
      <div className="flex w-full shrink-0 flex-col border-b border-black/8 lg:w-[360px] lg:border-b-0 lg:border-r">

        {/* Header */}
        <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Film className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">UGC Video Builder</h2>
              <p className="text-[11px] text-white/70">Script → Avatar → B-Roll → Video hoàn chỉnh</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Missing keys warning */}
          {missingKeys.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <p className="text-[11px] text-amber-700">
                Thiếu API key: <strong>{missingKeys.join(', ')}</strong> — vào Cài đặt để thêm.
              </p>
            </div>
          )}

          {/* Script input */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <FileText className="h-3 w-3" /> Script
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`Nhập kịch bản video của bạn ở đây...\n\nVí dụ:\n"The secret to pain-free joints was discovered in 1973. My knees used to hurt so bad I couldn't even play with my kids..."`}
              rows={8}
              className="w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 outline-none transition-colors focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              {script.length} ký tự · ước ~{formatDuration(Math.round(script.length / 12.5))}
            </p>
          </div>

          {/* Avatar upload */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <User className="h-3 w-3" /> Ảnh Avatar (chân dung)
            </label>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); e.target.value = '' }}
            />
            {avatarFile ? (
              <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5">
                {avatarPreview && (
                  <img src={avatarPreview} alt="avatar" className="h-12 w-12 rounded-lg object-cover border border-violet-200" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-semibold text-violet-800">{avatarFile.name}</p>
                  <p className="text-[10px] text-violet-500">{(avatarFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={() => { setAvatarFile(null); setAvatarPreview(null) }} className="text-violet-400 hover:text-violet-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-black/10 bg-black/[0.01] px-4 py-4 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/40"
              >
                <User className="h-5 w-5 text-gray-300" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Upload ảnh chân dung</p>
                  <p className="text-[10px] text-gray-400">JPG, PNG · Nền đơn giản · Nhìn thẳng vào camera</p>
                </div>
              </button>
            )}
          </div>

          {/* Product images */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <ImageIcon className="h-3 w-3" /> Ảnh sản phẩm (tùy chọn, tối đa 5)
            </label>
            <input
              ref={productInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) handleProductFiles(Array.from(e.target.files)); e.target.value = '' }}
            />
            {productPreviews.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {productPreviews.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt="" className="h-14 w-14 rounded-lg border border-black/8 object-cover" />
                    <button
                      onClick={() => removeProduct(i)}
                      className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {productFiles.length < 5 && (
              <button
                onClick={() => productInputRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-black/10 bg-black/[0.01] px-4 py-3 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/40"
              >
                <Upload className="h-4 w-4 text-gray-300" />
                <p className="text-xs text-gray-400">Thêm ảnh sản phẩm</p>
              </button>
            )}
          </div>

          {/* Voice selection */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <Mic className="h-3 w-3" /> Giọng đọc (ElevenLabs)
            </label>
            {!elevenLabsApiKey ? (
              <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">Cần ElevenLabs API key</p>
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
                    {v.name} {v.labels?.gender ? `(${v.labels.gender})` : ''} {v.labels?.accent ? `· ${v.labels.accent}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Pipeline info */}
          <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-violet-400">Pipeline</p>
            {[
              'Gemini phân tích kịch bản → N segments',
              'ElevenLabs tạo voiceover toàn bộ script',
              'KIE.ai Kling Avatar: ảnh → avatar lip-sync',
              'KIE.ai Kling 3.0: gen B-roll song song',
              'fal.ai xóa nền avatar',
              'Shotstack ghép 3 layer → video 9:16',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold text-violet-400 mt-0.5">{i + 1}.</span>
                <p className="text-[10px] text-violet-600">{item}</p>
              </div>
            ))}
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
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang build...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4" />
                Build UGC Video
              </span>
            )}
          </button>
          <p className="mt-1.5 text-center text-[10px] text-gray-400">
            Thời gian ~5-10 phút · Cần tất cả 5 API keys
          </p>
        </div>
      </div>

      {/* ── Right panel: Progress + History ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Panel header */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/8 bg-white/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-semibold text-gray-700">Kết quả</span>
            {history.length > 0 && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                {history.length}
              </span>
            )}
          </div>
          {history.length > 0 && !isBuilding && (
            <button
              onClick={() => setHistory([])}
              className="text-[11px] text-gray-400 transition-colors hover:text-red-400"
            >
              Xóa tất cả
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">

          {/* Build progress (shown while building) */}
          {isBuilding && (
            <div className="mb-4 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold text-violet-700 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Đang build video...
              </p>
              <div className="space-y-1.5">
                {steps.map((step) => <StepRow key={step.id} step={step} />)}
              </div>
              <div className="mt-3 flex items-center gap-1 text-[10px] text-gray-400">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                Quá trình này mất 5-10 phút, vui lòng giữ tab mở
              </div>
            </div>
          )}

          {/* History */}
          {history.length === 0 && !isBuilding ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100">
                <Film className="h-10 w-10 text-violet-400" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-500">Chưa có video nào được build</p>
                <p className="mt-1 max-w-xs text-center text-xs leading-relaxed text-gray-400">
                  Nhập script, upload ảnh avatar và sản phẩm, chọn giọng đọc → Build UGC Video
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
                  {/* Show steps for active job */}
                  {job.id === activeJobId && !isBuilding && (job.status === 'done' || job.status === 'failed') && (
                    <div className="mb-2 rounded-xl border border-black/6 bg-white p-3">
                      <div className="space-y-1">
                        {steps.map((step) => <StepRow key={step.id} step={step} />)}
                      </div>
                    </div>
                  )}
                  <HistoryCard
                    job={job}
                    onDelete={() => setHistory((h) => h.filter((j) => j.id !== job.id))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom info bar */}
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
