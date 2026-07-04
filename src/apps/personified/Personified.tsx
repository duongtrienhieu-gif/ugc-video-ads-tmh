// ── Mode 3 — Xưởng Nhân Vật Hoá 3D — Simulator (P1, text-only) ────────────────
// Pick sản phẩm → phân tích insight → chọn Kiểu kịch bản + cấu hình → sinh
// Storyboard + Full-text Voice Script SONG NGỮ + ước credit. CHƯA render ảnh/video.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Loader2, AlertCircle, RefreshCw, Wand2 } from 'lucide-react'
import { useBankStore } from '../../stores/bankStore'
import { useSettingsStore } from '../../stores/settingsStore'
import {
  type TargetMarket, type PersonifiedConfig, type ProductInsight,
  type PersonifiedScript, type PersonifiedScene, type PersonifiedCharacter, type SceneType, type ArchetypeId, type HeroType, type CtaStyle, type VideoLength,
  TARGET_MARKET_LABEL,
} from './types'
import {
  ARCHETYPES, ARCHETYPE_ORDER, HERO_TYPE_LABEL, HERO_TYPE_DESC, FALSE_SOLUTION_DESC,
  CTA_STYLE_LABEL, LENGTH_LABEL, LENGTH_TARGET_SEC, SCENE_TYPE_LABEL, RENDER_TIER_LABEL, type RenderTier,
  estimateProjectCredits, formatCreditEstimate, pickClipDuration, estimateSpeechSec, playbackWps,
} from './constants'
import { analyzeInsight, generateScript, resyncStoryboard } from './services/personifiedBrain'
import { renderKeyframe, renderClipFromKeyframe, renderCharacterRef, addSceneVoiceover, synthSceneVoice, muxSceneVoiceover, synthVoiceSample } from './services/personifiedRenderer'   // P2a/P2b/P2c (cũng đăng ký dev helper __testRenderScene)
import VoiceLibraryModal from '../voice-studio/components/VoiceLibraryModal'
import CloneVoiceModal from '../voice-studio/components/CloneVoiceModal'
import { listVoices, type ElevenLabsVoice } from '../../utils/elevenlabs'
import { assemblePersonifiedVideo } from './services/personifiedAssembler'   // P2d
import { resetFFmpeg } from '../video-builder/v3/services/ffmpegLoader'      // reset worker sau OOM
import { type LibVideo, getLibraryLocal, syncLibrary, addToLibrary, removeFromLibrary,
  type LibProject, getProjectsLocal, syncProjects, saveProject, removeProject } from './services/personifiedLibrary'   // P2e + dự án
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
  voiceSec?: number   // độ dài giọng cảnh (để ghép khớp)
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

/** Chạy danh sách task với GIỚI HẠN số chạy cùng lúc (pool). Bước mạng (KIE/ElevenLabs)
 *  song song thật; bước ffmpeg tự xếp hàng qua execLock của ffmpegLoader → an toàn. */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<unknown>): Promise<void> {
  let next = 0
  const run = async (): Promise<void> => {
    const i = next++
    if (i >= items.length) return
    try { await worker(items[i]) } catch { /* worker tự set trạng thái lỗi */ }
    await run()
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => run()))
}

// #1 — Editor kịch bản liền mạch: dựng text có nhãn [Cảnh N] để user sửa thoại tự do,
// rồi parse ngược về map idx→thoại. Nhãn [Cảnh N] là mỏ neo (giữ nhãn = khớp đúng cảnh).
// Nhãn dựng theo VỊ TRÍ (i+1), KHÔNG theo s.idx — để editor luôn khớp số cảnh storyboard
// (idx gốc AI có thể trùng/nhảy). Số trong nhãn chỉ để user đọc.
function buildReadDraft(scenes: PersonifiedScene[]): string {
  return scenes.map((s, i) => `[Cảnh ${i + 1}] ${s.dialoguePrimary ?? ''}`.trimEnd()).join('\n\n')
}
function parseReadDraft(text: string, scenes: PersonifiedScene[]): Record<number, string> {
  const out: Record<number, string> = {}
  // Tách theo nhãn [Cảnh N] — nhưng MAP THEO THỨ TỰ: nhãn thứ i → cảnh thứ i (scenes[i]).
  // Không tin số trong nhãn → 2 cảnh trùng idx KHÔNG còn đè nhau (chống nuốt thoại).
  const re = /\[\s*Cảnh\s*\d+\s*\]/gi
  const marks: { start: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) marks.push({ start: m.index, end: re.lastIndex })
  for (let i = 0; i < marks.length; i++) {
    const scene = scenes[i]
    if (!scene) break   // nhiều nhãn hơn cảnh → bỏ dư
    const body = text.slice(marks[i].end, i + 1 < marks.length ? marks[i + 1].start : undefined)
    out[scene.idx] = body.replace(/\s+/g, ' ').trim()
  }
  // Cảnh không có nhãn tương ứng (ít nhãn hơn cảnh) → giữ thoại cũ (đừng xóa).
  for (const s of scenes) if (!(s.idx in out)) out[s.idx] = s.dialoguePrimary ?? ''
  return out
}

// #2 — Nhân vật XUẤT HIỆN trong khung 1 cảnh (để khóa diện mạo keyframe) — TÁCH khỏi
// "người nói" (speaker, chỉ dùng chọn giọng). Vì format "bộ phận cằn nhằn" có narrator nói
// xuyên suốt → nếu khóa theo speaker thì ảnh bank HERO không bao giờ được dùng. Suy theo
// sceneType: cảnh sản phẩm ra tay → HERO; cảnh đối đầu (hero gặp villain) → CẢ HAI; còn lại → villain/organ.
const HERO_LEAD_SCENES = new Set<SceneType>(['hero_entrance', 'application', 'destruction', 'result', 'cta'])
const CONFRONT_SCENES = new Set<SceneType>(['hero_entrance', 'application', 'destruction'])
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
// HERO = sản phẩm. Phòng khi Gemini KHÔNG gắn đúng role='hero': fallback theo tên ≈ tên SP,
// rồi theo role chứa 'hero'/'product' → tránh "hero=undefined" làm phí ảnh bank (regression).
function findHeroChar(characters: PersonifiedCharacter[], productName?: string): PersonifiedCharacter | undefined {
  const byRole = characters.find((c) => c.role === 'hero')
  if (byRole) return byRole
  if (productName) {
    const pn = norm(productName)
    const byName = characters.find((c) => { const n = norm(c.name); return !!n && (pn.includes(n) || n.includes(pn)) })
    if (byName) return byName
  }
  return characters.find((c) => /hero|product|san\s?pham|sản phẩm/i.test(c.role))
}
// Nhân vật TRONG KHUNG để khóa diện mạo. Ưu tiên inFrame brain TỰ KHAI (đúng cho cả 4 KB +
// người-thật KB2); rỗng (kịch bản cũ) → fallback heuristic theo sceneType.
function pickSceneVisuals(
  scene: PersonifiedScene, characters: PersonifiedCharacter[], productName?: string,
): { main?: PersonifiedCharacter; extra?: PersonifiedCharacter } {
  const hero = findHeroChar(characters, productName)
  // 1) Brain đã khai inFrame → dùng trực tiếp (ưu tiên hero làm main để khớp heroVfx + khóa SP).
  const declared = (scene.inFrame ?? [])
    .map((n) => characters.find((c) => c.name === n) ?? characters.find((c) => c.role === n))
    .filter((c): c is PersonifiedCharacter => !!c)
  const uniq = declared.filter((c, i) => declared.findIndex((d) => d.name === c.name) === i)
  if (uniq.length) {
    const main = (hero && uniq.some((c) => c.name === hero.name)) ? hero : uniq[0]
    const extra = uniq.find((c) => c.name !== main.name)
    return { main, extra }
  }
  // 2) Fallback heuristic (kịch bản tạo trước khi có inFrame).
  const speaker = characters.find((c) => c.name === scene.speaker || c.role === scene.speaker)
    ?? characters.find((c) => !hero || c.name !== hero.name) ?? characters[0]
  if (hero && HERO_LEAD_SCENES.has(scene.sceneType)) {
    const extra = CONFRONT_SCENES.has(scene.sceneType) && speaker && speaker.name !== hero.name ? speaker : undefined
    return { main: hero, extra }
  }
  return { main: speaker, extra: undefined }
}

// #1 — Nhân vật NÓI (để chọn GIỌNG) từ scene.speaker. Match MỀM (chuẩn hóa + chứa-nhau) thay vì
// bằng-đúng-tuyệt-đối; nếu vẫn không ra → dùng nhân vật CHÍNH trong khung (KHÔNG phải characters[0]
// = hay là người dẫn → trước đây mọi mismatch đều bị gán nhầm giọng người dẫn).
function resolveSpeakerChar(
  scene: PersonifiedScene, characters: PersonifiedCharacter[], productName?: string,
): PersonifiedCharacter | undefined {
  const sp = (scene.speaker ?? '').trim()
  if (sp) {
    const exact = characters.find((c) => c.name === sp || c.role === sp)
    if (exact) return exact
    const n = norm(sp)
    if (n) {
      const partial = characters.find((c) => { const cn = norm(c.name); return !!cn && (cn.includes(n) || n.includes(cn)) })
      if (partial) return partial
    }
  }
  return pickSceneVisuals(scene, characters, productName).main ?? characters[0]
}

/** 1 giọng ElevenLabs có hợp ngôn ngữ thị trường đích không (đọc nhãn/tên/mô tả). */
function voiceMatchesMarket(v: ElevenLabsVoice, market: TargetMarket): boolean {
  const lang = (v.labels?.language ?? '').toLowerCase()
  const hay = `${v.name} ${v.description ?? ''} ${Object.values(v.labels ?? {}).join(' ')}`.toLowerCase()
  if (market === 'VN') return lang === 'vi' || /viet|việt|tiếng việt/.test(hay)
  return lang === 'ms' || lang === 'id' || /malay|melayu|indones|bahasa/.test(hay)
}

/** Giới tính giọng từ ElevenLabs (label trước, rồi tên/mô tả). KHÔNG match bare "nam" (dễ
 *  nhầm "Miền Nam" = vùng miền) — chỉ "giọng nam"/"male". Trả undefined nếu không rõ. */
function voiceGender(v: ElevenLabsVoice): 'male' | 'female' | undefined {
  const lab = (v.labels?.gender ?? '').toLowerCase()
  if (/female|woman|nữ/.test(lab)) return 'female'
  if (/male|man/.test(lab)) return 'male'
  const hay = `${v.name} ${v.description ?? ''}`.toLowerCase()
  if (/\bnữ\b|giọng nữ|female|woman|\bcô\b|\bchị\b|\bbà\b/.test(hay)) return 'female'
  if (/giọng nam|\bmale\b|\bman\b|\banh\b|\bchú\b|\bông\b/.test(hay)) return 'male'
  return undefined
}
/** Giới tính mong muốn của nhân vật (voice.gioiTinh 'nam'|'nu'). */
function charWantGender(ch: PersonifiedCharacter): 'male' | 'female' {
  return /nu|nữ|nu+/.test((ch.voice?.gioiTinh ?? '').toLowerCase()) ? 'female' : 'male'
}
/** Điểm khớp 1 giọng cho 1 nhân vật: GIỚI TÍNH ưu tiên cứng (sai giới = phạt nặng), TUỔI bonus nhẹ. */
function scoreVoiceForChar(v: ElevenLabsVoice, ch: PersonifiedCharacter): number {
  let s = 0
  const g = voiceGender(v)
  const want = charWantGender(ch)
  if (g === want) s += 100
  else if (g) s -= 100              // biết chắc lệch giới → tránh (chỉ dùng khi hết giọng đúng giới)
  const age = `${v.labels?.age ?? ''} ${v.name}`.toLowerCase()
  const tuoi = (ch.voice?.tuoi ?? '').toLowerCase()
  if (/già|lão|cao tuổi/.test(tuoi) && /old|senior|elder|mature|già|lão/.test(age)) s += 10
  if (/trẻ|teen|thanh niên|gen ?z/.test(tuoi) && /young|teen|trẻ/.test(age)) s += 10
  return s
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
  charVoices?: Record<string, string>
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
  // #1 — Editor "Đọc liền mạch": sửa thoại TỰ DO → Lưu → AI đồng bộ hình storyboard.
  const [readDraft, setReadDraft] = useState('')
  const [resyncing, setResyncing] = useState(false)
  // P2a — clip đã render mỗi cảnh (keyed theo scene.idx), persist cùng kịch bản.
  const [clips, setClips] = useState<Record<number, SceneRender>>({})
  const [renderingAll, setRenderingAll] = useState(false)
  // P2b — Character Bank (keyed theo character.name).
  const [charBank, setCharBank] = useState<Record<string, CharRef>>({})
  const [bankRunning, setBankRunning] = useState(false)
  // P2c+ — giọng ElevenLabs gán per-nhân-vật (name → voiceId), persist. + cache danh sách giọng.
  const [charVoices, setCharVoices] = useState<Record<string, string>>({})
  const [myVoices, setMyVoices] = useState<ElevenLabsVoice[]>([])
  const [voiceModal, setVoiceModal] = useState<{ kind: 'lib' | 'clone'; charName: string } | null>(null)
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null)
  // P2d — video cuối (ghép + upscale 720p).
  const [finalVideo, setFinalVideo] = useState<{ status: 'idle' | 'running' | 'done' | 'failed'; videoRef?: string; stage?: string; error?: string }>({ status: 'idle' })
  // Keyframe đang render dở lúc F5 → tự nối lại (chỉ keyframe, rẻ). idx gom khi restore.
  const kfResume = useRef<number[]>([])
  // Clip i2v đang chạy lúc F5 → NỐI LẠI job đã trả tiền (poll taskId, 0 credit thêm).
  const clipResume = useRef<{ idx: number; taskId: string }[]>([])
  // Auto-match giọng theo thị trường: nhớ các nhân vật đã gán TỰ ĐỘNG + market lần cuối.
  const autoVoiced = useRef<Set<string>>(new Set())
  const lastVoiceMarket = useRef<TargetMarket | null>(null)
  // #1 — Render ĐANG CHẠY (manual lẫn "tất cả") để nút "tất cả" ĐỢI đúng cái dở rồi nối tiếp,
  // KHÔNG chạy lại từ đầu. bankRefs = ref TƯƠI (vượt stale-closure) của ảnh bank đã xong.
  const bankInflight = useRef<Record<string, Promise<string | undefined>>>({})
  const bankRefs = useRef<Record<string, string>>({})
  const kfInflight = useRef<Record<number, Promise<void>>>({})
  // Xem to (lightbox) ảnh keyframe / video clip khi bấm thumbnail.
  const [zoom, setZoom] = useState<{ isVideo: boolean; ref: string } | null>(null)
  // P2e — Thư viện video đã lưu.
  const [library, setLibrary] = useState<LibVideo[]>(getLibraryLocal())
  const [showLibrary, setShowLibrary] = useState(false)
  const [savedToLib, setSavedToLib] = useState(false)
  // Dự án (kịch bản + tiến trình) đã lưu.
  const [projects, setProjects] = useState<LibProject[]>(getProjectsLocal())
  const [savingProject, setSavingProject] = useState(false)

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
  // Số cảnh ĐÃ lồng giọng rồi (để bật nút "Lồng LẠI tất cả" khi đổi giọng sau khi lỡ chạy).
  const voicedDoneCount = useMemo(() => {
    if (!script) return 0
    return script.scenes.filter((s) => clips[s.idx]?.lipStatus === 'done').length
  }, [script, clips])
  // P2d — số cảnh đã có clip (để ghép). Bằng tổng cảnh = đủ; ít hơn = ghép phần đã render.
  const clipCount = useMemo(() => script ? script.scenes.filter((s) => clips[s.idx]?.clipRef).length : 0, [script, clips])
  // Độ dài THẬT dự kiến của video cuối = tổng giọng (cảnh đã lồng giọng) + render-length cảnh
  // chưa lồng. Khớp với cột Giây + video ghép ra (ghép cắt/kéo về voiceSec). voicedAny để biết
  // có nên hiện "thật" khác "render" không.
  const realTotalSec = useMemo(
    () => script ? Math.round(script.scenes.reduce((sum, s) => sum + (clips[s.idx]?.voiceSec ?? s.clipDuration), 0)) : 0,
    [script, clips],
  )
  const voicedAny = useMemo(() => script ? script.scenes.some((s) => clips[s.idx]?.voiceSec) : false, [script, clips])

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
              if (fixedBank[k].refImage) bankRefs.current[k] = fixedBank[k].refImage!   // seed ref tươi (dedup sau F5)
            }
            setCharBank(fixedBank)
          }
          if (s.charVoices) setCharVoices(s.charVoices)
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
      const s: PersistedState = { v: 1, productId, market, problemHint, insight, config, script, variant, tier, clips, charBank, charVoices, finalVideoRef: finalVideo.videoRef }
      localStorage.setItem(CACHE_KEY, JSON.stringify(s))
    } catch { /* quota / serialization — non-fatal */ }
  }, [productId, market, problemHint, insight, config, script, variant, tier, clips, charBank, charVoices, finalVideo.videoRef])

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

  // P2e — kéo thư viện + dự án từ cloud 1 lần khi mount (degrade về local nếu chưa login).
  useEffect(() => { void syncLibrary().then(setLibrary) }, [])
  useEffect(() => { void syncProjects().then(setProjects) }, [])

  // Tải danh sách giọng ElevenLabs của tài khoản (để hiện tên + dropdown chọn).
  useEffect(() => {
    if (!elevenKey) return
    void listVoices(elevenKey).then(setMyVoices).catch(() => {})
  }, [elevenKey])
  async function refreshMyVoices() {
    try { setMyVoices(await listVoices(elevenKey)) } catch { /* offline */ }
  }

  // Auto-GỢI-Ý giọng theo thị trường đích: gán distinct cho mỗi nhân vật giọng hợp ngôn
  // ngữ (VN/MY) từ thư viện. Đổi market → gán lại (chỉ các giọng AUTO; GIỮ giọng user tự
  // chọn). Nhân vật user đã chọn (kể cả "Tự động"=rỗng) thì tôn trọng, không đè.
  useEffect(() => {
    if (!script || !myVoices.length) return
    setCharVoices((prev) => {
      const next = { ...prev }
      if (lastVoiceMarket.current !== null && lastVoiceMarket.current !== market) {
        for (const n of autoVoiced.current) if (next[n] !== undefined) delete next[n]
        autoVoiced.current = new Set()
      }
      lastVoiceMarket.current = market
      const matched = myVoices.filter((v) => voiceMatchesMarket(v, market))
      if (!matched.length) return next
      const used = new Set(Object.values(next).filter(Boolean))
      // Mỗi nhân vật: chọn giọng hợp ngôn ngữ + KHỚP GIỚI TÍNH (điểm cao nhất) chưa dùng.
      // Sai giới bị phạt -100 nên chỉ dùng khi HẾT giọng đúng giới. → hết cảnh ông già giọng nữ.
      for (const ch of script.characters) {
        if (next[ch.name] !== undefined) continue   // user/auto đã đụng → tôn trọng
        const avail = matched.filter((v) => !used.has(v.voice_id))
        if (!avail.length) break
        const pick = avail
          .map((v) => ({ v, s: scoreVoiceForChar(v, ch) }))
          .sort((a, b) => b.s - a.s)[0].v
        next[ch.name] = pick.voice_id
        used.add(pick.voice_id)
        autoVoiced.current.add(ch.name)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, myVoices, market])
  // Nghe thử 1 giọng (TTS 1 câu mẫu eleven_v3).
  async function handlePreviewVoice(charName: string, voiceId: string) {
    if (!elevenKey || !voiceId || previewingVoice) return
    setPreviewingVoice(charName)
    try {
      const sample = isVN ? 'Xin chào, đây là giọng đọc thử cho nhân vật.' : 'Hai, ini suara untuk watak ini.'
      const url = await synthVoiceSample(elevenKey, voiceId, sample)
      const audio = new Audio(url)
      audio.onended = () => URL.revokeObjectURL(url)
      await audio.play()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nghe thử lỗi')
    } finally {
      setPreviewingVoice(null)
    }
  }

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
      bankRefs.current = {}; bankInflight.current = {}; kfInflight.current = {}   // xóa cache tiến trình render cũ
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

  // XÓA 1 CẢNH: bỏ cảnh + ĐÁNH SỐ LẠI idx=i+1 + REMAP clips theo idx mới (đừng để render lệch cảnh).
  function handleDeleteScene(delIdx: number) {
    if (!script) return
    if (script.scenes.length <= 1) { setError('Phải còn ít nhất 1 cảnh'); return }
    const sc = script.scenes.find((s) => s.idx === delIdx)
    const rendered = !!(clips[delIdx]?.keyframeRef || clips[delIdx]?.clipRef)
    if (!window.confirm(`Xóa cảnh ${delIdx}${sc ? ` (${SCENE_TYPE_LABEL[sc.sceneType]})` : ''}?${rendered ? ' Cảnh này đã render — ảnh/clip sẽ mất.' : ''}`)) return
    const remaining = script.scenes.filter((s) => s.idx !== delIdx)
    const remap = new Map<number, number>()            // idx cũ → idx mới
    const renumbered = remaining.map((s, i) => { remap.set(s.idx, i + 1); return { ...s, idx: i + 1 } })
    const newClips: Record<number, SceneRender> = {}   // dời render theo idx mới, bỏ cảnh xóa
    for (const [k, v] of Object.entries(clips)) {
      const ni = remap.get(Number(k))
      if (ni != null) newClips[ni] = v
    }
    setScript({
      ...script, scenes: renumbered,
      fullVoiceScriptPrimary: renumbered.map((s) => s.dialoguePrimary).filter(Boolean).join('\n'),
      fullVoiceScriptVi: renumbered.map((s) => s.dialogueVi).filter(Boolean).join('\n'),
      totalSec: renumbered.reduce((sum, s) => sum + s.clipDuration, 0),
    })
    setClips(newClips)
    setExpandedScene(null)
  }

  // #1 — Giữ editor "Đọc liền mạch" khớp kịch bản hiện tại. Rebuild khi NỘI DUNG CẢNH
  // thật sự đổi (số cảnh / thoại) — không phải mỗi lần script re-render. Chữ ký = idx+thoại
  // mỗi cảnh: user gõ trong editor → scenes chưa đổi → chữ ký giữ nguyên → KHÔNG đè chữ đang
  // gõ; regen/resync đổi số cảnh → chữ ký đổi → rebuild → hết lệch 8/9.
  const readSig = script ? script.scenes.map((s) => `${s.idx}:${s.dialoguePrimary ?? ''}`).join('|') : ''
  useEffect(() => {
    setReadDraft(script ? buildReadDraft(script.scenes) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readSig])

  // #1 — LƯU & ĐỒNG BỘ: user sửa thoại tự do ở "Đọc liền mạch" → giữ NGUYÊN VĂN thoại,
  // gọi AI vẽ lại hình (action/i2v/setting) cho khớp → prompt chính xác. Dọn render cũ
  // thông minh: cảnh đổi HÌNH → xóa keyframe+clip; cảnh chỉ đổi CHỮ → giữ clip, reset giọng.
  async function handleResyncScript() {
    if (!script || !product) return
    if (!geminiKey) { setError('Thiếu Gemini API key trong Cài đặt'); return }
    const newDia = parseReadDraft(readDraft, script.scenes)
    const changed = script.scenes.filter((s) => (newDia[s.idx] ?? '') !== (s.dialoguePrimary ?? ''))
    if (!changed.length) { setError(''); setScriptTab('table'); return }

    // Cảnh đã render mà sắp bị vẽ lại hình → cảnh báo trước khi xóa (tốn credit).
    const renderedChanged = changed.filter((s) => clips[s.idx]?.keyframeRef || clips[s.idx]?.clipRef)
    if (renderedChanged.length &&
      !window.confirm(`${changed.length} cảnh đổi thoại — trong đó ${renderedChanged.length} cảnh đã render. Đồng bộ sẽ vẽ lại prompt cho khớp; ảnh/clip cảnh đổi HÌNH sẽ phải render lại (giọng phải lồng lại). Tiếp tục?`)) return

    setError(''); setResyncing(true)
    try {
      const updates = await resyncStoryboard({
        product, market, worldEnv: script.worldEnv, characters: script.characters,
        scenes: changed.map((s) => ({
          idx: s.idx, sceneType: s.sceneType, speaker: s.speaker,
          newDialoguePrimary: newDia[s.idx] ?? '',
          prevAction: s.action, prevSetting: s.setting, prevVideoPromptEn: s.videoPromptEn,
        })),
        geminiKey,
      })

      // Cảnh nào đổi HÌNH (action/setting/videoPromptEn) → render cũ vô hiệu hoàn toàn.
      const visualChanged = new Set<number>()
      const dialogueOnly = new Set<number>()   // chỉ đổi chữ → giữ clip, lồng giọng lại
      const nextScenes = script.scenes.map((s) => {
        if (!changed.some((c) => c.idx === s.idx)) return s
        const u = updates[s.idx]
        const dia = newDia[s.idx] ?? ''
        const sp = estimateSpeechSec(dia || (isVN ? dia : u?.dialogueVi) || '', playbackWps(market))
        const next: PersonifiedScene = {
          ...s,
          dialoguePrimary: dia,
          dialogueVi: isVN ? dia : (u?.dialogueVi ?? s.dialogueVi),
          clipDuration: pickClipDuration(sp),
          ...(u ? {
            emotion: u.emotion || s.emotion, camera: u.camera || s.camera,
            sfx: u.sfx?.length ? u.sfx : s.sfx,
            action: u.action || s.action, setting: u.setting || s.setting,
            videoPromptEn: u.videoPromptEn || s.videoPromptEn,
          } : {}),
        }
        if (u && (u.action !== s.action || u.setting !== s.setting || u.videoPromptEn !== s.videoPromptEn)) visualChanged.add(s.idx)
        else dialogueOnly.add(s.idx)
        return next
      })

      setScript((prev) => prev ? {
        ...prev, scenes: nextScenes,
        fullVoiceScriptPrimary: nextScenes.map((s) => s.dialoguePrimary).filter(Boolean).join('\n'),
        fullVoiceScriptVi: nextScenes.map((s) => s.dialogueVi).filter(Boolean).join('\n'),
        totalSec: nextScenes.reduce((sum, s) => sum + s.clipDuration, 0),
      } : prev)

      // Dọn render: đổi hình → xóa cả keyframe+clip; chỉ đổi chữ → giữ clip, bỏ giọng (lồng lại).
      if (visualChanged.size || dialogueOnly.size) {
        setClips((prev) => {
          const nx = { ...prev }
          for (const idx of visualChanged) delete nx[idx]
          for (const idx of dialogueOnly) {
            const c = nx[idx]
            if (c) nx[idx] = { ...c, lipStatus: 'idle', lipsyncRef: undefined, audioRef: undefined, voiceSec: undefined, lipError: undefined }
          }
          return nx
        })
        if (visualChanged.size) setFinalVideo({ status: 'idle' })   // video cuối cũ lệch → bỏ
      }

      setScriptTab('table')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đồng bộ kịch bản lỗi')
    } finally {
      setResyncing(false)
    }
  }

  // P2b — render CHARACTER SHEET 1 nhân vật → Character Bank (khóa diện mạo xuyên cảnh).
  //   Trả về refImage. IDEMPOTENT: đã xong → trả ref ngay (bankRefs tươi); đang chạy → trả
  //   ĐÚNG promise đang chạy (caller ĐỢI nó xong, không submit lại) → nút "tất cả" nối tiếp được.
  async function handleRenderCharacterRef(character: PersonifiedCharacter, force = false): Promise<string | undefined> {
    if (!kieKey) { setError('Thiếu KIE API key trong Cài đặt'); return undefined }
    // force = user bấm "Đổi ảnh" (re-roll có chủ đích) → xóa cache, render mới. Bulk thì force=false.
    if (force) delete bankRefs.current[character.name]
    else if (bankRefs.current[character.name]) return bankRefs.current[character.name]   // đã xong (ref tươi)
    const inflight = bankInflight.current[character.name]
    if (inflight) return inflight                                                   // đang chạy → đợi chính nó
    const task = (async () => {
      setCharBank((p) => ({ ...p, [character.name]: { status: 'rendering' } }))
      try {
        // Hero = SP nhân cách hóa → khóa bao bì thật bằng ảnh sản phẩm (chống drift màu/nhãn).
        const isProductHero = character.role === 'hero'
        const { refImage } = await renderCharacterRef({
          apiKey: kieKey, character,
          productRefs: isProductHero ? productRefs : [],
        })
        bankRefs.current[character.name] = refImage
        setCharBank((p) => ({ ...p, [character.name]: { status: 'done', refImage } }))
        return refImage
      } catch (e) {
        setCharBank((p) => ({ ...p, [character.name]: { status: 'failed', error: e instanceof Error ? e.message : String(e) } }))
        return undefined
      } finally {
        delete bankInflight.current[character.name]
      }
    })()
    bankInflight.current[character.name] = task
    return task
  }

  // P2b — render bank cho TẤT CẢ nhân vật chưa có (pool 3 song song). Làm trước khi render cảnh.
  //   Gọi cho MỌI nhân vật: đã xong → bỏ qua tức thì, đang chạy → ĐỢI (không submit lại).
  async function handleRenderAllChars() {
    if (!script || bankRunning) return
    if (!kieKey) { setError('Thiếu KIE API key trong Cài đặt'); return }
    setBankRunning(true)
    try {
      await runPool(script.characters, 3, (c) => handleRenderCharacterRef(c))
    } finally { setBankRunning(false) }
  }

  // P2a — BƯỚC 1: render keyframe (ảnh tĩnh, rẻ) để DUYỆT trước i2v. → status 'kf_ready'.
  //   #2 — khóa diện mạo theo NHÂN VẬT XUẤT HIỆN (pickSceneVisuals), KHÔNG theo speaker →
  //   cảnh sản phẩm dùng ảnh bank HERO; cảnh đối đầu khóa cả 2. force = bấm "Đổi keyframe".
  async function handleRenderKeyframe(scene: PersonifiedScene, bankOverride?: Record<string, string>, force = false) {
    if (!script) return
    if (!kieKey) { setError('Thiếu KIE API key trong Cài đặt'); return }
    // #1 — đang render dở → ĐỢI chính nó (không submit lại). Đã có KF mà không force → bỏ qua.
    const inflight = kfInflight.current[scene.idx]
    if (inflight) return inflight
    const st = clips[scene.idx]?.status
    if (!force && (st === 'kf' || st === 'clip')) return
    const refOf = (name?: string) => name ? (bankOverride?.[name] ?? bankRefs.current[name] ?? charBank[name]?.refImage) : undefined
    const { main, extra } = pickSceneVisuals(scene, script.characters, product?.productName)
    setClips((p) => ({ ...p, [scene.idx]: { status: 'kf' } }))
    const task = (async () => {
      try {
        const { keyframeRef } = await renderKeyframe({
          apiKey: kieKey, scene, character: main,
          characterRef: refOf(main?.name),
          extraCharacter: extra, extraCharacterRef: refOf(extra?.name),
          productRefs: scene.hasProduct ? productRefs : [],
          worldEnv: script.worldEnv,
        })
        setClips((p) => ({ ...p, [scene.idx]: { status: 'kf_ready', keyframeRef } }))
      } catch (e) {
        setClips((p) => ({ ...p, [scene.idx]: { status: 'failed', error: e instanceof Error ? e.message : String(e) } }))
      } finally {
        delete kfInflight.current[scene.idx]
      }
    })()
    kfInflight.current[scene.idx] = task
    return task
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

  // GỘP: Tạo clip i2v + lồng giọng CHẠY SONG SONG (TTS không cần clip) → đỡ chờ.
  //   i2v (KIE) ∥ synthSceneVoice (ElevenLabs) → xong cả 2 thì mux. Cảnh không thoại → chỉ i2v.
  async function handleRenderClipVoice(scene: PersonifiedScene) {
    if (!script || !kieKey) { if (!kieKey) setError('Thiếu KIE API key trong Cài đặt'); return }
    const cur = clips[scene.idx]
    if (!cur?.keyframeRef) { setError('Cảnh này chưa có keyframe — tạo keyframe trước'); return }
    if (cur.status === 'clip') return
    const hasDialogue = !!(scene.dialoguePrimary ?? '').trim()
    const character = resolveSpeakerChar(scene, script.characters, product?.productName)
    const doVoice = hasDialogue && !!elevenKey
    setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], status: 'clip', lipStatus: doVoice ? 'tts' : p[scene.idx]?.lipStatus, error: undefined } }))
    // Chạy SONG SONG: i2v + giọng.
    const clipP = renderClipFromKeyframe({
      apiKey: kieKey, scene, tier, keyframeRef: cur.keyframeRef,
      onSubmit: (tid) => setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], status: 'clip', taskId: tid } })),
    })
    const voiceP = doVoice
      ? synthSceneVoice({ elevenKey, scene, character, voiceId: character ? charVoices[character.name] : undefined })
      : Promise.resolve(null)
    const [clipR, voiceR] = await Promise.allSettled([clipP, voiceP])

    if (clipR.status === 'rejected') {
      setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], status: 'kf_ready', error: clipR.reason instanceof Error ? clipR.reason.message : String(clipR.reason) } }))
      return
    }
    const { clipRef, taskId } = clipR.value
    setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], status: 'done', clipRef, taskId } }))
    if (voiceR.status === 'rejected') {
      setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], lipStatus: 'failed', lipError: voiceR.reason instanceof Error ? voiceR.reason.message : String(voiceR.reason) } }))
      return
    }
    const voice = voiceR.value
    if (!voice) return   // cảnh không thoại → xong ở clip
    try {
      setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], lipStatus: 'mux' } }))
      const voicedRef = await muxSceneVoiceover({ clipRef, voice, scene })
      setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], lipStatus: 'done', audioRef: voice.audioRef, lipsyncRef: voicedRef, voiceSec: voice.voiceSec } }))
    } catch (e) {
      setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], lipStatus: 'failed', lipError: e instanceof Error ? e.message : String(e) } }))
    }
  }

  // P2a — STORYBOARD: RÀNG BUỘC — Character Bank (khóa nhân vật) XONG TRƯỚC, rồi mới keyframe.
  //   #1 — NỐI TIẾP từ tiến trình hiện có: cái đang render (manual/all) thì ĐỢI, cái xong thì
  //   BỎ QUA, chỉ chạy cái thiếu/lỗi — KHÔNG chạy lại từ đầu. (Không guard cứng bankRunning nữa.)
  async function handleRenderAllKeyframes() {
    if (!script || renderingAll) return
    if (!kieKey) { setError('Thiếu KIE API key trong Cài đặt'); return }
    setRenderingAll(true)
    try {
      // BƯỚC 1: đảm bảo MỌI nhân vật có ảnh bank (pool 3). handleRenderCharacterRef idempotent:
      // xong → trả ngay · đang chạy → ĐỢI chính nó · thiếu/lỗi → render. Gom map ref TƯƠI.
      const bankMap: Record<string, string> = { ...bankRefs.current }
      setBankRunning(true)
      try {
        await runPool(script.characters, 3, async (c) => { const ref = await handleRenderCharacterRef(c); if (ref) bankMap[c.name] = ref })
      } finally { setBankRunning(false) }
      // BƯỚC 2: keyframe storyboard (pool 3). Bỏ cảnh đã có KF (kf_ready/done); cảnh ĐANG render
      // (kf) vẫn đưa vào để handleRenderKeyframe ĐỢI promise đang chạy (không submit lại).
      const todo = script.scenes.filter((s) => {
        const st = clips[s.idx]?.status
        return !(st === 'kf_ready' || st === 'clip' || st === 'done')
      })
      await runPool(todo, 3, (s) => handleRenderKeyframe(s, bankMap))
    } finally { setRenderingAll(false) }
  }

  // P2c — lồng giọng 1 cảnh (TTS → ghép voiceover vào clip i2v, 0 credit). Cần clip + thoại.
  async function handleVoiceoverScene(scene: PersonifiedScene) {
    const cur = clips[scene.idx]
    if (!cur?.clipRef) { setError('Cảnh chưa có clip i2v — render clip trước'); return }
    if (!(scene.dialoguePrimary ?? '').trim()) { setError('Cảnh không có thoại — không cần lồng giọng'); return }
    if (!elevenKey) { setError('Thiếu ElevenLabs API key (giọng) trong Cài đặt'); return }
    if (cur.lipStatus === 'tts' || cur.lipStatus === 'mux') return
    const character = script ? resolveSpeakerChar(scene, script.characters, product?.productName) : undefined
    setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], lipStatus: 'tts', lipError: undefined } }))
    try {
      const { audioRef, voicedRef, voiceSec } = await addSceneVoiceover({
        elevenKey, scene, character, clipRef: cur.clipRef,
        voiceId: character ? charVoices[character.name] : undefined,
        onStage: (stage) => setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], lipStatus: stage === 'done' ? 'done' : stage } })),
      })
      setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], lipStatus: 'done', audioRef, lipsyncRef: voicedRef, voiceSec } }))
    } catch (e) {
      setClips((p) => ({ ...p, [scene.idx]: { ...p[scene.idx], lipStatus: 'failed', lipError: e instanceof Error ? e.message : String(e) } }))
    }
  }

  // P2c — lồng giọng TẤT CẢ cảnh có clip + có thoại. force=true → lồng LẠI cả cảnh đã xong
  //   (dùng khi đổi giọng sau khi lỡ chạy — TTS + ghép lại bằng giọng MỚI, 0 credit KIE).
  async function handleVoiceoverAll(force = false) {
    if (!script || renderingAll) return
    if (!elevenKey) { setError('Thiếu ElevenLabs API key (giọng) trong Cài đặt'); return }
    if (force && !window.confirm('Lồng LẠI giọng cho TẤT CẢ cảnh bằng giọng đang chọn hiện tại? (0 credit KIE, chỉ tốn ElevenLabs + thời gian ghép)')) return
    setRenderingAll(true)
    try {
      const todo = script.scenes.filter((s) => {
        const c = clips[s.idx]
        return c?.clipRef && (s.dialoguePrimary ?? '').trim() && (force || c.lipStatus !== 'done')
      })
      await runPool(todo, 3, (s) => handleVoiceoverScene(s))
    } finally { setRenderingAll(false) }
  }

  // P2d — GHÉP video cuối: nối clip mọi cảnh (lipsync nếu có, không thì i2v câm) + upscale 720p.
  async function handleAssemble() {
    if (!script || finalVideo.status === 'running') return
    const list = script.scenes
      .filter((s) => clips[s.idx]?.clipRef)
      .map((s) => {
        const c = clips[s.idx]!
        const voiced = !!c.lipsyncRef
        return {
          // Cảnh có giọng → dùng voiced clip (đã có caption) + audioRef + đúng độ dài giọng;
          // cảnh câm → i2v clip + im, dài bằng slot.
          videoRef: voiced ? c.lipsyncRef! : c.clipRef!,
          audioRef: voiced ? c.audioRef : undefined,
          durationSec: voiced ? (c.voiceSec ?? s.clipDuration) : s.clipDuration,
        }
      })
    if (!list.length) { setError('Chưa cảnh nào có clip — render clip trước khi ghép'); return }
    setFinalVideo({ status: 'running', stage: 'Bắt đầu…' })
    const run = (resolution: '720p' | '480p') => assemblePersonifiedVideo({
      clips: list, resolution,
      onStage: (m) => setFinalVideo((p) => ({ ...p, status: 'running', stage: m })),
    })
    try {
      const res = await run('720p')
      setFinalVideo({ status: 'done', videoRef: res.videoRef })
      setSavedToLib(false)   // video mới → cho lưu lại
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const isOom = /memory access out of bounds|out of memory|\boom\b|abort\(\)|table index is out of bounds/i.test(msg)
      // Worker wasm có thể đã CHẾT sau OOM → reset để không "bấm lại vẫn lỗi tới khi F5".
      await resetFFmpeg().catch(() => {})
      if (isOom) {
        try {
          setFinalVideo({ status: 'running', stage: 'RAM đầy ở 720p — tự ghép lại ở 480p…' })
          const res = await run('480p')
          setFinalVideo({ status: 'done', videoRef: res.videoRef })
          setSavedToLib(false)
          return
        } catch (e2) {
          await resetFFmpeg().catch(() => {})
          setFinalVideo({ status: 'failed', error: (e2 instanceof Error ? e2.message : String(e2)) + ' (đã thử cả 480p)' })
          return
        }
      }
      setFinalVideo({ status: 'failed', error: msg })
    }
  }

  // P2e — lưu video cuối vào thư viện (local + cloud).
  async function handleSaveToLibrary() {
    if (!finalVideo.videoRef || !script || savedToLib) return
    const stamp = new Date().toLocaleDateString('vi-VN')
    const item: LibVideo = {
      id: crypto.randomUUID(),
      title: `${product?.productName || 'Video'} · ${market} · ${stamp}`,
      videoRef: finalVideo.videoRef, market,
      sceneCount: script.scenes.length, totalSec: voicedAny ? realTotalSec : script.totalSec, createdAt: Date.now(),
    }
    await addToLibrary(item)
    setLibrary(getLibraryLocal())
    setSavedToLib(true)
  }

  async function handleDeleteFromLib(id: string) {
    await removeFromLibrary(id)
    setLibrary(getLibraryLocal())
  }

  // ── DỰ ÁN: lưu toàn bộ kịch bản + tiến trình (snapshot = PersistedState) ──
  async function handleSaveProject() {
    if (!script || savingProject) { if (!script) setError('Chưa có kịch bản để lưu'); return }
    setSavingProject(true)
    try {
      const snapshot: PersistedState = { v: 1, productId, market, problemHint, insight, config, script, variant, tier, clips, charBank, charVoices, finalVideoRef: finalVideo.videoRef }
      const stamp = new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
      const item: LibProject = {
        id: crypto.randomUUID(),
        title: `${product?.productName || 'Dự án'} · ${market} · ${stamp}`,
        productName: product?.productName || '', market,
        sceneCount: script.scenes.length, createdAt: Date.now(), snapshot,
      }
      await saveProject(item)
      setProjects(getProjectsLocal())
    } catch (e) {
      setError('Lưu kịch bản lỗi: ' + ((e as Error).message || '').slice(0, 80))
    } finally { setSavingProject(false) }
  }
  // Mở project = ghi snapshot vào CACHE_KEY rồi reload → tái dùng ĐÚNG đường hydrate đã kiểm chứng.
  function handleOpenProject(p: LibProject) {
    if (!confirm('Mở dự án này? Tiến trình hiện tại chưa lưu sẽ bị thay thế.')) return
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(p.snapshot)) } catch { /* quota */ }
    window.location.reload()
  }
  async function handleDeleteProject(id: string) {
    if (!confirm('Xoá vĩnh viễn dự án này?')) return
    await removeProject(id)
    setProjects(getProjectsLocal())
  }

  // P2a — i2v + GIỌNG (song song) TẤT CẢ cảnh đã duyệt keyframe. Cảnh chưa có keyframe → bỏ qua.
  async function handleRenderAllClips() {
    if (!script || renderingAll) return
    if (!kieKey) { setError('Thiếu KIE API key trong Cài đặt'); return }
    setRenderingAll(true)
    try {
      const todo = script.scenes.filter((s) => clips[s.idx]?.status === 'kf_ready')
      await runPool(todo, 3, (s) => handleRenderClipVoice(s))
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
        <button onClick={() => void handleSaveProject()} disabled={!script || savingProject}
          title="Lưu toàn bộ kịch bản + tiến trình (clip/giọng đã sinh) — mở lại để làm tiếp, khỏi sinh lại"
          className="ml-auto flex items-center gap-1 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-fuchsia-700 disabled:opacity-40">
          {savingProject ? '⏳ Đang lưu…' : '💾 Lưu kịch bản'}
        </button>
        <button onClick={() => setShowLibrary((v) => !v)}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${showLibrary ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          📚 Thư viện{(library.length + projects.length) > 0 && ` (${library.length + projects.length})`}
        </button>
      </div>

      {/* P2e — Thư viện video đã lưu */}
      {showLibrary && (
        <div className="mx-6 mt-4 rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
          {/* Dự án — kịch bản + toàn bộ tiến trình (mở lại làm tiếp, khỏi sinh lại) */}
          <div className="mb-4 border-b border-black/8 pb-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">📝 Dự án đã lưu ({projects.length})</div>
            {projects.length === 0
              ? <p className="text-xs text-gray-400">Chưa có dự án. Bấm "💾 Lưu kịch bản" ở trên để lưu toàn bộ tiến trình (clip/giọng đã sinh) → mở lại làm tiếp.</p>
              : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((p) => (
                    <div key={p.id} className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/40 p-2.5">
                      <p className="truncate text-xs font-bold text-gray-800" title={p.title}>{p.title}</p>
                      <p className="text-[10px] text-gray-400">{p.market} · {p.sceneCount} cảnh · {new Date(p.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</p>
                      <div className="mt-1.5 flex gap-1.5">
                        <button onClick={() => handleOpenProject(p)} className="flex-1 rounded-md bg-fuchsia-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-fuchsia-700">↗ Mở làm tiếp</button>
                        <button onClick={() => void handleDeleteProject(p.id)} className="rounded-md border border-black/10 px-2 py-1 text-[11px] text-gray-500 hover:bg-red-50 hover:text-red-600">Xoá</button>
                      </div>
                    </div>
                  ))}
                </div>}
          </div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">📚 Thư viện video ({library.length})</div>
          {library.length === 0
            ? <p className="text-xs text-gray-400">Chưa có video nào. Ghép xong 1 video → bấm "💾 Lưu vào thư viện".</p>
            : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {library.map((v) => (
                  <div key={v.id} className="rounded-lg border border-black/10 bg-gray-50 p-2">
                    <LibVideoCard item={v} onDelete={() => handleDeleteFromLib(v.id)} />
                  </div>
                ))}
              </div>}
        </div>
      )}

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
              <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700"
                title={voicedAny ? `Độ dài thật theo giọng ~${realTotalSec}s (render ${script.totalSec}s, ghép cắt/kéo về giọng) · mục tiêu ~${LENGTH_TARGET_SEC[config.length]}s` : `Render ~${script.totalSec}s · mục tiêu ~${LENGTH_TARGET_SEC[config.length]}s`}>
                {script.scenes.length} cảnh · ~{voicedAny ? realTotalSec : script.totalSec}s <span className="font-normal text-gray-400">(mục tiêu ~{LENGTH_TARGET_SEC[config.length]}s)</span></span>
              <label className="flex items-center gap-1">
                <span className="text-gray-500">Tier render:</span>
                <select value={tier} onChange={(e) => setTier(e.target.value as RenderTier)}
                  className="rounded border border-black/10 bg-white px-2 py-1 text-xs">
                  {(Object.keys(RENDER_TIER_LABEL) as RenderTier[]).map((t) => <option key={t} value={t}>{RENDER_TIER_LABEL[t]}</option>)}
                </select>
              </label>
              {credit && <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700" title="Credit KIE: ảnh nhân vật (bank) + keyframe + i2v. Giọng do ElevenLabs (ví riêng) + ghép ffmpeg (0 credit).">KIE {formatCreditEstimate(credit)} · giọng riêng</span>}
              {/* P2a — STORYBOARD GATE: keyframe tất cả (rẻ, để duyệt) → soi xong → clip tất cả (i2v, đắt) */}
              <button onClick={handleRenderAllKeyframes} disabled={renderingAll || bankRunning || !kieKey}
                className="ml-auto flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-40"
                title={kieKey ? 'Tự render Character Bank (khóa nhân vật) TRƯỚC, rồi keyframe mọi cảnh dùng ảnh bank đó (nhất quán)' : 'Thiếu KIE key trong Cài đặt'}>
                {renderingAll ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang chạy…</> : <>🎭→🖼️ Bank + Keyframe tất cả</>}
              </button>
              <button onClick={handleRenderAllClips} disabled={renderingAll || !kieKey || kfReadyCount === 0}
                className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
                title={kfReadyCount > 0 ? `i2v + lồng giọng song song ${kfReadyCount} cảnh (i2v tốn KIE, giọng ElevenLabs)` : 'Duyệt keyframe trước (chưa cảnh nào sẵn sàng i2v)'}>
                {renderingAll ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang chạy…</> : <>🎬 Clip + giọng tất cả{kfReadyCount > 0 && ` (${kfReadyCount})`}</>}
              </button>
              {/* P2c — lồng giọng tất cả cảnh có clip + thoại (TTS + ghép ffmpeg, 0 credit KIE) */}
              <button onClick={() => handleVoiceoverAll(false)} disabled={renderingAll || !elevenKey || lipReadyCount === 0}
                className="flex items-center gap-1 rounded-lg bg-fuchsia-600 px-3 py-1.5 font-bold text-white transition-colors hover:bg-fuchsia-700 disabled:opacity-40"
                title={!elevenKey ? 'Cần ElevenLabs key (giọng) trong Cài đặt' : lipReadyCount > 0 ? `Lồng giọng ${lipReadyCount} cảnh (TTS, 0 credit KIE)` : 'Render clip i2v trước'}>
                {renderingAll ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang chạy…</> : <>🎙️ Lồng giọng tất cả{lipReadyCount > 0 && ` (${lipReadyCount})`}</>}
              </button>
              {/* Lồng LẠI tất cả (ép) — dùng khi đổi giọng SAU KHI đã chạy (vd lỡ ra giọng nữ). 0 credit KIE. */}
              {voicedDoneCount > 0 && (
                <button onClick={() => handleVoiceoverAll(true)} disabled={renderingAll || !elevenKey}
                  className="flex items-center gap-1 rounded-lg border border-fuchsia-400 bg-fuchsia-50 px-3 py-1.5 font-bold text-fuchsia-700 transition-colors hover:bg-fuchsia-100 disabled:opacity-40"
                  title="Lồng LẠI giọng cho mọi cảnh bằng giọng đang chọn hiện tại (sau khi đổi giọng). 0 credit KIE.">
                  {renderingAll ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang chạy…</> : <>🔁 Lồng lại tất cả</>}
                </button>
              )}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700">✅ Video hoàn chỉnh (720p)</span>
                      <button onClick={handleSaveToLibrary} disabled={savedToLib}
                        className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-50">
                        {savedToLib ? <>✅ Đã lưu thư viện</> : <>💾 Lưu vào thư viện</>}
                      </button>
                    </div>
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
                    <div className="flex items-stretch">
                    <button onClick={() => setExpandedScene(expandedScene === s.idx ? null : s.idx)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-violet-50/40">
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
                      {/* Đã lồng giọng → hiện ĐỘ DÀI THẬT (giọng) vì ghép cắt/kéo về đây; chưa thì hiện độ dài render */}
                      <span className="w-9 shrink-0 text-[11px] font-bold text-amber-700"
                        title={clips[s.idx]?.voiceSec ? `Render ${s.clipDuration}s · ghép còn ${clips[s.idx]!.voiceSec!.toFixed(1)}s theo giọng` : `Render ${s.clipDuration}s`}>
                        {clips[s.idx]?.voiceSec ? `${clips[s.idx]!.voiceSec!.toFixed(1)}s` : `${s.clipDuration}s`}
                      </span>
                      {/* #2 — dòng trên = NHÂN VẬT TRONG KHUNG (khóa diện mạo); dòng dưới 🎙️ = NGƯỜI NÓI
                          (chọn giọng). Hiện 🎙️ khi người nói KHÁC nhân vật chính trong khung → khỏi nhầm. */}
                      {(() => {
                        const v = pickSceneVisuals(s, script.characters, product?.productName)
                        const names = [v.main?.name, v.extra?.name].filter(Boolean).join(' + ')
                        const spk = resolveSpeakerChar(s, script.characters, product?.productName)
                        const showSpk = spk && spk.name !== v.main?.name
                        return (
                          <span className="w-20 shrink-0 truncate text-[11px] text-gray-400" title={`Trong khung: ${names || '—'} · 🎙️ Giọng: ${spk?.name ?? s.speaker}`}>
                            {names || s.speaker}
                            {showSpk && <span className="block truncate text-[9px] text-fuchsia-500">🎙️ {spk!.name}</span>}
                          </span>
                        )
                      })()}
                      <span className="flex-1 truncate text-xs text-gray-900">"{s.dialoguePrimary}"</span>
                      <span className="w-6 shrink-0 text-center text-[11px]" title={`${clips[s.idx]?.status ?? ''}${clips[s.idx]?.lipStatus ? ' · lip:' + clips[s.idx]?.lipStatus : ''}`}>
                        {clips[s.idx]?.lipStatus === 'tts' || clips[s.idx]?.lipStatus === 'mux' ? '🎙️'
                          : clips[s.idx]?.status === 'kf' || clips[s.idx]?.status === 'clip' ? '⏳'
                          : clips[s.idx]?.status === 'kf_ready' ? '🖼️'
                          : clips[s.idx]?.status === 'done' ? (clips[s.idx]?.lipStatus === 'done' ? '✅🎙️' : '✅')
                          : clips[s.idx]?.status === 'failed' ? '❌' : ''}
                      </span>
                    </button>
                    <button onClick={() => handleDeleteScene(s.idx)} title={`Xóa cảnh ${s.idx} (kể cả khi đã render)`}
                      className="flex w-9 shrink-0 items-center justify-center text-rose-300 transition-colors hover:bg-rose-50 hover:text-rose-600">🗑</button>
                    </div>
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
                        {/* #3 — NGƯỜI NÓI (chọn GIỌNG cảnh này) — sửa được. Đổi → lồng giọng lại cảnh đó. */}
                        <label className="block">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-600">🎙️ Người nói (giọng) — sửa được</span>
                          <select
                            value={resolveSpeakerChar(s, script.characters, product?.productName)?.name ?? ''}
                            onChange={(e) => updateScene(s.idx, { speaker: e.target.value })}
                            className="mt-0.5 w-full rounded border border-fuchsia-200 bg-white px-2 py-1 text-[11px] text-gray-800 focus:border-fuchsia-400 focus:outline-none">
                            {script.characters.map((c) => <option key={c.name} value={c.name}>{c.name} · {c.role}</option>)}
                          </select>
                          {clips[s.idx]?.lipStatus === 'done' && (
                            <span className="mt-0.5 block text-[10px] text-amber-600">⚠ Đổi người nói rồi thì bấm "🎙️ Lồng giọng lại" cảnh này (0 credit) để đổi giọng.</span>
                          )}
                        </label>
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
                          // #2 — nhân vật khóa diện mạo = nhân vật TRONG KHUNG (main + phụ), không phải speaker.
                          const { main, extra } = pickSceneVisuals(s, script.characters, product?.productName)
                          const visChars = [main, extra].filter((c): c is PersonifiedCharacter => !!c)
                          const unlocked = visChars.filter((c) => !charBank[c.name]?.refImage)
                          return (
                            <div className="space-y-1.5 pt-1">
                              {visChars.length > 0 && (
                                unlocked.length === 0
                                  ? <div className="text-[10px] font-semibold text-emerald-600">🎭 Khóa diện mạo từ bank: {visChars.map((c) => `"${c.name}"`).join(' + ')}</div>
                                  : <div className="text-[10px] text-amber-600">🎭 {unlocked.map((c) => `"${c.name}"`).join(', ')} chưa có ảnh bank → mặt có thể lệch giữa các cảnh. Tạo bank ở tab Nhân vật trước.</div>
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
                                {/* Bước 2 — i2v + giọng SONG SONG (chỉ bật khi đã có keyframe duyệt) */}
                                {clips[s.idx]?.keyframeRef && (
                                  <button onClick={() => handleRenderClipVoice(s)} disabled={busy || renderingAll || !kieKey}
                                    className="flex items-center gap-1 rounded bg-violet-600 px-2 py-1 text-[11px] font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-40">
                                    {st === 'clip'
                                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Đang i2v + giọng…</>
                                      : st === 'done'
                                      ? <><RefreshCw className="h-3 w-3" /> Tạo clip lại</>
                                      : <>✅ Tạo clip + giọng</>}
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

            {/* ── Đọc liền mạch: EDITOR SỬA THOẠI TỰ DO → Lưu → AI đồng bộ hình storyboard ── */}
            {scriptTab === 'read' && (() => {
              const dirty = readDraft !== buildReadDraft(script.scenes)
              return (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 text-[11px] text-gray-700">
                    <span>✏️ <b>Sửa thoại thoải mái</b> — giữ nhãn <code className="rounded bg-white px-1 font-mono text-violet-700">[Cảnh N]</code> để khớp đúng cảnh. Bấm <b>Lưu</b> → AI vẽ lại hình (keyframe/i2v) cho khớp thoại mới (rẻ, không tốn credit ảnh). Cảnh đổi hình sẽ phải render lại.</span>
                  </div>
                  <textarea
                    value={readDraft}
                    onChange={(e) => setReadDraft(e.target.value)}
                    rows={Math.min(22, Math.max(8, script.scenes.length * 2 + 2))}
                    spellCheck={false}
                    className="w-full resize-y rounded-lg border border-violet-200 bg-white p-3 text-sm leading-relaxed text-gray-800 focus:border-violet-400 focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={handleResyncScript} disabled={resyncing || !dirty || !geminiKey}
                      className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-40">
                      {resyncing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang đồng bộ hình…</> : <>💾 Lưu &amp; đồng bộ storyboard</>}
                    </button>
                    {dirty && !resyncing && (
                      <button onClick={() => setReadDraft(buildReadDraft(script.scenes))}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50">
                        ↩ Hoàn tác
                      </button>
                    )}
                    <button onClick={() => setReadDraft(buildReadDraft(script.scenes))}
                      title="Dựng lại editor từ bảng cảnh hiện tại (dùng khi thấy lệch số cảnh)"
                      className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50">
                      🔄 Dựng lại từ bảng cảnh ({script.scenes.length})
                    </button>
                    {dirty
                      ? <span className="text-[11px] font-semibold text-amber-600">● Đã sửa — chưa lưu</span>
                      : <span className="text-[11px] text-gray-400">Khớp storyboard</span>}
                    {!geminiKey && <span className="text-[11px] text-rose-600">cần Gemini key để đồng bộ</span>}
                  </div>
                  {(() => {
                    const labelCount = (readDraft.match(/\[\s*Cảnh\s*\d+\s*\]/gi) || []).length
                    return labelCount !== script.scenes.length
                      ? <p className="text-[11px] font-semibold text-rose-600">⚠ Editor có {labelCount} nhãn cảnh nhưng bảng cảnh {script.scenes.length} — bấm "🔄 Dựng lại từ bảng cảnh" cho khớp.</p>
                      : null
                  })()}
                  {!isVN && (
                    <>
                      <p className="pt-1 text-xs font-semibold text-gray-600">↳ Nghĩa VN (tự cập nhật sau khi Lưu)</p>
                      <div className="w-full whitespace-pre-wrap rounded-lg border border-black/10 bg-gray-50 p-3 text-sm leading-relaxed text-gray-600">
                        {script.fullVoiceScriptVi}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

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
                              <button onClick={() => handleRenderCharacterRef(ch, !!bank?.refImage)} disabled={bank?.status === 'rendering' || bankRunning || !kieKey}
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
                            {/* Giọng ElevenLabs (v3) per-nhân-vật: chọn từ thư viện / clone / nghe thử */}
                            <div className="mt-1.5 border-t border-black/5 pt-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-600">🎙️ Giọng (ElevenLabs v3)</span>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <select value={charVoices[ch.name] ?? ''} onChange={(e) => setCharVoices((p) => ({ ...p, [ch.name]: e.target.value }))}
                                  className="max-w-[150px] rounded border border-black/10 bg-white px-2 py-1 text-[11px]">
                                  <option value="">— Tự động —</option>
                                  {myVoices.map((v) => <option key={v.voice_id} value={v.voice_id}>{v.name}{v.category === 'cloned' ? ' (clone)' : ''}</option>)}
                                </select>
                                <button onClick={() => setVoiceModal({ kind: 'lib', charName: ch.name })} disabled={!elevenKey}
                                  className="rounded border border-fuchsia-300 bg-fuchsia-50 px-2 py-1 text-[11px] font-bold text-fuchsia-700 hover:bg-fuchsia-100 disabled:opacity-40">📚 Thư viện</button>
                                <button onClick={() => setVoiceModal({ kind: 'clone', charName: ch.name })} disabled={!elevenKey}
                                  className="rounded border border-fuchsia-300 bg-fuchsia-50 px-2 py-1 text-[11px] font-bold text-fuchsia-700 hover:bg-fuchsia-100 disabled:opacity-40">🎤 Clone</button>
                                {charVoices[ch.name] && (
                                  <button onClick={() => handlePreviewVoice(ch.name, charVoices[ch.name])} disabled={!!previewingVoice}
                                    className="rounded bg-fuchsia-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-fuchsia-700 disabled:opacity-40">
                                    {previewingVoice === ch.name ? '⏳ đang phát…' : '🔊 Thử'}</button>
                                )}
                              </div>
                              {elevenKey && charVoices[ch.name] && (() => {
                                const sv = myVoices.find((v) => v.voice_id === charVoices[ch.name])
                                if (!sv) return null
                                const langOk = voiceMatchesMarket(sv, market)
                                const g = voiceGender(sv)
                                const want = charWantGender(ch)
                                const genderBad = g && g !== want   // biết chắc lệch giới
                                return (
                                  <div className="mt-0.5 space-y-0.5">
                                    {langOk
                                      ? <span className="block text-[10px] font-semibold text-emerald-600">⭐ Giọng hợp {isVN ? 'Việt Nam' : 'Malaysia'}{autoVoiced.current.has(ch.name) ? ' (AI gợi ý)' : ''}</span>
                                      : <span className="block text-[10px] text-amber-600">⚠ Giọng này có thể không phải tiếng {isVN ? 'Việt' : 'Mã'}</span>}
                                    {genderBad && (
                                      <span className="block text-[10px] font-semibold text-rose-600">⚠ Lệch giới tính: giọng {g === 'female' ? 'NỮ' : 'NAM'} nhưng nhân vật là {want === 'female' ? 'NỮ' : 'NAM'} — đổi giọng cho khớp</span>
                                    )}
                                  </div>
                                )
                              })()}
                              {elevenKey && myVoices.length > 0 && !myVoices.some((v) => voiceMatchesMarket(v, market)) &&
                                <span className="mt-0.5 block text-[10px] text-amber-600">Thư viện chưa có giọng {isVN ? 'Việt' : 'Mã'} → bấm 📚 Thư viện thêm</span>}
                              {!elevenKey && <span className="text-[10px] text-amber-600">cần ElevenLabs key trong Cài đặt</span>}
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

      {/* Modal chọn giọng từ thư viện ElevenLabs / clone giọng — gán cho 1 nhân vật */}
      <VoiceLibraryModal
        open={voiceModal?.kind === 'lib'}
        onClose={() => setVoiceModal(null)}
        onAdded={(voiceId) => {
          if (voiceModal) setCharVoices((p) => ({ ...p, [voiceModal.charName]: voiceId }))
          void refreshMyVoices()
          setVoiceModal(null)
        }}
      />
      <CloneVoiceModal
        open={voiceModal?.kind === 'clone'}
        onClose={() => setVoiceModal(null)}
        onCloned={(voiceId) => {
          if (voiceModal) setCharVoices((p) => ({ ...p, [voiceModal.charName]: voiceId }))
          void refreshMyVoices()
          setVoiceModal(null)
        }}
      />
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

// P2e — thẻ video trong thư viện: preview + tiêu đề + tải + xoá.
function LibVideoCard({ item, onDelete }: { item: LibVideo; onDelete: () => void }) {
  const url = useAssetUrl(item.videoRef)
  return (
    <div className="space-y-1.5">
      {url
        ? <video src={url} controls playsInline muted className="w-full rounded border border-black/10" />
        : <div className="flex h-32 w-full items-center justify-center rounded border border-black/10 bg-gray-100 text-[11px] text-gray-400">đang tải…</div>}
      <div className="truncate text-[11px] font-semibold text-gray-800" title={item.title}>{item.title}</div>
      <div className="text-[10px] text-gray-400">{item.sceneCount} cảnh · {item.totalSec}s · {new Date(item.createdAt).toLocaleDateString('vi-VN')}</div>
      <div className="flex items-center gap-2">
        {url && <a href={url} download="personified-video.mp4" className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">⬇️ Tải</a>}
        <button onClick={onDelete} className="rounded bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-200">🗑️ Xoá</button>
      </div>
    </div>
  )
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
