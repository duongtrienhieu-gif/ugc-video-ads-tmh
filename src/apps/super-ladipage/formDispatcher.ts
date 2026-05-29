// ═════════════════════════════════════════════════════════════════════
// formDispatcher — route LandingGenParams sang engine tương ứng theo
// form ID. Đây là điểm DUY NHẤT trong Super Ladipage modify được, vì
// nó là drop-in replacement cho `generateLandingPack` của UGC.
//
// Pattern:
//   - SuperLadipage.tsx import `generateLandingPack` từ file này
//     (thay vì './services/generateLandingPack' trực tiếp)
//   - Signature giữ nguyên: (LandingGenParams) → Promise<LandingPagePack>
//   - Form 'advertorial' route sang storytelling engine
//   - 4 form còn lại (`ugc-malaysia`, `premium`, `hard-sell-cod`,
//     `chuyen-gia`) → pass-through tới UGC engine UNCHANGED
//
// Zero modification tới UGC pipeline. Behavior cho 4 form UGC khác hoàn
// toàn không đổi.
// ═════════════════════════════════════════════════════════════════════

import type { LandingGenParams, LandingPagePack } from './types'
import { generateLandingPack as generateLandingPackUGC } from './services/generateLandingPack'
import { generateStorytellingPack } from './storytelling'

/** Drop-in replacement cho UGC's `generateLandingPack`. Routes by form ID.
 *  Same signature → SuperLadipage.tsx chỉ cần đổi import path. */
export async function generateLandingPack(
  params: LandingGenParams,
): Promise<LandingPagePack> {
  if (params.form === 'advertorial') {
    return generateStorytellingPack(params)
  }
  return generateLandingPackUGC(params)
}
