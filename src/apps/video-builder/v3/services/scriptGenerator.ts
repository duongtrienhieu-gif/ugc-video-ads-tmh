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
  SCRIPT_LANG_GEMINI_NAME, HOOK_ARCHETYPE_ORDER, DEFAULT_SCRIPT_LANG,
} from '../types'
import { AD_STRUCTURES } from './adStructures'
import { buildHookPoolBlock, pickRandomViralReferences } from './hookViralPatterns'
import { validateHooks, validateBody, spellFixVi, type BodyBlocks } from './scriptValidator'
import { buildMsBodyVocabBlock } from './bodyPatternsMs'
import { buildShapeOverrideBlock } from './scriptShapes'
import {
  detectHookShape,
  buildSemanticAnswerRule,
  validateNumbersInHook,
} from './hookSemanticBinder'
import { AD_ANGLES } from './adAngles'
import {
  allocateBlockBudgets, estimateReadDurationSec, estimateReadDurationForVoice,
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
  /** P3q — body shape: 'narrative' (default) / 'listicle' / 'comparison' / 'journey'.
   *  Orthogonal to structure (INSTANT/LEAD). Drives a SHAPE OVERRIDE block in
   *  the body system prompt that repurposes pain/discovery/benefit semantics.
   *  Omit → 'narrative' (back-compat with the previous-implicit behaviour). */
  shape?: import('../types').ScriptShape
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
        frameworkLabel: structure.labelVi,
        structureSystem: structure.systemPrompt,
        productRevealRule: structure.productRevealRule,
        blockGuides: structure.blockGuides,
        bodyAntiPatterns: structure.bodyAntiPatterns,
        symptomBans: structure.symptomBans,
        angleTone: angle.tonePrompt,
        lang,
        shape: params.shape,
      }),
      // P3k — pass the structure so the validator can run after parse.
      structure,
      // P3n — script language so MS scripts validate against MS vocab.
      lang: params.lang,
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
      frameworkLabel: structure.labelVi,
      structureSystem: structure.systemPrompt,
      productRevealRule: structure.productRevealRule,
      blockGuides: structure.blockGuides,
      bodyAntiPatterns: structure.bodyAntiPatterns,
      symptomBans: structure.symptomBans,
      angleTone: angle.tonePrompt,
      lang,
      shape: params.shape,
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

  // ── Fit-to-length (deterministic) ───────────────────────────────────────────
  // The model can't reliably self-measure spoken duration and word↔second density
  // varies by language (vi ≈ 3.5-3.9 w/s, ms differs), so prompt-only length control
  // swings short↔long. Instead MEASURE the estimate and run up to 2 corrective
  // passes that explicitly cut (or expand) to the target while keeping the core
  // facts. Skipped for own-script (the user's words are never reshaped).
  if (!params.useOwnScript) {
    let blockMap: Record<ScriptBlockId, string> = { ...parsed.blocks }
    const target = params.targetDurationSec
    // P3i — tighter band [0.90, 1.10] + 3 passes (was 2). With the refit prompt's
    // explicit "must land in [target-3, target+3]" + sensory/empathy expansion fuel,
    // 3 passes virtually guarantee the script reaches ~target ±10%.
    for (let pass = 0; pass < 3; pass++) {
      const joined = SCRIPT_BLOCK_IDS.map((id) => blockMap[id] ?? '').join(' ')
      const durNow = estimateReadDurationForVoice(joined, params.lang)
      if (durNow <= target * 1.10 && durNow >= target * 0.90) break  // in band
      const refit = await refitScriptToLength({
        apiKey: params.geminiKey,
        blocks: blockMap,
        langName: lang,
        targetSec: target,
        currentSec: durNow,
        tooLong: durNow > target * 1.10,
      })
      if (!refit) break
      blockMap = refit
    }
    // Keep the user's picked hook verbatim through any refit.
    if ((params.chosenHook ?? '').trim()) blockMap.hook = params.chosenHook!.trim()
    parsed = { ...parsed, blocks: blockMap }
  }

  const blocks: ScriptBlock[] = SCRIPT_BLOCK_IDS.map((id) => ({
    id,
    text: parsed.blocks[id] ?? '',
    estDurationSec: estimateReadDurationSec(parsed.blocks[id] ?? '', params.lang),
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
    estDurationSec: estimateReadDurationSec(hv.text, params.lang),
  }))

  return { script, hookVariants }
}

// ── Internals ──────────────────────────────────────────────────────────────

const SCRIPT_BLOCK_IDS: ScriptBlockId[] = [
  'hook', 'pain', 'discovery', 'benefit', 'cta',
]

const HOOK_STYLES: HookStyle[] = ['emotional', 'shock', 'curiosity']

/** P3l — per-language first-person pronoun rule, shared by the body prompt and
 *  the hook prompt so both speak in the same voice. Branches on the Gemini
 *  language NAME ("Vietnamese" / "Bahasa Malaysia" / …).
 *  VN: "mình" only (never "tôi" except an explicit authority role).
 *  MS: "aku" default (Gen Z TikTok-native), "saya" for mature niches.
 *  EN/other: neutral casual "I". */
function pronounRule(langName: string): string {
  if (langName === 'Vietnamese') {
    return '- XƯNG HÔ (VN — BẮT BUỘC): dùng "mình" làm ngôi thứ nhất XUYÊN SUỐT (cả hook lẫn body). ' +
      'TUYỆT ĐỐI KHÔNG dùng "tôi" — "tôi" nghe formal, phá chất voice-memo TikTok. Ngoại lệ DUY ' +
      'NHẤT: khi nói bằng vai trò chuyên gia rõ ràng (vd "Là bác sĩ / bartender 8 năm, tôi nói ' +
      'thẳng…") thì "tôi" được phép để tăng uy tín. Gọi người xem là "bạn" (KHÔNG "quý khách").'
  }
  if (langName === 'Bahasa Malaysia') {
    return '- KATA GANTI DIRI (MS — WAJIB): default "aku" (Gen Z TikTok-native, mesra) untuk produk ' +
      'snek / kecantikan / fesyen / gajet. Guna "saya" HANYA untuk niche matang (kesihatan / ' +
      'wellness / keibubapaan) yang audiensnya 30+. Panggil penonton "korang"/"kau" (santai), ' +
      'JANGAN formal. Pilih SATU kata ganti dan kekal konsisten sepanjang skrip.'
  }
  return '- FIRST PERSON: a natural casual "I"; address the viewer as "you". Stay consistent throughout.'
}

function buildSystemPrompt(args: {
  frameworkLabel: string
  structureSystem: string
  productRevealRule: string
  blockGuides: { pain: string; discovery: string; benefit: string; cta: string }
  bodyAntiPatterns: string[]
  symptomBans: string[]
  angleTone: string
  lang: string
  /** P3q — body shape. When non-narrative, a SHAPE OVERRIDE block is appended
   *  AFTER the per-block guide so it wins for that block's semantic. */
  shape?: import('../types').ScriptShape
}): string {
  const antiPatternList = args.bodyAntiPatterns
    .map((p) => `  • "${p}…"`)
    .join('\n')
  const symptomLine = args.symptomBans.length > 0
    ? `\n*** SYMPTOM VOCABULARY BANNED in the pain block (this is an INSTANT group — pain is a 1-line transition, NOT a symptom report). Words listed below are HARD-BANNED in pain; if you write any of them, the script has drifted into Problem-Solution shape: ${args.symptomBans.map((s) => `"${s}"`).join(', ')}. The discovery / benefit blocks may reference outcomes but the pain block must NEVER name a symptom.`
    : ''
  // P3q — shape override (empty for 'narrative', the previous default).
  const shapeOverride = args.shape ? buildShapeOverrideBlock(args.shape) : ''
  return `You are a TikTok-native ad copywriter writing in ${args.lang}.

FRAMEWORK: "${args.frameworkLabel}" — STICK TO IT.
${args.structureSystem}

PRODUCT REVEAL RULE (HARD — this is the cold-reach scroll-stop contract):
${args.productRevealRule}
- Every block MUST respect this rule. If the rule says the product is in the hook,
  the discovery block keeps it on screen / in the words and the pain block is at
  most 1 short empathy sentence. If the rule says the product appears mid-script,
  the hook + pain DO NOT name the product yet.
- The body must NEVER drift to a different framework's shape (e.g. inserting a
  long pain block into a "vào thẳng sản phẩm" framework).

PER-BLOCK GUIDE FOR THIS FRAMEWORK (HARD — exactly what each block must do):
- pain:      ${args.blockGuides.pain}
- discovery: ${args.blockGuides.discovery}
- benefit:   ${args.blockGuides.benefit}
- cta:       ${args.blockGuides.cta}${shapeOverride}

BANNED BODY OPENINGS for this framework (these are the WRONG framework's defaults —
NEVER start any block with them; they signal the script has drifted):
${antiPatternList}${symptomLine}

TONE GUIDANCE:
${args.angleTone}

UNIVERSAL TIKTOK-NATIVE RULES:
- Write spoken language, not written copy. First person. Sound like a real person on
  TikTok sharing what worked. NO corporate "in this video / let me introduce you to".
- TikTok RHYTHM (critical for scroll-retention): VARY sentence length across the
  script — alternate PUNCH sentences (4-8 words: "Trời ơi mê quá đi.", "Đợi chút.",
  "Cái đó tự nhiên không.") with FULLER sentences (12-18 words explaining details).
  A script of all 15-word sentences feels flat; a script of all 5-word sentences
  feels jumpy. Mix them — punch, full, punch, full, punch. Imperfect conversational
  phrasing is encouraged.
- Write in the casual everyday spoken register of ${args.lang} — the way a real
  person talks to friends. 100% in ${args.lang}; never borrow filler from another
  language. NO formal salutation.
${pronounRule(args.lang)}
- The product should appear as a discovery the speaker stumbled onto, NOT
  as a sponsored mention. Avoid "today I'll tell you about X".
- GROUND IT IN THE REAL PRODUCT — do NOT stay vague ("some Korean technology",
  "this serum", "công nghệ gì đó", "thứ này"). Vague copy persuades nobody AND
  gives the downstream visual director nothing to show. A real person who actually
  uses a product can name what is in it and why it works — so must this script,
  using ONLY the real facts in the PRODUCT BRIEF (never invent ingredients, claims,
  or STATISTICS — if the brief gives no number, do NOT fabricate one like
  "740.000 hộp đã bán" / "90% người dùng"; switch to a non-numeric angle instead):
    • NAME the key ingredient(s) / active(s) / material the brief lists — say them
      out loud (e.g. "peptide với collagen", "than hoạt tính", "thép Nhật"), NOT
      "công nghệ gì đó". If the brief names two actives, name both.
    • Give the MECHANISM in ONE simple spoken sentence — HOW it actually works, the
      way a friend explains it ("peptide nó kích cho da tự sinh collagen lại"),
      not a corporate spec. This is the line the director turns into a mechanism shot.
    • Show ONE concrete USAGE moment — the ACT of using it (how much, where, the
      texture / feel), something a phone can FILM: "tối thoa 2-3 giọt, vỗ nhẹ là
      thấm". Write the moment, not the adjective — this becomes the product-in-use
      B-roll. (Universal: "xả thẳng dưới vòi, rửa cái sạch trơn" for an appliance;
      "thả nguyên củ cà rốt vô, xay cái thành nước" for a blender.)
    • Speak to the SPECIFIC person it is for, EARLY, so they feel seen — pull their
      exact situation from the brief's pain points + target audience ("ai da vừa
      khô vừa nhăn sớm như mình không").
  Keep ALL of this in casual spoken register — a real person who genuinely knows
  the product, weaving the facts in naturally, NEVER a brochure or a spec list.
- SENSORY MOMENT (UNIVERSAL — pick the dimension that fits THIS product):
  The script MUST include AT LEAST ONE concrete sensory beat — what it FEELS /
  TASTES / SMELLS / SOUNDS / LOOKS like at the moment of use. Read the brief to
  pick the 1-2 relevant dimensions; never list all. Examples across niches:
    • Food / drink → taste + texture + smell + temperature ("giòn rụm như bánh vừa
      ra lò, ngọt thanh tự nhiên không gắt", "ấm bụng, thơm mùi quế nhẹ")
    • Skincare / cosmetic → feel on skin + scent + finish ("mát tê tê khi vỗ vào",
      "thấm nhanh, không nhờn", "mùi hoa cam dịu")
    • Appliance / tool → grip + weight + sound + force ("cầm vừa tay, nặng đúng kiểu
      chắc chắn", "tiếng êm như tủ lạnh chạy")
    • Apparel / accessory → fabric feel + breathability + fit ("mát rượi như cotton
      hè", "co giãn 4 chiều, vận động thoải mái")
    • Tech / electronics → button feel + screen + warmth + response time ("bấm chắc,
      không lỏng lẻo", "phản hồi gần như tức thì")
  Be SPECIFIC ("giòn rụm như bánh vừa nướng"), NEVER abstract ("ngon", "đẹp",
  "tốt"). The sensory line is also what the visual director films, so it must be
  filmable, not feeling-only.
- EMPATHY ECHO — the hook touches a pain / persona / moment; the benefit block
  MUST come back to that EXACT pain or moment in a NEW state (after using the
  product). The viewer needs the emotional loop to close ("hồi đó mình hay đau
  đầu lúc 3 giờ chiều / giờ thì ngồi trọn ca không phải vò đầu nữa"). Universal
  across niches.
- POINT-OF-CONTACT — at least ONE sentence in pain / discovery is a very
  CONCRETE everyday moment (a TIME of day / a PLACE / an ACTION / an inner
  thought) the persona would silently nod at, not an abstract feeling. Example
  upgrades:
    bad:  "tôi hay mệt" → good: "3 giờ chiều ngồi máy tính, dạ dày kêu, cứ với tay
                                  tìm gì đó nhâm nhi"
    bad:  "lười skincare" → good: "tối thứ Sáu uể oải, chỉ kịp vỗ 2 giọt rồi đi ngủ"
  Read the brief to pick the moment that fits the persona — universal across niches.
- KEEP IT BELIEVABLE — a believable specific beats a spectacular lie. NO miracle
  instant results ("3 giây", "vài ngày là hết nhăn"), NO claiming it equals a
  medical procedure ("như đi tiêm filler / botox"), realistic timeframes, spoken
  as personal felt experience. Overclaiming reads as a scam, kills trust, and
  breaks compliance. Let the named ingredient + mechanism do the convincing, not
  an unbelievable result.
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

LENGTH — aim for about ${args.targetDurationSec}s spoken: tight, punchy, to the
point. Do NOT ramble, repeat, or over-explain — a concise ad holds attention far
better than a long one. The length is auto-checked and trimmed afterward, so err
on the side of SHORTER rather than padding. Cover the key beats (the pain, the
named ingredient + how it works, the usage moment, the offer) without filler.

PER-BLOCK rough split (sum ~${args.targetDurationSec}s, just a guide):
- HOOK:      ~${args.budgets.hook}s
- PAIN:      ~${args.budgets.pain}s
- DISCOVERY: ~${args.budgets.discovery}s
- BENEFIT:   ~${args.budgets.benefit}s
- CTA:       ~${args.budgets.cta}s

MUST INCLUDE (pull from the brief — this is what makes it persuasive, not basic):
- the SPECIFIC pain + who it's for, so the right viewer feels seen (early);
- the NAMED key ingredient(s) / active(s) the brief lists (not "công nghệ gì đó");
- a ONE-LINE simple mechanism — how it actually works;
- a concrete USAGE moment — the act of using it (filmable);
- a believable result (NO "3 giây" / miracle / filler-botox claims).
If the brief has no ingredient/mechanism info, do not invent — lean on the pain,
the usage moment and the honest result instead.

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
      maxOutputTokens: 3072,
      thinkingBudget: 0,   // structured JSON — don't let thinking eat the output budget
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
  /** P3k — optional: when present, the body is validated against the group's
   *  symptomBans / bodyAntiPatterns / CTA-lever rules and 1 feedback retry runs
   *  if anything failed. Omit to skip the post-gen check. */
  structure?: import('./adStructures').AdStructureConfig
  /** P3n — script language. Threaded to the validator so MS scripts use the
   *  Malaysian CTA / anti-pattern / symptom vocab; defaults to VN when absent. */
  lang?: ScriptLang
}): Promise<GeminiOutput> {
  // P3n — when lang='ms', inject the Malaysian native-vocabulary block so Gemini
  // stops translating from Vietnamese ("hết hàng" → "habis" formal) and uses
  // bahasa rojak with the actual viral TikTok register. EN/VI fall through to
  // the universal rules already in args.systemInstruction.
  const msVocabBlock = args.lang === 'ms' ? `\n\n${buildMsBodyVocabBlock()}` : ''
  // P3r — Hướng X: detect hook shape (question / listicle / comparison / confession /
  // claim_bold / investigation / imperative) and inject the matching ANSWER rule.
  // Replaces P3i's "reuse a key word" literal contract — that rule worked for
  // confessions but broke awkwardly for question hooks (the body picked up a noun
  // instead of answering the question).
  const semanticRule = buildSemanticAnswerRule(detectHookShape(args.chosenHook), args.chosenHook)
  const systemInstruction = `${args.systemInstruction}${msVocabBlock}

HOOK IS ALREADY CHOSEN — do NOT write or change the hook. The opening hook line
is FIXED (given below). Write ONLY the remaining 4 blocks (pain, discovery,
benefit, cta) so they continue DIRECTLY from this exact hook.

${semanticRule}

HARD CONTRACT (must hold across all 4 blocks):
- DO NOT start the body with a generic pain question that the WRONG framework
  uses (the BANNED BODY OPENINGS list above lists them for this framework). The
  body MUST respect the per-block guide above.
- STICK TO THE FRAMEWORK + the PRODUCT REVEAL RULE — never pivot to another
  framework's shape (e.g. don't insert a 3-line confession into a "vào thẳng sản
  phẩm" framework; don't reveal the product early in a "dẫn dắt" framework).
- Reproduce the GIVEN hook VERBATIM in the "hook" field — do not edit a word.`

  const userPrompt = `${args.userPrompt}

THE FIXED HOOK (continue the script DIRECTLY from this line; reproduce it verbatim as the hook block):
"""${args.chosenHook}"""`

  const call = (schema = true) =>
    directGeminiText({
      apiKey: args.apiKey,
      systemInstruction,
      prompt: userPrompt,
      maxOutputTokens: 2048,
      temperature: 0.85,   // creative but still grounded in the brief
      thinkingBudget: 0,   // structured JSON — don't let thinking eat the output budget
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

  // P3p-D — silent VN spell fix on the 4 generated blocks (NOT the hook, which
  // was forced verbatim above and is the user's own picked text). Catches
  // recurring Gemini typos like "hấu hết" → "hầu hết" deterministically without
  // costing a retry call. No-op when lang ≠ 'vi'.
  if (args.lang === 'vi') {
    blocks.pain = spellFixVi(blocks.pain ?? '')
    blocks.discovery = spellFixVi(blocks.discovery ?? '')
    blocks.benefit = spellFixVi(blocks.benefit ?? '')
    blocks.cta = spellFixVi(blocks.cta ?? '')
  }

  // P3k — post-gen body validator: catches the symptom-drift + missing-hook-reuse
  // + banned-opening + flat-CTA failures the prompt sometimes lets through. ONE
  // feedback retry (no new prompt layer, just an append) when something failed.
  if (args.structure) {
    const bodyBlocks: BodyBlocks = {
      hook: blocks.hook,
      pain: blocks.pain ?? '',
      discovery: blocks.discovery ?? '',
      benefit: blocks.benefit ?? '',
      cta: blocks.cta ?? '',
    }
    const check = validateBody(bodyBlocks, args.structure, args.lang)
    if (!check.ok) {
      // eslint-disable-next-line no-console
      console.log(`[generateBodyAroundHook] body check failed (${check.failures.length} issues), 1 retry…`)
      try {
        const feedback = check.failures.map((f) => `- ${f}`).join('\n')
        const retryPrompt = `${userPrompt}

PREVIOUS ATTEMPT FAILED THESE CHECKS — fix ONLY these (keep everything else exactly the same shape and content):
${feedback}

Return the JSON in the same shape — the hook field unchanged, the 4 other blocks corrected.`
        const raw2 = await directGeminiText({
          apiKey: args.apiKey,
          systemInstruction,
          prompt: retryPrompt,
          maxOutputTokens: 2048,
          temperature: 0.7,
          thinkingBudget: 0,
          responseMimeType: 'application/json',
          responseSchema: SEGMENT_RESPONSE_SCHEMA,
        })
        const blocks2 = tryParseSegments(raw2) ?? tryParseSegments(repairJsonString(raw2))
        if (blocks2) {
          blocks2.hook = args.chosenHook
          const check2 = validateBody({
            hook: blocks2.hook,
            pain: blocks2.pain ?? '',
            discovery: blocks2.discovery ?? '',
            benefit: blocks2.benefit ?? '',
            cta: blocks2.cta ?? '',
          }, args.structure)
          // Keep retry only if it actually fixed MORE than it broke.
          if (check2.failures.length < check.failures.length) blocks = blocks2
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[generateBodyAroundHook] retry failed (silent fallback):', err)
      }
    }
  }

  return { blocks, hookVariants: [] }
}

// ── Fit-to-length corrective pass ───────────────────────────────────────────
// Rewrites the 5 blocks to hit a target spoken length. Used by the deterministic
// fit-to-length loop in generateScript. CUTS (or expands) while preserving the
// hook + product name + ingredients + mechanism + usage + offer. Language-agnostic.
async function refitScriptToLength(args: {
  apiKey: string
  blocks: Record<ScriptBlockId, string>
  langName: string
  targetSec: number
  currentSec: number
  tooLong: boolean
}): Promise<Record<ScriptBlockId, string> | null> {
  const current = SCRIPT_BLOCK_IDS.map((id) => `[${id}] ${args.blocks[id] ?? ''}`).join('\n')
  const lo = args.targetSec - 3
  const hi = args.targetSec + 3
  const systemInstruction = `You are editing a finished TikTok ad script written in ${args.langName} to FIT A TARGET SPOKEN LENGTH. Keep the SAME language, the SAME casual spoken voice, and the 5-block structure (hook, pain, discovery, benefit, cta). Do not switch language or tone.`
  const userPrompt = `This script currently reads about ${Math.round(args.currentSec)} seconds spoken, but it MUST land within ${lo}-${hi} seconds (target ~${args.targetSec}s). ${
    args.tooLong
      ? `It is TOO LONG — CUT it down to about ${args.targetSec}s. Remove the least essential sentences, trim repetition + filler + meta talk, tighten wording. You MUST KEEP: the opening hook (verbatim), the product name + its key ingredients + the mechanism, the one concrete usage moment, the sensory beat, the empathy echo (hook → benefit), and the offer / CTA. Cut fluff, never the core facts.`
      : `It is TOO SHORT — expand to ~${args.targetSec}s. EXPANSION FUEL (in this order — use ONLY facts in the brief, never invent product claims, never pad with filler):
  1. Add a CONCRETE SENSORY beat to discovery / benefit — what it tastes / smells /
     feels / sounds like at the moment of use, in plain spoken words.
  2. Add an EMPATHY ECHO — bring the hook's pain / persona / moment back in the
     benefit block at the new state (after using the product).
  3. Add a POINT-OF-CONTACT — one very specific everyday moment (time / place /
     action / inner thought) the persona would silently nod at.
  4. Deepen the MECHANISM by one spoken sentence — how the ingredient actually
     works in the body / on skin / in the device, the way a friend explains it.
NEVER add filler ("rồi đó, các bạn ạ, mình nói thật nhé") to fake length.`
  }

CURRENT SCRIPT:
${current}

Return strict JSON only, no markdown fences:
{ "blocks": { "hook":"", "pain":"", "discovery":"", "benefit":"", "cta":"" } }`

  const call = (schema = true) =>
    directGeminiText({
      apiKey: args.apiKey,
      systemInstruction,
      prompt: userPrompt,
      maxOutputTokens: 3072,
      temperature: 0.4,
      thinkingBudget: 0,   // structured JSON — don't let thinking eat the output budget
      responseMimeType: 'application/json',
      ...(schema ? { responseSchema: SEGMENT_RESPONSE_SCHEMA } : {}),
    })

  let raw = await call()
  let blocks = tryParseSegments(raw) ?? tryParseSegments(repairJsonString(raw))
  if (!blocks) {
    raw = await call(false)
    blocks = tryParseSegments(raw) ?? tryParseSegments(repairJsonString(raw))
  }
  return blocks
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
  /** P3i — when the user presses "Đổi 6 hook", pass the previous batch so the
   *  re-roll is FORCED to break out of the same connectors / closing clauses
   *  rather than mass-producing 6 copies of the previous template. */
  previousBatch?: string[]
  /** P3r — body shape selected by the user. The hook prompt now requires the 6
   *  hooks to fit the shape (listicle → "N reasons" openers; comparison → "A vs B";
   *  journey → "N ngày test"; narrative → no shape constraint). Omit → 'narrative'. */
  shape?: import('../types').ScriptShape
}

// P3j — hook archetype is now METADATA ONLY (each generated hook also gets a
// natural archetype tag for the UI badge / store back-compat). The actual shape
// of every hook is decided by mix-matching the 3 POOLs at generate time, not by
// a per-framework archetype.
const GROUP_TO_DEFAULT_ARCHETYPE: Record<AdStructure, HookArchetype> = {
  INSTANT: 'shock_result',
  LEAD:    'confession',
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
          vi:        { type: 'string' },  // #6 — VN gloss for display (when lang ≠ vi)
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
  const groupArchetype: HookArchetype = GROUP_TO_DEFAULT_ARCHETYPE[params.framework]
  const productRevealLine = structure.group === 'instant'
    ? `- The product NAME (or a clear "cầm thử / mở gói / show" reference) MUST appear in EVERY hook — this group is "vào thẳng sản phẩm".`
    : `- The product NAME must NOT appear in any hook — this group is "dẫn dắt sản phẩm"; the body reveals the product later. The hook sets up tension only.`
  const isReroll = (params.previousBatch?.length ?? 0) > 0
  // P3j — inject the 3 POOL block + a random subset of the 150-hook viral library
  // so Gemini reads varied scroll-stop examples every call (different press → different
  // anchors → less template-copying).
  const poolBlock = buildHookPoolBlock()
  const viralRefs = pickRandomViralReferences(10, params.lang)
    .map((h, i) => `  ${i + 1}. ${h}`)
    .join('\n')
  // P3r — shape-aware hook generation. P3q only wired shape into the body prompt
  // (the user audited: pick "listicle" / "comparison" / "journey" → hooks were
  // still random). The hook prompt now carries an explicit SHAPE BIND block so
  // every one of the 6 hooks fits the body shape that will be written for it.
  const shape = params.shape ?? 'narrative'
  const shapeBindLine = shape === 'listicle'
    ? `*** BODY SHAPE = LISTICLE *** — EVERY one of the 6 hooks MUST be an N-reasons opener (e.g. "3 lý do mình mua...", "Có 2 lý do thôi mà mình...", "Aku ada 3 sebab kenapa..."). The N can vary (2/3/4/5) but ALL 6 hooks MUST include a number + "lý do / reasons / sebab" pattern. Hooks without a number-list opener are a HARD FAILURE for this shape.`
    : shape === 'comparison'
    ? `*** BODY SHAPE = COMPARISON *** — EVERY one of the 6 hooks MUST set up a side-by-side test (e.g. "Mình so sánh A và B", "Bên trái 200k, bên phải 99k", "Aku compare RM20 vs RM200", "Tôi đã test 3 brand", "Yang murah lawan yang mahal"). Hooks that don't tee up a comparison are a HARD FAILURE for this shape.`
    : shape === 'journey'
    ? `*** BODY SHAPE = JOURNEY *** — EVERY one of the 6 hooks MUST signal a multi-day / multi-week / multi-month test (e.g. "Test 7 ngày kết quả", "Aku guna 30 hari, ni result", "Sau 1 tháng dùng...", "Aku test 7 hari, gila weh"). The duration must be EXPLICIT (a number + unit of time). Hooks without a time-bound test are a HARD FAILURE for this shape.`
    : ''   // 'narrative' = no shape constraint, current free POOL behaviour

  const systemInstruction = `You are a TikTok-native ad HOOK specialist writing in ${lang}.
A hook is the first 1-3 seconds of a short video ad — the single biggest factor
in whether a viewer keeps watching or scrolls past.

*** GROUP BINDING ***
Group: "${structure.labelVi}".
${productRevealLine}
${shapeBindLine ? `\n${shapeBindLine}\n` : ''}
*** THE 3 POOLs — mix-match for each of the 6 hooks ***
Build each of the 6 hooks by combining ONE choice from POOL 1 + ONE choice from
POOL 2 + (optionally) ONE choice from POOL 3. Across the 6 hooks the combinations
MUST be different — never reuse the same POOL 1 device twice, never reuse the same
POOL 2 mechanism twice.

${poolBlock}

*** 10 VIRAL HOOK REFERENCES (random sample from a 150-hook viral library) ***
STUDY the tone / rhythm / shock vocabulary. Do NOT copy the words — these are not
templates. Notice how they OPEN punchy, end clean, and avoid Instagram-caption
softeners. Adapt the SPIRIT to the user's product:
${viralRefs}

*** ANTI-REPETITION (HARD) ***
- NO TWO hooks may share the same opening words (the first 2-3 words).
- NO TWO hooks may share the same closing clause / connector phrase
  (e.g. if hook 1 ends with "là dành cho bạn", NO OTHER hook may end that way).
- KILL the lazy "fill the bracket" instinct — write each hook AS IF it were the
  only hook for this product, then check it doesn't echo the others.

*** LANGUAGE LOCK ***
ALL 6 hooks 100% in ${lang}. The brief may be Vietnamese — READ + understand it,
NEVER echo Vietnamese words. If ${lang} is not Vietnamese, a Vietnamese/mixed hook
is a HARD FAILURE.
${pronounRule(lang)}

WHAT MAKES A HOOK STOP THE SCROLL:
- VOICE-MEMO REGISTER, not Instagram caption. A real person talking to a friend.
  Each hook reads like a SPOKEN line — never a captionless fragment.
- 8-16 words, one breath, readable in under 3 seconds. Punchy but COMPLETE.
- ONE concrete, slightly UNEXPECTED detail per hook (a moment, number, texture,
  ingredient, situation, persona). Make the viewer see a picture, not read a claim.
- KILL softeners in the trail: no "...nhé / ...đó / ...cơ / ...vậy" habit, no
  "Bạn có thấy... không?" wind-ups. Say it straight.
- BAN clichés: "bí mật ít ai biết", "điều bất ngờ là", "không ngờ...", "thay đổi
  cuộc đời", and their ${lang} equivalents. If it sounds like an ad, rewrite.
- NO meta-labels or stage directions inside the text — every character is read
  aloud. NEVER write "POV:", "Hook:", brackets, or scene directions.

GROUNDING (universal):
- Ground every hook in the REAL product from the brief — specific, not generic.
- BELIEVABLE: no "in X days" miracles, no certifications/approvals (Halal, KKM,
  GMP, FDA, clinically proven, doctor approved). Felt + personal beats grand.
- NO FABRICATED STATISTICS: only use a number (sales count / %, e.g. "740.000 hộp",
  "90% người dùng") if it appears in the PRODUCT BRIEF. If the brief gives no such
  number, do NOT invent one — for a hook that wants the stat_number / concrete_comparison
  bait, fall back to a non-numeric tension (insider / contrarian / personal-stake).
${params.lang !== 'vi' ? `
TRANSLATION: each hook also gets a faithful Vietnamese translation in "vi" —
keep the casual spoken tone, NOT formal/literal. Display-only, NEVER used in the
video. "text" stays 100% in ${lang}; only "vi" is Vietnamese.` : ''}

OUTPUT strict JSON, no markdown fences. Tag every hook with archetype "${groupArchetype}"
(metadata only — the SHAPE is set by the POOL mix above, not by the archetype tag):
${params.lang !== 'vi'
  ? `{ "hooks": [ { "archetype": "${groupArchetype}", "text": "<in ${lang}>", "vi": "<VN>" }, ... exactly 6 ] }`
  : `{ "hooks": [ { "archetype": "${groupArchetype}", "text": "..." }, ... exactly 6 ] }`}`

  const creatorLine = params.creatorDescription
    ? `\nCREATOR PROFILE (write in this voice): ${params.creatorDescription}\n` : ''
  // A fresh token per call so "Đổi hook" actually re-rolls instead of converging
  // on the same safe answer (combined with a high temperature below).
  const freshness = Math.random().toString(36).slice(2, 8)
  // P3i — on re-roll, force a break from the previous batch's connectors / endings.
  const prevBlock = isReroll
    ? `\n*** PREVIOUS BATCH (the user pressed "Đổi 6 hook" — they didn't like these; do NOT repeat their opening words, connectors, or closing clauses; break out completely): ***\n${params.previousBatch!.map((h, i) => `  ${i + 1}. ${h}`).join('\n')}\nWrite 6 RADICALLY different hooks: different POOL-1 devices, different POOL-2 mechanisms, different opening words. If the previous batch all closed with the same clause, the new batch must use 6 distinct closings.\n`
    : ''
  const userPrompt = `Write the 6 hooks in ${lang} for this product.

PRODUCT: ${params.productName}
PRODUCT BRIEF (understand + ground the hooks in these real facts; may be in
Vietnamese — never echo Vietnamese words, write only in ${lang}):
${params.productPitch}
${creatorLine}${prevBlock}
Give a FRESH, BOLD set — mix-match the 3 POOLs so each hook lands a DIFFERENT
linguistic device + DIFFERENT tension mechanism. Aim for scroll-stop, not
narration. (variation ${freshness})

Generate the JSON now — exactly 6 hooks.`

  const call = (schema = true) =>
    directGeminiText({
      apiKey: params.geminiKey,
      systemInstruction,
      prompt: userPrompt,
      maxOutputTokens: 3072,
      // Re-rolls run hotter so Gemini breaks out of the safe-converged answer
      // it just produced. First-time generation stays disciplined at 0.9.
      temperature: isReroll ? 1.05 : 0.9,
      thinkingBudget: 0,  // 2.5 models otherwise burn the token budget thinking → truncated JSON → 1 hook
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
  let hooks = parseHooks(raw, params.lang) ?? parseHooks(repairJsonString(raw), params.lang) ?? salvageHooks(raw, params.lang)
  // Retry once if we got nothing OR a truncated partial (< 4 of the 6 hooks) — keep
  // whichever attempt yielded more hooks. Never lose a good batch to a bad retry.
  if (!hooks || hooks.length < 4) {
    // eslint-disable-next-line no-console
    console.warn(`[generateHooks] only ${hooks?.length ?? 0} hooks, retrying. raw:`, raw.slice(0, 400))
    try {
      const raw2 = await call(false)
      const hooks2 = parseHooks(raw2, params.lang) ?? parseHooks(repairJsonString(raw2), params.lang) ?? salvageHooks(raw2, params.lang)
      if (hooks2 && (!hooks || hooks2.length > hooks.length)) hooks = hooks2
    } catch (err) {
      if (!hooks) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new Error(`Gemini lỗi khi tạo hook: ${msg}`)
      }
    }
  }
  if (!hooks || hooks.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('[generateHooks] still no hooks. final raw:', raw.slice(0, 500))
    throw new Error(`Gemini trả về không đọc được${raw.trim() ? ` (${raw.trim().slice(0, 80)}…)` : ' (rỗng)'}. Thử lại.`)
  }

  // P3p-D — silent VN spell fix on every hook text before the user even sees
  // it. Catches "Hấu hết" → "Hầu hết" deterministically.
  if (params.lang === 'vi') {
    for (const h of hooks) {
      h.text = spellFixVi(h.text)
    }
  }

  // P3k — post-gen validator: catches "6 hooks share the same opening / closing"
  // (lazy template-copy mode) that the prompt's diversity rule sometimes misses.
  // P3p-E — now also fails when ≥1 hook exceeds 18 words (rule was prompt-only).
  // One feedback retry — NO new prompt layer, just a short fix-only instruction.
  const collectHookFailures = (list: HookVariant[]): string[] => {
    const texts = list.map((h) => h.text)
    const failures = validateHooks(texts).failures.slice()
    // P3r — fabricated-number check on every hook against the brief.
    for (const h of texts) {
      const numHit = validateNumbersInHook(h, params.productPitch)
      if (numHit) failures.push(numHit)
    }
    // P3r — shape conformance: when user picked a non-narrative shape, each
    // hook must match it (listicle hooks must have a number-list opener; etc).
    if (shape !== 'narrative') {
      for (const h of texts) {
        const detected = detectHookShape(h)
        if (shape === 'listicle' && detected !== 'listicle') {
          failures.push(`Hook "${h.slice(0, 60)}…" is NOT a listicle (shape "${detected}"). User selected LISTICLE — rewrite so this hook opens with an N-reasons / N-lý do / N-sebab pattern.`)
        } else if (shape === 'comparison' && detected !== 'comparison') {
          failures.push(`Hook "${h.slice(0, 60)}…" is NOT a comparison (shape "${detected}"). User selected COMPARISON — rewrite so this hook tees up an A vs B / side-by-side test.`)
        } else if (shape === 'journey' && detected !== 'investigation' && !/\b\d+\s*(ngày|days?|hari|tuần|weeks?|minggu|tháng|months?|bulan)/i.test(h)) {
          failures.push(`Hook "${h.slice(0, 60)}…" is NOT a journey (no explicit time duration). User selected JOURNEY — rewrite so this hook signals a multi-day / multi-week test (e.g. "7 ngày", "30 hari", "1 tháng").`)
        }
      }
    }
    return failures
  }

  const initialFailures = collectHookFailures(hooks)
  if (initialFailures.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[generateHooks] post-gen check failed (${initialFailures.length} issues), 1 retry…`)
    try {
      const feedback = initialFailures.map((f) => `- ${f}`).join('\n')
      const retryPrompt = `${userPrompt}

PREVIOUS ATTEMPT FAILED THESE CHECKS — fix ONLY these (keep everything else exactly the same):
${feedback}

Return the JSON in the same shape — exactly 6 hooks, each fixing its issue.`
      const raw3 = await directGeminiText({
        apiKey: params.geminiKey,
        systemInstruction,
        prompt: retryPrompt,
        maxOutputTokens: 3072,
        temperature: 1.0,
        thinkingBudget: 0,
        responseMimeType: 'application/json',
        responseSchema: HOOKS_RESPONSE_SCHEMA,
      })
      const hooks3 = parseHooks(raw3, params.lang) ?? parseHooks(repairJsonString(raw3), params.lang) ?? salvageHooks(raw3, params.lang)
      if (hooks3 && hooks3.length >= 4) {
        if (params.lang === 'vi') for (const h of hooks3) h.text = spellFixVi(h.text)
        const retryFailures = collectHookFailures(hooks3)
        // Keep retry only if it actually reduced failures.
        if (retryFailures.length < initialFailures.length) hooks = hooks3
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[generateHooks] post-gen retry failed (silent fallback):', err)
    }
  }
  return hooks
}

// Salvage hooks from a TRUNCATED / slightly-malformed JSON payload (Gemini cut
// off mid-object, or an unescaped quote broke JSON.parse). Pulls every
// "archetype"/"text" value in document order and zips them by index — every
// COMPLETE hook before the cut survives, even if the closing braces are missing.
function salvageHooks(raw: string, lang: ScriptLang = DEFAULT_SCRIPT_LANG): HookVariant[] | null {
  const archetypes = [...raw.matchAll(/"archetype"\s*:\s*"([a-z_]+)"/g)].map((m) => m[1])
  const texts = [...raw.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1])
  const vis = [...raw.matchAll(/"vi"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1])
  const n = Math.min(archetypes.length, texts.length)
  const out: HookVariant[] = []
  for (let i = 0; i < n; i++) {
    const archetype = HOOK_ARCHETYPE_ORDER.includes(archetypes[i] as HookArchetype)
      ? (archetypes[i] as HookArchetype)
      : undefined
    const text = texts[i].replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()
    const viGloss = vis[i]?.replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim() || undefined
    if (text) {
      out.push({
        style: ARCHETYPE_TO_STYLE[archetype ?? 'curiosity_gap'],
        archetype,
        text,
        viGloss,
        estDurationSec: estimateReadDurationSec(text, lang),
      })
    }
  }
  return out.length > 0 ? out : null
}

function parseHooks(raw: string, lang: ScriptLang = DEFAULT_SCRIPT_LANG): HookVariant[] | null {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  const obj = parsed as { hooks?: Array<{ archetype?: string; text?: string; vi?: string }> }
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
      viGloss: typeof h.vi === 'string' && h.vi.trim() ? h.vi.trim() : undefined,
      estDurationSec: estimateReadDurationSec(h.text.trim(), lang),
    })
  }
  return out.length > 0 ? out : null
}

// ── #6 — Vietnamese translation for display (never used as the script input) ──
// Lets the Vietnamese user understand a non-Vietnamese script/hook without copying
// to Google Translate. Keeps the casual TikTok tone, not a stiff literal gloss.
export async function translateScriptToVietnamese(
  apiKey: string, text: string, fromLang: ScriptLang,
): Promise<string> {
  if (fromLang === 'vi' || !text.trim()) return text
  const fromName = SCRIPT_LANG_GEMINI_NAME[fromLang]
  const systemInstruction =
    `You translate short ad scripts into natural, CASUAL, SPOKEN Vietnamese — the way ` +
    `a real person talks on TikTok (first person, friendly, a bit playful), NOT formal ` +
    `or stiff. The translation is only so a Vietnamese reader understands the meaning ` +
    `and tone; keep the energy, do not soften it into textbook Vietnamese.`
  const prompt =
    `Translate this ${fromName} TikTok ad script into casual spoken Vietnamese. ` +
    `Output ONLY the Vietnamese translation — no notes, no labels, no quotes:\n\n${text}`
  const out = await directGeminiText({
    apiKey, systemInstruction, prompt, maxOutputTokens: 2048, temperature: 0.3,
  })
  return out.trim()
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
      maxOutputTokens: 3072,
      temperature: 0.85,   // creative but still grounded in the brief
      thinkingBudget: 0,   // structured JSON — don't let thinking eat the output budget
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
