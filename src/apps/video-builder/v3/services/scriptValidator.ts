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
  MS_BLACKLIST_INDO,
} from './bodyPatternsMs'

// Indonesian-dialect words that instantly mark an MS script as fake. Built once
// from MS_BLACKLIST_INDO with \b…\b boundaries so 'aja' can't trip 'saja' and
// 'udah' can't trip 'sudah'. Only consulted when lang='ms'.
const MS_INDO_BLACKLIST_RE = new RegExp(
  `\\b(${MS_BLACKLIST_INDO.join('|')})\\b`,
  'i',
)
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

// ── HARD price strip (user rule: CTA/script NEVER speaks a price) ─────────────
// The prompt nudge ("don't say a price") is unreliable — the model still emits
// "RM59 je", "chỉ 99k", "tak payah bayar sampai RM138", "giảm 50%". This is a
// DETERMINISTIC post-gen strip that removes money amounts + discount-% while
// KEEPING the offer NAME ("mua 1 tặng 1" / "Beli 1 Percuma 1" — no number) and the
// FOMO. Currency-anchored (RM / $ / đồng / đ / vnđ / "giá|harga" + N | discount %)
// so it never touches "10k người" (social proof), "UMF 10+", "B12", "20000mAh",
// "5 sao", "96%" stats. VN + MS + EN.
export function stripMoney(text: string): string {
  let out = text
  const LEAD = '(?:(?:ch[ỉi]|cuma|hanya|gi[áa]|harga|c[òo]n|sekarang ni|từ|dari|from|just|only)\\s+)*'
  const END = '(?=$|[\\s,.!?…;:)])'
  // (replace with a SPACE, not '', so two words never fuse — cleanup collapses spaces after)
  // 1. "no need to pay up to RM###" / "thay vì 138k" style price-compare clauses
  out = out.replace(/,?\s*(?:tak payah bayar(?:\s+sampai)?|tak perlu bayar(?:\s+sampai)?|thay vì(?:\s+tới| đến)?|instead of)\s*(?:RM|rm|\$|₫)?\s?\d[\d.,]*\s?(?:k|ribu|rb|nghìn|ngàn|đồng|đ|vnđ)?/gi, ' ')
  // 2. RM / $ / ₫ amounts — currency on EITHER side ("RM59" or "149 RM") + optional lead +
  //    optional trailing unit/filler ("je / sahaja / lận / thôi / lebih").
  out = out.replace(new RegExp(`,?\\s*${LEAD}(?:(?:RM|rm|\\$|₫)\\s?\\d[\\d.,]*|\\d[\\d.,]*\\s?(?:RM|rm))\\s?(?:k|ribu|rb|je|sahaja|saja|l[ậa]n|th[ôo]i|lebih)?`, 'gi'), ' ')
  // 3. "N đồng / N đ / N vnđ" — đồng is ALWAYS currency (lead optional). Lookahead end
  //    (NOT \b — \b is unreliable after the non-ASCII "đ").
  out = out.replace(new RegExp(`,?\\s*${LEAD}\\d[\\d.,]*\\s?(?:đồng|vnđ|đ)${END}`, 'gi'), ' ')
  // 4. "N k / N nghìn / N ngàn" ONLY with a price LEAD (so "10k người" / "mấy ngàn người"
  //    social-proof counts are NEVER stripped — they have no chỉ/giá/còn lead).
  out = out.replace(/,?\s*(?:ch[ỉi]|cuma|hanya|gi[áa]|harga|c[òo]n)\s+\d[\d.,]*\s?(?:k|nghìn|ngàn)(?:\s?th[ôo]i)?(?=$|[\s,.!?…;:)])/gi, ' ')
  // 5. Discount percent ONLY in a discount context (keep "96%" stats, "5 sao")
  out = out.replace(/,?\s*(?:giảm|diskaun|sale|tiết kiệm|hemat|off)\s*-?\s*\d+\s?%|,?\s*-\s?\d+\s?%(?:\s?(?:off|giảm|discount))?/gi, ' ')
  // cleanup leftover punctuation / double spaces / dangling connectors
  out = out
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?…])/g, '$1')
    .replace(/([,.!?…])\s*\1+/g, '$1')
    .replace(/,\s*([.!?…])/g, '$1')
    .replace(/([.!?…]\s*),\s*/g, '$1')
    .replace(/\s+,/g, ',')
    .replace(/^[\s,;–-]+/, '')
    .trim()
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

  // 6. MS INDO-DIALECT BLACKLIST — when lang='ms', an Indonesian word (banget /
  //    nggak / kalian / aja …) instantly outs the script as non-Malaysian and
  //    kills the native feel. Hard-ban (these are wrong-dialect facts, not style),
  //    word-boundary matched so 'saja'/'sudah' don't false-trip.
  if (lang === 'ms' || lang === 'Bahasa Malaysia') {
    // body blocks only (hook is user-picked + not regenerated on retry).
    const allBody = `${blocks.pain ?? ''} ${blocks.discovery ?? ''} ${blocks.benefit ?? ''} ${blocks.cta ?? ''}`
    const m = allBody.match(MS_INDO_BLACKLIST_RE)
    if (m) {
      failures.push(
        `Script uses the Indonesian word "${m[1]}" — Malaysians spot this instantly as ` +
        `fake/non-local. Replace with the Malay equivalent (tak, korang, je, dah, penat, ` +
        `etc.) and remove any other Indonesian-dialect words.`,
      )
    }
  }

  // 7. SOURCE-LANGUAGE LEAK — the product brief is written in Vietnamese, so a
  //    non-VN script (ms / en) must NOT contain Vietnamese words. A Vietnamese-only
  //    diacritic (ă â ê ô ơ ư đ + tone marks) is a sure sign a brief word leaked
  //    through untranslated — most often the product NAME ("tỏi", "mùi tây"). This
  //    is a binary correctness check (wrong-language word present), not a style call.
  if (lang && lang !== 'vi' && lang !== 'Vietnamese') {
    const allBody = `${blocks.pain ?? ''} ${blocks.discovery ?? ''} ${blocks.benefit ?? ''} ${blocks.cta ?? ''}`
    const leak = allBody.match(/\S*[ăâêôơưđàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]\S*/i)
    if (leak) {
      failures.push(
        `Vietnamese word "${leak[0]}" leaked into a non-Vietnamese script — the brief is ` +
        `Vietnamese but the script must be 100% in the target language. Translate it (e.g. ` +
        `"tỏi"→"bawang putih"/"garlic", "mùi tây"→"pasli"/"parsley") and remove EVERY ` +
        `Vietnamese word, especially in the product name.`,
      )
    }
  }

  // 8. SOCIAL-PROOF CROWD BEAT (P5w) — the script must carry ONE explicit herd/crowd
  //    proof line (popularity / sold-out / repeat buyers / reviews) so the video can
  //    render the on-screen social-proof CARD the user asked for. LENIENT: a broad
  //    cross-language cue list, checked on the PROOF stretch (discovery+benefit+cta,
  //    NOT the hook), so it only fails when a crowd beat is genuinely absent — a soft
  //    personal aside ("nhỏ bạn mình cũng mê") deliberately does NOT satisfy it. One
  //    retry max (wired via scriptGenerator's existing validateBody retry).
  {
    // PLACEMENT-AWARE: the crowd beat must live in the DISCOVERY/BENEFIT proof stretch
    // (so the director cards it). A crowd line stranded in the CTA is wasted — a card
    // can't be the closing buy-shot (brollDirector demotes a social_proof on the last
    // cut). So we check the proof stretch and the cta SEPARATELY.
    const proofStretch = `${blocks.discovery ?? ''} ${blocks.benefit ?? ''}`.toLowerCase()
    const ctaOnly = (blocks.cta ?? '').toLowerCase()
    const inProof = SOCIAL_PROOF_CUE_RE.test(proofStretch)
    const inCta = SOCIAL_PROOF_CUE_RE.test(ctaOnly)
    const ex = lang === 'ms' || lang === 'Bahasa Malaysia'
      ? '"ramai dah beli", "laku keras", "ulasan 5 bintang", "ramai repeat order"'
      : '"mấy nghìn người mua rồi", "bán cháy hàng mấy đợt", "ai mua cũng quay lại đặt thêm", "review toàn 5 sao"'
    if (!inProof && !inCta) {
      failures.push(
        `No explicit SOCIAL-PROOF crowd beat in the body — the video needs ONE clear ` +
        `WIDER-PUBLIC herd line (popularity / sold-out / repeat buyers / reviews) to render ` +
        `the proof card. A soft personal aside or a family-only line ("nhỏ bạn mình cũng mê", ` +
        `"cả nhà ai cũng khen") does NOT count. Add ONE standalone crowd line in the ` +
        `discovery/benefit proof stretch — e.g. ${ex}. Plausible vibe is fine; do NOT invent ` +
        `a fake exact number or a certification.`,
      )
    } else if (!inProof && inCta) {
      // present but mis-placed — move it earlier so it can become the on-screen card.
      failures.push(
        `The SOCIAL-PROOF crowd beat is stuck in the CTA (the closing buy line) — it can't ` +
        `become the on-screen proof card there. Move ONE crowd line (e.g. ${ex}) UP into the ` +
        `discovery/benefit proof stretch, BEFORE the CTA; keep the CTA for the offer + buy push.`,
      )
    }
  }

  // 9. FOREIGN-MARKET DRIFT (P5z5) — the script must NOT cite a foreign country/market
  //    that doesn't match its own output language (the "mấy nghìn người bên Malaysia" in a
  //    Vietnamese ad bug). Own market is exempt (VN→Việt Nam, MS→Malaysia). Catches a place
  //    name used as crowd/origin; the fix is to drop the country, not the popularity.
  {
    const allBody = `${blocks.pain ?? ''} ${blocks.discovery ?? ''} ${blocks.benefit ?? ''} ${blocks.cta ?? ''}`
    const foreignRe = lang === 'ms' || lang === 'Bahasa Malaysia'
      ? /\b(vi[eệ]t ?nam|vietnam|indonesia|th[aá]i ?lan|thailand|singapura|filipina)\b/i
      : /\b(malaysia|m[ãa] ?lai|indonesia|singapore|th[aá]i ?lan|thailand|philippines)\b/i
    const m = allBody.match(foreignRe)
    if (m) {
      failures.push(
        `The script names a foreign market "${m[0]}" that does not match its language — that is ` +
        `drift (e.g. "bán chạy bên Malaysia" in a Vietnamese ad). Remove the country name; state ` +
        `the popularity / crowd WITHOUT tying it to a foreign place.`,
      )
    }
  }

  // 10. FABRICATED PRECISE RATING (P5z5) — a decimal star rating ("4.8/5 sao", "4.9 bintang")
  //     is an invented exact stat. Social proof should be a plausible VIBE, not a fake precise
  //     number. Vague "review toàn 5 sao" / "ulasan 5 bintang" (no decimal) is fine.
  {
    const allBody = `${blocks.discovery ?? ''} ${blocks.benefit ?? ''} ${blocks.cta ?? ''}`
    const m = allBody.match(/\b\d+[.,]\d+\s*(?:\/\s*5\s*)?(sao|bintang|star)\b/i)
    if (m) {
      failures.push(
        `Body invents a precise rating ("${m[0].trim()}"). Don't fabricate an exact stat — use a ` +
        `plausible vibe instead ("review toàn 5 sao" / "ulasan 5 bintang", no decimal number).`,
      )
    }
  }

  return { ok: failures.length === 0, failures }
}

// Cross-language crowd / social-proof cues (VN + MS + EN). Broad on purpose — rule 8
// is a presence check, so a wide net keeps false-fails rare (it fires only when NO
// crowd beat at all is present). Mirrors brollDirector's SOCIAL_PROOF_CUE_RE.
// P5z3 — must signal a PLURAL crowd. Dropped single-capable cues (review / đánh giá /
// recommend / ulasan / puas hati / verified) because a LONE reviewer ("một chị đầu bếp
// review nó") was false-passing as crowd proof. Kept only counts / sold-out / repeat /
// many-people / star-ratings / community (VN + MS + EN). "review toàn 5 sao" still passes
// via "5 sao"; "cả ngàn đánh giá" via "ngàn".
const SOCIAL_PROOF_CUE_RE =
  /ngh[ìi]n ng[ưu][ờo]i|ng[àa]n ng[ưu][ờo]i|m[oọ]i ng[ưu][ờo]i|ai (?:d[ùu]ng|mua)|nhi[eề]u ng[ưu][ờo]i|b[áa]n ch[aạ]y|ch[áa]y h[àa]ng|quay l[aạ]i mua|mua l[aạ]i|l[ưu][ợo]t (?:mua|b[áa]n)|ng[ưu][ờo]i (?:mua|đ[ặa]t)|5 sao|n[ăa]m sao|c[oộ]ng đ[ồo]ng|\b(?:sold|sold[- ]?out|repeat|viral|popular)\b|ramai|terjual|bintang|\blaku\b|semua orang|orang (?:beli|guna|pakai|cuba)/i

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

// ── P5 — Memory ANCHOR validator ─────────────────────────────────────────────
// The script must plant ONE concrete reason/expectation EARLY and RESTATE it at
// the CTA — the line that survives the COD cooling-off and wins the re-decision at
// the door. LENIENT (only fail on clear misses → avoid retry storms): checks the
// anchor (a) exists + is concrete (not pure vague praise), (b) is echoed early AND
// at the CTA, (c) is HONEST (no absolute-cure / miracle phrasing). Language-light.
const ANCHOR_VAGUE_ONLY_RE = /^(rất )?(tốt|tuyệt vời|tuyệt|đỉnh|xịn|chất lượng|đa năng|hoàn hảo|number one|terbaik|bagus|best)\.?$/i
// Absolute-cure / miracle phrasing that gets refused at the door (VN + MS).
// Only the day-1-CHECKABLE cure promise is banned — bold benefit/popularity hype is
// allowed (see scriptGenerator "SELL HARD" rules). The "100%" branch requires a cure/
// effect word after it so a material spec ("100% cotton", "thép 100%") is NOT flagged.
const ABSOLUTE_CURE_RE = /(hết hẳn|khỏi hẳn|dứt điểm|chữa khỏi|trị dứt|hết bệnh|cam kết khỏi|đảm bảo khỏi|sembuh terus|sembuh total|sembuh sepenuhnya|hilang terus|hilang serta[- ]?merta|(confirm|pasti|mesti|dijamin|jamin)\s+sembuh|100\s*%\s*(khỏi|sembuh|berkesan|hết))/i
// Number + time-unit immediately tied to a cure verb = a falsifiable deadline ("3 ngày
// là hết", "3 hari sembuh"). A hedged window ("khoảng 1 tuần", "sekitar seminggu") has no
// \d+ here and a non-cure speed claim ("bơm 3 phút đầy lốp") lacks the cure verb → both pass.
const MIRACLE_SPEED_RE = /\b\d+\s*(giây|phút|ngày|saat|minit|jam|hari)\b[^.!?]{0,30}(hết|khỏi|sembuh|hilang|sihat)/i

function anchorTokens(s: string): string[] {
  return s.toLowerCase().replace(/[.,!?;:"'“”…()\-–—]/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 3)
}

/** Validate the memory anchor. `anchor` is the model's declared anchor phrase.
 *  Returns ok=true (lenient pass) when missing-but-can't-verify; only hard-fails on
 *  clear contract breaks so it never burns a retry on a fine script. */
export function validateAnchor(blocks: BodyBlocks, anchor: string, _lang?: string): ValidatorResult {
  const failures: string[] = []
  const a = (anchor ?? '').trim()

  // (a) present + concrete (not pure vague praise)
  if (a.length < 4) {
    failures.push('Thiếu ANCHOR — chọn 1 lý do/kỳ vọng CỤ THỂ, THẬT (số liệu job chính / cơ chế / kết quả có mốc) và xuất ra field "anchor".')
    return { ok: false, failures }   // can't check the rest without an anchor
  }
  if (ANCHOR_VAGUE_ONLY_RE.test(a)) {
    failures.push(`ANCHOR quá chung ("${a}"). Phải CỤ THỂ — kèm số/đặc tính/kết quả (vd "bơm đầy lốp 3 phút", "đỡ rõ sau ~1 tuần"), không chỉ "tốt/đa năng".`)
  }

  // (b) echoed EARLY (hook/pain/discovery) AND at the CTA — fuzzy token overlap
  const tokens = [...new Set(anchorTokens(a))].filter((t) => !/^\d+$/.test(t))   // skip bare numbers for overlap
  if (tokens.length > 0) {
    const early = `${blocks.hook} ${blocks.pain} ${blocks.discovery}`.toLowerCase()
    const cta = (blocks.cta ?? '').toLowerCase()
    const inEarly = tokens.some((t) => early.includes(t))
    const inCta = tokens.some((t) => cta.includes(t))
    if (!inEarly) failures.push(`ANCHOR ("${a}") chưa xuất hiện SỚM (trong hook / câu body đầu). Gài nó ngay đầu.`)
    if (!inCta) failures.push(`ANCHOR ("${a}") chưa được NHẮC LẠI ở CTA (diễn đạt khác cũng được). Lặp lại để khách nhớ tới lúc nhận hàng.`)
  }

  // (c) honesty — no absolute-cure / miracle-speed anywhere in the body
  const body = `${blocks.pain} ${blocks.discovery} ${blocks.benefit} ${blocks.cta}`
  if (ABSOLUTE_CURE_RE.test(body) || MIRACLE_SPEED_RE.test(body)) {
    failures.push('Kỳ vọng đang là CAM KẾT KHỎI TUYỆT ĐỐI / phép màu (VN: "hết hẳn / chữa khỏi / 100% khỏi / 3 ngày là hết"; MS: "sembuh terus / sembuh total / 3 hari sembuh / 100% berkesan") — đổi sang HEDGED thực tế ngôi 1 (VN "mình thấy đỡ rõ sau ~1 tuần"; MS "rasa beza lepas seminggu lebih kurang"). Cam kết khỏi theo mốc kiểm-được-ngay = bị bom hàng ở cửa COD.')
  }

  return { ok: failures.length === 0, failures }
}
