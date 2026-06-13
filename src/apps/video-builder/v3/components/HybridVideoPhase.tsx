// ── HybridVideoPhase (P3d) ───────────────────────────────────────────────────
// The hybrid 1-luồng UI: it replaces the mode-1 Action-Inserts + Creator-Video +
// Auto-Edit + Export chain with a single screen.
//
//   1. PLAN (free)   — directBrollScenes + assignSceneTiming → review the shot list
//      (lips / b-roll / 3D + stickers). 0 credit. "Đạo diễn lại" re-rolls.
//   2. TẠO VIDEO     — renderCreatorKeyframe (voice + the talking face in one call) →
//      re-time the plan to the REAL voice → renderHybridScenes (per-scene Kling) →
//      render sticker PNGs + place them → assembleHybridVideo → final MP4.
//   3. KẾT QUẢ       — play + download + làm lại.
//
// Reuses the whole engine built in P0-P3c (brollDirector, hybridRenderer,
// hybridAssembler, creatorVideoEngine, stickerRenderer). The mode-1 components are
// untouched (still reachable via the wizard / Legacy).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import {
  Loader2, Wand2, Clapperboard, Download, RotateCcw, AlertCircle, Film, Mic, User, Sparkles,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import { directBrollScenes, assignSceneTiming, type TimedBrollScene, type BrollSticker } from '../services/brollDirector'
import { renderHybridScenes, type HybridRenderContext } from '../services/hybridRenderer'
import { assembleHybridVideo, type HybridSceneClip, type HybridStickerPlacement } from '../services/hybridAssembler'
import { renderCreatorKeyframe } from '../services/creatorVideoEngine'
import { renderStickerBlob, type StickerStyle } from '../services/stickerRenderer'
import { computeWordTimestampFromAlignment, computeQuoteTimestamp } from '../services/insertTimingEngine'
import { saveAsset } from '../../../../utils/assetStore'
import { matchVoiceForAvatar } from '../services/voiceCreatorMatcher'
import type { VoiceAlignment } from '../types'

const now = () => Date.now()

type Stage = 'idle' | 'planning' | 'planned' | 'making' | 'done' | 'error'

interface SceneRow { scene: TimedBrollScene; status: 'pending' | 'rendering' | 'done' | 'failed' }

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  lips:        { label: '🗣 Nói',     cls: 'bg-violet-100 text-violet-700' },
  broll:       { label: '🎬 Cảnh',    cls: 'bg-sky-100 text-sky-700' },
  mechanism3d: { label: '🧬 3D',      cls: 'bg-amber-100 text-amber-700' },
}

export default function HybridVideoPhase() {
  const state         = useAdsVideoStore((s) => s.state)
  const addToast      = useAppStore((s) => s.addToast)
  const geminiKey     = useSettingsStore((s) => s.geminiApiKey)
  const kieApiKey     = useSettingsStore((s) => s.kieApiKey)
  const elevenLabsKey = useSettingsStore((s) => s.elevenLabsApiKey)

  const script = state.scriptBrain.script

  const [stage, setStage] = useState<Stage>('idle')
  const [scenes, setScenes] = useState<SceneRow[]>([])
  const [stickers, setStickers] = useState<BrollSticker[]>([])
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [videoRef, setVideoRef] = useState<string | null>(null)
  const planRanFor = useRef<string | null>(null)

  const resolution = state.costMode === 'FULL' ? '1080p' : state.costMode === 'STANDARD' ? '720p' : '480p'
  const voiceDurEstimate = script?.totalDurationSec ?? 50

  // ── 1. PLAN (free) ─────────────────────────────────────────────────────────
  const runPlan = async () => {
    if (!script) { addToast('Chưa có kịch bản (Bước 1)', 'error'); return }
    if (!geminiKey) { addToast('Thiếu Gemini key trong Cài đặt', 'error'); return }
    setStage('planning'); setError(''); setVideoRef(null)
    try {
      const res = await directBrollScenes({
        geminiKey, script, lang: state.scriptBrain.outputLang,
        product: state.inputs.product, voiceDurationSec: voiceDurEstimate,
      })
      // Time the plan on the estimate for now (re-timed to the real voice at render).
      const alignment = state.voiceFirst?.voiceAlignment ?? state.creatorVideo?.voiceAlignment
      const timed = assignSceneTiming(res.scenes, alignment, script, state.voiceFirst?.voiceDurationSec ?? voiceDurEstimate)
      setScenes(timed.map((scene) => ({ scene, status: 'pending' as const })))
      setStickers(res.stickers)
      setStage('planned')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStage('error')
    }
  }

  // Auto-plan once when the script first arrives (0 credit).
  useEffect(() => {
    const sig = script ? `${script.generatedAt}` : null
    if (script && sig && planRanFor.current !== sig && stage === 'idle') {
      planRanFor.current = sig
      void runPlan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script])

  // ── 2. TẠO VIDEO (credit) ───────────────────────────────────────────────────
  const makeVideo = async () => {
    if (!script) return
    if (!kieApiKey) { addToast('Thiếu KIE key', 'error'); return }
    if (!elevenLabsKey) { addToast('Thiếu ElevenLabs key (cần cho giọng + mặt creator)', 'error'); return }
    const avatar = state.inputs.avatar
    if (!avatar) { addToast('Cần chọn Avatar creator ở Bước 1', 'error'); return }

    setStage('making'); setError('')
    try {
      // 2a. Voice + keyframe (one call).
      setProgress('Đang tạo giọng + khuôn mặt creator…')
      const voiceCategory = state.scriptBrain.voiceCategory
        ?? matchVoiceForAvatar(avatar, state.scriptBrain.angle)
      const kf = await renderCreatorKeyframe({
        kieApiKey, elevenLabsApiKey: elevenLabsKey, config: state.creatorVideoConfig,
        script, voiceCategory, voiceId: state.scriptBrain.voice?.voiceId ?? null,
        avatar, product: state.inputs.product,
        reuseVoiceRef: state.voiceFirst?.voiceRef,
        reuseVoiceDurationSec: state.voiceFirst?.voiceDurationSec,
        reuseVoiceId: state.voiceFirst?.voiceId,
        reuseVoiceAlignment: state.voiceFirst?.voiceAlignment,
        onStageUpdate: (u) => setProgress(`Khuôn mặt: ${u.stage}…`),
      })

      // 2b. Re-time the reviewed plan to the REAL voice (scene list unchanged).
      const realDur = kf.voiceDurationSec
      const timed = assignSceneTiming(scenes.map((r) => r.scene), kf.voiceAlignment, script, realDur)
      setScenes(timed.map((scene) => ({ scene, status: 'pending' as const })))

      // 2c. Render every scene (concurrency 2), updating each card as it lands.
      const ctx: HybridRenderContext = {
        kieApiKey, keyframeRef: kf.keyframeRef, voiceRef: kf.voiceRef,
        product: state.inputs.product, avatar: state.inputs.avatar,
        creatorVideoConfig: state.creatorVideoConfig, resolution,
      }
      setProgress(`Đang dựng ${timed.length} cảnh…`)
      const { clips, failed } = await renderHybridScenes(timed, ctx, {
        concurrency: 2,
        onSceneStart: (i) => setScenes((rows) => rows.map((r, k) => (k === i ? { ...r, status: 'rendering' } : r))),
        onSceneDone: (i, clip) => setScenes((rows) => rows.map((r, k) => (k === i ? { ...r, status: clip ? 'done' : 'failed' } : r))),
      })
      const sceneClips = clips.filter((c): c is HybridSceneClip => !!c)
      if (sceneClips.length === 0) throw new Error('Không cảnh nào dựng được — kiểm tra KIE key / credit.')
      if (failed.length) addToast(`${failed.length} cảnh lỗi, bỏ qua — video vẫn ghép phần còn lại`, 'info')

      // 2d. Sticker PNGs + placement (0 credit), then assemble.
      setProgress('Đang vẽ sticker + ghép video…')
      const placements = await buildStickerPlacements(stickers, kf.voiceAlignment, realDur)
      const result = await assembleHybridVideo({
        clips: sceneClips, voiceRef: kf.voiceRef, voiceDurationSec: realDur,
        resolution, stickers: placements,
        onStage: (m) => setProgress(m),
      })
      setVideoRef(result.videoRef)
      setStage('done')
      addToast('✓ Video hybrid xong!', 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg); setStage('error')
      addToast(`Lỗi tạo video: ${msg.slice(0, 140)}`, 'error')
    }
  }

  // Sticker → transparent PNG + absolute pop second (word-align → quote estimate),
  // spacing-deduped ≥3s so they don't stack. (Same logic as the dev export helper.)
  const buildStickerPlacements = async (
    raw: BrollSticker[], alignment: VoiceAlignment | undefined, realDur: number,
  ): Promise<HybridStickerPlacement[]> => {
    const dated = raw
      .map((stk) => {
        const at = (alignment ? computeWordTimestampFromAlignment(alignment, stk.quote, stk.wordAnchor) : null)
          ?? (script ? computeQuoteTimestamp(script, stk.quote) : null)
        return { stk, at }
      })
      .filter((x): x is { stk: BrollSticker; at: number } => typeof x.at === 'number' && x.at < realDur)
      .sort((a, b) => a.at - b.at)
    const out: HybridStickerPlacement[] = []
    let last = -Infinity
    for (const { stk, at } of dated) {
      if (at - last < 3.0) continue
      last = at
      try {
        const blob = await renderStickerBlob({ style: stk.style as StickerStyle, text: stk.text ?? '', items: stk.items })
        const pngRef = await saveAsset(blob, 'image/png')
        out.push({ pngRef, atSec: at, durationSec: 2.7, heightFraction: 0.1 })
      } catch { /* skip a bad sticker */ }
    }
    return out
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const finalUrl = useAssetUrl(videoRef ?? undefined)
  const lipsN = scenes.filter((r) => r.scene.role === 'lips').length
  const doneN = scenes.filter((r) => r.status === 'done').length
  const busy = stage === 'planning' || stage === 'making'

  if (!script) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-500">
        Chưa có kịch bản — quay lại Bước 1 để tạo kịch bản trước.
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Video Hybrid — 1 luồng</h2>
          <p className="text-[12px] text-gray-500">
            AI đạo diễn cả video thành chuỗi cảnh (mặt nói + cảnh sản phẩm + 3D) phủ kín giọng đọc,
            kèm sticker. Soát kịch bản cảnh bên dưới (miễn phí), rồi bấm <strong>Tạo video</strong>.
          </p>
        </div>

        {/* ── Plan toolbar ─────────────────────────────────────────────────── */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-3">
          <Film className="h-5 w-5 shrink-0 text-violet-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">
              {stage === 'planning' ? 'Đang đạo diễn…'
                : scenes.length > 0 ? `${scenes.length} cảnh · ${lipsN} cảnh mặt nói · ${stickers.length} sticker · ${resolution}`
                : 'Chưa có kịch bản cảnh'}
            </p>
            <p className="text-[11px] text-gray-500">
              Đạo diễn + soát cảnh: 0 credit. "Tạo video" mới render (tốn credit theo từng cảnh).
            </p>
          </div>
          <button
            onClick={runPlan}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-2 text-[12px] font-bold text-violet-700 shadow-sm hover:bg-violet-50 disabled:opacity-50"
          >
            {stage === 'planning' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {scenes.length > 0 ? 'Đạo diễn lại' : 'Đạo diễn'}
          </button>
          <button
            onClick={makeVideo}
            disabled={busy || scenes.length === 0}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
          >
            {stage === 'making' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="h-3.5 w-3.5" />}
            Tạo video
          </button>
        </div>

        {/* ── Progress / error ─────────────────────────────────────────────── */}
        {stage === 'making' && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-800">
            <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
            {progress} {doneN > 0 && <span className="font-bold">· {doneN}/{scenes.length} cảnh xong</span>}
            <span className="mt-1 block text-[11px] text-emerald-700/80">Đừng đóng tab — render Kling mất vài phút/cảnh, chạy song song 2.</span>
          </div>
        )}
        {stage === 'error' && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {/* ── Result video ─────────────────────────────────────────────────── */}
        {stage === 'done' && finalUrl && (
          <div className="mb-4 rounded-xl border border-emerald-300 bg-white p-3">
            <p className="mb-2 text-sm font-bold text-emerald-700">✓ Video hoàn chỉnh</p>
            <video src={finalUrl} controls className="mx-auto max-h-[60vh] rounded-lg bg-black" />
            <div className="mt-3 flex justify-center gap-2">
              <a
                href={finalUrl} download={`hybrid-${now()}.mp4`}
                className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-violet-700"
              >
                <Download className="h-3.5 w-3.5" /> Tải MP4
              </a>
              <button
                onClick={makeVideo}
                className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-[12px] font-bold text-gray-600 hover:bg-gray-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Tạo lại
              </button>
            </div>
          </div>
        )}

        {/* ── Scene plan list ──────────────────────────────────────────────── */}
        {scenes.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {scenes.map((row, i) => {
              const s = row.scene
              const badge = ROLE_BADGE[s.role] ?? ROLE_BADGE.broll
              return (
                <div key={i} className={`rounded-lg border p-2.5 ${
                  row.status === 'done' ? 'border-emerald-300 bg-emerald-50/40'
                    : row.status === 'rendering' ? 'border-violet-300 bg-violet-50/40'
                    : row.status === 'failed' ? 'border-rose-300 bg-rose-50/40'
                    : 'border-gray-200 bg-white'}`}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-gray-400">#{i + 1}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${badge.cls}`}>{badge.label}</span>
                    <span className="text-[9px] text-gray-400">{s.startSec.toFixed(1)}-{s.endSec.toFixed(1)}s</span>
                    {s.cameraFraming === 'hands_noface' && <span className="rounded bg-gray-100 px-1 text-[8px] text-gray-500">no-face</span>}
                    <span className="ml-auto">
                      {row.status === 'rendering' && <Loader2 className="h-3 w-3 animate-spin text-violet-500" />}
                      {row.status === 'done' && <span className="text-[10px] text-emerald-600">✓</span>}
                      {row.status === 'failed' && <span className="text-[10px] text-rose-600">✗</span>}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold leading-tight text-gray-800">“{s.quote}”</p>
                  {s.role !== 'lips' && s.conceptPrompt && (
                    <p className="mt-1 line-clamp-2 text-[10px] italic leading-tight text-gray-500">{s.conceptPrompt}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Sticker preview chips ────────────────────────────────────────── */}
        {stickers.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Sticker ({stickers.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {stickers.map((st, i) => (
                <span key={i} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  {st.items?.length ? st.items.join(' · ') : st.text}
                </span>
              ))}
            </div>
          </div>
        )}

        {scenes.length === 0 && stage !== 'planning' && (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-[12px] text-gray-400">
            <Sparkles className="mx-auto mb-2 h-7 w-7 text-gray-300" />
            Bấm "Đạo diễn" để AI tách kịch bản thành cảnh.
          </div>
        )}

        {/* requirements hint */}
        <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><User className="h-3 w-3" /> Avatar: {state.inputs.avatar ? '✓' : '⚠ cần chọn ở Bước 1'}</span>
          <span className="flex items-center gap-1"><Mic className="h-3 w-3" /> ElevenLabs: {elevenLabsKey ? '✓' : '⚠ thiếu key'}</span>
          <span className="flex items-center gap-1"><Film className="h-3 w-3" /> KIE: {kieApiKey ? '✓' : '⚠ thiếu key'}</span>
        </div>
      </div>
    </div>
  )
}
