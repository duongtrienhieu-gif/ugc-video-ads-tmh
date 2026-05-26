// ─────────────────────────────────────────────────────────────────────
// Proof System — OBJECTION PATTERNS per niche (P1 foundation)
//
// Reader đến với pack có sẵn 3-5 objections trong đầu. Proof phải
// reduce skepticism — NOT direct refute (emotional bypass).
//
// Per pack: sample 1-2 objections → 1-2 proof pieces counter via
// emotional posture (not "khẳng định ngược lại").
//
// Counter posture examples:
//   - objection "tôi đã thử rồi không hiệu quả"
//   - counter posture: skeptical-recommender stance —
//     "Tôi cũng đã thử đủ. Đây là cái duy nhất tôi vẫn dùng."
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey, NicheObjections } from '../types'

export const NICHE_OBJECTIONS: Record<NicheKey, NicheObjections> = {
  'haircare': {
    niche: 'haircare',
    objections: [
      {
        objection: '"Tôi đã thử bao loại rồi, lần này cũng vậy thôi"',
        counterPosture: 'skeptical-recommender — "tôi đã thử đủ, đây là cái duy nhất tôi vẫn dùng"',
      },
      {
        objection: '"Tóc rụng do tuổi tác / di truyền không cản được"',
        counterPosture: 'slow-converter — "tháng thứ 2 tôi mới chịu công nhận. Tuổi nhưng vẫn đỡ rõ"',
      },
      {
        objection: '"Vitamin uống mãi tóc cũng không khá hơn"',
        counterPosture: 'still-using-uncertain — "tôi không hứa hẹn. Chỉ thấy gối ít tóc hẳn"',
      },
      {
        objection: '"Serum/dầu gội bên ngoài mới tác dụng"',
        counterPosture: 'accidentally-impressed — "tôi mua uống cho có. Không ngờ lại đỡ"',
      },
    ],
  },

  'skincare': {
    niche: 'skincare',
    objections: [
      {
        objection: '"Da xuống cấp do tuổi, kem nào cũng vô ích"',
        counterPosture: 'cautious-believer — "tôi không khen lung tung. Da tôi bắt sáng lại thật"',
      },
      {
        objection: '"Bao nhiêu kem mới rồi cũng không khác"',
        counterPosture: 'skeptical-recommender — "tôi đã thử đủ. Cái này tôi vẫn dùng 4 tháng"',
      },
      {
        objection: '"Hứa hẹn quá — chắc cũng vậy"',
        counterPosture: 'anti-hype-blunt — "không thần kỳ đâu. Đỡ xỉn thật. Vậy thôi"',
      },
    ],
  },

  'supplement-wellness': {
    niche: 'supplement-wellness',
    objections: [
      {
        objection: '"Tôi uống vitamin tổng hợp rồi vẫn mệt"',
        counterPosture: 'slow-converter — "tôi cũng uống đủ. Mất 2 tháng mới chịu nhận khác"',
      },
      {
        objection: '"Mệt vì tuổi, cà phê còn đỡ hơn"',
        counterPosture: 'still-using-uncertain — "vẫn đang dùng. Pin chiều 3h ít cạn hơn rõ"',
      },
      {
        objection: '"Mua online sợ fake"',
        counterPosture: 'second-hand-reporter — "mẹ mình dùng cũng đỡ. Mua qua tin được"',
      },
      {
        objection: '"Phải uống cả đời mới có tác dụng"',
        counterPosture: 'accidentally-impressed — "tôi không nghĩ sẽ đỡ nhanh vậy. 3 tuần đầu đã khác"',
      },
    ],
  },

  'health-functional': {
    niche: 'health-functional',
    objections: [
      {
        objection: '"Khớp đau do tuổi, không có cách"',
        counterPosture: 'second-hand-reporter — "ba/mẹ tôi dùng, đi cầu thang đỡ rõ. Tuổi cao vẫn đỡ"',
      },
      {
        objection: '"Thuốc giảm đau dễ hơn"',
        counterPosture: 'slow-converter — "tôi cũng dùng thuốc giảm đau. Cái này khác — đỡ chậm nhưng không quay lại"',
      },
      {
        objection: '"Bao nhiêu thực phẩm chức năng rồi vẫn vậy"',
        counterPosture: 'cautious-believer — "tôi ít share. Đây là cái tôi recommend cho bạn cùng vấn đề"',
      },
    ],
  },

  'mom-baby': {
    niche: 'mom-baby',
    objections: [
      {
        objection: '"Sau sinh rụng tóc là tự nhiên — không cần dùng gì"',
        counterPosture: 'slow-converter — "tôi cũng nghĩ vậy 6 tháng đầu. Tới tháng 9 mới chịu thử"',
      },
      {
        objection: '"Đang cho con bú không dám uống gì"',
        counterPosture: 'second-hand-reporter — "bạn tôi cũng cho con bú. Dùng được rồi share lại"',
      },
      {
        objection: '"Mẹ nào cũng mệt — không có cách"',
        counterPosture: 'anti-hype-blunt — "không thần kỳ. Chỉ là 3 giờ sáng đỡ kiệt hơn thôi"',
      },
    ],
  },

  'beauty-confidence': {
    niche: 'beauty-confidence',
    objections: [
      {
        objection: '"Vẻ ngoài do gene — không che được tuổi"',
        counterPosture: 'cautious-believer — "tôi không hay khen. Da tôi bắt sáng lại — bạn cũ nhận xét"',
      },
      {
        objection: '"Filter app làm được rồi"',
        counterPosture: 'still-using-uncertain — "vẫn đang dùng. Filter ít hơn rõ — không khẳng định nhưng..."',
      },
      {
        objection: '"Tôi đã thử mỹ phẩm cao cấp rồi vẫn vậy"',
        counterPosture: 'skeptical-recommender — "tôi đã thử Lab Series / Sulwhasoo... Cái này tôi vẫn dùng"',
      },
    ],
  },

  'relationship': {
    niche: 'relationship',
    objections: [
      {
        objection: '"Cộc tính là personality, không sửa được"',
        counterPosture: 'slow-converter — "tôi nghĩ vậy mãi. Mất 2 tháng mới nhận — không phải personality, là kiệt sức kéo dài"',
      },
      {
        objection: '"Cần đi therapy, không phải supplement"',
        counterPosture: 'still-using-uncertain — "tôi vẫn đang dùng. Chưa biết có phải nhờ nó không, nhưng patience trở lại rõ"',
      },
      {
        objection: '"Mệt vì stress, supplement không giải quyết stress"',
        counterPosture: 'accidentally-impressed — "tôi mua uống cho có. Không ngờ — buổi tối về nhà ít snap với con hơn"',
      },
    ],
  },

  'fitness-recovery': {
    niche: 'fitness-recovery',
    objections: [
      {
        objection: '"Đau do tuổi, không có cách"',
        counterPosture: 'second-hand-reporter — "bạn mình 55 tuổi dùng, đi du lịch trở lại được. Tuổi cao vẫn đỡ"',
      },
      {
        objection: '"Thuốc giảm đau Tây y mới mạnh"',
        counterPosture: 'slow-converter — "tôi cũng dùng paracetamol. Cái này khác — không tê, không nóng, chỉ là đỡ dần"',
      },
      {
        objection: '"Đắt mà chưa chắc tác dụng"',
        counterPosture: 'cautious-believer — "tôi không khen lung tung. Đầu gối đỡ thật. Bê đồ siêu thị bình thường rồi"',
      },
    ],
  },
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 1-2 objections per pack — counter-proof focus.
 *  Returns 1 or 2 (sometimes 0 if niche has only 3 objections — bias toward 1-2). */
export function sampleObjections(seed: string, niche: NicheKey, count = 2): NicheObjections['objections'] {
  const pool = NICHE_OBJECTIONS[niche]?.objections ?? []
  if (pool.length === 0) return []

  const all = [...pool]
  const picked: NicheObjections['objections'] = []
  const target = Math.min(count, all.length)
  for (let i = 0; i < target; i++) {
    if (all.length === 0) break
    const idx = hashSeed(`${seed}:objection:${i}`) % all.length
    picked.push(all[idx])
    all.splice(idx, 1)
  }
  return picked
}
