// ── B-roll Director (HYBRID mode) ────────────────────────────────────────────
// The NEW director for the hybrid rebuild. Unlike the frozen mode-1 director
// (directScenesWithGemini), there is NO continuous talking-head base: the whole
// ${dur}s voice is covered by a SEQUENCE of full-screen cuts —
//   • a few short LIPS cuts (the creator on camera, lip-synced to that span),
//   • B-ROLL cuts (product-in-use / close-up / concept, often no-face),
//   • 3D MECHANISM cuts (how it works inside),
// plus 0-credit STICKER pops for short text/number callouts (replacing overlays).
//
// Design (per the agreed plan):
//   • COVER 100% of the timeline — every spoken line gets a visual, NO gaps.
//   • LIPS placement: a fixed count by length (3/<50s, 4/<60s, 5/<70s), the FIRST
//     within the opening third (so the hook is a face — never a 19s empty open),
//     then spread (a mid beat + the CTA) to keep the creator's trust-thread.
//   • NO overlays, NO hand-drawn graphics — callouts become stickers (incl. LIST).
//   • KEEP 3D mechanism.
//   • Universal: the setting/usage is INFERRED from the product context, never
//     hardcoded per niche.
//
// REUSE (read-only import, not modified): buildProductContextBlock,
// detectProductNiche from insertSuggester. The mode-1 director is NOT touched.
// This module is plan-only — it does NOT render; the assembler/render is Phase 3.
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import { SCRIPT_LANG_GEMINI_NAME } from '../types'
import type { GeneratedScript, ScriptLang, CameraFraming, VoiceAlignment } from '../types'
import type { Product } from '../../../../stores/types'
import { buildProductContextBlock, detectProductNiche } from './insertSuggester'
import { computeQuoteTimestampFromAlignment, computeQuoteTimestamp } from './insertTimingEngine'
import { buildShapeDirectorHint } from './scriptShapes'

// ── Output types ────────────────────────────────────────────────────────────

export type BrollSceneRole = 'lips' | 'broll' | 'mechanism3d'
export type BrollSceneKind = 'product_action' | 'product_closeup' | 'concept'

export interface BrollScene {
  /** lips = creator on camera (lip-synced); broll = product/concept cut;
   *  mechanism3d = clean 3D internal animation. */
  role: BrollSceneRole
  /** The verbatim spoken line this cut covers (anchor — drives voice sync). */
  quote: string
  /** Cut length (3-6s, flexible for pacing). */
  durationSec: number
  /** broll/3d only — the vivid English visual prompt (action + setting). */
  conceptPrompt?: string
  /** broll only — face vs no-face framing (reused from the D1-D3 capability). */
  cameraFraming?: CameraFraming
  /** broll only — which kind of B-roll shot. */
  kind?: BrollSceneKind
  /** one short phrase explaining the choice (debug / UI). */
  reason?: string
}

export interface BrollSticker {
  style: string
  /** single-line callout (when not a list) */
  text?: string
  /** LIST sticker — multiple stacked items (replaces the old multi-row overlay). */
  items?: string[]
  /** the spoken line this sticker rides on */
  quote: string
  /** the word within the quote to pop on */
  wordAnchor?: string
}

export interface BrollDirectorResult {
  scenes: BrollScene[]
  stickers: BrollSticker[]
}

export interface BrollDirectorParams {
  geminiKey: string
  script: GeneratedScript
  lang: ScriptLang
  product?: Product | null
  /** Real measured voice duration (preferred) — the timeline length to cover. */
  voiceDurationSec: number
  /** P3q — body shape (narrative / listicle / comparison / journey). When
   *  non-narrative, a SHAPE HINT block is injected into the director prompt so
   *  scene types (split-screen, date stamps, numbered closeups) match the body.
   *  Omit → 'narrative' (no hint). */
  shape?: import('../types').ScriptShape
}

// ── Lips count ladder (user spec — NOT a niche hardcode) ────────────────────
function lipsCountForDuration(sec: number): number {
  if (sec < 50) return 3
  if (sec < 60) return 4
  if (sec < 70) return 5
  return 6
}

// ── Density floor (deterministic) ───────────────────────────────────────────
// Gemini is non-deterministic about scene COUNT: the same script can come back
// as 8 sparse cuts one run and 14 the next. A sparse plan stretched over the
// whole voice yields long, flat ~6s holds that feel slow. We enforce a minimum
// cut density two ways: (1) RE-ROLL the director ONCE if the first plan is sparse,
// and (2) a hard post-timing floor that splits the LONGEST cuts until the floor
// is met — splitting longest-first keeps the short snappy cuts intact (variety),
// never a uniform metronome. ~5s/cut → a 60s ad floors at ~12 cuts (12-15 is the
// natural UGC ad rhythm — earlier 4.5s/cut floor produced 18 cuts that felt frantic).
// P3t — relaxed pacing: was 5.0s/cut (12 cuts/60s floor 8). The user audited
// this as "frantic + forces 1 sentence = 1 cut". A 6s average lets ideas
// breathe (10 cuts/60s) and matches the "1 idea = 1 cut, group short sentences"
// flexibility the user wants. Small-video floor also drops 8 → 6 so a 40s ad
// doesn't get padded to 8 cuts.
const TARGET_AVG_CUT_SEC = 6.0
function densityFloor(dur: number): number {
  return Math.max(6, Math.round(dur / TARGET_AVG_CUT_SEC))
}

// ── Gemini response schema ──────────────────────────────────────────────────
const BROLL_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role:          { type: 'string', enum: ['lips', 'broll', 'mechanism3d'] },
          quote:         { type: 'string', maxLength: 200 },
          durationSec:   { type: 'number' },
          conceptPrompt: { type: 'string', maxLength: 240 },
          cameraFraming: { type: 'string', enum: ['creator', 'hands_noface'] },
          kind:          { type: 'string', enum: ['product_action', 'product_closeup', 'concept'] },
          reason:        { type: 'string', maxLength: 80 },
        },
        required: ['role', 'quote', 'durationSec'],
      },
    },
    stickers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          style:      { type: 'string', enum: ['number', 'countdown', 'pill', 'flag', 'badge', 'warning', 'price', 'highlight', 'arrow', 'list'] },
          text:       { type: 'string', maxLength: 24 },
          items:      { type: 'array', items: { type: 'string', maxLength: 24 } },
          quote:      { type: 'string', maxLength: 200 },
          wordAnchor: { type: 'string', maxLength: 40 },
        },
        required: ['style', 'quote'],
      },
    },
  },
  required: ['scenes'],
}

// ── Concept-prompt guarantee (P4e) ──────────────────────────────────────────
// Universal 3-layer defense so EVERY non-lips scene renders a grounded visual —
// never a silent generic "product close-up". Layer 1 = the director prompt asks
// for it. Layer 2 = backfillWeakConcepts (1 Gemini call fills the missing/vague
// ones). Layer 3 = deriveConceptPrompt (deterministic last-resort, role/kind
// aware). Both helpers are exported + reused by hybridRenderer (Layer 3 runs at
// render time to also cover the deterministic filler cuts that split/density
// add later, which carry no conceptPrompt).

/** A conceptPrompt is "weak" when it's empty, a stub, or a generic placeholder
 *  that tells the video model nothing specific ("close-up of the product"). */
export function isWeakConceptPrompt(cp: string | undefined): boolean {
  const t = (cp ?? '').trim()
  if (t.length < 18) return true
  if (t.split(/\s+/).filter(Boolean).length < 4) return true
  const lower = t.toLowerCase()
  if (/^(close[- ]?up of (the )?product\b|the product\b|product (shot|on)\b|a product\b|sản phẩm\b)/.test(lower)) return true
  return false
}

/** Deterministic, UNIVERSAL last-resort conceptPrompt from a scene's role/kind +
 *  the product's real usage. No niche hardcode — keys off role/kind + the
 *  detected usage so it's correct for food / skincare / device / 3D / emotion
 *  alike. Used only when Layer 2 (Gemini) didn't fill the scene (e.g. the
 *  deterministic filler cuts from split/density, or a backfill rate-limit). */
export function deriveConceptPrompt(args: {
  role: string; kind?: string; cameraFraming?: string; product?: Product | null
}): string {
  if (args.role === 'mechanism3d') {
    return 'a clean cross-section / macro showing how the product works on the inside, soft studio light, no people, no packaging'
  }
  if (args.kind === 'concept' && args.cameraFraming === 'creator') {
    return 'a real person with an authentic, natural facial expression and body language reacting in the moment, candid UGC, soft natural light, no product packaging'
  }
  if (args.kind === 'concept') {
    return 'a real-world everyday moment that illustrates the idea, natural light, authentic UGC, no product packaging'
  }
  const name = args.product?.productName?.trim() || 'the product'
  const usage = args.product ? detectProductNiche(args.product)?.usage : null
  return `hands holding and naturally using ${name}${usage ? ` — ${usage}` : ''}, shown close-up in its real-world setting, authentic UGC iPhone footage, natural light`
}

/** Layer 2 — one targeted Gemini call to write a vivid conceptPrompt for every
 *  scene the director left empty / vague. Mutates `scenes` in place. Graceful:
 *  any failure leaves them for Layer 3 (deriveConceptPrompt) to backstop. */
async function backfillWeakConcepts(
  scenes: BrollScene[], product: Product | null | undefined, apiKey: string,
): Promise<void> {
  const weak = scenes
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => (s.role === 'broll' || s.role === 'mechanism3d') && isWeakConceptPrompt(s.conceptPrompt))
  if (weak.length === 0) return
  const productContext = buildProductContextBlock(product)
  const list = weak
    .map(({ s }, n) => `${n + 1}. role=${s.role}${s.kind ? `/${s.kind}` : ''}${s.cameraFraming ? `/${s.cameraFraming}` : ''} | câu thoại: "${s.quote}"`)
    .join('\n')
  const systemInstruction =
`You are a UGC ad video DIRECTOR. For each scene below, write ONE vivid English conceptPrompt — the literal instruction a video model renders — grounded in the PRODUCT + that scene's spoken quote.${productContext}

Each conceptPrompt MUST specify: SHOT TYPE (macro / wide / over-the-shoulder / POV-hands / top-down) + a concrete ACTION + WHICH PART of the subject + a real SETTING. Make each DISTINCT (no two the same shot).
By role:
- broll + product_action / product_closeup → the PRODUCT on screen doing a concrete action (break / pour / apply / hold up / use), in its real setting. The line tells you what to show.
- broll + concept + creator → a PERSON with an authentic expression / reaction (NO product packaging).
- broll + concept (no creator) → a real-world moment illustrating the line (NO product packaging).
- mechanism3d → the internal mechanism as a clean 3D cross-section / macro (NO people, NO packaging).
UNIVERSAL — infer the action + setting from the product context; NEVER assume a niche.

OUTPUT exactly ${weak.length} lines, ONE conceptPrompt per line, SAME order, no numbering, no quotes, no commentary.`
  const prompt = `Write a conceptPrompt for each scene (write in English):\n${list}\n\nOutput ${weak.length} lines, one per line, same order.`
  try {
    const raw = await directGeminiText({
      apiKey, systemInstruction, prompt, maxOutputTokens: 1536, temperature: 0.7, thinkingBudget: 0,
    })
    const lines = raw.split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').replace(/^["'“”\-•]+|["'“”]+$/g, '').trim()).filter(Boolean)
    weak.forEach(({ i }, n) => { if (lines[n] && !isWeakConceptPrompt(lines[n])) scenes[i].conceptPrompt = lines[n] })
    // eslint-disable-next-line no-console
    console.log(`[BROLL_DIRECTOR] backfill ${Math.min(lines.length, weak.length)}/${weak.length} conceptPrompt rỗng/yếu`)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[BROLL_DIRECTOR] backfill concept lỗi (để Layer 3 lo):', e)
  }
}

/** P4g — POST-TIMING "director's brain" for the deterministic FILLER cuts that
 *  split/density create AFTER backfillWeakConcepts already ran (lips-overflow
 *  halves, density splits of a lips cut). Those carry a REAL spoken line but no
 *  conceptPrompt — and the main backfill never saw them (they didn't exist yet).
 *  Without this, a rich emotional line ("cả nhà khỏe luôn", "mùi thơm tự nhiên")
 *  renders as a generic product shot — the exact "đạo diễn show sản phẩm" bug.
 *  This reads each line's MEANING and decides TYPE (human moment vs product shot)
 *  + writes a grounded conceptPrompt, fixing kind + cameraFraming to match. ONE
 *  Gemini call, mutates in place, graceful (leaves the deterministic concept+
 *  creator floor for Layer 3 on failure). Run on the FINAL timed scene list. */
export async function groundOrphanScenes(
  scenes: BrollScene[], product: Product | null | undefined, apiKey: string,
): Promise<void> {
  const orphans = scenes
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.role === 'broll' && isWeakConceptPrompt(s.conceptPrompt))
  if (orphans.length === 0) return
  const productContext = buildProductContextBlock(product)
  const list = orphans.map(({ s }, n) => `${n + 1}. câu thoại: "${s.quote}"`).join('\n')
  const systemInstruction =
`You are a UGC ad video DIRECTOR with a real director's brain. Each scene below is a
spoken line that still needs a VISUAL. For EACH line: READ ITS MEANING, picture the
real-life moment + the person's EMOTION it implies, and decide how to film it — like
the garlic-salt rule (a "tastes great" line is someone tasting a bite with a happy
face, NOT a static jar shot).${productContext}

For each line output ONE line in EXACTLY this format:
TYPE | conceptPrompt
where TYPE is one of:
- "human"   → the line is about a FEELING, a RESULT, an EXPERIENCE, or a real-life
  MOMENT that lands on a PERSON (tasting and enjoying, a family sharing a meal,
  waking up refreshed, a relieved smile, confidence in the mirror). conceptPrompt =
  a person / people in that authentic candid moment, NO product packaging in frame.
- "product" → the line is about the PRODUCT itself, a feature, a spec, an ingredient,
  or the product being USED. conceptPrompt = the product doing a concrete action
  (hands using / pouring / sprinkling / holding it) in its real setting.
conceptPrompt rules: ONE vivid English sentence — SHOT TYPE (macro / wide / POV-hands
/ over-the-shoulder / top-down) + a concrete ACTION + a real SETTING, grounded in the
product + THIS exact line. Make each DISTINCT. NEVER abstract ("show the benefit") —
always a filmable moment. UNIVERSAL — infer from the product context; never assume a
niche.

OUTPUT exactly ${orphans.length} lines, SAME order, each "TYPE | conceptPrompt",
no numbering, no quotes, no extra commentary.`
  const prompt = `Direct each line (output "TYPE | conceptPrompt", conceptPrompt in English):\n${list}\n\nOutput ${orphans.length} lines, same order.`
  try {
    const raw = await directGeminiText({
      apiKey, systemInstruction, prompt, maxOutputTokens: 1536, temperature: 0.7, thinkingBudget: 0,
    })
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
    let applied = 0
    orphans.forEach(({ i }, n) => {
      const ln = lines[n]
      if (!ln) return
      const sep = ln.indexOf('|')
      const type = (sep >= 0 ? ln.slice(0, sep) : '').toLowerCase()
      const cp = (sep >= 0 ? ln.slice(sep + 1) : ln).replace(/^["'“”\-•\s]+|["'“”\s]+$/g, '').trim()
      if (!cp || isWeakConceptPrompt(cp)) return
      scenes[i].conceptPrompt = cp
      // Re-direct kind + framing to match the line's MEANING (the mechanical
      // splitter's product_closeup/concept guess is overridden by the brain).
      if (type.includes('product')) { scenes[i].kind = 'product_action'; scenes[i].cameraFraming = 'hands_noface' }
      else { scenes[i].kind = 'concept'; scenes[i].cameraFraming = 'creator' }
      applied++
    })
    // eslint-disable-next-line no-console
    console.log(`[BROLL_DIRECTOR] ground orphan ${applied}/${orphans.length} cảnh filler (đọc nghĩa câu)`)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[BROLL_DIRECTOR] ground orphan lỗi (để Layer 3 lo):', e)
  }
}

// ── Public: plan a full-coverage hybrid shot list ───────────────────────────
export async function directBrollScenes(
  params: BrollDirectorParams,
): Promise<BrollDirectorResult> {
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang]
  const dur = Math.round(params.voiceDurationSec || params.script.totalDurationSec || 50)
  const lipsCount = lipsCountForDuration(dur)
  const minScenes = densityFloor(dur)
  const productContext = buildProductContextBlock(params.product)
  const scriptDump = params.script.blocks.map((b) => `[${b.id}] ${b.text}`).join('\n')
  // P3q — shape hint (empty for 'narrative', the previous default).
  const shapeHint = params.shape ? buildShapeDirectorHint(params.shape) : ''
  // P3o — when the script targets Malaysia, ground the scene SETTING in real
  // Malaysian visual culture so conceptPrompts stop defaulting to "generic
  // Asian office / generic bedroom". The user-curated MS daily contexts
  // ("aircond semalaman", "lunch break dekat office", "balik kerja", "musim
  // hujan") only carry weight if the director knows what those LOOK like.
  const culturalSettingBlock = params.lang === 'ms' ? `
MALAYSIAN VISUAL CULTURE (this script targets Malaysia — every conceptPrompt
should look like a real Malaysian creator filmed it, NOT a generic Asian setting):
- LIGHTING: warm tropical daylight, soft natural shadows; midday sunlight through
  window blinds; the warm yellow of "balik kerja jam 6-7 petang"; occasional
  monsoon-rain look ("musim hujan") for moody beats.
- LOCATIONS (pick what fits the script's point-of-contact moment): a Malaysian
  apartment / landed-house bedroom (often with a ceiling fan + a window aircond
  unit visible); a small home kitchen with rice cooker + electric kettle on the
  counter; a KL/PJ open-plan office with mixed-race coworkers; a kopitiam (kopi
  + roti); a mamak with steel tables + plastic chairs; a food court (KL eatery);
  a Grab car interior; LRT / commuter rail; a residential gym; an HDB-style
  corridor; a wet market; a Mydin / 99 Speedmart aisle for the buying beat.
- PEOPLE: Malaysian Gen Z / millennial casual wear — t-shirt + shorts at home,
  smart-casual at office. Cast mixed race naturally (Malay / Chinese / Indian);
  if visibly Malay, modest dress (sleeves, optional tudung) — never force tudung
  but never put a Malay-coded creator in revealing clothes.
- FOOD CUES (only when script names food / kitchen / breakfast moments): nasi
  lemak, roti canai, kopi-O, milo dinosaur, kuih, biskut Raya — universal MY
  food iconography.
- AVOID (these break the Malaysian feel): snow / winter / autumn leaves;
  fully-Western European suburbs / brownstones; pork in frame; alcohol bottles
  in frame; formal Hollywood-corporate suits + ties (MY office is smart-casual).
- SPECIFIC TRANSLATIONS for daily-context cues the body script likes to use:
  • "aircond semalaman" / "bangun pagi" → bed with ceiling fan + window aircon
    unit; creator stretches / rubs eyes in morning warm light.
  • "lunch break dekat office" → mamak or food court with creator's phone on the
    table + a plate (nasi campur / mee) + a teh tarik.
  • "balik kerja" → Grab car interior at dusk / LRT carriage / parking lot of a
    PJ shopping mall.
  • "weekend" → kopitiam / mall / home couch with TV.
  • "musim hujan" → exterior shot through a window with rain streaks.
` : ''

  const systemInstruction = `You are a senior UGC ad video DIRECTOR cutting a ${dur}-second TikTok ad written
in ${langName}. There is NO continuous talking-head — you build the WHOLE video as
a SEQUENCE of full-screen cuts that together COVER EVERY SECOND of the voice, with
NO gaps and no dead air. Read the actual script + the product, and direct like a
real creator. The product can be ANYTHING (gadget, tool, cosmetic, food, apparel,
appliance, accessory…) — never assume a niche.${productContext}

THREE cut ROLES (set "role"):
1. "lips" — the creator ON CAMERA saying a specific line (face visible, will be
   lip-synced to that exact voice span). Give the "quote" (verbatim spoken line) — a
   lips cut is a SHORT line (~3-5s of speech). NO conceptPrompt needed.
   *** Use EXACTLY ${lipsCount} lips cuts. The FIRST is the opening HOOK (the viewer
   must see a real face in the first ~3s or they scroll). SPREAD the rest through the
   MIDDLE so the creator's face re-appears and carries the trust thread — but the very
   last CTA/buy line is NOT a lips cut (it is the product-endorsement shot, see RULES). ***
2. "broll" — a full-screen product/concept cut, usually NO face. Write a vivid
   "conceptPrompt" (one English sentence: action + real-world SETTING) and set:
     • "kind" — pick what the LINE actually calls for:
       - "product_action" (the BACKBONE — the product being USED in its real
         setting; infer WHERE/HOW from the product's usageGuide/description) or
         "product_closeup" (a clean close-up of the product / a feature / texture /
         result). Most cuts are these — ground spec / ingredient / how-it-works
         lines in a real product shot, never an abstract drawing.
       - "concept" (NO product on screen) — USE IT, do not avoid it, whenever the
         line is about a FEELING, a RESULT, an EXPERIENCE, or a real-life MOMENT
         that lands harder on a PERSON or a scene than on the packaging. A real
         ad cuts to the human payoff — set cameraFraming:"creator" for these.
         Universal across niches (read the product, infer the moment):
           · food → someone tasting a bite, eyes lighting up, satisfied nod
           · skincare/beauty → touching freshly-clean skin in the mirror, quiet smile
           · supplement/health → waking up easy, stretching, light and energetic
           · apparel → spinning in the outfit, confident in the mirror
           · gadget/tool → the relieved "finally, done in seconds" reaction
           · home/clean → stepping back to admire the spotless result
         Do NOT force the product into a beat that is purely about how it FEELS.
     • "cameraFraming": "hands_noface" (only hands + product in its setting, NO
       face — use GENEROUSLY for usage/demo) or "creator" (a person / reaction /
       emotion — use for the human payoff beats above).
   ⚠ conceptPrompt is REQUIRED + DISTINCT for EVERY broll. This is the SINGLE most
   important thing you write — it is the literal instruction the video model
   renders. A weak / vague / repeated conceptPrompt is why an ad looks like the
   same shot over and over. EACH conceptPrompt MUST specify ALL of:
     (1) SHOT TYPE — macro close-up / wide / over-the-shoulder / POV-hands /
         top-down flat-lay / slow push-in. VARY it across scenes.
     (2) ACTION — the concrete thing happening this second (break / pour / dip /
         scoop / sprinkle / wipe / hold up / bite / press / unwrap). A real verb,
         not "show the product".
     (3) WHICH PART of the product is in frame — the texture, the open cross-
         section, one feature, the result on a surface — NOT always the packaging.
     (4) SETTING — the real-world place (kitchen counter, bathroom mirror, desk,
         car, outdoors) inferred from the product's usage.
   GOOD: "POV over the hands snapping the biscuit in half on a wooden board,
   walnut chunks and fig bits tumbling out, morning kitchen light." BAD: "close-up
   of the product" / "the biscuit on a table" (generic → identical clones).
   *** NO TWO broll cuts may be the SAME shot. If two lines are about the same
   thing, give them DIFFERENT shot types / angles / actions (one macro of the
   texture, one wide of it being eaten, one top-down of the ingredients). ***
   Lean to "hands_noface" so we SEE the product used, not just a face.
   The setting is INFERRED, never hardcoded — examples across niches: seasoning →
   hands sprinkling over food in a kitchen; tyre inflator → pumping a tyre at the
   roadside; serum → dabbed on at a bathroom mirror; watch → on a wrist; seeds →
   scattered onto garden soil; perfume → sprayed on the wrist. Read THIS product.
3. "mechanism3d" — for a line describing a process INSIDE the product/body a phone
   can't film (an ingredient acting inside, airflow inside a device, a coating at
   molecular level…). Write the conceptPrompt; it renders as a clean 3D animation.
   Use SPARINGLY — at most ~2 per video. If SEVERAL lines describe internal benefits,
   make only the strongest one a 3D cut and ground the rest as a real product
   close-up (+ a sticker for the claim) — the ad must not become a science reel.

STICKERS (separate array — 0-credit text pops that ride on a cut, REPLACING the
old overlays). Be GENEROUS — stickers are FREE and do NOT compete with the cuts,
so pop one on EVERY beat where the voice names something concrete: a number, a
spec, a measurement, a feature, a benefit, a time, a price, a discount, a free
gift, a safety/result claim. Cover MOST such moments, not just two or three — a
spec/feature-heavy product (gadget, tool, appliance) should get MANY stickers; an
emotional/abstract script naturally gets fewer. Scale to what THIS script actually
names — never pad with vague stickers, but never leave a concrete callout bare.
  • single callout → {style:"number"|"price"|"badge"|"countdown"|…, text:"2kg" /
    "tự ngắt" / "mấy giây", quote, wordAnchor}. Prepend a fitting emoji to text.
  • a line listing SEVERAL specs/claims (e.g. "20000mAh, 4 hours, 30 min", or
    "tiết kiệm thời gian, không cần trạm xăng") → ONE {style:"list", items:["🔋
    20000mAh","⏱ 4 tiếng","⚡ 30 phút"], quote} — a stacked card (each item may
    start with its own emoji).
  Stickers carry the info the old hand-drawn overlays used to; do NOT make overlay
  scenes. They pop ONE at a time, spaced ~3s apart (two within 3s collide and the
  later one is dropped) — so cover the KEY callouts; don't stack many on one line.
  ALL sticker text 100% in ${langName} — translate the idea INTO ${langName}; NEVER
  leave or switch a word to English (write the ${langName} word, not the English one).
${culturalSettingBlock}${shapeHint}
RULES:
- DIRECTOR'S BRAIN (the #0 rule — think like a real director, not a captioner):
  READ THE MEANING of each line, then PICTURE the real-life moment + the person's
  EMOTION it implies, and film THAT — not a static product shot of the words.
  A descriptive line is an invitation to STAGE a scene. Universal, infer from the
  product (examples span niches, do NOT copy them literally):
    · "dùng được cho nhiều món / vị ngon" (a seasoning) → someone cooking at the
      stove, sprinkling it on, then tasting a spoonful with a happy, satisfied face
    · "da căng mượt sau 1 tuần" (a serum) → applying at the mirror, then a close,
      confident touch of glowing skin + a small smile
    · "ngủ ngon hơn hẳn" (a supplement) → waking up easy in soft morning light,
      stretching, refreshed
    · "bơm phát ăn ngay" (a tire inflator) → the roadside relief moment, tire
      firms up, the driver exhales and smiles
  When a line is RICH (an action AND a feeling/result), you MAY break it into a
  short MICRO-SEQUENCE of 2-3 complementary cuts (action → result/taste → the
  satisfied human reaction) instead of one flat shot — that is real directing.
  Each cut still gets its own quote slice + conceptPrompt.
- COVER 100%: the scenes' durations sum to ~${dur}s; every spoken beat has a cut;
  NO empty span.
- GROUPING (the #1 rule — be FLEXIBLE, not mechanical):
    • ONE idea = ONE cut. If 2-3 SHORT consecutive sentences share ONE visual moment
      (same product action, same setting, same beat), GROUP them into ONE cut with
      a quote that joins those sentences. Do NOT fragment by sentence.
    • Examples of correct grouping:
        - "Cắn miếng bánh. Giòn rụm. Thơm lừng." → ONE cut (one bite moment,
          quote = "Cắn miếng bánh. Giòn rụm. Thơm lừng.").
        - "Mua 1 tặng 1. Chỉ 69k. Hốt lẹ kẻo hết." → ONE CTA cut (one product
          shot + thumbs-up).
    • A LONG complete idea (full demo / story beat / result) → ONE longer cut
      (~5-${MAX_BROLL_SEC.toFixed(0)}s of speech).
- PACING is set by HOW MUCH SPEECH each cut covers — you do NOT set seconds.
  Mix punchy ~2-3s callouts with breathing ~5-${MAX_BROLL_SEC.toFixed(0)}s ideas
  (fast-fast-slow), never a flat metronome.
- NO cut may cover more than ~${MAX_BROLL_SEC.toFixed(0)}s of speech. If ONE idea
  is GENUINELY longer, split into TWO DISTINCT shots with DIFFERENT visual angles
  (e.g. wide → macro, hands → reaction, top-down → over-the-shoulder), NEVER a
  near-duplicate "(slightly different angle)" of the same shot — Grok renders
  duplicates as visually-identical clones.
- AIM FOR AROUND ${minScenes} cuts (up to ${minScenes + 3} is fine if the natural
  rhythm calls for it). PREFER fewer cuts with grouped quotes over many tiny cuts;
  ~${minScenes} thoughtful cuts beats ${minScenes + 5} frantic ones.
- Each scene's "quote" MUST come FROM the script: either ONE sentence verbatim, OR
  a join of 2-3 CONSECUTIVE sentences (in order, verbatim, joined with spaces).
- VARIETY: mix lips + no-face hands-action + product close-ups + (some) 3D, so the
  ad feels like a real hand-held review, not a slideshow or a single locked shot.
  Do NOT run more than 2 cuts of the SAME type back-to-back — when several consecutive
  lines are similar (a list of symptoms, a list of ingredients/benefits), VARY the
  shot type across them (slip a product close-up or hands-action between concept or 3D
  cuts) so it stays a hand-held review, not a mood montage or a science reel.
- The CTA / buy line MUST show the PRODUCT in frame with an endorsing gesture — the
  creator holding/presenting the product and a thumbs-up / nod / offering it to camera
  (set role:"broll", kind:"product_action", cameraFraming:"creator", AND write its
  conceptPrompt describing exactly that endorsement shot). NEVER end on a bare
  talking-head with no product — the viewer must see the product at the call to buy.
- Universal: infer setting/usage from the product context; never hardcode a niche.

SCRIPT (cover all of it):
${scriptDump}

OUTPUT strict JSON only (no markdown fences):
{ "scenes": [ {"role":"lips","quote":"…","durationSec":4}, {"role":"broll","quote":"…","durationSec":5,"kind":"product_action","cameraFraming":"hands_noface","conceptPrompt":"…"} ], "stickers": [ {"style":"list","items":["…","…"],"quote":"…"} ] }`

  const call = (schema = true, denserHint?: { have: number; want: number }) =>
    directGeminiText({
      apiKey: params.geminiKey,
      systemInstruction,
      prompt: denserHint
        ? `Your last plan had only ${denserHint.have} cuts for a ${dur}s video — too sparse; a few ideas were merged into one long cut. Re-plan with about ${denserHint.want} cuts (a bit more is fine if it feels natural): give EACH distinct beat its own visual (new action / angle / detail grounded in that line). Keep the hook + callouts as fast 2-3s cuts; the main demo / reveal / CTA at 4-${MAX_BROLL_SEC.toFixed(0)}s. Cover every second. Return the JSON.`
        : 'Plan the full-coverage hybrid shot list now. Return the JSON.',
      maxOutputTokens: 4096,
      temperature: 0.6,
      thinkingBudget: 0,   // structured JSON — keep the whole list, no truncation
      responseMimeType: 'application/json',
      ...(schema ? { responseSchema: BROLL_RESPONSE_SCHEMA } : {}),
    })

  let raw = await call()
  let parsed = tryParse(raw)
  if (!parsed) { raw = await call(false); parsed = tryParse(raw) }
  if (!parsed) {
    throw new Error('Director (hybrid) trả về JSON không đọc được. Thử lại.')
  }

  // Enforce the lips ladder DETERMINISTICALLY — the prompt asks for exactly N but
  // Gemini sometimes returns fewer; promote evenly-spread broll cuts to lips to hit N.
  let scenes = enforceLipsCount(sanitizeScenes(parsed.scenes), lipsCount)

  // Density floor (1/2) — REAL content density comes from the DIRECTOR, not from
  // mechanically cutting one cut in half. If the plan is sparse, re-roll (up to 2×)
  // asking it to give each distinct line its OWN grounded visual; keep whichever
  // roll has the most scenes. The mechanical floor in assignSceneTiming is only the
  // last-resort backstop and should rarely fire once the director cooperates.
  // Re-roll ONCE if the plan is genuinely sparse (was 2× — too many calls + burned
  // Gemini quota; the new "AROUND minScenes (allow up to +3)" prompt is permissive
  // enough that the director rarely returns much fewer than the floor on the 1st try).
  for (let attempt = 1; attempt <= 1 && scenes.length < minScenes; attempt++) {
    // eslint-disable-next-line no-console
    console.log(`[BROLL_DIRECTOR] plan thưa (${scenes.length}<${minScenes}) — re-roll cho dày hơn`)
    const raw2 = await call(true, { have: scenes.length, want: minScenes })
    const parsed2 = tryParse(raw2)
    if (parsed2) {
      const scenes2 = enforceLipsCount(sanitizeScenes(parsed2.scenes), lipsCount)
      if (scenes2.length > scenes.length) { scenes = scenes2; parsed = parsed2 }
    }
  }
  // CTA visual guarantee — the LAST cut is the buy line; lock it to the standard
  // product endorsement (creator + product + thumbs-up) so the call-to-buy always
  // shows the product, regardless of what the model wrote for that scene.
  const lastScene = scenes[scenes.length - 1]
  if (lastScene && lastScene.role === 'broll') {
    lastScene.kind = 'product_action'
    lastScene.cameraFraming = 'creator'
    lastScene.conceptPrompt =
      'The creator holds the product up beside their face and gives an enthusiastic thumbs-up to camera, smiling — a genuine endorsement at the call to buy.'
  }

  // P4e Layer 2 — fill any scene the director left with an empty / vague
  // conceptPrompt via ONE targeted Gemini call (grounded in product + quote), so
  // the render never silently falls back to a generic product close-up. Filler
  // cuts added later by split/density are caught by Layer 3 at render time.
  await backfillWeakConcepts(scenes, params.product, params.geminiKey)

  const stickers = sanitizeStickers(parsed.stickers)

  const coveredSec = scenes.reduce((s, x) => s + x.durationSec, 0)
  const lipsScenes = scenes.filter((s) => s.role === 'lips')
  // eslint-disable-next-line no-console
  console.log(
    `[BROLL_DIRECTOR] dur=${dur}s scenes=${scenes.length} covered≈${coveredSec.toFixed(0)}s ` +
    `lips=${lipsScenes.length}/${lipsCount} broll=${scenes.filter((s) => s.role === 'broll').length} ` +
    `3d=${scenes.filter((s) => s.role === 'mechanism3d').length} ` +
    `noface=${scenes.filter((s) => s.cameraFraming === 'hands_noface').length} stickers=${stickers.length}`,
  )
  return { scenes, stickers }
}

// ── Parse + sanitize ────────────────────────────────────────────────────────

interface RawScene {
  role?: string; quote?: string; durationSec?: number
  conceptPrompt?: string; cameraFraming?: string; kind?: string; reason?: string
}
interface RawSticker {
  style?: string; text?: string; items?: unknown; quote?: string; wordAnchor?: string
}

function tryParse(raw: string): { scenes?: RawScene[]; stickers?: RawSticker[] } | null {
  let s = raw.trim()
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
  try {
    const obj = JSON.parse(s)
    if (obj && typeof obj === 'object' && Array.isArray(obj.scenes)) return obj
  } catch { /* fall through */ }
  return null
}

const SCENE_ROLES: BrollSceneRole[] = ['lips', 'broll', 'mechanism3d']
const SCENE_KINDS: BrollSceneKind[] = ['product_action', 'product_closeup', 'concept']

// Guarantee the lips ladder: if fewer "lips" than `target`, convert the broll cuts
// sitting in the LARGEST gaps between existing lips into lips, so the creator's face
// re-appears at evenly-spread points (hook + middle beats). Never drops below the
// model's choice; only tops up. NEVER promotes the LAST cut — that is the CTA
// product-endorsement shot and must keep its product (see the CTA rule).
function enforceLipsCount(scenes: BrollScene[], target: number): BrollScene[] {
  const lipsIdx = scenes.map((s, i) => (s.role === 'lips' ? i : -1)).filter((i) => i >= 0)
  if (lipsIdx.length >= target) return scenes
  // Exclude the final cut (the CTA) from promotion candidates.
  const brollIdx = scenes.map((s, i) => (s.role === 'broll' ? i : -1)).filter((i) => i >= 0 && i !== scenes.length - 1)
  const need = target - lipsIdx.length
  const chosen: number[] = []
  const n = scenes.length
  for (let k = 0; k < need; k++) {
    const occupied = [...lipsIdx, ...chosen].sort((a, b) => a - b)
    const bounds = [-1, ...occupied, n]
    let gapMid = 0, gapSize = -1
    for (let g = 0; g < bounds.length - 1; g++) {
      const size = bounds[g + 1] - bounds[g]
      if (size > gapSize) { gapSize = size; gapMid = Math.round((bounds[g] + bounds[g + 1]) / 2) }
    }
    const cand = brollIdx.filter((i) => !chosen.includes(i))
    if (cand.length === 0) break
    cand.sort((a, b) => Math.abs(a - gapMid) - Math.abs(b - gapMid))
    chosen.push(cand[0])
  }
  for (const i of chosen) {
    scenes[i] = {
      role: 'lips',
      quote: scenes[i].quote,
      durationSec: scenes[i].durationSec,
      reason: 'promoted to lips (enforce ladder)',
    }
  }
  return scenes
}

function sanitizeScenes(raw: RawScene[] | undefined): BrollScene[] {
  if (!Array.isArray(raw)) return []
  const out: BrollScene[] = []
  for (const r of raw) {
    const role = SCENE_ROLES.includes(r.role as BrollSceneRole) ? (r.role as BrollSceneRole) : 'broll'
    const quote = typeof r.quote === 'string' ? r.quote.trim() : ''
    if (!quote) continue
    const durationSec = Math.max(2, Math.min(6, Number(r.durationSec) || 4))
    const scene: BrollScene = { role, quote, durationSec }
    if (role !== 'lips') {
      // No-face only makes sense for a real product-action cut; otherwise creator.
      scene.kind = SCENE_KINDS.includes(r.kind as BrollSceneKind) ? (r.kind as BrollSceneKind) : 'product_action'
      const wantsNoFace = r.cameraFraming === 'hands_noface'
      scene.cameraFraming = wantsNoFace && role === 'broll' && scene.kind !== 'concept' ? 'hands_noface' : 'creator'
      // Backstop: the model sometimes returns an empty conceptPrompt for product
      // cuts (assuming the product image is enough) → the render would collapse to a
      // bland generic closeup. Fill a grounded default BY KIND so every cut keeps a
      // real on-product visual direction (and product_action stays product_action).
      let cp = typeof r.conceptPrompt === 'string' ? r.conceptPrompt.trim() : ''
      if (!cp) {
        cp = scene.kind === 'product_closeup'
          ? 'A clean, well-lit close-up of the product — its texture and a key detail filling the frame.'
          : scene.kind === 'concept'
          ? 'A simple real-life moment that illustrates the spoken line (no product on screen).'
          : 'Hands actively using and holding the product in its real everyday setting.'
      }
      scene.conceptPrompt = cp
    }
    scene.reason = typeof r.reason === 'string' ? r.reason : undefined
    out.push(scene)
  }
  return out
}

// ── P3a — Scene timing (derive the REAL timeline from the voice) ────────────
// The director's per-scene durationSec is only a HINT; the real timeline comes
// from WHERE each scene's quote is actually spoken. We locate each quote in the
// voice (real word-alignment first, estimate fallback), then each scene spans
// [its anchor .. the next scene's anchor], so the cuts cover the voice EXACTLY
// (sum = voiceDurationSec, no gaps, no hang past the voice). Unanchored scenes
// (quote not locatable) are interpolated between their anchored neighbours.

export interface TimedBrollScene extends BrollScene {
  startSec: number
  endSec: number
}

const round2 = (x: number) => Math.round(x * 100) / 100

export function assignSceneTiming(
  scenes: BrollScene[],
  alignment: VoiceAlignment | null | undefined,
  script: GeneratedScript,
  voiceDurationSec: number,
): TimedBrollScene[] {
  const n = scenes.length
  if (n === 0) return []
  const dur = Math.max(1, voiceDurationSec)

  // 1. Locate each scene's quote → raw anchor second (null if not locatable).
  const raw: (number | null)[] = scenes.map((s) => {
    const t = alignment ? computeQuoteTimestampFromAlignment(alignment, s.quote) : null
    return t !== null ? t : computeQuoteTimestamp(script, s.quote)
  })

  // 2. Collect KNOWN anchors (monotonic, clamped) + virtual ends at 0 and dur.
  const known: { idx: number; t: number }[] = [{ idx: -1, t: 0 }]
  for (let i = 0; i < n; i++) {
    if (raw[i] !== null) {
      const t = Math.max(known[known.length - 1].t, Math.min(dur, Math.max(0, raw[i]!)))
      known.push({ idx: i, t })
    }
  }
  known.push({ idx: n, t: dur })

  // 3. Start second per scene — anchored scenes keep their anchor; the runs of
  //    unanchored scenes between two anchors are spread evenly.
  const starts = new Array<number>(n).fill(0)
  for (let k = 0; k < known.length - 1; k++) {
    const a = known[k]
    const b = known[k + 1]
    if (a.idx >= 0 && a.idx < n) starts[a.idx] = a.t
    for (let i = a.idx + 1; i < b.idx; i++) {
      starts[i] = a.t + ((b.t - a.t) * (i - a.idx)) / (b.idx - a.idx)
    }
  }
  starts[0] = 0  // the first cut always opens the video

  // 4. Build spans: scene i runs until the next scene's start (last → dur).
  const out: TimedBrollScene[] = []
  for (let i = 0; i < n; i++) {
    const startSec = round2(starts[i])
    const rawEnd = i < n - 1 ? starts[i + 1] : dur
    const endSec = round2(Math.max(startSec + 0.2, rawEnd))
    out.push({ ...scenes[i], startSec, endSec })
  }
  return enforceDensityFloor(capSplitScenes(out), densityFloor(dur))
}

// Hard cut-length caps (deterministic — independent of how many scenes the model
// returned). A sparse plan stretched to fill the voice can otherwise produce a 12s
// monster cut. LIPS are kept to 4-5s (a talking-head shouldn't hold longer); the
// overflow voice becomes a product close-up B-roll (cheaper + more dynamic than a
// 2nd lipsync). B-ROLL longer than the cap is split into equal sub-cuts.
const MAX_LIPS_SEC = 5
// Grok i2v clips are ~6s; at 1.3× (after skipping the static lead-in) one clip fills
// ~5s of timeline natively, and the assembler's fit-speed re-fits anything between
// 5-6s. Cap broll/3d at 6s so a single coherent idea can BREATHE (~5-6s) instead of
// being chopped into 3s "(closer angle)" duplicates — the source of "18 cuts trong 60s
// feels frantic". Lips stays 5s (a talking-head shouldn't hold longer).
// P3t — nâng 6 → 8 để khớp với Grok i2v duration step (6 / 8 / 10 — P3s đã loại 7s).
// Mỗi cảnh broll giờ thở tới 8s thay vì bị chẻ làm đôi 3s/3s với prompt clone.
const MAX_BROLL_SEC = 8.0
// 2s minimum so a leftover cut never flashes < 2s and disrupts the eye.
const MIN_CUT_SEC = 2.0

function capSplitScenes(timed: TimedBrollScene[]): TimedBrollScene[] {
  const out: TimedBrollScene[] = []
  // Fill [start,end] with B-roll cut(s), each ≤ MAX_BROLL_SEC. These are the
  // LIPS-OVERFLOW leftovers (the creator was still talking when the lips cut hit
  // its 5s cap). P4g — default them to a CONCEPT + creator HUMAN-moment shot, NOT
  // a product_closeup: a spoken line is the creator's own words, so the coherent
  // fallback is the person/reaction, never a generic product shot slapped on a
  // rich emotional line ("cả nhà khỏe luôn" must not become a túi sản phẩm). The
  // post-timing brain (groundOrphanScenes) + Layer 3 ground the real concept; the
  // kind/framing set here is just the safe floor if Gemini is unavailable.
  const fillBroll = (start: number, end: number, quote: string) => {
    const L = end - start
    if (L < MIN_CUT_SEC) {
      // Too small for its own cut — extend the PREVIOUS cut, but NEVER a lips cut
      // (that would push the lips past its hard cap). Absorb into the last broll if
      // there is one; otherwise emit a short broll rather than violate the lips cap.
      const last = out[out.length - 1]
      if (last && last.role !== 'lips') {
        last.endSec = round2(end); last.durationSec = round2(end - last.startSec)
      } else {
        out.push({ role: 'broll', kind: 'concept', cameraFraming: 'creator', quote, conceptPrompt: '', durationSec: round2(L), startSec: round2(start), endSec: round2(end) })
      }
      return
    }
    const parts = Math.max(1, Math.ceil(L / MAX_BROLL_SEC))
    const step = L / parts
    const quoteParts = splitQuoteByParts(quote, parts)   // P3v — no duplicate text
    for (let k = 0; k < parts; k++) {
      const a = round2(start + k * step)
      const b = round2(k === parts - 1 ? end : start + (k + 1) * step)
      out.push({ role: 'broll', kind: 'concept', cameraFraming: 'creator', quote: quoteParts[k], conceptPrompt: '', durationSec: round2(b - a), startSec: a, endSec: b })
    }
  }
  for (const s of timed) {
    const L = s.endSec - s.startSec
    if (s.role === 'lips') {
      if (L <= MAX_LIPS_SEC + 0.4) { out.push(s); continue }
      // Hard-cap the lips ABSOLUTELY: cut it at MAX_LIPS_SEC, but pull the cut a
      // touch earlier when needed so the overflow is ≥ MIN_CUT — that way the
      // leftover always becomes its own broll and we never extend the lips past 5s.
      const lipsEnd = round2(Math.min(s.startSec + MAX_LIPS_SEC, s.endSec - MIN_CUT_SEC))
      // P3v — split the spoken line so the lips card shows the FIRST portion and
      // the overflow broll shows the REST (no duplicate of the whole sentence).
      const [lipsQuote, overflowQuote] = splitQuoteByParts(s.quote, 2)
      out.push({ ...s, quote: lipsQuote, endSec: lipsEnd, durationSec: round2(lipsEnd - s.startSec) })
      fillBroll(lipsEnd, s.endSec, overflowQuote)  // overflow → product close-up
    } else {
      if (L <= MAX_BROLL_SEC + 0.4) { out.push(s); continue }
      const parts = Math.ceil(L / MAX_BROLL_SEC)
      const step = L / parts
      const quoteParts = splitQuoteByParts(s.quote, parts)   // P3v — no duplicate text
      for (let k = 0; k < parts; k++) {
        const a = round2(s.startSec + k * step)
        const b = round2(k === parts - 1 ? s.endSec : s.startSec + (k + 1) * step)
        out.push({
          ...s, startSec: a, endSec: b, durationSec: round2(b - a),
          quote: quoteParts[k],   // P3v — each sub-cut its own portion of speech
          // P3t — was: append "(a slightly different angle / closer)" which Grok
          // i2v rendered as visually-identical clones (the user audited 2 cảnh
          // i hệt nhau). Now apply ROTATING visual-craft modifiers so split
          // halves get genuinely different shots, not a paraphrased duplicate.
          conceptPrompt: k > 0 && s.conceptPrompt
            ? `${s.conceptPrompt} — ${SPLIT_ANGLE_VARIANTS[k % SPLIT_ANGLE_VARIANTS.length]}`
            : s.conceptPrompt,
        })
      }
    }
  }
  return out
}

// P3t — universal visual modifiers for forced splits (no niche assumption).
// These describe how a CAMERA moves around the SAME subject — they don't change
// what the subject IS, so they preserve the director's intent while making
// Grok render two visibly different frames instead of a clone.
const SPLIT_ANGLE_VARIANTS = [
  'macro close-up, shallow depth of field, the same subject',
  'wider shot showing more of the setting around the same subject',
  'over-the-shoulder angle of the same action',
  'low-angle product hero shot of the same subject',
  'top-down flat-lay of the same subject',
]

// P3v — split a quote across N sub-cuts so a long line chẻ thành nhiều cảnh
// KHÔNG lặp lại y nguyên text (the user demanded "cấm trùng câu thoại triệt
// để"). Each sub-cut carries ONLY the portion of speech spoken during its
// sub-span. Prefers sentence boundaries; falls back to word-split when there
// are fewer sentences than parts. Pure text — universal, no niche assumption.
// GUARANTEES: returns exactly `parts` non-empty strings (each sub-cut shows
// something), and concatenated in order they reconstruct the original quote.
function splitQuoteByParts(quote: string, parts: number): string[] {
  const q = (quote ?? '').trim()
  if (parts <= 1) return [q]
  if (!q) return new Array(parts).fill('')
  const sentences = (q.match(/[^.!?…]+[.!?…]*/g) ?? [q]).map((s) => s.trim()).filter(Boolean)
  // Greedy fill `parts` buckets, balanced by char length, keeping sentence order.
  const targetLen = q.length / parts
  const buckets: string[] = new Array(parts).fill('')
  let bi = 0
  for (const sent of sentences) {
    if (bi < parts - 1 && buckets[bi].length >= targetLen && buckets[bi].length > 0) bi++
    buckets[bi] = buckets[bi] ? `${buckets[bi]} ${sent}` : sent
  }
  // Any empty bucket (more parts than sentences) → borrow words from the
  // longest non-trivial bucket so no sub-cut ends up with a blank quote.
  for (let i = 0; i < parts; i++) {
    if (buckets[i]) continue
    let donor = -1, donorWords = 1
    for (let j = 0; j < parts; j++) {
      const w = buckets[j].split(/\s+/).filter(Boolean).length
      if (w > donorWords) { donorWords = w; donor = j }
    }
    if (donor < 0) { buckets[i] = q; continue }
    const w = buckets[donor].split(/\s+/).filter(Boolean)
    const half = Math.ceil(w.length / 2)
    buckets[donor] = w.slice(0, half).join(' ')
    buckets[i] = w.slice(half).join(' ')
  }
  return buckets
}

// Density floor (2/2) — the deterministic backstop. After capping, if the plan is
// still below `minScenes` (a stubborn-sparse director that the re-roll didn't fix),
// split the LONGEST cut in half, repeatedly, until the floor is met. Splitting
// longest-first preserves the short snappy cuts (variety) instead of chopping
// everything to a uniform ~4s metronome. A long lips splits into lips + a
// product-closeup broll (keep one face beat, don't make two lipsync renders).
function enforceDensityFloor(scenes: TimedBrollScene[], minScenes: number): TimedBrollScene[] {
  const out = scenes.slice()
  let guard = 0
  let split = 0
  while (out.length < minScenes && guard++ < 64) {
    let li = -1
    let lLen = 2 * MIN_CUT_SEC   // only split cuts that yield two ≥ MIN_CUT halves
    for (let i = 0; i < out.length; i++) {
      const L = out[i].endSec - out[i].startSec
      if (L > lLen) { lLen = L; li = i }
    }
    if (li < 0) break   // nothing long enough to split — accept the current density
    const s = out[li]
    const mid = round2(s.startSec + (s.endSec - s.startSec) / 2)
    // P3v — split the quote so the two halves never show identical text.
    const [q1, q2] = splitQuoteByParts(s.quote, 2)
    const first: TimedBrollScene = { ...s, quote: q1, endSec: mid, durationSec: round2(mid - s.startSec) }
    const second: TimedBrollScene = s.role === 'lips'
      // P4g — second half of a split LIPS cut = the creator still talking. Default
      // to a concept + creator HUMAN-moment shot (groundOrphanScenes / Layer 3
      // fill the real concept), NOT a product_closeup that would dump a generic
      // product shot onto a spoken emotional line.
      ? { role: 'broll', kind: 'concept', cameraFraming: 'creator', quote: q2, conceptPrompt: '', startSec: mid, endSec: s.endSec, durationSec: round2(s.endSec - mid) }
      // P3t — was: " (a slightly different angle / closer)" → visually-identical
      // clones. Now apply a rotating angle modifier so the second half is a
      // genuinely different shot of the same subject.
      : { ...s, quote: q2, startSec: mid, durationSec: round2(s.endSec - mid),
          conceptPrompt: s.conceptPrompt
            ? `${s.conceptPrompt} — ${SPLIT_ANGLE_VARIANTS[split % SPLIT_ANGLE_VARIANTS.length]}`
            : s.conceptPrompt }
    out.splice(li, 1, first, second)
    split++
  }
  if (split > 0) {
    // eslint-disable-next-line no-console
    console.log(`[BROLL_DIRECTOR] density floor: chẻ ${split} cảnh dài → tổng ${out.length} cảnh (sàn ${minScenes})`)
  }
  return out
}

function sanitizeStickers(raw: RawSticker[] | undefined): BrollSticker[] {
  if (!Array.isArray(raw)) return []
  const out: BrollSticker[] = []
  for (const r of raw) {
    const quote = typeof r.quote === 'string' ? r.quote.trim() : ''
    if (!quote) continue
    const items = Array.isArray(r.items)
      ? (r.items as unknown[]).map((x) => String(x).trim()).filter((x) => x.length > 0 && x.length <= 24).slice(0, 4)
      : []
    const text = typeof r.text === 'string' ? r.text.trim() : ''
    if (items.length === 0 && !text) continue
    out.push({
      style: typeof r.style === 'string' ? r.style : 'highlight',
      ...(items.length > 0 ? { items } : { text }),
      quote,
      wordAnchor: typeof r.wordAnchor === 'string' ? r.wordAnchor.trim() : undefined,
    })
  }
  return out
}
