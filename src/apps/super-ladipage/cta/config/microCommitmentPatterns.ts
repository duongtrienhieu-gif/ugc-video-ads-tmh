// ─────────────────────────────────────────────────────────────────────
// CTA — MICRO-COMMITMENT PATTERNS (P3)
//
// Small internal agreements reader makes BEFORE final CTA. Accumulate
// psychological action momentum without commercial pressure.
//
// NOT direct selling. Internal "có lẽ tôi nên..." moments.
// ─────────────────────────────────────────────────────────────────────

import type { CtaPattern } from '../types'

export const MICRO_COMMITMENT_PATTERNS: CtaPattern[] = [
  {
    id: 'should-listen-to-body',
    posture: 'permission to attend to self',
    frame: '"Có lẽ bạn cũng nên thử [lắng nghe / chú ý] [body signal / hidden state]"',
    exampleNicheMismatched: '"Có lẽ bạn cũng nên thử lắng nghe cơ thể mình."',
  },
  {
    id: 'stop-enduring',
    posture: 'release from endurance default',
    frame: '"Ít nhất [tôi/bạn] không cần tiếp tục [old endurance behavior]"',
    exampleNicheMismatched: '"Ít nhất tôi không cần tiếp tục cố chịu đựng như trước."',
  },
  {
    id: 'not-normal-anymore',
    posture: 'reject "normal aging/decline" assumption',
    frame: '"[Tôi/Mình] không cần tiếp tục xem [decline] là chuyện bình thường nữa"',
    exampleNicheMismatched: '"Mình không cần tiếp tục xem đó là chuyện bình thường nữa."',
  },
  {
    id: 'maybe-try-different',
    posture: 'permission to try new approach',
    frame: '"Có lẽ [tôi/bạn] nên thử một cách khác — không phải [old approach]"',
    exampleNicheMismatched: '"Có lẽ tôi nên thử cách khác — không phải tiếp tục che bên ngoài."',
  },
  {
    id: 'enough-evidence',
    posture: 'internal acknowledgment of evidence',
    frame: '"Đủ rồi — [cơ thể / mình] đã cho [tôi/bạn] thấy [signal] đủ nhiều lần"',
    exampleNicheMismatched: '"Đủ rồi — cơ thể đã cho tôi thấy nó cần được hỗ trợ đủ nhiều lần."',
  },
  {
    id: 'small-act-of-care',
    posture: 'frame action as small self-care, not purchase',
    frame: '"[Tôi/Mình] có thể bắt đầu bằng một việc nhỏ — [low-friction first step]"',
    exampleNicheMismatched: '"Mình có thể bắt đầu bằng một việc nhỏ — thử hỗ trợ cơ thể đúng cách."',
  },
]

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 2 distinct micro-commitment patterns per pack. */
export function sampleMicroCommitments(seed: string, count = 2): CtaPattern[] {
  const all = [...MICRO_COMMITMENT_PATTERNS]
  const picked: CtaPattern[] = []
  for (let i = 0; i < count; i++) {
    if (all.length === 0) break
    const idx = hashSeed(`${seed}:microCommit:${i}`) % all.length
    picked.push(all[idx])
    all.splice(idx, 1)
  }
  return picked
}
