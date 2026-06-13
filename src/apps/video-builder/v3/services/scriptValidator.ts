// ── Script Validator (P3k) ───────────────────────────────────────────────────
// JS post-generation layer (NOT a prompt) that catches the failure modes Gemini
// slips through despite the rules in scriptGenerator's system prompt:
//
//   • Hook batch where 4-6 hooks share the same opening / closing clause.
//   • Pain block of an INSTANT script that sneaks in a symptom word
//     ("đau dạ dày", "mệt mỏi", "khó tập trung", …) — the exact drift the
//     user audited.
//   • Pain block whose first sentence skips literal key-word reuse from the hook
//     (the "Mình cũng vậy á" tone shift the user noticed).
//   • Any block opening with one of the framework's banned phrases.
//   • CTA without a buying lever (scarcity / urgency / social proof / risk reversal).
//
// scriptGenerator calls these AFTER the first Gemini call. If a check fails, it
// makes ONE retry with a short feedback line listing the failures — NOT a fresh
// full prompt — so we don't stack prompt layers.
// ─────────────────────────────────────────────────────────────────────────────

import type { AdStructureConfig } from './adStructures'

export interface ValidatorResult {
  ok: boolean
  failures: string[]
}

// ── Tokenization helpers (VN-friendly) ───────────────────────────────────────

const STOPWORDS_VI = new Set([
  'là', 'và', 'của', 'với', 'cho', 'này', 'kia', 'ấy', 'tôi', 'mình',
  'bạn', 'đó', 'đây', 'thì', 'mà', 'ơi', 'á', 'nha', 'nhé', 'rồi',
  'cũng', 'còn', 'vẫn', 'lại', 'đã', 'đang', 'sẽ', 'có', 'không',
  'một', 'cái', 'thằng', 'con', 'mấy', 'như', 'để', 'từ', 'đến', 'tới',
  'trong', 'ngoài', 'trên', 'dưới', 'khi', 'mỗi', 'mọi', 'nhiều', 'ít',
  'rất', 'lắm', 'quá', 'hơn', 'kém', 'nữa', 'thôi', 'luôn', 'mới',
])

/** Tokenize a Vietnamese (or generic Latin) string into lowercase words longer
 *  than 3 chars, with stopwords filtered out. Returns a SET for cheap lookup. */
function meaningfulTokens(text: string): Set<string> {
  const cleaned = text.toLowerCase().replace(/[.,!?;:"'…–—()/]/g, ' ').trim()
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 3 && !STOPWORDS_VI.has(t))
  return new Set(tokens)
}

/** Lowercase normalized form for opening/closing comparison. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:"'…–—()]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** First N words of a string, normalized + joined by space — used to compare hook openings. */
function firstWords(s: string, n: number): string {
  return normalize(s).split(' ').slice(0, n).join(' ')
}

/** Last N words of a string — used to compare hook closings. */
function lastWords(s: string, n: number): string {
  const words = normalize(s).split(' ')
  return words.slice(Math.max(0, words.length - n)).join(' ')
}

/** First sentence of a block (split on . ! ?). Whitespace-trimmed. */
function firstSentence(block: string): string {
  const match = block.trim().match(/^[^.!?]+[.!?]?/)
  return (match ? match[0] : block).trim()
}

// ── Hook validator ───────────────────────────────────────────────────────────

/** Check the 6-hook batch for the diversity contract: at least 5 unique openings
 *  and at least 5 unique closings (we allow ONE collision so the model has wiggle
 *  room; the hard fail is 4-or-fewer unique = the lazy template-copy mode). */
export function validateHooks(hooks: string[]): ValidatorResult {
  const failures: string[] = []
  if (hooks.length < 4) {
    failures.push(`Chỉ có ${hooks.length} hook (cần ≥4 để check).`)
    return { ok: false, failures }
  }
  const openings = hooks.map((h) => firstWords(h, 3))
  const closings = hooks.map((h) => lastWords(h, 4))
  const uniqueOpenings = new Set(openings).size
  const uniqueClosings = new Set(closings).size
  if (uniqueOpenings < hooks.length - 1) {
    failures.push(
      `${hooks.length - uniqueOpenings + 1} hooks share the same opening words ` +
      `(e.g. "${openings.filter((o, i) => openings.indexOf(o) !== i)[0] ?? ''}…"). ` +
      `Each hook needs a DIFFERENT first 3 words.`,
    )
  }
  if (uniqueClosings < hooks.length - 1) {
    failures.push(
      `${hooks.length - uniqueClosings + 1} hooks share the same closing clause ` +
      `(e.g. "…${closings.filter((c, i) => closings.indexOf(c) !== i)[0] ?? ''}"). ` +
      `Each hook needs a DIFFERENT closing.`,
    )
  }
  return { ok: failures.length === 0, failures }
}

// ── Body validator ───────────────────────────────────────────────────────────

const CTA_LEVER_KEYWORDS = [
  // SCARCITY
  'hết hàng', 'sắp hết', 'còn vài', 'còn ít', 'cuối tuần', 'duy nhất', 'số lượng',
  // URGENCY
  'hốt lẹ', 'nhanh tay', 'mau lên', '24h', 'hôm nay', 'liền',
  'kẻo', 'kẹo lỡ', 'kẻo lỡ', 'kịp',
  // SOCIAL PROOF
  'người đặt', 'đã thử', 'đã mua', 'review', 'đánh giá', '5 sao',
  'quay lại', 'mua lại', 'cộng đồng', 'ai dùng rồi',
  // RISK REVERSAL
  'đổi trả', 'hoàn tiền', 'bảo hành', 'không thích', 'dùng thử',
  // OFFER (deal itself is also a lever)
  'mua 1 tặng', 'sale', 'giảm', 'tặng', 'free ship', 'miễn phí', 'voucher',
]

export interface BodyBlocks {
  hook: string
  pain: string
  discovery: string
  benefit: string
  cta: string
}

/** Validate a body against the chosen group's structure: symptom bans, hook
 *  literal reuse, banned openings, CTA lever. Each failure is a short English
 *  cue so the retry prompt can list them verbatim. */
export function validateBody(
  blocks: BodyBlocks,
  structure: AdStructureConfig,
): ValidatorResult {
  const failures: string[] = []

  // 1. SYMPTOM BANS — INSTANT pain must not name a symptom.
  if (structure.symptomBans.length > 0 && blocks.pain) {
    const painLower = blocks.pain.toLowerCase()
    const hit = structure.symptomBans.find((s) => painLower.includes(s.toLowerCase()))
    if (hit) {
      failures.push(
        `Pain block mentions a banned symptom word ("${hit}"). The INSTANT group's pain ` +
        `block is a 1-sentence transition tied to the hook, NOT a symptom report. ` +
        `Remove this word and any other symptom in the symptomBans list.`,
      )
    }
  }

  // 2. HOOK LITERAL REUSE — first sentence of pain must reuse ≥1 meaningful token from hook.
  if (blocks.hook && blocks.pain) {
    const hookTokens = meaningfulTokens(blocks.hook)
    const firstPain = firstSentence(blocks.pain)
    const painFirstTokens = meaningfulTokens(firstPain)
    const overlap = [...hookTokens].filter((t) => painFirstTokens.has(t))
    if (hookTokens.size > 0 && overlap.length === 0) {
      failures.push(
        `First sentence of pain ("${firstPain.slice(0, 60)}…") does NOT reuse any key ` +
        `word from the hook. Pull at least ONE concrete noun/verb (≥4 chars) from the ` +
        `hook into the first sentence of pain. Hook tokens to choose from: ` +
        `${[...hookTokens].slice(0, 6).join(', ')}.`,
      )
    }
  }

  // 3. BANNED OPENINGS — no block may start with one of bodyAntiPatterns.
  for (const blockName of ['pain', 'discovery', 'benefit', 'cta'] as const) {
    const text = (blocks[blockName] ?? '').trim()
    if (!text) continue
    const opening = text.slice(0, 80).toLowerCase()
    const hit = structure.bodyAntiPatterns.find((p) => opening.startsWith(p.toLowerCase()))
    if (hit) {
      failures.push(
        `Block "${blockName}" opens with banned phrase "${hit}…" (this is the WRONG ` +
        `group's default opening). Rewrite the first sentence with a different shape.`,
      )
    }
  }

  // 4. CTA LEVER — must contain at least one buying-lever keyword.
  if (blocks.cta) {
    const ctaLower = blocks.cta.toLowerCase()
    const hasLever = CTA_LEVER_KEYWORDS.some((k) => ctaLower.includes(k))
    if (!hasLever) {
      failures.push(
        `CTA has no buying lever (scarcity / urgency / social proof / risk reversal / ` +
        `offer). A flat "Mua tại link bio" doesn't convert. Add ONE concrete lever — ` +
        `e.g. "kẻo hết hàng", "sale hôm nay", "10k đã đặt", "đổi trả 30 ngày".`,
      )
    }
  }

  return { ok: failures.length === 0, failures }
}
