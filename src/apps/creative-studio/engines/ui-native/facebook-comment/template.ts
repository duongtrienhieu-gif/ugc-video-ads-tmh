// ── Facebook Comment Thread Canvas Template (P12 authenticity refresh) ─────
//
// P12 changes:
//   • per-platform metrics (FACEBOOK_COMMENT_METRICS) — bubble proportions
//     match real FB v420 screenshots
//   • per-platform typography (FACEBOOK_TYPO) — Meta-stack 600/400 weights
//   • iPhone 15 Pro device chrome (dynamic island + home indicator)
//   • locale-aware metadata: "Like" / "Reply" / "Most relevant" / engagement
//     count formats per locale
//   • multi-avatar pool — each unique commenter has their own face,
//     defeats the "all commenters look identical" bot-farm tell

import type { UINativeTextContent, UINativeTemplate, UINativeLocale } from '../../../types/uiNative'
import { createCanvas, loadImage, drawCircularAvatar, roundedRectPath, wrapText } from '../../../shared/canvas'
import { FACEBOOK_LIGHT_2024 } from '../_shared/colors'
import { FACEBOOK_COMMENT_METRICS } from '../_shared/platformMetrics'
import { FACEBOOK_TYPO, font } from '../_shared/platformTypography'
import { IPHONE_15_PRO, renderDeviceChrome } from '../_shared/deviceChrome'
import { readLikes, readIsReply } from '../_shared/textPayload'
import { findStrings, fakeMetric } from '../_shared/conversationMetadata'
import type { MessageTimeline } from '../_shared/timestamps'

export const FACEBOOK_COMMENT_TEMPLATE: UINativeTemplate = {
  id: 'facebook-comment-v1',
  platform: 'facebook',
  variant: 'post-with-comments',
  canvasSize: { width: 1080, height: 1920 },
  theme: 'light',
  statusBarStyle: 'ios',
  uiVintage: '2024',
}

export interface RenderInputs {
  text: UINativeTextContent
  timeline: MessageTimeline
  customerAvatarUrl: string
  avatarPool?: Map<number, string>
  locale: UINativeLocale
  productImageUrl?: string
}

export async function renderFacebookComments(inputs: RenderInputs): Promise<HTMLCanvasElement> {
  const palette = FACEBOOK_LIGHT_2024
  const M = FACEBOOK_COMMENT_METRICS
  const T = FACEBOOK_TYPO
  const S = findStrings(inputs.locale)
  const size = FACEBOOK_COMMENT_TEMPLATE.canvasSize
  const { canvas, ctx } = createCanvas(size)

  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, 0, size.width, size.height)

  // iPhone chrome — Facebook uses white header so status bar fg is dark
  renderDeviceChrome(ctx, IPHONE_15_PRO, size.width, size.height, {
    statusBarBg: palette.headerBg,
    statusBarFg: palette.headerFg,
    timeLabel: inputs.timeline.statusBarTime,
  })

  // Header — "Comments" + back chevron + sort label
  const headerY = IPHONE_15_PRO.statusBarHeight + IPHONE_15_PRO.safeAreaTop
  ctx.fillStyle = palette.headerBg
  ctx.fillRect(0, headerY, size.width, M.headerHeight)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, headerY + M.headerHeight, size.width, 1)

  // Back chevron
  ctx.strokeStyle = palette.headerFg
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  const chevY = headerY + M.headerHeight / 2
  ctx.moveTo(58, chevY); ctx.lineTo(34, chevY)
  ctx.moveTo(46, chevY - 12); ctx.lineTo(34, chevY); ctx.lineTo(46, chevY + 12)
  ctx.stroke()

  ctx.fillStyle = palette.headerFg
  ctx.font = font(T, 'header')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('Comments', 86, chevY)

  // Sort pill right
  ctx.fillStyle = palette.mutedFg
  ctx.font = font(T, 'meta')
  ctx.textAlign = 'right'
  ctx.fillText(`${S.mostRelevant} ▾`, size.width - 28, chevY)

  // Engagement stub bar
  const stubY = headerY + M.headerHeight
  const stubH = 78
  ctx.fillStyle = palette.pageBg
  ctx.fillRect(0, stubY, size.width, stubH)
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, stubY + stubH, size.width, 1)

  ctx.fillStyle = palette.likeAccent
  ctx.beginPath()
  ctx.arc(60, stubY + stubH / 2, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 18px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('👍', 60, stubY + stubH / 2)

  const totalLikes = inputs.text.items.reduce((s, c) => s + readLikes(c), 0) + fakeMetric(`${inputs.timeline.dateLabel}_likes`, 'medium')
  ctx.fillStyle = palette.pageFg
  ctx.font = font(T, 'name')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${totalLikes}`, 92, stubY + stubH / 2)

  ctx.fillStyle = palette.mutedFg
  ctx.font = font(T, 'meta')
  ctx.textAlign = 'right'
  ctx.fillText(
    `${S.commentsCount(inputs.text.items.length + fakeMetric(`${inputs.timeline.dateLabel}_cmt`, 'small'))}  ·  ${fakeMetric(`${inputs.timeline.dateLabel}_share`, 'small')} shares`,
    size.width - 28, stubY + stubH / 2,
  )

  // Pre-load all unique commenter avatars from pool
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
  let cursor = stubY + stubH + 20
  const cutoffY = size.height - M.footerHeight - 30

  for (let i = 0; i < inputs.text.items.length; i++) {
    const c = inputs.text.items[i]
    const author = inputs.text.participants[c.authorIdx]
    cursor = await drawComment(ctx, {
      palette, metrics: M, typo: T, strings: S,
      width: size.width,
      startY: cursor,
      displayName: author?.displayName ?? 'user',
      body: c.text,
      timestamp: c.timestamp,
      likes: readLikes(c),
      isReply: readIsReply(c),
      avatarImg: avatarCache.get(c.authorIdx) ?? null,
    })
    if (cursor > cutoffY) break
  }

  // Composer
  drawFbComposer(ctx, {
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
  palette: typeof FACEBOOK_LIGHT_2024
  metrics: typeof FACEBOOK_COMMENT_METRICS
  typo: typeof FACEBOOK_TYPO
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

async function drawComment(ctx: CanvasRenderingContext2D, i: CommentInputs): Promise<number> {
  const { palette, metrics: M, typo: T, strings: S, width, startY,
          displayName, body, timestamp, likes, isReply, avatarImg } = i

  const indentX = isReply ? 78 : 0
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

  const bubbleX = avatarCx + avatarRadius + 12
  const bubbleMaxW = (width - bubbleX - M.sideMargin) * 0.95

  // Pre-measure body
  ctx.font = font(T, 'body')
  const lines = wrapText(ctx, body, bubbleMaxW - M.bubblePaddingX * 2)
  const lh = T.bodySize * T.bodyLineHeight
  const textBlockH = lines.length * lh

  ctx.font = font(T, 'name')
  const nameW = ctx.measureText(displayName).width
  const longestLineW = lines.length === 0 ? 0 : Math.max(...lines.map((l) => {
    ctx.font = font(T, 'body')
    return ctx.measureText(l).width
  }))

  const bubbleW = Math.min(
    bubbleMaxW,
    Math.max(nameW, longestLineW) + M.bubblePaddingX * 2,
  )
  const bubbleH = 34 + textBlockH + M.bubblePaddingY

  roundedRectPath(ctx, bubbleX, startY, bubbleW, bubbleH, M.bubbleRadius)
  ctx.fillStyle = '#F0F2F5'
  ctx.fill()

  // Display name
  ctx.fillStyle = palette.authorFg
  ctx.font = font(T, 'name')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(displayName, bubbleX + M.bubblePaddingX, startY + M.bubblePaddingY)

  // Body
  ctx.fillStyle = palette.pageFg
  ctx.font = font(T, 'body')
  for (let li = 0; li < lines.length; li++) {
    ctx.fillText(lines[li], bubbleX + M.bubblePaddingX, startY + 34 + M.bubblePaddingY + li * lh - 6)
  }

  // Action row
  const actionsY = startY + bubbleH + 6
  ctx.font = font(T, 'meta')
  ctx.fillStyle = palette.mutedFg
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(timestamp, bubbleX + 4, actionsY)
  ctx.fillStyle = palette.likeAccent
  ctx.fillText(S.like, bubbleX + 96, actionsY)
  ctx.fillStyle = palette.mutedFg
  ctx.fillText(S.reply, bubbleX + 168, actionsY)

  if (likes > 0) {
    ctx.fillStyle = palette.likeAccent
    ctx.beginPath()
    ctx.arc(bubbleX + bubbleW - 52, actionsY + 11, 13, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '600 16px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('👍', bubbleX + bubbleW - 52, actionsY + 11)
    ctx.fillStyle = palette.mutedFg
    ctx.font = font(T, 'meta')
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`${likes}`, bubbleX + bubbleW - 30, actionsY)
  }

  return actionsY + 32 + M.bubbleGap
}

function drawFbComposer(ctx: CanvasRenderingContext2D, i: {
  palette: typeof FACEBOOK_LIGHT_2024
  typo: typeof FACEBOOK_TYPO
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

  // Reactions row
  const reactionsY = yOffset + 28
  const reactions = ['👍', '❤️', '😆', '😮', '😢', '😡']
  ctx.font = font(T, 'name')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (let r = 0; r < reactions.length; r++) {
    ctx.fillText(reactions[r], 36 + r * 72, reactionsY)
  }

  // Avatar + input pill row
  const pillRowY = yOffset + 66
  const pillH = height - 76
  const ax = 36 + 24
  if (primaryAvatar) drawCircularAvatar(ctx, primaryAvatar, ax, pillRowY + pillH / 2, 22)

  const pillX = ax + 32
  const pillW = width - pillX - 36
  roundedRectPath(ctx, pillX, pillRowY, pillW, pillH, pillH / 2)
  ctx.fillStyle = palette.pageBg
  ctx.fill()
  ctx.strokeStyle = palette.divider
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = palette.composerPlaceholder
  ctx.font = font(T, 'body')
  ctx.textBaseline = 'middle'
  ctx.fillText(S.composerPlaceholder('facebook'), pillX + 26, pillRowY + pillH / 2)
}

async function loadImageSafe(url: string): Promise<HTMLImageElement | null> {
  try { return await loadImage(url) } catch { return null }
}
