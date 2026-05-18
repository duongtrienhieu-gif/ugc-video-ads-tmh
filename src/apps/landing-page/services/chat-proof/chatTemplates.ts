// ─────────────────────────────────────────────────────────────────────
// Chat templates — render the full chat screen (status bar + header +
// chat body + input bar) for each of the 5 platform variants.
//
// Every template is a single function taking:
//   - ctx           — canvas 2D context
//   - screenRect    — inner screen area (returned by phone frame draw)
//   - content       — ChatProofContent (header + messages + productCard)
//   - thumbImage    — pre-loaded product thumbnail (or null)
//
// The template returns nothing — it draws directly onto ctx, scoped to
// screenRect. Caller is responsible for clipping if they want overflow
// to respect the rounded screen corners.
// ─────────────────────────────────────────────────────────────────────

import {
  drawAvatar, fillRoundRect, roundRectPath, SYSTEM_FONT_STACK, wrapText,
} from './canvasUtils'
import { drawProductCard, PRODUCT_CARD_THEMES } from './productCard'
import type { ScreenRect } from './phoneFrames'
import type { ChatProofContent, ChatProofVariant } from './types'

// ──────────────────────────────────────────────────────────────────────
// Per-variant theme — colors / fonts / bubble shapes.
// ──────────────────────────────────────────────────────────────────────

interface VariantTheme {
  // Chat background
  chatBg: string
  // Header
  headerBg: string
  headerText: string
  headerStatusText: string
  // Bubbles
  incomingBg: string
  incomingText: string
  outgoingBg: string
  outgoingText: string
  // Status bar text color (over header)
  statusBarText: string
  // Input area
  inputBg: string
  inputFieldBg: string
  inputFieldText: string
  // Misc
  bubbleRadius: number
  // Status bar background fallback (if header doesn't extend)
  statusBarBg?: string
  // Header icon tint
  headerIconColor: string
  // Timestamp separator color
  timestampColor: string
}

const THEMES: Record<ChatProofVariant, VariantTheme> = {
  'whatsapp-ios': {
    chatBg: '#E4DDD2',
    headerBg: '#075E54',
    headerText: '#FFFFFF',
    headerStatusText: 'rgba(255,255,255,0.85)',
    incomingBg: '#FFFFFF',
    incomingText: '#111111',
    outgoingBg: '#DCF8C6',
    outgoingText: '#111111',
    statusBarText: '#FFFFFF',
    inputBg: '#F0F0F0',
    inputFieldBg: '#FFFFFF',
    inputFieldText: '#9A9A9A',
    bubbleRadius: 12,
    headerIconColor: '#FFFFFF',
    timestampColor: '#5F6B6F',
  },
  'whatsapp-android': {
    chatBg: '#0D1418',
    headerBg: '#1F2C34',
    headerText: '#E9EDEF',
    headerStatusText: 'rgba(233,237,239,0.78)',
    incomingBg: '#1F2C34',
    incomingText: '#E9EDEF',
    outgoingBg: '#005C4B',
    outgoingText: '#E9EDEF',
    statusBarText: '#E9EDEF',
    inputBg: '#1F2C34',
    inputFieldBg: '#2A3942',
    inputFieldText: '#7C8689',
    bubbleRadius: 14,
    headerIconColor: '#E9EDEF',
    timestampColor: '#7C8689',
  },
  'imessage-ios': {
    chatBg: '#FFFFFF',
    headerBg: '#F6F6F6',
    headerText: '#000000',
    headerStatusText: '#777777',
    incomingBg: '#E9E9EB',
    incomingText: '#0A0A0A',
    outgoingBg: '#1A8CFF',
    outgoingText: '#FFFFFF',
    statusBarText: '#000000',
    inputBg: '#FFFFFF',
    inputFieldBg: '#FFFFFF',
    inputFieldText: '#BBBBBB',
    bubbleRadius: 18,
    statusBarBg: '#FFFFFF',
    headerIconColor: '#0A84FF',
    timestampColor: '#9A9A9A',
  },
  'messenger-ios': {
    chatBg: '#FFFFFF',
    headerBg: '#FFFFFF',
    headerText: '#0A0A0A',
    headerStatusText: '#777777',
    incomingBg: '#F0F0F0',
    incomingText: '#0A0A0A',
    outgoingBg: '#0084FF',
    outgoingText: '#FFFFFF',
    statusBarText: '#000000',
    inputBg: '#FFFFFF',
    inputFieldBg: '#F0F0F0',
    inputFieldText: '#9A9A9A',
    bubbleRadius: 18,
    statusBarBg: '#FFFFFF',
    headerIconColor: '#0084FF',
    timestampColor: '#9A9A9A',
  },
  'messenger-android': {
    chatBg: '#FFFFFF',
    headerBg: '#FFFFFF',
    headerText: '#0A0A0A',
    headerStatusText: '#777777',
    incomingBg: '#F0F0F0',
    incomingText: '#0A0A0A',
    outgoingBg: '#0084FF',
    outgoingText: '#FFFFFF',
    statusBarText: '#000000',
    inputBg: '#FFFFFF',
    inputFieldBg: '#F0F0F0',
    inputFieldText: '#9A9A9A',
    bubbleRadius: 18,
    statusBarBg: '#FFFFFF',
    headerIconColor: '#0084FF',
    timestampColor: '#9A9A9A',
  },
}

// ──────────────────────────────────────────────────────────────────────
// Status bar (battery / wifi / signal / time) — top edge of every chat.
// ──────────────────────────────────────────────────────────────────────

function drawStatusBar(
  ctx: CanvasRenderingContext2D,
  rect: ScreenRect,
  theme: VariantTheme,
  variant: ChatProofVariant,
): void {
  const { x, statusBarY, width, statusBarHeight } = rect

  // Background — for iMessage / Messenger the status bar matches header bg
  if (theme.statusBarBg) {
    ctx.fillStyle = theme.statusBarBg
    ctx.fillRect(x, statusBarY, width, statusBarHeight)
  } else {
    ctx.fillStyle = theme.headerBg
    ctx.fillRect(x, statusBarY, width, statusBarHeight)
  }

  const isIos = variant.endsWith('-ios') || variant === 'imessage-ios'
  const textSize = Math.round(statusBarHeight * 0.42)
  ctx.fillStyle = theme.statusBarText
  ctx.font = `600 ${textSize}px ${SYSTEM_FONT_STACK}`
  ctx.textBaseline = 'middle'

  if (isIos) {
    // iOS: time on left, signal / wifi / battery on right
    ctx.textAlign = 'left'
    ctx.fillText('9:41', x + width * 0.085, statusBarY + statusBarHeight * 0.62)
    drawIosStatusIcons(ctx, x + width * 0.78, statusBarY + statusBarHeight * 0.62, statusBarHeight * 0.35, theme.statusBarText)
  } else {
    // Android: time on left, icons on far right (smaller)
    ctx.textAlign = 'left'
    ctx.fillText('9:41', x + width * 0.05, statusBarY + statusBarHeight * 0.55)
    drawAndroidStatusIcons(ctx, x + width * 0.78, statusBarY + statusBarHeight * 0.55, statusBarHeight * 0.32, theme.statusBarText)
  }
}

function drawIosStatusIcons(
  ctx: CanvasRenderingContext2D,
  startX: number, cy: number, height: number, color: string,
): void {
  // Signal bars
  ctx.fillStyle = color
  for (let i = 0; i < 4; i++) {
    const barH = height * (0.4 + i * 0.2)
    const bw = height * 0.18
    ctx.fillRect(startX + i * (bw + 2), cy + height / 2 - barH, bw, barH)
  }
  // Wifi (simplified — 3 arcs)
  const wifiX = startX + height * 1.8
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, height * 0.13)
  for (let i = 2; i >= 0; i--) {
    ctx.beginPath()
    ctx.arc(wifiX, cy + height * 0.3, height * (0.3 + i * 0.2), Math.PI * 1.25, Math.PI * 1.75)
    ctx.stroke()
  }
  // Battery body
  const batX = startX + height * 3.2
  const batW = height * 1.4
  const batH = height * 0.7
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, height * 0.07)
  ctx.strokeRect(batX, cy - batH / 2, batW, batH)
  ctx.fillStyle = color
  ctx.fillRect(batX + batW + 1, cy - batH * 0.25, height * 0.15, batH * 0.5)
  // Battery fill 65%
  ctx.fillRect(batX + 1.5, cy - batH / 2 + 1.5, (batW - 3) * 0.65, batH - 3)
  // Battery percentage text
  ctx.fillStyle = color
  ctx.font = `600 ${height * 0.55}px ${SYSTEM_FONT_STACK}`
  ctx.textAlign = 'right'
  ctx.fillText('65', batX - 4, cy + height * 0.05)
  ctx.textAlign = 'left'
}

function drawAndroidStatusIcons(
  ctx: CanvasRenderingContext2D,
  startX: number, cy: number, height: number, color: string,
): void {
  // Simplified — wifi triangle + battery
  ctx.fillStyle = color
  // Wifi triangle
  ctx.beginPath()
  ctx.moveTo(startX, cy + height * 0.4)
  ctx.lineTo(startX + height * 1.4, cy + height * 0.4)
  ctx.lineTo(startX + height * 0.7, cy - height * 0.4)
  ctx.closePath()
  ctx.fill()
  // Battery
  const batX = startX + height * 2.0
  const batW = height * 1.4
  const batH = height * 0.6
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, height * 0.08)
  ctx.strokeRect(batX, cy - batH / 2, batW, batH)
  ctx.fillRect(batX + 1.5, cy - batH / 2 + 1.5, (batW - 3) * 0.7, batH - 3)
}

// ──────────────────────────────────────────────────────────────────────
// Header — contact name + avatar + call icons. Drawn directly below the
// status bar. Returns Y position where chat body should begin.
// ──────────────────────────────────────────────────────────────────────

function drawHeader(
  ctx: CanvasRenderingContext2D,
  rect: ScreenRect,
  theme: VariantTheme,
  variant: ChatProofVariant,
  contactName: string,
  status: string | undefined,
): number {
  const { x, statusBarY, width, statusBarHeight, height } = rect
  const headerY = statusBarY + statusBarHeight
  const headerHeight = height * 0.075

  // Header bg
  ctx.fillStyle = theme.headerBg
  ctx.fillRect(x, headerY, width, headerHeight)

  // Bottom border (iMessage / Messenger)
  if (theme.statusBarBg) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.fillRect(x, headerY + headerHeight - 1, width, 1)
  }

  // Back chevron (left)
  const backX = x + width * 0.04
  const backY = headerY + headerHeight / 2
  ctx.strokeStyle = theme.headerIconColor
  ctx.lineWidth = Math.max(2, width * 0.006)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(backX + 8, backY - 8)
  ctx.lineTo(backX, backY)
  ctx.lineTo(backX + 8, backY + 8)
  ctx.stroke()

  // Avatar
  const avatarR = headerHeight * 0.36
  const avatarCx = x + width * 0.16
  const avatarCy = headerY + headerHeight / 2
  drawAvatar(ctx, avatarCx, avatarCy, avatarR, contactName)

  // Contact name
  const nameSize = Math.round(headerHeight * 0.28)
  ctx.fillStyle = theme.headerText
  ctx.font = `600 ${nameSize}px ${SYSTEM_FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const isCenteredHeader = variant === 'imessage-ios' || variant === 'messenger-ios'
  if (isCenteredHeader) {
    // iMessage centered name above avatar style is more complex — for
    // simplicity we still left-align after the avatar.
    ctx.fillText(contactName, avatarCx + avatarR + 12, avatarCy - (status ? nameSize * 0.4 : 0))
  } else {
    ctx.fillText(contactName, avatarCx + avatarR + 12, avatarCy - (status ? nameSize * 0.4 : 0))
  }

  if (status) {
    const statusSize = Math.round(headerHeight * 0.20)
    ctx.fillStyle = theme.headerStatusText
    ctx.font = `400 ${statusSize}px ${SYSTEM_FONT_STACK}`
    ctx.fillText(status, avatarCx + avatarR + 12, avatarCy + nameSize * 0.6)
  }

  // Right action icons — video + voice call (simplified glyphs)
  const iconCy = headerY + headerHeight / 2
  const iconSize = headerHeight * 0.28
  ctx.fillStyle = theme.headerIconColor
  ctx.strokeStyle = theme.headerIconColor
  ctx.lineWidth = Math.max(2, width * 0.005)
  // Video icon (rectangle + triangle)
  const vidX = x + width - width * 0.18
  fillRoundRect(ctx, vidX, iconCy - iconSize * 0.4, iconSize * 1.1, iconSize * 0.8, 3, theme.headerIconColor)
  ctx.fillStyle = theme.headerBg
  ctx.beginPath()
  ctx.moveTo(vidX + iconSize * 1.05, iconCy - iconSize * 0.25)
  ctx.lineTo(vidX + iconSize * 1.5, iconCy - iconSize * 0.5)
  ctx.lineTo(vidX + iconSize * 1.5, iconCy + iconSize * 0.5)
  ctx.lineTo(vidX + iconSize * 1.05, iconCy + iconSize * 0.25)
  ctx.closePath()
  ctx.fillStyle = theme.headerIconColor
  ctx.fill()

  // Phone icon (circle)
  const phX = x + width - width * 0.07
  ctx.fillStyle = theme.headerIconColor
  ctx.beginPath()
  ctx.arc(phX, iconCy, iconSize * 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = theme.headerBg
  ctx.beginPath()
  ctx.arc(phX, iconCy, iconSize * 0.22, 0, Math.PI * 2)
  ctx.fill()

  return headerY + headerHeight
}

// ──────────────────────────────────────────────────────────────────────
// Chat body — message bubbles + product card. Draws between chatBodyY
// and the input area (whose top is computed and reserved).
// ──────────────────────────────────────────────────────────────────────

function drawChatBody(
  ctx: CanvasRenderingContext2D,
  rect: ScreenRect,
  theme: VariantTheme,
  variant: ChatProofVariant,
  content: ChatProofContent,
  thumbImage: HTMLImageElement | null,
  chatBodyY: number,
  chatBodyHeight: number,
): void {
  const { x, width } = rect

  // Background
  ctx.fillStyle = theme.chatBg
  ctx.fillRect(x, chatBodyY, width, chatBodyHeight)

  // Light pattern for WhatsApp iOS (faint doodle texture imitation)
  if (variant === 'whatsapp-ios') {
    ctx.save()
    ctx.globalAlpha = 0.08
    ctx.fillStyle = '#8C7E66'
    let seed = 99
    for (let i = 0; i < 50; i++) {
      seed = (seed * 9301 + 49297) % 233280
      const px = x + (seed / 233280) * width
      seed = (seed * 9301 + 49297) % 233280
      const py = chatBodyY + (seed / 233280) * chatBodyHeight
      seed = (seed * 9301 + 49297) % 233280
      const r = (seed / 233280) * 6 + 3
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // Padding
  const horizontalPad = width * 0.04
  const verticalPad = width * 0.025
  const bubbleMaxWidth = width * 0.72
  const fontSize = Math.round(width * 0.042)
  const lineHeight = fontSize * 1.32
  const bubblePadX = width * 0.032
  const bubblePadY = width * 0.020
  const bubbleGap = width * 0.018

  // Start cursor from the top of chat body
  let cursorY = chatBodyY + verticalPad

  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  const drawBubble = (
    side: 'incoming' | 'outgoing',
    text: string,
    timestamp: string | undefined,
    hasTail: boolean,
  ) => {
    ctx.font = `400 ${fontSize}px ${SYSTEM_FONT_STACK}`
    const lines = wrapText(ctx, text, bubbleMaxWidth - bubblePadX * 2)
    const bubbleW = Math.min(
      bubbleMaxWidth,
      Math.max(...lines.map((l) => ctx.measureText(l).width)) + bubblePadX * 2,
    )
    const bubbleH = bubblePadY * 2 + lines.length * lineHeight

    const bubbleX = side === 'outgoing'
      ? x + width - horizontalPad - bubbleW
      : x + horizontalPad
    const bubbleY = cursorY

    const radius = theme.bubbleRadius
    const tailRadius = hasTail ? radius * 0.3 : radius
    const corner = side === 'outgoing'
      ? { tl: radius, tr: radius, br: tailRadius, bl: radius }
      : { tl: radius, tr: radius, br: radius, bl: tailRadius }

    fillRoundRect(
      ctx,
      bubbleX, bubbleY, bubbleW, bubbleH,
      corner,
      side === 'outgoing' ? theme.outgoingBg : theme.incomingBg,
    )

    // Tail squiggle for WhatsApp iOS
    if (hasTail && variant === 'whatsapp-ios') {
      const tailW = width * 0.018
      ctx.fillStyle = side === 'outgoing' ? theme.outgoingBg : theme.incomingBg
      ctx.beginPath()
      if (side === 'outgoing') {
        ctx.moveTo(bubbleX + bubbleW, bubbleY + bubbleH - 2)
        ctx.lineTo(bubbleX + bubbleW + tailW, bubbleY + bubbleH)
        ctx.lineTo(bubbleX + bubbleW, bubbleY + bubbleH)
      } else {
        ctx.moveTo(bubbleX, bubbleY + bubbleH - 2)
        ctx.lineTo(bubbleX - tailW, bubbleY + bubbleH)
        ctx.lineTo(bubbleX, bubbleY + bubbleH)
      }
      ctx.closePath()
      ctx.fill()
    }

    // Text
    ctx.fillStyle = side === 'outgoing' ? theme.outgoingText : theme.incomingText
    ctx.font = `400 ${fontSize}px ${SYSTEM_FONT_STACK}`
    let textY = bubbleY + bubblePadY
    for (const line of lines) {
      ctx.fillText(line, bubbleX + bubblePadX, textY)
      textY += lineHeight
    }

    // Timestamp inside bubble (WhatsApp style — bottom-right)
    if (timestamp && (variant === 'whatsapp-ios' || variant === 'whatsapp-android')) {
      const tsSize = Math.round(fontSize * 0.7)
      ctx.fillStyle = side === 'outgoing' ? 'rgba(0,0,0,0.4)' : theme.timestampColor
      ctx.font = `400 ${tsSize}px ${SYSTEM_FONT_STACK}`
      ctx.textAlign = 'right'
      ctx.fillText(timestamp, bubbleX + bubbleW - bubblePadX * 0.5, bubbleY + bubbleH - tsSize * 1.3)
      ctx.textAlign = 'left'
    }

    cursorY = bubbleY + bubbleH + bubbleGap
  }

  const drawTimestampSeparator = (label: string) => {
    const tsSize = Math.round(fontSize * 0.72)
    ctx.font = `500 ${tsSize}px ${SYSTEM_FONT_STACK}`
    const tw = ctx.measureText(label).width
    const padding = tsSize * 0.8
    const labelW = tw + padding * 2
    const labelH = tsSize * 1.8
    const labelX = x + (width - labelW) / 2
    cursorY += verticalPad * 0.4
    if (variant === 'whatsapp-ios' || variant === 'whatsapp-android') {
      fillRoundRect(ctx, labelX, cursorY, labelW, labelH, labelH / 2, variant === 'whatsapp-android' ? '#182229' : '#E1F2D5')
      ctx.fillStyle = variant === 'whatsapp-android' ? '#A1B2BB' : '#5F6B6F'
    } else {
      ctx.fillStyle = theme.timestampColor
    }
    ctx.textAlign = 'center'
    ctx.fillText(label, x + width / 2, cursorY + (labelH - tsSize) / 2)
    ctx.textAlign = 'left'
    cursorY += labelH + verticalPad * 0.5
  }

  // Optional opening timestamp (e.g. "Today 9:47 AM")
  const firstTs = content.messages[0]?.timestamp
  const headerTs = firstTs && /\b(today|hari|kelmarin|khamis|today)\b/i.test(firstTs)
    ? firstTs
    : (firstTs ? null : null)
  if (headerTs) drawTimestampSeparator(headerTs)

  for (let i = 0; i < content.messages.length; i++) {
    const msg = content.messages[i]
    const nextMsg = content.messages[i + 1]
    const sameSideNext = nextMsg && nextMsg.side === msg.side
    const showTail = !sameSideNext

    // Inline timestamp separator (if message has timestamp AND it's not
    // the one we already drew at the top)
    if (msg.timestamp && i > 0 && /[0-9]/.test(msg.timestamp) && !/AM|PM|:/.test(msg.timestamp ?? '')) {
      drawTimestampSeparator(msg.timestamp)
    }

    drawBubble(msg.side, msg.text, msg.timestamp, showTail)

    // Inject product card AFTER this message if specified
    if (content.productCard && content.productCardAfterIndex === i) {
      const card = content.productCard
      const cardWidth = bubbleMaxWidth
      const cardX = card.side === 'outgoing'
        ? x + width - horizontalPad - cardWidth
        : x + horizontalPad

      const theme = PRODUCT_CARD_THEMES[variant]
      const cardHeight = drawProductCard(ctx, cardX, cursorY, card, thumbImage, cardWidth, theme)
      cursorY += cardHeight + bubbleGap
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
// Input bar — bottom of the chat. Attachment icon + text field + mic.
// ──────────────────────────────────────────────────────────────────────

function drawInputBar(
  ctx: CanvasRenderingContext2D,
  rect: ScreenRect,
  theme: VariantTheme,
  variant: ChatProofVariant,
  inputY: number,
  inputHeight: number,
): void {
  const { x, width } = rect

  ctx.fillStyle = theme.inputBg
  ctx.fillRect(x, inputY, width, inputHeight)

  const fieldX = x + width * 0.13
  const fieldW = width * 0.74
  const fieldH = inputHeight * 0.55
  const fieldY = inputY + (inputHeight - fieldH) / 2

  // Field background
  fillRoundRect(ctx, fieldX, fieldY, fieldW, fieldH, fieldH / 2, theme.inputFieldBg)

  // iMessage uses a pill border
  if (variant === 'imessage-ios') {
    roundRectPath(ctx, fieldX, fieldY, fieldW, fieldH, fieldH / 2)
    ctx.strokeStyle = '#D1D1D6'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Placeholder text
  ctx.fillStyle = theme.inputFieldText
  const placeSize = Math.round(inputHeight * 0.22)
  ctx.font = `400 ${placeSize}px ${SYSTEM_FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const placeholder =
    variant === 'imessage-ios'      ? 'iMessage' :
    variant.startsWith('messenger') ? 'Aa'       :
    'Message'
  ctx.fillText(placeholder, fieldX + fieldH * 0.7, fieldY + fieldH / 2)

  // Plus / attachment icon (left)
  const plusCx = x + width * 0.07
  const plusCy = inputY + inputHeight / 2
  const plusR = inputHeight * 0.20
  ctx.strokeStyle = variant === 'imessage-ios' || variant.startsWith('messenger') ? theme.headerIconColor : '#7C8689'
  ctx.lineWidth = Math.max(2, width * 0.005)
  ctx.beginPath()
  ctx.arc(plusCx, plusCy, plusR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(plusCx - plusR * 0.4, plusCy)
  ctx.lineTo(plusCx + plusR * 0.4, plusCy)
  ctx.moveTo(plusCx, plusCy - plusR * 0.4)
  ctx.lineTo(plusCx, plusCy + plusR * 0.4)
  ctx.stroke()

  // Mic icon (right)
  const micCx = x + width - width * 0.07
  const micCy = inputY + inputHeight / 2
  ctx.fillStyle = variant.startsWith('whatsapp') ? '#7C8689' : theme.headerIconColor
  fillRoundRect(ctx, micCx - inputHeight * 0.08, micCy - inputHeight * 0.18, inputHeight * 0.16, inputHeight * 0.28, inputHeight * 0.08, ctx.fillStyle as string)

  // Home indicator (iOS only)
  if (variant.endsWith('-ios') || variant === 'imessage-ios') {
    const homeY = inputY + inputHeight + (rect.y + rect.height - inputY - inputHeight) * 0.55
    fillRoundRect(ctx, x + width * 0.34, homeY, width * 0.32, Math.max(3, width * 0.008), 100, '#0A0A0A')
  }
}

// ──────────────────────────────────────────────────────────────────────
// Public — drawChatScreen orchestrates the whole template.
// ──────────────────────────────────────────────────────────────────────

export function drawChatScreen(
  ctx: CanvasRenderingContext2D,
  rect: ScreenRect,
  variant: ChatProofVariant,
  content: ChatProofContent,
  thumbImage: HTMLImageElement | null,
): void {
  const theme = THEMES[variant]

  // Clip everything to the screen radius so corners stay round
  ctx.save()
  roundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, rect.screenRadius)
  ctx.clip()

  // Background fill
  ctx.fillStyle = theme.chatBg
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)

  drawStatusBar(ctx, rect, theme, variant)
  const headerBottom = drawHeader(ctx, rect, theme, variant, content.header.contactName, content.header.status)

  // Reserve input bar at the bottom
  const inputHeight = rect.height * 0.07
  const homeIndicatorReserve = (variant.endsWith('-ios') || variant === 'imessage-ios') ? rect.height * 0.025 : 0
  const inputY = rect.y + rect.height - inputHeight - homeIndicatorReserve
  const chatBodyHeight = inputY - headerBottom

  drawChatBody(ctx, rect, theme, variant, content, thumbImage, headerBottom, chatBodyHeight)
  drawInputBar(ctx, rect, theme, variant, inputY, inputHeight)

  ctx.restore()
}
