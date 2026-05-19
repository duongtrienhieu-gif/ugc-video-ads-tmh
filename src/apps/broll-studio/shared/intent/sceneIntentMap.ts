// ── Scene Intent + Product Visibility Matrix (P4) ──────────────────────────
//
// Single source of truth for "given a section role, how much product is
// allowed / required". Prompt builders read this to shape [VISIBILITY]
// blocks; QC reads the same to validate post-render.

import type { SectionRole, ProductVisibility } from '../../types/narrative'

/** allowProduct: 'none' = absolutely forbidden. 'soft' = peripheral. */
export interface SceneIntent {
  allowProduct: 'none' | 'soft' | 'medium' | 'strong' | 'hero'
  /** Suggested face dominance for this role. */
  faceDominance: number
  /** Suggested product dominance. */
  productDominance: number
  /** Forbidden vibes for this role. */
  forbidden: string[]
}

/**
 * Scene intent map — extend as new section types are introduced. The
 * Phase 4 spec's `productVisibilityRules` lives here in normalised form.
 */
export const SCENE_INTENT: Record<SectionRole, SceneIntent> = {
  pain: {
    allowProduct: 'none',
    faceDominance: 0.7,
    productDominance: 0.0,
    forbidden: ['product showcase', 'smiling hero pose', 'premium lighting'],
  },
  storytelling_intro: {
    allowProduct: 'none',
    faceDominance: 0.6,
    productDominance: 0.0,
    forbidden: ['product label visible', 'hero shot composition'],
  },
  lifestyle: {
    allowProduct: 'soft',
    faceDominance: 0.5,
    productDominance: 0.25,
    forbidden: ['hard-sell framing', 'centered product hero'],
  },
  social_proof: {
    allowProduct: 'medium',
    faceDominance: 0.55,
    productDominance: 0.4,
    forbidden: ['studio polish', 'influencer aesthetic'],
  },
  product_showcase: {
    allowProduct: 'hero',
    faceDominance: 0.2,
    productDominance: 0.8,
    forbidden: ['cluttered background', 'face dominates frame'],
  },
  before_after: {
    allowProduct: 'soft',
    faceDominance: 0.65,
    productDominance: 0.2,
    forbidden: ['identical clothes', 'identical pose', 'photoshop split clone'],
  },
  offer: {
    allowProduct: 'strong',
    faceDominance: 0.3,
    productDominance: 0.65,
    forbidden: ['no product visible', 'pain expression'],
  },
  cta: {
    allowProduct: 'hero',
    faceDominance: 0.25,
    productDominance: 0.8,
    forbidden: ['no product', 'unrelated background'],
  },
}

/** Convert the SceneIntent.allowProduct into a ProductVisibility level. */
export function intentToVisibility(role: SectionRole): ProductVisibility {
  const intent = SCENE_INTENT[role]
  switch (intent.allowProduct) {
    case 'none':   return 'none'
    case 'soft':   return 'soft'
    case 'medium': return 'medium'
    case 'strong': return 'high'
    case 'hero':   return 'very_high'
  }
}

/**
 * Build a [VISIBILITY] prompt block describing what the renderer should
 * allow / forbid product-wise for this section role.
 */
export function buildVisibilityBlock(role: SectionRole): string {
  const intent = SCENE_INTENT[role]
  const lines = [
    `Section role: ${role}.`,
    `Product visibility policy: ${intent.allowProduct}.`,
    `Forbidden in this section: ${intent.forbidden.join('; ')}.`,
  ]
  if (intent.allowProduct === 'none') {
    lines.push('THE PRODUCT MUST NOT APPEAR. No bottle, no label, no packaging — not even in the background or out of focus.')
  }
  return `[VISIBILITY]\n${lines.join(' ')}`
}
