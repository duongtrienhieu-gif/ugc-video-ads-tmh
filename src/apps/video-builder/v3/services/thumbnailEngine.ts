// ── Thumbnail Engine ─────────────────────────────────────────────────────────
// Z35 §12 — Plan + build thumbnails for the export package. 3 styles:
//   • tiktok_native — overlay big bold caption on creator keyframe
//   • bold_text     — full-bleed black background + headline only
//   • clean_ugc     — soft fade + small subtitle
//
// Phase 1 ships METADATA + canvas-based PNG rendering for tiktok_native +
// bold_text. clean_ugc thumbnail can be enhanced in a follow-up commit.
//
// Strategy: render thumbnails CLIENT-SIDE via Canvas API. No KIE/Gemini
// calls — cheap + instant + survives offline.
// ─────────────────────────────────────────────────────────────────────────────

import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import type { ThumbnailStyleId, ThumbnailPlan } from '../types'

export interface ThumbnailStyleConfig {
  id: ThumbnailStyleId
  labelVi: string
  descriptionVi: string
  emoji: string
}

export const THUMBNAIL_STYLES: Record<ThumbnailStyleId, ThumbnailStyleConfig> = {
  tiktok_native: {
    id: 'tiktok_native',
    labelVi: 'TikTok native',
    descriptionVi: 'Keyframe creator + caption bold vàng (TikTok feel chuẩn).',
    emoji: '📱',
  },
  bold_text: {
    id: 'bold_text',
    labelVi: 'Bold text',
    descriptionVi: 'Full-bleed nền tối + headline đập vào mặt — high CTR.',
    emoji: '💥',
  },
  clean_ugc: {
    id: 'clean_ugc',
    labelVi: 'Clean UGC',
    descriptionVi: 'Keyframe + subtitle nhỏ, mềm — cho beauty/wellness/luxury.',
    emoji: '🌸',
  },
}

export const THUMBNAIL_STYLE_ORDER: ThumbnailStyleId[] = [
  'tiktok_native',
  'bold_text',
  'clean_ugc',
]

// ── Render a thumbnail via Canvas (returns asset ref) ──────────────────

export interface RenderThumbnailParams {
  styleId: ThumbnailStyleId
  /** asset:xxx of the source keyframe to use as background (creator first
   *  frame OR a still). Required for tiktok_native + clean_ugc. */
  sourceRef: string
  /** Headline text overlay */
  headlineText: string
  /** Output size — vertical 9:16 default */
  width?: number
  height?: number
}

/**
 * Z35 — Render a thumbnail PNG via the browser's Canvas API. Returns the
 * asset:xxx ref of the saved PNG. No network — pure local work.
 */
export async function renderThumbnail(
  params: RenderThumbnailParams,
): Promise<string> {
  const width = params.width ?? 1080
  const height = params.height ?? 1920  // 9:16 default

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context không khả dụng')

  // Pre-load the source image (if needed for the style)
  let sourceImg: HTMLImageElement | null = null
  if (params.styleId !== 'bold_text' && params.sourceRef) {
    try {
      sourceImg = await loadImage(params.sourceRef)
    } catch (err) {
      console.warn('[THUMBNAIL] failed to load source image, falling back to bold_text style', err)
    }
  }

  // ── Render by style ──────────────────────────────────────────────────
  if (params.styleId === 'bold_text' || !sourceImg) {
    // Style 2 — full-bleed dark + huge headline
    ctx.fillStyle = '#0F172A'  // slate-900
    ctx.fillRect(0, 0, width, height)
    drawCenteredText(ctx, params.headlineText, {
      x: width / 2,
      y: height / 2,
      maxWidth: width * 0.85,
      color: '#FBBF24',  // amber-400
      outlineColor: '#000000',
      fontSize: 120,
      fontWeight: 900,
      uppercase: true,
      lineHeight: 1.1,
    })
  } else if (params.styleId === 'tiktok_native') {
    // Style 1 — keyframe bg + bold yellow caption overlaid bottom-third
    drawCover(ctx, sourceImg, width, height)
    // Bottom darken gradient
    const grad = ctx.createLinearGradient(0, height * 0.5, 0, height)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.7)')
    ctx.fillStyle = grad
    ctx.fillRect(0, height * 0.5, width, height * 0.5)
    drawCenteredText(ctx, params.headlineText, {
      x: width / 2,
      y: height * 0.78,
      maxWidth: width * 0.9,
      color: '#FBBF24',
      outlineColor: '#000000',
      fontSize: 90,
      fontWeight: 900,
      uppercase: true,
      lineHeight: 1.05,
    })
  } else {
    // Style 3 — clean UGC — keyframe + soft text bottom-third
    drawCover(ctx, sourceImg, width, height)
    drawCenteredText(ctx, params.headlineText, {
      x: width / 2,
      y: height * 0.88,
      maxWidth: width * 0.9,
      color: '#FFFFFF',
      outlineColor: '#1E293B',
      fontSize: 56,
      fontWeight: 700,
      uppercase: false,
      lineHeight: 1.1,
    })
  }

  // Export as PNG blob and save
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('Canvas toBlob trả về null'))
    }, 'image/png', 0.95)
  })
  return saveAsset(blob, 'image/png')
}

/** Build a ThumbnailPlan + render it. */
export async function buildAndRenderThumbnail(
  styleId: ThumbnailStyleId,
  sourceRef: string,
  headlineText: string,
): Promise<ThumbnailPlan> {
  const imageRef = await renderThumbnail({
    styleId,
    sourceRef,
    headlineText,
  })
  return {
    styleId,
    sourceRef,
    headlineText,
    imageRef,
    generatedAt: Date.now(),
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

async function loadImage(assetRefOrUrl: string): Promise<HTMLImageElement> {
  const url = isAssetRef(assetRefOrUrl) ? await getUrl(assetRefOrUrl) : assetRefOrUrl
  if (!url) throw new Error(`Asset không tồn tại: ${assetRefOrUrl.slice(0, 40)}`)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Load image failed: ${url.slice(0, 60)}`))
    img.src = url
  })
}

/** Draw an image to fill the canvas with object-fit: cover semantics. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
): void {
  const imgAspect = img.width / img.height
  const canvasAspect = w / h
  let drawW: number, drawH: number, offsetX: number, offsetY: number
  if (imgAspect > canvasAspect) {
    // Image is wider — crop horizontally
    drawH = h
    drawW = h * imgAspect
    offsetX = -(drawW - w) / 2
    offsetY = 0
  } else {
    // Image is taller — crop vertically
    drawW = w
    drawH = w / imgAspect
    offsetX = 0
    offsetY = -(drawH - h) / 2
  }
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH)
}

interface DrawTextOpts {
  x: number
  y: number
  maxWidth: number
  color: string
  outlineColor: string
  fontSize: number
  fontWeight: number
  uppercase: boolean
  lineHeight: number
}

/** Draw text centered horizontally at (x, y) with wrapping + outline. */
function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: DrawTextOpts,
): void {
  const displayText = opts.uppercase ? text.toUpperCase() : text
  ctx.font = `${opts.fontWeight} ${opts.fontSize}px system-ui, -apple-system, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Word-wrap to maxWidth
  const words = displayText.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const test = current ? `${current} ${w}` : w
    if (ctx.measureText(test).width > opts.maxWidth) {
      if (current) lines.push(current)
      current = w
    } else {
      current = test
    }
  }
  if (current) lines.push(current)

  const lineSpacing = opts.fontSize * opts.lineHeight
  const startY = opts.y - (lines.length - 1) * lineSpacing / 2

  // Draw outline + fill per line
  ctx.lineWidth = Math.max(4, opts.fontSize * 0.08)
  ctx.strokeStyle = opts.outlineColor
  ctx.fillStyle = opts.color
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineSpacing
    ctx.strokeText(lines[i], opts.x, y)
    ctx.fillText(lines[i], opts.x, y)
  }
}
