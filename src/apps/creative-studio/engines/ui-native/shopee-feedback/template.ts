// ── Shopee Review Canvas Template (P6) ──────────────────────────────────────
//
// Renders a Shopee-style buyer review screenshot to an HTMLCanvasElement.
// Single review (one buyer, one star rating, one body). Pixel-accurate
// enough to pass at-a-glance authenticity.
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
import { SHOPEE_LIGHT_2024 } from '../_shared/colors'
import { renderStatusBar } from '../_shared/statusBar'
import { readRating, readVariant, readHelpful } from '../_shared/textPayload'
import { findStrings } from '../_shared/conversationMetadata'
import type { MessageTimeline } from '../_shared/timestamps'

export const SHOPEE_REVIEW_TEMPLATE: UINativeTemplate = {
  id: 'shopee-review-v1',
  platform: 'shopee',
  variant: 'single-review',
  canvasSize: { width: 1080, height: 1920 },
  theme: 'light',
  statusBarStyle: 'android',
  uiVintage: '2024',
}

export interface RenderInputs {
  text: UINativeTextContent
  timeline: MessageTimeline
  customerAvatarUrl: string
  /** Optional product image URL — used as the review attachment thumb. */
  productImageUrl?: string
  /** P12 — accepted but unused (single-buyer review). */
  avatarPool?: Map<number, string>
  /** P12 — locale for metadata strings. */
  locale?: import('../../../types/uiNative').UINativeLocale
}

export async function renderShopeeReview(
  inputs: RenderInputs,
): Promise<HTMLCanvasElement> {
  const palette = SHOPEE_LIGHT_2024
  const size = SHOPEE_REVIEW_TEMPLATE.canvasSize
  const { canvas, ctx } = createCanvas(size)
  // P31 — locale-aware UI strings (was hardcoded Vietnamese before)
  const S = findStrings(inputs.locale ?? 'vi-VN')

  // Background
  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, 0, size.width, size.height)

  // Status bar — white on orange header background
  renderStatusBar(ctx, {
    style: 'android',
    fg: palette.headerFg,
    bg: palette.headerBg,
    timeLabel: inputs.timeline.statusBarTime,
    width: size.width,
  })

  // Header — orange app bar with "Đánh giá sản phẩm" / "Product reviews"
  const headerY = 44
  const headerH = 100
  ctx.fillStyle = palette.headerBg
  ctx.fillRect(0, headerY, size.width, headerH)

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

  ctx.fillStyle = palette.headerFg
  ctx.font = '600 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(S.productReviewsTitle, 90, headerY + headerH / 2)

  // ── Rating summary card ────────────────────────────────────────────
  const summaryY = headerY + headerH + 24
  const summaryH = 200
  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, summaryY, size.width, summaryH)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, summaryY + summaryH, size.width, 1)

  const item = inputs.text.items[0]
  const overallRating = readRating(item)

  // Large rating number
  ctx.fillStyle = palette.starFill
  ctx.font = '700 80px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(`${overallRating}.0`, 50, summaryY + 30)

  // "/5" below
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 24px -apple-system, sans-serif'
  ctx.fillText('trên 5', 50, summaryY + 120)

  // Stars row + tag chips
  drawStarRow(ctx, 240, summaryY + 50, overallRating, palette)
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 22px -apple-system, sans-serif'
  ctx.fillText(`(${readHelpful(item) + 200} đánh giá)`, 240, summaryY + 100)

  // Filter chips
  const chipsY = summaryY + 150
  drawChip(ctx, 50,  chipsY, 'Tất cả (220)',  palette, true)
  drawChip(ctx, 290, chipsY, '5 Sao (192)',   palette, false)
  drawChip(ctx, 510, chipsY, 'Có hình (88)',  palette, false)

  // ── Review card ────────────────────────────────────────────────────
  const reviewY = summaryY + summaryH + 24
  await renderReviewCard(ctx, {
    palette,
    width: size.width,
    startY: reviewY,
    item,
    avatarUrl: inputs.customerAvatarUrl,
    productImageUrl: inputs.productImageUrl,
    displayName: inputs.text.participants[0].displayName,
    timestamp: inputs.timeline.dateLabel,
  })

  // ── Bottom action bar — "Chat" + "Mua ngay" CTA ────────────────────
  const footerH = 110
  const footerY = size.height - footerH
  ctx.fillStyle = palette.footerBg
  ctx.fillRect(0, footerY, size.width, footerH)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, footerY, size.width, 1)

  // Chat icon (left)
  ctx.strokeStyle = palette.ctaBg
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(100, footerY + footerH / 2, 28, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = palette.ctaBg
  ctx.font = '400 18px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Chat', 100, footerY + footerH / 2)

  // Add to cart (middle)
  ctx.font = '400 18px -apple-system, sans-serif'
  ctx.fillStyle = palette.pageFg
  ctx.fillText('Thêm vào giỏ', 260, footerY + footerH / 2)

  // Buy now (right, orange)
  const btnW = 360
  const btnH = 70
  const btnX = size.width - btnW - 30
  const btnY = footerY + (footerH - btnH) / 2
  roundedRectPath(ctx, btnX, btnY, btnW, btnH, btnH / 2)
  ctx.fillStyle = palette.ctaBg
  ctx.fill()
  ctx.fillStyle = palette.ctaFg
  ctx.font = '600 28px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Mua ngay', btnX + btnW / 2, btnY + btnH / 2)

  return canvas
}

// ── Helpers ────────────────────────────────────────────────────────────

interface ReviewCardInputs {
  palette: typeof SHOPEE_LIGHT_2024
  width: number
  startY: number
  item: UINativeTextContent['items'][number]
  avatarUrl: string
  productImageUrl?: string
  displayName: string
  timestamp: string
}

async function renderReviewCard(
  ctx: CanvasRenderingContext2D,
  inputs: ReviewCardInputs,
): Promise<void> {
  const { palette, width, startY, item, avatarUrl, productImageUrl, displayName, timestamp } = inputs

  const padX = 50
  let cursor = startY + 30

  // Avatar + username row
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
  ctx.fillText(displayName, avatarCx + avatarRadius + 20, avatarCy - 10)

  // Star row + variant under username
  drawStarRow(ctx, avatarCx + avatarRadius + 20, avatarCy + 14, readRating(item), palette, 20)

  cursor += avatarRadius * 2 + 30

  // Variant + timestamp line
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 22px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const variantStr = readVariant(item)
  if (variantStr) {
    ctx.fillText(`Phân loại: ${variantStr}`, padX, cursor)
    cursor += 32
  }

  cursor += 8

  // Review body (wrapped)
  ctx.fillStyle = palette.pageFg
  ctx.font = '400 28px -apple-system, sans-serif'
  const bodyMaxW = width - padX * 2
  const lines = wrapText(ctx, item.text, bodyMaxW)
  const lineH = 38
  for (const line of lines) {
    ctx.fillText(line, padX, cursor)
    cursor += lineH
  }
  cursor += 16

  // Product thumb attachment (if provided)
  if (productImageUrl) {
    try {
      const img = await loadImage(productImageUrl)
      const thumbSize = 200
      ctx.fillStyle = palette.divider
      roundedRectPath(ctx, padX, cursor, thumbSize, thumbSize, 12)
      ctx.fill()
      ctx.save()
      roundedRectPath(ctx, padX, cursor, thumbSize, thumbSize, 12)
      ctx.clip()
      ctx.drawImage(img, padX, cursor, thumbSize, thumbSize)
      ctx.restore()
      cursor += thumbSize + 24
    } catch {
      // skip on failure
    }
  }

  // Helpful row
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 22px -apple-system, sans-serif'
  ctx.fillText(`${timestamp}  |  Mua sản phẩm chính hãng`, padX, cursor)
  cursor += 32

  // Helpful button (heart icon + count)
  const helpfulCount = readHelpful(item)
  const helpfulText = `Hữu ích (${helpfulCount})`
  const helpfulX = padX
  ctx.strokeStyle = palette.mutedFg
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(helpfulX + 5, cursor + 12)
  ctx.lineTo(helpfulX + 15, cursor + 22)
  ctx.lineTo(helpfulX + 35, cursor + 12)
  ctx.lineTo(helpfulX + 35, cursor + 28)
  ctx.lineTo(helpfulX + 12, cursor + 28)
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 22px -apple-system, sans-serif'
  ctx.fillText(helpfulText, helpfulX + 50, cursor + 4)
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
  cx: number,
  cy: number,
  r: number,
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

function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  palette: typeof SHOPEE_LIGHT_2024,
  active: boolean,
): void {
  ctx.font = '500 22px -apple-system, sans-serif'
  const padX = 22
  const padY = 12
  const w = ctx.measureText(text).width + padX * 2
  const h = 44
  roundedRectPath(ctx, x, y, w, h, h / 2)
  if (active) {
    ctx.fillStyle = '#FFEEE8'
    ctx.fill()
    ctx.strokeStyle = palette.starFill
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = palette.starFill
  } else {
    ctx.strokeStyle = palette.divider
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = palette.pageFg
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX, y + h / 2)
  void padY
}
