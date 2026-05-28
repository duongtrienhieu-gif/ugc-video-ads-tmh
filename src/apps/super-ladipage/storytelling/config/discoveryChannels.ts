// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — DISCOVERY CHANNELS (v5.3)
//
// Section 6 (soft-reveal) product discovery diversity. Engine samples
// 1 channel per pack — different "how I found this" route per pack.
//
// Forbid template: "em gái tôi nhắc tới..." every pack.
// ─────────────────────────────────────────────────────────────────────

export type DiscoveryChannel =
  | 'old-friend'           // bạn cũ rủ cà phê
  | 'spouse-mention'       // chồng/vợ vô tình nhắc
  | 'sister-experience'    // em gái/chị share
  | 'overheard-clinic'     // tình cờ nghe ở phòng khám/spa
  | 'overheard-cafe'       // ngồi quán cà phê nghe bàn bên
  | 'late-night-search'    // google đêm khuya tự tìm
  | 'fb-saved-post'        // post Facebook lưu lại từ lâu
  | 'review-thread'        // đọc review thread (Tiki/Lazada/Shopee comment)
  | 'community-group'      // hội nhóm cùng cảnh
  | 'livestream-mention'   // livestream / podcast nhắc qua
  | 'article-line'         // bài báo đọc tình cờ
  | 'colleague-comment'    // đồng nghiệp comment nhẹ
  | 'mother-tradition'     // mẹ/dì truyền thống nhắc

export interface DiscoveryChannelSpec {
  channel: DiscoveryChannel
  description: string
  /** Vietnamese style references for opener — NOT literal copy. */
  examples: string[]
}

export const DISCOVERY_CHANNELS: Record<DiscoveryChannel, DiscoveryChannelSpec> = {
  'old-friend': {
    channel: 'old-friend',
    description: 'Bạn cũ rủ cà phê — share không phải sales',
    examples: [
      'Một bữa bạn cũ rủ đi cà phê — vô tình nó kể chuyện này.',
      'Tôi gặp lại bạn cấp 3 sau 5 năm — nghe nó kể, tôi giật mình.',
    ],
  },
  'spouse-mention': {
    channel: 'spouse-mention',
    description: 'Chồng/vợ tình cờ nhắc — observation gentle',
    examples: [
      'Chồng tôi hỏi một câu rất bình thường — và câu đó ở lại với tôi cả tuần.',
      'Vợ tôi mua thứ gì đó — nói "anh thử xem có khác không".',
    ],
  },
  'sister-experience': {
    channel: 'sister-experience',
    description: 'Em gái/chị share trải nghiệm tương tự',
    examples: [
      'Em gái tôi vừa quay lại đi làm sau nghỉ chăm con — nó kể chuyện cũng từng như tôi.',
      'Chị họ tôi vô tình kể — chị từng nghĩ là do tuổi tác, sau mới biết không phải.',
    ],
  },
  'overheard-clinic': {
    channel: 'overheard-clinic',
    description: 'Tình cờ nghe ở phòng khám/spa/hiệu thuốc',
    examples: [
      'Tôi đi khám sức khỏe định kỳ — ngồi đợi, nghe lỏm cô lớn tuổi nhắc tới một sản phẩm.',
      'Mua thuốc cho mẹ ở pharmacy — dược sĩ nhắc qua tôi cũng cần thử.',
    ],
  },
  'overheard-cafe': {
    channel: 'overheard-cafe',
    description: 'Ngồi quán cà phê nghe bàn bên — accidental',
    examples: [
      'Tôi đang ngồi cà phê làm việc — hai chị bàn bên nói chuyện, tôi không định nghe nhưng tự dưng để ý.',
      'Café gần văn phòng — tôi nghe lỏm hai bạn nữ kể về một thứ họ đang dùng.',
    ],
  },
  'late-night-search': {
    channel: 'late-night-search',
    description: 'Google đêm khuya tự tìm — chỉ tôi biết',
    examples: [
      'Đêm hôm đó tôi không ngủ — google một câu mà tôi đã giấu trong đầu cả tháng.',
      'Tôi đọc đâu đó một câu — đêm về tôi search lại, tìm thấy thông tin về sản phẩm này.',
    ],
  },
  'fb-saved-post': {
    channel: 'fb-saved-post',
    description: 'Post Facebook lưu lại từ lâu — accidental dig up',
    examples: [
      'Tôi quét lại danh sách post đã lưu trên Facebook — và thấy một bài share từ tháng trước.',
      'Một bài viết tôi lướt qua, lưu lại mà chưa đọc — tuần này mở lại.',
    ],
  },
  'review-thread': {
    channel: 'review-thread',
    description: 'Đọc review thread trên thương mại điện tử',
    examples: [
      'Tôi đang search sản phẩm khác trên Shopee — vô tình thấy comment review nhắc đến thứ này.',
      'Đọc threads comment dưới một bài post — vài người mention sản phẩm này.',
    ],
  },
  'community-group': {
    channel: 'community-group',
    description: 'Hội nhóm Facebook/Zalo cùng cảnh ngộ',
    examples: [
      'Nhóm các bà mẹ tôi join từ lúc sinh con — có chị share trải nghiệm tương tự.',
      'Group phụ nữ sau 35 — vô tình một post được chia sẻ nhiều, tôi click vào đọc.',
    ],
  },
  'livestream-mention': {
    channel: 'livestream-mention',
    description: 'Livestream / podcast nhắc qua — không phải ads',
    examples: [
      'Tôi vừa xem một podcast về sức khỏe phụ nữ — host nhắc qua một câu, làm tôi suy nghĩ.',
      'Livestream một bác sĩ tôi follow — không phải quảng cáo, chị ấy chỉ nhắc qua thôi.',
    ],
  },
  'article-line': {
    channel: 'article-line',
    description: 'Bài báo đọc tình cờ — một câu khiến ngẫm',
    examples: [
      'Bài báo tôi đọc tuần trước — có câu khiến tôi đặt điện thoại xuống suy nghĩ.',
      'Bài viết trên một tạp chí phụ nữ — chỉ một câu thôi mà tôi nhớ mãi.',
    ],
  },
  'colleague-comment': {
    channel: 'colleague-comment',
    description: 'Đồng nghiệp comment nhẹ — workplace',
    examples: [
      'Đồng nghiệp ngồi cạnh bảo "trông cậu hôm nay khác nhỉ" — sau đó cô ấy share một thứ cô đang dùng.',
      'Sếp tôi ngẫu nhiên nhắc — không phải khuyên, chỉ kể chuyện riêng.',
    ],
  },
  'mother-tradition': {
    channel: 'mother-tradition',
    description: 'Mẹ/dì truyền thống nhắc — generational',
    examples: [
      'Mẹ tôi ghé qua chơi — dặn dò vài câu, trong đó có một câu khiến tôi ghi nhớ.',
      'Dì tôi gọi điện hỏi thăm — vô tình nhắc một thứ dì đang dùng.',
    ],
  },
}

/** Compose channel brief for prompt. */
export function discoveryChannelBrief(channel: DiscoveryChannel): string {
  const spec = DISCOVERY_CHANNELS[channel]
  const examples = spec.examples.slice(0, 2).join(' / ')
  return `DISCOVERY CHANNEL for section 6: ${channel} — ${spec.description}
  Style refs (NOT copy literally): ${examples}`
}
