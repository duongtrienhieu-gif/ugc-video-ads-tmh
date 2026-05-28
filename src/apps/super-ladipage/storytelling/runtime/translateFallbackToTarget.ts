// ─────────────────────────────────────────────────────────────────────
// storytelling/runtime/translateFallbackToTarget (LANG-FIX 2026-05-27)
//
// FALLBACK_COPY is hardcoded Vietnamese (its content is generic diary
// prose, written once in VN). When pack target language is MS or EN,
// applying VN fallback creates a MIXED-LANGUAGE pack — eg 12 MS sections
// + 7 VN fallback sections = broken reading experience.
//
// FIX: when targetLanguage ≠ 'vi' AND fallback was applied to ≥1 section,
// batch-translate just the fallback sections' title + copy in ONE Gemini
// call. Original Gemini-generated sections (already in target language)
// are NOT touched. Pack ships in 100% target language.
//
// Generic for any future target language (ms / en / future additions) —
// no per-language static text maintenance needed.
// ─────────────────────────────────────────────────────────────────────

import type { LandingLanguage } from '../types'
import type { ParsedSection } from './parsePackResponse'
import type { BlockId } from '../types'
import { textGenWithFallback } from '../../services/textGenWithFallback'

interface ApiKeys {
  geminiApiKey: string
  kieApiKey: string
}

/** Translate fallback section texts (title + copy) from VN to target language.
 *  Only translates the failingIds sections. Other sections pass through
 *  unchanged (they were Gemini-generated already in target language). */
export async function translateFallbackToTarget(
  sections: ParsedSection[],
  failingIds: BlockId[],
  targetLanguage: LandingLanguage,
  keys: ApiKeys,
): Promise<ParsedSection[]> {
  // No translation needed for VN packs (fallback content is already VN)
  if (targetLanguage === 'vi') return sections
  if (failingIds.length === 0) return sections
  if (!keys.geminiApiKey && !keys.kieApiKey) return sections

  const failingSet = new Set<string>(failingIds)

  // Collect fields-to-translate map keyed by section index
  const toTranslate: Record<string, string> = {}
  sections.forEach((s, idx) => {
    if (!failingSet.has(s.id)) return
    if (s.title) toTranslate[`s${idx}.title`] = s.title
    if (s.copy)  toTranslate[`s${idx}.copy`]  = s.copy
  })

  if (Object.keys(toTranslate).length === 0) return sections

  const targetLangName = targetLanguage === 'ms'
    ? 'Bahasa Melayu (Malaysian Malay — natural conversational, NOT formal Bahasa Indonesia)'
    : 'natural conversational English'

  const culturalNote = targetLanguage === 'ms'
    ? 'Use Malaysian Malay cultural register. First-person "saya". Use "anda" for reader (NOT "kamu" / "engkau"). Keep diary tone — confessional, slightly informal.'
    : 'Use natural conversational English. First-person "I". Address reader as "you". Keep diary tone — confessional, slightly informal.'

  const prompt = `Translate these Vietnamese diary fallback texts to ${targetLangName}.

═══ TRANSLATION RULES ═══
- ${culturalNote}
- Diary tone — NOT marketing, NOT formal essay
- Preserve paragraph breaks (\\n\\n)
- Preserve em-dashes and parenthetical asides
- Do NOT add marketing phrases ("đặt ngay", "ưu đãi" → never)
- Do NOT change meaning or add cultural references not in source
- If source says "vitamin tổng hợp", translate literally ("multi-vitamin" / "multivitamin")

═══ INPUT (JSON, keys are field paths) ═══
${JSON.stringify(toTranslate, null, 2)}

═══ OUTPUT ═══
Return JSON object with the SAME keys, values translated to ${targetLangName}.
NO markdown fences, NO prose outside JSON.`

  let raw: string
  try {
    raw = await textGenWithFallback({
      geminiApiKey: keys.geminiApiKey,
      kieApiKey:    keys.kieApiKey,
      prompt,
      jsonMode:        true,
      maxOutputTokens: 4000,
      timeoutMs:       45_000,
      label:           'fallback-translate-to-target',
    })
  } catch (err) {
    console.warn(
      `[storytelling/fallback-translate] Translate call failed — pack will ship with ` +
      `Vietnamese fallback sections. Reason: ${err instanceof Error ? err.message : 'unknown'}`,
    )
    return sections
  }

  let parsed: Record<string, string>
  try {
    const cleaned = raw.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim()
    parsed = JSON.parse(cleaned) as Record<string, string>
  } catch (err) {
    console.warn(
      `[storytelling/fallback-translate] JSON parse failed — keeping VN fallback. ` +
      `Reason: ${err instanceof Error ? err.message : 'unknown'}`,
    )
    return sections
  }

  return sections.map((s, idx) => {
    if (!failingSet.has(s.id)) return s
    const newTitle = parsed[`s${idx}.title`]
    const newCopy  = parsed[`s${idx}.copy`]

    const finalTitle = typeof newTitle === 'string' && newTitle.trim().length > 0
      ? newTitle.trim()
      : s.title
    const finalCopy = typeof newCopy === 'string' && newCopy.trim().length > 0
      ? newCopy.trim()
      : s.copy

    return {
      ...s,
      title: finalTitle,
      copy: finalCopy,
      paragraphs: finalCopy
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    }
  })
}
