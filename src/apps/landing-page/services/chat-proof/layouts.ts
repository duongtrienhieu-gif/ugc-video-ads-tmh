// ─────────────────────────────────────────────────────────────────────
// Layout renderers — orchestrate the phone-mockup placement on top of
// the background. Each layout function takes the canvas + content +
// pre-loaded thumb and produces the final composition.
//
// 4 layouts:
//   A. centered-phone    — single phone mockup centered (reference)
//   B. partial-crop      — screenshot edge, no full phone frame
//   C. floating-collage  — phone mockup rotated, with secondary glyph
//   D. full-vertical     — 4:5 portrait with phone in upper 70%
// ─────────────────────────────────────────────────────────────────────

import { drawPhoneFrame, drawScreenshotCrop, type ScreenRect } from './phoneFrames'
import { drawChatScreen } from './chatTemplates'
import { drawBackground } from './backgrounds'
import { fillRoundRect } from './canvasUtils'
import type {
  ChatProofContent, ChatProofVariant, ChatProofLayout,
  ChatProofBackground, PhoneFrame,
} from './types'

interface LayoutArgs {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  background: ChatProofBackground
  phoneFrame: PhoneFrame
  variant: ChatProofVariant
  content: ChatProofContent
  thumbImage: HTMLImageElement | null
}

export function applyLayout(layout: ChatProofLayout, args: LayoutArgs): void {
  switch (layout) {
    case 'centered-phone':   return centeredPhone(args)
    case 'partial-crop':     return partialCrop(args)
    case 'floating-collage': return floatingCollage(args)
    case 'full-vertical':    return fullVertical(args)
  }
}

// ── A. CENTERED PHONE ────────────────────────────────────────────────
function centeredPhone(args: LayoutArgs): void {
  const { ctx, width, height, background, phoneFrame, variant, content, thumbImage } = args
  drawBackground(ctx, width, height, background)

  // Phone occupies ~60% of canvas width, centered
  const phoneWidth = width * 0.62
  const cx = width / 2
  const cy = height / 2
  const rect: ScreenRect = drawPhoneFrame(ctx, cx, cy, phoneWidth, phoneFrame)
  drawChatScreen(ctx, rect, variant, content, thumbImage)
}

// ── B. PARTIAL CROP — no phone frame, soft screenshot edge ───────────
function partialCrop(args: LayoutArgs): void {
  const { ctx, width, height, background, variant, content, thumbImage } = args
  drawBackground(ctx, width, height, background)

  const screenW = width * 0.82
  const screenH = height * 0.86
  const cx = width / 2
  const cy = height / 2
  const rect = drawScreenshotCrop(ctx, cx, cy, screenW, screenH)
  drawChatScreen(ctx, rect, variant, content, thumbImage)
}

// ── C. FLOATING COLLAGE — phone rotated ───────────────────────────────
function floatingCollage(args: LayoutArgs): void {
  const { ctx, width, height, background, phoneFrame, variant, content, thumbImage } = args
  drawBackground(ctx, width, height, background)

  // Decorative ghost phone (back layer)
  ctx.save()
  ctx.globalAlpha = 0.45
  ctx.translate(width * 0.28, height * 0.42)
  ctx.rotate(-Math.PI / 18)
  ctx.translate(-width * 0.28, -height * 0.42)
  const ghostRect = drawPhoneFrame(ctx, width * 0.28, height * 0.42, width * 0.42, phoneFrame)
  drawChatScreen(ctx, ghostRect, variant, content, thumbImage)
  ctx.restore()

  // Foreground phone — primary
  ctx.save()
  ctx.translate(width * 0.58, height * 0.52)
  ctx.rotate(Math.PI / 28)
  ctx.translate(-width * 0.58, -height * 0.52)
  const fgRect = drawPhoneFrame(ctx, width * 0.58, height * 0.52, width * 0.5, phoneFrame)
  drawChatScreen(ctx, fgRect, variant, content, thumbImage)
  ctx.restore()
}

// ── D. FULL VERTICAL — 4:5 ad layout ──────────────────────────────────
function fullVertical(args: LayoutArgs): void {
  const { ctx, width, height, background, phoneFrame, variant, content, thumbImage } = args
  drawBackground(ctx, width, height, background)

  // Phone occupies upper 78% of canvas
  const phoneWidth = width * 0.58
  const cx = width / 2
  const cy = height * 0.42
  const rect = drawPhoneFrame(ctx, cx, cy, phoneWidth, phoneFrame)
  drawChatScreen(ctx, rect, variant, content, thumbImage)

  // Caption strip at bottom 22%
  const stripY = height * 0.82
  const stripH = height * 0.18
  fillRoundRect(ctx, width * 0.06, stripY, width * 0.88, stripH * 0.7, 16, 'rgba(255,255,255,0.95)')
  ctx.fillStyle = '#0A0A0A'
  ctx.font = `700 ${Math.round(width * 0.038)}px -apple-system, BlinkMacSystemFont, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Real customer chat', width / 2, stripY + stripH * 0.35)
}
