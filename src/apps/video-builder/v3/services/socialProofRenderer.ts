// ── Social-proof card renderer (P5v) ─────────────────────────────────────────
// Draws a full-frame 9:16 "social proof" card — a GENERIC shop-style review / sold-
// count card (NOT a clone of Shopee/TikTok UI, to avoid impersonation) — on a canvas
// and exports a PNG. Held ~2-3s as its own scene (the spy-ad "screenshot of reviews /
// sold count" beat). Text + numbers are drawn by US → 100% accurate (vs AI which
// garbles review text). Universal: product-agnostic; copy + defaults per language.
//
// Numbers/reviews come from the caller (real data from the brief when available, else
// the plausible per-language defaults here). The spoken script never invents a specific
// figure — only THIS visual carries the crowd numbers (an ad convention).
// ─────────────────────────────────────────────────────────────────────────────

import type { ScriptLang } from '../types'
import { SCRIPT_LANG_GEMINI_NAME } from '../types'
import { generateGpt4oImageFast } from '../../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'

export interface SocialProofReview { name: string; text: string; stars?: number }
export interface SocialProofOpts {
  lang: ScriptLang
  productName: string
  /** "Đã bán 12k+" style — caller may pass a real figure; else a localized default. */
  soldText?: string
  rating?: number            // 4.9 etc
  ratingCount?: string       // "10k+ đánh giá"
  reviews?: SocialProofReview[]
  /** Optional product thumbnail (asset URL) for the header; a placeholder otherwise. */
  thumbUrl?: string
}

// Generic, plausible, product-agnostic defaults per language (no niche, no cert).
const DEFAULTS: Record<ScriptLang, {
  sold: string; ratingCount: string; hot: string; bought: string; reviews: SocialProofReview[]
}> = {
  vi: {
    sold: 'Đã bán 12k+', ratingCount: '10k+ đánh giá', hot: 'BÁN CHẠY', bought: 'Đã mua',
    reviews: [
      { name: 'Mai Anh', text: 'Dùng thấy ổn thật, mình mua lại lần 2 luôn rồi.' },
      { name: 'Trang Nguyễn', text: 'Cả nhà ai cũng thích, đáng tiền, sẽ ủng hộ tiếp.' },
    ],
  },
  ms: {
    sold: 'Terjual 12k+', ratingCount: '10k+ penilaian', hot: 'LARIS', bought: 'Telah beli',
    reviews: [
      { name: 'Aisyah', text: 'Memang berbaloi, saya dah repeat order kali kedua.' },
      { name: 'Siti', text: 'Satu rumah suka, confirm beli lagi. Recommend!' },
    ],
  },
  en: {
    sold: '12k+ sold', ratingCount: '10k+ reviews', hot: 'BEST SELLER', bought: 'Verified buyer',
    reviews: [
      { name: 'Emma', text: 'It actually works — already ordered my second one.' },
      { name: 'Sarah', text: 'The whole family loves it, totally worth it.' },
    ],
  },
}

// P6q — IDENTITY VARIATION (anti-fingerprint at scale). The reviewer names/faces/blurbs
// were effectively CONSTANT on every render: the canvas drew 2 HARDCODED names, and the AI
// path sent an IDENTICAL prompt → GPT-4o kept drawing the same default face + name. Across
// many videos that repeats the SAME fake reviewer → instantly spottable. Pull a RANDOM
// distinct identity per render from per-language pools (canvas) and inject random names +
// a varied persona into the AI prompt so each card shows a different believable person.
const NAME_POOL: Record<ScriptLang, string[]> = {
  vi: ['Mai Anh', 'Trang Nguyễn', 'Thu Hà', 'Ngọc Linh', 'Phương Thảo', 'Hồng Nhung', 'Quỳnh Chi', 'Kim Oanh', 'Bích Phương', 'Diệu Linh', 'Anh Thư', 'Lan Hương', 'Tuấn Anh', 'Minh Đức', 'Hoàng Long', 'Văn Hùng', 'Thanh Tâm', 'Gia Bảo', 'Đức Huy', 'Kim Ngân'],
  ms: ['Aisyah', 'Siti Nurul', 'Farah', 'Nurul Huda', 'Zarina', 'Hidayah', 'Liyana', 'Amirah', 'Suhaila', 'Nabila', 'Faridah Aziz', 'Aiman', 'Faizal', 'Hafiz', 'Syafiq', 'Iskandar', 'Khairul', 'Azlan', 'Shafiq', 'Hanis'],
  en: ['Emma', 'Sarah', 'Jessica', 'Rachel', 'Olivia', 'Sophie', 'Hannah', 'Chloe', 'Grace', 'Megan', 'Michael', 'David', 'James', 'Daniel', 'Ryan', 'Jason', 'Kevin', 'Laura', 'Amanda', 'Nicole'],
}
const REVIEW_POOL: Record<ScriptLang, string[]> = {
  vi: ['Dùng thấy ổn thật, mình mua lại lần 2 luôn rồi.', 'Cả nhà ai cũng thích, đáng tiền, sẽ ủng hộ tiếp.', 'Lúc đầu hơi nghi ngờ mà giờ ưng lắm.', 'Giao nhanh, xài thích, recommend nha mọi người.', 'Đúng như mô tả, không hối hận khi mua.', 'Bất ngờ luôn, hiệu quả hơn mình tưởng.', 'Mua cho người nhà, ai cũng khen.', 'Chất lượng ổn so với giá tiền.', 'Xài một thời gian rồi mà vẫn rất ưng.', 'Bạn bè giới thiệu, dùng xong nghiện luôn.'],
  ms: ['Memang berbaloi, saya dah repeat order kali kedua.', 'Satu rumah suka, confirm beli lagi. Recommend!', 'Mula-mula ragu, tapi sekarang puas hati sangat.', 'Penghantaran laju, produk elok, berbaloi.', 'Macam dalam description, tak menyesal beli.', 'Hasil lagi bagus dari yang dijangka.', 'Beli untuk family, semua suka.', 'Kualiti ok untuk harga ni.', 'Dah guna lama, masih berpuas hati.', 'Kawan recommend, lepas guna terus suka.'],
  en: ['It actually works — already ordered my second one.', 'The whole family loves it, totally worth it.', 'Was skeptical at first but really happy now.', 'Fast delivery, love it, highly recommend.', 'Exactly as described, no regrets at all.', 'Better results than I expected honestly.', 'Bought it for my mum, she loves it.', 'Great quality for the price.', "Been using it a while, still impressed.", 'A friend recommended it, now I am hooked.'],
}
// Profile-photo persona for the AI FB-post (vary gender + age so faces differ; the output
// language carries the local look). Generic + respectful — no body/appearance prescriptions.
const PROOF_PERSONAS = ['a woman in her 20s', 'a woman in her 30s', 'a woman in her early 40s', 'a man in his 20s', 'a man in his 30s', 'a man in his 40s', 'a young parent', 'a middle-aged woman']
const SOLD_POOL: Record<ScriptLang, string[]> = {
  vi: ['Đã bán 8k+', 'Đã bán 12k+', 'Đã bán 15k+', 'Đã bán 9k+', 'Đã bán 20k+'],
  ms: ['Terjual 8k+', 'Terjual 12k+', 'Terjual 15k+', 'Terjual 9k+', 'Terjual 20k+'],
  en: ['8k+ sold', '12k+ sold', '15k+ sold', '9k+ sold', '20k+ sold'],
}
const AV_POOL = ['#7E57C2', '#26A69A', '#EC407A', '#42A5F5', '#FF7043', '#5C6BC0', '#26C6DA', '#9CCC65']

const pickRand = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const pickRandN = <T>(a: T[], n: number): T[] => {
  const pool = a.slice(); const out: T[] = []
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  return out
}

const FONT = `'Be Vietnam Pro', system-ui, sans-serif`
const GOLD = '#FFB400'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w } else cur = t
    if (lines.length === maxLines) break
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  return lines
}

function stars(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, n = 5) {
  ctx.font = `${size}px ${FONT}`
  ctx.fillStyle = GOLD
  ctx.textBaseline = 'middle'
  ctx.fillText('★★★★★'.slice(0, n), x, y)
}

async function loadImg(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return null
  return await new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export async function renderSocialProofCanvas(opts: SocialProofOpts): Promise<HTMLCanvasElement> {
  const d = DEFAULTS[opts.lang] ?? DEFAULTS.vi
  const lang: ScriptLang = NAME_POOL[opts.lang] ? opts.lang : 'vi'
  const soldText = opts.soldText?.trim() || pickRand(SOLD_POOL[lang])
  const rating = (opts.rating && opts.rating > 0 ? opts.rating : pickRand([4.7, 4.8, 4.9])).toFixed(1)
  const ratingCount = opts.ratingCount?.trim() || d.ratingCount
  // P6q — random DISTINCT reviewer identities per render (anti-fingerprint at scale).
  const rNames = pickRandN(NAME_POOL[lang], 2)
  const rTexts = pickRandN(REVIEW_POOL[lang], 2)
  const reviews = (opts.reviews?.length
    ? opts.reviews
    : rNames.map((nm, i) => ({ name: nm, text: rTexts[i], stars: 5 }))
  ).slice(0, 2)
  const name = opts.productName?.trim() || 'Sản phẩm'

  try {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts) { await fonts.load(`700 40px 'Be Vietnam Pro'`).catch(() => {}); await fonts.ready }
  } catch { /* best-effort */ }
  const thumb = await loadImg(opts.thumbUrl)

  const W = 540, H = 960, dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * dpr; canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  // Soft light background.
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#EEF1F7'); bg.addColorStop(1, '#FFFFFF')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  const PAD = 34
  let y = 150

  // ── Header card: thumb + name + rating + sold + hot badge ──────────────────
  const cardX = PAD, cardW = W - PAD * 2, cardH = 190
  ctx.save(); ctx.shadowColor = 'rgba(20,30,60,0.12)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8
  ctx.fillStyle = '#FFFFFF'; roundRect(ctx, cardX, y, cardW, cardH, 26); ctx.fill(); ctx.restore()

  const th = 130, tx = cardX + 24, ty = y + (cardH - th) / 2
  ctx.save(); roundRect(ctx, tx, ty, th, th, 18); ctx.clip()
  if (thumb) ctx.drawImage(thumb, tx, ty, th, th)
  else { ctx.fillStyle = '#FFE0B2'; ctx.fillRect(tx, ty, th, th); ctx.fillStyle = '#E67E22'; ctx.font = `800 64px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name[0]?.toUpperCase() || '★', tx + th / 2, ty + th / 2); ctx.textAlign = 'left' }
  ctx.restore()

  const ix = tx + th + 22, iw = cardX + cardW - ix - 22
  ctx.textBaseline = 'top'; ctx.fillStyle = '#1B1F2A'; ctx.font = `700 30px ${FONT}`
  const nameLines = wrap(ctx, name, iw, 2)
  nameLines.forEach((l, i) => ctx.fillText(l, ix, y + 30 + i * 36))
  let ry = y + 30 + nameLines.length * 36 + 10
  stars(ctx, ix, ry + 11, 26)
  ctx.fillStyle = '#1B1F2A'; ctx.font = `700 24px ${FONT}`; ctx.textBaseline = 'middle'
  ctx.fillText(` ${rating}`, ix + 150, ry + 11)
  ctx.fillStyle = '#8A93A6'; ctx.font = `500 22px ${FONT}`
  ctx.fillText(`· ${ratingCount}`, ix + 210, ry + 11)
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#E03E2F'; ctx.font = `800 26px ${FONT}`
  ctx.fillText(`🔥 ${soldText}`, ix, ry + 38)

  y += cardH + 28

  // ── Review rows ─────────────────────────────────────────────────────────────
  const AV = pickRandN(AV_POOL, AV_POOL.length)   // P6q — shuffled avatar colors per render
  reviews.forEach((rv, idx) => {
    const rh = 196
    ctx.save(); ctx.shadowColor = 'rgba(20,30,60,0.10)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6
    ctx.fillStyle = '#FFFFFF'; roundRect(ctx, cardX, y, cardW, rh, 24); ctx.fill(); ctx.restore()

    const av = 64, ax = cardX + 24, ay = y + 24
    ctx.fillStyle = AV[idx % AV.length]; ctx.beginPath(); ctx.arc(ax + av / 2, ay + av / 2, av / 2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = `800 32px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText((rv.name[0] || '?').toUpperCase(), ax + av / 2, ay + av / 2); ctx.textAlign = 'left'

    const rx = ax + av + 20
    ctx.fillStyle = '#1B1F2A'; ctx.font = `700 26px ${FONT}`; ctx.textBaseline = 'top'
    ctx.fillText(rv.name, rx, ay + 2)
    stars(ctx, rx, ay + 46, 22, Math.max(4, Math.min(5, rv.stars ?? 5)))
    ctx.fillStyle = '#16A34A'; ctx.font = `600 20px ${FONT}`; ctx.textBaseline = 'middle'
    ctx.fillText(`✓ ${d.bought}`, rx + 130, ay + 46 + 11)

    ctx.fillStyle = '#3A4255'; ctx.font = `500 25px ${FONT}`; ctx.textBaseline = 'top'
    const tw = cardX + cardW - rx - 24
    wrap(ctx, `"${rv.text}"`, tw, 3).forEach((l, i) => ctx.fillText(l, rx, ay + 92 + i * 32))
    y += rh + 20
  })

  return canvas
}

// ── AI path (P5v-2): a REALISTIC Facebook-post screenshot via GPT-4o image (the same
// engine as thumbnails). Looks like a real customer's post (header + caption + the
// product photo + reactions + 3 comments) → believable, unlike the plain canvas card.
// Text rendered in the script's language. The product photo is passed as a ref so the
// post shows the REAL product. Falls back to the canvas card if AI fails / no key.
function buildSocialProofPrompt(lang: ScriptLang, langName: string, productName: string): string {
  // P6q — inject a RANDOM persona + distinct names so GPT-4o renders a DIFFERENT believable
  // person each render (an identical prompt produced the same default face/name every time).
  const persona = pickRand(PROOF_PERSONAS)
  const names = pickRandN(NAME_POOL[lang] ?? NAME_POOL.vi, 4)
  const poster = names[0]
  const commenters = names.slice(1, 4)
  const commentWord = lang === 'ms' ? 'komen' : lang === 'en' ? 'comments' : 'bình luận'
  return `Create a REALISTIC screenshot of a FACEBOOK POST (mobile app UI), as if a happy real customer shared it. Make it believable — a real person's phone screenshot, NOT an ad poster, NOT a collage. Render ALL text crisply and correctly spelled in ${langName}.
LAYOUT top→bottom:
1) Post header: a round profile photo of ${persona} (an ordinary, candid everyday person — NOT a stock/model headshot) + the personal name "${poster}" in bold + " · 3h" + a small public/globe icon.
2) Caption (1–2 lines): "${poster}" warmly recommending the product — casual + genuine, in ${langName}.
3) The PRODUCT PHOTO (from the reference image) as the post's attached image — a natural real-life snapshot, the product clearly recognisable and UNCHANGED.
4) Reactions row: 👍❤️😍 + a like count (e.g. "${pickRand(['842', '1.2K', '967', '1.5K', '738'])}") + "${pickRand(['180', '248', '312', '156'])} ${commentWord}" + a few shares.
5) A thin divider, then THREE (3) comments — use these EXACT names in bold, one per comment: "${commenters[0]}", "${commenters[1]}", "${commenters[2]}". Each comment: a small round avatar of a DIFFERENT person (vary gender + age so no two look alike) + a short enthusiastic praise in ${langName} + "Like · Reply · 2h" + a couple of likes.
STYLE: authentic Facebook mobile screenshot, clean white UI, soft shadows, realistic. Make EVERY person look like a DIFFERENT real individual (different faces, ages, genders) so it never looks templated. Product: ${productName}.`
}

/** Generate the social-proof card as a realistic FB-post image (GPT-4o). Returns an
 *  asset ref. Falls back to the canvas card on any failure (no key / KIE error). */
export async function generateSocialProofImage(params: {
  kieApiKey: string
  lang: ScriptLang
  productName: string
  productImageRef?: string
  soldText?: string
  reviews?: SocialProofReview[]
}): Promise<string> {
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang]
  try {
    const filesUrl: string[] = []
    if (params.productImageRef) {
      const u = isAssetRef(params.productImageRef) ? await getUrl(params.productImageRef) : params.productImageRef
      if (u) filesUrl.push(u)
    }
    const remoteUrl = await generateGpt4oImageFast({
      apiKey: params.kieApiKey,
      prompt: buildSocialProofPrompt(params.lang, langName, params.productName?.trim() || 'the product'),
      filesUrl,
      size: '2:3',
      softTimeoutMs: 100_000, attemptTimeoutMs: 150_000, maxAttempts: 2,
    })
    const blob = await fetch(remoteUrl).then((r) => r.blob())
    return await saveAsset(blob, blob.type || 'image/png')
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[socialProof] AI gen failed → canvas fallback:', e)
    const blob = await renderSocialProofBlob({ lang: params.lang, productName: params.productName, soldText: params.soldText, reviews: params.reviews })
    return await saveAsset(blob, 'image/png')
  }
}

export async function renderSocialProofBlob(opts: SocialProofOpts): Promise<Blob> {
  const canvas = await renderSocialProofCanvas(opts)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('socialProof toBlob failed'))), 'image/png')
  })
}

// Dev helper — eyeball the card FREE from the console (0 credit):
//   __testSocialProof('vi', 'APRICOT SNACK')
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__testSocialProof = async (
    lang: ScriptLang, productName: string,
  ) => {
    const blob = await renderSocialProofBlob({ lang: lang ?? 'vi', productName: productName ?? 'Sản phẩm' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    return url
  }
  // __testSocialProofAI() — realistic FB-post via GPT-4o (≈6cr), using the current
  // project's KIE key + product image + output language. Eyeball the REAL look.
  ;(window as unknown as Record<string, unknown>).__testSocialProofAI = async () => {
    const settings = (await import('../../../../stores/settingsStore')).useSettingsStore.getState()
    const st = (await import('../stores/adsVideoStore')).useAdsVideoStore.getState().state
    const ref = await generateSocialProofImage({
      kieApiKey: settings.kieApiKey,
      lang: st.scriptBrain.outputLang,
      productName: st.inputs.product?.productName ?? 'Sản phẩm',
      productImageRef: st.inputs.product?.productImage ?? undefined,
    })
    const url = await getUrl(ref)
    if (url) window.open(url, '_blank')
    return url
  }
}
