// ── HybridVideoPhase (P3f) — Bước "Tạo Video" ────────────────────────────────
// Visual, mode-1-style control: each scene is a 9:16 FRAME with the render button
// ON it; rendered clips play right in the frame so quality is checkable at a glance.
// Voice + face show in a panel you can LISTEN to before paying. This step ONLY
// renders the scenes — assembling the final MP4 happens on the Export step (Bước 3).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  Loader2, Wand2, RotateCcw, AlertCircle, Sparkles, Mic, User, Film, Play, ChevronRight,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import { directBrollScenes, assignSceneTiming, type TimedBrollScene } from '../services/brollDirector'
import { renderOneHybridScene, type HybridRenderContext } from '../services/hybridRenderer'
import { renderCreatorKeyframe } from '../services/creatorVideoEngine'
import { matchVoiceForAvatar } from '../services/voiceCreatorMatcher'
import { estimateInsertCredits, V3_CREDIT_COST } from '../types'

const LIPS_CR_PER_SEC = 14
const ASSETS_CR = V3_CREDIT_COST.tts + V3_CREDIT_COST.keyframe

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  lips:        { label: '🗣 Nói',  cls: 'bg-violet-600/90 text-white' },
  broll:       { label: '🎬 Cảnh', cls: 'bg-sky-600/90 text-white' },
  mechanism3d: { label: '🧬 3D',   cls: 'bg-amber-500/90 text-white' },
}

interface Props { onContinue?: () => void }

export default function HybridVideoPhase(_props: Props) {
  const state          = useAdsVideoStore((s) => s.state)
  const setHybridPlan  = useAdsVideoStore((s) => s.setHybridPlan)
  const setHybridClip  = useAdsVideoStore((s) => s.setHybridClip)
  const setHybridAssets= useAdsVideoStore((s) => s.setHybridCreatorAssets)
  const setHybridResolution = useAdsVideoStore((s) => s.setHybridResolution)
  const setPhase       = useAdsVideoStore((s) => s.setPhase)
  const addToast       = useAppStore((s) => s.addToast)
  const geminiKey      = useSettingsStore((s) => s.geminiApiKey)
  const kieApiKey      = useSettingsStore((s) => s.kieApiKey)
  const elevenLabsKey  = useSettingsStore((s) => s.elevenLabsApiKey)

  const hybrid = state.hybrid
  const script = state.scriptBrain.script
  const scenes = hybrid.scenes ?? []
  const resolution = hybrid.resolution
  const hasAssets = !!(hybrid.keyframeRef && hybrid.voiceRef)

  const [planning, setPlanning] = useState(false)
  const [assetsBusy, setAssetsBusy] = useState(false)
  const [renderingIdx, setRenderingIdx] = useState<Set<number>>(new Set())
  const [failedIdx, setFailedIdx] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')

  const sceneCredit = (s: TimedBrollScene): number => {
    const dur = Math.max(1, s.endSec - s.startSec)
    return s.role === 'lips' ? Math.round(dur * LIPS_CR_PER_SEC) : estimateInsertCredits('video', resolution, dur)
  }
  const doneCount = scenes.filter((_, i) => hybrid.clips[i]).length
  const pendingIdx = scenes.map((_, i) => i).filter((i) => !hybrid.clips[i])
  const pendingCredit = pendingIdx.reduce((sum, i) => sum + sceneCredit(scenes[i]), 0)
  const allDone = scenes.length > 0 && doneCount === scenes.length
  const busy = planning || assetsBusy || renderingIdx.size > 0

  const runPlan = async () => {
    if (!script) { addToast('Chưa có kịch bản (Bước 1)', 'error'); return }
    if (!geminiKey) { addToast('Thiếu Gemini key', 'error'); return }
    setPlanning(true); setError('')
    try {
      const voiceDur = hybrid.voiceDurationSec ?? script.totalDurationSec ?? 50
      const res = await directBrollScenes({
        geminiKey, script, lang: state.scriptBrain.outputLang, product: state.inputs.product, voiceDurationSec: voiceDur,
      })
      const timed = assignSceneTiming(res.scenes, hybrid.voiceAlignment, script, voiceDur)
      setHybridPlan(timed, res.stickers, res.scenes)
      setFailedIdx(new Set())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e); setError(msg); addToast(`Đạo diễn lỗi: ${msg.slice(0, 120)}`, 'error')
    } finally { setPlanning(false) }
  }

  const makeAssets = async () => {
    if (!script) return
    if (!kieApiKey) { addToast('Thiếu KIE key', 'error'); return }
    if (!elevenLabsKey) { addToast('Thiếu ElevenLabs key', 'error'); return }
    const avatar = state.inputs.avatar
    if (!avatar) { addToast('Cần chọn Avatar ở Bước 1', 'error'); return }
    const raw = useAdsVideoStore.getState().state.hybrid.rawScenes
    if (raw.length === 0) { addToast('Bấm "Đạo diễn" trước', 'error'); return }
    setAssetsBusy(true); setError('')
    try {
      const voiceCategory = state.scriptBrain.voiceCategory ?? matchVoiceForAvatar(avatar, state.scriptBrain.angle)
      const kf = await renderCreatorKeyframe({
        kieApiKey, elevenLabsApiKey: elevenLabsKey, config: state.creatorVideoConfig,
        // The PICKED voice (Bước 1) lives in inputs.voiceId — overrides the default.
        script, voiceCategory, voiceId: state.inputs.voiceId,
        avatar, product: state.inputs.product, onStageUpdate: () => {},
      })
      setHybridAssets({ keyframeRef: kf.keyframeRef, voiceRef: kf.voiceRef, voiceDurationSec: kf.voiceDurationSec, voiceAlignment: kf.voiceAlignment })
      const timed = assignSceneTiming(raw, kf.voiceAlignment, script, kf.voiceDurationSec)
      setHybridPlan(timed, useAdsVideoStore.getState().state.hybrid.stickers, raw)
      addToast(`✓ Giọng (${kf.voiceDurationSec.toFixed(1)}s) + khuôn mặt — nghe thử rồi render cảnh`, 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e); setError(msg); addToast(`Tạo giọng/mặt lỗi: ${msg.slice(0, 120)}`, 'error')
    } finally { setAssetsBusy(false) }
  }

  const ctx = (): HybridRenderContext => ({
    kieApiKey, keyframeRef: hybrid.keyframeRef, voiceRef: hybrid.voiceRef,
    product: state.inputs.product, avatar: state.inputs.avatar, creatorVideoConfig: state.creatorVideoConfig, resolution,
  })

  const renderScene = async (i: number) => {
    if (!hasAssets) { addToast('Bấm "Tạo giọng + mặt" trước', 'error'); return }
    if (!kieApiKey) { addToast('Thiếu KIE key', 'error'); return }
    const s = (useAdsVideoStore.getState().state.hybrid.scenes ?? [])[i]
    if (!s) return
    setRenderingIdx((set) => new Set(set).add(i))
    setFailedIdx((set) => { const n = new Set(set); n.delete(i); return n })
    try {
      const videoRef = await renderOneHybridScene(s, ctx())
      setHybridClip(i, videoRef)
    } catch (e) {
      console.error(`[HYBRID_UI] cảnh ${i} lỗi:`, e)
      setFailedIdx((set) => new Set(set).add(i))
      addToast(`Cảnh #${i + 1} lỗi: ${(e instanceof Error ? e.message : String(e)).slice(0, 100)}`, 'error')
    } finally {
      setRenderingIdx((set) => { const n = new Set(set); n.delete(i); return n })
    }
  }

  const renderAll = async () => {
    if (!hasAssets) { addToast('Bấm "Tạo giọng + mặt" trước', 'error'); return }
    const queue = scenes.map((_, i) => i).filter((i) => !hybrid.clips[i])
    if (queue.length === 0) { addToast('Tất cả cảnh đã render', 'info'); return }
    addToast(`🎬 Render ${queue.length} cảnh (×2 song song)…`, 'info')
    const worker = async () => { while (queue.length) { const i = queue.shift(); if (i === undefined) break; await renderScene(i) } }
    await Promise.all([worker(), worker()])
  }

  if (!script) {
    return <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-500">Chưa có kịch bản — quay lại Bước 1.</div>
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Tạo Video — Hybrid</h2>
          <p className="text-[12px] text-gray-500">
            Render <strong>từng cảnh</strong> trên khung 9:16 để xem + kiểm chất lượng (credit hiện trên nút). Render hết rồi
            bấm <strong>Tiếp tục → Export</strong> để ghép + tải.
          </p>
        </div>

        {/* ── Toolbar ───────────────────────────────────────────────────────── */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-3">
          <Film className="h-5 w-5 shrink-0 text-violet-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">
              {scenes.length > 0 ? `${scenes.length} cảnh · ${doneCount}/${scenes.length} đã render` : 'Chưa có kịch bản cảnh'}
            </p>
            <p className="text-[11px] text-gray-500">Đạo diễn + soát: 0 credit.</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-[10px] font-semibold text-gray-400">Chất lượng</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-violet-200">
              {(['480p', '720p', '1080p'] as const).map((r) => (
                <button key={r} onClick={() => setHybridResolution(r)} disabled={busy}
                  title={r === '480p' ? 'Nháp rẻ' : r === '720p' ? 'Mặc định — nét + khớp lipsync' : 'Premium'}
                  className={`px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${resolution === r ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-violet-50'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <button onClick={runPlan} disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-2 text-[12px] font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-50">
            {planning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {scenes.length > 0 ? 'Đạo diễn lại' : 'Đạo diễn'}
          </button>
          {scenes.length > 0 && (
            <button onClick={makeAssets} disabled={busy}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold shadow-sm disabled:opacity-50 ${hasAssets ? 'border border-emerald-300 bg-white text-emerald-700' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'}`}>
              {assetsBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
              {hasAssets ? 'Giọng + mặt ✓' : `Tạo giọng + mặt (~${ASSETS_CR}cr)`}
            </button>
          )}
          {scenes.length > 0 && hasAssets && pendingIdx.length > 0 && (
            <button onClick={renderAll} disabled={busy}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-violet-700 hover:to-pink-700 disabled:opacity-50">
              <Sparkles className="h-3.5 w-3.5" /> Tạo tất cả (~{pendingCredit}cr)
            </button>
          )}
          {scenes.length > 0 && (
            <button onClick={() => setPhase('export')}
              title={allDone ? 'Sang Export để ghép + tải' : 'Nên render hết các cảnh trước'}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700">
              Tiếp tục → Export <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {/* ── Creator assets — listen to the voice + see the face before paying ─ */}
        {hasAssets ? (
          <AssetsBar keyframeRef={hybrid.keyframeRef} voiceRef={hybrid.voiceRef}
            voiceDurationSec={hybrid.voiceDurationSec} busy={busy} onRegen={makeAssets} />
        ) : scenes.length > 0 ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800">
            Bấm <strong>"Tạo giọng + mặt"</strong> trước — cần khuôn mặt + giọng thật để render cảnh "Nói" + nghe kiểm tra giọng.
          </div>
        ) : null}

        {/* ── Scene frames (9:16, render on frame) ──────────────────────────── */}
        {scenes.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {scenes.map((s, i) => (
              <SceneCard key={i} i={i} scene={s} clipRef={hybrid.clips[i]}
                rendering={renderingIdx.has(i)} failed={failedIdx.has(i)}
                credit={sceneCredit(s)} hasAssets={hasAssets} busy={busy}
                onRender={() => renderScene(i)} />
            ))}
          </div>
        )}

        {hybrid.stickers.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Sticker ({hybrid.stickers.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {hybrid.stickers.map((st, i) => (
                <span key={i} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  {st.items?.length ? st.items.join(' · ') : st.text}
                </span>
              ))}
            </div>
          </div>
        )}

        {scenes.length === 0 && !planning && (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-[12px] text-gray-400">
            <Sparkles className="mx-auto mb-2 h-7 w-7 text-gray-300" /> Bấm "Đạo diễn" để AI tách kịch bản thành cảnh (0 credit).
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><User className="h-3 w-3" /> Avatar: {state.inputs.avatar ? '✓' : '⚠ Bước 1'}</span>
          <span className="flex items-center gap-1"><Mic className="h-3 w-3" /> ElevenLabs: {elevenLabsKey ? '✓' : '⚠'}</span>
          <span className="flex items-center gap-1"><Film className="h-3 w-3" /> KIE: {kieApiKey ? '✓' : '⚠'}</span>
        </div>
      </div>
    </div>
  )
}

// ── Creator assets bar — face thumbnail + voice audio player ──────────────────
function AssetsBar({ keyframeRef, voiceRef, voiceDurationSec, busy, onRegen }: {
  keyframeRef?: string; voiceRef?: string; voiceDurationSec?: number; busy: boolean; onRegen: () => void
}) {
  const faceUrl = useAssetUrl(keyframeRef ?? undefined)
  const voiceUrl = useAssetUrl(voiceRef ?? undefined)
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-900">
        {faceUrl && <img src={faceUrl} alt="creator" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-emerald-800">🎙 Giọng + khuôn mặt creator {voiceDurationSec ? `· ${voiceDurationSec.toFixed(1)}s` : ''}</p>
        <p className="mb-1 text-[10px] text-emerald-700/80">Nghe thử xem ĐÚNG giọng đã chọn chưa — sai thì "Tạo lại" trước khi render.</p>
        {voiceUrl && <audio src={voiceUrl} controls className="h-8 w-full max-w-md" />}
      </div>
      <button onClick={onRegen} disabled={busy}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
        <RotateCcw className="h-3 w-3" /> Tạo lại
      </button>
    </div>
  )
}

// ── One scene = a 9:16 frame; render button ON the frame; clip plays in place ──
function SceneCard({ i, scene, clipRef, rendering, failed, credit, hasAssets, busy, onRender }: {
  i: number; scene: TimedBrollScene; clipRef?: string; rendering: boolean; failed: boolean
  credit: number; hasAssets: boolean; busy: boolean; onRender: () => void
}) {
  const url = useAssetUrl(clipRef ?? undefined)
  const badge = ROLE_BADGE[scene.role] ?? ROLE_BADGE.broll
  const done = !!url
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* 9:16 frame */}
      <div className="relative aspect-[9/16] w-full bg-gray-900">
        {done ? (
          <video src={url} controls playsInline className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {rendering ? (
              <div className="flex flex-col items-center gap-1 text-violet-300">
                <Loader2 className="h-6 w-6 animate-spin" /> <span className="text-[10px]">đang render…</span>
              </div>
            ) : (
              <button onClick={onRender} disabled={busy || !hasAssets}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-3 text-white shadow-lg hover:bg-violet-700 disabled:opacity-40">
                <Play className="h-5 w-5 fill-white" />
                <span className="text-[12px] font-bold">Render</span>
                <span className="text-[10px] text-white/80">~{credit}cr</span>
              </button>
            )}
          </div>
        )}
        {/* overlays */}
        <div className="pointer-events-none absolute left-1 top-1 flex items-center gap-1">
          <span className="rounded bg-black/60 px-1 text-[9px] font-bold text-white">#{i + 1}</span>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${badge.cls}`}>{badge.label}</span>
        </div>
        <span className="pointer-events-none absolute right-1 top-1 rounded bg-black/60 px-1 text-[9px] text-white/90">{scene.startSec.toFixed(1)}-{scene.endSec.toFixed(1)}s</span>
        {scene.cameraFraming === 'hands_noface' && <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[8px] text-white/80">no-face</span>}
        {done && <span className="absolute right-1 bottom-1 rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">✓</span>}
        {failed && <span className="absolute right-1 bottom-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">✗</span>}
      </div>
      {/* quote + concept + re-render */}
      <div className="flex flex-1 flex-col gap-1 p-2">
        <p className="text-[11px] font-semibold leading-tight text-gray-800 line-clamp-2">“{scene.quote}”</p>
        {scene.role !== 'lips' && scene.conceptPrompt && (
          <p className="line-clamp-2 text-[10px] italic leading-tight text-gray-500">{scene.conceptPrompt}</p>
        )}
        {done && !rendering && (
          <button onClick={onRender} disabled={busy}
            className="mt-auto flex items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <RotateCcw className="h-3 w-3" /> Render lại ~{credit}cr
          </button>
        )}
      </div>
    </div>
  )
}
