// ── HybridVideoPhase (P3f) — Bước "Tạo Video" ────────────────────────────────
// Visual, mode-1-style control: each scene is a 9:16 FRAME with the render button
// ON it; rendered clips play right in the frame so quality is checkable at a glance.
// Voice + face show in a panel you can LISTEN to before paying. This step ONLY
// renders the scenes — assembling the final MP4 happens on the Export step (Bước 3).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import {
  Loader2, Wand2, RotateCcw, AlertCircle, Sparkles, Mic, User, Film, Play, ChevronRight,
  Edit3, Save, X, Pause, Volume2,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import { directBrollScenes, assignSceneTiming, type TimedBrollScene } from '../services/brollDirector'
import { renderOneHybridScene, type HybridRenderContext } from '../services/hybridRenderer'
import { renderCreatorKeyframe } from '../services/creatorVideoEngine'
import { matchVoiceForAvatar } from '../services/voiceCreatorMatcher'
import { BROLL_RENDER_RES } from '../services/hybridConstants'
import { estimateInsertCredits, V3_CREDIT_COST } from '../types'

// P3s — KIE Kling AI Avatar Standard 720p is 8 cr/s (was incorrectly 14 — user
// audited against KIE pricing page). The renderer already calls
// `kling/ai-avatar-standard` (the right model id), only the UI estimate was wrong.
const LIPS_CR_PER_SEC = 8
// P3s — render 2 scenes concurrently (was: 1 at a time). KIE jobs are independent;
// a fail on one doesn't cascade. 2 is the safe Mode-1 cadence the user wants back.
const MAX_CONCURRENT_RENDERS = 2
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
  const setSceneConceptPrompt = useAdsVideoStore((s) => s.setSceneConceptPrompt)
  const setHybridAssets= useAdsVideoStore((s) => s.setHybridCreatorAssets)
  const setAssetsGenStartedAt = useAdsVideoStore((s) => s.setAssetsGenStartedAt)
  const setPhase       = useAdsVideoStore((s) => s.setPhase)
  const addToast       = useAppStore((s) => s.addToast)
  const geminiKey      = useSettingsStore((s) => s.geminiApiKey)
  const kieApiKey      = useSettingsStore((s) => s.kieApiKey)
  const elevenLabsKey  = useSettingsStore((s) => s.elevenLabsApiKey)

  const hybrid = state.hybrid
  const script = state.scriptBrain.script
  const scenes = hybrid.scenes ?? []
  // Resolution is HARD-CODED per the hybrid contract: brolls render at 480p (cheap),
  // the final assembles at 720p — the user does not choose. See hybridConstants.ts.
  const resolution = BROLL_RENDER_RES
  const hasAssets = !!(hybrid.keyframeRef && hybrid.voiceRef)
  // P3x-G — resolve the MASTER TTS blob URL ONCE here (not per-card) so each
  // scene card can play its own [startSec, endSec] slice of the voice — the
  // "nghe thoại từng cảnh" the user had in Model 1. Hybrid has one master voice,
  // so we seek into it rather than a per-scene audio file.
  const masterVoiceUrl = useAssetUrl(hybrid.voiceRef ?? undefined)

  const [planning, setPlanning] = useState(false)
  const [assetsBusy, setAssetsBusy] = useState(false)
  const [renderingIdx, setRenderingIdx] = useState<Set<number>>(new Set())
  // P3s — scenes the user clicked while ≥2 were already rendering. They wait
  // their turn (FIFO) and auto-launch as a slot frees up.
  const [queuedIdx, setQueuedIdx] = useState<number[]>([])
  const [failedIdx, setFailedIdx] = useState<Set<number>>(new Set())
  // P3s — running tally of credits KIE consumed on scenes that then failed.
  // Shown as a warning banner so the user knows how much they've lost to the
  // pre-flight bugs (B/D) before the retry succeeds. NOT refundable — KIE keeps
  // charged credits on failure — so this is a visibility tool, not a recovery.
  const [lostCredits, setLostCredits] = useState(0)
  // P3t — per-scene KIE poll progress (poll count + elapsed seconds) so the
  // card shows "đang render… poll #5 · 28s" instead of a blind spinner.
  const [progressByIdx, setProgressByIdx] = useState<Record<number, { pollCount: number; elapsedSec: number }>>({})
  const [error, setError] = useState('')

  const sceneCredit = (s: TimedBrollScene): number => {
    const dur = Math.max(1, s.endSec - s.startSec)
    return s.role === 'lips' ? Math.round(dur * LIPS_CR_PER_SEC) : estimateInsertCredits('video', resolution, dur)
  }
  const doneCount = scenes.filter((_, i) => hybrid.clips[i]).length
  const pendingIdx = scenes.map((_, i) => i).filter((i) => !hybrid.clips[i])
  const pendingCredit = pendingIdx.reduce((sum, i) => sum + sceneCredit(scenes[i]), 0)
  const allDone = scenes.length > 0 && doneCount === scenes.length
  // P3x — creator-assets generation may still be running in the background after
  // the user navigated away + back (the promise survives unmount). The persisted
  // timestamp tells us so we keep the lock + "đang tạo" state instead of showing
  // an idle button the user would re-click (double-charging TTS + keyframe). A
  // value older than 4 minutes is stale (tab closed mid-gen) → ignore it.
  const ASSETS_STALE_MS = 4 * 60 * 1000
  const assetsGenRunning = !!hybrid.assetsGenStartedAt &&
    (Date.now() - hybrid.assetsGenStartedAt < ASSETS_STALE_MS)
  // P3s — `busy` now ONLY locks the toolbar actions (plan / makeAssets / renderAll).
  // The per-card Render button no longer respects `busy` — it queues instead
  // (see renderScene). The user can fire up to N concurrent renders themselves.
  const busy = planning || assetsBusy || assetsGenRunning
  const renderingNow = renderingIdx.size + queuedIdx.length > 0

  const runPlan = async () => {
    if (!script) { addToast('Chưa có kịch bản (Bước 1)', 'error'); return }
    if (!geminiKey) { addToast('Thiếu Gemini key', 'error'); return }
    setPlanning(true); setError('')
    try {
      const voiceDur = hybrid.voiceDurationSec ?? script.totalDurationSec ?? 50
      const res = await directBrollScenes({
        geminiKey, script, lang: state.scriptBrain.outputLang, product: state.inputs.product, voiceDurationSec: voiceDur,
        shape: state.scriptBrain.shape,
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
    // P3x — guard against double-charge: if a generation is already in flight
    // (even from a previous mount before the user navigated away), don't start
    // another. The persisted timestamp survives unmount.
    if (assetsGenRunning) { addToast('Đang tạo giọng + mặt rồi — đợi xong nhé', 'info'); return }
    setAssetsBusy(true); setError('')
    setAssetsGenStartedAt(Date.now())   // persist "đang tạo" across nav
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
    } finally {
      setAssetsBusy(false)
      setAssetsGenStartedAt(undefined)   // clear persisted lock (also runs if unmounted)
    }
  }

  const ctx = (): HybridRenderContext => ({
    kieApiKey, keyframeRef: hybrid.keyframeRef, voiceRef: hybrid.voiceRef,
    product: state.inputs.product, avatar: state.inputs.avatar, creatorVideoConfig: state.creatorVideoConfig, resolution,
  })

  // P3s — directly render a scene WITHOUT queue logic. Used internally by the
  // queue worker. Tracks lostCredits on failure so the user can see how much
  // KIE took on the failed attempt (it doesn't refund).
  const runRender = async (i: number) => {
    const s = (useAdsVideoStore.getState().state.hybrid.scenes ?? [])[i]
    if (!s) return
    setRenderingIdx((set) => new Set(set).add(i))
    setFailedIdx((set) => { const n = new Set(set); n.delete(i); return n })
    setProgressByIdx((p) => ({ ...p, [i]: { pollCount: 0, elapsedSec: 0 } }))
    try {
      const videoRef = await renderOneHybridScene(
        s,
        ctx(),
        undefined,
        // P3t — KIE poll progress → UI shows "poll #N · Ms" per card.
        (info) => setProgressByIdx((p) => ({ ...p, [i]: info })),
      )
      setHybridClip(i, videoRef)
    } catch (e) {
      console.error(`[HYBRID_UI] cảnh ${i} lỗi:`, e)
      setFailedIdx((set) => new Set(set).add(i))
      // KIE keeps credits on failure → tally the loss for the visibility banner.
      setLostCredits((c) => c + sceneCredit(s))
      addToast(`Cảnh #${i + 1} lỗi: ${(e instanceof Error ? e.message : String(e)).slice(0, 100)}`, 'error')
    } finally {
      setRenderingIdx((set) => { const n = new Set(set); n.delete(i); return n })
      setProgressByIdx((p) => { const n = { ...p }; delete n[i]; return n })
      // Pull the next queued scene (if any) right after a slot frees up.
      setQueuedIdx((q) => {
        if (q.length === 0) return q
        const [nextI, ...rest] = q
        // Defer the launch so React commits the state update first.
        setTimeout(() => { void runRender(nextI) }, 0)
        return rest
      })
    }
  }

  // P3s — user-facing render call. Enqueues if ≥MAX_CONCURRENT_RENDERS are in
  // flight (UI just shows "đang chờ" on that card); fires immediately otherwise.
  const renderScene = (i: number) => {
    if (!hasAssets) { addToast('Bấm "Tạo giọng + mặt" trước', 'error'); return }
    if (!kieApiKey) { addToast('Thiếu KIE key', 'error'); return }
    // If a slot is free, launch directly.
    if (renderingIdx.size < MAX_CONCURRENT_RENDERS) {
      void runRender(i)
      return
    }
    // Otherwise queue (dedupe: don't enqueue twice if user spam-clicks).
    setQueuedIdx((q) => (q.includes(i) ? q : [...q, i]))
  }

  const renderAll = () => {
    if (!hasAssets) { addToast('Bấm "Tạo giọng + mặt" trước', 'error'); return }
    if (!kieApiKey) { addToast('Thiếu KIE key', 'error'); return }
    const pending = scenes.map((_, i) => i).filter((i) => !hybrid.clips[i] && !renderingIdx.has(i) && !queuedIdx.includes(i))
    if (pending.length === 0) { addToast('Không còn cảnh chờ render', 'info'); return }
    addToast(`🎬 Render ${pending.length} cảnh (${MAX_CONCURRENT_RENDERS} song song)…`, 'info')
    // Fill the slots; queue the rest. The runRender finalizer drains the queue.
    const slots = Math.max(0, MAX_CONCURRENT_RENDERS - renderingIdx.size)
    const immediate = pending.slice(0, slots)
    const queued = pending.slice(slots)
    if (queued.length) setQueuedIdx((q) => [...q, ...queued])
    immediate.forEach((i) => { void runRender(i) })
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
            <p className="text-[11px] text-gray-500">Đạo diễn + soát: 0 credit. Render 480p · Video cuối 720p.</p>
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
            <button onClick={renderAll} disabled={busy || renderingNow}
              title={renderingNow ? 'Đang có cảnh đang render — đợi xong rồi bấm' : ''}
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

        {/* P3s — credit lost on failed renders (KIE doesn't refund). Visibility, not recovery. */}
        {lostCredits > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Đã mất <strong>~{lostCredits}cr</strong> do {failedIdx.size} cảnh fail (KIE không hoàn credit). Bấm "Render lại" ở cảnh ✗ để thử lại.
              <button onClick={() => setLostCredits(0)} className="ml-2 underline">[Xoá]</button>
            </span>
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
                rendering={renderingIdx.has(i)} queued={queuedIdx.includes(i)} failed={failedIdx.has(i)}
                progress={progressByIdx[i]} voiceUrl={masterVoiceUrl}
                credit={sceneCredit(s)} hasAssets={hasAssets}
                onRender={() => renderScene(i)}
                onSavePrompt={(prompt) => setSceneConceptPrompt(i, prompt)} />
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
function SceneCard({ i, scene, clipRef, rendering, queued, failed, progress, voiceUrl, credit, hasAssets, onRender, onSavePrompt }: {
  i: number; scene: TimedBrollScene; clipRef?: string; rendering: boolean; queued: boolean; failed: boolean
  progress?: { pollCount: number; elapsedSec: number }
  voiceUrl?: string
  credit: number; hasAssets: boolean; onRender: () => void
  onSavePrompt: (prompt: string) => void
}) {
  const url = useAssetUrl(clipRef ?? undefined)
  const badge = ROLE_BADGE[scene.role] ?? ROLE_BADGE.broll
  const done = !!url
  // P3x-G — play THIS scene's slice of the master TTS [startSec, endSec] so the
  // user can check the voice line per card (Model 1 had this). One shared master
  // voice URL is passed in; we seek into it and stop at endSec.
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null)
  const [voicePlaying, setVoicePlaying] = useState(false)
  const playVoiceLine = () => {
    const a = voiceAudioRef.current
    if (!a || !voiceUrl) return
    if (!a.paused) { a.pause(); return }
    try { a.currentTime = scene.startSec } catch { /* not yet seekable — will start at 0 */ }
    void a.play()
  }
  // P3t-F — inline prompt editor for broll/mechanism3d. Lips has no
  // conceptPrompt (lipsync uses keyframe + voice), so the editor is hidden for
  // lips scenes. Dirty state tracks unsaved edits so the Save button enables only
  // when there's an actual change.
  const canEditPrompt = scene.role !== 'lips'
  const [editing, setEditing] = useState(false)
  const [draftPrompt, setDraftPrompt] = useState(scene.conceptPrompt ?? '')
  useEffect(() => { setDraftPrompt(scene.conceptPrompt ?? '') }, [scene.conceptPrompt])
  const promptDirty = draftPrompt.trim() !== (scene.conceptPrompt ?? '').trim()
  // P3t-D — custom video player without native audio controls. Click toggles play.
  // muted=true so the lipsync clip's embedded audio doesn't compete with the
  // master TTS that the assembler muxes in later.
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { void v.play() } else { v.pause() }
  }
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* 9:16 frame */}
      <div className="relative aspect-[9/16] w-full bg-gray-900">
        {done ? (
          <>
            <video ref={videoRef} src={url} muted playsInline
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
              onClick={togglePlay}
              className="h-full w-full cursor-pointer object-contain" />
            {!playing && (
              <button onClick={togglePlay}
                className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="rounded-full bg-black/60 p-3 text-white"><Play className="h-5 w-5 fill-white" /></span>
              </button>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {rendering ? (
              <div className="flex flex-col items-center gap-1 text-violet-300">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-[10px]">đang render…</span>
                {progress && (
                  <span className="text-[9px] text-violet-200/80">
                    poll #{progress.pollCount} · {progress.elapsedSec}s
                  </span>
                )}
              </div>
            ) : queued ? (
              <div className="flex flex-col items-center gap-1 text-amber-300">
                <Loader2 className="h-6 w-6 animate-pulse" /> <span className="text-[10px]">đang chờ…</span>
              </div>
            ) : (
              <button onClick={onRender} disabled={!hasAssets}
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
        <div className="flex items-start gap-1">
          <p className="flex-1 text-[11px] font-semibold leading-tight text-gray-800 line-clamp-2">“{scene.quote}”</p>
          {/* P3x-G — nghe thoại của riêng cảnh này (slice master TTS) */}
          {voiceUrl && (
            <button onClick={playVoiceLine} title="Nghe đoạn thoại của cảnh này"
              className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-violet-600">
              {voicePlaying ? <Pause className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        {voiceUrl && (
          <audio
            ref={voiceAudioRef}
            src={voiceUrl}
            onPlay={() => setVoicePlaying(true)}
            onPause={() => setVoicePlaying(false)}
            onTimeUpdate={(e) => {
              // Stop exactly at this scene's end so we only hear ITS line.
              if (e.currentTarget.currentTime >= scene.endSec) {
                e.currentTarget.pause()
                setVoicePlaying(false)
              }
            }}
            className="hidden"
          />
        )}

        {/* P3t-F — inline prompt panel (broll/mechanism3d only) */}
        {canEditPrompt && !editing && (
          <div className="flex items-start gap-1">
            <p className="line-clamp-2 flex-1 text-[10px] italic leading-tight text-gray-500">
              {scene.conceptPrompt || <span className="not-italic text-gray-400">(không có prompt — đang dùng product close-up mặc định)</span>}
            </p>
            <button onClick={() => setEditing(true)} title="Sửa prompt"
              className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-violet-600">
              <Edit3 className="h-3 w-3" />
            </button>
          </div>
        )}
        {canEditPrompt && editing && (
          <div className="flex flex-col gap-1 rounded-md border border-violet-200 bg-violet-50 p-1.5">
            <textarea value={draftPrompt} onChange={(e) => setDraftPrompt(e.target.value)}
              rows={4} placeholder="Mô tả CỤ THỂ visual: action + sản phẩm + setting. Tránh từ trừu tượng."
              className="w-full resize-none rounded border border-violet-200 bg-white p-1.5 text-[10px] leading-tight text-gray-700 focus:border-violet-400 focus:outline-none" />
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] text-violet-600/80">Lưu rồi bấm "Render lại" để dùng prompt mới</span>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(false); setDraftPrompt(scene.conceptPrompt ?? '') }}
                  className="flex items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-gray-600 hover:bg-gray-50">
                  <X className="h-2.5 w-2.5" /> Huỷ
                </button>
                <button onClick={() => { onSavePrompt(draftPrompt.trim()); setEditing(false) }}
                  disabled={!promptDirty}
                  className="flex items-center gap-0.5 rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-violet-700 disabled:opacity-40">
                  <Save className="h-2.5 w-2.5" /> Lưu
                </button>
              </div>
            </div>
          </div>
        )}

        {done && !rendering && !queued && (
          <button onClick={onRender}
            className="mt-auto flex items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-50">
            <RotateCcw className="h-3 w-3" /> Render lại ~{credit}cr
          </button>
        )}
      </div>
    </div>
  )
}
