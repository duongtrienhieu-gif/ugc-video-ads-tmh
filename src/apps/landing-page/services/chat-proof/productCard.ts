// ─────────────────────────────────────────────────────────────────────
// In-chat product card renderer — recreates the iMessage / WhatsApp
// rich-link preview pattern (see reference image: green Huel can with
// "Huel Daily Greens · 41 vitamins, minerals & superfoods · huel.com").
//
// The product card is a chat bubble with a wide-aspect image at the top
// and 2-3 lines of text underneath. Drawn purely on canvas — text and
// layout deterministic, only the thumbnail pixel data comes from AI.
// ─────────────────────────────────────────────────────────────────────

import { drawImageCover, fillRoundRect, SYSTEM_FONT_STACK, wrapText } from './canvasUtils'
import type { ProductCard } from './types'

export interface ProductCardLayout {
  /** Required width — caller decides based on bubble width budget. */
  width: number
  /** Total rendered height (image + text). Returned by drawProductCard. */
  height: number
}

/** Draw a product card preview bubble. Returns the final height so the
 *  caller can advance their cursor.
 *
 *  The card is structured top→bottom:
 *    1. Thumbnail (4:3 image area)
 *    2. Title (bold)
 *    3. Subtitle (regular, 2-line wrap max)
 *    4. Domain (tiny, gray)
 */
export function drawProductCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  card: ProductCard,
  thumbImage: HTMLImageElement | null,
  width: number,
  variantTheme: ProductCardTheme,
): number {
  const padding = width * 0.045
  const radius = width * 0.04
  const thumbAspect = 3 / 4  // height / width — wide landscape ish
  const thumbHeight = width * thumbAspect * 0.55  // ~41% of width

  // Title
  const titleFontSize = Math.round(width * 0.062)
  const subtitleFontSize = Math.round(width * 0.045)
  const domainFontSize = Math.round(width * 0.038)

  // Measure text heights
  ctx.font = `400 ${subtitleFontSize}px ${SYSTEM_FONT_STACK}`
  const subtitleLines = wrapText(ctx, card.subtitle, width - padding * 2).slice(0, 2)
  const lineHeight = subtitleFontSize * 1.25

  const textBlockHeight =
    padding * 0.7
    + titleFontSize * 1.1
    + 4
    + subtitleLines.length * lineHeight
    + 4
    + domainFontSize * 1.1
    + padding * 0.7

  const totalHeight = thumbHeight + textBlockHeight

  // Card background
  fillRoundRect(ctx, x, y, width, totalHeight, radius, variantTheme.cardBg)

  // Thumbnail area
  if (thumbImage) {
    drawImageCover(ctx, thumbImage, x, y, width, thumbHeight, 0)
    // Mask top corners
    ctx.save()
    ctx.globalCompositeOperation = 'destination-in'
    fillRoundRect(ctx, x, y, width, totalHeight, radius, '#fff')
    ctx.restore()
  } else {
    // Placeholder gradient
    const grad = ctx.createLinearGradient(x, y, x, y + thumbHeight)
    grad.addColorStop(0, variantTheme.thumbPlaceholderTop)
    grad.addColorStop(1, variantTheme.thumbPlaceholderBottom)
    ctx.save()
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.rect(x, y, width, thumbHeight)
    ctx.clip()
    fillRoundRect(ctx, x, y, width, totalHeight, radius, '#fff')
    ctx.fillStyle = grad
    ctx.fillRect(x, y, width, thumbHeight)
    ctx.restore()
  }

  // Subtle divider line between thumbnail and text
  ctx.fillStyle = variantTheme.divider
  ctx.fillRect(x, y + thumbHeight, width, 1)

  // Text content
  let textY = y + thumbHeight + padding * 0.7
  ctx.fillStyle = variantTheme.titleColor
  ctx.font = `700 ${titleFontSize}px ${SYSTEM_FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(card.title, x + padding, textY, width - padding * 2)
  textY += titleFontSize * 1.1 + 4

  ctx.fillStyle = variantTheme.subtitleColor
  ctx.font = `400 ${subtitleFontSize}px ${SYSTEM_FONT_STACK}`
  for (const line of subtitleLines) {
    ctx.fillText(line, x + padding, textY, width - padding * 2)
    textY += lineHeight
  }
  textY += 4

  if (card.domain) {
    ctx.fillStyle = variantTheme.domainColor
    ctx.font = `400 ${domainFontSize}px ${SYSTEM_FONT_STACK}`
    ctx.fillText(card.domain, x + padding, textY, width - padding * 2)
  }

  return totalHeight
}

export interface ProductCardTheme {
  cardBg: string
  titleColor: string
  subtitleColor: string
  domainColor: string
  divider: string
  thumbPlaceholderTop: string
  thumbPlaceholderBottom: string
}

/** Per-variant product card theme. iMessage uses a clean white card on
 *  light-green bubble; WhatsApp uses near-bubble color; Messenger uses
 *  the bubble-tinted card.  */
export const PRODUCT_CARD_THEMES: Record<string, ProductCardTheme> = {
  'whatsapp-ios': {
    cardBg: '#FFFFFF',
    titleColor: '#111111',
    subtitleColor: '#4A4A4A',
    domainColor: '#8C8C8C',
    divider: '#E5E5E5',
    thumbPlaceholderTop: '#D7F0DC',
    thumbPlaceholderBottom: '#A2D8AC',
  },
  'whatsapp-android': {
    cardBg: '#FFFFFF',
    titleColor: '#111111',
    subtitleColor: '#4A4A4A',
    domainColor: '#8C8C8C',
    divider: '#E5E5E5',
    thumbPlaceholderTop: '#D7F0DC',
    thumbPlaceholderBottom: '#A2D8AC',
  },
  'imessage-ios': {
    cardBg: '#FFFFFF',
    titleColor: '#0A0A0A',
    subtitleColor: '#666666',
    domainColor: '#A0A0A0',
    divider: '#EAEAEA',
    thumbPlaceholderTop: '#E8F0FB',
    thumbPlaceholderBottom: '#BFD4F0',
  },
  'messenger-ios': {
    cardBg: '#F0F0F0',
    titleColor: '#0A0A0A',
    subtitleColor: '#555555',
    domainColor: '#888888',
    divider: '#E1E1E1',
    thumbPlaceholderTop: '#E4F0FF',
    thumbPlaceholderBottom: '#BFD7FF',
  },
  'messenger-android': {
    cardBg: '#F0F0F0',
    titleColor: '#0A0A0A',
    subtitleColor: '#555555',
    domainColor: '#888888',
    divider: '#E1E1E1',
    thumbPlaceholderTop: '#E4F0FF',
    thumbPlaceholderBottom: '#BFD7FF',
  },
}
