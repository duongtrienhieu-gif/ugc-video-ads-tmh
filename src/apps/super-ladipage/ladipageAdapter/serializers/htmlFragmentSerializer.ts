// ─────────────────────────────────────────────────────────────────────
// Ladipage Adapter — htmlFragmentSerializer (P16A)
//
// LadipageExportBundle → clipboard-ready HTML fragments. Two outputs:
//   - serializeBundleHtml: full page as one HTML string
//   - serializeSectionHtml: per-section HTML for paste-one-at-a-time
//
// Mobile-tuned inline styles. No JS. No external assets. Suitable for
// Ladipage HTML embed widgets or rich-text blocks.
// ─────────────────────────────────────────────────────────────────────

import type { LadipageExportBundle, LadipageSection } from '../types'
import { buildHtmlFragment } from '../config/htmlFragmentTemplates'

/** Build full-page HTML. Each section in its own <section> tag. */
export function serializeBundleHtml(bundle: LadipageExportBundle): string {
  const parts: string[] = []
  parts.push(`<!-- Ladipage Export Bundle · ${bundle.bundleId} · ${bundle.createdAt} -->`)
  parts.push(`<!-- ${bundle.sections.length} sections · ${bundle.meta.totalWordCount} words · ~${bundle.meta.estimatedScrollTimeSec}s scroll -->`)
  parts.push(``)
  parts.push(`<div data-ladipage-export="${bundle.bundleId}" style="max-width:480px;margin:0 auto;background:#fff;">`)
  for (const section of bundle.sections) {
    parts.push(buildHtmlFragment(section))
    parts.push(``)
  }
  parts.push(`</div>`)
  return parts.join('\n')
}

/** Build HTML for a single section. */
export function serializeSectionHtml(section: LadipageSection): string {
  const header = `<!-- Section ${section.order + 1} · ${section.template} · ${section.intent} -->`
  return `${header}\n${buildHtmlFragment(section)}`
}
