// Facebook comment screenshot composer — 4:5 canvas.
// Matches FB MY post + comment section UI: blue header, profile pic + name,
// post body + image, then 3-5 comments with avatars and Malay text. Looks
// like a screenshot from someone's phone showing a post that's getting
// social-proof engagement.

import type { Composer } from '../templateEngine'
import {
  roundRect, wrapText, loadImage, resolveImageRef,
  makeInitials, pickColorBySeed, addJpegNoise,
} from '../templateEngine'

export interface FbCommentParams {
  posterName: string
  postText: string
  productImageRef?: string  // post image
  postLikes?: number
  comments: Array<{
    name: string
    text: string
    timestamp?: string
  }>
}

const COLORS = {
  bg:         '#FFFFFF',
  fbBlue:     '#1877F2',
  text:       '#050505',
  textMuted:  '#65676B',
  border:     '#CED0D4',
  commentBg:  '#F0F2F5',
  reactBg:    '#FFFFFF',
}

export const fbCommentComposer: Composer<FbCommentParams> = {
  id: 'fb-comment',
  defaultSize: { width: 800, height: 1000 },

  async draw(ctx, params, { width, height }) {
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, width, height)

    // ── FB Header ─────────────────────────────────────────────────────
    const headerH = 60
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, width, headerH)
    // Logo
    ctx.fillStyle = COLORS.fbBlue
    ctx.beginPath()
    ctx.arc(40, headerH / 2, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 28px -apple-system, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText('f', 40, headerH / 2 + 2)
    ctx.textAlign = 'left'

    ctx.fillStyle = COLORS.fbBlue
    ctx.font = 'bold 26px -apple-system, sans-serif'
    ctx.fillText('facebook', 76, headerH / 2)
    // Search + bell icons (right)
    ctx.fillStyle = '#E4E6EB'
    ctx.beginPath()
    ctx.arc(width - 90, headerH / 2, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(width - 44, headerH / 2, 18, 0, Math.PI * 2)
    ctx.fill()
    // Bottom border
    ctx.fillStyle = COLORS.border
    ctx.fillRect(0, headerH, width, 1)

    // ── Post block ────────────────────────────────────────────────────
    let cursorY = headerH + 12
    const padX = 16

    // Poster info row
    const avatarSize = 48
    ctx.fillStyle = pickColorBySeed(params.posterName)
    ctx.beginPath()
    ctx.arc(padX + avatarSize / 2, cursorY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 18px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(makeInitials(params.posterName), padX + avatarSize / 2, cursorY + avatarSize / 2 + 2)
    ctx.textAlign = 'left'

    const nameX = padX + avatarSize + 12
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 20px -apple-system, sans-serif'
    ctx.fillText(params.posterName, nameX, cursorY + 22)
    ctx.fillStyle = COLORS.textMuted
    ctx.font = '500 15px -apple-system, sans-serif'
    ctx.fillText('2 jam lalu · 🌐', nameX, cursorY + 44)
    cursorY += avatarSize + 14

    // Post text
    ctx.fillStyle = COLORS.text
    ctx.font = '500 22px -apple-system, sans-serif'
    const postLines = wrapText(ctx, params.postText, width - padX * 2)
    for (const line of postLines.slice(0, 4)) {
      ctx.fillText(line, padX, cursorY + 22)
      cursorY += 30
    }
    cursorY += 8

    // Post image (product photo)
    if (params.productImageRef) {
      const url = await resolveImageRef(params.productImageRef)
      if (url) {
        try {
          const img = await loadImage(url)
          const imgH = 280
          ctx.fillStyle = '#000000'
          ctx.fillRect(0, cursorY, width, imgH)
          // contain fit
          const ratio = Math.min(width / img.width, imgH / img.height)
          const drawW = img.width * ratio
          const drawH = img.height * ratio
          ctx.drawImage(img, (width - drawW) / 2, cursorY + (imgH - drawH) / 2, drawW, drawH)
          cursorY += imgH
        } catch {/* skip */}
      }
    }

    // Reaction count strip
    cursorY += 8
    ctx.fillStyle = '#E7F3FF'
    ctx.beginPath()
    ctx.arc(padX + 14, cursorY + 12, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = COLORS.fbBlue
    ctx.font = 'bold 14px -apple-system, sans-serif'
    ctx.fillText('👍', padX + 7, cursorY + 18)
    ctx.fillStyle = COLORS.textMuted
    ctx.font = '500 16px -apple-system, sans-serif'
    const likes = params.postLikes ?? 247
    ctx.fillText(`${likes} · ${params.comments.length} komen`, padX + 36, cursorY + 16)
    cursorY += 30

    // Divider
    ctx.fillStyle = COLORS.border
    ctx.fillRect(padX, cursorY, width - padX * 2, 1)
    cursorY += 4

    // Reaction button row
    const btnY = cursorY
    const btnW = (width - padX * 2) / 3
    ctx.fillStyle = COLORS.textMuted
    ctx.font = '600 16px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('👍 Suka', padX + btnW / 2, btnY + 22)
    ctx.fillText('💬 Komen', padX + btnW * 1.5, btnY + 22)
    ctx.fillText('↗ Kongsi', padX + btnW * 2.5, btnY + 22)
    ctx.textAlign = 'left'
    cursorY += 36

    // Divider
    ctx.fillStyle = COLORS.border
    ctx.fillRect(padX, cursorY, width - padX * 2, 1)
    cursorY += 12

    // ── Comments ──────────────────────────────────────────────────────
    const maxComments = Math.min(params.comments.length, 4)
    for (let i = 0; i < maxComments; i++) {
      const c = params.comments[i]
      const cAvatarSize = 36
      ctx.fillStyle = pickColorBySeed(c.name)
      ctx.beginPath()
      ctx.arc(padX + cAvatarSize / 2, cursorY + cAvatarSize / 2, cAvatarSize / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 14px -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(makeInitials(c.name), padX + cAvatarSize / 2, cursorY + cAvatarSize / 2 + 2)
      ctx.textAlign = 'left'

      // Comment bubble
      const bubbleX = padX + cAvatarSize + 10
      const bubbleMaxW = width - bubbleX - padX
      ctx.font = '500 16px -apple-system, sans-serif'
      const cmtLines = wrapText(ctx, c.text, bubbleMaxW - 24)
      const bubbleH = 18 + 14 + cmtLines.length * 22 + 10

      ctx.fillStyle = COLORS.commentBg
      roundRect(ctx, bubbleX, cursorY, Math.min(bubbleMaxW, 520), bubbleH, 18)
      ctx.fill()

      // Commenter name
      ctx.fillStyle = COLORS.text
      ctx.font = 'bold 16px -apple-system, sans-serif'
      ctx.fillText(c.name, bubbleX + 12, cursorY + 22)
      // Comment text
      ctx.font = '500 16px -apple-system, sans-serif'
      let lineY = cursorY + 42
      for (const line of cmtLines.slice(0, 3)) {
        ctx.fillText(line, bubbleX + 12, lineY)
        lineY += 22
      }

      // Below bubble: Like · Reply · timestamp
      ctx.fillStyle = COLORS.textMuted
      ctx.font = '600 13px -apple-system, sans-serif'
      ctx.fillText('Suka · Balas · ' + (c.timestamp ?? `${i + 1}j`), bubbleX + 6, cursorY + bubbleH + 18)

      cursorY += bubbleH + 30
      if (cursorY > height - 80) break
    }

    // JPEG noise (lighter than TikTok)
    addJpegNoise(ctx, width, height, 0.02, `fb-${params.posterName}`)
  },
}
