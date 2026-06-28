// ── Mode 3 — Personified RENDER core (P2a) ───────────────────────────────────
// 1 cảnh → KEYFRAME (gpt-4o-image, nhân vật 3D) → i2v Seedance 1.5 Pro 480p (no-audio)
// → clip CÂM. Tái dùng KIE utils chung (kieai.ts), Mode 3 standalone — KHÔNG phụ thuộc
// logic preset của v3. Lipsync (P2c) + ghép/upscale (P2d) là bước sau.
// ─────────────────────────────────────────────────────────────────────────────

import {
  generateGpt4oImageFast, generateVideoJob, pollVideoJobUntilDone, type Resolution,
} from '../../../utils/kieai'
import { fetchFile } from '@ffmpeg/util'
import { textToSpeech, textToSpeechWithTimestamps } from '../../../utils/elevenlabs'
import { getFFmpeg } from '../../video-builder/v3/services/ffmpegLoader'
import { buildCaptionChunks } from '../../video-builder/v3/services/captionChunker'
import type { VoiceAlignment } from '../../video-builder/v3/types'
import { renderCaptionPng } from './personifiedCaption'
import { saveAsset, getUrl, isAssetRef } from '../../../utils/assetStore'

/** 1 frame caption karaoke đã render (PNG) + cửa sổ hiện (giây, gốc clip). */
export interface CapFrame { png: Uint8Array; startSec: number; endSec: number }

/** Build các frame karaoke từ alignment giọng: mỗi TỪ 1 frame (cụm chữ, tô vàng từ đó),
 *  hiện trong [word.start, word.end]. Không alignment → 1 frame tĩnh cả câu suốt clip. */
async function buildKaraokeFrames(
  text: string, alignment: { characters: string[]; characterStartTimesSeconds: number[]; characterEndTimesSeconds: number[] } | null,
  clipDur: number,
): Promise<CapFrame[]> {
  if (!alignment || !alignment.characters?.length) {
    const png = await renderCaptionPng(text.split(/\s+/).filter(Boolean), -1)
    return [{ png, startSec: 0, endSec: Math.max(0.5, clipDur) }]
  }
  const va: VoiceAlignment = { text: alignment.characters.join(''), charStartSecs: alignment.characterStartTimesSeconds }
  const realDur = alignment.characterEndTimesSeconds[alignment.characterEndTimesSeconds.length - 1] || clipDur
  const chunks = buildCaptionChunks(va, text, realDur)
  const frames: CapFrame[] = []
  for (const ch of chunks) {
    const wordTexts = ch.words.map((w) => w.text)
    for (let i = 0; i < ch.words.length; i++) {
      const w = ch.words[i]
      frames.push({ png: await renderCaptionPng(wordTexts, i), startSec: w.startSec, endSec: w.endSec })
    }
  }
  return frames
}
import type { PersonifiedScene, PersonifiedCharacter, VoiceProfile } from '../types'
import { type RenderTier, CINEMATIC_STYLE, CHARACTER_SHEET_STYLE, EXPRESSIVE_SPEED } from '../constants'

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
  opts: {
    hasCharRef: boolean; hasProductRef: boolean; worldEnv?: string; dropAction?: boolean
    // Nhân vật PHỤ cùng khung (vd hero_entrance: villain panic + hero vào) — khóa bằng ref riêng.
    hasExtraChar?: boolean; extraCharacter?: PersonifiedCharacter
    // Index ref ĐỘNG (renderKeyframe tính theo số ref thật sự push) — khớp đúng filesUrl.
    charRefIdx?: string; extraRefIdx?: string; productIdx?: string
  },
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
    ? ` The MAIN CHARACTER is reference image ${opts.charRefIdx ?? '#1'} — keep the EXACT same face, body, colour, material and packaging; change only the pose and expression to match this scene${isHeroVfx ? ' (you MAY add the heroic effects described below around it)' : ', and do NOT redesign the character'}.`
    : ''
  // Nhân vật phụ trong cùng khung — khóa diện mạo từ ref riêng (vd cảnh hero gặp villain).
  const extraLock = opts.hasExtraChar
    ? ` A SECOND character is ALSO present in the SAME frame — reference image ${opts.extraRefIdx} (${opts.extraCharacter?.represents || opts.extraCharacter?.name || 'the other character'}): keep its EXACT face, body, colour and material from that reference; change only its pose and expression to fit the action. Both characters share one cohesive 3D scene, interacting naturally.`
    : ''
  const product = opts.hasProductRef
    ? ` The REAL PRODUCT appears in frame EXACTLY as reference image ${opts.productIdx ?? '#2'} — same packaging, label, colour, shape and on-pack text; do NOT invent, alter, or re-spell any packaging or text, copy it from the reference.`
    : ''
  // Khi đã khóa nhân vật bằng ảnh ref thì không cần tả lại base (tránh prompt "đè" lên ảnh).
  const desc = opts.hasCharRef ? '' : `${base} `
  return `${desc}${charLock}${extraLock}${mood}${act}${world}${product}${heroVfx} ${CINEMATIC_STYLE}`
}

export interface RenderSceneParams {
  apiKey: string
  scene: PersonifiedScene
  /** Nhân vật nói/chủ thể của cảnh (cho imagePromptEn). */
  character?: PersonifiedCharacter
  /** Ảnh chân dung nhân vật từ Character Bank (P2b) — khóa diện mạo xuyên cảnh (i2i ref #1). */
  characterRef?: string
  /** Nhân vật PHỤ cùng khung (vd hero_entrance: villain + hero) — để khóa diện mạo bằng ref #2. */
  extraCharacter?: PersonifiedCharacter
  /** Ảnh bank của nhân vật phụ (i2i ref #2). */
  extraCharacterRef?: string
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
  // ĐAU ĐỚN / KHỔ SỞ → biểu cảm hoạt hình ngộ nghĩnh (GIỮ kịch tính, bỏ "pain/agony" model chặn).
  [/\bcontorted in (pain|agony)\b/gi, 'with a comically dizzy cross-eyed face'],
  [/\b(writhing |twisted )?in (great |intense )?(pain|agony)\b/gi, 'looking comically dazed'],
  [/\bpainful(ly)?\b/gi, 'comically dramatic'], [/\bpain\b/gi, 'dizziness'], [/\bagony\b/gi, 'comic dismay'],
  [/\bsuffering\b/gi, 'flailing comically'], [/\bwrith(e|ing)\b/gi, 'wobbling'],
  [/\bscream(ing|ed|s)?\b/gi, 'yelping comically'],
  [/\btortur(e|ed|ing)\b/gi, 'teasing'], [/\bdistorted\b/gi, 'wobbly'], [/\boverwhelmed\b/gi, 'outmatched'],
  // NGHIỀN/NỔ/TAN → biến mất kiểu hoạt hình (puff bụi/đốm sáng/confetti) — y nguyên SỰ KIỆN, mất bạo lực.
  [/\bcrush(ed|ing|es)?\b/gi, 'comically squashed'],
  [/\bdisintegrat(e|es|ing|ed|ion)\b/gi, 'harmlessly puffing apart'],
  [/\bshatter(ed|ing|s)?\b/gi, 'popping apart'],
  [/\bexplod(e|es|ing|ed)\b/gi, 'bursting into confetti'], [/\bexplosions?\b/gi, 'confetti bursts'],
  [/\bviolent(ly)?\b/gi, 'energetically'],
  // ĐAU ĐỚN tiếng Việt (nếu lọt vào field hình) → biểu cảm hài.
  [/\bđau đớn\b/gi, 'xây xẩm hài hước'], [/\bquằn quại\b/gi, 'lảo đảo'], [/\bgào thét\b/gi, 'kêu oai oái'],
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
  p: Pick<RenderSceneParams, 'apiKey' | 'scene' | 'character' | 'characterRef' | 'extraCharacter' | 'extraCharacterRef' | 'productRefs' | 'worldEnv' | 'signal'>,
): Promise<{ keyframeRef: string }> {
  if (!p.apiKey) throw new Error('Thiếu KIE API key (Cài đặt)')
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')

  // Thứ tự ref BẮT BUỘC khớp index trong prompt: [nhân vật chính, nhân vật phụ, ...sản phẩm].
  const filesUrl: string[] = []
  const charUrl = await refToUrl(p.characterRef)
  if (charUrl) filesUrl.push(charUrl)
  const extraUrl = await refToUrl(p.extraCharacterRef)
  if (extraUrl) filesUrl.push(extraUrl)

  const useProduct = !!(p.scene.hasProduct && p.productRefs && p.productRefs.length > 0)
  let productIdx: string | undefined
  if (useProduct) {
    productIdx = `#${filesUrl.length + 1}`   // index ĐỘNG = sau các ref nhân vật đã push
    for (const ref of p.productRefs!.slice(0, 4)) {
      const url = await refToUrl(ref)
      if (url) filesUrl.push(url)
    }
  }
  const promptOpts = {
    hasCharRef: !!charUrl, hasProductRef: useProduct, worldEnv: p.worldEnv,
    hasExtraChar: !!extraUrl, extraCharacter: p.extraCharacter,
    charRefIdx: charUrl ? '#1' : undefined,
    extraRefIdx: extraUrl ? (charUrl ? '#2' : '#1') : undefined,
    productIdx,
  }
  const kfPrompt = buildKeyframePrompt(p.scene, p.character, promptOpts)
  // Bản an toàn (bỏ action gore) cho lần retry nếu dính content-policy.
  const softPrompt = buildKeyframePrompt(p.scene, p.character, { ...promptOpts, dropAction: true })
  const remoteUrl = await genImageModSafe({ apiKey: p.apiKey, prompt: kfPrompt, softPrompt, filesUrl, signal: p.signal })
  const kfBlob = await fetch(remoteUrl).then((r) => r.blob())
  const keyframeRef = await saveAsset(kfBlob, kfBlob.type || 'image/png')
  return { keyframeRef }
}

/** Bước 2 — i2v từ KEYFRAME ĐÃ DUYỆT (Seedance 480p no-audio) → { clipRef }. Tốn credit.
 *  onSubmit: fire taskId NGAY SAU submit → caller lưu để RESUME khi F5 (0 credit thêm).
 *  resumeTaskId: bỏ qua submit, poll thẳng job đã có (dùng khi nối lại sau reload). */
export async function renderClipFromKeyframe(
  p: Pick<RenderSceneParams, 'apiKey' | 'scene' | 'tier' | 'signal'>
    & { keyframeRef?: string; resumeTaskId?: string; onSubmit?: (taskId: string) => void },
): Promise<{ clipRef: string; taskId: string }> {
  if (!p.apiKey) throw new Error('Thiếu KIE API key (Cài đặt)')
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')

  let taskId = p.resumeTaskId
  if (!taskId) {
    if (!p.keyframeRef) throw new Error('Chưa có keyframe — tạo keyframe trước')
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
    taskId = sub.taskId
    p.onSubmit?.(taskId)   // lưu taskId NGAY → F5 vẫn resume được job đã trả tiền
  }

  const clipUrl = await pollVideoJobUntilDone({
    apiKey: p.apiKey, taskId, timeoutMs: 10 * 60 * 1000,
    logTag: `personified/${p.scene.sceneType}#${p.scene.idx}`,
  })
  const clipBlob = await fetch(clipUrl).then((r) => r.blob())
  const clipRef = await saveAsset(clipBlob, 'video/mp4')
  return { clipRef, taskId }
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
  /** voiceId ElevenLabs gán cho nhân vật (user chọn từ thư viện / clone). Rỗng → map mặc định. */
  voiceId?: string
  /** Clip i2v CÂM đã render (P2a/b) — ghép voiceover lên đây bằng ffmpeg. */
  clipRef: string
  /** Tốc độ đọc (atempo trong textToSpeech ElevenLabs); mặc định 1.0. */
  speed?: number
  signal?: AbortSignal
  onStage?: (stage: 'tts' | 'mux' | 'done', info?: { audioRef?: string; voicedRef?: string }) => void
}

export interface VoiceoverSceneResult { audioRef: string; voicedRef: string; voiceSec: number }

/** Giọng đã tổng hợp 1 cảnh (chưa ghép vào clip) — để CHẠY SONG SONG với i2v. */
export interface SceneVoice { audioRef: string; audioBytes: Uint8Array; voiceSec: number; frames: CapFrame[] }

/** BƯỚC GIỌNG (KHÔNG cần clip i2v) → TTS eleven_v3 + karaoke frames. Chạy song song i2v được. */
export async function synthSceneVoice(
  p: { elevenKey: string; scene: PersonifiedScene; character?: PersonifiedCharacter; voiceId?: string; speed?: number; signal?: AbortSignal },
): Promise<SceneVoice> {
  if (!p.elevenKey) throw new Error('Thiếu ElevenLabs API key (Cài đặt)')
  const text = (p.scene.dialoguePrimary ?? '').trim()
  if (!text) throw new Error('Cảnh không có thoại — không cần lồng giọng')
  const voiceId = (p.voiceId ?? '').trim() || pickVoiceId(p.character?.voice)
  // Đọc ở 1.2x (EXPRESSIVE_SPEED) cho KHỚP ước lượng giây (playbackWps đã tính 1.2x) —
  // nếu để 1.0x thì giọng dài hơn ~20% → tràn clip, cắt chữ. ElevenLabs trả timestamp
  // theo đúng tốc độ này nên caption karaoke vẫn chuẩn.
  const { buffer, alignment } = await textToSpeechWithTimestamps({
    apiKey: p.elevenKey, voiceId, text, modelId: 'eleven_v3', speed: p.speed ?? EXPRESSIVE_SPEED,
  })
  const audioBytes = new Uint8Array(buffer.byteLength)
  audioBytes.set(new Uint8Array(buffer))
  const audioRef = await saveAsset(new Blob([audioBytes], { type: 'audio/mpeg' }), 'audio/mpeg')
  const ends = alignment?.characterEndTimesSeconds
  const ttsLen = ends && ends.length ? ends[ends.length - 1] : p.scene.clipDuration
  // GIỌNG = ĐỒNG HỒ CHUẨN của cảnh: lấy ĐỘ DÀI THẬT (KHÔNG kẹp về clipDuration nữa) →
  // bước ghép sẽ cắt clip 8s thừa về đúng đây (hết im) hoặc kéo clip 4s ngắn cho đủ giọng
  // (không cắt chữ). Caption cũng phủ trọn câu theo độ dài thật.
  const voiceSec = Math.max(0.5, ttsLen || p.scene.clipDuration)
  const frames = await buildKaraokeFrames(text, alignment, voiceSec)
  return { audioRef, audioBytes, voiceSec, frames }
}

/** BƯỚC GHÉP: pad-fit 9:16 nền blur + voiceover + overlay karaoke vào clip i2v (ffmpeg, 0cr). */
export async function muxSceneVoiceover(
  p: { clipRef: string; voice: SceneVoice; scene: PersonifiedScene; signal?: AbortSignal },
): Promise<string> {
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')
  const clipUrl = isAssetRef(p.clipRef) ? await getUrl(p.clipRef) : p.clipRef
  if (!clipUrl) throw new Error('Không lấy được URL clip i2v')
  const { audioBytes, frames } = p.voice
  // ĐỘ DÀI CẢNH = GIỌNG THẬT. Clip i2v ngắn hơn → kéo (freeze frame cuối) cho đủ giọng;
  // dài hơn → cắt về đúng đây. → voiced clip luôn = voiceSec, đủ caption + tiếng cả câu.
  const voiceSec = Math.max(0.5, p.voice.voiceSec || p.scene.clipDuration)
  const ffmpeg = await getFFmpeg()
  const W = 720, H = 1280
  const vIn = 'vo_in.mp4', aIn = 'vo_in.mp3', out = 'vo_out.mp4'
  await ffmpeg.writeFile(vIn, await fetchFile(clipUrl))
  await ffmpeg.writeFile(aIn, audioBytes)
  const capFiles: string[] = []
  for (let i = 0; i < frames.length; i++) {
    const f = `vo_c${i}.png`
    await ffmpeg.writeFile(f, frames[i].png)
    capFiles.push(f)
  }
  // Base 9:16: nền = bản BLUR phóng to (fill khung), foreground = clip fit NGUYÊN (không cắt rìa).
  // tpad giữ frame cuối → kéo base tới đủ voiceSec (nếu clip ngắn hơn giọng).
  const parts: string[] = [
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:4,setsar=1[bg]`,
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,tpad=stop_mode=clone:stop_duration=${voiceSec.toFixed(3)}[base]`,
  ]
  const inputs: string[] = ['-i', vIn, '-i', aIn]
  let last = 'base'
  for (let i = 0; i < capFiles.length; i++) {
    inputs.push('-i', capFiles[i])
    const inIdx = i + 2                 // 0=clip, 1=audio, caption từ input #2
    const next = i === capFiles.length - 1 ? 'vout' : `o${i}`
    parts.push(`[${last}][${inIdx}:v]overlay=0:0:enable='between(t,${frames[i].startSec.toFixed(2)},${frames[i].endSec.toFixed(2)})'[${next}]`)
    last = next
  }
  const mapV = capFiles.length ? 'vout' : 'base'
  // -t voiceSec: chốt cứng độ dài = giọng (KHÔNG -shortest — tránh cắt theo clip ngắn).
  // apad: nếu mp3 hụt vài ms thì đệm im cho đủ, rồi -t cắt khít.
  await ffmpeg.exec([
    ...inputs,
    '-filter_complex', parts.join(';'),
    '-map', `[${mapV}]`, '-map', '1:a:0',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-af', 'apad', '-c:a', 'aac', '-ar', '44100', '-ac', '2',
    '-t', voiceSec.toFixed(3), '-movflags', '+faststart', '-y', out,
  ])
  for (const f of capFiles) await ffmpeg.deleteFile(f).catch(() => {})
  const data = await ffmpeg.readFile(out)
  const src = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const outBytes = new Uint8Array(src.byteLength)   // copy khỏi SharedArrayBuffer (wasm)
  outBytes.set(src)
  const voicedRef = await saveAsset(new Blob([outBytes], { type: 'video/mp4' }), 'video/mp4')
  await ffmpeg.deleteFile(vIn).catch(() => {})
  await ffmpeg.deleteFile(aIn).catch(() => {})
  await ffmpeg.deleteFile(out).catch(() => {})
  return voicedRef
}

/** P2c — lồng giọng 1 cảnh (standalone, dùng cho "Lồng giọng lại"): synth → mux. */
export async function addSceneVoiceover(p: VoiceoverSceneParams): Promise<VoiceoverSceneResult> {
  const voice = await synthSceneVoice(p)
  p.onStage?.('tts', { audioRef: voice.audioRef })
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')
  p.onStage?.('mux', { audioRef: voice.audioRef })
  const voicedRef = await muxSceneVoiceover({ clipRef: p.clipRef, voice, scene: p.scene, signal: p.signal })
  p.onStage?.('done', { audioRef: voice.audioRef, voicedRef })
  return { audioRef: voice.audioRef, voicedRef, voiceSec: voice.voiceSec }
}

/** Nghe thử 1 giọng — TTS 1 câu mẫu (eleven_v3) → object URL để phát. Caller tự revoke. */
export async function synthVoiceSample(elevenKey: string, voiceId: string, text: string): Promise<string> {
  const buf = await textToSpeech({ apiKey: elevenKey, voiceId, text, modelId: 'eleven_v3', speed: EXPRESSIVE_SPEED })
  const bytes = new Uint8Array(buf.byteLength)
  bytes.set(new Uint8Array(buf))
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
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
