// ─────────────────────────────────────────────────────────────────────
// Narrative Mode — modeSystemPromptHint (REBUILD Sprint 2, 2026-05-28)
//
// Per-mode cadence + opening guidance pasted into the storytelling
// systemPrompt right under the brainstorm anchor. Tells the writer how
// to PACE the pack, what tone to hold, and what NOT to do for the
// chosen mode.
//
// Kept short (~150-220 words) so it complements the brainstorm anchor
// without overwhelming the existing 4-phase + cadence instructions
// already in systemPrompt.
// ─────────────────────────────────────────────────────────────────────

import type { NarrativeMode } from './detectNarrativeMode'

export function buildModeHint(mode: NarrativeMode): string {
  switch (mode) {
    case 'pain-driven-DR':
      return [
        '═══ NARRATIVE MODE: pain-driven-DR ═══',
        'Đây là PAIN-DRIVEN DR pack. Reader đang đau — cần feedback NHANH.',
        '',
        'CADENCE:',
        '- Phase 1: HIT pain trong 2 câu đầu Block 1. KHÔNG warm-up nostalgia. KHÔNG soft philosophy mở đầu.',
        '- Phase 1-2: STACK agitate beats (đếm symptoms, vẽ tương lai tệ hơn, inventory failed attempts). Mỗi block kế tiếp PHẢI deepen pain, không relief sớm.',
        '- Phase 3: mechanism reveal nhanh — explain THROUGH felt difference + 1-2 concrete domain terms.',
        '- Phase 4: micro-transformation + CTA ngắn. KHÔNG dùng filler "cuộc sống nhẹ nhàng hơn" generic.',
        '',
        'PACK ĐANG ĐƯỢC CẮT NHỮNG BLOCK SAU (compose ngắn hơn ~12 blocks):',
        '- not-alone-bridge (filler "bạn không đơn độc")',
        '- belief-shift (đã gộp vào shared-failed-attempts qua brainstorm reframe beat)',
        '- emotional-wins (redundant với micro-transformation)',
        '',
        'TUYỆT ĐỐI KHÔNG:',
        '- Mở pack bằng "Bạn còn nhớ cảm giác..." nostalgia recall.',
        '- Mở pack bằng câu hỏi triết lý chung chung ("Có những điều rất nhỏ...").',
        '- Đoạn validation "tôi cũng từng cảm thấy như vậy" trước khi đã hit pain rank-1.',
        '- Cliché DR ("đặt hàng ngay", "đừng bỏ lỡ") — vẫn giữ diary tone, chỉ siết cadence.',
        '═══════════════════════════════════════════════════════════',
      ].join('\n')

    case 'aspiration-led':
      return [
        '═══ NARRATIVE MODE: aspiration-led ═══',
        'Đây là ASPIRATION-LED pack. Reader mua vì TƯƠNG LAI MUỐN ĐẾN, không phải vì NỖI ĐAU MUỐN THOÁT.',
        '',
        'CADENCE:',
        '- Phase 1: Mở bằng future-vision teaser — "bạn có hình dung được không, khi X..." Cho thấy possibility trước khi nói nỗi đau hiện tại.',
        '- Phase 2: Narrator chia sẻ "tôi cũng từng nghĩ là không thể" — failed attempts ở đây là attempts để ĐẠT mục tiêu, không phải để THOÁT khỏi triệu chứng.',
        '- Phase 3: mechanism = lý do TẠI SAO phương pháp này khác — đi vào logic + minh chứng nhẹ.',
        '- Phase 4: future-self projection dài hơn các mode khác — đây là core conversion.',
        '═══════════════════════════════════════════════════════════',
      ].join('\n')

    case 'recognition-soft':
    default:
      return [
        '═══ NARRATIVE MODE: recognition-soft ═══',
        'Đây là RECOGNITION-SOFT pack. Reader mua vì cảm thấy "trang này hiểu mình" — conversion-via-recognition, không phải hard-sell DR.',
        '',
        'CADENCE: pacing diary chậm cho phép. Hook có thể là recall/nostalgia ("bạn còn nhớ..."). Validation block + future-self block đầy đủ.',
        'Giữ nguyên 4-phase structure đầy đủ (15-17 blocks).',
        '═══════════════════════════════════════════════════════════',
      ].join('\n')
  }
}
