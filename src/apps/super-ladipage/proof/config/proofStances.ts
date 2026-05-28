// ─────────────────────────────────────────────────────────────────────
// Proof System — STANCES (P1 foundation)
//
// 7 stance archetypes — WHO speaks + HOW. Sampled per proof piece
// (3 pieces per pack = 3 distinct stances). Each stance has psychology
// (certainty, enthusiasm, sentence-quality) NOT just format.
//
// Niche-mismatched examples to prevent verbatim copy across packs.
//
// Anti-fake-review: stances designed to feel chaotic + human, NOT
// polished testimonial templates.
// ─────────────────────────────────────────────────────────────────────

import type { ProofStance } from '../types'

export const PROOF_STANCES: ProofStance[] = [
  {
    id: 'cautious-believer',
    voice: 'Người ít khen, không hào hứng dễ dàng. Thừa nhận tác dụng kèm với "tôi không khen lung tung" tone.',
    certaintyLevel: 'mild',
    enthusiasmLevel: 'mild',
    sentenceQuality: 'attempted-coherent',
    characteristicMoves: [
      'mở bằng "tôi không khen lung tung" / "tôi không hay viết review" framing',
      'kèm 1 detail cụ thể chứ không generic',
      'kết bằng restrained endorsement, không dùng "best" / "tuyệt vời"',
    ],
    exampleQuotesMismatched: [
      'Tôi không hay review. Nhưng cái này tôi đã dùng được 3 tháng — tóc bám lại hơn rõ.',
      'Mình không khen lung tung — uống được 2 tháng, sáng dậy nhẹ hơn thật.',
    ],
  },
  {
    id: 'slow-converter',
    voice: 'Người mất nhiều tháng mới chịu công nhận. Resistance kéo dài rồi cuối cùng admit.',
    certaintyLevel: 'mild',
    enthusiasmLevel: 'mild',
    sentenceQuality: 'attempted-coherent',
    characteristicMoves: [
      'mở bằng timestamp ("3 tháng rồi" / "tới tháng thứ X")',
      'có moment "tôi mới chịu công nhận" / "lúc đầu tôi nghĩ chỉ là placebo"',
      'kết bằng quiet acknowledgment, không khẳng định mạnh',
    ],
    exampleQuotesMismatched: [
      'Mất 4 tháng tôi mới chịu công nhận. Lúc đầu nghĩ chỉ là cảm giác. Giờ thì không nghi nữa.',
      'Tháng thứ 2 tôi mới chú ý tới sự khác biệt. Lúc đầu tôi cứ nghĩ do thời tiết.',
    ],
  },
  {
    id: 'accidentally-impressed',
    voice: 'Mua thử cho có / cho qua chuyện. Không kỳ vọng. Bị surprised.',
    certaintyLevel: 'mild',
    enthusiasmLevel: 'occasional-strong',
    sentenceQuality: 'casual',
    characteristicMoves: [
      'mở bằng "mua cho có" / "thử cho qua chuyện" / "không kỳ vọng gì"',
      'có moment "không ngờ" / "lại có tác dụng" surprise',
      'tone hơi awkward — không quen nói tích cực về sản phẩm',
    ],
    exampleQuotesMismatched: [
      'Mua thử cho có, ai dè uống được 1 tháng thấy người nhẹ hơn lol',
      'Tôi vốn không kỳ vọng gì — chỉ thử cho qua chuyện. Không ngờ lại work.',
    ],
  },
  {
    id: 'skeptical-recommender',
    voice: 'Người đã thử nhiều, ít khen. Giờ recommend nhưng vẫn giữ tone skeptical.',
    certaintyLevel: 'strong',
    enthusiasmLevel: 'mild',
    sentenceQuality: 'attempted-coherent',
    characteristicMoves: [
      'mở bằng "tôi đã thử đủ rồi" / "không có cái nào ăn thua" framing',
      'kèm "đây là cái duy nhất" / "lần này khác" — narrow endorsement',
      'kết bằng practical recommendation, không nhuốm cảm xúc',
    ],
    exampleQuotesMismatched: [
      'Tôi đã thử serum tóc đủ rồi — đây là cái duy nhất tôi giới thiệu lại cho bạn.',
      'Đã uống 4-5 loại trước đó. Cái này tôi vẫn đang dùng, recommend cho ai cùng vấn đề.',
    ],
  },
  {
    id: 'still-using-uncertain',
    voice: 'Vẫn dùng nhưng không chắc do sản phẩm hay yếu tố khác. Hedge mạnh.',
    certaintyLevel: 'hedged',
    enthusiasmLevel: 'flat',
    sentenceQuality: 'casual',
    characteristicMoves: [
      'mở bằng "vẫn đang dùng" / "chưa nghĩ dừng"',
      'kèm hedge "chưa biết có phải nhờ nó không" / "không khẳng định nhưng..."',
      'kết bằng tentative observation, không claim chắc chắn',
    ],
    exampleQuotesMismatched: [
      'Tôi vẫn đang uống. Chưa biết có phải nhờ nó không nhưng người tôi nhẹ hơn rõ.',
      'Đang dùng tháng thứ 3 — không khẳng định gì cả, chỉ thấy tóc rụng ít hẳn.',
    ],
  },
  {
    id: 'second-hand-reporter',
    voice: 'Proxy proof — kể về người thân (mẹ, chồng, bạn) dùng, không phải bản thân.',
    certaintyLevel: 'mild',
    enthusiasmLevel: 'mild',
    sentenceQuality: 'casual',
    characteristicMoves: [
      'mở bằng "mẹ mình" / "chồng mình" / "bạn tôi" — proxy subject',
      'observation through caretaker lens, hơi distant',
      'kết bằng witness statement, không personal claim',
    ],
    exampleQuotesMismatched: [
      'Mẹ mình dùng — mình thấy mẹ ít than đau hơn. Mẹ không nói ra nhưng mình để ý.',
      'Bạn thân tôi đang dùng, kể với tôi rằng đỡ rõ. Tôi chưa thử nhưng để ý.',
    ],
  },
  {
    id: 'anti-hype-blunt',
    voice: 'Người straight-talk. Không hype. Acknowledge tác dụng nhưng cắt fluff.',
    certaintyLevel: 'mild',
    enthusiasmLevel: 'flat',
    sentenceQuality: 'fragments-OK',
    characteristicMoves: [
      'short fragments OK — "Không thần kỳ đâu. Nhưng đỡ thật."',
      'cut all enthusiasm vocabulary',
      'kết bằng dry acknowledgment hoặc fragment',
    ],
    exampleQuotesMismatched: [
      'Không thần kỳ đâu nhưng. Đỡ thật.',
      'Không kỳ diệu. Chỉ là người không còn nặng nề như trước. Vậy thôi.',
    ],
  },
]

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 3 DISTINCT stances per pack — variety enforced. */
export function sampleStances(seed: string, count = 3): ProofStance[] {
  const all = [...PROOF_STANCES]
  const picked: ProofStance[] = []
  for (let i = 0; i < count; i++) {
    if (all.length === 0) break
    const idx = hashSeed(`${seed}:stance:${i}`) % all.length
    picked.push(all[idx])
    all.splice(idx, 1)  // remove picked → next pick is distinct
  }
  return picked
}
