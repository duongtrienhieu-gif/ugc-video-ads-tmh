// ─────────────────────────────────────────────────────────────────────
// Pack Brainstorm — buildBrainstormBrief (REBUILD Sprint 1, 2026-05-28)
//
// Convert PackBrainstorm output into a short paragraph that gets pasted
// at the TOP of the storytelling system prompt. The downstream writer
// is told to anchor Block 1 to the hookDraft + scaffold Phase 1-2 from
// the agitateBeats.
//
// Kept tight (~250-400 words) so it doesn't bloat the prompt.
// ─────────────────────────────────────────────────────────────────────

import type { PackBrainstorm, HookAngle } from './types'
import { getSubVariantSpec } from './hookSubVariants'

const ANGLE_GUIDANCE: Record<HookAngle, string> = {
  'pain-immediate-scene':
    'Mở Block 1 bằng SCENE CỤ THỂ tại 1 thời điểm xác định (giờ / khoảnh khắc). KHÔNG dùng pattern "bạn còn nhớ..." (nostalgia). KHÔNG dùng câu hỏi triết lý chung chung.',
  'social-shame':
    'Mở Block 1 bằng MOMENT XÃ HỘI mà reader giấu nỗi đau (cuộc họp / gặp khách / chụp ảnh). Đánh vào identity, KHÔNG vào triệu chứng đơn thuần.',
  'future-fear':
    'Mở Block 1 bằng PROJECTION 5-10 năm nếu để vậy. Kèm 1 chi tiết cụ thể (vd "không leo nổi cầu thang nhà mình"). KHÔNG nhẹ nhàng "có lẽ".',
  'wasted-effort':
    'Mở Block 1 bằng INVENTORY các thứ reader đã thử + tiền đã ném vào. Số cụ thể nếu có. Frustration tone, KHÔNG resignation tone.',
  'soft-recognition':
    'Mở Block 1 bằng RECOGNITION nhẹ — vẫn YOU-first nhưng warmer cadence. Pattern "bạn còn nhớ..." chấp nhận ở mode này.',
}

export function buildBrainstormBrief(brainstorm: PackBrainstorm): string {
  const lines: string[] = []
  lines.push('═══ PACK BRAINSTORM (REQUIRED ANCHOR — DO NOT IGNORE) ═══')
  lines.push('')
  lines.push(`Chosen hook angle: ${brainstorm.chosenAngle}`)
  lines.push(`Angle guidance: ${ANGLE_GUIDANCE[brainstorm.chosenAngle]}`)
  // Sprint 4: surface the sub-variant the picker chose so the writer
  // knows WHICH flavor of the angle to use.
  const subSpec = getSubVariantSpec(brainstorm.chosenAngle, brainstorm.chosenSubVariant)
  if (subSpec) {
    lines.push(`Chosen sub-variant: ${subSpec.id} (${subSpec.label})`)
    lines.push(`Sub-variant hint: ${subSpec.hint}`)
  } else if (brainstorm.chosenSubVariant) {
    lines.push(`Chosen sub-variant: ${brainstorm.chosenSubVariant}`)
  }
  lines.push('')

  // OPT-F4 (2026-05-28): the full pain list lives in PRODUCT ESSENCE's
  // "Reader-specific symptoms" block below — listing all 5 ranks again
  // here was a ~400-token duplicate. Keep just the rank-1 pain so the
  // hook draft anchor stays clear, and the rest comes from the essence
  // block (which also carries forbiddenDriftSymptoms — more useful).
  const topPain = brainstorm.painLadder[0]
  if (topPain) {
    lines.push(`Rank-1 pain (Block 1 MUST hit this in first 2 sentences): [${topPain.lossType}] ${topPain.pain}`)
    lines.push('(Full pain list is in the PRODUCT ESSENCE block below.)')
    lines.push('')
  }

  lines.push('HOOK DRAFT — Block 1 (self-recognition-hook) opening:')
  lines.push(`"""`)
  lines.push(brainstorm.hookDraft)
  lines.push(`"""`)

  // Sprint 5 — E1 (2026-05-28): STRICT VERBATIM rule for non-soft angles.
  // Previously this section said "STARTING POINT + may polish" which gave
  // Gemini permission to soften the draft into a generic recall question
  // ("Lần cuối bạn ngủ ngon là khi nào?"). The pain-driven draft was
  // overridden by the system prompt's "Reader Immersion soft" architecture.
  // For non-soft angles, the opening is now LOCKED.
  if (brainstorm.chosenAngle === 'soft-recognition') {
    lines.push('Use this draft as the STARTING POINT for Block 1. You may polish freely while keeping the recall feel.')
  } else {
    lines.push('═══ HARD RULE — BLOCK 1 OPENING IS LOCKED ═══')
    lines.push('Block 1\'s FIRST 2-3 SENTENCES MUST be the hookDraft above, VERBATIM or near-verbatim (≤10% word change allowed only for minor flow fixes like pronoun/connector adjustments).')
    lines.push('You may ADD 1-2 connecting sentences AFTER the locked opening, but the opening 2-3 are LOCKED to the draft.')
    lines.push('')
    lines.push('FORBIDDEN — DO NOT do any of these to Block 1 opening:')
    lines.push('  ✗ Replace with a generic recall question ("Lần cuối bạn ngủ ngon là khi nào?", "Bạn còn nhớ cảm giác...?")')
    lines.push('  ✗ Replace with a philosophical question ("Có những điều rất nhỏ nhặt...")')
    lines.push('  ✗ Soften the draft into vague emotional language ("Có những ngày bạn cảm thấy như...")')
    lines.push('  ✗ Strip out concrete details (times, numbers, sensory cues) from the draft')
    lines.push('  ✗ Insert a soft narrator self-intro before the locked opening')
    lines.push('')
    lines.push('OVERRIDE NOTE: the system prompt\'s "Reader Immersion soft" rule ("recognition progression > story progression", "human imperfection") DOES NOT APPLY to Block 1 opening when this brainstorm anchor is present. Anchor wins.')
  }
  lines.push('Block 1 must hit the rank-1 pain WITHIN THE FIRST 2 SENTENCES.')
  lines.push('')

  if (brainstorm.agitateBeats.length > 0) {
    lines.push('Agitate beats for Phase 1-2 blocks (daily-micro-friction + hidden-emotional-truth):')
    brainstorm.agitateBeats.forEach((b, i) => {
      lines.push(`  • Beat ${i + 1}: ${b}`)
    })
    lines.push('Each Phase 1-2 block must touch AT LEAST ONE of these beats. Stack them, don\'t skip to relief.')
    lines.push('')
  }

  if (brainstorm.socialProofPersonas.length > 0) {
    lines.push('Social-proof persona seeds (for proof-future-self / lifestyle blocks):')
    brainstorm.socialProofPersonas.forEach((p, i) => {
      lines.push(`  Persona ${i + 1}: ${p.label} — ${p.angle}`)
    })
    lines.push('')
  }

  if (brainstorm.rationale) {
    lines.push(`(Rationale — debug only, not for output: ${brainstorm.rationale})`)
  }

  lines.push('═══════════════════════════════════════════════════════════')
  return lines.join('\n')
}
