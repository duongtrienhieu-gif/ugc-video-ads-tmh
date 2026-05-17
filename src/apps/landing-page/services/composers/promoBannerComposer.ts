// Promo banner composer — supports 16:9 (offer/final-cta) and 1:1 ratios.
// Reuses product packshot from productRenderPool (key insight: same product
// image rendered ONCE by KIE, then composed into 4+ promo banners locally).
//
// Two variants:
//   • clean    — gradient bg, soft glow, premium feel (offer_01, finalcta_01)
//   • urgency  — high-contrast bg, scarcity badges, hard-sell (offer_02, finalcta_02)

import type { Composer } from '../templateEngine'
import {
  roundRect, loadImage, resolveImageRef, addJpegNoise,
} from '../templateEngine'

export interface PromoBannerParams {
  /** clean = premium gradient; urgency = high-contrast hard-sell */
  variant: 'clean' | 'urgency'
  /** Source product packshot — typically from productRenderPool */
  productImageRef?: string
  /** Big top line — "DISKAUN 50% HARI INI" / "PROMOSI TAMAT MALAM INI" */
  mainHeadline: string
  /** Middle line — "COD SELURUH MALAYSIA" / "JANGAN LEPASKAN PELUANG" */
  subHeadline: string
  /** Bottom line — "STOK TERHAD" / "RAMAI DAH CUBA" */
  thirdLine?: string
  /** Exact RM price — required for ecommerce promo. */
  productPrice?: string
  /** Trust badges to show: HALAL / KKM / shield — pick which ones to display. */
  badges?: Array<'halal' | 'kkm' | 'shield' | 'cod'>
}

export const promoBannerComposer: Composer<PromoBannerParams> = {
  id: 'promo-banner',
  defaultSize: { width: 1280, height: 720 }, // 16:9

  async draw(ctx, params, { width, height }) {
    const isClean = params.variant === 'clean'

    // ── Background gradient ───────────────────────────────────────────
    const grad = ctx.createLinearGradient(0, 0, width, height)
    if (isClean) {
      grad.addColorStop(0, '#FFF4E6')   // warm cream
      grad.addColorStop(0.5, '#FFE0B2')
      grad.addColorStop(1, '#FFB74D')   // amber edge
    } else {
      grad.addColorStop(0, '#1A237E')   // navy
      grad.addColorStop(0.5, '#3F0061')
      grad.addColorStop(1, '#D32F2F')   // red corner
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)

    // Subtle starburst behind product (urgency only)
    if (!isClean) {
      ctx.save()
      ctx.translate(width * 0.32, height / 2)
      ctx.fillStyle = 'rgba(255, 200, 0, 0.18)'
      for (let i = 0; i < 16; i++) {
        ctx.rotate(Math.PI / 8)
        ctx.beginPath()
        ctx.moveTo(0, -8)
        ctx.lineTo(width * 0.5, 0)
        ctx.lineTo(0, 8)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }

    // ── Product image (left side) ─────────────────────────────────────
    const productAreaW = width * 0.42
    const productAreaH = height * 0.78
    const productX = width * 0.04
    const productY = (height - productAreaH) / 2
    if (params.productImageRef) {
      const url = await resolveImageRef(params.productImageRef)
      if (url) {
        try {
          const img = await loadImage(url)
          // Soft halo behind product
          if (isClean) {
            const halo = ctx.createRadialGradient(
              productX + productAreaW / 2, productY + productAreaH / 2, 20,
              productX + productAreaW / 2, productY + productAreaH / 2, productAreaW / 1.8,
            )
            halo.addColorStop(0, 'rgba(255, 255, 255, 0.55)')
            halo.addColorStop(1, 'rgba(255, 255, 255, 0)')
            ctx.fillStyle = halo
            ctx.fillRect(0, 0, width, height)
          } else {
            const halo = ctx.createRadialGradient(
              productX + productAreaW / 2, productY + productAreaH / 2, 20,
              productX + productAreaW / 2, productY + productAreaH / 2, productAreaW / 1.5,
            )
            halo.addColorStop(0, 'rgba(255, 80, 0, 0.45)')
            halo.addColorStop(1, 'rgba(255, 80, 0, 0)')
            ctx.fillStyle = halo
            ctx.fillRect(0, 0, width, height)
          }

          // Product, contain-fit
          const ratio = Math.min(productAreaW / img.width, productAreaH / img.height)
          const drawW = img.width * ratio
          const drawH = img.height * ratio
          ctx.drawImage(
            img,
            productX + (productAreaW - drawW) / 2,
            productY + (productAreaH - drawH) / 2,
            drawW, drawH,
          )
        } catch {/* skip */}
      }
    } else {
      // No product → big placeholder rect with brand name
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      roundRect(ctx, productX, productY, productAreaW, productAreaH, 16)
      ctx.fill()
    }

    // ── Headline block (right side) ───────────────────────────────────
    const textX = width * 0.5
    const textMaxW = width * 0.45
    let cursorY = height * 0.18

    // Main headline — huge bold
    ctx.fillStyle = isClean ? '#1B5E20' : '#FFFFFF'
    ctx.font = `900 ${Math.floor(height * 0.085)}px -apple-system, "Segoe UI", sans-serif`
    ctx.textBaseline = 'top'
    const mainLines = drawWrapped(ctx, params.mainHeadline, textX, cursorY, textMaxW, height * 0.092)
    cursorY += mainLines * height * 0.092 + 12

    // Sub headline
    ctx.fillStyle = isClean ? '#33691E' : '#FFEB3B'
    ctx.font = `700 ${Math.floor(height * 0.05)}px -apple-system, sans-serif`
    const subLines = drawWrapped(ctx, params.subHeadline, textX, cursorY, textMaxW, height * 0.06)
    cursorY += subLines * height * 0.06 + 12

    // Third line
    if (params.thirdLine) {
      ctx.fillStyle = isClean ? '#5D4037' : '#FFFFFF'
      ctx.font = `600 ${Math.floor(height * 0.038)}px -apple-system, sans-serif`
      const thirdLines = drawWrapped(ctx, params.thirdLine, textX, cursorY, textMaxW, height * 0.046)
      cursorY += thirdLines * height * 0.046 + 12
    }

    // ── Price chip ───────────────────────────────────────────────────
    if (params.productPrice) {
      const priceW = 320
      const priceH = 90
      const priceX = textX
      const priceY = cursorY + 8

      ctx.fillStyle = isClean ? '#C62828' : '#FFEB3B'
      roundRect(ctx, priceX, priceY, priceW, priceH, 16)
      ctx.fill()
      ctx.fillStyle = isClean ? '#FFFFFF' : '#1A1A1A'
      ctx.font = `900 ${Math.floor(height * 0.075)}px -apple-system, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(params.productPrice, priceX + priceW / 2, priceY + priceH / 2 + 18)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
    }

    // ── Trust badges (bottom strip) ────────────────────────────────────
    const badges = params.badges ?? ['halal', 'kkm', 'cod']
    const badgeY = height - 70
    let badgeX = textX
    for (const b of badges) {
      const label = b === 'halal' ? '✓ HALAL'
                  : b === 'kkm'   ? '✓ KKM MY'
                  : b === 'shield' ? '🛡 SAFE'
                  : '🚚 COD MY'
      const w = ctx.measureText(label).width + 30
      ctx.fillStyle = isClean ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.5)'
      roundRect(ctx, badgeX, badgeY, w, 38, 19)
      ctx.fill()
      ctx.fillStyle = isClean ? '#1B5E20' : '#FFFFFF'
      ctx.font = 'bold 16px -apple-system, sans-serif'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, badgeX + 14, badgeY + 19)
      ctx.textBaseline = 'top'
      badgeX += w + 12
    }

    // CTA arrow (urgency only)
    if (!isClean) {
      ctx.fillStyle = '#FFEB3B'
      ctx.font = 'bold 56px -apple-system, sans-serif'
      ctx.fillText('→', width - 80, height / 2 - 28)
    }

    // Very light JPEG artifact for native-banner feel
    addJpegNoise(ctx, width, height, 0.015, `promo-${params.variant}-${params.mainHeadline.slice(0, 10)}`)
  },
}

/** Wrap + draw a text block. Returns number of lines actually drawn. */
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  maxW: number,
  lineH: number,
): number {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const test = current ? `${current} ${w}` : w
    if (ctx.measureText(test).width > maxW && current) {
      lines.push(current)
      current = w
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    ctx.fillText(lines[i], x, y + i * lineH)
  }
  return Math.min(lines.length, 3)
}
