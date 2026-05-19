// ── WhatsApp Conversation Canvas Template (P12 authenticity refresh) ───────
//
// P12 changes:
//   • WHATSAPP_METRICS + WHATSAPP_TYPO (SF Pro Text stack)
//   • iPhone 15 Pro dynamic island chrome
//   • locale-aware presence ("đang hoạt động" / "online" / etc) +
//     "Đã xem HH:MM" stamp on last outgoing
//   • bubble proportions tightened to match real WA v23.x screenshots

import type { UINativeTextContent, UINativeTemplate, UINativeLocale } from '../../../types/uiNative'
import { createCanvas, loadImage, drawCircularAvatar, roundedRectPath, wrapText } from '../../../shared/canvas'
import { WHATSAPP_LIGHT_2024 } from '../_shared/colors'
import { WHATSAPP_METRICS } from '../_shared/platformMetrics'
import { WHATSAPP_TYPO, font } from '../_shared/platformTypography'
import { IPHONE_15_PRO, renderDeviceChrome } from '../_shared/deviceChrome'
import { findStrings, buildCadence } from '../_shared/conversationMetadata'
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
  customerAvatarUrl: string
  locale: UINativeLocale
}

export async function renderWhatsAppConversation(inputs: RenderInputs): Promise<HTMLCanvasElement> {
  const palette = WHATSAPP_LIGHT_2024
  const M = WHATSAPP_METRICS
  const T = WHATSAPP_TYPO
  const S = findStrings(inputs.locale)
  const size = WHATSAPP_CONVERSATION_TEMPLATE.canvasSize
  const { canvas, ctx } = createCanvas(size)

  // Conversation background (classic doodle base color)
  ctx.fillStyle = palette.conversationBg
  ctx.fillRect(0, 0, size.width, size.height)

  // iPhone 15 Pro chrome — dark teal status bar bg, white fg
  renderDeviceChrome(ctx, IPHONE_15_PRO, size.width, size.height, {
    statusBarBg: palette.headerBg,
    statusBarFg: palette.headerFg,
    timeLabel: inputs.timeline.statusBarTime,
  })

  // Header
  const headerY = IPHONE_15_PRO.statusBarHeight + IPHONE_15_PRO.safeAreaTop
  ctx.fillStyle = palette.headerBg
  ctx.fillRect(0, headerY, size.width, M.headerHeight)

  // Back chevron
  ctx.strokeStyle = palette.headerFg
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  const chevY = headerY + M.headerHeight / 2
  ctx.moveTo(50, chevY - 12); ctx.lineTo(28, chevY); ctx.lineTo(50, chevY + 12)
  ctx.stroke()

  // Avatar
  const ar = M.headerAvatarRadius
  const ax = 100
  const ay = chevY
  try {
    const img = await loadImage(inputs.customerAvatarUrl)
    drawCircularAvatar(ctx, img, ax, ay, ar)
  } catch {
    ctx.fillStyle = '#9AA5B1'
    ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill()
  }

  // Display name + presence
  const cadence = buildCadence(inputs.timeline.perMessage)
  ctx.fillStyle = palette.headerFg
  ctx.font = font(T, 'header')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(inputs.text.participants[0].displayName, ax + ar + 20, chevY - 12)

  ctx.font = font(T, 'meta')
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.fillText(cadence.presenceLabel(S), ax + ar + 20, chevY + 16)

  // Header icons right
  ctx.strokeStyle = palette.headerFg
  ctx.lineWidth = 2.6
  drawHeaderGlyph(ctx, size.width - 200, chevY, 'video')
  drawHeaderGlyph(ctx, size.width - 130, chevY, 'phone')
  drawHeaderGlyph(ctx, size.width - 60,  chevY, 'kebab')

  // Conversation area starts
  let cursor = headerY + M.headerHeight + 24

  // Date separator pill
  ctx.font = font(T, 'meta')
  const dateText = inputs.timeline.dateLabel
  const dateW = ctx.measureText(dateText).width + 28
  const dateH = 32
  const dateX = (size.width - dateW) / 2
  roundedRectPath(ctx, dateX, cursor, dateW, dateH, dateH / 2)
  ctx.fillStyle = palette.dateSeparatorBg
  ctx.fill()
  ctx.fillStyle = palette.dateSeparatorFg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(dateText, size.width / 2, cursor + dateH / 2)
  cursor += dateH + 24

  // Message bubbles
  const bubbleMaxW = size.width * M.bubbleMaxWidthFrac

  for (let i = 0; i < inputs.text.items.length; i++) {
    const msg = inputs.text.items[i]
    const isOutgoing = msg.side === 'outgoing'
    const bubbleBg = isOutgoing ? palette.outgoingBubbleBg : palette.incomingBubbleBg
    const bubbleFg = isOutgoing ? palette.outgoingBubbleFg : palette.incomingBubbleFg

    ctx.font = font(T, 'body')
    const textMaxW = bubbleMaxW - M.bubblePaddingX * 2 - 100
    const lines = wrapText(ctx, msg.text, textMaxW)
    const lh = T.bodySize * T.bodyLineHeight
    const textH = lines.length * lh

    ctx.font = font(T, 'meta')
    const tsW = ctx.measureText(msg.timestamp).width + 32

    const longest = lines.length ? Math.max(...lines.map((l) => { ctx.font = font(T, 'body'); return ctx.measureText(l).width })) : 0
    const bubbleW = Math.min(bubbleMaxW, longest + M.bubblePaddingX * 2 + tsW)
    const bubbleH = textH + M.bubblePaddingY * 2

    const bubbleX = isOutgoing
      ? size.width - M.sideMargin - bubbleW
      : M.sideMargin

    // Slight drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.06)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetY = 1
    roundedRectPath(ctx, bubbleX, cursor, bubbleW, bubbleH, M.bubbleRadius)
    ctx.fillStyle = bubbleBg
    ctx.fill()
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

    // Body
    ctx.fillStyle = bubbleFg
    ctx.font = font(T, 'body')
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (let li = 0; li < lines.length; li++) {
      ctx.fillText(lines[li], bubbleX + M.bubblePaddingX, cursor + M.bubblePaddingY + li * lh - 4)
    }

    // Timestamp + ticks
    ctx.font = font(T, 'meta')
    ctx.fillStyle = palette.bubbleMetaFg
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(msg.timestamp, bubbleX + bubbleW - M.bubblePaddingX - (isOutgoing ? 26 : 0), cursor + bubbleH - 6)
    if (isOutgoing) drawBlueChecks(ctx, bubbleX + bubbleW - M.bubblePaddingX, cursor + bubbleH - 12)

    cursor += bubbleH + M.bubbleGap
    // P51 — bubble cutoff is now raised by the iOS keyboard height so
    // bubbles stop above the composer-keyboard stack instead of running
    // into it. KEYBOARD_HEIGHT is defined below.
    if (cursor > size.height - M.footerHeight - KEYBOARD_HEIGHT - 80) break
  }

  // "Seen at HH:MM" on the last outgoing message
  const lastOut = [...inputs.text.items].reverse().find((m) => m.side === 'outgoing')
  if (lastOut) {
    ctx.fillStyle = palette.bubbleMetaFg
    ctx.font = font(T, 'meta')
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`${S.seen} ${cadence.seenAtLast}`, size.width - M.sideMargin, cursor)
  }

  // P51 — composer rises above the iOS keyboard. Real WhatsApp
  // screenshots taken mid-conversation include the open keyboard; the
  // empty band at the bottom of the canvas pre-P51 read as "fake — the
  // user wasn't actually typing", so the keyboard fills that gap.
  const composerY = size.height - M.footerHeight - KEYBOARD_HEIGHT - IPHONE_15_PRO.safeAreaBottom
  ctx.fillStyle = palette.composerBg
  ctx.fillRect(0, composerY, size.width, M.footerHeight)

  const pillX = 70
  const pillY = composerY + 18
  const pillW = size.width - pillX - 180
  const pillH = M.footerHeight - 36
  roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.fillStyle = palette.composerPlaceholder
  ctx.font = font(T, 'body')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(S.composerPlaceholder('whatsapp'), pillX + 26, pillY + pillH / 2)

  // Mic button
  const micCx = size.width - 80
  const micCy = composerY + M.footerHeight / 2
  ctx.fillStyle = palette.headerBg
  ctx.beginPath(); ctx.arc(micCx, micCy, 32, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  roundedRectPath(ctx, micCx - 6, micCy - 12, 12, 20, 6); ctx.fill()
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.2
  ctx.beginPath(); ctx.arc(micCx, micCy, 12, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(micCx, micCy + 12); ctx.lineTo(micCx, micCy + 20); ctx.stroke()

  // P51 — iOS QWERTY keyboard below the composer
  drawIOSKeyboard(ctx, {
    x: 0,
    y: composerY + M.footerHeight,
    width: size.width,
    height: KEYBOARD_HEIGHT,
    safeAreaBottom: IPHONE_15_PRO.safeAreaBottom,
  })

  return canvas
}

// ── P51 — iOS QWERTY keyboard (light theme, English layout) ────────────
//
// Rendered below the WhatsApp composer to give the impression that the
// screenshot was captured while the user was actively typing — the most
// common moment a real WhatsApp chat gets screenshotted for sharing.
// Pre-P51 the bottom ~150-700px was empty white space which gave the
// fake "scrolled-up chat with nothing happening" smell. The keyboard
// adds the missing authenticity beat.

const KEYBOARD_HEIGHT = 720

interface KeyboardInputs {
  x: number
  y: number
  width: number
  height: number
  safeAreaBottom: number
}

function drawIOSKeyboard(ctx: CanvasRenderingContext2D, k: KeyboardInputs): void {
  const { x, y, width, height, safeAreaBottom } = k
  // Backdrop — iOS keyboard pale gray
  ctx.fillStyle = '#D1D5DB'
  ctx.fillRect(x, y, width, height + safeAreaBottom)

  // Predictive text bar at top
  const predY = y + 8
  const predH = 64
  ctx.fillStyle = '#D1D5DB'
  ctx.fillRect(x, predY, width, predH)
  const predicts = ['hai', 'best', '👍']
  ctx.font = '500 26px -apple-system, BlinkMacSystemFont, "SF Pro Text", Helvetica, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < predicts.length; i++) {
    const colX = x + (width / 3) * (i + 0.5)
    if (i < predicts.length - 1) {
      // Vertical divider
      ctx.fillStyle = '#AEB3BA'
      ctx.fillRect(x + (width / 3) * (i + 1) - 1, predY + 14, 2, predH - 28)
    }
    ctx.fillStyle = '#1C1C1E'
    ctx.fillText(predicts[i], colX, predY + predH / 2)
  }

  // Key rows
  const keyTop = predY + predH + 14
  const keyAreaH = height - (keyTop - y) - 18
  const rowH = keyAreaH / 4 - 6
  const rowGap = 14

  const row1 = ['q','w','e','r','t','y','u','i','o','p']
  const row2 = ['a','s','d','f','g','h','j','k','l']
  const row3 = ['z','x','c','v','b','n','m']

  const keyW = (width - 22) / 10
  drawKeyRow(ctx, x + 11, keyTop,                        keyW, rowH, row1)
  drawKeyRow(ctx, x + 11 + keyW * 0.5, keyTop + rowH + rowGap, keyW, rowH, row2)

  // Row 3 with shift (left) + 7 letters + backspace (right)
  const r3Y = keyTop + (rowH + rowGap) * 2
  const sideW = keyW * 1.4
  drawSpecialKey(ctx, x + 11,           r3Y, sideW, rowH, '⇧')
  drawKeyRow   (ctx, x + 11 + sideW + 6, r3Y, keyW, rowH, row3)
  drawSpecialKey(ctx, x + width - 11 - sideW, r3Y, sideW, rowH, '⌫')

  // Bottom row: 123 / 🌐 / space (long) / return
  const r4Y = keyTop + (rowH + rowGap) * 3
  const bottomKeyW = keyW * 1.4
  const spaceW = width - 22 - bottomKeyW * 3 - 18
  drawSpecialKey(ctx, x + 11,                                r4Y, bottomKeyW, rowH, '123')
  drawSpecialKey(ctx, x + 11 + bottomKeyW + 6,               r4Y, bottomKeyW, rowH, '🌐')
  drawSpecialKey(ctx, x + 11 + (bottomKeyW + 6) * 2,         r4Y, spaceW,     rowH, 'space', '#FFFFFF', true)
  drawSpecialKey(ctx, x + width - 11 - bottomKeyW,           r4Y, bottomKeyW, rowH, 'return')

  // iOS home indicator centered in the safe-area-bottom
  const hiY = y + height + safeAreaBottom * 0.55
  ctx.fillStyle = '#1C1C1E'
  roundedRectPath(ctx, x + width / 2 - 70, hiY, 140, 5, 2.5)
  ctx.fill()
}

function drawKeyRow(
  ctx: CanvasRenderingContext2D,
  startX: number, y: number, keyW: number, keyH: number,
  letters: string[],
): void {
  const gap = 6
  const usableW = (letters.length * keyW) + (letters.length - 1) * gap
  // Start with no horizontal offset — caller positions startX precisely
  void usableW
  for (let i = 0; i < letters.length; i++) {
    const kx = startX + i * (keyW + gap)
    drawSpecialKey(ctx, kx, y, keyW, keyH, letters[i].toUpperCase())
  }
}

function drawSpecialKey(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string,
  fill: string = '#FFFFFF',
  isSpace: boolean = false,
): void {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.18)'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 2
  roundedRectPath(ctx, x, y, w, h, 10)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = '#1C1C1E'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (isSpace) {
    ctx.font = '500 24px -apple-system, sans-serif'
  } else if (label.length === 1) {
    ctx.font = '500 32px -apple-system, sans-serif'
  } else {
    ctx.font = '500 26px -apple-system, sans-serif'
  }
  ctx.fillText(label, x + w / 2, y + h / 2 + 1)
}

function drawHeaderGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, kind: 'video' | 'phone' | 'kebab') {
  ctx.save()
  if (kind === 'video') {
    ctx.strokeRect(cx - 16, cy - 10, 26, 20)
    ctx.beginPath(); ctx.moveTo(cx + 10, cy - 6); ctx.lineTo(cx + 22, cy - 12); ctx.lineTo(cx + 22, cy + 12); ctx.lineTo(cx + 10, cy + 6); ctx.closePath(); ctx.stroke()
  } else if (kind === 'phone') {
    ctx.beginPath(); ctx.arc(cx, cy, 14, Math.PI * 0.85, Math.PI * 1.35); ctx.stroke()
  } else {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.arc(cx, cy + i * 8, 2.6, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
}

function drawBlueChecks(ctx: CanvasRenderingContext2D, rightX: number, baselineY: number) {
  ctx.save()
  ctx.strokeStyle = '#53BDEB'
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let off = 0; off < 2; off++) {
    const x = rightX - off * 8
    ctx.beginPath()
    ctx.moveTo(x - 12, baselineY - 2); ctx.lineTo(x - 6, baselineY + 4); ctx.lineTo(x, baselineY - 7)
    ctx.stroke()
  }
  ctx.restore()
}
