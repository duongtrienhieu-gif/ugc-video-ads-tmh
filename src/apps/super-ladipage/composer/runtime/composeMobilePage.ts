// ─────────────────────────────────────────────────────────────────────
// Composer — composeMobilePage (P4 main entry)
//
// Top-level fn. Reads pack.sections (15-17 storytelling blocks) + ctaFlow
// metadata → produces ComposedPage (~7 mobile sections).
//
// Pure function — deterministic. No Gemini call, no I/O.
// Renderer-agnostic — output is data structure for future visual layer.
//
// LOCK: transitionHint = INTERNAL metadata, NEVER visible copy.
// LOCK: ~7 SectionRoles only (no taxonomy expansion).
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../../storytelling/runtime/parsePackResponse'
import type { ComposedPage, ComposedSection, BlockId } from '../types'
import {
  COMPOSITION_RULES, COMPOSITION_ORDER,
} from '../config/compositionRules'
import { DENSITY_PROFILES } from '../config/densityProfiles'
import { mergeBlocks } from './mergeBlocks'
import { computeDensity, estimateScrollTime } from './computeDensity'
import { assignImageRole } from './assignImageRole'
import { computeTransitionHint } from './computeTransitions'
import { scrollFatigueDetector } from '../validators/scrollFatigueDetector'

export interface ComposeArgs {
  packSections: ParsedSection[]
  /** Whether pack has CTA touches inline (from CtaFlow presence). Used for
   *  ctaInline metadata on close-invitation + transformation sections. */
  hasCtaFlow: boolean
}

/** Compose mobile page from storytelling pack. */
export function composeMobilePage(args: ComposeArgs): ComposedPage {
  const composedSections: ComposedSection[] = []

  // Phase 1: build raw sections (merge + density + image role)
  let sectionIndex = 0
  for (const role of COMPOSITION_ORDER) {
    const blockIds: BlockId[] = COMPOSITION_RULES[role]
    const merged = mergeBlocks(blockIds, args.packSections)

    // Skip section if no blocks present (all optional missing — rare)
    if (merged.sourceBlockIds.length === 0) continue

    const density = computeDensity(merged.paragraphs)
    const imageRole = assignImageRole(role, density.density, !!merged.inlineProof)
    const profile = DENSITY_PROFILES[role]

    // CTA inline: close-invitation always has CTA; transformation may have
    // micro-commitments / reassurance woven in (if hasCtaFlow).
    const ctaInline =
      role === 'close-invitation' ||
      (args.hasCtaFlow && (role === 'transformation' || role === 'solution-opening'))

    sectionIndex++
    composedSections.push({
      id: `sec-${sectionIndex}-${role}`,
      role,
      sourceBlockIds: merged.sourceBlockIds,
      paragraphs: merged.paragraphs,
      inlineProof: merged.inlineProof,
      density: density.density,
      pacingRole: profile.pacingRole,
      imageRole,
      scrollWeight: density.scrollWeight,
      ctaInline,
      spacingBefore: profile.spacingBefore,
      spacingAfter: profile.spacingAfter,
      transitionHint: '',  // filled in phase 2
      wordCount: density.wordCount,
      paragraphCount: density.paragraphCount,
    })
  }

  // Phase 2: compute transition hints (NEXT role each section transitions to)
  for (let i = 0; i < composedSections.length; i++) {
    const current = composedSections[i]
    const next = i + 1 < composedSections.length ? composedSections[i + 1] : null
    current.transitionHint = computeTransitionHint(current.role, next?.role ?? null)
  }

  // Phase 3: aggregate metrics
  const totalWordCount = composedSections.reduce((sum, s) => sum + s.wordCount, 0)
  const sourcePackBlockCount = args.packSections.length

  // Phase 4: scroll fatigue analysis (soft warnings)
  const fatigueWarnings = scrollFatigueDetector(composedSections)

  return {
    sections: composedSections,
    totalSections: composedSections.length,
    sourcePackBlockCount,
    totalWordCount,
    estimatedScrollTimeSec: estimateScrollTime(totalWordCount),
    fatigueWarnings,
  }
}
