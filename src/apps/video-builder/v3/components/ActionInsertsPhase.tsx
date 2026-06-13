// ── ActionInsertsPhase ───────────────────────────────────────────────────────
// Z33 Phase 4 UI — pick + render action inserts.
//
// Layout (top-to-bottom):
//   1. Smart Suggestions banner — Gemini-free, keyword-based. Scans the
//      Phase 2 script for trigger keywords and recommends preset inserts.
//      One click "Apply N suggestions" bulk-adds them to the inserts list.
//   2. Insert budget chip — cost mode dictates max (TEST=3 / STD=5 / FULL=8).
//   3. 12-preset library — clickable cards. Click = add one insert.
//   4. Per-insert cards — render individually (preview-first). Approve /
//      reject / lock / skip / rerender per Z26 lessons.
//   5. Bulk render banner — renders all idle/failed inserts that haven't
//      been locked or approved.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react'
import {
  Loader2, Sparkles, AlertCircle, ChevronRight, Play, Pause, RotateCcw,
  Lock, X, Plus, Trash2, Lightbulb, Zap, Wand2, Mic,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import {
  COST_MODE_CONFIG, INSERT_STAGE_LABEL_VI,
  estimateInsertCredits, formatCredits,
  type ActionPresetId, type ActionInsertClip, type InsertRenderStage,
  type InsertRenderMode, type V3ClipStatus, type GeneratedScript,
  type VoiceFirstSlot,
} from '../types'
import { ACTION_PRESETS } from '../services/actionPresets'
import {
  pickTopInsertsForBudget, directScenesWithGemini,
  type InsertSuggestion,
} from '../services/insertSuggester'
import { renderInsert, resumeInsertVideo, listEligibleInsertsForBulk } from '../services/insertRenderer'
import { directBrollScenes, assignSceneTiming, type TimedBrollScene, type BrollSticker } from '../services/brollDirector'
import { assembleHybridVideo, type HybridSceneClip, type HybridStickerPlacement } from '../services/hybridAssembler'
import { getProductVisualBrief, type ProductVisualBrief } from '../../../../services/productVisualBrief'
import { hasFourProductImages } from '../../../../stores/types'
import { computeBlockStartTimestamps, computeQuoteTimestamp, computeWordTimestampFromAlignment } from '../services/insertTimingEngine'
// Z98 #5 — local sticker renderer (canvas → transparent PNG, 0 credit).
import { renderStickerBlob, STICKER_STYLE_META, type StickerStyle } from '../services/stickerRenderer'
import { saveAsset, getUrl } from '../../../../utils/assetStore'
// Z98 B2 — voice-first: synth the real voice + recalibrate the script BEFORE the
// director runs, so scene count/placement use the real duration not a WPM guess.
import { generateCreatorVoice, renderLipsyncSegment } from '../services/creatorVideoEngine'
import { recalibrateScriptToRealVoice, scriptVoiceSig } from '../services/voiceTimingEstimator'
import { matchVoiceForAvatar } from '../services/voiceCreatorMatcher'

// Wrap Date.now in a non-render-pure call site so react-hooks/purity lint
// doesn't false-positive on usage inside async event handlers below.
const now = () => Date.now()

const TONE_BG: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  violet:  'bg-violet-100 text-violet-800 border-violet-300',
  amber:   'bg-amber-100 text-amber-800 border-amber-300',
  pink:    'bg-pink-100 text-pink-800 border-pink-300',
  sky:     'bg-sky-100 text-sky-800 border-sky-300',
  rose:    'bg-rose-100 text-rose-800 border-rose-300',
}

const STATUS_DOT: Record<V3ClipStatus, string> = {
  idle:      'bg-slate-300',
  rendering: 'bg-violet-500 animate-pulse',
  completed: 'bg-emerald-500',
  approved:  'bg-green-600',
  rejected:  'bg-rose-500',
  locked:    'bg-blue-600',
  failed:    'bg-red-500',
}

const STAGE_BAR_COLOR: Record<InsertRenderStage, string> = {
  idle:           'bg-slate-200',
  keyframe:       'bg-violet-400 animate-pulse',
  preview_motion: 'bg-amber-400 animate-pulse',
  video_full:     'bg-pink-500 animate-pulse',
  completed:      'bg-emerald-500',
  failed:         'bg-red-500',
}

interface Props {
  onContinue: () => void
}

// Z98 — voice-first player. The REAL voice is synthesized at Step 2 BEFORE the
// director runs; surface it here so the user can LISTEN to it (it's the exact
// voice the director timed the B-roll to, and the one reused for lipsync).
//
// Insert cards dispatch `ads-video:seek-voice` (detail.sec) to ask this player
// to jump to the second a given quoted line is spoken. Event-bus over prop
// drilling: there's only ever ONE voice player on the page.
const SEEK_VOICE_EVENT = 'ads-video:seek-voice'
function VoiceFirstBar({ voice }: { voice: VoiceFirstSlot }) {
  const url = useAssetUrl(voice.voiceRef)
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const onSeek = (e: Event) => {
      const el = audioRef.current
      if (!el) return
      const sec = (e as CustomEvent<{ sec: number }>).detail?.sec
      if (!Number.isFinite(sec)) return
      el.currentTime = Math.max(0, sec - 0.1)  // tiny pre-roll for context
      el.play().catch(() => { /* user-gesture race — ignore */ })
    }
    window.addEventListener(SEEK_VOICE_EVENT, onSeek)
    return () => window.removeEventListener(SEEK_VOICE_EVENT, onSeek)
  }, [])
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 px-3 py-2.5">
      <div className="flex shrink-0 items-center gap-1.5 text-[12px] font-bold text-violet-900">
        <Mic className="h-4 w-4 text-violet-600" />
        Giọng đọc thật · {voice.voiceDurationSec.toFixed(1)}s
      </div>
      {url ? (
        <audio ref={audioRef} controls src={url} preload="metadata" className="h-8 min-w-[220px] flex-1" />
      ) : (
        <span className="flex items-center gap-1 text-[11px] text-violet-500">
          <Loader2 className="h-3 w-3 animate-spin" /> Đang tải giọng…
        </span>
      )}
      <span className="shrink-0 text-[10px] text-violet-500">
        Bấm câu thoại dưới mỗi cảnh để nghe phần voice tương ứng — nếu không khớp ý, "Lại" trước khi render
      </span>
    </div>
  )
}

function seekVoiceTo(sec: number) {
  window.dispatchEvent(new CustomEvent(SEEK_VOICE_EVENT, { detail: { sec } }))
}

export default function ActionInsertsPhase({ onContinue }: Props) {
  const state = useAdsVideoStore((s) => s.state)
  const bulkAddInsertsFromPresets = useAdsVideoStore((s) => s.bulkAddInsertsFromPresets)
  const patchInsert      = useAdsVideoStore((s) => s.patchInsert)
  const removeInsert     = useAdsVideoStore((s) => s.removeInsert)
  const clearAllInserts  = useAdsVideoStore((s) => s.clearAllInserts)
  const setVoiceFirst    = useAdsVideoStore((s) => s.setVoiceFirst)
  const setGeneratedScript = useAdsVideoStore((s) => s.setGeneratedScript)

  const kieApiKey     = useSettingsStore((s) => s.kieApiKey)
  const geminiKey     = useSettingsStore((s) => s.geminiApiKey)
  const elevenLabsKey = useSettingsStore((s) => s.elevenLabsApiKey)
  const addToast      = useAppStore((s) => s.addToast)

  // P1 dev helper — test the new HYBRID director (plan only, no render, no credit).
  // From the console: __testBrollDirector() → logs the full-coverage shot list.
  useEffect(() => {
    const w = window as unknown as { __testBrollDirector?: () => Promise<unknown> }
    w.__testBrollDirector = async () => {
      const st = useAdsVideoStore.getState().state
      const script = st.scriptBrain.script
      if (!geminiKey) { console.warn('[BROLL_DIRECTOR] thiếu Gemini key'); return }
      if (!script) { console.warn('[BROLL_DIRECTOR] chưa có kịch bản (Bước 1)'); return }
      const voiceDurationSec =
        st.voiceFirst?.voiceDurationSec ?? st.creatorVideo?.voiceDurationSec ?? script.totalDurationSec ?? 50
      console.log(`[BROLL_DIRECTOR] đang plan (dur=${voiceDurationSec.toFixed(0)}s)...`)
      try {
        const res = await directBrollScenes({
          geminiKey, script, lang: st.scriptBrain.outputLang, product: st.inputs.product, voiceDurationSec,
        })
        console.log('[BROLL_DIRECTOR] SCENES:', res.scenes)
        console.log('[BROLL_DIRECTOR] STICKERS:', res.stickers)
        // P3a — derive the real timeline from the voice and verify coverage.
        const alignment = st.voiceFirst?.voiceAlignment ?? st.creatorVideo?.voiceAlignment
        const timed = assignSceneTiming(res.scenes, alignment, script, voiceDurationSec)
        let gaps = 0, overlaps = 0, shorts = 0
        for (let i = 0; i < timed.length; i++) {
          const len = timed[i].endSec - timed[i].startSec
          if (len < 1.2) shorts++
          if (i > 0) {
            const d = timed[i].startSec - timed[i - 1].endSec
            if (d > 0.05) gaps++
            if (d < -0.05) overlaps++
          }
        }
        console.log(
          `[BROLL_TIMING] align=${alignment ? 'REAL' : 'estimate'} voiceDur=${voiceDurationSec.toFixed(1)}s ` +
          `lastEnd=${timed[timed.length - 1]?.endSec.toFixed(1)}s gaps=${gaps} overlaps=${overlaps} short(<1.2s)=${shorts}`,
        )
        console.log('[BROLL_TIMING] timeline:', timed.map((t) => `${t.role} ${t.startSec.toFixed(1)}-${t.endSec.toFixed(1)}s (${(t.endSec - t.startSec).toFixed(1)})`))
        ;(window as unknown as { __lastBrollTimed?: TimedBrollScene[] }).__lastBrollTimed = timed
        ;(window as unknown as { __lastBrollStickers?: BrollSticker[] }).__lastBrollStickers = res.stickers
        return { ...res, timed }
      } catch (e) { console.error('[BROLL_DIRECTOR] lỗi:', e) }
    }
    // P3b — render ONE scene of the last plan to a clip (verify quality + sync on a
    // few scenes before the full batch). Run __testBrollDirector() first, then
    // __testRenderScene(0), __testRenderScene(1)… It opens the resulting clip.
    const w2 = window as unknown as {
      __testRenderScene?: (i: number) => Promise<unknown>
      __testHybridAssemble?: () => Promise<unknown>
      __lastBrollTimed?: TimedBrollScene[]
      __lastBrollStickers?: BrollSticker[]
      __hybridClips?: (HybridSceneClip | undefined)[]
    }
    w2.__testRenderScene = async (i: number) => {
      const st = useAdsVideoStore.getState().state
      const timed = w2.__lastBrollTimed
      if (!timed || !timed[i]) { console.warn('[BROLL_RENDER] chạy __testBrollDirector() trước rồi __testRenderScene(i)'); return }
      if (!kieApiKey) { console.warn('[BROLL_RENDER] thiếu KIE key'); return }
      const scene = timed[i]
      const keyframeRef = st.creatorVideo?.keyframeRef
      const voiceRef = st.voiceFirst?.voiceRef ?? st.creatorVideo?.voiceRef
      const resolution = st.costMode === 'FULL' ? '1080p' : st.costMode === 'STANDARD' ? '720p' : '480p'
      console.log(`[BROLL_RENDER] #${i} role=${scene.role} ${scene.startSec}-${scene.endSec}s "${scene.quote.slice(0, 40)}"`)
      try {
        let videoRef: string
        if (scene.role === 'lips') {
          if (!keyframeRef || !voiceRef) { console.warn('[BROLL_RENDER] lips cần keyframe + voice — tạo keyframe ở Bước 3 trước'); return }
          const r = await renderLipsyncSegment({ kieApiKey, config: st.creatorVideoConfig, voiceRef, keyframeRef, startSec: scene.startSec, endSec: scene.endSec })
          videoRef = r.videoRef
        } else {
          const presetId = (scene.role === 'mechanism3d' ? 'CONCEPT_SCENE'
            : scene.kind === 'product_closeup' ? 'PRODUCT_CLOSEUP'
            : scene.kind === 'concept' ? 'CONCEPT_SCENE'
            : 'PRODUCT_IN_ACTION') as ActionPresetId
          let conceptPrompt = scene.conceptPrompt || ''
          if (scene.role === 'mechanism3d' && !conceptPrompt.startsWith('3D MECHANISM ANIMATION')) {
            conceptPrompt = `3D MECHANISM ANIMATION (no people): clean photorealistic 3D scientific/technical animation INSIDE the subject — ${conceptPrompt}. Cross-section or macro of the internal workings, studio 3D render, soft clinical light. NO people, NO hands, NO product packaging, NO text.`
          }
          const r = await renderInsert({
            kieApiKey, presetId, product: st.inputs.product, avatar: st.inputs.avatar,
            creatorKeyframeRef: keyframeRef, resolution,
            conceptPrompt, renderMode: 'video', durationSec: scene.endSec - scene.startSec,
            cameraFraming: scene.cameraFraming, quote: scene.quote,
            onStageUpdate: (u) => console.log(`[BROLL_RENDER] #${i} ${u.stage}`),
          })
          videoRef = r.videoRef
        }
        // P3c-1 — cache the rendered clip so __testHybridAssemble() can ghép them.
        w2.__hybridClips = w2.__hybridClips ?? []
        w2.__hybridClips[i] = { scene, videoRef }
        const url = await getUrl(videoRef)
        console.log(`[BROLL_RENDER] ✅ #${i} XONG (cache __hybridClips[${i}]). Video: ${url}`)
        if (url) window.open(url, '_blank')
        return url
      } catch (e) { console.error(`[BROLL_RENDER] #${i} lỗi:`, e) }
    }
    // P3c-1 — ghép các clip ĐÃ render (cache trong __hybridClips) + master TTS → MP4.
    // FREE (local ffmpeg, 0 credit). Render vài cảnh LIÊN TIẾP từ 0 trước, rồi gọi cái này.
    w2.__testHybridAssemble = async () => {
      const st = useAdsVideoStore.getState().state
      const voiceRef = st.voiceFirst?.voiceRef ?? st.creatorVideo?.voiceRef
      const voiceDurationSec =
        st.voiceFirst?.voiceDurationSec ?? st.creatorVideo?.voiceDurationSec ?? st.scriptBrain.script?.totalDurationSec ?? 50
      if (!voiceRef) { console.warn('[HYBRID_ASM] thiếu voiceRef — tạo keyframe ở Bước 3 trước'); return }
      const clips = (w2.__hybridClips ?? []).filter((c): c is HybridSceneClip => !!c)
      if (clips.length === 0) { console.warn('[HYBRID_ASM] chưa có clip nào — chạy __testRenderScene(0), (1)… trước'); return }
      const resolution = st.costMode === 'FULL' ? '1080p' : st.costMode === 'STANDARD' ? '720p' : '480p'

      // P3c-2 — render sticker PNGs locally (0 credit) + place each on the real
      // timeline second (word-alignment first, sentence estimate fallback). Spacing
      // dedup ≥2.5s (all stickers share the same mid-right spot, like applySuggestions).
      const alignment = st.voiceFirst?.voiceAlignment ?? st.creatorVideo?.voiceAlignment
      const script = st.scriptBrain.script
      const placements: HybridStickerPlacement[] = []
      const dated = (w2.__lastBrollStickers ?? [])
        .map((stk) => {
          const atSec = (alignment ? computeWordTimestampFromAlignment(alignment, stk.quote, stk.wordAnchor) : null)
            ?? (script ? computeQuoteTimestamp(script, stk.quote) : null)
          return { stk, atSec }
        })
        .filter((x): x is { stk: BrollSticker; atSec: number } => typeof x.atSec === 'number')
        .sort((a, b) => a.atSec - b.atSec)
      let lastTs = -Infinity
      for (const { stk, atSec } of dated) {
        if (atSec - lastTs < 2.5) continue
        lastTs = atSec
        try {
          const blob = await renderStickerBlob({ style: stk.style as StickerStyle, text: stk.text ?? '', items: stk.items })
          const pngRef = await saveAsset(blob, 'image/png')
          placements.push({ pngRef, atSec, durationSec: 1.8, heightFraction: 0.10 })
        } catch (e) { console.warn('[HYBRID_ASM] sticker render lỗi — bỏ qua', e) }
      }
      console.log(`[HYBRID_ASM] ghép ${clips.length} clip + ${placements.length} sticker (res=${resolution})…`)
      try {
        const r = await assembleHybridVideo({
          clips, voiceRef, voiceDurationSec, resolution, stickers: placements,
          onStage: (m) => console.log('[HYBRID_ASM]', m),
        })
        const url = await getUrl(r.videoRef)
        console.log(`[HYBRID_ASM] ✅ XONG. MP4: ${url}`)
        if (url) window.open(url, '_blank')
        return url
      } catch (e) { console.error('[HYBRID_ASM] lỗi:', e) }
    }
    return () => {
      delete (window as unknown as { __testBrollDirector?: unknown }).__testBrollDirector
      delete (window as unknown as { __testRenderScene?: unknown }).__testRenderScene
      delete (window as unknown as { __testHybridAssemble?: unknown }).__testHybridAssemble
    }
  }, [geminiKey, kieApiKey])

  const inserts = state.inserts
  const costModeCfg = COST_MODE_CONFIG[state.costMode]
  const maxInserts = costModeCfg.insertCount.max
  const minInserts = costModeCfg.insertCount.min
  const insertResolution =
    state.costMode === 'FULL' ? '1080p' :
    state.costMode === 'STANDARD' ? '720p' :
    '480p'
  // Z39/Z68 — per-insert credit is mode-aware: 'video' = keyframe + Grok 1.5
  // i2v (~21cr); 'ken_burns' = keyframe-only (~6cr, the motion is a free local
  // ffmpeg zoom). Default chip shows the video price as the headline.
  // Z98 — credit estimate now scales with the active resolution + the insert's
  // duration so the UI chip matches what Grok will actually bill.
  const insertCredits = estimateInsertCredits('video', insertResolution, 6)
  // Eligible inserts a "Bulk render" would actually pay for (skips
  // locked/approved/rejected per the Z26 lesson) — and their real summed cost,
  // honouring each card's render mode. Z98 #5 — stickers are excluded: they're
  // already drawn locally (0 credit), so sending them to Grok just errors.
  const bulkEligible = listEligibleInsertsForBulk(inserts).filter((it) => it.renderMode !== 'sticker')
  const bulkPendingCount = bulkEligible.length
  const bulkCredits = bulkEligible.reduce(
    (sum, it) => sum + estimateInsertCredits(it.renderMode ?? 'video', insertResolution, it.durationSec ?? 4), 0,
  )

  // ── Smart suggestions (Gemini semantic, script-language aware) ────────────
  const [suggestions, setSuggestions] = useState<InsertSuggestion[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  // Z98 B2 — true while the real voice is being synthesized before the director.
  const [isPreparingVoice, setIsPreparingVoice] = useState(false)

  // Z98 B2 — VOICE-FIRST. Ensure the REAL voice exists BEFORE the director runs,
  // recalibrate the script to its measured duration, and return the recalibrated
  // script for the director to read. Reuses an existing voice when script+voice
  // are unchanged (sig match). Falls back to the current estimate-script when
  // there's no ElevenLabs key or TTS fails — never blocks the director.
  const ensureVoiceFirst = async (): Promise<GeneratedScript | null> => {
    const script = state.scriptBrain.script
    if (!script) return null
    const fullText = script.blocks.map((b) => b.text).join(' ')
    const pickedVoiceId = state.inputs.voiceId
    const sig = scriptVoiceSig(fullText, pickedVoiceId)

    // Already have a matching real voice → reuse, just recalibrate (idempotent).
    const existing = state.voiceFirst
    if (existing && existing.scriptSig === sig) {
      const recal = recalibrateScriptToRealVoice(script, existing.voiceDurationSec, existing.voiceAlignment)
      setGeneratedScript(recal)
      return recal
    }

    // No ElevenLabs key → can't synth the real voice; director uses the estimate.
    if (!elevenLabsKey) return script

    setIsPreparingVoice(true)
    try {
      const voiceCategory = state.scriptBrain.voiceCategory
        ?? matchVoiceForAvatar(state.inputs.avatar, state.scriptBrain.angle)
      const voice = await generateCreatorVoice({
        elevenLabsApiKey: elevenLabsKey,
        script,
        voiceCategory,
        voiceId: pickedVoiceId,
      })
      setVoiceFirst({
        voiceRef: voice.voiceRef,
        voiceDurationSec: voice.voiceDurationSec,
        voiceId: voice.voiceId,
        voiceAlignment: voice.voiceAlignment,
        scriptSig: sig,
      })
      const recal = recalibrateScriptToRealVoice(script, voice.voiceDurationSec, voice.voiceAlignment)
      setGeneratedScript(recal)
      addToast(
        `✓ Đã tạo giọng thật ${recal.totalDurationSec.toFixed(1)}s — đạo diễn chia cảnh theo độ dài này`,
        'success',
      )
      return recal
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Tạo giọng lỗi: ${msg.slice(0, 140)} — đạo diễn tạm dùng ước tính`, 'info')
      return script
    } finally {
      setIsPreparingVoice(false)
    }
  }

  // Fetch the director's scene breakdown for the current script. Gemini path
  // when a key exists (reads meaning), keyword fallback otherwise.
  const fetchSuggestions = async (scriptOverride?: GeneratedScript): Promise<InsertSuggestion[]> => {
    const script = scriptOverride ?? state.scriptBrain.script
    if (!script) return []
    if (geminiKey) {
      return directScenesWithGemini({
        geminiKey,
        script,
        lang: state.scriptBrain.outputLang,
        budget: maxInserts,
        floor: minInserts,
        // Z48 — give the Director the product so it understands usage/form
        // and picks usage-correct presets for any niche (not just teeth).
        product: state.inputs.product,
      })
    }
    // Offline fallback — keyword match, no padding.
    return pickTopInsertsForBudget(script, maxInserts)
  }

  // Apply a suggestion list straight into the store (replaces current inserts).
  // Anchors each scene to its block's start second so the auto-edit planner
  // places it at the right moment (semantic match → timeline).
  const applySuggestions = (result: InsertSuggestion[], scriptOverride?: GeneratedScript) => {
    if (result.length === 0) return
    const script = scriptOverride ?? state.scriptBrain.script
    const blockStarts = script ? computeBlockStartTimestamps(script) : null
    // Z98 #5.3 — real char-level alignment from the voice-first synth; lets
    // stickers anchor on the exact WORD, not the sentence start. Read FRESH from
    // the store (not the closure `state`, which can be stale when applySuggestions
    // runs in the async flow right after the voice was synthesized — a stale
    // undefined alignment made every sticker fall back to its sentence start, so
    // two stickers on one line collided at the same second).
    const align = useAdsVideoStore.getState().state.voiceFirst?.voiceAlignment
    const items = result.map((s) => {
      // Z42 — anchor to the EXACT second the quoted line is spoken; fall back to
      // the coarse block-start only when the quote can't be located.
      const quoteTs = script ? computeQuoteTimestamp(script, s.quote) : null
      const blockTs = blockStarts && s.anchorBlock ? blockStarts[s.anchorBlock] : null
      // Z98 #5.3 — a sticker pops on its keyword, not the sentence start. Use
      // the real alignment's word-level second when available; else fall back
      // to the sentence-level estimate like any other insert.
      const wordTs = (s.renderMode === 'sticker' && align)
        ? computeWordTimestampFromAlignment(align, s.quote, s.stickerWordAnchor)
        : null
      return {
        presetId: s.presetId,
        durationSec: s.durationSec ?? ACTION_PRESETS[s.presetId].durationPreset,
        scriptKeyword: s.matchedKeywords[0],
        voiceTimestampSec: wordTs ?? quoteTs ?? blockTs,
        // Z98 (#6) — persist the quote so the planner can re-anchor against the
        // REAL voice alignment (exact spoken second), not just the WPM estimate.
        quote: s.quote,
        conceptPrompt: s.conceptPrompt,
        renderMode: s.renderMode,
        layout: s.layout,
        cameraFraming: s.cameraFraming,
        // Z98 #5 — sticker scenes carry their style + text + word anchor.
        stickerStyle: s.stickerStyle,
        stickerText: s.stickerText,
        stickerWordAnchor: s.stickerWordAnchor,
      }
    })
    // Z98 #5 — sticker spacing. Stickers all sit at the same mid-right spot and
    // last 1.8s, so two within ~2.5s overlap (the director sometimes pops a
    // keyword + its neighbour in one line). Keep the FIRST of any cluster, drop
    // the rest. Scenes are left untouched.
    const sceneItems = items.filter((it) => it.renderMode !== 'sticker')
    const MIN_STICKER_GAP = 2.5
    let lastStickerTs = -Infinity
    const keptStickers = items
      .filter((it) => it.renderMode === 'sticker')
      .sort((a, b) => (a.voiceTimestampSec ?? 0) - (b.voiceTimestampSec ?? 0))
      .filter((it) => {
        const t = it.voiceTimestampSec ?? 0
        if (t - lastStickerTs >= MIN_STICKER_GAP) { lastStickerTs = t; return true }
        return false
      })
    const dedupedItems = [...sceneItems, ...keptStickers]

    // Z98 #1 — telemetry-only gap detector. The director's "no gap >5s" rule
    // sits in the prompt and Gemini sometimes ignores it (anchors 2 distinct
    // voice claims into a single scene → 9-12s of talking-head with nothing
    // illustrating it). Code never auto-generates a scene to fill the gap —
    // that would be patching AI behaviour, which the user has banned. Instead
    // we sort the scenes by their real spoken second + log any consecutive
    // pair more than 5s apart so the user sees WHERE the gap is and can
    // either "Đạo diễn lại" or accept it (a sparse script naturally yields
    // sparse coverage).
    const voiceDur = script?.totalDurationSec ?? 0
    if (voiceDur > 0) {
      const timed = sceneItems
        .map((it, i) => ({ i, ts: it.voiceTimestampSec, dur: it.durationSec ?? 4 }))
        .filter((x): x is { i: number; ts: number; dur: number } => typeof x.ts === 'number')
        .sort((a, b) => a.ts - b.ts)
      const GAP_THRESHOLD = 5
      const gaps: { fromIdx: number; toIdx: number; gapSec: number; fromEnd: number; toStart: number }[] = []
      for (let k = 0; k < timed.length - 1; k++) {
        const fromEnd = timed[k].ts + timed[k].dur
        const toStart = timed[k + 1].ts
        const gap = toStart - fromEnd
        if (gap > GAP_THRESHOLD) {
          gaps.push({ fromIdx: timed[k].i + 1, toIdx: timed[k + 1].i + 1, gapSec: Math.round(gap * 10) / 10, fromEnd: Math.round(fromEnd * 10) / 10, toStart: Math.round(toStart * 10) / 10 })
        }
      }
      if (gaps.length > 0) {
        console.warn(
          `[DIRECTOR] ${gaps.length} GAP >${GAP_THRESHOLD}s detected — script vùng đó không có cảnh nào minh hoạ:`,
          gaps,
        )
        addToast(
          `⚠ ${gaps.length} đoạn voice trống >${GAP_THRESHOLD}s (xem Console) — bấm "Đạo diễn lại" hoặc kiểm tra kịch bản`,
          'info',
        )
      }
    }
    clearAllInserts()
    bulkAddInsertsFromPresets(dedupedItems)
    // Z98 #5 — auto-render sticker PNGs locally (0 credit, instant). Stickers
    // never touch the Grok pipeline; we draw the transparent PNG on a canvas,
    // save it as the insert's keyframeRef, and mark it completed so the card
    // shows it immediately. Runs after bulkAdd so the insertIds exist.
    void renderPendingStickers()
  }

  // Z98 #5 — render any sticker insert that doesn't have its PNG yet.
  const renderPendingStickers = async () => {
    const pending = useAdsVideoStore.getState().state.inserts.filter(
      (it) => it.renderMode === 'sticker' && it.stickerStyle && it.stickerText && !it.keyframeRef,
    )
    for (const it of pending) {
      try {
        const blob = await renderStickerBlob({ style: it.stickerStyle!, text: it.stickerText! })
        const ref = await saveAsset(blob, 'image/png')
        patchInsert(it.insertId, { keyframeRef: ref, stage: 'completed', status: 'idle' })
      } catch (err) {
        console.warn(`[STICKER] render failed for insert #${it.insertId}`, err)
        patchInsert(it.insertId, { stage: 'failed', error: 'Lỗi vẽ sticker' })
      }
    }
  }

  // Manual re-run ("Đạo diễn lại"). Fetches + applies + shows the result chips.
  const handleSuggest = async () => {
    const script = state.scriptBrain.script
    if (!script) {
      addToast('Chưa có script — quay lại Bước 1', 'error')
      return
    }
    setIsSuggesting(true)
    try {
      // Z98 B2 — real voice first → director reads the true duration.
      const calibrated = await ensureVoiceFirst()
      const result = await fetchSuggestions(calibrated ?? undefined)
      setSuggestions(result)
      if (result.length > 0) {
        applySuggestions(result, calibrated ?? undefined)
        // Z42 — honest path signal. The Gemini DIRECTOR always sets matchCount=0;
        // the offline KEYWORD path sets matchCount>0. If every result came from
        // keyword matching, the AI director did NOT run (no key, or it failed) —
        // say so instead of falsely claiming "AI đạo diễn".
        const usedKeyword = result.every((r) => r.matchCount > 0)
        if (usedKeyword) {
          addToast(
            geminiKey
              ? '⚠ AI đạo diễn chưa trả được kết quả — đang tạm dò từ khoá (không có cảnh concept/cơ chế). Bấm Đạo diễn lại để thử lại.'
              : '⚠ Chưa có Gemini key trong Cài đặt — chỉ dò từ khoá (không tách được cảnh cơ chế/cảm xúc). Thêm key để AI đạo diễn thật.',
            'info',
          )
        } else {
          const freeCount = result.filter(
            (r) => r.presetId === 'CONCEPT_SCENE' || r.presetId === 'PRODUCT_IN_ACTION',
          ).length
          addToast(
            `✓ AI đạo diễn ${result.length} cảnh theo kịch bản${freeCount > 0 ? ` (${freeCount} cảnh tự do)` : ''}`,
            'success',
          )
        }
      } else {
        addToast(
          geminiKey
            ? 'Kịch bản hơi ngắn — AI chưa tách được cảnh, bạn thêm từ thư viện bên dưới nhé'
            : 'Chưa match được cảnh nào — thêm Gemini key hoặc thêm từ thư viện bên dưới',
          'info',
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Đạo diễn lỗi: ${msg.slice(0, 160)}`, 'error')
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleApplySuggestions = () => {
    if (suggestions.length === 0) return
    applySuggestions(suggestions)
    addToast(`✓ Đã thêm ${suggestions.length} insert từ gợi ý`, 'success')
  }

  // ── Full-auto: direct the scenes ONCE on entry ───────────────────────────
  // The engine is AI-first — landing on this step with a script and no inserts
  // yet auto-runs the director and fills the list. The user only reviews/edits;
  // the preset library below is for manual tweaks, not the starting point.
  // This is a single cheap Gemini text call — NO KIE credits are spent (nothing
  // is rendered until the user explicitly triggers a render).
  const autoRanRef = useRef(false)
  useEffect(() => {
    if (autoRanRef.current) return
    const script = state.scriptBrain.script
    if (!script) return
    // Respect existing work (restored from store / added manually) — don't wipe.
    if (inserts.length > 0) { autoRanRef.current = true; return }
    autoRanRef.current = true
    void (async () => {
      setIsSuggesting(true)
      try {
        // Z98 B2 — synth the real voice + recalibrate BEFORE directing.
        const calibrated = await ensureVoiceFirst()
        const result = await fetchSuggestions(calibrated ?? undefined)
        if (result.length > 0) {
          setSuggestions(result)
          applySuggestions(result, calibrated ?? undefined)
          const usedKeyword = result.every((r) => r.matchCount > 0)
          if (usedKeyword) {
            addToast(
              geminiKey
                ? '⚠ AI đạo diễn chưa trả được kết quả — đang tạm dò từ khoá. Bấm Đạo diễn lại để thử lại.'
                : '⚠ Chưa có Gemini key trong Cài đặt — chỉ dò từ khoá. Thêm key để AI đạo diễn thật theo kịch bản.',
              'info',
            )
          } else {
            const freeCount = result.filter(
              (r) => r.presetId === 'CONCEPT_SCENE' || r.presetId === 'PRODUCT_IN_ACTION',
            ).length
            addToast(
              `✓ AI tự đạo diễn ${result.length} cảnh theo kịch bản${freeCount > 0 ? ` (${freeCount} cảnh tự do)` : ''} — soát lại / sửa bên dưới`,
              'success',
            )
          }
        }
      } catch (err) {
        // Z42 — surface the failure (was silent) so a bad Gemini key / network
        // error is visible instead of looking like "AI did nothing".
        const msg = err instanceof Error ? err.message : String(err)
        addToast(`AI đạo diễn lỗi: ${msg.slice(0, 140)} — bấm Đạo diễn lại để thử`, 'error')
      } finally {
        setIsSuggesting(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scriptBrain.script])

  // ── Per-insert render ────────────────────────────────────────────────────

  // Z44 — Render concurrency gate. Manual clicks fire in parallel by default;
  // bursting 5+ Kling submissions at once gets KIE rate-limited (422 / 429 /
  // queue-stuck timeouts). Hard cap at 2 in-flight; additional clicks queue up
  // and start as the earlier ones finish. The user can spam every "Render"
  // button — the gate keeps KIE happy.
  const RENDER_CONCURRENCY = 2
  const renderSlotRef = useRef<{ active: number; queue: Array<() => void> }>({ active: 0, queue: [] })
  const acquireRenderSlot = (insertId: number): Promise<void> => new Promise((resolve) => {
    const ref = renderSlotRef.current
    if (ref.active < RENDER_CONCURRENCY) {
      ref.active++
      resolve()
    } else {
      addToast(`Đã có ${RENDER_CONCURRENCY} render đang chạy — insert #${insertId} xếp hàng đợi`, 'info')
      ref.queue.push(() => { ref.active++; resolve() })
    }
  })
  const releaseRenderSlot = () => {
    const ref = renderSlotRef.current
    ref.active = Math.max(0, ref.active - 1)
    const next = ref.queue.shift()
    if (next) next()
  }

  const handleRenderInsert = async (insertId: number) => {
    if (!kieApiKey) { addToast('Thiếu KIE API key', 'error'); return }
    const insert = inserts.find((it) => it.insertId === insertId)
    if (!insert) return
    const preset = ACTION_PRESETS[insert.presetId]

    // P4b GATE — product inserts need the product's 4 images. Old 1-image
    // products are blocked until the user re-uploads 4 in the Product app.
    if (preset.needsProduct && state.inputs.product && !hasFourProductImages(state.inputs.product)) {
      addToast('Sản phẩm cần đủ 4 ảnh — vào app Sản phẩm bổ sung đủ 4 ảnh rồi lưu mới tạo được cảnh', 'error')
      return
    }

    // Z74 — DOUBLE-SUBMIT GUARD. CRITICAL credit-burn fix.
    // Before: if the user clicked Bulk render and then clicked the per-card
    // Render on an insert that was queued (status='rendering'), this handler
    // re-submitted the SAME insert to KIE, costing the credit again. User
    // burned ~487 credits on one session this way. Now: any insert already
    // in an active state (rendering OR mid-stage keyframe/video_full) is
    // refused with a clear toast; nothing is submitted.
    if (insert.status === 'rendering' || insert.stage === 'keyframe' || insert.stage === 'video_full') {
      addToast(`Insert #${insertId} đang render (${insert.stage}) — đợi xong, không bấm lại để tránh tốn credit 2 lần.`, 'info')
      return
    }
    // Mark queued state if we have to wait
    patchInsert(insertId, { stage: 'keyframe', status: 'rendering', startedAt: now(), error: undefined })
    await acquireRenderSlot(insertId)

    try {
      const product = preset.needsProduct ? state.inputs.product : null
      // P4b — compute the product's visual brief ONCE (cached + in-flight
      // deduped), so the renderer can pick the best image(s) per insert.
      let visualBrief: ProductVisualBrief | undefined
      if (product && geminiKey) {
        try { visualBrief = await getProductVisualBrief(product, geminiKey) }
        catch (e) { console.warn('[insert] product visual brief failed — using single image', e) }
      }
      const result = await renderInsert({
        kieApiKey,
        presetId: insert.presetId,
        product,
        visualBrief,
        avatar: state.inputs.avatar,
        creatorKeyframeRef: state.creatorVideo?.keyframeRef,
        resolution: insert.resolution,
        conceptPrompt: insert.conceptPrompt,
        renderMode: insert.renderMode ?? 'video',
        durationSec: insert.durationSec,
        cameraFraming: insert.cameraFraming,  // director upgrade — no-face hands-in-action shot
        quote: insert.quote,  // Z98 V1 — drives the wardrobe-shift decision in the renderer
        onStageUpdate: (update) => {
          patchInsert(insertId, {
            stage: update.stage,
            ...(update.keyframeRef !== undefined        && { keyframeRef: update.keyframeRef }),
            ...(update.keyframePromptUsed !== undefined && { keyframePromptUsed: update.keyframePromptUsed }),
            ...(update.fullTaskId !== undefined         && { fullTaskId: update.fullTaskId }),
            ...(update.videoRef !== undefined           && { videoRef: update.videoRef }),
          })
        },
      })
      patchInsert(insertId, {
        stage: 'completed',
        status: 'completed',
        videoRef: result.videoRef,
        finishedAt: now(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined
      console.error(`[INSERT_FAIL insertId=${insertId} presetId=${insert.presetId}] full message:`, msg)
      if (stack) console.error(`[INSERT_FAIL insertId=${insertId}] stack:`, stack)
      patchInsert(insertId, {
        stage: 'failed',
        status: 'failed',
        error: msg.slice(0, 240),
        finishedAt: now(),
      })
      addToast(`Insert lỗi: ${msg}`, 'error')
    } finally {
      releaseRenderSlot()
    }
  }

  // Z38 — RESUME a paid-but-unfinished insert. When a render timed out (or the
  // tab was refreshed) the Kling job kept running on KIE and was already
  // charged. Re-poll the SAME taskId instead of re-submitting → 0 extra credit.
  const handleResumeInsert = async (insertId: number) => {
    if (!kieApiKey) { addToast('Thiếu KIE API key', 'error'); return }
    const insert = inserts.find((it) => it.insertId === insertId)
    if (!insert?.fullTaskId) return
    patchInsert(insertId, { stage: 'video_full', status: 'rendering', error: undefined })
    try {
      const { videoRef } = await resumeInsertVideo({
        kieApiKey,
        taskId: insert.fullTaskId,
        onStageUpdate: (update) => {
          patchInsert(insertId, {
            stage: update.stage,
            ...(update.videoRef !== undefined && { videoRef: update.videoRef }),
          })
        },
      })
      patchInsert(insertId, {
        stage: 'completed',
        status: 'completed',
        videoRef,
        finishedAt: now(),
      })
      addToast('✓ Khôi phục insert thành công (0 credit)', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      patchInsert(insertId, { stage: 'failed', status: 'failed', error: msg.slice(0, 240), finishedAt: now() })
      addToast(`Khôi phục lỗi: ${msg}`, 'error')
    }
  }


  const handleBulkRender = async () => {
    // Z98 #5 — never bulk-render stickers (local, 0 credit; Grok render errors).
    const eligible = listEligibleInsertsForBulk(inserts).filter((it) => it.renderMode !== 'sticker')
    if (eligible.length === 0) {
      addToast('Tất cả cảnh đã có video — không còn cảnh nào cần tạo', 'info')
      return
    }
    // Z98 P1 — parallel with concurrency=2. Sequential was ~5min/scene worst
    // case when KIE freezes (150s × 3 fast-attempt retries) → 12 scenes = 60min.
    // 2-at-a-time roughly halves wall-clock without hitting KIE rate limits.
    const CONCURRENCY = 2
    addToast(`🎬 Đang tạo ${eligible.length} cảnh (×${CONCURRENCY} song song)...`)
    const queue = [...eligible]
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const it = queue.shift()
        if (!it) break
        await handleRenderInsert(it.insertId)
      }
    })
    await Promise.all(workers)
    addToast(`✓ Tạo xong ${eligible.length} cảnh`, 'success')
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Bước 2 — Action Inserts</h2>
          <p className="text-[12px] text-gray-500">
            AI tự đạo diễn cảnh từ kịch bản và đổ danh sách sẵn — bạn chỉ soát lại. Đây là clip ngắn hỗ trợ
            (cầm sản phẩm, mở nắp, point label, cảnh minh hoạ) — không phải B-roll cinematic.
            Giới hạn {minInserts}-{maxInserts} insert · {insertResolution} · mỗi insert {formatCredits(insertCredits)}.
          </p>
          <p className="mt-1 text-[11px] text-amber-700">
            Mỗi insert chỉ render 1 lần (đã bỏ bước preview tốn credit thừa). Nếu render timeout, bấm
            <strong> Khôi phục</strong> trên thẻ để lấy lại video đã trả tiền — không tốn thêm credit.
          </p>
        </div>

        {/* ── Z98 — voice-first player (listen to the real voice the director used) ── */}
        {state.voiceFirst && <VoiceFirstBar voice={state.voiceFirst} />}

        {/* ── Smart suggestions (Gemini semantic) ─────────────────────────── */}
        {state.scriptBrain.script && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  AI đạo diễn — tự tách cảnh theo kịch bản
                </p>
                <p className="mt-0.5 text-[11px] text-gray-600">
                  AI <strong>tự chạy</strong> ngay khi bạn vào bước này: đọc <strong>nghĩa</strong> cả kịch bản,
                  tách cảnh (3-5s/cảnh) và <strong>đổ sẵn danh sách insert bên dưới</strong>. Bạn chỉ soát lại / sửa / xoá.
                  Bấm <strong>Đạo diễn lại</strong> nếu muốn AI thử lại. (Chưa render gì — không tốn KIE credit.)
                </p>
                {suggestions.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {suggestions.map((sug, i) => {
                      const preset = ACTION_PRESETS[sug.presetId]
                      const isConcept = sug.presetId === 'CONCEPT_SCENE' || sug.presetId === 'PRODUCT_IN_ACTION'
                      return (
                        <div
                          key={`${sug.presetId}-${i}`}
                          title={isConcept ? sug.conceptPrompt : sug.reason}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${TONE_BG[preset.tone]}`}
                        >
                          <span className="shrink-0 opacity-50">#{i + 1}</span>
                          <span className="shrink-0">{preset.emoji}</span>
                          <span className="shrink-0">{preset.labelVi}</span>
                          <span className="shrink-0 rounded bg-black/10 px-1 text-[8px]">~{sug.durationSec ?? preset.durationPreset}s</span>
                          {(isConcept ? sug.conceptPrompt : sug.reason) && (
                            <span className="min-w-0 flex-1 truncate font-normal opacity-80">
                              {isConcept ? sug.conceptPrompt : sug.reason}
                            </span>
                          )}
                          <span className="ml-auto shrink-0 text-[8px] opacity-70">{Math.round(sug.confidence * 100)}%</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button
                  onClick={handleSuggest}
                  disabled={isSuggesting || isPreparingVoice}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-[12px] font-bold text-amber-700 shadow-sm hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPreparingVoice
                    ? <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Đang tạo giọng...</>
                    : isSuggesting
                    ? <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Đang đạo diễn...</>
                    : <><Wand2 className="mr-1 inline h-3.5 w-3.5" /> {suggestions.length > 0 ? 'Đạo diễn lại' : 'Gợi ý AI'}</>}
                </button>
                {suggestions.length > 0 && (
                  <button
                    onClick={handleApplySuggestions}
                    className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-[12px] font-bold text-white shadow-sm hover:from-amber-600 hover:to-orange-600"
                  >
                    <Zap className="mr-1 inline h-3.5 w-3.5" /> Apply {suggestions.length}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Insert cards ─────────────────────────────────────────────────── */}
        {inserts.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Inserts ({inserts.length})
              </p>
              <button
                onClick={clearAllInserts}
                className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="mr-0.5 inline h-3 w-3" /> Xoá hết
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {inserts.map((insert) => (
                <InsertCard
                  key={insert.insertId}
                  insert={insert}
                  voiceRef={state.voiceFirst?.voiceRef}
                  onSetMode={(mode) => patchInsert(insert.insertId, { renderMode: mode })}
                  onSetLayout={(layout) => patchInsert(insert.insertId, { layout })}
                  onRender={() => handleRenderInsert(insert.insertId)}
                  onResume={() => handleResumeInsert(insert.insertId)}
                  onRemove={() => removeInsert(insert.insertId)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Bulk render + Continue ───────────────────────────────────────── */}
        {inserts.length > 0 && (
          <div className="mt-4 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  {bulkPendingCount > 0
                    ? `${bulkPendingCount} cảnh chờ tạo / ${inserts.length}`
                    : `Đã tạo xong · ${inserts.length} cảnh`}
                </p>
                <p className="text-[11px] text-gray-500">
                  "Tạo tất cả" render mọi cảnh chưa có video — cảnh đã xong không tạo lại (không tốn credit thừa).
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkRender}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-violet-700 hover:to-pink-700"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Tạo tất cả{bulkPendingCount > 0 ? ` · ${formatCredits(bulkCredits)}` : ''}
                </button>
                <button
                  onClick={onContinue}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700"
                >
                  Tiếp tục → Video Creator <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {inserts.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <Plus className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm font-semibold text-gray-500">Chưa có cảnh nào</p>
            <p className="mt-1 text-[11px] text-gray-400">
              AI tự đạo diễn khi bạn vào bước này. Bấm "Đạo diễn lại" ở trên nếu chưa thấy cảnh.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Per-insert card ──────────────────────────────────────────────────────

function InsertCard({
  insert, voiceRef,
  onSetMode, onSetLayout, onRender, onResume, onRemove,
}: {
  insert: ActionInsertClip
  /** Z98 #5 — the voice-first voice asset, for the sticker mini-preview. */
  voiceRef?: string
  onSetMode: (mode: InsertRenderMode) => void
  onSetLayout: (layout: 'cut' | 'overlay_corner') => void
  onRender: () => void
  onResume: () => void
  onRemove: () => void
}) {
  const preset = ACTION_PRESETS[insert.presetId]
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const resolvedKeyframe = useAssetUrl(insert.keyframeRef ?? undefined)
  const resolvedVideo    = useAssetUrl(insert.videoRef ?? undefined)
  const resolvedPreview  = useAssetUrl(insert.previewVideoRef ?? undefined)
  // Z98 #5 — sticker mini-preview: plays the voice window + pops the sticker in
  // at the exact spoken second so the user can SEE+HEAR whether it lines up.
  const stickerVoiceUrl = useAssetUrl(voiceRef ?? undefined)
  const stickerAudioRef = useRef<HTMLAudioElement>(null)
  const [stickerPreviewing, setStickerPreviewing] = useState(false)
  const [stickerShown, setStickerShown] = useState(true)
  const playStickerPreview = () => {
    const audio = stickerAudioRef.current
    const ts = insert.voiceTimestampSec
    if (!audio || ts == null) return
    setStickerPreviewing(true)
    setStickerShown(false)                  // hidden during the 2s lead-in
    audio.currentTime = Math.max(0, ts - 2)
    audio.play().catch(() => {})
    const onTime = () => {
      if (audio.currentTime >= ts) setStickerShown(true)        // pop on the word
      if (audio.currentTime >= ts + 2) {                        // end the window
        audio.pause()
        audio.removeEventListener('timeupdate', onTime)
        setStickerPreviewing(false)
        setStickerShown(true)               // back to the static display
      }
    }
    audio.addEventListener('timeupdate', onTime)
  }

  const keyframeUrl = insert.keyframeRef?.startsWith('http') ? insert.keyframeRef : resolvedKeyframe
  const videoUrl    = insert.videoRef?.startsWith('http')    ? insert.videoRef    : resolvedVideo
  const previewUrl  = insert.previewVideoRef?.startsWith('http') ? insert.previewVideoRef : resolvedPreview

  // Show full video if available; otherwise preview; otherwise keyframe still
  const displayVideoUrl = videoUrl ?? previewUrl

  const isLoading = insert.stage === 'keyframe' || insert.stage === 'preview_motion' || insert.stage === 'video_full'
  const hasVideo = !!insert.videoRef
  const mode: InsertRenderMode = insert.renderMode ?? 'video'
  const layout = insert.layout ?? 'cut'
  const canEditMode = !isLoading && !hasVideo && insert.status !== 'locked'
  const isLocked = insert.status === 'locked'
  const isApproved = insert.status === 'approved'
  const isRejected = insert.status === 'rejected'
  const canEditLayout = !isLocked && !isApproved

  // Auto-rebind src when ref changes. Z98 V3 — also pin the playback rate to
  // 1.3× so the preview matches the final export (Grok i2v intrinsic motion
  // runs ~0.7× of natural speed; without this the preview feels slow-mo even
  // though the final export will already be sped up by the assembler).
  useEffect(() => {
    if (videoRef.current && displayVideoUrl) {
      videoRef.current.load()
      videoRef.current.playbackRate = 1.3
    }
  }, [displayVideoUrl])

  const toggle = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) { videoRef.current.play(); setPlaying(true) }
    else { videoRef.current.pause(); setPlaying(false) }
  }

  const borderCls =
    isLocked   ? 'border-blue-400 ring-2 ring-blue-200/60' :
    isApproved ? 'border-emerald-400 ring-1 ring-emerald-200/40' :
    isRejected ? 'border-rose-300 opacity-70' :
    insert.stage === 'failed' ? 'border-red-300' :
    'border-black/10'

  // Z98 #5.4 — sticker cards are a DIFFERENT thing from Grok/3D inserts: a free
  // local PNG that pops mid-right over the talking-head. Render a dedicated,
  // simpler card (no Render button, no mode toggle, no "Video lỗi" banner) that
  // previews the sticker at its REAL size + position, with a click-to-hear so
  // the user can verify it lands on the right voice moment.
  if (insert.renderMode === 'sticker') {
    const styleMeta = insert.stickerStyle ? STICKER_STYLE_META[insert.stickerStyle] : null
    const ts = insert.voiceTimestampSec
    return (
      <div className="group flex flex-col overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
        {/* Mock composition: the talking-head stand-in + the sticker at its real
            right-column LOWER-THIRD position (y≈70%, over the chest — clears the
            face), so the user sees where it will actually sit. */}
        <div className="relative aspect-[9/16] bg-gradient-to-b from-slate-200 to-slate-300">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400">
            <Mic className="h-8 w-8 opacity-40" />
            <span className="text-[9px] font-medium opacity-70">creator đang nói</span>
          </div>
          {keyframeUrl ? (
            <img
              src={keyframeUrl}
              alt={insert.stickerText ?? 'sticker'}
              /* Z98 #5 — size by HEIGHT (consistent text size for every sticker),
                 width auto, capped so a long label can't overflow. Fixing WIDTH
                 made short labels huge + long labels unreadably tiny. */
              className={`absolute right-[4%] top-[70%] h-[11%] w-auto max-w-[60%] -translate-y-1/2 object-contain drop-shadow-lg transition-all duration-200 ${
                stickerShown ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-violet-500">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Đang vẽ sticker…
            </div>
          )}
          <span className="absolute left-1.5 top-1.5 rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
            🏷 STICKER · {styleMeta?.labelVi ?? insert.stickerStyle}
          </span>
          {stickerPreviewing && (
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold text-white">
              ▶ đang xem thử…
            </span>
          )}
          {stickerVoiceUrl && <audio ref={stickerAudioRef} src={stickerVoiceUrl} preload="auto" className="hidden" />}
        </div>
        <div className="border-t border-black/5 px-2 py-1.5 text-[10px]">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate font-bold text-violet-800">"{insert.stickerText}"</span>
            {ts != null && <span className="shrink-0 text-violet-600">@{ts.toFixed(1)}s</span>}
          </div>
          {insert.quote && (
            <button
              type="button"
              onClick={playStickerPreview}
              disabled={ts == null || !stickerVoiceUrl || stickerPreviewing}
              title={ts != null ? `Xem thử: nghe voice + sticker bật ở giây ${ts.toFixed(1)}s` : 'Không có dấu thời gian'}
              className="mt-1 flex w-full items-start gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-1 text-left leading-tight text-violet-900 transition-colors enabled:hover:border-violet-400 enabled:hover:bg-violet-100 disabled:cursor-default disabled:opacity-70"
            >
              <Play className="mt-[1px] h-2.5 w-2.5 shrink-0 text-violet-600" />
              <span className="line-clamp-2">
                <span className="font-semibold text-violet-700">▶ Xem thử · </span>
                "{insert.quote}"
                {insert.stickerWordAnchor && (
                  <span className="font-semibold"> → bật ở "{insert.stickerWordAnchor}"</span>
                )}
              </span>
            </button>
          )}
          <div className="mt-1 flex items-center justify-between text-gray-400">
            <span>1.8s · 0 credit · local</span>
            <button onClick={onRemove} className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-rose-500 hover:bg-rose-50">
              <Trash2 className="h-3 w-3" /> Xoá
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`group flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${borderCls}`}>
      <div className="relative aspect-[9/16] bg-gray-100">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 p-2 text-center text-violet-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[10px] font-medium">{INSERT_STAGE_LABEL_VI[insert.stage]}</span>
            <div className={`absolute inset-x-0 bottom-0 h-0.5 ${STAGE_BAR_COLOR[insert.stage]}`} />
          </div>
        ) : displayVideoUrl ? (
          <>
            <video
              ref={videoRef}
              src={displayVideoUrl}
              className="h-full w-full object-cover"
              playsInline
              loop
              muted
              autoPlay
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onClick={toggle}
              onEnded={() => setPlaying(false)}
            />
            {!playing && (
              <button
                onClick={toggle}
                className="absolute inset-0 flex items-center justify-center bg-black/30 text-white opacity-0 transition-opacity hover:opacity-100"
              >
                <Play className="h-8 w-8 fill-white" />
              </button>
            )}
          </>
        ) : keyframeUrl ? (
          <>
            <img src={keyframeUrl} alt={preset.labelVi} className="h-full w-full object-cover opacity-90" />
            {/* Z45 — when keyframe is done but video FAILED, the card otherwise
                looks identical to "not yet rendered" (just an image + Render
                button), which made users think the still image WAS the final
                result. Overlay a clear failure banner so the retry intent is
                obvious. */}
            {insert.stage === 'failed' && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-red-600/85 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                <AlertCircle className="h-3 w-3" />
                <span className="line-clamp-1">Video lỗi — bấm Render để thử lại</span>
              </div>
            )}
            {insert.stage !== 'failed' && !hasVideo && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-amber-500/85 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                <span>Mới có ảnh keyframe · bấm Render để tạo video</span>
              </div>
            )}
          </>
        ) : insert.stage === 'failed' ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="line-clamp-3 text-[10px] leading-tight">{insert.error ?? 'Render lỗi'}</span>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <span className="text-3xl opacity-40">{preset.emoji}</span>
          </div>
        )}

        <span className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          #{insert.order + 1} {preset.emoji}
        </span>
        {hasVideo && insert.stage === 'completed' && (
          <span className="absolute right-1.5 top-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
            ✓ DONE
          </span>
        )}
        {isLocked && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-blue-600/90 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <Lock className="h-3 w-3" /> Đã khoá
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="border-t border-black/5 px-2 py-1.5 text-[10px]">
        <p className="font-bold leading-tight text-gray-700">{preset.labelVi}</p>
        {(insert.presetId === 'CONCEPT_SCENE' || insert.presetId === 'PRODUCT_IN_ACTION') && insert.conceptPrompt && (
          <p
            title={insert.conceptPrompt}
            className="mt-0.5 line-clamp-2 font-normal italic leading-tight text-sky-700"
          >
            {insert.conceptPrompt}
          </p>
        )}
        {/* Z98 — verbatim voice line this scene illustrates. Click to seek the
            voice player up top so the user can verify the director matched the
            cảnh to the RIGHT moment of the script BEFORE paying for the render.
            Empty for manually-added inserts (no director quote bound). */}
        {insert.quote && (
          <button
            type="button"
            onClick={() => insert.voiceTimestampSec != null && seekVoiceTo(insert.voiceTimestampSec)}
            disabled={insert.voiceTimestampSec == null}
            title={insert.voiceTimestampSec != null
              ? `Bấm để nghe đoạn voice tương ứng (@${insert.voiceTimestampSec.toFixed(1)}s)`
              : 'Không có dấu thời gian — kéo voice thủ công'}
            className="mt-1 flex w-full items-start gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-1 text-left text-[10px] leading-tight text-violet-900 transition-colors enabled:hover:border-violet-400 enabled:hover:bg-violet-100 disabled:cursor-default disabled:opacity-70"
          >
            <Play className="mt-[1px] h-2.5 w-2.5 shrink-0 text-violet-600" />
            <span className="line-clamp-2">
              <span className="font-semibold">"{insert.quote}"</span>
            </span>
          </button>
        )}
        <div className="mt-0.5 flex items-center justify-between text-gray-500">
          <span className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[insert.status]}`} />
            {insert.durationSec.toFixed(1)}s
          </span>
          {insert.voiceTimestampSec != null && (
            <span className="text-violet-600">@{insert.voiceTimestampSec.toFixed(1)}s</span>
          )}
        </div>

        {/* Z39/Z76 — render-mode toggle: static image (cheap, ~6cr, free local
            ffmpeg, content never cropped) vs Grok i2v (~16cr). Editable only
            before render. */}
        <div className="mt-1 flex items-center gap-1">
          {canEditMode ? (
            <div className="inline-flex overflow-hidden rounded-md border border-gray-200">
              <button
                onClick={() => onSetMode('ken_burns')}
                title="Ảnh tĩnh — giữ trọn 100% nội dung, không cắt chữ (ffmpeg local, ~6 credit). Hợp cảnh concept/thành phần/infographic."
                className={`px-1.5 py-0.5 text-[9px] font-bold ${
                  mode === 'ken_burns' ? 'bg-sky-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                🖼 Ảnh
              </button>
              <button
                onClick={() => onSetMode('video')}
                title="Video Grok image-to-video (~16 credit). Hợp cảnh có chuyển động/người thật."
                className={`px-1.5 py-0.5 text-[9px] font-bold ${
                  mode === 'video' ? 'bg-pink-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                🎬 Video
              </button>
            </div>
          ) : (
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
              mode === 'ken_burns' ? 'bg-sky-100 text-sky-700' : 'bg-pink-100 text-pink-700'
            }`}>
              {mode === 'ken_burns' ? '🖼 Ảnh tĩnh' : '🎬 Video (Grok)'}
            </span>
          )}
          <span className="ml-auto text-[9px] font-semibold text-gray-400">
            {formatCredits(estimateInsertCredits(mode, insert.resolution, insert.durationSec)).replace(/ \(.*\)$/, '')}
          </span>
        </div>

        {/* Z69 — layout toggle: full-screen 'cut' vs corner PIP 'overlay_corner'.
            Editable until the clip is locked or approved. */}
        <div className="mt-1 flex items-center gap-1">
          {canEditLayout ? (
            <div className="inline-flex overflow-hidden rounded-md border border-gray-200">
              <button
                onClick={() => onSetLayout('cut')}
                title="Cut — insert chiếm full màn hình, thay thế creator. Hợp hook, demo, CTA, kết quả."
                className={`px-1.5 py-0.5 text-[9px] font-bold ${
                  layout === 'cut' ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                ⬛ Cut
              </button>
              <button
                onClick={() => onSetLayout('overlay_corner')}
                title="Overlay góc — insert hiện góc ~30% màn hình, creator vẫn nói full. Hợp cảnh minh hoạ, thành phần, cơ chế."
                className={`px-1.5 py-0.5 text-[9px] font-bold ${
                  layout === 'overlay_corner' ? 'bg-amber-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                ◰ Overlay
              </button>
            </div>
          ) : (
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
              layout === 'overlay_corner' ? 'bg-amber-100 text-amber-800' : 'bg-violet-100 text-violet-700'
            }`}>
              {layout === 'overlay_corner' ? '◰ Overlay góc' : '⬛ Cut full'}
            </span>
          )}
          <span className="ml-auto text-[9px] text-gray-400">
            {layout === 'overlay_corner' ? 'creator vẫn nói full' : 'thay thế creator'}
          </span>
        </div>
      </div>

      {/* Buttons — director auto-fills + auto-renders; per-card just allows a
          re-render / recover / delete. Approval (✓/✗/lock) removed (Z26 retired). */}
      <div className="flex flex-wrap gap-1 border-t border-black/5 bg-gray-50 px-1.5 py-1.5">
        {isLoading ? (
          <span className="flex-1 px-2 py-1 text-center text-[10px] italic text-gray-400">đang render...</span>
        ) : (
          <>
            <button
              onClick={onRender}
              title={hasVideo ? 'Render lại' : 'Render preview-first'}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-violet-700"
            >
              {hasVideo ? <RotateCcw className="h-3 w-3" /> : <Play className="h-3 w-3 fill-white" />}
              {hasVideo ? 'Lại' : 'Render'}
            </button>
            {!hasVideo && insert.fullTaskId && (
              <button
                onClick={onResume}
                title="Khôi phục video đã trả tiền (re-poll taskId, 0 credit)"
                className="flex items-center justify-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-50"
              >
                <RotateCcw className="h-3 w-3" /> Khôi phục
              </button>
            )}
            <button
              onClick={onRemove}
              title="Xoá insert"
              className="flex items-center justify-center rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-500 hover:bg-red-50 hover:text-red-700"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// Suppress unused-warning for icons referenced only via JSX
void Pause
