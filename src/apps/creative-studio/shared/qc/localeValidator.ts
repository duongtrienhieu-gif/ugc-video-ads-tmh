// ── Locale Text Validator (P29 — Phase 5) ──────────────────────────────────
//
// Post-generation language check. Catches the failure mode where Gemini
// drifts into the wrong language despite the prompt-level [LOCALE HARD
// LOCK] block (P25). The validator runs AFTER schema validation but
// BEFORE the structured result is consumed by the template renderer —
// when it fails, the upstream safeGenerateStructured loop treats it as
// a regenerate-able failure and retries up to N times with a stricter
// instruction.
//
// DETECTION STRATEGY (cheap heuristics, no LLM call needed):
//   • Vietnamese:       tone-marked vowels + ăâđêôơư letters
//   • Chinese:          CJK Unified Ideographs 0x4E00–0x9FFF
//   • Korean Hangul:    0xAC00–0xD7AF
//   • Bahasa Melayu:    no diacritics, but flagged by detecting common
//                       Vietnamese tone marks ANYWHERE
//
// vi-VN locale REQUIRES at least one Vietnamese-only character to be
// present in the joined text. Without it the text is most likely
// pidgin-Vietnamese (no diacritics) which fails on its own quality bar.

import type { UINativeLocale } from '../../types/uiNative'

/** Matches any Vietnamese-only character (vowels with diacritics + the
 *  6 Vietnamese-specific letters). If the text contains ZERO of these,
 *  it is almost certainly not Vietnamese. */
const VIETNAMESE_CHAR_RX = /[ăâđêôơưĂÂĐÊÔƠƯáàảãạÁÀẢÃẠắằẳẵặẮẰẲẴẶấầẩẫậẤẦẨẪẬéèẻẽẹÉÈẺẼẸếềểễệẾỀỂỄỆíìỉĩịÍÌỈĨỊóòỏõọÓÒỎÕỌốồổỗộỐỒỔỖỘớờởỡợỚỜỞỠỢúùủũụÚÙỦŨỤứừửữựỨỪỬỮỰýỳỷỹỵÝỲỶỸỴ]/

/** CJK Unified Ideographs — Chinese / Japanese kanji. */
const CHINESE_RX = /[一-鿿]/

/** Korean Hangul syllables. */
const KOREAN_RX = /[가-힯]/

/** Common Bahasa Melayu / Indonesian function words that strongly
 *  indicate the text is Malay or Indonesian. Used to flag wrong-locale
 *  leakage when the locale is vi-VN or global. */
const BAHASA_MARKER_RX = /\b(yang|dengan|sangat|tidak|sudah|akan|untuk|saya|kamu|kami|mereka|itu|ini|adalah|bagus|kerana|kerja|boleh|nak|tak|dah|aje|jugak|gila|memang)\b/i

/** Common Vietnamese function words that strongly indicate Vietnamese
 *  text — used as a secondary signal when the diacritic detector
 *  returns false (some users type Vietnamese without diacritics). */
const VI_MARKER_RX = /\b(không|được|chưa|đang|rồi|nhưng|cũng|đã|là|của|và|vì|với|nha|nhé|shop|sản\s*phẩm|cảm\s*ơn|ưng|tuyệt)\b/i

export interface LocaleValidationResult {
  ok: boolean
  reason?: string
  /** First offending snippet, if any — used for debug logging. */
  sample?: string
}

/** Validate that `text` matches the locale's expected language profile.
 *
 *  Empty strings ALWAYS pass — they're handled by the schema check, not
 *  the locale validator. */
export function validateLocale(text: string, locale: UINativeLocale): LocaleValidationResult {
  if (!text || text.trim().length === 0) return { ok: true }

  const hasViDiacritics = VIETNAMESE_CHAR_RX.test(text)
  const hasViMarker = VI_MARKER_RX.test(text)
  const hasChinese = CHINESE_RX.test(text)
  const hasKorean = KOREAN_RX.test(text)
  const hasBahasaMarker = BAHASA_MARKER_RX.test(text)

  switch (locale) {
    case 'vi-VN': {
      // Vietnamese MUST have at least one diacritic — pidgin-Vietnamese
      // (no tone marks) is treated as a failure even though native
      // speakers sometimes write that way casually.
      if (!hasViDiacritics && !hasViMarker) {
        return {
          ok: false,
          reason: 'vi-VN expected — output contains no Vietnamese diacritics or markers',
          sample: text.slice(0, 80),
        }
      }
      if (hasChinese || hasKorean) {
        return {
          ok: false,
          reason: 'vi-VN expected — output contains Chinese or Korean characters',
          sample: text.slice(0, 80),
        }
      }
      return { ok: true }
    }
    case 'my-MY': {
      if (hasViDiacritics) {
        const m = text.match(VIETNAMESE_CHAR_RX)
        return {
          ok: false,
          reason: 'my-MY expected — output contains Vietnamese diacritic characters',
          sample: m ? text.slice(Math.max(0, (m.index ?? 0) - 20), (m.index ?? 0) + 40) : text.slice(0, 80),
        }
      }
      if (hasChinese || hasKorean) {
        return {
          ok: false,
          reason: 'my-MY expected — output contains Chinese or Korean characters',
          sample: text.slice(0, 80),
        }
      }
      if (hasViMarker) {
        return {
          ok: false,
          reason: 'my-MY expected — output contains Vietnamese function-word markers',
          sample: text.slice(0, 80),
        }
      }
      return { ok: true }
    }
    case 'id-ID': {
      if (hasViDiacritics) {
        return {
          ok: false,
          reason: 'id-ID expected — output contains Vietnamese diacritic characters',
          sample: text.slice(0, 80),
        }
      }
      if (hasChinese || hasKorean) {
        return {
          ok: false,
          reason: 'id-ID expected — output contains Chinese or Korean characters',
          sample: text.slice(0, 80),
        }
      }
      if (hasViMarker) {
        return {
          ok: false,
          reason: 'id-ID expected — output contains Vietnamese function-word markers',
          sample: text.slice(0, 80),
        }
      }
      return { ok: true }
    }
    case 'global': {
      if (hasViDiacritics || hasViMarker || hasChinese || hasKorean || hasBahasaMarker) {
        return {
          ok: false,
          reason: 'global (English) expected — output contains non-English characters or markers',
          sample: text.slice(0, 80),
        }
      }
      return { ok: true }
    }
  }
}

/** Join all text fields from an array of strings into one buffer and
 *  validate. Handy for structured LLM responses that have multiple text
 *  fields (chat messages, comment thread, review body). */
export function validateLocaleMany(texts: string[], locale: UINativeLocale): LocaleValidationResult {
  const joined = texts.filter(Boolean).join('\n')
  return validateLocale(joined, locale)
}
