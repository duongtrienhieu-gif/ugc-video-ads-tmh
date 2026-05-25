// ── Tìm Source Video — types, config, error taxonomy ────────────────────────
// V2.0 pivot: dropped Gemini Google-Search grounding (expensive, returned
// homepage/e-commerce noise) and per-call Gemini rank (replaced with batched
// embedding similarity). Deep video analysis is now LAZY — user clicks a
// "Verify content" button per card instead of auto-running on top-N.

export const CONFIG = {
  search: {
    ytMaxResults: 8,            // bumped from 5 — more candidates per scene
    tiktokCount: 8,
    /** Scene-level parallelism. Phase-2 search is non-Gemini (YouTube Data
     *  API + tikwm), so we can fan out fully — no Gemini RPM concern. */
    sceneConcurrency: 8,
  },
  rank: {
    /** Drop links scoring below this percentile (cosine 0-100 scale). */
    minScoreShow: 25,
    maxCardsPerScene: 8,
  },
  cache: {
    /** parseScript output cached for 1 day — same script → instant rerun. */
    parseScriptTtlMs:    24 * 60 * 60 * 1000,
    /** YouTube + TikTok search results cached for 1 day. */
    searchTtlMs:         24 * 60 * 60 * 1000,
    /** Embedding vectors cached for 7 days (content semantics stable). */
    embeddingTtlMs: 7 * 24 * 60 * 60 * 1000,
    /** Timestamp analysis cached for 7 days (videos rarely change). */
    timestampTtlMs: 7 * 24 * 60 * 60 * 1000,
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
// V2: Web source dropped — only YouTube (content-verifiable) + TikTok (title-only).
export type SourceId = 'youtube' | 'tiktok'

export interface Scene {
  line: string
  visualIntent: string
  keywordVi: string
  keywordEn: string
}

export interface Link {
  url: string
  title: string
  /** YouTube only — description from Data API snippet (semantic signal). */
  description?: string
  thumbnail?: string
  domain: string
  meta?: string
}

export interface RankedLink extends Link {
  source: SourceId
  /** Cosine similarity scaled to 0-100. */
  score: number
  /** Optional short Vietnamese explanation. */
  reason?: string
  /** Stable id for tracking timestamp-verify state. */
  _cardId: string
}

export interface SearchResult {
  source: SourceId
  links: Link[]
}

export interface TimestampRow {
  start: string
  end: string
  description: string
}

export interface TimestampResult {
  found: boolean
  timestamps?: TimestampRow[]
  summary?: string
}

/** Per-card verify state — 'idle' default, transitions on user click. */
export type VerifyState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; result: TimestampResult }
  | { kind: 'error'; message: string }

export interface SceneState {
  scene: Scene
  ranked: RankedLink[]
  /** keyed by _cardId — verify state per card */
  verify: Record<string, VerifyState>
  /** per-source errors (so 1 source fail doesn't poison the scene) */
  errors: Partial<Record<SourceId, string>>
}

export interface BannerSpec {
  kind: 'quota_gemini' | 'quota_youtube' | 'aborted' | 'generic'
  message?: string
}
