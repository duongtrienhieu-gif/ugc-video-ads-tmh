// TikTok Shop review screenshot composer — 4:5 canvas.
// Matches TikTok Shop MY review card aesthetic: black/dark theme, product
// card top with thumb + price in TikTok red, review text below with star
// rating, reviewer name. Looks like a screenshot from TikTok Shop reviews
// tab — slightly grainy phone-screenshot feel.

import type { Composer } from '../templateEngine'
import {
  roundRect, wrapText, loadImage, resolveImageRef, drawStars,
  makeInitials, pickColorBySeed, addJpegNoise,
} from '../templateEngine'

export interface TiktokReviewParams {
  reviewerName: string
  rating: number
  reviewText: string
  productName: string
  productPrice: string         // "RM 89"
  productImageRef?: string
  reviewerHandle?: string      // "@aisyahr"
  likeCount?: number
}

const COLORS = {
  bgTop:        '#0F0F0F',
  bgMid:        '#1A1A1A',
  bgBottom:     '#0F0F0F',
  text:         '#F5F5F5',
  textMuted:    '#A0A0A0',
  tiktokRed:    '#FE2C55',
  tiktokTeal:   '#25F4EE',
  cardBg:       '#1F1F1F',
  border:       '#2A2A2A',
  starGold:     '#FFC107',
}

export const tiktokReviewComposer: Composer<TiktokReviewParams> = {
  id: 'tiktok-review',
  defaultSize: { width: 800, height: 1000 },

  async draw(ctx, params, { width, height }) {
    // Black bg
    ctx.fillStyle = COLORS.bgTop
    ctx.fillRect(0, 0, width, height)

    // ── Status bar mock ───────────────────────────────────────────────
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 18px -apple-system, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText('21:08', 28, 22)
    // Battery
    ctx.strokeStyle = COLORS.text
    ctx.lineWidth = 1.5
    ctx.strokeRect(width - 56, 14, 26, 14)
    ctx.fillRect(width - 56, 16, 18, 10)

    // ── TikTok Shop header ────────────────────────────────────────────
    const headerY = 50
    const headerH = 80
    ctx.fillStyle = COLORS.bgMid
    ctx.fillRect(0, headerY, width, headerH)
    // Back chevron
    ctx.strokeStyle = COLORS.text
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(26, headerY + headerH / 2)
    ctx.lineTo(16, headerY + headerH / 2 - 10)
    ctx.moveTo(26, headerY + headerH / 2)
    ctx.lineTo(16, headerY + headerH / 2 + 10)
    ctx.stroke()
    // Title
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 24px -apple-system, sans-serif'
    ctx.fillText('Ulasan', 48, headerY + headerH / 2)
    // Rating summary right
    ctx.font = 'bold 22px -apple-system, sans-serif'
    ctx.fillText('4.9', width - 90, headerY + headerH / 2)
    drawStars(ctx, width - 60, headerY + headerH / 2 - 8, 5, 12, COLORS.starGold)

    // ── Product card ──────────────────────────────────────────────────
    const cardY = headerY + headerH + 16
    const cardH = 120
    const padX = 20
    ctx.fillStyle = COLORS.cardBg
    roundRect(ctx, padX, cardY, width - padX * 2, cardH, 10)
    ctx.fill()

    const thumbX = padX + 14
    const thumbY = cardY + 14
    const thumbSize = cardH - 28
    if (params.productImageRef) {
      const url = await resolveImageRef(params.productImageRef)
      if (url) {
        try {
          const img = await loadImage(url)
          ctx.save()
          roundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 8)
          ctx.clip()
          ctx.fillStyle = '#2A2A2A'
          ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize)
          const ratio = Math.min(thumbSize / img.width, thumbSize / img.height)
          const drawW = img.width * ratio
          const drawH = img.height * ratio
          ctx.drawImage(
            img,
            thumbX + (thumbSize - drawW) / 2,
            thumbY + (thumbSize - drawH) / 2,
            drawW, drawH,
          )
          ctx.restore()
        } catch {/* skip */}
      }
    } else {
      ctx.fillStyle = '#2A2A2A'
      roundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 8)
      ctx.fill()
    }

    // Product name + price + rating chip
    const infoX = thumbX + thumbSize + 16
    ctx.fillStyle = COLORS.text
    ctx.font = '500 18px -apple-system, sans-serif'
    const nameLines = wrapText(ctx, params.productName, width - padX - infoX - 12)
    let infoY = cardY + 28
    for (const line of nameLines.slice(0, 2)) {
      ctx.fillText(line, infoX, infoY)
      infoY += 22
    }
    // Price in TikTok red
    ctx.fillStyle = COLORS.tiktokRed
    ctx.font = 'bold 26px -apple-system, sans-serif'
    ctx.fillText(params.productPrice, infoX, cardY + cardH - 22)

    // ── Reviewer block ────────────────────────────────────────────────
    let cursorY = cardY + cardH + 24
    const avatarSize = 48
    ctx.fillStyle = pickColorBySeed(params.reviewerName)
    ctx.beginPath()
    ctx.arc(padX + avatarSize / 2, cursorY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 18px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(makeInitials(params.reviewerName), padX + avatarSize / 2, cursorY + avatarSize / 2 + 2)
    ctx.textAlign = 'left'

    const reviewTextX = padX + avatarSize + 14
    ctx.fillStyle = COLORS.text
    ctx.font = '600 20px -apple-system, sans-serif'
    ctx.fillText(params.reviewerName, reviewTextX, cursorY + 18)
    ctx.fillStyle = COLORS.textMuted
    ctx.font = '500 15px -apple-system, sans-serif'
    ctx.fillText(params.reviewerHandle ?? `@${params.reviewerName.toLowerCase().replace(/\s+/g, '')}`, reviewTextX, cursorY + 38)
    // Stars
    drawStars(ctx, reviewTextX + 200, cursorY + 28, params.rating, 18, COLORS.starGold)

    cursorY += avatarSize + 18

    // ── Review text ──────────────────────────────────────────────────
    ctx.fillStyle = COLORS.text
    ctx.font = '500 22px -apple-system, sans-serif'
    const lines = wrapText(ctx, params.reviewText, width - padX * 2)
    for (const line of lines.slice(0, 9)) {
      ctx.fillText(line, padX, cursorY + 22)
      cursorY += 32
    }
    cursorY += 12

    // ── Reaction row (♥ + comment) ────────────────────────────────────
    const likes = params.likeCount ?? Math.floor(120 + Math.random() * 400)
    ctx.fillStyle = COLORS.tiktokRed
    ctx.font = 'bold 28px -apple-system, sans-serif'
    ctx.fillText('♥', padX, cursorY + 30)
    ctx.fillStyle = COLORS.text
    ctx.font = '600 18px -apple-system, sans-serif'
    ctx.fillText(`${likes}`, padX + 36, cursorY + 30)
    ctx.fillStyle = COLORS.textMuted
    ctx.fillText('💬 Balas', padX + 110, cursorY + 30)

    // Bottom bar — TikTok Shop CTA
    const ctaY = height - 80
    ctx.fillStyle = COLORS.tiktokRed
    roundRect(ctx, padX, ctaY, width - padX * 2, 56, 28)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 22px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Beli Sekarang', width / 2, ctaY + 36)
    ctx.textAlign = 'left'

    // JPEG noise — heavier than Shopee for that "TikTok screenshot" look
    addJpegNoise(ctx, width, height, 0.035, `tiktok-${params.reviewerName}`)
  },
}
