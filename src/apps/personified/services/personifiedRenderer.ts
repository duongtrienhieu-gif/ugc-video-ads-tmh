// ── Mode 3 — Personified RENDER core (P2a) ───────────────────────────────────
// 1 cảnh → KEYFRAME (gpt-4o-image, nhân vật 3D) → i2v Seedance 1.5 Pro 480p (no-audio)
// → clip CÂM. Tái dùng KIE utils chung (kieai.ts), Mode 3 standalone — KHÔNG phụ thuộc
// logic preset của v3. Lipsync (P2c) + ghép/upscale (P2d) là bước sau.
// ─────────────────────────────────────────────────────────────────────────────

import {
  generateGpt4oImageFast, generateVideoJob, pollVideoJobUntilDone, type Resolution,
} from '../../../utils/kieai'
import { fetchFile } from '@ffmpeg/util'
import { textToSpeech } from '../../../utils/elevenlabs'
import { getFFmpeg } from '../../video-builder/v3/services/ffmpegLoader'
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
  opts: { hasCharRef: boolean; hasProductRef: boolean; worldEnv?: string; dropAction?: boolean },
): string {
  const base = (character?.imagePromptEn ?? '').trim() || (scene.action ?? '').trim() || 'A 3D Pixar cartoon character'
  const mood = scene.emotion ? ` Expression / mood: ${scene.emotion}.` : ''
  // dropAction = bản an toàn (tầng 2 retry): bỏ mô tả hành động (nơi chứa từ gore).
  const act = (!opts.dropAction && (scene.action ?? '').trim()) ? ` Scene: ${scene.action.trim()}.` : ''
  // BỐI CẢNH: ưu tiên setting RIÊNG của cảnh (đời thực/nội tại bám thoại); fallback worldEnv.
  const env = (scene.setting ?? '').trim() || (opts.worldEnv ?? '').trim()
  const world = env ? ` This scene takes place in: ${env}.` : ''
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

// TẦNG 1 — bộ lọc từ-độc deterministic: thay từ gore/y-khoa-thật bằng từ cartoon an toàn
// NGAY TRƯỚC KHI gửi (ăn cho cả kịch bản cũ Gemini viết "flesh crumble, rusty, mục nát").
const GORE_SCRUB: Array<[RegExp, string]> = [
  [/\bflesh\b/gi, 'clay'],
  [/\bbloody\b/gi, 'colourful'], [/\bblood\b/gi, 'paint'],
  [/\bgory\b/gi, 'cartoonish'], [/\bgore\b/gi, 'cartoon mess'],
  [/\bwounds?\b/gi, 'dents'], [/\bwounded\b/gi, 'dented'],
  [/\bcrumbl(e|es|ing|ed)\b/gi, 'wobble'],
  [/\b(stress )?cracks?\b/gi, 'cartoon cracks'], [/\bcrack(ed|ing)\b/gi, 'cartoon-cracked'],
  [/\brust(y|ed)?\b/gi, 'worn'],
  [/\brot(ten|ting)?\b/gi, 'dusty'], [/\bdecay(ing|ed)?\b/gi, 'dusty'],
  [/\bcorrod(e|ed|ing)\b/gi, 'worn'],
  [/\bskeletons?\b/gi, ''], [/\bskulls?\b/gi, ''],
  [/\bnứt (vỡ|nẻ)\b/gi, 'rạn kiểu hoạt hình'],
  [/\bmục nát\b/gi, 'cũ kỹ'], [/\bsắt vụn\b/gi, 'đồ chơi cũ'], [/\bmáu\b/gi, 'màu'],
]
function scrubGore(s: string): string {
  let out = s
  for (const [re, rep] of GORE_SCRUB) out = out.replace(re, rep)
  return out
}

/** Gọi gpt-4o-image; nếu dính content-policy → thử lại với prompt AN TOÀN HƠN (bỏ phần
 *  gore) + mệnh đề cartoon. softPrompt = bản rút gọn không có action gore (tầng 2). */
async function genImageModSafe(p: {
  apiKey: string; prompt: string; filesUrl: string[]; signal?: AbortSignal; softPrompt?: string
}): Promise<string> {
  try {
    return await generateGpt4oImageFast({
      apiKey: p.apiKey, prompt: scrubGore(p.prompt), filesUrl: p.filesUrl, size: '2:3',
      softTimeoutMs: 100_000, attemptTimeoutMs: 150_000, maxAttempts: 3, signal: p.signal,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!isContentViolation(msg)) throw e
    // Tầng 2: dùng bản rút gọn an toàn (bỏ action gore) nếu có, + scrub + mệnh đề cartoon.
    const retry = scrubGore((p.softPrompt ?? p.prompt)) + SAFE_CARTOON_CLAUSE
    return await generateGpt4oImageFast({
      apiKey: p.apiKey, prompt: retry, filesUrl: p.filesUrl, size: '2:3',
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
    hasCharRef: !!charUrl, hasProductRef: useProduct, worldEnv: p.worldEnv,
  })
  // Bản an toàn (bỏ action gore) cho lần retry nếu dính content-policy.
  const softPrompt = buildKeyframePrompt(p.scene, p.character, {
    hasCharRef: !!charUrl, hasProductRef: useProduct, worldEnv: p.worldEnv, dropAction: true,
  })
  const remoteUrl = await genImageModSafe({ apiKey: p.apiKey, prompt: kfPrompt, softPrompt, filesUrl, signal: p.signal })
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
  // Cảnh có thoại → để nhân vật DIỄN + mồm mấp máy như đang nói (voiceover sẽ đè lên,
  // không cần khớp từng chữ). Không thoại → chuyển động hành động bình thường.
  const talking = (p.scene.dialoguePrimary ?? '').trim()
    ? ' The character is talking and gesturing expressively, mouth opening and moving naturally as if speaking.'
    : ''
  const i2vPrompt = ((p.scene.videoPromptEn ?? '').trim() || (p.scene.action ?? '').trim() || 'subtle natural motion') + talking
  const sub = await generateVideoJob({
    apiKey: p.apiKey,
    jobModelId: tierToModel(p.tier),
    prompt: i2vPrompt,
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
// P2c — LỒNG GIỌNG: thoại nhân vật. TTS ElevenLabs multilingual_v2 (chuẩn MY/VN) →
// GHÉP voiceover vào clip i2v bằng ffmpeg (0 credit). KHÔNG dùng lipsync engine: video
// 3D cartoon viral vốn để nhân vật i2v DIỄN (mồm mấp máy) + giọng đè + caption — không
// cần khớp mồm từng chữ như mặt người thật. Giữ FULL action của Seedance, rẻ, 2 ví
// (KIE keyframe+i2v + ElevenLabs giọng), bỏ hẳn fal. Chỉ cảnh CÓ dialoguePrimary.
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

export interface VoiceoverSceneParams {
  elevenKey: string
  scene: PersonifiedScene
  character?: PersonifiedCharacter
  /** Clip i2v CÂM đã render (P2a/b) — ghép voiceover lên đây bằng ffmpeg. */
  clipRef: string
  /** Tốc độ đọc (atempo trong textToSpeech ElevenLabs); mặc định 1.0. */
  speed?: number
  signal?: AbortSignal
  onStage?: (stage: 'tts' | 'mux' | 'done', info?: { audioRef?: string; voicedRef?: string }) => void
}

export interface VoiceoverSceneResult { audioRef: string; voicedRef: string }

/** P2c — lồng giọng 1 cảnh: TTS ElevenLabs → ghép voiceover vào clip i2v bằng ffmpeg
 *  (0 credit) → { audioRef, voicedRef }. Không lipsync — giữ full action của i2v. */
export async function addSceneVoiceover(p: VoiceoverSceneParams): Promise<VoiceoverSceneResult> {
  if (!p.elevenKey) throw new Error('Thiếu ElevenLabs API key (Cài đặt)')
  const text = (p.scene.dialoguePrimary ?? '').trim()
  if (!text) throw new Error('Cảnh không có thoại — không cần lồng giọng')
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')

  // ── 1. TTS (ElevenLabs multilingual — đọc đúng ngôn ngữ đích) ──────────────
  const buf = await textToSpeech({
    apiKey: p.elevenKey,
    voiceId: pickVoiceId(p.character?.voice),
    text,
    modelId: 'eleven_multilingual_v2',
    speed: p.speed ?? 1.0,
  })
  const audioBytes = new Uint8Array(buf.byteLength)
  audioBytes.set(new Uint8Array(buf))
  const audioRef = await saveAsset(new Blob([audioBytes], { type: 'audio/mpeg' }), 'audio/mpeg')
  p.onStage?.('tts', { audioRef })
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')

  // ── 2. Ghép voiceover vào clip i2v (ffmpeg.wasm — 0 credit) ────────────────
  const clipUrl = isAssetRef(p.clipRef) ? await getUrl(p.clipRef) : p.clipRef
  if (!clipUrl) throw new Error('Không lấy được URL clip i2v')
  p.onStage?.('mux', { audioRef })
  const ffmpeg = await getFFmpeg()
  const vIn = 'vo_in.mp4', aIn = 'vo_in.mp3', out = 'vo_out.mp4'
  await ffmpeg.writeFile(vIn, await fetchFile(clipUrl))
  await ffmpeg.writeFile(aIn, audioBytes)
  // Giữ video (copy), thay audio = giọng; -shortest cắt theo clip (clip đã sized theo thoại).
  await ffmpeg.exec([
    '-i', vIn, '-i', aIn,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-ar', '44100', '-ac', '2',
    '-shortest', '-movflags', '+faststart', '-y', out,
  ])
  const data = await ffmpeg.readFile(out)
  const src = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const outBytes = new Uint8Array(src.byteLength)   // copy khỏi SharedArrayBuffer (wasm)
  outBytes.set(src)
  const voicedRef = await saveAsset(new Blob([outBytes], { type: 'video/mp4' }), 'video/mp4')
  await ffmpeg.deleteFile(vIn).catch(() => {})
  await ffmpeg.deleteFile(aIn).catch(() => {})
  await ffmpeg.deleteFile(out).catch(() => {})
  p.onStage?.('done', { audioRef, voicedRef })
  return { audioRef, voicedRef }
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
