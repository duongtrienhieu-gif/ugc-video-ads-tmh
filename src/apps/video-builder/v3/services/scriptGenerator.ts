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
  SCRIPT_LANG_GEMINI_NAME,
} from '../types'
import { AD_STRUCTURES } from './adStructures'
import { pickShapedViralHooks } from './hookViralPatterns'
import { validateBody, validateShapeExecution, validateAnchor, spellFixVi, type BodyBlocks } from './scriptValidator'
import { buildMsBodyVocabBlock } from './bodyPatternsMs'
import { buildShapeOverrideBlock } from './scriptShapes'
import {
  detectHookShape,
  buildSemanticAnswerRule,
  scriptShapeToHookSemantic,
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
      // P4j — picked ScriptShape drives the opening anchor + shape-execution check.
      shape: params.shape,
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
    // P3i — tighter band [0.90, 1.10]. P3x — back to 2 passes (was 3) to cut
    // Gemini call count on free keys: the band is almost always reached on pass
    // 0-1 with the strong refit prompt, so the 3rd pass rarely fired but still
    // counted against the free-tier RPM budget when it did. The loop still
    // BREAKS early the moment the script lands in band.
    // P4n — 1 fit pass (was 2) to cut Gemini calls on free keys. The strong refit
    // prompt lands the script in-band on pass 0 ~always; the 2nd pass rarely moved
    // the needle but still burned a call against the 10 RPM / 250 RPD budget.
    for (let pass = 0; pass < 1; pass++) {
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
- PRODUCT NAMING (speak it like a local) — say the product's name the way a real
  ${args.lang} creator would say it OUT LOUD. If the name is a DESCRIPTIVE English
  phrase (e.g. "Knee Support Booster", "Cooling Neck Fan", "Posture Corrector"),
  render it NATURALLY in ${args.lang} ("đai trợ lực khớp gối", "quạt đeo cổ", "đai
  chỉnh dáng lưng") — do NOT read the clunky English verbatim. KEEP a genuine BRAND
  token as-is (e.g. "Hada Labo", "Anessa", "Xiaomi") — only the descriptive part is
  localized. Pick ONE natural name and use it CONSISTENTLY across all blocks. A
  ${args.lang} viewer should never hear a raw English product name they wouldn't
  naturally say themselves.
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
- MEMORY ANCHOR (P5 — the single most important line for an order that STAYS, not
  just one that's placed): pick the ONE most concrete, TRUE, memorable reason to
  buy from the PRODUCT BRIEF — the strongest of: a real performance fact/number of
  the MAIN job ("bơm đầy lốp ~3 phút, tự tắt"), a unique mechanism, or a concrete
  felt RESULT with an EXPECTATION. ONE thing, a short phrase. Surface it ONCE EARLY
  (in the fixed hook if it already carries it, else the first body sentence) and
  RESTATE it — reworded, not copy-paste — in the CTA. Do NOT repeat it more than
  these 2 places (over-repeating = ad-spam). Output it in the "anchor" field.
- EXPECTATION must be CONCRETE but HONEST (this is what decides keep-vs-return):
  the viewer needs a concrete expectation to decide, so DO give one — but for a
  felt-RESULT product, frame the timeframe as REALISTIC + HEDGED + first-person/
  typical, e.g. "mình thấy đỡ rõ sau khoảng 1 tuần", "đa số dùng đều 2-3 tuần mới
  cảm nhận khác". NEVER an absolute cure or miracle speed ("hết hẳn sau 3 ngày",
  "chữa khỏi", "100%"). If the chosen hook already states a timeframe, REUSE that
  exact one — never introduce a second, contradicting number.
- CONVICTION & TRUST (P5b — what turns a PLACED order into a KEPT order at the door).
  WEAVE 2-3 of these into the blocks where they fit NATURALLY — do NOT add separate
  sections, do NOT force all, NEVER fabricate. Pick what fits THIS product:
    • QUALIFY (highest value — also FILTERS impulse-wrong orders that get refused):
      one short line saying who it's FOR and, honestly, who it's NOT for / when you
      don't need it ("hợp [đúng persona]; nhà đã có [giải pháp khác] thì khỏi cần").
      Naming who it's NOT for reads as honest → builds trust + cuts returns.
    • RISK REVERSAL in the CTA (only if plausible for a real seller): a concrete,
      HONEST assurance — "đổi trả / bảo hành / lỗi hoàn tiền" — NOT a fake "đền 10 lần".
    • STAKES: make the pain's CONSEQUENCE concrete + real (what actually happens if
      unsolved) — honest, not catastrophizing ("kẹt giữa đường tối, con nhỏ trên xe").
    • OBJECTION: pre-empt ONE real doubt a buyer of THIS product has, in a clause
      ("không lo nóng máy / không nặng / dễ dùng, bấm 1 nút").
    • SOCIAL PROOF: ONLY if there's a REAL figure in the brief (sold count / rating).
      If none → SKIP entirely. NEVER invent "10k đã mua / 50 triệu người".
  Keep these conversational + SPARSE — trust beats woven in, NOT an ad checklist.
- LANGUAGE (anchor/expectation/conviction): every example phrase in the rules above
  is ILLUSTRATIVE Vietnamese — WRITE THE ACTUAL SCRIPT 100% in ${args.lang}. For
  Bahasa Malaysia use the natural LOCAL register (light rojak), NEVER Vietnamese
  words and NEVER a word-for-word Vietnamese calque; for English, idiomatic English.
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
  "anchor":    "string (the ONE concrete true reason/expectation — see MEMORY ANCHOR rule)",
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
    // P5 (Anchor) — the ONE concrete, true, memorable reason/expectation the
    // script plants early + restates at the CTA. Used by validateAnchor; harmless
    // for the own-script segmenter (it just won't fill it).
    anchor:      { type: 'string', maxLength: 140 },
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
  /** P4j — the user's picked ScriptShape. Drives the hook-answer anchor (so the
   *  body opens in the SHAPE the user chose, not a re-guess from the hook text)
   *  AND the post-gen shape-execution check. Omit → narrative (detect from hook). */
  shape?: import('../types').ScriptShape
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
  // P4j — anchor the body's opening to the SHAPE THE USER PICKED. The old code
  // re-detected the shape from the hook TEXT, which mis-fired ("So với…" → 'general')
  // and let the body drift into a confession. The explicit ScriptShape wins; we
  // only fall back to hook-text detection for the 'narrative' (no-shape) case.
  const resolvedHookShape = scriptShapeToHookSemantic(args.shape) ?? detectHookShape(args.chosenHook)
  const semanticRule = buildSemanticAnswerRule(resolvedHookShape, args.chosenHook)
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
  // P5 (Anchor) — the ONE concrete reason/expectation Gemini chose (best-effort).
  let anchor = parseAnchor(raw)

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
    // P4j — combine the body checks (symptom/CTA/banned/semantic) with the
    // shape-execution check (does the body actually run the chosen shape).
    const bodyCheck = validateBody(bodyBlocks, args.structure, args.lang, resolvedHookShape)
    const shapeCheck = validateShapeExecution(bodyBlocks, args.shape, args.lang)
    // P5 — anchor present + concrete + repeated (early↔cta) + honest (no absolute cure).
    const anchorCheck = validateAnchor(bodyBlocks, anchor, args.lang)
    const check = { ok: bodyCheck.ok && shapeCheck.ok && anchorCheck.ok, failures: [...bodyCheck.failures, ...shapeCheck.failures, ...anchorCheck.failures] }
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
          const anchor2 = parseAnchor(raw2)
          const blk2: BodyBlocks = {
            hook: blocks2.hook,
            pain: blocks2.pain ?? '',
            discovery: blocks2.discovery ?? '',
            benefit: blocks2.benefit ?? '',
            cta: blocks2.cta ?? '',
          }
          const c2body = validateBody(blk2, args.structure, args.lang, resolvedHookShape)
          const c2shape = validateShapeExecution(blk2, args.shape, args.lang)
          const c2anchor = validateAnchor(blk2, anchor2, args.lang)
          const failures2 = c2body.failures.length + c2shape.failures.length + c2anchor.failures.length
          // Keep retry only if it actually fixed MORE than it broke.
          if (failures2 < check.failures.length) { blocks = blocks2; anchor = anchor2 }
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

// HOOKS_RESPONSE_SCHEMA removed in P3u — generateHooks no longer calls Gemini.

/**
 * P3u — Generate 6 hooks for the picked SHAPE by randomly sampling the curated
 * 50-hook viral library (per shape). NO Gemini call: the user audited every
 * Gemini hook generation drifting on pronoun ("tôi" vs "mình"), spelling
 * ("Hấu hết"), or fabricated stat ("740.000 hộp") — and concluded the safer
 * path is to skip the LLM entirely and pick from a pre-curated Tier S+ pool.
 *
 * Free (0 Gemini quota), zero-latency, guaranteed to land in Tier S+ voice.
 * The previousBatch is excluded from re-rolls so "Đổi 6 hook" produces a
 * genuinely different batch.
 */
export async function generateHooks(params: GenerateHooksParams): Promise<HookVariant[]> {
  const shape = (params.shape ?? 'narrative') as 'narrative' | 'listicle' | 'comparison' | 'journey'
  const groupArchetype: HookArchetype = GROUP_TO_DEFAULT_ARCHETYPE[params.framework]
  const archetypeStyle: HookStyle = ARCHETYPE_TO_STYLE[groupArchetype]
  // [1] Pick 6 proven viral SKELETONS for the shape (Tier S+ structure + voice).
  const picked = pickShapedViralHooks({
    shape,
    count: 6,
    lang: params.lang,
    exclude: params.previousBatch,
  })
  // [2] P3y — ADAPT each skeleton to THIS product via ONE cheap Gemini call.
  // P3u picked skeletons verbatim → hooks were generic ("Mình đã đổi ý về điều
  // này") with zero product relevance. We keep the skeleton's structure/energy
  // but swap the vague placeholder ("điều này / cái này / nó") for a SHORT,
  // natural reference to the product or its core benefit. On ANY failure we fall
  // back to the raw skeletons (never break the step).
  let finalTexts = picked
  try {
    const adapted = await adaptHooksToProduct({
      apiKey: params.geminiKey,
      lang: params.lang,
      productName: params.productName,
      productPitch: params.productPitch,
      creatorDescription: params.creatorDescription,
      skeletons: picked,
    })
    if (adapted.length >= Math.min(4, picked.length)) {
      // Keep order; if the model returned fewer than 6, top up with the
      // remaining raw skeletons so the user still sees 6 cards.
      finalTexts = picked.map((raw, i) => adapted[i]?.trim() || raw)
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[generateHooks] adapt failed, dùng skeleton gốc:', e)
  }
  // [3] VN spell-fix safety net + build variants.
  const fixed = params.lang === 'vi' ? finalTexts.map((t) => spellFixVi(t)) : finalTexts
  const hooks: HookVariant[] = fixed.map((text) => ({
    style: archetypeStyle,
    archetype: groupArchetype,
    text,
    estDurationSec: estimateReadDurationSec(text, params.lang),
  }))
  return hooks
}

// P3y — adapt viral hook SKELETONS to a specific product. One Gemini call, returns
// one rewritten hook per skeleton (same order). Keeps the skeleton's structure +
// scroll-stop energy but grounds it in the product. Flexible length — the user
// explicitly asked NOT to cap word count (a hard cap made the model over-stuff
// product specs and break the hook's logic); the rule is "hook hay > nhồi từ".
async function adaptHooksToProduct(args: {
  apiKey: string
  lang: ScriptLang
  productName: string
  productPitch: string
  creatorDescription?: string
  skeletons: string[]
}): Promise<string[]> {
  const langName = SCRIPT_LANG_GEMINI_NAME[args.lang]
  const creatorLine = args.creatorDescription
    ? `\nCREATOR VOICE: ${args.creatorDescription}` : ''
  const numbered = args.skeletons.map((s, i) => `${i + 1}. ${s}`).join('\n')
  const systemInstruction =
`You ADAPT proven viral TikTok hook SKELETONS to a specific product, writing in ${langName}.
You are given ${args.skeletons.length} Tier S+ scroll-stop hook skeletons + a product brief.
Rewrite EACH skeleton so it is now ABOUT this product — KEEP its sentence structure,
rhythm, shock device and energy, but replace any vague placeholder ("điều này / cái
này / thứ này / nó / cách này" or their ${langName} equivalents) with a SHORT, natural
reference to the product OR its core purpose / benefit / standout feature.

HARD RULES:
- The hook MUST now clearly connect to the product (its job, its benefit, or what it
  IS) — a viewer should sense what's being sold, not a blank "điều này".
- You MAY shorten the product name (e.g. "máy bơm mini" instead of the full long
  name). NEVER cram the full specs — a hook is a SCROLL-STOP, not a feature list.
- LOCALIZE THE NAME — if the product name is a DESCRIPTIVE English phrase ("Knee
  Support Booster", "Cooling Neck Fan"), say it naturally in ${langName} ("đai trợ
  lực khớp gối", "quạt đeo cổ"), NOT the English verbatim. KEEP a genuine BRAND
  token as-is. A ${langName} viewer must not hear a raw English name they wouldn't say.
- P5 — if the hook implies a RESULT TIMEFRAME, keep it REALISTIC + HEDGED + first-
  person/typical ("đỡ rõ sau khoảng 1 tuần", "đa số 2-3 tuần"), NEVER an absolute
  cure or miracle speed ("hết hẳn sau 3 ngày", "chữa khỏi", "100%"). A believable
  expectation converts AND survives delivery; a miracle promise gets refused at the door.
- ${pronounRule(langName).replace(/^- /, '')}
- LENGTH IS FLEXIBLE — do NOT pad and do NOT over-stuff product words; if adding the
  product makes it clunky, keep it tight. PRIORITISE that the hook reads GREAT and
  natural over cramming product terms. A punchy short hook beats a stuffed long one.
- NEVER invent a statistic / number that is not in the brief.
- Keep it 100% in ${langName}, casual spoken TikTok register.

OUTPUT: exactly ${args.skeletons.length} lines, ONE adapted hook per line, in the SAME
order as the skeletons. No numbering, no quotes, no commentary, no blank lines.`
  const prompt =
`PRODUCT: ${args.productName}
PRODUCT BRIEF (ground the hooks in these real facts; may be Vietnamese — understand
it but write only in ${langName}):
${args.productPitch}${creatorLine}

SKELETONS to adapt (rewrite each to be about the product, keep its structure):
${numbered}

Output ${args.skeletons.length} adapted hooks now — one per line, same order.`
  const raw = await directGeminiText({
    apiKey: args.apiKey,
    systemInstruction,
    prompt,
    maxOutputTokens: 1024,
    temperature: 0.8,
    thinkingBudget: 0,
  })
  // Parse: one hook per line. Strip any stray numbering / bullets / quotes.
  return raw
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').replace(/^["'“”\-•]+|["'“”]+$/g, '').trim())
    .filter((l) => l.length > 0)
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

// P5 (Anchor) — best-effort pull of the top-level "anchor" field. Separate from
// tryParseSegments so its return type (blocks) stays unchanged. Returns '' if absent.
function parseAnchor(raw: string): string {
  try {
    const obj = JSON.parse(raw) as { anchor?: unknown }
    return typeof obj?.anchor === 'string' ? obj.anchor.trim() : ''
  } catch { return '' }
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
