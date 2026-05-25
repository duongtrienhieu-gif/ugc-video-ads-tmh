// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — FALLBACK COPY (Reader-Immersion architecture)
//
// Used khi retry vẫn fail validators. Pre-validated content embodying
// the 4-phase reader-immersion structure:
//   Phase 1 RECOGNITION — reader sees self
//   Phase 2 TRUST + RESISTANCE — narrator joins, reframe
//   Phase 3 SOLUTION OPENING — natural discovery + mechanism
//   Phase 4 FUTURE SELF — micro wins + soft invitation
//
// Generic enough for cross-niche use. Voice = reader-first ("Bạn có
// từng..."), narrator = validator ("Tôi cũng từng..."), no narrator-
// protagonist arc. Optional blocks (skepticism-alignment, soft-mechanism-
// compare) included so caller can pick all 15.
// ═════════════════════════════════════════════════════════════════════

import type { BlockId } from '../types'

export interface FallbackReview {
  quote: string
  author?: string
  meta?: string
}

export interface FallbackSection {
  title: string
  copy: string
  /** Optional reviews for social-proof block. Different voices, FB-comment
   *  vibe, NOT formal testimonials. */
  reviews?: FallbackReview[]
}

export const FALLBACK_COPY: Record<BlockId, FallbackSection> = {
  // ─── Phase 1 — RECOGNITION ─────────────────────────────────────────

  'self-recognition-hook': {
    title: 'Bạn có từng đứng ở đó',
    copy:
`Bạn có từng đứng cạnh mép giường vài giây chỉ để lấy can đảm bước xuống đất?

Có thể bạn không nói chuyện đó với ai. Có thể bạn cũng đang giả vờ mọi thứ vẫn ổn.

Tôi cũng từng đứng đó. Và tôi biết cảm giác đó như thế nào.`,
  },

  'daily-micro-friction': {
    title: 'Những thứ rất nhỏ đã đổi khác',
    copy:
`Có những điều rất nhỏ mà bạn đã quen tới mức không còn để ý nữa.

Đi cầu thang chậm hơn một chút. Vịn vào thành bàn khi đứng dậy. Pha ly cà phê thứ ba lúc 3 giờ chiều mà không tự hỏi tại sao.

Bao lâu rồi bạn không cảm thấy thật sự nhẹ nhõm khi thức dậy buổi sáng?`,
  },

  'hidden-emotional-truth': {
    title: 'Điều bạn không nói với ai',
    copy:
`Có những điều bạn giữ trong đầu cả tháng mà không kể ai.

Cái cảm giác bất an mỗi sáng. Câu hỏi bạn google lúc 2 giờ sáng. Cái nhìn bạn lén dành cho chính mình trong gương.

Bạn không nói ra vì không biết bắt đầu thế nào — và vì sợ nghe câu trả lời.`,
  },

  'not-alone-bridge': {
    title: 'Không phải mỗi mình bạn',
    copy:
`Bạn không phải là người duy nhất đang trải qua điều này.

Có rất nhiều người khác cũng đang giấu cảm giác y vậy — chỉ là không ai nói ra.

Đọc đến đây, có lẽ bạn thấy nhẹ đi một chút. Tôi cũng vậy lần đầu tôi nhận ra.`,
  },

  // ─── Phase 2 — TRUST + RESISTANCE ALIGNMENT ────────────────────────

  'narrator-validation-entry': {
    title: 'Tôi cũng từng đứng đó',
    copy:
`Tôi cũng từng tự nhủ "chắc do thời tiết thôi" rồi quay đi.

Tôi cũng từng pha ly cà phê thứ ba lúc 3 giờ chiều rồi tự thuyết phục mình là không sao. Tôi cũng từng nhìn ngăn kéo đầy vitamin chưa uống hết rồi nghĩ "lần này chắc cũng vậy".

Tôi viết những dòng này không phải để kể chuyện của tôi. Mà vì biết bạn cũng có thể đang ở đó.`,
  },

  'shared-failed-attempts': {
    title: 'Cả hai chúng ta đã thử đủ',
    copy:
`Tôi đã thử đủ kiểu. Ngâm chân buổi tối. Dầu nóng. Vitamin tổng hợp. Yoga theo YouTube. Miếng dán giảm đau.

Mỗi lần đỡ một chút rồi quay về điểm cũ.

Bạn cũng đã thử đủ rồi đúng không — và cũng quay lại điểm cũ?

Cái cảm giác hy vọng rồi thất vọng liên tục đó — thật ra mới là thứ làm mình mệt nhất.`,
  },

  'skepticism-alignment': {
    title: 'Bạn nghi ngờ là đúng',
    copy:
`Đọc đến đây bạn có thể đang nghĩ: "lại một bài quảng cáo nữa".

Tôi hiểu. Tôi cũng từng nghĩ vậy mỗi lần đọc những bài kiểu này.

Sự nghi ngờ của bạn không sai. Nó chỉ là dấu hiệu bạn đã thử quá nhiều thứ không hiệu quả.`,
  },

  'belief-shift': {
    title: 'Có thể bạn đang nghĩ sai chỗ',
    copy:
`Một người bạn nói với tôi một câu khiến tôi nghĩ mãi: "không phải tuổi tác — là cơ thể không còn phục hồi tốt như trước."

Tôi khựng lại mất mấy hôm liền.

Vì trước giờ tôi luôn mặc định: tuổi này thì phải vậy thôi. Đau, mệt, mất ngủ — chuyện đương nhiên.

Lần đầu tôi nghĩ: có lẽ tôi đã giải quyết sai chỗ suốt thời gian qua.`,
  },

  // ─── Phase 3 — SOLUTION OPENING ────────────────────────────────────

  'natural-product-discovery': {
    title: 'Cũng không kỳ vọng gì nhiều',
    copy:
`Nó đưa tôi xem loại nó đang dùng — không phải để giảm đau tức thời, mà để hỗ trợ cơ thể hoạt động ổn định từ bên trong.

Thật lòng tôi không kỳ vọng gì nhiều. Vì tôi đã thử không ít thứ trước đó rồi.

Nhưng cách nó nói nghe thực tế hơn tất cả những gì tôi từng đọc. Thôi thử xem sao.`,
  },

  'why-this-felt-different': {
    title: 'Cái khác là ở đâu',
    copy:
`Khác biệt không nằm ở chỗ "giảm triệu chứng nhanh".

Mà ở chỗ nó tập trung vào nguyên nhân bên dưới — cơ thể đang thiếu thứ gì để phục hồi, chứ không phải che lấp dấu hiệu bên ngoài.

Tôi không hiểu hết về cơ chế. Tôi chỉ thấy cái mạch lý này nghe khác với mọi thứ tôi từng thử.`,
  },

  'soft-mechanism-compare': {
    title: 'Trước, tôi đã cố che bên ngoài',
    copy:
`Trước đây tôi cố che vấn đề từ ngoài — dầu nóng, miếng dán, thuốc giảm đau.

Cơ thể bên dưới thì vẫn mệt như cũ.

Lần này khác ở chỗ nó hỗ trợ cơ thể tự phục hồi — không phải làm thay phần việc của cơ thể.`,
  },

  // ─── Phase 4 — FUTURE SELF IMMERSION ───────────────────────────────

  'micro-transformation': {
    title: 'Ba tuần sau',
    copy:
`Khoảng tuần thứ ba, tôi bắt đầu nhận ra vài thay đổi rất nhỏ.

Một sáng tôi đứng dậy nhẹ hơn — không phải kiểu thần kỳ, chỉ là không còn cảm giác "phải lấy can đảm" như trước.

Rồi có hôm tôi chợt nhận ra: mình không còn nghĩ tới cơ thể liên tục nữa.

Không phải "khỏi". Mà giống cảm giác cơ thể đang quay lại trạng thái bình thường từng chút một.`,
  },

  'emotional-wins': {
    title: 'Cuộc sống nhẹ hơn',
    copy:
`Điều bạn có thể nhận ra dần dần không phải là "hết khó chịu" — mà là cảm giác cơ thể không còn kéo tụt cuộc sống mình xuống nữa.

Đi siêu thị lâu hơn mà không phải đặt giỏ xuống nghỉ. Nấu ăn mà không cần ngồi nghỉ giữa chừng. Đưa con đi chơi mà vẫn còn sức lúc về nhà.

Mọi thứ rất nhỏ thôi. Nhưng khi cơ thể nhẹ hơn, cuộc sống tự nhiên cũng nhẹ hơn rất nhiều.`,
  },

  'social-proof': {
    title: 'Vài chia sẻ tôi nhận được',
    copy: 'Sau khi tôi share câu chuyện này, có vài bạn nhắn lại. Tôi xin phép share lại với bạn — đây là những điều họ nói:',
    reviews: [
      {
        quote: 'Tôi ngủ ngon hơn sau khoảng ba tuần. Không phải kiểu thần kỳ, chỉ là buổi sáng không còn nặng nề như trước.',
        author: 'Chị Lan, 42',
        meta: 'Sau 3 tuần dùng',
      },
      {
        quote: 'Mẹ mình đi cầu thang đỡ mỏi hơn rồi. Mẹ không hay nói nhưng mình thấy mẹ ít than đau hơn.',
        author: 'Hà, 30',
      },
      {
        quote: 'Không hết ngay đâu, mà cơ thể nhẹ dần lên thật. Mình vẫn uống đều, chưa nghĩ đến chuyện dừng.',
        author: 'Một bạn đọc viết',
      },
    ],
  },

  'future-self-cta': {
    title: 'Nếu bạn cũng đang ở giai đoạn đó',
    copy:
`Có thể bạn cũng đang ở giai đoạn mà sáng thức dậy thấy người nặng nề hơn — và đã quen với điều đó tới mức không còn để ý.

Tôi không nói đây là phép màu. Chỉ muốn nói: bạn không phải đợi cho đến khi mệt thêm để bắt đầu chăm cho mình.

Có lẽ đã đến lúc bạn cho phép bản thân thử một cách khác.`,
  },
}
