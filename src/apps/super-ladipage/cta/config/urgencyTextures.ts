// ─────────────────────────────────────────────────────────────────────
// CTA — URGENCY TEXTURES (P3 — EMOTIONAL urgency ONLY)
//
// LIGHT urgency through emotional momentum, NOT scarcity.
//
// ⛔ ABSOLUTELY BANNED in this pool:
//   - "chỉ còn X suất"
//   - "ưu đãi sắp hết"
//   - countdown logic
//   - artificial deadlines
//   - fake stock language
//
// ✅ ONLY allowed: emotional urgency around time-as-loss or
//    waiting-as-cost framing.
// ─────────────────────────────────────────────────────────────────────

import type { CtaPattern } from '../types'

export const URGENCY_TEXTURES: CtaPattern[] = [
  {
    id: 'dont-wait-like-i-did',
    posture: 'narrator regret as warning — "don\'t replicate my waiting"',
    frame: '"Đừng như [tôi/mình] đã từng [waited / endured] quá lâu"',
    exampleNicheMismatched: '"Đừng như tôi đã từng chờ quá lâu mới chịu lắng nghe cơ thể."',
  },
  {
    id: 'not-another-year',
    posture: 'reject continuing-as-is for another period',
    frame: '"Không cần tiếp tục [old endurance] thêm [time unit] nữa"',
    exampleNicheMismatched: '"Không cần tiếp tục chờ thêm năm nữa rồi mới chịu thừa nhận."',
  },
  {
    id: 'each-week-cost',
    posture: 'each passing time-unit = continued cost (emotional, not deal)',
    frame: '"Mỗi [time unit] trôi qua là một [time unit] [continued cost description]"',
    exampleNicheMismatched: '"Mỗi tuần trôi qua là một tuần cơ thể tiếp tục yếu thêm — và mình tiếp tục giả vờ không thấy."',
  },
  {
    id: 'enough-time-passed',
    posture: 'time-already-spent acknowledgment',
    frame: '"[Tôi/Bạn] đã chờ đủ [time unit] rồi"',
    exampleNicheMismatched: '"Tôi đã chờ đủ năm rồi — không cần thêm bằng chứng để biết cơ thể đang cần được hỗ trợ."',
  },
]

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 1 urgency texture per pack. */
export function sampleUrgencyTexture(seed: string): CtaPattern {
  const idx = hashSeed(`${seed}:urgency`) % URGENCY_TEXTURES.length
  return URGENCY_TEXTURES[idx]
}
