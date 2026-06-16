// ── Caption renderer (P5k) ───────────────────────────────────────────────────
// Draws ONE caption chunk (a 3-7 word phrase, ≤2 lines) onto a canvas and exports a
// TRANSPARENT PNG — the SAME local, 0-credit overlay path the stickers use. This
// replaces the old ASS/libass burner whose font fell back per-glyph in ffmpeg.wasm
// ("mỗi frame một font, loạn màu"): here WE draw the pixels with a font we control,
// so every frame is identical + clean (CapCut-style). The assembler scales the PNG
// to width + overlays it bottom-centre (see hybridAssembler caption path).
//
// Style comes entirely from a CaptionPreset (1 locked font + colors + stroke/shadow
// + accent). NO bubble background. Price/number tokens get the accent colour.
// ─────────────────────────────────────────────────────────────────────────────

import { CAPTION_PRESETS, type CaptionPreset, type CaptionPresetId } from './captionPresets'

const FONT_PX = 80            // fixed render size for crispness; assembler scales the PNG
const LINE_GAP = 0.18         // gap between the 2 lines, as a fraction of FONT_PX
// P5y — narrower wrap (~9 em, was 13). The assembler now scales captions by a FIXED
// factor (consistent on-screen size, no more "short chunk ballooned"), so a line must
// be short enough to fit the frame width at that factor; 9 em keeps wrapped lines inside
// the 92% caption box across 480/720/1080p.
const MAX_LINE_W = FONT_PX * 9
const PAD = Math.round(FONT_PX * 0.5)   // breathing room so stroke/shadow isn't clipped

// Always-emphasise price / number / percent tokens (the "giá / con số" the eye catches).
const ACCENT_TOKEN_RE = /^(rm\s?\d[\d.,]*k?|\$?\d[\d.,]*%?|\d+k|\d+%)$/i

// VN/MS/EN function words to drop when picking script keywords to highlight.
const HL_STOPWORDS = new Set([
  'và','là','của','cho','với','mà','thì','được','các','những','một','khi','đã','rồi','nha','nhé','đó','này','ấy','rất','quá','cũng','vẫn','còn','nó','mình','bạn',
  'dan','yang','untuk','dengan','ni','tu','je','dah','tak','ada','ini','itu',
  'the','a','an','and','to','of','with','for','is','are','it','this','that','you','your',
])

/** P5y (ii) — highlight terms from the script's KEY (its anchor — what the brain
 *  identified as THE reason). Tokenise the anchor, drop stopwords, prefer numeric +
 *  longest, cap 3 → those words get the accent colour in any caption chunk they appear
 *  in. Universal, deterministic, 0 cost. */
export function deriveCaptionHighlights(anchor?: string): string[] {
  const toks = (anchor ?? '').toLowerCase()
    .replace(/[.,!?;:"'“”…()\-–—]/g, ' ')
    .split(/\s+/).map((w) => w.trim()).filter(Boolean)
    .filter((w) => w.length >= 2 && !HL_STOPWORDS.has(w))
  const uniq = [...new Set(toks)]
  uniq.sort((a, b) => (/\d/.test(b) ? 1 : 0) - (/\d/.test(a) ? 1 : 0) || b.length - a.length)
  return uniq.slice(0, 3)
}

let fontsInjected = false
/** Load the preset fonts the browser doesn't already have (Be Vietnam Pro ships with
 *  the app; Montserrat / Inter come from the Google Fonts CDN). Idempotent + best-
 *  effort — a CDN miss just falls back to Be Vietnam Pro via the family stack. */
export async function ensureCaptionFonts(): Promise<void> {
  try {
    if (!fontsInjected && typeof document !== 'undefined') {
      fontsInjected = true
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@600;700&family=Montserrat:wght@700;800&family=Baloo+2:wght@700;800&display=swap'
      document.head.appendChild(link)
    }
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts) {
      await Promise.all([
        fonts.load(`800 ${FONT_PX}px 'Montserrat'`).catch(() => {}),
        fonts.load(`700 ${FONT_PX}px 'Inter'`).catch(() => {}),
        fonts.load(`800 ${FONT_PX}px 'Baloo 2'`).catch(() => {}),
        fonts.load(`700 ${FONT_PX}px 'Be Vietnam Pro'`).catch(() => {}),
      ])
      await fonts.ready
    }
  } catch { /* best-effort */ }
}

function fontStr(p: CaptionPreset): string {
  return `${p.weight} ${FONT_PX}px ${p.family}`
}

/** Greedy word-wrap into AT MOST 2 lines (the chunker keeps phrases short enough that
 *  this rarely truncates; if a phrase is too long we still cap at 2 lines to protect
 *  the layout). */
function wrapTwoLines(ctx: CanvasRenderingContext2D, text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w
    if (ctx.measureText(trial).width > MAX_LINE_W && cur) {
      lines.push(cur)
      cur = w
      if (lines.length === 1) { /* one line filled; rest goes to line 2 */ }
    } else {
      cur = trial
    }
  }
  if (cur) lines.push(cur)
  if (lines.length <= 2) return lines
  // >2 lines: keep line 1, cram the remainder onto line 2.
  return [lines[0], lines.slice(1).join(' ')]
}

/** Strip punctuation + lowercase a word for keyword matching. */
function normWord(w: string): string {
  return w.toLowerCase().replace(/[.,!?;:"'“”…()\-–—]/g, '')
}

/** Render a caption chunk to a transparent canvas (text only, no background).
 *  `highlightTerms` = script keywords (from the anchor) to colour with the accent. */
export async function renderCaptionCanvas(
  text: string, presetId: CaptionPresetId, highlightTerms: string[] = [],
): Promise<HTMLCanvasElement> {
  await ensureCaptionFonts()
  const p = CAPTION_PRESETS[presetId] ?? CAPTION_PRESETS.clean_white
  const hlSet = new Set(highlightTerms.map((t) => t.toLowerCase()))

  const scratch = document.createElement('canvas').getContext('2d')!
  scratch.font = fontStr(p)
  if (p.upper) text = text.toUpperCase()
  const lines = wrapTwoLines(scratch, text)
  const spaceW = scratch.measureText(' ').width
  const lineWidths = lines.map((l) => scratch.measureText(l).width)
  const contentW = Math.max(1, ...lineWidths)
  const lineH = FONT_PX * (1 + LINE_GAP)
  const contentH = lines.length * lineH

  const W = Math.ceil(contentW + PAD * 2)
  const H = Math.ceil(contentH + PAD * 2)
  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.font = fontStr(p)
  ctx.textBaseline = 'top'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  const strokeW = p.strokeFrac > 0 ? FONT_PX * p.strokeFrac : 0

  lines.forEach((line, li) => {
    const lw = lineWidths[li]
    let x = (W - lw) / 2          // centre each line
    const y = PAD + li * lineH
    const words = line.split(' ')
    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi]
      const ww = ctx.measureText(word).width
      const canAccent = !!p.accent && p.accent !== p.fill
      const isAccent = canAccent && (ACCENT_TOKEN_RE.test(word) || hlSet.has(normWord(word)))
      // soft shadow (premium) — set once, applies to the fill below
      ctx.save()
      if (p.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)'
        ctx.shadowBlur = FONT_PX * 0.12
        ctx.shadowOffsetY = FONT_PX * 0.05
      }
      if (strokeW > 0) {
        ctx.lineWidth = strokeW
        ctx.strokeStyle = p.stroke
        ctx.strokeText(word, x, y)
      }
      ctx.fillStyle = isAccent ? p.accent : p.fill
      ctx.fillText(word, x, y)
      ctx.restore()
      x += ww + spaceW
    }
  })

  return canvas
}

/** Render + export a transparent PNG blob (what the assembler / asset store want). */
export async function renderCaptionBlob(text: string, presetId: CaptionPresetId, highlightTerms: string[] = []): Promise<Blob> {
  const canvas = await renderCaptionCanvas(text, presetId, highlightTerms)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('caption toBlob failed'))), 'image/png')
  })
}

// ── Dev helper — eyeball a preset's look from the console, FREE (no render credit):
//   __testCaption('clean_white', 'Bơm 3 phút là CĂNG ĐÉT, chỉ RM79')
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__testCaption = async (
    presetId: CaptionPresetId, text: string,
  ) => {
    const blob = await renderCaptionBlob(text, presetId ?? 'clean_white')
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    return url
  }
}
