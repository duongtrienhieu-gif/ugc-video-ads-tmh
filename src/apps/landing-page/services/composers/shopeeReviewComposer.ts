// Shopee review screenshot composer — 4:5 canvas.
// Matches Shopee MY ecommerce review card UI: orange header strip, product
// thumb top-left, 5-star rating, "Verified Purchase" badge, Malay review
// text with emojis, reviewer name + timestamp, "Bermanfaat?" reaction row.

import type { Composer } from '../templateEngine'
import {
  roundRect, wrapText, loadImage, resolveImageRef, drawStars,
  makeInitials, pickColorBySeed, addJpegNoise,
} from '../templateEngine'

export interface ShopeeReviewParams {
  reviewerName: string
  rating: number              // 1-5, supports decimals (4.5)
  reviewText: string
  productName: string
  productPrice: string        // e.g. "RM 89"
  productImageRef?: string    // asset:xxx or http URL
  timestamp?: string          // "2 minggu lalu"
  variantLabel?: string       // "1 botol", "Set 2 botol", etc.
}

const COLORS = {
  bg:            '#FFFFFF',
  shopeeOrange:  '#EE4D2D',
  border:        '#E0E0E0',
  text:          '#222222',
  meta:          '#757575',
  badgeBg:       '#FFF4F0',
  badgeText:     '#EE4D2D',
  starGold:      '#FFA500',
  reactBg:       '#F5F5F5',
  variantChip:   '#F5F5F5',
}

export const shopeeReviewComposer: Composer<ShopeeReviewParams> = {
  id: 'shopee-review',
  defaultSize: { width: 800, height: 1000 },

  async draw(ctx, params, { width, height }) {
    // Background
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, width, height)

    // Top brand strip — orange Shopee
    ctx.fillStyle = COLORS.shopeeOrange
    ctx.fillRect(0, 0, width, 56)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 26px -apple-system, "Segoe UI", Roboto, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText('Shopee', 24, 28)
    ctx.font = '500 16px -apple-system, "Segoe UI", Roboto, sans-serif'
    ctx.fillText('Penilaian Produk', 130, 28)
    // Filter chip on right
    roundRect(ctx, width - 130, 14, 110, 28, 14)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.fillStyle = COLORS.shopeeOrange
    ctx.font = '600 14px -apple-system, "Segoe UI", Roboto, sans-serif'
    ctx.fillText('5 Bintang ▾', width - 116, 28)

    // ─── Reviewer row ────────────────────────────────────────────────
    const padX = 24
    let cursorY = 80
    const avatarSize = 56
    // Avatar circle
    ctx.fillStyle = pickColorBySeed(params.reviewerName)
    ctx.beginPath()
    ctx.arc(padX + avatarSize / 2, cursorY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 22px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(makeInitials(params.reviewerName), padX + avatarSize / 2, cursorY + avatarSize / 2 + 2)
    ctx.textAlign = 'left'

    // Reviewer name + timestamp + stars
    const textX = padX + avatarSize + 16
    ctx.fillStyle = COLORS.text
    ctx.font = '600 22px -apple-system, sans-serif'
    ctx.fillText(params.reviewerName, textX, cursorY + 22)
    // Stars
    drawStars(ctx, textX, cursorY + 32, params.rating, 20, COLORS.starGold)
    // Timestamp
    ctx.fillStyle = COLORS.meta
    ctx.font = '500 16px -apple-system, sans-serif'
    ctx.fillText(params.timestamp ?? '2 minggu lalu', textX + 170, cursorY + 46)

    cursorY += avatarSize + 18

    // Variant chip
    if (params.variantLabel) {
      ctx.fillStyle = COLORS.variantChip
      const chipW = ctx.measureText(`Variasi: ${params.variantLabel}`).width + 24
      roundRect(ctx, padX, cursorY, chipW, 28, 6)
      ctx.fill()
      ctx.fillStyle = COLORS.meta
      ctx.font = '500 15px -apple-system, sans-serif'
      ctx.fillText(`Variasi: ${params.variantLabel}`, padX + 12, cursorY + 18)
      cursorY += 40
    }

    // ─── Review text block ───────────────────────────────────────────
    ctx.fillStyle = COLORS.text
    ctx.font = '500 22px -apple-system, sans-serif'
    const lines = wrapText(ctx, params.reviewText, width - padX * 2)
    for (const line of lines.slice(0, 7)) {
      ctx.fillText(line, padX, cursorY + 18)
      cursorY += 30
    }
    cursorY += 16

    // ─── Product card ────────────────────────────────────────────────
    const cardY = cursorY
    const cardH = 130
    ctx.fillStyle = '#FAFAFA'
    roundRect(ctx, padX, cardY, width - padX * 2, cardH, 8)
    ctx.fill()
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 1
    ctx.stroke()

    // Product thumb
    const thumbX = padX + 12
    const thumbY = cardY + 12
    const thumbSize = cardH - 24
    if (params.productImageRef) {
      const url = await resolveImageRef(params.productImageRef)
      if (url) {
        try {
          const img = await loadImage(url)
          ctx.save()
          roundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 6)
          ctx.clip()
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize)
          // contain-style fit
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
        } catch {/* show empty thumb */}
      }
    } else {
      ctx.fillStyle = '#F0F0F0'
      roundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 6)
      ctx.fill()
    }

    // Product name + price (right of thumb)
    const infoX = thumbX + thumbSize + 16
    ctx.fillStyle = COLORS.text
    ctx.font = '500 18px -apple-system, sans-serif'
    const nameLines = wrapText(ctx, params.productName, width - padX - infoX - 12)
    let infoY = cardY + 30
    for (const line of nameLines.slice(0, 2)) {
      ctx.fillText(line, infoX, infoY)
      infoY += 24
    }
    // Price (Shopee orange)
    ctx.fillStyle = COLORS.shopeeOrange
    ctx.font = 'bold 24px -apple-system, sans-serif'
    ctx.fillText(params.productPrice, infoX, cardY + cardH - 22)
    cursorY = cardY + cardH + 18

    // ─── "Bermanfaat?" reaction row ──────────────────────────────────
    ctx.fillStyle = COLORS.reactBg
    roundRect(ctx, padX, cursorY, width - padX * 2, 56, 8)
    ctx.fill()
    ctx.fillStyle = COLORS.text
    ctx.font = '500 18px -apple-system, sans-serif'
    ctx.fillText('Penilaian ini berguna?', padX + 18, cursorY + 32)
    // 👍 chip
    const likeX = width - padX - 100
    ctx.fillStyle = '#FFFFFF'
    roundRect(ctx, likeX, cursorY + 12, 80, 32, 16)
    ctx.fill()
    ctx.strokeStyle = COLORS.border
    ctx.stroke()
    ctx.fillStyle = COLORS.text
    ctx.font = '600 16px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('👍 12', likeX + 40, cursorY + 32)
    ctx.textAlign = 'left'

    // Verified purchase badge floats at top-right (across body)
    ctx.fillStyle = COLORS.badgeBg
    roundRect(ctx, width - padX - 178, 88, 162, 28, 6)
    ctx.fill()
    ctx.fillStyle = COLORS.badgeText
    ctx.font = '600 14px -apple-system, sans-serif'
    ctx.fillText('✓ Pembelian Disahkan', width - padX - 172, 106)

    // Subtle JPEG noise for authenticity
    addJpegNoise(ctx, width, height, 0.025, `shopee-${params.reviewerName}`)
  },
}
