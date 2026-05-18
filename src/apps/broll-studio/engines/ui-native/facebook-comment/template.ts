// ── Facebook Comment Thread Canvas Template (P6) ────────────────────────────
//
// Renders a Facebook post + comment thread screenshot. Top portion shows
// a minimal post header (author + time + body excerpt) so the comments
// have context; bulk of the canvas is the comment list.
//
// Output: 9:16 portrait, 1080×1920.

import type { UINativeTextContent, UINativeTemplate } from '../../../types/uiNative'
import {
  createCanvas,
  loadImage,
  drawCircularAvatar,
  roundedRectPath,
  wrapText,
} from '../_shared/canvas'
import { FACEBOOK_LIGHT_2024 } from '../_shared/colors'
import { renderStatusBar } from '../_shared/statusBar'
import { readLikes, readIsReply } from '../_shared/textPayload'
import type { MessageTimeline } from '../_shared/timestamps'

export const FACEBOOK_COMMENT_TEMPLATE: UINativeTemplate = {
  id: 'facebook-comment-v1',
  platform: 'facebook',
  variant: 'post-with-comments',
  canvasSize: { width: 1080, height: 1920 },
  theme: 'light',
  statusBarStyle: 'android',
  uiVintage: '2024',
}

export interface RenderInputs {
  text: UINativeTextContent
  timeline: MessageTimeline
  /** Avatar of the POST author (NOT a commenter). */
  postAuthorAvatarUrl: string
  /** Optional generic commenter avatar (reused for all commenters). */
  commenterAvatarUrl?: string
}

export async function renderFacebookComments(
  inputs: RenderInputs,
): Promise<HTMLCanvasElement> {
  const palette = FACEBOOK_LIGHT_2024
  const size = FACEBOOK_COMMENT_TEMPLATE.canvasSize
  const { canvas, ctx } = createCanvas(size)

  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, 0, size.width, size.height)

  renderStatusBar(ctx, {
    style: 'android',
    fg: palette.headerFg,
    bg: palette.headerBg,
    timeLabel: inputs.timeline.statusBarTime,
    width: size.width,
  })

  // ── Page header — "Comments" label + back chevron ─────────────────
  const headerY = 44
  const headerH = 100
  ctx.fillStyle = palette.headerBg
  ctx.fillRect(0, headerY, size.width, headerH)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, headerY + headerH, size.width, 1)

  ctx.strokeStyle = palette.headerFg
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(60, headerY + headerH / 2)
  ctx.lineTo(34, headerY + headerH / 2)
  ctx.moveTo(46, headerY + headerH / 2 - 14)
  ctx.lineTo(34, headerY + headerH / 2)
  ctx.lineTo(46, headerY + headerH / 2 + 14)
  ctx.stroke()

  ctx.fillStyle = palette.headerFg
  ctx.font = '600 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('Comments', 90, headerY + headerH / 2)

  // Sort pill (right)
  ctx.fillStyle = palette.mutedFg
  ctx.font = '500 22px -apple-system, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText('Most relevant ▾', size.width - 30, headerY + headerH / 2)

  // ── Compact post stub (engagement bar) ────────────────────────────
  const stubY = headerY + headerH
  const stubH = 80
  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, stubY, size.width, stubH)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, stubY + stubH, size.width, 1)

  // Like + comment + share counters
  ctx.fillStyle = palette.likeAccent
  ctx.beginPath()
  ctx.arc(60, stubY + stubH / 2, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 18px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('👍', 60, stubY + stubH / 2)

  ctx.fillStyle = palette.pageFg
  ctx.font = '500 26px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${countTotalLikes(inputs.text) + 218}`, 96, stubY + stubH / 2)

  ctx.fillStyle = palette.mutedFg
  ctx.font = '400 24px -apple-system, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`${inputs.text.items.length} comments  ·  12 shares`, size.width - 30, stubY + stubH / 2)

  // ── Comment list ──────────────────────────────────────────────────
  let cursor = stubY + stubH + 24
  const commenterImg = inputs.commenterAvatarUrl
    ? await loadImageSafe(inputs.commenterAvatarUrl)
    : null

  for (let i = 0; i < inputs.text.items.length; i++) {
    const c = inputs.text.items[i]
    const isReply = readIsReply(c)
    cursor = await drawComment(ctx, {
      palette,
      width: size.width,
      startY: cursor,
      displayName: inputs.text.participants[c.authorIdx]?.displayName ?? 'user',
      body: c.text,
      timestamp: c.timestamp,
      likes: readLikes(c),
      isReply,
      avatarImg: commenterImg,
    })

    if (cursor > size.height - 200) break
  }

  // ── Composer at bottom ────────────────────────────────────────────
  const composerH = 130
  const composerY = size.height - composerH
  ctx.fillStyle = palette.composerBg
  ctx.fillRect(0, composerY, size.width, composerH)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, composerY, size.width, 1)

  // Reactions row (above input)
  const reactionsY = composerY + 30
  const reactions = ['👍', '❤️', '😆', '😮', '😢', '😡']
  ctx.font = '400 26px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < reactions.length; i++) {
    ctx.fillText(reactions[i], 40 + i * 80, reactionsY)
  }

  // Input pill
  const pillX = 40
  const pillY = composerY + 70
  const pillW = size.width - pillX - 100
  const pillH = composerH - 78
  roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2)
  ctx.fillStyle = palette.pageBg
  ctx.fill()
  ctx.strokeStyle = palette.divider
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = palette.composerPlaceholder
  ctx.font = '400 24px -apple-system, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('Write a comment...', pillX + 30, pillY + pillH / 2)

  // Smiley icon (right of input)
  ctx.fillStyle = palette.composerPlaceholder
  ctx.beginPath()
  ctx.arc(size.width - 60, pillY + pillH / 2, 22, 0, Math.PI * 2)
  ctx.fill()

  return canvas
}

// ── Helpers ────────────────────────────────────────────────────────────

interface CommentInputs {
  palette: typeof FACEBOOK_LIGHT_2024
  width: number
  startY: number
  displayName: string
  body: string
  timestamp: string
  likes: number
  isReply: boolean
  avatarImg: HTMLImageElement | null
}

async function drawComment(
  ctx: CanvasRenderingContext2D,
  inputs: CommentInputs,
): Promise<number> {
  const { palette, width, startY, displayName, body, timestamp, likes, isReply, avatarImg } = inputs

  const padX = 36
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

  // Bubble background
  const bubbleX = avatarCx + avatarRadius + 14
  const bubblePadX = 22
  const bubblePadY = 14
  const bubbleMaxW = width - bubbleX - padX
  const nameFont = '600 24px -apple-system, sans-serif'
  const bodyFont = '400 26px -apple-system, sans-serif'

  ctx.font = bodyFont
  const lines = wrapText(ctx, body, bubbleMaxW - bubblePadX * 2)
  const lineH = 34
  const textBlockH = lines.length * lineH

  ctx.font = nameFont
  const nameW = ctx.measureText(displayName).width
  const longestBodyW = Math.max(...lines.map((l) => ctx.measureText(l).width))
  const bubbleW = Math.min(
    bubbleMaxW,
    Math.max(nameW, longestBodyW) + bubblePadX * 2,
  )
  const bubbleH = 38 + textBlockH + bubblePadY  // header height + body
  roundedRectPath(ctx, bubbleX, startY, bubbleW, bubbleH, 18)
  ctx.fillStyle = '#F0F2F5'
  ctx.fill()

  // Display name (bold)
  ctx.fillStyle = palette.authorFg
  ctx.font = nameFont
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(displayName, bubbleX + bubblePadX, startY + bubblePadY)

  // Body
  ctx.fillStyle = palette.pageFg
  ctx.font = bodyFont
  for (let li = 0; li < lines.length; li++) {
    ctx.fillText(lines[li], bubbleX + bubblePadX, startY + 38 + bubblePadY + li * lineH)
  }

  // Action row below bubble
  const actionsY = startY + bubbleH + 8
  ctx.font = '500 22px -apple-system, sans-serif'
  ctx.fillStyle = palette.mutedFg
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(timestamp, bubbleX + 6, actionsY)
  ctx.fillStyle = palette.likeAccent
  ctx.fillText('Like', bubbleX + 110, actionsY)
  ctx.fillStyle = palette.mutedFg
  ctx.fillText('Reply', bubbleX + 200, actionsY)

  if (likes > 0) {
    // Right-aligned like count badge
    ctx.fillStyle = palette.likeAccent
    ctx.beginPath()
    ctx.arc(bubbleX + bubbleW - 60, actionsY + 12, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '600 18px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('👍', bubbleX + bubbleW - 60, actionsY + 12)
    ctx.fillStyle = palette.mutedFg
    ctx.font = '500 22px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`${likes}`, bubbleX + bubbleW - 36, actionsY)
  }

  return actionsY + 40
}

async function loadImageSafe(url: string): Promise<HTMLImageElement | null> {
  try { return await loadImage(url) } catch { return null }
}

function countTotalLikes(text: UINativeTextContent): number {
  return text.items.reduce((sum, c) => sum + readLikes(c), 0)
}
