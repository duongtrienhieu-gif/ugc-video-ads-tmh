// ── Mode 3 — Xưởng Nhân Vật Hoá 3D — Simulator (P1, text-only) ────────────────
// Pick sản phẩm → phân tích insight → chọn Kiểu kịch bản + cấu hình → sinh
// Storyboard + Full-text Voice Script SONG NGỮ + ước credit. CHƯA render ảnh/video.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Loader2, AlertCircle, RefreshCw, Wand2 } from 'lucide-react'
import { useBankStore } from '../../stores/bankStore'
import { useSettingsStore } from '../../stores/settingsStore'
import {
  type TargetMarket, type PersonifiedConfig, type ProductInsight,
  type PersonifiedScript, type PersonifiedScene, type PersonifiedCharacter, type ArchetypeId, type HeroType, type CtaStyle, type VideoLength,
  TARGET_MARKET_LABEL,
} from './types'
import {
  ARCHETYPES, ARCHETYPE_ORDER, HERO_TYPE_LABEL, HERO_TYPE_DESC, FALSE_SOLUTION_DESC,
  CTA_STYLE_LABEL, LENGTH_LABEL, LENGTH_TARGET_SEC, SCENE_TYPE_LABEL, RENDER_TIER_LABEL, type RenderTier,
  estimateProjectCredits, formatCreditEstimate, pickClipDuration, estimateSpeechSec, playbackWps,
} from './constants'
import { analyzeInsight, generateScript } from './services/personifiedBrain'
import { renderKeyframe, renderClipFromKeyframe, renderCharacterRef, addSceneVoiceover } from './services/personifiedRenderer'   // P2a/P2b/P2c (cũng đăng ký dev helper __testRenderScene)
import { assemblePersonifiedVideo } from './services/personifiedAssembler'   // P2d
import { useAssetUrl } from '../../hooks/useAssetUrl'

// P2a — trạng thái render 1 cảnh (persist cùng kịch bản).
// CỔNG DUYỆT: kf (đang tạo ảnh) → kf_ready (xem ảnh, duyệt) → clip (đang i2v) → done.
interface SceneRender {
  status: 'idle' | 'kf' | 'kf_ready' | 'clip' | 'done' | 'failed'
  keyframeRef?: string
  clipRef?: string
  taskId?: string
  error?: string
  // P2c — lồng giọng (TTS → ghép voiceover vào clip). Sau khi clip i2v 'done', cảnh có thoại.
  //   lipsyncRef = clip ĐÃ CÓ GIỌNG (tên field giữ nguyên cho gọn). mux = đang ghép ffmpeg.
  lipStatus?: 'idle' | 'tts' | 'mux' | 'done' | 'failed'
  audioRef?: string
  lipsyncRef?: string
  lipError?: string
}

// P2b — Character Bank: ảnh chân dung chuẩn mỗi nhân vật (render 1 lần, khóa diện mạo
// xuyên cảnh). Keyed theo character.name. Persist cùng kịch bản.
interface CharRef {
  status: 'idle' | 'rendering' | 'done' | 'failed'
  refImage?: string
  error?: string
}

const DEFAULT_CONFIG: PersonifiedConfig = {
  archetype: 'KB1_invader', length: 'medium', heroType: 'product_knight',
  falseSolution: true, ctaStyle: 'villain_flees',
}

// Persist toàn bộ input + kết quả vào localStorage → chuyển tab mode (unmount) /
// F5 không mất việc. KHÔNG lưu cờ loading (analyzing/generating) — chúng là transient.
const CACHE_KEY = 'personified-state-v1'
interface PersistedState {
  v: 1
  productId: string
  market: TargetMarket
  problemHint: string
  insight: ProductInsight | null
  config: PersonifiedConfig
  script: PersonifiedScript | null
  variant: number
  tier: RenderTier
  clips?: Record<number, SceneRender>
  charBank?: Record<string, CharRef>
  finalVideoRef?: string
}

export default function Personified() {
  const products = useBankStore((s) => s.products)
  const geminiKey = useSettingsStore((s) => s.geminiApiKey)
  const kieKey = useSettingsStore((s) => s.kieApiKey)
  const elevenKey = useSettingsStore((s) => s.elevenLabsApiKey)   // P2c — TTS giọng nhân vật

  const [productId, setProductId] = useState('')
  const [market, setMarket] = useState<TargetMarket>('MY')
  const [problemHint, setProblemHint] = useState('')

  const [insight, setInsight] = useState<ProductInsight | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [config, setConfig] = useState<PersonifiedConfig>(DEFAULT_CONFIG)

  const [script, setScript] = useState<PersonifiedScript | null>(null)
  const [generating, setGenerating] = useState(false)
  const [variant, setVariant] = useState(0)

  const [tier, setTier] = useState<RenderTier>('seedance480')   // P2 — mặc định 480p (đẹp+rẻ, upscale 720p khi ghép)
  const [error, setError] = useState('')
  // C — kịch bản hiển thị dạng tab + bảng cảnh dày (bỏ scroll dài / cột voice trùng).
  const [scriptTab, setScriptTab] = useState<'table' | 'read' | 'chars'>('table')
  const [expandedScene, setExpandedScene] = useState<number | null>(null)
  // P2a — clip đã render mỗi cảnh (keyed theo scene.idx), persist cùng kịch bản.
  const [clips, setClips] = useState<Record<number, SceneRender>>({})
  const [renderingAll, setRenderingAll] = useState(false)
  // P2b — Character Bank (keyed theo character.name).
  const [charBank, setCharBank] = useState<Record<string, CharRef>>({})
  const [bankRunning, setBankRunning] = useState(false)
  // P2d — video cuối (ghép + upscale 720p).
  const [finalVideo, setFinalVideo] = useState<{ status: 'idle' | 'running' | 'done' | 'failed'; videoRef?: string; stage?: string; error?: string }>({ status: 'idle' })
  // Keyframe đang render dở lúc F5 → tự nối lại (chỉ keyframe, rẻ). idx gom khi restore.
  const kfResume = useRef<number[]>([])
  // Clip i2v đang chạy lúc F5 → NỐI LẠI job đã trả tiền (poll taskId, 0 credit thêm).
  const clipResume = useRef<{ idx: number; taskId: string }[]>([])
  // Xem to (lightbox) ảnh keyframe / video clip khi bấm thumbnail.
  const [zoom, setZoom] = useState<{ isVideo: boolean; ref: string } | null>(null)

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId])
  // P2a — ảnh sản phẩm để khóa fidelity (cảnh hasProduct).
  const productRefs = useMemo(() => {
    if (!product) return [] as string[]
    return (product.productImages?.length ? product.productImages : (product.productImage ? [product.productImage] : []))
      .filter((r): r is string => !!r && r.trim() !== '')
  }, [product])
  const credit = useMemo(
    () => script ? estimateProjectCredits(script.scenes, tier, script.characters.length) : null,   // KIE: bank + keyframe + i2v (giọng = ElevenLabs, ví riêng)
    [script, tier],
  )
  // P2a — số cảnh đã duyệt keyframe (sẵn sàng i2v) → bật nút "Clip tất cả".
  const kfReadyCount = useMemo(() => Object.values(clips).filter((c) => c.status === 'kf_ready').length, [clips])
  // P2c — số cảnh đã có clip + có thoại + chưa lồng giọng → bật nút "Lồng giọng tất cả".
  const lipReadyCount = useMemo(() => {
    if (!script) return 0
    return script.scenes.filter((s) => clips[s.idx]?.clipRef && (s.dialoguePrimary ?? '').trim() && clips[s.idx]?.lipStatus !== 'done').length
  }, [script, clips])
  // P2d — số cảnh đã có clip (để ghép). Bằng tổng cảnh = đủ; ít hơn = ghép phần đã render.
  const clipCount = useMemo(() => script ? script.scenes.filter((s) => clips[s.idx]?.clipRef).length : 0, [script, clips])

  const noKey = !geminiKey
  const isVN = market === 'VN'

  // ── Persistence: restore once on mount ────────────────────────────────────
  const hydrated = useRef(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const s = JSON.parse(raw) as Partial<PersistedState>
        if (s.v === 1) {
          if (s.productId) setProductId(s.productId)
          if (s.market) setMarket(s.market)
          if (s.problemHint) setProblemHint(s.problemHint)
          if (s.insight) setInsight(s.insight)
          if (s.config) {
            // Sanitize: cache cũ có thể chứa heroType/ctaStyle đã bỏ → rơi về default.
            const c = s.config
            setConfig({
              ...DEFAULT_CONFIG, ...c,
              heroType: HERO_TYPE_LABEL[c.heroType] ? c.heroType : DEFAULT_CONFIG.heroType,
              ctaStyle: CTA_STYLE_LABEL[c.ctaStyle] ? c.ctaStyle : DEFAULT_CONFIG.ctaStyle,
            })
          }
          if (s.script) setScript(s.script)
          if (typeof s.variant === 'number') setVariant(s.variant)
          if (s.tier) setTier(s.tier)
          if (s.clips) {
            // Sanitize trạng thái transient (đang render lúc F5) → trạng thái ổn định:
            //   kf đang chạy → idle (chưa có ảnh) hoặc kf_ready (đã có ảnh); clip đang chạy → kf_ready.
            const fixed: Record<number, SceneRender> = {}
            const kfQ: number[] = []
            const clipQ: { idx: number; taskId: string }[] = []
            for (const [k, v] of Object.entries(s.clips)) {
              let nv: SceneRender = v
              // keyframe đang render dở (chưa có ảnh) lúc F5 → 'idle' + gom để TỰ NỐI LẠI (rẻ).
              if (v.status === 'kf') { nv = { ...nv, status: v.keyframeRef ? 'kf_ready' : 'idle' }; if (!v.keyframeRef) kfQ.push(+k) }
              // clip i2v đang chạy: có taskId → giữ 'clip' + NỐI LẠI poll (0 credit); chưa có → về kf_ready.
              else if (v.status === 'clip') {
                if (v.taskId) clipQ.push({ idx: +k, taskId: v.taskId })
                else nv = { ...nv, status: v.keyframeRef ? 'kf_ready' : 'idle' }
              }
              // lồng giọng đang chạy lúc F5 → reset về done (đã có) / undefined (chưa) để bấm lại.
              if (v.lipStatus === 'tts' || v.lipStatus === 'mux') nv = { ...nv, lipStatus: v.lipsyncRef ? 'done' : undefined }
              fixed[+k] = nv
            }
            setClips(fixed)
            kfResume.current = kfQ
            clipResume.current = clipQ
          }
          if (s.charBank) {
            // Sanitize: nhân vật đang render lúc F5 → idle (chưa có ảnh) hoặc done (đã có).
            const fixedBank: Record<string, CharRef> = {}
            for (const [k, v] of Object.entries(s.charBank)) {
              fixedBank[k] = v.status === 'rendering' ? { ...v, status: v.refImage ? 'done' : 'idle' } : v
            }
            setCharBank(fixedBank)
          }
          if (s.finalVideoRef) setFinalVideo({ status: 'done', videoRef: s.finalVideoRef })
        }
      }
    } catch { /* ignore corrupt cache */ }
    hydrated.current = true
  }, [])

  // ── Persistence: save on meaningful change (skip until hydrated to avoid
  //    overwriting the restore with the initial empty state) ─────────────────
  useEffect(() => {
    if (!hydrated.current) return
    // Skip the initial empty commit (right after restore the closure still holds the
    // pre-restore empty state) — never overwrite a good cache with nothing.
    if (!productId && !insight && !script && !problemHint) return
    try {
      const s: PersistedState = { v: 1, productId, market, problemHint, insight, config, script, variant, tier, clips, charBank, finalVideoRef: finalVideo.videoRef }
      localStorage.setItem(CACHE_KEY, JSON.stringify(s))
    } catch { /* quota / serialization — non-fatal */ }
  }, [productId, market, problemHint, insight, config, script, variant, tier, clips, charBank, finalVideo.videoRef])

  // F5-resume: nối lại render đang dở khi reload. Keyframe → render lại (rẻ). Clip i2v →
  // POLL LẠI job đã trả tiền (resumeTaskId, 0 credit thêm). Chạy 1 lần khi có script + key.
  useEffect(() => {
    if (!hydrated.current || !script || !kieKey) return
    if (kfResume.current.length) {
      const ids = kfResume.current
      kfResume.current = []
      ids.forEach((idx) => {
        const sc = script.scenes.find((s) => s.idx === idx)
        if (sc && !clips[idx]?.keyframeRef) void handleRenderKeyframe(sc)
      })
    }
    if (clipResume.current.length) {
      const jobs = clipResume.current
      clipResume.current = []
      jobs.forEach(({ idx, taskId }) => {
        const sc = script.scenes.find((s) => s.idx === idx)
        if (sc && !clips[idx]?.clipRef) void handleRenderClip(sc, taskId)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, kieKey])

  async function handleAnalyze() {
    if (!product || analyzing) return
    setError(''); setAnalyzing(true); setInsight(null); setScript(null)
    try {
      const ins = await analyzeInsight(product, market, problemHint, geminiKey)
      setInsight(ins)
      // AI gợi ý cả 3: kiểu kịch bản + dạng hero + kiểu CTA → auto-chọn (user vẫn đổi được).
      setConfig((c) => ({
        ...c,
        archetype: ins.recommendedArchetype,
        heroType: ins.recommendedHeroType ?? c.heroType,
        ctaStyle: ins.recommendedCtaStyle ?? c.ctaStyle,
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Phân tích lỗi')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleGenerate(nextVariant: number) {
    if (!product || !insight || generating) return
    setError(''); setGenerating(true)
    try {
      const sc = await generateScript(product, market, config, insight, geminiKey, nextVariant)
      setScript(sc); setVariant(nextVariant); setClips({}); setCharBank({}); setFinalVideo({ status: 'idle' })   // kịch bản mới → bỏ clip + bank + video cũ
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tạo kịch bản lỗi')
    } finally {
      setGenerating(false)
    }
  }

  // #2 — cho phép SỬA kịch bản: cập nhật thoại 1 cảnh → tính lại clip/credit + full voice script,
  // ghi thẳng vào state (đã persist localStorage) → bước render (P2) sẽ nhận đúng bản đã sửa.
  function updateScene(idx: number, patch: Partial<PersonifiedScene>) {
    setScript((prev) => {
      if (!prev) return prev
      const scenes = prev.scenes.map((s) => {
        if (s.idx !== idx) return s
        const next = { ...s, ...patch }
        if (patch.dialoguePrimary !== undefined) {
          const sp = estimateSpeechSec(next.dialoguePrimary || next.dialogueVi || '', playbackWps(market))
          next.clipDuration = pickClipDuration(sp)
        }
        return next
      })
      return {
        ...prev, scenes,
        fullVoiceScriptPrimary: scenes.map((s) => s.dialoguePrimary).filter(Boolean).join('\n'),
        fullVoiceScriptVi: scenes.map((s) => s.dialogueVi).filter(Boolean).join('\n'),
        totalSec: scenes.reduce((sum, s) => sum + s.clipDuration, 0),
      }
    })
  }

  // P2b — render CHARACTER SHEET 1 nhân vật → Character Bank (khóa diện mạo xuyên cảnh).
  async function handleRenderCharacterRef(character: PersonifiedCharacter) {
    if (!kieKey) { setError('Thiếu KIE API key trong Cài đặt'); return }
    if (charBank[character.name]?.status === 'rendering') return
    setCharBank((p) => ({ ...p, [character.name]: { status: 'rendering' } }))
    try {
      // Hero = SP nhân cách hóa → khóa bao bì thật bằng ảnh sản phẩm (chống drift màu/nhãn).
      const isProductHero = character.role === 'hero'
      const { refImage } = await renderCharacterRef({
        apiKey: kieKey, character,
        productRefs: isProductHero ? productRefs : [],
      })
      setCharBank((p) => ({ ...p, [character.name]: { status: 'done', refImage } }))
    } catch (e) {
      setCharBank((p) => ({ ...p, [character.name]: { status: 'failed', error: e instanceof Error ? e.message : String(e) } }))
    }
  }

  // P2b — render bank cho TẤT CẢ nhân vật chưa có (tuần tự). Làm trước khi render cảnh.
  async function handleRenderAllChars() {
    if (!script || bankRunning) return
    if (!kieKey) { setError('Thiếu KIE API key trong Cài đặt'); return }
    setBankRunning(true)
    try {
      for (const c of script.characters) {
        if (charBank[c.name]?.status === 'done') continue
        await handleRenderCharacterRef(c)
      }
    } finally { setBankRunning(false) }
  }

  // P2a — BƯỚC 1: render keyframe (ảnh tĩnh, rẻ) để DUYỆT trước i2v. → status 'kf_ready'.
  //   Nếu nhân vật đã có ảnh trong Character Bank → truyền làm ref khóa diện mạo (P2b).
  async function handleRenderKeyframe(scene: PersonifiedScene) {
    if (!script) return
    if (!kieKey) { setError('Thiếu KIE API key trong Cài đặt'); return }
    if (clips[scene.idx]?.status === 'kf' || clips[scene.idx]?.status === 'clip') return
    const character = script.characters.find((c) => c.name === scene.speaker || c.role === scene.speaker) ?? script.characters[0]
    setClips((p) => ({ ...p, [scene.idx]: { status: 'kf' } }))
    try {
      const { keyframeRef } = await renderKeyframe({
        apiKey: kieKey, scene, character,
        characterRef: character ? charBank[character.name]?.refImage : undefined,
        productRefs: scene.hasProduct ? productRefs : [],
        worldEnv: script.worldEnv,
      })
      setClips((p) => ({ ...p, [scene.idx]: { status: 'kf_ready', keyframeRef } }))
    } catch (e) {
      setClips((p) => ({ ...p, [scene.idx]: { status: 'failed', error: e instanceof Error ? e.message : String(e) } }))
    }
  }

  // P2a — BƯỚC 2: i2v từ keyframe ĐÃ DUYỆT (tốn credit). resumeTaskId = nối lại job sau F5.
  async function handleRenderClip(scene: PersonifiedScene, resumeTaskId?: string) {
    if (!script) return
    if (!kieKey) { setError('Thiếu KIE API key trong Cài đặt'); return }
    const cur = clips[scene.idx]
    if (!resumeTaskId && !cur?.keyframeRef) { setError('Cảnh này chưa có keyframe — tạo keyframe trước'); return }
    if (!resumeTaskId && cur?.status === 'clip') return
    setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], status: 'clip' } }))
    try {
      const { clipRef, taskId } = await renderClipFromKeyframe({
        apiKey: kieKey, scene, tier, keyframeRef: cur?.keyframeRef, resumeTaskId,
        // Lưu taskId NGAY sau submit → F5 vẫn poll lại được (không trả tiền lần 2).
        onSubmit: (tid) => setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], status: 'clip', taskId: tid } })),
      })
      setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], status: 'done', clipRef, taskId } }))
    } catch (e) {
      setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], status: 'kf_ready', error: e instanceof Error ? e.message : String(e) } }))
    }
  }

  // P2a — STORYBOARD: render keyframe TẤT CẢ cảnh (rẻ) để soi cả phim trước khi đốt i2v.
  //   Bỏ qua cảnh đã có keyframe (kf_ready/clip/done).
  async function handleRenderAllKeyframes() {
    if (!script || renderingAll) return
    if (!kieKey) { setError('Thiếu KIE API key trong Cài đặt'); return }
    setRenderingAll(true)
    try {
      for (const s of script.scenes) {
        const st = clips[s.idx]?.status
        if (st === 'kf_ready' || st === 'clip' || st === 'done') continue
        await handleRenderKeyframe(s)
      }
    } finally { setRenderingAll(false) }
  }

  // P2c — lồng giọng 1 cảnh (TTS → ghép voiceover vào clip i2v, 0 credit). Cần clip + thoại.
  async function handleVoiceoverScene(scene: PersonifiedScene) {
    const cur = clips[scene.idx]
    if (!cur?.clipRef) { setError('Cảnh chưa có clip i2v — render clip trước'); return }
    if (!(scene.dialoguePrimary ?? '').trim()) { setError('Cảnh không có thoại — không cần lồng giọng'); return }
    if (!elevenKey) { setError('Thiếu ElevenLabs API key (giọng) trong Cài đặt'); return }
    if (cur.lipStatus === 'tts' || cur.lipStatus === 'mux') return
    const character = script?.characters.find((c) => c.name === scene.speaker || c.role === scene.speaker) ?? script?.characters[0]
    setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], lipStatus: 'tts', lipError: undefined } }))
    try {
      const { audioRef, voicedRef } = await addSceneVoiceover({
        elevenKey, scene, character, clipRef: cur.clipRef,
        onStage: (stage) => setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], lipStatus: stage === 'done' ? 'done' : stage } })),
      })
      setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], lipStatus: 'done', audioRef, lipsyncRef: voicedRef } }))
    } catch (e) {
      setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], lipStatus: 'failed', lipError: e instanceof Error ? e.message : String(e) } }))
    }
  }

  // P2c — lồng giọng TẤT CẢ cảnh có clip + có thoại + chưa lồng.
  async function handleVoiceoverAll() {
    if (!script || renderingAll) return
    if (!elevenKey) { setError('Thiếu ElevenLabs API key (giọng) trong Cài đặt'); return }
    setRenderingAll(true)
    try {
      for (const s of script.scenes) {
        const c = clips[s.idx]
        if (c?.clipRef && (s.dialoguePrimary ?? '').trim() && c.lipStatus !== 'done') await handleVoiceoverScene(s)
      }
    } finally { setRenderingAll(false) }
  }

  // P2d — GHÉP video cuối: nối clip mọi cảnh (lipsync nếu có, không thì i2v câm) + upscale 720p.
  async function handleAssemble() {
    if (!script || finalVideo.status === 'running') return
    const list = script.scenes
      .filter((s) => clips[s.idx]?.clipRef)
      .map((s) => ({
        videoRef: (clips[s.idx]?.lipsyncRef ?? clips[s.idx]!.clipRef!),
        durationSec: s.clipDuration,
        hasAudio: !!clips[s.idx]?.lipsyncRef,
      }))
    if (!list.length) { setError('Chưa cảnh nào có clip — render clip trước khi ghép'); return }
    setFinalVideo({ status: 'running', stage: 'Bắt đầu…' })
    try {
      const res = await assemblePersonifiedVideo({
        clips: list, resolution: '720p',
        onStage: (m) => setFinalVideo((p) => ({ ...p, status: 'running', stage: m })),
      })
      setFinalVideo({ status: 'done', videoRef: res.videoRef })
    } catch (e) {
      setFinalVideo({ status: 'failed', error: e instanceof Error ? e.message : String(e) })
    }
  }

  // P2a — i2v TẤT CẢ cảnh đã duyệt keyframe (status kf_ready). Cảnh chưa có keyframe → bỏ qua.
  async function handleRenderAllClips() {
    if (!script || renderingAll) return
    if (!kieKey) { setError('Thiếu KIE API key trong Cài đặt'); return }
    setRenderingAll(true)
    try {
      for (const s of script.scenes) {
        const st = clips[s.idx]?.status
        if (st === 'kf_ready') await handleRenderClip(s)
      }
    } finally { setRenderingAll(false) }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#FAFAFA]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-black/10 bg-white px-6 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
          <Sparkles className="h-4 w-4 text-violet-600" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-gray-900">Xưởng Nhân Vật Hoá 3D</h1>
          <p className="text-[11px] text-gray-500">Video nhân cách hóa vấn đề · simulator kịch bản (P1)</p>
        </div>
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
          TEXT-ONLY · chưa render
        </span>
      </div>

      {noKey && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-gray-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Chưa có Gemini API key — vào Cài đặt để nhập trước khi phân tích.
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl space-y-5 p-6">
        {/* ── Bước 1 — Input ── */}
        <Section step={1} title="Chọn sản phẩm & thị trường">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">Sản phẩm (từ kho)</span>
              <select
                value={productId} onChange={(e) => { setProductId(e.target.value); setInsight(null); setScript(null) }}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
              >
                <option value="">— Chọn sản phẩm —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.productName || '(chưa đặt tên)'}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">Thị trường đích</span>
              <div className="flex gap-2">
                {(['MY', 'VN'] as TargetMarket[]).map((m) => (
                  <button key={m} onClick={() => { setMarket(m); setInsight(null); setScript(null) }}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      market === m ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-black/10 bg-white text-gray-600 hover:bg-black/5'
                    }`}>
                    {TARGET_MARKET_LABEL[m]}{m === 'MY' && ' (chính)'}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Vấn đề cần nhân cách hóa <span className="font-normal text-gray-400">(tùy chọn — để trống thì AI tự suy)</span></span>
            <input value={problemHint} onChange={(e) => setProblemHint(e.target.value)}
              placeholder="vd: viêm xoang, mụn lưng, mất ngủ…"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />
          </label>
          <button onClick={handleAnalyze} disabled={!product || analyzing || noKey}
            className="mt-3 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-40">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Phân tích & lên ý tưởng
          </button>
        </Section>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        {/* ── Bước 2 — Insight + config ── */}
        {insight && (
          <Section step={2} title="Insight & chọn Kiểu kịch bản">
            <div className="grid gap-2 rounded-lg bg-violet-50/60 p-3 text-xs text-gray-700 md:grid-cols-2">
              <InsightRow label="Insight sản phẩm" value={insight.productInsight} />
              <InsightRow label="Insight khách hàng" value={insight.customerInsight} />
              <InsightRow label="Nỗi đau cốt lõi" value={insight.painCore} />
              <InsightRow label="Ẩn dụ đề xuất" value={insight.metaphor} />
            </div>

            <p className="mt-4 mb-2 text-xs font-semibold text-gray-600">Kiểu kịch bản {insight && <span className="font-normal text-violet-600">· AI gợi ý: {ARCHETYPES[insight.recommendedArchetype].labelVi}</span>}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {ARCHETYPE_ORDER.map((id: ArchetypeId) => {
                const a = ARCHETYPES[id]; const active = config.archetype === id
                return (
                  <button key={id} onClick={() => setConfig((c) => ({ ...c, archetype: id }))}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      active ? 'border-violet-500 bg-violet-50' : 'border-black/10 bg-white hover:bg-black/5'
                    }`}>
                    <div className="text-sm font-bold text-gray-900">{a.emoji} {a.labelVi}{id === insight.recommendedArchetype && <span className="ml-1 text-[10px] text-violet-600">★</span>}</div>
                    <div className="mt-0.5 text-[11px] text-gray-600">{a.taglineVi}</div>
                    <div className="mt-1 text-[10px] text-gray-400">{a.whenVi}</div>
                  </button>
                )
              })}
            </div>

            {/* B — guard KB2: cảnh báo nhẹ khi chọn Quỷ Tâm Lý cho vấn đề AI gợi ý kiểu khác (thường là nhìn-thấy-được). */}
            {config.archetype === 'KB2_inner_demon' && insight.recommendedArchetype !== 'KB2_inner_demon' && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-gray-800">
                ⚠️ <b>Quỷ Tâm Lý</b> hợp vấn đề <b>VÔ HÌNH</b> (tự ti / mất ngủ / lo âu). Vấn đề này AI gợi ý <b>{ARCHETYPES[insight.recommendedArchetype].labelVi}</b> — KB2 vẫn chạy nhưng sẽ đánh qua góc <b>TÂM LÝ (xấu hổ)</b> + bắt buộc có người thật. Muốn villain nhìn-thấy-được thì chọn kiểu AI gợi ý.
              </p>
            )}

            <div className="mt-4 grid items-start gap-3 md:grid-cols-2">
              <Picker label="Độ dài" value={config.length} options={Object.keys(LENGTH_LABEL) as VideoLength[]}
                labels={LENGTH_LABEL} onChange={(v) => setConfig((c) => ({ ...c, length: v }))}
                hint="Tổng giây thực tế hiện ở bước 3 (mỗi cảnh chỉ 4s hoặc 8s nên có thể lệch nhẹ)." />
              <Picker label="Sản phẩm thật ra tay kiểu gì?" value={config.heroType} options={Object.keys(HERO_TYPE_LABEL) as HeroType[]}
                labels={HERO_TYPE_LABEL} onChange={(v) => setConfig((c) => ({ ...c, heroType: v }))}
                hint={HERO_TYPE_DESC[config.heroType]} recommended={insight?.recommendedHeroType} />
              <Picker label="Kiểu CTA" value={config.ctaStyle} options={Object.keys(CTA_STYLE_LABEL) as CtaStyle[]}
                labels={CTA_STYLE_LABEL} onChange={(v) => setConfig((c) => ({ ...c, ctaStyle: v }))}
                recommended={insight?.recommendedCtaStyle} />
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={config.falseSolution}
                    onChange={(e) => setConfig((c) => ({ ...c, falseSolution: e.target.checked }))} />
                  Cảnh "đồ thường thất bại" <span className="text-xs font-normal text-violet-600">(khuyên bật)</span>
                </label>
                <span className="mt-1 block text-[11px] leading-snug text-gray-400">{FALSE_SOLUTION_DESC}</span>
              </div>
            </div>

            <button onClick={() => handleGenerate(0)} disabled={generating || noKey}
              className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-40">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Tạo kịch bản
            </button>
          </Section>
        )}

        {/* ── Bước 3 — Kịch bản ── */}
        {script && (
          <Section step={3} title="Kịch bản">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700">{script.scenes.length} cảnh · ~{script.totalSec}s <span className="font-normal text-gray-400">(mục tiêu ~{LENGTH_TARGET_SEC[config.length]}s)</span></span>
              <label className="flex items-center gap-1">
                <span className="text-gray-500">Tier render:</span>
                <select value={tier} onChange={(e) => setTier(e.target.value as RenderTier)}
                  className="rounded border border-black/10 bg-white px-2 py-1 text-xs">
                  {(Object.keys(RENDER_TIER_LABEL) as RenderTier[]).map((t) => <option key={t} value={t}>{RENDER_TIER_LABEL[t]}</option>)}
                </select>
              </label>
              {credit && <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700" title="Credit KIE: ảnh nhân vật (bank) + keyframe + i2v. Giọng do ElevenLabs (ví riêng) + ghép ffmpeg (0 credit).">KIE {formatCreditEstimate(credit)} · giọng riêng</span>}
              {/* P2a — STORYBOARD GATE: keyframe tất cả (rẻ, để duyệt) → soi xong → clip tất cả (i2v, đắt) */}
              <button onClick={handleRenderAllKeyframes} disabled={renderingAll || !kieKey}
                className="ml-auto flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-40"
                title={kieKey ? 'Tạo keyframe (ảnh tĩnh, rẻ) cho mọi cảnh để duyệt visual trước khi i2v' : 'Thiếu KIE key trong Cài đặt'}>
                {renderingAll ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang chạy…</> : <>🖼️ Keyframe tất cả</>}
              </button>
              <button onClick={handleRenderAllClips} disabled={renderingAll || !kieKey || kfReadyCount === 0}
                className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
                title={kfReadyCount > 0 ? `i2v ${kfReadyCount} cảnh đã duyệt keyframe (tốn credit)` : 'Duyệt keyframe trước (chưa cảnh nào sẵn sàng i2v)'}>
                {renderingAll ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang chạy…</> : <>🎬 Clip tất cả{kfReadyCount > 0 && ` (${kfReadyCount})`}</>}
              </button>
              {/* P2c — lồng giọng tất cả cảnh có clip + thoại (TTS + ghép ffmpeg, 0 credit KIE) */}
              <button onClick={handleVoiceoverAll} disabled={renderingAll || !elevenKey || lipReadyCount === 0}
                className="flex items-center gap-1 rounded-lg bg-fuchsia-600 px-3 py-1.5 font-bold text-white transition-colors hover:bg-fuchsia-700 disabled:opacity-40"
                title={!elevenKey ? 'Cần ElevenLabs key (giọng) trong Cài đặt' : lipReadyCount > 0 ? `Lồng giọng ${lipReadyCount} cảnh (TTS, 0 credit KIE)` : 'Render clip i2v trước'}>
                {renderingAll ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang chạy…</> : <>🎙️ Lồng giọng tất cả{lipReadyCount > 0 && ` (${lipReadyCount})`}</>}
              </button>
              {/* P2d — ghép video cuối (nối clip + upscale 720p) */}
              <button onClick={handleAssemble} disabled={finalVideo.status === 'running' || clipCount === 0}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
                title={clipCount > 0 ? `Ghép ${clipCount} cảnh đã render + upscale 720p` : 'Render clip trước khi ghép'}>
                {finalVideo.status === 'running' ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang ghép…</> : <>🎬 Ghép video{clipCount > 0 && ` (${clipCount})`}</>}
              </button>
              <button onClick={() => handleGenerate(variant + 1)} disabled={generating}
                className="flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 font-semibold text-gray-700 transition-colors hover:bg-black/5 disabled:opacity-40">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Tạo lại
              </button>
            </div>

            {/* Biome cố định (worldEnv) — bối cảnh chung cho mọi keyframe; sửa được rồi render lại. */}
            <label className="mb-3 block rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">🌍 Biome nội tại mặc định (cảnh "trong cơ thể") — mỗi cảnh còn có bối cảnh riêng ở bảng dưới</span>
              <textarea value={script.worldEnv ?? ''} onChange={(e) => setScript((prev) => (prev ? { ...prev, worldEnv: e.target.value } : prev))}
                rows={2} placeholder="VD: inside an inflamed knee joint, glistening cartilage, swollen red tissue…"
                className="mt-0.5 w-full resize-none rounded border border-emerald-200 bg-white p-2 text-xs text-gray-800 focus:border-emerald-400 focus:outline-none" />
            </label>

            {/* P2d — video cuối: trạng thái ghép + preview + tải về */}
            {finalVideo.status !== 'idle' && (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                {finalVideo.status === 'running' && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang ghép video… {finalVideo.stage && <span className="font-normal text-emerald-600">{finalVideo.stage}</span>}
                  </div>
                )}
                {finalVideo.status === 'failed' && <div className="text-xs text-rose-600">⚠ Ghép lỗi: {finalVideo.error?.slice(0, 160)}</div>}
                {finalVideo.status === 'done' && finalVideo.videoRef && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-emerald-700">✅ Video hoàn chỉnh (720p)</div>
                    <FinalVideoPreview videoRef={finalVideo.videoRef} />
                  </div>
                )}
              </div>
            )}

            {/* C — tabs: bảng cảnh dày (mặc định) · đọc liền mạch · nhân vật. Hết scroll dài + bỏ cột voice trùng. */}
            <div className="mb-3 flex gap-1">
              {([['table', '📋 Bảng cảnh'], ['read', '📖 Đọc liền mạch'], ['chars', `👤 Nhân vật (${script.characters.length})`]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setScriptTab(id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${scriptTab === id ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
              ))}
            </div>

            {/* ── Bảng cảnh: thấy hết cảnh trong 1 màn, click 1 dòng để bung chi tiết ── */}
            {scriptTab === 'table' && (
              <div className="overflow-hidden rounded-lg border border-black/10">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  <span className="w-5 shrink-0">#</span>
                  <span className="w-10 shrink-0">Ảnh</span>
                  <span className="w-28 shrink-0">Loại</span>
                  <span className="w-9 shrink-0">Giây</span>
                  <span className="w-20 shrink-0">Nhân vật</span>
                  <span className="flex-1">Thoại</span>
                </div>
                {script.scenes.map((s) => (
                  <div key={s.idx} className="border-t border-black/5">
                    <button onClick={() => setExpandedScene(expandedScene === s.idx ? null : s.idx)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-violet-50/40">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">{s.idx}</span>
                      {/* Thumbnail: có clip → video auto-loop; chưa có → keyframe ảnh. Bấm = xem TO. */}
                      {(() => {
                        const vid = clips[s.idx]?.lipsyncRef ?? clips[s.idx]?.clipRef
                        const ref = vid ?? clips[s.idx]?.keyframeRef
                        return (
                          <span
                            onClick={ref ? (e) => { e.stopPropagation(); setZoom({ isVideo: !!vid, ref }) } : undefined}
                            title={ref ? 'Bấm để xem to' : undefined}
                            className={`relative h-14 w-[3.25rem] shrink-0 overflow-hidden rounded border border-black/10 bg-gray-100 ${ref ? 'cursor-zoom-in' : ''}`}>
                            {ref
                              ? <><RowThumb assetRef={ref} isVideo={!!vid} /><span className="pointer-events-none absolute bottom-0 right-0 bg-black/55 px-1 text-[8px] text-white">🔍</span></>
                              : <span className="flex h-full w-full items-center justify-center text-[14px] text-gray-300">{clips[s.idx]?.status === 'kf' ? '⏳' : '🖼️'}</span>}
                          </span>
                        )
                      })()}
                      <span className="w-28 shrink-0 truncate text-[11px] font-semibold text-gray-600">{SCENE_TYPE_LABEL[s.sceneType]}{s.hasProduct && ' 📦'}</span>
                      <span className="w-9 shrink-0 text-[11px] font-bold text-amber-700">{s.clipDuration}s</span>
                      <span className="w-20 shrink-0 truncate text-[11px] text-gray-400">{s.speaker}</span>
                      <span className="flex-1 truncate text-xs text-gray-900">"{s.dialoguePrimary}"</span>
                      <span className="w-6 shrink-0 text-center text-[11px]" title={`${clips[s.idx]?.status ?? ''}${clips[s.idx]?.lipStatus ? ' · lip:' + clips[s.idx]?.lipStatus : ''}`}>
                        {clips[s.idx]?.lipStatus === 'tts' || clips[s.idx]?.lipStatus === 'mux' ? '🎙️'
                          : clips[s.idx]?.status === 'kf' || clips[s.idx]?.status === 'clip' ? '⏳'
                          : clips[s.idx]?.status === 'kf_ready' ? '🖼️'
                          : clips[s.idx]?.status === 'done' ? (clips[s.idx]?.lipStatus === 'done' ? '✅🎙️' : '✅')
                          : clips[s.idx]?.status === 'failed' ? '❌' : ''}
                      </span>
                    </button>
                    {expandedScene === s.idx && (
                      <div className="space-y-1.5 bg-gray-50/70 px-3 pb-3 pl-10 pt-1 text-xs">
                        <label className="block">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">✏️ Thoại — sửa được (render sẽ dùng bản này)</span>
                          <textarea value={s.dialoguePrimary} onChange={(e) => updateScene(s.idx, { dialoguePrimary: e.target.value })}
                            rows={2} className="mt-0.5 w-full resize-none rounded border border-violet-200 bg-white p-2 text-sm font-medium text-gray-900 focus:border-violet-400 focus:outline-none" />
                        </label>
                        {!isVN && (
                          <label className="block">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">↳ Nghĩa VN — sửa được</span>
                            <textarea value={s.dialogueVi} onChange={(e) => updateScene(s.idx, { dialogueVi: e.target.value })}
                              rows={2} className="mt-0.5 w-full resize-none rounded border border-gray-200 bg-white p-2 text-xs italic text-gray-600 focus:border-violet-400 focus:outline-none" />
                          </label>
                        )}
                        {s.action && <div className="text-gray-600"><span className="font-semibold">Hành động:</span> {s.action}</div>}
                        {/* Bối cảnh riêng cảnh (đời thực/nội tại) — sửa được; render keyframe dùng bản này */}
                        <label className="block">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">🎬 Bối cảnh cảnh này — sửa được</span>
                          <input value={s.setting ?? ''} onChange={(e) => updateScene(s.idx, { setting: e.target.value })}
                            placeholder="vd: a crowded morning wet market / inside the knee joint cavern…"
                            className="mt-0.5 w-full rounded border border-emerald-200 bg-white px-2 py-1 text-[11px] text-gray-800 focus:border-emerald-400 focus:outline-none" />
                        </label>
                        <div className="text-[11px] text-gray-400">🎥 {s.camera}{s.sfx.length > 0 && ` · 🔊 ${s.sfx.join(', ')}`}</div>
                        {s.videoPromptEn && <div className="text-[10px] text-gray-400"><span className="font-semibold">i2v:</span> {s.videoPromptEn}</div>}
                        {/* P2a — CỔNG DUYỆT: keyframe (rẻ) → soi ảnh → i2v (đắt). */}
                        {(() => {
                          const st = clips[s.idx]?.status
                          const busy = st === 'kf' || st === 'clip'
                          const sceneChar = script.characters.find((c) => c.name === s.speaker || c.role === s.speaker)
                          const charLocked = !!(sceneChar && charBank[sceneChar.name]?.refImage)
                          return (
                            <div className="space-y-1.5 pt-1">
                              {sceneChar && (
                                charLocked
                                  ? <div className="text-[10px] font-semibold text-emerald-600">🎭 Khóa diện mạo "{sceneChar.name}" từ bank</div>
                                  : <div className="text-[10px] text-amber-600">🎭 "{sceneChar.name}" chưa có ảnh bank → mặt có thể lệch giữa các cảnh. Tạo bank ở tab Nhân vật trước.</div>
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Bước 1 — keyframe (luôn có; khi đã có ảnh thì là "Đổi keyframe" / re-roll) */}
                                <button onClick={() => handleRenderKeyframe(s)} disabled={busy || renderingAll || !kieKey}
                                  className="flex items-center gap-1 rounded border border-violet-300 bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-40">
                                  {st === 'kf'
                                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Đang tạo ảnh…</>
                                    : clips[s.idx]?.keyframeRef
                                    ? <><RefreshCw className="h-3 w-3" /> Đổi keyframe</>
                                    : <>🖼️ Tạo keyframe</>}
                                </button>
                                {/* Bước 2 — i2v (chỉ bật khi đã có keyframe duyệt) */}
                                {clips[s.idx]?.keyframeRef && (
                                  <button onClick={() => handleRenderClip(s)} disabled={busy || renderingAll || !kieKey}
                                    className="flex items-center gap-1 rounded bg-violet-600 px-2 py-1 text-[11px] font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-40">
                                    {st === 'clip'
                                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Đang i2v…</>
                                      : st === 'done'
                                      ? <><RefreshCw className="h-3 w-3" /> Tạo clip lại</>
                                      : <>✅ Tạo clip (i2v)</>}
                                  </button>
                                )}
                                {st === 'kf_ready' && <span className="text-[10px] font-semibold text-violet-600">👁️ Soi ảnh dưới — đẹp thì bấm "Tạo clip", drift thì "Đổi keyframe"</span>}
                                {clips[s.idx]?.error && <span className="text-[10px] text-rose-600">⚠ {clips[s.idx]?.error?.slice(0, 90)}</span>}
                              </div>
                              {/* P2c — Bước 3: lồng giọng (chỉ khi clip xong + cảnh có thoại) */}
                              {(() => {
                                const lip = clips[s.idx]?.lipStatus
                                const lipBusy = lip === 'tts' || lip === 'mux'
                                const hasDialogue = !!(s.dialoguePrimary ?? '').trim()
                                if (st !== 'done' || !hasDialogue) return null
                                return (
                                  <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-1.5">
                                    <button onClick={() => handleVoiceoverScene(s)} disabled={lipBusy || renderingAll || !elevenKey}
                                      className="flex items-center gap-1 rounded bg-fuchsia-600 px-2 py-1 text-[11px] font-bold text-white transition-colors hover:bg-fuchsia-700 disabled:opacity-40"
                                      title={!elevenKey ? 'Cần ElevenLabs key (giọng)' : 'TTS giọng + burn caption thoại (vàng) vào clip (0 credit KIE)'}>
                                      {lip === 'tts'
                                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Đang tạo giọng…</>
                                        : lip === 'mux'
                                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Đang ghép giọng+caption…</>
                                        : lip === 'done'
                                        ? <><RefreshCw className="h-3 w-3" /> Lồng giọng lại</>
                                        : <>🎙️ Lồng giọng + caption</>}
                                    </button>
                                    {lip === 'done' && <span className="text-[10px] font-semibold text-fuchsia-600">✅ giọng + caption</span>}
                                    {lip === 'failed' && <span className="text-[10px] text-rose-600">⚠ {clips[s.idx]?.lipError?.slice(0, 80)}</span>}
                                    {!elevenKey && <span className="text-[10px] text-amber-600">cần key ElevenLabs</span>}
                                  </div>
                                )
                              })()}
                              {/* Preview: keyframe (ảnh) khi chưa có clip; lipsync (ưu tiên) hoặc clip i2v khi xong */}
                              {clips[s.idx]?.keyframeRef && st !== 'done' && <KeyframePreview keyframeRef={clips[s.idx]!.keyframeRef!} />}
                              {st === 'done' && clips[s.idx]?.lipsyncRef
                                ? <ClipPreview clipRef={clips[s.idx]!.lipsyncRef!} />
                                : st === 'done' && clips[s.idx]?.clipRef && <ClipPreview clipRef={clips[s.idx]!.clipRef!} />}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Đọc liền mạch: voice script song ngữ (gộp cột cũ vào đây, hết trùng) ── */}
            {scriptTab === 'read' && (
              <div className="space-y-2">
                <div className="w-full whitespace-pre-wrap rounded-lg border border-black/10 bg-white p-3 text-sm leading-relaxed text-gray-800">
                  {script.fullVoiceScriptPrimary}
                </div>
                {!isVN && (
                  <>
                    <p className="text-xs font-semibold text-gray-600">↳ Bản dịch nghĩa VN (duyệt)</p>
                    <div className="w-full whitespace-pre-wrap rounded-lg border border-black/10 bg-gray-50 p-3 text-sm leading-relaxed text-gray-600">
                      {script.fullVoiceScriptVi}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Nhân vật + Character Bank (P2b) ── */}
            {scriptTab === 'chars' && (
              script.characters.length > 0 ? (
                <div className="space-y-2">
                  {/* Hướng dẫn + nút tạo bank tất cả */}
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 text-[11px] text-gray-700">
                    <span>🎭 <b>Character Bank</b> — render ảnh chuẩn mỗi nhân vật <b>1 lần</b>. Render cảnh sẽ dùng ảnh này để <b>giữ y mặt/dáng xuyên các cảnh</b> (chống mỗi cảnh một mặt). Nên làm <b>trước</b> khi render keyframe cảnh.</span>
                    <button onClick={handleRenderAllChars} disabled={bankRunning || !kieKey}
                      className="ml-auto flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-40">
                      {bankRunning ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tạo…</> : <>🎭 Tạo bank tất cả</>}
                    </button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {script.characters.map((ch, i) => {
                      const bank = charBank[ch.name]
                      return (
                        <div key={i} className="flex gap-3 rounded-lg border border-black/10 bg-white p-3 text-xs">
                          {/* Ảnh bank (nếu có) */}
                          <div className="w-20 shrink-0">
                            {bank?.refImage
                              ? <CharRefPreview refImage={bank.refImage} />
                              : <div className="flex h-28 w-20 items-center justify-center rounded-lg border border-dashed border-violet-200 bg-violet-50/40 text-center text-[18px]">{bank?.status === 'rendering' ? <Loader2 className="h-4 w-4 animate-spin text-violet-500" /> : '🎭'}</div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-gray-900">{ch.name} <span className="font-normal text-gray-400">· {ch.role}</span>{ch.role === 'hero' && <span className="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">📦 khóa bao bì thật</span>}</div>
                            <div className="mt-0.5 text-gray-600">{ch.represents}</div>
                            {ch.voice.vungMien && !/không có/i.test(ch.voice.vungMien) && (
                              <div className="mt-1 text-[10px] text-gray-400">Giọng: {ch.voice.vungMien} · {ch.voice.gioiTinh} · {ch.voice.tuoi} · {ch.voice.texture}</div>
                            )}
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <button onClick={() => handleRenderCharacterRef(ch)} disabled={bank?.status === 'rendering' || bankRunning || !kieKey}
                                className="flex items-center gap-1 rounded border border-violet-300 bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-40">
                                {bank?.status === 'rendering'
                                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Đang tạo…</>
                                  : bank?.refImage
                                  ? <><RefreshCw className="h-3 w-3" /> Đổi ảnh</>
                                  : <>🎭 Tạo ảnh nhân vật</>}
                              </button>
                              {bank?.status === 'done' && <span className="text-[10px] font-semibold text-emerald-600">✅ đã khóa diện mạo</span>}
                              {bank?.status === 'failed' && <span className="text-[10px] text-rose-600">⚠ {bank.error?.slice(0, 70)}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : <p className="text-xs text-gray-400">Chưa có nhân vật.</p>
            )}
          </Section>
        )}
      </div>

      {/* Lightbox xem TO ảnh/video — bấm nền hoặc nút ✕ để đóng */}
      {zoom && (
        <div onClick={() => setZoom(null)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
          <button onClick={() => setZoom(null)}
            className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/25">✕ Đóng</button>
          {zoom.isVideo
            ? <ZoomVideo refId={zoom.ref} />
            : <ZoomImage refId={zoom.ref} />}
        </div>
      )}
    </div>
  )
}

// Xem to trong lightbox — dùng useAssetUrl ở component con (hook ở top-level an toàn).
function ZoomImage({ refId }: { refId: string }) {
  const url = useAssetUrl(refId)
  if (!url) return <span className="text-sm text-white/70">đang tải…</span>
  return <img src={url} alt="" onClick={(e) => e.stopPropagation()} className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl" />
}
function ZoomVideo({ refId }: { refId: string }) {
  const url = useAssetUrl(refId)
  if (!url) return <span className="text-sm text-white/70">đang tải…</span>
  return <video src={url} controls autoPlay loop playsInline onClick={(e) => e.stopPropagation()} className="max-h-[88vh] max-w-[92vw] rounded-lg shadow-2xl" />
}

// ── small UI helpers ─────────────────────────────────────────────────────────
function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs text-white">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

// P2a — thumbnail nhỏ trên dòng bảng cảnh (storyboard). Có clip → VIDEO auto-loop câm
// (thấy ngay storyboard động); chưa có clip → ảnh keyframe. pointer-events-none để click
// dòng vẫn bung chi tiết bình thường.
function RowThumb({ assetRef, isVideo }: { assetRef: string; isVideo?: boolean }) {
  const url = useAssetUrl(assetRef)
  if (!url) return <span className="flex h-full w-full items-center justify-center text-[10px] text-gray-300">…</span>
  return isVideo
    ? <video src={url} autoPlay muted loop playsInline className="pointer-events-none h-full w-full object-cover" />
    : <img src={url} alt="" className="h-full w-full object-cover" />
}

// P2b — ảnh chân dung nhân vật trong Character Bank.
function CharRefPreview({ refImage }: { refImage: string }) {
  const url = useAssetUrl(refImage)
  if (!url) return <div className="flex h-28 w-20 items-center justify-center rounded-lg border border-violet-200 text-[10px] text-gray-400">tải…</div>
  return <img src={url} alt="nhân vật" className="h-28 w-20 rounded-lg border border-violet-200 object-cover" />
}

// P2a — keyframe (ảnh tĩnh) để DUYỆT trước i2v.
function KeyframePreview({ keyframeRef }: { keyframeRef: string }) {
  const url = useAssetUrl(keyframeRef)
  if (!url) return <span className="text-[10px] text-gray-400">đang tải keyframe…</span>
  return <img src={url} alt="keyframe" className="mt-1 w-full max-w-[220px] rounded-lg border border-violet-200" />
}

// P2d — video cuối (ghép xong): preview lớn + nút tải về.
function FinalVideoPreview({ videoRef }: { videoRef: string }) {
  const url = useAssetUrl(videoRef)
  if (!url) return <span className="text-[11px] text-gray-400">đang tải video…</span>
  return (
    <div className="space-y-2">
      <video src={url} controls playsInline className="w-full max-w-[280px] rounded-lg border border-black/10" />
      <a href={url} download="personified-video.mp4"
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700">⬇️ Tải video</a>
    </div>
  )
}

// P2a — clip đã render (lấy URL từ assetStore). Hook gọi ở đầu component → an toàn.
function ClipPreview({ clipRef }: { clipRef: string }) {
  const url = useAssetUrl(clipRef)
  if (!url) return <span className="text-[10px] text-gray-400">đang tải clip…</span>
  return <video src={url} controls autoPlay loop playsInline muted className="mt-1 w-full max-w-[240px] rounded-lg border border-black/10" />
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div><span className="font-semibold text-gray-500">{label}: </span><span>{value}</span></div>
  )
}

function Picker<T extends string>({ label, value, options, labels, onChange, hint, recommended }: {
  label: string; value: T; options: T[]; labels: Record<T, string>; onChange: (v: T) => void; hint?: string; recommended?: T
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}{recommended && <span className="ml-1 font-normal text-violet-600">· ⭐ AI gợi ý: {labels[recommended]}</span>}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm">
        {options.map((o) => <option key={o} value={o}>{labels[o]}{o === recommended ? ' ⭐' : ''}</option>)}
      </select>
      {hint && <span className="mt-1 block text-[11px] leading-snug text-gray-400">{hint}</span>}
    </label>
  )
}
