// ── Thumbnail Engine ─────────────────────────────────────────────────────────
// Z35 §12 — Plan + build thumbnails for the export package. 3 styles:
//   • tiktok_native — overlay big bold caption on creator keyframe
//   • bold_text     — full-bleed black background + headline only
//   • clean_ugc     — soft fade + small subtitle
//
// Phase 1 ships METADATA + canvas-based PNG rendering for tiktok_native +
// bold_text. clean_ugc thumbnail can be enhanced in a follow-up commit.
//
// Strategy: render thumbnails CLIENT-SIDE via Canvas API. No KIE/Gemini
// calls — cheap + instant + survives offline.
// ─────────────────────────────────────────────────────────────────────────────

import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import { directGeminiText } from '../../../../utils/gemini'
import { generateGpt4oImageFast } from '../../../../utils/kieai'
import type {
  ThumbnailStyleId, ThumbnailPlan, ThumbnailArchetypeId,
  GeneratedScript, ScriptLang,
} from '../types'
import { SCRIPT_LANG_GEMINI_NAME } from '../types'
import type { Product, Model } from '../../../../stores/types'

export interface ThumbnailStyleConfig {
  id: ThumbnailStyleId
  labelVi: string
  descriptionVi: string
  emoji: string
}

export const THUMBNAIL_STYLES: Record<ThumbnailStyleId, ThumbnailStyleConfig> = {
  tiktok_native: {
    id: 'tiktok_native',
    labelVi: 'TikTok native',
    descriptionVi: 'Keyframe creator + caption bold vàng (TikTok feel chuẩn).',
    emoji: '📱',
  },
  bold_text: {
    id: 'bold_text',
    labelVi: 'Bold text',
    descriptionVi: 'Full-bleed nền tối + headline đập vào mặt — high CTR.',
    emoji: '💥',
  },
  clean_ugc: {
    id: 'clean_ugc',
    labelVi: 'Clean UGC',
    descriptionVi: 'Keyframe + subtitle nhỏ, mềm — cho beauty/wellness/luxury.',
    emoji: '🌸',
  },
}

export const THUMBNAIL_STYLE_ORDER: ThumbnailStyleId[] = [
  'tiktok_native',
  'bold_text',
  'clean_ugc',
]

// ── Render a thumbnail via Canvas (returns asset ref) ──────────────────

export interface RenderThumbnailParams {
  styleId: ThumbnailStyleId
  /** asset:xxx of the source keyframe to use as background (creator first
   *  frame OR a still). Required for tiktok_native + clean_ugc. */
  sourceRef: string
  /** Headline text overlay */
  headlineText: string
  /** Output size — vertical 9:16 default */
  width?: number
  height?: number
}

/**
 * Z35 — Render a thumbnail PNG via the browser's Canvas API. Returns the
 * asset:xxx ref of the saved PNG. No network — pure local work.
 */
export async function renderThumbnail(
  params: RenderThumbnailParams,
): Promise<string> {
  const width = params.width ?? 1080
  const height = params.height ?? 1920  // 9:16 default

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context không khả dụng')

  // Pre-load the source image (if needed for the style)
  let sourceImg: HTMLImageElement | null = null
  if (params.styleId !== 'bold_text' && params.sourceRef) {
    try {
      sourceImg = await loadImage(params.sourceRef)
    } catch (err) {
      console.warn('[THUMBNAIL] failed to load source image, falling back to bold_text style', err)
    }
  }

  // ── Render by style ──────────────────────────────────────────────────
  if (params.styleId === 'bold_text' || !sourceImg) {
    // Style 2 — full-bleed dark + huge headline
    ctx.fillStyle = '#0F172A'  // slate-900
    ctx.fillRect(0, 0, width, height)
    drawCenteredText(ctx, params.headlineText, {
      x: width / 2,
      y: height / 2,
      maxWidth: width * 0.85,
      color: '#FBBF24',  // amber-400
      outlineColor: '#000000',
      fontSize: 120,
      fontWeight: 900,
      uppercase: true,
      lineHeight: 1.1,
    })
  } else if (params.styleId === 'tiktok_native') {
    // Style 1 — keyframe bg + bold yellow caption overlaid bottom-third
    drawCover(ctx, sourceImg, width, height)
    // Bottom darken gradient
    const grad = ctx.createLinearGradient(0, height * 0.5, 0, height)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.7)')
    ctx.fillStyle = grad
    ctx.fillRect(0, height * 0.5, width, height * 0.5)
    drawCenteredText(ctx, params.headlineText, {
      x: width / 2,
      y: height * 0.78,
      maxWidth: width * 0.9,
      color: '#FBBF24',
      outlineColor: '#000000',
      fontSize: 90,
      fontWeight: 900,
      uppercase: true,
      lineHeight: 1.05,
    })
  } else {
    // Style 3 — clean UGC — keyframe + soft text bottom-third
    drawCover(ctx, sourceImg, width, height)
    drawCenteredText(ctx, params.headlineText, {
      x: width / 2,
      y: height * 0.88,
      maxWidth: width * 0.9,
      color: '#FFFFFF',
      outlineColor: '#1E293B',
      fontSize: 56,
      fontWeight: 700,
      uppercase: false,
      lineHeight: 1.1,
    })
  }

  // Export as PNG blob and save
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('Canvas toBlob trả về null'))
    }, 'image/png', 0.95)
  })
  return saveAsset(blob, 'image/png')
}

/** Build a ThumbnailPlan + render it. */
export async function buildAndRenderThumbnail(
  styleId: ThumbnailStyleId,
  sourceRef: string,
  headlineText: string,
): Promise<ThumbnailPlan> {
  const imageRef = await renderThumbnail({
    styleId,
    sourceRef,
    headlineText,
  })
  return {
    styleId,
    sourceRef,
    headlineText,
    imageRef,
    generatedAt: Date.now(),
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

async function loadImage(assetRefOrUrl: string): Promise<HTMLImageElement> {
  const url = isAssetRef(assetRefOrUrl) ? await getUrl(assetRefOrUrl) : assetRefOrUrl
  if (!url) throw new Error(`Asset không tồn tại: ${assetRefOrUrl.slice(0, 40)}`)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Load image failed: ${url.slice(0, 60)}`))
    img.src = url
  })
}

/** Draw an image to fill the canvas with object-fit: cover semantics. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
): void {
  const imgAspect = img.width / img.height
  const canvasAspect = w / h
  let drawW: number, drawH: number, offsetX: number, offsetY: number
  if (imgAspect > canvasAspect) {
    // Image is wider — crop horizontally
    drawH = h
    drawW = h * imgAspect
    offsetX = -(drawW - w) / 2
    offsetY = 0
  } else {
    // Image is taller — crop vertically
    drawW = w
    drawH = w / imgAspect
    offsetX = 0
    offsetY = -(drawH - h) / 2
  }
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH)
}

interface DrawTextOpts {
  x: number
  y: number
  maxWidth: number
  color: string
  outlineColor: string
  fontSize: number
  fontWeight: number
  uppercase: boolean
  lineHeight: number
}

/** Draw text centered horizontally at (x, y) with wrapping + outline. */
function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: DrawTextOpts,
): void {
  const displayText = opts.uppercase ? text.toUpperCase() : text
  ctx.font = `${opts.fontWeight} ${opts.fontSize}px system-ui, -apple-system, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Word-wrap to maxWidth
  const words = displayText.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const test = current ? `${current} ${w}` : w
    if (ctx.measureText(test).width > opts.maxWidth) {
      if (current) lines.push(current)
      current = w
    } else {
      current = test
    }
  }
  if (current) lines.push(current)

  const lineSpacing = opts.fontSize * opts.lineHeight
  const startY = opts.y - (lines.length - 1) * lineSpacing / 2

  // Draw outline + fill per line
  ctx.lineWidth = Math.max(4, opts.fontSize * 0.08)
  ctx.strokeStyle = opts.outlineColor
  ctx.fillStyle = opts.color
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineSpacing
    ctx.strokeText(lines[i], opts.x, y)
    ctx.fillText(lines[i], opts.x, y)
  }
}

// ── Z89 — AI thumbnail archetypes (đợt 3) ─────────────────────────────────
// 4 fully-AI-rendered thumbnails (GPT-4o i2i with avatar + product refs). Each
// pairs a distinct scroll-stopping composition with a curiosity hook. User picks 1.

export interface ThumbnailArchetypeConfig {
  id: ThumbnailArchetypeId
  labelVi: string
  /** Popup text so the user knows WHEN to pick this style. */
  popupVi: string
  emoji: string
}

export const THUMBNAIL_ARCHETYPES: Record<ThumbnailArchetypeId, ThumbnailArchetypeConfig> = {
  reaction_face: {
    id: 'reaction_face',
    labelVi: 'Mặt phản ứng',
    popupVi: 'Mặt creator biểu cảm mạnh (sốc/tò mò) cận cảnh + hook to phía trên, sản phẩm nhỏ góc. Dừng lướt bằng CẢM XÚC — hợp hook cảm xúc/bất ngờ.',
    emoji: '😲',
  },
  before_after: {
    id: 'before_after',
    labelVi: 'Before / After',
    popupVi: 'Chia đôi: trái = vấn đề (xấu), phải = kết quả (đẹp) + hook. Dừng lướt bằng TƯƠNG PHẢN — hợp sản phẩm có kết quả nhìn thấy (răng/da/tóc).',
    emoji: '🔀',
  },
  product_hero: {
    id: 'product_hero',
    labelVi: 'Sản phẩm + Ưu đãi',
    popupVi: 'Sản phẩm to giữa khung (creator cầm) + hook + badge ưu đãi. Direct-response — hợp khách đã có nhu cầu, đẩy mua/COD.',
    emoji: '🎁',
  },
  curiosity_text: {
    id: 'curiosity_text',
    labelVi: 'Câu hỏi tò mò',
    popupVi: 'Chữ hook dạng câu hỏi/bí mật choán phần lớn khung + creator + sản phẩm nhỏ. Dừng lướt bằng TÒ MÒ — hợp hook "tại sao / bí mật / đừng mua trước khi...".',
    emoji: '❓',
  },
}

// P6c — user dropped Before/After (đụng hàng before/after video) + Sản phẩm+Ưu đãi
// (badge giảm giá/giá tiền) → chỉ giữ 2 kiểu: Mặt phản ứng + Câu hỏi tò mò. Config map
// vẫn giữ đủ 4 (Record cần đủ key); chỉ ORDER này điều khiển UI + số ảnh tạo.
export const THUMBNAIL_ARCHETYPE_ORDER: ThumbnailArchetypeId[] = [
  'reaction_face', 'curiosity_text',
]

// Per-archetype composition prompt; the hook text is baked into the image so it
// reads as a designed thumbnail. The avatar (person) + product are passed as
// i2i references via filesUrl.
function buildArchetypePrompt(archetype: ThumbnailArchetypeId, hook: string, langName: string): string {
  // P4r — Malaysian visual culture when the script targets MY, so the thumbnail
  // vibe/setting/casting reads as a real Malaysian creator's (the avatar + product
  // refs already anchor the person + product; this fixes the BACKGROUND/styling).
  const msCulture = langName === 'Bahasa Malaysia'
    ? `Setting + styling MUST feel authentically MALAYSIAN: warm tropical daylight, a real Malaysian ` +
      `home / office / mamak / kopitiam vibe, Malaysian Gen-Z casual wear, naturally mixed-race casting ` +
      `(Malay / Chinese / Indian; if a Malay-coded creator, modest dress). AVOID snow / Western-suburb / ` +
      `Hollywood-corporate looks. `
    : ''
  const base =
    `Design a scroll-stopping VERTICAL 9:16 TikTok ad THUMBNAIL. ` +
    `REFERENCE IMAGES: most show the PRODUCT (from several angles); ONE shows the CREATOR (a human face). ` +
    `PRODUCT FIDELITY IS CRITICAL (non-negotiable): replicate the product EXACTLY as in its reference — the SAME ` +
    `physical TYPE / FORM (box, adhesive PATCH, sachet, bottle, tube, jar, sheet — whatever the reference actually ` +
    `IS), same packaging, colour, label and text. Do NOT redesign it, do NOT swap it for a different or generic ` +
    `product, and NEVER invent a product the hook/topic might suggest (e.g. if the reference is a PATCH/BOX, do ` +
    `NOT turn it into a generic oil or supplement BOTTLE). If space is tight, show it SMALLER but still the EXACT ` +
    `product, clearly recognisable — never a look-alike or a re-imagined version. ` +
    `Use the SAME PERSON from the creator/face reference (identical face) as the creator. ` +
    `Render the hook text "${hook}" as BIG, BOLD, perfectly-spelled ${langName} text with a heavy contrasting ` +
    `outline so it is readable on a small phone. Authentic UGC look (real iPhone photo, natural light), NOT stock. ` +
    msCulture
  switch (archetype) {
    case 'reaction_face':
      return base +
        `COMPOSITION: close-up of the creator's face with a strong shocked / curious / amazed expression in the upper ` +
        `frame. Hook text across the TOP third. The product sits in the lower third / a bottom corner, held or placed so ` +
        `it is CLEARLY RECOGNISABLE as the exact reference product (sharp, well-lit — NOT blurred, NOT shrunk past ` +
        `recognition, NOT a different product). High-contrast, emotional.`
    case 'before_after':
      return base +
        `COMPOSITION: a clear vertical SPLIT-SCREEN. LEFT half = the BEFORE problem state (dull / before using). ` +
        `RIGHT half = the AFTER result (bright / improved) — same creator or the relevant body-part change. ` +
        `Bold "BEFORE" / "AFTER" labels on each half; hook text across the centre. Product small in a corner.`
    case 'product_hero':
      return base +
        `COMPOSITION: the product is the HERO — large, centred, held up by the creator's hands, sharp + well-lit. ` +
        `The creator's smiling face partly visible beside it. Hook text bold at the top; a small bright OFFER/discount badge in a corner.`
    case 'curiosity_text':
      return base +
        `COMPOSITION: the hook QUESTION text DOMINATES the frame (very large, ~half the image, bold with a bright highlight). ` +
        `The creator's face smaller to one side with a curious expression; the product in a corner but CLEARLY RECOGNISABLE ` +
        `as the exact reference product (sharp, well-lit — NOT blurred, NOT a different/generic product). Maximum curiosity-gap.`
  }
}

/** Generate 4 short curiosity hooks in the script language. Robust: simple
 *  schema + fallback so the thumbnail flow never blocks on Gemini. */
export async function generateThumbnailHooks(params: {
  geminiKey: string
  script: GeneratedScript
  product: Product | null
  lang: ScriptLang
}): Promise<string[]> {
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang]
  const productName = params.product?.productName ?? ''
  const scriptText = params.script.blocks.map((b) => b.text).join(' ').slice(0, 1200)
  const fallback = buildFallbackHooks(params.script, productName, params.lang)
  if (!params.geminiKey) return fallback
  // P4r — MS register: thumbnail hooks must read as bahasa ROJAK (the casual MY
  // TikTok caption voice), not formal Malay, and NEVER leak Vietnamese (the dev/
  // source language). EN/VI fall through to the universal rule.
  const msHint = params.lang === 'ms'
    ? ` Write in natural Malaysian bahasa ROJAK (casual MY TikTok caption voice, light English mix like ` +
      `"Free", "Best", "Confirm" is fine). NEVER write any Vietnamese. Use MY hook energy: "Korang kena tengok ni", ` +
      `"Jangan beli sebelum...", "Confirm menyesal kalau...", "Rahsia yang shop tak bagitau".`
    : ''
  try {
    const raw = await directGeminiText({
      apiKey: params.geminiKey,
      systemInstruction:
        `You write THUMBNAIL hooks for a TikTok ad. Output 4 DIFFERENT hooks in ${langName}, each 3-7 words, ` +
        `SHORT + punchy, designed to STOP the scroll via a curiosity gap (a question, bold claim, "secret", ` +
        `"don't buy before…"). No hashtags, no emojis, no quotes. Base them on the product + script.${msHint} ` +
        `Return strict JSON: {"hooks":["...","...","...","..."]}`,
      prompt: `PRODUCT: ${productName}\nSCRIPT: ${scriptText}\n\nWrite the 4 thumbnail hooks now.`,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: { hooks: { type: 'array', items: { type: 'string' } } },
        required: ['hooks'],
      },
      thinkingBudget: 0,
    })
    const parsed = JSON.parse(raw) as { hooks?: unknown }
    let hooks = Array.isArray(parsed.hooks)
      ? parsed.hooks.map((h) => String(h).trim()).filter((h) => h.length >= 2 && h.length <= 60)
      : []
    // P4r — anti-VN-leak for MS: Malay never carries Vietnamese diacritics, so any
    // hook that does is contaminated → swap it for the (MS) fallback.
    if (params.lang === 'ms') hooks = hooks.map((h, n) => (VN_DIACRITICS_RE.test(h) ? (fallback[n] ?? fallback[0]) : h))
    while (hooks.length < 4) hooks.push(fallback[hooks.length % fallback.length])
    return hooks.slice(0, 4)
  } catch (err) {
    console.warn('[THUMBNAIL] hook generation failed — using fallback hooks', err)
    return fallback
  }
}

// P4r — VN-only diacritics (Malay is plain a-z). Any of these on an MS hook = a
// Vietnamese leak. Same signal used for MS stickers in brollDirector.
const VN_DIACRITICS_RE = /[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/

// P4r — language-aware fallback. The 3 non-script hooks used to be HARD-CODED
// Vietnamese → an MS video that hit a Gemini rate-limit got Vietnamese thumbnail
// text. Now each language has its own set; hook #1 still comes from the script's
// own hook (already in the right language). MS = bahasa rojak.
function buildFallbackHooks(script: GeneratedScript, productName: string, lang: ScriptLang): string[] {
  const hookBlock = script.blocks.find((b) => b.id === 'hook')?.text ?? ''
  const firstClause = hookBlock.split(/[.!?…\n]/)[0]?.trim().slice(0, 50) ?? ''
  const name = productName.slice(0, 28)
  const set = lang === 'ms'
    ? ['Aku hampir give up...', 'Sebelum vs Selepas guna', `${name || 'Produk ni'} — try je terus suka`, 'Kenapa semua orang sorok benda ni?']
    : lang === 'en'
    ? ['I almost gave up...', 'Before vs After using it', `${name || 'This product'} — try it, you’ll love it`, 'Why is everyone hiding this?']
    : ['Mình suýt bỏ cuộc...', 'Trước vs Sau khi dùng', `${name || 'Sản phẩm này'} — thử là mê`, 'Tại sao ai cũng giấu cái này?']
  return [firstClause.length >= 6 ? firstClause : set[0], set[1], set[2], set[3]]
}

/** Render ONE AI thumbnail for an archetype (GPT-4o i2i with avatar + product
 *  refs). Returns the asset:xxx ref. Throws on failure (caller marks the card). */
export async function generateAiThumbnail(params: {
  kieApiKey: string
  archetypeId: ThumbnailArchetypeId
  hook: string
  langName: string
  avatar: Model | null
  product: Product | null
}): Promise<string> {
  // P6aq — PRODUCT fidelity is the priority (the user audited SEVERE product drift: a
  // medicated PATCH rendered as a generic oil bottle). Anchor the product FIRST and with
  // MULTIPLE reference angles (up to 3) so gpt-4o-image locks its real type/form; the avatar
  // (1 ref) still locks the face via the prompt's content-based role assignment. Was: avatar
  // first + a SINGLE product ref → the lone secondary product ref got overridden by the hook
  // topic and drifted to a stereotypical product.
  const filesUrl: string[] = []
  const productImgs = (params.product?.productImages?.length
    ? params.product.productImages
    : [params.product?.productImage])
    .filter((x): x is string => !!x)
    .slice(0, 3)
  for (const img of productImgs) {
    const u = isAssetRef(img) ? await getUrl(img) : img
    if (u) filesUrl.push(u)
  }
  if (params.avatar?.characterImage) {
    const u = isAssetRef(params.avatar.characterImage) ? await getUrl(params.avatar.characterImage) : params.avatar.characterImage
    if (u) filesUrl.push(u)
  }
  const prompt = buildArchetypePrompt(params.archetypeId, params.hook, params.langName)
  const remoteUrl = await generateGpt4oImageFast({
    apiKey: params.kieApiKey,
    prompt,
    filesUrl,
    size: '2:3',
    softTimeoutMs: 100_000,
    attemptTimeoutMs: 150_000,
    maxAttempts: 2,
  })
  const blob = await fetch(remoteUrl).then((r) => r.blob())
  return saveAsset(blob, blob.type || 'image/png')
}
