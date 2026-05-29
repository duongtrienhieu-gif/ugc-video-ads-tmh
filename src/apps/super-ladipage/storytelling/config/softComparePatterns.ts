// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — SOFT COMPARE PATTERNS (Chunk D, lightweight)
//
// 3 lightweight compare archetypes for Block 11 (soft-mechanism-compare,
// optional). Emotional positioning compare — NEVER hard tables / vs /
// brand-name comparison / ingredient table.
//
// SMALL on purpose. Risk of giant compare taxonomy: "technically smart
// output but emotionally synthetic." Keep human, subtle.
//
// SCOPE: Block 11 ONLY (when optional block fires per niche/intensity).
// ─────────────────────────────────────────────────────────────────────

export type ComparePosture =
  | 'before-now-feeling'      // before [X feeling], now [Y feeling]
  | 'quick-fix-vs-stable'     // đỡ nhanh rồi quay lại vs đỡ chậm không quay lại
  | 'symptom-vs-relief'       // đếm số lần [symptom] vs đếm ngày [feeling]

export interface ComparePattern {
  id: ComparePosture
  /** 2-sentence structural frame for compare. */
  frame: string
  /** 1 niche-mismatched example. */
  exampleNicheMismatched: string
}

export const SOFT_COMPARE_PATTERNS: ComparePattern[] = [
  {
    id: 'before-now-feeling',
    frame:
      '"Trước, tôi [old feeling/action]. Bây giờ tôi [new feeling/non-action] — và cảm giác khác hẳn."',
    exampleNicheMismatched:
      '"Trước, tôi luôn lo phải gội đầu xong sẽ thấy bao nhiêu tóc trong cống. Bây giờ tôi không đếm nữa — và cảm giác nhẹ hơn rất nhiều."',
  },
  {
    id: 'quick-fix-vs-stable',
    frame:
      '"Mọi thứ trước đó làm tôi đỡ nhanh rồi quay lại điểm cũ. Cái này đỡ chậm hơn — mà không quay lại."',
    exampleNicheMismatched:
      '"Serum trước làm tóc nhìn dày hơn ngay tuần đầu rồi tệ đi. Cái này không có \\"wow\\" ban đầu — chỉ là 3 tháng sau nhìn lại thấy khác."',
  },
  {
    id: 'symptom-vs-relief',
    frame:
      '"Trước, tôi đếm số [symptom]. Bây giờ tôi đếm số ngày [feeling positive]."',
    exampleNicheMismatched:
      '"Trước, tôi đếm số sợi tóc rụng mỗi sáng. Bây giờ tôi đếm số ngày không phải nghĩ tới chuyện đó."',
  },
]

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 1 compare pattern per pack. */
export function sampleComparePattern(seed: string): ComparePattern {
  const idx = hashSeed(`${seed}:softCompare`) % SOFT_COMPARE_PATTERNS.length
  return SOFT_COMPARE_PATTERNS[idx]
}

/** Compose compare brief for Block 11 prompt injection. */
export function softCompareBrief(pattern: ComparePattern): string {
  return [
    `═══ SOFT COMPARE (Block 11 ONLY — soft-mechanism-compare) ═══`,
    `Posture: ${pattern.id}`,
    `Frame: ${pattern.frame}`,
    `Shape example (NEVER copy verbatim — niche-mismatched):`,
    `  ${pattern.exampleNicheMismatched}`,
    ``,
    `Soft emotional positioning. Subtle. Human.`,
    `KHÔNG: hard table / "vs sản phẩm X" / brand-name comparison /`,
    `       "ưu điểm vượt trội" / "công thức tiên tiến" / ingredient-vs-ingredient.`,
  ].join('\n')
}
