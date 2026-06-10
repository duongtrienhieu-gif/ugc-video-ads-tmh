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
  ActionPresetId, GeneratedScript, ScriptBlockId, ScriptLang, InsertRenderMode, InsertLayout,
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
  /** Z69 — Director-picked layout: full-screen 'cut' or corner 'overlay_corner'.
   *  See InsertLayout in types.ts. */
  layout?: InsertLayout
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

// Z70 — auto-detect product niche from name + description, used as an extra
// hint for the Director so it doesn't have to infer usage purely from text.
// Conservative: only return a label when there are STRONG signals; otherwise
// leave it 'unknown' and let Director read the description directly.
const NICHE_RULES: { niche: string; usage: string; cues: RegExp }[] = [
  { niche: 'dental',     usage: 'brushed on teeth with a toothbrush (topical, not swallowed)',
    cues: /\b(tooth|teeth|toothpaste|whiten|enamel|gum|plaque|dental|răng|men răng|kem đánh răng|mảng bám|nướu|gigi|pergigian)\b/i },
  { niche: 'skincare',   usage: 'applied topically to skin (rubbed/patted/massaged)',
    cues: /\b(skin|skincare|serum|cream|lotion|moisturiz|moisturis|cleanser|toner|mask|sunscreen|spf|acne|wrinkle|da|dưỡng da|kem dưỡng|tinh chất|mặt nạ|kulit|wajah)\b/i },
  { niche: 'haircare',   usage: 'washed/applied into hair or scalp',
    cues: /\b(hair|shampoo|conditioner|scalp|tóc|gội|dầu gội|chân tóc|da đầu|rambut|kepala)\b/i },
  { niche: 'joint',      usage: 'worn on / supports a body joint (knee, back, wrist…), not consumed',
    cues: /\b(knee|joint|brace|back support|wrist|elbow|ankle|lưng|khớp|gối|đai|đeo|sendi|lutut|pinggang)\b/i },
  { niche: 'supplement', usage: 'swallowed orally (pill / capsule / drink)',
    cues: /\b(supplement|vitamin|capsule|tablet|pill|gummies|thực phẩm chức năng|tpcn|viên uống|uống bổ|suplemen|vitamin)\b/i },
  { niche: 'beverage',   usage: 'sipped / drunk directly',
    cues: /\b(drink|beverage|tea|coffee|juice|protein shake|nước uống|trà|cà phê|minuman)\b/i },
  { niche: 'food',       usage: 'eaten as food',
    cues: /\b(snack|cookie|biscuit|cereal|noodle|bánh|kẹo|đồ ăn|makanan)\b/i },
  { niche: 'cleaning',   usage: 'used to clean a surface / kitchen / bathroom',
    cues: /\b(detergent|cleaner|disinfect|stain|wipe|chất tẩy|lau chùi|tẩy|vệ sinh|pembersih)\b/i },
  { niche: 'pest',       usage: 'placed/sprayed to kill or repel pests; never consumed by humans',
    cues: /\b(pest|roach|cockroach|ant|mosquito|insect|repellent|bait|gián|kiến|muỗi|côn trùng|bả|serangga)\b/i },
  { niche: 'appliance',  usage: 'a tool/device that is operated, not consumed',
    cues: /\b(blender|fryer|cooker|vacuum|drill|machine|appliance|máy|thiết bị|dụng cụ|mesin|alat)\b/i },
  { niche: 'apparel',    usage: 'worn on the body (clothing/footwear)',
    cues: /\b(shirt|pants|dress|shoes|sneaker|jacket|áo|quần|giày|baju|seluar|kasut)\b/i },
]

function detectProductNiche(product: Product | null | undefined): { niche: string; usage: string } | null {
  if (!product) return null
  const hay = [product.productName, product.productDescription, product.usps, product.ingredients]
    .filter(Boolean).join(' ').toLowerCase()
  if (hay.length < 8) return null
  for (const r of NICHE_RULES) {
    if (r.cues.test(hay)) return { niche: r.niche, usage: r.usage }
  }
  return null
}

// Z48/Z70 — build the product-context block injected into the Director prompt.
// The Director was previously blind to the product (script-only), so it
// guessed usage — picking TAKE_PILL for a tooth powder, BEFORE_AFTER for a
// visible result, etc. Giving it the name + description + detected niche
// fixes the whole class of niche-misread bugs at the source.
function buildProductContextBlock(product: Product | null | undefined): string {
  if (!product) return ''
  const lines: string[] = []
  if (product.productName) lines.push(`- Name: ${product.productName}`)
  if (product.productDescription) lines.push(`- Description: ${product.productDescription.slice(0, 600)}`)
  if (product.usps) lines.push(`- Key selling points: ${product.usps.slice(0, 300)}`)
  if (product.ingredients) lines.push(`- Ingredients / contents: ${product.ingredients.slice(0, 200)}`)
  const detected = detectProductNiche(product)
  if (detected) {
    lines.push(`- Detected niche: ${detected.niche}`)
    lines.push(`- Detected physical usage: ${detected.usage}`)
  }
  if (lines.length === 0) return ''
  return `\n\nPRODUCT CONTEXT — read this FIRST to understand what the product IS and
HOW it is physically used. The "Detected niche / physical usage" lines (when
present) are a strong hint — trust them over a guess from "powder/gel/liquid":
${lines.join('\n')}

USE THIS to choose usage-correct scenes. Worked examples:
- A "powder" can be a drink mix (swallowed), a tooth powder (brushed on teeth),
  or a face mask (applied to skin) — the name + description tell you which.
- A "tooth/teeth/whitening/enamel" product is BRUSHED on teeth, never eaten.
- A cream / serum / lotion is rubbed on skin; a shampoo is washed into hair.
- A supplement / vitamin / capsule is swallowed.
- A device / appliance / tool is operated, not consumed.
- A joint brace / support is WORN on the body, not swallowed.
- A pest bait / repellent is PLACED or sprayed; the human never consumes it.\n`
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

// Z98 — presets the AI director may NOT auto-pick. They read as generic stock
// B-roll with no real claim, so the director rationalises them onto unrelated
// lines (e.g. PHONE_SCROLL "lướt điện thoại" landing on a teeth-whitening
// social-proof beat — nothing in the script is about a phone). Still available in
// the MANUAL preset library if the user deliberately adds one.
const DIRECTOR_BANNED_PRESETS: ActionPresetId[] = ['PHONE_SCROLL']
const DIRECTOR_ALLOWED_PRESETS = ACTION_PRESET_ORDER.filter(
  (p) => !DIRECTOR_BANNED_PRESETS.includes(p),
)
const DIRECTOR_PRESET_ENUM = [...DIRECTOR_ALLOWED_PRESETS, 'CONCEPT_SCENE', 'PRODUCT_IN_ACTION']

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
          // Z98 — hard maxLength caps stop Gemini 2.5-flash from rambling inside a
          // single field until it hits the token ceiling (→ truncated JSON → 0
          // scenes → weak keyword fallback). conceptPrompt is the usual culprit.
          quote:         { type: 'string', maxLength: 200 },
          durationSec:   { type: 'number' },
          fit:           { type: 'number' },
          reason:        { type: 'string', maxLength: 80 },
          conceptPrompt: { type: 'string', maxLength: 240 },
          motionKind:    { type: 'string', enum: ['graphic', 'emotion'] },
          labels:        { type: 'array', items: { type: 'string' } },
          layout:        { type: 'string', enum: ['cut', 'overlay_corner'] },
        },
        required: ['presetId', 'anchorBlock', 'quote', 'durationSec', 'fit'],
      },
    },
    // Z79 (A) — the ingredient phrases the SCRIPT actually names, copied
    // VERBATIM in the script's own language. Empty if the script names none.
    ingredientsInScript: { type: 'array', items: { type: 'string' } },
  },
  required: ['scenes'],
}

export async function directScenesWithGemini(
  params: GeminiSuggestParams,
): Promise<InsertSuggestion[]> {
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang]
  // Z79/Z80 (B) — scale the scene count to the SCRIPT LENGTH, not a flat cap.
  // Z80: DENSER now that overlays are free + additive (don't hide the creator).
  // Z98: divisor 4.5 → 4.0 + ceiling 14 → 16 so a long script has room for a
  // BIG cut quota + many overlays on top. → 64s ≈ 16, 48s ≈ 12, 32s ≈ 8,
  // 18s ≈ 5 — clamped to the cost-mode [floor, budget]. effFloor = target − 1
  // nudges Gemini to actually reach the target.
  const baseFloor = Math.max(1, Math.min(params.floor ?? 3, params.budget))
  const durTarget = Math.round((params.script.totalDurationSec || 30) / 4.0)
  const effBudget = Math.max(baseFloor, Math.min(params.budget, durTarget))
  const effFloor = Math.max(baseFloor, effBudget - 1)
  const floor = effFloor  // template references `${floor}` → the duration-aware target
  // Z98 — CUT-TIME QUOTA. At least 40% of the REAL voice length must be CUT
  // footage (real-footage scenes that REPLACE the creator full-screen). Overlay
  // illustrations ride on top and don't count toward it. ≈4s per cut → the
  // minimum number of cut scenes the director must return.
  const dur = Math.round(params.script.totalDurationSec || 30)
  const cutSecNeeded = Math.round(dur * 0.4)
  const minCutScenes = Math.max(2, Math.min(effBudget, Math.ceil(cutSecNeeded / 4)))
  const catalogue = DIRECTOR_ALLOWED_PRESETS
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
     • "graphic" — for ingredient photos, infographics, claim graphics ("5x"),
       problem-cause diagrams, microscope shots — any scene with NO PERSON.
       Examples: "microscopic bacteria multiplying", "a labeled cross-section of
       the affected body part". NOTE: a PRODUCT MECHANISM (an ingredient acting
       inside the body) is NOT a flat graphic — the engine renders it as 3D; and a
       real before/after of a PERSON is real footage ("emotion"), not a graphic.
       These render cheaply as a still + slow zoom (~6cr) — perfect when static.
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
- CREATOR-FIRST — don't anchor the FIRST insert in the opening ~3s (let the
  viewer see the talking creator first), and don't stack 3+ back-to-back cuts.
  (The engine enforces both, but plan for it.)
- INGREDIENT BEATS — when a line NAMES specific ingredients (e.g. "Activated
  Charcoal và Volcanic Ash...", "Grape Seed Extract..."), give that line a
  CONCEPT_SCENE whose conceptPrompt SHOWS and LABELS each named ingredient (the
  label IS the ingredient name). Two ingredients named → both labeled. Do NOT
  cover an ingredient line with a bare product close-up — a macro of the jar
  garbles the small label text and does NOT tell the viewer the ingredient
  names. The labeled photo / illustration does.
  *** INGREDIENT STYLE = REAL PHOTOGRAPHY, NOT HAND-DRAWN (UNIVERSAL) ***
  For ANY ingredient beat in ANY niche, write the conceptPrompt as REAL-WORLD
  macro/product photography of THAT specific ingredient's actual real-world
  appearance, on a clean neutral surface, soft natural daylight, sharp focus,
  shallow depth of field. Pick the right form per ingredient — match what the
  ingredient ACTUALLY looks like in real life:
    • Powders → a small pile/scoop in its REAL colour (charcoal black, turmeric
      orange, collagen white); oils/liquids/extracts → a few drops or a small
      glass jar (amber/golden/clear); plant/seed/herb → the raw ingredient itself;
      capsules → a few cut open showing the contents; chemical actives → a clean
      lab drop on glass. Match the ingredient's REAL look.
  Use whatever the script names. Labels in the script language, placed cleanly
  next to the ingredient (not floating). Two ingredients in the line → both
  shown side-by-side with their respective real forms + labels.
  Reserve hand-drawn doodle style for TEACHING / CLAIM graphics ("Nx more
  effective" claims, benefit-breakdowns, an abstract idea a photo can't show) and
  problem-cause visuals — NOT for product mechanism (the engine renders mechanism
  beats as a 3D animation; see the CUT-TIME QUOTA note).
- CONCEPT ART-STYLE RULE (for "graphic" CONCEPT_SCENE only) — bake the art
  direction INTO the conceptPrompt. There are THREE looks; pick per scene:
  (0) REAL-WORLD PHOTO — for INGREDIENT scenes (see "INGREDIENT STYLE" rule
      above). NOT hand-drawn — real macro photography of the actual ingredient.
  (1) SIMPLE HAND-DRAWN VISUAL — use this for TEACHING / CLAIM graphics ("X times
      more effective" claims, benefit breakdowns, abstract teaching where a real
      photo doesn't apply). NOT for product mechanism (→ 3D, the engine handles
      it). Write the conceptPrompt as:
      ONE friendly HAND-DRAWN sketch (clean simple line-art doodle, warm
      marker / crayon feel) illustrating a SINGLE idea — big, bold, instantly
      readable.
      *** SIMPLE BUT LABELED — this is the balance ***
      The viewer sees this for only 2-4 seconds WHILE the voice talks, so it
      must be absorbed at a glance AND it MUST carry the KEY TERMS the spoken
      line names, as short labels, so image and voice match:
        • LANGUAGE LOCK — EVERY text label in the image MUST be written in
          ${langName} (the script's language). For a Bahasa Malaysia script the
          labels are Malay, for a Vietnamese script Vietnamese, etc. NEVER mix
          languages and NEVER default to another language.
          *** Even when the PRODUCT NAME is English (e.g. "Brightening Serum"),
          the concept LABELS stay in ${langName} — mirror the term from the
          ${langName} quote (e.g. "Da xỉn", "Sáng mịn", NOT "dull skin",
          "brightening"). Brand-name actives ("Activated Charcoal", "Niacinamide")
          may keep their original form if the script writes them that way. ***
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
      Example (multi-ingredient — works for ANY niche; here skincare): "Simple
      friendly hand-drawn sketch: a drop of vitamin C serum + a green tea leaf
      soothing red irritated skin, two short labels (each ingredient's name in
      ${langName}), warm marker style, lots of white space." Example (claim):
      "Hand-drawn '5x' badge over the improved area with one short ${langName}
      label for the core tech, airy, minimal."
      LAYOUT — the frame is cropped to TALL VERTICAL 9:16 and slowly zoomed, so
      keep the drawing + its labels CENTRED with wide margins; nothing near the
      edges (it gets cropped).
  (2) REALISTIC SCIENTIFIC — use this ONLY for true microscopy / anatomy / real
      micro-phenomena (bacteria, a tissue/anatomy cross-section under a microscope). Write
      it as a realistic documentary/medical close-up, NO text labels.
  Most ingredient/mechanism beats in an ad should be (1) the friendly
  infographic — it reads clearly and matches UGC tone. Reserve (2) for genuine
  microscope/anatomy shots.
- LABELS FIELD (REQUIRED for teaching graphic scenes) — for a "graphic"
  CONCEPT_SCENE of style (1) that teaches (ingredient / mechanism / "Nx" claim /
  benefit), you MUST ALSO fill the separate "labels" array with the short text
  to PRINT on the image, each in ${langName}, each 1-3 words. This is NOT
  optional and must not be left empty for these scenes — a teaching graphic
  with no labels is useless. Examples:
    • line "Activated Charcoal và Volcanic Ash..." → labels: ["Than hoạt tính", "Tro núi lửa"]  (in ${langName})
    • line "...gấp 5 lần..." → labels: ["Công nghệ Nano", "5x"]
  Leave "labels" EMPTY ONLY for: pure pain/emotion visuals that need no words,
  and style (2) realistic microscopy. Brand-name ingredients may stay in their
  original form if the script writes them that way.
- NO-PRODUCT-IN-CONCEPT — when writing a CONCEPT_SCENE conceptPrompt, NEVER
  describe ANY product-like object: no brace, jar, bottle, tube, sachet, pill,
  device, toothbrush head, medical appliance — branded OR unbranded, real OR
  generic. Even a "generic version" of the product visually competes with the
  real product (the viewer thinks "is that the product?"). Concept scenes show
  ONLY: anatomy, raw ingredients (charcoal chunks, grape seeds, herb leaves),
  mechanism diagrams (particles, arrows, cross-sections), body parts, or pure
  emotion. If the scene NEEDS a product on screen, switch presetId to
  PRODUCT_IN_ACTION or one of the 12 fixed product presets — not CONCEPT_SCENE.
- VISUAL VARIETY — do NOT make every graphic scene the same "subject in the
  centre with a label". A run of 5 near-identical illustrations feels like a
  boring slideshow. Vary EACH scene so the eye keeps moving:
    • Change the SUBJECT focus: sometimes the ingredient itself (a powder, a seed,
      a drop, a leaf) as the hero, sometimes the target body part, sometimes a
      hand / face close-up, sometimes an abstract motion (particles, sparkles).
    • Change the FRAMING / ANGLE: extreme macro, side angle, top-down, wide,
      split — not always a flat centred front view.
    • BALANCE illustration with reality: an all-cartoon B-roll set looks fake.
      Across the whole ad, mix the hand-drawn teaching scenes with REAL-footage
      scenes (emotion reactions, the product in use, before/after) so it does
      not become a cartoon slideshow. Aim for roughly half illustration, half
      real footage when the script allows.
- Group sentences describing the SAME idea into ONE scene; don't cut every line.
- NO ABSTRACT TEXT-METAPHORS — a scene that only makes sense by READING words in
  it (a calendar labelled "Doubt → Relief", a signpost, a gauge marked
  "before/after", a clock) is weak UGC: abstract, text-dependent, slow to read.
  Prefer a CONCRETE visual — the person's face/reaction, the body part, the
  ingredient, the product in use. Also do NOT illustrate the SAME felt-transition
  twice: if one scene already shows "skeptical → relieved" (e.g. a person
  before/after), do NOT add a second metaphor scene for the same idea.
- DURATION — keep every scene 3-4s (MAX 4s; the engine clamps it). A dense beat
  (a multi-step mechanism, several ingredients) → SPLIT into 2-3 short cuts, each
  a different angle (subject / framing / environment), not one long scene.
- Anchor each scene to the ONE block (hook/pain/discovery/benefit/cta) whose
  dialogue it illustrates (used only as a coarse fallback).
- PRODUCT FORM — pick a fixed preset only if the product matches its assumed form
  (OPEN_CAP = screw-cap bottle, TAKE_PILL = a solid pill, DRINK = sipped straight,
  UNBOX = ships in a box, BAG_PRODUCT_PULL = fits a handbag). When unsure, use
  PRODUCT_IN_ACTION and describe the real action — it's form-agnostic. DRINK/
  TAKE_PILL are for genuinely SWALLOWED products only; a TOPICAL (tooth powder
  brushed on, cream rubbed in, spray sprayed on) must be PRODUCT_IN_ACTION showing
  the real application, never swallowed. (The engine auto-fixes a swallow preset
  picked for a topical, but get it right.)
- LAYOUT — set "cut" (replaces the creator full-screen) for high-impact REAL
  beats: hook reveal, pain shot, product demo, visible before/after, CTA close,
  and the 3D mechanism. Set "overlay_corner" (corner PIP while the creator keeps
  talking) for SUPPORTING teaching illustrations (ingredient photos, claim
  graphics, infographics). The engine auto-forces hand-drawn teaching graphics to
  overlay, so the ad stays creator-led with pop-ups, punctuated by real cuts.
- CTA close — the final "cta" beat is the creator holding the product up beside
  their face + a thumbs-up endorsement ("trust me, try this"). The engine forces
  this, so just anchor a scene to the "cta" block.
- BEFORE/AFTER — for a VISIBLE result (whiter teeth, clearer skin, fuller hair,
  faded marks) show a REAL before/after of the SAME person: TWO real testimonial
  photos — a BEFORE shot (whole face/area, problem visible) and an AFTER shot
  (improved) — realistic phone photo, natural light. NEVER one face/image split
  down the middle (looks fake), NO cinematic/glow/CGI. For an INTERNAL/felt result
  (energy, sleep, mood, focus) a face going tired → relieved is fine. (The engine
  auto-switches BEFORE_AFTER_REACTION → a real before/after for visible results.)
- Don't pick the same fixed preset twice — vary the composition (the engine
  swaps duplicates automatically, but variety is better from the start).
- SCENE COUNT — TARGET the FULL ${effBudget} scenes (matched to the ${dur}s
  length — the ad should feel RICH and fast, not sparse). Returning only ~half
  the budget makes a flat, talking-head-heavy ad. A normal product script has
  plenty to show, so REACH ${effBudget} by DECOMPOSING dense lines instead of
  covering each with one scene:
    • a pain line that names several symptoms (e.g. tired / aching / bloated, OR
      dull / dry / flaky skin, OR yellow teeth / bad breath / sensitivity) = one
      scene per symptom.
    • a line naming 2 ingredients = 2 scenes (one each).
    • a benefit/result list = ONE scene per benefit.
  Then give EACH of these its own scene too: every named ingredient, every
  symptom, every distinct benefit, every claim/number, the mechanism, the hook,
  the demo, the proof, and the CTA. More short scenes > fewer long ones.
- EVERY SCENE MUST EARN ITS PLACE — each scene MUST illustrate a SPECIFIC spoken
  detail (its "quote") with something LITERALLY in that line: a real object, body
  part, action, ingredient, number, or face. Decomposing real spoken details
  (above) is NOT padding — it's coverage. What IS forbidden: inventing an
  abstract, decorative or vague "vibe" scene (drifting particles, generic
  lifestyle b-roll, a mood with no spoken anchor), or REPEATING the same idea.
  Returning fewer than ${floor} scenes on a normal product script is too flat /
  lazy — only drop below that if the script is genuinely thin.
- CUT-TIME QUOTA — at least 40% of the ${dur}s video should be CUT footage
  (real-footage scenes that REPLACE the creator, layout:"cut") ≈ ${minCutScenes}
  cuts; don't go overlay-heavy with only 2-3. A CUT shows the REAL thing — the
  product in hand / being used, the visible result, a real before/after, the
  package, the creator demoing or endorsing. EVERY REAL CUT must look like real
  phone footage: NO cinematic / fantasy / glowing / floating / CGI on a real
  person or product. ILLUSTRATION overlays (teaching sketches / ingredient photos
  / infographics, layout:"overlay_corner") ride on top of the creator, do NOT
  count toward the 40%, and are unlimited. (The engine tops cuts up to 40% and
  renders product-mechanism beats as 3D, so just aim true and it holds.)
- "fit" = 0..1 how strongly the visual supports the line. "reason" = one short
  phrase in ${langName} explaining the choice (shown to the user).
- BE CONCISE — HARD LIMITS: "conceptPrompt" ≤ 240 characters (one tight visual
  sentence, no extra adjectives), "reason" ≤ 12 words, "quote" = ONE line copied
  verbatim (never a paragraph). Do NOT repeat, pad, or keep elaborating a single
  scene. A long-winded response gets cut off mid-JSON and the WHOLE result is
  lost — short scenes that all fit beats one verbose scene that truncates.

INGREDIENT EXTRACTION — separately from the scenes, scan the WHOLE script for any
PRODUCT INGREDIENT it names (e.g. an extract, a powder, an oil, a herb, an active
compound). Copy each one into "ingredientsInScript" EXACTLY as it is written in
the script, in ${langName} (the script's language) — do NOT translate it to
English, do NOT add ingredients the script does not mention. If the script names
no ingredients, return an empty array. This list guarantees an ingredient scene
gets made even if you did not pick one above.

OUTPUT strict JSON, no fences:
{ "scenes": [ { "presetId": "...", "anchorBlock": "...", "quote": "(verbatim line)",
  "durationSec": 4, "fit": 0.0, "reason": "...",
  "conceptPrompt": "(required for CONCEPT_SCENE and PRODUCT_IN_ACTION)",
  "labels": ["(required for teaching graphic CONCEPT_SCENE — short ${langName} terms to print on the image; empty for pain/emotion/microscopy)"],
  "layout": "cut | overlay_corner (per LAYOUT RULE — pick per scene)" } ],
  "ingredientsInScript": ["(each ingredient the script names, verbatim, in ${langName}; [] if none)"] }`

  const userPrompt = `SCRIPT (block id in brackets):\n${scriptDump}\n\nDirect the scenes now.`

  // Z43/Z80 — room for the full scene list. Z80 raised the budget to 12 scenes
  // (each with a VN quote + VN reason + an English conceptPrompt + the ingredient
  // list). At 8192 the JSON truncated mid-array on a 12-scene 55s script
  // (raw≈33k chars > 8192-token ceiling) → JSON.parse failed → parsed=0 →
  // silent fallback to the weak 2-insert keyword path (the "không ra 12" bug).
  // Z98 — raised 16384 → 32768. With the cap now 14 (and verbose conceptPrompts),
  // a long 60s+ script could ramble past 16384 (seen: raw=60335ch parsed=0). The
  // schema maxLength caps + the CONCISE rule keep each scene small; this ceiling
  // is the safety net so even a full 14-scene list always closes its JSON.
  const raw = await directGeminiText({
    apiKey: params.geminiKey,
    systemInstruction,
    prompt: userPrompt,
    maxOutputTokens: 32768,
    responseMimeType: 'application/json',
    responseSchema: DIRECTOR_RESPONSE_SCHEMA,
    // Z43 — disable 2.5-flash "thinking" so the whole token budget goes to the
    // JSON answer, not internal reasoning (which was returning empty bodies).
    thinkingBudget: 0,
  })

  const { scenes: parsed, ingredientsInScript } = parseDirectorOutput(raw)
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
  const rewrite = { beforeAfter: 0, topical: 0, dupeSwap: 0, labeled: 0, labelLangDrop: 0, ctaClose: 0 }

  const seen = new Set<ActionPresetId>()
  // Z98 — de-dupe free scenes by their conceptPrompt prefix. Free scenes are
  // exempt from the preset-key dedup (their identity is the prompt), but the CTA
  // close-rewrite OVERWRITES the prompt with a FIXED endorsement template, so two
  // cta-anchored scenes end up byte-identical (the #10≡#11 duplicate). This also
  // catches any other accidental repeat of the same concept.
  const seenPrompts = new Set<string>()
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
      // Z74 — was 'graphic' (generic anatomy split, no person). Now 'emotion'
      // so the keyframe builder anchors the scene to the AVATAR ref → the
      // BEFORE and AFTER halves both show the SAME creator (not random
      // anatomy), with the BEFORE state visibly impaired and the AFTER state
      // visibly recovered. Authentic before/after = same person across both.
      motionKind = 'emotion'
      conceptPrompt = conceptPrompt.length > 0 ? conceptPrompt :
        `A REAL before/after of THE SAME PERSON (from the avatar reference) for the ` +
        `line "${quote}": TWO real testimonial photos side by side — the BEFORE photo ` +
        `(whole face/area, the visible problem the script names: yellow stained ` +
        `teeth / acne skin / thinning hair, subdued mood) and the AFTER photo (the ` +
        `SAME person, problem clearly resolved: white teeth / clear skin / fuller ` +
        `hair, confident smile). Identical face + outfit, only the named body-part ` +
        `+ mood differ. Realistic phone photo, natural light. NOT one single face/` +
        `image split down the middle into two halves, NOT cinematic, NO glow/CGI.`
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

    // Z93 — CTA TRUST-CLOSE rewrite. The final CTA beat should be the creator
    // personally ENDORSING the product: holding it up + a THUMBS-UP + an
    // approving smile/nod ("trust me, buy it"). The Director kept picking
    // POINT_LABEL — which renders the PRODUCT ALONE (no creator face, no
    // endorsement) — or a plain hold. Force every cta-anchored scene to
    // PRODUCT_IN_ACTION with the thumbs-up endorsement so the close is always
    // creator + product + 👍. Runs LAST so it wins over before/after/topical.
    if (item.anchorBlock === 'cta') {
      const quote = (item.quote ?? '').trim()
      presetId = 'PRODUCT_IN_ACTION' as ActionPresetId
      motionKind = 'emotion'
      conceptPrompt =
        `The SAME creator (from the avatar reference) holds the product up beside their face in one hand ` +
        `and gives an enthusiastic THUMBS-UP with the other hand, with a big approving smile and a confident ` +
        `nod — a warm personal endorsement / "trust me, you should try this" close for the CTA line ` +
        `"${quote}". Authentic UGC selfie, natural friendly light. Keep the EXACT product packaging ` +
        `(same colour/label), and the creator's face identical to the avatar.`
      rewrite.ctaClose++
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
    // Z98 — MECHANISM → 3D. When the line explains HOW THE PRODUCT works (an
    // ingredient/technology acting on/inside the body — restoring enamel,
    // absorbing plaque, nano delivering minerals into the tooth) it is NOT
    // filmable as real footage. Instead of a hand-drawn overlay OR a surreal
    // avatar+magic cut, render it as a clean 3D scientific animation (no person),
    // full-screen cut. Marked via a conceptPrompt prefix the renderer detects.
    // Only a NON-person concept scene can become a 3D animation — a person /
    // emotion / before-after scene (motionKind 'emotion') stays real footage even
    // if it mentions a mechanism word ("she nourishes her skin").
    const is3D = presetId === 'CONCEPT_SCENE' && motionKind !== 'emotion' &&
      MECHANISM_RE.test(`${typeof item.quote === 'string' ? item.quote : ''} ${conceptPrompt}`)
    const isEmotionConcept = presetId === 'CONCEPT_SCENE' && motionKind === 'emotion'
    const renderMode: InsertRenderMode =
      is3D ? 'video'
        : presetId === 'CONCEPT_SCENE'
          ? (isEmotionConcept ? 'video' : 'ken_burns')
          : 'video'

    // Z98 — rebuild a mechanism scene as a 3D scientific-animation prompt (no
    // person, no text, no product). The renderer detects this "3D MECHANISM
    // ANIMATION" prefix → switches to a 3D render style + drops the avatar.
    // layout is forced to 'cut' below.
    if (is3D) {
      const core = conceptPrompt
        .split('\n\n')[0]
        .replace(/\b(simple |friendly )?(hand[- ]drawn sketch|hand[- ]drawn|illustration|illustrated|animated graphic|animation|graphic|drawing|infographic|ilustrasi|lakaran|sketch|labeled|split[- ]screen)\b/gi, '')
        .replace(/\s+/g, ' ').trim()
      conceptPrompt =
        `3D MECHANISM ANIMATION (no people, no text): clean photorealistic 3D ` +
        `scientific / medical animation showing ${core}. Studio 3D render, ` +
        `cross-section / macro view of the body part, smooth depth of field, soft ` +
        `clinical light. NO human, NO avatar, NO text labels, NO product packaging.`
    }

    // Z56 — hard-inject the structured labels into the conceptPrompt as an
    // explicit "render this text" instruction. The Director kept dropping
    // labels when they were only an instruction buried in prose; making them
    // a separate field + appending them here as a final, unmissable directive
    // forces the labels to actually appear in the image. Only for graphic
    // (ken_burns) concept scenes — emotion video + realistic microscopy get none.
    let labels = Array.isArray(item.labels)
      ? item.labels.map((l) => String(l).trim()).filter((l) => l.length > 0 && l.length <= 24).slice(0, 4)
      : []
    // Z70 — Language filter. For non-English scripts the labels MUST be in the
    // script language. The Director sometimes drifts to English when the
    // product description contains English terms ("Knee Support Booster"). We
    // detect: a label that is ALL-Latin without ANY diacritics on a VN script,
    // OR all-Latin on a BM script that doesn't match the script's own words —
    // and drop it (better no label than wrong-language label). The structured-
    // labels rule + ${langName} mention in the prompt are still the primary
    // defense; this is the safety net.
    if (params.lang === 'vi' && labels.length > 0) {
      // Vietnamese has diacritics on most non-trivial words. A 4+ char label
      // with zero diacritics is almost certainly English. Allow short words
      // (1-3 chars like "5x") and known global terms.
      const KEEP_AS_IS = /^(5x|10x|nano|gmp|fda|iso|vit|c|b1|b3|b5|b12)$/i
      const droppedLabels: string[] = []
      labels = labels.filter((l) => {
        if (KEEP_AS_IS.test(l)) return true
        if (l.length <= 3) return true  // short codes pass
        const hasDiacritic = /[À-ỹĂăÂâÊêÔôƠơƯưĐđ]/.test(l)
        // All-Latin no-diacritic label on a VN script → drop (likely English).
        if (!hasDiacritic && /^[A-Za-z0-9\s\-./()]+$/.test(l)) {
          droppedLabels.push(l)
          return false
        }
        return true
      })
      if (droppedLabels.length > 0) {
        rewrite.labelLangDrop += droppedLabels.length
        console.warn(`[DIRECTOR] dropped non-VN labels: ${droppedLabels.join(', ')} (scene anchor=${anchor})`)
      }
    }
    if (presetId === 'CONCEPT_SCENE' && renderMode === 'ken_burns' && labels.length > 0) {
      const list = labels.map((l) => `"${l}"`).join(', ')
      conceptPrompt +=
        `\n\nTEXT TO RENDER IN THE IMAGE — print these exact words as BIG, clear, ` +
        `correctly-spelled hand-written labels placed next to what they describe: ${list}. ` +
        `Do NOT translate or alter them. These labels MUST be visible and legible in the image.`
      rewrite.labeled++
    }
    // Z92 — LANGUAGE LOCK on ANY text in the image (not just the labels above).
    // GPT-4o reads the English conceptPrompt and otherwise renders incidental
    // ENGLISH text — calendar day names, "Doubt → Relief" arrows, captions (the
    // #8 nasal-spray calendar bug). Force every visible word into the script's
    // language for ALL graphic concept scenes.
    if (presetId === 'CONCEPT_SCENE' && renderMode === 'ken_burns') {
      conceptPrompt +=
        `\n\nLANGUAGE: EVERY word/caption/label/heading that appears anywhere in ` +
        `the image MUST be written in ${langName} — NEVER English. This includes ` +
        `calendar day names, arrow labels, headings and any incidental caption. ` +
        `Only a brand/product name may stay as printed on the real product.`
    }

    // Z98 — drop a free scene whose conceptPrompt repeats one already emitted
    // (the CTA endorsement template is identical across cta scenes → #10≡#11).
    if (isFreeScene) {
      const promptKey = conceptPrompt.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 160)
      if (seenPrompts.has(promptKey)) { drop.dupeSkip++; continue }
      seenPrompts.add(promptKey)
    }

    const durationSec = clampDuration(item.durationSec, presetId, renderMode)
    const quote = typeof item.quote === 'string' && item.quote.trim().length > 0
      ? item.quote.trim()
      : undefined
    // Z69 — pick layout. Honour the Director's choice when valid. When absent
    // or invalid, choose a SAFE default per scene kind:
    //   • CTA / hook product reveal / demo / visible-result → 'cut' (focus).
    //   • Teaching graphic CONCEPT_SCENE (ken_burns w/ labels) → 'overlay_corner'.
    //   • Everything else → 'cut'.
    const directorLayout = item.layout === 'overlay_corner' || item.layout === 'cut'
      ? item.layout
      : undefined
    // Z77 — static illustration concept scenes (infographic / ingredient /
    // mechanism — no person, renderMode ken_burns) ALWAYS overlay on the
    // talking creator, so the ad stays a continuous creator-led piece with
    // illustrations popping over it ("sinh động" target) instead of a slideshow
    // of full-screen cuts. We OVERRIDE the Director's layout for these — its
    // habit of marking them 'cut' is exactly what flattened the ad into a
    // slideshow. Person / product / demo / before-after / CTA keep the
    // Director's choice (defaulting to 'cut' for full focus).
    const isStaticIllustration = presetId === 'CONCEPT_SCENE' && renderMode === 'ken_burns'
    const layout: InsertLayout =
      is3D ? 'cut'                                  // Z98 — 3D mechanism = full-screen cut
        : isStaticIllustration ? 'overlay_corner'
        : (directorLayout ?? 'cut')
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
      layout,
    })
  }
  // Z69/Z79 — Trust & pacing safety net (post-parse):
  // 1. CREATOR-FIRST: drop any scene anchored before t<3s so the viewer sees
  //    the speaker's face during the trust-building window. Director was told
  //    not to do this, but Gemini sometimes still front-loads infographics.
  // 2. CUT COVERAGE CAP (Z79 (C)): only CUT inserts hide the creator, so only
  //    CUTS count toward the cap (≤ 50% of voice). OVERLAYS are uncapped — the
  //    creator stays full-screen + talking behind them, so they can't "lose"
  //    the creator no matter how many there are. (Pre-Z79 this counted overlays
  //    too, which throttled the lively pop-up illustrations for no reason.)
  // 3. NO-RUN-OF-3: split runs of 3+ back-to-back inserts by removing the
  //    middle one, so the creator's face surfaces between illustrations.
  const sortedByTime = [...out].sort((a, b) => {
    const ta = a.matchedBlocks[0] ? 0 : 0  // tie-break placeholder
    return ta - (b.matchedBlocks[0] ? 0 : 0)
  })
  void sortedByTime  // (placeholder so the import stays — reordering not needed; we use computeQuoteTimestamp at apply time)

  const trustDrops = { earlyHook: 0, coverage: 0, run3: 0 }
  // (1) Creator-first — best-effort: we don't have block timestamps here, but
  //     the FIRST anchored block we see is the hook. We drop the FIRST scene
  //     iff its quote sits in the hook block AND there are at least 2 hook
  //     scenes (so the second can carry the hook beat with a small delay).
  const hookScenes = out.filter((s) => s.anchorBlock === 'hook')
  if (hookScenes.length >= 2) {
    const idx = out.indexOf(hookScenes[0])
    if (idx >= 0) {
      out.splice(idx, 1)
      trustDrops.earlyHook++
    }
  }
  // (2) CUT coverage cap — only REAL cuts hide the creator + count toward it.
  // Z98 — EXCLUDE 3D mechanism scenes: they're intentional full-screen premium
  // moments, not "the creator being buried", so they must never be dropped here
  // (and shouldn't squeeze the real-footage cuts out of the 50% budget).
  const voiceDur = params.script.totalDurationSec
  if (voiceDur && voiceDur > 0) {
    const isCut = (x: InsertSuggestion) => x.layout !== 'overlay_corner' && !is3DScene(x)
    const cap = voiceDur * 0.5  // ≤50% of the ad may be hidden by REAL cuts
    let cutSec = out.filter(isCut).reduce((s, x) => s + (x.durationSec ?? 4), 0)
    if (cutSec > cap) {
      // Drop the lowest-confidence CUTS (never overlays) until under the cap.
      const rankedCuts = out.filter(isCut).sort((a, b) => a.confidence - b.confidence)
      while (cutSec > cap && rankedCuts.length > 1) {
        const victim = rankedCuts.shift()
        if (!victim) break
        const idx = out.indexOf(victim)
        if (idx >= 0) {
          cutSec -= victim.durationSec ?? 4
          out.splice(idx, 1)
          trustDrops.coverage++
        }
      }
    }
  }
  // (3) Break runs of 3+ consecutive CUTS only (Z80). A run of CUTS hides the
  //     creator for a long stretch = slideshow risk. OVERLAYS are EXEMPT — the
  //     creator stays full-screen + talking behind them, so any number of
  //     consecutive overlays is fine (that's the lively pop-up look the user
  //     wants). Pre-Z80 this counted ALL inserts by anchorBlock, which — now
  //     that we run 10-12 dense scenes across only 5 blocks — fired constantly
  //     and silently deleted ~3 scenes ("chưa ra 12 chip" bug). Cuts are
  //     already bounded by the 50% coverage cap, so this rarely triggers now.
  for (let i = 0; i < out.length - 2; i++) {
    const isCut = (s: InsertSuggestion) => s.layout !== 'overlay_corner'
    if (
      isCut(out[i]) && isCut(out[i + 1]) && isCut(out[i + 2]) &&
      out[i].anchorBlock != null &&
      out[i].anchorBlock === out[i + 1].anchorBlock &&
      out[i].anchorBlock === out[i + 2].anchorBlock
    ) {
      out.splice(i + 1, 1)
      trustDrops.run3++
      i--  // re-check the new triplet
    }
  }

  // Z78/Z79 — INGREDIENT COVERAGE GUARANTEE. Z79 (A): drive it off the
  // ingredient phrases GEMINI extracted FROM THE SCRIPT (language-correct,
  // cross-language safe) — falls back to product.ingredients literal match.
  const ingredientInjected = enforceIngredientScene(out, params.script, params.product, effBudget, ingredientsInScript)

  // Keep the director's ORDER (narrative sequence), not a fit sort — scenes
  // should play in script order. Cap to the duration-aware budget.
  const directed = out.slice(0, effBudget)
  // Z98 — HARD cut-quota guarantee. The prompt rule biases the director, but it's
  // an LLM and keeps going overlay-heavy on teaching scripts. If cut footage is
  // short, promote the most FILMABLE overlay illustrations (person / body-part /
  // product / result / before-after — NOT abstract data/mechanism graphics) into
  // real-footage cuts.
  const promotedCuts = promoteCutsToQuota(directed, cutSecNeeded)
  // Z98 — cut-quota telemetry. Cuts = real-footage scenes that replace the
  // creator (layout !== overlay_corner); overlays don't count toward the 40%.
  const cutScenes = directed.filter((s) => s.layout !== 'overlay_corner' && !is3DScene(s))
  const cutSec = Math.round(cutScenes.reduce((sum, s) => sum + (s.durationSec ?? 4), 0))
  const scenes3D = directed.filter(is3DScene).length
  const overlays = directed.filter((s) => s.layout === 'overlay_corner').length
  console.log(
    `[DIRECTOR] raw=${raw.length}ch parsed=${parsed.length} usable=${out.length} ` +
    `dropped{preset:${drop.preset},noPrompt:${drop.noPrompt},zeroFit:${drop.zeroFit},dupeSkip:${drop.dupeSkip}} ` +
    `rewrote{beforeAfter:${rewrite.beforeAfter},topical:${rewrite.topical},dupeSwap:${rewrite.dupeSwap},labeled:${rewrite.labeled},labelLangDrop:${rewrite.labelLangDrop},ctaClose:${rewrite.ctaClose}} ` +
    `trust{earlyHook:${trustDrops.earlyHook},coverage:${trustDrops.coverage},run3:${trustDrops.run3}} ` +
    `realCuts=${cutScenes.length}/${minCutScenes} cutSec=${cutSec}/${cutSecNeeded}s(≥40%of${dur}s) promoted=${promotedCuts} 3d=${scenes3D} overlays=${overlays} ` +
    `ingredientInject=${ingredientInjected} ` +
    `visibleResult=${visibleResultProduct} topical=${topicalCategory ?? 'no'} ` +
    `→ ${directed.length > 0 ? `${directed.length} scenes` : 'EMPTY → keyword fallback'}`,
  )
  if (directed.length > 0 && cutSec < cutSecNeeded) {
    console.warn(
      `[DIRECTOR] CUT QUOTA MISS — only ${cutSec}s cut footage (<${cutSecNeeded}s = 40% of ${dur}s). ` +
      `Director went overlay-heavy; bấm "Đạo diễn lại" để thử lại.`,
    )
  }
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

// Z98 — HARD cut-quota enforcement. Promote overlay illustrations into real-
// footage CUTS until cut footage ≥ the 40% quota. ONLY pure diagram / data
// graphics can't be filmed (molecular/cross-section diagrams, counters, badges,
// "how it works") — skip just those. EVERYTHING else in a product ad (a product,
// a body part, a result, a person, a before/after) can be shown as real footage,
// so default to promotable. NOTE: body-state words (plaque, bacteria, eroded) are
// deliberately NOT in ABSTRACT — "split-screen of teeth with plaque vs white" is a
// perfectly filmable before/after, not a diagram. Mutates scenes in place; returns
// how many were promoted. Promotion order = script order (keeps narrative flow).
// (Internal-mechanism scenes are already converted to 3D cuts upstream by
// MECHANISM_RE, so they never reach this overlay pool — ABSTRACT only needs the
// pure data / diagram graphics here.)
const ABSTRACT_RE = /\b(nano|molecul\w*|cross[- ]section|schematic|diagram|counter|graph|chart|infographic|icon|flag|badge|stamp|how it works|mechanism|statistic\w*|percentage|arrow|timeline|calendar|glowing particle)\b/i

// Z98 — PRODUCT MECHANISM = an ingredient/technology acting ON/INSIDE the body
// (restoring enamel, absorbing plaque, nano delivering minerals into the tooth).
// Can't be filmed for real → rendered as a 3D scientific animation (no person),
// not real footage and not a hand-drawn overlay. Narrow on purpose: problem-cause
// scenes (enamel ERODING, bacteria forming) and demos / before-after are NOT
// mechanism and are left alone.
const MECHANISM_RE = /\b((restor|repair|rebuild|remineral|strengthen|heal|regenerat|replenish|lubricat|calm|soothe|regulat|balanc|neutralis|neutraliz|detox|cleans|stimulat|coat|feed|flush|boost|nourish)\w*( the| your)? (enamel|tooth|teeth|gum|skin|hair|scalp|nail|follicle|collagen|gut|stomach|intestin\w*|digest\w*|joint|cartilage|bone|ligament|liver|kidney|blood\w*|cell|nerve|nervous|immun\w*|muscle|gland|hormone|metabolism|lung|artery|vein|eye|root)|absorb\w* (the )?(plaque|plak|toxin|bacteria|dirt|kotoran|impurit|stain|oil|grease)|penetrat\w*|deliver\w*[^.]{0,25}(mineral|nutrient|ingredient|vitamin|collagen|active)\w*|nano[- ]?(tech|particle|mineral)\w*|particles? (that )?(sink|enter|penetrat|go deep|absorb)|deep in(to)? the (tooth|enamel|skin|hair|root|gut|joint|cell|body)|inside the (tooth|enamel|body|skin|hair|gut|joint|cell))\b/i

// Z98 — a scene that was rebuilt into a 3D mechanism animation (marked in prompt).
// These are full-screen cuts but DON'T count toward the 40% real-footage quota.
const is3DScene = (s: InsertSuggestion) => (s.conceptPrompt ?? '').startsWith('3D MECHANISM ANIMATION')

// Only the FIRST paragraph is the real scene description. The engine appends
// "\n\nTEXT TO RENDER…" + "\n\nLANGUAGE: EVERY … calendar day names … arrow labels …"
// boilerplate to labeled illustration scenes — those words would otherwise poison
// the abstract check (calendar/arrow are in ABSTRACT_RE) and wrongly skip every
// labeled overlay. So test + rebuild from the base description only.
const baseDesc = (s: InsertSuggestion) => (s.conceptPrompt ?? '').split('\n\n')[0].trim()

function promoteCutsToQuota(scenes: InsertSuggestion[], cutSecNeeded: number): number {
  const cutSec = () => scenes
    .filter((s) => s.layout !== 'overlay_corner' && !is3DScene(s))
    .reduce((sum, s) => sum + (s.durationSec ?? 4), 0)
  if (cutSec() >= cutSecNeeded) return 0

  const promotable = scenes.filter((s) =>
    s.layout === 'overlay_corner' &&
    typeof s.conceptPrompt === 'string' &&
    s.conceptPrompt.length > 0 &&
    !ABSTRACT_RE.test(baseDesc(s)),
  )

  let promoted = 0
  for (const s of promotable) {
    if (cutSec() >= cutSecNeeded) break
    s.layout = 'cut'
    s.renderMode = 'video'  // real footage (i2v), not a ken_burns illustration
    const cleaned = baseDesc(s)
      .replace(/\b(simple |friendly )?(hand[- ]drawn sketch|hand[- ]drawn|illustration|illustrated|animated graphic|animation|graphic|drawing|infographic|ilustrasi|lakaran|sketch)\b/gi, 'real footage')
      .replace(/\b(glowing|magical|magic|floating|sci-?fi|cinematic|fantasy|surreal|CGI|particles)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    s.conceptPrompt =
      `Real, photographic, realistic phone-shot UGC footage — NOT a drawing/sketch/` +
      `graphic, NOT cinematic, NO magical/fantasy/glowing/floating/CGI effects, only ` +
      `real physical objects + real people in natural light: ${cleaned}`
    promoted++
  }
  if (promoted > 0) {
    console.log(`[DIRECTOR] cut-quota: promoted ${promoted} overlay illustration(s) → real-footage cuts`)
  }
  return promoted
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

// Z78 — INGREDIENT COVERAGE GUARANTEE. The "INGREDIENT BEATS" prompt rule is
// SOFT — Gemini sometimes skips the ingredient line entirely (covers it with a
// bare product close-up, or merges it away), so a script that NAMES ingredients
// could ship with NO ingredient scene at all (the user hit this). This injects
// ONE photoreal ingredient CONCEPT_SCENE — but ONLY when:
//   (a) the product has an ingredient list, AND
//   (b) the SCRIPT actually mentions ≥1 of those ingredients, AND
//   (c) no existing scene already covers them.
// If the script never mentions ingredients → does NOTHING (no forced/hardcoded
// scene, per the user's instruction). Returns 1 if injected, else 0.
function normalizeForMatch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim()
}
function enforceIngredientScene(
  out: InsertSuggestion[],
  script: GeneratedScript,
  product: Product | null | undefined,
  budget: number,
  ingredientsFromScript: string[] = [],
): number {
  // Z79 (A) — PRIMARY source: the phrases Gemini extracted FROM THE SCRIPT (in
  // the script's own language). This is what the user wanted — "read the
  // script". It is cross-language safe (product list can be English while the
  // script is Vietnamese) AND gives correctly-localised on-image labels.
  // FALLBACK: literal match of product.ingredients against the script (only
  // works when they share a language) for the rare case Gemini returns nothing.
  let mentioned = ingredientsFromScript
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 50)

  if (mentioned.length === 0) {
    if (!product?.ingredients) return 0
    const vocab = product.ingredients
      .split(/[,;\n•·/|]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3 && s.length <= 40)
    if (vocab.length === 0) return 0
    const scriptNorm = normalizeForMatch(script.blocks.map((b) => b.text).join('  '))
    mentioned = vocab.filter((ing) => scriptNorm.includes(normalizeForMatch(ing)))
  }
  if (mentioned.length === 0) return 0

  // (c) already covered? Any scene whose conceptPrompt/quote names a mentioned
  //     ingredient counts → don't duplicate.
  const covered = out.some((s) => {
    const hay = normalizeForMatch(`${s.conceptPrompt ?? ''} ${s.quote ?? ''}`)
    return mentioned.some((ing) => hay.includes(normalizeForMatch(ing)))
  })
  if (covered) return 0

  // Find the script sentence naming the MOST ingredients → use it as the quote
  // so the planner times the overlay to that exact line.
  let bestQuote = ''
  let bestHits = 0
  let bestBlock: ScriptBlockId | undefined
  for (const b of script.blocks) {
    const sents = b.text.split(/(?<=[.!?…])\s+|\n+/).map((x) => x.trim()).filter(Boolean)
    for (const sent of sents) {
      const sn = normalizeForMatch(sent)
      const hits = mentioned.filter((ing) => sn.includes(normalizeForMatch(ing))).length
      if (hits > bestHits) { bestHits = hits; bestQuote = sent; bestBlock = b.id }
    }
  }
  if (!bestQuote) { bestQuote = mentioned.join(', '); bestBlock = 'benefit' }

  // Build the photoreal ingredient scene (static image → overlays per Z77).
  const list = mentioned.slice(0, 4)
  const labelList = list.map((l) => `"${l}"`).join(', ')
  const conceptPrompt =
    `Professional real-world macro product photography of the actual ingredients named in the script: ${list.join(', ')}. ` +
    `Show EACH ingredient in its REAL physical form (powder pile / liquid drops / raw plant / seeds / capsule contents — whatever it truly is) ` +
    `arranged side by side on a clean neutral surface, soft natural daylight, sharp focus, shallow depth of field. ` +
    `Real photographs of the real materials — NOT hand-drawn, NOT cartoon, NOT icons.` +
    `\n\nTEXT TO RENDER IN THE IMAGE — print these exact words as big, clear, correctly-spelled labels next to each ingredient: ${labelList}. ` +
    `Do NOT translate or alter them. These labels MUST be visible and legible.`

  const scene: InsertSuggestion = {
    presetId: 'CONCEPT_SCENE' as ActionPresetId,
    matchCount: 0,
    matchedBlocks: bestBlock ? [bestBlock] : [],
    matchedKeywords: [],
    anchorBlock: bestBlock ?? 'benefit',
    confidence: 0.9,  // high → survives the coverage cap if one runs
    reason: 'Thành phần sản phẩm (tự thêm — script có nhắc, đảm bảo cảnh thành phần)',
    conceptPrompt,
    durationSec: 4,
    quote: bestQuote,
    renderMode: 'ken_burns',     // static image (Z76) → overlay (Z77)
    layout: 'overlay_corner',
  }

  // Insert within budget. If at/over budget, replace the lowest-confidence
  // existing scene so the guarantee holds without exceeding the budget.
  if (out.length >= budget) {
    let lowIdx = -1
    let lowConf = Infinity
    out.forEach((s, i) => { if (s.confidence < lowConf) { lowConf = s.confidence; lowIdx = i } })
    if (lowIdx >= 0) out.splice(lowIdx, 1, scene)
    else out.push(scene)
  } else {
    out.push(scene)
  }
  return 1
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
  // Z42/Z44/Z45/Z60/Z81 — free duration, bounded by render mode:
  //   • ken_burns (static image) → 2-4s. A still held for 7-8s is boring; keep
  //     it short and split dense ideas into more cuts.
  //   • video (Grok i2v) → 3-4s. Z81: capped at 4s (was 6s) — the user found
  //     6s cuts "dài lê thê" (draggy). 3-4s reads as a snappy beat; the Grok
  //     clip is 6s but the assembler trims it to this window.
  const isKenBurns = presetId === 'CONCEPT_SCENE' && renderMode !== 'video'
  const n = Number(v)
  if (isKenBurns) {
    if (!Number.isFinite(n)) return 3.5
    return Math.max(2, Math.min(4, Math.round(n * 10) / 10))
  }
  // video mode — max 4s (was 6s)
  if (!Number.isFinite(n)) return 4
  return Math.max(3, Math.min(4, Math.round(n * 10) / 10))
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
  /** Z56 — explicit short text labels to print on a graphic concept scene
   *  (ingredient names, "5x", core term). Structured field so the Director
   *  can't bury/drop them in prose; appended to conceptPrompt as a hard
   *  "render this text" instruction at parse time. */
  labels?: string[]
  /** Z69 — full-screen cut vs corner overlay. */
  layout?: 'cut' | 'overlay_corner'
}

function parseDirectorOutput(raw: string): { scenes: RawDirectorScene[]; ingredientsInScript: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Z90 — SALVAGE. Gemini 2.5-flash sometimes rambles/repeats until it hits
      // the output-token cap, so the JSON is TRUNCATED mid-array (the whole
      // response then fails JSON.parse → parsed=0 → weak keyword fallback). This
      // happened on the nasal-spray product (raw=67068ch). Instead of throwing
      // the whole thing away, walk the "scenes" array and recover every COMPLETE
      // {...} object from the start — works for ANY product/niche.
      const scenes = salvageScenes(raw)
      if (scenes.length > 0) {
        console.warn(`[DIRECTOR] JSON truncated (${raw.length}ch) — salvaged ${scenes.length} complete scenes`)
        return { scenes, ingredientsInScript: [] }
      }
      return { scenes: [], ingredientsInScript: [] }
    }
  }
  const obj = parsed as { scenes?: unknown; ingredientsInScript?: unknown }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.scenes)) {
    return { scenes: [], ingredientsInScript: [] }
  }
  const ingredientsInScript = Array.isArray(obj.ingredientsInScript)
    ? (obj.ingredientsInScript as unknown[]).map((x) => String(x).trim()).filter((x) => x.length >= 2 && x.length <= 50)
    : []
  return { scenes: obj.scenes as RawDirectorScene[], ingredientsInScript }
}

// Z90 — recover complete scene objects from a TRUNCATED Director JSON. Finds the
// "scenes" array, then walks it extracting balanced {...} objects (string-aware
// so braces inside quoted text don't confuse it) and JSON.parse-ing each. Stops
// at the first incomplete object (the truncation point). Universal — no
// product-specific assumptions.
function salvageScenes(raw: string): RawDirectorScene[] {
  const key = raw.indexOf('"scenes"')
  if (key < 0) return []
  const arrStart = raw.indexOf('[', key)
  if (arrStart < 0) return []
  const out: RawDirectorScene[] = []
  let i = arrStart + 1
  while (i < raw.length) {
    while (i < raw.length && raw[i] !== '{' && raw[i] !== ']') i++
    if (i >= raw.length || raw[i] === ']') break
    const objStart = i
    let depth = 0
    let inStr = false
    let esc = false
    let closed = false
    for (; i < raw.length; i++) {
      const c = raw[i]
      if (esc) { esc = false; continue }
      if (c === '\\') { esc = true; continue }
      if (c === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (c === '{') depth++
      else if (c === '}') { depth--; if (depth === 0) { i++; closed = true; break } }
    }
    if (!closed) break  // truncated mid-object → stop
    try {
      out.push(JSON.parse(raw.slice(objStart, i)) as RawDirectorScene)
    } catch { /* skip a malformed object, keep going */ }
  }
  return out
}

