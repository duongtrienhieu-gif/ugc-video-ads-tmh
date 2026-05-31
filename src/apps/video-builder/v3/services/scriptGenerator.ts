// ── Script Generator (Ad Brain) ──────────────────────────────────────────────
// Z31 §3-4-11 — Gemini-powered TikTok-native ad script generation.
//
// Takes the user's structure + angle + target duration + product context
// and produces:
//   1. A 5-block script (HOOK / PAIN / DISCOVERY / BENEFIT / CTA)
//   2. 3 hook variants (emotional / shock / curiosity) the user picks from
//
// Output JSON is strict-mode (responseMimeType='application/json') so
// parse failures are eliminated. Validation catches the rare malformed
// payload and reports a friendly error.
//
// Per-block target durations come from voiceTimingEstimator.allocateBlockBudgets
// → fed into Gemini as "aim for ~Xs per block" so the output naturally
// hits the target without post-hoc trimming.
//
// IMPORTANT: This service does NOT call ElevenLabs. Voice synthesis
// happens in a separate step. This service is text-only.
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import type {
  AdStructure, AdAngle, ScriptTargetDurationSec,
  GeneratedScript, ScriptBlock, HookVariant, ScriptBlockId, HookStyle,
  ScriptLang,
} from '../types'
import { SCRIPT_LANG_GEMINI_NAME } from '../types'
import { AD_STRUCTURES } from './adStructures'
import { AD_ANGLES } from './adAngles'
import {
  allocateBlockBudgets, estimateReadDurationSec,
} from './voiceTimingEstimator'

// ── Public API ─────────────────────────────────────────────────────────────

export interface GenerateScriptParams {
  geminiKey: string
  structure: AdStructure
  angle: AdAngle
  targetDurationSec: ScriptTargetDurationSec
  /** Product name to weave into the script */
  productName: string
  /** Product short description (1-2 lines) — gives Gemini context */
  productPitch: string
  /** Optional creator description (name / vibe) — helps Gemini write
   *  in-character. E.g. "Malaysian Muslim mom, late-30s, calm voice" */
  creatorDescription?: string
  /** Output language — locks the WHOLE generation to ONE language.
   *  No auto-detect, no mixing. Default decided by the caller (Bahasa Malaysia). */
  lang: ScriptLang
  /** TRUE = segment the user's own pasted script VERBATIM into the 5 roles
   *  (Gemini never rewrites). FALSE = Gemini writes a fresh script. */
  useOwnScript?: boolean
  /** Raw pasted script — required when useOwnScript is TRUE. */
  ownScriptText?: string
}

export interface GenerateScriptResult {
  script: GeneratedScript
  hookVariants: HookVariant[]
}

/**
 * Z31 — Generate a full ad script with 3 hook variants.
 * Single Gemini call; strict JSON output; auto-retry on parse fail.
 */
export async function generateScript(
  params: GenerateScriptParams,
): Promise<GenerateScriptResult> {
  // Single output language per generate — no auto-detect, no mixing.
  const lang = SCRIPT_LANG_GEMINI_NAME[params.lang]
  const structure = AD_STRUCTURES[params.structure]
  const angle = AD_ANGLES[params.angle]
  const budgets = allocateBlockBudgets(params.structure, params.targetDurationSec)

  // Branch: own-script (verbatim segmentation) vs fresh generation.
  // The own-script path NEVER rewrites the user's words — Gemini only
  // assigns each existing sentence to one of the 5 roles.
  let parsed: GeminiOutput
  if (params.useOwnScript && (params.ownScriptText ?? '').trim().length > 0) {
    parsed = await segmentOwnScript({
      apiKey: params.geminiKey,
      ownScriptText: params.ownScriptText!.trim(),
      langName: lang,
    })
  } else {
    const systemInstruction = buildSystemPrompt({
      structureSystem: structure.systemPrompt,
      angleTone: angle.tonePrompt,
      lang,
    })

    const userPrompt = buildUserPrompt({
      productName: params.productName,
      productPitch: params.productPitch,
      creatorDescription: params.creatorDescription,
      targetDurationSec: params.targetDurationSec,
      budgets,
      structureLabel: structure.labelVi,
      angleLabel: angle.labelVi,
      lang,
    })

    // Z31-fix: schema-constrained decoding + auto-retry on parse failure.
    // Gemini's `responseMimeType: 'application/json'` alone leaves ~5% of
    // outputs malformed (unescaped newlines / quotes inside Vietnamese
    // string values). `responseSchema` forces shape conformance at decode
    // time; the repair + retry path handles the edge cases that slip through.
    parsed = await callGeminiWithRetry({
      apiKey: params.geminiKey,
      systemInstruction,
      userPrompt,
    })
  }
  const blocks: ScriptBlock[] = SCRIPT_BLOCK_IDS.map((id) => ({
    id,
    text: parsed.blocks[id] ?? '',
    estDurationSec: estimateReadDurationSec(parsed.blocks[id] ?? ''),
  }))
  const totalDurationSec = Number(
    blocks.reduce((s, b) => s + b.estDurationSec, 0).toFixed(2),
  )

  const script: GeneratedScript = {
    structure: params.structure,
    angle: params.angle,
    targetDurationSec: params.targetDurationSec,
    blocks,
    totalDurationSec,
    generatedAt: Date.now(),
  }

  const hookVariants: HookVariant[] = parsed.hookVariants.map((hv) => ({
    style: hv.style,
    text: hv.text,
    estDurationSec: estimateReadDurationSec(hv.text),
  }))

  return { script, hookVariants }
}

// ── Internals ──────────────────────────────────────────────────────────────

const SCRIPT_BLOCK_IDS: ScriptBlockId[] = [
  'hook', 'pain', 'discovery', 'benefit', 'cta',
]

const HOOK_STYLES: HookStyle[] = ['emotional', 'shock', 'curiosity']

function buildSystemPrompt(args: {
  structureSystem: string
  angleTone: string
  lang: string
}): string {
  return `You are a TikTok-native ad copywriter writing in ${args.lang}.

STRUCTURE GUIDANCE:
${args.structureSystem}

TONE GUIDANCE:
${args.angleTone}

UNIVERSAL TIKTOK-NATIVE RULES:
- Write spoken language, not written copy. Short sentences. Natural rhythm.
- Use first person. Sound like a real person on TikTok sharing what worked.
- NO corporate language. NO "in this video". NO "let me introduce you to".
- NO long paragraphs. Each block should feel like 1-2 spoken breaths.
- It is OK (encouraged) to have imperfect, conversational phrasing.
- Write in the casual, everyday spoken register of ${args.lang} — the way a real
  person talks to friends, NOT formal or written language. Pick ONE consistent
  first-person voice and stick with it. Use the natural filler words, rhythm and
  short clauses native to ${args.lang}. Do NOT borrow filler or phrasing from any
  other language, and write 100% in ${args.lang} only. NO formal salutation.
- The product should appear as a discovery the speaker stumbled onto, NOT
  as a sponsored mention. Avoid "today I'll tell you about X".
- COMPLIANCE (Malaysia Trade Descriptions Act): NEVER claim regulatory
  certifications or official approvals — no "Halal certified", "KKM approved",
  "GMP", "FDA approved", "clinically proven", "doctor approved", or similar
  authority/approval claims. We cannot verify proof here, so these are illegal
  if unbacked. Speak only to personal experience and felt benefits, not
  official endorsements.

OUTPUT FORMAT:
Return strict JSON with this exact shape (no markdown fences, no commentary):
{
  "blocks": {
    "hook":      "string",
    "pain":      "string",
    "discovery": "string",
    "benefit":   "string",
    "cta":       "string"
  },
  "hookVariants": [
    { "style": "emotional", "text": "string" },
    { "style": "shock",     "text": "string" },
    { "style": "curiosity", "text": "string" }
  ]
}

The "hook" inside "blocks" is your DEFAULT pick. The "hookVariants" array
must contain exactly 3 ALTERNATIVE hooks — emotional + shock + curiosity —
that the user could swap in. Each hookVariant should be 1-2 short lines.

Do not include the field labels (HOOK:, PAIN:, etc.) inside the text values.
Just the spoken script content.`
}

function buildUserPrompt(args: {
  productName: string
  productPitch: string
  creatorDescription?: string
  targetDurationSec: ScriptTargetDurationSec
  budgets: Record<ScriptBlockId, number>
  structureLabel: string
  angleLabel: string
  lang: string
}): string {
  const creatorLine = args.creatorDescription
    ? `\nCREATOR PROFILE (write in this voice):\n${args.creatorDescription}\n`
    : ''
  return `Write a ${args.targetDurationSec}-second TikTok ad in ${args.lang} for the product below.

PRODUCT: ${args.productName}
PITCH: ${args.productPitch}
${creatorLine}
SELECTED STRUCTURE: ${args.structureLabel}
SELECTED ANGLE: ${args.angleLabel}

PER-BLOCK TARGET DURATION (sum to ~${args.targetDurationSec}s):
- HOOK:      ~${args.budgets.hook}s
- PAIN:      ~${args.budgets.pain}s
- DISCOVERY: ~${args.budgets.discovery}s
- BENEFIT:   ~${args.budgets.benefit}s
- CTA:       ~${args.budgets.cta}s

Reading pace baseline: 150 words per minute. So a 3s block ≈ ~7-8 words.
Hit the per-block budget within ±20%.

Generate the JSON now.`
}

// ── Schema-constrained decoding (Gemini responseSchema) ───────────────────
// Forces the model to emit a JSON value that matches this exact shape.
// Without `propertyOrdering` Gemini may interleave block keys, but parsing
// still succeeds — order only matters for downstream readability.
const SCRIPT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    blocks: {
      type: 'object',
      properties: {
        hook:      { type: 'string' },
        pain:      { type: 'string' },
        discovery: { type: 'string' },
        benefit:   { type: 'string' },
        cta:       { type: 'string' },
      },
      required: ['hook', 'pain', 'discovery', 'benefit', 'cta'],
    },
    hookVariants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          style: { type: 'string', enum: ['emotional', 'shock', 'curiosity'] },
          text:  { type: 'string' },
        },
        required: ['style', 'text'],
      },
    },
  },
  required: ['blocks', 'hookVariants'],
}

// ── Own-script verbatim segmentation ──────────────────────────────────────
// When the user pastes their OWN finished script, we must not rewrite a
// single word. Gemini acts purely as a segmenter: it assigns each existing
// sentence to one of the 5 canonical roles, preserving wording, punctuation
// and language exactly. This keeps the user's voice while still feeding the
// downstream 5-block contract (insertTimingEngine et al.).

const SEGMENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    blocks: {
      type: 'object',
      properties: {
        hook:      { type: 'string' },
        pain:      { type: 'string' },
        discovery: { type: 'string' },
        benefit:   { type: 'string' },
        cta:       { type: 'string' },
      },
      required: ['hook', 'pain', 'discovery', 'benefit', 'cta'],
    },
  },
  required: ['blocks'],
}

async function segmentOwnScript(args: {
  apiKey: string
  ownScriptText: string
  langName: string
}): Promise<GeminiOutput> {
  const systemInstruction = `You are a script SEGMENTER, not a writer.
You receive a finished ad script written in ${args.langName}. Your ONLY job is
to split it VERBATIM into 5 roles: hook, pain, discovery, benefit, cta.

ABSOLUTE RULES (violating any is a failure):
- DO NOT translate, paraphrase, rewrite, shorten, expand, fix, or "improve" any word.
- Preserve the EXACT original wording, punctuation, casing and ${args.langName} spelling.
- Every sentence of the original must be assigned to exactly ONE role.
- Keep the original order — each role is a consecutive span of the script.
- Do NOT invent new sentences. If a role has no matching span, give it the single
  closest existing sentence (it is fine for a role to be short).
- Do NOT add labels (HOOK:, PAIN:, etc.) inside the text values.

ROLE MEANING (for assignment only — never rewrite):
- hook: opening attention grab
- pain: the problem / pain context
- discovery: the moment the product / solution appears
- benefit: what it does / the results / proof
- cta: the closing call to action (offer / buy / link)

OUTPUT: strict JSON only, no markdown fences:
{ "blocks": { "hook":"", "pain":"", "discovery":"", "benefit":"", "cta":"" } }`

  const userPrompt = `Segment this script verbatim into the 5 roles. Reproduce the original words exactly:\n\n${args.ownScriptText}`

  const call = (schema = true) =>
    directGeminiText({
      apiKey: args.apiKey,
      systemInstruction,
      prompt: userPrompt,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      ...(schema ? { responseSchema: SEGMENT_RESPONSE_SCHEMA } : {}),
    })

  let raw = await call()
  let blocks = tryParseSegments(raw)
  if (!blocks) blocks = tryParseSegments(repairJsonString(raw))
  if (!blocks) {
    raw = await call(false)
    blocks = tryParseSegments(raw) ?? tryParseSegments(repairJsonString(raw))
  }
  if (!blocks) {
    throw new Error('Không tách được kịch bản của bạn thành 5 phần. Hãy thử lại.')
  }

  // Own-script mode: never invent alternative hooks. The user's hook stands.
  return { blocks, hookVariants: [] }
}

function tryParseSegments(raw: string): Record<ScriptBlockId, string> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const obj = parsed as { blocks?: Partial<Record<ScriptBlockId, string>> }
  if (!obj || typeof obj !== 'object' || !obj.blocks) return null
  const out = {} as Record<ScriptBlockId, string>
  for (const id of SCRIPT_BLOCK_IDS) {
    const v = obj.blocks[id]
    if (typeof v !== 'string') return null
    out[id] = v
  }
  return out
}

async function callGeminiWithRetry(args: {
  apiKey: string
  systemInstruction: string
  userPrompt: string
}): Promise<GeminiOutput> {
  const baseCall = (extraSuffix = '', schema = true) =>
    directGeminiText({
      apiKey: args.apiKey,
      systemInstruction: args.systemInstruction,
      prompt: args.userPrompt + extraSuffix,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      ...(schema ? { responseSchema: SCRIPT_RESPONSE_SCHEMA } : {}),
    })

  // Attempt 1 — strict schema. Should succeed ~99% of the time.
  let raw = await baseCall()
  try {
    return parseAndValidate(raw)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[scriptGenerator] parse fail #1, repairing...', { err, raw: raw.slice(0, 400) })
  }

  // Attempt 2 — JSON repair (escape stray control chars inside strings).
  try {
    return parseAndValidate(repairJsonString(raw))
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[scriptGenerator] repair fail #2, retrying Gemini...', { err })
  }

  // Attempt 3 — retry Gemini with stricter instruction (no schema this time,
  // in case the schema itself is causing decode pathology on a specific model).
  raw = await baseCall(
    '\n\nIMPORTANT: Output MUST be a single valid JSON object. Inside every string value, escape newlines as \\n and double quotes as \\". Do not break strings across lines.',
    false,
  )
  try {
    return parseAndValidate(raw)
  } catch {
    return parseAndValidate(repairJsonString(raw))
  }
}

/**
 * Best-effort JSON repair for Gemini outputs that contain unescaped
 * newlines / tabs / carriage returns INSIDE string values. Walks the
 * raw text char-by-char tracking string state and escapes control chars.
 *
 * Handles the most common Gemini failure mode:
 *   "discovery": "thật ra
 *    mình đã thử rất nhiều..."
 * which is invalid JSON (raw \n inside the string). Output:
 *   "discovery": "thật ra\n    mình đã thử rất nhiều..."
 *
 * Does NOT try to repair unterminated strings without a closing quote —
 * those have to fall through to the retry path.
 */
function repairJsonString(raw: string): string {
  // Strip code fences first (Gemini sometimes wraps JSON in ```json … ```)
  let s = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()

  let out = ''
  let inString = false
  let escapeNext = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (escapeNext) {
      out += c
      escapeNext = false
      continue
    }
    if (c === '\\') {
      out += c
      escapeNext = true
      continue
    }
    if (c === '"') {
      out += c
      inString = !inString
      continue
    }
    if (inString) {
      if (c === '\n') { out += '\\n'; continue }
      if (c === '\r') { out += '\\r'; continue }
      if (c === '\t') { out += '\\t'; continue }
    }
    out += c
  }
  return out
}

// ── Output validation ──────────────────────────────────────────────────────

interface GeminiOutput {
  blocks: Record<ScriptBlockId, string>
  hookVariants: Array<{ style: HookStyle; text: string }>
}

function parseAndValidate(raw: string): GeminiOutput {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    // Fallback — try to strip code fences
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      throw new Error(
        `Gemini trả về JSON không hợp lệ. Hãy thử lại. ${err instanceof Error ? err.message : ''}`,
      )
    }
  }

  const obj = parsed as Partial<GeminiOutput>
  if (!obj || typeof obj !== 'object' || !obj.blocks || !obj.hookVariants) {
    throw new Error('Gemini output thiếu fields "blocks" hoặc "hookVariants".')
  }

  // Validate blocks
  const blocks = obj.blocks as Partial<Record<ScriptBlockId, string>>
  for (const id of SCRIPT_BLOCK_IDS) {
    if (typeof blocks[id] !== 'string') {
      throw new Error(`Gemini output thiếu block "${id}".`)
    }
  }

  // Validate hook variants
  const variants = obj.hookVariants
  if (!Array.isArray(variants) || variants.length < 1) {
    throw new Error('Gemini output thiếu hookVariants array.')
  }
  // Coerce: keep only valid styles
  const validVariants = variants
    .filter((v) => v && typeof v.text === 'string' && HOOK_STYLES.includes(v.style as HookStyle))
    .slice(0, 3)
  if (validVariants.length === 0) {
    throw new Error('Gemini không trả về hookVariants hợp lệ.')
  }

  return {
    blocks: blocks as Record<ScriptBlockId, string>,
    hookVariants: validVariants as Array<{ style: HookStyle; text: string }>,
  }
}

// ── Compliance: cert / authority claim detector ──────────────────────────────
// Z-compliance — scans a finished script (AI-generated OR the user's own
// pasted text) for regulatory certification / authority-approval language.
// We have no proof-upload mechanism in the video builder, so any such claim
// is unbacked and illegal under the Malaysia Trade Descriptions Act. The UI
// surfaces a non-blocking warning so the user removes it or confirms they
// hold valid proof. We never render a cert badge graphic (there is none).

const CERT_CLAIM_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'Halal',             re: /\bhalal\b/i },
  { label: 'KKM',               re: /\bkkm\b|kementerian kesihatan/i },
  { label: 'GMP',               re: /\bgmp\b/i },
  { label: 'FDA',               re: /\bfda\b/i },
  { label: 'MeSTI',             re: /\bmesti\b/i },
  { label: 'Clinically proven', re: /clinical(ly)? proven|terbukti (secara )?klinikal|chứng minh lâm sàng/i },
  { label: 'Doctor approved',   re: /doctor[- ]approved|disahkan doktor|bác sĩ khuyên dùng/i },
  { label: 'Certified/Approved',re: /\bcertified\b|\bapproved\b|disahkan|diluluskan|được chứng nhận|được phê duyệt/i },
]

/**
 * Returns the distinct cert/authority claim labels found anywhere in the
 * script blocks. Empty array = clean. Language-agnostic (BM / VN / EN terms).
 */
export function detectCertClaims(script: GeneratedScript): string[] {
  const haystack = script.blocks.map((b) => b.text).join('\n')
  const found = new Set<string>()
  for (const { label, re } of CERT_CLAIM_PATTERNS) {
    if (re.test(haystack)) found.add(label)
  }
  return Array.from(found)
}
