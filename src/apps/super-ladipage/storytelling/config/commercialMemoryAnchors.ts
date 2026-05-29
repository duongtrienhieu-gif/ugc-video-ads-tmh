// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — COMMERCIAL MEMORY ANCHORS (Chunk C2)
//
// Sampling pool 8 anchor patterns — SHARP single-phrase memorable
// differentiator that reader carries away after closing the page.
//
// Current problem: reader exits with emotional impression but FORGETS
//   - product
//   - mechanism
//   - reason to buy
//
// Fix: 1 SHARP anchor per pack, STATED in Block 10 (why-this-felt-different)
// as the ONE differentiator. ECHOED lightly in Block 12 or 14 — callback,
// not repeat — so memory locks.
//
// Reader should remember:
//   "À đúng rồi, cái này khác ở chỗ [X]"
// NOT:
//   "một bài chữa lành khá hay"
//
// Architecture rule: anchor is SHAPED frame (sampled per pack), CONTENT
// filled by Gemini per niche. Niche-mismatched examples to prevent
// verbatim copy.
// ─────────────────────────────────────────────────────────────────────

export type AnchorPosture =
  | 'comparison-anchor'   // "Cái khác là X" — direct differentiation
  | 'mechanism-anchor'    // "Không phải X mà là Y" — mechanism reframe
  | 'insight-anchor'      // "Hoá ra suốt thời gian qua tôi đặt sai câu hỏi"
  | 'process-anchor'      // "Không [old action] — không [old action] — chỉ [new]"

export interface MemoryAnchorPattern {
  id: string
  posture: AnchorPosture
  /** Structural frame — niche fills in concrete. */
  frame: string
  /** Niche-mismatched example to teach SHAPE not verbatim copy. */
  exampleNicheMismatched: string
  /** When to inject — Block 10 always, plus echo block. */
  echoBlock: 'micro-transformation' | 'emotional-wins' | 'social-proof'
}

export const COMMERCIAL_MEMORY_ANCHORS: MemoryAnchorPattern[] = [
  {
    id: 'difference-locked',
    posture: 'comparison-anchor',
    frame: '"Cái khác là [single-axis mechanism point — NOT feature list]"',
    exampleNicheMismatched:
      '"Cái khác là nó focus vào nang tóc — không phải sợi tóc."',
    echoBlock: 'micro-transformation',
  },
  {
    id: 'not-X-but-Y',
    posture: 'mechanism-anchor',
    frame: '"Không phải [common-expectation-X], mà là [actual-mechanism-Y]"',
    exampleNicheMismatched:
      '"Không phải kích thích mọc nhanh, mà là giữ tóc khỏi rụng tiếp."',
    echoBlock: 'emotional-wins',
  },
  {
    id: 'wrong-question',
    posture: 'insight-anchor',
    frame:
      '"Hoá ra suốt thời gian qua tôi đặt sai câu hỏi — [old-question vs new-question]"',
    exampleNicheMismatched:
      '"Tôi luôn hỏi làm sao tóc mọc lại — chứ không phải làm sao tóc khỏi rụng tiếp."',
    echoBlock: 'micro-transformation',
  },
  {
    id: 'process-negation',
    posture: 'process-anchor',
    frame:
      '"Không [old action 1] — không [old action 2] — chỉ [single new approach]"',
    exampleNicheMismatched:
      '"Không kích — không che — chỉ làm môi trường nang ổn định lại."',
    echoBlock: 'emotional-wins',
  },
  {
    id: 'surface-vs-underneath',
    posture: 'mechanism-anchor',
    frame:
      '"Trước, mọi thứ tôi thử đều làm [surface]. Cái này focus [underneath]"',
    exampleNicheMismatched:
      '"Trước, tôi cố làm sợi tóc khỏe. Cái này focus da đầu bên dưới."',
    echoBlock: 'micro-transformation',
  },
  {
    id: 'cause-not-symptom',
    posture: 'insight-anchor',
    frame:
      '"Cái [symptom-Y] không phải vấn đề — [root-X] mới là vấn đề"',
    exampleNicheMismatched:
      '"Cái rụng tóc không phải vấn đề — nang tóc yếu mới là vấn đề."',
    echoBlock: 'emotional-wins',
  },
  {
    id: 'not-fix-but-allow',
    posture: 'process-anchor',
    frame:
      '"Không phải fix — là cho cơ thể đủ [resource] để TỰ làm việc của mình"',
    exampleNicheMismatched:
      '"Không phải làm tóc mọc nhanh — là cho da đầu đủ thứ để TỰ giữ tóc lại."',
    echoBlock: 'social-proof',
  },
  {
    id: 'questioned-default',
    posture: 'insight-anchor',
    frame:
      '"Tôi luôn nghĩ [old-assumption] — hoá ra [new-realization]"',
    exampleNicheMismatched:
      '"Tôi luôn nghĩ tuổi này thì tóc rụng là tự nhiên — hoá ra không phải tuổi, là nang tóc đang thiếu."',
    echoBlock: 'micro-transformation',
  },
]

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 1 anchor pattern per pack — deterministic. */
export function sampleMemoryAnchor(seed: string): MemoryAnchorPattern {
  const idx = hashSeed(`${seed}:memoryAnchor`) % COMMERCIAL_MEMORY_ANCHORS.length
  return COMMERCIAL_MEMORY_ANCHORS[idx]
}

/** Compose anchor brief for prompt injection. */
export function memoryAnchorBrief(anchor: MemoryAnchorPattern): string {
  return [
    `═══ COMMERCIAL MEMORY ANCHOR (sampled this pack) ═══`,
    `Posture: ${anchor.posture}`,
    `Anchor frame: ${anchor.frame}`,
    `Shape example (NEVER copy verbatim — niche-mismatched):`,
    `  ${anchor.exampleNicheMismatched}`,
    ``,
    `INJECTION RULES:`,
    `- Block 10 "why-this-felt-different": STATE the anchor as the SHARP differentiator.`,
    `  This is the ONE phrase reader will remember. Generate niche-fit version.`,
    `- Block "${anchor.echoBlock}": ECHO the anchor lightly (callback, NOT repeat).`,
    `  Reader recognizes the differentiator returning — locks memory.`,
    ``,
    `KHÔNG: ingredient list, feature comparison, hard table, "vs sản phẩm khác".`,
    `Anchor is EMOTIONAL POSITIONING, not feature description.`,
  ].join('\n')
}
