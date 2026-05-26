// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — PRODUCT DISSOLUTION PATTERNS (Chunk D)
//
// Lightweight sampling pool for HOW product info enters narrative
// naturally in Block 9 (natural-product-discovery). Counters narrator-
// expert vibe and "Sản phẩm chứa A, B, C" interruption.
//
// SCOPE: Block 9 ONLY. Block 10 has its own 3-beat structure (emotion
// → curiosity → understanding). DO NOT cross-pollinate.
//
// KEEP SMALL (4 patterns). Goal: believable human discovery texture,
// NOT giant emotional architecture taxonomy.
// ─────────────────────────────────────────────────────────────────────

export type DissolutionPosture =
  | 'retrospective-reading'   // "Mãi sau tôi mới đọc kỹ — hoá ra..."
  | 'friend-explained'        // "Bạn tôi giải thích — nó focus vào..."
  | 'body-as-witness'         // "Cơ thể tôi nhận ra trước tôi..."
  | 'single-thing-noticed'    // "Tôi chú ý đúng một điều..."

export interface DissolutionPattern {
  id: DissolutionPosture
  /** Structural posture — Gemini fills niche content. */
  frame: string
  /** 1 niche-mismatched example to teach SHAPE not verbatim. */
  exampleNicheMismatched: string
}

export const PRODUCT_DISSOLUTION_PATTERNS: DissolutionPattern[] = [
  {
    id: 'retrospective-reading',
    frame: '"Mãi sau tôi mới đọc kỹ — hoá ra [mechanism hint, no ingredient list]"',
    exampleNicheMismatched:
      '"Mãi sau tôi mới đọc kỹ — hoá ra nó không cố làm tóc mọc nhanh, mà focus vào nang tóc bên dưới."',
  },
  {
    id: 'friend-explained',
    frame:
      '"Bạn/người quen tôi giải thích — nó [single-axis mechanism], không phải [common assumption]"',
    exampleNicheMismatched:
      '"Bạn tôi giải thích — nó hỗ trợ da đầu, không phải thay nuôi sợi tóc như serum thông thường."',
  },
  {
    id: 'body-as-witness',
    frame:
      '"Cơ thể tôi nhận ra trước tôi — chỉ khi [felt change] tôi mới quay lại đọc [product]"',
    exampleNicheMismatched:
      '"Cơ thể tôi nhận ra trước tôi — chỉ khi tóc bám trên gối ít hẳn, tôi mới quay lại đọc bao bì."',
  },
  {
    id: 'single-thing-noticed',
    frame:
      '"Tôi chú ý đúng một điều — [single specific detail] — và đó là điểm khác"',
    exampleNicheMismatched:
      '"Tôi chú ý đúng một điều — nó nói \\"hỗ trợ chứ không kích thích\\" — và đó là điểm khác."',
  },
]

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 1 dissolution pattern per pack. */
export function sampleDissolutionPattern(seed: string): DissolutionPattern {
  const idx = hashSeed(`${seed}:dissolution`) % PRODUCT_DISSOLUTION_PATTERNS.length
  return PRODUCT_DISSOLUTION_PATTERNS[idx]
}

/** Compose dissolution brief for Block 9 prompt injection. */
export function dissolutionBrief(pattern: DissolutionPattern): string {
  return [
    `═══ PRODUCT DISSOLUTION (Block 9 ONLY — natural-product-discovery) ═══`,
    `Posture: ${pattern.id}`,
    `Frame: ${pattern.frame}`,
    `Shape example (NEVER copy verbatim — niche-mismatched):`,
    `  ${pattern.exampleNicheMismatched}`,
    ``,
    `⚠️ USE ONLY HERE (Block 9). Block 10 chuyển sang emotion→curiosity→understanding`,
    `   sequence — KHÔNG carry dissolution pattern sang Block 10.`,
    ``,
    `KHÔNG: ingredient list / pseudo-science authority / narrator-as-expert.`,
    `Product enters story qua narrator's HUMAN DISCOVERY texture, không announcement.`,
  ].join('\n')
}
