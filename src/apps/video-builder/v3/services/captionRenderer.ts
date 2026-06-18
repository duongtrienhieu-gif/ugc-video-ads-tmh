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
  'di','ke','dari','pada','akan','sudah','saya','awak','dia','kami','kita','nak','pun','lah','kan','atau','tapi','tetapi','sangat','memang','sebab','kerana','adalah','ialah','macam',
  'the','a','an','and','to','of','with','for','is','are','it','this','that','you','your',
])

const tokenizeWords = (s?: string) => (s ?? '').toLowerCase()
  .replace(/[.,!?;:"'“”…()\-–—]/g, ' ').split(/\s+/).map((w) => w.trim()).filter(Boolean)

/** P5z (ii) — script keyword SET to bias which word gets the accent. Sourced from BOTH
 *  the anchor (the brain's KEY) AND the recurring meaningful words in the body — so the
 *  set is rarely empty (the old anchor-only version was empty → nothing ever coloured).
 *  The renderer still highlights exactly ONE word per chunk and FALLS BACK to the longest
 *  content word, so a caption ALWAYS shows a coloured keyword even if the set misses it. */
export function deriveCaptionHighlights(anchor?: string, bodyText?: string): string[] {
  const anchorToks = tokenizeWords(anchor)
  const fromAnchor = [...new Set(anchorToks.filter((w) => w.length >= 2 && !HL_STOPWORDS.has(w)))]
  // P5z5 — also key PHRASES: consecutive content-word pairs in the anchor ("chất xơ",
  // "đường huyết", "óc chó"). Listed FIRST → the renderer prefers a real 2-word term over
  // splitting it / picking one arbitrary word. Universal (VN+MS+EN — stopword-gated only).
  const bigrams: string[] = []
  for (let i = 0; i < anchorToks.length - 1; i++) {
    const a = anchorToks[i], b = anchorToks[i + 1]
    if (a.length >= 2 && b.length >= 2 && !HL_STOPWORDS.has(a) && !HL_STOPWORDS.has(b)) bigrams.push(`${a} ${b}`)
  }
  const freq = new Map<string, number>()
  for (const w of tokenizeWords(bodyText)) {
    if (w.length >= 4 && !HL_STOPWORDS.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  const fromBody = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).map((e) => e[0])
  return [...new Set([...bigrams, ...fromAnchor, ...fromBody])].slice(0, 12)
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
      link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Baloo+2:wght@700;800&family=Oswald:wght@600;700&display=swap'
      document.head.appendChild(link)
    }
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts) {
      // P5z4 — pass a VN-diacritic + MS/EN sample so the browser DOWNLOADS the
      // 'vietnamese' subset of each font. Without the text arg it only fetched the
      // 'latin' subset → canvas drew VN glyphs (đ/ỉ/ậ…) in a FALLBACK font, so all 4
      // presets looked the same. The sample forces the real glyphs to load.
      const S = 'AĂÂĐÊÔƠƯ ăn giòn rụm đỉnh thật sẵn rằng của bạn RM79 5 sao'
      await Promise.all([
        fonts.load(`800 ${FONT_PX}px 'Montserrat'`, S).catch(() => {}),
        fonts.load(`800 ${FONT_PX}px 'Baloo 2'`, S).catch(() => {}),
        fonts.load(`700 ${FONT_PX}px 'Oswald'`, S).catch(() => {}),
        fonts.load(`700 ${FONT_PX}px 'Be Vietnam Pro'`, S).catch(() => {}),
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

/** A "content" word worth pairing into a 2-word accent phrase (not a function word).
 *  Stopword-gated → universal VN/MS/EN. */
const isContentWord = (n: string): boolean => n.length >= 2 && !HL_STOPWORDS.has(n) && /\p{L}/u.test(n)

/** P5z5 — grow a single accent index into a 1-2 word PHRASE: pair it with an adjacent
 *  CONTENT word (prefer the next, else the previous) so "chất"→"chất xơ", "đường"→"đường
 *  huyết". Stays a single word when both neighbours are function words. */
function phraseSpan(i: number, norm: string[]): [number, number] {
  if (i + 1 < norm.length && isContentWord(norm[i + 1])) return [i, i + 1]
  if (i - 1 >= 0 && isContentWord(norm[i - 1])) return [i - 1, i]
  return [i, i]
}

/** P6b — rounded rectangle path (karaoke highlight box behind the active word). */
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

/** Render a caption chunk to a transparent canvas (text only, no background).
 *  `highlightTerms` = script keywords (from the anchor) to colour with the accent.
 *  P6b — `activeWordIndex` ≥ 0 switches to KARAOKE mode: the keyword accent is
 *  dropped and instead the word at that flat index (reading order across both lines)
 *  gets an accent-colour BACKGROUND BOX + white text — the moving highlight. The text
 *  LAYOUT is identical regardless of activeWordIndex, so a chunk's per-word frames
 *  differ ONLY by which word is boxed (stable, no jitter). */
export async function renderCaptionCanvas(
  text: string, presetId: CaptionPresetId, highlightTerms: string[] = [],
  activeWordIndex?: number,
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
  const accentMode = p.accentMode ?? 'color'

  // P5z5 — Accent a 1-2 word PHRASE (not one arbitrary word). Priority, indexed across BOTH
  // lines in reading order: price/number token → a key BIGRAM present in the chunk → a
  // single script-keyword (grown to a 2-word phrase) → the longest content word (grown).
  const allWords = lines.flatMap((l) => l.split(' '))
  const norm = allWords.map(normWord)
  const hlBigrams = new Set([...hlSet].filter((t) => t.includes(' ')))
  const hlSingles = new Set([...hlSet].filter((t) => !t.includes(' ')))
  let accStart = -1, accEnd = -1
  // 1) a price / number token (always a single token like "RM79", "50%")
  const numIdx = allWords.findIndex((w) => ACCENT_TOKEN_RE.test(w))
  if (numIdx >= 0) { accStart = numIdx; accEnd = numIdx }
  // 2) a key bigram literally present (two consecutive words forming a term)
  if (accStart < 0) {
    for (let i = 0; i < norm.length - 1; i++) {
      if (hlBigrams.has(`${norm[i]} ${norm[i + 1]}`)) { accStart = i; accEnd = i + 1; break }
    }
  }
  // 3) a single script-keyword (longest) → grow to a 2-word phrase
  if (accStart < 0) {
    let best = -1, bestLen = 0
    norm.forEach((n, i) => { if (hlSingles.has(n) && n.length > bestLen) { best = i; bestLen = n.length } })
    if (best >= 0) [accStart, accEnd] = phraseSpan(best, norm)
  }
  // 4) fallback: the longest content word → grow to a 2-word phrase
  if (accStart < 0) {
    let best = -1, bestLen = 2
    norm.forEach((n, i) => { if (n.length > bestLen && !HL_STOPWORDS.has(n)) { best = i; bestLen = n.length } })
    if (best >= 0) [accStart, accEnd] = phraseSpan(best, norm)
  }
  // P6b — KARAOKE mode: a moving background box replaces the static keyword accent.
  const karaoke = typeof activeWordIndex === 'number' && activeWordIndex >= 0
  const canAccent = !karaoke && !!p.accent && p.accent !== p.fill
  const boxColor = (p.accent && p.accent !== p.fill) ? p.accent : '#7C3AED'   // accent box; violet fallback

  let gi = 0
  lines.forEach((line, li) => {
    const lw = lineWidths[li]
    let x = (W - lw) / 2          // centre each line
    const y = PAD + li * lineH
    const words = line.split(' ')
    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi]
      const ww = ctx.measureText(word).width
      const isActive = karaoke && gi === activeWordIndex
      const isAccent = canAccent && gi >= accStart && gi <= accEnd
      // Karaoke: draw the highlight BOX first so the word text sits on top of it.
      if (isActive) {
        const padX = FONT_PX * 0.16
        ctx.save()
        ctx.fillStyle = boxColor
        roundRect(ctx, x - padX, y - FONT_PX * 0.07, ww + padX * 2, FONT_PX * 1.16, FONT_PX * 0.22)
        ctx.fill()
        ctx.restore()
      }
      ctx.save()
      // Neon glow ONLY on the accent word in 'glow' presets (a colour bloom, no box).
      if (isAccent && accentMode === 'glow') {
        ctx.shadowColor = p.accent
        ctx.shadowBlur = FONT_PX * 0.4
      }
      if (strokeW > 0) {                 // every preset has a stroke (readability rule)
        ctx.lineWidth = strokeW
        ctx.strokeStyle = p.stroke
        ctx.strokeText(word, x, y)
      }
      // Active karaoke word → white on the accent box; else accent (kw) or normal fill.
      ctx.fillStyle = isActive ? '#FFFFFF' : isAccent ? p.accent : p.fill
      ctx.fillText(word, x, y)
      ctx.restore()
      // Underline the accent word in 'underline' presets (no background, just a bar).
      if (isAccent && accentMode === 'underline') {
        ctx.save()
        ctx.fillStyle = p.accent
        ctx.fillRect(x, y + FONT_PX * 1.0, ww, Math.max(3, FONT_PX * 0.09))
        ctx.restore()
      }
      x += ww + spaceW
      gi++
    }
  })

  return canvas
}

/** Render + export a transparent PNG blob (what the assembler / asset store want).
 *  P6b — pass `activeWordIndex` to render the karaoke frame with that word boxed. */
export async function renderCaptionBlob(text: string, presetId: CaptionPresetId, highlightTerms: string[] = [], activeWordIndex?: number): Promise<Blob> {
  const canvas = await renderCaptionCanvas(text, presetId, highlightTerms, activeWordIndex)
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
