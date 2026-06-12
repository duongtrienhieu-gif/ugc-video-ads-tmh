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
  ScriptLang, HookArchetype,
} from '../types'
import {
  SCRIPT_LANG_GEMINI_NAME, HOOK_ARCHETYPES, HOOK_ARCHETYPE_ORDER,
} from '../types'
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
  /** #6 hook-first — a hook the user already picked (from generateHooks).
   *  When set, Gemini writes the other 4 blocks to flow from THIS exact hook
   *  and the hook block is forced to this text verbatim (never rewritten). */
  chosenHook?: string
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
  } else if ((params.chosenHook ?? '').trim().length > 0) {
    // #6 hook-first — the user already picked the hook; write the body around it.
    parsed = await generateBodyAroundHook({
      apiKey: params.geminiKey,
      systemInstruction: buildSystemPrompt({
        structureSystem: structure.systemPrompt,
        angleTone: angle.tonePrompt,
        lang,
      }),
      chosenHook: params.chosenHook!.trim(),
      userPrompt: buildUserPrompt({
        productName: params.productName,
        productPitch: params.productPitch,
        creatorDescription: params.creatorDescription,
        targetDurationSec: params.targetDurationSec,
        budgets,
        structureLabel: structure.labelVi,
        angleLabel: angle.labelVi,
        lang,
      }),
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
- CONCRETE & FILMABLE (IMPORTANT) — in the DISCOVERY, demo and BENEFIT moments,
  prefer lines that describe a SPECIFIC, physical, SENSORY action a phone camera
  could actually film, instead of abstract claims. A downstream AI director turns
  each spoken line into a visual and can only show what the words concretely name,
  so vague claims become flat talking-head footage. Write the moment, not the
  adjective. This is UNIVERSAL across every niche — for example:
    • instead of "it's so easy to clean" → "I just hold it under the tap and the
      gunk rinses straight off, done in seconds" (an appliance / tool)
    • instead of "it absorbs fast" → "I dab it on and it just sinks in and
      disappears, my hands aren't even greasy" (a topical / skincare)
    • instead of "it's really powerful" → "I dropped a whole carrot in and it
      turned to juice before I finished the sentence" (a blender / gadget)
    • instead of "it's comfortable" → "I wore it all day and forgot it was even
      on" (apparel / wearable)
  Name the real action, object, texture, time or place. Do NOT force every line
  to be an action — the HOOK, PAIN and emotional beats can stay abstract/felt;
  this applies where the script is showing the product working or its result.
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
PRODUCT BRIEF (read + understand — ground the script in these real facts, weave them in naturally, do NOT recite verbatim. The brief may be written in Vietnamese; understand it, but write the script 100% in ${args.lang} — never echo Vietnamese words):
${args.productPitch}
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

// ── #6 hook-first body generation ──────────────────────────────────────────
// The user has already picked the hook (from generateHooks). Gemini writes only
// the remaining 4 blocks so they flow from that exact hook; the hook block is
// forced verbatim afterwards so the model can never drift from the chosen line.

async function generateBodyAroundHook(args: {
  apiKey: string
  systemInstruction: string
  userPrompt: string
  chosenHook: string
}): Promise<GeminiOutput> {
  const systemInstruction = `${args.systemInstruction}

HOOK IS ALREADY CHOSEN — do NOT write or change the hook. The opening hook line
is FIXED (given below). Write ONLY the remaining 4 blocks (pain, discovery,
benefit, cta) so they flow naturally and seamlessly from this exact hook — same
person, same voice, same language. For the "hook" field, reproduce the GIVEN
hook VERBATIM, unchanged.`

  const userPrompt = `${args.userPrompt}

THE FIXED HOOK (continue the script from here; reproduce it verbatim as the hook block):
"""${args.chosenHook}"""`

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
    throw new Error('Không viết được kịch bản từ hook đã chọn. Hãy thử lại.')
  }
  // Force the hook verbatim — never trust the model to reproduce it exactly.
  blocks.hook = args.chosenHook
  return { blocks, hookVariants: [] }
}

// ── #6 hook layer ──────────────────────────────────────────────────────────
// Hook is the #1 lever on whether an ad survives the scroll, so it is generated
// as its own cheap, fast step: 6 hooks (one per archetype), the user picks one,
// THEN the body is written around it (generateScript with chosenHook). Universal
// — the AI fills the niche from the product brief.

export interface GenerateHooksParams {
  geminiKey: string
  lang: ScriptLang
  /** Body framework the hooks must stay compatible with */
  framework: AdStructure
  productName: string
  productPitch: string
  creatorDescription?: string
}

const ARCHETYPE_TO_STYLE: Record<HookArchetype, HookStyle> = {
  callout_pain:  'emotional',
  contrarian:    'shock',
  curiosity_gap: 'curiosity',
  confession:    'emotional',
  shock_result:  'shock',
  question_pov:  'curiosity',
}

const HOOKS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    hooks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          archetype: { type: 'string', enum: HOOK_ARCHETYPE_ORDER },
          text:      { type: 'string' },
        },
        required: ['archetype', 'text'],
      },
    },
  },
  required: ['hooks'],
}

/**
 * #6 — Generate 6 scroll-stopping hooks (one per archetype) for the product.
 * Cheap text-only Gemini call; the user picks one, then generateScript writes
 * the body around it. Strict JSON + repair/retry.
 */
export async function generateHooks(params: GenerateHooksParams): Promise<HookVariant[]> {
  const lang = SCRIPT_LANG_GEMINI_NAME[params.lang]
  const structure = AD_STRUCTURES[params.framework]
  const archetypeList = HOOK_ARCHETYPE_ORDER
    .map((id) => `- ${id}: ${HOOK_ARCHETYPES[id].promptHint}`)
    .join('\n')

  const systemInstruction = `You are a TikTok-native ad HOOK specialist writing in ${lang}.
A hook is the first 1-3 seconds of a short video ad — the single biggest factor
in whether a viewer keeps watching or scrolls past. Write hooks so good the
target viewer cannot scroll past.

Generate EXACTLY 6 hooks — ONE for each archetype below — all for the SAME product:
${archetypeList}

WHAT MAKES A HOOK STOP THE SCROLL (follow ALL — this is the whole job):
- BRUTALLY SHORT. Aim for ~6-12 words, one breath, readable in under 3 seconds.
  Front-load the punch into the FIRST 3 WORDS. Cut every word that isn't pulling
  weight. A long, complete, polite sentence is a SCROLLED-PAST sentence.
- ONE sharp, concrete, slightly UNEXPECTED detail per hook — a specific moment,
  object, number, time of day, or micro-behaviour. NOT a generic list of symptoms.
  Make the viewer see a picture, not read a claim.
- KILL the softeners and filler that bleed urgency: no trailing "...nhé / ...đó /
  ...cơ / ...vậy", no "Bạn có thấy... không?" wind-ups. Say it straight.
- BAN clichés / ad-speak the audience is blind to: "bí mật ít ai biết", "điều bất
  ngờ là", "không ngờ...", "cứ như trẻ lại chục tuổi", "thay đổi cuộc đời" and the
  like (and their ${lang} equivalents). If it sounds like an ad, rewrite it.
- NO meta-labels or stage directions IN THE TEXT — the hook is spoken aloud by a
  voiceover, so every character is read out. NEVER write "POV:", "Hook:", archetype
  names, brackets, or scene directions. Just the words the person actually says.
- The 6 hooks must each take a CLEARLY DIFFERENT angle and use a DIFFERENT concrete
  detail — they must NOT read as 6 paraphrases of the same line.

RULES:
- Each hook: 1 short SPOKEN line, first person, the casual everyday register of
  ${lang}. Sound like a real person mid-scroll, never an ad.
- Write 100% in ${lang}. The brief may be in Vietnamese — understand it but NEVER
  echo Vietnamese words; write only in ${lang}.
- Ground every hook in the REAL product / niche from the brief — specific, not generic.
- The hook sets up tension the rest of the ad pays off; do NOT pitch the product as
  a sponsored mention in the hook itself.
- BELIEVABLE: no miracle "in X days" results, no certifications/approvals (Halal,
  KKM, GMP, FDA, clinically proven, doctor approved) or authority endorsement — a
  felt, plausible, personal angle beats an unbelievable claim (and stays compliant).
- The body will use the "${structure.labelVi}" framework — keep hooks compatible,
  but each hook leads with its OWN archetype angle.

OUTPUT strict JSON, no markdown fences:
{ "hooks": [ { "archetype": "callout_pain", "text": "..." }, ... exactly 6 ] }`

  const creatorLine = params.creatorDescription
    ? `\nCREATOR PROFILE (write in this voice): ${params.creatorDescription}\n` : ''
  const userPrompt = `Write the 6 hooks in ${lang} for this product.

PRODUCT: ${params.productName}
PRODUCT BRIEF (understand + ground the hooks in these real facts; may be in
Vietnamese — never echo Vietnamese words, write only in ${lang}):
${params.productPitch}
${creatorLine}
Generate the JSON now — exactly 6 hooks, one per archetype.`

  const call = (schema = true) =>
    directGeminiText({
      apiKey: params.geminiKey,
      systemInstruction,
      prompt: userPrompt,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      ...(schema ? { responseSchema: HOOKS_RESPONSE_SCHEMA } : {}),
    })

  // Surface the REAL cause: if the Gemini call itself fails (429 rate-limit, 503,
  // bad key…) propagate that message; only fall back to a generic message when the
  // call SUCCEEDS but the payload can't be parsed (and log the raw for diagnosis).
  let raw = ''
  try {
    raw = await call()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Gemini lỗi khi tạo hook: ${msg}`)
  }
  let hooks = parseHooks(raw) ?? parseHooks(repairJsonString(raw)) ?? salvageHooks(raw)
  if (!hooks) {
    // eslint-disable-next-line no-console
    console.warn('[generateHooks] parse fail, retrying without schema. raw:', raw.slice(0, 500))
    try {
      raw = await call(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Gemini lỗi khi tạo hook: ${msg}`)
    }
    hooks = parseHooks(raw) ?? parseHooks(repairJsonString(raw)) ?? salvageHooks(raw)
  }
  if (!hooks || hooks.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('[generateHooks] still no hooks. final raw:', raw.slice(0, 500))
    throw new Error(`Gemini trả về không đọc được${raw.trim() ? ` (${raw.trim().slice(0, 80)}…)` : ' (rỗng)'}. Thử lại.`)
  }
  return hooks
}

// Salvage hooks from a TRUNCATED / slightly-malformed JSON payload (Gemini cut
// off mid-object, or an unescaped quote broke JSON.parse). Pulls every
// "archetype"/"text" value in document order and zips them by index — every
// COMPLETE hook before the cut survives, even if the closing braces are missing.
function salvageHooks(raw: string): HookVariant[] | null {
  const archetypes = [...raw.matchAll(/"archetype"\s*:\s*"([a-z_]+)"/g)].map((m) => m[1])
  const texts = [...raw.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1])
  const n = Math.min(archetypes.length, texts.length)
  const out: HookVariant[] = []
  for (let i = 0; i < n; i++) {
    const archetype = HOOK_ARCHETYPE_ORDER.includes(archetypes[i] as HookArchetype)
      ? (archetypes[i] as HookArchetype)
      : undefined
    const text = texts[i].replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()
    if (text) {
      out.push({
        style: ARCHETYPE_TO_STYLE[archetype ?? 'curiosity_gap'],
        archetype,
        text,
        estDurationSec: estimateReadDurationSec(text),
      })
    }
  }
  return out.length > 0 ? out : null
}

function parseHooks(raw: string): HookVariant[] | null {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  const obj = parsed as { hooks?: Array<{ archetype?: string; text?: string }> }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.hooks)) return null
  const out: HookVariant[] = []
  for (const h of obj.hooks) {
    if (!h || typeof h.text !== 'string' || !h.text.trim()) continue
    const archetype = HOOK_ARCHETYPE_ORDER.includes(h.archetype as HookArchetype)
      ? (h.archetype as HookArchetype)
      : undefined
    out.push({
      style: ARCHETYPE_TO_STYLE[archetype ?? 'curiosity_gap'],
      archetype,
      text: h.text.trim(),
      estDurationSec: estimateReadDurationSec(h.text.trim()),
    })
  }
  return out.length > 0 ? out : null
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
