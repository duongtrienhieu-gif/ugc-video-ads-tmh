// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — fallback copy (downgrade path)
//
// Section-level safe fallback used khi retry vẫn fail validators.
// Strategy: KHÔNG drama escalation — degrade to simpler, safer content.
//
// These copy đã được handcrafted để pass tất cả 5 validators (bio-intro,
// adjacent-rhythm, ai-cadence, banned-phrase, commercial-tone). Generic
// enough để fit nhiều niche, restraint maintained.
// ═════════════════════════════════════════════════════════════════════

import type { SectionId } from '../types'

export interface FallbackSection {
  title: string
  copy: string
}

/** Per-section fallback. Each is short, safe, demonstrates rhythm. */
export const FALLBACK_COPY: Record<SectionId, FallbackSection> = {
  'intro-portrait': {
    title: 'Một sáng tháng Ba',
    copy:
`Chồng cô là người đầu tiên nhận ra.

Một sáng anh đứng ở cửa bếp, hỏi một câu rất bình thường.

Cô lắc đầu. Bình thường.

Nhưng anh nhìn cô thêm một giây — rồi đi.

Cô không hiểu vì sao mình nhớ mãi giây phút đó.`,
  },

  'ordinary-life': {
    title: 'Cuộc sống không có gì đặc biệt',
    copy:
`Cuộc sống của cô không có gì đặc biệt — đúng theo nghĩa mà chính cô vẫn dùng khi ai đó hỏi.

Mỗi tuần cô vẫn làm những việc cô đã làm nhiều năm qua, vẫn gặp những người cô vẫn gặp, vẫn đi qua cùng những con đường.

Người ta vẫn nói cô may mắn. Không có lý do gì để phàn nàn.

Cô đồng ý với họ.

Chỉ là — và cô không nhớ chính xác từ khi nào — có những buổi tối cô ngồi lâu hơn bình thường, không làm gì.`,
  },

  'daily-friction': {
    title: 'Một cảm giác quen thuộc',
    copy:
`Mỗi chiều.

Một cảm giác đến.

Không phải mệt. Cũng không phải buồn ngủ.

Một cái gì đó ở giữa. Một cái gì đó cô không có từ để gọi tên.

Cô tiếp tục công việc. Khách vào, khách ra.

Đến tối thì đỡ hơn.

Điều lạ là — chuyện này lặp lại nhiều ngày liên tiếp, và cô vẫn không nói ai biết.`,
  },

  'failed-attempts': {
    title: 'Cô đã thử',
    copy:
`Vitamin tổng hợp. Đã thử.

Đi ngủ sớm hơn. Đã thử.

Uống nhiều nước. Đã thử.

Mỗi lần cô đọc một bài về cách có nhiều năng lượng hơn — cô ghi lại. Thử được vài ngày. Rồi quay lại điểm cũ.

Không phải cô lười. Cô biết điều đó.

Vấn đề là — cô bắt đầu nghĩ — có lẽ vấn đề không nằm ở chỗ cô chưa đủ cố gắng.`,
  },

  'inner-realization': {
    title: 'Một câu hỏi cô đã tránh',
    copy:
`Có một câu hỏi mà cô đã tránh nhiều tháng nay.

Không phải vì sợ. Mà vì cô không biết bắt đầu trả lời thế nào.

Có lẽ — cô nghĩ rất chậm — cơ thể cô đang thiếu một thứ gì đó.

Một thứ rất nhỏ. Nhưng cụ thể.

Cô không biết là thứ gì.

Nhưng từ ngày đó, cô bắt đầu để ý hơn.`,
  },

  'discovery-moment': {
    title: 'Một tối tháng Năm',
    copy:
`Em gái cô ghé qua chơi một tối.

Hai chị em ngồi ở hiên nhà, uống trà. Em gái vừa quay lại đi làm sau nhiều tháng nghỉ.

"Chị có biết — em từng tưởng mình bị burnout thật sự," cô em nói. "Sau đó em mới biết là…"

Em gái nhắc một cái tên.

Cô chưa từng nghe.

Cô gật đầu lịch sự.

Đêm đó cô tra Google.`,
  },

  'first-trial': {
    title: 'Không kỳ vọng gì',
    copy:
`Cô không kỳ vọng gì.

Đặt mua. Chờ hai ngày. Hộp đến.

Cô mở ra. Đọc hướng dẫn. Đặt lên kệ bếp.

Sáng hôm sau cô dùng theo hướng dẫn.

Ngày đầu không cảm thấy gì. Ngày thứ hai cũng vậy.

Cô có thói quen quên đi những thứ không gây ra phản ứng tức thì.

Có lẽ điều đó cũng giải thích nhiều chuyện khác.`,
  },

  'subtle-change': {
    title: 'Cô không nhớ chính xác',
    copy:
`Cô không nhớ chính xác ngày nào mọi thứ bắt đầu khác đi — đó là điều cô vẫn nói khi sau này có ai hỏi.

Có thể là sáng thứ Tư của tuần thứ ba — khi cô tỉnh dậy mà không cần bấm "ngủ thêm mười phút" trên đồng hồ.

Có thể là một chiều khi cô không nghĩ đến ly cà phê thứ ba — và mãi đến tối hôm sau cô mới nhận ra điều đó.

Hoặc một tối Chủ Nhật, khi cô ngồi với con đến chín giờ và mí mắt vẫn không nặng.

Những thay đổi nhỏ. Không kịch tính.

Chỉ là — không còn ngồi lâu trước bàn vào buổi tối nữa.`,
  },

  'new-normal': {
    title: 'Bây giờ',
    copy:
`Bây giờ là một mùa khác.

Mọi việc vẫn diễn ra như cũ.

Khác là — cô không còn đứng nhìn theo lâu hơn cần thiết nữa.

Cuối tuần cô đi chợ sớm, đôi khi mang hoa về cắm trên bàn. Việc nhỏ — nhưng cô nhớ là vài tháng trước cô không có sức để nghĩ đến chuyện hoa.

Tuần trước chồng cô có nói một câu. Anh không nhớ — cô hỏi lại và anh không nhớ.

Cô nói: "Em ngủ ngon."`,
  },

  'sharing-invitation': {
    title: 'Nếu bạn cũng từng…',
    copy:
`Câu chuyện đến đây là hết.

Tôi không biết câu chuyện của bạn đang ở đâu — giữa Chương Ba và Chương Bốn, có lẽ.

Nếu bạn cũng từng có những cảm giác tương tự — có lẽ chúng ta hiểu nhau hơn bạn nghĩ.

Tôi chỉ muốn nói: bạn không một mình.`,
  },
}
