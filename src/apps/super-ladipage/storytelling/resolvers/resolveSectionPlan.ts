// ─────────────────────────────────────────────────────────────────────
// resolveSectionPlan — STUB cho P0.5
//
// P0.5: trả về SectionPlan[] dùng DEFAULT_SECTION_ORDER + countDefault
// của blueprint. KHÔNG dynamic ordering, KHÔNG niche-flex section count,
// KHÔNG overlay budget allocation.
//
// Phase 2 sẽ:
//   - reorder/drop section theo niche preset (vd 'quicker' → drop inner-realization)
//   - tính productRevealSection adjustment (nếu input.productRevealSection ≠ 7,
//     swap first-trial vị trí)
//   - allocate overlay budget (2 slots) ưu tiên intro-portrait + subtle-change
//   - validate image count tổng không vượt PACK_LIMITS.imageMax
// ─────────────────────────────────────────────────────────────────────

import type { SectionPlan, StorytellingInput } from '../types'
import {
  DEFAULT_SECTION_ORDER, SECTION_BLUEPRINTS,
} from '../config/sectionBlueprints'

/** P0.5 stub: trả default 10-section plan, mỗi section dùng countDefault
 *  của blueprint. Overlay/product visibility lấy y từ blueprint. */
export function resolveSectionPlan(_input: StorytellingInput): SectionPlan[] {
  return DEFAULT_SECTION_ORDER.map((id) => {
    const blueprint = SECTION_BLUEPRINTS[id]
    const imageCount = blueprint.imageRequirement.countDefault
    return {
      blueprint,
      imageCount,
      hasImage: imageCount > 0,
      showsProduct: blueprint.productVisibility === 'still-life'
                 || blueprint.productVisibility === 'subtle-background',
      overlayType: null,  // P2 sẽ allocate
    }
  })
}
