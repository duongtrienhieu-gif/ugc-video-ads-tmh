// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — MICRO-REALISM HOOKS (v4.4)
//
// Library of embodied human details — small physical/sensory moments
// reader has lived through. INJECT 1-2 per section to ground narrative
// in recognizable lived experience.
//
// Goal: reader thinks "ờ mình cũng vịn cầu thang vậy" — recognition via
// physical reality, NOT poetic abstraction.
//
// CRITICAL DISTINCTION:
// - GOOD: "vịn cầu thang khi lên xuống" — recognizable moment, signal of state
// - BAD: "quay lại bồn rửa, vặn vòi nước, đặt muỗng xuống" — cinematic blocking
//
// Goal is recognition, NOT scene description.
// ─────────────────────────────────────────────────────────────────────

import type { SectionId } from '../types'

export type MicroRealismCategory =
  | 'physical-discomfort'     // body friction signals
  | 'fatigue-signals'         // energy depletion
  | 'reflection-moments'      // quiet thinking signals
  | 'failed-attempts-objects' // objects/actions from frustration phase
  | 'belief-shift-moments'    // quiet realization signals
  | 'tentative-engagement'    // first-try hesitation signals
  | 'recovery-signals'        // subtle improvement signs
  | 'quality-of-life'         // daily ease returned
  | 'mature-acceptance'       // looking back maturity
  | 'closure-stillness'       // quiet ending signals

export interface MicroRealismDetailSet {
  category: MicroRealismCategory
  description: string
  /** Vietnamese embodied detail phrases. Reader recognizes lived moments. */
  details: string[]
}

export const MICRO_REALISM_HOOKS: Record<MicroRealismCategory, MicroRealismDetailSet> = {
  'physical-discomfort': {
    category: 'physical-discomfort',
    description: 'Embodied body friction — sigh of cơ thể không còn phục hồi như trước',
    details: [
      'vịn cầu thang khi lên xuống',
      'đứng dậy chậm hơn trước, phải ngồi yên vài giây',
      'xoa đầu gối vô thức khi đang nói chuyện',
      'tay tê khi cầm điện thoại lâu',
      'cảm giác tê bì khi mới thức dậy',
      'cứng người khi ngồi lâu quá 30 phút',
      'kéo ghế chậm khi ngồi xuống bàn ăn',
      'nhói lên ở khớp khi đứng dậy bất chợt',
      'đứng cạnh giường mấy giây trước khi bước xuống',
      'đặt tay lên thắt lưng khi đứng dậy',
    ],
  },

  'fatigue-signals': {
    category: 'fatigue-signals',
    description: 'Embodied energy depletion — quiet signs of being out of fuel',
    details: [
      'bỏ dở ly cà phê chiều, quên uống',
      'nhìn đồng hồ 3 giờ chiều rồi thở dài',
      'người nặng như đeo chì khi mới thức dậy',
      'sáng dậy mà cảm thấy như chưa từng ngủ',
      'ngồi ở bàn trang điểm vài phút mà không làm gì',
      'mở tủ lạnh, đứng đó, đóng lại vì quên định lấy gì',
      'mí mắt sụp lúc 8 giờ tối',
      'pha cà phê thứ hai, thứ ba trong ngày',
      'ngủ 7-8 tiếng mà sáng dậy vẫn mệt',
      'đặt chìa khóa rồi quên mình đặt ở đâu',
    ],
  },

  'reflection-moments': {
    category: 'reflection-moments',
    description: 'Quiet observation signals — small physical moments of inner thought',
    details: [
      'nhìn bàn tay mình lâu hơn cần thiết',
      'ngồi ở bậc cửa cuối ngày, tay chống trán',
      'TV mở nhưng không thật sự xem',
      'nhìn ra cửa sổ thay vì màn hình điện thoại',
      'cầm ly trà đã nguội mà không nhớ đã pha bao giờ',
      'thở ra dài hơn bình thường khi ngồi xuống',
      'đứng yên trong bếp, đèn chưa bật',
      'tay đặt lên ngực vô thức',
      'cảm giác như đang giữ điều gì đó mà chưa nói ra',
    ],
  },

  'failed-attempts-objects': {
    category: 'failed-attempts-objects',
    description: 'Physical traces of things tried — frustration loop signals',
    details: [
      'kệ ngăn kéo có 4-5 lọ vitamin đã hết',
      'lọ dầu nóng nắp đã đậy nửa',
      'miếng dán giảm đau trong túi xách',
      'hộp thuốc bổ sung uống được 2 tuần rồi quên',
      'ứng dụng yoga trên điện thoại đã không mở 6 tuần',
      'túi gừng tươi mua từ tháng trước vẫn còn trong tủ',
      'đôi giày tập màu hồng treo trên kệ — chưa mang lần nào',
      'những bài "5 cách có nhiều năng lượng" lưu trong bookmark',
      'sách self-help đọc được 3 chương',
    ],
  },

  'belief-shift-moments': {
    category: 'belief-shift-moments',
    description: 'Quiet realization signals — small physical pause when mind opens',
    details: [
      'tự nhiên đứng yên giữa lời người ta đang kể',
      'không trả lời ngay, chỉ gật đầu',
      'cầm ly cà phê lên rồi đặt xuống mà không uống',
      'câu nói đó ở lại trong đầu cả tuần',
      'đêm đó tự dưng tra Google một cụm từ chưa từng search',
      'lần đầu cảm thấy "có lẽ mình đã hiểu sai"',
      'ngồi yên lâu hơn lúc ăn sáng hôm sau',
      'nhớ mãi một câu nói ngắn trong vài tuần',
    ],
  },

  'tentative-engagement': {
    category: 'tentative-engagement',
    description: 'First-try hesitation signals — low expectation, không tin lắm',
    details: [
      'đặt mua online, không tin lắm',
      'mở hộp ra, đọc qua hướng dẫn',
      'đặt sản phẩm trên kệ bếp cạnh bình cà phê',
      'sáng đầu tiên dùng theo hướng dẫn — không cảm thấy gì',
      'gần như đã quên là mình đang dùng',
      'không nói với ai mình đang thử',
      'đặt ở chỗ dễ thấy để không quên',
      'ngày thứ ba bắt đầu nghi ngờ chính mình',
    ],
  },

  'recovery-signals': {
    category: 'recovery-signals',
    description: 'Subtle improvement signs — small specific wins noticed retrospectively',
    details: [
      'sáng dậy không cần bấm "ngủ thêm 10 phút"',
      'không nghĩ tới ly cà phê thứ ba',
      'đứng dậy mà không cần ngồi yên vài giây',
      'mí mắt không nặng vào 9 giờ tối',
      'đi cầu thang mà không cần vịn',
      'không nhớ là khớp gối có nhói hôm nay không',
      'ngủ một mạch đến sáng',
      'đứng giữa siêu thị không cần đứng khựng',
    ],
  },

  'quality-of-life': {
    category: 'quality-of-life',
    description: 'Daily ease returned — small acts that signal life works again',
    details: [
      'đi chợ sớm, mang hoa về cắm trên bàn',
      'nấu ăn không cần ngồi nghỉ giữa chừng',
      'đưa con đi chơi mà vẫn còn sức lúc về',
      'ngồi vẽ với con đến 9 giờ tối',
      'đi bộ ngoài công viên buổi chiều',
      'nói chuyện điện thoại lâu với mẹ mà không thấy mệt',
      'pha trà mời chồng buổi tối',
      'bê đồ siêu thị về mà không cần dừng giữa lối đi',
    ],
  },

  'mature-acceptance': {
    category: 'mature-acceptance',
    description: 'Looking-back maturity signals — quiet wisdom of someone who saw it through',
    details: [
      'không hối tiếc, chỉ nghĩ "giá mà mình nghe cơ thể sớm hơn"',
      'không kể to chuyện này, nhưng kể với 1-2 người thân',
      'không nghĩ đây là phép màu, nhưng cũng không nghĩ là tình cờ',
      'có lẽ điều quan trọng nhất tôi học được là biết lắng nghe cơ thể mình',
      'không còn cảm giác phải "cố chịu" như trước',
      'biết khi nào nên nghỉ ngơi, biết khi nào cần hỗ trợ',
    ],
  },

  'closure-stillness': {
    category: 'closure-stillness',
    description: 'Quiet ending signals — calm presence, no push',
    details: [
      'ngồi ngoài ban công cuối ngày, nhìn ra ngõ',
      'pha một ly trà ấm, không vội uống',
      'tắt đèn chính, để đèn ngủ nhỏ',
      'ngồi yên một lát trước khi bắt đầu tối',
      'không cần làm gì cả',
      'thở ra dài, không vội vàng',
    ],
  },
}

// ═══ SECTION → CATEGORY MAP ═══════════════════════════════════════════

/** Map 11 sections → preferred micro-realism categories.
 *  Image gen + text gen both can reference. Section 10 (trust-continuity)
 *  is testimonial fragments — không inject (different voices). */
export const SECTION_MICRO_REALISM_MAP: Record<SectionId, MicroRealismCategory[]> = {
  'hook-interrupt':    ['physical-discomfort', 'reflection-moments'],
  'daily-friction':    ['physical-discomfort', 'fatigue-signals'],
  'internal-fear':     ['reflection-moments', 'fatigue-signals'],
  'failed-attempts':   ['failed-attempts-objects', 'fatigue-signals'],
  'belief-shift':      ['belief-shift-moments', 'reflection-moments'],
  'soft-reveal':       ['tentative-engagement'],
  'micro-reward':      ['recovery-signals'],
  'emotional-payoff':  ['quality-of-life', 'recovery-signals'],
  'reflection-trust':  ['mature-acceptance', 'reflection-moments'],
  'trust-continuity':  [],  // testimonial fragments — different voices
  'soft-cta':          ['closure-stillness', 'reflection-moments'],
}

// ═══ PROMPT DIRECTIVE ═════════════════════════════════════════════════

export const MICRO_REALISM_PROMPT =
  `Micro-realism injection rules:

GOAL: reader feels "ờ giống mình thật" — recognition via lived physical moments.

PHẢI có per section (where category assigned):
- 1-2 embodied details from section's micro-realism category
- Concrete physical/sensory moments (không metaphor, không abstraction)
- Reader-recognizable signals (đã từng vịn cầu thang, đã từng quên trong bếp)
- Weave naturally vào prose — KHÔNG list-y, KHÔNG bullet

TUYỆT ĐỐI KHÔNG:
- Cinematic blocking ("quay lại bồn rửa, vặn vòi nước, đặt muỗng xuống")
- Multi-step action choreography
- Poetic abstraction ("cơn gió cô đơn đi qua phòng")
- Over-described scenes
- Same detail repeated across sections (variety required)

Self-test: Câu chi tiết này có làm reader nghĩ "ờ mình cũng vậy" không? Hay chỉ
"ờ writing đẹp"? Nếu là writing đẹp → reject, choose simpler detail.`

/** Compose per-section directive — picks 2 random examples from category for variety. */
export function microRealismDirectiveFor(sectionId: SectionId): string {
  const categories = SECTION_MICRO_REALISM_MAP[sectionId]
  if (!categories || categories.length === 0) return ''

  const pickedCategory = categories[0]  // primary category
  const examples = MICRO_REALISM_HOOKS[pickedCategory].details.slice(0, 2)
  const altCategory = categories[1]
  const altExample = altCategory ? MICRO_REALISM_HOOKS[altCategory].details[0] : undefined

  const examplesStr = altExample
    ? `${examples.join(' / ')} / ${altExample}`
    : examples.join(' / ')

  return `MICRO-REALISM: weave 1-2 embodied details from [${categories.join(', ')}]. Examples (style refs, do NOT copy literally): ${examplesStr}`
}
