// ─────────────────────────────────────────────────────────────────────
// Image Scene Synthesis — RENDERER ROUTING (LOCKED)
//
// Deterministic per-imageRole routing decision. Replaces the prior
// fragment-intent-driven rendererRouting which selected from {gptImage /
// flux / sdxl} based on 9 axes.
//
// New rule (single source of truth):
//   - gpt-image-2 (cheap, no reference lock)
//        → object-trace WHEN no product reference (pure no-person flat-lay)
//   - gpt-4o-image (premium, supports up to 5 reference URLs)
//        → ALL other imageRoles (character continuity OR product lock)
//
// Reference policy:
//   - hero-anchor: no reference (this IS the anchor — first to gen)
//   - mood-supporting / lifestyle-context: character reference (anchor URL)
//   - proof-callout: character + product references (both, up to 2 URLs)
//   - object-trace: product reference only if uploaded
// ─────────────────────────────────────────────────────────────────────

import type { ImageRole } from '../../composer'
import type { RouterDecision, SceneRendererKey } from '../types'

/** Whether a given imageRole intrinsically shows the product. */
const PRODUCT_VISIBLE_ROLES = new Set<ImageRole>([
  'proof-callout',
  'lifestyle-context',
  // object-trace MAY include product if reference is available
])

/** Whether a given imageRole intrinsically shows a person. */
const CHARACTER_BEARING_ROLES = new Set<ImageRole>([
  'hero-anchor',
  'mood-supporting',
  'lifestyle-context',
  'proof-callout',
])

export function decideRouting(
  imageRole: ImageRole,
  hasProductReference: boolean,
): RouterDecision {
  // hero-anchor — generate FIRST, no references, this IS the anchor
  if (imageRole === 'hero-anchor') {
    return {
      renderer: 'gpt4o',
      requiresProductReference: false,
      requiresCharacterReference: false,
      isCharacterAnchorSource: true,
    }
  }

  // object-trace: prefer gpt-image-2 (cheap) — flat-lay, no person needed.
  // If product reference available AND product is naturally part of trace,
  // route to gpt-4o-image with product lock (still no person).
  if (imageRole === 'object-trace') {
    if (hasProductReference) {
      return {
        renderer: 'gpt4o',
        requiresProductReference: true,
        requiresCharacterReference: false,
        isCharacterAnchorSource: false,
      }
    }
    return {
      renderer: 'gptImage',
      requiresProductReference: false,
      requiresCharacterReference: false,
      isCharacterAnchorSource: false,
    }
  }

  // none — no image, but caller should skip before reaching here
  if (imageRole === 'none') {
    return {
      renderer: 'gpt4o',
      requiresProductReference: false,
      requiresCharacterReference: false,
      isCharacterAnchorSource: false,
    }
  }

  // All other character-bearing roles → gpt-4o-image with refs
  const requiresProduct = PRODUCT_VISIBLE_ROLES.has(imageRole) && hasProductReference
  const requiresCharacter = CHARACTER_BEARING_ROLES.has(imageRole)

  return {
    renderer: 'gpt4o',
    requiresProductReference: requiresProduct,
    requiresCharacterReference: requiresCharacter,
    isCharacterAnchorSource: false,
  }
}

/** Returns true if THIS role must be generated BEFORE other character roles. */
export function isAnchorRole(imageRole: ImageRole): boolean {
  return imageRole === 'hero-anchor'
}

/** Returns the renderer key with no other input — for legacy registry lookup. */
export function getRendererKey(decision: RouterDecision): SceneRendererKey {
  return decision.renderer
}
