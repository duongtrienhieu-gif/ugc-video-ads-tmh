// ─────────────────────────────────────────────────────────────────────
// Product Info Layer — planPISections (data + niche driven, no hardcode)
//
// Decides WHICH PI section types to generate for THIS pack based on:
//   - presence of input data (ingredients / USP / pricing fields)
//   - niche-specific suitability (eg before-after skipped for mental-health)
//
// Skipping logic = SOFT — if data missing, fall back gracefully but
// still try to generate (Gemini will weave around missing fields).
// Hard skip only when explicit signal says "this section type is wrong
// for this niche".
// ─────────────────────────────────────────────────────────────────────

import type { PlannerInput, PIPlan, PIAnchorPosition, PISectionType } from '../types'
import { PI_ANCHOR_BY_TYPE } from '../types'
import type { NicheKey } from '../../storytelling/types'

/** Niches where "social proof" should NOT come from peer voices (privacy-
 *  sensitive niches → social proof handled in mechanism block via doctor
 *  reference, not public testimonials). */
const SHAME_HEAVY_NICHES: ReadonlyArray<NicheKey> = [
  'hemorrhoids-digestive-shame',
  'prostate-urology',
  'mental-health',
]

/** Niches where pricing-narrator should be EXTRA quiet (high-trust products
 *  where any mention of price triggers skepticism). For now keep all niches
 *  with normal pricing-narrator; this list is reserved for future tuning. */
// const PRICING_AVOIDANT_NICHES: ReadonlyArray<NicheKey> = []

function hasData(field: string): boolean {
  return field.trim().length > 5
}

export function planPISections(input: PlannerInput): PIPlan {
  const sections: PIPlan['sections'] = []
  const skipped: PIPlan['skipped'] = []

  // ── 1. mechanism-personal ─── ALWAYS (driven by synthesis brief) ──
  if (input.synthesizedBrief.productEssence.length > 20) {
    sections.push({
      type: 'mechanism-personal',
      anchor: PI_ANCHOR_BY_TYPE['mechanism-personal'],
      reason: 'always-on; synthesis brief has product essence',
    })
  } else {
    skipped.push({
      type: 'mechanism-personal',
      reason: 'synthesis brief missing — would fabricate mechanism',
    })
  }

  // ── 2. ingredients-usp-woven ─── only if ingredients OR USP data ──
  const hasIngredients = hasData(input.productIngredients)
  const hasUsp = hasData(input.productUsp)
  if (hasIngredients || hasUsp) {
    sections.push({
      type: 'ingredients-usp-woven',
      anchor: PI_ANCHOR_BY_TYPE['ingredients-usp-woven'],
      reason: `data available: ingredients=${hasIngredients}, usp=${hasUsp}`,
    })
  } else {
    skipped.push({
      type: 'ingredients-usp-woven',
      reason: 'no ingredients field, no USP field — would invent fake details',
    })
  }

  // ── 3. usage-faq-personal ─── ALWAYS (uses niche objection patterns) ──
  sections.push({
    type: 'usage-faq-personal',
    anchor: PI_ANCHOR_BY_TYPE['usage-faq-personal'],
    reason: 'always-on; derives FAQ from niche objection patterns',
  })

  // ── 4. social-proof-collective ─── conditional on niche ──
  if (!SHAME_HEAVY_NICHES.includes(input.niche)) {
    sections.push({
      type: 'social-proof-collective',
      anchor: PI_ANCHOR_BY_TYPE['social-proof-collective'],
      reason: 'niche supports peer-voice testimonials',
    })
  } else {
    skipped.push({
      type: 'social-proof-collective',
      reason: `niche '${input.niche}' is shame-heavy — peer voices break dignity tone`,
    })
  }

  // ── 5. pricing-narrator ─── only if pricing data ──
  if (hasData(input.productPricing)) {
    sections.push({
      type: 'pricing-narrator',
      anchor: PI_ANCHOR_BY_TYPE['pricing-narrator'],
      reason: 'pricing input provided',
    })
  } else {
    skipped.push({
      type: 'pricing-narrator',
      reason: 'no pricing input — would fabricate offer',
    })
  }

  return { sections, skipped }
}

/** Return only the section types that planner WILL generate. */
export function getPlannedTypes(plan: PIPlan): PISectionType[] {
  return plan.sections.map((s) => s.type)
}

/** Get anchor for a given section type from a plan. */
export function getAnchorForType(
  plan: PIPlan,
  type: PISectionType,
): PIAnchorPosition | undefined {
  return plan.sections.find((s) => s.type === type)?.anchor
}
