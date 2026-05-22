// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — fallback copy (P0.5.4 STORYSELLING REALIGNMENT)
//
// Section-level safe fallback. Used khi retry vẫn fail validators.
// Strategy: NO drama escalation — degrade to simpler, safer content.
//
// REWRITTEN for storyselling: 1st person "tôi" voice, conversational
// flow, specific named pain, sales-functional per section.
//
// These copy đã được handcrafted để:
//   - Pass all 5 hard validators (bio-intro, adjacent-rhythm, ai-cadence,
//     banned-phrase, commercial-tone)
//   - Pass selfInsertion soft warning (1st person from line 1)
//   - Demonstrate the storyselling voice target
//
// Generic enough cho nhiều niche, restraint maintained, NOT copywriter
// template.
// ═════════════════════════════════════════════════════════════════════

import type { SectionId } from '../types'

export interface FallbackSection {
  title: string
  copy: string
}

export const FALLBACK_COPY: Record<SectionId, FallbackSection> = {
  'intro-portrait': {
    title: 'Có một thời gian',
    copy:
`Có một thời gian tôi gần như không dám nhìn vào gương mỗi sáng. Không phải vì tôi ghét bản thân mình, mà vì càng nhìn tôi càng thấy mệt — da xỉn màu, mắt thâm, lúc nào cũng như thiếu sức sống dù đã cố ngủ sớm và chăm sóc đủ kiểu.

Tôi đã ngoài 35, có gia đình nhỏ, công việc tạm ổn. Cuộc sống không có gì để than phiền — nhưng có một điều tôi vẫn không hiểu sao mình lại cảm thấy như vậy mỗi ngày.`,
  },

  'ordinary-life': {
    title: 'Mọi thứ vẫn diễn ra bình thường',
    copy:
`Tôi không nhớ chính xác mọi chuyện bắt đầu từ khi nào. Có lẽ là sau tuổi 35, khi mọi thứ vẫn diễn ra bình thường ở bên ngoài — đi làm, lo cho gia đình, dọn dẹp nhà cửa — nhưng ở bên trong tôi có cảm giác như đang lái xe với phanh tay kéo lên nhẹ.

Ai nhìn vào cuộc sống của tôi cũng nói tôi may mắn. Tôi cũng đồng ý. Chỉ là có những buổi tối tôi ngồi ở bàn lâu hơn cần thiết, không làm gì cả — và tôi không biết tại sao.`,
  },

  'daily-friction': {
    title: 'Khoảng 3 giờ chiều mỗi ngày',
    copy:
`Khoảng 3 giờ chiều mỗi ngày, tôi sẽ thấy cơ thể mình như hết pin. Không phải mệt theo kiểu thiếu ngủ, mà là một cảm giác trống rỗng khó tả — tôi vẫn làm việc, vẫn cười với mọi người, nhưng phải gồng lên rất nhiều.

Tối về thì khá hơn một chút, nhưng sáng dậy tôi lại bắt đầu chu kỳ đó từ đầu. Đôi khi tôi nhìn vào gương thấy da mình xỉn màu hơn, mắt có quầng thâm rõ, và tôi nghĩ "ơ sao trông mình hôm nay khác vậy". Điều lạ là tôi không nói với ai chuyện này — vì kể ra cũng không biết bắt đầu từ đâu.`,
  },

  'failed-attempts': {
    title: 'Tôi đã thử nhiều cách',
    copy:
`Tôi đã thử nhiều cách. Đi ngủ sớm hơn — được 1 tuần. Vitamin tổng hợp ở hiệu thuốc — uống được 2 tháng không thấy khác. Tập thể dục buổi sáng — được 5 ngày. Tôi cũng đổi nhiều dòng mỹ phẩm, chăm sóc da kỹ hơn, uống nước nhiều hơn.

Mỗi cách work được vài ngày rồi tôi lại quay về trạng thái cũ. Đến lúc đó tôi bắt đầu nghĩ — có lẽ vấn đề không nằm ở việc tôi chưa đủ cố gắng. Có lẽ tôi đang thiếu một thứ gì đó nhỏ thôi, nhưng cụ thể, mà tôi chưa biết là gì.`,
  },

  'inner-realization': {
    title: 'Một câu hỏi tôi đã tránh',
    copy:
`Có một câu hỏi tôi đã tránh trong vài tháng nay. Không phải vì tôi sợ trả lời, mà vì tôi không biết bắt đầu từ đâu. Cơ thể tôi đang nói với tôi điều gì đó mà tôi chưa lắng nghe đủ kỹ.

Sau tuổi 35, có những thứ không thể giải quyết chỉ bằng ngủ thêm một tiếng hay uống thêm một ly cà phê. Tôi nghĩ mình cần một cái gì đó hỗ trợ từ bên trong — không phải để khoẻ tức thì, mà để cơ thể có đủ những thứ nó cần để hoạt động bình thường trở lại.`,
  },

  'discovery-moment': {
    title: 'Một tối tháng năm',
    copy:
`Em gái tôi ghé qua chơi vào một tối tháng 5. Hai chị em ngồi ngoài hiên uống trà, nghe tụi nhỏ trong nhà cãi nhau chuyện xem phim. Em tôi vừa quay lại đi làm sau mấy tháng nghỉ chăm con.

"Em từng tưởng mình bị burnout thật sự," nó nói, không nhìn tôi. "Mệt kiểu chết người. Sau đó em mới biết là cơ thể em đang thiếu một số chất. Em uống một dòng bổ sung khoảng 6 tuần thì khác hẳn."

Em tôi nhắc tên một sản phẩm. Tôi chưa từng nghe. Đêm đó tôi mở điện thoại tra thử.`,
  },

  'first-trial': {
    title: 'Tôi không kỳ vọng gì cao',
    copy:
`Thú thật là tôi không kỳ vọng gì cao. Mua online, chờ 2 ngày, hộp đến, tôi mở ra đọc hướng dẫn rồi đặt lên kệ. Sáng hôm sau bắt đầu dùng theo hướng dẫn.

Ngày đầu tôi không cảm thấy gì. Ngày thứ ba cũng vậy. Tôi gần như đã quên là mình đang dùng — vì tôi vốn không tin lắm vào những thứ "sẽ thay đổi cuộc sống bạn".`,
  },

  'subtle-change': {
    title: 'Khoảng tuần thứ ba',
    copy:
`Khoảng tuần thứ 3, tôi mới nhận ra mọi thứ đang khác đi. Không phải kiểu "tôi cảm thấy tràn đầy năng lượng" như quảng cáo hay nói — mà nhỏ hơn rất nhiều.

Một sáng thứ Tư tôi tỉnh dậy lúc 5h30 và không cần bấm "ngủ thêm 10 phút". Tôi để ý nhưng nghĩ chắc tình cờ. Chiều thứ Sáu, 3 giờ trôi qua mà tôi không nghĩ đến ly cà phê thứ ba. Đến chiều thứ Bảy tôi mới chợt nhận ra mình đã không pha cà phê chiều suốt 2 ngày.

Da thì sáng hơn một chút. Mắt đỡ thâm. Nhưng quan trọng hơn — tôi không còn cảm giác trống rỗng vào 3 giờ chiều nữa.`,
  },

  'new-normal': {
    title: 'Bây giờ',
    copy:
`Bây giờ là vài tháng sau. Cuộc sống vẫn diễn ra như trước — vẫn những công việc đó, vẫn những người đó, vẫn những ngày đó. Khác là tôi không còn phải gồng lên để đi qua từng buổi chiều nữa.

Cuối tuần tôi đi chợ sớm hơn, đôi khi mang hoa về cắm trên bàn ăn. Việc rất nhỏ — nhưng tôi nhớ là vài tháng trước tôi không có đủ sức để nghĩ đến chuyện hoa. Hôm rồi chồng tôi hỏi: "Em dạo này nhìn khác hẳn nhỉ?" Tôi cười, không nói gì nhiều — vì câu trả lời rất đơn giản: tôi ngủ ngon hơn, ăn ngon hơn, và không còn lo lắng vô cớ.`,
  },

  'sharing-invitation': {
    title: 'Nếu bạn cũng từng',
    copy:
`Tôi viết những dòng này không phải để quảng cáo gì. Câu chuyện của tôi đến đây là hết — nhưng có thể câu chuyện của bạn đang ở đâu đó giữa chương 3 và chương 4.

Nếu bạn cũng từng có cảm giác mệt vô cớ vào 3 giờ chiều, từng nhìn vào gương và tự hỏi "có phải mình đang già rồi không" — có lẽ chúng ta hiểu nhau hơn bạn nghĩ. Tôi chỉ muốn nói: bạn không một mình. Và đôi khi cơ thể chỉ cần một thứ rất nhỏ để quay lại bình thường thôi.`,
  },
}
