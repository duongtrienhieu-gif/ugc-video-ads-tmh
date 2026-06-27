// ── Mode 3 — Personified RENDER core (P2a) ───────────────────────────────────
// 1 cảnh → KEYFRAME (gpt-4o-image, nhân vật 3D) → i2v Seedance 1.5 Pro 480p (no-audio)
// → clip CÂM. Tái dùng KIE utils chung (kieai.ts), Mode 3 standalone — KHÔNG phụ thuộc
// logic preset của v3. Lipsync (P2c) + ghép/upscale (P2d) là bước sau.
// ─────────────────────────────────────────────────────────────────────────────

import {
  generateGpt4oImageFast, generateVideoJob, pollVideoJobUntilDone, type Resolution,
} from '../../../utils/kieai'
import { textToSpeech } from '../../../utils/elevenlabs'
import { submitLatentSync, pollLatentSyncUntilDone } from '../../../utils/falai'
import { saveAsset, getUrl, isAssetRef } from '../../../utils/assetStore'
import type { PersonifiedScene, PersonifiedCharacter, VoiceProfile } from '../types'
import { type RenderTier, CINEMATIC_STYLE, CHARACTER_SHEET_STYLE } from '../constants'

function tierToModel(tier: RenderTier): string {
  return tier === 'grok480' ? 'grok-imagine/image-to-video' : 'bytedance/seedance-1.5-pro'
}
function tierToRes(tier: RenderTier): Resolution {
  return tier === 'seedance720' ? '720p' : '480p'
}

/** Prompt CHARACTER SHEET — render 1 lần/nhân vật để khóa diện mạo (Character Bank, P2b).
 *  Pose trung tính, nền studio trơn → dễ dùng làm reference i2i cho mọi cảnh sau.
 *  hasProductRef = nhân vật HERO chính là SẢN PHẨM nhân cách hóa → khóa bao bì/màu/nhãn
 *  từ ảnh thật (ref #1), CHỈ thêm mắt + tay/chân, BỎ QUA màu mô tả trong text (chống drift). */
function buildCharacterSheetPrompt(character: PersonifiedCharacter, hasProductRef: boolean): string {
  const base = (character.imagePromptEn ?? '').trim() || (character.appearance ?? '').trim() || 'A 3D Pixar cartoon character'
  if (hasProductRef) {
    // HERO = sản phẩm thật. Reference image = bao bì thật → giữ NGUYÊN packaging.
    // CHỈ nhân cách hóa 1 đơn vị = cái TUÝP (lõi SP); references có thể kèm hộp/carton →
    // KHÔNG biến hộp thành nhân vật thứ 2, hộp chỉ là tham chiếu nhãn/màu.
    return `The references show the REAL PRODUCT. Create EXACTLY ONE single cartoon character: personify ONLY the squeeze TUBE (the primary product unit). If the references also show an outer box / carton / a second unit, do NOT personify it and do NOT add a second character — render ONE tube character only; treat the box solely as a colour and label reference. Keep the tube's packaging, label text, brand name, colours, gradients and shape EXACTLY as in the reference — do NOT change the colour, do NOT recolour, do NOT invent a new label. ONLY add expressive cartoon eyes, small cartoon arms with gloved hands, and little legs with shoes, while the body stays the real tube. ${character.represents ? `It represents: ${character.represents}.` : ''} Ignore any colour or packaging described in words — the colour and label come ONLY from the reference product image. ${CHARACTER_SHEET_STYLE}`
  }
  return `${base} ${CHARACTER_SHEET_STYLE}`
}

/** Prompt KEYFRAME 1 cảnh. Index ảnh ref phụ thuộc có ảnh nhân vật (bank) hay không:
 *  - có charRef → #1 = NHÂN VẬT (giữ y diện mạo), #2 = sản phẩm thật (nếu hasProduct)
 *  - không charRef → sinh nhân vật từ text; #1 = sản phẩm thật (nếu hasProduct)
 *  Giữ luật "preserve product" của repo (copy bao bì, cấm bịa). */
function buildKeyframePrompt(
  scene: PersonifiedScene, character: PersonifiedCharacter | undefined,
  opts: { hasCharRef: boolean; hasProductRef: boolean; worldEnv?: string },
): string {
  const base = (character?.imagePromptEn ?? '').trim() || (scene.action ?? '').trim() || 'A 3D Pixar cartoon character'
  const mood = scene.emotion ? ` Expression / mood: ${scene.emotion}.` : ''
  const act = (scene.action ?? '').trim() ? ` Scene: ${scene.action.trim()}.` : ''
  // A — BIOME CỐ ĐỊNH: nhồi vào MỌI cảnh → 9 cảnh chung 1 thế giới (như video mẫu).
  const world = (opts.worldEnv ?? '').trim()
    ? ` The whole scene takes place inside this consistent environment: ${opts.worldEnv!.trim()}.`
    : ''
  // B — HERO VFX: nhân vật hero (= sản phẩm) ở cảnh hành động (KHÔNG phải cta) được THÊM
  // hiệu ứng anh hùng (hào quang/khiên/áo choàng) — chỉ là EFFECT, KHÔNG đổi bao bì.
  const isHeroVfx = character?.role === 'hero' && scene.sceneType !== 'cta'
  const heroVfx = isHeroVfx
    ? ' Render it as an epic hero: surround the product with a glowing energy aura, a translucent light shield and a flowing cape, dynamic motion energy and sparks — these are ADDED visual effects only and must NOT change the product packaging, label, colour or shape.'
    : ''
  const charLock = opts.hasCharRef
    ? ` The MAIN CHARACTER is reference image #1 — keep the EXACT same face, body, colour, material and packaging; change only the pose and expression to match this scene${isHeroVfx ? ' (you MAY add the heroic effects described below around it)' : ', and do NOT redesign the character'}.`
    : ''
  const productIdx = opts.hasCharRef ? '#2' : '#1'
  const product = opts.hasProductRef
    ? ` The REAL PRODUCT appears in frame EXACTLY as reference image ${productIdx} — same packaging, label, colour, shape and on-pack text; do NOT invent, alter, or re-spell any packaging or text, copy it from the reference.`
    : ''
  // Khi đã khóa nhân vật bằng ảnh ref thì không cần tả lại base (tránh prompt "đè" lên ảnh).
  const desc = opts.hasCharRef ? '' : `${base} `
  return `${desc}${charLock}${mood}${act}${world}${product}${heroVfx} ${CINEMATIC_STYLE}`
}

export interface RenderSceneParams {
  apiKey: string
  scene: PersonifiedScene
  /** Nhân vật nói/chủ thể của cảnh (cho imagePromptEn). */
  character?: PersonifiedCharacter
  /** Ảnh chân dung nhân vật từ Character Bank (P2b) — khóa diện mạo xuyên cảnh (i2i ref #1). */
  characterRef?: string
  /** Biome cố định của video (PersonifiedScript.worldEnv) — nhồi vào keyframe để nhất quán bối cảnh. */
  worldEnv?: string
  /** Ảnh sản phẩm thật (asset ref hoặc URL) — chỉ dùng khi scene.hasProduct. */
  productRefs?: string[]
  tier: RenderTier
  signal?: AbortSignal
  onStage?: (stage: 'keyframe' | 'i2v' | 'done', info?: { keyframeRef?: string; taskId?: string; clipRef?: string }) => void
}

export interface RenderSceneResult { keyframeRef: string; clipRef: string; taskId: string }

// ─────────────────────────────────────────────────────────────────────────────
// CỔNG DUYỆT VISUAL (giống B2 hybrid): tách KEYFRAME (rẻ ~6cr, ảnh tĩnh để soi
// mặt nhân vật + bao bì) khỏi i2v (đắt ~10-12cr, chỉ làm-động ảnh đã duyệt).
// → user xem keyframe, re-roll nếu drift, OK mới tốn credit i2v.
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve asset ref → URL công khai (KIE đọc được). Bỏ qua ref rỗng/hỏng. */
async function refToUrl(ref: string | undefined): Promise<string | null> {
  if (!ref || !ref.trim()) return null
  return isAssetRef(ref) ? await getUrl(ref) : ref
}

/** OpenAI/gpt-4o-image chặn nội dung gore/y-khoa-thật (vd "quỷ xương khớp", "swollen red
 *  tissue, bone ends"). Phát hiện lỗi content-policy để thử lại bản đã làm mềm. */
function isContentViolation(msg: string): boolean {
  const l = msg.toLowerCase()
  return l.includes('content polic') || l.includes('violate') || l.includes('inappropriate')
    || l.includes('unsafe') || l.includes('community guidelines') || l.includes('safety system')
    || l.includes('rejected')
}
/** Mệnh đề ép cartoon brand-safe — gắn vào lần thử lại khi bị chặn. */
const SAFE_CARTOON_CLAUSE =
  ' IMPORTANT: keep it a wholesome, friendly kids-movie 3D cartoon with soft rounded shapes — ' +
  'NON-graphic, NO gore, NO blood, NO open wounds, NO realistic human anatomy, NO skeleton, ' +
  'NO surgical or medical-textbook imagery, NO body horror. Stylised and brand-safe.'

/** Gọi gpt-4o-image; nếu dính content-policy → thử lại 1 lần với mệnh đề cartoon an toàn. */
async function genImageModSafe(p: {
  apiKey: string; prompt: string; filesUrl: string[]; signal?: AbortSignal
}): Promise<string> {
  try {
    return await generateGpt4oImageFast({
      apiKey: p.apiKey, prompt: p.prompt, filesUrl: p.filesUrl, size: '2:3',
      softTimeoutMs: 100_000, attemptTimeoutMs: 150_000, maxAttempts: 3, signal: p.signal,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!isContentViolation(msg)) throw e
    // Thử lại 1 lần: ép cartoon an toàn (làm mềm mô tả gore/y khoa).
    return await generateGpt4oImageFast({
      apiKey: p.apiKey, prompt: p.prompt + SAFE_CARTOON_CLAUSE, filesUrl: p.filesUrl, size: '2:3',
      softTimeoutMs: 100_000, attemptTimeoutMs: 150_000, maxAttempts: 2, signal: p.signal,
    })
  }
}

/** P2b — render CHARACTER SHEET 1 nhân vật (1 lần) → { refImage }. Lưu vào Character Bank,
 *  dùng làm ref khóa diện mạo cho mọi cảnh có nhân vật đó.
 *  productRefs: chỉ truyền cho nhân vật HERO (= SP nhân cách hóa) → khóa bao bì thật,
 *  chống drift màu/nhãn (vd LANZF đỏ ra xanh). Villain/organ để rỗng (vật bịa). */
export async function renderCharacterRef(
  p: { apiKey: string; character: PersonifiedCharacter; productRefs?: string[]; signal?: AbortSignal },
): Promise<{ refImage: string }> {
  if (!p.apiKey) throw new Error('Thiếu KIE API key (Cài đặt)')
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')

  const filesUrl: string[] = []
  for (const ref of (p.productRefs ?? []).slice(0, 4)) {
    const url = await refToUrl(ref)
    if (url) filesUrl.push(url)
  }
  const prompt = buildCharacterSheetPrompt(p.character, filesUrl.length > 0)
  const remoteUrl = await genImageModSafe({ apiKey: p.apiKey, prompt, filesUrl, signal: p.signal })
  const blob = await fetch(remoteUrl).then((r) => r.blob())
  const refImage = await saveAsset(blob, blob.type || 'image/png')
  return { refImage }
}

/** Bước 1 — chỉ render KEYFRAME (ảnh tĩnh) → { keyframeRef }. Rẻ, để duyệt trước i2v.
 *  Nếu có characterRef (Character Bank) → ref #1 khóa diện mạo nhân vật; SP thật → ref #2. */
export async function renderKeyframe(
  p: Pick<RenderSceneParams, 'apiKey' | 'scene' | 'character' | 'characterRef' | 'productRefs' | 'worldEnv' | 'signal'>,
): Promise<{ keyframeRef: string }> {
  if (!p.apiKey) throw new Error('Thiếu KIE API key (Cài đặt)')
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')

  // Thứ tự ref BẮT BUỘC khớp index trong prompt: [nhân vật, ...sản phẩm].
  const filesUrl: string[] = []
  const charUrl = await refToUrl(p.characterRef)
  if (charUrl) filesUrl.push(charUrl)

  const useProduct = !!(p.scene.hasProduct && p.productRefs && p.productRefs.length > 0)
  if (useProduct) {
    for (const ref of p.productRefs!.slice(0, 4)) {
      const url = await refToUrl(ref)
      if (url) filesUrl.push(url)
    }
  }
  const kfPrompt = buildKeyframePrompt(p.scene, p.character, {
    hasCharRef: !!charUrl,
    hasProductRef: useProduct,
    worldEnv: p.worldEnv,
  })
  const remoteUrl = await genImageModSafe({ apiKey: p.apiKey, prompt: kfPrompt, filesUrl, signal: p.signal })
  const kfBlob = await fetch(remoteUrl).then((r) => r.blob())
  const keyframeRef = await saveAsset(kfBlob, kfBlob.type || 'image/png')
  return { keyframeRef }
}

/** Bước 2 — i2v từ KEYFRAME ĐÃ DUYỆT (Seedance 480p no-audio) → { clipRef }. Tốn credit. */
export async function renderClipFromKeyframe(
  p: Pick<RenderSceneParams, 'apiKey' | 'scene' | 'tier' | 'signal'> & { keyframeRef: string },
): Promise<{ clipRef: string; taskId: string }> {
  if (!p.apiKey) throw new Error('Thiếu KIE API key (Cài đặt)')
  if (!p.keyframeRef) throw new Error('Chưa có keyframe — tạo keyframe trước')
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')

  const kfPublic = await getUrl(p.keyframeRef)
  if (!kfPublic) throw new Error('Không lấy được URL keyframe')
  const sub = await generateVideoJob({
    apiKey: p.apiKey,
    jobModelId: tierToModel(p.tier),
    prompt: (p.scene.videoPromptEn ?? '').trim() || (p.scene.action ?? '').trim() || 'subtle natural motion',
    aspectRatio: '9:16',
    resolution: tierToRes(p.tier),
    duration: p.scene.clipDuration,
    startFrameUrl: kfPublic,
  })

  const clipUrl = await pollVideoJobUntilDone({
    apiKey: p.apiKey, taskId: sub.taskId, timeoutMs: 10 * 60 * 1000,
    logTag: `personified/${p.scene.sceneType}#${p.scene.idx}`,
  })
  const clipBlob = await fetch(clipUrl).then((r) => r.blob())
  const clipRef = await saveAsset(clipBlob, 'video/mp4')
  return { clipRef, taskId: sub.taskId }
}

/** Render 1 cảnh end-to-end (keyframe → i2v) → { keyframeRef, clipRef }. Dùng cho dev helper /
 *  luồng không cần cổng duyệt. UI chính dùng renderKeyframe + renderClipFromKeyframe riêng. */
export async function renderPersonifiedScene(p: RenderSceneParams): Promise<RenderSceneResult> {
  const { keyframeRef } = await renderKeyframe(p)
  p.onStage?.('keyframe', { keyframeRef })
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')
  p.onStage?.('i2v', { keyframeRef })
  const { clipRef, taskId } = await renderClipFromKeyframe({ ...p, keyframeRef })
  p.onStage?.('done', { keyframeRef, clipRef, taskId })
  return { keyframeRef, clipRef, taskId }
}

// ─────────────────────────────────────────────────────────────────────────────
// P2c — LIPSYNC: thoại nhân vật. TTS ElevenLabs multilingual_v2 (chuẩn MY/VN) →
// LatentSync (fal.ai, video→video) NHÉP MỒM lên clip i2v đã render (giữ chuyển động
// Seedance, chỉ thêm khẩu hình). Chỉ cảnh CÓ dialoguePrimary. Clip i2v giữ nguyên →
// nếu sync mồm cartoon kém có thể đổi engine mà không phải render lại i2v.
// ─────────────────────────────────────────────────────────────────────────────

// ElevenLabs premade multilingual voices (lấy từ voiceCategories.ts).
const EL_VOICE = {
  adam: 'pNInz6obpgDQGcFmaJgB',   // nam mạnh / hung hăng
  josh: 'TxGEqnHWrfWFTfGW9XjX',   // nam chuyên gia / điềm
  domi: 'AZnzlk1XvdvUeBnXmlld',   // nữ ấm / có lực
  bella: 'EXAVITQu4vr4xnSDxMaL',  // nữ nhẹ / mềm
}

/** Map VoiceProfile nhân vật → 1 voiceId ElevenLabs mặc định (user có thể đổi sau).
 *  Phân theo giới tính + tính cách (hung hăng → giọng có lực hơn). */
function pickVoiceId(v?: VoiceProfile): string {
  const male = v?.gioiTinh === 'nam'
  const punch = /hung|đanh|gắt|mạnh|dữ|khịa|cằn|quát|gào|trầm/i.test(`${v?.tinhCach ?? ''} ${v?.texture ?? ''} ${v?.pitch ?? ''}`)
  if (male) return punch ? EL_VOICE.adam : EL_VOICE.josh
  return punch ? EL_VOICE.domi : EL_VOICE.bella
}

export interface LipsyncSceneParams {
  elevenKey: string
  falKey: string
  scene: PersonifiedScene
  character?: PersonifiedCharacter
  /** Clip i2v CÂM đã render (P2a/b) — LatentSync nhép mồm lên đây. */
  clipRef: string
  /** Tốc độ đọc (atempo nằm trong textToSpeech ElevenLabs); mặc định 1.0. */
  speed?: number
  signal?: AbortSignal
  onStage?: (stage: 'tts' | 'lip' | 'done', info?: { audioRef?: string; lipsyncRef?: string; status?: string }) => void
}

export interface LipsyncSceneResult { audioRef: string; lipsyncRef: string }

/** P2c — nhép mồm 1 cảnh: TTS → LatentSync lên clip i2v → { audioRef, lipsyncRef }. */
export async function renderSceneLipsync(p: LipsyncSceneParams): Promise<LipsyncSceneResult> {
  if (!p.elevenKey) throw new Error('Thiếu ElevenLabs API key (Cài đặt)')
  if (!p.falKey) throw new Error('Thiếu fal.ai API key (Cài đặt)')
  const text = (p.scene.dialoguePrimary ?? '').trim()
  if (!text) throw new Error('Cảnh không có thoại — không cần lipsync')
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')

  // ── 1. TTS (ElevenLabs multilingual — đọc đúng ngôn ngữ đích) ──────────────
  const buf = await textToSpeech({
    apiKey: p.elevenKey,
    voiceId: pickVoiceId(p.character?.voice),
    text,
    modelId: 'eleven_multilingual_v2',
    speed: p.speed ?? 1.0,
  })
  const audioRef = await saveAsset(new Blob([buf], { type: 'audio/mpeg' }), 'audio/mpeg')
  p.onStage?.('tts', { audioRef })
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')

  // ── 2. LatentSync nhép mồm lên clip i2v (cần URL công khai cho cả audio + video) ──
  const audioUrl = await getUrl(audioRef)
  const clipUrl = isAssetRef(p.clipRef) ? await getUrl(p.clipRef) : p.clipRef
  if (!audioUrl) throw new Error('Không lấy được URL audio')
  if (!clipUrl) throw new Error('Không lấy được URL clip i2v')

  const { requestId } = await submitLatentSync({ apiKey: p.falKey, videoUrl: clipUrl, audioUrl })
  p.onStage?.('lip', { audioRef })
  const res = await pollLatentSyncUntilDone({
    apiKey: p.falKey, requestId, timeoutMs: 15 * 60 * 1000,
    onStatusChange: (status) => p.onStage?.('lip', { audioRef, status }),
  })
  const vidBlob = await fetch(res.videoUrl).then((r) => r.blob())
  const lipsyncRef = await saveAsset(vidBlob, res.contentType || 'video/mp4')
  p.onStage?.('done', { audioRef, lipsyncRef })
  return { audioRef, lipsyncRef }
}

// ── Dev helper — test render 1 cảnh từ kịch bản đang lưu (console, P2a) ───────
//   __testRenderScene(1)   → render cảnh #1 của kịch bản personified hiện tại
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__testRenderScene = async (sceneIdx = 1) => {
    const { useSettingsStore } = await import('../../../stores/settingsStore')
    const apiKey = useSettingsStore.getState().kieApiKey
    if (!apiKey) { console.error('[RENDER_TEST] thiếu KIE key trong Cài đặt'); return }
    const cache = JSON.parse(localStorage.getItem('personified-state-v1') ?? '{}')
    const script = cache.script
    if (!script?.scenes?.length) { console.error('[RENDER_TEST] chưa có kịch bản — tạo trước'); return }
    const scene = script.scenes[sceneIdx - 1]
    if (!scene) { console.error(`[RENDER_TEST] không có cảnh #${sceneIdx}`); return }
    const character = (script.characters ?? []).find(
      (c: PersonifiedCharacter) => c.name === scene.speaker || c.role === scene.speaker,
    ) ?? script.characters?.[0]
    console.log(`[RENDER_TEST] render cảnh #${sceneIdx} (${scene.sceneType}) tier=${cache.tier ?? 'seedance480'}…`)
    try {
      const res = await renderPersonifiedScene({
        apiKey, scene, character, tier: cache.tier ?? 'seedance480',
        worldEnv: script.worldEnv,
        onStage: (s, info) => console.log('[RENDER_TEST]', s, info),
      })
      const url = await getUrl(res.clipRef)
      console.log('[RENDER_TEST] DONE → clip:', url)
      if (url) window.open(url, '_blank')
      return res
    } catch (e) {
      console.error('[RENDER_TEST] lỗi:', e)
    }
  }
}
