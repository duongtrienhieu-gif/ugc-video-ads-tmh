// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — narrative hooks (section 1 only)
//
// Opening hook patterns + banned bio-style framings. Enforced via
// runtime self-test prompt: section 1 MUST open with anomaly/observation,
// NEVER with name/age/routine/job/personality label.
// ─────────────────────────────────────────────────────────────────────

import type { HookPattern, SectionId } from '../types'

export interface HookPatternSpec {
  pattern: HookPattern
  description: string
  /** 2-3 example opening lines (Vietnamese). Style demos, không phải template. */
  examples: string[]
}

export const HOOK_PATTERNS: Record<HookPattern, HookPatternSpec> = {
  'observation-first': {
    pattern: 'observation-first',
    description: 'Mở qua mắt ai đó khác — chứng kiến, để ý, nhận ra',
    examples: [
      'Chồng cô là người đầu tiên nhận ra.',
      'Em gái cô gọi điện vào một sáng và hỏi một câu rất lạ.',
      'Hàng xóm có lẽ là người để ý trước cô.',
    ],
  },
  'anomaly-first': {
    pattern: 'anomaly-first',
    description: 'Mở bằng moment lạ nhỏ — hành vi bất thường, vắng mặt thói quen',
    examples: [
      'Có một khoảng thời gian, cô bắt đầu tránh nhìn vào gương quá lâu.',
      'Cô không nhớ chính xác lần cuối cùng mình ngồi xuống mà không nghĩ đến việc đứng dậy.',
      'Buổi sáng hôm đó, lần đầu tiên trong nhiều tháng, cô không bấm "ngủ thêm".',
    ],
  },
  'negative-space': {
    pattern: 'negative-space',
    description: 'Mở bằng điều gì missing/avoided — không nói ra, không làm',
    examples: [
      'Có những thứ thay đổi rất chậm — bạn không để ý cho đến khi đã quá muộn để giả vờ là không có.',
      'Cô không nói với ai. Đó có lẽ là phần khó nhất.',
      'Không phải cô không muốn nói. Chỉ là cô không biết nói như thế nào.',
    ],
  },
  'time-blur': {
    pattern: 'time-blur',
    description: 'Mở bằng không xác định bắt đầu khi nào — "không nhớ chính xác"',
    examples: [
      'Aishah không nhớ chính xác khi nào nó bắt đầu.',
      'Có lẽ đã ba tháng. Có lẽ sáu tháng. Cô không đếm.',
      'Sau này khi có người hỏi, cô vẫn không biết trả lời thế nào.',
    ],
  },
  'subtle-detail': {
    pattern: 'subtle-detail',
    description: 'Mở bằng magnify thứ rất nhỏ — chi tiết đời thường',
    examples: [
      'Ban đầu chỉ là một chuyện rất nhỏ.',
      'Mọi chuyện lúc đầu thật ra không nghiêm trọng.',
      'Cốc cà phê thứ ba — đó là dấu hiệu cô nhớ nhất.',
    ],
  },
  'third-person-witness': {
    pattern: 'third-person-witness',
    description: 'Mở chứng kiến từ người khác — không phải bản thân nhân vật',
    examples: [
      'Aida — em gái — là người đầu tiên dùng từ đó.',
      'Chồng cô nói câu đó vào một sáng thứ Bảy.',
      'Cô bạn thân từ thời cấp ba nhắn tin: "Mày dạo này sao vậy?"',
    ],
  },
}

/** Banned opening patterns — runtime semantic gate sẽ reject section 1
 *  nếu mở bằng các pattern này. */
export const BANNED_HOOK_PATTERNS = [
  'name-age-intro',          // "Aishah, 38 tuổi"
  'location-intro',          // "Sống ở Selangor..."
  'routine-description',     // "Mỗi sáng cô dậy lúc..."
  'job-description',         // "Cô làm chủ một cửa hàng nhỏ..."
  'family-composition',      // "Cô sống cùng chồng và 2 con..."
  'personality-label',       // "Cô là kiểu người..."
  'background-exposition',   // "Sinh ra trong một gia đình..."
  'demographic-statement',   // "Cô thuộc thế hệ phụ nữ Á Đông..."
] as const

/** Inject vào pack-gen prompt cho section 1 only. */
export const HOOK_ENFORCEMENT_PROMPT =
  `Section 1 (hook) opening rules:
- OPEN with observation / anomaly / negative-space / time-blur / subtle-detail / third-person-witness
- BANNED: name+age, location, routine, job, family composition, personality label
- Identity reveal đến SAU hook — qua context (scene, dialogue), không qua statement
- Hook line PHẢI tạo unresolved question trong 3 dòng đầu
- Self-test: "Câu mở đầu có gây 'ủa, chuyện gì vậy?' cho reader không?"`

/** Section IDs có hook (chỉ section 1 hiện tại). */
export const HOOK_REQUIRED_SECTIONS: SectionId[] = ['intro-portrait']
