// ─────────────────────────────────────────────────────────────────────
// Ladipage Adapter — HTML fragment templates (P16A)
//
// Per-template HTML string builders. Output is RAW HTML (mobile-tuned
// inline styles) suitable for clipboard paste into Ladipage rich-text
// blocks or HTML embed widgets.
//
// LOCKED: no JS, no external assets, no third-party scripts. Inline
// styles only (Ladipage strips most class names). Minimal markup.
//
// Each builder takes LadipageSection → string. Idempotent + pure.
// ─────────────────────────────────────────────────────────────────────

import type { LadipageSection, LadipageTemplateName } from '../types'

// ─── HTML helpers (mobile-tuned inline styles) ─────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const PADDING_PX: Record<string, string> = {
  tight: '12px 16px',
  comfortable: '20px 20px',
  spacious: '32px 24px',
}

const SPACING_PX: Record<string, string> = {
  tight: '8px',
  normal: '16px',
  wide: '28px',
}

const TEXT_WIDTH_PX: Record<string, string> = {
  narrow: '480px',
  standard: '600px',
  wide: '100%',
}

function containerOpen(section: LadipageSection): string {
  const p = PADDING_PX[section.layout.padding] ?? PADDING_PX.comfortable
  const w = TEXT_WIDTH_PX[section.layout.textWidth] ?? TEXT_WIDTH_PX.standard
  return `<section data-template="${section.template}" data-source="${escapeHtml(section.sourceSectionId)}" style="padding:${p};max-width:${w};margin:0 auto;font-family:system-ui,-apple-system,sans-serif;line-height:1.55;color:#1c1917;">`
}

function containerClose(): string {
  return `</section>`
}

function imageBlock(section: LadipageSection): string {
  if (!section.image || section.image.urls.length === 0) {
    const aspect = section.image?.aspectRatio ?? '4:5'
    return `<div data-image-slot="${aspect}" style="background:#f5f5f4;border:1px dashed #a8a29e;aspect-ratio:${aspect.replace(':', '/')};display:flex;align-items:center;justify-content:center;color:#78716c;font-family:monospace;font-size:11px;margin-bottom:16px;">[image · ${aspect} · upload via Ladipage]</div>`
  }
  return `<img src="${escapeHtml(section.image.urls[0])}" alt="" style="width:100%;height:auto;display:block;margin-bottom:16px;" />`
}

function headlineBlock(text: string, layout: LadipageSection['layout']): string {
  if (layout.typography === 'headline-led') {
    return `<h2 style="font-size:24px;line-height:1.25;font-weight:600;margin:0 0 ${SPACING_PX[layout.spacing] ?? SPACING_PX.normal} 0;">${escapeHtml(text)}</h2>`
  }
  return `<p style="font-size:18px;font-weight:500;line-height:1.4;margin:0 0 ${SPACING_PX[layout.spacing] ?? SPACING_PX.normal} 0;">${escapeHtml(text)}</p>`
}

function bodyBlock(paragraphs: string[], layout: LadipageSection['layout']): string {
  const gap = SPACING_PX[layout.spacing] ?? SPACING_PX.normal
  return paragraphs
    .map(
      (p) =>
        `<p style="font-size:16px;line-height:1.6;margin:0 0 ${gap} 0;">${escapeHtml(p)}</p>`,
    )
    .join('\n')
}

function proofBlock(
  proof: NonNullable<LadipageSection['text']['proof']>,
  proofStyle: LadipageSection['layout']['proofStyle'],
): string {
  if (proofStyle === 'none') return ''
  const attribution = proof.author
    ? `<div style="margin-top:8px;font-size:13px;color:#78716c;font-style:italic;">— ${escapeHtml(proof.author)}${proof.meta ? `, ${escapeHtml(proof.meta)}` : ''}</div>`
    : ''

  switch (proofStyle) {
    case 'subtle':
      return `<div style="margin:16px 0;font-size:14px;color:#57534e;font-style:italic;">${escapeHtml(proof.quote)} ${attribution}</div>`
    case 'standard':
      return `<blockquote style="border-left:3px solid #a8a29e;padding:8px 0 8px 16px;margin:20px 0;font-style:italic;color:#44403c;">"${escapeHtml(proof.quote)}"${attribution}</blockquote>`
    case 'spotlight':
      return `<div style="border:1px solid #d6d3d1;border-radius:8px;padding:20px;margin:24px 0;background:#fafaf9;"><div style="font-size:17px;line-height:1.5;color:#1c1917;">"${escapeHtml(proof.quote)}"</div>${attribution}</div>`
  }
}

function ctaBlock(ctaText: string | undefined, sticky: boolean): string {
  if (!ctaText) return ''
  const stickyStyle = sticky
    ? 'position:sticky;bottom:0;background:#fff;border-top:1px solid #e7e5e4;padding:12px 16px;z-index:10;'
    : 'margin:24px 0 0 0;'
  return `<div style="${stickyStyle}"><a href="#" style="display:block;text-align:center;background:#1c1917;color:#fff;padding:14px 24px;border-radius:8px;font-weight:600;text-decoration:none;">${escapeHtml(ctaText)}</a></div>`
}

// ─── Template builders ─────────────────────────────────────────────

function buildHeroBlockTemplate(s: LadipageSection): string {
  const parts = [containerOpen(s)]
  parts.push(imageBlock(s))
  if (s.text.headline) parts.push(headlineBlock(s.text.headline, s.layout))
  parts.push(bodyBlock(s.text.body, s.layout))
  parts.push(containerClose())
  return parts.join('\n')
}

function buildBreathingNarrativeTemplate(s: LadipageSection): string {
  const parts = [containerOpen(s)]
  parts.push(imageBlock(s))
  parts.push(bodyBlock(s.text.body, s.layout))
  if (s.text.proof) parts.push(proofBlock(s.text.proof, s.layout.proofStyle))
  parts.push(containerClose())
  return parts.join('\n')
}

function buildFrustrationFlatLayTemplate(s: LadipageSection): string {
  const parts = [containerOpen(s)]
  parts.push(imageBlock(s))
  parts.push(bodyBlock(s.text.body, s.layout))
  parts.push(containerClose())
  return parts.join('\n')
}

function buildProblemAgitationTemplate(s: LadipageSection): string {
  const parts = [containerOpen(s)]
  // Text-led, centered, no image
  const centerStyle =
    `<div style="text-align:center;font-size:18px;font-style:italic;color:#44403c;line-height:1.7;">`
  parts.push(centerStyle)
  parts.push(s.text.body.map((p) => `<p style="margin:0 0 ${SPACING_PX[s.layout.spacing]} 0;">${escapeHtml(p)}</p>`).join('\n'))
  parts.push(`</div>`)
  parts.push(containerClose())
  return parts.join('\n')
}

function buildProductFeatureTemplate(s: LadipageSection): string {
  const parts = [containerOpen(s)]
  // First paragraph above image, rest below — mixed flow
  if (s.text.body.length > 0) {
    parts.push(`<p style="font-size:16px;line-height:1.6;margin:0 0 ${SPACING_PX[s.layout.spacing]} 0;">${escapeHtml(s.text.body[0])}</p>`)
  }
  parts.push(imageBlock(s))
  if (s.text.body.length > 1) {
    parts.push(bodyBlock(s.text.body.slice(1), s.layout))
  }
  if (s.text.proof) parts.push(proofBlock(s.text.proof, s.layout.proofStyle))
  parts.push(containerClose())
  return parts.join('\n')
}

function buildLifestyleUpliftTemplate(s: LadipageSection): string {
  const parts = [containerOpen(s)]
  parts.push(imageBlock(s))
  parts.push(bodyBlock(s.text.body, s.layout))
  if (s.text.proof) parts.push(proofBlock(s.text.proof, s.layout.proofStyle))
  parts.push(containerClose())
  return parts.join('\n')
}

function buildFinalCTASection(s: LadipageSection): string {
  const parts = [containerOpen(s)]
  parts.push(bodyBlock(s.text.body, s.layout))
  parts.push(`<div style="margin-top:24px;padding-top:24px;border-top:1px solid #e7e5e4;text-align:center;color:#78716c;font-size:14px;font-style:italic;">— Đến đây tôi xin dừng. Phần tiếp theo là của bạn. —</div>`)
  if (s.text.ctaText) parts.push(ctaBlock(s.text.ctaText, s.layout.stickyCtaRecommended))
  parts.push(containerClose())
  return parts.join('\n')
}

function buildTestimonialBlockTemplate(s: LadipageSection): string {
  const parts = [containerOpen(s)]
  if (s.text.proof) {
    parts.push(proofBlock(s.text.proof, 'spotlight'))
  } else {
    // Defensive: testimonial template without proof — render body as quoted feel
    parts.push(`<div style="font-style:italic;text-align:center;color:#44403c;font-size:17px;line-height:1.6;">`)
    parts.push(bodyBlock(s.text.body, s.layout))
    parts.push(`</div>`)
  }
  parts.push(containerClose())
  return parts.join('\n')
}

// ─── Dispatcher ────────────────────────────────────────────────────

const TEMPLATE_BUILDERS: Record<LadipageTemplateName, (s: LadipageSection) => string> = {
  HeroBlockTemplate:          buildHeroBlockTemplate,
  BreathingNarrativeTemplate: buildBreathingNarrativeTemplate,
  FrustrationFlatLayTemplate: buildFrustrationFlatLayTemplate,
  ProblemAgitationTemplate:   buildProblemAgitationTemplate,
  ProductFeatureTemplate:     buildProductFeatureTemplate,
  LifestyleUpliftTemplate:    buildLifestyleUpliftTemplate,
  FinalCTASection:            buildFinalCTASection,
  TestimonialBlockTemplate:   buildTestimonialBlockTemplate,
}

/** Build HTML fragment for a single Ladipage section. */
export function buildHtmlFragment(section: LadipageSection): string {
  const builder = TEMPLATE_BUILDERS[section.template]
  return builder(section)
}
