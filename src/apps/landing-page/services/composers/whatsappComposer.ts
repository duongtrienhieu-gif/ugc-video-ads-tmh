// ── whatsappComposer.ts — Phase 3 first composer ──────────────────────────
//
// Renders a believable WhatsApp chat screenshot as a 4:5 canvas:
//   • Dark teal header bar (#075E54) with avatar + name + "tap untuk info"
//   • Cream chat wallpaper (WhatsApp default beige #ECE5DD)
//   • Receiver bubbles: white background, subtle shadow, left-aligned
//   • Sender bubbles: pale green (#DCF8C6), right-aligned, blue read receipts
//   • Bottom input bar with rounded text field + voice/send icons
//   • Slight noise texture so it doesn't look "too clean / vector-y"
//
// Replaces 4 AI renders per pack (~24 KIE credit) with 4 local Canvas
// renders (~50ms each, $0 cost).

import type { Composer } from '../templateEngine'
import { roundRect, wrapText, seededRand } from '../templateEngine'

// ── Params ──────────────────────────────────────────────────────────────────

/** A single chat message in the conversation. */
export interface WhatsappMessage {
  /** Who sent this message. Determines left/right alignment + bubble color. */
  side: 'incoming' | 'outgoing'
  /** Message body (Malay typically, but composer is language-agnostic). */
  text: string
  /** Timestamp like "10:42 PG" / "21:08". Always shown in bubble bottom-right. */
  timestamp: string
  /** Sender name to show above the bubble — used only in group chats. */
  senderName?: string
}

export interface WhatsappComposerParams {
  /** Chat partner / group name shown in header. */
  chatName: string
  /** Header subtitle. Default "online" / Malay "dalam talian". */
  subtitle?: string
  /** "👤 1-on-1" or "👥 group" — drives avatar shape + senderName visibility. */
  chatType: 'private' | 'group'
  /** Optional avatar emoji or single character — drawn as colored circle. */
  avatarSeed?: string
  /** 4-12 messages — the convo body. */
  messages: WhatsappMessage[]
}

// ── Drawing constants — extracted so they're easy to tune ──────────────────

const COLORS = {
  headerBg:       '#075E54',
  headerText:     '#FFFFFF',
  headerSub:      '#B8E6D9',
  chatBg:         '#ECE5DD',
  chatBgTexture:  '#E7DDD0',
  incomingBubble: '#FFFFFF',
  outgoingBubble: '#DCF8C6',
  messageText:    '#0F0F0F',
  timestamp:      '#667781',
  readReceipt:    '#4FC3F7',
  inputBarBg:     '#F0F0F0',
  inputFieldBg:   '#FFFFFF',
  divider:        'rgba(0,0,0,0.08)',
} as const

const FONTS = {
  // System font stack — works without bundling custom WA font.
  // Stays close to Helvetica Neue / Segoe UI / Roboto rendering.
  header:    'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headerSub: '500 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  groupName: 'bold 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  message:   '500 25px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  timestamp: '500 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  input:     '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as const

const LAYOUT = {
  // 4:5 → 800 × 1000 default. Scales proportionally for other sizes.
  statusBarH:  44,
  headerH:     94,
  avatarSize:  56,
  bubbleMaxW:  540,    // out of ~800 width
  bubbleRadius: 16,
  bubblePadX:  18,
  bubblePadY:  12,
  bubbleGap:   14,
  inputBarH:   84,
} as const

// ── Color picker for avatar circle ─────────────────────────────────────────

const AVATAR_PALETTE = [
  '#7CB342', '#26A69A', '#5C6BC0', '#EC407A', '#FF7043',
  '#AB47BC', '#42A5F5', '#FFA726', '#66BB6A', '#EF5350',
]

function pickAvatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0] ?? '').join('').toUpperCase()
}

// ── Drawing primitives ─────────────────────────────────────────────────────

function drawStatusBar(ctx: CanvasRenderingContext2D, w: number): void {
  // Mock iOS status bar — opaque dark gray for contrast
  ctx.fillStyle = '#054C44'
  ctx.fillRect(0, 0, w, LAYOUT.statusBarH)

  // Time on left
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('21:08', 28, LAYOUT.statusBarH / 2 + 2)

  // Battery + signal on right — simple shapes
  const rightX = w - 28
  // Battery rect
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 1.5
  ctx.strokeRect(rightX - 30, LAYOUT.statusBarH / 2 - 7, 26, 14)
  ctx.fillRect(rightX - 30, LAYOUT.statusBarH / 2 - 5, 18, 10) // partial fill
  // Battery nub
  ctx.fillRect(rightX - 2, LAYOUT.statusBarH / 2 - 3, 2, 6)
  // Signal bars (small)
  ctx.fillRect(rightX - 70, LAYOUT.statusBarH / 2 - 2, 3, 4)
  ctx.fillRect(rightX - 64, LAYOUT.statusBarH / 2 - 4, 3, 6)
  ctx.fillRect(rightX - 58, LAYOUT.statusBarH / 2 - 6, 3, 8)
  ctx.fillRect(rightX - 52, LAYOUT.statusBarH / 2 - 8, 3, 10)
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  w: number,
  yStart: number,
  params: WhatsappComposerParams,
): void {
  ctx.fillStyle = COLORS.headerBg
  ctx.fillRect(0, yStart, w, LAYOUT.headerH)

  // Back arrow
  ctx.strokeStyle = COLORS.headerText
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(28, yStart + LAYOUT.headerH / 2)
  ctx.lineTo(18, yStart + LAYOUT.headerH / 2 - 10)
  ctx.moveTo(28, yStart + LAYOUT.headerH / 2)
  ctx.lineTo(18, yStart + LAYOUT.headerH / 2 + 10)
  ctx.stroke()

  // Avatar circle
  const seedForAvatar = params.avatarSeed ?? params.chatName
  const avatarX = 48 + LAYOUT.avatarSize / 2
  const avatarY = yStart + LAYOUT.headerH / 2
  ctx.fillStyle = pickAvatarColor(seedForAvatar)
  ctx.beginPath()
  ctx.arc(avatarX, avatarY, LAYOUT.avatarSize / 2, 0, Math.PI * 2)
  ctx.fill()
  // Initials inside avatar
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(initials(params.chatName), avatarX, avatarY + 1)
  ctx.textAlign = 'left'

  // Name + subtitle (right of avatar)
  const textX = avatarX + LAYOUT.avatarSize / 2 + 18
  ctx.fillStyle = COLORS.headerText
  ctx.font = FONTS.header
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(params.chatName, textX, avatarY - 4)
  ctx.fillStyle = COLORS.headerSub
  ctx.font = FONTS.headerSub
  ctx.fillText(params.subtitle ?? 'dalam talian', textX, avatarY + 22)

  // Right side icons (video + call + 3-dot) — simple geometric stand-ins
  const rightX = w - 28
  ctx.fillStyle = COLORS.headerText
  // 3-dot menu
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(rightX - 4, avatarY - 14 + i * 14, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  // Call icon — rough handset shape
  ctx.lineWidth = 3.5
  ctx.strokeStyle = COLORS.headerText
  ctx.beginPath()
  ctx.moveTo(rightX - 56, avatarY - 12)
  ctx.lineTo(rightX - 44, avatarY - 14)
  ctx.lineTo(rightX - 38, avatarY + 4)
  ctx.lineTo(rightX - 52, avatarY + 18)
  ctx.stroke()
  // Video icon
  ctx.strokeRect(rightX - 100, avatarY - 12, 32, 20)
  ctx.beginPath()
  ctx.moveTo(rightX - 68, avatarY - 4)
  ctx.lineTo(rightX - 60, avatarY - 12)
  ctx.lineTo(rightX - 60, avatarY + 8)
  ctx.closePath()
  ctx.fillStyle = COLORS.headerText
  ctx.fill()
}

function drawChatBackground(
  ctx: CanvasRenderingContext2D,
  w: number, y: number, h: number,
  seedRng: () => number,
): void {
  ctx.fillStyle = COLORS.chatBg
  ctx.fillRect(0, y, w, h)

  // Subtle wallpaper texture — sparse dots, deterministic
  ctx.fillStyle = COLORS.chatBgTexture
  for (let i = 0; i < 320; i++) {
    const dx = seedRng() * w
    const dy = y + seedRng() * h
    const r = seedRng() * 1.2 + 0.4
    ctx.beginPath()
    ctx.arc(dx, dy, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawReadReceipt(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
): void {
  // Double check mark — WhatsApp blue ✓✓
  ctx.strokeStyle = COLORS.readReceipt
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // First check
  ctx.beginPath()
  ctx.moveTo(x, y + 2)
  ctx.lineTo(x + 3, y + 5)
  ctx.lineTo(x + 9, y - 2)
  ctx.stroke()
  // Second check (offset right)
  ctx.beginPath()
  ctx.moveTo(x + 5, y + 2)
  ctx.lineTo(x + 8, y + 5)
  ctx.lineTo(x + 14, y - 2)
  ctx.stroke()
}

function drawMessageBubble(
  ctx: CanvasRenderingContext2D,
  msg: WhatsappMessage,
  yStart: number,
  canvasW: number,
  showSenderName: boolean,
  isLastFromSide: boolean,
): number {
  const isOut = msg.side === 'outgoing'
  const bubbleColor = isOut ? COLORS.outgoingBubble : COLORS.incomingBubble

  // Layout: figure out wrapped text first to know bubble height
  ctx.font = FONTS.message
  const innerMaxW = LAYOUT.bubbleMaxW - LAYOUT.bubblePadX * 2 - 60 /* timestamp space */
  const lines = wrapText(ctx, msg.text, innerMaxW)
  const senderNameH = (showSenderName && msg.senderName && !isOut) ? 26 : 0
  const lineH = 32
  const textBlockH = lines.length * lineH
  const bubbleH = LAYOUT.bubblePadY * 2 + senderNameH + textBlockH + 6

  // Width: fit content but cap at bubbleMaxW
  const longestLine = lines.reduce((max, line) => {
    const w = ctx.measureText(line).width
    return w > max ? w : max
  }, 0)
  const senderW = senderNameH > 0 && msg.senderName ? ctx.measureText(msg.senderName).width : 0
  const timestampW = ctx.measureText(msg.timestamp).width + (isOut ? 22 : 0) /* +check icon space */
  const bubbleW = Math.min(
    LAYOUT.bubbleMaxW,
    Math.max(longestLine, senderW, 120) + LAYOUT.bubblePadX * 2 + timestampW + 10,
  )

  // Position — outgoing on right, incoming on left
  const x = isOut
    ? canvasW - bubbleW - 22
    : 22

  // Drop shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.08)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1
  ctx.fillStyle = bubbleColor
  roundRect(ctx, x, yStart, bubbleW, bubbleH, LAYOUT.bubbleRadius)
  ctx.fill()
  ctx.restore()

  // Bubble "tail" for last-in-streak messages
  if (isLastFromSide) {
    ctx.fillStyle = bubbleColor
    ctx.beginPath()
    if (isOut) {
      ctx.moveTo(x + bubbleW - 4, yStart + 4)
      ctx.lineTo(x + bubbleW + 8, yStart + 2)
      ctx.lineTo(x + bubbleW - 4, yStart + 18)
    } else {
      ctx.moveTo(x + 4, yStart + 4)
      ctx.lineTo(x - 8, yStart + 2)
      ctx.lineTo(x + 4, yStart + 18)
    }
    ctx.closePath()
    ctx.fill()
  }

  // Sender name (group chat, incoming only)
  let cursorY = yStart + LAYOUT.bubblePadY
  if (senderNameH > 0 && msg.senderName) {
    const senderColor = pickAvatarColor(msg.senderName)
    ctx.fillStyle = senderColor
    ctx.font = FONTS.groupName
    ctx.textBaseline = 'top'
    ctx.fillText(msg.senderName, x + LAYOUT.bubblePadX, cursorY)
    cursorY += senderNameH
  }

  // Message body lines
  ctx.fillStyle = COLORS.messageText
  ctx.font = FONTS.message
  ctx.textBaseline = 'top'
  for (const line of lines) {
    ctx.fillText(line, x + LAYOUT.bubblePadX, cursorY)
    cursorY += lineH
  }

  // Timestamp + read receipt (bottom-right, inside bubble)
  ctx.fillStyle = COLORS.timestamp
  ctx.font = FONTS.timestamp
  ctx.textBaseline = 'alphabetic'
  const tsY = yStart + bubbleH - 8
  const tsX = x + bubbleW - LAYOUT.bubblePadX - (isOut ? 24 : 0)
  ctx.textAlign = 'right'
  ctx.fillText(msg.timestamp, tsX, tsY)
  ctx.textAlign = 'left'

  if (isOut) {
    drawReadReceipt(ctx, x + bubbleW - LAYOUT.bubblePadX - 18, tsY - 4)
  }

  return yStart + bubbleH + LAYOUT.bubbleGap
}

function drawInputBar(ctx: CanvasRenderingContext2D, w: number, h: number, yStart: number): void {
  ctx.fillStyle = COLORS.inputBarBg
  ctx.fillRect(0, yStart, w, h)

  // Rounded text field (with emoji icon on left, attach + camera on right)
  const fieldX = 60
  const fieldW = w - 60 - 70
  const fieldY = yStart + (h - 56) / 2
  ctx.fillStyle = COLORS.inputFieldBg
  roundRect(ctx, fieldX, fieldY, fieldW, 56, 28)
  ctx.fill()

  // Emoji icon (smiley) inside field — circle + dots
  ctx.fillStyle = '#919191'
  ctx.beginPath()
  ctx.arc(20 + 12, yStart + h / 2, 14, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(20 + 12 - 5, yStart + h / 2 - 3, 2, 0, Math.PI * 2)
  ctx.arc(20 + 12 + 5, yStart + h / 2 - 3, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(20 + 12, yStart + h / 2 + 2, 6, 0, Math.PI)
  ctx.stroke()

  // Placeholder text
  ctx.fillStyle = '#919191'
  ctx.font = FONTS.input
  ctx.textBaseline = 'middle'
  ctx.fillText('Mesej', fieldX + 24, yStart + h / 2 + 2)

  // Mic icon (right of field, green circle)
  const micX = w - 38
  ctx.fillStyle = COLORS.headerBg
  ctx.beginPath()
  ctx.arc(micX, yStart + h / 2, 28, 0, Math.PI * 2)
  ctx.fill()
  // Mic shape
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(micX - 5, yStart + h / 2 - 12, 10, 16)
  roundRect(ctx, micX - 5, yStart + h / 2 - 12, 10, 16, 5)
  ctx.fill()
  ctx.fillRect(micX - 1, yStart + h / 2 + 5, 2, 6)
}

// ── Composer ───────────────────────────────────────────────────────────────

export const whatsappComposer: Composer<WhatsappComposerParams> = {
  id: 'whatsapp-chat',
  defaultSize: { width: 800, height: 1000 }, // 4:5

  async draw(ctx, params, { width, height }) {
    const rng = seededRand(params.chatName + params.messages.length)

    // Layers (top → bottom)
    drawStatusBar(ctx, width)
    drawHeader(ctx, width, LAYOUT.statusBarH, params)

    const chatY = LAYOUT.statusBarH + LAYOUT.headerH
    const chatH = height - chatY - LAYOUT.inputBarH
    drawChatBackground(ctx, width, chatY, chatH, rng)

    // Messages — top-down, oldest first
    let cursorY = chatY + 16
    for (let i = 0; i < params.messages.length; i++) {
      const msg = params.messages[i]
      const next = params.messages[i + 1]
      const isLastFromSide = !next || next.side !== msg.side
      const showSenderName = params.chatType === 'group'
      cursorY = drawMessageBubble(
        ctx, msg, cursorY, width, showSenderName, isLastFromSide,
      )
      // Bail if we'd overflow into the input bar
      if (cursorY > chatY + chatH - 60) break
    }

    drawInputBar(ctx, width, LAYOUT.inputBarH, height - LAYOUT.inputBarH)
  },
}

// ── DevTools test helper ───────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  const w = window as unknown as {
    __testWhatsappComposer?: (overrides?: Partial<WhatsappComposerParams>) => Promise<string>
  }
  // Lazy import to avoid pulling templateEngine into production bundles when
  // hybrid-render is disabled — the helper is only useful in dev anyway.
  w.__testWhatsappComposer = async (overrides) => {
    const { composeToBlob } = await import('../templateEngine')
    const params: WhatsappComposerParams = {
      chatName: 'Aisyah Rahman',
      subtitle: 'dalam talian',
      chatType: 'private',
      messages: [
        { side: 'incoming', text: 'Eh cuba tengok ni 🔥', timestamp: '21:02' },
        { side: 'incoming', text: 'Aku dah cuba sebulan, hilang 5kg', timestamp: '21:02' },
        { side: 'outgoing', text: 'Wait apa produk?', timestamp: '21:05' },
        { side: 'incoming', text: 'Tunggu aku hantar 😍', timestamp: '21:06' },
        { side: 'incoming', text: 'Yang ni la — selamat, halal, COD ada', timestamp: '21:07' },
        { side: 'outgoing', text: 'Ok aku try lah 🙏', timestamp: '21:08' },
      ],
      ...overrides,
    }
    const blob = await composeToBlob(whatsappComposer, params, { format: 'jpeg', quality: 0.85, pixelRatio: 2 })
    const url = URL.createObjectURL(blob)
    console.info('[whatsappComposer] preview blob URL (opens new tab):', url)
    if (typeof window !== 'undefined') window.open(url, '_blank')
    return url
  }
}
