// Infographic composer — multi-purpose. Single composer with subType.
// Replaces AI rendering for ingredient cards / mechanism diagrams / benefits
// grids / comparison tables / why-happens diagrams. All can be built from
// the pack's text content (bullets, copy, headline) + clean canvas layout.
//
// Subtypes:
//   • ingredient-cards   — colored card per ingredient with name + benefit
//   • mechanism          — numbered step diagram (1→2→3)
//   • benefits           — icon grid (3-7 benefits)
//   • comparison         — 2-column table us vs them
//   • why-happens        — labeled body diagram (heuristic icon arrangement)

import type { Composer } from '../templateEngine'
import { roundRect, wrapText, pickColorBySeed } from '../templateEngine'

export interface InfographicParams {
  subType: 'ingredient-cards' | 'mechanism' | 'benefits' | 'comparison' | 'why-happens'
  /** Section title — shown at top. */
  title: string
  /** Source text rows — for bullets/items. */
  items: string[]
  /** Optional emoji icons aligned 1:1 with items. */
  icons?: string[]
  /** Brand accent color. Default = ecommerce orange. */
  accentColor?: string
  /** Comparison-only: 2nd column items. */
  competitorItems?: string[]
}

const DEFAULT_ACCENT = '#FB8C00'  // warm Malaysia ecommerce orange

export const infographicComposer: Composer<InfographicParams> = {
  id: 'infographic',
  defaultSize: { width: 800, height: 800 }, // 1:1

  async draw(ctx, params, { width, height }) {
    // White bg
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    // Top brand strip
    const accent = params.accentColor ?? DEFAULT_ACCENT
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, width, 8)

    // ── Title block ───────────────────────────────────────────────────
    const padX = 32
    let cursorY = 30
    ctx.fillStyle = '#1A1A1A'
    ctx.font = 'bold 36px -apple-system, "Segoe UI", sans-serif'
    ctx.textBaseline = 'top'
    const titleLines = wrapText(ctx, params.title, width - padX * 2)
    for (const line of titleLines.slice(0, 2)) {
      ctx.fillText(line, padX, cursorY)
      cursorY += 44
    }
    // Underline accent
    ctx.fillStyle = accent
    ctx.fillRect(padX, cursorY + 4, 80, 5)
    cursorY += 32

    // Dispatch by subtype
    switch (params.subType) {
      case 'ingredient-cards':
        drawIngredientCards(ctx, params, cursorY, width, height, padX, accent)
        break
      case 'mechanism':
        drawMechanism(ctx, params, cursorY, width, height, padX, accent)
        break
      case 'benefits':
        drawBenefitsGrid(ctx, params, cursorY, width, height, padX, accent)
        break
      case 'comparison':
        drawComparison(ctx, params, cursorY, width, height, padX, accent)
        break
      case 'why-happens':
        drawWhyHappens(ctx, params, cursorY, width, height, padX, accent)
        break
    }
  },
}

// ── Sub-renderers ──────────────────────────────────────────────────────────

function drawIngredientCards(
  ctx: CanvasRenderingContext2D, params: InfographicParams,
  yStart: number, width: number, _height: number, padX: number, accent: string,
): void {
  const items = params.items.slice(0, 4)
  const cardW = (width - padX * 2 - 16) / 2
  const cardH = 220
  items.forEach((item, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = padX + col * (cardW + 16)
    const y = yStart + row * (cardH + 16)

    // Card bg
    ctx.fillStyle = '#F5F5F5'
    roundRect(ctx, x, y, cardW, cardH, 14)
    ctx.fill()
    // Accent top strip
    ctx.fillStyle = pickColorBySeed(item)
    roundRect(ctx, x, y, cardW, 6, 14)
    ctx.fill()

    // Icon circle
    const iconSize = 64
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(x + cardW / 2, y + 56, iconSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 32px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(params.icons?.[i] ?? '🌿', x + cardW / 2, y + 56)

    // Item text
    ctx.fillStyle = '#1A1A1A'
    ctx.font = 'bold 20px -apple-system, sans-serif'
    const lines = wrapText(ctx, item, cardW - 24)
    let textY = y + 110
    for (const line of lines.slice(0, 4)) {
      ctx.fillText(line, x + cardW / 2, textY)
      textY += 26
    }
    ctx.textAlign = 'left'
  })
}

function drawMechanism(
  ctx: CanvasRenderingContext2D, params: InfographicParams,
  yStart: number, width: number, _height: number, padX: number, accent: string,
): void {
  const steps = params.items.slice(0, 4)
  const stepH = 110
  steps.forEach((step, i) => {
    const y = yStart + i * (stepH + 12)
    // Step circle
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(padX + 36, y + stepH / 2, 32, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 28px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), padX + 36, y + stepH / 2 + 2)

    // Connecting line down to next step
    if (i < steps.length - 1) {
      ctx.strokeStyle = accent
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(padX + 36, y + stepH - 6)
      ctx.lineTo(padX + 36, y + stepH + 12)
      ctx.stroke()
    }

    // Step text
    ctx.fillStyle = '#1A1A1A'
    ctx.font = '500 20px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    const stepLines = wrapText(ctx, step, width - padX - 100)
    let textY = y + 30
    for (const line of stepLines.slice(0, 3)) {
      ctx.fillText(line, padX + 90, textY)
      textY += 26
    }
  })
}

function drawBenefitsGrid(
  ctx: CanvasRenderingContext2D, params: InfographicParams,
  yStart: number, width: number, _height: number, padX: number, accent: string,
): void {
  const items = params.items.slice(0, 6)
  const cols = items.length <= 4 ? 2 : 3
  const rows = Math.ceil(items.length / cols)
  const gap = 12
  const cardW = (width - padX * 2 - (cols - 1) * gap) / cols
  const cardH = 140
  items.forEach((item, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = padX + col * (cardW + gap)
    const y = yStart + row * (cardH + gap)

    // Bg gradient
    const grad = ctx.createLinearGradient(x, y, x + cardW, y + cardH)
    grad.addColorStop(0, '#FFFFFF')
    grad.addColorStop(1, '#FFF8E1')
    ctx.fillStyle = grad
    roundRect(ctx, x, y, cardW, cardH, 12)
    ctx.fill()
    ctx.strokeStyle = '#FFE082'
    ctx.lineWidth = 1
    ctx.stroke()

    // Big check icon
    ctx.fillStyle = accent
    ctx.font = 'bold 40px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(params.icons?.[i] ?? '✅', x + 36, y + cardH / 2)

    // Text
    ctx.fillStyle = '#1A1A1A'
    ctx.font = 'bold 18px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const lines = wrapText(ctx, item, cardW - 80)
    let textY = y + 28
    for (const line of lines.slice(0, rows > 2 ? 3 : 4)) {
      ctx.fillText(line, x + 72, textY)
      textY += 22
    }
  })
  // Use rows so eslint stays quiet
  void rows
}

function drawComparison(
  ctx: CanvasRenderingContext2D, params: InfographicParams,
  yStart: number, width: number, _height: number, padX: number, accent: string,
): void {
  const us = params.items.slice(0, 5)
  const them = (params.competitorItems ?? us.map(() => '—')).slice(0, 5)
  const colW = (width - padX * 2 - 16) / 2

  // Column headers
  ctx.fillStyle = '#2E7D32'
  roundRect(ctx, padX, yStart, colW, 56, 8)
  ctx.fill()
  ctx.fillStyle = '#C62828'
  roundRect(ctx, padX + colW + 16, yStart, colW, 56, 8)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 22px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Produk Kami', padX + colW / 2, yStart + 28)
  ctx.fillText('Lain', padX + colW + 16 + colW / 2, yStart + 28)

  // Rows
  const rowH = 60
  let rowY = yStart + 70
  for (let i = 0; i < Math.max(us.length, them.length); i++) {
    // Alternating bg
    if (i % 2 === 0) {
      ctx.fillStyle = '#FAFAFA'
      ctx.fillRect(padX, rowY, colW * 2 + 16, rowH)
    }

    // US — green checkmark
    ctx.fillStyle = '#2E7D32'
    ctx.font = 'bold 26px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✓', padX + 26, rowY + rowH / 2 + 2)
    ctx.fillStyle = '#1A1A1A'
    ctx.font = '500 17px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    const usLines = wrapText(ctx, us[i] ?? '—', colW - 50)
    ctx.fillText(usLines[0] ?? '', padX + 52, rowY + rowH / 2 + 2)

    // THEM — red X
    ctx.fillStyle = '#C62828'
    ctx.font = 'bold 24px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✗', padX + colW + 16 + 26, rowY + rowH / 2 + 2)
    ctx.fillStyle = '#999999'
    ctx.font = '500 17px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    const themLines = wrapText(ctx, them[i] ?? '—', colW - 50)
    ctx.fillText(themLines[0] ?? '', padX + colW + 16 + 52, rowY + rowH / 2 + 2)

    rowY += rowH
  }
  void accent
}

function drawWhyHappens(
  ctx: CanvasRenderingContext2D, params: InfographicParams,
  yStart: number, width: number, _height: number, padX: number, accent: string,
): void {
  const causes = params.items.slice(0, 4)
  // Concentric circles diagram — central problem, surrounded by causes
  const cx = width / 2
  const cy = yStart + 240

  // Center circle (problem)
  ctx.fillStyle = '#FF5252'
  ctx.beginPath()
  ctx.arc(cx, cy, 80, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 22px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('VẤN ĐỀ', cx, cy)

  // Cause circles around
  const radius = 200
  causes.forEach((cause, i) => {
    const angle = (Math.PI * 2 * i) / causes.length - Math.PI / 2
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius

    // Line from problem to cause
    ctx.strokeStyle = accent
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * 82, cy + Math.sin(angle) * 82)
    ctx.lineTo(x - Math.cos(angle) * 50, y - Math.sin(angle) * 50)
    ctx.stroke()

    // Cause circle
    ctx.fillStyle = pickColorBySeed(cause)
    ctx.beginPath()
    ctx.arc(x, y, 50, 0, Math.PI * 2)
    ctx.fill()
    // Number
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 24px -apple-system, sans-serif'
    ctx.fillText(String(i + 1), x, y)
    // Label below
    ctx.fillStyle = '#1A1A1A'
    ctx.font = '500 16px -apple-system, sans-serif'
    const labelLines = wrapText(ctx, cause, 180)
    ctx.fillText(labelLines[0] ?? '', x, y + 70)
  })
  void padX
}
