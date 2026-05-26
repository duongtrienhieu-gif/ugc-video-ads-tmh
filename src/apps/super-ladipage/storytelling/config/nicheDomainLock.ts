// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — NICHE DOMAIN LOCK (Chunk C2 Stabilization)
//
// Strict per-niche concrete-data pools to PREVENT cross-niche contamination.
// Each niche owns SEPARATED pools (symptoms / friction / sensory / body-
// language / hidden fears / daily behaviors) PLUS explicit forbidden-leak
// list — phrases that belong to OTHER niches and must NOT appear here.
//
// Without strict separation: reader unconsciously notices "tóc rụng" pack
// using "đứng dậy chậm" or "nostalgic of energetic self" — template reuse
// → immersion drop → conversion drop.
//
// Architecture rule: each pool is SAMPLED concretely (not paraphrased)
// into per-pack prompt. Gemini cannot guess generic body symptoms — it
// picks from niche's pool only.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey } from '../types'

export interface NicheDomainLock {
  niche: NicheKey
  /** Concrete physical symptoms specific to this niche. */
  symptomsPool: string[]
  /** Daily friction behaviors — what reader does to navigate the condition. */
  frictionPool: string[]
  /** Sensory snapshots — smell/touch/sight/sound specific to niche. */
  sensoryPool: string[]
  /** Micro physical cues / postures reader displays. */
  bodyLanguagePool: string[]
  /** Unspoken fears reader carries specific to niche. */
  hiddenFearsPool: string[]
  /** Routine daily behaviors tinged by the condition. */
  dailyBehaviorsPool: string[]
  /** Cross-niche leak risk — phrases that belong to OTHER niches.
   *  Used by nicheContaminationDetector to flag pollution. */
  forbiddenLeak: string[]
}

export const NICHE_DOMAIN_LOCK: Record<NicheKey, NicheDomainLock> = {
  // ─── HAIRCARE — femininity / mirror / attractiveness ────────────────
  'haircare': {
    niche: 'haircare',
    symptomsPool: [
      'tóc rụng nắm khi gội đầu',
      'tóc bám đầy lược chải',
      'vùng đỉnh đầu lộ rõ da đầu',
      'sợi tóc mảnh hơn rõ rệt',
      'tóc khô gãy ở phần đuôi',
      'tóc rụng trên gối mỗi sáng',
      'thấy da đầu rõ qua tóc khi ánh đèn từ trên rọi xuống',
      'tóc không còn bám chắc — kéo nhẹ là rời',
    ],
    frictionPool: [
      'né ánh đèn LED từ trên đầu (phòng họp, thang máy, siêu thị)',
      'buộc tóc khác cách để che vùng đỉnh',
      'mặc tóc xõa che mặt khi gặp người quen lâu',
      'đếm số sợi rụng trên gối mỗi sáng',
      'nghiêng đầu trước gương để góc tóc trông dày hơn',
    ],
    sensoryPool: [
      'tay sờ vùng đỉnh đầu vô thức nhiều lần trong ngày',
      'cảm giác da đầu nhờn nhanh hơn — phải gội thường xuyên',
      'sợi tóc nhẹ tênh trên ngón tay khi vén lên',
      'mùi dầu gội mới mỗi 2 tháng vì hy vọng sản phẩm này khác',
    ],
    bodyLanguagePool: [
      'vén tóc lên rồi đặt xuống vì không muốn nhìn rõ vùng đỉnh',
      'che vùng đỉnh khi cúi đầu chào',
      'né selfie góc cao',
      'tránh để ai chụp ảnh mình từ phía sau',
    ],
    hiddenFearsPool: [
      'phải đội mũ / che tóc cả đời',
      'chồng/bạn trai bắt đầu để ý nhưng không nói',
      'tóc tiếp tục mỏng không gì cản được',
      'mình không còn xinh như trước',
      'lần gặp lại bạn cũ sẽ bị nhận xét',
    ],
    dailyBehaviorsPool: [
      'soi gương trong xe rồi tắt camera trước',
      'mua serum mọc tóc rồi quên dùng đều',
      'thử dầu gội mới mỗi 2 tháng — vẫn rụng',
      'tự cắt tóc ngắn hơn vì nghĩ "đỡ rụng hơn"',
      'tìm cách chải tóc che vùng đỉnh',
    ],
    forbiddenLeak: [
      'đứng dậy chậm', 'vịn cầu thang', 'đầu gối nhói',
      'pin cạn 3 giờ chiều', 'sương mù não', 'chiều 3h hết pin',
      'snapping at chồng', 'khóc một mình trong nhà tắm',
      'ngủ không sâu', 'da xỉn màu', 'quầng thâm mắt',
    ],
  },

  // ─── SKINCARE — age visibility / social-confidence ─────────────────
  'skincare': {
    niche: 'skincare',
    symptomsPool: [
      'da xỉn màu — không còn sáng như trước',
      'quầng thâm mắt rõ hơn dù ngủ đủ',
      'lỗ chân lông to ở vùng mũi',
      'da khô + bong ở vùng mép môi',
      'nếp nhăn mịn quanh mắt khi cười',
      'tone da không đều',
      'mụn nhỏ kéo dài không khỏi hẳn',
    ],
    frictionPool: [
      'né ánh sáng trắng (siêu thị, phòng họp, đèn LED)',
      'mở camera trước rồi tắt nhiều lần',
      'chọn ảnh có filter mới đăng',
      'nghiêng đầu khi soi gương để không thấy đường nét quá rõ',
      'thử kem mới mỗi 2-3 tháng',
    ],
    sensoryPool: [
      'sờ vùng mắt khi mệt — quầng thâm rõ hơn',
      'cảm giác da khô khi vừa rửa mặt xong',
      'mùi kem mới hy vọng "lần này khác"',
      'cảm giác da căng khi cười sau khi không skincare',
    ],
    bodyLanguagePool: [
      'chỉnh ánh sáng phòng để selfie',
      'tránh chụp ảnh gần với bạn cũ',
      'nghiêng nửa đầu khi đứng cạnh người trẻ hơn',
      'lùi một bước khi soi gương buổi sáng',
    ],
    hiddenFearsPool: [
      'da xuống cấp nhanh hơn các bạn cùng tuổi',
      'người ta nhận ra mình đang già đi',
      'không còn nhận lời khen "trẻ" như trước',
      'không che được dấu vết thời gian dù chăm sóc',
    ],
    dailyBehaviorsPool: [
      'soi gương buổi sáng lâu hơn cần thiết',
      'mua thêm kem mới nhưng routine cũ vẫn không đỡ',
      'so sánh ảnh hiện tại với ảnh 2 năm trước',
      'lưu ảnh "trước - sau" của người khác về tham khảo',
    ],
    forbiddenLeak: [
      'tóc rụng', 'vùng đỉnh đầu', 'da đầu nhờn',
      'đứng dậy chậm', 'vịn cầu thang', 'đầu gối nhói',
      'pin cạn 3 giờ chiều', 'sương mù não',
      'khóc với con', 'snapping at chồng',
    ],
  },

  // ─── SUPPLEMENT-WELLNESS (hormone / energy / cognitive) ─────────────
  'supplement-wellness': {
    niche: 'supplement-wellness',
    symptomsPool: [
      'sáng dậy mệt hơn lúc đi ngủ',
      '3 giờ chiều cạn pin — không nghĩ được nữa',
      'cảm xúc phẳng — không buồn không vui',
      'cáu nhẹ với mọi thứ',
      'ngủ chập chờn, dậy giữa đêm',
      'bốc hỏa lúc giữa đêm hoặc giữa cuộc họp',
      'không tập trung nổi 30 phút liên tục',
      'sương mù não — quên giữa câu',
    ],
    frictionPool: [
      'pha ly cà phê thứ 3 trong ngày',
      'không lên lịch đi chơi cuối tuần — sợ không có sức',
      'từ chối hẹn cà phê vào 3 giờ chiều',
      'mua thêm vitamin tổng hợp — chưa uống đủ liều',
      'lén nằm xuống bàn 5 phút giữa giờ làm',
    ],
    sensoryPool: [
      'mí mắt sụp lúc 8 giờ tối',
      'cảm giác đầu nặng từ trán trở lên',
      'tay tê nhẹ ở đầu ngón vào buổi sáng',
      'cảm giác cơ thể "tắt điện" sau bữa trưa',
    ],
    bodyLanguagePool: [
      'tựa cằm vào tay khi nói chuyện vì quá mệt',
      'thở ra dài hơn bình thường khi ngồi xuống',
      'ngồi ở bàn 5 phút mà không nhớ định làm gì',
      'mở tủ lạnh xong quên định lấy gì',
    ],
    hiddenFearsPool: [
      'mệt suốt mà không có lý do "đủ to" để nghỉ',
      'tâm trí mờ — không tập trung như xưa',
      'không thấy chiều dài đời như xưa nữa',
      'mình không còn là người energetic ngày xưa',
      'phải uống cà phê cả ngày để function',
    ],
    dailyBehaviorsPool: [
      'không kể với chồng/vợ là mỗi sáng phải lấy can đảm dậy',
      'mua thêm vitamin nhưng chưa đều',
      'tự bảo "cuối tuần ngủ bù" — rồi vẫn mệt thứ 2',
      'pha cà phê thứ 3 mà tay đã quen mở tủ',
    ],
    forbiddenLeak: [
      'tóc rụng', 'vùng đỉnh đầu',
      'da xỉn màu', 'quầng thâm mắt rõ hơn',
      'đứng dậy chậm', 'vịn cầu thang', 'đầu gối nhói',
      'khóc với con', 'không nhận ra phiên bản sau sinh',
    ],
  },

  // ─── HEALTH-FUNCTIONAL — joint / movement / aging body ──────────────
  'health-functional': {
    niche: 'health-functional',
    symptomsPool: [
      'đầu gối nhói khi đứng dậy bất chợt',
      'tay tê khi cầm điện thoại lâu',
      'phải ngồi vài giây trước khi đứng',
      'cứng người sau khi ngồi quá 30 phút',
      'vai gáy đau âm ỉ kéo dài',
      'đi cầu thang phải vịn',
      'lưng đau khi cúi xuống nhặt đồ',
    ],
    frictionPool: [
      'né cầu thang ở nơi công cộng — đi thang máy',
      'không nói đau với người nhà',
      'giả vờ buộc dây giày để ngồi nghỉ',
      'không nhận lời đi xa với bạn cũ',
      'kéo ghế chậm khi ngồi xuống bàn ăn',
    ],
    sensoryPool: [
      'cảm giác cứng khớp khi mới thức dậy',
      'tê bì lan từ tay xuống các đầu ngón',
      'nhói âm ỉ ở khớp khi thay đổi tư thế',
      'cảm giác lưng nặng khi đứng quá 20 phút',
    ],
    bodyLanguagePool: [
      'xoa đầu gối vô thức khi đang nói chuyện',
      'đặt tay lên thắt lưng khi đứng dậy',
      'lăn vai khi đang ngồi làm việc',
      'đứng cạnh giường mấy giây trước khi bước xuống',
    ],
    hiddenFearsPool: [
      'cơ thể đang xuống nhanh hơn dự đoán',
      'sẽ trở thành gánh nặng cho gia đình',
      'không còn chơi với cháu/con như muốn',
      'phải vịn cầu thang vĩnh viễn',
      'sẽ phải đi viện sớm hơn dự kiến',
    ],
    dailyBehaviorsPool: [
      'đi siêu thị về phải nằm ngay',
      'mua miếng dán giảm đau dự trữ trong túi xách',
      'mở tủ lạnh xong quên định lấy gì',
      'không leo lên thang lấy đồ trên kệ cao nữa',
    ],
    forbiddenLeak: [
      'tóc rụng', 'vùng đỉnh đầu', 'da đầu',
      'da xỉn màu', 'quầng thâm mắt rõ hơn',
      'cảm xúc phẳng', 'snapping at chồng', 'khóc với con',
      'attractiveness anxiety', 'né camera',
    ],
  },

  // ─── MOM-BABY — postpartum identity / invisible exhaustion ─────────
  'mom-baby': {
    niche: 'mom-baby',
    symptomsPool: [
      'tóc rụng nắm khi gội đầu sau sinh',
      'người nặng nề chưa lấy lại form',
      'mệt mỏi nhưng không thể nghỉ',
      'cáu nhẹ với chồng hoặc con không hiểu vì sao',
      'ngực căng + nứt khi cho con bú',
      'không ngủ liền 4 tiếng từ khi sinh',
    ],
    frictionPool: [
      'né gặp bạn cũ chưa có con',
      'không chụp ảnh trừ ảnh con',
      'không mua áo size mình bây giờ — vẫn nghĩ "sẽ giảm cân"',
      'lén khóc trong nhà tắm',
      'từ chối tụ tập đông người',
    ],
    sensoryPool: [
      'mùi sữa khi cho con bú lúc 3 giờ sáng',
      'cảm giác tay run nhẹ khi pha sữa',
      'mệt sâu ở mí mắt khi nghe con khóc',
      'cảm giác tóc rụng từng nắm khi gội',
    ],
    bodyLanguagePool: [
      'tay tự sờ bụng vô thức',
      'cúi đầu khi gặp người quen ngoài đường',
      'ngồi cho con bú lúc 3 giờ sáng — không thể ngủ lại',
      'mở album hình cũ rồi tắt đi nhanh',
    ],
    hiddenFearsPool: [
      'không nhận ra phiên bản mới của mình',
      'tóc rụng không phục hồi',
      'cơ thể không quay lại được như trước sinh',
      'không có ai hiểu mình mệt thế nào',
      'mình đã đánh mất bản thân vì làm mẹ',
    ],
    dailyBehaviorsPool: [
      'mua áo size cũ về và nhét vào ngăn dưới cùng',
      'so sánh ảnh trước-sau sinh rồi đóng tab',
      'cố ngủ thêm 30 phút khi chồng dậy đỡ con',
      'lén ăn vội khi con đang ngủ',
    ],
    forbiddenLeak: [
      'đứng dậy chậm', 'vịn cầu thang', 'đầu gối nhói',
      'phòng họp', 'phải làm việc tập trung',
      'attractiveness anxiety của phụ nữ độc thân',
      'tone da xỉn', 'lỗ chân lông',
    ],
  },

  // ─── BEAUTY-CONFIDENCE — attractiveness / social visibility ─────────
  'beauty-confidence': {
    niche: 'beauty-confidence',
    symptomsPool: [
      'da xỉn — không bắt sáng như trước',
      'cảm giác mặt mất sức sống',
      'quầng thâm + bọng mắt rõ',
      'tone da không đều',
      'nếp nhăn mịn quanh mắt khi cười rõ hơn',
      'da phản ứng nhanh với stress',
    ],
    frictionPool: [
      'né bữa tụ tập đông người',
      'mở camera lên — tắt — mở lại lần nữa',
      'chọn ảnh có filter mới chia sẻ',
      'né selfie cùng bạn trẻ hơn',
      'lùi 1 bước khi soi gương',
    ],
    sensoryPool: [
      'cảm giác da căng + thô khi vừa rửa mặt',
      'sờ vùng cằm khi đối diện gương — nhăn nhẹ',
      'mùi makeup heavy trên da khi cố che hết',
      'cảm giác cảm xúc thấp khi soi gương buổi sáng',
    ],
    bodyLanguagePool: [
      'mỉm cười nhẹ trong gương để xem đường nét cười',
      'nghiêng đầu khi đứng cạnh bạn trẻ hơn',
      'tay che cằm khi nói chuyện',
      'mở filter trước khi quay phim ngắn cho con xem',
    ],
    hiddenFearsPool: [
      'mình đang xuống cấp nhanh hơn bạn cùng tuổi',
      'không còn được nhìn như trước',
      'sự attractiveness của mình đang fade',
      'lần gặp lại bạn cũ — họ sẽ nhận ra',
      'mất sự attention từ chồng/bạn trai',
    ],
    dailyBehaviorsPool: [
      'chuyển ánh sáng phòng để selfie sáng hơn',
      'mua filter app + dùng mỗi khi chụp',
      'so sánh ảnh mình hiện tại với ảnh người khác cùng tuổi',
      'thêm bước skincare mới mỗi 3 tháng',
    ],
    forbiddenLeak: [
      'đứng dậy chậm', 'vịn cầu thang', 'đầu gối nhói',
      'pin cạn 3 giờ chiều', 'sương mù não',
      'khóc với con', 'snapping at chồng',
      'tóc rụng nắm', 'vùng đỉnh đầu lộ da',
    ],
  },

  // ─── RELATIONSHIP — emotional presence / patience / warmth ─────────
  'relationship': {
    niche: 'relationship',
    symptomsPool: [
      'cảm xúc phẳng — không vui không buồn',
      'snap với chồng/con vì chuyện vặt',
      'overstimulation khi tiếng ồn nhiều',
      'mệt khi nghe người khác nói chuyện lâu',
      'không muốn về nhà sau ngày dài',
      'không có patience với bố mẹ già',
      'cười cho có — không cảm thấy thật',
    ],
    frictionPool: [
      'né cuộc gọi từ mẹ hoặc bạn thân',
      'lấy cớ bận để không đi tụ tập',
      'vào phòng riêng sau bữa tối',
      'ngồi lâu trong xe trước khi vào nhà',
      'mở điện thoại để né nói chuyện với chồng',
    ],
    sensoryPool: [
      'cảm giác đầu căng khi nghe quá nhiều tiếng nói',
      'cơ thể nặng + uể oải khi về tới nhà',
      'cảm giác như đang đeo mặt nạ giả vờ vui',
      'mùi cơm tối nhà mẹ — không còn thấy thèm',
    ],
    bodyLanguagePool: [
      'thở ra dài khi nghe ai bắt đầu kể chuyện',
      'không nhìn vào mắt khi nói chuyện với người thân',
      'ngồi xa người yêu trên ghế sofa hơn trước',
      'cười nhanh rồi quay đi — không kéo dài',
    ],
    hiddenFearsPool: [
      'mình đang trở thành người cộc tính',
      'chồng/bạn trai bắt đầu để ý mình thay đổi',
      'sẽ mất kết nối với con vì không có patience',
      'mình không còn là người ấm như trước',
      'sẽ cô đơn dù xung quanh có người',
    ],
    dailyBehaviorsPool: [
      'ngồi 10 phút trong xe trước khi xuống đón con',
      'đeo tai nghe khi đi siêu thị để giảm noise',
      'né ăn tối cùng cả nhà — viện cớ bận',
      'mua trà thảo mộc về uống mà chưa pha bao giờ',
    ],
    forbiddenLeak: [
      'tóc rụng', 'vùng đỉnh đầu',
      'da xỉn màu', 'quầng thâm mắt rõ hơn',
      'đứng dậy chậm', 'vịn cầu thang', 'đầu gối nhói',
      'pin cạn 3 giờ chiều theo nghĩa năng lượng vật lý',
    ],
  },

  // ─── FITNESS-RECOVERY — COD impulse / joint / muscle / pain ─────────
  'fitness-recovery': {
    niche: 'fitness-recovery',
    symptomsPool: [
      'đầu gối nhói khi xuống cầu thang',
      'lưng đau âm ỉ kéo dài',
      'vai gáy cứng sau ngày làm việc',
      'tay tê khi cầm điện thoại lâu',
      'cứng khớp khi mới thức dậy',
      'cơ bắp đau sau khi đi bộ xa',
    ],
    frictionPool: [
      'không nhận lời đi du lịch dài ngày',
      'tránh mang vác đồ nặng',
      'né tham gia môn thể thao bạn rủ',
      'mua miếng dán giảm đau dự trữ',
      'massage chân/lưng mỗi tối trước khi ngủ',
    ],
    sensoryPool: [
      'cảm giác nhói rõ ở đầu gối khi đứng dậy',
      'mùi dầu nóng quen thuộc mỗi tối',
      'cảm giác mỏi nóng ở vùng vai khi gõ máy lâu',
      'cứng người khi vừa thức dậy — tay không đưa cao được',
    ],
    bodyLanguagePool: [
      'đặt tay lên thắt lưng khi đứng dậy',
      'xoa đầu gối vô thức khi đang ngồi',
      'lăn vai liên tục khi đang làm việc',
      'duỗi chân thẳng dưới bàn để giảm cứng',
    ],
    hiddenFearsPool: [
      'không còn vận động như trước',
      'sẽ bị ràng buộc với thuốc giảm đau dài hạn',
      'không leo núi / đi xa được nữa',
      'phải phẫu thuật khớp trong tương lai gần',
      'cơ thể xuống cấp nhanh hơn bạn cùng tuổi',
    ],
    dailyBehaviorsPool: [
      'mua dầu nóng / miếng dán dự trữ',
      'tự massage đầu gối/lưng mỗi tối',
      'né đi du lịch trekking với bạn',
      'mua đôi giày mới với hy vọng đỡ đau',
    ],
    forbiddenLeak: [
      'tóc rụng', 'vùng đỉnh đầu',
      'da xỉn màu', 'quầng thâm mắt rõ hơn',
      'cảm xúc phẳng', 'snapping at chồng', 'khóc với con',
      'attractiveness anxiety',
    ],
  },
}

/** Get domain lock for niche — never null (8 niches covered). */
export function getDomainLockForNiche(niche: NicheKey): NicheDomainLock {
  return NICHE_DOMAIN_LOCK[niche]
}

/** Compose domain lock brief — surfaces forbidden-leak prominently. */
export function nicheDomainLockBrief(lock: NicheDomainLock): string {
  return [
    `═══ NICHE DOMAIN LOCK (${lock.niche}) — strict separation ═══`,
    `Concrete symptoms (use 2-3 across pack — NEVER paraphrase generically):`,
    ...lock.symptomsPool.slice(0, 4).map((s) => `  - ${s}`),
    `Friction behaviors (sample 1-2 per recognition block):`,
    ...lock.frictionPool.slice(0, 3).map((b) => `  - ${b}`),
    `Body language cues (weave subtly):`,
    ...lock.bodyLanguagePool.slice(0, 3).map((c) => `  - ${c}`),
    `Hidden fears (surface 1 in Phase 1 hidden-emotional-truth block):`,
    ...lock.hiddenFearsPool.slice(0, 3).map((f) => `  - ${f}`),
    `⛔ FORBIDDEN cross-niche phrases (NEVER appear in this pack):`,
    `  ${lock.forbiddenLeak.join(' / ')}`,
  ].join('\n')
}
