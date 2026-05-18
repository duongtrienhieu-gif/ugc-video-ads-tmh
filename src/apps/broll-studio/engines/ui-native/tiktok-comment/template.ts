// ── TikTok Comment Overlay Canvas Template (P6) ─────────────────────────────
//
// Renders the TikTok comment-section overlay that slides up over a video.
// Pure dark theme — black background, white text, pink heart accents.
// Comments are flat list (no reply nesting in this MVP — TikTok shows
// reply count instead).
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
import { TIKTOK_COMMENT_DARK_2024 } from '../_shared/colors'
import { renderStatusBar } from '../_shared/statusBar'
import { readLikes, readIsReply } from '../_shared/textPayload'
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
  /** Single shared commenter avatar — reused for all commenters. */
  commenterAvatarUrl: string
}

export async function renderTikTokComments(
  inputs: RenderInputs,
): Promise<HTMLCanvasElement> {
  const palette = TIKTOK_COMMENT_DARK_2024
  const size = TIKTOK_COMMENT_TEMPLATE.canvasSize
  const { canvas, ctx } = createCanvas(size)

  // Dark background
  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, 0, size.width, size.height)

  // Status bar — white on black
  renderStatusBar(ctx, {
    style: 'ios',
    fg: '#FFFFFF',
    bg: palette.pageBg,
    timeLabel: inputs.timeline.statusBarTime,
    width: size.width,
  })

  // Top — a faint video peek frame (~25% of height) so the comment
  // overlay context is obvious
  const videoPeekH = 380
  const videoY = 44
  ctx.fillStyle = '#1A1A1F'
  ctx.fillRect(0, videoY, size.width, videoPeekH)

  // Mock video gradient
  const grad = ctx.createLinearGradient(0, videoY, 0, videoY + videoPeekH)
  grad.addColorStop(0, '#1F1F25')
  grad.addColorStop(1, '#0A0A0D')
  ctx.fillStyle = grad
  ctx.fillRect(0, videoY, size.width, videoPeekH)

  // Right rail icons (heart / comment / share — TikTok hallmark)
  drawRightRailIcons(ctx, size.width - 110, videoY + 60, palette)

  // ── Comment sheet handle + count label ────────────────────────────
  const sheetY = videoY + videoPeekH
  const sheetH = size.height - sheetY - 140  // leave room for composer
  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, sheetY, size.width, sheetH)

  // Drag handle
  roundedRectPath(ctx, size.width / 2 - 40, sheetY + 16, 80, 6, 3)
  ctx.fillStyle = palette.mutedFg
  ctx.fill()

  // Count + sort label
  ctx.fillStyle = palette.pageFg
  ctx.font = '600 30px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(
    `${inputs.text.items.length + 1.4 | 0}k comments`,
    size.width / 2,
    sheetY + 40,
  )

  // Sort row
  ctx.fillStyle = palette.mutedFg
  ctx.font = '500 22px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('Most relevant', 50, sheetY + 110)
  ctx.textAlign = 'right'
  ctx.fillText('Newest', size.width - 50, sheetY + 110)

  // Divider
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, sheetY + 155, size.width, 1)

  // ── Comment list ──────────────────────────────────────────────────
  let cursor = sheetY + 180
  const commenterImg = await loadImageSafe(inputs.commenterAvatarUrl)
  const cutoffY = size.height - 200

  for (let i = 0; i < inputs.text.items.length; i++) {
    const c = inputs.text.items[i]
    cursor = await drawTikTokComment(ctx, {
      palette,
      width: size.width,
      startY: cursor,
      displayName: inputs.text.participants[c.authorIdx]?.displayName ?? 'user',
      body: c.text,
      timestamp: c.timestamp,
      likes: readLikes(c),
      isReply: readIsReply(c),
      avatarImg: commenterImg,
    })
    if (cursor > cutoffY) break
  }

  // ── Composer ──────────────────────────────────────────────────────
  const composerH = 140
  const composerY = size.height - composerH
  ctx.fillStyle = palette.composerBg
  ctx.fillRect(0, composerY, size.width, composerH)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, composerY, size.width, 1)

  // Avatar (left)
  const myAvatarCx = 70
  const myAvatarCy = composerY + composerH / 2
  if (commenterImg) {
    drawCircularAvatar(ctx, commenterImg, myAvatarCx, myAvatarCy, 30)
  } else {
    ctx.fillStyle = palette.divider
    ctx.beginPath()
    ctx.arc(myAvatarCx, myAvatarCy, 30, 0, Math.PI * 2)
    ctx.fill()
  }

  // Input pill
  const pillX = 130
  const pillY = composerY + 30
  const pillW = size.width - pillX - 50
  const pillH = composerH - 60
  roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2)
  ctx.fillStyle = '#1E1E22'
  ctx.fill()

  ctx.fillStyle = palette.composerPlaceholder
  ctx.font = '400 26px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('Add comment...', pillX + 28, pillY + pillH / 2)

  // Right side glyph trio (@ # emoji)
  ctx.fillStyle = palette.composerPlaceholder
  ctx.font = '400 26px -apple-system, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('@  #  😊', pillX + pillW - 30, pillY + pillH / 2)

  return canvas
}

// ── Helpers ────────────────────────────────────────────────────────────

interface CommentInputs {
  palette: typeof TIKTOK_COMMENT_DARK_2024
  width: number
  startY: number
  displayName: string
  body: string
  timestamp: string
  likes: number
  isReply: boolean
  avatarImg: HTMLImageElement | null
}

async function drawTikTokComment(
  ctx: CanvasRenderingContext2D,
  inputs: CommentInputs,
): Promise<number> {
  const { palette, width, startY, displayName, body, timestamp, likes, isReply, avatarImg } = inputs

  const padX = 30
  const indentX = isReply ? 90 : 0
  const avatarRadius = isReply ? 22 : 28
  const avatarCx = padX + indentX + avatarRadius
  const avatarCy = startY + avatarRadius

  if (avatarImg) {
    drawCircularAvatar(ctx, avatarImg, avatarCx, avatarCy, avatarRadius)
  } else {
    ctx.fillStyle = palette.divider
    ctx.beginPath()
    ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  const textX = avatarCx + avatarRadius + 18
  const textMaxW = width - textX - 120  // 120 reserved for right heart column

  // Display name + body — TikTok wraps name+body together
  ctx.fillStyle = palette.mutedFg
  ctx.font = '500 22px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(displayName, textX, startY)

  ctx.fillStyle = palette.pageFg
  ctx.font = '400 26px -apple-system, sans-serif'
  const lines = wrapText(ctx, body, textMaxW)
  const lineH = 34
  for (let li = 0; li < lines.length; li++) {
    ctx.fillText(lines[li], textX, startY + 30 + li * lineH)
  }

  const bodyBottomY = startY + 30 + lines.length * lineH

  // Action row (timestamp + Reply)
  ctx.fillStyle = palette.mutedFg
  ctx.font = '500 22px -apple-system, sans-serif'
  ctx.fillText(`${timestamp}`, textX, bodyBottomY + 6)
  ctx.fillText('Reply', textX + 110, bodyBottomY + 6)

  // Heart icon + count (right column)
  const heartCx = width - 50
  const heartCy = startY + 30
  ctx.fillStyle = palette.likeAccent
  drawHeartOutline(ctx, heartCx, heartCy, 16, palette.mutedFg)
  if (likes > 0) {
    ctx.fillStyle = palette.mutedFg
    ctx.font = '500 22px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(formatTikTokCount(likes), heartCx, heartCy + 28)
  }

  return bodyBottomY + 50
}

function drawHeartOutline(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  strokeColor: string,
): void {
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(cx, cy + r * 0.6)
  ctx.bezierCurveTo(cx - r * 1.2, cy - r * 0.4, cx - r * 0.6, cy - r * 1.4, cx, cy - r * 0.4)
  ctx.bezierCurveTo(cx + r * 0.6, cy - r * 1.4, cx + r * 1.2, cy - r * 0.4, cx, cy + r * 0.6)
  ctx.closePath()
  ctx.stroke()
}

function drawRightRailIcons(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: { mutedFg: string; likeAccent: string },
): void {
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 3
  // heart
  ctx.fillStyle = palette.likeAccent
  ctx.beginPath()
  ctx.moveTo(x, y + 30)
  ctx.bezierCurveTo(x - 36, y - 8, x - 16, y - 36, x, y - 8)
  ctx.bezierCurveTo(x + 16, y - 36, x + 36, y - 8, x, y + 30)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 20px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('12.4k', x, y + 50)

  // comment glyph
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(x, y + 130, 28, 0.15 * Math.PI, 1.85 * Math.PI)
  ctx.lineTo(x - 12, y + 170)
  ctx.lineTo(x + 4, y + 158)
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('842', x, y + 190)

  // share glyph
  ctx.beginPath()
  ctx.moveTo(x - 18, y + 250)
  ctx.lineTo(x + 18, y + 260)
  ctx.lineTo(x - 18, y + 270)
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('Share', x, y + 290)
}

async function loadImageSafe(url: string): Promise<HTMLImageElement | null> {
  try { return await loadImage(url) } catch { return null }
}

function formatTikTokCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}
