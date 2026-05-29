// ─────────────────────────────────────────────────────────────────────
// Render Contract — deriveRenderContract (P5 core override logic)
//
// Per-section: ComposedSection → RenderContract. Where system starts
// thinking like mobile UX — not content generation.
//
// Baseline: lookup defaults per SectionRole (layout / image / typography
// / energy).
//
// Override logic (the IMPORTANT part):
//   - fragmented density → drop image, switch to text-only layout
//   - heavy scrollWeight → spacingPreset 'airy' (counter-balance)
//   - inline proof present + non-hero → proofPresentation override
//   - ctaInline true → ctaPlacement appropriate
//   - empty paragraphs (proof-only section) → layout-with-inline-proof
// ─────────────────────────────────────────────────────────────────────

import type { ComposedSection } from '../../composer'
import type { RenderContract, LayoutType, SpacingPreset } from '../types'
import { getLayoutPattern } from '../config/layoutPatterns'
import { getImageSpec } from '../config/imageSpecs'
import { deriveTypographySpec } from '../config/typographySpecs'
import { getVisualEnergy } from '../config/visualEnergyMap'
import { computeProofPresentation } from './computeProofPresentation'
import { computeCtaPlacement } from './computeCtaPlacement'

/** Map ComposedSection spacing hints to renderContract spacing preset.
 *  Heavy scroll weight overrides to airy (counter-balance reading effort). */
function spacingFromComposer(section: ComposedSection): SpacingPreset {
  if (section.scrollWeight === 'heavy') return 'airy'

  // Compose hints: average of spacingBefore + spacingAfter
  const before = section.spacingBefore
  const after = section.spacingAfter

  if (before === 'wide' || after === 'wide') return 'airy'
  if (before === 'tight' && after === 'tight') return 'snug'
  return 'comfortable'
}

/** Apply override logic: density 'fragmented' → text-only + no image. */
function applyFragmentedDensityOverride(
  baseLayoutType: LayoutType,
  section: ComposedSection,
): { layoutType: LayoutType; recommendedImageCount: number } {
  if (section.density === 'fragmented' && section.role !== 'hero-recognition') {
    return { layoutType: 'text-only', recommendedImageCount: 0 }
  }
  const spec = getImageSpec(section.imageRole)
  return { layoutType: baseLayoutType, recommendedImageCount: spec.recommendedCount }
}

/** Apply override: inline proof on non-hero → text-with-inline-proof layout. */
function applyInlineProofOverride(
  layoutType: LayoutType,
  section: ComposedSection,
): LayoutType {
  if (section.inlineProof && section.role !== 'hero-recognition' && layoutType === 'text-only') {
    return 'text-with-inline-proof'
  }
  return layoutType
}

/** Derive render contract for a single composed section. */
export function deriveRenderContract(section: ComposedSection): RenderContract {
  // ── Step 1: baseline lookups per role ─────────────────────────────
  const layoutPattern = getLayoutPattern(section.role)
  const imageSpec = getImageSpec(section.imageRole)
  const typography = deriveTypographySpec(section.density, section.role)
  const energyEntry = getVisualEnergy(section.role)

  // ── Step 2: override logic ─────────────────────────────────────────
  const { layoutType: overriddenLayout, recommendedImageCount } =
    applyFragmentedDensityOverride(layoutPattern.layoutType, section)

  const finalLayoutType = applyInlineProofOverride(overriddenLayout, section)

  const proofPresentation = computeProofPresentation(section)
  const ctaPlacement = computeCtaPlacement(section)
  const spacingPreset = spacingFromComposer(section)

  return {
    layoutType:           finalLayoutType,
    mobilePattern:        layoutPattern.mobilePattern,
    recommendedImageCount,
    imageAspectRatio:     recommendedImageCount > 0 ? imageSpec.aspectRatio : undefined,
    textChunking:         typography.textChunking,
    typographyDominance:  typography.typographyDominance,
    proofPresentation,
    ctaPlacement,
    spacingPreset,
    visualEnergy:         energyEntry.energy,
    feelNote:             energyEntry.feelNote,
  }
}
