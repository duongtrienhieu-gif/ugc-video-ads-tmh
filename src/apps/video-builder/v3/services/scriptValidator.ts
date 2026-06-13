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
import {
  MS_CTA_LEVERS,
  MS_BODY_ANTI_PATTERNS,
  MS_SYMPTOM_BANS_INSTANT,
} from './bodyPatternsMs'
import { validateSemanticAnswer, type HookSemanticShape } from './hookSemanticBinder'

export interface ValidatorResult {
  ok: boolean
  failures: string[]
}

// ── VN spell-fix table (P3p-D) ──────────────────────────────────────────────
// Gemini occasionally mistypes common Vietnamese tones — the user audited
// "Hấu hết" twice across separate batches (should be "Hầu hết"). This is a
// SILENT post-gen replacement, not a validator failure: there's no
// architectural reason to retry just to fix a tone mark when we can correct
// it deterministically. Patterns are case-aware (capitalized + lowercase).
// P3u — `\b` doesn't work reliably across Vietnamese diacritics (the user audited
// "Hấu hết" slipping through). Drop the word-boundary anchor and rely on the
// fact that these typo strings are themselves distinctive enough that a substring
// match won't false-positive (no real Vietnamese word contains "hấu hết" or
// "bị mật" as a substring of something legitimate).
const VN_SPELL_FIXES: Array<[RegExp, string]> = [
  [/Hấu hết/g, 'Hầu hết'],
  [/hấu hết/g, 'hầu hết'],
  [/Bị mật/g, 'Bí mật'],
  [/bị mật/g, 'bí mật'],
  // Stray "tôi" → "mình" cleanup is NOT auto-done; that's the pronoun rule's job.
]

/** Silent VN spell fix. Returns the corrected string (or the original if no
 *  patterns matched). Used by scriptGenerator after the body parse, before the
 *  block reaches the user. Pure deterministic replacement — no LLM call. */
export function spellFixVi(text: string): string {
  let out = text
  for (const [pattern, replacement] of VN_SPELL_FIXES) {
    out = out.replace(pattern, replacement)
  }
  return out
}

// ── Tokenization helpers (VN-friendly) ───────────────────────────────────────

// VN stopword list + `meaningfulTokens` helper removed in P3r — the literal-reuse
// rule they powered was replaced by the semantic-answer rule in hookSemanticBinder.

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
  // P3p-E — hook length: the system prompt says "8-16 words, one breath" but
  // Gemini sometimes pushes to 20+ (the user audited a 21-word hook). 18 is
  // the hard ceiling — past that the viewer can't read it in 3 seconds and
  // the scroll-stop dies. Counts whitespace-separated tokens after stripping
  // punctuation; lenient enough to allow rojak ("worth it") without false-fail.
  const overlong = hooks
    .map((h, i) => ({ idx: i, words: normalize(h).split(' ').filter(Boolean).length, text: h }))
    .filter((h) => h.words > 18)
  if (overlong.length > 0) {
    const sample = overlong[0]
    failures.push(
      `${overlong.length} hook(s) exceed 18 words (a TikTok hook must read in under 3s). ` +
      `Hook #${sample.idx + 1} is ${sample.words} words: "${sample.text.slice(0, 70)}…". ` +
      `Tighten to 8-16 words — cut redundant adjectives and connectors.`,
    )
  }
  return { ok: failures.length === 0, failures }
}

// ── Body validator ───────────────────────────────────────────────────────────

const CTA_LEVER_KEYWORDS_VI = [
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

/** Pick the language-appropriate validator vocab. Falls back to VN if lang is
 *  unknown (the most curated, plus EN scripts often share VN sentiment words). */
function ctaLeversForLang(lang?: string): string[] {
  if (lang === 'ms' || lang === 'Bahasa Malaysia') return MS_CTA_LEVERS
  return CTA_LEVER_KEYWORDS_VI
}

/** Lang-specific body anti-patterns layered on top of the framework's bodyAntiPatterns.
 *  MS scripts can drift via different openers than VN, so we add the MS drift list. */
function extraBodyAntiPatternsForLang(lang?: string): string[] {
  if (lang === 'ms' || lang === 'Bahasa Malaysia') return MS_BODY_ANTI_PATTERNS
  return []
}

/** Lang-specific symptom bans layered on top of the framework's symptomBans.
 *  VN list lives in adStructures (Vietnamese); MS equivalents live in bodyPatternsMs.
 *  Both apply ONLY to INSTANT pain blocks (LEAD allows real symptoms). */
function extraSymptomBansForLang(lang?: string): string[] {
  if (lang === 'ms' || lang === 'Bahasa Malaysia') return MS_SYMPTOM_BANS_INSTANT
  return []
}

export interface BodyBlocks {
  hook: string
  pain: string
  discovery: string
  benefit: string
  cta: string
}

/** Validate a body against the chosen group's structure: symptom bans, hook
 *  literal reuse, banned openings, CTA lever. Each failure is a short English
 *  cue so the retry prompt can list them verbatim. Pass `lang` so MS / VN use
 *  the right keyword vocabulary; defaults to VN. */
export function validateBody(
  blocks: BodyBlocks,
  structure: AdStructureConfig,
  lang?: string,
  // P4j — resolved hook-answer shape (from the user's ScriptShape). Threaded into
  // the semantic-answer check so it matches what the body was instructed to do.
  shapeHint?: HookSemanticShape,
): ValidatorResult {
  const failures: string[] = []
  const ctaLevers = ctaLeversForLang(lang)
  const extraAntiPatterns = extraBodyAntiPatternsForLang(lang)
  const extraSymptomBans = extraSymptomBansForLang(lang)
  // Combine framework's bans with lang-specific equivalents. INSTANT MS adds
  // "sakit perut / penat / tak boleh tidur" on top of "đau dạ dày / mệt mỏi".
  const symptomBans = structure.symptomBans.length > 0
    ? [...structure.symptomBans, ...extraSymptomBans]
    : []
  const allAntiPatterns = [...structure.bodyAntiPatterns, ...extraAntiPatterns]
  const langCtaExample = lang === 'ms' || lang === 'Bahasa Malaysia'
    ? '"grab cepat kalau tak rugi", "stok terhad", "ramai dah cuba", "review padu"'
    : '"kẻo hết hàng", "sale hôm nay", "10k đã đặt", "đổi trả 30 ngày"'

  // 1. SYMPTOM BANS — INSTANT pain must not name a symptom.
  if (symptomBans.length > 0 && blocks.pain) {
    const painLower = blocks.pain.toLowerCase()
    const hit = symptomBans.find((s) => painLower.includes(s.toLowerCase()))
    if (hit) {
      failures.push(
        `Pain block mentions a banned symptom word ("${hit}"). The INSTANT group's pain ` +
        `block is a 1-sentence transition tied to the hook, NOT a symptom report. ` +
        `Remove this word and any other symptom in the symptomBans list.`,
      )
    }
  }

  // 2. HOOK SEMANTIC ANSWER (P3r — Hướng X) — replaces the P3i literal-reuse rule.
  // Detects what shape of hook this is (question / listicle / comparison / test) and
  // requires the body's first sentence to actually ANSWER it (not just share a noun).
  if (blocks.hook && blocks.pain) {
    const firstPain = firstSentence(blocks.pain)
    const semanticFailure = validateSemanticAnswer(blocks.hook, firstPain, lang, shapeHint)
    if (semanticFailure) failures.push(semanticFailure)
  }

  // 3. BANNED OPENINGS — no block may start with one of bodyAntiPatterns (per-framework + per-lang).
  for (const blockName of ['pain', 'discovery', 'benefit', 'cta'] as const) {
    const text = (blocks[blockName] ?? '').trim()
    if (!text) continue
    const opening = text.slice(0, 80).toLowerCase()
    const hit = allAntiPatterns.find((p) => opening.startsWith(p.toLowerCase()))
    if (hit) {
      failures.push(
        `Block "${blockName}" opens with banned phrase "${hit}…" (this is the WRONG ` +
        `group's default opening). Rewrite the first sentence with a different shape.`,
      )
    }
  }

  // 4. VN PRONOUN — when lang='vi', the body must use "mình" only ("tôi" reads
  //    formal and kills the voice-memo register on TikTok). The pronoun rule has
  //    been in the body prompt since P3l but Gemini occasionally slips a "Tôi"
  //    into pain or benefit; we catch it here so the retry has a chance.
  //    Authority-role context ("là bác sĩ / là bartender N năm") is allowed.
  if (lang === 'vi' || lang === 'Vietnamese') {
    const authorityCue = /\b(là (bác sĩ|bartender|chuyên gia|nhà nghiên cứu|kỹ sư|đầu bếp|dược sĩ)|làm (nghề|trong (ngành|nghề)))/i
    const allBody = `${blocks.pain ?? ''} ${blocks.discovery ?? ''} ${blocks.benefit ?? ''} ${blocks.cta ?? ''}`
    if (!authorityCue.test(allBody) && /(^|[^A-Za-zÀ-ỹ])[Tt]ôi[^A-Za-zÀ-ỹ]/.test(` ${allBody} `)) {
      failures.push(
        `Body uses "tôi" but the VN pronoun rule is "mình" only (TikTok voice-memo register). ` +
        `Replace every "tôi" with "mình" in the pain / discovery / benefit / cta blocks. ` +
        `("Tôi" is only allowed when the script opens with an explicit authority role such ` +
        `as "là bác sĩ" / "là bartender 8 năm".)`,
      )
    }
  }

  // 5. CTA LEVER — must contain at least one buying-lever keyword (lang-specific).
  if (blocks.cta) {
    const ctaLower = blocks.cta.toLowerCase()
    const hasLever = ctaLevers.some((k) => ctaLower.includes(k))
    if (!hasLever) {
      failures.push(
        `CTA has no buying lever (scarcity / urgency / social proof / risk reversal / ` +
        `offer). A flat "link bio" close doesn't convert. Add ONE concrete lever — ` +
        `e.g. ${langCtaExample}.`,
      )
    }
  }

  return { ok: failures.length === 0, failures }
}

// ── P4j — shape-execution validator ──────────────────────────────────────────
// validateBody checks symptom / CTA / banned-openings but NOT whether the body
// actually EXECUTES the chosen ScriptShape — so a "comparison" or "listicle"
// script could quietly collapse into the same narrative confession (the bug the
// user audited). This is a LENIENT structural check: it only fails when the shape
// is CLEARLY absent (no enumeration / no two-sides / no time progression), so it
// never burns a retry on a script that did follow the shape. Lang-aware (VN/MS).
export function validateShapeExecution(
  blocks: BodyBlocks,
  shape: string | undefined,
  lang?: string,
): ValidatorResult {
  const failures: string[] = []
  if (!shape || shape === 'narrative') return { ok: true, failures }
  const isMs = lang === 'ms' || lang === 'Bahasa Malaysia'
  const body = `${blocks.pain ?? ''} ${blocks.discovery ?? ''} ${blocks.benefit ?? ''}`.toLowerCase()

  if (shape === 'listicle') {
    const markers = isMs
      ? ['pertama', 'kedua', 'ketiga', 'nombor 1', 'nombor 2', 'sebab 1', 'sebab 2', 'yang pertama', 'yang kedua']
      : ['số 1', 'số 2', 'số 3', 'đầu tiên', 'thứ hai', 'thứ ba', 'tiếp theo', 'lý do 1', 'lý do 2', 'cuối cùng']
    const hits = markers.filter((m) => body.includes(m)).length
    if (hits < 2) failures.push(
      `SHAPE=LISTICLE but the body does not read as an enumerated list (need ≥2 of ` +
      `"số 1 / đầu tiên / thứ hai / tiếp theo…"). Rewrite discovery as explicit numbered ` +
      `reasons spoken back-to-back, not one flowing story.`,
    )
  } else if (shape === 'comparison') {
    const markers = isMs
      ? ['yang kiri', 'yang kanan', 'satu lagi', 'berbanding', ' vs ', 'manakala', 'sebelah', 'yang biasa']
      : ['bên trái', 'bên phải', 'so với', 'cái cũ', 'cái kia', 'cái này thì', 'còn cái', 'trong khi', 'một bên', 'loại thường', 'đối thủ']
    const hits = markers.filter((m) => body.includes(m)).length
    if (hits < 1) failures.push(
      `SHAPE=COMPARISON but the body never sets up the two sides (need a contrast like ` +
      `"bên trái/bên phải", "so với cái cũ", "còn cái kia…"). Rewrite discovery to test ` +
      `BOTH options side by side, then reveal the winner — do NOT tell one personal story.`,
    )
  } else if (shape === 'journey') {
    const re = isMs
      ? /(hari|minggu|bulan)\s*\d|day\s*\d|\d+\s*(hari|minggu|bulan|days?|weeks?)/i
      : /(ngày|tuần|tháng)\s*\d|day\s*\d|\d+\s*(ngày|tuần|tháng|days?|weeks?)/i
    const hasStamp = re.test(body)
      || /(ngày đầu|ngày cuối|hôm đầu|tuần đầu|hari pertama|hari terakhir)/i.test(body)
    if (!hasStamp) failures.push(
      `SHAPE=JOURNEY but the body has no time progression (need markers like "ngày 1 / ` +
      `ngày 3 / ngày 7" or "ngày đầu… đến ngày cuối"). Rewrite discovery as dated ` +
      `milestones across the journey, not one undated story.`,
    )
  }
  return { ok: failures.length === 0, failures }
}
