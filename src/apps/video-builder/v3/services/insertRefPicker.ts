// Per-insert product-image picker. Chooses WHICH of the product's images to
// send as i2i references for ONE action insert — so each B-roll scene gets the
// most-fitting reference instead of every scene reusing the same single image.
//
// Lives in its own file (NOT insertRenderer.ts) so it stays clear of the
// Z98-heavy director/renderer code. Pure function, no I/O, easy to reason about.
//
// Design (per user spec):
//  - ALWAYS include the hero (clean identity anchor) first.
//  - Add the image that best matches THIS scene's action (open lid → open-lid img).
//  - Keep ≥2 refs ("anti-lazy" director) and cap at `max` ("anti-confused" — no
//    frankenstein blend of many different shots).
//  - When the 4 images are SIMILAR there is no strong match → it just adds the
//    next clean image → still ≥2, never worse than the old single-image path.

import type { ProductVisualBrief } from '../../../../services/productVisualBrief'
import type { ActionPresetId } from '../types'

// For each product-interaction preset: words in an image's `shows` description
// that indicate the image fits THAT scene. English keywords matched against the
// brief's (English) per-image descriptions. Presets not listed → no scene-match;
// the picker just uses hero + clean diverse fill.
const PRESET_IMAGE_KEYWORDS: Partial<Record<ActionPresetId, string[]>> = {
  HOLD_PRODUCT:      ['hold', 'holding', 'hand', 'front', 'clean'],
  OPEN_CAP:          ['open', 'lid', 'cap', 'unscrew', 'opening'],
  POINT_LABEL:       ['label', 'text', 'front', 'ingredient', 'back'],
  DRINK:             ['drink', 'pour', 'glass', 'liquid', 'sip'],
  TAKE_PILL:         ['pill', 'tablet', 'capsule', 'blister'],
  UNBOX:             ['box', 'unbox', 'package', 'packaging', 'open'],
  SHOW_PACKAGE:      ['box', 'package', 'packaging', 'front'],
  PRODUCT_CLOSEUP:   ['close', 'closeup', 'macro', 'detail', 'texture'],
  DESK_PRODUCT:      ['desk', 'table', 'flat', 'lifestyle', 'scene', 'background'],
  BAG_PRODUCT_PULL:  ['bag', 'pull'],
  PRODUCT_IN_ACTION: ['use', 'using', 'apply', 'applying', 'action', 'open'],
}

function clampIndex(i: number, n: number): number {
  return Math.min(Math.max(Math.round(i), 0), Math.max(n - 1, 0))
}

/**
 * Ordered list of product-image indexes to use as references for one insert.
 * Always ≥1; ≥2 when the brief has ≥2 images. Capped at `max` (default 3).
 * Returns [0] (legacy single image) when there's no brief.
 */
export function pickProductRefIndexes(
  brief: ProductVisualBrief | undefined,
  presetId: ActionPresetId,
  quote?: string,
  conceptPrompt?: string,
  max = 3,
): number[] {
  if (!brief || !brief.perImage || brief.perImage.length === 0) return [0]
  const n = brief.perImage.length
  const hero = clampIndex(brief.heroImageIndex, n)

  const kw = PRESET_IMAGE_KEYWORDS[presetId] ?? []
  const freeText = `${conceptPrompt ?? ''} ${quote ?? ''}`.toLowerCase()
  const scoreOf = (shows: string): number => {
    const s = (shows ?? '').toLowerCase()
    let sc = 0
    for (const k of kw) if (s.includes(k)) sc += 2
    // light bonus for any 4+ char word shared with the director's free text
    for (const w of freeText.split(/\W+/)) if (w.length >= 4 && s.includes(w)) sc += 1
    return sc
  }
  const scored = brief.perImage.map((p, i) => ({
    index: clampIndex(typeof p.index === 'number' ? p.index : i, n),
    clean: p.clean === true,
    score: scoreOf(p.shows),
  }))

  const order: number[] = []
  const add = (i: number) => { if (i >= 0 && i < n && !order.includes(i)) order.push(i) }

  add(hero) // 1) hero always first (named "reference image #1" in the prompt)

  // 2) best scene-match, distinct from hero
  const best = scored
    .filter((s) => s.index !== hero && s.score > 0)
    .sort((a, b) => b.score - a.score)[0]
  if (best) add(best.index)

  // 3) fill with clean images (higher score first) up to `max` — keeps identity
  //    strong; with diverse images this naturally adds visual variety.
  for (const s of scored.filter((s) => s.clean).sort((a, b) => b.score - a.score)) {
    if (order.length >= max) break
    add(s.index)
  }

  // 4) ensure ≥2 (anti-lazy) — top up with any remaining image.
  for (const s of scored) {
    if (order.length >= Math.min(2, n)) break
    add(s.index)
  }

  return order.slice(0, max)
}
