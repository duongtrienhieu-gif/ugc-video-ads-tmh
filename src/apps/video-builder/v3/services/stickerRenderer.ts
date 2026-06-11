// ── Sticker renderer (Z98 #5) ────────────────────────────────────────────────
// LOCAL, ZERO-credit TikTok-style stickers drawn on an HTML canvas and exported
// as TRANSPARENT PNGs. They ride in the corner of the talking-head (overlay),
// popping up on the spoken keyword, so the 22s of "dead" talking-head between
// B-roll cuts becomes lively without burning a single Grok render.
//
// 9 styles are organised by CONTENT TYPE, not product niche, so the same set
// serves skincare, supplements, appliances, agriculture, tools, fashion, etc:
//   number    — a measured spec        ("20kPa", "98%", "1400 vòng", "16MP")
//   countdown — a time / duration      ("3 giây", "2 tuần", "180 phút")
//   pill      — an ingredient/part name("Nano", "HEPA", "Inox 304", "Cotton")
//   flag      — an origin / brand      ("Korea", "Japan", "Made in VN")
//   badge     — a short benefit claim  ("Chống gỉ", "Kháng khuẩn", "An toàn")
//   warning   — a caution / note       ("Không cho trẻ em", "Bảo hành 2 năm")
//   price     — a price / offer / CTA  ("RM59", "-50%", "Combo")
//   highlight — emphasise any keyword  (marker swipe behind the word)
//   arrow     — point at something      ("Nút này", "Đây nè")
//
// This file is PURE rendering — no schema, no store, no assembler coupling.
// Later sub-commits wire the director (5.2), word-level timing (5.3), the card
// UI (5.4) and the final assembler (5.5) to it.

export type StickerStyle =
  | 'number' | 'countdown' | 'pill' | 'flag'
  | 'badge' | 'warning' | 'price' | 'highlight' | 'arrow'

export const STICKER_STYLES: StickerStyle[] = [
  'number', 'countdown', 'pill', 'flag', 'badge', 'warning', 'price', 'highlight', 'arrow',
]

interface StyleSpec {
  /** Vietnamese label for the picker UI. */
  labelVi: string
  /** Emoji prepended when the director didn't supply one. '' = no emoji. */
  defaultEmoji: string
  /** Pill background (CSS color). 'transparent' = highlight (marker) style. */
  bg: string
  /** Text color. */
  fg: string
  /** Optional left accent bar color (number style). */
  accent?: string
  /** Draw a thin outer border (stamp look). */
  border?: boolean
}

export const STICKER_STYLE_META: Record<StickerStyle, StyleSpec> = {
  number:    { labelVi: 'Thông số',  defaultEmoji: '',   bg: '#FFFFFF', fg: '#0F172A', accent: '#2563EB' },
  countdown: { labelVi: 'Thời gian', defaultEmoji: '⏱', bg: '#111827', fg: '#FFFFFF' },
  pill:      { labelVi: 'Thành phần',defaultEmoji: '💧', bg: '#FFFFFF', fg: '#0F172A' },
  flag:      { labelVi: 'Xuất xứ',   defaultEmoji: '🌏', bg: '#FFFFFF', fg: '#0F172A', border: true },
  badge:     { labelVi: 'Lợi ích',   defaultEmoji: '✓',  bg: '#16A34A', fg: '#FFFFFF' },
  warning:   { labelVi: 'Lưu ý',     defaultEmoji: '⚠', bg: '#F59E0B', fg: '#1F2937' },
  price:     { labelVi: 'Giá / Ưu đãi', defaultEmoji: '💰', bg: '#EF4444', fg: '#FFFFFF' },
  highlight: { labelVi: 'Nhấn chữ',  defaultEmoji: '',   bg: 'transparent', fg: '#0F172A' },
  arrow:     { labelVi: 'Chỉ vào',   defaultEmoji: '👉', bg: '#FFFFFF', fg: '#0F172A' },
}

export interface StickerRenderOpts {
  style: StickerStyle
  /** The text content (the director's label) — e.g. "3 giây", "Nano", "RM59". */
  text: string
  /** Optional emoji override; falls back to the style's defaultEmoji. */
  emoji?: string
}

// Render scale — the PNG is drawn big for crispness, then the final assembler
// scales it down to ~28% of the video width. Keep the proportions, not the px.
const FONT = 64           // main text px
const PAD_X = 40
const PAD_Y = 26
const RADIUS = 30
const EMOJI = Math.round(FONT * 1.5)  // emoji 1.5× the text size (user request)
const GAP = 16            // gap between emoji and text
const FONT_STACK = `800 ${FONT}px 'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Draw the sticker onto a fresh canvas (transparent background) + return it. */
export async function renderStickerCanvas(opts: StickerRenderOpts): Promise<HTMLCanvasElement> {
  // Ensure the app font is available so VN diacritics render correctly.
  try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready } catch { /* best-effort */ }

  const spec = STICKER_STYLE_META[opts.style]
  const emoji = (opts.emoji ?? spec.defaultEmoji).trim()
  const text = (opts.text ?? '').trim() || '…'

  // Measure on a scratch context first so we can size the canvas to the content.
  const scratch = document.createElement('canvas').getContext('2d')!
  scratch.font = FONT_STACK
  const textW = Math.ceil(scratch.measureText(text).width)
  const emojiW = emoji ? EMOJI + GAP : 0
  const accentW = opts.style === 'number' && spec.accent ? 14 + GAP : 0

  const innerW = emojiW + accentW + textW
  const boxW = innerW + PAD_X * 2
  // Height tracks the TALLER of text vs emoji so the bigger emoji isn't clipped.
  const boxH = Math.max(FONT, emoji ? EMOJI : 0) + PAD_Y * 2
  const SHADOW = 18
  const W = Math.ceil(boxW + SHADOW * 2)
  const H = Math.ceil(boxH + SHADOW * 2)

  const dpr = 2  // crisp at downscale
  const canvas = document.createElement('canvas')
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.textBaseline = 'middle'

  const bx = SHADOW
  const by = SHADOW
  const cy = by + boxH / 2

  if (opts.style === 'highlight') {
    // Marker swipe behind the text — no solid box, mostly-transparent sticker.
    ctx.font = FONT_STACK
    const markH = FONT * 0.92
    ctx.fillStyle = 'rgba(250, 204, 21, 0.85)'  // marker yellow
    roundRectPath(ctx, bx, cy - markH / 2, textW + PAD_X, markH, 10)
    ctx.fill()
    ctx.fillStyle = spec.fg
    ctx.fillText(text, bx + PAD_X / 2, cy + 2)
    return canvas
  }

  // Drop shadow for separation on busy video.
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.32)'
  ctx.shadowBlur = SHADOW
  ctx.shadowOffsetY = 6
  ctx.fillStyle = spec.bg
  roundRectPath(ctx, bx, by, boxW, boxH, RADIUS)
  ctx.fill()
  ctx.restore()

  if (spec.border) {
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(15,23,42,0.55)'
    roundRectPath(ctx, bx + 2, by + 2, boxW - 4, boxH - 4, RADIUS - 2)
    ctx.stroke()
  }

  let cx = bx + PAD_X
  if (accentW) {
    ctx.fillStyle = spec.accent!
    roundRectPath(ctx, cx, by + PAD_Y, 14, boxH - PAD_Y * 2, 7)
    ctx.fill()
    cx += accentW
  }
  if (emoji) {
    ctx.font = `${EMOJI}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`
    ctx.fillText(emoji, cx, cy + 2)
    cx += emojiW
  }
  ctx.font = FONT_STACK
  ctx.fillStyle = spec.fg
  ctx.fillText(text, cx, cy + 2)

  return canvas
}

/** Render + export a TRANSPARENT PNG blob (the form the asset store + assembler want). */
export async function renderStickerBlob(opts: StickerRenderOpts): Promise<Blob> {
  const canvas = await renderStickerCanvas(opts)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('sticker toBlob failed'))), 'image/png')
  })
}

// ── Dev helper — test any style from the browser console without the full UI.
//   __testSticker('countdown', '3 giây')  → opens the PNG in a new tab.
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__testSticker = async (
    style: StickerStyle, text: string, emoji?: string,
  ) => {
    const blob = await renderStickerBlob({ style, text, emoji })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    return url
  }
}
