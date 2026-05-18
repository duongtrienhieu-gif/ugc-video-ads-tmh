// ── Vision QC Tier (P7) ─────────────────────────────────────────────────────
//
// Opt-in Gemini Vision pass for UI-native screenshots. Asks the model
// to evaluate authenticity along axes the local heuristics cannot see
// (font weight realism, status bar pixel-accuracy, conversation flow
// believability, etc).
//
// Costs one Gemini call per asset. Caller opts in via
// params.options.runVisionQC = true.
//
// The vision pass returns strict JSON; if parsing fails we degrade
// gracefully (mark visionPass null + emit a warning issue) rather than
// blocking the asset.

import type { QCIssue } from '../../types/qc'
import type { UINativeAuthenticity, UINativePlatform } from '../../types/uiNative'
import { directGeminiVision } from '../../../../utils/gemini'

export interface VisionQCInput {
  apiKey: string
  /** The rendered blob (must be JPEG / PNG). */
  blob: Blob
  /** Platform — drives the rubric. */
  platform: UINativePlatform
  /** Authenticity ruleset from the module. */
  authenticity: UINativeAuthenticity
}

export interface VisionQCResult {
  visionPass: boolean
  score: number  // 0-100
  issues: QCIssue[]
}

const SYSTEM_INSTRUCTION =
  'You are an authenticity auditor for synthetic mobile-screenshot assets used in UGC '
  + 'advertising. You receive ONE image and must judge whether it would pass as a real '
  + 'screenshot from the named platform. Output STRICT JSON only — no prose, no markdown '
  + 'fences. Be critical but practical: a real screenshot from a phone has minor '
  + 'imperfections (slight asymmetric padding, jpeg ringing, off-by-a-pixel crop) — those '
  + 'are GOOD signs, not bad. What is BAD: missing status bar, perfect Figma edges, '
  + 'glaringly fake typography, wrong platform palette, perfect rgba transparency.'

interface LLMResponse {
  /** Overall pass — true if the image would pass at a 1-second glance. */
  pass: boolean
  /** 0-100 confidence score. */
  score: number
  /** Specific findings — used to generate QCIssue entries. */
  findings: {
    rule: string
    severity: 'info' | 'warning' | 'error'
    detail: string
  }[]
}

function buildRubricPrompt(platform: UINativePlatform, a: UINativeAuthenticity): string {
  const required: string[] = []
  if (a.requireStatusBar)            required.push('a phone status bar at the top (battery / signal / time)')
  if (a.requireRealisticTimestamps)  required.push('realistic timestamps (not 00:00 / 12:00 placeholders)')
  if (a.requireImperfectCrop)        required.push('slight imperfect crop (a few pixels off — real screenshots are NOT pixel-perfect)')
  if (a.requireJpegCompression)      required.push('visible JPEG compression artifacts (rings around text, color banding)')

  return [
    `Evaluate this image as an alleged ${platform} screenshot.`,
    '',
    'It MUST exhibit ALL of the following to pass:',
    ...required.map((r, i) => `  ${i + 1}. ${r}`),
    '',
    'It MUST NOT exhibit any of these banned aesthetics:',
    ...(a.bannedAesthetics ?? []).map((b) => `  ✗ ${b}`),
    '',
    'Return STRICT JSON — no markdown fence, no prose:',
    '{',
    '  "pass": true,',
    '  "score": 86,',
    '  "findings": [',
    '    { "rule": "<one of: status-bar | timestamps | crop | compression | palette | typography | banned-aesthetic>",',
    '      "severity": "info" | "warning" | "error",',
    '      "detail": "<one-sentence specific observation>" }',
    '  ]',
    '}',
    '',
    'score guidance:',
    '  90-100 → indistinguishable from real screenshot',
    '  70-89  → would pass at a 1-second glance',
    '  50-69  → looks synthetic on closer inspection',
    '  0-49   → obvious fake / Figma export / unbranded',
    '',
    'pass=true ONLY if score >= 70 AND there is no error-severity finding.',
  ].join('\n')
}

async function blobToInlineData(blob: Blob): Promise<{ mimeType: string; data: string }> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return { mimeType: blob.type || 'image/jpeg', data: btoa(binary) }
}

function stripJsonFence(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
}

/**
 * Run a Gemini Vision QC pass. On any error (network, parse, etc) returns
 * a soft-fail result with visionPass=false + a single QCIssue rather
 * than throwing — the dispatcher proceeds and the asset is still saved.
 */
export async function runVisionQC(input: VisionQCInput): Promise<VisionQCResult> {
  const inline = await blobToInlineData(input.blob)
  const prompt = buildRubricPrompt(input.platform, input.authenticity)

  let raw: string
  try {
    raw = await directGeminiVision({
      apiKey: input.apiKey,
      parts: [
        { inlineData: { mimeType: inline.mimeType, data: inline.data } },
        { text: prompt },
      ],
      systemInstruction: SYSTEM_INSTRUCTION,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    })
  } catch (err) {
    return {
      visionPass: false,
      score: 0,
      issues: [{
        code: 'VISION_CALL_FAILED',
        message: `Gemini vision QC call failed: ${(err as Error).message}`,
        severity: 'warning',
        tier: 'vision',
      }],
    }
  }

  let parsed: LLMResponse
  try {
    parsed = JSON.parse(stripJsonFence(raw).trim()) as LLMResponse
  } catch (err) {
    return {
      visionPass: false,
      score: 0,
      issues: [{
        code: 'VISION_PARSE_FAILED',
        message: `Gemini vision QC response did not parse: ${(err as Error).message}`,
        severity: 'warning',
        tier: 'vision',
      }],
    }
  }

  const issues: QCIssue[] = (parsed.findings ?? []).map((f) => ({
    code: `VISION_${f.rule.toUpperCase().replace(/-/g, '_')}`,
    message: f.detail,
    severity: f.severity,
    tier: 'vision',
  }))

  return {
    visionPass: parsed.pass === true,
    score: clampScore(parsed.score),
    issues,
  }
}

function clampScore(s: unknown): number {
  const n = typeof s === 'number' ? s : Number(s ?? 0)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}
