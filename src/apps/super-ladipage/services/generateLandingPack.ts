import type { LandingGenParams, LandingPagePack } from '../types'

// ─────────────────────────────────────────────────────────────────────
// Super Ladipage — Pass 1: sinh landing pack (text + image prompt).
//
// PHASE 2 STUB — sẽ rebuild đầy đủ ở Phase 3.
//
// Plan Phase 3:
//   1. Build 3-layer prompt:
//      L1 = product layer (productName + painPoints + usps + benefits +
//           packaging description từ Gemini Vision)
//      L2 = style layer (cố định theo form/preset — vd "TikTok UGC mobile"
//           vs "luxury editorial")
//      L3 = section role layer (vai trò trong sales funnel + image role)
//   2. Gemini text gen với JSON schema validation (retry nếu fail)
//   3. Dịch native → VN trong cùng 1 call (tránh chi phí double)
//   4. Sinh image prompt ENG cho từng asset role
//   5. Return LandingPagePack đúng shape
// ─────────────────────────────────────────────────────────────────────

export async function generateLandingPack(
  _params: LandingGenParams,
): Promise<LandingPagePack> {
  throw new Error(
    'Super Ladipage Pass 1 (text generation) chưa được implement. ' +
    'Phase 3 sẽ rebuild với 3-layer prompt + Zod schema validation.',
  )
}
