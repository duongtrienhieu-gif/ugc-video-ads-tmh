// ─────────────────────────────────────────────────────────────────────
// CTA — FRICTION REDUCTION PATTERNS (P3)
//
// Lower psychological resistance before action. Permit reader to NOT
// commit fully, stay skeptical, keep doubt — paradoxically increases
// trust + reduces fear of "buying into" something.
//
// "Don't have to believe yet" frame > pressure frame.
// ─────────────────────────────────────────────────────────────────────

import type { CtaPattern } from '../types'

export const FRICTION_REDUCTION_PATTERNS: CtaPattern[] = [
  {
    id: 'no-immediate-belief',
    posture: 'release from "must believe" pressure',
    frame: '"Không cần tin ngay. [Optional: timeline acknowledgment]"',
    exampleNicheMismatched: '"Không cần tin ngay. Cứ thử rồi cơ thể sẽ nói cho bạn nghe."',
  },
  {
    id: 'i-also-doubted',
    posture: 'narrator validates reader\'s doubt',
    frame: '"[Tôi/Mình] cũng từng nghi ngờ. [Optional brief evidence]"',
    exampleNicheMismatched: '"Tôi cũng từng nghi ngờ. Đến tháng thứ 3 tôi mới chịu công nhận."',
  },
  {
    id: 'no-high-expectation-required',
    posture: 'permission to expect nothing',
    frame: '"Không ai bắt [bạn/mình] phải kỳ vọng quá nhiều"',
    exampleNicheMismatched: '"Không ai bắt bạn phải kỳ vọng quá nhiều. Cứ để cơ thể tự phản hồi."',
  },
  {
    id: 'not-magic',
    posture: 'pre-empt "miracle" objection',
    frame: '"[X] không phải thứ thần kỳ — chỉ là [grounded mechanism description]"',
    exampleNicheMismatched: '"Cái này không phải thứ thần kỳ — chỉ là cho cơ thể đủ thứ nó đang thiếu."',
  },
  {
    id: 'small-step-not-commitment',
    posture: 'reduce sense of "lifelong commitment"',
    frame: '"Không cần [big commitment language]. Chỉ là [small first step]"',
    exampleNicheMismatched: '"Không cần thay đổi cả routine. Chỉ là thử thêm một thứ nhỏ trong ngày."',
  },
]

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 1 friction reduction pattern per pack. */
export function sampleFrictionReduction(seed: string): CtaPattern {
  const idx = hashSeed(`${seed}:friction`) % FRICTION_REDUCTION_PATTERNS.length
  return FRICTION_REDUCTION_PATTERNS[idx]
}
