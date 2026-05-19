// ── TikTok Comment Overlay Canvas Template (P12 refresh, P49 video frame) ──
//
// P49 — the top "video peek" zone used to be a flat dark gradient. It now
// renders a styled video still (creator avatar + product photo + caption
// + creator handle) so the comments overlay reads as "a real TikTok post
// with a video preview at the top", not a dark void with comments below.
// Symmetric with the P49 Facebook comment template restructure.
//
// P12 baseline preserved:
//   • per-platform metrics (TIKTOK_COMMENT_METRICS)
//   • per-platform typography (TIKTOK_TYPO)
//   • iPhone 15 Pro device chrome
//   • locale-aware metadata strings + per-comment avatar pool

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
  /** P49 — product image is now composited into the styled video peek
   *  zone so the post reads as "a video about this product" rather than
   *  a dark void with comments below. */
  productImageUrl?: string
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

  // Pre-load avatars (used by both the video peek post photo + the
  // commenter avatars). The post-photo person is a customer face
  // (avatarPool[1] when available) — distinct from the creator handle.
  const avatarCache = new Map<number, HTMLImageElement | null>()
  const uniqueAuthors = new Set(inputs.text.items.map((c) => c.authorIdx))
  const poolSize = inputs.avatarPool?.size ?? 0
  for (const idx of uniqueAuthors) {
    const url = (poolSize > 0
      ? inputs.avatarPool!.get(idx % poolSize)
      : inputs.customerAvatarUrl) ?? inputs.customerAvatarUrl
    avatarCache.set(idx, await loadImageSafe(url))
  }
  const creatorAvatar = avatarCache.get(0) ?? await loadImageSafe(inputs.customerAvatarUrl)
  const postPhotoAvatar = (poolSize > 1 ? await loadImageSafe(inputs.avatarPool!.get(1 % poolSize) ?? inputs.customerAvatarUrl) : creatorAvatar) ?? creatorAvatar

  // ── P49 — styled video peek: customer-face + product side-by-side
  //   composited on a dark cinematic backdrop. Caption + creator handle
  //   overlay at the bottom-left. Increases the video zone to 540px so
  //   the post still + caption are legible.
  const videoPeekH = 540
  const videoY = IPHONE_15_PRO.statusBarHeight + IPHONE_15_PRO.safeAreaTop
  await drawTikTokVideoFrame(ctx, {
    width: size.width,
    startY: videoY,
    height: videoPeekH,
    productImageUrl: inputs.productImageUrl,
    postPhotoAvatar,
    creatorHandle: inputs.text.context.ownerName ?? defaultCreatorHandle(inputs.locale),
    caption: inputs.text.context.postCaption ?? defaultTikTokCaption(inputs.locale, inputs.text.context.productName),
    typo: T,
    dateLabelSeed: inputs.timeline.dateLabel,
  })

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

  // Comment list (avatars already pre-loaded above for the video peek)
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

// ── P49 — Styled video peek (post photo with person + product + caption) ──

interface TikTokVideoFrameInputs {
  width: number
  startY: number
  height: number
  productImageUrl?: string
  postPhotoAvatar: HTMLImageElement | null
  creatorHandle: string
  caption: string
  typo: typeof TIKTOK_TYPO
  dateLabelSeed: string
}

async function drawTikTokVideoFrame(ctx: CanvasRenderingContext2D, i: TikTokVideoFrameInputs): Promise<void> {
  const { width, startY, height, productImageUrl, postPhotoAvatar, creatorHandle, caption, typo: T, dateLabelSeed } = i

  // Cinematic dark backdrop with vertical gradient (sim of a TikTok video still)
  const grad = ctx.createLinearGradient(0, startY, 0, startY + height)
  grad.addColorStop(0, '#171723')
  grad.addColorStop(0.55, '#1B1224')
  grad.addColorStop(1, '#080810')
  ctx.fillStyle = grad
  ctx.fillRect(0, startY, width, height)

  // Subtle brand-accent diagonal beam
  ctx.save()
  ctx.globalAlpha = 0.10
  ctx.fillStyle = '#FE2C55'
  ctx.beginPath()
  ctx.moveTo(0, startY + height * 0.65)
  ctx.lineTo(width, startY + height * 0.30)
  ctx.lineTo(width, startY + height * 0.42)
  ctx.lineTo(0, startY + height * 0.77)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // Vignette
  ctx.save()
  const vg = ctx.createRadialGradient(
    width / 2, startY + height * 0.55, height * 0.25,
    width / 2, startY + height * 0.55, height * 0.85,
  )
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vg
  ctx.fillRect(0, startY, width, height)
  ctx.restore()

  // Left: large customer-face avatar (the "creator on camera")
  if (postPhotoAvatar) {
    const avX = Math.round(width * 0.30)
    const avY = startY + Math.round(height * 0.48)
    const avR = 175
    ctx.save()
    ctx.shadowColor = 'rgba(254,44,85,0.45)'
    ctx.shadowBlur = 26
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(avX, avY, avR + 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    drawCircularAvatar(ctx, postPhotoAvatar, avX, avY, avR)
  }

  // Right: product image in a rounded white tile
  if (productImageUrl) {
    try {
      const img = await loadImage(productImageUrl)
      const pW = 340
      const pH = 340
      const pX = Math.round(width * 0.72 - pW / 2)
      const pY = startY + Math.round((height - pH) / 2)
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.45)'
      ctx.shadowBlur = 30
      ctx.shadowOffsetY = 14
      roundedRectPath(ctx, pX, pY, pW, pH, 24)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
      ctx.restore()
      ctx.save()
      roundedRectPath(ctx, pX, pY, pW, pH, 24)
      ctx.clip()
      const scale = Math.max(pW / img.naturalWidth, pH / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      ctx.drawImage(img, pX + (pW - dw) / 2, pY + (pH - dh) / 2, dw, dh)
      ctx.restore()
    } catch {
      // silent
    }
  }

  // Bottom-left caption overlay: creator handle + caption + audio strip
  const captionX = 36
  const captionY = startY + height - 168
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `700 ${T.nameSize + 4}px ${T.nameFont}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(creatorHandle.startsWith('@') ? creatorHandle : `@${creatorHandle.replace(/\s+/g, '.').toLowerCase()}`, captionX, captionY)

  ctx.font = font(T, 'body')
  ctx.fillStyle = '#FFFFFF'
  const captionLines = wrapText(ctx, caption, width - captionX * 2 - 130).slice(0, 2)
  const lh = T.bodySize * T.bodyLineHeight
  for (let li = 0; li < captionLines.length; li++) {
    ctx.fillText(captionLines[li], captionX, captionY + T.nameSize + 14 + li * lh)
  }

  // Audio strip — music note + product handle as audio name
  const audioY = captionY + T.nameSize + 14 + captionLines.length * lh + 10
  ctx.font = font(T, 'meta')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('🎵  Nguyên gốc · audio gốc', captionX, audioY)

  // tiny dot-decorator on the right for cinematic balance
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  for (let k = 0; k < 3; k++) {
    ctx.beginPath()
    ctx.arc(width - 36, audioY + 8 + k * 14, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // silence the unused-var warning for dateLabelSeed (reserved for future use)
  void dateLabelSeed
}

function defaultCreatorHandle(locale: UINativeLocale): string {
  if (locale === 'vi-VN') return '@my.linh.review'
  if (locale === 'my-MY') return '@aisyah.sihat'
  if (locale === 'id-ID') return '@nadia.wellness'
  return '@beauty.review'
}

function defaultTikTokCaption(locale: UINativeLocale, productName?: string): string {
  const p = productName ?? 'sản phẩm'
  if (locale === 'vi-VN') return `dùng ${p} được 2 tuần kết quả bất ngờ luôn 😱 ai cần inbox mình nha`
  if (locale === 'my-MY') return `dah guna ${p} 2 minggu, hasil memang power gila 😱 sapa nak DM aku`
  if (locale === 'id-ID') return `udah pake ${p} 2 minggu, hasilnya beneran kelihatan 😱 mau cobain? DM ya`
  return `tried ${p} for 2 weeks and the result is wild 😱 dm if you want the link`
}
