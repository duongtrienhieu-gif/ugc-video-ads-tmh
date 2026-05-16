// ── QC Retry Orchestrator ────────────────────────────────────────────────────
// Wraps an image-generation function in a QC + smart-retry loop:
//
//   try {
//     gen image
//     qc image vs references
//     if pass → return
//     if fail → analyze failure → pick overrides → regen
//   } while retries < maxRetries
//
// Smart retry strategy:
//   • product fail   → bumpProductLock (extra ABSOLUTE BAN + duplicate ref slot)
//   • face fail      → bumpIdentityLock (force strict tier)
//   • realism fail   → bumpRealism (extra "raw unedited iphone" emphasis)
//   • OCR fail       → bumpLabelLock (preserve text+logo explicitly)
//
// Intermediate failed attempts are NOT exposed to the user — only the final
// result is returned. The onAttempt callback fires for UI progress updates.
// ─────────────────────────────────────────────────────────────────────────────

import { qcImage } from './qcEngine'
import type {
  QcScore,
  SectionOverrides,
  FailureClassification,
  QcThresholds,
  ConsistencyConfig,
} from '../types'
import { computeQcThresholds } from '../types'

// ── Map failure classification → which sections to bump on retry ─────────────

function bumpsForFailure(classification: FailureClassification): SectionOverrides {
  switch (classification) {
    case 'wrong-product':
    case 'redesigned-packaging':
      return { bumpProductLock: true }

    case 'wrong-label':
      return { bumpProductLock: true, bumpLabelLock: true }

    case 'wrong-hijab':
    case 'wrong-ethnicity':
    case 'wrong-age':
      return { bumpIdentityLock: true }

    case 'studio-look':
    case 'cinematic-lighting':
    case 'stock-photo-vibe':
    case 'plastic-skin':
      return { bumpRealism: true }

    case 'fake-hands':
      return { bumpRealism: true }  // Add anti-distortion negatives

    case 'multiple-issues':
      // Hit everything
      return { bumpProductLock: true, bumpIdentityLock: true, bumpRealism: true, bumpLabelLock: true }

    case 'ok':
    default:
      return {}
  }
}

// Combine two SectionOverrides into one (logical OR per flag)
function mergeOverrides(a: SectionOverrides, b: SectionOverrides): SectionOverrides {
  return {
    bumpProductLock: a.bumpProductLock || b.bumpProductLock,
    bumpIdentityLock: a.bumpIdentityLock || b.bumpIdentityLock,
    bumpRealism: a.bumpRealism || b.bumpRealism,
    bumpLabelLock: a.bumpLabelLock || b.bumpLabelLock,
  }
}

// ── Main orchestrator ────────────────────────────────────────────────────────

export interface QcAttempt {
  attemptIdx: number
  imageUrl: string
  qc: QcScore
  overrides: SectionOverrides
}

export interface QcLoopResult {
  finalImageUrl: string
  finalQc: QcScore
  attempts: QcAttempt[]
  /** True iff finalQc.passed, OR retry budget exhausted and we return best-so-far */
  passedOnLastTry: boolean
}

export interface QcLoopParams {
  geminiKey: string
  avatarImageUrl: string
  productImageUrl: string
  consistency: ConsistencyConfig
  /** Override thresholds (else computed from consistency strength) */
  thresholds?: QcThresholds
  /** The image-gen function — receives overrides each iteration and returns a new image URL */
  generateFn: (overrides: SectionOverrides, attemptIdx: number) => Promise<string>
  /** Max regen attempts (default uses consistency.maxRetries) */
  maxRetries?: number
  /** Progress callback — fires once per attempt with intermediate QC result */
  onAttempt?: (attempt: QcAttempt) => void
}

/**
 * Generate an image, QC it, retry with smart strength bumps on fail.
 * Returns the final accepted image (or the best-scoring fallback if budget exhausted).
 */
export async function runQcLoop(params: QcLoopParams): Promise<QcLoopResult> {
  const maxRetries = params.maxRetries ?? params.consistency.maxRetries
  const thresholds = params.thresholds ?? computeQcThresholds(params.consistency.strength)

  const attempts: QcAttempt[] = []
  // Accumulator: every failure adds to the overrides so retry N has the union of all prior bumps
  let overrides: SectionOverrides = {}

  for (let i = 0; i <= maxRetries; i++) {
    // 1. Generate
    const imageUrl = await params.generateFn(overrides, i)

    // 2. QC
    const qc = await qcImage({
      geminiKey: params.geminiKey,
      generatedImageUrl: imageUrl,
      avatarImageUrl: params.avatarImageUrl,
      productImageUrl: params.productImageUrl,
      retryCount: i,
      thresholds,
    })

    const attempt: QcAttempt = { attemptIdx: i, imageUrl, qc, overrides: { ...overrides } }
    attempts.push(attempt)
    params.onAttempt?.(attempt)

    // 3. Pass → done
    if (qc.passed) {
      return {
        finalImageUrl: imageUrl,
        finalQc: qc,
        attempts,
        passedOnLastTry: true,
      }
    }

    // 4. Fail → if out of retries, return best-so-far
    if (i === maxRetries) break

    // 5. Smart-retry: merge new bumps into running overrides
    const newBumps = bumpsForFailure(qc.classification)
    overrides = mergeOverrides(overrides, newBumps)
  }

  // Exhausted retries — pick the best-scoring attempt (weighted: product > face > realism > ocr)
  const scoreAttempt = (a: QcAttempt): number =>
    a.qc.productScore * 3 + a.qc.faceScore * 2 + a.qc.realismScore * 1.5 + a.qc.ocrScore * 1
  const best = attempts.reduce((a, b) => (scoreAttempt(b) > scoreAttempt(a) ? b : a))

  return {
    finalImageUrl: best.imageUrl,
    finalQc: best.qc,
    attempts,
    passedOnLastTry: best.qc.passed,
  }
}
