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

  // ── Tier S extensions (2026-05-27) ──

  'sleep-insomnia': {
    niche: 'sleep-insomnia',
    objections: [
      {
        objection: '"Thuốc ngủ Tây y mới đáng tin"',
        counterPosture: 'cautious-trier — "tôi sợ phụ thuộc thuốc ngủ. Cái này không phải kéo cơ thể vào ngủ — nó giúp đầu yên xuống thôi"',
      },
      {
        objection: '"Mất ngủ do stress việc làm, sản phẩm không sửa được"',
        counterPosture: 'slow-converter — "tôi cũng nghĩ vậy. Nhưng 3 tuần dùng — không thay đổi công việc gì, nhưng đêm có thể ngủ"',
      },
      {
        objection: '"Tôi thử melatonin rồi không tác dụng"',
        counterPosture: 'accidentally-impressed — "tôi cũng dùng melatonin trước đây. Cái này khác công thức — combine với GABA và magie"',
      },
    ],
  },

  'menopause': {
    niche: 'menopause',
    objections: [
      {
        objection: '"Mãn kinh phải uống HRT mới khỏi"',
        counterPosture: 'doctor-recommended-friend — "bác sĩ tôi không cho HRT vì tiền sử gia đình. Cái này là phyto, an toàn hơn"',
      },
      {
        objection: '"Phyto-estrogen không đủ mạnh"',
        counterPosture: 'second-hand-reporter — "bạn tôi 52 tuổi dùng 4 tháng. Bốc hỏa giảm rõ — không phải hết nhưng đỡ hẳn 70%"',
      },
      {
        objection: '"Đợi vài năm sẽ tự qua"',
        counterPosture: 'slow-converter — "tôi định đợi tự qua. Nhưng 2 năm rồi vẫn đêm đổ mồ hôi. Cái này giúp tôi ngủ lại được"',
      },
    ],
  },

  'mental-health': {
    niche: 'mental-health',
    objections: [
      {
        objection: '"Tôi cần đi gặp bác sĩ tâm lý, không phải supplement"',
        counterPosture: 'both-and — "tôi vẫn đi therapy. Cái này là support cho thân thể — não chỉ nghỉ được khi thân không stress"',
      },
      {
        objection: '"Ashwagandha thử rồi không khác"',
        counterPosture: 'careful-trier — "tôi cũng dùng ashwagandha rẻ tiền không tác dụng. Cái này KSM-66 — extract chuẩn lâm sàng"',
      },
      {
        objection: '"Cảm giác lo âu là tính cách, không sửa được"',
        counterPosture: 'gentle-correction — "không phải sửa tính cách. Cortisol baseline cao 24/7 là khác — đo được, can thiệp được"',
      },
    ],
  },

  'anti-aging-longevity': {
    niche: 'anti-aging-longevity',
    objections: [
      {
        objection: '"NMN/NAD chỉ là marketing — chưa được FDA approve"',
        counterPosture: 'cautious-researcher — "tôi đọc paper của Sinclair lab. Approve không có nghĩa hiệu quả — nhiều supplement chưa approve vẫn có evidence"',
      },
      {
        objection: '"Đắt mà chưa chắc kéo dài tuổi thọ"',
        counterPosture: 'reframe-from-quantity-to-quality — "không phải sống lâu hơn — là 10-20 năm tới sống TỐT hơn. Đáng đầu tư 1tr/tháng"',
      },
      {
        objection: '"Tập gym và ngủ đủ là đủ rồi"',
        counterPosture: 'both-and — "tôi vẫn tập gym + ngủ đủ. NMN bổ sung cho cellular machinery — không thay thế lifestyle"',
      },
    ],
  },

  // ── SEA-6 extensions (2026-05-27) ──

  'dental-oral-care': {
    niche: 'dental-oral-care',
    objections: [
      {
        objection: '"Phải đi nha sĩ chuyên môn — sản phẩm tự dùng vô ích"',
        counterPosture: 'both-and — "tôi vẫn đi cạo vôi 6 tháng/lần. Cái này là maintenance giữa các lần — sạch lâu hơn rõ"',
      },
      {
        objection: '"Kem đánh răng nào cũng quảng cáo trắng răng — không có thật"',
        counterPosture: 'skeptical-trier — "tôi đã thử Colgate Total / Sensodyne / Marvis... Cái này khác — không trắng nhanh nhưng cao răng ít rõ"',
      },
      {
        objection: '"Hơi thở do dạ dày — không phải miệng"',
        counterPosture: 'gentle-correction — "tôi cũng từng nghĩ vậy. Đi nội soi dạ dày sạch. Là vi khuẩn yếm khí ở kẽ răng — chỉ bàn chải không lấy được"',
      },
    ],
  },

  'diabetes-blood-sugar': {
    niche: 'diabetes-blood-sugar',
    objections: [
      {
        objection: '"Phải uống metformin — supplement vô ích"',
        counterPosture: 'both-and — "tôi vẫn uống metformin theo đơn bác sĩ. Cái này là hỗ trợ — không thay thế. A1C giảm từ 7.8 xuống 6.9"',
      },
      {
        objection: '"Tiểu đường type 2 phải kiêng tinh bột — không thuốc nào sửa được"',
        counterPosture: 'slow-converter — "tôi kiêng cơm 2 năm vẫn không đỡ. Sau 3 tháng dùng — ăn nửa bát cơm vẫn ổn glucose"',
      },
      {
        objection: '"Sợ uống thêm thứ làm hại gan/thận"',
        counterPosture: 'cautious-trier — "tôi hỏi bác sĩ trước. Đây là phyto + chromium — không tương tác với metformin. Test men gan/creatinine sau 3 tháng vẫn ổn"',
      },
    ],
  },

  'liver-detox': {
    niche: 'liver-detox',
    objections: [
      {
        objection: '"Gan tự thải độc — không cần supplement"',
        counterPosture: 'gentle-correction — "tôi cũng nghĩ vậy. Nhưng siêu âm gan nhiễm mỡ độ 2 thì gan đã quá tải. Đây là silymarin hỗ trợ phase 2 detox — có evidence"',
      },
      {
        objection: '"Detox trà / nước chanh là đủ"',
        counterPosture: 'slow-converter — "tôi uống nước chanh 2 năm — men gan vẫn 80. 4 tháng dùng cái này — ALT về 35 rõ"',
      },
      {
        objection: '"Phải bỏ bia hoàn toàn mới hết gan nhiễm mỡ"',
        counterPosture: 'both-and — "tôi giảm bia còn 1-2 lần/tháng + uống thêm cái này. Không hứa cứu được gan người nghiện rượu nặng — chỉ là maintenance"',
      },
    ],
  },

  'prostate-urology': {
    niche: 'prostate-urology',
    objections: [
      {
        objection: '"Tuyến tiền liệt phì đại do tuổi — không cản được"',
        counterPosture: 'second-hand-reporter — "bố tôi 65 dùng saw palmetto 1 năm. PSA từ 5.5 về 3.8 — bác sĩ ngạc nhiên. Tuổi cao vẫn đỡ"',
      },
      {
        objection: '"Phải đi tiểu đêm là do uống nhiều nước thôi"',
        counterPosture: 'gentle-correction — "tôi cũng nghĩ vậy. Cắt nước sau 7h tối vẫn dậy 3 lần. Là tuyến tiền liệt chèn bàng quang — bác sĩ siêu âm xác định"',
      },
      {
        objection: '"Saw palmetto là thảo dược — không mạnh bằng thuốc Tây"',
        counterPosture: 'slow-converter — "tôi dùng Tamsulosin 6 tháng — có tác dụng phụ huyết áp tụt. Chuyển qua saw palmetto + beta-sitosterol — chậm hơn nhưng không phản ứng"',
      },
    ],
  },

  'hemorrhoids-digestive-shame': {
    niche: 'hemorrhoids-digestive-shame',
    objections: [
      {
        objection: '"Trĩ phải mổ — không có thuốc nào chữa được"',
        counterPosture: 'slow-converter — "tôi sợ mổ trĩ — đau khủng khiếp. 3 tháng dùng diosmin + thuốc bôi — búi trĩ co lại 70%. Chưa cần mổ"',
      },
      {
        objection: '"Mua thuốc bôi ở nhà thuốc là đủ"',
        counterPosture: 'both-and — "tôi vẫn dùng thuốc bôi khi rát. Cái này uống vào để tĩnh mạch khỏe — bôi chỉ giảm triệu chứng tạm"',
      },
      {
        objection: '"Trĩ do ngồi nhiều — chỉ cần đứng dậy thường xuyên"',
        counterPosture: 'gentle-correction — "tôi làm văn phòng — đứng đứng đi đi vẫn không khá. Là tĩnh mạch đã giãn — cần hỗ trợ thành mạch co lại"',
      },
    ],
  },

  'eye-vision-care': {
    niche: 'eye-vision-care',
    objections: [
      {
        objection: '"Mỏi mắt là do screen-time nhiều — nghỉ là hết"',
        counterPosture: 'slow-converter — "tôi cũng nghĩ vậy. Nghỉ cuối tuần vẫn mỏi từ tối thứ 2. Cái này có lutein + omega — 6 tuần khác rõ"',
      },
      {
        objection: '"Phải đi đo độ + cắt kính mới — không phải uống thuốc"',
        counterPosture: 'both-and — "tôi vẫn đeo kính theo độ. Cái này là cho võng mạc — chống thoái hóa điểm vàng (di truyền nhà tôi)"',
      },
      {
        objection: '"Lutein supplement marketing — mắt vốn tự đủ"',
        counterPosture: 'cautious-researcher — "AREDS-2 study (NIH) chứng minh lutein + zeaxanthin chống AMD. Tôi đọc nghiên cứu trước khi mua"',
      },
    ],
  },

  // ── SPEC-FIX (2026-05-27) — health-functional split ──

  'health-respiratory': {
    niche: 'health-respiratory',
    objections: [
      {
        objection: '"Phải mổ xoang mới khỏi hẳn"',
        counterPosture: 'slow-converter — "tôi sợ mổ. 4 tháng dùng cái này — viêm xoang đỡ rõ. Bác sĩ bảo chưa cần mổ nữa"',
      },
      {
        objection: '"Xịt mũi nào cũng làm phụ thuộc"',
        counterPosture: 'gentle-correction — "thuốc co mạch như Otrivin có phụ thuộc thật. Cái này là dung dịch thảo dược + muối — không co mạch, không phụ thuộc"',
      },
      {
        objection: '"Rửa mũi nước muối là đủ"',
        counterPosture: 'both-and — "tôi vẫn rửa mũi mỗi sáng. Cái này dùng thêm khi cần — không thay thế nước muối, chỉ là tăng hiệu quả"',
      },
    ],
  },

  'health-joint': {
    niche: 'health-joint',
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
        objection: '"Glucosamine không có evidence mạnh"',
        counterPosture: 'cautious-researcher — "tôi đọc nghiên cứu — glucosamine + chondroitin combine có evidence vừa phải. Đáng thử trước khi mổ"',
      },
    ],
  },

  'health-digestive': {
    niche: 'health-digestive',
    objections: [
      {
        objection: '"Phải uống omeprazole cả đời"',
        counterPosture: 'both-and — "tôi vẫn uống omeprazole sáng. Cái này hỗ trợ niêm mạc + cân bằng acid — giảm liều omeprazole sau 3 tháng"',
      },
      {
        objection: '"Chỉ cần kiêng cay + chua là hết"',
        counterPosture: 'slow-converter — "tôi kiêng 1 năm vẫn đầy bụng. Cái này dùng thêm — ăn nhẹ cay vẫn ổn"',
      },
      {
        objection: '"Dạ dày do stress, supplement vô ích"',
        counterPosture: 'gentle-correction — "stress trigger thật, nhưng niêm mạc viêm sẵn cần phục hồi. Cái này là cho niêm mạc, không phải thuốc tâm lý"',
      },
    ],
  },

  'health-cardiovascular': {
    niche: 'health-cardiovascular',
    objections: [
      {
        objection: '"Phải uống thuốc huyết áp + statin theo đơn — supplement vô ích"',
        counterPosture: 'both-and — "tôi vẫn uống thuốc theo đơn bác sĩ. Cái này là CoQ10 + omega — bác sĩ cho phép. Hỗ trợ thêm chứ không thay"',
      },
      {
        objection: '"Huyết áp cao do tuổi, không cản được"',
        counterPosture: 'slow-converter — "tôi cũng nghĩ vậy. 6 tháng dùng — huyết áp từ 150/95 về 135/85. Bác sĩ giảm liều thuốc"',
      },
      {
        objection: '"CoQ10 / omega-3 chỉ là marketing"',
        counterPosture: 'cautious-researcher — "tôi đọc — statin gây thiếu CoQ10, omega-3 chống viêm mạch. Có evidence vừa phải, đáng bổ sung"',
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
