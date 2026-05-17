// ── sanitizeAnalysisResult ──────────────────────────────────────────────────
// Z20 — Defensive sanitizer for AnalysisResult.
//
// The cached AnalysisResult shape evolves (v1 → v2 added Z1/Z2 fields).
// Old caches, malformed Gemini outputs, imported data, and failed parses
// can all leave required fields missing. When the UI tries to access
// `result.hookBreakdown.hookText` directly, it throws → ErrorBoundary
// catches → user sees "Không thể tải trang".
//
// This module wraps any AnalysisResult-shaped input and guarantees every
// required field is present with a safe default. No component should
// render directly from raw cache.data — always pipe through sanitize().
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AnalysisResult, HookBreakdown, Scorecard, StructureMap,
  PsychologyPersuasion, TranscriptLine, VisualFrame, Improvement,
  Variation, VariationType,
} from '../types'

// Sentinel safe defaults — used when raw data is missing/malformed.
const EMPTY_HOOK: HookBreakdown = {
  hookText: '',
  technique: '',
  whyItWorks: '',
  adaptableTemplate: '',
}

const EMPTY_SCORECARD: Scorecard = {
  scores: [],
  analystNote: '',
}

const EMPTY_STRUCTURE: StructureMap = {
  runtime: '',
  pacing: '',
  beats: [],
}

const EMPTY_PSYCHOLOGY: PsychologyPersuasion = {
  primaryLevers: [],
  targetingSignals: [],
}

// ── Per-field guards ────────────────────────────────────────────────────────

function safeString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function safeHookBreakdown(raw: unknown): HookBreakdown {
  if (!raw || typeof raw !== 'object') return EMPTY_HOOK
  const r = raw as Partial<HookBreakdown>
  return {
    hookText:          safeString(r.hookText),
    technique:         safeString(r.technique),
    whyItWorks:        safeString(r.whyItWorks),
    adaptableTemplate: safeString(r.adaptableTemplate),
  }
}

function safeScorecard(raw: unknown): Scorecard {
  if (!raw || typeof raw !== 'object') return EMPTY_SCORECARD
  const r = raw as Partial<Scorecard>
  return {
    scores: safeArray(r.scores),
    analystNote: safeString(r.analystNote),
  }
}

function safeStructure(raw: unknown): StructureMap {
  if (!raw || typeof raw !== 'object') return EMPTY_STRUCTURE
  const r = raw as Partial<StructureMap>
  return {
    runtime: safeString(r.runtime),
    pacing:  safeString(r.pacing),
    beats:   safeArray(r.beats),
  }
}

function safePsychology(raw: unknown): PsychologyPersuasion {
  if (!raw || typeof raw !== 'object') return EMPTY_PSYCHOLOGY
  const r = raw as Partial<PsychologyPersuasion>
  return {
    primaryLevers:    safeArray<string>(r.primaryLevers),
    targetingSignals: safeArray<string>(r.targetingSignals),
  }
}

function safeTranscript(raw: unknown): TranscriptLine[] {
  const arr = safeArray<unknown>(raw)
  return arr.map((line) => {
    if (!line || typeof line !== 'object') return { timestamp: '', text: '' }
    const l = line as Partial<TranscriptLine>
    return {
      timestamp: safeString(l.timestamp),
      text:      safeString(l.text),
    }
  })
}

function safeVisualPlaybook(raw: unknown): VisualFrame[] {
  const arr = safeArray<unknown>(raw)
  return arr.map((frame) => {
    if (!frame || typeof frame !== 'object') return { timestamp: '', description: '', prompt: '' }
    const f = frame as Partial<VisualFrame>
    return {
      timestamp:   safeString(f.timestamp),
      description: safeString(f.description),
      prompt:      safeString(f.prompt),
    }
  })
}

function safeImprovements(raw: unknown): Improvement[] {
  const arr = safeArray<unknown>(raw)
  return arr.map((imp) => {
    if (!imp || typeof imp !== 'object') return { weakness: '', fix: '' }
    const i = imp as Partial<Improvement>
    return {
      weakness: safeString(i.weakness),
      fix:      safeString(i.fix),
    }
  })
}

function safeVariation(raw: unknown): Variation | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Partial<Variation>
  // Drop variations missing both id + nameVi — they're too malformed to render
  if (!v.id && !v.nameVi) return null
  return {
    id:             safeString(v.id) || `var-${Math.random().toString(36).slice(2, 9)}`,
    type:           (v.type as VariationType) ?? 'emotional',
    nameVi:         safeString(v.nameVi),
    hookText:       safeString(v.hookText),
    scriptText:     safeString(v.scriptText),
    ctaText:        safeString(v.ctaText),
    toneBreakdown:  safeString(v.toneBreakdown),
    recommendedFor: safeString(v.recommendedFor),
  }
}

function safeVariations(raw: unknown): Variation[] | undefined {
  if (raw === undefined) return undefined
  const arr = safeArray<unknown>(raw)
  return arr.map(safeVariation).filter((v): v is Variation => v !== null)
}

// ── Public sanitizer ────────────────────────────────────────────────────────

/**
 * Take any AnalysisResult-shaped input (cached, parsed, imported, etc.) and
 * return a value where every REQUIRED field is guaranteed present. Optional
 * Z1/Z2 fields (decisionLayer, adAngle, retentionTimeline, …) are preserved
 * as-is if present, omitted if missing.
 *
 * Never throws — even on completely garbage input, returns an empty-but-
 * renderable AnalysisResult shape.
 */
export function sanitizeAnalysisResult(raw: unknown): AnalysisResult {
  if (!raw || typeof raw !== 'object') {
    // Total garbage → return an empty shell so the UI can still render its
    // empty state instead of crashing
    return {
      scorecard: EMPTY_SCORECARD,
      transcript: [],
      hookBreakdown: EMPTY_HOOK,
      structureMap: EMPTY_STRUCTURE,
      psychology: EMPTY_PSYCHOLOGY,
      visualPlaybook: [],
      improvements: [],
      reconstructionPrompt: '',
    }
  }

  const r = raw as Partial<AnalysisResult>
  return {
    // Required fields — guaranteed safe defaults
    scorecard:            safeScorecard(r.scorecard),
    transcript:           safeTranscript(r.transcript),
    hookBreakdown:        safeHookBreakdown(r.hookBreakdown),
    structureMap:         safeStructure(r.structureMap),
    psychology:           safePsychology(r.psychology),
    visualPlaybook:       safeVisualPlaybook(r.visualPlaybook),
    improvements:         safeImprovements(r.improvements),
    reconstructionPrompt: safeString(r.reconstructionPrompt),
    // Optional Z1/Z2 fields — pass through if present (already optional in type)
    decisionLayer:    r.decisionLayer,
    adAngle:          r.adAngle,
    marketAwareness:  r.marketAwareness,
    funnelPosition:   r.funnelPosition,
    scalingPotential: r.scalingPotential,
    retentionTimeline: r.retentionTimeline,
    // Optional Z4 variations — sanitized
    variations: safeVariations(r.variations),
  }
}

// ── Safe localStorage parse ────────────────────────────────────────────────
/** Parse a JSON value from localStorage. Returns `fallback` on any error
 *  (missing key, malformed JSON, etc.). Never throws. */
export function safeParseLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
