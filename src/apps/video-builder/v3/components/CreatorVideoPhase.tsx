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
  Loader2, Sparkles, AlertCircle, ChevronRight, Play, Pause, Check,
  Wand2, Mic2, ImageIcon, Film, RotateCcw,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import {
  CREATOR_VIDEO_STAGE_LABEL_VI, COST_MODE_CONFIG,
  V3_CREDIT_COST, formatCredits,
  type CreatorSettingId, type CreatorEnergyLevel, type CreatorPresetId,
  type CreatorVideoStage,
} from '../types'
import {
  CREATOR_SETTINGS, CREATOR_SETTING_ORDER,
} from '../services/creatorSettings'
import {
  CREATOR_ENERGIES, CREATOR_ENERGY_ORDER, recommendEnergyForAngle,
} from '../services/creatorEnergy'
import {
  CREATOR_PRESETS, CREATOR_PRESET_ORDER,
} from '../services/creatorPresets'
import { renderCreatorVideo } from '../services/creatorVideoEngine'

const TONE_BG: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  violet:  'bg-violet-100 text-violet-800 border-violet-300',
  amber:   'bg-amber-100 text-amber-800 border-amber-300',
  pink:    'bg-pink-100 text-pink-800 border-pink-300',
  sky:     'bg-sky-100 text-sky-800 border-sky-300',
  rose:    'bg-rose-100 text-rose-800 border-rose-300',
}

// ── Stage progress strip ───────────────────────────────────────────────────

const STAGE_ORDER: CreatorVideoStage[] = [
  'tts', 'keyframe', 'preview_motion', 'lipsync_full', 'completed',
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
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const resolved = useAssetUrl(assetRef ?? undefined)
  const src = assetRef?.startsWith('http') ? assetRef : resolved

  const toggle = () => {
    if (!ref.current) return
    if (ref.current.paused) { ref.current.play(); setPlaying(true) }
    else { ref.current.pause(); setPlaying(false) }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
      <div className="relative aspect-[9/16] bg-gray-100">
        {src ? (
          <>
            <video
              ref={ref}
              src={src}
              className="h-full w-full object-cover"
              playsInline
              loop
              muted={false}
              onClick={toggle}
              onEnded={() => setPlaying(false)}
            />
            <button
              onClick={toggle}
              className={`absolute inset-0 flex items-center justify-center bg-black/30 text-white transition-opacity ${
                playing ? 'opacity-0 hover:opacity-100' : 'opacity-100'
              }`}
            >
              {playing ? <Pause className="h-10 w-10" /> : <Play className="h-10 w-10 fill-white" />}
            </button>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <Film className="h-10 w-10 opacity-40" />
          </div>
        )}
        {badge && (
          <span className="absolute left-2 top-2 rounded bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            {badge}
          </span>
        )}
      </div>
      <div className="p-2 text-center text-[11px] font-semibold text-gray-600">{label}</div>
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
  const applyCreatorPreset      = useAdsVideoStore((s) => s.applyCreatorPreset)
  const setCreatorVideo         = useAdsVideoStore((s) => s.setCreatorVideo)
  const patchCreatorVideo       = useAdsVideoStore((s) => s.patchCreatorVideo)
  const setSkipPreviewOverride  = useAdsVideoStore((s) => s.setSkipPreviewOverride)

  const kieApiKey       = useSettingsStore((s) => s.kieApiKey)
  const elevenLabsKey   = useSettingsStore((s) => s.elevenLabsApiKey)
  const addToast        = useAppStore((s) => s.addToast)

  const config = state.creatorVideoConfig
  const clip   = state.creatorVideo
  const brain  = state.scriptBrain

  const costModeCfg = COST_MODE_CONFIG[state.costMode]
  const skipPreview = state.skipPreviewOverride ?? costModeCfg.skipPreviewDefault

  // Cost of THIS render = TTS + keyframe + full lipsync (+ optional 1s preview).
  const stepCredits =
    V3_CREDIT_COST.tts +
    V3_CREDIT_COST.keyframe +
    V3_CREDIT_COST.lipsync +
    (skipPreview ? 0 : V3_CREDIT_COST.previewMotion)

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
        voiceCategory: brain.voiceCategory ?? 'energetic_creator',
        avatar: state.inputs.avatar,
        product: state.inputs.product,
        skipPreview,
        onStageUpdate: (update) => {
          patchCreatorVideo({
            stage: update.stage,
            ...(update.voiceRef !== undefined          && { voiceRef: update.voiceRef }),
            ...(update.voiceDurationSec !== undefined  && { voiceDurationSec: update.voiceDurationSec }),
            ...(update.voiceId !== undefined           && { voiceId: update.voiceId }),
            ...(update.keyframeRef !== undefined       && { keyframeRef: update.keyframeRef }),
            ...(update.keyframePromptUsed !== undefined && { keyframePromptUsed: update.keyframePromptUsed }),
            ...(update.previewVideoRef !== undefined   && { previewVideoRef: update.previewVideoRef }),
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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Bước 3 — Video creator chính (talking head)</h2>
          <p className="text-[12px] text-gray-500">
            70-80% của video cuối — 1 video creator lipsync liên tục. Voice timeline đã chốt {brain.script?.totalDurationSec.toFixed(1) ?? '—'}s.
          </p>
        </div>

        {/* ── 6 Preset cards ──────────────────────────────────────────────── */}
        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <Wand2 className="mr-1 inline h-3.5 w-3.5" /> Preset 1-click
          </h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {CREATOR_PRESET_ORDER.map((p) => {
              const cfg = CREATOR_PRESETS[p]
              const isActive = config.preset === p
              return (
                <button
                  key={p}
                  onClick={() => applyCreatorPreset(p as CreatorPresetId)}
                  className={`flex items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                    isActive
                      ? `${TONE_BG[cfg.tone]} ring-2 ring-offset-1`
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                  disabled={isRendering}
                >
                  <span className="text-2xl">{cfg.emoji}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-bold">{cfg.labelVi}</p>
                    <p className="text-[10px] leading-snug text-gray-500">{cfg.descriptionVi}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Setting + Energy + Wardrobe customise ─────────────────────── */}
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-black/10 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Setting</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {CREATOR_SETTING_ORDER.map((s) => {
                const cfg = CREATOR_SETTINGS[s]
                const isActive = config.setting === s
                return (
                  <button
                    key={s}
                    onClick={() => patchCreatorVideoConfig({ setting: s as CreatorSettingId, preset: null })}
                    disabled={isRendering}
                    title={cfg.descriptionVi}
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-left text-[10px] font-semibold transition-all ${
                      isActive ? TONE_BG[cfg.tone] : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{cfg.emoji}</span>
                    <span className="truncate">{cfg.labelVi}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Energy</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {CREATOR_ENERGY_ORDER.map((e) => {
                const cfg = CREATOR_ENERGIES[e]
                const isActive = config.energy === e
                return (
                  <button
                    key={e}
                    onClick={() => patchCreatorVideoConfig({ energy: e as CreatorEnergyLevel, preset: null })}
                    disabled={isRendering}
                    title={cfg.descriptionVi}
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-left text-[10px] font-semibold transition-all ${
                      isActive ? TONE_BG[cfg.tone] : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{cfg.emoji}</span>
                    <span className="truncate">{cfg.labelVi}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Wardrobe (free text)</p>
            <textarea
              value={config.wardrobeNote}
              onChange={(e) => patchCreatorVideoConfig({ wardrobeNote: e.target.value, preset: null })}
              disabled={isRendering}
              placeholder="VD: hijab pastel + áo cotton trắng nhẹ..."
              rows={4}
              className="mt-2 w-full resize-none rounded-lg border border-black/10 bg-black/[0.02] p-2 text-[12px] focus:border-violet-400 focus:outline-none"
            />
          </div>
        </div>

        {/* ── Render banner ──────────────────────────────────────────────── */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {clip?.stage === 'completed' ? 'Đã có creator video — render lại nếu cần' : 'Render creator video'}
            </p>
            <p className="text-[11px] text-gray-500">
              {config.resolution} · ~{brain.script?.totalDurationSec.toFixed(0) ?? '—'}s · TTS → keyframe → {skipPreview ? '' : 'preview → '}lipsync · bước này {formatCredits(stepCredits)}
            </p>
            <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] text-gray-600">
              <input
                type="checkbox"
                checked={skipPreview}
                onChange={(e) => setSkipPreviewOverride(e.target.checked)}
                className="h-3 w-3 accent-violet-600"
              />
              Bỏ qua preview 1s (nhanh + rẻ hơn, bỏ bước kiểm tra motion)
            </label>
          </div>
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
        </div>

        {/* ── Stage progress strip ────────────────────────────────────────── */}
        {clip && clip.stage !== 'idle' && (
          <div className="mt-3">
            <StageStrip stage={clip.stage} error={clip.error} />
          </div>
        )}

        {/* ── Output tiles ────────────────────────────────────────────────── */}
        {clip && (clip.keyframeRef || clip.previewVideoRef || clip.videoRef) && (
          <div className="mt-4">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Output</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {clip.keyframeRef && (
                <ImageTile assetRef={clip.keyframeRef} label="Keyframe (still)" />
              )}
              {clip.previewVideoRef && (
                <VideoTile assetRef={clip.previewVideoRef} label="Preview motion" badge="PREVIEW" />
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
                Sang Action Inserts để add B-roll moments (3-8 clips ngắn).
              </p>
            </div>
            <button
              onClick={onContinue}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
            >
              Tiếp tục → Action inserts <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
