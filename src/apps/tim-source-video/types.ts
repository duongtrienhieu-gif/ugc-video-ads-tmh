// ── Tìm Source Video — types, config, error taxonomy ────────────────────────
// V2.0 pivot: dropped Gemini Google-Search grounding (expensive, returned
// homepage/e-commerce noise) and per-call Gemini rank (replaced with batched
// embedding similarity). Deep video analysis is now LAZY — user clicks a
// "Verify content" button per card instead of auto-running on top-N.

export const CONFIG = {
  search: {
    ytMaxResults: 5,            // 5 raw from YT Data API per query; cap 3 in mix
    webMaxResults: 12,          // V3.2.2 — bumped 8→12. Gemini grounding sometimes
                                // returns 8-10 chunks; strict filters drop many, so
                                // higher ceiling means more reach the UI.
    /** Scene-level parallelism — bounded by Gemini Flash 10 RPM (web search
     *  uses 1 Gemini call per scene). 4 keeps burst under the ceiling. */
    sceneConcurrency: 4,
  },
  rank: {
    /** Drop links scoring below this percentile (cosine 0-100 scale). */
    minScoreShow: 25,
    maxCardsPerScene: 8,
    /** Per-source quota in final mix when includeYouTube=true.
     *  3 YT + 5 Web = 8 cards (37.5% / 62.5% — close to user's 40/60 target). */
    mixYouTubeMax: 3,
    mixWebMax: 5,
  },
  cache: {
    /** parseScript output cached for 1 day — same script → instant rerun. */
    parseScriptTtlMs:    24 * 60 * 60 * 1000,
    /** YouTube + TikTok search results cached for 1 day. */
    searchTtlMs:         24 * 60 * 60 * 1000,
    /** Embedding vectors cached for 7 days (content semantics stable). */
    embeddingTtlMs: 7 * 24 * 60 * 60 * 1000,
    /** Transcript text cached 7 days (video captions rarely change). */
    transcriptTtlMs: 7 * 24 * 60 * 60 * 1000,
  },
  transcript: {
    /** Max parallel transcript fetches — Vercel free tier 100K/mo allows
     *  burst, but YouTube IP rate-limit kicks in if we go too wide. */
    concurrency: 6,
    /** Boost applied to embedding score if at least 1 transcript hit found.
     *  Multiplier (1.3 = +30% over base cosine). Keep modest so embedding
     *  signal still dominates ranking. */
    hitScoreBoost: 1.3,
    /** Cues around a hit included as excerpt (each side). */
    excerptCueWindow: 2,
  },
  scoreColor: [
    { min: 75, color: '#10b981' },  // excellent — green
    { min: 55, color: '#f59e0b' },  // good — amber
    { min: 35, color: '#f97316' },  // ok — orange
    { min: 25, color: '#dc2626' },  // low but shown — red
  ],
  scoreColorNone: '#9ca3af',         // gray — when score missing
} as const

export function colorForScore(score: number | null | undefined): string {
  if (typeof score !== 'number') return CONFIG.scoreColorNone
  for (const tier of CONFIG.scoreColor) {
    if (score >= tier.min) return tier.color
  }
  return CONFIG.scoreColorNone
}

// ── Error taxonomy ──────────────────────────────────────────────────────────
export const ERR = {
  QUOTA_GEMINI:  'QUOTA_GEMINI',
  QUOTA_YOUTUBE: 'QUOTA_YOUTUBE',
  ABORTED:       'ABORTED',
  GEMINI_FAIL:   'GEMINI_FAIL',
  YOUTUBE_FAIL:  'YOUTUBE_FAIL',
  PARSE_FAIL:    'PARSE_FAIL',
} as const

export type ErrCode = typeof ERR[keyof typeof ERR]

export class ApiError extends Error {
  code: ErrCode
  constructor(code: ErrCode, message: string) {
    super(message)
    this.code = code
    this.name = 'ApiError'
  }
}

// ── Domain types ────────────────────────────────────────────────────────────
// V3.2: TikTok scraper dropped (tikwm fragile). Sources now:
//   - YouTube via Data API (when includeYouTube toggle is ON, capped 40%)
//   - Web via Gemini Google Search grounding (any indexed page, 60% or 100%)
export type SourceId = 'youtube' | 'web'

/** Script-level language detection. Drives source-search strategy +
 *  transcript fetch priority. */
export type ScriptLang = 'vi' | 'en' | 'ms'

export interface Scene {
  /** Original line in the script's language (vi / en / ms). */
  line: string
  /** Vietnamese translation of `line` — for Vietnamese-speaking operator to
   *  read along when the script is in English or Malay. Equal to `line`
   *  when scriptLang === 'vi'. UI only renders if it differs from `line`. */
  lineVi: string
  visualIntent: string
  /** Keywords in 3 languages so we can search English content (largest pool)
   *  alongside native-lang content (more authentic UGC for the audience). */
  keywordVi: string
  keywordEn: string
  keywordMs: string
}

/** Script-level product context extracted ONCE per script. Injected vào
 *  search queries + embedding query + transcript matching để giữ topical
 *  relevance — fix bug "scene-emotional-only" (visualIntent/keywords AI
 *  generate quá generic, mất context sản phẩm thật). */
export interface ProductContext {
  /** Tên sản phẩm/brand verbatim trong kịch bản (vd "9YOUNG-BASIC Vitamin B Complex"). */
  productName: string
  /** 1-3 từ mô tả ngách (vd "vitamin supplement", "skincare collagen"). */
  niche: string
  /** 4-6 từ khóa Việt về sản phẩm + ngách + cơ chế chính. */
  productKeywordsVi: string
  /** 4-6 từ khóa Anh tương đương. */
  productKeywordsEn: string
  /** 4-6 từ khóa Malay tương đương. */
  productKeywordsMs: string
}

export interface ParseResult {
  scriptLang: ScriptLang
  productContext: ProductContext
  scenes: Scene[]
}

export interface Link {
  url: string
  title: string
  /** YouTube only — description from Data API snippet (semantic signal). */
  description?: string
  thumbnail?: string
  domain: string
  meta?: string
  /** YouTube only — videoId extracted for transcript fetch. */
  videoId?: string
}

/** One transcript snippet (cue) — output of /api/yt-transcript. */
export interface TranscriptSnippet {
  /** Start time in seconds. */
  start: number
  /** Duration in seconds. */
  duration: number
  /** Caption text. */
  text: string
}

/** Output of phrase-search over a transcript. Used to surface ONLY videos
 *  where the spoken content actually mentions scene's keywords. */
export interface TranscriptHit {
  /** Start of matched window (seconds). */
  start: number
  /** End of matched window (seconds). */
  end: number
  /** ±2 cues of context around the match. */
  excerpt: string
  /** Which keyword variant fired the match. */
  matchedTerm: string
  /** Matched keyword's source language (so UI can tag VI/EN/MS). */
  matchedLang: ScriptLang
  /** Score for ranking: occurrences × keyword-specificity boost. */
  score: number
}

export interface RankedLink extends Link {
  source: SourceId
  /** Final score 0-100 = blend of embedding cosine + transcript-hit boost. */
  score: number
  /** Optional short Vietnamese explanation. */
  reason?: string
  /** Transcript matches if YouTube + transcript fetched successfully.
   *  Empty array if no transcript OR no keyword hits in transcript. */
  transcriptHits?: TranscriptHit[]
  /** Language of the fetched transcript (informational only). */
  transcriptLang?: ScriptLang | 'unknown'
  /** Stable id for tracking state. */
  _cardId: string
}

export interface SearchResult {
  source: SourceId
  links: Link[]
}

export interface SceneState {
  scene: Scene
  ranked: RankedLink[]
  /** per-source errors (so 1 source fail doesn't poison the scene) */
  errors: Partial<Record<SourceId, string>>
}

export interface BannerSpec {
  kind: 'quota_gemini' | 'quota_youtube' | 'aborted' | 'generic'
  message?: string
}
