// ── Transcript phrase matcher — pure JS, 0 API cost ─────────────────────────
// Takes a transcript (array of timed cues from /api/yt-transcript) and the
// scene's multi-lang keywords, returns TranscriptHit[] with timestamp window
// + excerpt + language tag. Used to surface ONLY videos whose SPOKEN content
// mentions scene's concept — far stronger signal than title matching alone.
//
// Cross-language matching: each scene has keywords in vi/en/ms; matcher tries
// all 3 variants against the transcript text. If transcript is English but
// scene's strongest match comes from Vietnamese keyword (e.g. translated
// captions), that still counts — we tag the hit with the language whose
// keyword fired, not the transcript's source language.

import type {
  Scene, ScriptLang, ProductContext,
  TranscriptSnippet, TranscriptHit,
} from './types'
import { CONFIG } from './types'

interface KeywordVariant {
  term: string
  lang: ScriptLang
}

/** Tokenise a keyword string into individual searchable terms, lowercased.
 *  "Tired stuffy nose" → ['tired', 'stuffy', 'nose']. Skips noise words 1-2
 *  chars long. */
function tokenize(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .normalize('NFC')
    .split(/[\s,.;:!?()[\]{}'"`/\\-]+/)
    .filter(t => t.length >= 3)
}

/** Collect all per-language keyword variants for a scene as flat list with
 *  language tags. F2: gộp thêm productContext keywords để transcript search
 *  cover cả product topic, không chỉ scene-specific. Cho Vitamin B scene,
 *  variants giờ có cả "vitamin b", "supplement", "fatigue" + scene-specific
 *  "positive change", "satisfied" → transcript phải match topic mới count. */
function expandKeywords(scene: Scene, productContext?: ProductContext): KeywordVariant[] {
  const variants: KeywordVariant[] = []
  for (const tok of tokenize(scene.keywordVi)) variants.push({ term: tok, lang: 'vi' })
  for (const tok of tokenize(scene.keywordEn)) variants.push({ term: tok, lang: 'en' })
  for (const tok of tokenize(scene.keywordMs)) variants.push({ term: tok, lang: 'ms' })
  if (productContext) {
    for (const tok of tokenize(productContext.productKeywordsVi)) variants.push({ term: tok, lang: 'vi' })
    for (const tok of tokenize(productContext.productKeywordsEn)) variants.push({ term: tok, lang: 'en' })
    for (const tok of tokenize(productContext.productKeywordsMs)) variants.push({ term: tok, lang: 'ms' })
  }
  // Dedupe identical terms (same lang or cross-lang accidentally matching)
  const seen = new Set<string>()
  return variants.filter(v => {
    const key = `${v.term}|${v.lang}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Group consecutive cue indices into a single hit window. Two cues are part
 *  of the same window if they're within 4 cues of each other in the transcript
 *  (~10-20 seconds depending on caption density). */
function groupAdjacentCues(cueIndices: number[]): number[][] {
  if (cueIndices.length === 0) return []
  const sorted = [...new Set(cueIndices)].sort((a, b) => a - b)
  const groups: number[][] = []
  let current: number[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= 4) {
      current.push(sorted[i])
    } else {
      groups.push(current)
      current = [sorted[i]]
    }
  }
  groups.push(current)
  return groups
}

/** Build excerpt text from cues ± window around match. */
function buildExcerpt(snippets: TranscriptSnippet[], centerIdx: number): string {
  const window = CONFIG.transcript.excerptCueWindow
  const start = Math.max(0, centerIdx - window)
  const end = Math.min(snippets.length, centerIdx + window + 1)
  return snippets
    .slice(start, end)
    .map(s => s.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

/**
 * Match scene's keywords against transcript text. Returns hits sorted by
 * score desc, capped at top 5.
 *
 * Scoring per group:
 *   • +1 per match (cue containing a keyword)
 *   • +0.5 bonus if multiple different keyword terms match in the same group
 *     (proximity signal — video likely covering the concept in depth here)
 *   • Final group score → normalised against group size
 */
export function matchTranscript(
  snippets: TranscriptSnippet[],
  scene: Scene,
  productContext?: ProductContext,
): TranscriptHit[] {
  if (!snippets || snippets.length === 0) return []
  const variants = expandKeywords(scene, productContext)
  if (variants.length === 0) return []

  // Pre-lowercase all cues once for O(N×K) phrase search
  const lowered = snippets.map(s => s.text.toLowerCase().normalize('NFC'))

  // Per-cue → which keyword variants matched in that cue
  interface CueMatch {
    cueIdx: number
    matchedVariants: KeywordVariant[]
  }
  const cueMatches: CueMatch[] = []
  for (let i = 0; i < lowered.length; i++) {
    const text = lowered[i]
    const matched: KeywordVariant[] = []
    for (const v of variants) {
      if (text.includes(v.term)) matched.push(v)
    }
    if (matched.length > 0) cueMatches.push({ cueIdx: i, matchedVariants: matched })
  }
  if (cueMatches.length === 0) return []

  // Group adjacent matching cues
  const cueIndices = cueMatches.map(m => m.cueIdx)
  const groups = groupAdjacentCues(cueIndices)

  const hits: TranscriptHit[] = []
  for (const group of groups) {
    // Pick representative cue (middle of group) for excerpt + lang tag
    const midIdx = group[Math.floor(group.length / 2)]
    const startSnippet = snippets[group[0]]
    const endSnippet = snippets[group[group.length - 1]]
    if (!startSnippet || !endSnippet) continue

    // Aggregate variants matched across the group
    const variantsInGroup = new Set<string>()
    for (const cueIdx of group) {
      const cm = cueMatches.find(m => m.cueIdx === cueIdx)
      if (cm) cm.matchedVariants.forEach(v => variantsInGroup.add(`${v.term}|${v.lang}`))
    }
    const uniqueVariants = Array.from(variantsInGroup).map(s => {
      const [term, lang] = s.split('|')
      return { term, lang: lang as ScriptLang }
    })

    // Score: base = number of matching cues, bonus = unique keyword diversity
    const score = group.length + (uniqueVariants.length > 1 ? uniqueVariants.length * 0.5 : 0)

    // Pick the FIRST keyword that matched (representative term + lang)
    const repVariant = uniqueVariants[0]

    hits.push({
      start: startSnippet.start,
      end: endSnippet.start + endSnippet.duration,
      excerpt: buildExcerpt(snippets, midIdx),
      matchedTerm: repVariant.term,
      matchedLang: repVariant.lang,
      score,
    })
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, 5)
}

/** Convenience: get the BEST hit's start time (for deep-link). */
export function bestHitStart(hits: TranscriptHit[]): number | null {
  if (!hits || hits.length === 0) return null
  return Math.floor(hits[0].start)
}
