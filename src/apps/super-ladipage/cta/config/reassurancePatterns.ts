// ─────────────────────────────────────────────────────────────────────
// CTA — REASSURANCE TEXTURES (P3)
//
// CTA-adjacent emotional stabilization. Anti-miracle language. Frame
// improvement as gradual, uneven, sometimes-imperceptible — counters
// "wow life change" infomercial energy.
//
// "Đỡ hơn từng chút" > "Khỏi hẳn"
// "Nhẹ dần" > "Thấy khác ngay"
// ─────────────────────────────────────────────────────────────────────

import type { CtaPattern } from '../types'

export const REASSURANCE_PATTERNS: CtaPattern[] = [
  {
    id: 'gradual-not-magic',
    posture: 'gradual improvement, anti-miracle frame',
    frame: '"Không phải [miracle adjective]. Chỉ là [gradual observation]"',
    exampleNicheMismatched: '"Không phải kiểu thần kỳ. Chỉ là từng tuần một, người tôi nhẹ hơn rõ."',
  },
  {
    id: 'piece-by-piece',
    posture: 'incremental, no single moment of transformation',
    frame: '"[Improvement] đến từng chút một — không có cái khoảnh khắc \\"wow\\""',
    exampleNicheMismatched: '"Tóc bám lại từng chút một — không có cái khoảnh khắc \\"wow đỡ rồi\\"."',
  },
  {
    id: 'noticed-retrospectively',
    posture: 'change observed only in hindsight',
    frame: '"[Tôi/Mình] không nhớ chính xác khi nào. Chỉ là [later observation]"',
    exampleNicheMismatched: '"Tôi không nhớ chính xác khi nào tóc đỡ rụng. Chỉ là một sáng tôi nhận ra gối ít tóc hẳn."',
  },
  {
    id: 'not-yet-fully-recovered',
    posture: 'honest about incomplete recovery — anti-perfectionist',
    frame: '"Chưa hoàn toàn [fully recovered state]. Nhưng [partial improvement]"',
    exampleNicheMismatched: '"Chưa phải tóc dày như xưa. Nhưng không còn rụng nắm nữa."',
  },
  {
    id: 'weeks-not-days',
    posture: 'realistic timeline expectations',
    frame: '"[Realistic timeline] — không phải [unrealistic timeline]"',
    exampleNicheMismatched: '"Tuần thứ 3-4 mới thấy khác — không phải vài ngày đã đỡ."',
  },
]

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 1 reassurance pattern per pack. */
export function sampleReassurance(seed: string): CtaPattern {
  const idx = hashSeed(`${seed}:reassurance`) % REASSURANCE_PATTERNS.length
  return REASSURANCE_PATTERNS[idx]
}
