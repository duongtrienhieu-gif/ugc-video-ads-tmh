// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — MEMORY SNAPSHOTS (v5.2)
//
// Full mini-scenes — setting + action + meaning. Engine samples 5 per
// pack via seed, injects into prompt as "scene library narrator may use".
//
// Different from v4.4 micro-realism (short embodied details):
//   - micro-realism = "vịn cầu thang" (short signal)
//   - memory-snapshot = "Lên cầu thang công ty, bắt đầu phải vịn lan can —
//     nhân viên mới chào, tôi gật đầu mà không nhìn lại" (full scene)
//
// ~50 snapshots across 5 niches (haircare, skincare, health-functional,
// supplement-wellness, mom-baby) × ~10 per niche.
//
// Engine selects 4-5 per pack via seed. Different seed = different
// scene set → reduces template feel.
// ─────────────────────────────────────────────────────────────────────

import type { MemorySnapshot, NicheKey } from '../types'

export const MEMORY_SNAPSHOTS: MemorySnapshot[] = [
  // ═══ HAIRCARE ═══
  {
    id: 'haircare-shower-counting',
    niche: 'haircare',
    emotionalState: 'private-moment',
    scene: 'Có hôm tôi nhìn nắm tóc trên tay sau khi gội đầu — và đứng đó vài giây không hiểu sao mình lại bắt đầu đếm.',
  },
  {
    id: 'haircare-pillow-morning',
    niche: 'haircare',
    emotionalState: 'private-moment',
    scene: 'Mỗi sáng tôi quét vài sợi tóc trên gối trước khi xếp chăn — quen tay đến mức không nghĩ nữa.',
  },
  {
    id: 'haircare-elevator-light',
    niche: 'haircare',
    emotionalState: 'avoidance-public',
    scene: 'Đứng thang máy có đèn LED trắng từ trên, tôi vô thức cúi đầu xuống — vì biết ánh sáng đó sẽ làm vùng đỉnh đầu lộ rõ.',
  },
  {
    id: 'haircare-mirror-parting',
    niche: 'haircare',
    emotionalState: 'shame-mirror',
    scene: 'Tôi đứng trước gương buổi sáng, vén tóc che đường ngôi — rồi soi lại ở góc khác để chắc là chồng không nhận ra.',
  },
  {
    id: 'haircare-avoid-selfie',
    niche: 'haircare',
    emotionalState: 'social-comparison',
    scene: 'Bạn cũ rủ chụp ảnh chung — tôi luôn đứng phía sau hoặc nghiêng đầu, tránh ảnh thẳng trán.',
  },
  {
    id: 'haircare-daughter-question',
    niche: 'haircare',
    emotionalState: 'family-witness',
    scene: 'Con gái hỏi sao mẹ rụng tóc nhiều thế — tôi cười bảo "do gội đầu thôi", nhưng tối đó tôi soi gối lâu hơn.',
  },
  {
    id: 'haircare-headband-trendy',
    niche: 'haircare',
    emotionalState: 'avoidance-public',
    scene: 'Tôi bắt đầu mua những chiếc băng đô và khăn turban "trendy" — chỉ tôi biết là để che, không phải vì style.',
  },
  {
    id: 'haircare-brush-amount',
    niche: 'haircare',
    emotionalState: 'private-moment',
    scene: 'Lược chải tóc đầy hơn rõ rệt sau mỗi tuần — tôi giấu nó dưới hộc bàn trang điểm thay vì để trên mặt bàn.',
  },
  {
    id: 'haircare-floor-cleaning',
    niche: 'haircare',
    emotionalState: 'private-moment',
    scene: 'Quét nhà cuối tuần, tôi tự nhận ra phần lớn tóc trên sàn là của mình — và dừng lại vài giây trước khi tiếp tục.',
  },
  {
    id: 'haircare-identity-mirror',
    niche: 'haircare',
    emotionalState: 'identity-shift',
    scene: 'Có buổi sáng tôi nhìn vào gương, thấy phần tóc thưa hơn năm trước — và cảm giác như đang nhìn người khác.',
  },

  // ═══ SKINCARE ═══
  {
    id: 'skincare-car-mirror',
    niche: 'skincare',
    emotionalState: 'shame-mirror',
    scene: 'Tan làm, ngồi vào xe, tôi soi gương chiếu hậu — nhìn da mình dưới ánh đèn ngoài trời rồi vội bật điều hòa để không phải nhìn nữa.',
  },
  {
    id: 'skincare-meeting-light',
    niche: 'skincare',
    emotionalState: 'avoidance-public',
    scene: 'Trong phòng họp đèn LED, tôi chọn ghế quay lưng vào cửa sổ — vì biết da trông xỉn hơn dưới ánh sáng đó.',
  },
  {
    id: 'skincare-old-photo',
    niche: 'skincare',
    emotionalState: 'identity-shift',
    scene: 'Tôi mở Facebook cũ — ảnh 3 năm trước. Tôi nhìn lâu hơn cần thiết, rồi đóng app.',
  },
  {
    id: 'skincare-routine-longer',
    niche: 'skincare',
    emotionalState: 'failed-attempt-trace',
    scene: 'Buổi tối skincare của tôi giờ có 7-8 bước — nhiều hơn năm ngoái rất nhiều — nhưng sáng dậy da vẫn chưa khác.',
  },
  {
    id: 'skincare-coworker-young',
    niche: 'skincare',
    emotionalState: 'social-comparison',
    scene: 'Đồng nghiệp mới 25 tuổi đứng cạnh tôi trong gương phòng tắm công ty — tôi tự dưng rút điện thoại ra "để check".',
  },
  {
    id: 'skincare-family-asked',
    niche: 'skincare',
    emotionalState: 'family-witness',
    scene: 'Chồng tôi hỏi "Em buồn à?" — tôi bảo "không, đang nghĩ gì đó thôi". Thực ra tôi chỉ thấy mặt mình mệt khi vừa soi gương.',
  },
  {
    id: 'skincare-buy-new-cream',
    niche: 'skincare',
    emotionalState: 'failed-attempt-trace',
    scene: 'Tủ mỹ phẩm tôi đầy chai dùng dở — nhưng cuối tuần này tôi lại order thêm. Tôi tự nhủ "lần này sẽ khác".',
  },
  {
    id: 'skincare-supermarket-light',
    niche: 'skincare',
    emotionalState: 'avoidance-public',
    scene: 'Đi siêu thị, qua quầy rau, tôi tránh đứng dưới đèn neon trắng — vô thức lùi vào bóng tủ lạnh kế bên.',
  },
  {
    id: 'skincare-camera-toggle',
    niche: 'skincare',
    emotionalState: 'shame-mirror',
    scene: 'Mở camera trước, tắt, mở lại — đổi góc — tắt — mở camera sau — rồi cuối cùng tôi không chụp gì cả.',
  },
  {
    id: 'skincare-filter-routine',
    niche: 'skincare',
    emotionalState: 'avoidance-public',
    scene: 'Trước khi đăng ảnh, tôi luôn dùng filter "natural" — không phải để đẹp hơn, mà để giống bản mình của 3 năm trước.',
  },

  // ═══ HEALTH-FUNCTIONAL (joint, body) ═══
  {
    id: 'joint-supermarket-bag',
    niche: 'health-functional',
    emotionalState: 'physical-discomfort',
    scene: 'Đứng giữa siêu thị, vừa lấy túi gạo lên thì đầu gối nhói — tôi giả vờ ngắm hàng mì gói 30 giây cho khớp đỡ.',
  },
  {
    id: 'joint-car-arrival',
    niche: 'health-functional',
    emotionalState: 'private-moment',
    scene: 'Đỗ xe vào gara, tôi ngồi lại trong xe vài phút trước khi mở cửa — không phải vì điện thoại, mà để chân hết tê.',
  },
  {
    id: 'joint-office-stairs',
    niche: 'health-functional',
    emotionalState: 'avoidance-public',
    scene: 'Lên cầu thang công ty, dạo này tôi bắt đầu phải vịn lan can — đồng nghiệp đi cùng, tôi giả vờ check tin nhắn để chậm lại.',
  },
  {
    id: 'joint-daughter-pace',
    niche: 'health-functional',
    emotionalState: 'family-witness',
    scene: 'Con gái đi trước, quay lại hỏi "sao mẹ đi chậm vậy?" — tôi cười bảo đang ngắm phố, thật ra đầu gối nhói.',
  },
  {
    id: 'joint-night-wake',
    niche: 'health-functional',
    emotionalState: 'private-moment',
    scene: 'Có đêm tôi tỉnh lúc 3 giờ sáng vì khớp gối nhói — nằm yên, xoay người tìm tư thế khác mà không đánh thức chồng.',
  },
  {
    id: 'joint-walk-husband',
    niche: 'health-functional',
    emotionalState: 'social-comparison',
    scene: 'Đi bộ trong công viên với chồng — tôi tụt lại 5 mét, anh quay lại đợi, tôi vẫy tay "đi đi, em vẫn ổn".',
  },
  {
    id: 'joint-meeting-stand-up',
    niche: 'health-functional',
    emotionalState: 'avoidance-public',
    scene: 'Sau cuộc họp 1 tiếng, mọi người đứng dậy ngay — tôi phải vịn vào mép bàn, làm vẻ "đang gom giấy tờ".',
  },
  {
    id: 'joint-taxi-arrival',
    niche: 'health-functional',
    emotionalState: 'private-moment',
    scene: 'Đến nhà bạn, tôi ngồi lại trong taxi vài phút — chưa muốn xuống vì người mỏi. Tôi nhắn "đang đến chỗ đỗ xe nhé".',
  },
  {
    id: 'joint-water-bottle',
    niche: 'health-functional',
    emotionalState: 'physical-discomfort',
    scene: 'Mở chai nước lọc trong cantin — phải dùng cả hai tay. Đồng nghiệp ngồi cạnh, tôi cười bảo "nắp chặt quá", lén xoa cổ tay.',
  },
  {
    id: 'joint-sleep-positions',
    niche: 'health-functional',
    emotionalState: 'private-moment',
    scene: 'Cả tối tôi xoay đi xoay lại để tìm tư thế nằm thoải mái — chồng đã ngủ say, tôi không đánh thức.',
  },

  // ═══ SUPPLEMENT-WELLNESS ═══
  {
    id: 'wellness-fridge-blank',
    niche: 'supplement-wellness',
    emotionalState: 'fatigue-cognitive',
    scene: 'Mở tủ lạnh, đứng đó 5-6 giây, đóng lại — vì tôi không nhớ mình định lấy gì.',
  },
  {
    id: 'wellness-screen-blank',
    niche: 'supplement-wellness',
    emotionalState: 'fatigue-cognitive',
    scene: 'Có hôm tôi ngồi nhìn màn hình vài phút mà không thật sự làm gì — chỉ là chưa đủ năng lượng để bắt đầu.',
  },
  {
    id: 'wellness-coffee-third',
    niche: 'supplement-wellness',
    emotionalState: 'private-moment',
    scene: '3 giờ chiều, tôi pha ly cà phê thứ ba trong ngày — tay đã quen mở tủ lấy gói, không cần nghĩ.',
  },
  {
    id: 'wellness-8pm-eyelid',
    niche: 'supplement-wellness',
    emotionalState: 'fatigue-cognitive',
    scene: 'Mới 8 giờ tối, đang xem phim với chồng — mí mắt tôi sụp xuống. Anh ấy hỏi "ngủ rồi à?", tôi mở mắt: "không, đang xem mà".',
  },
  {
    id: 'wellness-coffee-leftover',
    niche: 'supplement-wellness',
    emotionalState: 'private-moment',
    scene: 'Tôi pha cà phê chiều, uống được nửa ly thì để đó — đến tối dọn dẹp mới nhận ra ly vẫn còn ở bàn.',
  },
  {
    id: 'wellness-keys-forgotten',
    niche: 'supplement-wellness',
    emotionalState: 'fatigue-cognitive',
    scene: 'Tôi đặt chìa khóa xuống bàn — 10 phút sau tìm lại mất 5 phút mới nhớ ra chỗ.',
  },
  {
    id: 'wellness-sleep-7hrs',
    niche: 'supplement-wellness',
    emotionalState: 'identity-shift',
    scene: 'Ngủ 7 tiếng mà sáng dậy còn mệt hơn lúc đi ngủ — tôi tự hỏi "sao 5 năm trước ngủ 6 tiếng vẫn tỉnh táo?".',
  },
  {
    id: 'wellness-meeting-drain',
    niche: 'supplement-wellness',
    emotionalState: 'fatigue-cognitive',
    scene: 'Họp 1 tiếng xong, tôi ngồi yên 10 phút không làm được gì — như xe vừa hết bình.',
  },
  {
    id: 'wellness-noon-dizzy',
    niche: 'supplement-wellness',
    emotionalState: 'physical-discomfort',
    scene: 'Đứng dậy sau giấc trưa ngắn — choáng nhẹ, phải vịn vào tủ bếp vài giây.',
  },
  {
    id: 'wellness-tv-asleep',
    niche: 'supplement-wellness',
    emotionalState: 'private-moment',
    scene: 'Tối thứ Bảy, định xem phim cùng chồng — tôi ngủ thiếp đi trước khi phim kết thúc episode đầu.',
  },

  // ═══ MOM-BABY ═══
  {
    id: 'mombaby-morning-mirror',
    niche: 'mom-baby',
    emotionalState: 'identity-shift',
    scene: 'Soi gương buổi sáng — phụ nữ trong đó không phải tôi của trước khi sinh. Tôi nhìn vài giây rồi quay đi.',
  },
  {
    id: 'mombaby-shower-hair',
    niche: 'mom-baby',
    emotionalState: 'private-moment',
    scene: 'Tóc rụng thành nắm khi tôi gội đầu — tôi cuộn lại bỏ vào sọt nhỏ, không muốn nhìn lâu.',
  },
  {
    id: 'mombaby-old-album',
    niche: 'mom-baby',
    emotionalState: 'identity-shift',
    scene: 'Mở album hình trước khi sinh — chỉ 18 tháng trước mà như đời khác. Tôi đóng lại sau 30 giây.',
  },
  {
    id: 'mombaby-3am-feeding',
    niche: 'mom-baby',
    emotionalState: 'private-moment',
    scene: '3 giờ sáng, ngồi cho con bú — con đã ngủ lại, tôi ngồi yên trong tối, không thể ngủ tiếp.',
  },
  {
    id: 'mombaby-old-clothes',
    niche: 'mom-baby',
    emotionalState: 'identity-shift',
    scene: 'Tôi mua thêm áo size cũ về — gấp lại, nhét vào ngăn dưới cùng tủ. Tôi tự nhủ "sẽ giảm cân".',
  },
  {
    id: 'mombaby-husband-still-pretty',
    niche: 'mom-baby',
    emotionalState: 'social-comparison',
    scene: 'Chồng khen "em vẫn xinh" — tôi cười cảm ơn, nhưng biết anh chỉ nói để tôi vui.',
  },
  {
    id: 'mombaby-photos-baby-only',
    niche: 'mom-baby',
    emotionalState: 'avoidance-public',
    scene: 'Ảnh trong điện thoại tôi 6 tháng nay chỉ có con — không có tấm nào của riêng mình.',
  },
  {
    id: 'mombaby-friend-no-kids',
    niche: 'mom-baby',
    emotionalState: 'social-comparison',
    scene: 'Bạn cũ rủ đi cà phê — chưa có con, vẫn dáng cũ. Tôi viện cớ "con đang ốm" thay vì đi.',
  },
  {
    id: 'mombaby-bathroom-cry',
    niche: 'mom-baby',
    emotionalState: 'private-moment',
    scene: 'Có hôm trong nhà tắm, tôi khóc 10 phút mà không nhớ vì sao — rồi rửa mặt ra ngoài chăm con như chưa có gì.',
  },
  {
    id: 'mombaby-bed-edge',
    niche: 'mom-baby',
    emotionalState: 'fatigue-cognitive',
    scene: 'Ngồi yên trên mép giường 10 phút trước khi đi tắm — không phải nghỉ, là chưa có sức để bắt đầu.',
  },
]

/** Get snapshots for a niche. */
export function snapshotsForNiche(niche: NicheKey): MemorySnapshot[] {
  return MEMORY_SNAPSHOTS.filter((s) => s.niche === niche)
}

/** Compose snapshots brief for prompt injection — list scene with category tags. */
export function snapshotsBrief(snapshots: MemorySnapshot[]): string {
  if (snapshots.length === 0) {
    return '(no scene library — write from narrator context + DNA)'
  }
  const lines: string[] = ['Scene library (sample these or invent similar — DO NOT copy literally):']
  snapshots.forEach((s, i) => {
    lines.push(`  ${i + 1}. [${s.emotionalState}] ${s.scene}`)
  })
  return lines.join('\n')
}

// ═══ VISUAL-FIRST WRITING RULE ═══════════════════════════════════════

/** Inject into system prompt. Forces engine to convert abstract → embodied scene. */
export const VISUAL_FIRST_WRITING_PROMPT =
  `═══ VISUAL-FIRST WRITING ═══
Convert abstract emotions to embodied scenes. Reader instantly imagines.

KHÔNG:
- "tôi mệt" / "tôi đau" / "tôi xuống sức" (abstract)
- "cảm thấy không ổn" / "có gì đó khác" (vague)

PHẢI:
- "Có hôm tôi ngồi nhìn màn hình vài phút mà đầu óc trống rỗng." (embodied)
- "Đầu gối nhói lên lúc tôi đang đứng chọn đồ trong siêu thị." (scene)
- "Soi gương buổi sáng, tôi đứng vài giây rồi quay đi." (action)

Each section: weave in 1-2 scenes from library OR invent similar.
Embodied detail = reader recognition. Abstract emotion = AI essay.`
