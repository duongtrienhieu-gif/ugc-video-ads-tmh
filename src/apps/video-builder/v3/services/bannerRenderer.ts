// ── Top hook banner renderer (P5x) ───────────────────────────────────────────
// Draws the slim top banner (a short hook/slogan from the script's KEY) onto a canvas
// and exports a TRANSPARENT PNG — same 0-credit path as captions/stickers. ONE line,
// one emphasised keyword. Two shapes: a snug rounded PILL (centred near the top) and a
// full-width RIBBON strip (flush to the top edge). The assembler scales the PNG by
// WIDTH only (uniform, aspect-preserved) so text never distorts; for the ribbon the
// canvas is a WIDE strip so scaling to the full frame width keeps the bar full-width
// with the text centred and un-stretched.
// ─────────────────────────────────────────────────────────────────────────────

import { BANNER_PRESETS, type BannerPreset, type BannerPresetId } from './bannerPresets'
import { ensureCaptionFonts } from './captionRenderer'
import { directGeminiText } from '../../../../utils/gemini'

// P5x(B) — the product-bank name can be in ANY language the user typed (e.g. the English
// packaging label "PARSLEY GARLIC SALT"); on a VN/MS video that mismatches the script +
// voice. Translate the name into the output language for the banner. ONE tiny Gemini call,
// cached by (lang, name); graceful fallback to the raw name on any failure.
const nameCache = new Map<string, string>()
const VN_DIACRITIC_RE = /[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/
export async function localizeProductName(rawName: string, langName: string, apiKey: string): Promise<string> {
  const name = (rawName ?? '').trim()
  if (!name || !apiKey) return name
  // Skip the call when it's already in the target language: Vietnamese output + the name
  // already carries VN diacritics → it's Vietnamese already, no translation needed.
  if (langName === 'Vietnamese' && VN_DIACRITIC_RE.test(name)) return name
  const key = `${langName}::${name}`
  const hit = nameCache.get(key)
  if (hit) return hit
  try {
    const out = await directGeminiText({
      apiKey,
      systemInstruction:
        `Translate the PRODUCT NAME into ${langName}. Keep it SHORT (≤5 words), natural, Title Case, ` +
        `keep real brand tokens as-is. Output ONLY the translated name — no quotes, no extra text.`,
      prompt: name,
      maxOutputTokens: 40, temperature: 0.2, thinkingBudget: 0,
    })
    const cleaned = (out ?? '').split('\n')[0].replace(/^["'“”]+|["'“”]+$/g, '').trim().slice(0, 40)
    const result = cleaned || name
    nameCache.set(key, result)
    return result
  } catch { return name }
}

const FONT_PX = 64
const PADX = Math.round(FONT_PX * 0.62)   // pill horizontal padding
const PADY = Math.round(FONT_PX * 0.40)   // pill vertical padding
const MARG = Math.round(FONT_PX * 0.18)   // transparent margin (room for highlight/underline)
const RIBBON_MIN_W = FONT_PX * 15         // ribbon strip min width → reads as a full-width bar

/** Build the banner slogan as PRODUCT NAME · short benefit (the user's choice "B").
 *  The benefit is a punchy ≤4-word phrase from the script's KEY (its anchor — the one
 *  concrete promise). We NEVER chop the narrative hook into a fragment (that produced
 *  the broken "Mình đã thử muối tỏi mùi"). If there's no product name we fall back to
 *  the anchor alone; if neither exists we return '' (the banner is simply skipped).
 *  Universal — language-agnostic. (Note: productName comes from the VN-source product
 *  bank, so on an MS video the name stays VN until the product translation layer lands.) */
export function deriveBannerSlogan(productName?: string, anchor?: string, _hook?: string): string {
  const clean = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim().replace(/^["'“”\-•·\s]+|["'“”.!?\-•·\s]+$/g, '')
  const cap = (s: string, words: number, chars: number) => {
    let out = s.split(' ').filter(Boolean).slice(0, words).join(' ')
    if (out.length > chars) out = out.slice(0, chars).replace(/\s+\S*$/, '').trim()
    return out
  }
  const name = clean(productName) ? cap(clean(productName), 5, 26) : ''
  const anc = clean(anchor)
  const benefit = anc.length >= 3 ? cap(anc, 4, 22) : ''
  if (name && benefit) return `${name} · ${benefit}`
  if (name) return name
  if (benefit) return benefit
  return ''
}

// P5z — the banner should make a scroller CURIOUS about the video's topic, NOT just name
// the product (a name persuades no one to stop). Generate ONE ultra-short curiosity hook
// in the output language from the script's opening line. Cached; graceful fallback to ''.
const hookCache = new Map<string, string>()
// P5z4 — distinct angles so "Gợi ý" stops repeating itself (was lazy: 4 clicks → 3 same).
const BANNER_ANGLES = [
  'a curiosity QUESTION', 'a CONTRARIAN / myth-busting take', 'a FOMO / "everyone\'s on it" angle',
  'a bold RESULT / transformation tease', 'an INSIDER-secret angle', 'a "stop scrolling" pattern-interrupt',
]
export async function generateBannerHook(
  scriptHook: string, langName: string, apiKey: string, fresh = false, avoid: string[] = [],
): Promise<string> {
  const src = (scriptHook ?? '').trim()
  if (!src || !apiKey) return ''
  const key = `${langName}::${src}`
  if (!fresh) {                       // fresh = the "Gợi ý" button wants a NEW variation
    const hit = hookCache.get(key)
    if (hit !== undefined) return hit
  }
  // Rotate the angle by how many we've already shown so each click leans a new direction.
  const angle = BANNER_ANGLES[avoid.length % BANNER_ANGLES.length]
  const avoidBlock = avoid.length
    ? `\nDo NOT repeat or paraphrase any of these earlier hooks — go in a CLEARLY different direction:\n${avoid.map((a) => `- "${a}"`).join('\n')}`
    : ''
  try {
    const out = await directGeminiText({
      apiKey,
      systemInstruction:
        `Write ONE ultra-short BANNER hook for a TikTok ad, in ${langName}: a ≤6-word curiosity ` +
        `line that makes a scroller instantly wonder what the video is about. Lean into ${angle}. ` +
        `Do NOT use the product name, no price, no quotes. Punchy + native. Output ONLY the line.`,
      prompt: `Video opening line: "${src}"${avoidBlock}\nBanner hook:`,
      maxOutputTokens: 40, temperature: fresh ? 1.0 : 0.7, thinkingBudget: 0,
    })
    const cleaned = (out ?? '').split('\n')[0].replace(/^["'“”]+|["'“”.!]+$/g, '').trim().slice(0, 60)
    if (!fresh) hookCache.set(key, cleaned)   // don't cache fresh variations (always re-roll)
    return cleaned
  } catch { return '' }
}

// P5z2 — short VN gloss of a banner hook (so a Vietnamese user understands an MS/EN banner
// before approving it). Spirit-translation, not word-for-word. Cached; '' on failure.
const glossCache = new Map<string, string>()
export async function glossBannerToVietnamese(text: string, apiKey: string): Promise<string> {
  const src = (text ?? '').trim()
  if (!src || !apiKey) return ''
  const hit = glossCache.get(src)
  if (hit !== undefined) return hit
  try {
    const out = await directGeminiText({
      apiKey,
      systemInstruction:
        `Dịch câu quảng cáo sau sang tiếng Việt ngắn gọn, ĐÚNG TINH THẦN (giữ năng lượng/ý đồ, ` +
        `không dịch word-by-word). CHỈ xuất bản dịch tiếng Việt, không thêm gì.`,
      prompt: src,
      maxOutputTokens: 50, temperature: 0.3, thinkingBudget: 0,
    })
    const cleaned = (out ?? '').split('\n')[0].replace(/^["'“”]+|["'“”]+$/g, '').trim().slice(0, 70)
    glossCache.set(src, cleaned)
    return cleaned
  } catch { return '' }
}

// The keyword to emphasise: a number/result token if present, else the LAST word.
function pickAccentIndex(words: string[]): number {
  for (let i = 0; i < words.length; i++) if (/\d/.test(words[i])) return i
  return Math.max(0, words.length - 1)
}

function fontStr(p: BannerPreset): string {
  return `${p.weight} ${FONT_PX}px ${p.family}`
}

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

/** Render the banner to a transparent canvas. */
export async function renderBannerCanvas(text: string, presetId: BannerPresetId): Promise<HTMLCanvasElement> {
  await ensureCaptionFonts()
  const p = BANNER_PRESETS[presetId] ?? BANNER_PRESETS.glass_dark
  const isRibbon = p.shape === 'ribbon'

  const scratch = document.createElement('canvas').getContext('2d')!
  scratch.font = fontStr(p)
  const words = text.trim().split(/\s+/).filter(Boolean)
  const accIdx = pickAccentIndex(words)
  const spaceW = scratch.measureText(' ').width
  const wordW = words.map((w) => scratch.measureText(w).width)
  const lineW = wordW.reduce((s, w) => s + w, 0) + spaceW * Math.max(0, words.length - 1)

  const bgH = FONT_PX + PADY * 2
  const bgW = lineW + PADX * 2
  // Pill: canvas snugly fits the pill (+margin). Ribbon: canvas is a wide strip whose bar
  // fills the FULL width (text centred), so scaling to the frame width keeps it a bar.
  const W = isRibbon ? Math.max(bgW, RIBBON_MIN_W) + MARG * 2 : bgW + MARG * 2
  const H = bgH + MARG * 2

  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(W * dpr)
  canvas.height = Math.ceil(H * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.font = fontStr(p)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'

  const cy = H / 2
  // Background (pill = rounded + snug; ribbon = full-width rect, square corners).
  ctx.fillStyle = p.bg
  if (isRibbon) {
    roundRect(ctx, 0, MARG, W, bgH, 0)
    ctx.fill()
  } else {
    roundRect(ctx, MARG, MARG, bgW, bgH, bgH / 2)
    ctx.fill()
  }

  let x = (W - lineW) / 2   // centre the line horizontally
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const ww = wordW[i]
    const isAccent = i === accIdx && p.accent !== p.text
    if (isAccent && p.accentMode === 'highlight') {
      const hx = x - FONT_PX * 0.10, hw = ww + FONT_PX * 0.20
      const hh = FONT_PX * 1.04
      ctx.fillStyle = p.accent
      roundRect(ctx, hx, cy - hh / 2, hw, hh, FONT_PX * 0.14)
      ctx.fill()
      ctx.fillStyle = p.highlightText ?? '#3A2A00'
      ctx.fillText(w, x, cy)
    } else if (isAccent && p.accentMode === 'underline') {
      ctx.fillStyle = p.accent
      ctx.fillText(w, x, cy)
      ctx.fillRect(x, cy + FONT_PX * 0.46, ww, Math.max(3, FONT_PX * 0.10))
    } else {
      ctx.fillStyle = isAccent ? p.accent : p.text
      ctx.fillText(w, x, cy)
    }
    x += ww + spaceW
  }

  return canvas
}

/** Render + export a transparent PNG blob. */
export async function renderBannerBlob(text: string, presetId: BannerPresetId): Promise<Blob> {
  const canvas = await renderBannerCanvas(text, presetId)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('banner toBlob failed'))), 'image/png')
  })
}

// Dev helper — eyeball a preset FREE from the console:
//   __testBanner('glass_dark', 'Ăn vặt mà vẫn khỏe re')
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__testBanner = async (
    presetId: BannerPresetId, text: string,
  ) => {
    const blob = await renderBannerBlob(text ?? 'Ăn vặt mà vẫn khỏe re', presetId ?? 'glass_dark')
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    return url
  }
}
