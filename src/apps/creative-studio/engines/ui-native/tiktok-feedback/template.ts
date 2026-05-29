// ── TikTok Shop Review Canvas Template (P50 authenticity overhaul) ─────────
//
// Renders a TikTok Shop-style buyer review screenshot. White background
// with TikTok's signature pink-red accents. Sister of shopee-feedback —
// same structural restructure as P50 Shopee (2 stacked reviews, photo
// grid, rich filter chips, masked usernames, locale-aware Bahasa Melayu
// default) but TikTok-flavoured chrome.
//
// Real TikTok Shop reference layout (per user's screenshot):
//   • Header: back chevron + "4.8 Đánh giá (2,6K)" + share + cart(N)
//   • Filter chip rows: "Ảnh/video (343) | 5★ (2,3K) | 4★ (231) | 3★ (60)"
//                       "2★ (9) | 1★ (57) | Đánh giá bổ sung (41)"
//                       "Khách mua tiếp (76) | Chất lượng tốt (247) | ▾"
//   • "Đánh giá xác thực từ khách hàng thật" disclaimer + "Mới nhất ▼"
//   • Stacked review cards: avatar + masked name + 5★ + item tag +
//     review body + 2x2 photo grid + date + ... menu + 👍 1
//   • Bottom bar: "Cửa h..." + "Chat" + red cart icon + "Mua ngay
//     [price] Freeship"
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
import { TIKTOK_SHOP_LIGHT_2024 } from '../_shared/colors'
import { renderStatusBar } from '../_shared/statusBar'
import { readRating, readVariant, readHelpful } from '../_shared/textPayload'
import { findStrings, fakeMetric } from '../_shared/conversationMetadata'
import type { MessageTimeline } from '../_shared/timestamps'

export const TIKTOK_SHOP_REVIEW_TEMPLATE: UINativeTemplate = {
  id: 'tiktok-shop-review-v1',
  platform: 'tiktok-shop',
  variant: 'stacked-reviews',
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
  avatarPool?: Map<number, string>
  /** P50 — photo pool from prior creatives for the same product. */
  reviewPhotoUrls?: string[]
  locale?: UINativeLocale
}

export async function renderTikTokShopReview(
  inputs: RenderInputs,
): Promise<HTMLCanvasElement> {
  const palette = TIKTOK_SHOP_LIGHT_2024
  const size = TIKTOK_SHOP_REVIEW_TEMPLATE.canvasSize
  const { canvas, ctx } = createCanvas(size)
  const locale = inputs.locale ?? 'my-MY'
  const S = findStrings(locale)

  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, 0, size.width, size.height)

  renderStatusBar(ctx, {
    style: 'ios',
    fg: palette.headerFg,
    bg: palette.headerBg,
    timeLabel: inputs.timeline.statusBarTime,
    width: size.width,
  })

  // ── Header: chevron + "★ 4.8 Đánh giá (2,6K)" + share + cart
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

  // Center title: ★ 4.8 Ulasan (2,6K)
  const totalReviewsK = (fakeMetric(`${inputs.timeline.dateLabel}_tikrv`, 'large') / 1000).toFixed(1)
  const headerTitle = `★ 4.8  ${S.reviewsWord.charAt(0).toUpperCase()}${S.reviewsWord.slice(1)} (${totalReviewsK}K)`
  ctx.fillStyle = '#FFD43A'
  drawSmallStar(ctx, size.width / 2 - 130, headerY + headerH / 2, 14)
  ctx.fillStyle = palette.headerFg
  ctx.font = '700 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(headerTitle, size.width / 2 + 10, headerY + headerH / 2)

  // Right icons: share + cart with red badge
  drawTikTokHeaderIcon(ctx, size.width - 160, headerY + headerH / 2, 'share', palette.headerFg)
  drawTikTokHeaderIcon(ctx, size.width - 70,  headerY + headerH / 2, 'cart',  palette.headerFg, '6')

  // ── Filter chip rows — match real TikTok Shop 3-row layout
  let chipsY = headerY + headerH + 24
  const totalReviews = Math.round(parseFloat(totalReviewsK) * 1000)
  const photoCount    = fakeMetric(`${inputs.timeline.dateLabel}_tkphotos`, 'medium')
  const fiveStarTk    = Math.round(totalReviews * 0.88)
  const fourStarTk    = Math.round(totalReviews * 0.09)
  const threeStarTk   = Math.round(totalReviews * 0.02)
  const twoStarTk     = Math.round(totalReviews * 0.005)
  const oneStarTk     = Math.round(totalReviews * 0.005)
  const extraReviews  = fakeMetric(`${inputs.timeline.dateLabel}_extra_rv`, 'small')
  const repeatBuyers  = fakeMetric(`${inputs.timeline.dateLabel}_repeat_b`, 'small')
  const qualityGood   = fakeMetric(`${inputs.timeline.dateLabel}_qgood`, 'medium')

  // Row 1
  let x = 36
  x = drawTikTokChip(ctx, x, chipsY, `${S.filterImagesVideos} (${photoCount})`, palette, false)
  x = drawTikTokChip(ctx, x, chipsY, `5★ (${(fiveStarTk / 1000).toFixed(1)}K)`, palette, true)
  x = drawTikTokChip(ctx, x, chipsY, `4★ (${fourStarTk})`, palette, false)
  x = drawTikTokChip(ctx, x, chipsY, `3★ (${threeStarTk})`, palette, false)
  // Row 2
  chipsY += 56
  x = 36
  x = drawTikTokChip(ctx, x, chipsY, `2★ (${twoStarTk})`, palette, false)
  x = drawTikTokChip(ctx, x, chipsY, `1★ (${oneStarTk})`, palette, false)
  x = drawTikTokChip(ctx, x, chipsY, `${S.filterExtraReviews} (${extraReviews})`, palette, false)
  // Row 3
  chipsY += 56
  x = 36
  x = drawTikTokChip(ctx, x, chipsY, `${S.filterRepeatBuyers} (${repeatBuyers})`, palette, false)
  x = drawTikTokChip(ctx, x, chipsY, `${S.filterQualityGood} (${qualityGood})`, palette, false)
  void x

  // ── Disclaimer row: "Ulasan disahkan..." + "Terbaru ▾"
  chipsY += 64
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 22px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${S.authenticDisclaimer} ⓘ`, 36, chipsY)
  ctx.textAlign = 'right'
  ctx.fillText(`${S.newest} ▾`, size.width - 36, chipsY)

  // ── Pre-load avatars + photo pool
  const reviews = inputs.text.items
  const avatarCache = new Map<number, HTMLImageElement | null>()
  const poolSize = inputs.avatarPool?.size ?? 0
  for (let idx = 0; idx < reviews.length; idx++) {
    const url = (poolSize > 0
      ? inputs.avatarPool!.get(idx % poolSize)
      : inputs.customerAvatarUrl) ?? inputs.customerAvatarUrl
    avatarCache.set(idx, await loadImageSafe(url))
  }
  const photoPool: (HTMLImageElement | null)[] = []
  for (const url of inputs.reviewPhotoUrls ?? []) {
    photoPool.push(await loadImageSafe(url))
  }
  const fallbackProductImg = inputs.productImageUrl ? await loadImageSafe(inputs.productImageUrl) : null

  // ── Stacked review cards
  const footerH = 140
  const reviewsTop = chipsY + 32
  const reviewsBottom = size.height - footerH - 24
  let cursor = reviewsTop
  for (let i = 0; i < reviews.length; i++) {
    if (cursor > reviewsBottom - 240) break
    const r = reviews[i]
    cursor = await renderTikTokReviewCard(ctx, {
      palette, S, locale,
      width: size.width,
      startY: cursor,
      maxBottom: reviewsBottom,
      item: r,
      displayName: inputs.text.participants[i]?.displayName ?? `Buyer ${i + 1}`,
      avatarImg: avatarCache.get(i) ?? null,
      timestamp: inputs.timeline.dateLabel,
      photoPool,
      photoOffset: i * 2,
      fallbackProductImg,
    })
    cursor += 24
  }

  // ── Bottom bar: Cửa hàng / Chat / cart icon / "Mua ngay [price] Freeship"
  const footerY = size.height - footerH
  ctx.fillStyle = palette.footerBg
  ctx.fillRect(0, footerY, size.width, footerH)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, footerY, size.width, 1)

  // Cửa hàng / Shop home column
  drawFooterIcon(ctx, 70, footerY + footerH / 2 - 6, 'shop', palette.pageFg)
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 18px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(S.shopHome, 70, footerY + footerH / 2 + 22)

  // Chat column
  drawFooterIcon(ctx, 200, footerY + footerH / 2 - 6, 'chat', palette.pageFg)
  ctx.fillText(S.chat, 200, footerY + footerH / 2 + 22)

  // Cart pill button (small, red filled circle)
  const cartCx = 330
  ctx.fillStyle = palette.ctaBg
  ctx.beginPath()
  ctx.arc(cartCx, footerY + footerH / 2, 30, 0, Math.PI * 2)
  ctx.fill()
  drawFooterIcon(ctx, cartCx, footerY + footerH / 2, 'cart', '#FFFFFF')

  // CTA pill: "Mua ngay [price]  Freeship"
  const offerPrice = fakeMarketplacePrice(locale, inputs.timeline.dateLabel)
  const ctaX = cartCx + 50
  const ctaW = size.width - ctaX - 30
  const ctaH = 80
  const ctaY = footerY + (footerH - ctaH) / 2
  roundedRectPath(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2)
  ctx.fillStyle = palette.ctaBg
  ctx.fill()
  ctx.fillStyle = palette.ctaFg
  ctx.font = '700 30px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${S.buyNow}  ${offerPrice}`, ctaX + ctaW / 2, ctaY + ctaH / 2 - 4)
  ctx.font = '500 18px -apple-system, sans-serif'
  ctx.globalAlpha = 0.9
  ctx.fillText(S.freeship, ctaX + ctaW / 2, ctaY + ctaH / 2 + 22)
  ctx.globalAlpha = 1

  return canvas
}

// ── Single review card renderer ────────────────────────────────────────

interface ReviewCardInputs {
  palette: typeof TIKTOK_SHOP_LIGHT_2024
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

async function renderTikTokReviewCard(
  ctx: CanvasRenderingContext2D,
  inputs: ReviewCardInputs,
): Promise<number> {
  const { palette, S, width, startY, maxBottom, item, displayName, avatarImg, timestamp,
          photoPool, photoOffset, fallbackProductImg } = inputs
  void maxBottom

  const padX = 50
  let cursor = startY + 18

  // Avatar + masked username row
  const avatarR = 28
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

  ctx.fillStyle = palette.pageFg
  ctx.font = '600 25px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(displayName, avatarCx + avatarR + 16, cursor + 4)

  // Star row + item tag below the username
  drawStarRow(ctx, avatarCx + avatarR + 16, cursor + 38, readRating(item), palette, 20)

  // Item tag — TikTok Shop uses "Mặt hàng:" prefix
  const variantStr = readVariant(item)
  if (variantStr) {
    ctx.fillStyle = palette.mutedFg
    ctx.font = '400 22px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${S.itemLabel} ${variantStr}`, avatarCx + avatarR + 130, cursor + 28)
  }

  cursor += avatarR * 2 + 36

  // Review body
  ctx.fillStyle = palette.pageFg
  ctx.font = '400 26px -apple-system, sans-serif'
  const bodyMaxW = width - padX * 2
  const paragraphs = item.text.split(/\n/).map((s) => s.trim()).filter(Boolean)
  const lineH = 36
  for (const para of paragraphs) {
    const lines = wrapText(ctx, para, bodyMaxW)
    for (const line of lines) {
      ctx.fillText(line, padX, cursor)
      cursor += lineH
    }
  }
  cursor += 12

  // 2x2 photo grid
  const thumb = 210
  const gap = 12
  const photo1 = photoPool[(photoOffset)     % Math.max(1, photoPool.length)] ?? fallbackProductImg
  const photo2 = photoPool[(photoOffset + 1) % Math.max(1, photoPool.length)] ?? fallbackProductImg
  drawReviewThumb(ctx, padX,                 cursor, thumb, photo1, palette)
  drawReviewThumb(ctx, padX + thumb + gap,   cursor, thumb, photo2, palette)
  cursor += thumb + 18

  // Bottom row: date + ... menu + 👍 count
  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 22px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(timestamp, padX, cursor + 14)

  // ... menu glyph mid
  for (let d = 0; d < 3; d++) {
    ctx.beginPath()
    ctx.arc(width - padX - 100 + d * 12, cursor + 14, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // 👍 count
  const helpfulCount = readHelpful(item)
  ctx.fillStyle = palette.mutedFg
  ctx.font = '500 22px -apple-system, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`👍 ${helpfulCount}`, width - padX, cursor + 14)

  cursor += 40

  // Divider
  ctx.fillStyle = palette.divider
  ctx.fillRect(padX, cursor, width - padX * 2, 1)

  return cursor
}

// ── Small drawing helpers ──────────────────────────────────────────────

function drawReviewThumb(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  img: HTMLImageElement | null,
  palette: typeof TIKTOK_SHOP_LIGHT_2024,
): void {
  ctx.save()
  roundedRectPath(ctx, x, y, size, size, 10)
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
  ctx.strokeStyle = palette.divider
  ctx.lineWidth = 1
  roundedRectPath(ctx, x, y, size, size, 10)
  ctx.stroke()
}

function drawStarRow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rating: number,
  palette: { starFill: string; starEmpty: string },
  starSize: number = 28,
): void {
  const gap = 4
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < rating ? palette.starFill : palette.starEmpty
    drawStar(ctx, x + i * (starSize + gap) + starSize / 2, y + starSize / 2, starSize / 2)
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

function drawSmallStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  drawStar(ctx, cx, cy, r)
}

function drawTikTokChip(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string,
  palette: typeof TIKTOK_SHOP_LIGHT_2024,
  active: boolean,
): number {
  ctx.font = '500 22px -apple-system, sans-serif'
  const padX = 22
  const w = ctx.measureText(text).width + padX * 2
  const h = 44
  roundedRectPath(ctx, x, y, w, h, h / 2)
  if (active) {
    ctx.fillStyle = '#FFE5EA'
    ctx.fill()
    ctx.strokeStyle = palette.ctaBg
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = palette.ctaBg
  } else {
    ctx.fillStyle = '#F5F5F5'
    ctx.fill()
    ctx.fillStyle = palette.pageFg
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX, y + h / 2)
  return x + w + 14
}

function drawTikTokHeaderIcon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  kind: 'share' | 'cart',
  color: string,
  badge?: string,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (kind === 'share') {
    // Curved arrow (forward share)
    ctx.beginPath()
    ctx.arc(cx, cy + 4, 20, Math.PI * 1.1, Math.PI * 1.9, false)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + 18, cy - 8); ctx.lineTo(cx + 28, cy - 4); ctx.lineTo(cx + 22, cy + 6)
    ctx.stroke()
  } else {
    // Cart
    ctx.beginPath()
    ctx.moveTo(cx - 20, cy - 14); ctx.lineTo(cx - 10, cy - 14); ctx.lineTo(cx - 4, cy + 6); ctx.lineTo(cx + 22, cy + 6); ctx.lineTo(cx + 18, cy - 8); ctx.lineTo(cx - 7, cy - 8)
    ctx.stroke()
    ctx.beginPath(); ctx.arc(cx - 1, cy + 16, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
    ctx.beginPath(); ctx.arc(cx + 16, cy + 16, 4, 0, Math.PI * 2); ctx.fill()
  }
  if (badge) {
    ctx.fillStyle = '#FE2C55'
    ctx.beginPath()
    ctx.arc(cx + 20, cy - 14, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '700 14px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(badge, cx + 20, cy - 14 + 1)
  }
  ctx.restore()
}

function drawFooterIcon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  kind: 'chat' | 'cart' | 'shop',
  color: string,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (kind === 'cart') {
    ctx.beginPath()
    ctx.moveTo(cx - 16, cy - 11); ctx.lineTo(cx - 8, cy - 11); ctx.lineTo(cx - 3, cy + 4); ctx.lineTo(cx + 17, cy + 4); ctx.lineTo(cx + 14, cy - 6); ctx.lineTo(cx - 5, cy - 6)
    ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy + 12, 3, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + 12, cy + 12, 3, 0, Math.PI * 2); ctx.fill()
  } else if (kind === 'chat') {
    ctx.beginPath()
    roundedRectPath(ctx, cx - 18, cy - 14, 36, 24, 6)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 6, cy + 10); ctx.lineTo(cx - 10, cy + 18); ctx.lineTo(cx - 2, cy + 10)
    ctx.stroke()
  } else {
    // Shop home — house glyph
    ctx.beginPath()
    ctx.moveTo(cx - 18, cy + 14); ctx.lineTo(cx - 18, cy - 4); ctx.lineTo(cx, cy - 18); ctx.lineTo(cx + 18, cy - 4); ctx.lineTo(cx + 18, cy + 14); ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 6, cy + 14); ctx.lineTo(cx - 6, cy + 4); ctx.lineTo(cx + 6, cy + 4); ctx.lineTo(cx + 6, cy + 14)
    ctx.stroke()
  }
  ctx.restore()
}

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
