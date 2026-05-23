// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — HOOK VARIATION (v5.3)
//
// 10 emotional axes for section 1 hook diversity. Engine samples 1 axis
// per pack via seed. Combined with existing 6 HOOK_PATTERNS (narrativeHooks)
// = up to 60 distinct hook combinations.
//
// Goal: forbid same opening energy across packs. Each pack opens with
// DIFFERENT emotional entry point.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey } from '../types'

export type HookEmotionalAxis =
  | 'identity-collapse'        // "không nhận ra mình"
  | 'embarrassment'            // public/social shame
  | 'silence'                  // "không nói với ai"
  | 'frustration'              // tried many things, none lasted
  | 'vanity'                   // mirror, ảnh, attractiveness
  | 'exhaustion'               // chronic fatigue body collapse
  | 'relationship'             // chồng/vợ/family witness
  | 'social-discomfort'        // group, friends, public moments
  | 'aging-realization'        // "tôi đang già đi"
  | 'hidden-fear'              // afraid but hide

export interface HookAxisSpec {
  axis: HookEmotionalAxis
  description: string
  /** Vietnamese style references — examples of opening lines on this axis.
   *  Per niche if mapped, else generic. */
  examples: string[]
}

export const HOOK_AXES: Record<HookEmotionalAxis, HookAxisSpec> = {
  'identity-collapse': {
    axis: 'identity-collapse',
    description: 'Không nhận ra phiên bản mình — face/body/voice changed',
    examples: [
      'Soi gương buổi sáng — phụ nữ trong đó không phải tôi của 2 năm trước.',
      'Tôi nhìn ảnh năm ngoái rồi đặt điện thoại xuống — không hiểu sao mình thấy khác.',
      'Có ngày tôi không nhận ra giọng mình khi nghe ghi âm.',
    ],
  },
  'embarrassment': {
    axis: 'embarrassment',
    description: 'Public/social shame moment',
    examples: [
      'Tôi ghét cảm giác phải chống tay đứng dậy trước mặt con mình.',
      'Đồng nghiệp mới chào, tôi cúi đầu vì biết vùng đỉnh tóc lộ rõ.',
      'Ăn xong tôi xin phép đi vệ sinh — chỉ để soi lại da mình dưới ánh sáng khác.',
    ],
  },
  'silence': {
    axis: 'silence',
    description: 'Carrying alone, not telling anyone',
    examples: [
      'Tôi không nói chuyện này với ai — kể cả chồng.',
      'Có những điều tôi không kể vì kể ra cũng chẳng biết làm gì.',
      'Tôi giấu trong đầu mấy tháng nay, chỉ nói với chính mình.',
    ],
  },
  'frustration': {
    axis: 'frustration',
    description: 'Tried many things, all failed — frustration loop',
    examples: [
      'Tôi đã thử đủ kiểu — không có cái nào kéo dài quá 2 tuần.',
      'Mỗi lần tôi đọc bài "5 cách trẻ hóa", tôi ghi lại. Mỗi lần cũng quay lại điểm cũ.',
      'Tủ tôi đầy chai dùng dở — minh chứng cho hy vọng rồi thất vọng nhiều lần.',
    ],
  },
  'vanity': {
    axis: 'vanity',
    description: 'Mirror / appearance / attractiveness preoccupation',
    examples: [
      'Có một thời gian tôi né soi gương buổi sáng.',
      'Tôi mở camera trước, tắt, mở lại — đổi góc — cuối cùng không chụp gì.',
      'Tôi bắt đầu chỉ chụp ảnh phía sau khi đi với bạn cũ.',
    ],
  },
  'exhaustion': {
    axis: 'exhaustion',
    description: 'Chronic fatigue body collapse',
    examples: [
      '3 giờ chiều là lúc tôi thấy cơ thể mình "tắt điện".',
      'Ngủ 8 tiếng mà sáng dậy mệt hơn lúc đi ngủ.',
      'Tôi pha ly cà phê thứ 4 trong ngày — tay đã quen mở tủ.',
    ],
  },
  'relationship': {
    axis: 'relationship',
    description: 'Spouse/family witness / catalyst',
    examples: [
      'Chồng tôi là người đầu tiên hỏi: "em ngủ không ngon à?"',
      'Mẹ tôi nhắc nhẹ tuần trước — tôi giả vờ không nghe.',
      'Con gái hỏi sao mẹ đi chậm — câu đó tôi nhớ mãi.',
    ],
  },
  'social-discomfort': {
    axis: 'social-discomfort',
    description: 'Group / friends / public moments awkwardness',
    examples: [
      'Bữa họp lớp tháng trước — tôi đi sớm về sớm, không chụp ảnh.',
      'Đứng cạnh đồng nghiệp mới ở phòng tắm công ty, tôi rút điện thoại "để check".',
      'Bạn cũ rủ đi du lịch — tôi viện cớ bận, thực ra là sợ.',
    ],
  },
  'aging-realization': {
    axis: 'aging-realization',
    description: 'Sudden awareness "tôi đang già đi"',
    examples: [
      'Tôi nhận ra mình đang già đi trong một buổi sáng rất bình thường.',
      'Sau tuổi 40, tôi bắt đầu để ý từng triệu chứng — như đếm ngược.',
      'Tôi không còn thích ánh sáng trắng nữa — và biết lý do thật sự.',
    ],
  },
  'hidden-fear': {
    axis: 'hidden-fear',
    description: 'Afraid but hiding — silent anxiety',
    examples: [
      'Tôi đứng cạnh mép giường gần ba phút chỉ để lấy can đảm bước xuống.',
      'Đêm khuya tôi vẫn google triệu chứng — chồng không biết.',
      'Có một câu hỏi tôi tránh trả lời — vì tôi sợ câu trả lời.',
    ],
  },
}

/** Niche-specific axis bias — some axes fit niche better than others.
 *  Niche has 4-5 "preferred" axes; selector samples from preferred pool when available. */
export const NICHE_HOOK_AXIS_BIAS: Partial<Record<NicheKey, HookEmotionalAxis[]>> = {
  'haircare':            ['vanity', 'identity-collapse', 'embarrassment', 'social-discomfort', 'hidden-fear'],
  'skincare':            ['vanity', 'identity-collapse', 'aging-realization', 'social-discomfort', 'embarrassment'],
  'health-functional':   ['exhaustion', 'embarrassment', 'aging-realization', 'relationship', 'hidden-fear'],
  'supplement-wellness': ['exhaustion', 'silence', 'frustration', 'aging-realization', 'hidden-fear'],
  'mom-baby':            ['identity-collapse', 'silence', 'relationship', 'social-discomfort', 'hidden-fear'],
  'beauty-confidence':   ['vanity', 'identity-collapse', 'social-discomfort', 'embarrassment'],
  'relationship':        ['silence', 'relationship', 'hidden-fear', 'frustration'],
  'fitness-recovery':    ['frustration', 'embarrassment', 'aging-realization', 'exhaustion'],
}

/** Compose axis brief for prompt injection. */
export function hookAxisBrief(axis: HookEmotionalAxis): string {
  const spec = HOOK_AXES[axis]
  const examples = spec.examples.slice(0, 2).join(' / ')
  return `HOOK AXIS for section 1: ${axis} — ${spec.description}
  Style refs (NOT copy literally): ${examples}`
}
