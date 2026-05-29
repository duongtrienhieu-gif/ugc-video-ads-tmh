// ─────────────────────────────────────────────────────────────────────
// Pack Brainstorm — buildBrainstormBrief (v6, 2026-05-29)
//
// REBUILD: removed Sprint 5 E1 "HARD RULE — BLOCK 1 OPENING IS LOCKED"
// escalation. That escalation existed because the v5 system prompt was
// overriding the brainstorm with its "Reader Immersion soft" default.
//
// In v6, the system prompt is MODE-CONDITIONAL — when brainstorm picked
// a pain angle, the system prompt is already pain-driven. No override
// needed → no HARD RULE needed → no "OVERRIDE NOTE: Reader Immersion
// soft DOES NOT APPLY" needed.
//
// The brainstorm now just states its decisions clearly. The downstream
// architecture is aligned, not fighting.
// ─────────────────────────────────────────────────────────────────────

import type { PackBrainstorm, HookAngle } from './types'
import { getSubVariantSpec } from './hookSubVariants'

const ANGLE_GUIDANCE: Record<HookAngle, string> = {
  'pain-immediate-scene':
    'Block 1 mở bằng SCENE CỤ THỂ tại 1 thời điểm xác định (giờ / moment).',
  'social-shame':
    'Block 1 mở bằng MOMENT XÃ HỘI mà reader giấu nỗi đau (cuộc họp / gặp khách / chụp ảnh).',
  'future-fear':
    'Block 1 mở bằng PROJECTION 5-10 năm nếu để vậy. Kèm 1 chi tiết cụ thể.',
  'wasted-effort':
    'Block 1 mở bằng INVENTORY các thứ reader đã thử + tiền đã ném vào. Số cụ thể nếu có.',
  'soft-recognition':
    'Block 1 mở bằng RECOGNITION nhẹ — YOU-first warmer cadence. Pattern "bạn còn nhớ..." chấp nhận.',
}

export function buildBrainstormBrief(brainstorm: PackBrainstorm): string {
  const lines: string[] = []
  lines.push('═══ PACK BRAINSTORM (pre-decided — anchor for Block 1 + Phase 1-2) ═══')
  lines.push('')

  // Angle + sub-variant
  lines.push(`Hook angle: ${brainstorm.chosenAngle}`)
  lines.push(`Guidance: ${ANGLE_GUIDANCE[brainstorm.chosenAngle]}`)
  const subSpec = getSubVariantSpec(brainstorm.chosenAngle, brainstorm.chosenSubVariant)
  if (subSpec) {
    lines.push(`Sub-variant: ${subSpec.id} (${subSpec.label}) — ${subSpec.hint}`)
  } else if (brainstorm.chosenSubVariant) {
    lines.push(`Sub-variant: ${brainstorm.chosenSubVariant}`)
  }
  lines.push('')

  // Top pain — Block 1 must hit this; full pain list is in synthesis brief.
  const topPain = brainstorm.painLadder[0]
  if (topPain) {
    lines.push(`Rank-1 pain (Block 1 hits this in first 2 sentences): [${topPain.lossType}] ${topPain.pain}`)
    lines.push('(Full pain list lives in PRODUCT ESSENCE / synthesis brief.)')
    lines.push('')
  }

  // Hook draft — Block 1 opening.
  // No more "VERBATIM LOCKED, ≤10% word change" escalation. The mode-conditional
  // system prompt now matches the angle naturally → Gemini doesn't drift soft
  // mid-Block-1. Just say "use this as the opening" and trust the alignment.
  lines.push('Hook draft (use as Block 1 opening):')
  lines.push('"""')
  lines.push(brainstorm.hookDraft)
  lines.push('"""')
  lines.push('')

  // Agitate beats — Phase 1-2 anchors (per-block assignment lives in user prompt).
  if (brainstorm.agitateBeats.length > 0) {
    lines.push('Agitate beats for Phase 1-2 blocks:')
    brainstorm.agitateBeats.forEach((b, i) => {
      lines.push(`  • Beat ${i + 1}: ${b}`)
    })
    lines.push('')
  }

  // Social proof persona seeds.
  if (brainstorm.socialProofPersonas.length > 0) {
    lines.push('Social-proof persona seeds (for proof-future-self / lifestyle blocks):')
    brainstorm.socialProofPersonas.forEach((p, i) => {
      lines.push(`  Persona ${i + 1}: ${p.label} — ${p.angle}`)
    })
    lines.push('')
  }

  if (brainstorm.rationale) {
    lines.push(`(Rationale — debug only: ${brainstorm.rationale})`)
  }

  lines.push('═══════════════════════════════════════════════════════════')
  return lines.join('\n')
}
