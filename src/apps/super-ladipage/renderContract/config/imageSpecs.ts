// ─────────────────────────────────────────────────────────────────────
// Render Contract — IMAGE SPECS per ImageRole (P5 baseline)
//
// Per ImageRole: recommended count + aspect ratio. Renderer-agnostic
// — no pixel sizes, no responsive breakpoints, just aspect intent.
// ─────────────────────────────────────────────────────────────────────

import type { ImageRole } from '../../composer'
import type { ImageAspectRatio } from '../types'

export interface ImageSpec {
  recommendedCount: number
  aspectRatio?: ImageAspectRatio
}

export const IMAGE_SPECS: Record<ImageRole, ImageSpec> = {
  'hero-anchor': {
    recommendedCount: 1,
    aspectRatio:      '4:5',     // portrait-ish, mobile-optimal hero
  },
  'mood-supporting': {
    recommendedCount: 1,
    aspectRatio:      '4:5',
  },
  'object-trace': {
    recommendedCount: 1,
    aspectRatio:      '1:1',     // flat-lay objects — square reads best
  },
  'lifestyle-context': {
    recommendedCount: 1,
    aspectRatio:      '16:9',    // wide environmental shot
  },
  'proof-callout': {
    recommendedCount: 0,         // proof-callout = inline quote, no image
    // aspectRatio omitted
  },
  // 2026-05-30 — Dedicated product hero shot (60-80% of frame, label
  // readable). Square reads best for product hero on mobile vertical
  // scroll — matches Shopee / TikTok Shop listing image convention so
  // marketers can repurpose the asset.
  'hero-product': {
    recommendedCount: 1,
    aspectRatio:      '1:1',
  },
  'none': {
    recommendedCount: 0,
  },
}

/** Lookup image spec for image role. */
export function getImageSpec(role: ImageRole): ImageSpec {
  return IMAGE_SPECS[role]
}
