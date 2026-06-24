// ── Reply-to-comment card renderer (P5) ──────────────────────────────────────
// Draws a TikTok-style "comment being replied to" card onto a canvas and exports a
// TRANSPARENT PNG — same 0-credit path as captions/banner. The card holds the comment
// the creator is answering (the comment IS the hook in reply mode); the assembler
// composites it near the TOP of the OPENING segments only, then it disappears.
// Universal vi/ms/en (system font covers all three). No real person is impersonated —
// the handle is a generic, derived pseudo-username.
// ─────────────────────────────────────────────────────────────────────────────

import { ensureCaptionFonts } from './captionRenderer'

// Logical canvas units (rendered at dpr=2). Width is fixed; height grows with the text.
const W = 960
const PAD = 44
const AV_R = 38                 // avatar circle radius
const NAME_PX = 34
const BODY_PX = 40
const BODY_LH = 54              // body line height
const MAX_LINES = 5             // cap a very long comment (with ellipsis) so the card stays compact
const MARG = 10                 // transparent margin around the card

// TikTok comment palette (light card).
const CARD_BG = '#FFFFFF'
const CARD_BORDER = 'rgba(0,0,0,0.06)'
const INK = '#161823'           // primary text (TikTok ink)
const SUB = '#8A8B91'           // username @, timestamp, heart/count (muted)

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Wrap `text` into ≤ maxLines lines that each fit `maxW`; the last line gets an ellipsis
 *  if the text overflows. `ctx.font` must already be set to the body font. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w
    if (ctx.measureText(trial).width <= maxW || !cur) {
      cur = trial
    } else {
      lines.push(cur)
      cur = w
      if (lines.length === maxLines) break
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  // Overflow → ellipsis on the last kept line.
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1]
    const joined = lines.join(' ')
    if (joined.replace(/\s+/g, ' ').trim().length < text.replace(/\s+/g, ' ').trim().length) {
      while (last && ctx.measureText(`${last}…`).width > maxW) last = last.replace(/\s+\S*$/, '')
      lines[maxLines - 1] = `${last}…`
    }
  }
  return lines
}

/** A stable, generic pseudo-handle derived from the comment (no Math.random → same comment =
 *  same handle on re-export). Reads like a real TikTok username; impersonates no one. */
function deriveHandle(comment: string): string {
  let h = 0
  for (let i = 0; i < comment.length; i++) h = (h * 31 + comment.charCodeAt(i)) >>> 0
  return `@user${1000 + (h % 9000)}`
}

/** Draw a small TikTok-style heart (liked = filled red) at (x, baseline y), height `s`. */
function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  const t = y - s
  ctx.moveTo(x + s / 2, y)
  ctx.bezierCurveTo(x + s / 2, y - s * 0.35, x, t - s * 0.05, x, t + s * 0.3)
  ctx.bezierCurveTo(x, t + s * 0.62, x + s * 0.28, t + s * 0.8, x + s / 2, y)
  ctx.bezierCurveTo(x + s - s * 0.28, t + s * 0.8, x + s, t + s * 0.62, x + s, t + s * 0.3)
  ctx.bezierCurveTo(x + s, t - s * 0.05, x + s / 2, t - s * 0.35, x + s / 2, y)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** Render the reply-to-comment card to a transparent canvas. */
export async function renderCommentCardCanvas(comment: string): Promise<HTMLCanvasElement> {
  await ensureCaptionFonts()
  const text = (comment ?? '').replace(/\s+/g, ' ').trim().slice(0, 220) || '...'
  const handle = deriveHandle(text)

  const nameFont = `700 ${NAME_PX}px 'Montserrat', 'Be Vietnam Pro', system-ui, sans-serif`
  const bodyFont = `400 ${BODY_PX}px system-ui, 'Segoe UI', 'Be Vietnam Pro', Roboto, sans-serif`

  // Measure wrapped body lines on a scratch context.
  const scratch = document.createElement('canvas').getContext('2d')!
  scratch.font = bodyFont
  const bodyMaxW = W - PAD * 2
  const lines = wrapLines(scratch, text, bodyMaxW, MAX_LINES)

  const headerH = AV_R * 2
  const bodyTop = PAD + headerH + 30
  const bodyH = lines.length * BODY_LH
  const footerTop = bodyTop + bodyH + 22
  const cardH = footerTop + 40 + PAD - PAD * 0.2   // heart row (~40) + bottom padding
  const H = Math.ceil(cardH + MARG * 2)

  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil((W + MARG * 2) * dpr)
  canvas.height = Math.ceil(H * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'

  // Card background (rounded, faint border).
  ctx.fillStyle = CARD_BG
  roundRect(ctx, MARG, MARG, W, cardH, 30)
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = CARD_BORDER
  ctx.stroke()

  const ox = MARG, oy = MARG

  // Avatar (gray circle + a simple head/shoulders glyph).
  const acx = ox + PAD + AV_R, acy = oy + PAD + AV_R
  ctx.fillStyle = '#E3E3E6'
  ctx.beginPath(); ctx.arc(acx, acy, AV_R, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#B9BAC0'
  ctx.beginPath(); ctx.arc(acx, acy - AV_R * 0.18, AV_R * 0.34, 0, Math.PI * 2); ctx.fill()       // head
  ctx.beginPath(); ctx.arc(acx, acy + AV_R * 0.62, AV_R * 0.58, Math.PI, Math.PI * 2); ctx.fill() // shoulders

  // Username + timestamp.
  ctx.font = nameFont
  ctx.fillStyle = SUB
  const nameX = acx + AV_R + 20
  ctx.fillText(`${handle}  ·  3h`, nameX, acy)

  // Comment body.
  ctx.font = bodyFont
  ctx.fillStyle = INK
  let y = oy + bodyTop + BODY_LH / 2
  for (const ln of lines) { ctx.fillText(ln, ox + PAD, y); y += BODY_LH }

  // Footer: a (liked) heart + count.
  const hy = oy + footerTop + 20
  drawHeart(ctx, ox + PAD, hy + 8, 26, '#FE2C55')
  ctx.font = `600 26px 'Montserrat', system-ui, sans-serif`
  ctx.fillStyle = SUB
  ctx.fillText(`${1 + (deriveHandle(text).length % 9)}.${(text.length % 9)}K`, ox + PAD + 40, hy)

  return canvas
}

/** Render + export the reply-to-comment card as a transparent PNG blob. */
export async function renderCommentCardBlob(comment: string): Promise<Blob> {
  const canvas = await renderCommentCardCanvas(comment)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('comment card toBlob failed'))), 'image/png')
  })
}

// Dev helper — eyeball the card FREE from the console:
//   __testCommentCard('Weh aku ni asyik pening je, lepas tu cepat semput. Risau pulak jantung aku ni…')
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__testCommentCard = async (comment: string) => {
    const blob = await renderCommentCardBlob(comment ?? 'Weh aku ni asyik pening je, lepas tu cepat semput. Risau pulak jantung ni…')
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    return url
  }
}
