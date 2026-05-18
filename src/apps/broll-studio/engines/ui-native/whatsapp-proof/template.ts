// ── WhatsApp Conversation Canvas Template (P5) ──────────────────────────────
//
// Renders a WhatsApp-style chat thread to an HTMLCanvasElement. Pure
// rendering — does NOT call Gemini or KIE. Consumes a pre-generated
// UINativeTextContent + (optionally) a pre-generated avatar URL.
//
// Output: 9:16 portrait, 1080×1920 — matches a typical phone screenshot.
// Theme: WhatsApp light 2024 — observed in current Android/iOS builds.

import type { UINativeTextContent, UINativeTemplate } from '../../../types/uiNative'
import {
  createCanvas,
  loadImage,
  drawCircularAvatar,
  roundedRectPath,
  wrapText,
} from '../../../shared/canvas'
import { WHATSAPP_LIGHT_2024 } from '../_shared/colors'
import { renderStatusBar } from '../_shared/statusBar'
import type { MessageTimeline } from '../_shared/timestamps'

export const WHATSAPP_CONVERSATION_TEMPLATE: UINativeTemplate = {
  id: 'whatsapp-conversation-v1',
  platform: 'whatsapp',
  variant: 'testimonial-thread',
  canvasSize: { width: 1080, height: 1920 },
  theme: 'light',
  statusBarStyle: 'ios',
  uiVintage: '2024',
}

export interface RenderInputs {
  text: UINativeTextContent
  timeline: MessageTimeline
  /** Public URL of the customer (incoming) avatar image. */
  customerAvatarUrl: string
}

/** Render the full WhatsApp thread, returns the finished canvas. */
export async function renderWhatsAppConversation(
  inputs: RenderInputs,
): Promise<HTMLCanvasElement> {
  const palette = WHATSAPP_LIGHT_2024
  const size = WHATSAPP_CONVERSATION_TEMPLATE.canvasSize
  const { canvas, ctx } = createCanvas(size)

  // Background — conversation area
  ctx.fillStyle = palette.conversationBg
  ctx.fillRect(0, 0, size.width, size.height)

  // Status bar
  renderStatusBar(ctx, {
    style: 'ios',
    fg: palette.headerFg,
    bg: palette.headerBg,
    timeLabel: inputs.timeline.statusBarTime,
    width: size.width,
  })

  // Header
  const headerY = 44
  const headerH = 130
  ctx.fillStyle = palette.headerBg
  ctx.fillRect(0, headerY, size.width, headerH)

  // Back chevron (left)
  ctx.strokeStyle = palette.headerFg
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(50, headerY + headerH / 2 - 14)
  ctx.lineTo(28, headerY + headerH / 2)
  ctx.lineTo(50, headerY + headerH / 2 + 14)
  ctx.stroke()

  // Avatar
  const avatarRadius = 38
  const avatarCx = 110
  const avatarCy = headerY + headerH / 2
  try {
    const avatarImg = await loadImage(inputs.customerAvatarUrl)
    drawCircularAvatar(ctx, avatarImg, avatarCx, avatarCy, avatarRadius)
  } catch {
    // Fallback grey disc if avatar fails — better than crashing
    ctx.fillStyle = '#9AA5B1'
    ctx.beginPath()
    ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  // Display name
  const displayName = inputs.text.participants[0].displayName
  ctx.fillStyle = palette.headerFg
  ctx.font = '600 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(displayName, avatarCx + avatarRadius + 20, avatarCy - 14)

  // "online" subtitle
  ctx.font = '400 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)'
  ctx.fillText('online', avatarCx + avatarRadius + 20, avatarCy + 18)

  // Header icons (right) — call + video + menu glyphs (just simple icons)
  ctx.strokeStyle = palette.headerFg
  ctx.lineWidth = 3
  // video glyph (rectangle + triangle)
  drawSimpleGlyph(ctx, size.width - 200, headerY + headerH / 2, 'video')
  drawSimpleGlyph(ctx, size.width - 130, headerY + headerH / 2, 'phone')
  drawSimpleGlyph(ctx, size.width - 60,  headerY + headerH / 2, 'kebab')

  // Conversation area starts
  const convStartY = headerY + headerH
  let cursor = convStartY + 30

  // Date separator pill
  ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const dateText = inputs.timeline.dateLabel
  const dateW = ctx.measureText(dateText).width + 32
  const dateH = 36
  const dateX = (size.width - dateW) / 2
  roundedRectPath(ctx, dateX, cursor, dateW, dateH, dateH / 2)
  ctx.fillStyle = palette.dateSeparatorBg
  ctx.fill()
  ctx.fillStyle = palette.dateSeparatorFg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(dateText, size.width / 2, cursor + dateH / 2)
  cursor += dateH + 30

  // Message bubbles
  const bubbleMaxW = size.width * 0.72
  const bubblePadX = 24
  const bubblePadY = 16
  const bubbleGap = 18
  const sideMargin = 30

  ctx.font = '400 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

  for (let i = 0; i < inputs.text.items.length; i++) {
    const msg = inputs.text.items[i]
    const isOutgoing = msg.side === 'outgoing'
    const bubbleBg = isOutgoing ? palette.outgoingBubbleBg : palette.incomingBubbleBg
    const bubbleFg = isOutgoing ? palette.outgoingBubbleFg : palette.incomingBubbleFg

    const textMaxW = bubbleMaxW - bubblePadX * 2 - 90  // 90px reserved for timestamp
    const lines = wrapText(ctx, msg.text, textMaxW)
    const lineH = 36
    const textBlockH = lines.length * lineH

    const timestampStr = msg.timestamp
    const tsW = measureWithFont(ctx, timestampStr, '400 18px -apple-system, sans-serif')

    const bubbleW = Math.min(
      bubbleMaxW,
      Math.max(...lines.map((l) => ctx.measureText(l).width)) + bubblePadX * 2 + tsW + 30,
    )
    const bubbleH = textBlockH + bubblePadY * 2

    const bubbleX = isOutgoing
      ? size.width - sideMargin - bubbleW
      : sideMargin

    // Shadow tail effect — slight drop shadow under the bubble
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 1
    roundedRectPath(ctx, bubbleX, cursor, bubbleW, bubbleH, 14)
    ctx.fillStyle = bubbleBg
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // Bubble text
    ctx.fillStyle = bubbleFg
    ctx.font = '400 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (let li = 0; li < lines.length; li++) {
      ctx.fillText(lines[li], bubbleX + bubblePadX, cursor + bubblePadY + li * lineH + 4)
    }

    // Timestamp + read tick in bottom right of bubble
    ctx.font = '400 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.fillStyle = palette.bubbleMetaFg
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(timestampStr, bubbleX + bubbleW - bubblePadX - (isOutgoing ? 30 : 0), cursor + bubbleH - 8)
    if (isOutgoing) {
      drawBlueChecks(ctx, bubbleX + bubbleW - bubblePadX, cursor + bubbleH - 14)
    }

    cursor += bubbleH + bubbleGap
    if (cursor > size.height - 200) break  // out of room — stop rendering further bubbles
  }

  // Composer bar at bottom
  const composerH = 110
  const composerY = size.height - composerH
  ctx.fillStyle = palette.composerBg
  ctx.fillRect(0, composerY, size.width, composerH)

  // Input pill
  const pillX = 80
  const pillY = composerY + 18
  const pillW = size.width - pillX - 200
  const pillH = composerH - 36
  roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.fillStyle = palette.composerPlaceholder
  ctx.font = '400 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('Message', pillX + 30, pillY + pillH / 2)

  // Mic round button (right)
  const micCx = size.width - 90
  const micCy = composerY + composerH / 2
  ctx.fillStyle = palette.headerBg
  ctx.beginPath()
  ctx.arc(micCx, micCy, 36, 0, Math.PI * 2)
  ctx.fill()
  // mic glyph (just a pill + base line)
  ctx.fillStyle = '#FFFFFF'
  roundedRectPath(ctx, micCx - 7, micCy - 14, 14, 22, 6)
  ctx.fill()
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(micCx, micCy, 13, 0.1 * Math.PI, 0.9 * Math.PI)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(micCx, micCy + 13)
  ctx.lineTo(micCx, micCy + 22)
  ctx.stroke()

  return canvas
}

// ── Small glyph helpers (vector-only, no atomic AI) ─────────────────────

function measureWithFont(ctx: CanvasRenderingContext2D, txt: string, font: string): number {
  const saved = ctx.font
  ctx.font = font
  const w = ctx.measureText(txt).width
  ctx.font = saved
  return w
}

function drawSimpleGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  kind: 'video' | 'phone' | 'kebab',
): void {
  ctx.save()
  if (kind === 'video') {
    ctx.lineWidth = 3
    ctx.strokeRect(cx - 18, cy - 12, 28, 24)
    ctx.beginPath()
    ctx.moveTo(cx + 10, cy - 8)
    ctx.lineTo(cx + 22, cy - 14)
    ctx.lineTo(cx + 22, cy + 14)
    ctx.lineTo(cx + 10, cy + 8)
    ctx.closePath()
    ctx.stroke()
  } else if (kind === 'phone') {
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, 16, Math.PI * 0.85, Math.PI * 1.35)
    ctx.stroke()
  } else {
    ctx.lineWidth = 0
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath()
      ctx.arc(cx, cy + i * 10, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawBlueChecks(
  ctx: CanvasRenderingContext2D,
  rightX: number,
  baselineY: number,
): void {
  ctx.save()
  ctx.strokeStyle = '#53BDEB'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Two overlapping checks for "read" status
  for (let off = 0; off < 2; off++) {
    const x = rightX - off * 10
    ctx.beginPath()
    ctx.moveTo(x - 14, baselineY - 2)
    ctx.lineTo(x - 7, baselineY + 5)
    ctx.lineTo(x, baselineY - 8)
    ctx.stroke()
  }
  ctx.restore()
}
