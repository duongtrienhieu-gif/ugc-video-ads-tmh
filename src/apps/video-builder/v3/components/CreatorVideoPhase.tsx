// ── CreatorVideoPhase ────────────────────────────────────────────────────────
// Z32 Phase 3 UI — main creator talking-head render.
//
// Layout:
//   1. Top — 6 preset cards (Malay Mom Casual / Skincare Creator / etc).
//      Click = applyCreatorPreset → fills setting + energy + wardrobe.
//   2. Customise row — Setting picker (8) + Energy picker (6) + Wardrobe
//      textarea for fine-grained override.
//   3. Render banner — single big "Tạo creator video" button. Cost preview.
//   4. Multi-stage progress strip — TTS → Keyframe → Preview → Full lipsync
//      with per-stage spinner / check / error states.
//   5. Video preview tiles — keyframe still + preview clip + full clip
//      once each lands. Player supports play/pause.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react'
import {
  Loader2, Sparkles, AlertCircle, ChevronRight, Check,
  Wand2, Mic2, ImageIcon, Film, RotateCcw,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import { matchVoiceForAvatar } from '../services/voiceCreatorMatcher'
import {
  CREATOR_VIDEO_STAGE_LABEL_VI,
  V3_CREDIT_COST, formatCredits, estimateLipsyncCredits,
  type CreatorVideoStage,
} from '../types'
import { CREATOR_SETTINGS } from '../services/creatorSettings'
import {
  CREATOR_ENERGIES, recommendEnergyForAngle,
} from '../services/creatorEnergy'
import { styleCreatorWithGemini } from '../services/creatorPresets'
import { renderCreatorVideo, resumeCreatorVideoLipsync, previewCreatorVoice } from '../services/creatorVideoEngine'

// ── Stage progress strip ───────────────────────────────────────────────────

// Z38 — 'preview_motion' removed from the visible pipeline (it was a
// duplicate full-length render that double-charged). One Kling pass now.
const STAGE_ORDER: CreatorVideoStage[] = [
  'tts', 'keyframe', 'lipsync_full', 'completed',
]

const STAGE_ICON: Record<CreatorVideoStage, React.ElementType> = {
  idle:           Loader2,
  tts:            Mic2,
  keyframe:       ImageIcon,
  preview_motion: Film,
  lipsync_full:   Film,
  completed:      Check,
  failed:         AlertCircle,
}

function StageStrip({ stage, error }: { stage: CreatorVideoStage; error?: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
        Pipeline render
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {STAGE_ORDER.filter((s) => s !== 'completed').map((s, i) => {
          const Icon = STAGE_ICON[s]
          const idx = STAGE_ORDER.indexOf(stage)
          const sIdx = STAGE_ORDER.indexOf(s)
          const isActive = s === stage
          const isPast = idx > sIdx
          const isFuture = idx < sIdx || stage === 'idle'
          const baseCls = isActive
            ? 'bg-violet-100 text-violet-800 border-violet-300'
            : isPast
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
              : isFuture
                ? 'bg-gray-50 text-gray-400 border-gray-200'
                : 'bg-gray-50 text-gray-400 border-gray-200'
          return (
            <div key={s} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${baseCls}`}>
                {isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isPast ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                <span>{CREATOR_VIDEO_STAGE_LABEL_VI[s]}</span>
              </div>
              {i < STAGE_ORDER.length - 2 && <ChevronRight className="h-3 w-3 text-gray-300" />}
            </div>
          )
        })}
        {stage === 'completed' && (
          <span className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">
            ✓ Đã xong
          </span>
        )}
        {stage === 'failed' && (
          <span className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white">
            ✗ Lỗi
          </span>
        )}
      </div>
      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-800">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

// ── Video player tile ──────────────────────────────────────────────────────

function VideoTile({
  assetRef, label, badge,
}: {
  assetRef: string | undefined
  label: string
  badge?: string
}) {
  const resolved = useAssetUrl(assetRef ?? undefined)
  const src = assetRef?.startsWith('http') ? assetRef : resolved

  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
      <div className="relative aspect-[9/16] bg-black">
        {src ? (
          // Z94 — native <video controls> gives a timeline/scrub bar, seek,
          // fullscreen + (via the browser) save. object-contain shows the full
          // 9:16 frame uncropped for review.
          <video
            src={src}
            controls
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <Film className="h-10 w-10 opacity-40" />
          </div>
        )}
        {badge && (
          <span className="absolute left-2 top-2 z-10 rounded bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 p-2">
        <span className="truncate text-[11px] font-semibold text-gray-600">{label}</span>
        {src && (
          <span className="flex shrink-0 gap-1">
            {/* Z94 — it cost ~600cr to render; always let the user keep it. */}
            <a
              href={src}
              download="creator-video.mp4"
              className="rounded-md border border-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600 hover:bg-gray-50"
            >
              ⬇ Tải MP4
            </a>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600 hover:bg-gray-50"
            >
              ↗ Tab mới
            </a>
          </span>
        )}
      </div>
    </div>
  )
}

// ── Keyframe still tile ────────────────────────────────────────────────────

function ImageTile({ assetRef, label }: { assetRef: string | undefined; label: string }) {
  const resolved = useAssetUrl(assetRef ?? undefined)
  const src = assetRef?.startsWith('http') ? assetRef : resolved
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
      <div className="aspect-[9/16] bg-gray-100">
        {src ? (
          <img src={src} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <ImageIcon className="h-10 w-10 opacity-40" />
          </div>
        )}
      </div>
      <div className="p-2 text-center text-[11px] font-semibold text-gray-600">{label}</div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props { onContinue: () => void }

export default function CreatorVideoPhase({ onContinue }: Props) {
  const state = useAdsVideoStore((s) => s.state)
  const patchCreatorVideoConfig = useAdsVideoStore((s) => s.patchCreatorVideoConfig)
  const setCreatorVideo         = useAdsVideoStore((s) => s.setCreatorVideo)
  const patchCreatorVideo       = useAdsVideoStore((s) => s.patchCreatorVideo)

  const kieApiKey       = useSettingsStore((s) => s.kieApiKey)
  const elevenLabsKey   = useSettingsStore((s) => s.elevenLabsApiKey)
  const geminiKey       = useSettingsStore((s) => s.geminiApiKey)
  const addToast        = useAppStore((s) => s.addToast)

  const config = state.creatorVideoConfig
  const clip   = state.creatorVideo
  const brain  = state.scriptBrain

  // Z41 AI Stylist — auto-composes persona (setting/energy/wardrobe).
  const [isStyling, setIsStyling] = useState(false)
  const [aiReason, setAiReason]   = useState<string | null>(null)
  const autoStyledRef = useRef(false)

  // Z53 — voice-only preview (TTS, no lipsync) so the user hears the real
  // script + voice + expressive setting + which model (v3/v2) before paying.
  const [voicePreviewing, setVoicePreviewing] = useState(false)
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null)
  const [voicePreviewModel, setVoicePreviewModel] = useState<string | null>(null)
  // Z64 — the MEASURED real voice duration from the preview. The header/banner
  // show this once known (vs the WPM estimate, which varies by voice/run and
  // kept confusing the user). null = not previewed yet → fall back to estimate.
  const [voicePreviewDuration, setVoicePreviewDuration] = useState<number | null>(null)

  // Best duration to DISPLAY: measured (real) once previewed, else the estimate.
  const displayDurationSec = voicePreviewDuration ?? brain.script?.totalDurationSec ?? null
  const durationIsReal = voicePreviewDuration != null

  // Z38 — cost of THIS render = TTS + keyframe + ONE Kling lipsync (no more
  // duplicate preview render). Lipsync scales with the real script duration
  // (Kling avatar is billed ~per second), so the chip reflects actual KIE cost.
  const lipsyncCredits = estimateLipsyncCredits(brain.script?.totalDurationSec ?? 30)
  const stepCredits =
    V3_CREDIT_COST.tts +
    V3_CREDIT_COST.keyframe +
    lipsyncCredits

  // Auto-suggest energy based on selected ad angle (but only if user hasn't
  // already changed energy from the default).
  useEffect(() => {
    if (config.energy === 'conversational' && !config.preset) {
      const recommended = recommendEnergyForAngle(brain.angle)
      if (recommended !== 'conversational') {
        patchCreatorVideoConfig({ energy: recommended })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brain.angle])

  const stage = clip?.stage ?? 'idle'
  const isRendering = stage !== 'idle' && stage !== 'completed' && stage !== 'failed'

  // ── Handlers ─────────────────────────────────────────────────────────────

  // Z53 — hear the voice on the REAL script before paying for lipsync.
  // Runs ONLY the TTS step (cheap) and plays it back; reports v3 vs v2.
  const handlePreviewVoice = async () => {
    if (!elevenLabsKey) { addToast('Thiếu ElevenLabs API key trong Settings', 'error'); return }
    if (!brain.script) { addToast('Chưa có script — quay lại bước Script + Voice', 'error'); return }
    if (!state.inputs.avatar) { addToast('Chưa pick avatar — quay lại bước 1', 'error'); return }
    setVoicePreviewing(true)
    setVoicePreviewModel(null)
    try {
      const result = await previewCreatorVoice({
        elevenLabsApiKey: elevenLabsKey,
        script: brain.script,
        voiceCategory: brain.voiceCategory ?? matchVoiceForAvatar(state.inputs.avatar, brain.angle),
        voiceId: state.inputs.voiceId,
      })
      // Revoke any previous object URL before replacing it.
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl)
      const url = URL.createObjectURL(result.audioBlob)
      setVoicePreviewUrl(url)
      setVoicePreviewModel(result.modelUsed)
      setVoicePreviewDuration(result.durationSec)
      const v3 = result.modelUsed === 'eleven_v3'
      addToast(
        v3
          ? '🔊 Giọng v3 (biểu cảm cao) — nghe thử bên dưới'
          : '🔊 Nghe thử bên dưới · Key không có v3 → dùng v2 (biểu cảm vừa)',
        'success',
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Nghe thử giọng lỗi: ${msg}`, 'error')
    } finally {
      setVoicePreviewing(false)
    }
  }

  const handleRender = async () => {
    if (!kieApiKey) { addToast('Thiếu KIE API key trong Settings', 'error'); return }
    if (!elevenLabsKey) { addToast('Thiếu ElevenLabs API key trong Settings', 'error'); return }
    if (!brain.script) { addToast('Chưa có script — quay lại bước Script + Voice', 'error'); return }
    if (!state.inputs.avatar) { addToast('Chưa pick avatar — quay lại bước 1', 'error'); return }

    // Seed the creator video clip with config + idle stage
    setCreatorVideo({
      stage: 'tts',
      status: 'rendering',
      config,
      durationSec: brain.script.totalDurationSec,
      resolution: config.resolution,
      startedAt: Date.now(),
    })

    try {
      const result = await renderCreatorVideo({
        kieApiKey,
        elevenLabsApiKey: elevenLabsKey,
        config,
        script: brain.script,
        // Tone picker removed — auto-pick a sensible voice category from
        // avatar gender + ad angle (gives female voice for female avatar, etc).
        // User can still override via the specific voice picker.
        voiceCategory: brain.voiceCategory ?? matchVoiceForAvatar(state.inputs.avatar, brain.angle),
        voiceId: state.inputs.voiceId,
        avatar: state.inputs.avatar,
        product: state.inputs.product,
        onStageUpdate: (update) => {
          patchCreatorVideo({
            stage: update.stage,
            ...(update.voiceRef !== undefined          && { voiceRef: update.voiceRef }),
            ...(update.voiceDurationSec !== undefined  && { voiceDurationSec: update.voiceDurationSec }),
            ...(update.voiceId !== undefined           && { voiceId: update.voiceId }),
            ...(update.keyframeRef !== undefined       && { keyframeRef: update.keyframeRef }),
            ...(update.keyframePromptUsed !== undefined && { keyframePromptUsed: update.keyframePromptUsed }),
            ...(update.fullLipsyncTaskId !== undefined && { fullLipsyncTaskId: update.fullLipsyncTaskId }),
            ...(update.videoRef !== undefined          && { videoRef: update.videoRef }),
            ...(update.error !== undefined             && { error: update.error }),
          })
        },
      })
      patchCreatorVideo({
        stage: 'completed',
        status: 'completed',
        videoRef: result.videoRef,
        finishedAt: Date.now(),
      })
      addToast('✓ Creator video rendered!', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      patchCreatorVideo({
        stage: 'failed',
        status: 'failed',
        error: msg.slice(0, 240),
        finishedAt: Date.now(),
      })
      addToast(`Render creator video lỗi: ${msg}`, 'error')
    }
  }

  // Z38 — RESUME a render that timed out. The Kling job was already submitted
  // and PAID FOR; its taskId is saved. This re-polls that same job — it does
  // NOT submit a new one, so it costs ZERO extra credit. Shown when a render
  // failed/timed-out but we still hold the taskId and have no final video.
  const canResume = !!clip?.fullLipsyncTaskId && !clip?.videoRef &&
    (clip?.stage === 'failed' || clip?.stage === 'lipsync_full')

  const handleResume = async () => {
    if (!kieApiKey) { addToast('Thiếu KIE API key trong Settings', 'error'); return }
    const taskId = clip?.fullLipsyncTaskId
    if (!taskId) { addToast('Không tìm thấy job để khôi phục', 'error'); return }

    patchCreatorVideo({ stage: 'lipsync_full', status: 'rendering', error: undefined })
    try {
      const { videoRef } = await resumeCreatorVideoLipsync({
        kieApiKey,
        taskId,
        onStageUpdate: (update) => {
          patchCreatorVideo({
            stage: update.stage,
            ...(update.fullLipsyncTaskId !== undefined && { fullLipsyncTaskId: update.fullLipsyncTaskId }),
            ...(update.videoRef !== undefined          && { videoRef: update.videoRef }),
          })
        },
      })
      patchCreatorVideo({
        stage: 'completed',
        status: 'completed',
        videoRef,
        finishedAt: Date.now(),
      })
      addToast('✓ Đã khôi phục video từ job đã trả tiền — không tốn thêm credit!', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      patchCreatorVideo({ stage: 'failed', status: 'failed', error: msg.slice(0, 240) })
      addToast(`Khôi phục lỗi: ${msg}. Job có thể đã hết hạn trên KIE.`, 'error')
    }
  }

  // ── Z41 AI Stylist ─────────────────────────────────────────────────────────
  // Reads product + market + angle + avatar + hook and auto-composes the
  // persona (setting / energy / wardrobe). manual=true surfaces errors; the
  // auto-run stays silent on failure so it never nags. One Gemini text call —
  // NO KIE credit (nothing is rendered here).
  const runStylist = async (manual: boolean) => {
    if (!geminiKey) {
      if (manual) addToast('Cần Gemini key trong Settings để AI stylist chạy', 'error')
      return
    }
    if (!brain.script && !state.inputs.product) {
      if (manual) addToast('Chưa có sản phẩm / kịch bản để AI tham chiếu', 'error')
      return
    }
    setIsStyling(true)
    try {
      const hook =
        brain.script?.blocks.find((b) => b.id === 'hook')?.text ??
        brain.script?.blocks[0]?.text
      const result = await styleCreatorWithGemini({
        geminiKey,
        product: state.inputs.product,
        avatarName: state.inputs.avatar?.name,
        avatarNotes: state.inputs.avatar?.notes,
        angle: brain.angle,
        scriptHook: hook,
        lang: brain.outputLang,
      })
      patchCreatorVideoConfig({
        setting: result.setting,
        energy: result.energy,
        wardrobeNote: result.wardrobeNote,
        preset: null,
      })
      setAiReason(result.reason || null)
      addToast(
        `✓ AI stylist: ${CREATOR_SETTINGS[result.setting].labelVi} · ${CREATOR_ENERGIES[result.energy].labelVi}`,
        'success',
      )
    } catch (err) {
      if (manual) {
        const msg = err instanceof Error ? err.message : String(err)
        addToast(`AI stylist lỗi: ${msg.slice(0, 160)}`, 'error')
      }
    } finally {
      setIsStyling(false)
    }
  }

  // Auto-run the stylist ONCE on entry — only on a fresh, untouched config so
  // we never overwrite the user's manual choices or a finished render.
  useEffect(() => {
    if (autoStyledRef.current) return
    if (!brain.script) return
    if (!geminiKey) return
    if (config.wardrobeNote.trim() !== '' || config.preset !== null) {
      autoStyledRef.current = true
      return
    }
    if (clip?.videoRef) { autoStyledRef.current = true; return }
    autoStyledRef.current = true
    void runStylist(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brain.script])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Bước 3 — Video creator chính (talking head)</h2>
          <p className="text-[12px] text-gray-500">
            70-80% của video cuối — 1 video creator lipsync liên tục. Voice timeline {durationIsReal ? 'thật' : 'ước tính'} ~{displayDurationSec?.toFixed(1) ?? '—'}s{durationIsReal ? ' (đã nghe thử)' : ' — nghe thử để biết số chính xác'}.
          </p>
          <p className="mt-1.5 rounded-lg bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-800 ring-1 ring-sky-100">
            Khuôn mặt nhân vật được giữ nguyên từ avatar bạn chọn ở Bước 1. AI tự chọn sẵn <b>bối cảnh</b>, <b>trang phục</b> và <b>thần thái</b> — bạn chỉ chỉnh lại nếu muốn, rồi app dựng video người đó đang nói đúng kịch bản (lipsync).
          </p>
        </div>

        {/* ── AI Stylist banner ───────────────────────────────────────────── */}
        {(brain.script || state.inputs.product) && (
          <div className="mb-4 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-4">
            <div className="flex items-start gap-3">
              <Wand2 className="h-5 w-5 shrink-0 text-violet-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">
                  AI stylist — tự chọn persona theo sản phẩm
                </p>
                <p className="mt-0.5 text-[11px] text-gray-600">
                  AI <strong>tự chạy</strong> khi bạn vào bước này: đọc sản phẩm + thị trường + góc quảng cáo + avatar
                  → chọn sẵn <strong>bối cảnh</strong>, <strong>thần thái</strong>, <strong>trang phục</strong> bên dưới.
                  Bạn chỉ chỉnh lại nếu muốn. (Chưa render — không tốn KIE credit.)
                </p>
                {aiReason && (
                  <p className="mt-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] text-violet-800 ring-1 ring-violet-100">
                    💡 {aiReason}
                  </p>
                )}
                {!geminiKey && (
                  <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
                    Cần Gemini key trong Settings để AI stylist chạy — hiện bạn chọn tay bên dưới.
                  </p>
                )}
              </div>
              <button
                onClick={() => runStylist(true)}
                disabled={isStyling || isRendering}
                className="shrink-0 rounded-lg border border-violet-300 bg-white px-3 py-2 text-[12px] font-bold text-violet-700 shadow-sm hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isStyling
                  ? <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Đang chọn...</>
                  : <><Wand2 className="mr-1 inline h-3.5 w-3.5" /> {aiReason ? 'AI chọn lại' : 'AI chọn'}</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Z85 — persona is AI-decided. The stylist above auto-runs + picks
            setting / energy / wardrobe; we just SHOW the result (read-only).
            No manual preset / setting / energy pickers — "AI chọn lại" re-rolls. */}
        <div className="mt-1 rounded-xl border border-black/10 bg-white p-3 text-[12px] text-gray-700">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Persona đạo diễn AI đã chọn
          </p>
          <p>
            🎬 Bối cảnh: <b>{CREATOR_SETTINGS[config.setting].labelVi}</b>
            {'  ·  '}⚡ Thần thái: <b>{CREATOR_ENERGIES[config.energy].labelVi}</b>
          </p>
          {config.wardrobeNote.trim() !== '' && (
            <p className="mt-0.5">👕 Trang phục: {config.wardrobeNote}</p>
          )}
          <p className="mt-1 text-[10px] text-gray-400">
            Muốn đổi? Bấm “AI chọn lại” ở khung tím phía trên.
          </p>
        </div>

        {/* ── Render banner ──────────────────────────────────────────────── */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {clip?.stage === 'completed' ? 'Đã có creator video — render lại nếu cần' : 'Render creator video'}
            </p>
            <p className="text-[11px] text-gray-500">
              {config.resolution} · ~{displayDurationSec?.toFixed(0) ?? '—'}s{durationIsReal ? ' (thật)' : ' (ước tính)'} · TTS → keyframe → lipsync · bước này {formatCredits(stepCredits)}
            </p>
            <p className="mt-1 text-[10px] text-gray-400">
              Ước tính theo độ dài kịch bản (Kling tính tiền theo giây). Chỉ render 1 lần — nếu timeout, bấm “Khôi phục” để lấy lại video đã trả tiền, không tốn thêm credit.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <button
              onClick={handleRender}
              disabled={isRendering || !brain.script}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRendering ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Đang render...</>
              ) : clip?.stage === 'completed' ? (
                <><RotateCcw className="h-4 w-4" /> Render lại · {formatCredits(stepCredits)}</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Tạo creator video · {formatCredits(stepCredits)}</>
              )}
            </button>
            {/* Z53 — nghe thử giọng trước khi tốn credit lipsync */}
            <button
              onClick={handlePreviewVoice}
              disabled={voicePreviewing || isRendering || !brain.script}
              className="flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-4 py-1.5 text-[12px] font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Chỉ tạo giọng (TTS) để nghe thử — KHÔNG tốn credit lipsync. Nghe ưng mới tạo video."
            >
              {voicePreviewing
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tạo giọng...</>
                : <><Mic2 className="h-3.5 w-3.5" /> Nghe thử giọng (không tốn lipsync)</>}
            </button>
            {canResume && !isRendering && (
              <button
                onClick={handleResume}
                className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-[12px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                title="Job đã được tính tiền — lấy lại video mà không tốn thêm credit"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Khôi phục video (0 credit)
              </button>
            )}
          </div>
        </div>

        {/* Z53 — voice preview player */}
        {voicePreviewUrl && (
          <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <Mic2 className="h-4 w-4 text-violet-600" />
              <span className="text-[12px] font-bold text-gray-800">Nghe thử giọng</span>
              {voicePreviewModel && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  voicePreviewModel === 'eleven_v3'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {voicePreviewModel === 'eleven_v3' ? 'v3 · biểu cảm cao' : 'v2 · biểu cảm vừa (key không có v3)'}
                </span>
              )}
              {voicePreviewDuration != null && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                  Thời lượng thật: {voicePreviewDuration.toFixed(1)}s
                </span>
              )}
            </div>
            <audio controls src={voicePreviewUrl} className="w-full" />
            <p className="mt-1.5 text-[11px] text-gray-500">
              Đây là giọng + tốc độ + ĐỘ DÀI thật sẽ dùng cho video (số ở trên cùng giờ là số thật, không phải ước tính). Nghe ưng thì bấm “Tạo creator video”. Đổi giọng ở bước Script + Voice rồi nghe lại nếu chưa hợp.
            </p>
          </div>
        )}

        {/* ── Stage progress strip ────────────────────────────────────────── */}
        {clip && clip.stage !== 'idle' && (
          <div className="mt-3">
            <StageStrip stage={clip.stage} error={clip.error} />
          </div>
        )}

        {/* ── Output tiles ────────────────────────────────────────────────── */}
        {clip && (clip.keyframeRef || clip.videoRef) && (
          <div className="mt-4">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Output</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {clip.keyframeRef && (
                <ImageTile assetRef={clip.keyframeRef} label="Keyframe (still)" />
              )}
              {clip.videoRef && (
                <VideoTile assetRef={clip.videoRef} label="Full lipsync video" badge="✓ FINAL" />
              )}
            </div>
          </div>
        )}

        {/* ── Continue button ──────────────────────────────────────────────── */}
        {clip?.stage === 'completed' && clip.videoRef && (
          <div className="mt-5 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-4">
            <div>
              <p className="text-sm font-bold text-emerald-900">
                ✓ Creator video sẵn sàng — {clip.voiceDurationSec?.toFixed(1) ?? '—'}s
              </p>
              <p className="text-[11px] text-emerald-700">
                Sang Auto-Edit để ghép talking-head với B-roll thành video hoàn chỉnh.
              </p>
            </div>
            <button
              onClick={onContinue}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
            >
              Tiếp tục → Auto-Edit <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
