// ── Authenticity QC Type Contracts (P7) ─────────────────────────────────────
//
// Engine-agnostic QC types. Each engine group's QC implementation
// returns the same QCVerdict shape so the orchestrator + analytics
// layer never have to know which group produced an asset.
//
// QC is two-tier:
//   1. LOCAL HEURISTICS — synchronous checks on the blob / metadata
//      (mime type, size, dimensions, JPEG marker, banned aesthetics).
//      Always runs. Zero cost. Catches Figma-clean exports + corrupt
//      blobs + dimension drift instantly.
//   2. VISION QC — opt-in Gemini Vision pass that asks "is this a
//      believable screenshot / photo?". Costs one Gemini call. Caller
//      decides via params.options.runVisionQC.
//
// Both tiers contribute to the same QCVerdict.

export type QCSeverity = 'info' | 'warning' | 'error'

/** A single QC finding — a check that flagged. */
export interface QCIssue {
  /** Stable code for analytics / dedup. Eg "MISSING_STATUS_BAR". */
  code: string
  /** Human-readable explanation. */
  message: string
  /** Severity — info/warning don't fail QC; error does. */
  severity: QCSeverity
  /** Which tier raised it. */
  tier: 'local' | 'vision'
}

/** Engine-agnostic QC result attached to GeneratedAsset.metadata. */
export interface QCVerdict {
  /** Overall pass — false if ANY error-severity issue exists. */
  passed: boolean
  /** 0-100 confidence score. 100 = pristine, 0 = clearly fake. */
  overall: number
  /** All findings — even infos / warnings, for downstream analytics. */
  issues: QCIssue[]
  /** Whether the vision tier ran. null when caller did not request it. */
  visionPass: boolean | null
  /** When QC ran (ms epoch). */
  ranAt: number
}

/** Caller knobs that drive the QC pipeline. Read from params.options. */
export interface QCRunOptions {
  /** Whether to invoke the Gemini Vision tier (extra Gemini call). */
  runVisionQC?: boolean
  /** Override the minimum pass score (default 70 for ui-native). */
  minPassScore?: number
  /** Inject a Gemini API key for the vision tier — falls back to settings store. */
  geminiApiKey?: string
}
