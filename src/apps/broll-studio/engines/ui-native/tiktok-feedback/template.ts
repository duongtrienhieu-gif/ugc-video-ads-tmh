// ── TikTok Shop Review Canvas Template (P6) ────────────────────────────────
//
// Renders a TikTok Shop-style buyer review screenshot. White background
// with TikTok's signature pink-red accents. Sister of shopee-feedback
// — same structural shape (single review with rating, variant, body)
// but TikTok-flavoured chrome (different header, different CTA).
//
// Output: 9:16 portrait, 1080×1920.

import type { UINativeTextContent, UINativeTemplate } from '../../../types/uiNative'
import {
  createCanvas,
  loadImage,
  drawCircularAvatar,
  roundedRectPath,
  wrapText,
} from '../../../shared/canvas'
import { TIKTOK_SHOP_LIGHT_2024 } from '../_shared/colors'
import { renderStatusBar } from '../_shared/statusBar'
import { readRating, readVariant, readHelpful } from '../_shared/textPayload'
import type { MessageTimeline } from '../_shared/timestamps'

export const TIKTOK_SHOP_REVIEW_TEMPLATE: UINativeTemplate = {
  id: 'tiktok-shop-review-v1',
  platform: 'tiktok-shop',
  variant: 'single-review',
  canvasSize: { width: 1080, height: 1920 },
  theme: 'light',
  statusBarStyle: 'ios',
  uiVintage: '2024',
}

export interface RenderInputs {
  text: UINativeTextContent
  timeline: MessageTimeline
  customerAvatarUrl: string
  productImageUrl?: string
}

export async function renderTikTokShopReview(
  inputs: RenderInputs,
): Promise<HTMLCanvasElement> {
  const palette = TIKTOK_SHOP_LIGHT_2024
  const size = TIKTOK_SHOP_REVIEW_TEMPLATE.canvasSize
  const { canvas, ctx } = createCanvas(size)

  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, 0, size.width, size.height)

  renderStatusBar(ctx, {
    style: 'ios',
    fg: palette.headerFg,
    bg: palette.headerBg,
    timeLabel: inputs.timeline.statusBarTime,
    width: size.width,
  })

  // Header
  const headerY = 44
  const headerH = 110
  ctx.fillStyle = palette.headerBg
  ctx.fillRect(0, headerY, size.width, headerH)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, headerY + headerH, size.width, 1)

  // Back chevron
  ctx.strokeStyle = palette.headerFg
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(60, headerY + headerH / 2)
  ctx.lineTo(34, headerY + headerH / 2)
  ctx.moveTo(46, headerY + headerH / 2 - 14)
  ctx.lineTo(34, headerY + headerH / 2)
  ctx.lineTo(46, headerY + headerH / 2 + 14)
  ctx.stroke()

  // Title
  ctx.fillStyle = palette.headerFg
  ctx.font = '600 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Reviews', size.width / 2, headerY + headerH / 2)

  // Share icon (right)
  ctx.strokeStyle = palette.headerFg
  ctx.lineWidth = 3
  const shareX = size.width - 70
  const shareY = headerY + headerH / 2
  ctx.beginPath()
  ctx.arc(shareX - 12, shareY,      8, 0, Math.PI * 2)
  ctx.moveTo(shareX + 8, shareY - 12)
  ctx.arc(shareX + 8,  shareY - 12, 8, 0, Math.PI * 2)
  ctx.moveTo(shareX + 8, shareY + 12)
  ctx.arc(shareX + 8,  shareY + 12, 8, 0, Math.PI * 2)
  ctx.moveTo(shareX - 6, shareY - 6)
  ctx.lineTo(shareX + 2, shareY - 10)
  ctx.moveTo(shareX - 6, shareY + 6)
  ctx.lineTo(shareX + 2, shareY + 10)
  ctx.stroke()

  // ── Rating summary ─────────────────────────────────────────────────
  const summaryY = headerY + headerH + 30
  const item = inputs.text.items[0]
  const overallRating = readRating(item)

  ctx.fillStyle = palette.pageFg
  ctx.font = '700 70px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(`${overallRating.toFixed(1)}`, 50, summaryY)

  // /5 small
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 28px -apple-system, sans-serif'
  ctx.fillText('/5.0', 50 + 110, summaryY + 30)

  // Stars row beside
  drawStarRow(ctx, 280, summaryY + 30, overallRating, palette, 36)

  // Total reviews label
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 22px -apple-system, sans-serif'
  ctx.fillText(`Based on ${readHelpful(item) + 384} reviews`, 280, summaryY + 90)

  // Filter row
  const filterY = summaryY + 140
  drawTikTokChip(ctx, 50,  filterY, 'All',            palette, true)
  drawTikTokChip(ctx, 160, filterY, 'With photos',    palette, false)
  drawTikTokChip(ctx, 400, filterY, '5 ★ (216)',      palette, false)
  drawTikTokChip(ctx, 580, filterY, '4 ★ (42)',       palette, false)

  // Divider under filters
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, filterY + 80, size.width, 1)

  // ── Review card ────────────────────────────────────────────────────
  await renderTikTokShopReviewCard(ctx, {
    palette,
    width: size.width,
    startY: filterY + 100,
    item,
    avatarUrl: inputs.customerAvatarUrl,
    productImageUrl: inputs.productImageUrl,
    displayName: inputs.text.participants[0].displayName,
    timestamp: inputs.timeline.dateLabel,
  })

  // ── Footer with Buy CTA ────────────────────────────────────────────
  const footerH = 120
  const footerY = size.height - footerH
  ctx.fillStyle = palette.footerBg
  ctx.fillRect(0, footerY, size.width, footerH)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, footerY, size.width, 1)

  const btnW = size.width - 80
  const btnH = 80
  const btnX = 40
  const btnY = footerY + (footerH - btnH) / 2
  roundedRectPath(ctx, btnX, btnY, btnW, btnH, btnH / 2)
  ctx.fillStyle = palette.ctaBg
  ctx.fill()
  ctx.fillStyle = palette.ctaFg
  ctx.font = '600 30px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Buy Now', btnX + btnW / 2, btnY + btnH / 2)

  return canvas
}

// ── Helpers ────────────────────────────────────────────────────────────

interface CardInputs {
  palette: typeof TIKTOK_SHOP_LIGHT_2024
  width: number
  startY: number
  item: UINativeTextContent['items'][number]
  avatarUrl: string
  productImageUrl?: string
  displayName: string
  timestamp: string
}

async function renderTikTokShopReviewCard(
  ctx: CanvasRenderingContext2D,
  inputs: CardInputs,
): Promise<void> {
  const { palette, width, startY, item, avatarUrl, productImageUrl, displayName, timestamp } = inputs

  const padX = 50
  let cursor = startY + 20

  // Avatar + username + timestamp row
  const avatarRadius = 30
  const avatarCx = padX + avatarRadius
  const avatarCy = cursor + avatarRadius
  try {
    const img = await loadImage(avatarUrl)
    drawCircularAvatar(ctx, img, avatarCx, avatarCy, avatarRadius)
  } catch {
    ctx.fillStyle = palette.divider
    ctx.beginPath()
    ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = palette.pageFg
  ctx.font = '500 26px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(displayName, avatarCx + avatarRadius + 20, avatarCy - 14)

  // Stars on row below
  drawStarRow(ctx, avatarCx + avatarRadius + 20, avatarCy + 14, readRating(item), palette, 20)

  // Right-aligned timestamp
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 22px -apple-system, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(timestamp, width - padX, avatarCy - 4)

  cursor += avatarRadius * 2 + 30

  // Variant pill
  const variantStr = readVariant(item)
  if (variantStr) {
    ctx.font = '400 22px -apple-system, sans-serif'
    const variantText = variantStr
    const variantW = ctx.measureText(variantText).width + 28
    const variantH = 38
    roundedRectPath(ctx, padX, cursor, variantW, variantH, 8)
    ctx.fillStyle = '#F1F1F2'
    ctx.fill()
    ctx.fillStyle = palette.mutedFg
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(variantText, padX + 14, cursor + variantH / 2)
    cursor += variantH + 24
  }

  // Body
  ctx.fillStyle = palette.pageFg
  ctx.font = '400 28px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const bodyMaxW = width - padX * 2
  const lines = wrapText(ctx, item.text, bodyMaxW)
  const lineH = 38
  for (const line of lines) {
    ctx.fillText(line, padX, cursor)
    cursor += lineH
  }
  cursor += 20

  // Product thumb
  if (productImageUrl) {
    try {
      const img = await loadImage(productImageUrl)
      const thumbSize = 180
      ctx.save()
      roundedRectPath(ctx, padX, cursor, thumbSize, thumbSize, 12)
      ctx.clip()
      ctx.drawImage(img, padX, cursor, thumbSize, thumbSize)
      ctx.restore()
      cursor += thumbSize + 24
    } catch {
      // skip
    }
  }

  // Helpful + reply row (TikTok-style: pink heart + count, then "Reply")
  const helpfulCount = readHelpful(item)
  ctx.fillStyle = palette.starFill
  drawHeart(ctx, padX + 14, cursor + 16, 12)
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 22px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${helpfulCount}`, padX + 40, cursor + 16)
  ctx.fillText('Reply', padX + 140, cursor + 16)
}

function drawStarRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rating: number,
  palette: { starFill: string; starEmpty: string },
  size: number = 28,
): void {
  const gap = 4
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < rating ? palette.starFill : palette.starEmpty
    drawStar(ctx, x + i * (size + gap) + size / 2, y, size / 2)
  }
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  const points = 5
  const inner = r * 0.45
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : inner
    const angle = (Math.PI * i) / points - Math.PI / 2
    const px = cx + Math.cos(angle) * radius
    const py = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

function drawTikTokChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  palette: typeof TIKTOK_SHOP_LIGHT_2024,
  active: boolean,
): void {
  ctx.font = '500 22px -apple-system, sans-serif'
  const padX = 22
  const w = ctx.measureText(text).width + padX * 2
  const h = 50
  roundedRectPath(ctx, x, y, w, h, 8)
  if (active) {
    ctx.fillStyle = palette.pageFg
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
  } else {
    ctx.fillStyle = palette.divider
    ctx.fill()
    ctx.fillStyle = palette.pageFg
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX, y + h / 2)
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(cx, cy + r * 0.6)
  ctx.bezierCurveTo(cx - r * 1.2, cy - r * 0.4, cx - r * 0.6, cy - r * 1.4, cx, cy - r * 0.4)
  ctx.bezierCurveTo(cx + r * 0.6, cy - r * 1.4, cx + r * 1.2, cy - r * 0.4, cx, cy + r * 0.6)
  ctx.closePath()
  ctx.fill()
}
