// ── HybridVideoPhase (P3f) — Bước "Tạo Video" ────────────────────────────────
// Visual, mode-1-style control: each scene is a 9:16 FRAME with the render button
// ON it; rendered clips play right in the frame so quality is checkable at a glance.
// Voice + face show in a panel you can LISTEN to before paying. This step ONLY
// renders the scenes — assembling the final MP4 happens on the Export step (Bước 3).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import {
  Loader2, Wand2, RotateCcw, AlertCircle, Sparkles, Mic, User, Film, Play, ChevronRight,
  Edit3, Save, X, Pause, Volume2, Image as ImageIcon,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import { directBrollScenes, assignSceneTiming, groundOrphanScenes, type TimedBrollScene, type ShotIntent } from '../services/brollDirector'
import { fixSceneConceptPrompt, planForIntent, type SceneFix } from '../services/sceneConceptFixer'
import { glossScenesToVietnamese } from '../services/scriptGenerator'
import { ensureLocalizedName, applyLocalizedName } from '../services/localizeProductName'
import { generateProductVisualBrief } from '../services/productVisionBrief'
import { renderOneHybridScene, type HybridRenderContext } from '../services/hybridRenderer'
import { resumeInsertVideo } from '../services/insertRenderer'
import { renderCreatorKeyframe } from '../services/creatorVideoEngine'
import { matchVoiceForAvatar } from '../services/voiceCreatorMatcher'
import { calibrateSyllableRate } from '../services/voiceTimingEstimator'
import { BROLL_RENDER_RES } from '../services/hybridConstants'
import { estimateInsertCredits, V3_CREDIT_COST } from '../types'

// P3s — KIE Kling AI Avatar Standard 720p is 8 cr/s (was incorrectly 14 — user
// audited against KIE pricing page). The renderer already calls
// `kling/ai-avatar-standard` (the right model id), only the UI estimate was wrong.
const LIPS_CR_PER_SEC = 8
// P3s — render scenes concurrently (was: 1 at a time). KIE jobs are independent;
// a fail on one doesn't cascade. P4a — bumped 2 → 3 for ~50% faster throughput.
// 3 is safe: client polling load is trivial (3 fetch/5s), submission is 3 POSTs
// (no 429), and any KIE-side queueing / timeout is recoverable via P3z resume
// (re-poll the paid job, no extra charge). 4+ risks heavier KIE queueing.
const MAX_CONCURRENT_RENDERS = 3
const ASSETS_CR = V3_CREDIT_COST.tts + V3_CREDIT_COST.keyframe
// P3z — staleness window for a persisted "đang render" before we treat it as
// abandoned (tab closed). Grok i2v + poll tops out ~10min, so 12 is safe.
const RENDER_STALE_MS = 12 * 60 * 1000
// P3z — module-level (survives SPA re-mount, resets on F5). Lets the mount-effect
// tell "the original render promise is STILL running in this JS session"
// (SPA-nav — don't re-poll, it'll finish itself) from "JS restarted" (F5 — the
// promise is dead, RE-POLL the persisted taskId to recover the paid job).
const ACTIVE_RENDERS = new Set<number>()
// P5h — tracks whether THIS JS session still owns a LIVE voice+face gen promise.
// Mirrors ACTIVE_RENDERS for renders: on a remount it lets us tell "still generating
// in the background (SPA nav, same session)" apart from "orphaned lock (gen died / F5
// reset the JS context)" — so the button never greys out forever on a dead lock.
let ASSETS_GEN_ACTIVE = false

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  lips:         { label: '🗣 Nói',  cls: 'bg-violet-600/90 text-white' },
  broll:        { label: '🎬 Cảnh', cls: 'bg-sky-600/90 text-white' },
  mechanism3d:  { label: '🧬 3D',   cls: 'bg-amber-500/90 text-white' },
  social_proof: { label: '🗯 Bằng chứng', cls: 'bg-emerald-600/90 text-white' },
}

// P6z — DETERMINISTIC mismatch flag (0 LLM, display-only). Flags a card for the user's
// attention when the voice line carries a STRONG cue that clearly disagrees with the declared
// shotIntent — so they can eyeball + "Nhờ AI sửa" if it's really wrong. It NEVER auto-changes
// anything (we don't let a fuzzy judge rewrite the director). Conservative: only high-confidence
// cues so it isn't noisy. Universal VN/MS/EN.
// P6ab — STRICT proof cue: a crowd noun is only "proof" when paired with a BUY/USE/RATE verb,
// or it's an unambiguous proof phrase (sold-fast / repeat / star-rating). Bare "nhiều người" /
// "ramai" / "review" / "đánh giá" alone is NOT proof (those sit in pain/audience/hook lines) —
// the old loose cue over-flagged everything as "should be proof". Universal VN/MS.
const SP_FLAG_RE = /b[áa]n ch[aạ]y|ch[áa]y h[àa]ng|quay l[aạ]i mua|mua l[aạ]i|repeat order|terjual|terlaris|\blaku keras\b|\d+\s*sao|n[ăa]m sao|\d+\s*bintang|review to[àa]n|đ[áa]nh gi[áa] (?:to[àa]n|\d)|(?:ngh[ìi]n|ng[àa]n|nhi[eề]u|tri[ệe]u) ng[ưu][ờo]i (?:đ[ãa] )?(?:mua|đ[ặa]t|d[ùu]ng|tin|review|đ[áa]nh gi[áa])|ribuan orang|ramai(?: dah| yang| gila)* (?:beli|guna|pakai|cuba|membeli|order)|orang (?:dah |ramai )?(?:beli|guna|pakai|cuba)/i
const CTA_FLAG_RE = /gi[ỏo] h[àa]ng|ch[ốo]t đơn|đ[ặa]t (?:hàng |mua )?ngay|link (?:b[êe]n d[ưươ][ớơ]i|mua)|h[ốo]t ngay|\bgrab\b|checkout|order ngay|jom (?:beli|order)|beli sekarang/i
// MECHANISM cue — the line explains HOW it works INSIDE the body (absorption / regulating /
// repairing tissue / stimulating). That begs a 3D internal-mechanism shot. Conservative: needs
// explicit internal/absorption wording, so a plain ingredient LIST ("có Curcumin, Emu Oil") or a
// generic benefit does NOT trip it (those are legitimately product_macro / a creator beat).
const MECH_FLAG_RE = /th[ấa]m (?:s[âa]u|v[àa]o|nhanh|th[ẳa]ng)|h[ấa]p th[ụu]|\bserap\b|ph[ụu]c h[ồo]i (?:m[ôo]|kh[ớ]p|s[ụu]n|t[ếe] b[àa]o|da)|t[áa]i t[ạa]o|k[íi]ch (?:th[íi]ch|ho[ạa]t)|đi (?:th[ẳa]ng |s[âa]u )?v[àa]o (?:m[áa]u|kh[ớ]p|t[ếe] b[àa]o|c[ơ] th[ểe]|da)|\bregulate\b|rangsang|c[ơ] ch[ếe]/i
function suspectMismatch(s: TimedBrollScene, isLast: boolean): string | null {
  const q = s.quote ?? ''
  const it = s.shotIntent
  if (!it) return null
  // FIX4 — the closing CTA cuts (penult offer / final endorsement / any gift cut) are LOCKED on
  // purpose; their buy/popularity wording is expected, so the heuristic must NOT flag them
  // (the "stok laku keras" endorsement was firing a false "nên là thẻ bằng chứng" warning).
  if (isLast || it === 'offer' || it === 'endorsement' || s.giftRef) return null
  if (SP_FLAG_RE.test(q) && it !== 'social_proof') return 'Câu nghe như BẰNG CHỨNG (đám đông/review) — cảnh nên là thẻ bằng chứng?'
  // offer/endorsement/isLast already returned above → this only flags non-CTA cuts that sound like a buy push.
  if (CTA_FLAG_RE.test(q)) return 'Câu nghe như KÊU GỌI MUA — cảnh nên là ưu đãi/CTA?'
  if (MECH_FLAG_RE.test(q) && it !== 'mechanism3d') return 'Câu tả CƠ CHẾ/hấp thụ bên trong — cân nhắc cảnh 3D cơ chế?'
  return null
}

// FIX3 — the "🎬 cảnh quay gì" line must ALWAYS show (the user saw it appear on some cards, vanish
// on others). Prefer the VN gloss; fall back to the raw concept, then a kind-based label, then a
// role label for lips / proof cards — so a card is NEVER blank regardless of translation/derive state.
function conceptLineFor(s: TimedBrollScene, gloss?: string): string {
  if (gloss && gloss.trim()) return gloss.trim()
  if (s.role === 'lips') return 'Người nói trực tiếp (talking head)'
  if (s.role === 'social_proof') return 'Thẻ bằng chứng (review / đám đông)'
  const c = (s.conceptPrompt ?? '').trim()
  if (c) return c   // raw concept (English) — better than blank until the gloss lands
  switch (s.kind) {
    case 'product_closeup': return 'Cận cảnh sản phẩm'
    case 'product_action':  return 'Sản phẩm đang được dùng'
    case 'concept':         return 'Cảnh minh hoạ / cảm xúc'
    default:                return 'Cảnh sản phẩm'
  }
}

interface Props { onContinue?: () => void }

export default function HybridVideoPhase(_props: Props) {
  const state          = useAdsVideoStore((s) => s.state)
  const setHybridPlan  = useAdsVideoStore((s) => s.setHybridPlan)
  const setHybridClip  = useAdsVideoStore((s) => s.setHybridClip)
  const setSceneConceptPrompt = useAdsVideoStore((s) => s.setSceneConceptPrompt)
  const setHybridAssets= useAdsVideoStore((s) => s.setHybridCreatorAssets)
  const setHybridLipsHoldProduct = useAdsVideoStore((s) => s.setHybridLipsHoldProduct)
  const setAssetsGenStartedAt = useAdsVideoStore((s) => s.setAssetsGenStartedAt)
  const patchSceneRender = useAdsVideoStore((s) => s.patchSceneRender)
  const setHybridQueue = useAdsVideoStore((s) => s.setHybridQueue)
  const setProduct     = useAdsVideoStore((s) => s.setProduct)
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
  // P6x — VN gloss per scene quote (DISPLAY-ONLY, never used for audio/render). When the script
  // is MS/EN, batch-translate every scene's spoken line ONCE so the user can read what each cut
  // says. The render + voice always use scene.quote — this map only feeds the grey caption under it.
  const [sceneGloss, setSceneGloss] = useState<Record<number, string>>({})     // P6x — VN của THOẠI
  const [conceptGloss, setConceptGloss] = useState<Record<number, string>>({}) // P6z — VN "cảnh quay gì" (từ conceptPrompt cuối)
  const glossSigRef = useRef('')

  const sceneCredit = (s: TimedBrollScene): number => {
    // social_proof = ONE GPT-4o FB-post card image (generateSocialProofImage), NOT an
    // i2v clip — so it costs the keyframe image price (~6cr), not a Seedance video.
    // Billing it as 'video' over-reported every proof card by ~14-21cr (the chip, the
    // "Tạo tất cả" total, and the lost-credits banner were all inflated).
    if (s.role === 'social_proof') return V3_CREDIT_COST.keyframe
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
      // P4k — read voice data from the STORE (fresh). The director now runs AFTER
      // the voice (correct order), so use the REAL measured duration + alignment —
      // NOT the `hybrid` closure, which is stale right after makeVoice in the auto
      // pipeline. Falls back to the script estimate only if no voice exists yet.
      const h = useAdsVideoStore.getState().state.hybrid
      const voiceDur = h.voiceDurationSec ?? script.totalDurationSec ?? 50
      // P4i — give the director EYES: compute the product VISUAL BRIEF from the
      // photos ONCE (cached on product.visualBrief) so the text-only director can
      // picture the real form / hero parts / size / how it's used. Universal —
      // works for any product. Graceful: failure leaves text-only context.
      let product = state.inputs.product
      if (product && !product.visualBrief) {
        const brief = await generateProductVisualBrief(product, geminiKey)
        if (brief) { product = { ...product, visualBrief: brief }; setProduct(product) }
      }
      // P6i — ensure the localized product name is cached for this lang (script step usually
      // did it already → cached/instant), then feed the DIRECTOR the localized-name copy so
      // every conceptPrompt / PRODUCT LOCK / sticker uses the same spoken name as the script.
      if (product) {
        const ep = await ensureLocalizedName(product, state.scriptBrain.outputLang, geminiKey)
        if (ep !== product) { product = ep; setProduct(product) }
      }
      const res = await directBrollScenes({
        geminiKey, script, lang: state.scriptBrain.outputLang,
        product: applyLocalizedName(product, state.scriptBrain.outputLang), voiceDurationSec: voiceDur,
        shape: state.scriptBrain.shape,
        gift: state.gift,   // Phase A — closing cuts show the gift when enabled
      })
      const timed = assignSceneTiming(res.scenes, h.voiceAlignment, script, voiceDur)
      // P4g — brain pass over the deterministic filler cuts (split/density) so a
      // spoken line never renders as a generic product shot. Mutates `timed`.
      await groundOrphanScenes(timed, product, geminiKey)
      setHybridPlan(timed, res.scenes)
      setFailedIdx(new Set())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e); setError(msg); addToast(`Đạo diễn lỗi: ${msg.slice(0, 120)}`, 'error')
    } finally { setPlanning(false) }
  }

  // P4k — VOICE-FIRST. Make the real voice + keyframe ONLY (no timing/grounding):
  // the director now runs AFTER this, on the REAL measured duration + alignment, so
  // we no longer re-time here (the old flow planned on an ESTIMATE then re-timed +
  // re-grounded after the voice — a wasted Gemini call + janky scene shift). Returns
  // true on success. Guarded against double-charge by the persisted lock.
  const makeVoice = async (): Promise<boolean> => {
    if (!script) return false
    if (!kieApiKey) { addToast('Thiếu KIE key', 'error'); return false }
    if (!elevenLabsKey) { addToast('Thiếu ElevenLabs key', 'error'); return false }
    const avatar = state.inputs.avatar
    if (!avatar) { addToast('Cần chọn Avatar ở Bước 1', 'error'); return false }
    if (assetsGenRunning) { addToast('Đang tạo giọng + mặt rồi — đợi xong nhé', 'info'); return false }
    setAssetsBusy(true); setError('')
    ASSETS_GEN_ACTIVE = true             // P5h — this JS session owns the live gen
    setAssetsGenStartedAt(Date.now())   // persist "đang tạo" across nav (anti double-charge)
    try {
      const voiceCategory = state.scriptBrain.voiceCategory ?? matchVoiceForAvatar(avatar, state.scriptBrain.angle)
      const kf = await renderCreatorKeyframe({
        kieApiKey, elevenLabsApiKey: elevenLabsKey, config: state.creatorVideoConfig,
        // The PICKED voice (Bước 1) lives in inputs.voiceId — overrides the default.
        script, voiceCategory, voiceId: state.inputs.voiceId,
        lang: state.scriptBrain.outputLang,   // P6e — MY → TTS 1.15×, VN → 1.2×
        avatar, product: state.inputs.product, onStageUpdate: () => {},
        // P6av — also make KF-B (creator holding product) for product-mention lips (toggle, default ON).
        withProductKeyframe: state.hybrid.lipsHoldProduct !== false && !!state.inputs.product,
      })
      // P4m — record WHICH voice this was made with (the user's pick, '' = default)
      // so auto-run can detect a voice change and regenerate instead of serving a
      // stale cached voice (the "đổi giọng mà Bước 2 vẫn giọng cũ" bug).
      setHybridAssets({ keyframeRef: kf.keyframeRef, voiceRef: kf.voiceRef, voiceDurationSec: kf.voiceDurationSec, voiceAlignment: kf.voiceAlignment, voiceId: state.inputs.voiceId ?? '', keyframeProductRef: kf.keyframeProductRef })
      // P5j — feed the REAL measured voice back into the per-language syllable-rate
      // calibration so the Bước-1 "~Xs" estimate converges to the user's ACTUAL
      // ElevenLabs pace. The hybrid flow never did this (only the legacy ActionInserts
      // flow did), so the estimate could never self-correct here — the root reason the
      // Bước-1 number stayed far from the real voice. Works for both VN + MS.
      try {
        const spokenText = script.blocks.map((b) => b.text).join(' ')
        calibrateSyllableRate(spokenText, state.scriptBrain.outputLang, kf.voiceDurationSec)
      } catch { /* calibration is best-effort, never break the gen */ }
      addToast(`✓ Giọng (${kf.voiceDurationSec.toFixed(1)}s) + khuôn mặt — đang đạo diễn…`, 'success')
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e); setError(msg); addToast(`Tạo giọng/mặt lỗi: ${msg.slice(0, 120)}`, 'error')
      return false
    } finally {
      ASSETS_GEN_ACTIVE = false          // P5h — live gen done (success or fail)
      setAssetsBusy(false)
      setAssetsGenStartedAt(undefined)   // clear persisted lock (also runs if unmounted)
    }
  }

  // FIX C2 — regenerate ONLY the keyframe image(s) (KF-A + KF-B), REUSING the already-paid voice
  // (no new TTS, timing/alignment unchanged). For when the face/hands drift but the voice is fine.
  // Does NOT touch rendered clips — warns the user to re-render lips cuts so they match the new face.
  const makeKeyframeOnly = async (): Promise<void> => {
    if (!script) { addToast('Chưa có kịch bản', 'error'); return }
    if (!kieApiKey) { addToast('Thiếu KIE key', 'error'); return }
    const avatar = state.inputs.avatar
    if (!avatar) { addToast('Cần chọn Avatar ở Bước 1', 'error'); return }
    const h = state.hybrid
    if (!h.voiceRef) { addToast('Chưa có giọng — bấm "Tạo lại" (giọng + mặt) trước', 'info'); return }
    if (assetsGenRunning) { addToast('Đang tạo rồi — đợi xong nhé', 'info'); return }
    setAssetsBusy(true); setError('')
    ASSETS_GEN_ACTIVE = true
    setAssetsGenStartedAt(Date.now())
    try {
      const voiceCategory = state.scriptBrain.voiceCategory ?? matchVoiceForAvatar(avatar, state.scriptBrain.angle)
      const kf = await renderCreatorKeyframe({
        kieApiKey, elevenLabsApiKey: elevenLabsKey, config: state.creatorVideoConfig,
        script, voiceCategory, voiceId: state.inputs.voiceId,
        lang: state.scriptBrain.outputLang,
        avatar, product: state.inputs.product, onStageUpdate: () => {},
        withProductKeyframe: state.hybrid.lipsHoldProduct !== false && !!state.inputs.product,
        // Reuse the existing voice → keyframe-only, no TTS charge, timeline unchanged.
        reuseVoiceRef: h.voiceRef, reuseVoiceDurationSec: h.voiceDurationSec, reuseVoiceId: h.voiceId, reuseVoiceAlignment: h.voiceAlignment,
      })
      setHybridAssets({ keyframeRef: kf.keyframeRef, voiceRef: h.voiceRef, voiceDurationSec: h.voiceDurationSec ?? 0, voiceAlignment: h.voiceAlignment, voiceId: h.voiceId ?? '', keyframeProductRef: kf.keyframeProductRef })
      addToast('✓ Đã tạo lại ảnh khuôn mặt — render lại các cảnh lips để khớp mặt mới', 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e); setError(msg); addToast(`Tạo lại ảnh lỗi: ${msg.slice(0, 120)}`, 'error')
    } finally {
      ASSETS_GEN_ACTIVE = false
      setAssetsBusy(false)
      setAssetsGenStartedAt(undefined)
    }
  }

  // P4n — AUTO-RUN ONLY the voice + keyframe (0 Gemini — ElevenLabs + KIE). The
  // DIRECTOR (the Gemini-heavy step) is now a MANUAL button. Rationale: voice+frame
  // takes ~30-60s with ZERO Gemini calls, so by the time the user reads/clicks
  // "Đạo diễn", the Bước-1 hook/body calls have aged out of the 60s RPM window →
  // the director burst no longer stacks on top of them (far fewer rate-limit hits
  // on free keys). Auto-fires ONCE; re-voices if the picked voice changed (P4m);
  // skips while a gen is in flight (no double-charge).
  const autoRanRef = useRef(false)
  useEffect(() => {
    if (autoRanRef.current) return
    if (!kieApiKey || !elevenLabsKey) return        // voice needs KIE + ElevenLabs (not Gemini)
    const s = useAdsVideoStore.getState().state
    if (!s.inputs.avatar) return
    const h = s.hybrid
    const voiceStale = !!h.voiceRef && (h.voiceId ?? '') !== (s.inputs.voiceId ?? '')
    if (h.voiceRef && !voiceStale) { autoRanRef.current = true; return }   // voice already current → director is the user's manual click
    if (h.assetsGenStartedAt && Date.now() - h.assetsGenStartedAt < ASSETS_STALE_MS) return // gen in flight → don't double-fire
    autoRanRef.current = true
    void makeVoice()    // auto ONLY the voice + frame; user clicks "Đạo diễn" after
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kieApiKey, elevenLabsKey, script])

  const ctx = (): HybridRenderContext => ({
    kieApiKey, keyframeRef: hybrid.keyframeRef, keyframeProductRef: hybrid.keyframeProductRef, voiceRef: hybrid.voiceRef,
    // P6i — render with the localized-name copy so PRODUCT LOCK / social-proof card use the
    // same spoken name as the script (cached on the product by the script/director step).
    product: applyLocalizedName(state.inputs.product, state.scriptBrain.outputLang),
    avatar: state.inputs.avatar, creatorVideoConfig: state.creatorVideoConfig, resolution,
    lang: state.scriptBrain.outputLang,   // P5w — social-proof card text language
  })

  // P6x — batch-translate scene quotes → VN gloss (display-only). Runs once per distinct set of
  // quotes (sig guard) so a scene fix (changes conceptPrompt, not quote) never re-calls Gemini;
  // a re-direct (new quotes) refreshes it. Best-effort: Gemini down → no gloss, never blocks.
  useEffect(() => {
    const lang = state.scriptBrain.outputLang
    if (lang === 'vi' || scenes.length === 0 || !geminiKey) { setSceneGloss({}); setConceptGloss({}); return }
    const items = scenes.map((s) => ({ quote: s.quote ?? '', concept: (s.role === 'lips' || s.role === 'social_proof') ? '' : (s.conceptPrompt ?? '') }))
    const sig = `${lang}|${items.map((it) => it.quote + it.concept).join('')}`
    if (glossSigRef.current === sig) return
    glossSigRef.current = sig
    let cancelled = false
    void (async () => {
      try {
        const res = await glossScenesToVietnamese(geminiKey, items, lang)
        if (cancelled || res.length === 0) return
        const vmap: Record<number, string> = {}, cmap: Record<number, string> = {}
        res.forEach((r, i) => { if (r.voice) vmap[i] = r.voice; if (r.scene) cmap[i] = r.scene })
        setSceneGloss(vmap); setConceptGloss(cmap)
      } catch { /* best-effort gloss — never block the UI */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, state.scriptBrain.outputLang, geminiKey])

  // P3s — directly render a scene WITHOUT queue logic. Used internally by the
  // queue worker. Tracks lostCredits on failure so the user can see how much
  // KIE took on the failed attempt (it doesn't refund).
  // P4p — queue mutations go through here so the store mirror stays in sync (the
  // queue is persisted → survives a tab switch instead of vanishing).
  const setQueue = (updater: (q: number[]) => number[]) => {
    setQueuedIdx((q) => { const next = updater(q); setHybridQueue(next); return next })
  }

  const runRender = async (i: number) => {
    const hy = useAdsVideoStore.getState().state.hybrid
    const s = (hy.scenes ?? [])[i]
    if (!s) return
    // P4p — never double-render the same index: an old (pre-tab-switch) closure may
    // still be draining the queue while the remounted component re-drives it. Bail
    // only if this index is ALREADY rendering this session. (Do NOT bail on an
    // existing clip — that would block an intentional "Render lại" of a done scene.)
    if (ACTIVE_RENDERS.has(i)) return
    ACTIVE_RENDERS.add(i)                                   // P3z — this JS session owns it
    setRenderingIdx((set) => new Set(set).add(i))
    setFailedIdx((set) => { const n = new Set(set); n.delete(i); return n })
    setProgressByIdx((p) => ({ ...p, [i]: { pollCount: 0, elapsedSec: 0 } }))
    patchSceneRender(i, { startedAt: Date.now() })          // P3z — persist "đang render"
    try {
      const videoRef = await renderOneHybridScene(
        s,
        ctx(),
        undefined,
        // P3t — KIE poll progress → UI shows "poll #N · Ms" per card.
        (info) => setProgressByIdx((p) => ({ ...p, [i]: info })),
        // P3z — persist the Grok taskId so an F5 mid-render can re-poll (no recharge).
        (taskId) => patchSceneRender(i, { startedAt: Date.now(), taskId }),
      )
      setHybridClip(i, videoRef)
    } catch (e) {
      console.error(`[HYBRID_UI] cảnh ${i} lỗi:`, e)
      setFailedIdx((set) => new Set(set).add(i))
      // KIE keeps credits on failure → tally the loss for the visibility banner.
      setLostCredits((c) => c + sceneCredit(s))
      addToast(`Cảnh #${i + 1} lỗi: ${(e instanceof Error ? e.message : String(e)).slice(0, 100)}`, 'error')
    } finally {
      ACTIVE_RENDERS.delete(i)
      patchSceneRender(i, null)                             // P3z — clear persisted state
      setRenderingIdx((set) => { const n = new Set(set); n.delete(i); return n })
      setProgressByIdx((p) => { const n = { ...p }; delete n[i]; return n })
      // Pull the next queued scene (if any) right after a slot frees up.
      setQueue((q) => {
        if (q.length === 0) return q
        const [nextI, ...rest] = q
        // Defer the launch so React commits the state update first.
        setTimeout(() => { void runRender(nextI) }, 0)
        return rest
      })
    }
  }

  // P3z — resume a render that was in flight when the user navigated away / F5'd.
  // Re-polls the already-paid Grok task (resumeInsertVideo, no new charge) and
  // saves the clip. Only for broll scenes that had reached the Grok stage (taskId
  // persisted). Scenes without a taskId (lips, or interrupted mid-keyframe) can't
  // resume → cleared so the user sees an idle Render button (re-render).
  const resumeRender = async (i: number, taskId: string) => {
    ACTIVE_RENDERS.add(i)
    setRenderingIdx((set) => new Set(set).add(i))
    setProgressByIdx((p) => ({ ...p, [i]: { pollCount: 0, elapsedSec: 0 } }))
    try {
      const { videoRef } = await resumeInsertVideo({ kieApiKey, taskId, onStageUpdate: () => {} })
      setHybridClip(i, videoRef)
      addToast(`✓ Cảnh #${i + 1} đã khôi phục (không tốn thêm credit)`, 'success')
    } catch (e) {
      console.warn(`[HYBRID_UI] resume cảnh ${i} lỗi:`, e)
      setFailedIdx((set) => new Set(set).add(i))
    } finally {
      ACTIVE_RENDERS.delete(i)
      patchSceneRender(i, null)
      setRenderingIdx((set) => { const n = new Set(set); n.delete(i); return n })
      setProgressByIdx((p) => { const n = { ...p }; delete n[i]; return n })
    }
  }

  // P3z — on mount, recover any render that was in flight when the user left.
  // Runs once per mount (SPA-nav remount re-runs it, which is what we want).
  const resumedRef = useRef(false)
  useEffect(() => {
    if (resumedRef.current) return
    resumedRef.current = true
    const st = useAdsVideoStore.getState().state.hybrid
    // P5h — orphaned voice+face lock recovery. The store says a gen was running, but
    // no live promise owns it THIS session (ASSETS_GEN_ACTIVE=false) → it died on a
    // tab switch or an F5 reset the JS context. Clear the lock so "Tạo giọng + mặt" /
    // "Đạo diễn" re-enable immediately instead of greying out for the full 4-min stale
    // window. A gen still alive (SPA nav, same session) keeps the flag true → left
    // alone; it finishes + writes the store itself, and the UI heals via subscription.
    if (st.assetsGenStartedAt && !ASSETS_GEN_ACTIVE) {
      setAssetsGenStartedAt(undefined)
    }
    const persisted = st.renderingScenes ?? {}
    const now = Date.now()
    const restore: number[] = []
    for (const [idxStr, info] of Object.entries(persisted)) {
      const idx = Number(idxStr)
      // P6u — check the LIVE-this-session lock FIRST: during a "Render lại" the OLD clip still
      // exists while the new render runs; the old order treated that as "finished" and wiped the
      // in-flight tracking. A live render must always be left to finish itself.
      if (ACTIVE_RENDERS.has(idx)) { restore.push(idx); continue }       // SPA-nav: promise alive → it finishes itself
      if (st.clips[idx]) { patchSceneRender(idx, null); continue }       // already finished (no live render) → clear
      if (now - info.startedAt > RENDER_STALE_MS) { patchSceneRender(idx, null); continue }  // abandoned
      if (info.taskId) { restore.push(idx); void resumeRender(idx, info.taskId); continue }  // F5 broll → re-poll paid job
      patchSceneRender(idx, null)                                        // F5 lips/mid-keyframe: can't resume → idle button
    }
    if (restore.length) setRenderingIdx((set) => { const n = new Set(set); restore.forEach((i) => n.add(i)); return n })
    // P4p — restore the persisted bulk-render QUEUE + re-drive free slots so "Tạo
    // tất cả" keeps going after a tab switch instead of the queued cảnh treo mãi.
    // Drop indices already done / already rendering this session.
    const persistedQueue = (st.queuedScenes ?? []).filter((i) => !st.clips[i] && !ACTIVE_RENDERS.has(i))
    if (persistedQueue.length) {
      const freeSlots = Math.max(0, MAX_CONCURRENT_RENDERS - restore.length)
      const startNow = persistedQueue.slice(0, freeSlots)
      const stillQueued = persistedQueue.slice(freeSlots)
      setQueuedIdx(stillQueued); setHybridQueue(stillQueued)
      startNow.forEach((i) => setTimeout(() => { void runRender(i) }, 0))
    } else if ((st.queuedScenes ?? []).length) {
      setHybridQueue([])   // queue fully resolved while away
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // P4p — self-heal the local render UI from the STORE. When a render an OLD
  // (pre-tab-switch) closure owns finishes, it saves the clip + clears
  // renderingScenes on the store (cross-instance writes work) but cannot touch
  // THIS instance's renderingIdx → the card would spin forever. Reconcile: a scene
  // stops "rendering" once it has a clip, or once it's neither active nor persisted.
  useEffect(() => {
    const rs = hybrid.renderingScenes ?? {}
    const now = Date.now()
    setRenderingIdx((set) => {
      let changed = false
      const n = new Set(set)
      // P6ao — RECONCILE BOTH WAYS (was: prune-only, which was the root of two bugs).
      // ADD any scene that is GENUINELY in-flight but missing from local state — either
      // this session owns the promise (ACTIVE_RENDERS) or a FRESH persisted record exists
      // (renderingScenes, e.g. a render owned by an OLD/other closure after a tab-switch).
      // Without this ADD, a render driven by a non-current closure showed NO spinner +
      // kept the STALE old clip on screen ("chạy ẩn, preview sai, không load").
      for (const i of ACTIVE_RENDERS) if (!n.has(i)) { n.add(i); changed = true }
      for (const [k, info] of Object.entries(rs)) {
        const idx = Number(k)
        if (!n.has(idx) && now - info.startedAt < RENDER_STALE_MS) { n.add(idx); changed = true }
      }
      // PRUNE any scene the UI thinks is rendering but is neither live nor persisted
      // (a dead/ghost entry — these inflated the concurrency count + blocked new clicks).
      for (const i of set) if (!ACTIVE_RENDERS.has(i) && !rs[i]) { n.delete(i); changed = true }
      return changed ? n : set
    })
    setQueuedIdx((q) => {
      const n = q.filter((i) => !hybrid.clips[i])
      if (n.length === q.length) return q
      setHybridQueue(n)
      return n
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hybrid.clips, hybrid.renderingScenes])

  // P3s — user-facing render call. Enqueues if ≥MAX_CONCURRENT_RENDERS are in
  // flight (UI just shows "đang chờ" on that card); fires immediately otherwise.
  const renderScene = (i: number) => {
    if (!hasAssets) { addToast('Bấm "Tạo giọng + mặt" trước', 'error'); return }
    if (!kieApiKey) { addToast('Thiếu KIE key', 'error'); return }
    // P6u — a user "Render lại" is AUTHORITATIVE. Unless a render is genuinely LIVE this
    // session (renderingIdx — the button is hidden then anyway), wipe every stale leftover
    // for `i` BEFORE launching: the module lock (orphaned by a dead tab-switch promise), the
    // persisted in-flight record (an OLD taskId here is exactly what the mount-resume re-polls
    // and slaps the previous WRONG clip back — the "load 1 chút rồi trả cảnh cũ" bug), the
    // failed flag, and any duplicate queue entry. Now nothing can resurrect the old clip.
    // P6ao — "genuinely LIVE" = THIS session owns the promise (ACTIVE_RENDERS), the module
    // truth — NOT the local renderingIdx, which could be a stale ghost. If it's not truly live,
    // wipe every leftover (module lock, persisted taskId that the mount-resume would re-poll +
    // slap the OLD clip back, failed flag, dup queue entry) BEFORE launching.
    if (!ACTIVE_RENDERS.has(i)) {
      ACTIVE_RENDERS.delete(i)
      patchSceneRender(i, null)
      setFailedIdx((s) => { const n = new Set(s); n.delete(i); return n })
      setQueue((q) => q.filter((x) => x !== i))
    }
    // P6ao — gate on the REAL live count (ACTIVE_RENDERS, the module truth) not renderingIdx
    // (local state that drifts). A ghost in renderingIdx must never block a genuine click.
    if (ACTIVE_RENDERS.size < MAX_CONCURRENT_RENDERS) {
      void runRender(i)
      return
    }
    // Otherwise queue (dedupe: don't enqueue twice if user spam-clicks).
    setQueue((q) => (q.includes(i) ? q : [...q, i]))
  }

  const renderAll = () => {
    if (!hasAssets) { addToast('Bấm "Tạo giọng + mặt" trước', 'error'); return }
    if (!kieApiKey) { addToast('Thiếu KIE key', 'error'); return }
    const pending = scenes.map((_, i) => i).filter((i) => !hybrid.clips[i] && !renderingIdx.has(i) && !queuedIdx.includes(i))
    if (pending.length === 0) { addToast('Không còn cảnh chờ render', 'info'); return }
    addToast(`🎬 Render ${pending.length} cảnh (${MAX_CONCURRENT_RENDERS} song song)…`, 'info')
    // Fill the slots; queue the rest. The runRender finalizer drains the queue.
    // P6ao — slots from the REAL live count (ACTIVE_RENDERS), not the drift-prone local state.
    const slots = Math.max(0, MAX_CONCURRENT_RENDERS - ACTIVE_RENDERS.size)
    const immediate = pending.slice(0, slots)
    const queued = pending.slice(slots)
    if (queued.length) setQueue((q) => [...q, ...queued])
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
              {(assetsBusy || assetsGenRunning) ? 'Đang tạo giọng + khuôn mặt…'
                : planning ? 'Đang đạo diễn (chia cảnh theo giọng thật)…'
                : scenes.length > 0 ? `${scenes.length} cảnh · ${doneCount}/${scenes.length} đã render`
                : hasAssets ? 'Giọng đã sẵn — bấm "Đạo diễn" để chia cảnh'
                : 'Đang tạo giọng + khuôn mặt…'}
            </p>
            <p className="text-[11px] text-gray-500">Giọng tự tạo · Đạo diễn bấm tay (0 credit, đỡ dính rate-limit). Render 480p · Video cuối 720p.</p>
          </div>
          <button onClick={runPlan} disabled={busy || !hasAssets}
            title={!hasAssets ? 'Đợi giọng + mặt tạo xong (đang tự chạy)' : 'Chia kịch bản thành cảnh theo giọng (0 credit Gemini)'}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold shadow-sm disabled:opacity-50 ${
              hasAssets && scenes.length === 0
                ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white'   // primary call-to-action once voice is ready
                : 'border border-violet-300 bg-white text-violet-700 hover:bg-violet-50'
            }`}>
            {planning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {scenes.length > 0 ? 'Đạo diễn lại' : 'Đạo diễn'}
          </button>
          <button onClick={makeVoice} disabled={busy}
            title="Tạo lại giọng + khuôn mặt (tốn credit giọng). Đạo diễn bấm riêng sau."
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold shadow-sm disabled:opacity-50 ${hasAssets ? 'border border-emerald-300 bg-white text-emerald-700' : 'border border-amber-300 bg-white text-amber-700'}`}>
            {(assetsBusy || assetsGenRunning) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
            {hasAssets ? `Tạo lại giọng (~${ASSETS_CR}cr)` : `Tạo giọng + mặt (~${ASSETS_CR}cr)`}
          </button>
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
          <AssetsBar keyframeRef={hybrid.keyframeRef} keyframeProductRef={hybrid.keyframeProductRef}
            voiceRef={hybrid.voiceRef} voiceDurationSec={hybrid.voiceDurationSec} busy={busy}
            lipsHoldProduct={hybrid.lipsHoldProduct !== false} hasProduct={!!state.inputs.product}
            onRegen={makeVoice} onRegenKeyframe={makeKeyframeOnly} onToggleLips={setHybridLipsHoldProduct} />
        ) : scenes.length > 0 ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800">
            Chưa có giọng — bấm <strong>"Tạo giọng + mặt"</strong> để tạo khuôn mặt + giọng thật, rồi bấm <strong>"Đạo diễn"</strong> chia cảnh theo nhịp giọng.
          </div>
        ) : null}

        {/* ── Scene frames (9:16, render on frame) ──────────────────────────── */}
        {scenes.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {scenes.map((s, i) => (
              <SceneCard key={i} i={i} scene={s} clipRef={hybrid.clips[i]}
                rendering={renderingIdx.has(i)} queued={queuedIdx.includes(i)} failed={failedIdx.has(i)}
                progress={progressByIdx[i]} voiceUrl={masterVoiceUrl} gloss={sceneGloss[i]}
                conceptGloss={conceptGloss[i]} mismatch={suspectMismatch(s, i === scenes.length - 1)}
                credit={sceneCredit(s)} hasAssets={hasAssets}
                onRender={() => renderScene(i)}
                onSavePrompt={(prompt, plan) => setSceneConceptPrompt(i, prompt, plan)}
                onAiFix={(intent, targetIntent) => fixSceneConceptPrompt({
                  geminiKey, scene: s, product: state.inputs.product,
                  lang: state.scriptBrain.outputLang, fullScript: script, userIntent: intent, targetIntent,
                })} />
            ))}
          </div>
        )}

        {scenes.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-[12px] text-gray-400">
            {assetsBusy || assetsGenRunning || planning ? (
              <><Loader2 className="mx-auto mb-2 h-7 w-7 animate-spin text-violet-400" />
                {(assetsBusy || assetsGenRunning) ? 'Đang tạo giọng + khuôn mặt thật…' : 'Đang đạo diễn (chia cảnh theo giọng)…'} Giữ tab mở nhé.</>
            ) : hasAssets ? (
              <>
                <Sparkles className="mx-auto mb-2 h-7 w-7 text-violet-300" />
                <p className="mb-2">Giọng + khuôn mặt đã sẵn sàng. Bấm để AI chia kịch bản thành cảnh (0 credit Gemini):</p>
                <button onClick={runPlan} disabled={busy}
                  className="mx-auto flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50">
                  <Wand2 className="h-3.5 w-3.5" /> Đạo diễn (chia cảnh)
                </button>
              </>
            ) : (
              <>
                <Sparkles className="mx-auto mb-2 h-7 w-7 text-gray-300" />
                <p className="mb-2">App tự tạo giọng + khuôn mặt. Nếu chưa tự chạy, bấm để bắt đầu:</p>
                <button onClick={makeVoice} disabled={busy}
                  className="mx-auto flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50">
                  <Mic className="h-3.5 w-3.5" /> Tạo giọng + mặt (~{ASSETS_CR}cr)
                </button>
              </>
            )}
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
function AssetsBar({ keyframeRef, keyframeProductRef, voiceRef, voiceDurationSec, busy, lipsHoldProduct, hasProduct, onRegen, onRegenKeyframe, onToggleLips }: {
  keyframeRef?: string; keyframeProductRef?: string; voiceRef?: string; voiceDurationSec?: number
  busy: boolean; lipsHoldProduct: boolean; hasProduct: boolean
  onRegen: () => void; onRegenKeyframe: () => void; onToggleLips: (on: boolean) => void
}) {
  const faceUrl = useAssetUrl(keyframeRef ?? undefined)
  const prodFaceUrl = useAssetUrl(keyframeProductRef ?? undefined)   // P6av — KF-B (cầm sản phẩm)
  const voiceUrl = useAssetUrl(voiceRef ?? undefined)
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
      <div className="flex shrink-0 gap-1">
        <div className="h-16 w-16 overflow-hidden rounded-lg bg-gray-900" title="Mặt nói (KF-A)">
          {faceUrl && <img src={faceUrl} alt="creator" className="h-full w-full object-cover" />}
        </div>
        {/* P6av — KF-B thumbnail (creator holding the product) when the toggle is on. */}
        {lipsHoldProduct && hasProduct && (
          <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-emerald-300 bg-gray-900" title="Mặt cầm sản phẩm (KF-B) — dùng cho câu lips nhắc sản phẩm">
            {prodFaceUrl
              ? <img src={prodFaceUrl} alt="creator+product" className="h-full w-full object-cover" />
              : <div className="flex h-full w-full items-center justify-center px-1 text-center text-[8px] text-gray-400">KF cầm SP</div>}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-emerald-800">🎙 Giọng + khuôn mặt creator {voiceDurationSec ? `· ${voiceDurationSec.toFixed(1)}s` : ''}</p>
        <p className="mb-1 text-[10px] text-emerald-700/80">Nghe thử giọng + soi mặt. Sai thì "Tạo lại" trước khi render.</p>
        {voiceUrl && <audio src={voiceUrl} controls className="h-8 w-full max-w-md" />}
        {hasProduct && (
          <label className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700/90">
            <input type="checkbox" checked={lipsHoldProduct} disabled={busy} onChange={(e) => onToggleLips(e.target.checked)} />
            Lips kèm "cầm sản phẩm" (KF-B — bật/tắt rồi bấm Tạo lại)
          </label>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <button onClick={onRegen} disabled={busy}
          className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          title="Tạo lại CẢ giọng + ảnh khuôn mặt (làm lại từ đầu)">
          <RotateCcw className="h-3 w-3" /> Tạo lại
        </button>
        <button onClick={onRegenKeyframe} disabled={busy || !keyframeRef}
          className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          title="Chỉ tạo lại ẢNH khuôn mặt (giữ nguyên giọng) — dùng khi mặt/tay bị lỗi">
          <ImageIcon className="h-3 w-3" /> Tạo lại ảnh
        </button>
      </div>
    </div>
  )
}

// ── One scene = a 9:16 frame; render button ON the frame; clip plays in place ──
// P6t — AI scene-fixer ARCHETYPES (one compact dropdown). value maps to the director's own
// `shotIntent` spine (intent), so a manual fix and the auto-director speak ONE language. The
// optional `hint` is an extra English directive sent to the fixer ('ingredient' is a flavour
// of product_macro that shows the named raw ingredients as hero). '' = let AI infer.
const FIX_ARCHETYPES: { value: string; intent?: ShotIntent; label: string; hint?: string }[] = [
  { value: '',                                              label: '✨ Để AI tự chọn (mặc định)' },
  { value: 'problem',         intent: 'reaction',           label: '😣 Cảnh vấn đề / nỗi đau', hint: 'PROBLEM moment: the creator living the PROBLEM/pain in ONE concrete real-life moment — visibly uncomfortable. NOT resolved, NO smile, NO before/after split, NO product. A single problem shot only.' },
  { value: 'reaction',        intent: 'reaction',           label: '🧍 Người thật / cảm xúc' },
  { value: 'result_behavior', intent: 'result_behavior',    label: '🏃 Tận hưởng kết quả' },
  { value: 'product_demo',    intent: 'product_demo',       label: '🧴 Đang dùng sản phẩm' },
  { value: 'product_macro',   intent: 'product_macro',      label: '🔍 Cận sản phẩm / chi tiết' },
  { value: 'ingredient',      intent: 'product_macro',      label: '🌿 Nguyên liệu / thành phần', hint: 'INGREDIENT SHOWCASE: arrange the REAL raw ingredients named in the line (herbs/fruit/roots/spices) around the product as the hero, natural flat-lay, no face.' },
  { value: 'mechanism3d',     intent: 'mechanism3d',        label: '🧬 3D cơ chế' },
  { value: 'before_after',    intent: 'before_after',       label: '🔁 Trước / sau' },
  { value: 'social_proof',    intent: 'social_proof',       label: '🗯 Bằng chứng' },
  { value: 'offer',           intent: 'offer',              label: '🎁 Combo / quà (không tay)', hint: 'OFFER hero close-up: the product (and the free gift / extra units if any) on a clean premium surface — NO person, NO hands. A "deal worth grabbing" framing.' },
  { value: 'endorsement',     intent: 'endorsement',        label: '🛒 Creator cầm SP (kêu gọi mua)' },
]

function SceneCard({ i, scene, clipRef, rendering, queued, failed, progress, voiceUrl, gloss, conceptGloss, mismatch, credit, hasAssets, onRender, onSavePrompt, onAiFix }: {
  i: number; scene: TimedBrollScene; clipRef?: string; rendering: boolean; queued: boolean; failed: boolean
  progress?: { pollCount: number; elapsedSec: number }
  voiceUrl?: string
  gloss?: string   // P6x — VN translation of the quote (display-only, never rendered)
  conceptGloss?: string   // P6z — VN "cảnh quay gì" (từ conceptPrompt cuối, display-only)
  mismatch?: string | null   // P6z — cờ nghi lệch deterministic (display-only)
  credit: number; hasAssets: boolean; onRender: () => void
  onSavePrompt: (prompt: string, plan?: { kind?: TimedBrollScene['kind']; cameraFraming?: 'creator' | 'hands_noface'; shotIntent?: ShotIntent }) => void
  onAiFix: (intent: string, targetIntent?: ShotIntent) => Promise<SceneFix>
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
  const canEditPrompt = scene.role !== 'lips' && scene.role !== 'social_proof'
  const [editing, setEditing] = useState(false)
  const [draftPrompt, setDraftPrompt] = useState(scene.conceptPrompt ?? '')
  useEffect(() => { setDraftPrompt(scene.conceptPrompt ?? '') }, [scene.conceptPrompt])
  const promptDirty = draftPrompt.trim() !== (scene.conceptPrompt ?? '').trim()
  // P6a — AI scene-fixer state. `aiPlan` holds the kind/cameraFraming the fixer
  // chose alongside the prompt, so saving applies all three together (the prompt
  // never fights the framing). Cleared on Huỷ. chips + note feed the fixer's intent.
  const [aiArch, setAiArch] = useState('')   // P6t — chosen archetype (maps to shotIntent)
  const [aiNote, setAiNote] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState('')
  const [aiPlan, setAiPlan] = useState<{ kind?: TimedBrollScene['kind']; cameraFraming?: 'creator' | 'hands_noface'; shotIntent?: ShotIntent } | null>(null)
  const runAiFix = async () => {
    setAiBusy(true); setAiErr('')
    try {
      const arch = FIX_ARCHETYPES.find((a) => a.value === aiArch)
      const intent = [
        arch?.hint ?? '',
        aiNote.trim() ? `User note: ${aiNote.trim()}` : '',
      ].filter(Boolean).join('\n')
      const fix = await onAiFix(intent, arch?.intent)
      setDraftPrompt(fix.conceptPrompt)
      setAiPlan({ kind: fix.kind, cameraFraming: fix.cameraFraming, shotIntent: fix.shotIntent })
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : String(e))
    } finally { setAiBusy(false) }
  }
  const resetEdit = () => {
    setEditing(false); setDraftPrompt(scene.conceptPrompt ?? '')
    setAiArch(''); setAiNote(''); setAiErr(''); setAiPlan(null)
  }
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
        {/* P4q — rendering/queued takes PRECEDENCE over the old clip: clicking
            "Render lại" must immediately CLEAR the old preview + show the spinner
            so the user sees the render actually started (before it only swapped
            after the new clip saved → looked like nothing happened). */}
        {rendering ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex flex-col items-center gap-1 text-violet-300">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-[10px]">đang render…</span>
              {progress && (
                <span className="text-[9px] text-violet-200/80">
                  poll #{progress.pollCount} · {progress.elapsedSec}s
                </span>
              )}
            </div>
          </div>
        ) : queued ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex flex-col items-center gap-1 text-amber-300">
              <Loader2 className="h-6 w-6 animate-pulse" /> <span className="text-[10px]">đang chờ…</span>
            </div>
          </div>
        ) : done ? (
          scene.role === 'social_proof' ? (
            // P5w — social-proof is a STATIC FB-card IMAGE, not a video; show it as <img>
            // (a video tag stays blank on an image → the "bấm play không ra ảnh" bug).
            <img src={url} alt="" className="h-full w-full object-contain" />
          ) : (
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
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <button onClick={onRender} disabled={!hasAssets}
              className="flex flex-col items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-3 text-white shadow-lg hover:bg-violet-700 disabled:opacity-40">
              <Play className="h-5 w-5 fill-white" />
              <span className="text-[12px] font-bold">Render</span>
              <span className="text-[10px] text-white/80">~{credit}cr</span>
            </button>
          </div>
        )}
        {/* overlays */}
        <div className="pointer-events-none absolute left-1 top-1 flex items-center gap-1">
          <span className="rounded bg-black/60 px-1 text-[9px] font-bold text-white">#{i + 1}</span>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${badge.cls}`}>{badge.label}</span>
          {/* P6m (P1) — Gemini's declared shot intent, for auditing the refactor (display only). */}
          {scene.shotIntent && <span className="rounded bg-violet-900/70 px-1 text-[8px] font-semibold text-violet-200">{scene.shotIntent}</span>}
          {/* P6av — flag a lips cut that the director picked to render from KF-B (creator HOLDING the product). */}
          {scene.role === 'lips' && scene.lipsHoldsProduct && (
            <span className="rounded bg-amber-500/90 px-1 text-[8px] font-bold text-white" title="Cảnh lips này render từ keyframe creator ĐANG CẦM sản phẩm (KF-B)">🧴 cầm SP</span>
          )}
        </div>
        <span className="pointer-events-none absolute right-1 top-1 rounded bg-black/60 px-1 text-[9px] text-white/90">{scene.startSec.toFixed(1)}-{scene.endSec.toFixed(1)}s</span>
        {scene.cameraFraming === 'hands_noface' && <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[8px] text-white/80">no-face</span>}
        {done && !rendering && !queued && <span className="absolute right-1 bottom-1 rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">✓</span>}
        {failed && !rendering && !queued && <span className="absolute right-1 bottom-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">✗</span>}
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
        {/* P6x — VN gloss dưới câu Mã: CHỈ để hiểu, KHÔNG dùng cho audio/render */}
        {gloss && (
          <p className="text-[12px] font-medium leading-snug text-gray-600 line-clamp-3" title="Dịch thoại để hiểu — không dùng cho video">
            🇻🇳 {gloss}
          </p>
        )}
        {/* P6z + FIX3 — "Cảnh quay gì" LUÔN hiển thị (gloss → concept thô → nhãn theo loại), không bao giờ trống. */}
        <p className="text-[12px] font-medium leading-snug text-sky-700 line-clamp-3" title="Cảnh sẽ quay (giải nghĩa từ prompt) — so với thoại ở trên xem có khớp không">
          🎬 {conceptLineFor(scene, conceptGloss)}
        </p>
        {/* P6z — cờ nghi lệch (heuristic, không tự sửa) → bấm "Nhờ AI sửa" nếu đúng là lệch. */}
        {mismatch && (
          <p className="rounded bg-amber-50 px-1.5 py-1 text-[11px] font-semibold leading-snug text-amber-700" title="Cảnh báo tự động — không tự sửa. Kiểm tra rồi bấm Nhờ AI sửa nếu lệch thật.">
            ⚠ Nghi lệch: {mismatch}
          </p>
        )}
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
          <div className="flex flex-col gap-1.5 rounded-md border border-violet-200 bg-violet-50 p-1.5">
            {/* P6a — AI sửa cảnh: chip ý muốn + ghi chú → AI viết lại prompt vào ô dưới.
                Sửa MỘT cảnh, không re-run đạo diễn (giữ nguyên các cảnh khác). */}
            <div className="flex flex-col gap-1 rounded border border-violet-200/70 bg-white/70 p-1.5">
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-violet-700">
                <Sparkles className="h-2.5 w-2.5" /> AI sửa cảnh sai
              </span>
              <select value={aiArch} onChange={(e) => {
                  const v = e.target.value
                  setAiArch(v)
                  // P6ap — apply the archetype's LOCK (kind + face/no-face framing) to the scene
                  // IMMEDIATELY on pick, even before "Nhờ AI sửa" — so the choice has effect right
                  // away (🔍 cận/🌿 nguyên liệu/🧬 3D → no creator; 🧍 cảm xúc/🏃 kết quả/🔁 trước-sau →
                  // có creator). Keeps the current conceptPrompt; the user can still run AI fix to
                  // rewrite the text to match. '' (để AI tự chọn) applies no lock.
                  const arch = FIX_ARCHETYPES.find((a) => a.value === v)
                  if (arch?.intent) onSavePrompt(scene.conceptPrompt ?? '', { ...planForIntent(arch.intent), shotIntent: arch.intent })
                }}
                title="Chọn kiểu cảnh đúng — khoá mặt/sản phẩm áp dụng NGAY; bấm Nhờ AI sửa để AI viết lại prompt cho khớp"
                className="w-full rounded border border-violet-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-gray-700 focus:border-violet-400 focus:outline-none">
                {FIX_ARCHETYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <input value={aiNote} onChange={(e) => setAiNote(e.target.value)}
                placeholder="Tả thêm ý muốn (vd: creator ngửi miếng dán rồi cười) — bỏ trống cũng được"
                className="w-full rounded border border-violet-200 bg-white px-1.5 py-1 text-[10px] text-gray-700 focus:border-violet-400 focus:outline-none" />
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] text-gray-400">Chọn kiểu (khoá mặt/SP áp ngay) → Nhờ AI sửa (viết lại prompt) → Lưu → Render lại</span>
                <button type="button" onClick={runAiFix} disabled={aiBusy}
                  className="flex items-center gap-0.5 rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-violet-700 disabled:opacity-40">
                  {aiBusy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Wand2 className="h-2.5 w-2.5" />} {aiBusy ? 'Đang sửa…' : 'Nhờ AI sửa'}
                </button>
              </div>
              {aiErr && <span className="text-[9px] text-rose-600">⚠ {aiErr}</span>}
              {aiPlan && !aiErr && <span className="text-[9px] text-emerald-600">✓ AI đã viết lại ({aiPlan.shotIntent} · {aiPlan.cameraFraming === 'creator' ? 'có mặt' : 'chỉ tay'}). Xem ô dưới, sửa thêm nếu cần rồi Lưu.</span>}
            </div>
            <textarea value={draftPrompt} onChange={(e) => setDraftPrompt(e.target.value)}
              rows={4} placeholder="Mô tả CỤ THỂ visual: action + sản phẩm + setting. Tránh từ trừu tượng."
              className="w-full resize-none rounded border border-violet-200 bg-white p-1.5 text-[10px] leading-tight text-gray-700 focus:border-violet-400 focus:outline-none" />
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] text-violet-600/80">Lưu rồi bấm "Render lại" để dùng prompt mới</span>
              <div className="flex gap-1">
                <button onClick={resetEdit}
                  className="flex items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-gray-600 hover:bg-gray-50">
                  <X className="h-2.5 w-2.5" /> Huỷ
                </button>
                <button onClick={() => { onSavePrompt(draftPrompt.trim(), aiPlan ?? undefined); setEditing(false); setAiErr(''); setAiPlan(null); setAiArch(''); setAiNote('') }}
                  disabled={!promptDirty && !aiPlan}
                  className="flex items-center gap-0.5 rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-violet-700 disabled:opacity-40">
                  <Save className="h-2.5 w-2.5" /> Lưu
                </button>
              </div>
            </div>
          </div>
        )}

        {(done || failed) && !rendering && !queued && (
          <button onClick={() => {
            // Auto-save an unsaved prompt edit so "Render lại" ALWAYS uses the new
            // prompt (before, an edit that wasn't "Lưu"-ed first was silently lost).
            // P6a — also carry the AI fixer's kind/cameraFraming so a not-yet-saved
            // AI fix re-renders with the right framing (not just the prompt text).
            if (promptDirty || aiPlan) onSavePrompt(draftPrompt.trim(), aiPlan ?? undefined)
            setEditing(false); setAiPlan(null); setAiErr('')
            onRender()
          }}
            className={`mt-auto flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${failed ? 'border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
            <RotateCcw className="h-3 w-3" /> Render lại ~{credit}cr
          </button>
        )}
      </div>
    </div>
  )
}
