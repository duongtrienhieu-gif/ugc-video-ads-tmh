// ─────────────────────────────────────────────────────────────────────
// Pack Brainstorm — hookSubVariants (REBUILD Sprint 4, 2026-05-28)
//
// Each HookAngle expands into 4-5 SUB-VARIANTS so the brainstorm can
// surface meaningfully different opening flavors even when the chosen
// angle is the same.
//
// Without sub-variants, "pain-immediate-scene" always produced the
// "3 giờ sáng. Bạn lại..." pattern. With sub-variants, the same angle
// can open as:
//   - timed-scene      → fixed moment ("3 giờ sáng / Sáng nay / 4 giờ
//                        chiều mỗi ngày...")
//   - sensory-stack    → 2-3 sensory bullets without time anchor
//   - overheard-scene  → 3rd-person witnessed moment narrator joins
//   - mirror-scene     → reflection / observation moment
//   - waking-checklist → first-thing-on-waking inventory
//
// Used by:
//   1. synthesizePackBrainstorm — passed to Gemini as the menu it must
//      pick 3 candidates from (each candidate uses a DIFFERENT variant)
//   2. buildBrainstormBrief — variant hint pasted into systemPrompt so
//      the storytelling generator honors the chosen flavor
// ─────────────────────────────────────────────────────────────────────

import type { HookAngle } from './types'

export type HookSubVariant = string

export interface HookSubVariantSpec {
  /** Stable id used for fingerprinting + telemetry. */
  id: HookSubVariant
  /** Short label shown to the writer in the prompt. */
  label: string
  /** Concrete instruction for THIS variant. */
  hint: string
}

export const HOOK_SUB_VARIANTS: Record<HookAngle, HookSubVariantSpec[]> = {
  'pain-immediate-scene': [
    {
      id: 'timed-scene',
      label: 'Cảnh có mốc giờ cụ thể',
      hint: 'Mở bằng MỐC THỜI GIAN cụ thể ("3 giờ sáng", "Sáng nay 6 giờ", "Mỗi 4 giờ chiều..."). Sau mốc thời gian là 1 hành động micro reader đang làm.',
    },
    {
      id: 'sensory-stack',
      label: 'Stack giác quan không mốc giờ',
      hint: 'Mở bằng 2-3 BULLET GIÁC QUAN (cảm giác cơ thể, âm thanh, mùi, nhiệt độ). KHÔNG dùng mốc giờ. Mỗi sense câu ngắn 4-8 từ. Sau đó là 1 câu insight reader tự nhận.',
    },
    {
      id: 'overheard-scene',
      label: 'Cảnh người khác chứng kiến',
      hint: 'Mở từ MOMENT người KHÁC chứng kiến reader (con cái nghe tiếng ho, đồng nghiệp thấy mặt mệt). Narrator chia sẻ "tôi cũng có lần ấy" sau câu 2.',
    },
    {
      id: 'mirror-scene',
      label: 'Cảnh nhìn gương / reflection',
      hint: 'Mở bằng moment reader NHÌN VÀO chính mình (gương, ảnh selfie, video call). Cảm thấy điều gì đó khác. KHÔNG vanity, mà là physical state.',
    },
    {
      id: 'waking-checklist',
      label: 'Inventory lúc thức dậy',
      hint: 'Mở bằng "Việc đầu tiên bạn làm khi thức dậy là gì?" sau đó list 3 việc reader phải làm để đối phó triệu chứng trước khi ra khỏi giường.',
    },
  ],

  'social-shame': [
    {
      id: 'meeting-moment',
      label: 'Moment trong cuộc họp / gặp khách',
      hint: 'Mở từ moment reader phải dừng / lảng / che giấu trong CUỘC HỌP hoặc lúc gặp khách. Specific position: micro-action reader làm để hide.',
    },
    {
      id: 'family-witness',
      label: 'Bị người thân để ý',
      hint: 'Mở từ moment NGƯỜI THÂN (vợ/chồng/con/bố mẹ) nói câu "ơ, sao dạo này..." hoặc nhìn reader với ánh mắt khó tả. Reader giả vờ không biết.',
    },
    {
      id: 'public-avoidance',
      label: 'Né tránh nơi công cộng',
      hint: 'Mở bằng SỰ NÉ TRÁNH cụ thể reader đang làm: không đi đám đông, đổi chỗ ngồi xa người khác, từ chối lời mời. Hành vi né tránh = identity reveal.',
    },
    {
      id: 'selfie-avoidance',
      label: 'Né chụp ảnh / video',
      hint: 'Mở bằng moment reader phải né selfie / video call / chụp ảnh nhóm. Specific micro-excuse reader luôn dùng.',
    },
  ],

  'future-fear': [
    {
      id: 'five-year-projection',
      label: 'Hình dung 5 năm nữa',
      hint: 'Mở bằng "5 năm nữa nếu để vậy, đây là điều bạn sẽ không làm được nữa..." Specific lost-future-action (leo cầu thang, bế cháu, đi chợ xa).',
    },
    {
      id: 'kids-future-mirror',
      label: 'Sợ con cái sẽ thấy mình thế',
      hint: 'Mở từ FEAR con cái / cháu nhỏ sẽ chứng kiến / nhớ về reader trong tình trạng hiện tại. Identity-as-parent layer.',
    },
    {
      id: 'parent-mirror',
      label: 'Đi qua hình ảnh bố/mẹ',
      hint: 'Mở bằng KHOẢNH KHẮC reader nhận ra "tôi đang đi vào con đường bố/mẹ tôi đã đi" — bệnh giống, sức khỏe giống. Generational warning.',
    },
    {
      id: 'compound-warning',
      label: 'Cảnh báo tích lũy',
      hint: 'Mở bằng số liệu thật về việc condition này tích lũy nếu để lâu. "Đa số người không phát hiện cho đến khi quá muộn." Authority + Negative Future Pacing.',
    },
  ],

  'wasted-effort': [
    {
      id: 'money-receipt',
      label: 'Đếm chi phí đã ném',
      hint: 'Mở bằng LIST các thứ đã thử + số tiền đã ném vào, kết bằng tổng (tự áng chừng nếu input không có số). "Tôi ngồi tính, hơn X triệu đã ném vào X thứ — vẫn không hết."',
    },
    {
      id: 'time-counter',
      label: 'Đếm năm/tháng đã chịu đựng',
      hint: 'Mở bằng KHOẢNG THỜI GIAN cụ thể reader đã sống với tình trạng này ("3 năm", "từ sau sinh con thứ 2", "kể từ khi đổi việc"). Identity = "tôi quen với điều này quá rồi".',
    },
    {
      id: 'list-of-failures',
      label: 'Danh sách thứ đã thử',
      hint: 'Mở thẳng bằng 3-4 bullet failed attempts cụ thể (tên thuốc, tên phương pháp, tên người khuyên). Câu kết: "Bạn cũng có list này trong đầu?"',
    },
    {
      id: 'expectation-collapse',
      label: 'Hy vọng nào cũng sụp',
      hint: 'Mở từ moment reader vừa thử 1 thứ MỚI và nó vừa thất bại. "Lần này tôi tưởng sẽ khác. Nó không." Dropped-hope tone.',
    },
  ],

  'soft-recognition': [
    {
      id: 'nostalgia-quiet',
      label: 'Hồi tưởng nhẹ',
      hint: 'Mở bằng RECALL nhẹ ("bạn còn nhớ cảm giác... không?"). Câu hỏi mở, không pain-hit. Phù hợp beauty/lifestyle niches.',
    },
    {
      id: 'morning-routine',
      label: 'Routine sáng quen thuộc',
      hint: 'Mở bằng MOMENT routine reader đang lặp lại hàng ngày, đã quen đến mức không nhận ra. Khám phá micro-friction trong routine.',
    },
    {
      id: 'question-recall',
      label: 'Câu hỏi tự nhận',
      hint: 'Mở bằng CÂU HỎI nhẹ reader đã tự hỏi mình thầm vài lần. "Có phải bạn đã từng tự hỏi..." Identity-soft.',
    },
    {
      id: 'object-trigger',
      label: 'Nhìn 1 vật, nhớ ra',
      hint: 'Mở từ 1 OBJECT đời thường (gương, lọ kem cũ, ảnh selfie cũ) → reader nhận ra điều mình đang né. Pattern Interrupt nhẹ.',
    },
  ],
}

export function listSubVariants(angle: HookAngle): HookSubVariantSpec[] {
  return HOOK_SUB_VARIANTS[angle] ?? []
}

export function getSubVariantSpec(
  angle: HookAngle,
  variantId: HookSubVariant,
): HookSubVariantSpec | undefined {
  return (HOOK_SUB_VARIANTS[angle] ?? []).find((v) => v.id === variantId)
}
