// ── Designed-Graphic Layout Grid Helpers (P7) ───────────────────────────────
//
// Pure geometry — given a layout descriptor, compute column rects /
// content rects / safe-area rects. No Canvas API dependency so this is
// trivially testable.

import type { DesignedGraphicLayout } from '../../types/designedGraphic'

export interface Rect { x: number; y: number; width: number; height: number }

/** Inner content rect after subtracting padding. */
export function contentRect(layout: DesignedGraphicLayout): Rect {
  return {
    x: layout.padding.left,
    y: layout.padding.top,
    width: layout.canvasSize.width - layout.padding.left - layout.padding.right,
    height: layout.canvasSize.height - layout.padding.top - layout.padding.bottom,
  }
}

/** Single column rect at column index `col` (0-based). */
export function columnRect(
  layout: DesignedGraphicLayout,
  col: number,
  gutterPx: number = 24,
): Rect {
  const inner = contentRect(layout)
  const totalGutters = gutterPx * (layout.gridColumns - 1)
  const colWidth = (inner.width - totalGutters) / layout.gridColumns
  return {
    x: inner.x + col * (colWidth + gutterPx),
    y: inner.y,
    width: colWidth,
    height: inner.height,
  }
}

/** Span N columns starting at index `col`. */
export function spanColumns(
  layout: DesignedGraphicLayout,
  col: number,
  span: number,
  gutterPx: number = 24,
): Rect {
  const first = columnRect(layout, col, gutterPx)
  const last  = columnRect(layout, col + span - 1, gutterPx)
  return {
    x: first.x,
    y: first.y,
    width: last.x + last.width - first.x,
    height: first.height,
  }
}

/** Divide a rect into N equal vertical sections — for infographic rows. */
export function splitVertical(rect: Rect, sections: number, gapPx: number = 16): Rect[] {
  const totalGap = gapPx * (sections - 1)
  const h = (rect.height - totalGap) / sections
  const out: Rect[] = []
  for (let i = 0; i < sections; i++) {
    out.push({
      x: rect.x,
      y: rect.y + i * (h + gapPx),
      width: rect.width,
      height: h,
    })
  }
  return out
}

/**
 * Common layouts pre-built — module factories pick one by id rather
 * than redeclaring padding + grid for every variant.
 */
export const LAYOUT_PRESETS: Record<string, DesignedGraphicLayout> = {
  'infographic-4x5': {
    canvasSize: { width: 1080, height: 1350 },
    gridColumns: 12,
    padding: { top: 80, right: 80, bottom: 80, left: 80 },
    templateId: 'infographic-4x5-v1',
  },
  'infographic-1x1': {
    canvasSize: { width: 1080, height: 1080 },
    gridColumns: 12,
    padding: { top: 64, right: 64, bottom: 64, left: 64 },
    templateId: 'infographic-1x1-v1',
  },
  'cta-banner-16x9': {
    canvasSize: { width: 1920, height: 1080 },
    gridColumns: 12,
    padding: { top: 96, right: 120, bottom: 96, left: 120 },
    templateId: 'cta-banner-16x9-v1',
  },
  'cta-banner-4x5': {
    canvasSize: { width: 1080, height: 1350 },
    gridColumns: 12,
    padding: { top: 96, right: 80, bottom: 96, left: 80 },
    templateId: 'cta-banner-4x5-v1',
  },
}

export function findLayout(id: string): DesignedGraphicLayout {
  return LAYOUT_PRESETS[id] ?? LAYOUT_PRESETS['infographic-4x5']
}
