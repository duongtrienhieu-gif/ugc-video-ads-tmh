// ─────────────────────────────────────────────────────────────────────
// Product Info Layer — composePIBlocks (parallel batch + interleave)
//
// Entry point per pack:
//   1. plan sections (data + niche driven)
//   2. generate planned sections in parallel
//   3. return PIBatchResult with PIBlocks sorted by anchor order
//
// Composer is RESPONSIBLE for inserting the PIBlocks into the pack at
// anchor positions — see interleaveIntoPack().
// ─────────────────────────────────────────────────────────────────────

import { planPISections } from './planPISections'
import { generatePISection } from './generatePISection'
import type {
  PlannerInput,
  GeneratorKeys,
  PIBlock,
  PIBatchResult,
  PIAnchorPosition,
} from '../types'
import { PI_SECTION_TYPE_MAP } from '../types'
import type { LandingSection } from '../../storytelling/types'

const DEFAULT_CONCURRENCY = 3

export async function composePIBlocks(
  input: PlannerInput,
  keys: GeneratorKeys,
  options: { concurrency?: number; signal?: AbortSignal } = {},
): Promise<PIBatchResult> {
  const startedAt = Date.now()
  const plan = planPISections(input)

  if (plan.sections.length === 0) {
    return {
      blocks: [],
      succeeded: 0,
      fallbackCount: 0,
      skippedCount: plan.skipped.length,
      durationMs: 0,
    }
  }

  // ── Concurrency-bounded parallel generation ────────────────────────
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY)
  const blocks: PIBlock[] = []
  let succeeded = 0
  let fallbackCount = 0
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < plan.sections.length) {
      if (options.signal?.aborted) return
      const sectionPlan = plan.sections[nextIndex++]
      const block = await generatePISection(
        {
          type: sectionPlan.type,
          niche: input.niche,
          targetLanguage: input.targetLanguage,
          productName: input.productName,
          productPainPoints: input.productPainPoints,
          productBenefits: input.productBenefits,
          productUsp: input.productUsp,
          productPricing: input.productPricing,
          productIngredients: input.productIngredients,
          synthesizedBrief: input.synthesizedBrief,
          character: input.character,
        },
        keys,
      )
      blocks.push(block)
      if (block.source === 'gemini') succeeded++
      else fallbackCount++
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, plan.sections.length) },
    () => worker(),
  )
  await Promise.all(workers)

  return {
    blocks,
    succeeded,
    fallbackCount,
    skippedCount: plan.skipped.length,
    durationMs: Date.now() - startedAt,
  }
}

// ─── Composer: interleave PIBlocks into storytelling sections ────────

/** Given a storytelling pack's sections (with sectionIds parallel array),
 *  and a list of PIBlocks (each carrying an anchor position), produce a
 *  new sections array with PI blocks inserted at the correct anchors.
 *
 *  Returns BOTH the merged sections + the merged sectionIds (so caller
 *  can update storytellingMeta.sectionIds). */
export function interleaveIntoPack(args: {
  sections: LandingSection[]
  sectionIds: string[]  // parallel to sections — storytelling block IDs
  piBlocks: PIBlock[]
}): { sections: LandingSection[]; sectionIds: string[] } {
  const { sections, sectionIds, piBlocks } = args

  if (piBlocks.length === 0) return { sections, sectionIds }

  // ── Group PI blocks by anchor ──
  const blocksByAnchor = new Map<PIAnchorPosition, PIBlock[]>()
  for (const block of piBlocks) {
    const arr = blocksByAnchor.get(block.anchor) ?? []
    arr.push(block)
    blocksByAnchor.set(block.anchor, arr)
  }

  // ── Walk through storytelling sections; insert PI blocks at anchors ──
  const mergedSections: LandingSection[] = []
  const mergedIds: string[] = []

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const sectionId = sectionIds[i]

    // BEFORE: anchor = 'before:<blockId>'
    const beforeKey: PIAnchorPosition = `before:${sectionId}` as PIAnchorPosition
    const beforeBlocks = blocksByAnchor.get(beforeKey)
    if (beforeBlocks) {
      for (const b of beforeBlocks) {
        mergedSections.push(piBlockToLandingSection(b))
        mergedIds.push(b.id)
      }
    }

    // Section itself
    mergedSections.push(section)
    mergedIds.push(sectionId)

    // AFTER: anchor = 'after:<blockId>'
    const afterKey: PIAnchorPosition = `after:${sectionId}` as PIAnchorPosition
    const afterBlocks = blocksByAnchor.get(afterKey)
    if (afterBlocks) {
      for (const b of afterBlocks) {
        mergedSections.push(piBlockToLandingSection(b))
        mergedIds.push(b.id)
      }
    }
  }

  return { sections: mergedSections, sectionIds: mergedIds }
}

/** Convert a PIBlock to a LandingSection so the existing OutputPanel
 *  renderer can show it inline. Type field maps to a permitted SectionType. */
function piBlockToLandingSection(block: PIBlock): LandingSection {
  const copy = block.paragraphs.join('\n\n')
  return {
    type: PI_SECTION_TYPE_MAP[block.type],
    title: block.heading,
    titleVi: block.heading,
    copy,
    layoutGuide: '',
    imagePrompts: [],
    // Subtle callout surfaces as offerStrip for the offer block; otherwise
    // we embed it as a footnote-like trailing paragraph — soft attribution.
    ...(block.subtleCallout && block.type === 'pricing-narrator'
      ? { offerStrip: block.subtleCallout }
      : block.subtleCallout
        ? { subheadline: block.subtleCallout }
        : {}),
  }
}
