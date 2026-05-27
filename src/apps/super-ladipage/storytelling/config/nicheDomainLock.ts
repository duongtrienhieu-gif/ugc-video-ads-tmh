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

  // ── Tier S extensions (2026-05-27) ──

  'sleep-insomnia': {
    niche: 'sleep-insomnia',
    symptomsPool: [
      '2-3 giờ sáng nhìn trần nhà',
      'mí mắt nặng nhưng não vẫn chạy',
      'trở dậy đêm 2-3 lần',
      'sáng dậy thấy mệt như chưa ngủ',
      'cà phê thứ 2 trong buổi sáng không đủ tỉnh',
      'cảm giác "thân tan thân ra" lúc 3 giờ chiều',
    ],
    frictionPool: [
      'lướt điện thoại đến 1-2 giờ sáng vì không ngủ được',
      'uống cà phê chiều để chống buồn ngủ',
      'né cuộc họp sáng nếu được',
      'từ chối đi chơi cuối tuần vì "phải bù ngủ"',
      'mua nến/tinh dầu/bịt mắt với hy vọng ngủ được',
    ],
    sensoryPool: [
      'cảm giác đồng hồ tích tắc quá rõ trong đêm',
      'ánh đèn pho từ điện thoại lúc 3 giờ sáng',
      'tiếng quạt máy chạy đều mà không ru ngủ được',
      'cảm giác chăn nóng/lạnh không vừa cả đêm',
    ],
    bodyLanguagePool: [
      'kiểm tra điện thoại liên tục giữa đêm',
      'trở mình liên tục 30 phút trước khi thiếp',
      'dụi mắt khi ngồi họp sáng',
      'tay che miệng ngáp âm thầm trong cuộc trò chuyện',
    ],
    hiddenFearsPool: [
      'tâm trí mình "khác" — không bao giờ ngủ thật được',
      'cơ thể đang xuống cấp vì mất ngủ kéo dài',
      'sợ buổi tối vì lại đối diện với chiếc gối',
      'mất ngủ là dấu hiệu bệnh nặng nào đó',
    ],
    dailyBehaviorsPool: [
      'mua nến thơm / tinh dầu / loa white noise',
      'thử app meditation rồi bỏ',
      'uống thuốc bổ thần kinh hy vọng có hiệu quả',
      'tắt đèn 10 giờ tối nhưng nằm tới 1 giờ sáng',
    ],
    forbiddenLeak: [
      'tóc rụng', 'vùng đỉnh đầu', 'da xỉn màu',
      'tê tay chân', 'đau khớp', 'đau lưng',
      'bốc hỏa', 'kinh nguyệt', 'libido',
      'thâm nách', 'tẩy lông',
    ],
  },

  'menopause': {
    niche: 'menopause',
    symptomsPool: [
      'bốc hỏa đột ngột giữa cuộc họp',
      'đổ mồ hôi đêm — tỉnh giấc với áo ướt',
      'cáu vô cớ với chồng / con',
      'kinh nguyệt đến muộn / không đều',
      'khô âm đạo gây khó chịu',
      'mất ham muốn với chồng',
    ],
    frictionPool: [
      'mặc nhiều lớp áo để dễ tháo khi bốc hỏa',
      'tránh váy ôm body vì sợ đổ mồ hôi lưng',
      'từ chối ăn cay/uống rượu — sợ trigger bốc hỏa',
      'né uống nước nóng / nóng phòng',
      'tránh thân mật với chồng — sợ đau khô',
    ],
    sensoryPool: [
      'cảm giác mặt nóng bừng đột ngột',
      'lưng áo ướt giữa đêm',
      'cổ và ngực đỏ rần khi bốc hỏa',
      'tóc xõa đột nhiên nặng nóng',
    ],
    bodyLanguagePool: [
      'tay quạt phần cổ ngầm',
      'kéo cổ áo cao xuống thấp',
      'mở cửa sổ giữa cuộc họp',
      'cười gượng khi đồng nghiệp hỏi "có nóng không"',
    ],
    hiddenFearsPool: [
      'không còn được nhìn là "phụ nữ" — chỉ là "bà"',
      'chồng sẽ ngừng quan tâm',
      'tôi đang mất đi bản thân từng có',
      'những năm còn lại sẽ chỉ là già và mệt',
    ],
    dailyBehaviorsPool: [
      'mua quạt cầm tay nhỏ giấu trong túi',
      'kiểm tra thân nhiệt liên tục',
      'thử phytoestrogen / dầu hoa anh thảo',
      'tránh chụp ảnh chung — sợ thấy mặt đỏ',
    ],
    forbiddenLeak: [
      'tóc rụng', 'vùng đỉnh đầu',
      'mất ngủ chỉ vì stress công việc',
      'da xỉn do thiếu skincare',
      'đau khớp do vận động',
      'tê tay chân',
      'cảm xúc trẻ con buồn vu vơ',
    ],
  },

  'mental-health': {
    niche: 'mental-health',
    symptomsPool: [
      'chest tightness khi mở email buổi sáng',
      'tỉnh giấc 4-5 giờ sáng với cảm giác lo',
      'thở dồn khi ngồi trong cuộc họp',
      'mệt nhưng không ngủ được — overtired',
      'mất tập trung — đọc 1 trang phải đọc lại 3 lần',
      'cười gượng khi bạn bè hỏi "có ổn không"',
    ],
    frictionPool: [
      'né mở thông báo điện thoại buổi sáng',
      'từ chối tụ tập bạn bè — lý do "bận"',
      'hủy hẹn cuối phút — viết tin "thôi để hôm khác"',
      'làm việc đến 11 giờ đêm để né suy nghĩ',
      'lướt mạng xã hội vô thức 2-3 giờ liền',
    ],
    sensoryPool: [
      'cảm giác chật ngực — phải hít thở sâu mới thoải mái',
      'tay run nhẹ khi cầm cốc cà phê',
      'tim đập nhanh khi điện thoại reo',
      'cảm giác đầu nặng như có sương mù',
    ],
    bodyLanguagePool: [
      'xoa ngực ngầm khi căng thẳng',
      'bóp gáy / cổ trong cuộc họp',
      'tay co lại khi nghe tin xấu',
      'cười không tới mắt',
    ],
    hiddenFearsPool: [
      'tôi đang "khác đi" — không còn là người tôi từng là',
      'sẽ không bao giờ thoát được cảm giác này',
      'nếu nói thật, ai cũng sẽ xa tôi',
      'tôi yếu đuối — người khác chịu được sao tôi không',
    ],
    dailyBehaviorsPool: [
      'thử app meditation / Calm / Headspace',
      'mua trà giảm stress / ashwagandha',
      'đọc sách self-help nhưng không áp dụng được',
      'pha cốc cà phê thứ 3 vì "chỉ thế mới chịu được ngày"',
    ],
    forbiddenLeak: [
      'tóc rụng', 'da xỉn', 'mụn',
      'đau khớp', 'tê tay', 'lưng',
      'bốc hỏa', 'kinh nguyệt',
      'cân nặng', 'vóc dáng',
      'libido', 'sexual',
    ],
  },

  'anti-aging-longevity': {
    niche: 'anti-aging-longevity',
    symptomsPool: [
      'soi gương sáng — "đây thật sự là tôi sao"',
      'lấy ảnh CMND năm 30 tuổi ra ngắm',
      'nhận ra bố mẹ già nhanh trong 1-2 năm gần đây',
      'thức dậy mệt dù ngủ 8 tiếng',
      'recovery sau 1 đêm ít ngủ — mất 3 ngày',
      'nhìn bạn cùng tuổi rồi tự hỏi "sao họ trẻ vậy"',
    ],
    frictionPool: [
      'tránh chụp ảnh chung với đồng nghiệp trẻ',
      'giấu tuổi khi gặp người mới',
      'tự nhủ "phải tập gym" rồi lại không',
      'theo dõi biological age test mỗi vài tháng',
      'tự đo body composition / chỉ số liên tục',
    ],
    sensoryPool: [
      'cảm giác mỏi sâu trong khớp khi thay đổi thời tiết',
      'da khô đột ngột — kem nào cũng không đủ',
      'cảm giác cơ thể "chậm" hơn — đi bộ cũng phải nghỉ',
      'mệt tinh thần đến mức nhìn vào TV còn thấy đuối',
    ],
    bodyLanguagePool: [
      'sờ nếp nhăn dưới mắt khi soi gương',
      'massage cổ ngầm khi ngồi máy tính',
      'thở dài khi đứng dậy từ ghế thấp',
      'che hai bàn tay khi chụp ảnh',
    ],
    hiddenFearsPool: [
      'sẽ không còn 10-20 năm tốt nữa',
      'cơ thể đang đi xuống nhanh hơn tôi nhận ra',
      'sẽ là gánh nặng cho con cháu',
      'những điều tôi muốn làm sẽ không kịp',
      'biological age cao hơn chronological — tôi đã "già" rồi',
    ],
    dailyBehaviorsPool: [
      'uống NMN / resveratrol / collagen mỗi sáng',
      'theo dõi biological age test 3-6 tháng/lần',
      'đo body comp / blood markers thường xuyên',
      'subscribe podcast longevity (Peter Attia, Huberman)',
    ],
    forbiddenLeak: [
      'tóc rụng chỉ vì stress',
      'mụn da liễu',
      'đau khớp do vận động sai',
      'mất ngủ stress công việc',
      'bốc hỏa', 'kinh nguyệt',
      'lo âu', 'trầm cảm',
    ],
  },

  // ── SEA-6 extensions (2026-05-27) — popular SEA market niches ──

  // ─── DENTAL-ORAL-CARE — social embarrassment / breath / smile ───────
  'dental-oral-care': {
    niche: 'dental-oral-care',
    symptomsPool: [
      'hơi thở có mùi dù vừa đánh răng',
      'răng ố vàng dần dù dùng kem đánh răng đắt',
      'cao răng tích nhiều ở chân răng',
      'nướu chảy máu khi đánh răng',
      'răng ê buốt khi ăn lạnh / nóng',
      'kẽ răng giắt thức ăn không xỉa ra hết',
      'nướu sưng nhẹ vào buổi sáng',
    ],
    frictionPool: [
      'che miệng khi cười to với người mới gặp',
      'né nói gần mặt người khác — sợ hơi thở',
      'kiểm tra hơi thở bằng tay che miệng',
      'nhai kẹo cao su trước cuộc họp / hẹn hò',
      'né chụp ảnh cười hở răng',
    ],
    sensoryPool: [
      'vị tanh trong miệng vào sáng sớm',
      'cảm giác răng "mượt" sau khi đánh kỹ — chỉ 1-2 tiếng',
      'cao răng cảm nhận được khi lưỡi chạm',
      'ê buốt rõ khi uống nước đá',
    ],
    bodyLanguagePool: [
      'mím môi nhẹ khi cười để giấu răng vàng',
      'tay che miệng khi cười to',
      'hít vào lòng bàn tay kiểm tra hơi thở',
      'né cười lộ răng trong selfie nhóm',
    ],
    hiddenFearsPool: [
      'đồng nghiệp / khách hàng để ý hơi thở mà không nói',
      'con / cháu bắt đầu né hôn lên má',
      'tới tuổi sẽ phải làm răng giả / implant đắt',
      'cao răng làm răng tự rơi dần — đã muộn để cứu',
    ],
    dailyBehaviorsPool: [
      'mua nước súc miệng + tăm chỉ — hết rồi mua tiếp',
      'đi cạo vôi răng 6 tháng/lần — vẫn vàng',
      'chuyển kem đánh răng đắt hơn — kết quả như nhau',
      'kiểm tra hơi thở trong xe trước cuộc hẹn',
    ],
    forbiddenLeak: [
      'đầu gối nhói', 'vịn cầu thang', 'đau lưng', 'tê tay',
      'tóc rụng', 'da xỉn màu',
      'mất ngủ', 'lo âu',
      'bốc hỏa', 'tiểu đêm',
      'gan nhiễm mỡ', 'tiểu đường',
      'libido', 'trĩ', 'táo bón',
    ],
  },

  // ─── DIABETES-BLOOD-SUGAR — chronic anxiety / food restriction ─────
  'diabetes-blood-sugar': {
    niche: 'diabetes-blood-sugar',
    symptomsPool: [
      'glucose sáng 7-8 mmol/L — cao hơn ngưỡng',
      'mệt sau bữa cơm — buồn ngủ rõ',
      'khát nước liên tục dù uống đủ',
      'A1C 7.5% — bác sĩ nhắc 3 tháng liền',
      'tiểu đêm 2 lần — đường trong máu cao kéo nước',
      'vết thương lâu lành ở chân / tay',
      'tê châm chích đầu ngón chân (peripheral neuropathy nhẹ)',
    ],
    frictionPool: [
      'không dám ăn cơm trắng + chè cùng bữa',
      'cố tránh tiệc sinh nhật / đám cưới — sợ bánh',
      'mua máy đo glucose dùng 3 ngày rồi cất',
      'không uống nước ngọt khi đi với bạn — bị hỏi',
      'cơm nhà nấu riêng — vợ/chồng ăn khác',
    ],
    sensoryPool: [
      'tê châm chích đầu ngón chân vào buổi tối',
      'mắt mờ nhẹ sau bữa cơm tinh bột',
      'khát + miệng khô vào ban đêm',
      'mệt sâu sau 1 tiếng ăn — như buồn ngủ',
    ],
    bodyLanguagePool: [
      'thở ra dài khi nhìn bánh ngọt ở tiệm cà phê',
      'đẩy bát cơm sang một bên — ăn nửa',
      'kiểm tra glucose lén trước bữa ăn ngoài',
      'từ chối tráng miệng với nụ cười gượng',
    ],
    hiddenFearsPool: [
      'sẽ phải tiêm insulin trong vài năm tới',
      'biến chứng mắt / thận / chân — sợ đoạn chi',
      'không kiểm soát được — đường vẫn lên dù đã kiêng',
      'con tôi sẽ di truyền tiểu đường',
      'không bao giờ ăn cơm thoải mái như xưa nữa',
    ],
    dailyBehaviorsPool: [
      'đo glucose buổi sáng — ghi vào sổ',
      'uống metformin + theo dõi A1C 3 tháng/lần',
      'mua bột yến mạch / gạo lứt thay cơm trắng',
      'tự ép đi bộ 30 phút sau ăn',
      'tìm hiểu chỉ số GI của từng món',
    ],
    forbiddenLeak: [
      'tóc rụng', 'da xỉn', 'mụn',
      'đau khớp', 'đầu gối',
      'bốc hỏa', 'kinh nguyệt',
      'lo âu chỉ vì công việc',
      'libido nam',
      'trĩ', 'táo bón',
      'mắt mỏi do màn hình',
    ],
  },

  // ─── LIVER-DETOX — silent damage / hidden anxiety ──────────────────
  'liver-detox': {
    niche: 'liver-detox',
    symptomsPool: [
      'men gan ALT 80-100 — gấp đôi bình thường',
      'siêu âm gan nhiễm mỡ độ 1-2',
      'mệt mỏi không lý do — ngủ đủ vẫn mệt',
      'da vàng nhẹ ở mắt khi nhìn ánh sáng',
      'đau âm ỉ vùng hạ sườn phải',
      'tiêu hóa kém — đầy bụng sau bữa nhậu',
      'cholesterol cao đi kèm — bác sĩ nhắc',
    ],
    frictionPool: [
      'né cuộc nhậu với đồng nghiệp / bạn cũ',
      'kiếm cớ "đang điều trị" để không uống bia',
      'không dám ăn nội tạng / da gà như trước',
      'soi gương kiểm tra mắt vàng ở ánh đèn',
      'tránh kể với gia đình men gan cao — sợ lo',
    ],
    sensoryPool: [
      'cảm giác nặng ở hạ sườn phải sau bữa ăn',
      'mệt lan từ trong gan ra cả người',
      'miệng đắng vào buổi sáng',
      'mùi hơi thở khác lạ sau đêm nhậu',
    ],
    bodyLanguagePool: [
      'tay tự xoa vùng hạ sườn phải khi ngồi lâu',
      'lắc đầu khi bạn rủ nhậu — không giải thích',
      'kiểm tra mắt mình trong gương xe',
      'thở dài khi nhìn kết quả xét nghiệm men gan',
    ],
    hiddenFearsPool: [
      'gan nhiễm mỡ → xơ gan → ung thư gan trong 5-10 năm',
      'không dấu hiệu rõ — chừng nào biết đã muộn',
      'sẽ phải kiêng bia rượu vĩnh viễn — cô lập xã hội',
      'gia đình sẽ phát hiện và lo lắng',
      'đã quá muộn để hồi phục — gan đã hỏng',
    ],
    dailyBehaviorsPool: [
      'mua silymarin / cây kế sữa về uống',
      'siêu âm gan 6 tháng/lần — kết quả không đỡ',
      'uống nước chanh ấm buổi sáng (detox tự nghĩ)',
      'kiêng bia 2 tuần rồi lại uống — không bền',
    ],
    forbiddenLeak: [
      'tóc rụng', 'da mụn', 'da xỉn vì skincare',
      'đau khớp', 'đầu gối', 'tê tay',
      'bốc hỏa', 'kinh nguyệt',
      'lo âu chỉ vì stress công việc',
      'tiểu đường', 'huyết áp', 'tim mạch',
      'tiểu đêm tuyến tiền liệt',
      'trĩ', 'táo bón',
    ],
  },

  // ─── PROSTATE-UROLOGY — silent male shame / nighttime trips ────────
  'prostate-urology': {
    niche: 'prostate-urology',
    symptomsPool: [
      'tiểu đêm 2-3 lần — phá giấc ngủ',
      'tia tiểu yếu / ngắt quãng',
      'tiểu xong vẫn cảm giác chưa hết',
      'phải đứng vài giây mới tiểu được',
      'tiểu rắt vào buổi sáng',
      'cảm giác đầy bàng quang dù vừa đi',
      'PSA 4-6 — bác sĩ theo dõi tuyến tiền liệt',
    ],
    frictionPool: [
      'né chuyến đi xa — sợ không có toilet kịp',
      'không uống nước sau 7 giờ tối',
      'kiểm tra toilet ở nhà hàng trước khi ngồi',
      'né phim dài 3 tiếng ở rạp — sợ ngắt giữa chừng',
      'không kể với vợ — sợ "không còn đàn ông"',
    ],
    sensoryPool: [
      'cảm giác bàng quang đầy lúc 2-3 giờ sáng',
      'tia tiểu yếu cảm nhận rõ khi đứng',
      'cảm giác mệt vào sáng vì mất giấc',
      'áp lực vùng chậu khi ngồi lâu',
    ],
    bodyLanguagePool: [
      'kiểm tra hướng toilet khi vào quán mới',
      'ngồi đứng 2-3 lần khi tiểu đêm',
      'gãi nhẹ vùng bụng dưới vô thức',
      'lén nhìn đồng hồ giữa đêm — biết là 3 giờ',
    ],
    hiddenFearsPool: [
      'tuyến tiền liệt → ung thư trong vài năm tới',
      'sẽ phải mang bỉm người lớn khi già',
      'không còn "đàn ông" như xưa — vợ sẽ biết',
      'phải phẫu thuật tuyến tiền liệt (TURP)',
      'sẽ mất khả năng tình dục cùng với BPH',
    ],
    dailyBehaviorsPool: [
      'uống saw palmetto / beta-sitosterol',
      'kiểm tra PSA 6 tháng/lần',
      'không uống nước sau 7 giờ tối',
      'đi tiểu lén trước khi đi ngủ 2 lần',
    ],
    forbiddenLeak: [
      'tóc rụng', 'da xỉn', 'mụn',
      'đau khớp', 'đầu gối',
      'bốc hỏa', 'kinh nguyệt', 'mãn kinh',
      'lo âu', 'trầm cảm chỉ vì stress',
      'tiểu đường', 'gan nhiễm mỡ',
      'trĩ', 'táo bón',
      'mắt mỏi do màn hình',
    ],
  },

  // ─── HEMORRHOIDS-DIGESTIVE-SHAME — bathroom suffering / silent ─────
  'hemorrhoids-digestive-shame': {
    niche: 'hemorrhoids-digestive-shame',
    symptomsPool: [
      'đau khi đi vệ sinh — phải rặn 5-10 phút',
      'búi trĩ lòi ra sau mỗi lần đi nặng',
      'chảy máu giấy vệ sinh sau khi đi',
      'ngứa rát vùng hậu môn cả ngày',
      'táo bón 3-4 ngày — phân khô + cứng',
      'cảm giác đi không hết — vẫn nặng bụng',
      'đau khi ngồi lâu (ghế cứng / xe máy)',
    ],
    frictionPool: [
      'né ngồi xe máy đường xa',
      'mua đệm donut giấu trong túi đi làm',
      'không kể với ai — kể cả vợ/chồng',
      'né các món cay / nhậu — sợ trĩ tái',
      'đi vệ sinh trong toilet công cộng — căng thẳng cực độ',
    ],
    sensoryPool: [
      'cảm giác rát + bỏng vùng hậu môn sau khi đi',
      'cảm giác có "cục" lòi ra khi ngồi xuống',
      'ngứa rát âm ỉ cả ngày',
      'cảm giác nặng vùng chậu khi đi bộ nhiều',
    ],
    bodyLanguagePool: [
      'đi đứng cẩn thận — né va chạm vùng dưới',
      'ngồi nửa mông trên ghế cứng',
      'lén đặt khăn lên ghế xe máy',
      'né cử động đột ngột sau khi vừa đi vệ sinh',
    ],
    hiddenFearsPool: [
      'sẽ phải phẫu thuật cắt trĩ — đau khủng khiếp',
      'nếu ai biết — quá xấu hổ',
      'sẽ không bao giờ ngồi thoải mái như trước',
      'búi trĩ to dần — đến mức không che được',
      'bị nhầm thành ung thư trực tràng — hậu môn rỉ máu',
    ],
    dailyBehaviorsPool: [
      'mua thuốc bôi trĩ / preparation H về dự trữ',
      'uống thêm chất xơ + nhiều nước',
      'ngâm hậu môn nước ấm 10-15 phút trước ngủ',
      'mua đệm donut để ngồi văn phòng',
      'tìm bác sĩ chuyên khoa online — không dám đi viện',
    ],
    forbiddenLeak: [
      'tóc rụng', 'da xỉn', 'mụn',
      'đau khớp', 'đầu gối', 'lưng',
      'bốc hỏa', 'kinh nguyệt', 'mãn kinh',
      'lo âu chỉ vì công việc',
      'tiểu đường', 'gan nhiễm mỡ', 'huyết áp',
      'tiểu đêm tuyến tiền liệt',
      'mắt mỏi', 'hơi thở',
    ],
  },

  // ─── EYE-VISION-CARE — screen fatigue / aging vision ───────────────
  'eye-vision-care': {
    niche: 'eye-vision-care',
    symptomsPool: [
      'mắt mỏi cuối ngày — không nhìn nổi màn hình thêm',
      'mắt khô + cảm giác cộm sau 8 tiếng làm việc',
      'mờ nhẹ khi đọc chữ nhỏ sau 4 giờ chiều',
      'nhức đầu vùng trán + mắt sau ngày dài máy tính',
      'cay mắt khi đang nhìn xa rồi quay vào màn hình',
      'thấy ruồi bay / floater trong tầm nhìn',
      'không nhìn rõ tin nhắn lúc thiếu sáng',
    ],
    frictionPool: [
      'tăng cỡ chữ điện thoại để dễ đọc',
      'né lái xe đêm — sợ chói đèn',
      'mua kính chống ánh sáng xanh đeo cả ngày',
      'nhỏ nước mắt nhân tạo 4-5 lần/ngày',
      'chống cằm + nheo mắt khi đọc menu nhà hàng',
    ],
    sensoryPool: [
      'cảm giác cát trong mắt sau 6 tiếng làm việc',
      'mắt nóng rát khi vừa rời màn hình',
      'mỏi xuyên ra sau gáy + thái dương',
      'cộm + chảy nước mắt khi gió thổi',
    ],
    bodyLanguagePool: [
      'dụi mắt liên tục giữa cuộc họp',
      'nheo mắt khi nhìn biển quảng cáo bên đường',
      'đưa điện thoại xa ra để đọc tin nhắn',
      'chớp mắt mạnh nhiều lần sau mỗi 15 phút',
    ],
    hiddenFearsPool: [
      'tới tuổi 60 sẽ phải phẫu thuật đục thủy tinh thể',
      'thoái hóa điểm vàng (AMD) trong gia đình — đến lượt mình',
      'mắt xuống cấp nhanh vì screen-time',
      'sẽ không lái xe được nữa — phụ thuộc người khác',
      'mắt cận / loạn tăng độ liên tục — không dừng được',
    ],
    dailyBehaviorsPool: [
      'mua thuốc nhỏ mắt + lutein supplement',
      'cài app nhắc nghỉ mắt 20-20-20',
      'đi đo mắt 6 tháng/lần — độ cận tăng',
      'mua kính chống ánh sáng xanh — đeo cả ngày',
      'tăng độ sáng văn phòng nhưng vẫn nheo',
    ],
    forbiddenLeak: [
      'tóc rụng', 'da xỉn da mặt', 'mụn',
      'đau khớp', 'đầu gối', 'tê tay',
      'bốc hỏa', 'kinh nguyệt',
      'lo âu chỉ vì stress',
      'tiểu đường', 'gan nhiễm mỡ', 'huyết áp',
      'tiểu đêm', 'trĩ', 'táo bón',
      'hơi thở', 'cao răng',
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
