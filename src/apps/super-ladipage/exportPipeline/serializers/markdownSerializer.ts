// ─────────────────────────────────────────────────────────────────────
// Export Pipeline — markdownSerializer (P14)
//
// ExportablePage → markdown string. One section per H2. Includes:
//   - section title (role label)
//   - paragraphs as body
//   - inline proof block (if present)
//   - exportGuide as HTML comment metadata for marketer reference
//
// LOCKED: no styling, no inline CSS, no HTML. Pure markdown. Marketer
// pastes into Ladipage rich-text editor.
// ─────────────────────────────────────────────────────────────────────

import type { ExportablePage, ExportableSection } from '../types'

export interface MarkdownExportOptions {
  /** Include exportGuide metadata as HTML comments. Default true. */
  includeMeta?: boolean
  /** Include section IDs in headers for QA. Default false. */
  includeSectionIds?: boolean
}

export function serializeToMarkdown(
  page: ExportablePage,
  options: MarkdownExportOptions = {},
): string {
  const { includeMeta = true, includeSectionIds = false } = options
  const parts: string[] = []

  parts.push(`# Storytelling Pack — ${page.totalSections} sections · ${page.totalWordCount} words`)
  parts.push(``)

  for (let i = 0; i < page.sections.length; i++) {
    parts.push(serializeSection(page.sections[i], i + 1, includeMeta, includeSectionIds))
    parts.push(``)
  }

  return parts.join('\n')
}

function serializeSection(
  section: ExportableSection,
  index: number,
  includeMeta: boolean,
  includeSectionIds: boolean,
): string {
  const lines: string[] = []
  const title = section.role.replace(/-/g, ' ')
  const idSuffix = includeSectionIds ? ` _(${section.id})_` : ''
  lines.push(`## ${index}. ${title}${idSuffix}`)
  lines.push(``)

  if (includeMeta) {
    lines.push(`<!--`)
    lines.push(`  intent: ${section.exportGuide.sectionIntent}`)
    lines.push(`  padding: ${section.exportGuide.suggestedPadding} · spacing: ${section.exportGuide.recommendedSpacing}`)
    lines.push(`  textWidth: ${section.exportGuide.textWidthMode} · typography: ${section.exportGuide.typographyMode}`)
    if (section.exportGuide.imageRatio) {
      lines.push(`  imageRatio: ${section.exportGuide.imageRatio}`)
    }
    lines.push(`  proofStyle: ${section.exportGuide.proofStyle} · stickyCta: ${section.exportGuide.stickyCtaRecommended}`)
    lines.push(`-->`)
    lines.push(``)
  }

  for (const para of section.paragraphs) {
    lines.push(para)
    lines.push(``)
  }

  if (section.inlineProof) {
    lines.push(`> ${section.inlineProof.quote}`)
    if (section.inlineProof.author) {
      lines.push(`> — ${section.inlineProof.author}${section.inlineProof.meta ? `, ${section.inlineProof.meta}` : ''}`)
    }
    lines.push(``)
  }

  return lines.join('\n')
}
