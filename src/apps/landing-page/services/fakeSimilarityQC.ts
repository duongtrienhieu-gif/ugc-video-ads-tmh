// fakeSimilarityQC.ts — Phase H3
//
// Gemini Vision-based detector for "AI clone look" within a section.
// Compares pairs of rendered images and reports a similarity score 0-100
// across the axes that matter for authenticity:
//   • Composition / camera angle similarity
//   • Hand pose / body posture similarity
//   • Background context similarity
//   • Lighting direction similarity
//   • Product placement similarity
//
// Strategy: on-demand only, never auto-regenerates. Showing a warning chip
// next to suspicious images is cheaper + safer than blowing user credit
// re-rendering. User decides whether to manually retry.
//
// Cost: 1 Gemini Vision call per pair compared. ~$0.001 each. For a 5-image
// section, scanning consecutive pairs = 4 calls ≈ $0.004. Full N² scan
// would be 10 calls ≈ $0.01 — done only when user explicitly asks.

import { directGeminiVision } from '../../../utils/gemini'
import { useSettingsStore } from '../../../stores/settingsStore'
import { getUrl, isAssetRef } from '../../../utils/assetStore'

// ── Types ──────────────────────────────────────────────────────────────────

export interface SimilarityAxes {
  /** 0-100 — high = composition / framing too similar */
  composition: number
  /** 0-100 — high = hand / body pose nearly identical */
  bodyPose: number
  /** 0-100 — high = background context cloned */
  background: number
  /** 0-100 — high = same lighting direction / mood */
  lighting: number
  /** 0-100 — high = product placement + angle cloned */
  productPlacement: number
}

export interface SimilarityResult {
  /** Aggregate score 0-100. >70 = warn. >85 = strong clone. */
  overall: number
  axes: SimilarityAxes
  /** VN human-readable summary — shown as tooltip on warning chip. */
  summaryVi: string
  /** True when this pair is flagged as needing regeneration. */
  flagged: boolean
}

export interface PairCheck {
  imageARef: string
  imageBRef: string
  result: SimilarityResult
}

export interface SectionScanReport {
  sectionType: string
  sectionIdx: number
  /** Pairs that were compared. */
  pairs: PairCheck[]
  /** Indices of images that appeared in any flagged pair. */
  flaggedImageIdx: number[]
  /** Section-level severity: max overall across pairs. */
  maxSimilarity: number
}

// ── Gemini Vision prompt ──────────────────────────────────────────────────

const SIMILARITY_PROMPT = `You are an authenticity auditor for an ecommerce landing page. Two images
from the SAME advertising pack are attached. Both should look like authentic,
real-life captures taken on DIFFERENT days at DIFFERENT angles. If they look
like AI-generated variants of the same shoot ("same hand pose / same
background / same bottle angle / same lighting"), that's a FAIL — the user
will spot them as fake.

Score 0-100 on each axis, where HIGHER = MORE similar (worse for authenticity):

  composition       — framing, camera angle, subject position
  bodyPose          — hand position, posture, body orientation (0 if no person in either)
  background        — room, surface, props, context
  lighting          — direction, color temperature, mood
  productPlacement  — bottle rotation, distance from camera, label visibility

Output STRICT JSON only (no markdown, no commentary):
{
  "composition": 0,
  "bodyPose": 0,
  "background": 0,
  "lighting": 0,
  "productPlacement": 0,
  "summaryVi": "TIẾNG VIỆT: 1-2 câu giải thích — đâu giống đâu khác"
}`

// ── Helpers ────────────────────────────────────────────────────────────────

async function refToBase64(ref: string): Promise<{ data: string; mimeType: string } | null> {
  let url: string | null = null
  if (ref.startsWith('http')) url = ref
  else if (isAssetRef(ref)) url = await getUrl(ref)
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const data = await blobToBase64(blob)
    return { data, mimeType: blob.type || 'image/jpeg' }
  } catch {
    return null
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip data URL prefix
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

function aggregateScore(axes: SimilarityAxes): number {
  return Math.round(
    (axes.composition * 0.25)
    + (axes.bodyPose * 0.20)
    + (axes.background * 0.20)
    + (axes.lighting * 0.15)
    + (axes.productPlacement * 0.20),
  )
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Compare ONE pair of images. Returns null if either image cannot be loaded
 * or Gemini fails — caller should treat as inconclusive (don't flag).
 */
export async function comparePair(imageARef: string, imageBRef: string): Promise<SimilarityResult | null> {
  const geminiKey = useSettingsStore.getState().getGeminiApiKey()
  if (!geminiKey) return null

  const [a, b] = await Promise.all([refToBase64(imageARef), refToBase64(imageBRef)])
  if (!a || !b) return null

  try {
    const raw = await directGeminiVision({
      apiKey: geminiKey,
      parts: [
        { inlineData: { mimeType: a.mimeType, data: a.data } },
        { inlineData: { mimeType: b.mimeType, data: b.data } },
        { text: SIMILARITY_PROMPT },
      ],
    })
    const parsed = parseGeminiJson(raw)
    if (!parsed) return null
    const axes: SimilarityAxes = {
      composition:       clampScore(parsed.composition),
      bodyPose:          clampScore(parsed.bodyPose),
      background:        clampScore(parsed.background),
      lighting:          clampScore(parsed.lighting),
      productPlacement:  clampScore(parsed.productPlacement),
    }
    const overall = aggregateScore(axes)
    return {
      overall,
      axes,
      summaryVi: typeof parsed.summaryVi === 'string' ? parsed.summaryVi : '',
      flagged: overall >= 70,
    }
  } catch (err) {
    console.warn('[fakeSimilarityQC] compare failed:', err)
    return null
  }
}

function parseGeminiJson(raw: string): Record<string, unknown> | null {
  let s = raw.trim()
  s = s.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim()
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  try {
    return JSON.parse(s) as Record<string, unknown>
  } catch {
    return null
  }
}

function clampScore(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * Scan a whole section — compare each consecutive pair (O(N) not O(N²)).
 * For 5 images that's 4 Gemini calls. Yields PairCheck results as they
 * complete so UI can update progressively.
 */
export async function scanSection(
  sectionType: string,
  sectionIdx: number,
  imageRefs: Array<{ ref: string; idx: number }>,
  onPairResult?: (pair: PairCheck) => void,
): Promise<SectionScanReport> {
  const report: SectionScanReport = {
    sectionType,
    sectionIdx,
    pairs: [],
    flaggedImageIdx: [],
    maxSimilarity: 0,
  }
  if (imageRefs.length < 2) return report

  for (let i = 0; i < imageRefs.length - 1; i++) {
    const a = imageRefs[i]
    const b = imageRefs[i + 1]
    const result = await comparePair(a.ref, b.ref)
    if (!result) continue
    const pair: PairCheck = { imageARef: a.ref, imageBRef: b.ref, result }
    report.pairs.push(pair)
    onPairResult?.(pair)
    if (result.overall > report.maxSimilarity) report.maxSimilarity = result.overall
    if (result.flagged) {
      if (!report.flaggedImageIdx.includes(a.idx)) report.flaggedImageIdx.push(a.idx)
      if (!report.flaggedImageIdx.includes(b.idx)) report.flaggedImageIdx.push(b.idx)
    }
  }
  return report
}
