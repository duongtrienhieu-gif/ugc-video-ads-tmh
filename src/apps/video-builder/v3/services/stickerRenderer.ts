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
  | 'list'   // hybrid — a stacked multi-item card (replaces the old multi-row overlay)

export const STICKER_STYLES: StickerStyle[] = [
  'number', 'countdown', 'pill', 'flag', 'badge', 'warning', 'price', 'highlight', 'arrow', 'list',
]

interface StyleSpec {
  /** Vietnamese label for the picker UI. */
  labelVi: string
  /** Emoji prepended when the director didn't supply one. '' = no emoji. */
  defaultEmoji: string
  /** Pill background (CSS color). 'transparent' = highlight (marker) style. */
  /** Ink (text) color — drawn on the shared paper background. The per-style
   *  colour now lives in the INK, not a solid pill, so every sticker reads as
   *  a friendly hand-drawn paper note while keeping a subtle colour code. */
  ink: string
}

export const STICKER_STYLE_META: Record<StickerStyle, StyleSpec> = {
  number:    { labelVi: 'Thông số',  defaultEmoji: '🔢', ink: '#3A3226' },
  countdown: { labelVi: 'Thời gian', defaultEmoji: '⏱', ink: '#3A3226' },
  pill:      { labelVi: 'Thành phần',defaultEmoji: '💧', ink: '#1D6FA3' },
  flag:      { labelVi: 'Xuất xứ',   defaultEmoji: '🌏', ink: '#1E4FA8' },
  badge:     { labelVi: 'Lợi ích',   defaultEmoji: '✅', ink: '#15803D' },
  warning:   { labelVi: 'Lưu ý',     defaultEmoji: '⚠', ink: '#B45309' },
  price:     { labelVi: 'Giá / Ưu đãi', defaultEmoji: '🔥', ink: '#C2410C' },
  highlight: { labelVi: 'Nhấn chữ',  defaultEmoji: '✏️', ink: '#A16207' },
  arrow:     { labelVi: 'Chỉ vào',   defaultEmoji: '👉', ink: '#3A3226' },
  list:      { labelVi: 'Danh sách', defaultEmoji: '',   ink: '#3A3226' },
}

export interface StickerRenderOpts {
  style: StickerStyle
  /** The text content (the director's label) — e.g. "3 giây", "Nano", "RM59". */
  text: string
  /** Optional emoji override; falls back to the style's defaultEmoji. */
  emoji?: string
  /** style 'list' only — 2-4 stacked items (each may start with its own emoji,
   *  e.g. "🔋 20000mAh"). Renders a multi-row card. */
  items?: string[]
}

// Render scale — the PNG is drawn big for crispness, then the final assembler
// scales it down to ~28% of the video width. Keep the proportions, not the px.
const FONT = 64           // main text px
const PAD_X = 40
const PAD_Y = 26
const RADIUS = 30
const EMOJI = FONT  // emoji 1:1 with the text size (user request)
const GAP = 16            // gap between emoji and text
// Hand-drawn look (Patrick Hand, loaded in index.html — has a Vietnamese subset).
// Be Vietnam Pro is the per-glyph fallback so any diacritic Patrick Hand lacks
// still renders. Patrick Hand is a single casual weight, so no bold prefix.
const FONT_STACK = `${FONT}px 'Patrick Hand', 'Be Vietnam Pro', system-ui, sans-serif`

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

const ROW_GAP = 14  // vertical gap between rows in a 'list' sticker

// Split a leading emoji off an item string ("🔋 20000mAh" → {emoji:"🔋", text:"20000mAh"}).
function splitLeadingEmoji(s: string): { emoji: string; text: string } {
  const m = s.match(/^(\p{Extended_Pictographic}️?)\s*/u)
  if (m) return { emoji: m[1], text: s.slice(m[0].length).trim() }
  return { emoji: '', text: s.trim() }
}

// Hybrid — a stacked multi-item card (replaces the old multi-row hand-drawn overlay).
// Self-contained: it reuses the SAME paper-note look but does NOT touch the single
// sticker path, so that battle-tested path can never regress.
async function renderListStickerCanvas(items: string[], ink: string): Promise<HTMLCanvasElement> {
  try {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts) { await fonts.load(`${FONT}px 'Patrick Hand'`, items.join(' ') || 'x').catch(() => {}); await fonts.ready }
  } catch { /* best-effort */ }

  const rows = items.map((it) => splitLeadingEmoji(it)).filter((r) => r.text || r.emoji).slice(0, 4)
  if (rows.length === 0) rows.push({ emoji: '', text: '…' })
  const scratch = document.createElement('canvas').getContext('2d')!
  scratch.font = FONT_STACK
  let maxRowW = 0
  const measured = rows.map((r) => {
    const tw = Math.ceil(scratch.measureText(r.text || '…').width)
    const ew = r.emoji ? EMOJI + GAP : 0
    if (ew + tw > maxRowW) maxRowW = ew + tw
    return { ...r, ew }
  })
  const rowH = Math.max(FONT, EMOJI)
  const innerH = measured.length * rowH + (measured.length - 1) * ROW_GAP
  const boxW = maxRowW + PAD_X * 2
  const boxH = innerH + PAD_Y * 2
  const SHADOW = 18
  const W = Math.ceil(boxW + SHADOW * 2)
  const H = Math.ceil(boxH + SHADOW * 2)
  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.textBaseline = 'middle'
  const bx = SHADOW
  const by = SHADOW

  // PAPER NOTE background (same look as the single sticker).
  ctx.save()
  ctx.shadowColor = 'rgba(60,40,15,0.30)'
  ctx.shadowBlur = SHADOW
  ctx.shadowOffsetY = 7
  ctx.fillStyle = '#FCF4E1'
  roundRectPath(ctx, bx, by, boxW, boxH, RADIUS)
  ctx.fill()
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, bx, by, boxW, boxH, RADIUS)
  ctx.clip()
  const specks = Math.min(220, Math.round((boxW * boxH) / 1400))
  for (let i = 0; i < specks; i++) {
    ctx.fillStyle = `rgba(120,90,40,${0.025 + Math.random() * 0.04})`
    ctx.fillRect(bx + Math.random() * boxW, by + Math.random() * boxH, 2, 2)
  }
  ctx.restore()
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(120,90,40,0.45)'
  roundRectPath(ctx, bx + 3, by + 3, boxW - 6, boxH - 6, RADIUS - 3)
  ctx.stroke()

  // Rows: optional emoji + handwritten text, stacked.
  let ry = by + PAD_Y + rowH / 2
  for (const r of measured) {
    let cx = bx + PAD_X
    if (r.emoji) {
      ctx.font = `${EMOJI}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`
      ctx.fillText(r.emoji, cx, ry + 2)
      cx += r.ew
    }
    ctx.font = FONT_STACK
    ctx.fillStyle = ink
    ctx.fillText(r.text || '…', cx, ry + 2)
    ry += rowH + ROW_GAP
  }
  return canvas
}

/** Draw the sticker onto a fresh canvas (transparent background) + return it. */
export async function renderStickerCanvas(opts: StickerRenderOpts): Promise<HTMLCanvasElement> {
  // Hybrid — a 'list' sticker is a separate stacked-card renderer. The single
  // sticker path below stays 100% untouched.
  if (opts.style === 'list' && opts.items && opts.items.length > 0) {
    return renderListStickerCanvas(opts.items, STICKER_STYLE_META.list.ink)
  }
  // Ensure the hand-drawn font (+ its VN glyphs) is loaded BEFORE measuring/
  // drawing — otherwise the first sticker silently falls back to a sans font
  // and gets mis-measured. Load with the actual text so the right subset loads.
  try {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts) {
      await fonts.load(`${FONT}px 'Patrick Hand'`, (opts.text ?? '') || 'x').catch(() => {})
      await fonts.ready
    }
  } catch { /* best-effort */ }

  const spec = STICKER_STYLE_META[opts.style]
  const emoji = (opts.emoji ?? spec.defaultEmoji).trim()
  const text = (opts.text ?? '').trim() || '…'

  // Measure on a scratch context first so we can size the canvas to the content.
  const scratch = document.createElement('canvas').getContext('2d')!
  scratch.font = FONT_STACK
  const textW = Math.ceil(scratch.measureText(text).width)
  const emojiW = emoji ? EMOJI + GAP : 0

  const innerW = emojiW + textW
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

  // ── PAPER NOTE background ──────────────────────────────────────────────────
  // Warm cream fill + soft lifted shadow → reads as a hand-stuck paper label.
  ctx.save()
  ctx.shadowColor = 'rgba(60,40,15,0.30)'
  ctx.shadowBlur = SHADOW
  ctx.shadowOffsetY = 7
  ctx.fillStyle = '#FCF4E1'  // cream paper
  roundRectPath(ctx, bx, by, boxW, boxH, RADIUS)
  ctx.fill()
  ctx.restore()

  // Subtle paper grain — a sprinkle of faint warm specks, clipped to the note.
  ctx.save()
  roundRectPath(ctx, bx, by, boxW, boxH, RADIUS)
  ctx.clip()
  const specks = Math.min(120, Math.round((boxW * boxH) / 1400))
  for (let i = 0; i < specks; i++) {
    const gx = bx + Math.random() * boxW
    const gy = by + Math.random() * boxH
    ctx.fillStyle = `rgba(120,90,40,${0.025 + Math.random() * 0.04})`
    ctx.fillRect(gx, gy, 2, 2)
  }
  ctx.restore()

  // Thin hand-drawn-ish ink border just inside the edge.
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(120,90,40,0.45)'
  roundRectPath(ctx, bx + 3, by + 3, boxW - 6, boxH - 6, RADIUS - 3)
  ctx.stroke()

  // ── Content: emoji (1.5× text) + handwritten ink text ─────────────────────
  let cx = bx + PAD_X
  if (emoji) {
    ctx.font = `${EMOJI}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`
    ctx.fillText(emoji, cx, cy + 2)
    cx += emojiW
  }
  ctx.font = FONT_STACK
  ctx.fillStyle = spec.ink
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
  // __testStickerList('🔋 20000mAh', '⏱ 4 tiếng', '⚡ 30 phút')  → opens the card.
  ;(window as unknown as Record<string, unknown>).__testStickerList = async (...items: string[]) => {
    const blob = await renderStickerBlob({ style: 'list', text: '', items })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    return url
  }
}
