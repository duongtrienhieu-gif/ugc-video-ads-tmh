// ── TikTok Comment Overlay Canvas Template (P12 authenticity refresh) ──────
//
// P12 changes:
//   • per-platform metrics (TIKTOK_COMMENT_METRICS) instead of inline numbers
//   • per-platform typography (TIKTOK_TYPO)
//   • iPhone 15 Pro device chrome (dynamic island + home indicator)
//   • locale-aware metadata strings (sort label, comment count, reply)
//   • multi-avatar pool — each unique commenter gets their own face

import type { UINativeTextContent, UINativeTemplate, UINativeLocale } from '../../../types/uiNative'
import { createCanvas, loadImage, drawCircularAvatar, roundedRectPath, wrapText } from '../../../shared/canvas'
import { TIKTOK_COMMENT_DARK_2024 } from '../_shared/colors'
import { TIKTOK_COMMENT_METRICS } from '../_shared/platformMetrics'
import { TIKTOK_TYPO, font } from '../_shared/platformTypography'
import { IPHONE_15_PRO, renderDeviceChrome } from '../_shared/deviceChrome'
import { readLikes, readIsReply } from '../_shared/textPayload'
import { findStrings, fakeMetric } from '../_shared/conversationMetadata'
import type { MessageTimeline } from '../_shared/timestamps'

export const TIKTOK_COMMENT_TEMPLATE: UINativeTemplate = {
  id: 'tiktok-comment-v1',
  platform: 'tiktok-comment',
  variant: 'comment-overlay',
  canvasSize: { width: 1080, height: 1920 },
  theme: 'dark',
  statusBarStyle: 'ios',
  uiVintage: '2024',
}

export interface RenderInputs {
  text: UINativeTextContent
  timeline: MessageTimeline
  customerAvatarUrl: string
  avatarPool?: Map<number, string>
  locale: UINativeLocale
}

export async function renderTikTokComments(inputs: RenderInputs): Promise<HTMLCanvasElement> {
  const palette = TIKTOK_COMMENT_DARK_2024
  const M = TIKTOK_COMMENT_METRICS
  const T = TIKTOK_TYPO
  const S = findStrings(inputs.locale)
  const size = TIKTOK_COMMENT_TEMPLATE.canvasSize
  const { canvas, ctx } = createCanvas(size)

  // Dark background
  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, 0, size.width, size.height)

  // Device chrome — dynamic island on top of dark video frame
  renderDeviceChrome(ctx, IPHONE_15_PRO, size.width, size.height, {
    statusBarBg: null,
    statusBarFg: '#FFFFFF',
    timeLabel: inputs.timeline.statusBarTime,
  })

  // Top — faint video peek frame (~22% of height)
  const videoPeekH = 380
  const videoY = IPHONE_15_PRO.statusBarHeight + IPHONE_15_PRO.safeAreaTop
  const grad = ctx.createLinearGradient(0, videoY, 0, videoY + videoPeekH)
  grad.addColorStop(0, '#1F1F25')
  grad.addColorStop(1, '#0A0A0D')
  ctx.fillStyle = grad
  ctx.fillRect(0, videoY, size.width, videoPeekH)

  drawRightRail(ctx, size.width - 90, videoY + 60, inputs.timeline.dateLabel)

  // Comment sheet
  const sheetY = videoY + videoPeekH
  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, sheetY, size.width, size.height - sheetY)

  // Drag handle
  roundedRectPath(ctx, size.width / 2 - 40, sheetY + 16, 80, 5, 2.5)
  ctx.fillStyle = palette.mutedFg
  ctx.fill()

  // Comments count — locale-aware
  ctx.fillStyle = palette.pageFg
  ctx.font = font(T, 'header')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const totalCommentCount = fakeMetric(`${inputs.timeline.dateLabel}_total`, 'large')
  ctx.fillText(S.commentsCount(totalCommentCount), size.width / 2, sheetY + 36)

  // Sort row
  ctx.font = font(T, 'meta')
  ctx.fillStyle = palette.pageFg
  ctx.textAlign = 'left'
  ctx.fillText(S.mostRelevant, M.sideMargin, sheetY + 110)
  ctx.textAlign = 'right'
  ctx.fillStyle = palette.mutedFg
  ctx.fillText(S.newest, size.width - M.sideMargin, sheetY + 110)

  ctx.fillStyle = palette.divider
  ctx.fillRect(0, sheetY + 152, size.width, 1)

  // Pre-load avatars from pool
  const avatarCache = new Map<number, HTMLImageElement | null>()
  const uniqueAuthors = new Set(inputs.text.items.map((c) => c.authorIdx))
  const poolSize = inputs.avatarPool?.size ?? 0
  for (const idx of uniqueAuthors) {
    const url = (poolSize > 0
      ? inputs.avatarPool!.get(idx % poolSize)
      : inputs.customerAvatarUrl) ?? inputs.customerAvatarUrl
    avatarCache.set(idx, await loadImageSafe(url))
  }

  // Comment list
  let cursor = sheetY + 178
  const cutoffY = size.height - M.footerHeight - 30

  for (let i = 0; i < inputs.text.items.length; i++) {
    const c = inputs.text.items[i]
    const author = inputs.text.participants[c.authorIdx]
    const displayName = author?.displayName ?? 'user'
    const avatar = avatarCache.get(c.authorIdx) ?? null
    cursor = drawTikTokComment(ctx, {
      palette, metrics: M, typo: T, strings: S,
      width: size.width,
      startY: cursor,
      displayName,
      body: c.text,
      timestamp: c.timestamp,
      likes: readLikes(c),
      isReply: readIsReply(c),
      avatarImg: avatar,
    })
    if (cursor > cutoffY) break
  }

  drawComposer(ctx, {
    palette, typo: T, strings: S,
    width: size.width,
    yOffset: size.height - M.footerHeight - IPHONE_15_PRO.safeAreaBottom,
    height: M.footerHeight,
    primaryAvatar: avatarCache.get(0) ?? null,
  })

  return canvas
}

// ── Helpers ────────────────────────────────────────────────────────────

interface CommentInputs {
  palette: typeof TIKTOK_COMMENT_DARK_2024
  metrics: typeof TIKTOK_COMMENT_METRICS
  typo: typeof TIKTOK_TYPO
  strings: ReturnType<typeof findStrings>
  width: number
  startY: number
  displayName: string
  body: string
  timestamp: string
  likes: number
  isReply: boolean
  avatarImg: HTMLImageElement | null
}

function drawTikTokComment(ctx: CanvasRenderingContext2D, i: CommentInputs): number {
  const { palette, metrics: M, typo: T, strings: S, width, startY,
          displayName, body, timestamp, likes, isReply, avatarImg } = i

  const indentX = isReply ? 80 : 0
  const avatarRadius = isReply ? M.inlineAvatarRadius * 0.78 : M.inlineAvatarRadius
  const avatarCx = M.sideMargin + indentX + avatarRadius
  const avatarCy = startY + avatarRadius

  if (avatarImg) {
    drawCircularAvatar(ctx, avatarImg, avatarCx, avatarCy, avatarRadius)
  } else {
    ctx.fillStyle = palette.divider
    ctx.beginPath()
    ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  const textX = avatarCx + avatarRadius + 14
  const textMaxW = width - textX - 110

  ctx.fillStyle = palette.mutedFg
  ctx.font = font(T, 'name')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(displayName, textX, startY)

  ctx.fillStyle = palette.pageFg
  ctx.font = font(T, 'body')
  const lines = wrapText(ctx, body, textMaxW)
  const lh = T.bodySize * T.bodyLineHeight
  for (let li = 0; li < lines.length; li++) {
    ctx.fillText(lines[li], textX, startY + 28 + li * lh)
  }
  const bodyBottom = startY + 28 + lines.length * lh

  // Action row: timestamp · Reply
  ctx.fillStyle = palette.mutedFg
  ctx.font = font(T, 'meta')
  ctx.fillText(timestamp, textX, bodyBottom + 6)
  ctx.fillText(S.reply, textX + 92, bodyBottom + 6)

  // Right column: outlined heart + count
  const heartCx = width - 48
  const heartCy = startY + 28
  drawHeartOutline(ctx, heartCx, heartCy, 14, palette.mutedFg)
  if (likes > 0) {
    ctx.fillStyle = palette.mutedFg
    ctx.font = font(T, 'meta')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(formatCount(likes), heartCx, heartCy + 22)
  }

  return bodyBottom + M.bubbleGap + 16
}

function drawHeartOutline(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = 2.2
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy + r * 0.55)
  ctx.bezierCurveTo(cx - r * 1.18, cy - r * 0.4, cx - r * 0.55, cy - r * 1.32, cx, cy - r * 0.42)
  ctx.bezierCurveTo(cx + r * 0.55, cy - r * 1.32, cx + r * 1.18, cy - r * 0.4, cx, cy + r * 0.55)
  ctx.closePath()
  ctx.stroke()
}

function drawRightRail(ctx: CanvasRenderingContext2D, x: number, y: number, dateLabelSeed: string) {
  ctx.save()
  ctx.fillStyle = '#FE2C55'
  ctx.beginPath()
  ctx.moveTo(x, y + 30)
  ctx.bezierCurveTo(x - 34, y - 8, x - 16, y - 34, x, y - 8)
  ctx.bezierCurveTo(x + 16, y - 34, x + 34, y - 8, x, y + 30)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 18px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(formatCount(fakeMetric(`${dateLabelSeed}_heart`, 'large')), x, y + 48)

  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y + 130, 24, Math.PI * 0.15, Math.PI * 1.85)
  ctx.lineTo(x - 10, y + 160)
  ctx.lineTo(x + 4, y + 150)
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(formatCount(fakeMetric(`${dateLabelSeed}_cmt`, 'medium')), x, y + 174)

  ctx.beginPath()
  ctx.moveTo(x - 16, y + 240)
  ctx.lineTo(x + 16, y + 250)
  ctx.lineTo(x - 16, y + 260)
  ctx.closePath()
  ctx.stroke()
  ctx.fillText('Share', x, y + 274)
  ctx.restore()
}

function drawComposer(ctx: CanvasRenderingContext2D, i: {
  palette: typeof TIKTOK_COMMENT_DARK_2024
  typo: typeof TIKTOK_TYPO
  strings: ReturnType<typeof findStrings>
  width: number
  yOffset: number
  height: number
  primaryAvatar: HTMLImageElement | null
}) {
  const { palette, typo: T, strings: S, width, yOffset, height, primaryAvatar } = i
  ctx.fillStyle = palette.composerBg
  ctx.fillRect(0, yOffset, width, height)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, yOffset, width, 1)

  const cy = yOffset + height / 2
  const ax = 60
  if (primaryAvatar) {
    drawCircularAvatar(ctx, primaryAvatar, ax, cy, 28)
  } else {
    ctx.fillStyle = palette.divider
    ctx.beginPath()
    ctx.arc(ax, cy, 28, 0, Math.PI * 2)
    ctx.fill()
  }

  const pillX = 110, pillY = yOffset + 26, pillW = width - pillX - 50, pillH = height - 52
  roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2)
  ctx.fillStyle = '#1E1E22'
  ctx.fill()

  ctx.fillStyle = palette.composerPlaceholder
  ctx.font = font(T, 'body')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(S.composerPlaceholder('tiktok-comment'), pillX + 24, pillY + pillH / 2)

  ctx.textAlign = 'right'
  ctx.fillText('@  #  😊', pillX + pillW - 24, pillY + pillH / 2)
}

async function loadImageSafe(url: string): Promise<HTMLImageElement | null> {
  try { return await loadImage(url) } catch { return null }
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}
