// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — fallback copy (v4.1 — 11 sections)
//
// Used khi retry vẫn fail validators. Pre-validated content embodying
// v4 voice — pattern-interrupt hook, daily friction with embodied detail,
// internal fear, failed attempts, belief-shift reframe, reluctant soft
// reveal, micro reward, emotional payoff, reflection, mini testimonials,
// soft CTA.
//
// Generic enough for cross-niche use. Will be polished further in v4.6.
// Trust-continuity section uses copy field for fallback (real engine
// uses reviews field).
// ═════════════════════════════════════════════════════════════════════

import type { SectionId } from '../types'

export interface FallbackSection {
  title: string
  copy: string
}

export const FALLBACK_COPY: Record<SectionId, FallbackSection> = {
  'hook-interrupt': {
    title: 'Tôi bắt đầu ghét buổi sáng',
    copy:
`Tôi bắt đầu ghét buổi sáng.

Không phải vì thiếu ngủ. Mà vì mỗi lần thức dậy, cơ thể tôi lại nhắc tôi rằng nó không còn như trước nữa.

Có hôm tôi đứng cạnh mép giường gần ba phút chỉ để lấy can đảm bước xuống đất.

Ban đầu tôi nghĩ chắc do tuổi tác thôi. Nhưng càng ngày tôi càng thấy không yên tâm.

Tôi không nói điều đó với ai.`,
  },

  'daily-friction': {
    title: 'Mọi thứ nhỏ dần trở nên khó khăn',
    copy:
`Tôi chưa tới mức "có bệnh". Vẫn đi làm, vẫn lo cho gia đình, vẫn nấu ăn mỗi ngày.

Nhưng cơ thể bắt đầu khác đi rất nhiều. Mỗi sáng tôi phải ngồi yên vài giây mới đứng dậy nổi. Đi cầu thang phải vịn tay. Ngồi lâu một chút thì người cứng lại.

Có hôm đang bê đồ ngoài siêu thị, tôi phải đứng khựng giữa lối đi vì tự nhiên cảm thấy không ổn.

Điều khó chịu nhất không phải là đau. Mà là cảm giác cơ thể mình đang yếu đi nhanh hơn tôi nghĩ.`,
  },

  'internal-fear': {
    title: 'Có lẽ tôi đã bỏ qua tín hiệu quá lâu',
    copy:
`Tôi bắt đầu để ý kỹ hơn vào những gì mình từng coi là "chuyện nhỏ".

Chiều nào người cũng nặng như đeo chì. Đêm ngủ không sâu. Sáng dậy vẫn mệt như chưa từng nghỉ.

Có hôm đang ngồi làm việc, tôi nhìn bàn tay mình rồi tự hỏi: không lẽ mới từng này tuổi mà cơ thể đã xuống nhanh vậy sao?

Tôi không nói điều đó với ai. Nhưng cảm giác bất an cứ lớn dần lên mỗi ngày — như một thứ tôi đang cố giả vờ không thấy.`,
  },

  'failed-attempts': {
    title: 'Tôi đã thử đủ thứ',
    copy:
`Tôi thử đủ kiểu rồi. Ngâm chân buổi tối. Massage. Dầu nóng. Yoga theo YouTube. Vitamin tổng hợp. Miếng dán giảm đau.

Lúc đầu thấy đỡ một chút. Rồi vài hôm sau lại quay về như cũ.

Cái cảm giác hy vọng rồi thất vọng liên tục đó — thật ra mới là thứ khiến tôi mệt nhất. Mệt hơn cả bản thân triệu chứng.

Đến lúc đó tôi mới nghĩ — có lẽ tôi đang giải quyết sai chỗ.`,
  },

  // 🆕 CONVERSION CORE — Belief shift
  'belief-shift': {
    title: 'Một câu nói khiến tôi nghĩ lại',
    copy:
`Một người bạn cũ hỏi tôi: "Mày có chắc đó chỉ là chuyện tuổi tác không?"

Câu đó làm tôi suy nghĩ mãi mấy hôm liền.

Vì trước giờ tôi luôn mặc định: lớn tuổi rồi thì cơ thể tự nhiên xuống — đau nhức, cứng khớp, mệt mỏi… là chuyện không tránh được.

Nhưng nó nói thêm một câu khiến tôi khựng lại: "Nhiều khi không phải mình già đi quá nhanh. Mà là cơ thể không còn phục hồi tốt như trước."

Lần đầu tiên tôi bắt đầu nghĩ — có lẽ tôi đã hiểu sai vấn đề suốt thời gian qua.`,
  },

  'soft-reveal': {
    title: 'Cũng không kỳ vọng gì nhiều',
    copy:
`Hôm đó nó đưa tôi xem loại nó đang dùng.

Thật lòng tôi không kỳ vọng gì nhiều. Vì tôi đã thử không ít thứ trước đó rồi.

Nhưng có một câu nó nói khiến tôi chú ý: không phải để giảm đau tức thời, mà là để hỗ trợ cơ thể hoạt động ổn định hơn từ bên trong.

Nghe thực tế hơn tất cả những gì tôi từng thử. Thôi thử xem sao.`,
  },

  'micro-reward': {
    title: 'Ba tuần sau',
    copy:
`Khoảng tuần thứ ba, tôi bắt đầu nhận ra vài thay đổi rất nhỏ.

Một sáng tôi đứng dậy nhẹ hơn — không phải kiểu thần kỳ, chỉ là không còn cảm giác "phải lấy can đảm" như trước.

Rồi có hôm tôi chợt nhận ra: mình không còn nghĩ tới cơ thể liên tục nữa.

Ngủ sâu hơn một chút. Người bớt nặng nề hơn.

Không phải "khỏi". Mà giống cảm giác cơ thể đang quay lại trạng thái bình thường từng chút một.`,
  },

  'emotional-payoff': {
    title: 'Cuộc sống nhẹ hơn',
    copy:
`Điều tôi thích nhất bây giờ không phải là "hết khó chịu".

Mà là cảm giác cơ thể không còn kéo tụt cuộc sống mình xuống nữa.

Tôi có thể đi siêu thị lâu hơn. Nấu ăn mà không phải ngồi nghỉ giữa chừng. Đưa con đi chơi mà vẫn còn sức lúc về nhà.

Mọi thứ rất nhỏ thôi. Nhưng khi cơ thể nhẹ hơn, cuộc sống tự nhiên cũng nhẹ hơn rất nhiều.`,
  },

  // 🆕 Reflection + maturity
  'reflection-trust': {
    title: 'Có lẽ tôi nên nghe cơ thể mình sớm hơn',
    copy:
`Nhìn lại, tôi nghĩ điều tiếc nhất là mình đã cố chịu quá lâu.

Tôi cứ nghĩ "rồi sẽ tự hết thôi" — cho tới khi cơ thể bắt đầu ảnh hưởng cả giấc ngủ, tâm trạng, và cuộc sống mỗi ngày.

Tôi không nghĩ đây là phép màu. Cũng không phải giải pháp tức thì.

Nhưng ít nhất, đó là thứ đầu tiên khiến tôi cảm thấy cơ thể mình đang tốt lên — thay vì tệ đi từng ngày.`,
  },

  // 🆕 Mini testimonials — real engine uses reviews field; fallback uses copy
  'trust-continuity': {
    title: 'Vài chia sẻ tôi nhận được',
    copy:
`"Tôi ngủ ngon hơn sau khoảng ba tuần."

"Mẹ mình đi cầu thang đỡ mỏi hơn."

"Không hết ngay, nhưng cơ thể nhẹ dần lên thật."`,
  },

  'soft-cta': {
    title: 'Nếu bạn cũng đang ở giai đoạn đó',
    copy:
`Nếu bạn cũng đang ở giai đoạn mà sáng thức dậy thấy người nặng nề hơn, đầu gối khó chịu hơn, hay cơ thể không còn hồi phục như trước — thì có lẽ điều bạn cần không phải là "cố chịu thêm".

Tôi chỉ muốn nói: bạn không phải người duy nhất trải qua cảm giác đó.

Có những thứ rất nhỏ thôi cũng đủ để cơ thể quay lại bình thường — chỉ là mình cần biết là có cách.`,
  },
}
