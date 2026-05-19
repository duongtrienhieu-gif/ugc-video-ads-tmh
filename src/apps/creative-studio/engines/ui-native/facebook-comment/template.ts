// ── Facebook Comment Thread Canvas Template (P12 refresh, P48 post header) ─
//
// P48 changes — the template now renders THREE stacked zones to match a
// real Facebook page post layout:
//
//   1. POST HEADER — page/creator avatar + display name + timestamp +
//      post caption + attached product image. Authored by the LLM and
//      surfaced via inputs.text.context.postCaption / ownerName.
//   2. ENGAGEMENT STRIP — like reactions ball + like count + comments
//      count + shares count (matches real FB v420 like/share row, not
//      just a "Comments" sort-bar like pre-P48).
//   3. COMMENTS THREAD — existing comment list, now with optional
//      "Tác giả" / "Author" badge on bubbles where readIsOwnerReply is
//      true. Owner replies are visually indented + author-coloured so
//      the page-owner-replying-to-a-customer pattern reads instantly.
//
// Pre-P48 the template only showed the comments + composer with a tiny
// "Comments / Most relevant" sort bar at the very top. That made every
// generated screenshot read as "a sorted comments list" instead of "a
// real Facebook post with replies" — losing the FB authenticity signal
// the user is after.
//
// P12 baseline preserved:
//   • per-platform metrics (FACEBOOK_COMMENT_METRICS)
//   • per-platform typography (FACEBOOK_TYPO) — Meta-stack 600/400
//   • iPhone 15 Pro device chrome
//   • locale-aware metadata strings + per-comment avatar pool

import type { UINativeTextContent, UINativeTemplate, UINativeLocale } from '../../../types/uiNative'
import { createCanvas, loadImage, drawCircularAvatar, roundedRectPath, wrapText } from '../../../shared/canvas'
import { FACEBOOK_LIGHT_2024 } from '../_shared/colors'
import { FACEBOOK_COMMENT_METRICS } from '../_shared/platformMetrics'
import { FACEBOOK_TYPO, font } from '../_shared/platformTypography'
import { IPHONE_15_PRO, renderDeviceChrome } from '../_shared/deviceChrome'
import { readLikes, readIsReply, readIsOwnerReply } from '../_shared/textPayload'
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

  // ── Header — back chevron + page name (no longer a "Comments" sort bar)
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

  const ownerName = inputs.text.context.ownerName ?? inputs.text.context.productName ?? 'Page'
  ctx.fillStyle = palette.headerFg
  ctx.font = font(T, 'header')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(truncate(ownerName, 30), 86, chevY)

  // Pre-load avatars before drawing the post header (the page owner
  // avatar reuses authorIdx 0 from the avatar pool if available).
  const avatarCache = new Map<number, HTMLImageElement | null>()
  const uniqueAuthors = new Set(inputs.text.items.map((c) => c.authorIdx))
  const poolSize = inputs.avatarPool?.size ?? 0
  for (const idx of uniqueAuthors) {
    const url = (poolSize > 0
      ? inputs.avatarPool!.get(idx % poolSize)
      : inputs.customerAvatarUrl) ?? inputs.customerAvatarUrl
    avatarCache.set(idx, await loadImageSafe(url))
  }
  const ownerAvatar = avatarCache.get(0)
    ?? await loadImageSafe(inputs.customerAvatarUrl)

  // ── POST HEADER — page avatar + name + timestamp + caption + product image
  let cursor = headerY + M.headerHeight + 16
  cursor = await drawPostHeader(ctx, {
    palette, metrics: M, typo: T,
    width: size.width,
    startY: cursor,
    ownerName,
    timestamp: inputs.timeline.dateLabel,
    caption: inputs.text.context.postCaption ?? defaultCaption(inputs.locale, inputs.text.context.productName),
    productImageUrl: inputs.productImageUrl,
    ownerAvatar,
  })

  // ── ENGAGEMENT STRIP — reactions stack + counts row
  cursor = drawEngagementStrip(ctx, {
    palette, metrics: M, typo: T, strings: S,
    width: size.width,
    startY: cursor,
    likes:     inputs.text.context.postLikes  ?? (200 + fakeMetric(`${inputs.timeline.dateLabel}_post_likes`, 'medium')),
    comments:  inputs.text.items.length + fakeMetric(`${inputs.timeline.dateLabel}_cmt`, 'small'),
    shares:    inputs.text.context.postShares ?? fakeMetric(`${inputs.timeline.dateLabel}_share`, 'small'),
    locale:    inputs.locale,
  })

  // ── COMMENT LIST
  const cutoffY = size.height - M.footerHeight - 30

  for (let i = 0; i < inputs.text.items.length; i++) {
    const c = inputs.text.items[i]
    const isOwnerReply = readIsOwnerReply(c)
    const displayName = isOwnerReply
      ? ownerName
      : inputs.text.participants[c.authorIdx]?.displayName ?? 'user'
    const avatarImg = isOwnerReply
      ? ownerAvatar
      : avatarCache.get(c.authorIdx) ?? null
    cursor = await drawComment(ctx, {
      palette, metrics: M, typo: T, strings: S,
      width: size.width,
      startY: cursor,
      displayName,
      body: c.text,
      timestamp: c.timestamp,
      likes: readLikes(c),
      isReply: readIsReply(c) || isOwnerReply,
      isOwnerReply,
      avatarImg,
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
  /** P48 — when true, render a small "Tác giả" / "Author" badge next
   *  to the display name and tint the bubble slightly to differentiate
   *  page-owner replies from regular commenters. */
  isOwnerReply?: boolean
  avatarImg: HTMLImageElement | null
}

// ── P48 — Post header / engagement strip / utility helpers ─────────────

interface PostHeaderInputs {
  palette: typeof FACEBOOK_LIGHT_2024
  metrics: typeof FACEBOOK_COMMENT_METRICS
  typo: typeof FACEBOOK_TYPO
  width: number
  startY: number
  ownerName: string
  timestamp: string
  caption: string
  productImageUrl?: string
  ownerAvatar: HTMLImageElement | null
}

async function drawPostHeader(ctx: CanvasRenderingContext2D, i: PostHeaderInputs): Promise<number> {
  const { palette, metrics: M, typo: T, width, startY, ownerName, timestamp, caption, productImageUrl, ownerAvatar } = i
  const sideX = M.sideMargin

  // Author row: avatar + name + timestamp + dot + "Đã được tài trợ"
  const avatarR = 38
  const avatarCx = sideX + avatarR
  const avatarCy = startY + avatarR
  if (ownerAvatar) {
    drawCircularAvatar(ctx, ownerAvatar, avatarCx, avatarCy, avatarR)
  } else {
    ctx.fillStyle = '#1877F2'
    ctx.beginPath()
    ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `700 ${Math.round(avatarR * 0.9)}px ${T.nameFont}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ownerName.charAt(0).toUpperCase(), avatarCx, avatarCy + 2)
  }

  const nameX = avatarCx + avatarR + 18
  ctx.fillStyle = palette.authorFg
  ctx.font = `700 ${T.nameSize}px ${T.nameFont}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(truncate(ownerName, 40), nameX, startY + 4)

  ctx.fillStyle = palette.mutedFg
  ctx.font = font(T, 'meta')
  ctx.fillText(`${timestamp}  ·  🌐`, nameX, startY + 4 + T.nameSize + 8)

  // Caption body
  let cy = startY + 2 * avatarR + 16
  if (caption) {
    ctx.fillStyle = palette.pageFg
    ctx.font = font(T, 'body')
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const captionMaxW = width - sideX * 2
    const captionLines = wrapText(ctx, caption, captionMaxW)
    const lh = T.bodySize * T.bodyLineHeight
    for (let li = 0; li < captionLines.length; li++) {
      ctx.fillText(captionLines[li], sideX, cy + li * lh)
    }
    cy += captionLines.length * lh + 16
  }

  // Attached product image — full-width 4:3
  if (productImageUrl) {
    try {
      const img = await loadImage(productImageUrl)
      const imgW = width
      const imgH = Math.round((imgW * 3) / 4)
      ctx.save()
      ctx.fillStyle = '#000'
      ctx.fillRect(0, cy, imgW, imgH)
      const scale = Math.max(imgW / img.naturalWidth, imgH / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      ctx.drawImage(img, (imgW - dw) / 2, cy + (imgH - dh) / 2, dw, dh)
      ctx.restore()
      cy += imgH
    } catch {
      // skip on load failure
    }
  }

  return cy
}

interface EngagementStripInputs {
  palette: typeof FACEBOOK_LIGHT_2024
  metrics: typeof FACEBOOK_COMMENT_METRICS
  typo: typeof FACEBOOK_TYPO
  strings: ReturnType<typeof findStrings>
  width: number
  startY: number
  likes: number
  comments: number
  shares: number
  locale: UINativeLocale
}

function drawEngagementStrip(ctx: CanvasRenderingContext2D, i: EngagementStripInputs): number {
  const { palette, metrics: M, typo: T, width, startY, likes, comments, shares, locale } = i
  const sideX = M.sideMargin

  // Counts row: 👍 likes ... N bình luận · M lượt chia sẻ
  ctx.fillStyle = palette.likeAccent
  const ballCx = sideX + 14
  const ballCy = startY + 22
  ctx.beginPath()
  ctx.arc(ballCx, ballCy, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `600 18px ${T.bodyFont}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('👍', ballCx, ballCy + 1)

  ctx.fillStyle = palette.mutedFg
  ctx.font = font(T, 'name')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(formatCount(likes), ballCx + 22, ballCy)

  ctx.font = font(T, 'meta')
  ctx.textAlign = 'right'
  const commentsLabel = locale === 'vi-VN' ? `${formatCount(comments)} bình luận` : locale === 'my-MY' ? `${formatCount(comments)} komen` : locale === 'id-ID' ? `${formatCount(comments)} komentar` : `${formatCount(comments)} comments`
  const sharesLabel   = locale === 'vi-VN' ? `${formatCount(shares)} lượt chia sẻ` : locale === 'my-MY' ? `${formatCount(shares)} kongsi` : locale === 'id-ID' ? `${formatCount(shares)} dibagikan` : `${formatCount(shares)} shares`
  ctx.fillText(`${commentsLabel}  ·  ${sharesLabel}`, width - sideX, ballCy)

  // Divider
  ctx.fillStyle = palette.divider
  ctx.fillRect(sideX, startY + 52, width - sideX * 2, 1)

  // Action row: Thích · Bình luận · Chia sẻ
  const actY = startY + 52 + 36
  const actW = (width - sideX * 2) / 3
  const actLabels = locale === 'vi-VN'
    ? ['👍  Thích', '💬  Bình luận', '↪️  Chia sẻ']
    : locale === 'my-MY'
    ? ['👍  Suka', '💬  Komen', '↪️  Kongsi']
    : locale === 'id-ID'
    ? ['👍  Suka', '💬  Komentar', '↪️  Bagikan']
    : ['👍  Like', '💬  Comment', '↪️  Share']
  ctx.fillStyle = palette.mutedFg
  ctx.font = font(T, 'name')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let k = 0; k < actLabels.length; k++) {
    ctx.fillText(actLabels[k], sideX + actW * (k + 0.5), actY)
  }

  // Divider below action row
  ctx.fillStyle = palette.divider
  ctx.fillRect(0, startY + 52 + 72, width, 1)

  return startY + 52 + 72 + 18
}

function defaultCaption(locale: UINativeLocale, productName?: string): string {
  const p = productName ?? 'sản phẩm mới'
  if (locale === 'vi-VN') return `Đã dùng ${p} được 2 tuần rồi mn ơi, hiệu quả thật sự bất ngờ luôn 🥰 ai cần thì hỏi mình nha`
  if (locale === 'my-MY') return `Dah guna ${p} dalam 2 minggu, memang power betul. Tanya mana nak dapat — boleh DM 🙌`
  if (locale === 'id-ID') return `Udah pakai ${p} 2 minggu, hasilnya beneran kelihatan banget. Mau nanya boleh DM ya 🙌`
  return `Been using ${p} for 2 weeks now and the results are real. DM me if you want to try ✨`
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `${Math.max(0, Math.round(n))}`
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

async function drawComment(ctx: CanvasRenderingContext2D, i: CommentInputs): Promise<number> {
  const { palette, metrics: M, typo: T, strings: S, width, startY,
          displayName, body, timestamp, likes, isReply, isOwnerReply, avatarImg } = i

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

  // P48 — owner badge measurement (rendered next to the display name).
  // Pre-compute so the bubble width accommodates the name + badge.
  const authorBadgeText = '· Tác giả'
  ctx.font = font(T, 'name')
  const nameW = ctx.measureText(displayName).width
  ctx.font = font(T, 'meta')
  const ownerBadgeW = isOwnerReply ? ctx.measureText(authorBadgeText).width + 8 : 0
  const longestLineW = lines.length === 0 ? 0 : Math.max(...lines.map((l) => {
    ctx.font = font(T, 'body')
    return ctx.measureText(l).width
  }))

  const bubbleW = Math.min(
    bubbleMaxW,
    Math.max(nameW + ownerBadgeW, longestLineW) + M.bubblePaddingX * 2,
  )
  const bubbleH = 34 + textBlockH + M.bubblePaddingY

  roundedRectPath(ctx, bubbleX, startY, bubbleW, bubbleH, M.bubbleRadius)
  // P48 — page-owner replies get a subtle blue-tint bubble so the
  // page-owner-answering-customer pattern reads at a glance, mirroring
  // real FB pages where the owner's reply often shows differently.
  ctx.fillStyle = isOwnerReply ? '#E7F3FF' : '#F0F2F5'
  ctx.fill()

  // Display name
  ctx.fillStyle = palette.authorFg
  ctx.font = font(T, 'name')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(displayName, bubbleX + M.bubblePaddingX, startY + M.bubblePaddingY)

  // P48 — owner badge ("· Tác giả") to the right of the display name
  if (isOwnerReply) {
    ctx.fillStyle = '#1877F2'
    ctx.font = font(T, 'meta')
    ctx.fillText(authorBadgeText, bubbleX + M.bubblePaddingX + nameW + 8, startY + M.bubblePaddingY + 4)
  }

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
