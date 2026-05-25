// ── Tìm Source Video — types, config, error taxonomy ────────────────────────
// Mirror of the standalone prototype in /prototypes/source-video.html, ported
// to TypeScript modules + React. Single source of truth for thresholds, retry
// params, score color tiers, and the error code enum that downstream UI
// branches on.

export const CONFIG = {
  search: {
    ytMaxResults: 5,
    tiktokCount: 8,
    webMaxLinks: 5,
  },
  rank: {
    minScoreShow: 30,           // filter cards below this
    minScoreAnalyzeTs: 50,      // YouTube cards eligible for timestamp analysis
    maxCardsPerScene: 8,
    fallbackPriority: { youtube: 70, tiktok: 60, web: 40 } as Record<SourceId, number>,
  },
  timestamp: {
    maxVideosPerScene: 3,
    concurrency: 2,
  },
  retry: {
    maxAttempts: 6,
    baseDelayMs: 2000,
    factor: 1.7,
  },
  scoreColor: [
    { min: 80, color: '#10b981' },  // excellent — green
    { min: 60, color: '#f59e0b' },  // good — amber
    { min: 40, color: '#f97316' },  // ok — orange
    { min: 30, color: '#dc2626' },  // low but shown — red
  ],
  scoreColorNone: '#9ca3af',         // gray — used when score is null
} as const

export function colorForScore(score: number | null | undefined): string {
  if (typeof score !== 'number') return CONFIG.scoreColorNone
  for (const tier of CONFIG.scoreColor) {
    if (score >= tier.min) return tier.color
  }
  return CONFIG.scoreColorNone
}

// ── Error taxonomy: every API call throws ApiError with a stable code. ──────
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
export type SourceId = 'youtube' | 'tiktok' | 'web'

export interface Scene {
  line: string
  visualIntent: string
  keywordVi: string
  keywordEn: string
}

export interface Link {
  url: string
  title: string
  thumbnail?: string
  domain: string
  meta?: string
}

export interface RankedLink extends Link {
  source: SourceId
  score: number
  reason?: string
  /** Stable id for DOM diffing during Phase 2 timestamp updates. */
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

export interface SceneState {
  scene: Scene
  ranked: RankedLink[]
  /** card-ids of YouTube videos selected for Phase 2 timestamp analysis */
  analyzingIds: Set<string>
  /** keyed by _cardId — result or in-flight/error marker */
  timestamps: Record<string, TimestampResult | { error: string } | 'loading'>
  /** per-source errors (so 1 source fail doesn't poison the scene) */
  errors: Partial<Record<SourceId, string>>
}

export interface BannerSpec {
  kind: 'quota_gemini' | 'quota_youtube' | 'aborted' | 'generic'
  message?: string
}
