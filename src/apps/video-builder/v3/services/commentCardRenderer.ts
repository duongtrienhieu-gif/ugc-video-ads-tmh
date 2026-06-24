// ── Reply-to-comment card renderer (P5) ──────────────────────────────────────
// Draws the TikTok "Reply to … comment" STICKER (white speech bubble with a tail) onto a canvas
// and exports a TRANSPARENT PNG — same 0-credit path as captions/banner. Matches the real TikTok
// sticker: a gray avatar + "Reply to <name>'s comment" header line, then the comment in BIG BOLD
// text, and a speech-bubble tail bottom-left. NO heart, NO like-count, NO timestamp (TikTok's reply
// sticker shows none). The assembler composites it near the TOP of the OPENING segments only.
// Universal vi/ms/en + emoji (system font covers all). No real person is impersonated — the name is
// a generic, derived pseudo-username.
// ─────────────────────────────────────────────────────────────────────────────

import { ensureCaptionFonts } from './captionRenderer'

// Logical canvas units (rendered at dpr=2). Width is fixed; height grows with the text.
const W = 980
const PADX = 46
const PADTOP = 40
const PADBOTTOM = 46
const AV_R = 30                 // avatar circle radius
const HEADER_PX = 30            // "Reply to <name>'s comment" line
const BODY_PX = 50              // the comment — BIG + BOLD (the TikTok look)
const BODY_LH = 62              // body line height
const MAX_LINES = 4             // cap a very long comment (ellipsis) so the bubble stays compact
const MARG = 12                 // transparent margin around the bubble
const TAIL_H = 34               // speech-bubble tail height below the card

// TikTok reply-sticker palette (white bubble).
const CARD_BG = '#FFFFFF'
const INK = '#161823'           // the comment text + bold name (TikTok ink)
const SUB = '#73747B'           // the "Reply to" prefix (muted gray)

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

/** Wrap `text` into ≤ maxLines lines that each fit `maxW`; last line gets an ellipsis on overflow.
 *  `ctx.font` must already be set to the body font. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w
    if (ctx.measureText(trial).width <= maxW || !cur) cur = trial
    else { lines.push(cur); cur = w; if (lines.length === maxLines) break }
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  if (lines.length === maxLines) {
    const full = text.replace(/\s+/g, ' ').trim()
    if (lines.join(' ').length < full.length) {
      let last = lines[maxLines - 1]
      while (last && ctx.measureText(`${last}…`).width > maxW) last = last.replace(/\s+\S*$/, '')
      lines[maxLines - 1] = `${last}…`
    }
  }
  return lines
}

// A pool of realistic TikTok-style handles (Malay + Vietnamese + neutral, romanized — looks real on
// either market). Combined with a separator + optional digits → hundreds of unique handles, so at
// scale it does NOT read as "the same user asking on every video" (the audited fake-tell), while a
// real person is never impersonated. Latin only (renders everywhere).
const HANDLE_NAMES = [
  'aisyah', 'nurul', 'farah', 'siti', 'amira', 'fatin', 'sofea', 'hana', 'liyana', 'aina',
  'nadia', 'mira', 'dahlia', 'izzah', 'najwa', 'intan', 'balqis', 'suria', 'zara', 'rina',
  'faiz', 'amir', 'danish', 'irfan', 'syafiq', 'haziq', 'adib', 'hakim', 'aziz', 'iskandar',
  'linh', 'trang', 'huong', 'ngoc', 'thao', 'myle', 'vy', 'nhi', 'chi', 'lan',
  'minh', 'tuan', 'quan', 'duy', 'khoa', 'phuc', 'mai', 'hanh', 'an', 'thu',
]
const HANDLE_SEP = ['_', '.', '', '_', '']
/** Build a stable, realistic, VARIED handle from the comment (deterministic → preview matches the
 *  burned card + re-export is stable; varies across different comments so it never looks repeated). */
function deriveName(comment: string): string {
  let h = 0
  for (let i = 0; i < comment.length; i++) h = (h * 31 + comment.charCodeAt(i)) >>> 0
  const name = HANDLE_NAMES[h % HANDLE_NAMES.length]
  const sep = HANDLE_SEP[(h >>> 8) % HANDLE_SEP.length]
  const tail = ['', String((h >>> 12) % 100), String(90 + ((h >>> 16) % 10)), String((h >>> 4) % 1000)][(h >>> 20) % 4]
  return `${name}${sep}${tail}`
}

/** Render the TikTok "Reply to … comment" sticker to a transparent canvas. */
export async function renderCommentCardCanvas(comment: string): Promise<HTMLCanvasElement> {
  await ensureCaptionFonts()
  const text = (comment ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || '...'
  const name = deriveName(text)

  const headerFont = `500 ${HEADER_PX}px system-ui, 'Segoe UI', 'Be Vietnam Pro', Roboto, sans-serif`
  const headerBold = `800 ${HEADER_PX}px system-ui, 'Segoe UI', 'Be Vietnam Pro', Roboto, sans-serif`
  const bodyFont = `800 ${BODY_PX}px system-ui, 'Segoe UI', 'Be Vietnam Pro', Roboto, sans-serif`

  // Measure wrapped body lines.
  const scratch = document.createElement('canvas').getContext('2d')!
  scratch.font = bodyFont
  const bodyMaxW = W - PADX * 2
  const lines = wrapLines(scratch, text, bodyMaxW, MAX_LINES)

  const bodyTop = PADTOP + AV_R * 2 + 26
  const cardH = bodyTop + lines.length * BODY_LH + PADBOTTOM
  const H = Math.ceil(cardH + TAIL_H + MARG * 2)

  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil((W + MARG * 2) * dpr)
  canvas.height = Math.ceil(H * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.textAlign = 'left'

  const ox = MARG, oy = MARG
  const cardBottom = oy + cardH

  // White speech bubble + a tail at the bottom-left (drawn first, merged with the card fill).
  ctx.fillStyle = CARD_BG
  roundRect(ctx, ox, oy, W, cardH, 34)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(ox + 46, cardBottom - 6)
  ctx.lineTo(ox + 46 + 58, cardBottom - 6)
  ctx.lineTo(ox + 38, cardBottom + TAIL_H)
  ctx.closePath()
  ctx.fill()

  // Avatar — TikTok default placeholder: light-gray circle + a clean head+shoulders silhouette
  // CLIPPED to the circle (the shoulders are cut by the rim, not a blob spilling outside it).
  const acx = ox + PADX + AV_R, acy = oy + PADTOP + AV_R
  ctx.fillStyle = '#E8E8EA'
  ctx.beginPath(); ctx.arc(acx, acy, AV_R, 0, Math.PI * 2); ctx.fill()
  ctx.save()
  ctx.beginPath(); ctx.arc(acx, acy, AV_R, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = '#BCBDC4'
  ctx.beginPath(); ctx.arc(acx, acy - AV_R * 0.22, AV_R * 0.32, 0, Math.PI * 2); ctx.fill()        // head
  ctx.beginPath(); ctx.arc(acx, acy + AV_R * 0.55, AV_R * 0.62, Math.PI, Math.PI * 2); ctx.fill()  // shoulders (clipped by rim)
  ctx.restore()

  // Header: "Reply to " (gray) + "<name>'s comment" (bold dark), centred on the avatar row.
  ctx.textBaseline = 'middle'
  const hx = acx + AV_R + 18
  ctx.font = headerFont
  ctx.fillStyle = SUB
  ctx.fillText('Reply to ', hx, acy)
  const prefixW = ctx.measureText('Reply to ').width
  ctx.font = headerBold
  ctx.fillStyle = INK
  ctx.fillText(`${name}'s comment`, hx + prefixW, acy)

  // Comment — BIG BOLD, dark, left-aligned, full width.
  ctx.font = bodyFont
  ctx.fillStyle = INK
  ctx.textBaseline = 'alphabetic'
  let y = oy + bodyTop + BODY_PX * 0.82
  for (const ln of lines) { ctx.fillText(ln, ox + PADX, y); y += BODY_LH }

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
//   __testCommentCard('Write any comment and see what happens 😊')
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__testCommentCard = async (comment: string) => {
    const blob = await renderCommentCardBlob(comment ?? 'Aku ni selalu pening, letih je… macam mana nak bagi bertenaga balik eh? 🤔')
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    return url
  }
}
