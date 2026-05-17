// Malaysia news article screenshot composer — 4:5 canvas.
// Mimics mStar / Berita Harian / health.com.my style: publication header,
// big headline, byline, hero image, body text columns. Looks like a
// screenshot from a phone browsing a Malaysian health/news portal.

import type { Composer } from '../templateEngine'
import {
  wrapText, loadImage, resolveImageRef, addJpegNoise,
} from '../templateEngine'

export interface NewsArticleParams {
  publication: string         // "mStar", "Berita Harian", "Health.com.my"
  publicationColor?: string   // theme color
  headline: string
  subheadline?: string
  bylineAuthor?: string       // "Oleh Aisyah Rahman"
  bylineDate?: string         // "20 Mei 2026"
  bodyParagraphs: string[]    // up to 3 short paragraphs
  heroImageRef?: string
}

const COLORS = {
  bg:        '#FFFFFF',
  text:      '#222222',
  textMuted: '#666666',
  divider:   '#E0E0E0',
  link:      '#0066CC',
}

export const newsArticleComposer: Composer<NewsArticleParams> = {
  id: 'news-article',
  defaultSize: { width: 800, height: 1000 },

  async draw(ctx, params, { width, height }) {
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, width, height)

    const pubColor = params.publicationColor ?? '#C8102E'

    // ── Status bar ─────────────────────────────────────────────────────
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, 40)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 18px -apple-system, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText('21:08', 24, 22)
    ctx.fillText('100%', width - 70, 22)

    // ── Browser URL bar mock ──────────────────────────────────────────
    ctx.fillStyle = '#F0F0F0'
    ctx.fillRect(0, 40, width, 52)
    ctx.fillStyle = '#FFFFFF'
    const urlBarY = 52
    ctx.beginPath()
    ctx.roundRect(20, urlBarY, width - 100, 30, 15)
    ctx.fill()
    ctx.fillStyle = COLORS.textMuted
    ctx.font = '500 14px -apple-system, sans-serif'
    const slug = params.publication.toLowerCase().replace(/\s+/g, '')
    ctx.fillText(`🔒 ${slug}.com.my/health/article/...`, 36, urlBarY + 20)
    // Refresh icon
    ctx.fillStyle = '#666666'
    ctx.font = '500 18px -apple-system, sans-serif'
    ctx.fillText('↻', width - 68, urlBarY + 22)

    // ── Publication header ────────────────────────────────────────────
    let cursorY = 100
    ctx.fillStyle = pubColor
    ctx.fillRect(0, cursorY, width, 60)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 32px -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(params.publication, 24, cursorY + 30)
    // Section chip
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.beginPath()
    ctx.roundRect(width - 120, cursorY + 18, 96, 26, 13)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '600 14px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('KESIHATAN', width - 72, cursorY + 32)
    ctx.textAlign = 'left'

    cursorY += 80

    // ── Headline ──────────────────────────────────────────────────────
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 32px -apple-system, "Segoe UI", Georgia, serif'
    const padX = 24
    const headlineLines = wrapText(ctx, params.headline, width - padX * 2)
    for (const line of headlineLines.slice(0, 3)) {
      ctx.fillText(line, padX, cursorY + 28)
      cursorY += 40
    }
    cursorY += 6

    // ── Subheadline ───────────────────────────────────────────────────
    if (params.subheadline) {
      ctx.fillStyle = COLORS.textMuted
      ctx.font = '500 20px -apple-system, sans-serif'
      const subLines = wrapText(ctx, params.subheadline, width - padX * 2)
      for (const line of subLines.slice(0, 2)) {
        ctx.fillText(line, padX, cursorY + 22)
        cursorY += 28
      }
      cursorY += 6
    }

    // ── Byline ─────────────────────────────────────────────────────────
    ctx.fillStyle = COLORS.textMuted
    ctx.font = '500 16px -apple-system, sans-serif'
    const byline = `${params.bylineAuthor ?? 'Oleh: Penulis'} · ${params.bylineDate ?? '20 Mei 2026'}`
    ctx.fillText(byline, padX, cursorY + 18)
    cursorY += 30

    // Reaction strip (👁 👍 💬 ↗)
    ctx.fillStyle = COLORS.textMuted
    ctx.font = '500 14px -apple-system, sans-serif'
    ctx.fillText('👁 12.4K  👍 247  💬 89  ↗ Kongsi', padX, cursorY + 14)
    cursorY += 28

    // Divider
    ctx.fillStyle = COLORS.divider
    ctx.fillRect(padX, cursorY, width - padX * 2, 1)
    cursorY += 14

    // ── Hero image ────────────────────────────────────────────────────
    if (params.heroImageRef) {
      const url = await resolveImageRef(params.heroImageRef)
      if (url) {
        try {
          const img = await loadImage(url)
          const heroH = 240
          ctx.fillStyle = '#F0F0F0'
          ctx.fillRect(padX, cursorY, width - padX * 2, heroH)
          // cover fit
          const ratio = Math.max(
            (width - padX * 2) / img.width,
            heroH / img.height,
          )
          const drawW = img.width * ratio
          const drawH = img.height * ratio
          ctx.save()
          ctx.beginPath()
          ctx.rect(padX, cursorY, width - padX * 2, heroH)
          ctx.clip()
          ctx.drawImage(
            img,
            padX + (width - padX * 2 - drawW) / 2,
            cursorY + (heroH - drawH) / 2,
            drawW, drawH,
          )
          ctx.restore()
          // Caption strip below image
          ctx.fillStyle = COLORS.textMuted
          ctx.font = 'italic 14px -apple-system, sans-serif'
          ctx.fillText('Gambar hiasan / sumber: pengeluar', padX, cursorY + heroH + 18)
          cursorY += heroH + 32
        } catch {/* skip */}
      }
    }

    // ── Body paragraphs ───────────────────────────────────────────────
    ctx.fillStyle = COLORS.text
    ctx.font = '500 20px -apple-system, Georgia, serif'
    for (const para of params.bodyParagraphs.slice(0, 4)) {
      const paraLines = wrapText(ctx, para, width - padX * 2)
      for (const line of paraLines) {
        if (cursorY > height - 80) break
        ctx.fillText(line, padX, cursorY + 22)
        cursorY += 30
      }
      cursorY += 14
      if (cursorY > height - 80) break
    }

    // Fade-to-white at bottom (article continues — "Baca lagi")
    const fadeY = height - 80
    const grad = ctx.createLinearGradient(0, fadeY, 0, height)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(1, 'rgba(255,255,255,1)')
    ctx.fillStyle = grad
    ctx.fillRect(0, fadeY, width, 80)

    // "Baca seterusnya" button
    ctx.fillStyle = pubColor
    ctx.font = 'bold 18px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Baca seterusnya ↓', width / 2, height - 22)
    ctx.textAlign = 'left'

    // Subtle JPEG artifacts
    addJpegNoise(ctx, width, height, 0.022, `news-${params.publication}`)
  },
}
