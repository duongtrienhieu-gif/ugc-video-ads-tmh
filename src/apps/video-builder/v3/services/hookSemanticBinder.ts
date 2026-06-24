// ── Hook Semantic Binder (P3r) ───────────────────────────────────────────────
// Replaces the LITERAL-REUSE rule from P3i ("first sentence of pain must reuse
// a noun/verb from the hook") with a SEMANTIC ANSWER rule:
//
//   - If the hook is a QUESTION, the body must ANSWER it within 2 sentences.
//   - If the hook is a STATEMENT-BOLD claim ("90% mọi người..."), the body must
//     EXPLAIN why the claim is true.
//   - If the hook is a LISTICLE opener ("3 lý do..."), the body must IMMEDIATELY
//     enter the list ("Lý do số 1...").
//   - If the hook is a CONFESSION ("Tôi từng..."), the body must CONTINUE the
//     first-person past story.
//   - If the hook is a COMPARISON ("A vs B" / "test so sánh"), the body must
//     IMMEDIATELY begin the test.
//   - Otherwise fall back to the gentler "thematic continuity" rule.
//
// The literal-reuse rule was forcing Gemini to stuff one of the hook's nouns
// into the pain opener, which works for confessions but breaks awkwardly for
// questions / lists / comparisons. Question hooks especially want an ANSWER,
// not a noun cameo.
//
// Also adds a fabricated-number detector that catches "740.000 hộp" / "90%
// người dùng" hallucinations when those numbers aren't in the product brief.
// ─────────────────────────────────────────────────────────────────────────────

export type HookSemanticShape =
  | 'question'      // ends with "?" or starts with "Bạn có / Tại sao / Có ai / Adakah / Kenapa"
  | 'listicle'      // mentions "N lý do / N reasons / N sebab" with a number
  | 'comparison'    // contains "vs / so sánh / compare / lawan / RM X vs RM Y"
  | 'confession'    // starts with "Mình từng / Tôi đã / Aku dulu / Aku ingat / Aku rugi"
  | 'claim_bold'    // starts with "Sự thật / 90% / Hầu hết / Sebenarnya / Memang ramai"
  | 'investigation' // "Tôi đã thử để chứng minh / Aku test 7 hari / Aku compare"
  | 'imperative'    // starts with "Đừng / Stop / Jangan / Cẩn thận / Eh wait"
  | 'general'       // default — gentler thematic-continuity rule

const QUESTION_OPENERS_RE = /^(bạn (có|đã|hay|sẽ|từng|có biết|có hay)|tại sao|có ai|có khi nào|adakah|kenapa|korang (pernah|tau|nampak)|awak (pernah|tau))/i
const LISTICLE_RE = /\b(\d+|hai|ba|bốn|năm|sáu|dua|tiga|empat|lima|enam)\s*(lý ?do|reasons?|sebab|hal)\b/i
const COMPARISON_RE = /\b(vs|versus|compare|lawan|so sánh|so với|side by side|test paling)\b|(rm\d+\s*vs\s*rm\d+)/i
const CONFESSION_OPENERS_RE = /^(mình từng|tôi đã|tôi từng|aku dulu|aku ingat|aku rugi|aku skeptikal|aku tak|aku pernah)/i
const CLAIM_BOLD_OPENERS_RE = /^(sự thật|hấu hết|hầu hết|\d{1,3}%|sebenarnya|memang ramai|ramai|kebanyakan)/i
const INVESTIGATION_RE = /\b(thử để chứng minh|test \d+ (ngày|hari|days?)|compare dua|aku test|tôi đã thử)\b/i
const IMPERATIVE_OPENERS_RE = /^(đừng|stop|jangan|cẩn thận|eh wait|hear me out|đợi đã|tunggu)/i

/** P4j — map the USER's explicitly-picked ScriptShape (Dạng kịch bản) to the
 *  matching hook-answer shape, so the body's opening anchor follows what the user
 *  CHOSE — not what a regex guesses from the hook text (which mis-fires, e.g.
 *  "So với…" hooks were read as 'general' and the body drifted into a confession).
 *  Returns null for 'narrative'/unknown → caller falls back to detectHookShape. */
export function scriptShapeToHookSemantic(shape: string | undefined): HookSemanticShape | null {
  switch (shape) {
    case 'listicle':   return 'listicle'
    case 'comparison': return 'comparison'
    case 'journey':    return 'investigation'   // a journey is "I tested over N days"
    default:           return null              // narrative / unknown → detect from hook
  }
}

/** Detect the semantic shape of a hook so the body prompt can inject the matching
 *  answer rule. Pure regex; no LLM. */
export function detectHookShape(hookText: string): HookSemanticShape {
  const t = hookText.trim().toLowerCase()
  if (LISTICLE_RE.test(t)) return 'listicle'
  if (COMPARISON_RE.test(t)) return 'comparison'
  if (INVESTIGATION_RE.test(t)) return 'investigation'
  if (t.endsWith('?') || QUESTION_OPENERS_RE.test(t)) return 'question'
  if (CONFESSION_OPENERS_RE.test(t)) return 'confession'
  if (CLAIM_BOLD_OPENERS_RE.test(t)) return 'claim_bold'
  if (IMPERATIVE_OPENERS_RE.test(t)) return 'imperative'
  return 'general'
}

/** Per-shape ANSWER rule injected into the body system prompt. Replaces the
 *  literal-reuse HARD CONTRACT from P3i. The body model now knows exactly what
 *  the hook is doing and what kind of opening sentence it owes. */
export function buildSemanticAnswerRule(shape: HookSemanticShape, hookText: string): string {
  const hook = hookText.trim()
  switch (shape) {
    case 'question':
      return (
        `*** HOOK SHAPE: QUESTION ***\n` +
        `The hook ASKS something ("${hook}"). The body's FIRST sentence MUST give a ` +
        `direct ANSWER to that question (open with "Bởi vì..." / "Vì..." / "Đó là vì..." / ` +
        `"Hoá ra..." in VN, "Sebab..." / "Sebabnya..." / "Rupanya..." in MS, or an equivalent ` +
        `direct answer). Do NOT pivot to an unrelated emotional opener like "Cứ thèm ăn vặt..." ` +
        `that ignores the question.`
      )
    case 'listicle':
      return (
        `*** HOOK SHAPE: LISTICLE (N reasons) ***\n` +
        `The hook promises N reasons / lý do / sebab ("${hook}"). The body's FIRST sentence ` +
        `MUST be the first list item: "Lý do số 1, ..." / "Đầu tiên là..." / "Sebab pertama, ..." ` +
        `/ "Yang pertama, ...". Do NOT open with a confession or emotional setup. The discovery ` +
        `block lists the remaining reasons.`
      )
    case 'comparison':
      return (
        `*** HOOK SHAPE: COMPARISON (A vs B) ***\n` +
        `The hook sets up a comparison ("${hook}"). The body's FIRST sentence MUST immediately ` +
        `start the comparison — either two named items ("Bên trái là X, bên phải là Y...", "Cái ` +
        `mắc 500k, cái rẻ 99k...", "Yang kiri RM200, yang kanan RM20...") OR the product vs a ` +
        `FAMILIAR alternative ("So với [cái quen thuộc / loại thường], cái này..."). Do NOT pivot ` +
        `to an emotional confession. The discovery block runs both sides of the test.`
      )
    case 'confession':
      return (
        `*** HOOK SHAPE: CONFESSION (first-person past) ***\n` +
        `The hook is a personal confession ("${hook}"). The body's FIRST sentence MUST ` +
        `CONTINUE the same first-person past story (e.g. open with the next beat of the ` +
        `confession, a concrete moment, what happened next). Keep the "mình / aku" voice. ` +
        `Do NOT switch to "Bạn có..." second-person address.`
      )
    case 'claim_bold':
      return (
        `*** HOOK SHAPE: BOLD CLAIM ***\n` +
        `The hook makes a strong claim ("${hook}"). The body's FIRST sentence MUST ` +
        `EXPLAIN WHY the claim is true (open with "Vì..." / "Bởi vì..." / "Lý do là..." / ` +
        `"Sebabnya..." / "Sebab..."). Do NOT switch to an unrelated emotional opener.`
      )
    case 'investigation':
      return (
        `*** HOOK SHAPE: INVESTIGATION / TEST (N-day journey) ***\n` +
        `The hook is "I tested over N days / I'll prove" ("${hook}"). The body's FIRST sentence opens on ` +
        `DAY 1 = the BASELINE you STARTED with — the PRE-EXISTING problem/symptom you still had at the ` +
        `start ("Ngày đầu, [vấn đề] vẫn còn…", "Hôm bắt đầu test, [vấn đề] vẫn…", "Day 1, [masalah] masih…"). ` +
        `CRITICAL: frame the symptom as the condition you CAME IN with — do NOT couple it with USING the ` +
        `product ("ngày đầu THỬ [sản phẩm] mà vẫn đau" reads as the product FAILING). The product is the ` +
        `thing you're testing to FIX it; its FIRST positive effect appears LATER (discovery, Day 3+). ` +
        `Do NOT detour to an unrelated opener.`
      )
    case 'imperative':
      return (
        `*** HOOK SHAPE: IMPERATIVE ***\n` +
        `The hook is a command ("${hook}"). The body's FIRST sentence MUST JUSTIFY the ` +
        `command (open with "Vì..." / "Lý do là..." / "Sebab..."). Do NOT pivot to a ` +
        `confession opener.`
      )
    case 'general':
    default:
      return (
        `*** HOOK SHAPE: GENERAL ***\n` +
        `The hook ("${hook}") sets a theme. The body's FIRST sentence MUST stay on that ` +
        `EXACT theme — pick up the same idea / object / moment / persona, do NOT switch ` +
        `subject. Match the hook's first-person voice (mình / aku) throughout.`
      )
  }
}

/** Detect whether the body's first sentence answers / continues the hook per its
 *  semantic shape. Returns ok=false with a feedback message when it doesn't. The
 *  shape decides what counts as a valid opening. */
const VN_ANSWER_OPENERS = ['vì', 'bởi vì', 'bởi', 'đó là vì', 'hoá ra', 'lý do', 'tại vì']
const MS_ANSWER_OPENERS = ['sebab', 'sebabnya', 'rupanya', 'kerana', 'puncanya']
const VN_LIST_OPENERS = ['lý do số 1', 'lý do 1', 'đầu tiên', 'thứ nhất', 'số 1', 'cái khiến mình mua đầu tiên', 'cái đầu tiên']
const MS_LIST_OPENERS = ['sebab pertama', 'pertama', 'sebab nombor satu', 'yang pertama', 'satu', 'nombor 1']
const VN_COMPARISON_OPENERS = ['bên trái', 'bên phải', 'cái mắc', 'cái rẻ', 'cái thứ nhất', 'cái thứ hai', 'side by side', 'so sánh']
const MS_COMPARISON_OPENERS = ['yang kiri', 'yang kanan', 'rm', 'side by side', 'satu side', 'aku compare', 'aku test']
const VN_TEST_OPENERS = ['ngày đầu', 'mình bắt đầu', 'ngày 1', 'mình thử', 'mình test', 'hôm đầu', 'tuần đầu']
const MS_TEST_OPENERS = ['day 1', 'hari pertama', 'aku mula', 'aku start', 'aku test', 'hari ke-1', 'minggu pertama']
// P5z3 (A) — the framework's GENERIC pain-template openers. When the hook sets a
// theme/claim/command (general/claim_bold/imperative) and the body bails to one of these,
// it has DRIFTED (ignored the hook) — the exact "lúc được lúc drift" the user audited.
// VN + MS. Matched against the punctuation-stripped, lowercased first sentence.
const GENERIC_PIVOT_OPENERS = [
  // VN
  'mình hay', 'mình thường', 'mình vốn', 'mình cứ', 'mình hay bị', 'mình là kiểu',
  'cứ mỗi lần', 'mỗi lần', 'mỗi khi', 'dạo này', 'dạo gần đây', 'gần đây',
  'bạn biết đấy', 'bạn biết đó', 'có những lúc', 'có những hôm', 'chả hiểu sao', 'không hiểu sao',
  // MS
  'aku selalu', 'aku slalu', 'selalu rasa', 'setiap kali', 'korang tau', 'korang pernah',
  'kebelakangan ni', 'akhir akhir ni', 'aku memang', 'aku jenis',
]

function lower(s: string): string { return s.toLowerCase().trim() }
function firstSentence(text: string): string {
  const m = text.trim().match(/^[^.!?…]+[.!?…]?/)
  return (m ? m[0] : text).trim()
}
function startsWithAny(opening: string, list: string[]): boolean {
  return list.some((p) => opening.startsWith(p))
}

/** Validate the body's first sentence against the detected hook shape. Returns
 *  null when ok; a feedback string when the body must be retried. */
export function validateSemanticAnswer(
  hookText: string,
  painFirstSentence: string,
  lang?: string,
  // P4j — when the user picked a ScriptShape, the caller passes the resolved
  // hook-answer shape so the check matches what the body was TOLD to do (not a
  // re-guess from the hook text that can disagree). Omit → detect from the hook.
  shapeHint?: HookSemanticShape,
): string | null {
  const shape = shapeHint ?? detectHookShape(hookText)
  const opening = lower(firstSentence(painFirstSentence)).replace(/[.,!?;:"'…–—]/g, ' ').replace(/\s+/g, ' ').trim()
  const isMs = lang === 'ms' || lang === 'Bahasa Malaysia'
  const answerOpeners = isMs ? MS_ANSWER_OPENERS : VN_ANSWER_OPENERS
  const listOpeners = isMs ? MS_LIST_OPENERS : VN_LIST_OPENERS
  const compOpeners = isMs ? MS_COMPARISON_OPENERS : VN_COMPARISON_OPENERS
  const testOpeners = isMs ? MS_TEST_OPENERS : VN_TEST_OPENERS

  if (shape === 'question' && !startsWithAny(opening, answerOpeners)) {
    return (
      `Hook is a QUESTION ("${hookText}") but the body's first sentence ("${painFirstSentence.slice(0, 70)}…") ` +
      `does NOT answer it. Open with "${answerOpeners.slice(0, 3).join('" / "')}…" and give a direct ANSWER, not a pivot.`
    )
  }
  if (shape === 'listicle' && !startsWithAny(opening, listOpeners)) {
    return (
      `Hook promises a LISTICLE ("${hookText}") but the body's first sentence ("${painFirstSentence.slice(0, 70)}…") ` +
      `does NOT enter the list. Open with "${listOpeners.slice(0, 3).join('" / "')}…" — the first list item.`
    )
  }
  if (shape === 'comparison' && !startsWithAny(opening, compOpeners)) {
    return (
      `Hook sets up a COMPARISON ("${hookText}") but the body's first sentence ("${painFirstSentence.slice(0, 70)}…") ` +
      `does NOT enter the test. Open with "${compOpeners.slice(0, 3).join('" / "')}…" and start the side-by-side.`
    )
  }
  if (shape === 'investigation' && !startsWithAny(opening, testOpeners)) {
    return (
      `Hook is a TEST / INVESTIGATION ("${hookText}") but the body's first sentence ("${painFirstSentence.slice(0, 70)}…") ` +
      `does NOT start the test. Open with "${testOpeners.slice(0, 3).join('" / "')}…" — the first day / first attempt.`
    )
  }
  // P5z3 (A) — general / claim_bold / imperative: the body owes the hook's theme/claim/
  // command. The one CLEAR, high-precision failure we can catch deterministically is the
  // body bailing to a GENERIC pain-template opener ("mình hay…", "mình vốn…", MS "aku
  // selalu…") that ignores the hook. Ban that. (confession is left to the LLM gate — a
  // first-person continuation legitimately varies and a strict opener doesn't fit.)
  if ((shape === 'general' || shape === 'claim_bold' || shape === 'imperative')
      && startsWithAny(opening, GENERIC_PIVOT_OPENERS)) {
    return (
      `The hook ("${hookText}") sets up a specific theme/claim, but the body's first sentence ` +
      `("${painFirstSentence.slice(0, 70)}…") bails to a GENERIC opener that ignores it. ` +
      `Sentence 1 MUST pay off the hook — pick up its EXACT subject / claim / curiosity ` +
      `(continue "${hookText.slice(0, 45)}…"), NOT a generic "${isMs ? 'aku selalu rasa…' : 'mình hay / mình vốn…'}".`
    )
  }
  return null
}

// ── Number fabrication detector (P3r) ────────────────────────────────────────
// The prompt rule (P3l) "do NOT invent statistics" only works prompt-side and
// Gemini still hallucinated "740.000 hộp" / "96% người dùng" across multiple
// test batches. This is a hard JS validator: any number-or-percent in a hook
// must appear in the product brief OR be a generic non-claim ("3 lý do" /
// "30 ngày" — those are RHETORICAL, not factual claims).
//
// Strategy: extract all numbers from the hook (including "740.000", "96%",
// "10k", "10.000"); for each, check the brief contains the same number (or
// "740k" / "740 nghìn" variants). If a number is absent → fail with a feedback
// hint to use a non-numeric angle.

const RHETORICAL_NUMBERS = new Set([
  '1', '2', '3', '4', '5', '6', '7', '10', '15', '30',     // generic counts ("3 lý do")
  // anecdotal first-person durations/quantities a real person says in a WOW hook
  // ("3 năm berdengung", "14 hari challenge", "2 titik") — NOT fabricated stats.
  '8', '9', '12', '14', '20', '21', '28',
])

/** Normalize a number string: "740.000" → "740000", "96%" → "96", "10k" → "10000". */
function normalizeNumber(raw: string): string {
  let s = raw.replace(/[%.,]/g, '')
  s = s.replace(/k$/i, '000')
  s = s.replace(/^0+/, '') || '0'
  return s
}

/** Extract every numeric token a viewer would hear as a factual claim. Skips
 *  pure-rhetorical small counts ("3 lý do" / "30 ngày challenge"). */
function extractFactualNumbers(text: string): string[] {
  const matches = text.match(/\b\d[\d.,]*\s*%?k?\b/gi) ?? []
  const out: string[] = []
  for (const raw of matches) {
    const norm = normalizeNumber(raw.trim())
    if (RHETORICAL_NUMBERS.has(norm)) continue
    out.push(norm)
  }
  return out
}

/** Check whether a candidate number appears in the brief in any common form. */
function briefContainsNumber(briefLower: string, normalized: string): boolean {
  if (briefLower.includes(normalized)) return true
  // 740000 → also accept "740.000", "740,000", "740 000", "740k", "740 nghìn", "740 ribu"
  const len = normalized.length
  if (len >= 4) {
    const head = normalized.slice(0, -3)
    const variants = [
      `${head}.000`, `${head},000`, `${head} 000`, `${head}k`, `${head}.nghìn`,
      `${head} nghìn`, `${head} ribu`, `${head} ngàn`,
    ]
    for (const v of variants) if (briefLower.includes(v.toLowerCase())) return true
  }
  return false
}

/** Returns null when ok; a feedback string when the hook contains a number that
 *  the brief doesn't back up (so the next retry can swap to a non-numeric hook). */
export function validateNumbersInHook(hookText: string, productPitch: string): string | null {
  const briefLower = productPitch.toLowerCase()
  const nums = extractFactualNumbers(hookText)
  for (const n of nums) {
    if (!briefContainsNumber(briefLower, n)) {
      return (
        `Hook cites a number ("${n}") that does NOT appear in the product brief. ` +
        `Do NOT invent statistics. Either: (a) remove the number and use a non-numeric tension ` +
        `(insider / contrarian / personal stake), or (b) replace it with a number that's literally ` +
        `in the brief.`
      )
    }
  }
  return null
}
