// ── QC Engine ─────────────────────────────────────────────────────────────────
// Audits an AI-generated image against the locked references (avatar + product)
// via a single Gemini Vision call. Returns 4 numeric scores (0-100) + a
// failure classification + a Vietnamese user-facing note.
//
// One Gemini call evaluates all 4 axes at once for efficiency:
//   1. FACE MATCH       (vs avatar reference)
//   2. PRODUCT MATCH    (vs product reference)
//   3. OCR LABEL MATCH  (label text + logo similarity)
//   4. REALISM          (no AI sheen, no studio look, no distorted hands)
//
// Output: strict JSON only — parsed into a QcScore.
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiVision } from '../../../../utils/gemini'
import type { QcScore, QcThresholds, FailureClassification } from '../types'
import { DEFAULT_QC_THRESHOLDS } from '../types'

// ── Image loading helper (URL → base64) ──────────────────────────────────────

async function imageUrlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) throw new Error('QC: data URL không hợp lệ')
    return { mimeType: match[1], base64: match[2] }
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`QC: không tải được ảnh (${res.status})`)
  const blob = await res.blob()
  const mimeType = blob.type || 'image/jpeg'
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return { base64: btoa(binary), mimeType }
}

// ── Gemini QC system prompt ──────────────────────────────────────────────────

const QC_SYSTEM_PROMPT = `You are a strict QC auditor for an AI-generated e-commerce / UGC photo.
You receive THREE images in order:
  IMAGE A — the AI-GENERATED output to audit
  IMAGE B — the AVATAR REFERENCE (the person who should appear in image A)
  IMAGE C — the PRODUCT REFERENCE (the product that should appear in image A)

Your job is to score 4 dimensions (0-100), classify the dominant failure (if any),
and return STRICT JSON only. No markdown fences, no preamble, no explanation outside the JSON.

SCORING RUBRIC:
  • faceScore (0-100): Does IMAGE A's person match IMAGE B?
    Compare face shape, eyes (color + shape), nose, lips, jawline, skin tone, age range,
    ethnicity, hijab style + color OR hairstyle/hair color.
    100 = clearly the same individual. 0 = obviously a different person.

  • productScore (0-100): Does IMAGE A's product match IMAGE C?
    Compare container TYPE (jar/bottle/tube/box/sachet), shape proportions
    (squat vs tall), dominant colors, cap color, overall packaging design.
    100 = exact same packaging. 0 = completely different product.
    This is the MOST IMPORTANT axis — be strict.

  • ocrScore (0-100): Does IMAGE A's product label/logo text match IMAGE C?
    Read the text on both labels. Compare brand name, product name, key tagline,
    logo shape/style. 100 = label text identical. 0 = no readable text matches.

  • realismScore (0-100): Does IMAGE A look like an authentic UGC iPhone photo?
    Penalize: AI sheen / plastic skin, distorted fingers, fake reflections,
    studio commercial look, cinematic dramatic lighting, stock-photo feel,
    over-beautified face, heavy bokeh on product, AI-generated artifacts.
    100 = indistinguishable from real iPhone UGC. 0 = clearly AI-generated studio shot.

FAILURE CLASSIFICATION (single dominant issue — pick from this list):
  "ok" | "wrong-product" | "wrong-label" | "redesigned-packaging" |
  "wrong-hijab" | "wrong-ethnicity" | "wrong-age" | "fake-hands" |
  "studio-look" | "cinematic-lighting" | "stock-photo-vibe" | "plastic-skin" |
  "multiple-issues"

OUTPUT FORMAT — exact JSON shape:
{
  "faceScore": <int 0-100>,
  "productScore": <int 0-100>,
  "ocrScore": <int 0-100>,
  "realismScore": <int 0-100>,
  "failureReasons": ["short English phrase", ...],
  "classification": "<one value from the list above>",
  "recommendation": "<short English advice for the next attempt>",
  "notesVi": "<1-2 short Vietnamese sentences for the user, e.g. 'Sản phẩm sai bao bì hoàn toàn — model render ra chai khác.'>"
}`

// ── Response parser ──────────────────────────────────────────────────────────

interface RawQcResponse {
  faceScore?: number
  productScore?: number
  ocrScore?: number
  realismScore?: number
  failureReasons?: string[]
  classification?: string
  recommendation?: string
  notesVi?: string
}

function parseQcResponse(raw: string): RawQcResponse {
  let cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1)
  try {
    return JSON.parse(cleaned) as RawQcResponse
  } catch (err) {
    console.error('[parseQcResponse] JSON parse failed. Raw:', raw.slice(0, 400))
    throw new Error(`Gemini QC trả về không phải JSON: ${(err as Error).message}`)
  }
}

function clampScore(n: number | undefined, fallback: number = 50): number {
  if (typeof n !== 'number' || !isFinite(n)) return fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

const VALID_CLASSIFICATIONS: FailureClassification[] = [
  'ok', 'wrong-product', 'wrong-label', 'redesigned-packaging',
  'wrong-hijab', 'wrong-ethnicity', 'wrong-age', 'fake-hands',
  'studio-look', 'cinematic-lighting', 'stock-photo-vibe', 'plastic-skin',
  'multiple-issues',
]

function clampClassification(c: string | undefined): FailureClassification {
  if (c && (VALID_CLASSIFICATIONS as string[]).includes(c)) return c as FailureClassification
  return 'multiple-issues'
}

// ── Threshold check ──────────────────────────────────────────────────────────

export function checkPass(score: Omit<QcScore, 'passed' | 'retryCount' | 'notes' | 'failureReasons' | 'classification' | 'recommendation'>, thresholds: QcThresholds): boolean {
  return (
    score.faceScore >= thresholds.faceScore &&
    score.productScore >= thresholds.productScore &&
    score.ocrScore >= thresholds.ocrScore &&
    score.realismScore >= thresholds.realismScore
  )
}

// ── Main QC call ─────────────────────────────────────────────────────────────

/**
 * Audit a generated image against the avatar + product references.
 * Returns a complete QcScore with pass/fail + per-axis scores + classification.
 *
 * Cost: 1 Gemini Vision call (~$0.001-0.002 per audit).
 * Latency: ~3-8 seconds.
 */
export async function qcImage(params: {
  geminiKey: string
  generatedImageUrl: string
  avatarImageUrl: string
  productImageUrl: string
  retryCount?: number
  thresholds?: QcThresholds
}): Promise<QcScore> {
  const thresholds = params.thresholds ?? DEFAULT_QC_THRESHOLDS

  // Load all 3 images in parallel
  const [gen, avatar, product] = await Promise.all([
    imageUrlToBase64(params.generatedImageUrl),
    imageUrlToBase64(params.avatarImageUrl),
    imageUrlToBase64(params.productImageUrl),
  ])

  const response = await directGeminiVision({
    apiKey: params.geminiKey,
    parts: [
      { text: 'IMAGE A — AI-GENERATED OUTPUT TO AUDIT:' },
      { inlineData: { mimeType: gen.mimeType, data: gen.base64 } },
      { text: 'IMAGE B — AVATAR REFERENCE:' },
      { inlineData: { mimeType: avatar.mimeType, data: avatar.base64 } },
      { text: 'IMAGE C — PRODUCT REFERENCE:' },
      { inlineData: { mimeType: product.mimeType, data: product.base64 } },
      { text: 'Audit image A against B and C. Return strict JSON only as specified.' },
    ],
    systemInstruction: QC_SYSTEM_PROMPT,
    maxOutputTokens: 1024,
    model: 'gemini-2.5-flash',
  })

  const parsed = parseQcResponse(response)

  const faceScore = clampScore(parsed.faceScore)
  const productScore = clampScore(parsed.productScore)
  const ocrScore = clampScore(parsed.ocrScore)
  const realismScore = clampScore(parsed.realismScore)

  const passed = checkPass({ faceScore, productScore, ocrScore, realismScore }, thresholds)

  return {
    passed,
    retryCount: params.retryCount ?? 0,
    faceScore,
    productScore,
    ocrScore,
    realismScore,
    failureReasons: Array.isArray(parsed.failureReasons) ? parsed.failureReasons.slice(0, 5) : [],
    classification: clampClassification(parsed.classification),
    recommendation: (parsed.recommendation ?? '').slice(0, 300),
    notes: (parsed.notesVi ?? '').slice(0, 200),
  }
}

// ── Score → Vietnamese badge label helper ────────────────────────────────────

export type QcBadgeStatus = 'pass' | 'warn' | 'fail-product' | 'fail-face' | 'fail-other'

export function badgeStatus(score: QcScore, thresholds: QcThresholds = DEFAULT_QC_THRESHOLDS): QcBadgeStatus {
  if (score.passed) return 'pass'
  if (score.productScore < thresholds.productScore) return 'fail-product'
  if (score.faceScore < thresholds.faceScore) return 'fail-face'
  // Near-pass: all axes within 5 points
  const nearPass =
    score.faceScore >= thresholds.faceScore - 5 &&
    score.productScore >= thresholds.productScore - 5 &&
    score.ocrScore >= thresholds.ocrScore - 5 &&
    score.realismScore >= thresholds.realismScore - 5
  if (nearPass) return 'warn'
  return 'fail-other'
}

export const BADGE_LABEL_VI: Record<QcBadgeStatus, string> = {
  'pass': '🟢 Đạt',
  'warn': '🟡 Tạm ổn',
  'fail-product': '🔴 Sai sản phẩm',
  'fail-face': '🔴 Sai khuôn mặt',
  'fail-other': '🔴 Không đạt',
}
