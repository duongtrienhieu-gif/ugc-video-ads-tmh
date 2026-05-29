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
// PARADIGM-FIX (2026-05-27): old static table hardcoded SUPPLEMENT
// paradigm ("vịn cầu thang", "vitamin tổng hợp", "đi siêu thị lâu hơn")
// → broke for non-supplement products. Now FALLBACK_COPY is built via
// builder function that uses synthesisBrief data (readerSpecificSymptoms,
// realisticFailedAttempts, discoveryRealistic) so fallback adapts to
// actual product paradigm. When synthesis missing, static neutral
// content (no paradigm assumption) is used.
// ═════════════════════════════════════════════════════════════════════

import type { BlockId } from '../types'
import type { SynthesizedProductBrief } from '../../productSynthesis/types'

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

/** Build fallback copy adapted to product paradigm.
 *  When synthesisBrief has product-specific data (readerSpecificSymptoms,
 *  realisticFailedAttempts, discoveryRealistic), USE THEM directly in
 *  fallback paragraphs so the fallback section talks about THIS product's
 *  reality — not a supplement-paradigm hardcode.
 *  When synthesisBrief is empty / missing, use neutral paragraph-agnostic
 *  phrasing (no "uống" / "đeo" / "đánh răng" assumption). */
export function buildFallbackCopy(brief?: SynthesizedProductBrief): Record<BlockId, FallbackSection> {
  const hasSymptoms       = brief && Array.isArray(brief.readerSpecificSymptoms) && brief.readerSpecificSymptoms.length > 0
  const hasFailedAttempts = brief && Array.isArray(brief.realisticFailedAttempts) && brief.realisticFailedAttempts.length > 0
  const hasDiscovery      = brief && typeof brief.discoveryRealistic === 'string' && brief.discoveryRealistic.length > 10
  const hasUsageScene     = brief && typeof brief.usageScene === 'string' && brief.usageScene.length > 10

  const symptom0 = hasSymptoms ? brief!.readerSpecificSymptoms[0] : null
  const symptom1 = hasSymptoms && brief!.readerSpecificSymptoms.length > 1 ? brief!.readerSpecificSymptoms[1] : null
  const failedAttempts = hasFailedAttempts ? brief!.realisticFailedAttempts.slice(0, 4) : []

  return {
  // ─── Phase 1 — RECOGNITION ─────────────────────────────────────────
  // PARADIGM-FIX: anchors to readerSpecificSymptoms when available so the
  // recognition hook references THIS product's actual symptoms (not "vịn
  // cầu thang" supplement-paradigm).

  'self-recognition-hook': {
    title: symptom0 ? 'Bạn có từng' : 'Bạn có từng đứng ở đó',
    copy: symptom0
      ? `Bạn có từng ${symptom0}?\n\nCó thể bạn không nói chuyện này với ai. Có thể bạn đã quen tới mức không còn để ý.\n\nTôi cũng từng ở đó. Và tôi biết cảm giác đó như thế nào.`
      : `Bạn có từng có cái cảm giác gì đó không ổn nhưng không nói được với ai?\n\nCó thể bạn đã quen tới mức không còn để ý.\n\nTôi cũng từng ở đó. Và tôi biết cảm giác đó như thế nào.`,
  },

  'daily-micro-friction': {
    title: 'Những thứ rất nhỏ',
    copy: symptom0 && symptom1
      ? `Có những điều rất nhỏ mà bạn đã quen tới mức không còn để ý nữa.\n\n${symptom0.charAt(0).toUpperCase()}${symptom0.slice(1)}. ${symptom1.charAt(0).toUpperCase()}${symptom1.slice(1)}.\n\nBao lâu rồi bạn không thấy thật sự thoải mái?`
      : symptom0
      ? `Có những điều rất nhỏ mà bạn đã quen tới mức không còn để ý nữa.\n\n${symptom0.charAt(0).toUpperCase()}${symptom0.slice(1)}.\n\nBao lâu rồi bạn không thấy thật sự thoải mái?`
      : `Có những điều rất nhỏ mà bạn đã quen tới mức không còn để ý nữa.\n\nNhững khoảnh khắc khi bạn nhận ra cơ thể hoặc cảm giác mình không còn như trước. Mỗi ngày tích lại một chút.\n\nBao lâu rồi bạn không cảm thấy thật sự thoải mái?`,
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
    copy: symptom0
      ? `Tôi cũng từng có cái cảm giác đó. ${symptom0.charAt(0).toUpperCase()}${symptom0.slice(1)} — tôi từng tự nhủ "chắc do thời tiết thôi" rồi quay đi.\n\nTôi viết những dòng này không phải để kể chuyện của tôi. Mà vì biết bạn cũng có thể đang ở đó.`
      : `Tôi cũng từng tự nhủ "chắc do thời tiết thôi" rồi quay đi.\n\nTôi cũng từng nghĩ "lần này chắc cũng vậy" khi thấy mình lại thử thêm một thứ mới.\n\nTôi viết những dòng này không phải để kể chuyện của tôi. Mà vì biết bạn cũng có thể đang ở đó.`,
  },

  'shared-failed-attempts': {
    // PARADIGM-FIX: use realisticFailedAttempts from synthesis (product-specific)
    // instead of supplement-paradigm hardcode ("ngâm chân buổi tối / dầu nóng /
    // vitamin tổng hợp / yoga theo YouTube / miếng dán giảm đau").
    title: 'Cả hai chúng ta đã thử đủ',
    copy: failedAttempts.length >= 2
      ? `Tôi đã thử đủ kiểu. ${failedAttempts.join('. ')}.\n\nMỗi lần đỡ một chút rồi quay về điểm cũ.\n\nBạn cũng đã thử đủ rồi đúng không — và cũng quay lại điểm cũ?\n\nCái cảm giác hy vọng rồi thất vọng liên tục đó — thật ra mới là thứ làm mình mệt nhất.`
      : `Tôi đã thử nhiều thứ. Mỗi cái có chút ổn rồi quay về điểm cũ.\n\nBạn cũng đã thử đủ rồi đúng không — và cũng quay lại điểm cũ?\n\nCái cảm giác hy vọng rồi thất vọng liên tục đó — thật ra mới là thứ làm mình mệt nhất.`,
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
`Một người bạn nói với tôi một câu khiến tôi nghĩ mãi: "có thể vấn đề không nằm ở chỗ bạn đang tập trung — mà ở một chỗ khác."

Tôi khựng lại mất mấy hôm liền.

Vì trước giờ tôi luôn mặc định: tuổi này thì phải vậy thôi.

Lần đầu tôi nghĩ: có lẽ tôi đã giải quyết sai chỗ suốt thời gian qua.`,
  },

  // ─── Phase 3 — SOLUTION OPENING ────────────────────────────────────

  'natural-product-discovery': {
    // PARADIGM-FIX: use discoveryRealistic from synthesis (product-specific
    // discovery scene) instead of generic "loại nó đang dùng" supplement-vague.
    title: 'Cũng không kỳ vọng gì nhiều',
    copy: hasDiscovery
      ? `${brief!.discoveryRealistic}\n\nThật lòng tôi không kỳ vọng gì nhiều. Vì tôi đã thử không ít thứ trước đó rồi.\n\nNhưng cách nó nói nghe thực tế hơn tất cả những gì tôi từng đọc. Thôi thử xem sao.`
      : `Có người giới thiệu cho tôi loại này — không phải để giải quyết tức thời, mà để hỗ trợ đúng cách.\n\nThật lòng tôi không kỳ vọng gì nhiều. Vì tôi đã thử không ít thứ trước đó rồi.\n\nNhưng cách nó nói nghe thực tế hơn tất cả những gì tôi từng đọc. Thôi thử xem sao.`,
  },

  'why-this-felt-different': {
    title: 'Cái khác là ở đâu',
    copy:
`Khác biệt không nằm ở chỗ "giải quyết nhanh".

Mà ở chỗ nó tập trung vào nguyên nhân bên dưới — không phải che lấp dấu hiệu bên ngoài.

Tôi không hiểu hết về cơ chế. Tôi chỉ thấy cái mạch lý này nghe khác với mọi thứ tôi từng thử.`,
  },

  'soft-mechanism-compare': {
    title: 'Trước, tôi chỉ cố che bên ngoài',
    copy:
`Trước đây tôi chỉ cố xử lý từ bên ngoài — những giải pháp tạm thời, che vấn đề.

Vấn đề thật bên dưới thì vẫn vậy.

Lần này khác ở chỗ nó hỗ trợ giải quyết tận chỗ — không chỉ làm dịu bề mặt.`,
  },

  // ─── Phase 4 — FUTURE SELF IMMERSION ───────────────────────────────

  'micro-transformation': {
    // PARADIGM-FIX: use usageScene context if available, else neutral phrasing
    title: 'Vài tuần sau',
    copy: hasUsageScene
      ? `Khoảng tuần thứ ba, tôi bắt đầu nhận ra vài thay đổi rất nhỏ.\n\nKhông phải kiểu thần kỳ. Chỉ là một sáng tôi chợt nhận ra mình không còn nghĩ tới vấn đề đó liên tục như trước.\n\nKhông phải "khỏi". Mà giống cảm giác mọi thứ đang quay lại trạng thái bình thường từng chút một.`
      : `Khoảng tuần thứ ba, tôi bắt đầu nhận ra vài thay đổi rất nhỏ.\n\nMột sáng tôi nhận ra mình không còn nghĩ tới vấn đề đó liên tục như trước — không phải kiểu thần kỳ, chỉ là không còn cảm giác "phải lấy can đảm" như xưa.\n\nKhông phải "khỏi". Mà giống cảm giác mọi thứ đang quay lại trạng thái bình thường từng chút một.`,
  },

  'emotional-wins': {
    // PARADIGM-FIX: removed "đi siêu thị lâu hơn / nấu ăn / đưa con đi chơi"
    // supplement-paradigm hardcode. Now neutral — adapts to any product.
    title: 'Cuộc sống nhẹ hơn',
    copy:
`Điều bạn có thể nhận ra dần dần không phải là "hết hoàn toàn" — mà là cảm giác vấn đề đó không còn kéo tụt mình xuống nữa.

Những việc trước đây phải né, phải tránh, phải nghĩ ngợi — giờ làm bình thường mà không còn phải để tâm.

Mọi thứ rất nhỏ thôi. Nhưng khi mình nhẹ hơn, cuộc sống tự nhiên cũng nhẹ hơn rất nhiều.`,
  },

  // ─── P2 — Proof callout fallbacks ───────────────────────────────────

  'proof-recognition': {
    title: 'Một chia sẻ',
    copy: 'Đọc xong tôi mới biết không phải mỗi mình mình bị. Cảm ơn chị share.',
    reviews: [{
      quote: 'Đọc xong tôi mới biết không phải mỗi mình mình bị. Cảm ơn chị share.',
      author: 'Một bạn đọc',
    }],
  },

  'proof-solution': {
    title: 'Một chia sẻ',
    copy: 'Mình lúc đầu cũng nghi nghi. Mà cách nó nói thì có cái gì đó khác. Thử rồi.',
    reviews: [{
      quote: 'Mình lúc đầu cũng nghi nghi. Mà cách nó nói thì có cái gì đó khác. Thử rồi.',
      author: 'Trang, 35',
    }],
  },

  'proof-future-self': {
    title: 'Một chia sẻ',
    copy: 'Tuần thứ 3 bắt đầu thấy khác thật. Không phải kiểu thần kỳ — chỉ là mọi thứ nhẹ hơn.',
    reviews: [{
      quote: 'Tuần thứ 3 bắt đầu thấy khác thật. Không phải kiểu thần kỳ — chỉ là mọi thứ nhẹ hơn.',
      author: 'Chị Lan, 42',
      meta: 'Sau 3 tuần dùng',
    }],
  },

  'future-self-cta': {
    title: 'Nếu bạn cũng đang ở giai đoạn đó',
    copy:
`Có thể bạn cũng đang ở giai đoạn đã quen với điều khó chịu tới mức không còn để ý.

Tôi không nói đây là phép màu. Chỉ muốn nói: bạn không phải đợi cho đến khi tệ hơn để bắt đầu thử cách khác.

Có lẽ đã đến lúc bạn cho phép bản thân thử một cách khác.`,
  },
  }
}

/** Legacy static table (supplement-paradigm). Kept ONLY for backward
 *  compatibility — new code paths should call buildFallbackCopy(brief). */
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

  // ─── P2 — Proof callout fallbacks ───────────────────────────────────
  // Used when generateProofSet fails — proof blocks ship with generic
  // believable fallback content. Real proof content from Gemini ideally.

  'proof-recognition': {
    title: 'Một chia sẻ',
    copy: 'Đọc xong tôi mới biết không phải mỗi mình mình bị. Cảm ơn chị share.',
    reviews: [{
      quote: 'Đọc xong tôi mới biết không phải mỗi mình mình bị. Cảm ơn chị share.',
      author: 'Một bạn đọc',
    }],
  },

  'proof-solution': {
    title: 'Một chia sẻ',
    copy: 'Mình lúc đầu cũng nghi nghi. Mà cách nó nói thì có cái gì đó khác. Thử rồi.',
    reviews: [{
      quote: 'Mình lúc đầu cũng nghi nghi. Mà cách nó nói thì có cái gì đó khác. Thử rồi.',
      author: 'Trang, 35',
    }],
  },

  'proof-future-self': {
    title: 'Một chia sẻ',
    copy: 'Tuần thứ 3 bắt đầu thấy khác thật. Không phải kiểu thần kỳ — chỉ là cơ thể nhẹ hơn.',
    reviews: [{
      quote: 'Tuần thứ 3 bắt đầu thấy khác thật. Không phải kiểu thần kỳ — chỉ là cơ thể nhẹ hơn.',
      author: 'Chị Lan, 42',
      meta: 'Sau 3 tuần dùng',
    }],
  },

  'future-self-cta': {
    title: 'Nếu bạn cũng đang ở giai đoạn đó',
    copy:
`Có thể bạn cũng đang ở giai đoạn mà sáng thức dậy thấy người nặng nề hơn — và đã quen với điều đó tới mức không còn để ý.

Tôi không nói đây là phép màu. Chỉ muốn nói: bạn không phải đợi cho đến khi mệt thêm để bắt đầu chăm cho mình.

Có lẽ đã đến lúc bạn cho phép bản thân thử một cách khác.`,
  },
}
