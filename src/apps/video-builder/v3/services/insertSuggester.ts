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
  // Z80: DENSER (~1 insert per ~4.5s, was 6.5) now that overlays are free +
  // additive (don't hide the creator) and the budget ceiling is 12 — gives the
  // Director room for a rich mix of cuts + overlays. → 55s ≈ 12, 45s ≈ 10,
  // 30s ≈ 7, 18s ≈ 4 — clamped to the cost-mode [floor, budget]. effFloor =
  // target − 1 nudges Gemini to actually reach the target.
  const baseFloor = Math.max(1, Math.min(params.floor ?? 3, params.budget))
  const durTarget = Math.round((params.script.totalDurationSec || 30) / 4.5)
  const effBudget = Math.max(baseFloor, Math.min(params.budget, durTarget))
  const effFloor = Math.max(baseFloor, effBudget - 1)
  const floor = effFloor  // template references `${floor}` → the duration-aware target
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
- CREATOR-FIRST RULE — the viewer needs to SEE the speaker's face early to
  trust the ad. The FIRST insert MUST NOT start before t≈3s of voice — let the
  viewer see the talking creator first. Practical translation: when you anchor
  scenes, the earliest scene (whichever quote starts the earliest) should be
  illustrating a line that arrives roughly 3+ seconds in, NOT the very first
  words of the hook. Reserve the opening seconds for the creator's face.
  Also: NEVER stack 3+ consecutive inserts that all replace the creator —
  the viewer will lose track of who is speaking. Break long stretches of
  illustration with at least one beat where ONLY the creator is on screen
  (i.e. skip an insert there).
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
    • POWDERS / solids: a small pile or scoop (charcoal = black powder,
      volcanic ash = grey powder, matcha = green powder, turmeric = orange,
      collagen = white powder, cocoa = brown, salt = white crystals).
    • LIQUIDS / oils / extracts: a few drops or a small clear glass jar (rose
      water = clear pink, vitamin C serum = golden drops, fish oil = amber,
      argan oil = yellow, milk = white).
    • PLANT / fruit / seed / herb: the raw ingredient itself (grape seeds,
      green tea leaves, ginseng root, aloe leaf, lavender sprigs, hyaluronic
      acid molecule on a glass slide).
    • CAPSULE / pearl ingredients: a few capsules / softgels cut open showing
      the contents next to whole ones.
    • MINERAL / chemical actives (niacinamide, retinol, hyaluronic, salicylic):
      a clean lab-style drop on glass / a small clear vial labeled in the
      script language.
  Use whatever the script names. Labels in the script language, placed cleanly
  next to the ingredient (not floating). Two ingredients in the line → both
  shown side-by-side with their respective real forms + labels.
  Reserve hand-drawn doodle style for non-ingredient teaching: MECHANISM /
  how-it-works diagrams / "Nx more effective" claims / benefit-breakdowns,
  where a real photo can't represent the idea.
- CONCEPT ART-STYLE RULE (for "graphic" CONCEPT_SCENE only) — bake the art
  direction INTO the conceptPrompt. There are THREE looks; pick per scene:
  (0) REAL-WORLD PHOTO — for INGREDIENT scenes (see "INGREDIENT STYLE" rule
      above). NOT hand-drawn — real macro photography of the actual ingredient.
  (1) SIMPLE HAND-DRAWN VISUAL — use this for MECHANISM / how-it-works
      diagrams, "X times more effective" claims, benefit breakdowns, abstract
      teaching where a real photo doesn't apply. Write the conceptPrompt as:
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
          *** CRITICAL: even when the PRODUCT NAME contains English words ***
          (e.g. "Knee Support Booster", "Brightening Serum"), THE LABELS STILL
          MUST BE IN ${langName}. The product NAME stays English (it's a brand);
          the LABELS on a teaching graphic are concepts and must be translated:
            • English product "Knee Support Booster" → labels in VN: "Khớp gối",
              "Áp lực", "Lò xo nâng đỡ" — NOT "knee joint", "pressure", "springs".
            • English product "Brightening Serum" → labels in VN: "Da xỉn",
              "Tinh chất", "Sáng mịn" — NOT "dull skin", "serum", "brightening".
          Take the term straight from the ${langName} quote that the scene
          illustrates — that quote IS in the script language; mirror it.
          (Ingredient names that ARE the brand of the active substance — e.g.
          "Activated Charcoal", "Niacinamide" — may stay in their original
          chemical form if the ${langName} script writes them that way.)
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
- VISUAL VARIETY — do NOT make every graphic scene the same "cartoon tooth in
  the centre with a label". A run of 5 near-identical illustrations feels like a
  boring slideshow. Vary EACH scene so the eye keeps moving:
    • Change the SUBJECT focus: sometimes the ingredient itself (charcoal chunk,
      volcanic rock, grape) as the hero, sometimes a tooth, sometimes a hand /
      mouth / gum close-up, sometimes an abstract motion (particles, sparkles).
    • Change the FRAMING / ANGLE: extreme macro, side angle, top-down, wide,
      split — not always a flat centred front view.
    • BALANCE illustration with reality: an all-cartoon B-roll set looks fake.
      Across the whole ad, mix the hand-drawn teaching scenes with REAL-footage
      scenes (emotion reactions, the product in use, before/after) so it does
      not become a cartoon slideshow. Aim for roughly half illustration, half
      real footage when the script allows.
- Group sentences describing the SAME idea into ONE scene; don't cut every line.
- Duration is FREE per scene — YOU decide based on how much dialogue it covers.
  But mind the render mode:
    • ken_burns concept stills → 2-4s (short; split dense ideas into more cuts).
    • VIDEO inserts (any product preset, PRODUCT_IN_ACTION, or emotion
      CONCEPT_SCENE) → 3-4s, MAX 4s. A 6s cut drags ("dài lê thê") and breaks
      TikTok pacing — keep every video beat punchy at 3-4s. Use MORE short cuts
      rather than fewer long ones.
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
- LAYOUT RULE — for EVERY scene, pick a "layout":
    • "cut" → the insert REPLACES the creator video full-screen for its window.
      Use for high-impact beats: HOOK reveal, PAIN raw shot, CTA trust close,
      product DEMO (PRODUCT_IN_ACTION), visible BEFORE/AFTER, emotion
      CONCEPT_SCENE that needs full focus.
    • "overlay_corner" → the insert sits as a corner PIP (~30% of the frame)
      while the CREATOR keeps talking full-screen behind it. Use for SUPPORTING
      illustrations the viewer should glance at without losing the speaker:
      teaching graphic CONCEPT_SCENE (ingredient sketches, mechanism diagrams,
      "Nx more effective" labels), small product close-ups during explanation.
  Rule of thumb: if the scene is the MAIN thing on screen at that moment, "cut";
  if the scene is a SUPPORTING aside while the creator is the focus, "overlay_corner".
  DEFAULT POLICY (the engine enforces this): every illustration / infographic /
  ingredient / mechanism graphic CONCEPT_SCENE → "overlay_corner" (it rides over
  the talking creator so the ad stays continuous and lively). Reserve "cut" for
  the few high-impact beats that deserve the full screen: HOOK reveal, PAIN raw
  shot, product DEMO (PRODUCT_IN_ACTION), visible BEFORE/AFTER, and the CTA trust
  close. So a finished ad is mostly creator-with-overlays, punctuated by a few
  full-screen cuts — NOT a slideshow of back-to-back cuts.
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
- SCENE COUNT — you MUST return ${effBudget} scenes (this number is matched to
  the script length; a ${Math.round((params.script.totalDurationSec || 30))}s
  script easily supports ${effBudget} distinct supporting visuals). Returning
  fewer than ${floor} is WRONG — the ad will feel flat. To reach ${effBudget},
  give EACH of these its own scene instead of grouping: every named ingredient,
  every distinct benefit, every claim/number, every pain point, every emotional
  turn, the hook, the demo, and the CTA. More short scenes > fewer long ones.
- SCENE MIX — split those ${effBudget} scenes roughly HALF and HALF:
    • ~half = real-footage VIDEO scenes that REPLACE the creator full-screen
      (cut): the person/product in action — HOLD_PRODUCT, PRODUCT_IN_ACTION
      (brushing / applying / using), the BEFORE/AFTER, the CTA hold. These carry
      the realism + product trust.
    • ~half = illustration IMAGE scenes that OVERLAY on the talking creator
      (overlay_corner): infographic / ingredient photo / mechanism / "Nx" claim
      graphic CONCEPT_SCENEs. These add the teaching + the lively pop-ups while
      the creator keeps talking.
  A pure-cut ad is a slideshow; a pure-overlay ad has no product realism. Mix.
- "fit" = 0..1 how strongly the visual supports the line. "reason" = one short
  phrase in ${langName} explaining the choice (shown to the user).

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
  // 16384 fits 12 verbose scenes so the full list parses.
  const raw = await directGeminiText({
    apiKey: params.geminiKey,
    systemInstruction,
    prompt: userPrompt,
    maxOutputTokens: 16384,
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
  const rewrite = { beforeAfter: 0, topical: 0, dupeSwap: 0, labeled: 0, labelLangDrop: 0 }

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
      // Z74 — was 'graphic' (generic anatomy split, no person). Now 'emotion'
      // so the keyframe builder anchors the scene to the AVATAR ref → the
      // BEFORE and AFTER halves both show the SAME creator (not random
      // anatomy), with the BEFORE state visibly impaired and the AFTER state
      // visibly recovered. Authentic before/after = same person across both.
      motionKind = 'emotion'
      conceptPrompt = conceptPrompt.length > 0 ? conceptPrompt :
        `Split-screen of THE SAME PERSON (from the avatar reference) shown in two ` +
        `clearly contrasting states, illustrating the line "${quote}": LEFT half = ` +
        `the BEFORE state showing the visible problem the script names (yellow ` +
        `stained teeth / acne-prone skin / thinning hair / stiff painful joint — ` +
        `whatever the script promises will improve), with matching subdued ` +
        `posture and dim cool light. RIGHT half = the SAME person in the AFTER ` +
        `state with the problem clearly resolved (white teeth / clear glowing ` +
        `skin / fuller hair / relaxed easy posture), confident smile, warm ` +
        `bright light. Identical face, hair, outfit — only the named body-part ` +
        `change + the emotion + the light differ. The two halves MUST look ` +
        `unmistakably different in the named area at a glance.`
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
      isStaticIllustration ? 'overlay_corner' : (directorLayout ?? 'cut')
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
  // (2) CUT coverage cap — only CUTS hide the creator, so only CUTS count.
  const voiceDur = params.script.totalDurationSec
  if (voiceDur && voiceDur > 0) {
    const isCut = (x: InsertSuggestion) => x.layout !== 'overlay_corner'
    const cap = voiceDur * 0.5  // ≤50% of the ad may hide the creator
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
  console.log(
    `[DIRECTOR] raw=${raw.length}ch parsed=${parsed.length} usable=${out.length} ` +
    `dropped{preset:${drop.preset},noPrompt:${drop.noPrompt},zeroFit:${drop.zeroFit},dupeSkip:${drop.dupeSkip}} ` +
    `rewrote{beforeAfter:${rewrite.beforeAfter},topical:${rewrite.topical},dupeSwap:${rewrite.dupeSwap},labeled:${rewrite.labeled},labelLangDrop:${rewrite.labelLangDrop}} ` +
    `trust{earlyHook:${trustDrops.earlyHook},coverage:${trustDrops.coverage},run3:${trustDrops.run3}} ` +
    `ingredientInject=${ingredientInjected} ` +
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
