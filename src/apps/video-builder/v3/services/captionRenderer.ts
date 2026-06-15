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
const MAX_LINE_W = FONT_PX * 13   // wrap width (~13 em) → keeps a line readable on 9:16
const PAD = Math.round(FONT_PX * 0.5)   // breathing room so stroke/shadow isn't clipped

// Emphasise price / number / percent tokens (the "giá / con số" the eye should catch).
const ACCENT_TOKEN_RE = /^(rm\s?\d[\d.,]*k?|\$?\d[\d.,]*%?|\d+k|\d+%)$/i

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
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@600;700&family=Montserrat:wght@700;800&display=swap'
      document.head.appendChild(link)
    }
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts) {
      await Promise.all([
        fonts.load(`800 ${FONT_PX}px 'Montserrat'`).catch(() => {}),
        fonts.load(`600 ${FONT_PX}px 'Inter'`).catch(() => {}),
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

/** Render a caption chunk to a transparent canvas (text only, no background). */
export async function renderCaptionCanvas(text: string, presetId: CaptionPresetId): Promise<HTMLCanvasElement> {
  await ensureCaptionFonts()
  const p = CAPTION_PRESETS[presetId] ?? CAPTION_PRESETS.clean_white

  const scratch = document.createElement('canvas').getContext('2d')!
  scratch.font = fontStr(p)
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
      const isAccent = !!p.accent && p.accent !== p.fill && ACCENT_TOKEN_RE.test(word)
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
export async function renderCaptionBlob(text: string, presetId: CaptionPresetId): Promise<Blob> {
  const canvas = await renderCaptionCanvas(text, presetId)
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
