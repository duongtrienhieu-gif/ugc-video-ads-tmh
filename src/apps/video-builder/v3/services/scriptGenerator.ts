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
import { validateBody, validateShapeExecution, validateAnchor, spellFixVi, stripMoney, stripOfferLadder, type BodyBlocks } from './scriptValidator'
import { buildMsBodyVocabBlock } from './bodyPatternsMs'
import { buildShapeOverrideBlock } from './scriptShapes'
import {
  detectHookShape,
  buildSemanticAnswerRule,
  scriptShapeToHookSemantic,
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
  /** P5e "Tạo lại kịch bản" — the previous script the user wants to replace. When
   *  present (hook-first regenerate), it is fed to Gemini with a DIVERGE instruction
   *  so the new version is genuinely different (not a lazy near-duplicate), while the
   *  fixed hook + product facts + shape stay the same. */
  previousScript?: string
  /** Phase A — OPTIONAL bundled gift. Already RESOLVED by the caller (name
   *  localised to the output lang + a benefit line — via giftBenefitForVideo).
   *  When present, the AI weaves "tặng kèm {name} — {benefitLine}" into the CTA
   *  block ONLY; the 4 hero blocks are untouched. No price ever (guard strips it). */
  gift?: { name: string; benefitLine: string }
  /** Reply-to-comment mode — the on-screen TikTok comment this video answers. When set,
   *  there is NO picked hook: the comment IS the hook (rendered as a card), and the FIRST
   *  spoken line (hook block) is written as the creator REPLYING to this comment, then
   *  bridging into the body. The comment itself is never spoken. */
  replyComment?: string
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
      // P5e — "Tạo lại kịch bản": diverge from the previous version when present.
      previousScript: params.previousScript,
      userPrompt: buildUserPrompt({
        productName: params.productName,
        productPitch: params.productPitch,
        creatorDescription: params.creatorDescription,
        targetDurationSec: params.targetDurationSec,
        budgets,
        structureLabel: structure.labelVi,
        angleLabel: angle.labelVi,
        lang,
        gift: params.gift,
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
      gift: params.gift,
      replyComment: params.replyComment,
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
    // P4n cut this to 1 pass to save free-tier Gemini calls — but with no re-measure
    // after pass 0, a refit that over/under-shot was never corrected → the 60s→52-70s
    // drift the user reported. P5d — back to a CONDITIONAL 2nd pass: the band check at
    // the top of the loop is the gate, so pass 1 only fires a 2nd Gemini call when the
    // script is STILL outside ±10% after pass 0 (the actual drift cases). When pass 0
    // already lands in-band — the common case — the loop breaks and no extra call burns.
    // P5n — up to 3 CONDITIONAL passes (was 2). The band check at the top gates every
    // pass, so an in-band script still breaks immediately with ZERO refit calls; the
    // extra pass only fires when STILL out of band. Needed because a regenerated +
    // benefit-rich script can land ~1.3× over (the user saw 79.6s vs a 60s pick) and 2
    // trims weren't enough. When FAR over (>20%), refit is told to cut AGGRESSIVELY
    // (drop secondary benefits, keep only the spine) so it actually reaches the band.
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
        aggressive: durNow > target * 1.20,   // far over → cut hard, sacrifice minor coverage
      })
      if (!refit) break
      blockMap = refit
    }
    // HARD guards (user rule, UNIVERSAL VN/MS/EN): the script NEVER speaks a PRICE, and the
    // offer NEVER escalates past "buy 1 free 1". Prompt nudges are unreliable — esp. for MY,
    // which still emitted "RM59 je" AND the tier ladder "beli 2 dapat 2 free beli 3 dapat 3
    // free…". Strip BOTH deterministically from EVERY block (not CTA-only — price/ladder can
    // land anywhere). The allowed offer NAME ("mua 1 tặng 1" / "Beli 1 Percuma 1") carries no
    // price number + buy-count 1 → survives both strips. (Runs before the verbatim-hook
    // re-set below, so a user-picked hook is never altered.)
    for (const id of SCRIPT_BLOCK_IDS) {
      if (blockMap[id]) blockMap[id] = stripOfferLadder(stripMoney(blockMap[id]))
    }
    // Keep the user's picked hook verbatim through any refit.
    if ((params.chosenHook ?? '').trim()) blockMap.hook = params.chosenHook!.trim()
    parsed = { ...parsed, blocks: blockMap }
  }

  // Phase A — DETERMINISTIC gift-CTA ordering. Runs for BOTH paths (incl. own-script / pasted
  // script): the prompt asks the model to end on the urgency buy-push with the gift just before
  // it, but Gemini often appends the gift LAST (burying the close — the user audited this), and
  // the own-script path used to SKIP this entirely → the gift silently vanished. Force the order:
  // [...other CTA sentences] → [gift] → [urgency LAST]. No-op when gift is off or it can't
  // confidently find both a gift + an urgency sentence (never mangles a normal CTA).
  if (params.gift?.name?.trim() && parsed.blocks.cta) {
    // (a) GUARANTEE the gift is present (Gemini drop / refit trim / own-script omission) — inject if missing.
    const ctaWithGift = ensureGiftInCta(parsed.blocks.cta, params.gift.name, params.gift.benefitLine, params.lang)
    // (b) order it: [...] → [gift] → [urgency LAST].
    parsed = { ...parsed, blocks: { ...parsed.blocks, cta: reorderGiftBeforeFinalCta(ctaWithGift, params.gift.name) } }
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
    anchor: parsed.anchor?.trim() || undefined,   // P5m — carry to the director (hero shot)
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

// Phase A — URGENCY / SCARCITY cue (the line the CTA must END on). DELIBERATELY excludes plain
// buy verbs (mua / beli / order / đặt / chốt) — those mark the OFFER ("Mua 1 Tặng 1"), NOT the
// hurry-close, and including them made the reorder mistake the offer for the close (the audited
// "Mua 1 Tặng 1 nhảy ra cuối" bug). Keep only HURRY / SCARCITY words. Universal VN / MS / EN.
const GIFT_CTA_URGENCY_RE =
  /(nhanh tay|kẻo|hết hàng|hốt l[eẹ]|hốt ngay|đừng (?:bỏ|để) l[ỡõ]|gấp lên|grab cepat|cepat|jangan tunggu|jangan lepas|sebelum (?:stok )?habis|stok terhad|sekarang|hurry|last chance|limited stock|while stock)/i

function stripDiacriticsLower(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Reorder the CTA block so the LAST spoken sentence is the urgency buy-push, with the
 *  gift announced JUST BEFORE it. Returns the text UNCHANGED unless it confidently finds
 *  BOTH a gift sentence (contains the gift name) AND a separate urgency sentence — so a
 *  normal CTA is never mangled. Universal across VN / MS / EN. */
function reorderGiftBeforeFinalCta(cta: string, giftName: string): string {
  const text = (cta ?? '').trim()
  const name = (giftName ?? '').trim()
  if (!text || !name) return cta
  const sentences = (text.match(/[^.!?…]+[.!?…]*/g) ?? [text]).map((s) => s.trim()).filter(Boolean)
  if (sentences.length < 2) return cta
  const nName = stripDiacriticsLower(name)
  const giftIdx = sentences.findIndex((s) => stripDiacriticsLower(s).includes(nName))
  if (giftIdx < 0) return cta   // gift not found in the CTA → leave as-is
  // The urgency line = the LAST non-gift sentence carrying a buy/urgency cue.
  let urgencyIdx = -1
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (i === giftIdx) continue
    if (GIFT_CTA_URGENCY_RE.test(sentences[i])) { urgencyIdx = i; break }
  }
  if (urgencyIdx < 0) return cta   // nothing to end on → don't risk reordering
  // Already correct (gift immediately before urgency, urgency last) → no-op.
  if (urgencyIdx === sentences.length - 1 && giftIdx === urgencyIdx - 1) return cta
  const gift = sentences[giftIdx]
  const urgency = sentences[urgencyIdx]
  const rest = sentences.filter((_, i) => i !== giftIdx && i !== urgencyIdx)
  return [...rest, gift, urgency].join(' ')
}

/** Phase A — GUARANTEE the gift appears in the CTA. Gemini sometimes drops it, and the
 *  fit-to-length refit can trim it (gift = "compressible"). Runs AFTER refit + stripMoney:
 *  if the gift name (or its most distinctive word) is NOT already in the CTA, inject ONE short
 *  native clause just BEFORE the final sentence (so the close stays last). No-op when the gift
 *  is already present → never duplicates. Connector is per-language so it reads native. */
function ensureGiftInCta(cta: string, giftName: string, benefitLine: string, lang: ScriptLang): string {
  const text = (cta ?? '').trim()
  const name = (giftName ?? '').trim()
  if (!text || !name) return cta
  const ctaN = stripDiacriticsLower(text)
  // Present if the full name OR its longest distinctive word (≥4 chars) is already in the CTA.
  const longest = name.split(/\s+/).filter((w) => w.length >= 4).sort((a, b) => b.length - a.length)[0]
  if (ctaN.includes(stripDiacriticsLower(name)) || (longest && ctaN.includes(stripDiacriticsLower(longest)))) return text
  const benefit = (benefitLine ?? '').trim().replace(/[.!?…]+$/, '')
  // Per-language gift clause (name + benefit already localized to the output lang).
  const clause = lang === 'ms'
    ? `Dapat ${name} percuma${benefit ? ` — ${benefit}` : ''}.`
    : lang === 'en'
      ? `Plus a free ${name}${benefit ? ` — ${benefit}` : ''}.`
      : `Tặng kèm ${name}${benefit ? ` — ${benefit}` : ''}.`
  const sentences = (text.match(/[^.!?…]+[.!?…]*/g) ?? [text]).map((s) => s.trim()).filter(Boolean)
  if (sentences.length <= 1) return `${text} ${clause}`.trim()
  sentences.splice(sentences.length - 1, 0, clause)   // insert before the final (urgency) sentence
  return sentences.join(' ')
}

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

FIRST-ATTEMPT QUALITY BAR (this is your BEST take, not a draft — do not rely on a rewrite):
write TIGHT, punchy, máu lửa — every line earns its place, no rambling, no generic
throat-clearing opener, hit the target length. Make attempt #1 as sharp as if you'd
already revised it twice.

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
- ENERGY = THE JOB (FLAT IS THE ENEMY): this is a SELLER hyping a product they're
  excited about — NOT a calm diary. High energy, momentum, "phải mua ngay" feel. A
  flat, even-toned recital is the #1 reason nobody buys. Use spoken HYPE markers in
  ${args.lang} (VN: "trời ơi", "mê xỉu", "đỉnh thật sự", "chốt đơn liền", "xịn dã man";
  MS rojak: "gila", "confirm", "terbaik", "memang padu", "jangan main-main") — always
  the LOCAL equivalent, never Vietnamese inside an MS script.
- TikTok RHYTHM: VARY sentence length — alternate PUNCH lines (3-7 words: "Trời ơi mê
  quá.", "Đỉnh thật.", "Chốt liền.") with FULLER lines (12-18 words). punch, full,
  punch, full. All-long = flat; all-short = jumpy. Imperfect conversational phrasing ok.
  HARD CAP: keep EVERY sentence ≤ ~18 words / ≤ one breath (~5s spoken). Each sentence
  is ONE filmable beat → it becomes ONE scene. NEVER write a run-on that needs a comma-
  splice to breathe — split it into two short sentences at the natural clause break. A
  sentence longer than one breath gets chopped mid-thought at render → an ugly 2-3s
  scene with a dangling 4-5 word fragment. End each sentence on a complete thought.
- BENEFITS AS HITS, NOT A LIST: stack as many strong benefits as you want (more
  benefits = more desire) — but land EACH as a SHARP, punchy hit with energy, NEVER
  a flat monotone recital. And say each idea ONCE: repeating the SAME benefit 3-4×
  DILUTES the punch, it doesn't add it.
- Write in the casual everyday spoken register of ${args.lang} — the way a real
  person talks to friends. 100% in ${args.lang}; never borrow filler from another
  language. NO formal salutation.
${pronounRule(args.lang)}
- PRODUCT NAMING (speak it like a local) — say the product's name the way a real
  ${args.lang} creator would say it OUT LOUD. The descriptive / common-noun parts of
  the name must be in ${args.lang}, NO MATTER what language they arrive in:
    • from English ("Knee Support Booster", "APRICOT SNACK") → natural ${args.lang}
      ("đai trợ lực khớp gối"; VN "snack mơ khô" — NOT "snack aprikot"/"apricot").
    • from VIETNAMESE — the brief is Vietnamese, so its name often has Vietnamese words
      ("tỏi", "mùi tây", "máy bơm"). TRANSLATE every such word into ${args.lang}; NEVER
      leave a Vietnamese word (MS: "tỏi"→"bawang putih", "mùi tây"→"pasli", "máy bơm"→"pam").
  Do this EVEN IF the name is Capitalized / looks like a brand: a COMMON NOUN (apricot,
  snack, garlic, pump, serum) is NOT a brand — translate it. WHEN UNSURE, TRANSLATE.
  KEEP only a genuine INVENTED brand token as-is (e.g. "Hada Labo", "Anessa", "Xiaomi").
  Every word of the name you say MUST be a real ${args.lang} word. Pick ONE natural name and use it CONSISTENTLY across
  all blocks. ZERO source-language leakage: a ${args.lang} viewer must never hear a
  Vietnamese or raw-English word they wouldn't say themselves — that instantly reads
  as a foreign-run / machine-translated ad and kills trust.
- The product should appear as a discovery the speaker stumbled onto, NOT
  as a sponsored mention. Avoid "today I'll tell you about X".
- GROUND IT IN THE REAL PRODUCT — do NOT stay vague ("some Korean technology",
  "this serum", "công nghệ gì đó", "thứ này"). Vague copy persuades nobody AND
  gives the downstream visual director nothing to show. A real person who actually
  uses a product can name what is in it and why it works — so must this script,
  grounded in the PRODUCT BRIEF. SELL HARD — bold benefit claims + a plausible
  popularity/"everyone loves it" vibe are GOOD (they excite and a viewer can't
  disprove them). The ONLY things you must NOT invent are FALSIFIABLE-AT-THE-DOOR
  facts: don't claim an ingredient/material the product doesn't have, and don't
  invent a precise checkable spec (size/weight/capacity) that contradicts the brief:
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
- APPETITE-FIRST (ONLY when the product is EATEN or DRUNK — a food, snack, drink, seasoning,
  anything taken by mouth): make TASTE / CRAVE the LEAD desire, not a footnote under the
  health mechanism. Open the wanting on flavour ("thơm phức, đậm đà, cắn miếng là ghiền"),
  and make sure ONE beat is an enjoyment moment the director can FILM — a satisfied bite /
  sip + the face reaction. This is a WEIGHTING shift (more crave, less raw mechanism), NOT
  extra length. For NON-edible products this rule does nothing — keep the normal
  mechanism/result focus.
- BENEFIT LADDER (UNIVERSAL — the upgrade that makes people FEEL the benefit instead of
  reading a label): NEVER leave a benefit as a bare mechanism / medical-sounding term
  ("kiểm soát cholesterol", "hỗ trợ tim mạch", "kháng khuẩn"). Ladder each one DOWN to what
  the buyer FEELS in daily life + the FEAR it lifts — AND anchor that felt result to ONE
  OBSERVABLE everyday ACTION / SITUATION a phone could film, so the feeling is SHOWN through
  a visible moment, not stated as a bare inner adjective. This REWRITES the benefit you
  already chose — it does NOT add new benefits or length:
    • "kiểm soát cholesterol" → "người nhẹ hẳn — leo ba tầng cầu thang không còn đứng thở dốc"
    • "bơm đầy lốp 3 phút" → "hết cảnh kẹt giữa đường — tự cắm bơm, ba phút lên xe đi tiếp"
    • "cấp ẩm sâu" → "da hết khô căng — sáng soi gương, ra đường khỏi lớp che khuyết điểm"
    • (đồ gia dụng) "lực hút mạnh" → "hút một đường là sàn sạch bóng, cúi xuống sờ hết sạn"
    • (thú cưng) "hợp vị, dễ ăn" → "vừa đổ ra là nó chạy lại, ăn sạch bát không bỏ thừa"
  SHOW THE RESULT, DON'T JUST NAME THE FEELING — a pure inner-state line ("thấy khỏe hơn /
  tự tin hơn / dễ chịu hơn" and the equivalent in any language) is too abstract to film ON
  ITS OWN. Keep the feeling ONLY if the same or the next clause carries the visible action /
  situation that proves it. Feeling = the WHY; the observable action = the SHOT.
  This ALSO bans the empty PAYOFF / VERDICT line — a reaction or judgement carrying NO visible
  change ("bất ngờ thật sự / đáng đồng tiền / không hối hận / như được hồi sinh / khác hẳn",
  MS "memang berbaloi / takkan menyesal / terbaik", EN "I was amazed / so worth it / life-
  changing"). Each MUST be rewritten as the VISIBLE result the verdict is about — e.g.
  "đáng tiền" → "ăn sạch bát, cả nhà xúm vào đòi thêm"; "như được hồi sinh" → "soi gương thấy
  da căng sáng bật hẳn lên so với tuần trước"; MS "takkan menyesal" → "naik tangga laju, lutut
  takde bunyi krek dah". A verdict word may stay ONLY if its OWN clause already shows that
  visible change.
  Mechanism may appear ONCE as the reason; the SELL is always the laddered felt result +
  fear. Use HEDGED support verbs ("hỗ trợ / giúp / cảm thấy") — never a cure ("chữa khỏi /
  hết hẳn") and never a cert (Halal/FDA/clinically proven); those are the money-losing lines
  (see guards below).
- VISUAL DENSITY (one filmable BEAT per sentence — this is what lets the video director cut
  clean, grounded shots instead of guessing, and is what kills generic b-roll): in the
  DISCOVERY and BENEFIT blocks, write each visual moment as its OWN short spoken sentence —
  do NOT bundle two or three separate moments into one long compound sentence (the director
  cuts on sentence beats; a 3-moment run-on collapses into one vague shot). AND every sentence
  that makes a CLAIM, names a SPEC, or states a RESULT must carry a CONCRETE FILMABLE SUBJECT
  — a real object / part / texture / action, or a person doing something visible — NEVER a
  bare adjective-only line ("xịn lắm / đáng tiền / ai cũng khen / chất lượng thật sự" standing
  alone). This is STILL natural spoken speech, NOT a shot list: do NOT write camera or scene
  directions — just talk in concrete nouns + verbs a phone could film. Universal across niches
  (illustrative — split into beats, each filmable):
    • health → "Mình uống một viên buổi sáng." / "Trưa không còn tụt năng lượng gục xuống bàn." (NOT "giúp khỏe hơn")
    • home   → "Xịt lên mặt kính." / "Lau một đường, vết ố tan ra thấy liền." (NOT "làm sạch hiệu quả")
    • auto   → "Cắm vào tẩu thuốc xe." / "Ba phút lốp căng, đồng hồ tự tắt." (NOT "tiện lợi dễ dùng")
    • food   → "Cắn một miếng." / "Vỏ vỡ rốp, nhân chảy ra nóng hổi." (NOT "ăn rất ngon")
  Write the actual script 100% in the target language per the LANGUAGE rule (the examples are
  illustrative Vietnamese; for Bahasa Malaysia use the native rojak register, never a calque).
- EMPATHY ECHO — the hook touches a pain / persona / moment; the benefit block
  MUST come back to that EXACT concrete MOMENT (the same time / place / action from
  the hook or pain) in a NEW, VISIBLY CHANGED state — close the loop on the SAME scene a
  camera could film, NOT on an abstract "thấy khá hơn". Reuse the moment, show the new
  behaviour in it ("hồi đó 3 giờ chiều gục trên bàn ôm đầu / giờ 3 giờ chiều vẫn ngồi làm
  phăng phăng"). Anchoring to the concrete moment (not the bare feeling) keeps the echo
  filmable. Universal across niches.
- POINT-OF-CONTACT — EVERY pain / struggle / problem line (not just one) must be a
  CONCRETE everyday moment a phone could FILM — a TIME of day / a PLACE / a visible
  ACTION the persona DOES or a thing they SEE — never a bare feeling word. A pure
  inner-state pain ("thấy nản / chán / mệt mỏi / tự ti / da xám xịt không sức sống",
  MS "rasa penat / macam dah tua / tak bermaya / kulit kusam", and the like in any
  language) gives the director NOTHING to shoot → it collapses into a generic sad
  face. Keep the feeling ONLY if the SAME or next clause shows the visible moment
  that proves it. Example upgrades:
    bad:  "tôi hay mệt" → good: "3 giờ chiều ngồi máy tính, dạ dày kêu, cứ với tay tìm gì đó nhâm nhi"
    bad:  "lười skincare" → good: "tối thứ Sáu uể oải, chỉ kịp vỗ 2 giọt rồi đi ngủ"
    bad:  "da xám xịt, không sức sống" → good: "sáng soi gương, kéo cổ áo xuống thấy vệt thâm sạm hai bên gò má"
    bad:  "soi gương thấy nản" → good: "đứng trước gương, kéo da má lên rồi buông, nó chảy xệ xuống"
    bad (MS): "rasa macam dah tua" → good: "bangun pagi, nak bangun dari katil pun lutut bunyi krek, kena pegang dinding"
  Read the brief to pick the moment that fits the persona — universal across niches.
- MEMORY ANCHOR (P5 — the single most important line for an order that STAYS, not
  just one that's placed): pick the ONE most concrete, TRUE, memorable reason to
  buy from the PRODUCT BRIEF — the strongest of: a real performance fact/number of
  the MAIN job ("bơm đầy lốp ~3 phút, tự tắt"), a unique mechanism, or a concrete
  felt RESULT with an EXPECTATION. ONE thing, a short phrase. Surface it ONCE EARLY
  (in the fixed hook if it already carries it, else the first body sentence) and
  RESTATE it — reworded, not copy-paste — in the CTA. Do NOT repeat it more than
  these 2 places (over-repeating = ad-spam). Output it in the "anchor" field.
- EXPECTATION must be CONCRETE + EXCITING (the viewer needs a vivid expectation to
  buy, so give a BOLD one). The ONLY guardrail (a MONEY rule, not a soft one): do NOT
  make a SPECIFIC, TIME-BOUND, CHECKABLE-ON-ARRIVAL CURE promise the product visibly
  fails on day 1 — "hết hẳn đau sau đúng 3 ngày", "khỏi bệnh 100%". That one bounces
  at the COD door = a refused parcel = your money lost. Everything else can be bold:
  big benefits, dream outcome, "đổi đời", a confident felt result ("cảm nhận khác rõ
  lắm"). Prefer first-person/typical for time results ("mình thấy khác sau tầm 1
  tuần") — exciting but not a falsifiable deadline. If the chosen hook already states
  a timeframe, REUSE that exact one — never a second, contradicting number.
- CONVICTION LEVERS (P5b — these BOTH push the order AND help it survive to the door).
  WEAVE 2-3 where they fit NATURALLY — do NOT add separate sections, do NOT force all.
  Pick what fits THIS product:
    • QUALIFY (desire + filter lever): a line on who it's PERFECT for + a light "not
      for everyone" exclusivity ("hợp [đúng persona]; ai [tình huống ngược] thì thôi").
      Creates "that's ME" desire AND quietly filters the wrong buyer.
    • RISK REVERSAL in the CTA: a confident assurance — "đổi trả / bảo hành / lỗi
      hoàn tiền". Make it BOLD; just don't promise a refund mechanism that doesn't exist.
    • STAKES: dramatize the pain's CONSEQUENCE hard ("kẹt giữa đường tối, con nhỏ
      trên xe, gọi cứu hộ cả tiếng") — push the fear, that's fine.
    • OBJECTION: smash ONE real doubt in a clause ("không lo nóng máy / không nặng").
  Keep them woven + punchy (energy!), NOT a flat checklist.
- SOCIAL PROOF — MANDATORY, and it must be its OWN clear, punchy WIDER-PUBLIC CROWD beat
  about MANY people. Does NOT count (too weak): a family-only line ("cả nhà mình ai cũng
  khen"), a soft personal aside ("nhỏ bạn mình cũng mê"), AND — important — a SINGLE
  reviewer / one expert / one chef ("một chị đầu bếp review nó", "có người nổi tiếng dùng").
  One person endorsing it is NOT herd proof. The beat MUST be the PLURAL crowd: a NUMBER
  ("mấy nghìn người mua rồi"), SOLD-OUT ("bán cháy hàng mấy đợt"), REPEAT buyers ("ai mua
  cũng quay lại đặt thêm"), or MANY ratings ("review toàn 5 sao", "cả ngàn đánh giá 5 sao").
  EVERY script MUST contain ONE such explicit HERD line — because the video turns this exact
  line into a believable social-proof CARD (a Facebook-post / review screenshot) on screen.
  (A single chef/expert can ALSO appear as a separate authority beat, but it does NOT
  replace the crowd line.) State it as a STANDALONE
  sentence the viewer can't check at the door, e.g. "mấy nghìn người mua rồi", "bán cháy
  hàng mấy đợt liền", "ai mua cũng quay lại đặt thêm", "review toàn 5 sao". (These examples
  are ILLUSTRATIVE Vietnamese — write the line in ${args.lang} per the LANGUAGE rule below.)
  VARY the wording every time — do NOT reuse the same crowd sentence across regenerations.
  NEVER name a country / market / place that is not in the product brief (e.g. do not write
  "bán chạy bên Malaysia" in a Vietnamese script) — that is drift. PLACEMENT (matters — the
  video CARDS this exact line): put it in the DISCOVERY/BENEFIT proof stretch, BEFORE the
  CTA. Do NOT leave it as the final CTA line — a card can't be the closing buy-shot, so a
  crowd beat stuck at the very end is wasted. GUARD (a MONEY rule, not morality): social
  proof must be a QUALITATIVE VIBE only — NEVER a SPECIFIC number. This means BOTH: do not
  INVENT a number ("740,128 hộp đã bán"), AND do not COPY a specific sold-count / rating-% /
  review-count out of the PRODUCT BRIEF either — even if the brief field literally contains
  "98% đánh giá 5 sao" / "780.000 đã bán", that exact figure is an unverifiable marketing stat
  that reads FAKE and is checkable-at-the-door, so REPHRASE it as a vibe ("mấy trăm nghìn
  người mua rồi", "review toàn 5 sao", "bán cháy hàng"), NEVER the digits / the percent. Also
  NEVER claim a certification (Halal/KKM/GMP/FDA/clinically proven) — those trip ad-review /
  break trust. Don't go cartoonish ("cả thế giới dùng").
- BELIEVABLE PROOF — SHOW, don't just TELL (this is what makes a viewer BELIEVE, and a
  believed promise = an order that STAYS, not one refused at the door). A flat "xịn lắm,
  ai cũng khen" persuades nobody. Weave in ONE concrete proof beat — pick the move that
  fits THIS product, ground it in the brief, NEVER fabricate a review/number:
    • SKEPTIC → CONVERT: admit you doubted it, then what flipped you ("mình cũng tưởng
      quảng cáo nói quá, ai dè…"). Lowers the guard better than any hype.
    • DEMONSTRABLE MOMENT (best — the app films it): a thing you can SHOW on camera —
      bẻ ra / cắm vào / đo / thử ngay ("bẻ một cái ra cho coi, nguyên hạt óc chó lộ ra";
      "cắm vô lốp xẹp, 3 phút đồng hồ nhảy 30 bar rồi tự tắt"). The B-roll director can
      actually shoot this, so the spoken proof + the visual proof match → double trust.
    • SPECIFIC SELF BEFORE→AFTER: your own concrete change, not a stranger's ("chụp lại
      ngày 1 với sau 3 tuần để tự so… vùng má khô đỡ rõ").
    • THIRD-PARTY NOTICED: a real bystander reaction ("nhỏ bạn hỏi đổi gì mà da lạ vậy",
      "mấy chị hỏi mua ở đâu"). For MS, the "aku skeptikal mula-mula…" objection beat is
      the most native version of this.
  ONE proof beat is enough — do NOT dump proof (over-proving reads staged). Show the
  thing, don't assert an adjective.
- DON'T BE TEMPLATED — this product will be turned into MANY ads, so vary it: pick a
  clear CREATOR STANCE for this take (skeptic-turned-fan / nerd-who-tested / friend
  warning you / the person who had the problem) and let it colour the whole script; and
  VARY THE CLOSE — do NOT end every script with the same stock line. Rotate the CTA lever
  + wording each time.
  CTA LÀ MỘT, KHÔNG NHỒI (P6w) — the CTA uses AT MOST 1–2 urgency/FOMO levers, never a pile.
  Do NOT stack "đừng chần chừ + hàng có hạn + không nhanh tay là tiếc + đừng để mai hối hận +
  game changer" in one close (the user audited this clutter). Pick the 1–2 punchiest that fit +
  the offer (if any), say them once, stop. One clean push beats five tired clichés.
  AVOID THESE OVER-USED TEMPLATES (they make every ad sound the same — find a fresh line):
    • Opening clichés: "Mình đã mất rất nhiều tiền vì không biết đến … sớm hơn", "… đang
      thay đổi cách mọi người …", MS "No way … ni macam ni", "Aku rugi berbulan sebab …".
    • Close clichés: "kẻo hết hàng", "đáng tiền lắm luôn", "game changer", "must-have",
      MS "grab cepat sebelum stok habis", "jangan tunggu lama", "memang berbaloi".
  Use the IDEA if it fits, but rephrase it freshly — never the stock sentence verbatim.
- OFFER + CTA PRICE (HARD): NEVER speak a PRICE or money amount in the CTA (or anywhere) —
  no "RM79", "giảm 50%", "chỉ 99k", "-50%". Price is NOT spoken. Mention a DEAL ONLY if the
  PRODUCT BRIEF explicitly states one: if the brief says "mua 1 tặng 1" / "Beli 1 Free 1",
  you MAY state THAT one deal ONCE, VERBATIM as written — NEVER escalate it into a tier ladder
  ("mua 2 tặng 2", "mua 3 tặng 3") and NEVER invent a deal the brief doesn't have. If the brief
  has NO offer, do NOT mention any deal — close on pure URGENCY / FOMO / fear-of-missing-out /
  regret instead ("kẻo hết / nhanh tay kẻo lỡ / bỏ lỡ là tiếc / đừng để mai hối hận").
- LANGUAGE (anchor/expectation/conviction): every example phrase in the rules above
  is ILLUSTRATIVE Vietnamese — WRITE THE ACTUAL SCRIPT 100% in ${args.lang}. For
  Bahasa Malaysia use the natural LOCAL register (light rojak), NEVER Vietnamese
  words and NEVER a word-for-word Vietnamese calque; for English, idiomatic English.
- SELL HARD (the smart way): exaggerate the BENEFIT, the DREAM and the emotion
  freely — that excitement is what makes people buy. The ONLY lines not to cross are
  the two that actually cost YOU money: (1) the door-bounce claim above (a specific,
  time-bound CURE the product visibly fails on arrival → refused parcel), and (2)
  claiming it's a MEDICAL PROCEDURE ("như đi tiêm filler / như đi mổ") → that wording
  trips platform ad-review + the app's cert detector. Everything else: go big.
- ONE SELF-INTEREST GUARD (not morality): don't name a regulator/cert you can't back
  — "Halal/KKM/GMP/FDA certified", "clinically proven", "doctor approved". Those EXACT
  words trip TikTok/Meta ad-review → account ban → you lose the whole channel, and the
  app flags them. Bold benefits + popularity vibes are fine; a fake regulator badge
  isn't worth getting banned over.

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
  gift?: { name: string; benefitLine: string }
  replyComment?: string
}): string {
  const creatorLine = args.creatorDescription
    ? `\nCREATOR PROFILE (write in this voice):\n${args.creatorDescription}\n`
    : ''
  // P4 reply-to-comment — the comment IS the hook (shown on screen, NOT spoken). Reshape ONLY the
  // HOOK block into the creator's spoken REPLY to it; the other 4 blocks are untouched.
  const replyLine = args.replyComment && args.replyComment.trim()
    ? `\nREPLY-TO-COMMENT MODE — this video answers a TikTok comment shown on screen (the comment is the HOOK; it is NOT spoken):
COMMENT: "${args.replyComment.trim()}"
- The HOOK block (first spoken line) MUST be the creator REPLYING to this comment out loud — open by directly answering / reacting to the EXACT worry, doubt or question in it (talk straight to that commenter), then bridge immediately into the story.
- Do NOT restate the comment word-for-word; respond to it naturally, as if you just read it and are answering. Keep it punchy + native, no greeting filler.
- The reply IS the hook — do NOT write a separate generic hook. Everything after flows as the normal body below.
- CONTINUITY (critical): the NEXT block (pain) MUST CONTINUE the reply's exact thread — pick up the SAME pain / question the comment raised and the promise the reply just made. Do NOT pivot to a generic, unrelated opener ("Mình hay…" / "Dạo này…" / "Aku selalu…" / "Korang tau…") that ignores what was just answered. The whole body must keep delivering on the reply's promise through to the CTA.\n`
    : ''
  // Phase A — gift directive scoped to the CTA block ONLY. The name is already
  // localised; the benefit line is given. The 4 hero blocks must NOT mention it.
  const giftLine = args.gift && args.gift.name.trim()
    ? `\nBUNDLED GIFT — applies to the CTA BLOCK ONLY (do NOT touch hook/pain/discovery/benefit):
- A FREE bonus gift comes with the order: "${args.gift.name.trim()}"${args.gift.benefitLine.trim() ? ` — ${args.gift.benefitLine.trim()}` : ''}.${args.gift.benefitLine.trim() ? '' : ' No benefit was provided for the gift — write ONE short, believable benefit for it yourself (a few words), in the output language.'}
- ALWAYS include the gift in the CTA — it must NOT be dropped even when trimming for length.
- Frame it as something SPECIAL and FOMO-worthy yet BELIEVABLE — an exclusive / limited bonus that makes buying NOW feel like a great deal. Make it punchy + native. Do NOT open it with a flat "today / hôm nay / hari ni" — find a more compelling, natural way to introduce the gift.
- CHAIN, don't stack: if the product already has a buy-X-get-Y offer, fold the gift onto it in ONE short flowing beat (e.g. "…mua 1 được thêm 2 món, lại còn được tặng thêm [gift] — [benefit]…") instead of a separate extra sentence — keep the whole CTA tight (the ad must not run long).
- ORDER (CRITICAL): announce the gift JUST BEFORE the final push. The VERY LAST sentence of the whole script MUST be the strongest urgency call-to-buy (buy now / grab it before it's gone) — NOT the gift line.
- ABSOLUTELY NO price / money / value-in-RM / discount % for the gift — just the gift + its benefit.
- The 4 hero blocks stay 100% about the main product — the gift exists only at the CTA.\n`
    : ''
  return `Write a ${args.targetDurationSec}-second TikTok ad in ${args.lang} for the product below.

PRODUCT: ${args.productName}
PRODUCT BRIEF (read + understand — ground the script in these real facts, weave them in naturally, do NOT recite verbatim. The brief may be written in Vietnamese; understand it, but write the script 100% in ${args.lang} — never echo Vietnamese words):
${args.productPitch}
${creatorLine}
SELECTED STRUCTURE: ${args.structureLabel}
SELECTED ANGLE: ${args.angleLabel}
${replyLine}
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

ONE VIDEO = ONE ANGLE (critical for a multi-benefit product): the hook/opening commits to
ONE promise (e.g. blood pressure). The WHOLE body must serve THAT one angle — pick ONLY the
pain, ingredient, mechanism and benefits that support it (blood-pressure hook → only the
"K/Mg → relax vessels → BP" thread). DROP every other benefit the product also has (digestion,
skin, energy, sleep…) even if the brief lists them — they belong to a DIFFERENT video, not
this one. Scattering across unrelated benefits = the script feels random and sells nothing.

MUST INCLUDE (pull from the brief — but ONLY the parts that serve the ONE angle above):
- the SPECIFIC pain + who it's for, so the right viewer feels seen (early);
- the NAMED key ingredient(s) / active(s) the brief lists THAT DRIVE THIS ANGLE (not "công nghệ gì đó");
- a ONE-LINE simple mechanism — how it works FOR THIS ANGLE;
- a concrete USAGE moment — the act of using it (filmable);
- a believable result ON THIS ANGLE (NO "3 giây" / miracle / filler-botox claims).
If the brief has no ingredient/mechanism info, do not invent — lean on the pain,
the usage moment and the honest result instead.

PRIORITY UNDER LENGTH PRESSURE (the script MUST fit ~${args.targetDurationSec}s — so be
ECONOMICAL, write tight from the start, every line earns its place):
- NON-NEGOTIABLE (always keep, even when short): the hook; the ONE memory ANCHOR
  (the single most concrete reason/expectation); the ONE believable PROOF beat
  (skeptic→convert / demonstrable moment / before-after / bystander); the ONE explicit
  SOCIAL-PROOF crowd line (popularity / sold-out / repeat buyers / reviews — it becomes
  the on-screen proof card); the offer + CTA.
- COMPRESSIBLE (cut HERE first when space is tight): the NUMBER of benefits — keep only
  the 2-3 STRONGEST as punchy hits, drop the rest; adjectives; any repetition or
  throat-clearing. Better 3 benefits + a real proof beat than 6 benefits and no proof.
  NOTE: the BENEFIT LADDER + APPETITE rules above are about HOW you WRITE the kept benefit
  (felt result + fear / crave) — they do NOT mean keep MORE benefits. Still 2-3, just
  laddered. Laddering replaces the mechanism phrase, it must not lengthen the script.
Do NOT sacrifice the anchor, the proof beat, the social-proof crowd line, or the CTA to
cram in more benefits.
${giftLine}
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

// P5z3 (B) — semantic continuity gate. A tiny LLM judge that decides whether the body's
// OPENING actually pays off the hook (answers it / reveals the teased reason / continues
// the same subject) vs a generic pivot the deterministic check (A) can't catch. Runs only
// for the drift-prone shapes; returns a feedback string when it does NOT follow (→ the
// existing 1-retry fixes it), else null. Language-agnostic (judges VN/MS/EN). Graceful:
// any error / parse miss → null (never blocks the generation).
async function judgeHookContinuity(hook: string, opening: string, apiKey: string): Promise<string | null> {
  const h = (hook ?? '').trim(); const o = (opening ?? '').trim()
  if (!h || !o || !apiKey) return null
  try {
    const raw = await directGeminiText({
      apiKey,
      systemInstruction:
        `You judge TikTok ad-script continuity. Given a HOOK and the body's OPENING (the line right ` +
        `after the hook), decide if the opening DIRECTLY continues / pays off the hook's promise — ` +
        `answers its question, reveals the reason it teased, or continues the SAME subject/story. A ` +
        `generic pivot to an unrelated personal intro ("mình hay đói vặt…", "aku selalu…") that ignores ` +
        `the hook does NOT follow. Reply STRICT JSON: {"follows":true|false,"reason":"<short>"}.`,
      prompt: `HOOK: "${h}"\nOPENING: "${o}"`,
      maxOutputTokens: 120, temperature: 0, thinkingBudget: 0, responseMimeType: 'application/json',
    })
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return null
    const parsed = JSON.parse(m[0]) as { follows?: boolean; reason?: string }
    if (parsed.follows === false) {
      return (
        `The body's first line does NOT continue the hook (${parsed.reason ?? 'it pivots to an unrelated opener'}). ` +
        `Rewrite sentence 1 to pay off the hook "${h.slice(0, 50)}…" — pick up its exact promise / subject, NOT a generic intro.`
      )
    }
    return null
  } catch { return null }
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
  /** P5e — previous script to DIVERGE from on "Tạo lại kịch bản" (anti-lazy). */
  previousScript?: string
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
- PAYOFF THE HOOK ACROSS THE WHOLE BODY (not just sentence 1): every block keeps
  serving the hook's EXACT promise / curiosity, and the benefit + CTA must visibly
  CLOSE the gap the hook opened — a "N lý do / N reasons" hook delivers all N; a
  question hook is fully answered; a teased result / transformation is actually shown.
  Never open the curiosity gap then drift to a generic pitch that ignores it.
- ANGLE-LOCK: the hook fixes ONE angle. Use ONLY the ingredients / mechanism / benefits
  that serve THAT angle, and DROP every unrelated benefit the product also has — even if
  the brief lists them. (Hook về huyết áp → chỉ mạch K/Mg→mạch máu→huyết áp; KHÔNG lôi
  tiêu hóa / da / năng lượng vào.) One video sells ONE message.
- Reproduce the GIVEN hook VERBATIM in the "hook" field — do not edit a word.`

  // P5e — "Tạo lại kịch bản": when a previous version is supplied, force a genuinely
  // different take so the model doesn't lazily re-emit a near-duplicate. Same hook +
  // same facts + same shape/energy, but different beats, ordering, sensory pick, CTA
  // lever and wording. Mirrors generateHooks' previousBatch anti-repeat for the body.
  const divergeBlock = (args.previousScript ?? '').trim()
    ? `

REGENERATE — WRITE A GENUINELY DIFFERENT TAKE: You already wrote the version below for
this EXACT hook + product. Produce a NEW script that a different creator might film —
same fixed hook, same true product facts, same shape + máu lửa energy, but change it
up: a different beat right after the hook, a different ORDER + selection of benefits to
spotlight, a different sensory detail / everyday moment, a different CTA lever, and
fresh wording throughout. Do NOT reuse the same sentences, the same opening move, or the
same benefit order as before.

PREVIOUS VERSION (diverge from this — do NOT repeat it):
"""${args.previousScript!.trim()}"""`
    : ''

  const userPrompt = `${args.userPrompt}

THE FIXED HOOK (continue the script DIRECTLY from this line; reproduce it verbatim as the hook block):
"""${args.chosenHook}"""${divergeBlock}`

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
    // P5z3 (B) — LLM continuity gate: only for the drift-prone shapes (the 4 strict shapes
    // already have deterministic openers). Judges the line right after the hook.
    const DRIFT_PRONE = new Set(['general', 'confession', 'claim_bold', 'imperative'])
    const continuityFail = DRIFT_PRONE.has(resolvedHookShape)
      ? await judgeHookContinuity(blocks.hook, bodyBlocks.pain, args.apiKey)
      : null
    const check = {
      ok: bodyCheck.ok && shapeCheck.ok && anchorCheck.ok && !continuityFail,
      failures: [...bodyCheck.failures, ...shapeCheck.failures, ...anchorCheck.failures, ...(continuityFail ? [continuityFail] : [])],
    }
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

  return { blocks, hookVariants: [], anchor }
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
  /** P5n — FAR over (>20%): cut hard, sacrifice minor coverage to hit the band. */
  aggressive?: boolean
}): Promise<Record<ScriptBlockId, string> | null> {
  const current = SCRIPT_BLOCK_IDS.map((id) => `[${id}] ${args.blocks[id] ?? ''}`).join('\n')
  const lo = args.targetSec - 3
  const hi = args.targetSec + 3
  const systemInstruction = `You are editing a finished TikTok ad script written in ${args.langName} to FIT A TARGET SPOKEN LENGTH. Keep the SAME language, the SAME casual spoken voice, and the 5-block structure (hook, pain, discovery, benefit, cta). Do not switch language or tone.`
  const userPrompt = `This script currently reads about ${Math.round(args.currentSec)} seconds spoken, but it MUST land within ${lo}-${hi} seconds (target ~${args.targetSec}s). ${
    args.tooLong
      ? (args.aggressive
        ? `It is WAY TOO LONG (${Math.round(args.currentSec)}s vs target ~${args.targetSec}s) — CUT HARD. Keep ONLY the SPINE and nothing else: the opening hook (verbatim); the ONE memory ANCHOR; the ONE believable PROOF beat; the product name + ONE key ingredient + a one-line mechanism; the offer / CTA. AGGRESSIVELY DROP everything else: keep only the 2 STRONGEST benefits (delete the rest entirely), cut every secondary clause, every extra adjective, every repeated idea, all throat-clearing. It is OK to LOSE minor coverage to hit ${args.targetSec}s — a tight punchy ${args.targetSec}s ad beats a bloated one. Land within ${lo}-${hi}s.`
        : `It is TOO LONG — CUT it down to about ${args.targetSec}s. You MUST KEEP (these are the conversion spine — never cut them): the opening hook (verbatim); the ONE memory ANCHOR (the single most concrete reason/expectation); the ONE believable PROOF beat (the skeptic→convert / demonstrable-moment / before-after / bystander line); the product name + its key ingredient(s) + the one-line mechanism; the one concrete usage moment; the offer / CTA. CUT FROM HERE FIRST: the NUMBER of benefits (keep only the 2-3 strongest as punchy hits, drop the rest), extra adjectives, repetition, throat-clearing, meta talk. Trimming a benefit or an adjective is fine; deleting the anchor, the proof beat, or the CTA is NOT.`)
      : `It is TOO SHORT — expand to ~${args.targetSec}s. EXPANSION FUEL (in this order — use ONLY facts in the brief, never invent product claims, never pad with filler):
  1. If there is NO believable PROOF beat yet, ADD one — a skeptic→convert line, a
     demonstrable moment you could film (bẻ ra / cắm vào / đo / thử ngay), a specific
     self before→after, or a real bystander reaction. SHOW, don't just assert.
  2. Add a CONCRETE SENSORY beat to discovery / benefit — what it tastes / smells /
     feels / sounds like at the moment of use, in plain spoken words.
  3. Add an EMPATHY ECHO — bring the hook's pain / persona / moment back in the
     benefit block at the new state (after using the product).
  4. Add a POINT-OF-CONTACT — one very specific everyday moment (time / place /
     action / inner thought) the persona would silently nod at.
  5. Deepen the MECHANISM by one spoken sentence — how the ingredient actually
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
      // Keep order; if the model returned fewer than 6, top up with the remaining
      // raw skeletons so the user still sees 6 cards. GUARD the adapt step — the
      // curated skeletons are safe by construction; only the Gemini rewrite can
      // drift, so we verify each adapted hook and revert that ONE to its skeleton
      // when it breaks a hard rule (universal, language-agnostic):
      //   • WORD CAP — a hook must read in <3s; >18 words kills the scroll-stop.
      //   • FABRICATED NUMBER — a factual number in the adapted hook that appears
      //     in NEITHER the skeleton NOR the brief means adapt invented it. (We pass
      //     skeleton+brief as the backing text, so numbers already in the curated
      //     skeleton — "90%", "10.000", "RM20" — and rhetorical counts are kept.)
      finalTexts = picked.map((raw, i) => {
        const cand = adapted[i]?.trim()
        if (!cand) return raw
        const words = cand.replace(/[.,!?;:"'“”…–—()]/g, ' ').split(/\s+/).filter(Boolean).length
        if (words > 18) return raw
        if (validateNumbersInHook(cand, `${raw}\n${params.productPitch}`)) return raw
        return cand
      })
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
  // [4] #6 — VN gloss for DISPLAY when target lang ≠ vi, so the VN seller can read
  // each hook's meaning + vibe before picking (the picker shows h.viGloss). ONE
  // batched call; on any failure the hooks just render without a gloss (never break).
  if (params.lang !== 'vi') {
    const glosses = await translateHooksToVietnamese(params.geminiKey, fixed, params.lang)
    hooks.forEach((h, i) => { if (glosses[i]) h.viGloss = glosses[i] })
  }
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

★ SCROLL-KILLER UPGRADE (this is a PAID AD — second 1 decides skip-or-stay; "correct" is NOT
enough, the hook must be UN-SKIPPABLE). Do NOT just swap the placeholder — REBUILD each hook
around ONE concrete scroll-killer DEVICE, grounded in the product's REAL pain / benefit from the
brief. Pick the device that fits the skeleton (ONE sharp device per hook, never stack 3):
  • SPECIFIC > vague — a real number / timeframe / moment ("3 tahun…", "2 titik", "malam tu" /
    "3 năm…", "2 giọt", "tối đó"). BAN empty payoffs: "result tak sangka / kết quả bất ngờ / khá
    hơn / macam ni / pulih" with nothing concrete attached.
  • PATTERN-INTERRUPT opener — a command, a number, a confession, or a visceral image. Do NOT open
    with a flat "Aku…/Mình…/Tui…" review cadence on EVERY hook.
  • CONTRARIAN / THE REAL REASON — deny what everyone believes ("sebab sebenar… BUKAN X" / "lý do
    THẬT… KHÔNG phải X").
  • STAKES / A NAMED ENEMY — the wrong thing the viewer DOES, or what it costs to ignore it
    ("berhenti korek pakai cotton bud…" / "ngừng ngoáy tai bằng tăm bông…").
  • VISCERAL SCENE the clip can show in second 1 — a relatable everyday moment / sensation
    ("mak aku dah tak jerit APA…" / "mẹ hết hỏi lại GÌ CƠ…").
A real buyer's thumb must STOP — the hook does not merely inform, it provokes. Stay native + casual.

HARD RULES:
- The hook MUST now clearly connect to the product (its job, its benefit, or what it
  IS) — a viewer should sense what's being sold, not a blank "điều này".
- REFER BY CATEGORY / BENEFIT, NOT THE BRAND (scroll-stop > ad): use the SHORT common
  category or the pain/benefit it solves ("gel sendi ni", "pam mini ni", "titisan
  telinga ni"), NOT the full brand/product name. A hook that front-loads a brand name
  reads like an AD and gets scrolled; a hook that leads with the VIEWER'S pain / a
  curiosity gap and only glances at the product reads like a real person. Prefer to
  OPEN on the pain or the hook's shock device, and slot the product reference where it
  falls naturally — it does NOT have to be the first words. Keep the skeleton's punch.
- SHORTEST POSSIBLE PRODUCT REFERENCE — max ~2-3 words, the bare HEAD-NOUN + a deictic
  ("gel ni", "benda ni", "pam ni"). DROP every qualifier: secondary conditions
  ("& sakit tekak"), ingredient / herb / actives ("manuka herba", "ginseng"), and
  form/brand adjectives. So "gel batuk & sakit tekak manuka herba" → just "gel batuk ni"
  or "benda ni" in the hook. The viewer learns the FULL identity later in the video,
  NEVER from a spec-dump in the hook (a long product phrase = instant "iklan" = scroll).
- You MAY shorten the product name (e.g. "máy bơm mini" instead of the full long
  name). NEVER cram the full specs — a hook is a SCROLL-STOP, not a feature list.
- LOCALIZE THE NAME (CRITICAL — every word of the name you say MUST be a real ${langName}
  word). The product name in the brief is often English or Vietnamese; its COMMON-NOUN
  parts MUST be translated into ${langName} EVEN IF it is Capitalized / looks like a brand:
    • "APRICOT SNACK" → Vietnamese "snack mơ khô" (NOT "snack aprikot" — "aprikot" is Malay,
      "apricot" is English); Bahasa Malaysia "snack aprikot"; English "apricot snack".
    • "Cooling Neck Fan" → VN "quạt đeo cổ"; "tỏi/mùi tây" → MS "bawang putih/pasli".
  ONLY keep a token that is a genuine INVENTED brand (Hada Labo, Anessa, Xiaomi). A common
  noun (apricot, snack, garlic, pump, serum) is NOT a brand — translate it. WHEN UNSURE,
  TRANSLATE: a localized common noun is always safe; a raw foreign word in the name screams
  "foreign-run ad" and kills trust. ZERO non-${langName} words in the product name.
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
//
// Shared SPIRIT-aware system prompt (body + hooks). The whole point of this gloss
// is so a VN seller can REVIEW a Malay script before approving it — a flat literal
// translation hides whether the MS original is actually "máu lửa" and mangles rojak
// slang ("racun" → "thuốc độc" is wrong). So we tell the model to carry the ENERGY +
// translate slang by VIBE, not word-for-word. Display-only; never fed back as script.
const MS_SPIRIT_TRANSLATE_SYSTEM =
  `You translate short TikTok ad copy into natural, CASUAL, SPOKEN Vietnamese so a ` +
  `Vietnamese seller can REVIEW its meaning and vibe before approving it. This is ` +
  `DISPLAY-ONLY — never used as the actual script.\n` +
  `- Carry the MEANING and the ENERGY/INTENT, not a word-for-word literal translation. ` +
  `If the source is hype / high-energy / "máu lửa", the Vietnamese must feel just as ` +
  `punchy — never flatten it into textbook Vietnamese.\n` +
  `- The source may be Bahasa Malaysia with rojak slang, end-particles and English ` +
  `code-switching. Translate slang by its VIBE, NOT literally: "racun / kena racun" → ` +
  `"gây nghiện / cuốn dữ lắm" (NOT "thuốc độc"); "padu / power / memang padu" → "đỉnh / ` +
  `xịn"; "best gila" → "ngon dữ / đỉnh thật"; end-particles "weh / lah / kan" → a natural ` +
  `Vietnamese exclamation/filler tone, not a literal word. Keep code-switched English ` +
  `words ("worth it", "game changer") as-is.\n` +
  `- First person, friendly, a bit playful — the way a real person talks on TikTok.`

/** Batch-translate the hook list into VN gloss in ONE Gemini call. Returns a
 *  string[] aligned to the input order ([] on failure → hooks just render without a
 *  gloss). Uses a JSON-array schema + thinkingBudget 0 so we get EXACTLY hooks.length
 *  items reliably — the earlier "numbered lines" parse dropped items when the model
 *  wrapped a translation onto two lines, and a missing thinkingBudget let "thinking"
 *  eat the token budget so the output was truncated after ~2 hooks. */
export async function translateHooksToVietnamese(
  apiKey: string, hooks: string[], fromLang: ScriptLang,
): Promise<string[]> {
  if (fromLang === 'vi' || hooks.length === 0) return []
  const fromName = SCRIPT_LANG_GEMINI_NAME[fromLang]
  const numbered = hooks.map((h, i) => `${i + 1}. ${h}`).join('\n')
  const prompt =
    `Translate each of these ${hooks.length} ${fromName} TikTok hooks into casual spoken ` +
    `Vietnamese. Return a JSON object {"translations": [...]} with EXACTLY ${hooks.length} ` +
    `strings, in the SAME order as the input. One translation per hook:\n\n${numbered}`
  try {
    const out = await directGeminiText({
      apiKey, systemInstruction: MS_SPIRIT_TRANSLATE_SYSTEM, prompt,
      maxOutputTokens: 2048, temperature: 0.4, thinkingBudget: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: { translations: { type: 'array', items: { type: 'string' } } },
        required: ['translations'],
      },
    })
    const parsed = JSON.parse(out) as { translations?: unknown }
    const arr = Array.isArray(parsed.translations) ? parsed.translations : []
    return arr.map((t) => (typeof t === 'string' ? t.trim() : ''))
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[translateHooksToVietnamese] failed, no gloss:', e)
    return []
  }
}

// P6z — ONE Gemini call that glosses each scene into VN for the REVIEW panel (display-only):
//   • voice  = the spoken line in casual VN (so the user reads what the cut says)
//   • scene  = a SHORT VN phrase of WHAT THE SHOT SHOWS (from the English conceptPrompt) so the
//              user can eyeball "câu thoại ↔ cảnh quay" and catch a mismatch. Empty concept → "".
// Batched (voice + scene together) to spend ONE call, not two. Never feeds render/audio.
export async function glossScenesToVietnamese(
  apiKey: string,
  items: { quote: string; concept: string }[],
  fromLang: ScriptLang,
): Promise<{ voice: string; scene: string }[]> {
  if (fromLang === 'vi' || items.length === 0) return []
  const fromName = SCRIPT_LANG_GEMINI_NAME[fromLang]
  const numbered = items
    .map((it, i) => `${i + 1}. THOAI(${fromName}): "${it.quote}" | CONCEPT(EN): "${it.concept?.trim() || '(none)'}"`)
    .join('\n')
  const sys =
`You convert ad-video scene data into Vietnamese for a REVIEW panel (so the user can verify the
shot matches the spoken line). For EACH numbered scene return:
- "voice": the spoken THOAI line in casual, natural spoken Vietnamese (faithful — same meaning).
- "scene": EXPLAIN in plain natural Vietnamese WHAT THE VIEWER WILL SEE in this shot — this is a
  MEANING explanation, NOT a word-for-word translation of CONCEPT. Rules:
    • IGNORE/strip all production meta-instructions in CONCEPT — do NOT translate these words:
      "DIFFERENT SHOT", "must look NOTHING like any other cut", "Render INSTEAD", "Stay on the SAME
      beat", "Same product + beat", "SHOT TYPE", and camera-jargon (macro / POV / POV-hands / wide /
      close-up / over-the-shoulder / top-down / split-screen / framing). Keep ONLY the real content.
    • Write ONE clear, complete Vietnamese sentence (length as needed — do NOT truncate) that a
      non-filmmaker understands: who/what is on screen + what they do + the setting. For a
      split-screen before/after, say it as "Cảnh chia đôi: bên trái lúc [vấn đề], bên phải lúc
      [đã đỡ]".
    • If CONCEPT is "(none)" or empty → return "" (the visual is decided later at render time).
Return JSON {"items":[{"voice","scene"}]} with EXACTLY ${items.length} entries, SAME order.`
  try {
    const out = await directGeminiText({
      apiKey, systemInstruction: sys, prompt: numbered,
      maxOutputTokens: 3072, temperature: 0.3, thinkingBudget: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: { items: { type: 'array', items: { type: 'object', properties: { voice: { type: 'string' }, scene: { type: 'string' } }, required: ['voice', 'scene'] } } },
        required: ['items'],
      },
    })
    const parsed = JSON.parse(out) as { items?: { voice?: string; scene?: string }[] }
    const arr = Array.isArray(parsed.items) ? parsed.items : []
    return items.map((_, i) => ({ voice: (arr[i]?.voice ?? '').trim(), scene: (arr[i]?.scene ?? '').trim() }))
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[glossScenesToVietnamese] failed, no gloss:', e)
    return []
  }
}

export async function translateScriptToVietnamese(
  apiKey: string, text: string, fromLang: ScriptLang,
): Promise<string> {
  if (fromLang === 'vi' || !text.trim()) return text
  const fromName = SCRIPT_LANG_GEMINI_NAME[fromLang]
  const systemInstruction = MS_SPIRIT_TRANSLATE_SYSTEM
  const prompt =
    `Translate this ${fromName} TikTok ad script into casual spoken Vietnamese. ` +
    `Output ONLY the Vietnamese translation — no notes, no labels, no quotes:\n\n${text}`
  const out = await directGeminiText({
    apiKey, systemInstruction, prompt, maxOutputTokens: 3072, temperature: 0.4,
    thinkingBudget: 0,   // don't let "thinking" eat the budget → truncated translation
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
  /** P5m — the anchor line (hook-first body sets it; carried onto GeneratedScript
   *  so the director can give it a hero shot). */
  anchor?: string
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
