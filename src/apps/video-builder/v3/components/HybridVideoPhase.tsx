// ── HybridVideoPhase (P3e) — Bước "Tạo Video" ────────────────────────────────
// The hybrid hub. Per-card render control (like mode-1) so the user can render +
// quality-check each scene individually, with the EXACT credit shown before paying.
//
//   1. [Đạo diễn]            director plan → store.hybrid (0 credit, review free).
//   2. [Tạo giọng + mặt]     renderCreatorKeyframe (voice + face, one call) → assets;
//                            then RE-TIME the plan to the real voice (lips slice
//                            from the exact spoken span). Required before rendering.
//   3. per-card [Render ~Xcr] each scene individually (re-render a bad one) + a
//      [Tạo tất cả ~Σcr] bulk (concurrency 2, skips done) — clips cached in store.
//   4. [Tạo video →]         assemble (only when ALL scenes rendered) → go to Export.
//
// All rendered work lives in the store (survives F5 / step-nav). Assemble + the
// player live on the Export step (HybridExportPhase).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  Loader2, Wand2, Clapperboard, RotateCcw, AlertCircle, Sparkles, Mic, User, Film, Play,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import {
  directBrollScenes, assignSceneTiming, type TimedBrollScene, type BrollSticker,
} from '../services/brollDirector'
import { renderOneHybridScene, type HybridRenderContext } from '../services/hybridRenderer'
import { assembleHybridVideo, type HybridSceneClip, type HybridStickerPlacement } from '../services/hybridAssembler'
import { renderCreatorKeyframe } from '../services/creatorVideoEngine'
import { renderStickerBlob, type StickerStyle } from '../services/stickerRenderer'
import { computeWordTimestampFromAlignment, computeQuoteTimestamp } from '../services/insertTimingEngine'
import { saveAsset } from '../../../../utils/assetStore'
import { matchVoiceForAvatar } from '../services/voiceCreatorMatcher'
import { estimateInsertCredits, V3_CREDIT_COST, type VoiceAlignment } from '../types'

// Kling Avatar Std ≈ 70cr per ~5s clip (V3_CREDIT_COST.lipsync) → ~14cr/s. Slightly
// conservative so the user is never surprised by MORE than the quote.
const LIPS_CR_PER_SEC = 14
const ASSETS_CR = V3_CREDIT_COST.tts + V3_CREDIT_COST.keyframe   // voice + keyframe

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  lips:        { label: '🗣 Nói',  cls: 'bg-violet-100 text-violet-700' },
  broll:       { label: '🎬 Cảnh', cls: 'bg-sky-100 text-sky-700' },
  mechanism3d: { label: '🧬 3D',   cls: 'bg-amber-100 text-amber-700' },
}

interface Props { onContinue?: () => void }

export default function HybridVideoPhase(_props: Props) {
  const state          = useAdsVideoStore((s) => s.state)
  const setHybridPlan  = useAdsVideoStore((s) => s.setHybridPlan)
  const setHybridClip  = useAdsVideoStore((s) => s.setHybridClip)
  const setHybridAssets= useAdsVideoStore((s) => s.setHybridCreatorAssets)
  const setHybridFinal = useAdsVideoStore((s) => s.setHybridFinal)
  const setPhase       = useAdsVideoStore((s) => s.setPhase)
  const addToast       = useAppStore((s) => s.addToast)
  const geminiKey      = useSettingsStore((s) => s.geminiApiKey)
  const kieApiKey      = useSettingsStore((s) => s.kieApiKey)
  const elevenLabsKey  = useSettingsStore((s) => s.elevenLabsApiKey)

  const hybrid = state.hybrid
  const script = state.scriptBrain.script
  const scenes = hybrid.scenes ?? []
  const resolution = state.costMode === 'FULL' ? '1080p' : state.costMode === 'STANDARD' ? '720p' : '480p'
  const hasAssets = !!(hybrid.keyframeRef && hybrid.voiceRef)

  const [planning, setPlanning] = useState(false)
  const [assetsBusy, setAssetsBusy] = useState(false)
  const [assembling, setAssembling] = useState(false)
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
  const busy = planning || assetsBusy || assembling || renderingIdx.size > 0

  // ── 1. Director plan (0 credit) ─────────────────────────────────────────────
  const runPlan = async () => {
    if (!script) { addToast('Chưa có kịch bản (Bước 1)', 'error'); return }
    if (!geminiKey) { addToast('Thiếu Gemini key', 'error'); return }
    setPlanning(true); setError('')
    try {
      const voiceDur = hybrid.voiceDurationSec ?? script.totalDurationSec ?? 50
      const res = await directBrollScenes({
        geminiKey, script, lang: state.scriptBrain.outputLang,
        product: state.inputs.product, voiceDurationSec: voiceDur,
      })
      const timed = assignSceneTiming(res.scenes, hybrid.voiceAlignment, script, voiceDur)
      setHybridPlan(timed, res.stickers, res.scenes)
      setFailedIdx(new Set())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg); addToast(`Đạo diễn lỗi: ${msg.slice(0, 120)}`, 'error')
    } finally { setPlanning(false) }
  }

  // ── 2. Voice + keyframe, then RE-TIME the plan to the real voice ────────────
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
        script, voiceCategory, voiceId: state.scriptBrain.voice?.voiceId ?? null,
        avatar, product: state.inputs.product,
        onStageUpdate: () => {},
      })
      setHybridAssets({ keyframeRef: kf.keyframeRef, voiceRef: kf.voiceRef, voiceDurationSec: kf.voiceDurationSec, voiceAlignment: kf.voiceAlignment })
      // Re-time the SAME director scenes to the real voice (lips slice exactly).
      const timed = assignSceneTiming(raw, kf.voiceAlignment, script, kf.voiceDurationSec)
      setHybridPlan(timed, useAdsVideoStore.getState().state.hybrid.stickers, raw)
      addToast(`✓ Đã tạo giọng (${kf.voiceDurationSec.toFixed(1)}s) + khuôn mặt — giờ render từng cảnh`, 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg); addToast(`Tạo giọng/mặt lỗi: ${msg.slice(0, 120)}`, 'error')
    } finally { setAssetsBusy(false) }
  }

  const ctx = (): HybridRenderContext => ({
    kieApiKey, keyframeRef: hybrid.keyframeRef, voiceRef: hybrid.voiceRef,
    product: state.inputs.product, avatar: state.inputs.avatar,
    creatorVideoConfig: state.creatorVideoConfig, resolution,
  })

  // ── 3. Render ONE scene (individual quality control) ────────────────────────
  const renderScene = async (i: number) => {
    if (!hasAssets) { addToast('Bấm "Tạo giọng + mặt" trước khi render cảnh', 'error'); return }
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

  // ── Bulk render (concurrency 2, skips already-rendered) ─────────────────────
  const renderAll = async () => {
    if (!hasAssets) { addToast('Bấm "Tạo giọng + mặt" trước', 'error'); return }
    const queue = scenes.map((_, i) => i).filter((i) => !hybrid.clips[i])
    if (queue.length === 0) { addToast('Tất cả cảnh đã render', 'info'); return }
    addToast(`🎬 Render ${queue.length} cảnh (×2 song song)…`, 'info')
    const worker = async () => { while (queue.length) { const i = queue.shift(); if (i === undefined) break; await renderScene(i) } }
    await Promise.all([worker(), worker()])
  }

  // ── 4. Assemble → Export step ───────────────────────────────────────────────
  const assemble = async () => {
    const h = useAdsVideoStore.getState().state.hybrid
    if (!h.voiceRef || !script) return
    const sc = h.scenes ?? []
    if (sc.some((_, i) => !h.clips[i])) { addToast('Còn cảnh chưa render — render hết đã', 'error'); return }
    setAssembling(true); setError('')
    try {
      const clips: HybridSceneClip[] = sc.map((scene, i) => ({ scene, videoRef: h.clips[i] }))
      const placements = await buildStickerPlacements(h.stickers, h.voiceAlignment, h.voiceDurationSec ?? script.totalDurationSec)
      const r = await assembleHybridVideo({
        clips, voiceRef: h.voiceRef, voiceDurationSec: h.voiceDurationSec ?? script.totalDurationSec,
        resolution, stickers: placements,
      })
      setHybridFinal(r.videoRef)
      addToast('✓ Đã ghép video — sang bước Export để xem + tải', 'success')
      setPhase('export')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg); addToast(`Ghép video lỗi: ${msg.slice(0, 120)}`, 'error')
    } finally { setAssembling(false) }
  }

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
        out.push({ pngRef: await saveAsset(blob, 'image/png'), atSec: at, durationSec: 2.7, heightFraction: 0.1 })
      } catch { /* skip */ }
    }
    return out
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!script) {
    return <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-500">Chưa có kịch bản — quay lại Bước 1.</div>
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Tạo Video — Hybrid</h2>
          <p className="text-[12px] text-gray-500">
            AI đạo diễn cả video thành chuỗi cảnh phủ kín giọng đọc. Render <strong>từng cảnh</strong> để
            kiểm soát chất lượng (xem credit trước khi tạo), rồi <strong>Tạo video</strong> để ghép.
          </p>
        </div>

        {/* ── Toolbar ───────────────────────────────────────────────────────── */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-3">
          <Film className="h-5 w-5 shrink-0 text-violet-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">
              {scenes.length > 0 ? `${scenes.length} cảnh · ${doneCount}/${scenes.length} đã render · ${resolution}` : 'Chưa có kịch bản cảnh'}
            </p>
            <p className="text-[11px] text-gray-500">Đạo diễn + soát: 0 credit. Render mỗi cảnh hiện credit riêng.</p>
          </div>
          <button onClick={runPlan} disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-2 text-[12px] font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-50">
            {planning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {scenes.length > 0 ? 'Đạo diễn lại' : 'Đạo diễn'}
          </button>
          {scenes.length > 0 && (
            <button onClick={makeAssets} disabled={busy}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold shadow-sm disabled:opacity-50 ${
                hasAssets ? 'border border-emerald-300 bg-white text-emerald-700' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'}`}>
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
            <button onClick={assemble} disabled={busy || !allDone}
              title={allDone ? 'Ghép + sang Export' : 'Render hết các cảnh trước'}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50">
              {assembling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="h-3.5 w-3.5" />}
              Tạo video →
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
          </div>
        )}
        {scenes.length > 0 && !hasAssets && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800">
            Bấm <strong>"Tạo giọng + mặt"</strong> trước — cần khuôn mặt + giọng thật để render cảnh "Nói" và canh đúng giây.
          </div>
        )}

        {/* ── Scene cards (per-card render) ─────────────────────────────────── */}
        {scenes.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {scenes.map((s, i) => {
              const badge = ROLE_BADGE[s.role] ?? ROLE_BADGE.broll
              const done = !!hybrid.clips[i]
              const rendering = renderingIdx.has(i)
              const failed = failedIdx.has(i)
              return (
                <div key={i} className={`flex flex-col rounded-lg border p-2.5 ${
                  done ? 'border-emerald-300 bg-emerald-50/40' : rendering ? 'border-violet-300 bg-violet-50/40'
                    : failed ? 'border-rose-300 bg-rose-50/40' : 'border-gray-200 bg-white'}`}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-gray-400">#{i + 1}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${badge.cls}`}>{badge.label}</span>
                    <span className="text-[9px] text-gray-400">{s.startSec.toFixed(1)}-{s.endSec.toFixed(1)}s</span>
                    {s.cameraFraming === 'hands_noface' && <span className="rounded bg-gray-100 px-1 text-[8px] text-gray-500">no-face</span>}
                  </div>
                  <p className="text-[11px] font-semibold leading-tight text-gray-800">“{s.quote}”</p>
                  {s.role !== 'lips' && s.conceptPrompt && (
                    <p className="mt-1 line-clamp-2 text-[10px] italic leading-tight text-gray-500">{s.conceptPrompt}</p>
                  )}
                  {/* per-card render control + EXACT credit */}
                  <div className="mt-2 flex items-center gap-1.5 border-t border-black/5 pt-1.5">
                    {rendering ? (
                      <span className="flex flex-1 items-center justify-center gap-1 text-[10px] font-semibold text-violet-600"><Loader2 className="h-3 w-3 animate-spin" /> đang render…</span>
                    ) : (
                      <button onClick={() => renderScene(i)} disabled={busy || !hasAssets}
                        className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold disabled:opacity-50 ${
                          done ? 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50' : 'bg-violet-600 text-white hover:bg-violet-700'}`}>
                        {done ? <><RotateCcw className="h-3 w-3" /> Render lại</> : <><Play className="h-3 w-3 fill-white" /> Render</>}
                        <span className={done ? 'text-gray-400' : 'text-white/80'}>~{sceneCredit(s)}cr</span>
                      </button>
                    )}
                    {done && <span className="text-[11px] text-emerald-600">✓</span>}
                    {failed && <span className="text-[10px] font-bold text-rose-600">✗ lỗi</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Sticker chips ─────────────────────────────────────────────────── */}
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
