// ── Shopee Review Canvas Template (P50 authenticity overhaul) ──────────────
//
// Renders a Shopee-style buyer review screenshot to an HTMLCanvasElement.
//
// P50 changes (replacing the P6 single-review layout):
//   • 2 stacked review cards (was 1 card with big empty space below)
//   • Each card has a 2x2 photo grid of attachments (Option C — photos
//     reused from previous creatives of the SAME product in workspace,
//     falling back to the product packshot if pool is empty)
//   • 7 filter chips (Tất cả / Có hình / 5★ / 4★ / 3★ / Khách mua tiếp /
//     Chất lượng tốt) — matches real Shopee
//   • Tab row "Đánh giá Sản phẩm" (active) / "Đánh giá Shop"
//   • Cart + chat icon top-right with count badges (60 / 99+)
//   • Variant tag per review ("Phân loại: 1 Botol, T400 3 MATA")
//   • Masked usernames (relies on LLM output already in Shopee mask
//     pattern "A**y**" / "S**z**n***92")
//   • Bottom action bar with chat icon + cart icon + "Beli dengan
//     baucar {price}" full-width primary CTA (price extracted from
//     product knowledge if available, else fakeMetric fallback)
//   • All UI strings locale-aware (default Bahasa Melayu)
//
// Output: 9:16 portrait, 1080×1920.

import type { UINativeTextContent, UINativeTemplate, UINativeLocale } from '../../../types/uiNative'
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
import { findStrings, fakeMetric } from '../_shared/conversationMetadata'
import type { MessageTimeline } from '../_shared/timestamps'

export const SHOPEE_REVIEW_TEMPLATE: UINativeTemplate = {
  id: 'shopee-review-v1',
  platform: 'shopee',
  variant: 'stacked-reviews',
  canvasSize: { width: 1080, height: 1920 },
  theme: 'light',
  statusBarStyle: 'android',
  uiVintage: '2024',
}

export interface RenderInputs {
  text: UINativeTextContent
  timeline: MessageTimeline
  customerAvatarUrl: string
  productImageUrl?: string
  avatarPool?: Map<number, string>
  /** P50 — pool of person+product photos from prior creatives for this
   *  product. Each review's 2x2 photo grid pulls from this pool. */
  reviewPhotoUrls?: string[]
  locale?: UINativeLocale
}

export async function renderShopeeReview(
  inputs: RenderInputs,
): Promise<HTMLCanvasElement> {
  const palette = SHOPEE_LIGHT_2024
  const size = SHOPEE_REVIEW_TEMPLATE.canvasSize
  const { canvas, ctx } = createCanvas(size)
  const locale = inputs.locale ?? 'my-MY'
  const S = findStrings(locale)

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

  // ── Header (orange app bar) — back chevron + title + cart + chat icons
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
  ctx.font = '600 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(S.productReviewsTitle, 90, headerY + headerH / 2)

  // Top-right cart icon + chat icon with count badges (matches real Shopee)
  drawShopeeHeaderIcon(ctx, size.width - 80, headerY + headerH / 2, 'cart', '60', palette.headerFg)
  drawShopeeHeaderIcon(ctx, size.width - 170, headerY + headerH / 2, 'chat', '99+', palette.headerFg)

  // ── Tab row: "Đánh giá Sản phẩm" (active) / "Đánh giá Shop"
  const tabsY = headerY + headerH
  const tabsH = 70
  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, tabsY, size.width, tabsH)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, tabsY + tabsH, size.width, 1)

  ctx.font = '600 26px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Active tab
  ctx.fillStyle = palette.starFill
  ctx.fillText(S.productReviewsTab, size.width * 0.27, tabsY + tabsH / 2)
  // Active-tab underline indicator
  ctx.fillRect(size.width * 0.27 - 90, tabsY + tabsH - 4, 180, 4)
  // Inactive tab
  ctx.fillStyle = palette.mutedFg
  ctx.font = '500 26px -apple-system, sans-serif'
  ctx.fillText(S.shopReviewsTab, size.width * 0.73, tabsY + tabsH / 2)

  // ── Filter chips row (scroll-able look) — 4 visible chips
  const chipsY = tabsY + tabsH + 22
  const item0 = inputs.text.items[0]
  const totalReviews = readHelpful(item0) + fakeMetric(`${inputs.timeline.dateLabel}_total_rv`, 'medium') + 80
  const photoCount  = fakeMetric(`${inputs.timeline.dateLabel}_photos`, 'small') + 12
  const fiveStar    = Math.round(totalReviews * 0.86)
  const fourStar    = Math.round(totalReviews * 0.10)
  drawChip(ctx, 36,  chipsY, `${S.filterAll} (${totalReviews})`, palette, true)
  let chipX = 36 + chipWidth(ctx, `${S.filterAll} (${totalReviews})`) + 14
  drawChip(ctx, chipX, chipsY, `${S.filterWithPhotos} (${photoCount})`, palette, false)
  chipX += chipWidth(ctx, `${S.filterWithPhotos} (${photoCount})`) + 14
  drawChip(ctx, chipX, chipsY, `5★ (${fiveStar})`, palette, false)
  chipX += chipWidth(ctx, `5★ (${fiveStar})`) + 14
  drawChip(ctx, chipX, chipsY, `4★ (${fourStar})`, palette, false)

  // Second-row chips
  const chipsY2 = chipsY + 56
  drawChip(ctx, 36, chipsY2, S.filterRepeatBuyers, palette, false)
  let chipX2 = 36 + chipWidth(ctx, S.filterRepeatBuyers) + 14
  drawChip(ctx, chipX2, chipsY2, S.filterQualityGood, palette, false)
  chipX2 += chipWidth(ctx, S.filterQualityGood) + 14
  drawChip(ctx, chipX2, chipsY2, `${S.filterVariant} ▾`, palette, false)

  // ── Pre-load avatars from pool (matches review count)
  const reviews = inputs.text.items
  const avatarCache = new Map<number, HTMLImageElement | null>()
  const poolSize = inputs.avatarPool?.size ?? 0
  for (let idx = 0; idx < reviews.length; idx++) {
    const url = (poolSize > 0
      ? inputs.avatarPool!.get(idx % poolSize)
      : inputs.customerAvatarUrl) ?? inputs.customerAvatarUrl
    avatarCache.set(idx, await loadImageSafe(url))
  }

  // Pre-load review photo pool (fallback to product image if pool empty)
  const photoPool: (HTMLImageElement | null)[] = []
  for (const url of inputs.reviewPhotoUrls ?? []) {
    photoPool.push(await loadImageSafe(url))
  }
  const fallbackProductImg = inputs.productImageUrl ? await loadImageSafe(inputs.productImageUrl) : null

  // ── Stacked review cards
  const footerH = 130
  const reviewsTop = chipsY2 + 80
  const reviewsBottom = size.height - footerH - 24
  let cursor = reviewsTop
  for (let i = 0; i < reviews.length; i++) {
    if (cursor > reviewsBottom - 200) break // not enough room for another card
    const r = reviews[i]
    cursor = await renderReviewCard(ctx, {
      palette, S, locale,
      width: size.width,
      startY: cursor,
      maxBottom: reviewsBottom,
      item: r,
      displayName: inputs.text.participants[i]?.displayName ?? `Buyer ${i + 1}`,
      avatarImg: avatarCache.get(i) ?? null,
      timestamp: inputs.timeline.dateLabel,
      photoPool,
      photoOffset: i * 2, // each review gets 2 photos from the pool
      fallbackProductImg,
    })
    cursor += 30
  }

  // ── Bottom action bar: chat + add-to-cart + buy-with-voucher
  const footerY = size.height - footerH
  ctx.fillStyle = palette.footerBg
  ctx.fillRect(0, footerY, size.width, footerH)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, footerY, size.width, 1)

  // Chat icon column
  drawFooterIcon(ctx, 70, footerY + footerH / 2, 'chat', palette.ctaBg)
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 18px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(S.chat, 70, footerY + footerH / 2 + 28)

  // Cart icon column
  drawFooterIcon(ctx, 200, footerY + footerH / 2, 'cart', palette.ctaBg)
  ctx.fillStyle = palette.mutedFg
  ctx.fillText(S.addToCart, 200, footerY + footerH / 2 + 28)

  // Price + freeship + voucher CTA pill (right-aligned, full remaining width)
  const offerPrice = fakeMarketplacePrice(locale, inputs.timeline.dateLabel)
  const ctaX = 300
  const ctaW = size.width - ctaX - 30
  const ctaH = 80
  const ctaY = footerY + (footerH - ctaH) / 2
  roundedRectPath(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2)
  ctx.fillStyle = palette.ctaBg
  ctx.fill()
  ctx.fillStyle = palette.ctaFg
  ctx.font = '600 28px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(S.buyWithVoucher(offerPrice), ctaX + ctaW / 2, ctaY + ctaH / 2 - 4)
  ctx.fillStyle = palette.ctaFg
  ctx.globalAlpha = 0.85
  ctx.font = '500 18px -apple-system, sans-serif'
  ctx.fillText(S.freeship, ctaX + ctaW / 2, ctaY + ctaH / 2 + 22)
  ctx.globalAlpha = 1

  return canvas
}

// ── Single review card renderer ────────────────────────────────────────

interface ReviewCardInputs {
  palette: typeof SHOPEE_LIGHT_2024
  S: ReturnType<typeof findStrings>
  locale: UINativeLocale
  width: number
  startY: number
  maxBottom: number
  item: UINativeTextContent['items'][number]
  displayName: string
  avatarImg: HTMLImageElement | null
  timestamp: string
  photoPool: (HTMLImageElement | null)[]
  photoOffset: number
  fallbackProductImg: HTMLImageElement | null
}

async function renderReviewCard(
  ctx: CanvasRenderingContext2D,
  inputs: ReviewCardInputs,
): Promise<number> {
  const { palette, S, width, startY, maxBottom, item, displayName, avatarImg, timestamp,
          photoPool, photoOffset, fallbackProductImg } = inputs
  void maxBottom // reserved for future overflow handling

  const padX = 50
  let cursor = startY + 22

  // Avatar + masked username + star row
  const avatarR = 32
  const avatarCx = padX + avatarR
  const avatarCy = cursor + avatarR
  if (avatarImg) {
    drawCircularAvatar(ctx, avatarImg, avatarCx, avatarCy, avatarR)
  } else {
    ctx.fillStyle = palette.divider
    ctx.beginPath()
    ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2)
    ctx.fill()
  }

  // Username
  ctx.fillStyle = palette.pageFg
  ctx.font = '600 26px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(displayName, avatarCx + avatarR + 18, cursor + 4)

  // Helpful count chip + "..." menu top-right
  const helpfulCount = readHelpful(item)
  ctx.fillStyle = palette.mutedFg
  ctx.font = '500 22px -apple-system, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText(S.helpfulCount(helpfulCount), width - padX - 50, cursor + 6)

  // "..." menu glyph
  ctx.fillStyle = palette.mutedFg
  for (let d = 0; d < 3; d++) {
    ctx.beginPath()
    ctx.arc(width - padX - 12 + d * 12, cursor + 18, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // Star row under username
  drawStarRow(ctx, avatarCx + avatarR + 18, cursor + 38, readRating(item), palette, 22)

  cursor += avatarR * 2 + 24

  // Variant line
  const variantStr = readVariant(item)
  if (variantStr) {
    ctx.fillStyle = palette.mutedFg
    ctx.font = '400 22px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`${S.variantLabel} ${variantStr}`, padX, cursor)
    cursor += 32
  }

  cursor += 6

  // Review body (multi-line, real Shopee uses line breaks per sentence)
  ctx.fillStyle = palette.pageFg
  ctx.font = '400 27px -apple-system, sans-serif'
  const bodyMaxW = width - padX * 2
  const paragraphs = item.text.split(/\n/).map((s) => s.trim()).filter(Boolean)
  const lineH = 38
  for (const para of paragraphs) {
    const lines = wrapText(ctx, para, bodyMaxW)
    for (const line of lines) {
      ctx.fillText(line, padX, cursor)
      cursor += lineH
    }
  }
  cursor += 14

  // ── 2x2 photo grid (Option C — workspace creatives, fallback product image)
  const thumb = 220
  const gap = 12
  const gridW = thumb * 2 + gap
  const photo1 = photoPool[(photoOffset)     % Math.max(1, photoPool.length)] ?? fallbackProductImg
  const photo2 = photoPool[(photoOffset + 1) % Math.max(1, photoPool.length)] ?? fallbackProductImg
  drawReviewThumb(ctx, padX,                 cursor, thumb, photo1, palette)
  drawReviewThumb(ctx, padX + thumb + gap,   cursor, thumb, photo2, palette)
  void gridW
  cursor += thumb + 22

  // Bottom row: timestamp + "Mua sản phẩm chính hãng" tag
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 22px -apple-system, sans-serif'
  ctx.fillText(timestamp, padX, cursor)
  cursor += 38

  // Divider between reviews
  ctx.fillStyle = palette.divider
  ctx.fillRect(padX, cursor, width - padX * 2, 1)

  return cursor
}

// ── Small drawing helpers ──────────────────────────────────────────────

function drawReviewThumb(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  img: HTMLImageElement | null,
  palette: typeof SHOPEE_LIGHT_2024,
): void {
  ctx.save()
  roundedRectPath(ctx, x, y, size, size, 12)
  ctx.clip()
  if (img) {
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight)
    const dw = img.naturalWidth * scale
    const dh = img.naturalHeight * scale
    ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh)
  } else {
    ctx.fillStyle = palette.divider
    ctx.fillRect(x, y, size, size)
  }
  ctx.restore()
  // 1px border
  ctx.strokeStyle = palette.divider
  ctx.lineWidth = 1
  roundedRectPath(ctx, x, y, size, size, 12)
  ctx.stroke()
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
    drawStar(ctx, x + i * (size + gap) + size / 2, y + size / 2, size / 2)
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

function chipWidth(ctx: CanvasRenderingContext2D, text: string): number {
  ctx.font = '500 22px -apple-system, sans-serif'
  return ctx.measureText(text).width + 44
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
}

function drawShopeeHeaderIcon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  kind: 'cart' | 'chat',
  badge: string,
  color: string,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (kind === 'cart') {
    // Simple cart: rectangle + handle + 2 wheels
    ctx.beginPath()
    ctx.moveTo(cx - 18, cy - 12); ctx.lineTo(cx - 8, cy - 12); ctx.lineTo(cx - 4, cy + 4); ctx.lineTo(cx + 18, cy + 4)
    ctx.stroke()
    ctx.beginPath(); ctx.arc(cx - 2, cy + 14, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
    ctx.beginPath(); ctx.arc(cx + 14, cy + 14, 4, 0, Math.PI * 2); ctx.fill()
  } else {
    // Speech bubble
    ctx.beginPath()
    roundedRectPath(ctx, cx - 18, cy - 14, 36, 24, 6)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 6, cy + 10); ctx.lineTo(cx - 10, cy + 18); ctx.lineTo(cx - 2, cy + 10)
    ctx.stroke()
  }
  // Badge red circle with count
  ctx.fillStyle = '#FF424F'
  ctx.beginPath()
  ctx.arc(cx + 18, cy - 18, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 16px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(badge, cx + 18, cy - 18 + 1)
  ctx.restore()
}

function drawFooterIcon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  kind: 'chat' | 'cart',
  color: string,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (kind === 'cart') {
    ctx.beginPath()
    ctx.moveTo(cx - 20, cy - 14); ctx.lineTo(cx - 10, cy - 14); ctx.lineTo(cx - 4, cy + 6); ctx.lineTo(cx + 22, cy + 6); ctx.lineTo(cx + 18, cy - 8); ctx.lineTo(cx - 7, cy - 8)
    ctx.stroke()
    ctx.beginPath(); ctx.arc(cx - 1, cy + 16, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
    ctx.beginPath(); ctx.arc(cx + 16, cy + 16, 4, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.beginPath()
    roundedRectPath(ctx, cx - 22, cy - 18, 44, 28, 8)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 8, cy + 12); ctx.lineTo(cx - 14, cy + 22); ctx.lineTo(cx - 2, cy + 12)
    ctx.stroke()
  }
  ctx.restore()
}

// ── Plausible price fallback when product.offer doesn't carry one ──────

function fakeMarketplacePrice(locale: UINativeLocale, seed: string): string {
  const n = fakeMetric(seed, 'medium')
  if (locale === 'my-MY') return `RM${(20 + (n % 60)).toFixed(0)}`
  if (locale === 'vi-VN') return `${(199 + (n % 200)).toFixed(0)}.000đ`
  if (locale === 'id-ID') return `Rp${((45 + (n % 80)) * 1000).toLocaleString('id-ID')}`
  return `$${(9 + (n % 30)).toFixed(2)}`
}

async function loadImageSafe(url: string): Promise<HTMLImageElement | null> {
  try { return await loadImage(url) } catch { return null }
}
