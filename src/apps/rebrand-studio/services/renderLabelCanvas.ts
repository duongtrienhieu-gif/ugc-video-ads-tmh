// renderLabelCanvas — vẽ nhãn IN (mặt trước/sau) bằng canvas, kích thước THẬT
// (cm → px@300DPI), CHỮ NÉT (không nhờ AI nướng). Dùng palette khoá từ bản gốc
// + copy do Gemini sinh. Trả Blob để caller saveAsset → user tải đưa bên in.
//
// Không dùng ảnh AI làm nền (nhãn in cần sạch + chữ chuẩn); nền = palette.

import { cmToPx, type Market, type RebrandIdentity } from '../types'

export interface RenderLabelParams {
  side: 'front' | 'back'
  widthCm: number
  heightCm: number
  name: string
  identity: RebrandIdentity
  market: Market
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur)
      cur = w
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function fitFontSize(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, weight: string): number {
  let size = start
  while (size > 8) {
    ctx.font = `${weight} ${size}px sans-serif`
    if (ctx.measureText(text).width <= maxW) break
    size -= 1
  }
  return size
}

const SECTION_TITLES: Record<Market, { ing: string; use: string; caution: string; bonus: string }> = {
  vi: { ing: 'THÀNH PHẦN', use: 'CÁCH DÙNG', caution: 'LƯU Ý & BẢO QUẢN', bonus: 'TẶNG KÈM' },
  ms: { ing: 'INGREDIENTS', use: 'DIRECTIONS', caution: 'CAUTION & STORAGE', bonus: 'FREE GIFT' },
}

export async function renderLabel(params: RenderLabelParams): Promise<Blob> {
  const { side, widthCm, heightCm, name, identity, market } = params
  const W = cmToPx(widthCm)
  const H = cmToPx(heightCm)
  const P = identity.palette
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const u = H / 100 // đơn vị scale theo chiều cao

  // Nền + lề bleed (vẽ tràn) + đường cắt mảnh bên trong.
  ctx.fillStyle = P.bg
  ctx.fillRect(0, 0, W, H)
  const pad = Math.round(Math.min(W, H) * 0.06)
  const innerW = W - pad * 2

  if (side === 'front') {
    // Header band (primary) + brand name + tagline
    const headH = Math.round(H * 0.30)
    ctx.fillStyle = P.primary
    ctx.fillRect(0, 0, W, headH)
    ctx.textAlign = 'center'
    ctx.fillStyle = P.onColor
    const nameSize = fitFontSize(ctx, name.toUpperCase(), innerW, Math.round(headH * 0.42), 'bold')
    ctx.font = `bold ${nameSize}px sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(name.toUpperCase(), W / 2, headH * (identity.tagline ? 0.42 : 0.5))
    if (identity.tagline) {
      const tSize = fitFontSize(ctx, identity.tagline, innerW, Math.round(headH * 0.16), 'normal')
      ctx.font = `normal ${tSize}px sans-serif`
      ctx.fillText(identity.tagline, W / 2, headH * 0.74)
    }

    // Body — benefit bullets
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    let y = headH + Math.round(u * 6)
    const bSize = Math.max(10, Math.round(u * 5))
    for (const b of identity.benefits.slice(0, 3)) {
      ctx.font = `bold ${bSize}px sans-serif`
      ctx.fillStyle = P.accent
      ctx.fillText('✓', pad, y)
      ctx.fillStyle = P.primary
      ctx.font = `normal ${bSize}px sans-serif`
      const lines = wrapText(ctx, b, innerW - bSize * 2)
      for (const ln of lines) {
        ctx.fillText(ln, pad + bSize * 1.8, y)
        y += bSize * 1.35
      }
      y += bSize * 0.4
    }

    // Footer band (accent) — net weight + market tag
    const footH = Math.round(H * 0.14)
    ctx.fillStyle = P.accent
    ctx.fillRect(0, H - footH, W, footH)
    ctx.fillStyle = P.onColor
    ctx.textBaseline = 'middle'
    const fSize = Math.max(10, Math.round(footH * 0.34))
    ctx.font = `bold ${fSize}px sans-serif`
    ctx.textAlign = 'left'
    if (identity.netWeight) ctx.fillText(identity.netWeight, pad, H - footH / 2)
    ctx.textAlign = 'right'
    ctx.font = `normal ${Math.round(fSize * 0.8)}px sans-serif`
    ctx.fillText(market === 'vi' ? 'Sản xuất cho thị trường VN' : 'For Malaysia market', W - pad, H - footH / 2)
  } else {
    // BACK — brand name nhỏ + các section
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    let y = pad
    const T = SECTION_TITLES[market]
    ctx.fillStyle = P.primary
    const nameSize = Math.max(12, Math.round(u * 6))
    ctx.font = `bold ${nameSize}px sans-serif`
    ctx.fillText(name.toUpperCase(), pad, y)
    y += nameSize * 1.6

    const titleSize = Math.max(9, Math.round(u * 3.4))
    const bodySize = Math.max(9, Math.round(u * 3.2))
    const section = (title: string, body: string) => {
      if (!body) return
      ctx.fillStyle = P.primary
      ctx.font = `bold ${titleSize}px sans-serif`
      ctx.fillText(title, pad, y)
      y += titleSize * 1.4
      ctx.fillStyle = '#333333'
      ctx.font = `normal ${bodySize}px sans-serif`
      for (const ln of wrapText(ctx, body, innerW)) {
        ctx.fillText(ln, pad, y)
        y += bodySize * 1.35
      }
      y += bodySize * 0.8
    }
    section(T.ing, identity.ingredients)
    section(T.use, identity.usage)
    section(T.caution, identity.caution)

    // Footer net weight
    if (identity.netWeight) {
      ctx.fillStyle = P.primary
      ctx.font = `bold ${Math.max(10, Math.round(u * 4))}px sans-serif`
      ctx.textBaseline = 'bottom'
      ctx.fillText(identity.netWeight, pad, H - pad)
    }
  }

  // Đường cắt mảnh (giúp bên in canh) — viền trong sau lề bleed.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = Math.max(1, Math.round(u * 0.4))
  ctx.setLineDash([Math.round(u * 2), Math.round(u * 2)])
  ctx.strokeRect(pad / 2, pad / 2, W - pad, H - pad)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Xuất nhãn thất bại.'))), 'image/jpeg', 0.95)
  })
}
