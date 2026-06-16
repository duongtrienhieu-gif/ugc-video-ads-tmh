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
  const soldText = opts.soldText?.trim() || d.sold
  const rating = (opts.rating && opts.rating > 0 ? opts.rating : 4.9).toFixed(1)
  const ratingCount = opts.ratingCount?.trim() || d.ratingCount
  const reviews = (opts.reviews?.length ? opts.reviews : d.reviews).slice(0, 2)
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
  const AV = ['#7E57C2', '#26A69A', '#EC407A', '#42A5F5']
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
}
