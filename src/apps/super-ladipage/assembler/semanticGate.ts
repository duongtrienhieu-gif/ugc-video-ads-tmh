import type { ProductIdentity, ImageSlotConcept, SectionSpec } from '../types'

// ─────────────────────────────────────────────────────────────────────
// Semantic Gate — runtime check sau khi Gemini sinh pack.
//
// Đây là chỗ chống lỗi section 14 (gut → weight loss) + section 2
// (probiotic → "lên cân"). Quét cả pack tìm dấu hiệu tier4_offniche
// trong concepts. Nếu phát hiện → throw để orchestrator retry.
// ─────────────────────────────────────────────────────────────────────

export interface SemanticGateIssue {
  sectionIdx: number
  imageIdx:   number
  issue:      string
  remedy:     string
}

/** Kiểm tra concept không chứa keyword anti-pattern.
 *  Match case-insensitive, substring (đủ để bắt "weight loss", "slim",
 *  "muscle"…). Trả về danh sách issue nếu fail. */
export function checkConceptAntiPatterns(
  conceptScene: string,
  identity: ProductIdentity,
): string[] {
  const lower = conceptScene.toLowerCase()
  const hits: string[] = []
  for (const antiPattern of identity.visualAntiPatterns) {
    const keyword = antiPattern.toLowerCase().replace(/^not\s+/, '')
    if (keyword.length < 3) continue // bỏ qua từ quá ngắn
    if (lower.includes(keyword)) {
      hits.push(antiPattern)
    }
  }
  return hits
}

/** Kiểm tra phân bố tier của 1 section có tierRules. */
export function checkTierDistribution(
  spec: SectionSpec,
  concepts: ImageSlotConcept[],
): string | null {
  if (!spec.tierRules) return null
  const counts = {
    tier1_primary:  0,
    tier2_axis:     0,
    tier3_loose:    0,
    tier4_offniche: 0,
  }
  for (const c of concepts) {
    if (c.sourceTier) counts[c.sourceTier]++
  }
  const dist = spec.tierRules.distribution
  const errs: string[] = []
  if (counts.tier1_primary < dist.tier1_primary.min) {
    errs.push(`tier1_primary=${counts.tier1_primary} < min ${dist.tier1_primary.min}`)
  }
  if (counts.tier1_primary > dist.tier1_primary.max) {
    errs.push(`tier1_primary=${counts.tier1_primary} > max ${dist.tier1_primary.max}`)
  }
  if (counts.tier2_axis > dist.tier2_axis.max) {
    errs.push(`tier2_axis=${counts.tier2_axis} > max ${dist.tier2_axis.max}`)
  }
  if (counts.tier3_loose > dist.tier3_loose.max) {
    errs.push(`tier3_loose=${counts.tier3_loose} > max ${dist.tier3_loose.max}`)
  }
  if (counts.tier4_offniche > 0) {
    errs.push(`tier4_offniche=${counts.tier4_offniche} > 0 (BANNED entirely)`)
  }
  return errs.length > 0 ? errs.join('; ') : null
}

/** Full semantic gate scan của 1 pack. Trả về array issues.
 *  Empty array = pass. */
export interface PackForGate {
  sections: Array<{
    type: string
    imagePrompts: Array<{
      filename?: string
      __concept?: ImageSlotConcept  // attached by orchestrator
    }>
  }>
}

export function semanticGateScan(
  pack: PackForGate,
  identity: ProductIdentity,
  specsBySectionType: Map<string, SectionSpec>,
): SemanticGateIssue[] {
  const issues: SemanticGateIssue[] = []

  pack.sections.forEach((section, sIdx) => {
    const spec = specsBySectionType.get(section.type)
    if (!spec) return

    // Collect concepts for tier-distribution check
    const sectionConcepts: ImageSlotConcept[] = []

    section.imagePrompts.forEach((p, iIdx) => {
      const concept = p.__concept
      if (!concept) {
        issues.push({
          sectionIdx: sIdx,
          imageIdx:   iIdx,
          issue:      'concept missing',
          remedy:     'Gemini must produce a `concept` object for every imagePrompt',
        })
        return
      }

      // 1. Anti-pattern keyword scan
      const hits = checkConceptAntiPatterns(concept.conceptScene, identity)
      if (hits.length > 0) {
        issues.push({
          sectionIdx: sIdx,
          imageIdx:   iIdx,
          issue:      `concept "${concept.conceptScene}" contains anti-pattern keyword(s): ${hits.join(', ')}`,
          remedy:     `Replace with a concept that does NOT mention these. For "${identity.productCategory}", use concepts from painPointsByTier.tier1_primary / transformationByTier.tier1_primary instead.`,
        })
      }

      // 2. Product policy check
      if (spec.productPolicy === 'required' && !concept.productInScene) {
        issues.push({
          sectionIdx: sIdx,
          imageIdx:   iIdx,
          issue:      `productPolicy=required but productInScene=false`,
          remedy:     `Set productInScene=true and ensure conceptScene mentions ${identity.productNameExact}`,
        })
      }
      if (spec.productPolicy === 'forbidden' && concept.productInScene) {
        issues.push({
          sectionIdx: sIdx,
          imageIdx:   iIdx,
          issue:      `productPolicy=forbidden but productInScene=true`,
          remedy:     `Set productInScene=false; do NOT mention ${identity.productNameExact} in conceptScene`,
        })
      }

      sectionConcepts.push(concept)
    })

    // 3. Tier distribution check (if section has tierRules)
    const tierErr = checkTierDistribution(spec, sectionConcepts)
    if (tierErr) {
      issues.push({
        sectionIdx: sIdx,
        imageIdx:   -1,
        issue:      `tier distribution violated: ${tierErr}`,
        remedy:     `Adjust imagePrompts so distribution matches spec.tierRules. Pick more from tier1_primary, fewer from tier3_loose, ZERO from tier4_offniche.`,
      })
    }
  })

  return issues
}
