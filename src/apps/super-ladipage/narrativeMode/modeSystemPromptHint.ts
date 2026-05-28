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
      // OPT-F6 (2026-05-28): trimmed anti-soft-opening rules — they live
      // in the brainstorm brief's ANGLE_GUIDANCE block already. Kept
      // here are only the mode-specific bits: cadence pacing + the
      // skipped-block list (which brainstorm doesn't know about).
      return [
        '═══ NARRATIVE MODE: pain-driven-DR ═══',
        'PAIN-DRIVEN DR pack. Cadence siết, không warm-up nostalgia, hit pain Block 1.',
        '',
        'CADENCE:',
        '- Phase 1-2: stack agitate beats; mỗi block deepen pain, không relief sớm.',
        '- Phase 3: mechanism reveal nhanh — felt difference + 1-2 concrete domain terms.',
        '- Phase 4: micro-transformation + CTA ngắn.',
        '',
        'PACK SKIPS (compose dense ~12 blocks vs full 17):',
        '- not-alone-bridge (filler "bạn không đơn độc")',
        '- belief-shift (gộp vào shared-failed-attempts)',
        '- emotional-wins (redundant với micro-transformation)',
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
