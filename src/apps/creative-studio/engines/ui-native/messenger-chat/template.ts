// ── Messenger Conversation Canvas Template (P5) ─────────────────────────────
//
// Renders a Facebook Messenger-style chat thread to an HTMLCanvasElement.
// Pure rendering — does NOT call Gemini or KIE. Different visual language
// from WhatsApp: white background, blue outgoing bubbles, small inline
// avatar on every incoming bubble (not just the header).
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
import { MESSENGER_LIGHT_2024 } from '../_shared/colors'
import { renderStatusBar } from '../_shared/statusBar'
import type { MessageTimeline } from '../_shared/timestamps'

export const MESSENGER_CONVERSATION_TEMPLATE: UINativeTemplate = {
  id: 'messenger-conversation-v1',
  platform: 'messenger',
  variant: 'testimonial-thread',
  canvasSize: { width: 1080, height: 1920 },
  theme: 'light',
  statusBarStyle: 'android',
  uiVintage: '2024',
}

export interface RenderInputs {
  text: UINativeTextContent
  timeline: MessageTimeline
  customerAvatarUrl: string
  /** P12 — accepted but not used (chat platform has single avatar). */
  avatarPool?: Map<number, string>
  /** P12 — locale for metadata strings. */
  locale?: import('../../../types/uiNative').UINativeLocale
  /** P12 — accepted but not used (no product thumb in messenger). */
  productImageUrl?: string
}

export async function renderMessengerConversation(
  inputs: RenderInputs,
): Promise<HTMLCanvasElement> {
  const palette = MESSENGER_LIGHT_2024
  const size = MESSENGER_CONVERSATION_TEMPLATE.canvasSize
  const { canvas, ctx } = createCanvas(size)

  // Background
  ctx.fillStyle = palette.conversationBg
  ctx.fillRect(0, 0, size.width, size.height)

  // Status bar — dark text on white background for Messenger header
  renderStatusBar(ctx, {
    style: 'android',
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

  // Subtle border under header
  ctx.fillStyle = '#E4E6EB'
  ctx.fillRect(0, headerY + headerH, size.width, 1)

  // Back arrow (left) — Messenger uses an angular chevron
  ctx.strokeStyle = '#0084FF'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(60, headerY + headerH / 2)
  ctx.lineTo(34, headerY + headerH / 2)
  ctx.moveTo(46, headerY + headerH / 2 - 14)
  ctx.lineTo(34, headerY + headerH / 2)
  ctx.lineTo(46, headerY + headerH / 2 + 14)
  ctx.stroke()

  // Centered avatar + name pair (Messenger style: avatar above name OR avatar left)
  const avatarRadius = 34
  const avatarCx = 110
  const avatarCy = headerY + headerH / 2
  try {
    const avatarImg = await loadImage(inputs.customerAvatarUrl)
    drawCircularAvatar(ctx, avatarImg, avatarCx, avatarCy, avatarRadius)
  } catch {
    ctx.fillStyle = '#BCC0C4'
    ctx.beginPath()
    ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  // Green online dot
  ctx.fillStyle = '#31A24C'
  ctx.beginPath()
  ctx.arc(avatarCx + avatarRadius - 6, avatarCy + avatarRadius - 6, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = palette.headerBg
  ctx.lineWidth = 3
  ctx.stroke()

  // Display name
  const displayName = inputs.text.participants[0].displayName
  ctx.fillStyle = palette.headerFg
  ctx.font = '600 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(displayName, avatarCx + avatarRadius + 22, avatarCy - 14)

  // "Active now" subtitle
  ctx.font = '400 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#65676B'
  ctx.fillText('Active now', avatarCx + avatarRadius + 22, avatarCy + 18)

  // Right side icons — phone + video + info dots
  ctx.strokeStyle = '#0084FF'
  ctx.lineWidth = 4
  drawMessengerGlyph(ctx, size.width - 200, headerY + headerH / 2, 'video')
  drawMessengerGlyph(ctx, size.width - 130, headerY + headerH / 2, 'phone')
  drawMessengerGlyph(ctx, size.width - 60,  headerY + headerH / 2, 'info')

  // Conversation area
  const convStartY = headerY + headerH + 1
  let cursor = convStartY + 30

  // Date / time small label (Messenger uses time-of-day stamps inline)
  ctx.fillStyle = palette.dateSeparatorFg
  ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${inputs.timeline.dateLabel} ${inputs.timeline.statusBarTime}`, size.width / 2, cursor)
  cursor += 50

  // Message bubbles
  const bubbleMaxW = size.width * 0.66
  const bubblePadX = 26
  const bubblePadY = 16
  const bubbleGap = 12
  const sideMargin = 30
  const inlineAvatarRadius = 22
  const inlineAvatarGap = 14

  ctx.font = '400 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

  // Pre-load small inline avatar (reused per incoming bubble)
  let inlineAvatarImg: HTMLImageElement | null = null
  try {
    inlineAvatarImg = await loadImage(inputs.customerAvatarUrl)
  } catch {
    inlineAvatarImg = null
  }

  for (let i = 0; i < inputs.text.items.length; i++) {
    const msg = inputs.text.items[i]
    const isOutgoing = msg.side === 'outgoing'
    const bubbleBg = isOutgoing ? palette.outgoingBubbleBg : palette.incomingBubbleBg
    const bubbleFg = isOutgoing ? palette.outgoingBubbleFg : palette.incomingBubbleFg

    const textMaxW = bubbleMaxW - bubblePadX * 2
    const lines = wrapText(ctx, msg.text, textMaxW)
    const lineH = 36
    const textBlockH = lines.length * lineH

    const bubbleW = Math.min(
      bubbleMaxW,
      Math.max(...lines.map((l) => ctx.measureText(l).width)) + bubblePadX * 2,
    )
    const bubbleH = textBlockH + bubblePadY * 2

    let bubbleX: number
    if (isOutgoing) {
      bubbleX = size.width - sideMargin - bubbleW
    } else {
      bubbleX = sideMargin + inlineAvatarRadius * 2 + inlineAvatarGap
    }

    // Render inline avatar only on the LAST consecutive incoming message
    // (Messenger convention — collapses repeated avatars in a sequence).
    const nextMsg = inputs.text.items[i + 1]
    const isLastInBurst = !isOutgoing && (!nextMsg || nextMsg.side === 'outgoing')
    if (isLastInBurst) {
      if (inlineAvatarImg) {
        drawCircularAvatar(
          ctx, inlineAvatarImg,
          sideMargin + inlineAvatarRadius,
          cursor + bubbleH - inlineAvatarRadius,
          inlineAvatarRadius,
        )
      } else {
        ctx.fillStyle = '#BCC0C4'
        ctx.beginPath()
        ctx.arc(sideMargin + inlineAvatarRadius, cursor + bubbleH - inlineAvatarRadius, inlineAvatarRadius, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    roundedRectPath(ctx, bubbleX, cursor, bubbleW, bubbleH, 20)
    ctx.fillStyle = bubbleBg
    ctx.fill()

    ctx.fillStyle = bubbleFg
    ctx.font = '400 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (let li = 0; li < lines.length; li++) {
      ctx.fillText(lines[li], bubbleX + bubblePadX, cursor + bubblePadY + li * lineH + 4)
    }

    cursor += bubbleH + bubbleGap

    // Add a tiny "Seen at HH:MM" line after the very last outgoing message
    const isLastMsg = i === inputs.text.items.length - 1
    if (isLastMsg && isOutgoing) {
      ctx.fillStyle = palette.bubbleMetaFg
      ctx.font = '400 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText(`Seen ${msg.timestamp}`, size.width - sideMargin, cursor)
      cursor += 30
    }

    if (cursor > size.height - 200) break
  }

  // Composer bar
  const composerH = 110
  const composerY = size.height - composerH
  ctx.fillStyle = palette.composerBg
  ctx.fillRect(0, composerY, size.width, composerH)
  // top border
  ctx.fillStyle = '#E4E6EB'
  ctx.fillRect(0, composerY, size.width, 1)

  // Left icons (camera + gallery + mic) — drawn as simple circles
  const leftIconY = composerY + composerH / 2
  ctx.fillStyle = '#0084FF'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(60 + i * 70, leftIconY, 20, 0, Math.PI * 2)
    ctx.fill()
  }

  // Input pill
  const pillX = 280
  const pillY = composerY + 18
  const pillW = size.width - pillX - 100
  const pillH = composerH - 36
  roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.fillStyle = palette.composerPlaceholder
  ctx.font = '400 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('Aa', pillX + 30, pillY + pillH / 2)

  // Like button (right) — thumb glyph
  ctx.fillStyle = '#0084FF'
  ctx.beginPath()
  ctx.arc(size.width - 60, leftIconY, 24, 0, Math.PI * 2)
  ctx.fill()

  return canvas
}

function drawMessengerGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  kind: 'video' | 'phone' | 'info',
): void {
  ctx.save()
  ctx.strokeStyle = '#0084FF'
  ctx.lineWidth = 3
  if (kind === 'video') {
    ctx.strokeRect(cx - 18, cy - 12, 28, 24)
    ctx.beginPath()
    ctx.moveTo(cx + 10, cy - 8)
    ctx.lineTo(cx + 22, cy - 14)
    ctx.lineTo(cx + 22, cy + 14)
    ctx.lineTo(cx + 10, cy + 8)
    ctx.closePath()
    ctx.stroke()
  } else if (kind === 'phone') {
    ctx.beginPath()
    ctx.arc(cx, cy, 16, Math.PI * 0.85, Math.PI * 1.35)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(cx, cy, 16, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy - 6, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#0084FF'
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx, cy - 2)
    ctx.lineTo(cx, cy + 8)
    ctx.stroke()
  }
  ctx.restore()
}
