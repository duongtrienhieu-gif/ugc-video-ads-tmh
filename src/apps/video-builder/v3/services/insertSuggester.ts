// ── Insert Suggester ─────────────────────────────────────────────────────────
// Z33 §11 — auto-suggest which action presets fit the current Phase 2
// script. Scans every script block's text for each preset's
// triggerKeywords; returns ranked suggestions.
//
// Example: script line "I just opened the bottle and it smelled amazing"
//   → matches OPEN_CAP (triggers: "open", "opened", "bottle")
//   → matches POINT_LABEL (triggers: "label" — not in this line)
//   → returns [OPEN_CAP score=2]
//
// The user PICKS from the suggestions — auto-application happens only
// in QUICK mode workflow (Z30 §5).
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import type {
  ActionPresetId, GeneratedScript, ScriptBlockId, ScriptLang, InsertRenderMode,
} from '../types'
import { SCRIPT_LANG_GEMINI_NAME } from '../types'
import type { Product } from '../../../../stores/types'
import { ACTION_PRESETS, ACTION_PRESET_ORDER } from './actionPresets'

export interface InsertSuggestion {
  presetId: ActionPresetId
  /** Number of keyword matches across the whole script (keyword path only) */
  matchCount: number
  /** Specific block ids where matches occurred (for timing engine) */
  matchedBlocks: ScriptBlockId[]
  /** Specific matched keywords (lowercased, deduped) — diagnostic */
  matchedKeywords: string[]
  /** First-match block id — used by timing engine as anchor */
  anchorBlock: ScriptBlockId | null
  /** Confidence score 0-1. Keyword path = matchCount/keywords; Gemini path = fit. */
  confidence: number
  /** Gemini path — one short phrase (in the script language) explaining the fit. */
  reason?: string
  /** Z37/Z42 — Scene Director path only. The free visual prompt (English, for
   *  the image/video model) describing the scene that illustrates this dialogue
   *  span. Used by BOTH free scene kinds:
   *    • CONCEPT_SCENE     — no product on screen (mechanism / emotion / lifestyle)
   *    • PRODUCT_IN_ACTION — product on screen, free real-world action/demo
   *  Undefined for the 12 fixed product presets (they use their own promptPreset). */
  conceptPrompt?: string
  /** Z37 — Scene Director path only. The director's chosen scene length. Free
   *  per scene (~2s to ~6s+) — the director matches it to how much dialogue the
   *  scene covers. Falls back to the preset's durationPreset when absent. */
  durationSec?: number
  /** Z42 — Scene Director path only. The VERBATIM line of dialogue (in the
   *  script's own language) this scene illustrates. Used to anchor the scene to
   *  the exact second the words are spoken (computeQuoteTimestamp), instead of
   *  the coarse block-start. Undefined for the keyword path. */
  quote?: string
  /** Z45 — Scene Director path only. The director-decided render mode for THIS
   *  scene. For CONCEPT_SCENE, the director picks 'video' (Kling motion, used
   *  for EMOTION/LIFESTYLE/PERSON beats — costs ~51cr) vs 'ken_burns' (still
   *  + local zoom, for GRAPHIC/INFOGRAPHIC/MECHANISM beats — costs ~6cr). For
   *  the 12 fixed presets and PRODUCT_IN_ACTION this is always 'video'. */
  renderMode?: InsertRenderMode
}

/**
 * Z33 — Suggest preset inserts for a given script. Returns ALL presets
 * ranked by relevance. Caller decides how many to pull.
 *
 * Sorted by:
 *   1. matchCount descending  (more keyword hits = better fit)
 *   2. ACTION_PRESET_ORDER     (tiebreaker — safer presets first)
 */
export function suggestInsertsForScript(script: GeneratedScript): InsertSuggestion[] {
  const suggestions: InsertSuggestion[] = []

  for (const presetId of ACTION_PRESET_ORDER) {
    const preset = ACTION_PRESETS[presetId]
    const keywords = preset.triggerKeywords

    const matchedBlocks = new Set<ScriptBlockId>()
    const matchedKeywords = new Set<string>()
    let firstMatchBlock: ScriptBlockId | null = null

    for (const block of script.blocks) {
      const text = block.text.toLowerCase()
      for (const kw of keywords) {
        // Whole-word-ish match using regex with word boundaries — handles
        // both English ("open"/"opened") and Vietnamese (no word boundaries
        // in Vietnamese script, so we fall back to includes() for short kw)
        const matched = kw.length <= 3 || /[À-ỹ]/.test(kw)
          ? text.includes(kw)
          : new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i').test(text)
        if (matched) {
          matchedBlocks.add(block.id)
          matchedKeywords.add(kw)
          if (firstMatchBlock === null) firstMatchBlock = block.id
        }
      }
    }

    const matchCount = matchedKeywords.size
    if (matchCount === 0) continue

    const confidence = Math.min(1, matchCount / Math.max(1, keywords.length))

    suggestions.push({
      presetId,
      matchCount,
      matchedBlocks: Array.from(matchedBlocks),
      matchedKeywords: Array.from(matchedKeywords),
      anchorBlock: firstMatchBlock,
      confidence,
    })
  }

  // Sort by matchCount desc, then by preset order
  suggestions.sort((a, b) => {
    if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount
    return ACTION_PRESET_ORDER.indexOf(a.presetId) - ACTION_PRESET_ORDER.indexOf(b.presetId)
  })

  return suggestions
}

/**
 * Z33 — Keyword fallback: pick the TOP N keyword-matched suggestions.
 * Used only when no Gemini key is available. NO confidence=0 padding —
 * a weak/empty suggestion list is more honest than fake "safe default"
 * inserts that don't actually match the script.
 */
export function pickTopInsertsForBudget(
  script: GeneratedScript,
  insertBudget: number,
): InsertSuggestion[] {
  return suggestInsertsForScript(script).slice(0, insertBudget)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── Gemini semantic suggester (primary path) ───────────────────────────────
// Keyword matching breaks the moment the script is in a language whose
// trigger words aren't in the bag (e.g. Bahasa Malaysia). This path reads the
// MEANING of each block in the script's own language and maps it to the
// inserts that visually support it — no keyword dependency, no language lock.

export interface GeminiSuggestParams {
  geminiKey: string
  script: GeneratedScript
  lang: ScriptLang
  budget: number
  /** Z40 — soft lower bound for full-auto mode: the director should aim for at
   *  least this many scenes (a finished ad almost always needs several
   *  cutaways). Default 3. Does NOT force padding — it just stops the model
   *  from being over-shy and returning zero. */
  floor?: number
  /** Z48 — the actual product. Passing name + description lets the Director
   *  understand WHAT the product is and HOW it is used, so it picks usage-
   *  correct presets for ANY niche (tooth powder → brush, cream → rub, pill →
   *  swallow, device → demo) instead of guessing from the script alone. */
  product?: Product | null
}

// Z48 — build the product-context block injected into the Director prompt.
// The Director was previously blind to the product (script-only), so it
// guessed usage — picking TAKE_PILL for a tooth powder, BEFORE_AFTER for a
// visible result, etc. Giving it the name + description fixes the whole class
// of niche-misread bugs at the source.
function buildProductContextBlock(product: Product | null | undefined): string {
  if (!product) return ''
  const lines: string[] = []
  if (product.productName) lines.push(`- Name: ${product.productName}`)
  if (product.productDescription) lines.push(`- Description: ${product.productDescription.slice(0, 600)}`)
  if (product.usps) lines.push(`- Key selling points: ${product.usps.slice(0, 300)}`)
  if (product.ingredients) lines.push(`- Ingredients / contents: ${product.ingredients.slice(0, 200)}`)
  if (lines.length === 0) return ''
  return `\n\nPRODUCT CONTEXT — read this FIRST to understand what the product IS and
HOW it is physically used. Do NOT guess usage from the script word "powder/gel/
liquid" alone:
${lines.join('\n')}

USE THIS to choose usage-correct scenes. Worked examples:
- A "powder" can be a drink mix (swallowed), a tooth powder (brushed on teeth),
  or a face mask (applied to skin) — the name + description tell you which.
- A "tooth/teeth/whitening/enamel" product is BRUSHED on teeth, never eaten.
- A cream / serum / lotion is rubbed on skin; a shampoo is washed into hair.
- A supplement / vitamin / capsule is swallowed.
- A device / appliance / tool is operated, not consumed.\n`
}

const SUGGEST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    inserts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          presetId:    { type: 'string', enum: ACTION_PRESET_ORDER },
          anchorBlock: { type: 'string', enum: ['hook', 'pain', 'discovery', 'benefit', 'cta'] },
          fit:         { type: 'number' },
          reason:      { type: 'string' },
        },
        required: ['presetId', 'anchorBlock', 'fit'],
      },
    },
  },
  required: ['inserts'],
}

export async function suggestInsertsWithGemini(
  params: GeminiSuggestParams,
): Promise<InsertSuggestion[]> {
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang]
  const catalogue = ACTION_PRESET_ORDER
    .map((id) => `- ${id}: ${ACTION_PRESETS[id].descriptionVi} (needsProduct=${ACTION_PRESETS[id].needsProduct})`)
    .join('\n')
  const scriptDump = params.script.blocks
    .map((b) => `[${b.id}] ${b.text}`)
    .join('\n')

  const systemInstruction = `You are a UGC ad video editor. The script is written in ${langName}.
You choose which B-roll "action insert" clips visually support the script.
Read the MEANING of each block (do NOT keyword-match) and pick inserts that
illustrate what is being said at that moment.

AVAILABLE INSERT PRESETS (id: what it shows):
${catalogue}

RULES:
- Pick AT MOST ${params.budget} inserts, ranked best-first.
- Anchor each insert to the ONE block (hook/pain/discovery/benefit/cta) it best supports.
- Only suggest an insert if it genuinely fits. Fewer strong inserts > padding with weak ones.
- Never suggest the same presetId twice.
- "fit" = 0..1 strength of the match. "reason" = one short phrase in ${langName}.

OUTPUT strict JSON, no fences:
{ "inserts": [ { "presetId": "...", "anchorBlock": "...", "fit": 0.0, "reason": "..." } ] }`

  const userPrompt = `SCRIPT (block id in brackets):\n${scriptDump}\n\nPick the inserts now.`

  const raw = await directGeminiText({
    apiKey: params.geminiKey,
    systemInstruction,
    prompt: userPrompt,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
    responseSchema: SUGGEST_RESPONSE_SCHEMA,
  })

  const parsed = parseSuggestOutput(raw)
  const seen = new Set<ActionPresetId>()
  const validPresets = new Set<string>(ACTION_PRESET_ORDER)
  const validBlocks = new Set<string>(['hook', 'pain', 'discovery', 'benefit', 'cta'])

  const out: InsertSuggestion[] = []
  for (const item of parsed) {
    if (!validPresets.has(item.presetId)) continue
    if (seen.has(item.presetId as ActionPresetId)) continue
    const anchor = validBlocks.has(item.anchorBlock) ? (item.anchorBlock as ScriptBlockId) : null
    const fit = Math.max(0, Math.min(1, Number(item.fit) || 0))
    if (fit <= 0) continue  // drop non-matches — no padding
    seen.add(item.presetId as ActionPresetId)
    out.push({
      presetId: item.presetId as ActionPresetId,
      matchCount: 0,
      matchedBlocks: anchor ? [anchor] : [],
      matchedKeywords: [],
      anchorBlock: anchor,
      confidence: fit,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
    })
  }
  out.sort((a, b) => b.confidence - a.confidence)
  return out.slice(0, params.budget)
}

// ── Z37 Scene Director (primary path when own-script / brainstorm wanted) ──
// The suggester above only maps the script to the 12 PRODUCT presets. The
// Scene Director goes further: it READS the whole script, brainstorms a
// variable scene breakdown (grouping same-content sentences into one 3-7s
// clip), and for each visual moment decides between:
//   • a PRODUCT preset (one of the 12 — product is on screen, fidelity-locked)
//   • a CONCEPT_SCENE  (no product on screen — a free B-roll prompt the model
//                       can render however it likes to illustrate the meaning;
//                       no fidelity risk because the product never appears).
// Talking-head moments produce NO insert (the creator video already covers
// them — inserts only LAYER over it). So the director's job is: where to cut
// away, and to what.

const DIRECTOR_PRESET_ENUM = [...ACTION_PRESET_ORDER, 'CONCEPT_SCENE', 'PRODUCT_IN_ACTION']

const DIRECTOR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          presetId:      { type: 'string', enum: DIRECTOR_PRESET_ENUM },
          anchorBlock:   { type: 'string', enum: ['hook', 'pain', 'discovery', 'benefit', 'cta'] },
          quote:         { type: 'string' },
          durationSec:   { type: 'number' },
          fit:           { type: 'number' },
          reason:        { type: 'string' },
          conceptPrompt: { type: 'string' },
          motionKind:    { type: 'string', enum: ['graphic', 'emotion'] },
        },
        required: ['presetId', 'anchorBlock', 'quote', 'durationSec', 'fit'],
      },
    },
  },
  required: ['scenes'],
}

export async function directScenesWithGemini(
  params: GeminiSuggestParams,
): Promise<InsertSuggestion[]> {
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang]
  // Full-auto baseline: aim for at least `floor` scenes (default 3) but never
  // more than the budget. Keeps the director from returning an empty list.
  const floor = Math.max(1, Math.min(params.floor ?? 3, params.budget))
  const catalogue = ACTION_PRESET_ORDER
    .map((id) => `- ${id}: ${ACTION_PRESETS[id].descriptionVi} (needsProduct=${ACTION_PRESETS[id].needsProduct})`)
    .join('\n')
  const scriptDump = params.script.blocks
    .map((b) => `[${b.id}] ${b.text}`)
    .join('\n')

  const productContext = buildProductContextBlock(params.product)

  const systemInstruction = `You are a senior UGC ad video DIRECTOR with full creative freedom. The
script is written in ${langName}. This is NOT a fixed storytelling template —
read the actual script, understand the product and the niche, and decide the
B-roll like a real director would. The product can be ANYTHING (health
supplement, cosmetics, kitchen appliance, power tool, machine, gadget, apparel…)
— never assume it is a supplement.${productContext}

A single talking-head "creator video" of the person speaking already covers the
whole script. Your job: decide WHERE to cut away to a supporting visual (a
B-roll insert that LAYERS over the talking head) and WHAT to show there.

You have THREE kinds of scene:

1. FIXED PRODUCT presets — product ON SCREEN, fidelity-locked, with a fixed safe
   action. Use when the line is about a simple product handling moment that one
   of these already describes:
${catalogue}

2. PRODUCT_IN_ACTION — product ON SCREEN, fidelity-locked, but YOU write the
   action. Use this for any real-world use / demo / test the fixed presets can't
   express — e.g. a blender crushing ice, a drill driving a screw, cream rubbed
   into skin, a bottle dunked in water to prove it's waterproof, a machine
   running on a workbench, the product used outdoors. For PRODUCT_IN_ACTION you
   MUST write a "conceptPrompt": one vivid English sentence describing the action
   + setting. The product itself stays on screen (a reference image locks its
   look) — so describe the ACTION around it, do NOT redescribe the packaging.

3. CONCEPT_SCENE — NO product on screen. Use when the line describes a FEELING,
   a PROBLEM, a MECHANISM / how-it-works, an INGREDIENT or cause, or a lifestyle
   moment that is better shown WITHOUT the product. For CONCEPT_SCENE you MUST
   write a "conceptPrompt": one vivid English sentence (subject, setting, mood,
   action). NEVER put product packaging in a CONCEPT_SCENE conceptPrompt.
   For CONCEPT_SCENE you MUST also set "motionKind":
     • "emotion" — for any scene featuring a PERSON expressing a feeling,
       performing a lifestyle action, or any scene that needs REAL HUMAN
       MOTION to feel believable. Examples: "person covering their mouth
       self-consciously", "woman smiling shyly", "tired man rubbing his eyes",
       "hand running through thinning hair, worried". These render as REAL
       motion video (Kling, ~51cr). A still image cannot carry human emotion.
     • "graphic" — for visualizations, infographics, microscope shots,
       split-screen comparisons, ingredient close-ups, sci-fi-style animations,
       chemistry diagrams, any scene with NO PERSON or where motion is not
       needed. Examples: "microscopic bacteria multiplying", "split-screen of
       teeth before/after", "ingredient capsule cross-section". These render
       cheaply as a still + slow zoom (~6cr) — perfect when subject is static.
   PICK CORRECTLY. Choosing "graphic" for a scene that needs human emotion
   makes the final video feel like a slideshow. Choosing "emotion" for a
   pure infographic wastes 8× the credit. Default to "graphic" only when the
   scene truly has no person and no felt-emotion.

DIRECTING RULES:
- Read the MEANING. Ground EVERY scene in a real line of the script — never
  invent a visual for something the script doesn't say. If a beat has no
  worthwhile visual, skip it.
- For EVERY scene, copy the exact line of dialogue it illustrates into "quote"
  (verbatim, in ${langName}, one sentence or clause — this is how the scene is
  timed to the voice). The quote MUST be text that actually appears in the script.
- COVER THE WHOLE SCRIPT, not just the obvious beats. If the script explains
  INGREDIENTS or a MECHANISM / how-it-works, you MUST give those lines their own
  scene (usually a labeled CONCEPT_SCENE) — do not leave them with no visual.
  This is the most common miss.
- INGREDIENT BEATS — when a line NAMES specific ingredients (e.g. "Activated
  Charcoal và Volcanic Ash...", "Grape Seed Extract..."), give that line a
  CONCEPT_SCENE whose conceptPrompt SHOWS and LABELS each named ingredient (the
  label IS the ingredient name). Two ingredients named → both labeled. Do NOT
  cover an ingredient line with a bare product close-up — a macro of the jar
  garbles the small label text and does NOT tell the viewer the ingredient
  names. The labeled sketch does. (Product close-ups are for "show the product"
  beats, not for teaching ingredients.)
- CONCEPT ART-STYLE RULE (for "graphic" CONCEPT_SCENE only) — bake the art
  direction INTO the conceptPrompt. There are TWO looks; pick per scene:
  (1) SIMPLE HAND-DRAWN VISUAL — use this for INGREDIENT explanations,
      MECHANISM / how-it-works, "X times more effective" claims, benefit
      breakdowns, anything that teaches. Write the conceptPrompt as: ONE
      friendly HAND-DRAWN sketch (clean simple line-art doodle, warm marker /
      crayon feel) illustrating a SINGLE idea — big, bold, instantly readable.
      *** SIMPLE BUT LABELED — this is the balance ***
      The viewer sees this for only 2-4 seconds WHILE the voice talks, so it
      must be absorbed at a glance AND it MUST carry the KEY TERMS the spoken
      line names, as short labels, so image and voice match:
        • LANGUAGE LOCK — EVERY text label in the image MUST be written in
          ${langName} (the script's language). For a Bahasa Malaysia script the
          labels are Malay, for a Vietnamese script Vietnamese, etc. NEVER mix
          languages and NEVER default to another language. Take the term
          straight from the ${langName} quote. (Ingredient brand names like
          "Activated Charcoal" may stay in their original form if the script
          itself uses them that way.)
        • LABEL THE ACTUAL TERMS FROM THE QUOTE: ingredient names, a number
          ("5x"), the one core mechanism/benefit word. Typically 1-4 short
          labels, each 1-3 words. The labels ARE the terms the voice is saying
          at that second.
        • If the line names MULTIPLE ingredients, SHOW and LABEL EACH ONE (e.g.
          a two-ingredient line → two labels, each the ingredient's name in
          ${langName}). Do not drop ingredient names — they are the point.
        • BUT still SIMPLE: a few short labels on a clean airy sketch. NO
          sentences, NO paragraphs, NO description blocks, NO body text, NO
          title bar + subtitle, NO row of icons along the bottom, NO dense
          medical-poster layout. Key terms only — never explanatory prose.
      If a beat is too dense for a few labels (a long multi-step mechanism),
      SPLIT into 2-3 simple labeled scenes instead of one crammed image.
      Example (multi-ingredient): "Simple friendly hand-drawn sketch: black
      charcoal powder + grey volcanic ash lifting dark plaque off a happy white
      tooth, two short labels (each ingredient's name written in ${langName}),
      warm marker style, lots of white space." Example (claim): "Hand-drawn
      tooth with nano dots sinking in, a big '5x' badge and one short
      ${langName} label for the core tech, airy, minimal."
      LAYOUT — the frame is cropped to TALL VERTICAL 9:16 and slowly zoomed, so
      keep the drawing + its labels CENTRED with wide margins; nothing near the
      edges (it gets cropped).
  (2) REALISTIC SCIENTIFIC — use this ONLY for true microscopy / anatomy / real
      micro-phenomena (bacteria, enamel cross-section under a microscope). Write
      it as a realistic documentary/medical close-up, NO text labels.
  Most ingredient/mechanism beats in an ad should be (1) the friendly
  infographic — it reads clearly and matches UGC tone. Reserve (2) for genuine
  microscope/anatomy shots.
- Group sentences describing the SAME idea into ONE scene; don't cut every line.
- Duration is FREE per scene — YOU decide based on how much dialogue it covers.
  A quick punch ≈ 2s, a normal beat ≈ 3-4s. Use whatever fits; do NOT force
  everything to one length.
- HARD LIMIT for CONCEPT_SCENE: never exceed 4s. A still image zoomed for 7-8s
  is BORING and breaks UGC pacing — the viewer's eye stops moving.
- For a DENSE / MULTI-SENTENCE concept beat (e.g. mechanism with several steps,
  ingredients with several names, a feeling described from multiple angles),
  DO NOT make one long 6-8s concept scene. Instead, SPLIT it into 2-3 short
  CONCEPT_SCENE cuts back-to-back (each 3-4s), each showing a DIFFERENT angle
  of the idea (different subject, framing, or environment). Example for a gut
  mechanism explanation: cut1 "microscopic bacteria multiplying" 3s → cut2
  "glowing Inulin molecules feeding bacteria" 3s → cut3 "calm relaxed stomach
  silhouette" 3s. Variety keeps the eye moving. The total budget covers this —
  use more, shorter cuts instead of fewer long ones.
- Anchor each scene to the ONE block (hook/pain/discovery/benefit/cta) whose
  dialogue it illustrates (used only as a coarse fallback).
- INGESTION RULE — DRINK and TAKE_PILL animate the person SWALLOWING the
  product. Use them ONLY for products that are genuinely ingested: drinks,
  shakes, supplements, vitamins, gummies, pills, capsules taken by mouth.
  For products APPLIED EXTERNALLY, these presets are WRONG and look absurd —
  NEVER use them. Instead use PRODUCT_IN_ACTION with a conceptPrompt showing
  the REAL application:
    • tooth powder / toothpaste / whitening powder → person BRUSHING it on
      their teeth with a toothbrush (it is NOT eaten — note clues like
      "whiten teeth", "enamel", "vs toothpaste", "plaque").
    • cream / serum / lotion / mask → rubbed / massaged onto skin.
    • shampoo / hair tonic / scalp serum → washed / applied into hair.
    • spray / deodorant / perfume → sprayed on.
  Read what the product IS. A "powder" is not automatically a supplement —
  a teeth-whitening powder is brushed on, not swallowed.
- PRODUCT-FORM RULE — several fixed presets hardcode a physical form. Pick them
  ONLY when the product actually matches; otherwise use PRODUCT_IN_ACTION and
  describe the real action (it has no form assumption):
    • OPEN_CAP assumes a BOTTLE with a screw cap. Don't use it for a jar (twist
      lid), tube (flip cap), sachet (tear), pump, box, or device.
    • TAKE_PILL assumes a single solid PILL/TABLET/CAPSULE. Don't use it for a
      powder (scooped/mixed), gummy (chewed), or liquid.
    • DRINK assumes the product is sipped straight from its container. A powder
      that must be mixed into water first is PRODUCT_IN_ACTION (scoop → stir →
      drink), not DRINK.
    • UNBOX assumes the product ships inside an outer BOX. Don't use it for a
      bare jar/bottle with no box.
    • BAG_PRODUCT_PULL assumes the product fits in a handbag. Don't use it for an
      appliance, machine, or large device.
  When in doubt about form, prefer PRODUCT_IN_ACTION — it is form-agnostic and
  you control the action.
- CTA SCENE RULE — for the FINAL beat (anchorBlock = "cta", typically the line
  asking the viewer to buy/click/order), the visual job is a TRUST CLOSE, not
  a generic phone shot. Pick one of:
    • HOLD_PRODUCT — the speaker confidently holding the product up to camera
    • POINT_LABEL  — the speaker pointing at the product label / key claim
  These show the model OWNING the product. NEVER use PHONE_SCROLL for a CTA
  scene — it shows generic doom-scrolling on a social feed and has no purchase
  intent, completely unrelated to "click the link / buy now" lines.
- BEFORE/AFTER RULE — **HARD BAN, NO EXCEPTIONS**. Read this twice:

    BEFORE_AFTER_REACTION animates ONLY the model's FACE (tired → relieved).
    The body part / object being claimed (teeth, skin, hair, scalp, nails)
    NEVER appears in this preset. So it CANNOT show camera-visible results.

    (a) INTERNAL / FELT result (energy ↑, sleep ↑, mood ↑, gut comfort,
        focus, fatigue ↓, less anxiety, calmer stomach) → OK to use
        BEFORE_AFTER_REACTION. The face going relieved IS the proof here.

    (b) VISIBLE / EXTERNAL result — **BEFORE_AFTER_REACTION IS BANNED for
        these. PICKING IT IS A BUG.** This covers ANY claim a camera can SEE:
          • teeth: whiter / brighter / less yellow / less plaque
          • skin: clearer / smoother / less acne / fewer wrinkles / brighter
          • hair: thicker / fuller / longer / less falling / shinier / scalp regrowth
          • body: slimmer / firmer / toned / lifted / less bloated
          • marks/stains: faded / gone / lightened
        For ANY of these, use CONCEPT_SCENE with a split-screen / side-by-side
        conceptPrompt showing the actual body part change. Examples:
          • teeth: "Extreme close-up split-screen of teeth: left half stained
            yellow with visible plaque, right half clean glossy white — dramatic
            dental before/after, soft natural light."
          • skin: "Macro split-screen of cheek skin: left side dull with visible
            blemishes, right side smooth even-toned, side-by-side comparison."
          • hair: "Top-down split scalp shot: left half thinning patches visible,
            right half fuller denser hair growth, clinical comparison lighting."
        If the script mentions BOTH (a) and (b) in one beat — e.g. "răng trắng
        hơn và mình tự tin hơn" — pick (b) CONCEPT_SCENE. The visible proof is
        the load-bearing claim for conversion; the felt-state is secondary.

  DECISION TREE: before picking BEFORE_AFTER_REACTION, ask "is the result a
  camera-visible body-part change?" If yes → switch to CONCEPT_SCENE. The
  post-parse layer will OVERRIDE BEFORE_AFTER_REACTION → CONCEPT_SCENE
  automatically when it detects a visible-result keyword in the script —
  picking BEFORE_AFTER for a visible-result product just wastes your slot.

- NO DUPLICATE PRESETS — never pick the same presetId twice. Even if the
  script has two great moments for HOLD_PRODUCT (e.g. hook + CTA), the
  second one MUST use a different preset (POINT_LABEL, SHOW_PACKAGE,
  PRODUCT_CLOSEUP). A video that opens with the speaker holding the jar
  and closes with the speaker holding the jar at the same angle looks
  amateur. Vary the composition.
- A finished UGC ad cuts to a supporting visual on most key beats. Propose
  between ${floor} and ${params.budget} scenes covering the arc. Returning zero
  or one scene is only right for an unusually short script.
- "fit" = 0..1 how strongly the visual supports the line. "reason" = one short
  phrase in ${langName} explaining the choice (shown to the user).

OUTPUT strict JSON, no fences:
{ "scenes": [ { "presetId": "...", "anchorBlock": "...", "quote": "(verbatim line)",
  "durationSec": 4, "fit": 0.0, "reason": "...",
  "conceptPrompt": "(required for CONCEPT_SCENE and PRODUCT_IN_ACTION)" } ] }`

  const userPrompt = `SCRIPT (block id in brackets):\n${scriptDump}\n\nDirect the scenes now.`

  // Z43 — room for up to 8 scenes, each with a VN quote + VN reason + an
  // English conceptPrompt. 2048 tokens truncated the JSON on longer scripts
  // (especially now that the budget is up to 8) → JSON.parse failed → the
  // director silently fell back to the weak keyword path. 8192 gives headroom
  // so the full scene list comes back intact.
  const raw = await directGeminiText({
    apiKey: params.geminiKey,
    systemInstruction,
    prompt: userPrompt,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    responseSchema: DIRECTOR_RESPONSE_SCHEMA,
    // Z43 — disable 2.5-flash "thinking" so the whole token budget goes to the
    // JSON answer, not internal reasoning (which was returning empty bodies).
    thinkingBudget: 0,
  })

  const parsed = parseDirectorOutput(raw)
  const validPresets = new Set<string>(DIRECTOR_PRESET_ENUM)
  const validBlocks = new Set<string>(['hook', 'pain', 'discovery', 'benefit', 'cta'])

  // Z46 — pre-scan script for visible-result claims (teeth whiter, skin clearer,
  // etc). When detected, the post-parse layer auto-rewrites any
  // BEFORE_AFTER_REACTION scene to CONCEPT_SCENE — the preset can't actually
  // show the camera-visible change the script promises.
  const visibleResultProduct = detectsVisibleResultClaim(params.script)

  // Z47 — pre-scan for topical products (tooth powder, cream, shampoo). When
  // detected, the post-parse layer rewrites any DRINK / TAKE_PILL scene to a
  // PRODUCT_IN_ACTION showing the real application — those presets animate
  // SWALLOWING, which is wrong (e.g. a tooth powder is brushed, not eaten).
  const topicalCategory = detectTopicalCategory(params.script)

  // Z43 — diagnostic counters so a silent keyword fallback can be traced from
  // the browser console instead of guessed at.
  // Z46/Z47 — added beforeAfter + topical + dupeSkip + dupeSwap counters.
  const drop = { preset: 0, noPrompt: 0, zeroFit: 0, dupeSkip: 0 }
  const rewrite = { beforeAfter: 0, topical: 0, dupeSwap: 0 }

  const seen = new Set<ActionPresetId>()
  const out: InsertSuggestion[] = []
  for (const item of parsed) {
    if (!validPresets.has(item.presetId)) { drop.preset++; continue }
    let presetId = item.presetId as ActionPresetId
    let motionKind = item.motionKind
    let conceptPrompt = typeof item.conceptPrompt === 'string' ? item.conceptPrompt.trim() : ''

    // Z46 — BEFORE_AFTER_REACTION rewrite for visible-result products.
    // The preset only animates the face, never the actual body-part change
    // the script promises. Auto-convert to a CONCEPT_SCENE split-screen.
    if (presetId === 'BEFORE_AFTER_REACTION' && visibleResultProduct) {
      const quote = (item.quote ?? '').trim()
      presetId = 'CONCEPT_SCENE' as ActionPresetId
      motionKind = 'graphic'
      conceptPrompt = conceptPrompt.length > 0 ? conceptPrompt :
        `Extreme close-up split-screen showing the body-part transformation the line ` +
        `"${quote}" promises: LEFT half = the "before" state with the visible problem ` +
        `clearly shown, RIGHT half = the "after" state with the problem resolved. ` +
        `Side-by-side dramatic comparison, soft natural light, clinical credibility.`
      rewrite.beforeAfter++
    }

    // Z47 — DRINK / TAKE_PILL rewrite for topical products. These presets
    // animate SWALLOWING; a tooth powder is brushed on teeth, a cream is
    // rubbed on skin — never eaten. Convert to PRODUCT_IN_ACTION showing the
    // real application (product stays on screen, fidelity-locked).
    if ((presetId === 'DRINK' || presetId === 'TAKE_PILL') && topicalCategory) {
      const quote = (item.quote ?? '').trim()
      presetId = 'PRODUCT_IN_ACTION' as ActionPresetId
      conceptPrompt = topicalApplicationPrompt(topicalCategory, quote)
      rewrite.topical++
    }

    // Both free-scene kinds carry a director-written prompt and are useless
    // without one — drop them if the prompt is missing.
    const isFreeScene = presetId === 'CONCEPT_SCENE' || presetId === 'PRODUCT_IN_ACTION'
    if (isFreeScene && conceptPrompt.length === 0) { drop.noPrompt++; continue }
    const anchor = validBlocks.has(item.anchorBlock) ? (item.anchorBlock as ScriptBlockId) : null
    const fit = Math.max(0, Math.min(1, Number(item.fit) || 0))
    if (fit <= 0) { drop.zeroFit++; continue }  // drop non-matches — no padding

    // Z46 — diversity: if this fixed preset is already used in this video,
    // try to swap to a related alternative (HOLD_PRODUCT → POINT_LABEL etc.).
    // Free scenes (CONCEPT_SCENE / PRODUCT_IN_ACTION) are exempt — their
    // identity is the conceptPrompt, not the preset key, so duplicates are
    // not actually visually duplicate.
    if (!isFreeScene && seen.has(presetId)) {
      const swap = pickSwap(presetId, seen)
      if (swap) {
        presetId = swap
        rewrite.dupeSwap++
      } else {
        drop.dupeSkip++
        continue
      }
    }
    if (!isFreeScene) seen.add(presetId)

    // Z45 — pick renderMode per scene:
    //   • 12 fixed presets + PRODUCT_IN_ACTION → always 'video' (product
    //     fidelity required)
    //   • CONCEPT_SCENE → 'video' when motionKind='emotion' (real human/lifestyle
    //     motion needed); 'ken_burns' otherwise (cheap graphic/infographic)
    const isEmotionConcept = presetId === 'CONCEPT_SCENE' && motionKind === 'emotion'
    const renderMode: InsertRenderMode =
      presetId === 'CONCEPT_SCENE'
        ? (isEmotionConcept ? 'video' : 'ken_burns')
        : 'video'
    const durationSec = clampDuration(item.durationSec, presetId, renderMode)
    const quote = typeof item.quote === 'string' && item.quote.trim().length > 0
      ? item.quote.trim()
      : undefined
    out.push({
      presetId,
      matchCount: 0,
      matchedBlocks: anchor ? [anchor] : [],
      matchedKeywords: [],
      anchorBlock: anchor,
      confidence: fit,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
      conceptPrompt: isFreeScene ? conceptPrompt : undefined,
      durationSec,
      quote,
      renderMode,
    })
  }
  // Keep the director's ORDER (narrative sequence), not a fit sort — scenes
  // should play in script order. Cap to budget.
  const directed = out.slice(0, params.budget)
  console.log(
    `[DIRECTOR] raw=${raw.length}ch parsed=${parsed.length} usable=${out.length} ` +
    `dropped{preset:${drop.preset},noPrompt:${drop.noPrompt},zeroFit:${drop.zeroFit},dupeSkip:${drop.dupeSkip}} ` +
    `rewrote{beforeAfter:${rewrite.beforeAfter},topical:${rewrite.topical},dupeSwap:${rewrite.dupeSwap}} ` +
    `visibleResult=${visibleResultProduct} topical=${topicalCategory ?? 'no'} ` +
    `→ ${directed.length > 0 ? `${directed.length} scenes` : 'EMPTY → keyword fallback'}`,
  )
  if (directed.length === 0) {
    console.warn(`[DIRECTOR] raw head: ${raw.slice(0, 400)}`)
  }
  if (directed.length > 0) return directed
  // Z40 full-auto safety net — Gemini returned nothing usable (over-shy, parse
  // miss, or a thin script). Fall back to the keyword suggester so the engine
  // still proposes a baseline instead of dumping the work back on the user.
  // (If the keyword path is ALSO empty, the script genuinely has no matchable
  // moment — that's an honest empty, not a shy one.)
  return suggestInsertsForScript(params.script).slice(0, params.budget)
}

// Z46 — visible-result claim detector. If the script promises a camera-visible
// body-part change (teeth whiter, skin clearer, hair thicker, etc.), the
// post-parse layer rejects BEFORE_AFTER_REACTION picks for that script — the
// preset only animates the face and can't show the actual change. The Director
// prompt already tells Gemini this; this is the safety net for when it disobeys.
const VISIBLE_RESULT_KEYWORDS = [
  // English
  'whiter', 'whiten', 'whitening', 'brighter', 'brighten', 'clearer', 'clear up',
  'smoother', 'thicker', 'fuller', 'stronger', 'longer', 'firmer', 'tighter',
  'glowing', 'shinier', 'less wrinkle', 'fewer wrinkle', 'less acne', 'less bloat',
  'fade', 'faded', 'lightened', 'slimmer', 'toned', 'lifted', 'plumper',
  // Vietnamese
  'trắng', 'sáng', 'sạch', 'mượt', 'mềm', 'dày', 'đầy', 'mạnh', 'dài',
  'thon', 'gọn', 'săn', 'mịn', 'bóng', 'mỏng đi', 'mờ đi', 'hết mụn',
  'hết nám', 'hết thâm', 'rụng tóc', 'dài tóc',
  // Bahasa Malaysia
  'putih', 'terang', 'bersih', 'halus', 'lembut', 'tebal', 'kuat',
  'panjang', 'langsing', 'padu', 'kilat', 'bersinar', 'kurang jerawat',
  'kurang kedut', 'hilang parut',
]

function detectsVisibleResultClaim(script: GeneratedScript): boolean {
  const haystack = script.blocks.map((b) => b.text.toLowerCase()).join(' ')
  return VISIBLE_RESULT_KEYWORDS.some((kw) => haystack.includes(kw))
}

// Z47 — usage-mode detection. DRINK / TAKE_PILL animate someone SWALLOWING the
// product. That is WRONG for topical products that are applied externally:
//   • tooth powder / paste → brushed on teeth (NEVER swallowed)
//   • cream / serum → rubbed on skin
//   • shampoo → washed into hair
// The Director sometimes picks TAKE_PILL for any "powder" because supplements
// are the most common UGC niche. This catches it + rewrites to a real-usage
// PRODUCT_IN_ACTION. Returns the topical category, or null if the product is
// genuinely ingested / unknown.
const DENTAL_SIGNALS = [
  'kem đánh răng', 'đánh răng', 'chà răng', 'men răng', 'làm trắng răng', 'mảng bám',
  'nướu', 'răng', 'teeth', 'tooth', 'toothpaste', 'dental', 'enamel', 'gum', 'gigi',
]
const SKIN_SIGNALS = [
  'thoa', 'bôi', 'lên da', 'kem dưỡng', 'serum', 'mặt nạ', 'dưỡng da', 'làn da',
  'skin', 'cream', 'serum', 'lotion', 'kulit', 'wajah',
]
const HAIR_SIGNALS = [
  'gội', 'dầu gội', 'ủ tóc', 'lên tóc', 'da đầu', 'chân tóc', 'hair', 'shampoo',
  'scalp', 'rambut',
]
const INGEST_VERBS = ['uống', 'nuốt', ' ăn ', 'swallow', 'sip', 'ingest', 'drink it']

function detectTopicalCategory(
  script: GeneratedScript,
): 'dental' | 'skin' | 'hair' | null {
  const hay = ' ' + script.blocks.map((b) => b.text.toLowerCase()).join(' ') + ' '
  const ingestVerb = INGEST_VERBS.some((k) => hay.includes(k))
  // Dental = always brushed, never swallowed → confident even with an ingest
  // verb elsewhere (e.g. "ăn uống thoải mái"). Need 2+ dental signals.
  const dentalHits = DENTAL_SIGNALS.filter((k) => hay.includes(k)).length
  if (dentalHits >= 2) return 'dental'
  // Skin / hair are ambiguous (could be ingested hair-vitamins etc), so only
  // treat as topical when there is NO ingestion verb in the script.
  if (!ingestVerb) {
    if (SKIN_SIGNALS.filter((k) => hay.includes(k)).length >= 2) return 'skin'
    if (HAIR_SIGNALS.filter((k) => hay.includes(k)).length >= 2) return 'hair'
  }
  return null
}

function topicalApplicationPrompt(category: 'dental' | 'skin' | 'hair', quote: string): string {
  const tail = ` This illustrates the line "${quote}". The product stays on screen (its packaging is locked by the reference image). Authentic UGC iPhone footage, natural daylight, real texture. The person does NOT swallow or eat the product.`
  switch (category) {
    case 'dental':
      return `Person dipping a damp toothbrush into the mineral tooth powder, then brushing their teeth with it — close-up of the loaded toothbrush gently foaming, bathroom-mirror setting.${tail}`
    case 'skin':
      return `Person scooping a small amount of the product and gently applying / massaging it onto their skin — close-up of the application motion.${tail}`
    case 'hair':
      return `Person applying the product to their hair / scalp and working it in — close-up of the application motion.${tail}`
  }
}

// Z46 — diversity swap: if a presetId is already used, pick the next-best
// substitute. Mainly fixes the hook+CTA both-HOLD_PRODUCT case the user hit.
// Returns null if no swap is available — caller should skip the scene.
const PRESET_SWAP_CHAIN: Record<string, ActionPresetId[]> = {
  HOLD_PRODUCT:    ['POINT_LABEL', 'SHOW_PACKAGE', 'PRODUCT_CLOSEUP'],
  POINT_LABEL:     ['SHOW_PACKAGE', 'PRODUCT_CLOSEUP', 'HOLD_PRODUCT'],
  SHOW_PACKAGE:    ['PRODUCT_CLOSEUP', 'POINT_LABEL', 'HOLD_PRODUCT'],
  PRODUCT_CLOSEUP: ['SHOW_PACKAGE', 'POINT_LABEL', 'DESK_PRODUCT'],
  DESK_PRODUCT:    ['PRODUCT_CLOSEUP', 'SHOW_PACKAGE'],
  OPEN_CAP:        ['UNBOX', 'SHOW_PACKAGE'],
  UNBOX:           ['OPEN_CAP', 'SHOW_PACKAGE'],
  DRINK:           ['TAKE_PILL', 'HOLD_PRODUCT'],
  TAKE_PILL:       ['DRINK', 'HOLD_PRODUCT'],
}

function pickSwap(presetId: ActionPresetId, seen: Set<ActionPresetId>): ActionPresetId | null {
  const chain = PRESET_SWAP_CHAIN[presetId] ?? []
  for (const candidate of chain) {
    if (!seen.has(candidate)) return candidate
  }
  return null
}

function clampDuration(v: unknown, presetId: ActionPresetId, renderMode?: InsertRenderMode): number {
  // Z42/Z44/Z45 — free duration, but bounded by what each render mode can
  // actually produce + what feels watchable:
  //   • CONCEPT_SCENE + ken_burns → 4s cap (a still zoomed for 7-8s is
  //     boring; force the director to split dense ideas)
  //   • CONCEPT_SCENE + video (Kling, for emotion scenes) → 5s cap, same as
  //     any Kling clip (fixed 5s footage)
  //   • Everything else → 5s (Kling fixed)
  // Floor is 2s for all (the director may want a quick punch cut).
  const isKenBurns = presetId === 'CONCEPT_SCENE' && renderMode !== 'video'
  const ceiling = isKenBurns ? 4 : 5
  const n = Number(v)
  if (!Number.isFinite(n)) return 4
  return Math.max(2, Math.min(ceiling, Math.round(n * 10) / 10))
}

interface RawDirectorScene {
  presetId: string
  anchorBlock: string
  quote?: string
  durationSec: number
  fit: number
  reason?: string
  conceptPrompt?: string
  motionKind?: 'graphic' | 'emotion'
}

function parseDirectorOutput(raw: string): RawDirectorScene[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return []
    }
  }
  const obj = parsed as { scenes?: unknown }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.scenes)) return []
  return obj.scenes as RawDirectorScene[]
}

interface RawSuggestItem {
  presetId: string
  anchorBlock: string
  fit: number
  reason?: string
}

function parseSuggestOutput(raw: string): RawSuggestItem[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return []
    }
  }
  const obj = parsed as { inserts?: unknown }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.inserts)) return []
  return obj.inserts as RawSuggestItem[]
}
