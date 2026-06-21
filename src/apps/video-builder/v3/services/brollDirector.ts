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

export type BrollSceneRole = 'lips' | 'broll' | 'mechanism3d' | 'social_proof'
export type BrollSceneKind = 'product_action' | 'product_closeup' | 'concept'

// P6m (refactor P1) — the SINGLE declared "shot intent" per scene: the ONE archetype that
// matches the line's meaning, chosen by Gemini in the schema. P1 only CAPTURES + DISPLAYS it
// (no layer reads it for decisions yet — zero behavior change); P2 will move the caps/dedup
// to key off this instead of regex, then delete the colliding mutators. Universal/niche-free.
export type ShotIntent =
  | 'lips'            // creator talking on camera
  | 'product_demo'    // product being USED in its real setting
  | 'product_macro'   // clean close-up / texture / a spec detail (no person)
  | 'mechanism3d'     // 3D animation of the internal mechanism
  | 'result_behavior' // creator DOING the thing the result enables (walk/cook/relaxed)
  | 'reaction'        // creator's emotion (skeptic / craving / worry / delight), no product
  | 'before_after'    // split-screen transformation
  | 'social_proof'    // FB/review card
  | 'offer'           // penult deal/offer shot
  | 'endorsement'     // CTA: creator holds product + thumbs-up
export const SHOT_INTENTS: ShotIntent[] = [
  'lips', 'product_demo', 'product_macro', 'mechanism3d', 'result_behavior',
  'reaction', 'before_after', 'social_proof', 'offer', 'endorsement',
]

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
  /** P6m — Gemini's declared single shot archetype for this line (P1: captured + shown
   *  only; not yet used for decisions). */
  shotIntent?: ShotIntent
  /** P6av — a lips cut whose line mentions/points at the product → render it from KF-B (the
   *  creator HOLDING the product) instead of the plain talking-head KF-A. At most one lips per
   *  video carries this (set by assignLipsProductKeyframe). */
  lipsHoldsProduct?: boolean
  /** Phase A — asset:xxx of a bundled GIFT image to send as an EXTRA render
   *  reference (alongside the product) for this cut. Set ONLY on the two closing
   *  cuts when a gift is enabled (penult product+gift hero; final creator holding
   *  BOTH). The renderer hard-locks the product + renders the gift as a distinct
   *  second object. Absent on every other cut. */
  giftRef?: string
  /** Phase A — how many IDENTICAL product units to render in this cut, read from the
   *  SPOKEN offer in the script (buy X get Y → X+Y, capped 4). >1 only on the penult
   *  product-hero cut so a "mua 1 được thêm 2" deal shows the real 3 units. The renderer
   *  also hard-locks the product to ONE hero ref when this is set (anti-drift). Absent/1
   *  elsewhere. */
  productUnits?: number
  /** one short phrase explaining the choice (debug / UI). */
  reason?: string
}

// P6p — sticker feature removed from the Ads Video pipeline (director no longer emits them).

export interface BrollDirectorResult {
  scenes: BrollScene[]
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
  /** Phase A — OPTIONAL bundled gift (already resolved: localised name + image
   *  ref). When enabled, the two closing cuts show the gift. undefined → no-op. */
  gift?: import('../types').VideoGift
}

// ── Lips count ladder (user spec — NOT a niche hardcode) ────────────────────
// P4o — <50s = 3, 50-70s = 4, >70s = 5 (HARD CAP). 5 is the ceiling — a longer
// ad does NOT keep adding talking-head cuts (kept the b-roll the hero).
function lipsCountForDuration(sec: number): number {
  // P5u — user: "1 video chỉ cần 3 lips" — keep the creator's face as a light trust
  // thread, give the rest of the timeline to product broll. ~3 lips (4 only for long
  // ads ≥75s so the face doesn't vanish for too long).
  return sec >= 75 ? 4 : 3
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
const TARGET_AVG_CUT_SEC = 4.5   // P5u — snappier pace (was 6.0 → slideshow-slow); ~15 cuts/69s
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
          role:          { type: 'string', enum: ['lips', 'broll', 'mechanism3d', 'social_proof'] },
          quote:         { type: 'string', maxLength: 200 },
          durationSec:   { type: 'number' },
          conceptPrompt: { type: 'string', maxLength: 240 },
          cameraFraming: { type: 'string', enum: ['creator', 'hands_noface'] },
          kind:          { type: 'string', enum: ['product_action', 'product_closeup', 'concept'] },
          shotIntent:    { type: 'string', enum: ['lips', 'product_demo', 'product_macro', 'mechanism3d', 'result_behavior', 'reaction', 'before_after', 'social_proof', 'offer', 'endorsement'] },
          reason:        { type: 'string', maxLength: 80 },
        },
        required: ['role', 'quote', 'durationSec'],
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
  // P6af — product_closeup = a STATIC MACRO of the product detail (not a usage shot). The old
  // fallback wrote "hands using…" for closeups too → a demo, contradicting the "cận chi tiết"
  // intent. Now a closeup falls back to a clean macro; only product_action falls back to a usage shot.
  if (args.kind === 'product_closeup') {
    return `a clean MACRO close-up of ${name} ALONE — its real texture / label / one key detail filling the frame, resting STATIC on a simple real surface, gentle slow push, soft studio light. NO hands, NO person, NOT held, NOT rotated.`
  }
  // product_action — prefer the REAL usage SEEN in the photos (visualBrief.howUsed) over the
  // generic keyword-bucket usage, so even this last-resort fallback is physically correct
  // (e.g. "rub gel onto the knee" not a guessed "hold it"). Falls back to the niche usage.
  const vbUsed = args.product?.visualBrief?.match(/how it is physically used[^:]*:\s*([^\n]+)/i)?.[1]?.trim()
  const usage = vbUsed || (args.product ? detectProductNiche(args.product)?.usage : null)
  return `hands naturally using ${name}${usage ? ` — ${usage}` : ''}, shown close-up in its real-world setting, authentic UGC iPhone footage, natural light`
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
- broll + product_action ("đang dùng") → the PRODUCT being USED, in its real setting. Use the SPECIFIC
  usage MOTION from the VISUAL BRIEF / product context — the real way THIS product is applied/used (e.g.
  squeeze gel & rub it in circles on the knee; tilt the head & drip 2-3 drops into the ear; peel the patch
  & press it onto the skin) — NEVER a generic "holding it up". The line tells which moment to show.
- broll + product_closeup ("cận sản phẩm / chi tiết") → the PRODUCT ALONE — a clean static macro of one
  real detail (texture / label / a key part) on a surface. NO hands, NO person, NOT held, NOT rotated
  (a held + rotating product makes the render morph). Just the product, gentle push.
- broll + concept + creator → a PERSON living the beat (NO product packaging). MATCH THE EMOTION SHADE
  of the line — do NOT write a generic face. Pain/discomfort → a grimace / wince / rubbing the sore
  spot / slumping in a concrete situation; craving/desire → a longing look, reaching for it; skepticism →
  a doubtful raised-brow / arms-crossed; relief/comfort → an exhale, shoulders dropping, a soft satisfied
  look; delight/result → a genuine bright smile mid-action. Anchor it to the line's CONCRETE moment, not
  a floating mood. CRITICAL for a PAIN/PROBLEM beat: keep it UNRESOLVED — show ONLY the discomfort, do
  NOT sneak in relief, a smile, the product, or any "and then it got better" payoff. The pain scene
  sells the problem; resolution belongs to a LATER beat.
- broll + concept (no creator) → a real-world moment illustrating the line (NO product packaging).
- mechanism3d → the internal mechanism as a clean 3D cross-section / macro (NO people, NO packaging).
UNIVERSAL — infer the action + setting from the product context; NEVER assume a niche.

OUTPUT exactly ${weak.length} lines, ONE conceptPrompt per line, SAME order, no numbering, no quotes, no commentary.`
  const prompt = `Write a conceptPrompt for each scene (write in English):\n${list}\n\nOutput ${weak.length} lines, one per line, same order.`
  try {
    const raw = await directGeminiText({
      apiKey, systemInstruction, prompt, maxOutputTokens: 1536, temperature: 0.4, thinkingBudget: 0,   // P6s — 0.7→0.4: ổn định concept khi re-roll
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
      apiKey, systemInstruction, prompt, maxOutputTokens: 1536, temperature: 0.4, thinkingBudget: 0,   // P6s — 0.7→0.4: ổn định concept khi re-roll
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

// ── P4h — product establishment + deictic (deterministic backstop) ──────────
// The Layer-1 prompt asks the director to SHOW the product when a line NAMES or
// POINTS AT it; these passes GUARANTEE it (mirroring the CTA last-cut lock) so a
// named product never stays invisible through the first half ("nhắc muối tỏi 5
// câu mà tới #6 mới thấy lọ"). Pure text/heuristics — universal, no niche hardcode.

// VN "cái lọ NÀY / em NÀY", MS "botol NI / produk NI" — a strong container noun
// followed (within a few words) by a point-at word. No \b (Vietnamese diacritics
// break \w boundaries); the strong noun keeps false positives low.
const PRODUCT_DEICTIC_RE = /(lọ|chai|hộp|tuýp|hũ|gói|sản phẩm|botol|tiub|kotak|produk)[^.?!]{0,30}(này|đây|ni|ini|nih)/iu

/** True if the spoken line POINTS AT the product ("cái lọ này", "botol ni"). */
function quoteHasProductDeictic(quote: string): boolean {
  return PRODUCT_DEICTIC_RE.test((quote ?? '').toLowerCase())
}

/** True if the spoken line NAMES the product (full name, or ≥2 consecutive
 *  content words of it). Drives the opening + first-third establish rules. */
function quoteNamesProduct(quote: string, product: Product | null | undefined): boolean {
  const name = product?.productName?.trim()
  if (!name || !quote) return false
  const q = quote.toLowerCase().replace(/\s+/g, ' ')
  const n = name.toLowerCase().replace(/\s+/g, ' ')
  if (n.length >= 3 && q.includes(n)) return true
  const STOP = new Set(['the', 'and', 'for', 'với', 'cho', 'và', 'là', 'các', 'những', 'bộ', 'loại', 'sản', 'phẩm', 'combo', 'set', 'chai', 'lọ', 'hộp', 'gói', 'hũ', 'tuýp', 'gram', 'size'])
  const words = n.split(' ').filter((w) => w.length >= 3 && !STOP.has(w))
  for (let i = 0; i + 1 < words.length; i++) {
    if (q.includes(`${words[i]} ${words[i + 1]}`)) return true
  }
  if (words.length === 1 && words[0].length >= 5 && q.includes(words[0])) return true
  return false
}

/** A scene that VISIBLY shows the product (not a face / concept / 3D cut). */
function sceneShowsProduct(s: BrollScene): boolean {
  return s.role === 'broll' && (s.kind === 'product_action' || s.kind === 'product_closeup')
}

/** Convert a scene into a product shot. 'creator' = face + product (the opening
 *  hold-up — keeps the scroll-stop face); 'hands_noface' = hands showing it. */
function makeProductScene(s: BrollScene, framing: CameraFraming, product: Product | null | undefined): void {
  s.role = 'broll'
  s.kind = 'product_action'
  s.cameraFraming = framing
  if (isWeakConceptPrompt(s.conceptPrompt)) {
    const name = product?.productName?.trim() || 'the product'
    s.conceptPrompt = framing === 'creator'
      ? `The creator holds up ${name} to the camera at a natural eye level, presenting it with a friendly, confident expression — authentic UGC, natural light.`
      : `Hands hold and show ${name} clearly in its real-world setting as the line refers to it — close-up, authentic UGC iPhone footage, natural light.`
  }
}

/** P4h — guarantee the product is established EARLY + shown on POINT-AT lines.
 *  Runs on the director's scenes BEFORE the CTA lock + backfill. Never touches
 *  the last cut (CTA, owned by the CTA lock) or 3D mechanism cuts. */
// P2 — intents that are CREATOR-CENTRIC by Gemini's own declaration (talking / emotion /
// showing-the-result / transformation). When Gemini explicitly tagged a line as one of
// these, the establish backstop must NOT overwrite it into a product hold-up (the audited
// "hook lips → cầm sản phẩm" flip). The product still gets established on a nearby NON-
// creator-intent line instead. A scene with no declared intent (or a product/proof intent)
// is still fair game for establishment, so coverage is preserved.
const ESTABLISH_PRESERVE_INTENTS = new Set<ShotIntent>(['lips', 'reaction', 'result_behavior', 'before_after'])
const preserveFromEstablish = (s: BrollScene): boolean =>
  !!s.shotIntent && ESTABLISH_PRESERVE_INTENTS.has(s.shotIntent)

function applyProductEstablishRules(scenes: BrollScene[], product: Product | null | undefined): void {
  if (scenes.length === 0 || !product?.productName) return
  const lastIdx = scenes.length - 1

  // Rule A — the OPENING establishes the product when the HOOK names it (face+product).
  const first = scenes[0]
  if (first && lastIdx > 0 && !sceneShowsProduct(first) && quoteNamesProduct(first.quote, product) && !preserveFromEstablish(first)) {
    makeProductScene(first, 'creator', product)
  }

  // Rule B — any line that POINTS AT the product must show it (never a bare face).
  for (let i = 0; i < scenes.length; i++) {
    if (i === lastIdx) continue
    const s = scenes[i]
    if (s.role === 'mechanism3d') continue          // 3D internal animation — leave it
    if (preserveFromEstablish(s)) continue          // P2 — honor a declared talking/reaction/result beat
    if (!sceneShowsProduct(s) && quoteHasProductDeictic(s.quote)) {
      makeProductScene(s, i === 0 ? 'creator' : 'hands_noface', product)
    }
  }

  // Rule C — establish within the FIRST THIRD (covers a LEAD / problem-first hook):
  // if no early scene shows the product, force the first product-NAMING scene to (skipping
  // any scene Gemini tagged as a creator-centric beat — establish on the next namer instead).
  const third = Math.max(1, Math.ceil(scenes.length / 3))
  if (!scenes.slice(0, third).some(sceneShowsProduct)) {
    for (let i = 0; i < lastIdx; i++) {
      if (scenes[i].role === 'mechanism3d') continue
      if (preserveFromEstablish(scenes[i])) continue
      if (quoteNamesProduct(scenes[i].quote, product)) {
        if (!sceneShowsProduct(scenes[i])) makeProductScene(scenes[i], i === 0 ? 'creator' : 'hands_noface', product)
        break
      }
    }
  }
}

/** P5l — no two "lips" cuts adjacent (user rule: lips must be separated by ≥1 broll;
 *  2-4 broll between lips is great). Gemini sometimes returns a 1:1 metronome or
 *  back-to-back lips; this deterministic backstop flips the SECOND of any adjacent
 *  lips pair to a broll that illustrates its OWN quote (empty concept → grounded by
 *  backfillWeakConcepts / Layer-3 later). Never adds lips; fewer lips is fine. */
function separateLipsRuns(scenes: BrollScene[]): void {
  for (let i = 1; i < scenes.length; i++) {
    if (scenes[i].role === 'lips' && scenes[i - 1].role === 'lips') {
      scenes[i].role = 'broll'
      scenes[i].kind = 'product_action'
      scenes[i].cameraFraming = 'hands_noface'
      scenes[i].conceptPrompt = ''   // weak → backfilled, grounded in this cut's quote
    }
  }
}

// P5p — render-safe holds (deterministic backstop to the prompt rule). The i2v model
// renders "container held in one hand while the other reaches in" / loose contents in
// a palm as a FLOATING bowl/object (the user's "đĩa bay"). For a PRESENT-to-camera
// (creator-framing) shot whose concept hits that pattern, rewrite it to a simple,
// well-supported PRODUCT hold. Universal — uses the product name, no niche. Usage
// shots (hands_noface on a surface — sprinkling / pouring / dipping) are left as-is.
const FLOATING_POSE_RE = /\b(bowl|plate|dish|tray|cup|saucer|platter|handful|overflowing|reaching\s+in(?:to)?|reach\s+into|balanced|scoop)\b|in (?:her|his|their) palm/i
function enforceRenderSafeHolds(scenes: BrollScene[], product: Product | null | undefined): void {
  const name = product?.productName?.trim() || 'the product'
  for (const s of scenes) {
    if (s.role !== 'broll' || s.cameraFraming !== 'creator') continue   // only present-to-camera holds
    if (!FLOATING_POSE_RE.test(s.conceptPrompt ?? '')) continue
    s.kind = 'product_action'
    s.conceptPrompt =
      `The creator holds ${name} firmly with both hands at chest height, presenting it clearly to the camera with a warm, confident smile — a simple, well-supported grip (NOT a floating object, NOT a container reached into), authentic UGC, natural light.`
  }
}

// P5q/P5r — PRODUCT-IS-HERO backstop (deterministic, NARROW). The director was making
// a >70% model reel. The bulk of "product is hero" is now enforced by the PROMPT (the
// LLM understands meaning); the deterministic layer is kept PRECISE to avoid the blunt
// over-trigger the user caught ("ăn đều đặn" — a habit/result line — wrongly forced to
// an eating shot). So we force ONLY unambiguous physical "doing-it-with-the-product"
// verbs (a true filmable demo), and still cap face-only concept cuts.
//
// DEMO_ACTION_RE = clear physical actions ONLY (bite/apply/spray… / cắn/nhai/thoa/xịt /
// MS gigit/kunyah/sapu/sembur/tabur/gosok/celup/perah). EXCLUDES ambiguous verbs
// (eat/use/try, ăn/dùng/thử, MS makan/guna/cuba) and flavour/texture DESCRIPTORS
// (taste/crunchy, vị/giòn/dẻo, MS rasa/sedap/rangup) — those can sit over a talking head.
// EN \b-bounded; VN/MS syllables bounded by whitespace/punctuation (space-sep).
const DEMO_ACTION_RE = /\b(?:bite|chew|apply|spray|sprinkle|rub|dab|squeeze)\b|(?:^|[\s.,!?;:"'(])(?:cắn|nhai|thoa|bôi|xịt|rắc|chấm|vắt|nặn|gigit|kunyah|telan|sapu|sembur|semburkan|tabur|taburkan|gosok|celup|perah)(?=$|[\s.,!?;:"')])/i
// Deictic — points AT the product ("này / đây / em này / cái này", MS "ni"): must SHOW
// the product, never a bare face → a bad lips candidate.
const DEICTIC_RE = /(?:^|[\s.,!?;:"'(])(?:này|đây|cái này|em này)(?=$|[\s.,!?;:"')])|\bni\b/i
// EATING subset of demo actions — these need the AVATAR'S OWN face/mouth (identity),
// NOT a hands-only crop (which the i2v model renders as a disembodied floating mouth +
// floating bowl — the user's "#8 đầu lơ lửng"). So an eating line is a CREATOR-framing
// shot of the same person taking a bite.
const EATING_ACTION_RE = /\b(?:bite|chew)\b|(?:^|[\s.,!?;:"'(])(?:cắn|nhai|gigit|kunyah|telan)(?=$|[\s.,!?;:"')])/i
// A line that should NOT become a "lips" talking-head (it begs for a product visual).
function isBadLipsCandidate(quote: string | undefined): boolean {
  const q = quote ?? ''
  return DEMO_ACTION_RE.test(q) || DEICTIC_RE.test(q)
}

// P6av — Hybrid 2-keyframe: mark AT MOST ONE lips cut (whose line NAMES or POINTS at the
// product) to render from KF-B (the creator HOLDING the product) instead of the static
// talking-head KF-A. Prefers the EARLIEST product-mention lips (usually the reveal/discovery
// line). Deterministic; the renderer falls back to KF-A if KF-B wasn't generated.
function assignLipsProductKeyframe(scenes: BrollScene[], product: Product | null | undefined): void {
  const name = (product?.productName ?? '').toLowerCase()
  const nameTokens = name.split(/[^a-z0-9à-ỹ]+/i).filter((w) => w.length >= 4)
  const mentionsProduct = (q: string): boolean => {
    const t = (q ?? '').toLowerCase()
    if (DEICTIC_RE.test(q ?? '')) return true
    return nameTokens.some((w) => t.includes(w))
  }
  const idx = scenes.findIndex((s) => s.role === 'lips' && mentionsProduct(s.quote))
  if (idx >= 0) scenes[idx].lipsHoldsProduct = true
}
// P6f — shared archetype cues (ONE source of truth for the meaning→shot system). Matched on
// the ENGLISH conceptPrompt the director writes, so universal across markets/niches.
//   • RESULT_BEHAVIOR_RE = the creator DOING the thing the result enables (walk/climb/cook…) —
//     a filmable, varied "show the result" beat, NOT a static talking-head reaction.
//   • isEndorsementLook = the "creator holds product beside face + thumbs-up/recommend" look,
//     which must be RESERVED for the CTA. Excludes the deliberate penult OFFER shot (which
//     says "OFFER moment / tapping / pointing") so capEndorsement never re-routes the offer.
const RESULT_BEHAVIOR_RE = /\b(walk|walking|climb|climbing|stair|strid|run|running|jog|bend|squat|lift|carr|danc|play(?:s|ing)?|cook|cooking|garden|reach(?:es|ing)?\s+up|moving freely|move(?:s)? freely|freely|effortless|pain-free|with ease|easily|relaxed)\b/i
// Catches the endorsement composition in ALL its phrasings — incl. the render-safe-hold
// "holds … presenting it clearly to the camera with a warm, confident smile" (the gap that
// left a present-to-camera shot on a non-CTA line). OFFER_LOOK_RE excludes the deliberate
// penult OFFER shot ("…to camera and tapping/pointing… the OFFER moment").
const ENDORSE_LOOK_RE = /thumbs[- ]?up|genuine endorsement|\brecommend|presenting\b[^.]{0,40}\bto (?:the )?camera|holds?\b[^.]{0,40}\bbeside (?:their|the) face/i
const OFFER_LOOK_RE = /offer moment|the deal|tapping|pointing/i
const isEndorsementLook = (cp: string): boolean => ENDORSE_LOOK_RE.test(cp) && !OFFER_LOOK_RE.test(cp)

function enforceProductHero(scenes: BrollScene[], product: Product | null | undefined): void {
  const lastIdx = scenes.length - 1
  const name = product?.productName?.trim() || 'the product'
  // (a) a clear DEMO-ACTION line → must SHOW that action, never a talking head.
  for (let i = 0; i < scenes.length; i++) {
    if (i === lastIdx) continue                 // CTA owned by the lock
    const s = scenes[i]
    if (s.role === 'mechanism3d') continue
    if (!DEMO_ACTION_RE.test(s.quote ?? '')) continue
    const isEating = EATING_ACTION_RE.test(s.quote ?? '')
    // Fix a lips/concept demo line always; ALSO fix an eating shot that isn't already
    // creator-framed (so a hands-only eating crop → the avatar's own face). A non-eating
    // shot that's already a product_action broll is left untouched (keep its concept).
    const needsFix = s.role === 'lips' || s.kind === 'concept' || (isEating && s.cameraFraming !== 'creator')
    if (!needsFix) continue
    s.role = 'broll'; s.kind = 'product_action'
    if (isEating) {
      // Eating → the AVATAR eats it herself, face visible (creator framing locks the
      // SAME person). Explicit concept so the model never renders a stray mouth/bowl.
      s.cameraFraming = 'creator'
      s.conceptPrompt =
        `The SAME creator takes a natural, appetising bite of ${name} herself — her face and hand clearly in frame, eating it, a satisfied look. ONE person (the creator), real UGC, natural light. NOT a disembodied mouth, NOT a separate floating bowl.`
    } else {
      s.cameraFraming = 'hands_noface'
      s.conceptPrompt = ''                       // weak → backfilled, grounded in this line
    }
  }
  // (b) P6f — cap only STATIC reaction-face concepts at 2 (a wall of talking-head faces is
  // the thing to avoid). A "result_behavior" concept (creator walking / climbing / cooking —
  // SHOWING the result) is filmable + varied, so it is NOT capped: that is exactly the
  // "show the result, don't restate the feeling" beat we want more of. (Was: capped ALL
  // concept cuts → starved result-behavior, pushing feeling lines back to a generic product
  // hold = the endorsement-collision root.)
  let staticFaceKept = 0
  for (let i = 0; i < scenes.length; i++) {
    if (i === lastIdx) continue
    const s = scenes[i]
    if (s.role !== 'broll' || s.kind !== 'concept') continue
    if (RESULT_BEHAVIOR_RE.test(s.conceptPrompt ?? '')) continue   // a "doing" concept → keep
    staticFaceKept++
    if (staticFaceKept > 2) {
      // P6af — over the static-face cap → DON'T force a product shot (that loses the emotion AND
      // breaks the reaction intent → intent/render mismatch). Keep it HUMAN: turn the static face
      // into an ACTIVE creator moment (a movement / gesture / real-life action acting out THIS
      // beat), still creator-framed, no product. Cuts the talking-head wall without going product.
      const beat = (s.quote ?? '').slice(0, 60).replace(/"/g, '')
      s.kind = 'concept'; s.cameraFraming = 'creator'
      s.conceptPrompt =
        `The SAME creator in a candid real-life moment ACTING OUT "${beat}" through what they DO — ` +
        `a concrete movement / gesture / everyday action in its real setting, body language carrying ` +
        `the beat — NOT a static talking-head face, NO product. Authentic UGC iPhone footage, natural light.`
    }
  }
}

// P6f Part B — the ENDORSEMENT archetype (creator holds product beside face + thumbs-up /
// recommend to camera) is the CTA's signature shot and must appear AT MOST ONCE. The CTA lock
// (+ penult OFFER shot) already own the close. ANY OTHER cut that the director / a backstop
// left reading as that same endorsement is a visual TWIN of the CTA (the #7≈#12 bug) → re-route
// it to a grounded NON-endorsement moment that SHOWS its own line's result. Skips the hook (0 —
// product establishment is intentional there) and the CTA (last). Runs AFTER enforceRenderSafeHolds
// (which itself can mint an endorsement-like hold), so nothing re-creates the twin afterwards.
function capEndorsement(scenes: BrollScene[]): void {
  const lastIdx = scenes.length - 1
  for (let i = 1; i < lastIdx; i++) {
    const s = scenes[i]
    if (s.role !== 'broll') continue
    if (!isEndorsementLook(s.conceptPrompt ?? '')) continue
    const beat = (s.quote ?? '').slice(0, 70).replace(/"/g, '')
    s.kind = 'concept'
    s.cameraFraming = 'creator'
    s.conceptPrompt =
      `The SAME creator in a real, candid everyday moment that SHOWS the result of "${beat}" through ` +
      `what they naturally DO (relaxed, free movement in its real-life setting) — NOT presenting the ` +
      `product to camera, NO thumbs-up, no posing. Authentic UGC iPhone footage, natural light.`
    s.reason = 'endorsement de-duplicated (reserved for the CTA)'
  }
}

// P5w — social-proof card guard (anti-abuse). A 'social_proof' scene is only valid on a
// genuine crowd/sold/review line; cap at 3, never the final CTA cut. Anything else →
// demote to a product broll (weak concept → backfilled). Universal cues (VN/EN/MS).
const SOCIAL_PROOF_CUE_RE = /ngh[ìi]n ng[ưu][ờo]i|ng[àa]n ng[ưu][ờo]i|m[oọ]i ng[ưu][ờo]i|ai (?:d[ùu]ng|mua)|nhi[eề]u ng[ưu][ờo]i|b[áa]n ch[aạ]y|ch[áa]y h[àa]ng|quay l[aạ]i mua|mua l[aạ]i|l[ưu][ợo]t (?:mua|b[áa]n)|ng[ưu][ờo]i (?:mua|đ[ặa]t)|5 sao|n[ăa]m sao|c[oộ]ng đ[ồo]ng|\b(?:sold|sold[- ]?out|repeat|viral|popular)\b|ramai|terjual|bintang|\blaku\b|semua orang|orang (?:beli|guna|pakai|cuba)/i
// STRICTER cue for PROMOTE only — clear THIRD-PARTY proof, NO lone "viral"/"popular"
// (those live in hooks). Requires a %, a people-count, repeat-buyers, or reviews/stars.
// BILINGUAL: VN + Malay parity (a MY script's proof line — "5 bintang", "ribuan orang
// dah beli", "ulasan/review", "terlaris" — must promote to the cheap card just like VN).
// P6r — bare "\d+%" REMOVED: it fired on a COMPOSITION claim ("100% thảo dược tự nhiên" /
// "pakai 100% herba") and mis-read it as "100% of buyers" → a product line became a proof
// card. A real "% proof" line (e.g. "95% người dùng hài lòng") now rides on the social_proof
// SHOT INTENT instead (the promote branch is intent-led below); this regex is only the
// no-intent fallback. "\d+ sao / bintang" (star ratings) stays — that IS proof.
const SOCIAL_PROOF_PROMOTE_RE = /ph[aầ]n tr[ăa]m|peratus|ngh[ìi]n ng[ưu][ờo]i|ng[àa]n ng[ưu][ờo]i|nhi[eề]u ng[ưu][ờo]i|ribu(?:an)?\s*orang|quay l[aạ]i mua|mua l[aạ]i|b[áa]n ch[aạ]y|ch[áa]y h[àa]ng|terjual|terlaris|\blaku\b|review|đ[áa]nh gi[áa]|ulasan|\d+\s*sao|n[ăa]m sao|\d+\s*bintang|\bbintang\b|ramai (?:beli|membeli|dah|guna|cuba)|orang (?:dah\s+)?(?:beli|guna|pakai|cuba)/i

// P5r2 — "applies to the BODY" detector for the no-face veto (runs on the ENGLISH
// conceptPrompt, so English-only is enough). A no-face / hands-only shot only works for a
// product used ON A SURFACE or as a HAND-HELD TOOL. The moment the product is applied to /
// worn on / eaten / drunk on a PERSON'S body (any part, head OR limb), dropping the head
// renders a DEFORMED head-less body — and it's a lazy dodge. Those MUST show the creator.
// Covers head-area + limbs/torso + wear/consume verbs (the gap the user flagged: knee
// brace / watch / snack-eaten / drink were NOT caught before — only head-area was).
const APPLIES_PRODUCT_TO_BODY_RE =
  /\b(?:neck|throat|nape|face|cheeks?|forehead|chin|jaw|lips?|mouth|teeth|gums?|tongue|hair|scalp|ears?|eyes?|eyelids?|nose|skin|chest|shoulders?|collar\s?bones?|d[ée]collet|back|waist|belly|stomach|tummy|arms?|elbows?|wrists?|knees?|legs?|thighs?|calf|calves|ankles?|foot|feet|nails?)\b|\b(?:wear|wears|wearing|worn|strap|straps|strapped|strapping|fasten(?:s|ed|ing)?|buckle[ds]?|wrap(?:s|ped|ping)?\s+around|eat|eats|eating|bite|bites|biting|chew|chews|chewing|drink|drinks|drinking|sip|sips|sipping|swallow|swallows|swallowing)\b/i
function capSocialProof(scenes: BrollScene[]): void {
  const lastIdx = scenes.length - 1
  const demote = (s: BrollScene) => {
    s.role = 'broll'; s.kind = 'product_action'; s.cameraFraming = 'hands_noface'; s.conceptPrompt = ''
  }
  // A native social_proof scene carries NO kind/framing/conceptPrompt (the FB-card image
  // is generated from the product) — match that shape when promoting.
  const promote = (s: BrollScene) => {
    s.role = 'social_proof'; s.kind = undefined; s.cameraFraming = undefined; s.conceptPrompt = undefined
  }
  // P6al — the 2ND strong proof beat does NOT become a 2nd FB-card (hard rule: max ONE card)
  // and is NOT wasted as a generic product shot. It becomes a "loved-by-many" CROWD broll: the
  // SAME creator proudly showing the product as a popular, trusted pick, with a warm busy feel
  // (a few blurred people around also enjoying it). We keep the single creator on purpose — a
  // CONCEPT_SCENE video locks the avatar for identity, so leaning into ONE focal creator avoids
  // a cloned-face montage. Universal VN / MS / EN (the render prompt is English).
  const crowdBroll = (s: BrollScene) => {
    s.role = 'broll'; s.kind = 'concept'; s.cameraFraming = 'creator'
    s.conceptPrompt =
      `The SAME creator, upbeat and proud, holding / showing THIS product to camera as a clearly ` +
      `LOVED, popular pick — a warm sense that MANY people already use and trust it (a friendly, ` +
      `busy everyday setting with a few softly-blurred people in the background also using/enjoying ` +
      `it). Authentic UGC energy, candid not staged. NO on-screen text, NO fake logos/badges. The ` +
      `product stays the recognisable hero — same packaging, do NOT redesign it.`
  }
  // P6j — AT MOST ONE social-proof card in the WHOLE video (user hard rule, every product/
  // niche/market). Gather every valid proof candidate, keep the SINGLE STRONGEST (a line
  // with clear THIRD-PARTY proof — %/people-count/repeat/reviews/stars), demote all the rest.
  // Candidates: a Gemini-tagged social_proof whose quote has ANY proof cue, OR a plain broll
  // whose quote has the STRICT third-party cue. Never the hook (0) or the CTA (last).
  const valid: number[] = []
  for (let i = 0; i < scenes.length; i++) {
    if (i === lastIdx) continue                              // CTA never a card
    const s = scenes[i]
    if (s.role === 'social_proof') {
      // P2 — trust Gemini's declared intent: a scene tagged role=social_proof AND
      // shotIntent=social_proof is a real proof beat even when the (rigid) cue regex
      // misses the phrasing ("Beribu orang dah cuba" — proof, but "orang" isn't
      // immediately followed by a verb so the cue failed and the line got wrongly demoted).
      if (i !== 0 && (s.shotIntent === 'social_proof' || SOCIAL_PROOF_CUE_RE.test(s.quote ?? ''))) valid.push(i)
      else demote(s)                                         // mis-tagged / hook → demote now
    } else if (s.role === 'broll' && i !== 0) {
      // P6r — INTENT-LED promote: a broll becomes a proof candidate ONLY when Gemini declared
      // social_proof intent (catches real proof the regex misses — "ramai repeat order, ramai
      // puji"). The strict regex is a FALLBACK for scenes with NO declared intent. A broll with
      // a NON-proof intent (product_macro on "100% thảo dược") is NEVER promoted → no false card.
      if (s.shotIntent === 'social_proof' || (!s.shotIntent && SOCIAL_PROOF_PROMOTE_RE.test(s.quote ?? ''))) valid.push(i)
    }
  }
  if (valid.length === 0) return
  // The ONE: a Gemini-declared social_proof INTENT wins first (regardless of array order, so a
  // real-proof scene beats an earlier regex-only match); else a strict third-party regex hit;
  // else the first valid candidate.
  const chosen = valid.find((i) => scenes[i].shotIntent === 'social_proof')
    ?? valid.find((i) => SOCIAL_PROOF_PROMOTE_RE.test(scenes[i].quote ?? ''))
    ?? valid[0]
  // P6al — if there is a SECOND genuinely-strong proof beat (not just any valid candidate), it
  // becomes the "loved-by-many" crowd broll instead of a 2nd card / a generic product shot. We
  // require real proof phrasing so a weak line never gets forced into a crowd scene.
  const second = valid.find((i) =>
    i !== chosen && (scenes[i].shotIntent === 'social_proof' || SOCIAL_PROOF_PROMOTE_RE.test(scenes[i].quote ?? '')),
  )
  for (const i of valid) {
    if (i === chosen) promote(scenes[i])
    else if (i === second) crowdBroll(scenes[i])                    // 2nd strong proof → crowd broll
    else if (scenes[i].role === 'social_proof') demote(scenes[i])   // extra cards → product broll
    // a non-chosen plain-broll candidate just stays a normal broll (never was a card)
  }
}

// ── Before/After split-screen (deterministic guarantee) ─────────────────────
// A transformation line (state AFTER using vs the problem BEFORE) MUST render as a
// SPLIT-SCREEN of the SAME creator (left = before-problem, right = after-improved) — the
// signature shot the app used to make but lost across refactors. The renderer's
// BEFORE_AFTER detector keys off "split-screen"+"before/after" in the conceptPrompt, so we
// just write that conceptPrompt here. Deterministic backstop on top of the prompt nudge;
// caps at 2 so the ad doesn't become a wall of split-screens. Skips hook(0) + CTA(last).
// P6x — before/after is a CONTRAST (a REVERSAL of a problem), NOT a bare result and NOT a bare
// problem. The old gate fired on ANY after/result token ("giờ thì", "sekarang dah", "sau 2 tuần",
// "kết quả") → it split pure-problem lines ("lutut aku selalu sakit") AND pure-result lines
// ("da sáng hơn sau 2 tuần") into a fake split (user audit: "mọi câu vấn đề thành before/after").
// Now a split needs EITHER (a) an explicit TIME contrast — a "before" word AND an "after" word in
// the SAME line, OR (b) a REVERSAL phrase — the problem stated as now-gone ("không còn / hết hẳn /
// dah takde / tak … dah / hilang"). A pure result → result_behavior; a pure problem → one problem
// moment. Universal VN / MS / EN.
const BA_BEFORE_RE = /h[ồô]i (?:tr[ưươ][ớơ]c|đ[óo]|x[ưươ]a)|tr[ưươ][ớơ]c (?:đ[âa]y|kia|khi)|l[úu]c tr[ưươ][ớơ]c|ng[àa]y (?:tr[ưươ][ớơ]c|x[ưươ]a)|d[ạa]o tr[ưươ][ớơ]c|\bdulu\b|masa (?:tu|dulu)|sebelum (?:ni|guna|pakai|tu)|\bused to\b|\bbefore\b/i
const BA_AFTER_RE = /gi[ờo] (?:th[ìi]|đ[âa]y|l[àa])|b[âa]y gi[ờo]|hi[ệe]n (?:t[ạa]i|gi[ờo])|\bnay\b|\bsekarang\b|\bkini\b|\bnow\b/i
const BA_REVERSAL_RE = /kh[ôo]ng c[òo]n|ch[ẳa]ng c[òo]n|h[ếe]t h[ẳa]n|đ[ỡo] h[ẳa]n|kh[áa]c h[ẳa]n|h[ếe]t (?:đau|[ùu]|ng[ứư]a|m[ệe]t|nh[ứư]c|h[ôo]i|g[àa]u|kh[ôo]|r[áa]t)|dah (?:takde|tak|kurang|lega|hilang|ok|baik|sembuh)|takde dah|tak\s+\w+\s+dah|\bhilang\b|\bno more\b|\bgone\b/i
const isBeforeAfterContrast = (q: string): boolean => {
  const t = q ?? ''
  return (BA_BEFORE_RE.test(t) && BA_AFTER_RE.test(t)) || BA_REVERSAL_RE.test(t)
}
const SPLIT_ALREADY_RE = /split[- ]?screen|before.{0,8}after/i

function enforceBeforeAfterSplit(scenes: BrollScene[], script: GeneratedScript): void {
  const painCue = (
    script.blocks.find((b) => b.id === 'pain')?.text
    ?? script.blocks.find((b) => b.id === 'hook')?.text
    ?? 'the earlier discomfort'
  ).slice(0, 80).replace(/"/g, '')
  let made = 0
  for (let i = 1; i < scenes.length - 1 && made < 2; i++) {   // never hook(0) / CTA(last)
    const s = scenes[i]
    if (s.role !== 'broll') continue                          // not lips / 3D / social_proof
    if (!isBeforeAfterContrast(s.quote ?? '')) continue       // P6x — only a real before↔after reversal
    if (s.conceptPrompt && SPLIT_ALREADY_RE.test(s.conceptPrompt)) { made++; continue }  // director already split it
    s.kind = 'concept'
    s.cameraFraming = 'creator'
    s.conceptPrompt =
      `Split-screen (LEFT | RIGHT). CRITICAL — it is ONE SINGLE person: the SAME face / same identity / ` +
      `same individual on BOTH halves (a before-vs-after of the SAME person, NOT two different people, ` +
      `NOT siblings) — they differ ONLY in outfit + state. ` +
      `The SAME creator on BOTH halves but a COMPLETELY DIFFERENT ` +
      `outfit on each half — different top, different bottoms, and different headwear/hairstyle ` +
      `if any (two different days). LEFT = BEFORE: the problem in a concrete moment (the ` +
      `situation in "${painCue}") — visibly uncomfortable / the un-improved state. RIGHT = AFTER: ` +
      `the OPPOSITE — the SAME person in the RESOLVED state, shown through the ACTION/look that ` +
      `fits THIS product (infer it: e.g. moving/walking freely for a pain·joint product; touching ` +
      `clear glowing skin at the mirror for skincare; light + energetic for a supplement; full ` +
      `shiny hair for haircare; a confident bright smile for teeth). Demonstrate the result as a ` +
      `concrete ACTION/state that REVERSES the before — NOT a passive seated smile. No on-screen text.`
    s.reason = 'before/after split (enforced)'
    made++
  }
  // P6x — INVERSE backstop: Gemini sometimes splits a line that is NOT a real reversal — a bare
  // PROBLEM line ("lutut aku selalu sakit") OR a bare RESULT line ("da sáng hơn sau 2 tuần") — and
  // invents a contrast the line never claimed (the user's "mọi câu vấn đề bị ép before/after" bug).
  // Any split whose quote is NOT a real before↔after contrast → DROP the split and leave the concept
  // WEAK so backfillWeakConcepts (runs next) grounds ONE shot in the line's actual MEANING: a problem
  // line → a problem moment; a result line → the creator doing the positive thing. (Hardcoding
  // "living the problem" here was wrong — it made a positive result line render as suffering.)
  for (let i = 1; i < scenes.length - 1; i++) {
    const s = scenes[i]
    if (!s.conceptPrompt || !SPLIT_ALREADY_RE.test(s.conceptPrompt)) continue
    if (isBeforeAfterContrast(s.quote ?? '')) continue   // genuine reversal/contrast — keep the split
    s.kind = 'concept'
    s.cameraFraming = 'creator'
    s.conceptPrompt = ''   // weak → grounded by meaning (problem vs result) in backfillWeakConcepts
    s.reason = 'before/after stripped — not a real contrast (single moment, grounded by meaning)'
  }
}

// ── Public: plan a full-coverage hybrid shot list ───────────────────────────
// Phase A — total product units a SPOKEN buy-X-get-Y offer implies (X + Y), parsed from the
// script text (what the viewer hears), capped at 4 (more identical units = i2v drift from one
// reference). Returns 1 when no quantified offer is found. Universal VN / MS / EN, DIGITS only
// (word-numbers fall back to 1 → never renders a wrong larger count). Picks the LARGEST match.
const OFFER_QTY_PATTERNS: RegExp[] = [
  /\bmua\s+(\d+)\s+(?:đư[ơợ]c\s+)?(?:th[eê]m|t[aặ]ng|k[eè]m)\s+(\d+)/gi,   // mua 1 (được) thêm/tặng/kèm 2
  /\bbeli\s+(\d+)\s+(?:dapat|free|percuma)\s+(\d+)/gi,                      // beli 1 dapat/free/percuma 2
  /\bbuy\s+(\d+)\s+(?:get|free)\s+(\d+)/gi,                                 // buy 1 get/free 2
]
export function parseOfferQty(text: string): number {
  const t = text ?? ''
  let best = 1
  for (const re of OFFER_QTY_PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(t)) !== null) {
      const x = parseInt(m[1], 10), y = parseInt(m[2], 10)
      if (Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0) best = Math.max(best, x + y)
    }
  }
  return Math.min(4, Math.max(1, best))
}

export async function directBrollScenes(
  params: BrollDirectorParams,
): Promise<BrollDirectorResult> {
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang]
  const dur = Math.round(params.voiceDurationSec || params.script.totalDurationSec || 50)
  const lipsCount = lipsCountForDuration(dur)
  const minScenes = densityFloor(dur)
  const productContext = buildProductContextBlock(params.product)
  const scriptDump = params.script.blocks.map((b) => `[${b.id}] ${b.text}`).join('\n')
  // P5m — the anchor (the ONE memorable reason/number) gets a HERO cut + a sticker;
  // the OFFER lands as a sticker at the CTA so the deal is visible, not just spoken.
  const anchorHint = params.script.anchor?.trim()
    ? `\n\nANCHOR — the ONE memorable reason/number this script drives home: "${params.script.anchor.trim()}". Give it a clear HERO cut in the FIRST HALF (the spec / number / result shown BIG + clean, a real product shot) and reinforce it at the CTA. Put a STICKER on the anchor (the spec / number / result — NEVER a price / money amount). At the CTA, sticker the OFFER ONLY if the script actually states one (e.g. "Beli 1 Free 1") — NEVER a price / "-50%" / money sticker (price is never shown).`
    : ''
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

  // P4l — sticker register for Malaysia. The universal sticker rule says "no
  // P6p — sticker feature removed; msStickerHint deleted.

  const systemInstruction = `You are a senior UGC ad video DIRECTOR cutting a ${dur}-second TikTok ad written
in ${langName}. There is NO continuous talking-head — you build the WHOLE video as
a SEQUENCE of full-screen cuts that together COVER EVERY SECOND of the voice, with
NO gaps and no dead air. Read the actual script + the product, and direct like a
real creator. The product can be ANYTHING (gadget, tool, cosmetic, food, apparel,
appliance, accessory…) — never assume a niche.${productContext}

FOUR cut ROLES (set "role"):
1. "lips" — the creator ON CAMERA saying a specific line (face visible, will be
   lip-synced to that exact voice span). Give the "quote" (verbatim spoken line) — a
   lips cut is a SHORT line (~3-5s of speech). NO conceptPrompt needed.
   *** Use AROUND ${lipsCount} lips cuts. SPREAD them so the creator's face re-appears
   through the MIDDLE and carries the trust thread. The OPENING does NOT have to be a
   lips cut — the first ~3s must show a FACE (scroll-stop), but that face can be the
   creator HOLDING the product (see the OPENING rule), not necessarily a lip-synced
   shot. The very last CTA/buy line is NOT a lips cut (it is the product-endorsement
   shot, see RULES). ***
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
         This ALSO covers the SETUP-side / TENSION feelings, not only the happy
         payoff: a CRAVING / desire, a WORRY / fear, a HESITATION, a FRUSTRATION,
         an OBJECTION, or the lived "before" struggle. Whenever a line says what the
         person WANTS, FEARS, or HESITATES over, that is a "concept" creator beat —
         show the human living that tension, NOT a product macro. E.g. "thèm đồ ngọt
         mà sợ đường lên" / "nak makan manis tapi takut gula naik" = a craving-vs-fear
         beat → the creator EYEING a tempting treat then pulling back, conflicted (no
         product packaging needed). cameraFraming:"creator".
     • LINE-MEANING → SHOT (the ~2/3 of lines that have NO explicit action — NEVER default
       them to "creator holding the product + smile"):
         - a RESULT / FEELING line ("lutut ringan, tak sakit", "so comfy now", "confident") →
           show the RESULT as observable BEHAVIOUR: the creator DOING what the result enables
           (walking / climbing stairs / squatting / cooking / playing — relaxed, pain-free),
           cameraFraming:"creator". NOT a thumbs-up, NOT holding the product up to camera.
         - a SPEC / CLAIM / how-it-works line ("tiga spring booster", "bernafas") → show the
           REASON: a product macro / a hero part / a 3D mechanism (cameraFraming:"hands_noface").
         - a pure SUMMARY / verdict line ("senang cerita, memang selesa sangat" / "long story
           short") = NOT its own shot (no new visual). FOLD it onto the neighbouring beat — do
           NOT invent a separate "creator + product + smile" cut for it.
       RULE OF THUMB: show the RESULT (behaviour) or the REASON (mechanism) — NEVER restate the
       feeling with a generic product-hold. The "creator holds product up + smile / thumbs-up"
       ENDORSEMENT shot is RESERVED for the CTA only; do NOT use it on any other line.
     • "cameraFraming": "hands_noface" — ONLY for a product used ON A SURFACE or held/
       operated IN-HAND (scoop from a jar, pour, snap, wipe a counter, operate a gadget),
       NO face. For any usage ON THE BODY (apply / wear / eat / drink — skin, face, hair,
       neck, knee, wrist…) use "creator": the person actually doing it, FACE VISIBLE (a
       head-less body renders deformed). Also "creator" for reaction / emotion / human-
       payoff beats.
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
   PHYSICAL SIMPLICITY (anti-drift): describe ONE simple, physically-plausible action per
   cut, in ONE clause — something a phone can actually film in 2-4s (a hand picks it up, a
   finger taps it, a person takes one step). Do NOT stack two actions, fast/complex motion,
   or an abstract verb ("demonstrates the benefits", "shows how amazing") — vague/compound
   motion is what makes the video model hallucinate/morph. Concrete + single + slow.
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
   *** INCLUDE AT LEAST ONE when the script genuinely has the material: if the PRODUCT
   BRIEF names an active / ingredient / material AND a script line EXPLAINS how it works
   INSIDE the body / skin / device, that line SHOULD become a mechanism3d cut — it is the
   signature "how it works inside" shot that sells an ingredient / mechanism product
   (supplement / skincare / health / any product with a real internal mechanism). Do NOT
   skip it for those products — it is their strongest differentiator. ***
   Use 1-3 per video (lean toward more for an ingredient/mechanism-heavy product). Each 3D cut
   MUST show the CORRECT body SITE for THIS line's mechanism — DERIVE the site from the meaning,
   NEVER a generic impressive organ (a beating HEART for a digestion/fibre line is WRONG → that's
   the gut). SITE MAP (representative — infer the rest the same way; VN/MS/EN):
     • tiêu hoá / chất xơ / nhuận tràng / lợi khuẩn / đầy hơi (pencernaan/serat/probiotik) → dạ dày + RUỘT
     • huyết áp / tuần hoàn / cholesterol / Kali·Magnesium (tekanan darah/kolesterol) → MẠCH MÁU cắt ngang (tim CHỈ khi nói nhịp tim)
     • da / collagen / nám / nếp nhăn / Vitamin C / dưỡng ẩm (kulit/kolagen/kedut) → LỚP DA (collagen, lỗ chân lông)
     • khớp / sụn / xương / glucosamine (sendi/rawan/tulang) → KHỚP GỐI cắt ngang (sụn, dịch khớp)
     • gan / giải độc / men gan (hati/detoks) → GAN · thận (buah pinggang) → THẬN
     • mắt / thị lực (mata) → MẮT · tai / thính giác / ù tai (telinga/pendengaran) → ỐNG TAI + tai trong
     • não / trí nhớ / tập trung / ginkgo (otak/ingatan) → NÃO (nơ-ron, máu lên não)
     • miễn dịch / đề kháng (imun) → tế bào miễn dịch diệt mầm bệnh · năng lượng / chuyển hoá (tenaga) → tế bào sáng (ty thể)
     • dạ dày / axit / trào ngược (gastrik) → niêm mạc dạ dày · đường huyết (gula darah) → tế bào hấp thu đường
     • răng / nướu (gigi/gusi) → răng + men + nướu · tóc / nang tóc (rambut) → nang tóc + da đầu · phổi / xoang (paru) → đường thở
   A SYNTHETIC active with NO body site (collagen/peptide/HA…) → the PRODUCT hero + its molecules orbiting (not an organ).
   A NON-BODY product (device / appliance / cleaner / pest) is NOT anatomy — its "3D" is the DEVICE's internal working
   (convection airflow in a fryer, suction path, EMS pulse + heat into the muscle layer, water through a filter) or a
   surface action, NEVER an organ. SITE UNCLEAR → a neutral premium 3D (active particles + product hero), never a guessed organ.
   Do NOT 3D a line that's just a NAMING/benefit/result ("giàu Kali" = a product close-up + sticker, NOT 3D), and never
   exceed ~3 — don't turn it into a science reel. ONLY skip 3D entirely when the product genuinely has NO internal
   mechanism (a simple gadget / tool / apparel / accessory).
4. "social_proof" — ONLY for a genuine SOCIAL-PROOF line: a crowd/popularity, a sold
   count, repeat buyers, or reviews — "mấy nghìn người mua rồi", "ai dùng cũng quay lại",
   "review toàn 5 sao", "bán cháy hàng", "nhỏ bạn mình dùng cũng mê". Renders as a
   realistic Facebook-post / review screenshot (handled by the app — NO conceptPrompt
   needed, just the "quote"). Use AT MOST ~2 (3 absolute max) per video, ONLY on real
   social-proof lines. NEVER for a product / benefit / demo / pain line (those stay
   broll/lips), and NEVER make the final CTA cut a social_proof card.

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
- BLOCK ROLE → DEFAULT VISUAL INTENT (a soft BIAS to help role/kind selection, NOT a lock):
  every line above is tagged with its block — [hook] / [pain] / [discovery] / [benefit] /
  [cta]. When the LINE ITSELF is ambiguous about what to show, lean on the block's default:
    • [pain]      → the problem / before-state moment, usually on a person (creator).
    • [discovery] → the product being used + how it works (product_action / product_closeup,
                    or mechanism3d for a genuine internal process).
    • [benefit]   → the RESULT lived on a person (the after-state, creator) — film the human
                    payoff, not the packaging.
    • [cta]       → product endorsement (already enforced).
  ⚠ THE QUOTE ALWAYS WINS — this is a DEFAULT, never an override of the line. If a [benefit]
  line is actually about a mechanism / feature / spec → make it product_closeup / mechanism3d
  (NOT a person). If a [discovery] line is actually a felt RESULT on a person → make it a
  creator concept cut (NOT a product shot). Read the line first; use the block lean only to
  break a tie.
  ⚠ DIVERSITY UNCHANGED — this biases role/kind PER LINE, it does NOT make a whole block one
  shot type. Cuts inside the SAME block still MIX creator / concept / product_action /
  product_closeup as each line demands, and NO-TWO-CUTS-ALIKE still holds across the video.
- CREATOR IDENTITY IS LOCKED DOWNSTREAM — NEVER describe WHO the creator is. Any conceptPrompt
  that shows a person MUST refer to them as "the same creator from the avatar reference" (or
  "the same person from the avatar reference") and MUST NOT invent or state their GENDER, AGE,
  ETHNICITY, body type, or looks. Lines like "a Malaysian man in his early 30s" / "a woman in
  her late 20s" are FORBIDDEN — the avatar reference supplies identity at render; if you name a
  gender/age you will CONTRADICT the real avatar (a female avatar rendered as a man). You MAY
  and SHOULD still describe what the person DOES + their EMOTION + the SETTING (that is the
  visual density) — just never who they are.
- PRODUCT IDENTITY IS LOCKED DOWNSTREAM — NEVER describe the product's PACKAGING APPEARANCE in
  a conceptPrompt: no colour ("red tube"), no shape/form ("tube / bottle / jar / squat"), no
  label text, no "black/white text", no on-pack graphics. The product's EXACT look is pinned by
  the reference photo + the PRODUCT LOCK at render — if you ALSO describe it in words, the model
  invents its OWN package and you get the SAME product drifting into 3 different shapes across
  cuts (the user audited this). Refer to it ONLY as "the product" (or its spoken name) and
  describe just the ACTION, the part/texture being shown, the setting, and the ingredients
  around it. (Same rule as the creator: describe what's DONE, never the IDENTITY.)
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
  near-duplicate "(slightly different angle)" of the same shot — i2v renders
  duplicates as visually-identical clones.
- ⛔ HARD RULE — NO TWO CUTS ALIKE (across the WHOLE video, face OR no-face): every
  scene's conceptPrompt MUST render a VISUALLY DISTINCT image from EVERY other cut —
  a different SHOT TYPE + ACTION + framing + setting, not merely a new camera angle.
  This holds EVEN when several lines repeat the SAME idea (multiple "after / result /
  feels-great" lines) or a line is long. For a REPEATED idea, show a DIFFERENT VISUAL
  FACET each time, e.g.: result #1 = the physical result in MACRO close-up (skin / hair
  / teeth / the relevant body part), #2 = the creator's GENUINE REACTION (face), #3 = a
  real LIFESTYLE moment the result enables, #4 = the PRODUCT resting in its setting.
  Two cuts that would look the same in the final video = a bug. Make every prompt earn
  its own distinct frame.
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
- REAL USAGE, NEVER A DODGE: if the product is APPLIED to / WORN on / EATEN / DRUNK on the
  body (cream-serum on skin/face, a brace on a knee, a watch on a wrist, a snack eaten, a
  drink sipped, a pill taken), the demo cut MUST show the CREATOR actually doing it on
  THEMSELVES — face/person visible — NOT merely "holding" it, and NEVER a head-less
  hands-only shot (a body part with no head renders deformed). "hands_noface" is ONLY for a
  product used on a SURFACE or a HAND-HELD TOOL (scoop from a jar, operate a gadget, wipe a
  counter, pour). For wearables/edibles/topicals → cameraFraming "creator", real action.
- LIPS SPACING (HARD RULE): NEVER put two "lips" cuts back-to-back. Every lips cut
  MUST have AT LEAST ONE broll cut between it and the next lips. It is GREAT to run 2,
  3, even 4 broll cuts between two lips cuts — a broll-heavy ad showing the product
  sells harder. Do NOT fall into a mechanical 1:1 "lips, broll, lips, broll" metronome.
  Think: a FEW lips anchors spread out, with rich broll RUNS between them.
- SHOW THE PROOF (demonstrable cut): when a line is a PROOF beat — "lúc đầu tôi cũng
  nghĩ… ai dè…" (skeptic→convert), a before→after, a "để tôi quay cho coi / cắm vô thử"
  demonstration, or a bystander reaction ("nhỏ bạn hỏi đổi gì") — render it as a
  DEMONSTRABLE broll that VISUALLY PROVES it: the real action / the result happening on
  camera / the before-vs-after, NOT a generic product close-up. Keep the action SIMPLE
  + filmable (ONE clear move) so the render lands it. If the proof carries a number /
  spec, that cut is a great spot for a number sticker.
- THE PRODUCT IS THE HERO (this is a PRODUCT ad, NOT a model reel). The MAJORITY of
  cuts MUST show the product — in use, its texture, the pack, or the result WITH the
  product in frame. The creator's face is the TRUST thread (the hook, a few lips, the
  CTA) — NOT the main subject. Do NOT turn most payoff lines into face-only "feeling"
  shots; show the PRODUCT delivering that result instead. Face-only / feeling-only cuts
  (kind:"concept", no product on screen) are CAPPED at ~2 in the entire video.
- APPETITE / USAGE / SENSORY lines (eating, biting, texture, taste, smell, applying,
  spraying, sprinkling, using) → ALWAYS a product BROLL showing that exact action (a
  mouth-watering close-up for food; the apply/use moment for others), NEVER a "lips"
  talking-head. Lips cuts are reserved for talk / confession / transition lines only —
  never waste an eating/usage moment (the most product-selling shot) on a face.
- RENDER-SAFE POSES (the video model BOTCHES hands holding loose objects → a "floating
  bowl / detached object" — the #1 visible artifact). For ANY hold / present / hero /
  CTA shot, the creator holds the PRODUCT ITSELF in ONE simple, clearly-SUPPORTED grip
  (both hands on it, or one hand gripping it firmly against the body). NEVER a pose
  where a CONTAINER (bowl / plate / tray / cup) is held in one hand while the OTHER
  hand reaches into it; NEVER loose contents balanced in an open palm; NEVER an object
  floating with no visible support. Universal — whatever the product is, present the
  PRODUCT itself, simply and firmly held. (Loose-product usage — sprinkling, pouring,
  dipping — is fine as a hands-on-a-SURFACE shot, just never "held + reached into".)
- OPENING / ESTABLISH THE PRODUCT EARLY:
    • The first ~3s must show a real HUMAN FACE (scroll-stop) — but a face does NOT
      require a "lips" cut.
    • If the HOOK (first line) NAMES the product, the OPENING cut SHOWS the product:
      role:"broll", kind:"product_action", cameraFraming:"creator" — the creator
      holds / presents the product to camera (face AND product together). Do NOT open
      on a bare face while the voice names a product the viewer cannot see.
    • Only if the hook LEADS WITH A PROBLEM and does NOT name the product may the
      opening be a bare face / problem-concept (the product is revealed a beat later).
    • The product MUST appear on screen WITHIN THE FIRST THIRD — never keep naming a
      product for many cuts without ever showing it.
- DEICTIC (point-at): any line that points AT the product — "cái lọ này", "em này",
  "nó đây", "cái này", MS "botol ni / produk ni" — MUST show the product on that cut
  (kind:"product_action"/"product_closeup"), NEVER a bare face: "này / đây / ni" means
  the viewer should be looking AT the thing right then.
- CORRECT ORIENTATION: if the PRODUCT CONTEXT above lists a "CORRECT ORIENTATION"
  (a brace / strap / mask / insole / device with a right-vs-wrong way to wear or
  place it), EVERY wear / put-on / placement / demo conceptPrompt MUST spell out
  that exact orientation (which part faces / sits where, what lines up) so the
  render never shows it worn BACKWARDS. Copy the orientation detail into the
  conceptPrompt itself — the video model only knows what the prompt says.
- The CTA / buy line MUST show the PRODUCT in frame with an endorsing gesture — the
  creator holding/presenting the product and a thumbs-up / nod / offering it to camera
  (set role:"broll", kind:"product_action", cameraFraming:"creator", AND write its
  conceptPrompt describing exactly that endorsement shot). NEVER end on a bare
  talking-head with no product — the viewer must see the product at the call to buy.
- FELT-BENEFIT / RESULT lines (the laddered payoff the script now leads with — "người nhẹ
  hẳn, đỡ mệt mỏi nặng đầu", "ngủ ngon, sáng dậy khỏe re", MS "rasa ringan, tak penat
  lagi", "tidur lena") → FILM THE PERSON LIVING THAT RESULT: a relatable BEFORE→AFTER
  micro-beat or the after-state itself (was tired / heavy → now light, energetic, relieved,
  smiling), role:"broll" kind:"concept" cameraFraming:"creator", NOT a product close-up.
  This is the cut where the viewer SEES the benefit, not just hears it. (Universal: a tire
  pump "hết kẹt giữa đường" → a relieved driver back on the road; a serum "da hết khô căng"
  → a confident glance in the mirror.)
- APPETITE (edible products): a taste / "ngon" / craving line → the creator taking a
  satisfied BITE + happy reaction (their OWN face in frame, creator-framing), or a close
  appetising macro of the food — never a static jar. The bite shot sells the craving.
- RAW INGREDIENT HERO — when a line NAMES the real ingredients the product is MADE of, show the
  ACTUAL named ingredients as a macro hero beside / tumbling around / being added to the product,
  NOT just a packaging close-up with text. STRICT GROUNDING (anti-hallucination — a content rule):
    • Show ONLY the ingredients NAMED in THIS line or the PRODUCT BRIEF — map each to its REAL
      visual source: Curcumin → turmeric root + golden powder; Arnica → arnica daisy flowers;
      Ginkgo → ginkgo leaves; Emu / olive oil → oil drops or a small oil bottle; collagen /
      glucosamine → fine powder or a capsule. NEVER invent or show a fruit / food / plant /
      product that is NOT named in the brief — do NOT borrow a snack or fruit from another
      product (e.g. do NOT put "hawthorn / apricot / a snack fruit" on a joint gel).
    • A SYNTHETIC / compound active with NO real plant form (glucosamine, chondroitin, MSM,
      collagen, peptide, hyaluronic acid, niacinamide, a lettered vitamin…) is NOT a powder macro
      (a spoon of white powder reads like flour — meaningless). Make it a 3D beat instead: set
      role="mechanism3d", and write the conceptPrompt as the PRODUCT as hero in the centre with the
      active's glowing molecules / particles flowing & orbiting around it (premium science look) —
      NOT a flat powder, NOT inside a body. Only a NATURAL ingredient with a real visible form
      (ginger, turmeric root, leaves, flowers, seeds, fruit, honey…) uses the real-ingredient MACRO
      hero above.
    • Only an EDIBLE product (food / drink / snack) gets the "fresh, appetising, on a board" look.
      A NON-edible product (gel / cream / serum / device / supplement) shows the botanical SOURCE
      or the active in powder / oil / capsule form beside the product — NEVER an appetising food plate.
  Keep the ingredient NAME as a sticker. DISTINCT from a 3D cut (the ingredient ACTING inside the
  body) and from a plain packaging close-up — here we SEE the real ingredients. cameraFraming:"hands_noface".
- STYLIZED ACTIVE (TPCN / cosmetics — the ingredient is an ABSTRACT substance with NO real-world
  object: peptide, collagen, hyaluronic acid, niacinamide, a vitamin/mineral complex, glucosamine,
  probiotics, zinc…): when such an active is just NAMED (NOT "acting inside the body" — that case
  is the 3D cut), render a PREMIUM stylized macro of the active's FORM — a serum / oil DROPLET with
  glowing suspended molecules or particles, a CAPSULE / tablet cross-section revealing the actives,
  a fine POWDER swirl, or glossy gel beads — the "science-beauty" shot, NOT a flat packaging
  close-up + text. Keep the active NAME as a sticker. (Real natural source → RAW INGREDIENT HERO;
  active ACTING inside the body → 3D mechanism; abstract active just named → this.) cameraFraming:"hands_noface".
- BEFORE/AFTER SPLIT-SCREEN (MANDATORY for a transformation line): when a line describes the
  state AFTER using the product vs the problem BEFORE — a result / "sau khi dùng" / "giờ thì…" /
  "trước… giờ…" / "lepas pakai" / "selepas N hari" / a visible improvement — render that cut as
  a SPLIT-SCREEN: role:"broll", kind:"concept", cameraFraming:"creator". The conceptPrompt MUST
  contain the words "split-screen" + "before/after" and read: "Split-screen, the SAME creator
  (SAME face) on BOTH halves but a COMPLETELY DIFFERENT outfit on each half — different top,
  bottoms, and headwear/hairstyle if any (two different days). LEFT = BEFORE (the problem in a
  concrete moment — uncomfortable / the un-improved state). RIGHT = AFTER (the OPPOSITE — the
  SAME person resolved, shown through the action/look that fits THIS product)." The AFTER must
  show the result as a concrete ACTION/state that REVERSES the before — never just sitting and
  smiling — and you INFER the right action from the product (moving/walking freely for a pain·
  joint product; touching clear glowing skin for skincare; light + energetic for a supplement;
  full shiny hair for haircare; a confident bright smile for teeth — NEVER hardcode one niche).
  Only the FACE is identical across the two halves; everything worn differs. No on-screen text.
  TRIGGER GUARD (critical — do NOT over-apply): use the split-screen ONLY when the LINE ITSELF
  states a visible AFTER / result (an improvement you can SEE — "giờ thì…", "sau khi dùng", "lepas
  pakai", "selepas N hari", "dah lega/hilang"). A pure PROBLEM / PAIN line that only describes the
  struggle, symptom, or "before" state — with NO resolution stated in that SAME line — is NOT a
  before/after: render it as a SINGLE problem moment (the BEFORE only, no split), and NEVER invent
  an "after" half the line never claimed. A bare sequencing word ("lepas tu", "rồi", "then", "habis
  tu", "selepas itu") is NOT an after-state signal.
- Universal: infer setting/usage from the product context; never hardcode a niche.${anchorHint}

SHOT INTENT (set "shotIntent" on EVERY scene) — the ONE archetype that matches THIS line's
meaning. Pick exactly one:
  • "lips" — creator talking on camera (a lips cut).
  • "product_demo" — the product being USED/held in its real setting (an action with it).
  • "product_macro" — a clean close-up / texture / one spec detail of the product (no person).
  • "mechanism3d" — a 3D animation of how an ACTIVE works INSIDE the body/skin/device.
  • "result_behavior" — the creator DOING what the result enables (walking/cooking/relaxed/sleeping well) — a felt RESULT shown as behaviour, NOT holding the product.
  • "reaction" — the creator's pure EMOTION to this beat (skeptic / craving / worry / delight), no product on screen.
  • "before_after" — a split-screen transformation (only when the line states a visible after/result).
  • "social_proof" — a crowd / sold-count / repeat / review line (renders as a card).
  • "offer" — the deal/offer beat just before the close.
  • "endorsement" — the FINAL CTA shot: creator holds the product up + thumbs-up.
This must AGREE with the role/kind you chose (e.g. a feeling/result line → "result_behavior" or
"reaction", NOT a product hold; a spec/ingredient line → "product_macro" or "mechanism3d"; the
LAST buy line → "endorsement"). It is a LABEL of the line's meaning — be honest, do not default
everything to "product_demo"/"endorsement".

SCRIPT (cover all of it):
${scriptDump}

OUTPUT strict JSON only (no markdown fences):
{ "scenes": [ {"role":"lips","quote":"…","durationSec":4,"shotIntent":"lips"}, {"role":"broll","quote":"…","durationSec":5,"kind":"product_action","cameraFraming":"hands_noface","conceptPrompt":"…","shotIntent":"product_demo"} ] }`

  const call = (schema = true, denserHint?: { have: number; want: number }) =>
    directGeminiText({
      apiKey: params.geminiKey,
      systemInstruction,
      prompt: denserHint
        ? `Your last plan had only ${denserHint.have} cuts for a ${dur}s video — too sparse; a few ideas were merged into one long cut. Re-plan with about ${denserHint.want} cuts (a bit more is fine if it feels natural): give EACH distinct beat its own visual (new action / angle / detail grounded in that line). Keep the hook + callouts as fast 2-3s cuts; the main demo / reveal / CTA at 4-${MAX_BROLL_SEC.toFixed(0)}s. Cover every second. Return the JSON.`
        : 'Plan the full-coverage hybrid shot list now. Return the JSON.',
      maxOutputTokens: 4096,
      // P6ac — back to 0.7 (user): testing phase done, now favour CREATIVE VARIETY — each
      // "Đạo diễn lại" gives a genuinely different carve/concepts. Trade-off (known + accepted):
      // less reproducible per re-roll. The intent-spine + deterministic layers still keep the
      // result on the rails; only the surface variety widens.
      temperature: 0.7,
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
  // P4n — only re-roll when GENUINELY sparse (< floor − 2), not on a 1-2 cut miss.
  // The deterministic density floor (enforceDensityFloor) backstops the small gap
  // by splitting long cuts, so a 2nd full director call (a whole extra Gemini call)
  // isn't worth it for a near-miss. Saves ~1 call/run on the common case.
  const rerollThreshold = minScenes - 2
  for (let attempt = 1; attempt <= 1 && scenes.length < rerollThreshold; attempt++) {
    // eslint-disable-next-line no-console
    console.log(`[BROLL_DIRECTOR] plan thưa (${scenes.length}<${rerollThreshold}) — re-roll cho dày hơn`)
    const raw2 = await call(true, { have: scenes.length, want: minScenes })
    const parsed2 = tryParse(raw2)
    if (parsed2) {
      const scenes2 = enforceLipsCount(sanitizeScenes(parsed2.scenes), lipsCount)
      if (scenes2.length > scenes.length) { scenes = scenes2; parsed = parsed2 }
    }
  }
  // P5l — no two "lips" cuts adjacent (≥1 broll between lips). Runs after the lips
  // ladder + any re-roll, before establish/CTA (those only convert lips→broll, never
  // re-introduce adjacency) so the flipped cuts get backfilled below.
  separateLipsRuns(scenes)
  // separateLipsRuns may DEMOTE an adjacent lips → re-top-up so the ladder count (e.g. 3
  // lips) is GUARANTEED even after de-adjacency (the adjacency-guard in enforceLipsCount
  // keeps the re-added lips spread, so this won't re-create a run).
  scenes = enforceLipsCount(scenes, lipsCount)

  // P4h — product establishment + deictic (deterministic backstop to the Layer-1
  // prompt): the hook / early lines that NAME or POINT AT the product must SHOW it,
  // so the product is never invisible while the voice keeps naming it. Runs before
  // the CTA lock (the CTA owns the last cut) and before backfill (fills any concept).
  applyProductEstablishRules(scenes, params.product)

  // CTA visual guarantee — the LAST cut is the buy line; lock it to the standard
  // product endorsement (creator + product + thumbs-up) so the call-to-buy always
  // shows the product, regardless of what the model wrote for that scene.
  const giftOn = !!(params.gift?.enabled && params.gift.imageRef)
  const lastScene = scenes[scenes.length - 1]
  if (lastScene && lastScene.role === 'broll') {
    lastScene.kind = 'product_action'
    lastScene.cameraFraming = 'creator'
    if (giftOn) {
      // Phase A (option C) — creator holds the PRODUCT and the GIFT, one in each hand,
      // both presented to camera. HARD product lock — two SEPARATE objects, never merged.
      lastScene.giftRef = params.gift!.imageRef
      lastScene.conceptPrompt =
        'The creator holds the PRODUCT in one hand and the FREE GIFT in the other, presenting BOTH up to camera with a warm smile and a nod — a genuine endorsement at the call to buy. CRITICAL: the product and the gift are TWO SEPARATE, DISTINCT objects held apart — do NOT merge, blend, swap, or restyle either one; keep each exactly as in its reference. No on-screen price or numbers.'
    } else {
      lastScene.conceptPrompt =
        'The creator holds the product up beside their face and gives an enthusiastic thumbs-up to camera, smiling — a genuine endorsement at the call to buy.'
    }
  }

  // P5o — when the CTA spans the LAST TWO scenes (two buy/offer lines), the single
  // lock above left BOTH reading as the same thumbs-up endorsement (the user audited
  // "#14 và #15 gần trùng"). Give the PENULTIMATE buy scene a DISTINCT OFFER shot
  // (product hero + the deal called out) so the close reads OFFER → ENDORSE, not two
  // identical thumbs-ups. Only fires when that scene is a broll AND its quote is a
  // buy/offer line (a CTA-block line), so a normal benefit penultimate is untouched.
  // P6aw — the penult CTA cut = a PRODUCT-HERO shot (NO creator), so the close reads
  // PRODUCT → CREATOR-ENDORSE (two visually DISTINCT shots) instead of two near-identical
  // "creator presenting the product" cuts (the "CTA luôn dính 2 scene giống nhau" the user
  // audited). With an offer in the brief → a special-deal flavour; otherwise → a sold-fast
  // urgency flavour matching the buy-push line. No face, no on-screen price.
  const penult = scenes[scenes.length - 2]
  const ctaCue = /(mua|ch[oố]t|gi[oỏ] h[aà]ng|link|[uư]u đãi|t[aặ]ng|sale|h[eế]t h[aà]ng|h[oố]t|s[oở] h[uữ]u|grab|beli|checkout|order|jom|cart)/i
  // Phase A — how many product units the SPOKEN offer implies (read from the script's CTA
  // block, NOT a field). "mua 1 được thêm 2" → 3 → the penult hero shows 3 real units.
  const offerQty = parseOfferQty(params.script.blocks.find((b) => b.id === 'cta')?.text ?? '')
  if (penult && penult.role === 'broll' && ctaCue.test(penult.quote ?? '')) {
    penult.kind = 'product_action'
    penult.cameraFraming = 'hands_noface'
    penult.shotIntent = 'offer'
    const hasOffer = !!(params.product?.offer && params.product.offer.trim())
    // The product unit phrase — renders the REAL deal quantity (capped 4) when >1.
    if (offerQty > 1) penult.productUnits = offerQty
    const units = offerQty > 1 ? `${offerQty} IDENTICAL units of the product, neatly grouped together` : 'the product'
    const sameUnitsClause = offerQty > 1
      ? ` Render ALL ${offerQty} product units IDENTICAL to the product reference (same form, color, label).`
      : ''
    if (giftOn) {
      // Phase A (option A) — the gift IS the offer beat: product unit(s) + free gift, NO person.
      // Takes priority over deal / urgency flavours. Distinct objects, hard product lock.
      penult.giftRef = params.gift!.imageRef
      penult.conceptPrompt =
        `PRODUCT-HERO shot — NO person, NO face: ${units} together with the FREE GIFT, arranged side by side on a clean premium surface in good light — a "buy now, get this free too" bundle that looks worth grabbing. CRITICAL: the product unit(s) and the gift are SEPARATE, DISTINCT objects placed apart — do NOT merge, blend, swap, or restyle any of them; keep each exactly as in its reference.${sameUnitsClause} No on-screen price or numbers.`
    } else if (offerQty > 1) {
      // Offer with a real quantity, no gift → show the true number of units (the deal).
      penult.conceptPrompt =
        `PRODUCT-HERO shot — NO person, NO face: ${units} on a clean premium surface in good light — a generous "buy more, get more" deal worth grabbing.${sameUnitsClause} No on-screen price or numbers.`
    } else {
      penult.conceptPrompt = hasOffer
        ? 'PRODUCT-HERO shot — NO person, NO face: the product is the clear HERO, centred + premium on a clean surface in good light, presented as a special DEAL / offer moment (a hand may place or point at it). Make it look worth grabbing. No on-screen price or numbers.'
        : 'PRODUCT-HERO shot — NO person, NO face: the product is the clear HERO on a shelf / surface, a hand quickly REACHING in to grab it — a "selling fast, last one, get it now" urgency feel. Clean, premium light. No on-screen text.'
    }
  }

  // P4e Layer 2 — fill any scene the director left with an empty / vague
  // conceptPrompt via ONE targeted Gemini call (grounded in product + quote), so
  // the render never silently falls back to a generic product close-up. Filler
  // cuts added later by split/density are caught by Layer 3 at render time.
  // P5q — make the PRODUCT the hero: appetite/usage lines → product action (not a
  // talking head), and cap face-only concept cuts at 2. Runs after the CTA lock + before
  // backfill so the converted weak concepts get grounded in their line + the product.
  enforceProductHero(scenes, params.product)
  capSocialProof(scenes)   // P5w — social_proof only on real proof lines, cap 3, never CTA
  enforceBeforeAfterSplit(scenes, params.script)   // transformation line → split-screen before/after (deterministic)

  await backfillWeakConcepts(scenes, params.product, params.geminiKey)

  // P5p — render-safe holds: rewrite any present-to-camera concept that would render
  // as a "floating bowl / object" into a simple supported product hold. Runs LAST so
  // it overrides whatever the director / backfill wrote (the CTA endorsement + offer
  // shots carry no floating words, so they're untouched).
  enforceRenderSafeHolds(scenes, params.product)
  // P6f Part B — reserve the endorsement look for the CTA (must run LAST, after the holds pass).
  capEndorsement(scenes)
  // P6av — mark ≤1 product-mention lips to render from KF-B (creator holding the product).
  assignLipsProductKeyframe(scenes, params.product)

  const coveredSec = scenes.reduce((s, x) => s + x.durationSec, 0)
  const lipsScenes = scenes.filter((s) => s.role === 'lips')
  // eslint-disable-next-line no-console
  console.log(
    `[BROLL_DIRECTOR] dur=${dur}s scenes=${scenes.length} covered≈${coveredSec.toFixed(0)}s ` +
    `lips=${lipsScenes.length}/${lipsCount} broll=${scenes.filter((s) => s.role === 'broll').length} ` +
    `3d=${scenes.filter((s) => s.role === 'mechanism3d').length} ` +
    `noface=${scenes.filter((s) => s.cameraFraming === 'hands_noface').length}`,
  )
  return { scenes }
}

// ── Parse + sanitize ────────────────────────────────────────────────────────

interface RawScene {
  role?: string; quote?: string; durationSec?: number
  conceptPrompt?: string; cameraFraming?: string; kind?: string; shotIntent?: string; reason?: string
}

function tryParse(raw: string): { scenes?: RawScene[] } | null {
  let s = raw.trim()
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
  try {
    const obj = JSON.parse(s)
    if (obj && typeof obj === 'object' && Array.isArray(obj.scenes)) return obj
  } catch { /* fall through */ }
  return null
}

const SCENE_ROLES: BrollSceneRole[] = ['lips', 'broll', 'mechanism3d', 'social_proof']
const SCENE_KINDS: BrollSceneKind[] = ['product_action', 'product_closeup', 'concept']

// P6r — a line with strong VISUAL fuel (Gemini tagged it product_macro / product_demo /
// mechanism3d / before_after / social_proof / offer / endorsement) must NOT be turned into a
// talking head by the lips ladder — that buried an ingredient/demo/proof beat as a bare face
// (user audit: "câu liệt kê thành phần bị ép lips"). Rank such lines as the WORST lips
// candidates (used only if no talk line is left); next worst = a demo-action / deictic line;
// best (0) = a plain talk line. Keeps the ladder intent-led, same as every other layer.
const LIPS_UNFIT_INTENTS = new Set<ShotIntent>(['product_macro', 'product_demo', 'mechanism3d', 'before_after', 'social_proof', 'offer', 'endorsement'])
const lipsUnfit = (s: BrollScene): number =>
  (s.shotIntent && LIPS_UNFIT_INTENTS.has(s.shotIntent)) ? 2 : (isBadLipsCandidate(s.quote) ? 1 : 0)

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
    // Prefer a candidate NOT adjacent to an existing/chosen lips so promoted lips stay
    // SPREAD (then separateLipsRuns won't demote one → the ladder count holds).
    const occ = new Set([...lipsIdx, ...chosen])
    let cand = brollIdx.filter((i) => !chosen.includes(i) && !occ.has(i - 1) && !occ.has(i + 1))
    if (cand.length === 0) cand = brollIdx.filter((i) => !chosen.includes(i))   // forced: allow adjacent
    if (cand.length === 0) break
    // P5r/P6r — pick lips from TALK lines, never from a line that carries a product visual.
    // Rank by lipsUnfit (0 talk → 1 demo/deictic → 2 visual-fuel intent) then by nearness to
    // the gap, so a talking-head promotion never lands on an ingredient/demo/proof/3D beat
    // while any plain talk line is still available.
    cand.sort((a, b) => {
      const ua = lipsUnfit(scenes[a]), ub = lipsUnfit(scenes[b])
      if (ua !== ub) return ua - ub
      return Math.abs(a - gapMid) - Math.abs(b - gapMid)
    })
    chosen.push(cand[0])
  }
  for (const i of chosen) {
    scenes[i] = {
      role: 'lips',
      quote: scenes[i].quote,
      durationSec: scenes[i].durationSec,
      shotIntent: 'lips',   // P6r — keep the displayed tag consistent with the new role
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
    // social_proof = a static FB-post card (rendered locally/AI later), no i2v kind/
    // framing/conceptPrompt. lips = talking head, also no product-cut setup.
    if (role !== 'lips' && role !== 'social_proof') {
      // No-face only makes sense for a real product-action cut; otherwise creator.
      scene.kind = SCENE_KINDS.includes(r.kind as BrollSceneKind) ? (r.kind as BrollSceneKind) : 'product_action'
      // P2 — when the model returns NO conceptPrompt, leave it EMPTY (do NOT inject a
      // generic by-kind template). The old templates ("a clean close-up of the product",
      // "a simple real-life moment that illustrates the spoken line") passed the length
      // check in isWeakConceptPrompt, so backfillWeakConcepts SKIPPED them and they
      // rendered as line-blind boilerplate (the audited "weak-default" ≈17% of cuts). An
      // empty prompt is correctly detected as weak → backfillWeakConcepts (Layer 2) writes
      // a vivid prompt grounded in THIS line + product, and deriveConceptPrompt (Layer 3)
      // is the role/kind-aware deterministic backstop at render if backfill is rate-limited.
      const cp = typeof r.conceptPrompt === 'string' ? r.conceptPrompt.trim() : ''
      scene.conceptPrompt = cp
      // P5r2 — no-face veto: a product APPLIED / WORN / EATEN / DRUNK on the body (any
      // part) must show the CREATOR doing it (face visible) — never a head-less hands-only
      // shot (deforms + lazy). no-face stays only for surface / hand-held-tool actions.
      const wantsNoFace = r.cameraFraming === 'hands_noface'
      const onBody = APPLIES_PRODUCT_TO_BODY_RE.test(cp)
      scene.cameraFraming = wantsNoFace && role === 'broll' && scene.kind !== 'concept' && !onBody ? 'hands_noface' : 'creator'
    }
    // P6m (P1) — capture Gemini's declared intent (display/observe only; no decision uses it yet).
    if (SHOT_INTENTS.includes(r.shotIntent as ShotIntent)) scene.shotIntent = r.shotIntent as ShotIntent
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
  return dedupeScenePrompts(enforceDensityFloor(capSplitScenes(out), densityFloor(dur)))
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
const MAX_BROLL_SEC = 6.0   // P5u — hard cap: no cut > ~6s (capSplitScenes splits longer ones)
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
    // P5w — a social-proof CARD is ONE static FB-post image; never split it (a split
    // would render the SAME quote as TWO identical cards = double credit + ugly repeat).
    // Hold the single card for its whole span even if that exceeds MAX_BROLL_SEC.
    if (s.role === 'social_proof') { out.push(s); continue }
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

// P5r — GLOBAL anti-duplicate (user hard rule: NO two B-roll cuts alike across the whole
// video, face or no-face). The angle modifiers above only change the LENS (same subject) →
// i2v still clones them. These change WHAT IS IN FRAME so a repeated/long idea becomes a
// genuinely different shot. Applied by dedupeScenePrompts as the last word.
//
// SPLIT BY FACE vs NO-FACE: the dedup rewrite must PRESERVE the cut's nature — a
// creator-framed cut (a feeling / desire / fear / reaction beat) may NEVER be rewritten
// into a faceless product macro (that destroyed the meaning of the "#3 craving" line), and
// a no-face product cut must stay faceless. Selection keys off cameraFraming — the SAME
// field the renderer uses to attach the avatar/face — so the rewritten prompt never fights
// the framing (the trap the before/after fix hit). Each pool ≥4 so several deduped cuts of
// the same nature still differ. The pools stay product-agnostic about PRESENCE (the beat +
// the renderer's PRODUCT LOCK decide if the product is in frame); they only pin person vs
// no-person, which must match cameraFraming.
const DISTINCT_SHOT_VARIANTS_PERSON = [
  "the creator's GENUINE face close-up REACTION — a real, unscripted expression living THIS exact beat",
  'a candid WIDE shot of the creator in their real daily setting, body language + face carrying THIS beat',
  'an over-the-shoulder / from-behind shot of the creator inside the situation of THIS beat',
  'a handheld, selfie-distance shot of the creator caught in a real, unguarded moment of THIS beat, natural light',
]
const DISTINCT_SHOT_VARIANTS_PRODUCT = [
  'an EXTREME MACRO close-up of the product texture / one key detail (no person, no full packaging)',
  'a first-person POV of the hands USING / interacting with the product (no face in frame)',
  'a clean PRODUCT-HERO still resting on a real surface in its setting (no person)',
  'a WIDE lifestyle still — the product small inside the real daily setting (no face), a candid real-life frame',
]
// P6am — the NO-HANDS subset (drops the "hands USING" variant) for a product_closeup cut,
// whose preset (PRODUCT_CLOSEUP) renders the product ALONE — a "hands using" variant would
// contradict the no-hands preset (hands rotating a product is the drift the closeup fix kills).
const DISTINCT_SHOT_VARIANTS_PRODUCT_NOHANDS = [
  DISTINCT_SHOT_VARIANTS_PRODUCT[0], DISTINCT_SHOT_VARIANTS_PRODUCT[2], DISTINCT_SHOT_VARIANTS_PRODUCT[3],
]
// P6f — CTA_ENDORSE_RE / CTA_OFFER_PROMPT removed: the "earlier endorsement → OFFER shot"
// pass is superseded by capEndorsement (Part B, plan-time), which re-routes ANY non-CTA
// endorsement to a grounded result shot (not just collapses two into the offer).
const DEDUP_STOP = new Set(['this','that','with','from','into','onto','their','they','them','your','about','over','shot','scene','camera','frame','video','clip','footage','natural','real','iphone','authentic','setting','light','lighting'])
const sigWords = (p: string): Set<string> =>
  new Set(p.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !DEDUP_STOP.has(w)))
const jac = (a: Set<string>, b: Set<string>): number => {
  if (!a.size || !b.size) return 0
  let inter = 0; for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}
// Drop a trailing split angle-modifier / prior DIFFERENT-SHOT tag (NOT a legit em-dash clause).
const stripMod = (p: string): string =>
  p.replace(/\s*—\s*(?:DIFFERENT SHOT\b.*|[^—]*\bsame (?:subject|action)\b.*)$/i, '').trim()

/** P5r — guarantee every B-roll cut renders a DISTINCT image. Any non-card/non-lips cut whose
 *  prompt is ≥0.55 similar to an earlier accepted cut → rewrite into a genuinely different shot
 *  (from the pool matching its framing). Never rewrites the locked CTA last cut. Runs AFTER
 *  split (the source of clone pairs) so it catches split-halves + director repeats.
 *  P6f Part C — SEED the CTA's signature into `accepted` up front: the loop only compares
 *  BACKWARD and the CTA is rewrite-exempt, so without this an EARLIER cut that renders like the
 *  CTA endorsement slips through (it's never compared against the later CTA). Seeding forces
 *  every earlier cut to differ from the CTA too. */
function dedupeScenePrompts(timed: TimedBrollScene[]): TimedBrollScene[] {
  const lastIdx = timed.length - 1
  const accepted: Set<string>[] = []
  const ctaCut = timed[lastIdx]
  if (ctaCut && ctaCut.role !== 'lips' && ctaCut.role !== 'social_proof') {
    const ctaSig = sigWords(stripMod((ctaCut.conceptPrompt ?? '').trim()))
    if (ctaSig.size) accepted.push(ctaSig)
  }
  let vi = 0
  for (let i = 0; i < timed.length; i++) {
    const s = timed[i]
    if (s.role === 'lips' || s.role === 'social_proof') continue
    const base = stripMod((s.conceptPrompt ?? '').trim())
    if (!base) continue
    const w = sigWords(base)
    // P2 — intent-aware: NEVER rewrite a 3D mechanism cut or a deliberate OFFER/ENDORSEMENT
    // close shot into a generic person/product pool variant. The blind rewrite destroyed the
    // 3D animation (it became "POV hands using product") and the closing offer (it became an
    // "over-the-shoulder/selfie" shot) — the audited dedup damage. We still SEED their
    // signature (via the else-branch below) so every OTHER cut is forced to differ from them.
    const protectedShot =
      s.role === 'mechanism3d' || s.shotIntent === 'offer' || s.shotIntent === 'endorsement' || OFFER_LOOK_RE.test(base)
    const dup = i !== lastIdx && !protectedShot && accepted.some((a) => jac(a, w) >= 0.55)   // never touch the locked CTA last cut
    if (dup) {
      // REPLACE (not append): appending "— DIFFERENT SHOT: macro" onto "creator massaging
      // the knee" contradicts itself and the model just re-renders the massage. Render the
      // distinct variant INSTEAD, anchored to this beat → a genuinely different image.
      const beat = (s.quote ?? '').slice(0, 50).replace(/"/g, '')
      // P6am — pick the pool by what the cut SHOWS at render time (its preset is derived from
      // `kind`), NOT just cameraFraming, AND re-align kind/role/framing to the chosen pool so
      // the rewritten concept can NEVER contradict the preset. Audited bug (KB1 #6): a
      // product_closeup macro got a "creator face REACTION" concept but stayed PRODUCT_CLOSEUP
      // → the no-hands product preset fought a creator-face concept. Now: only a true `concept`
      // cut (no product on screen) draws the PERSON pool; every product cut draws a faceless
      // product variant (closeup uses the NO-HANDS subset, since PRODUCT_CLOSEUP shows no hands).
      const isPerson = s.kind === 'concept'
      const pool = isPerson
        ? DISTINCT_SHOT_VARIANTS_PERSON
        : (s.kind === 'product_closeup' || !s.kind) ? DISTINCT_SHOT_VARIANTS_PRODUCT_NOHANDS
        : DISTINCT_SHOT_VARIANTS_PRODUCT
      const tail = isPerson ? `Stay on the SAME beat: "${beat}".` : `Same product + beat as "${beat}".`
      s.conceptPrompt = `DIFFERENT SHOT — must look NOTHING like any other cut. Render INSTEAD: ${pool[vi % pool.length]}. ${tail}`
      if (isPerson) {
        s.role = 'broll'; s.cameraFraming = 'creator'            // kind already 'concept' → CONCEPT_SCENE (person, no product)
      } else {
        if (!s.kind) s.kind = 'product_closeup'                  // a faceless product variant must render on a product preset
        s.cameraFraming = 'hands_noface'                         // every product variant is faceless → never inject a stray face
      }
      vi++
      accepted.push(sigWords(s.conceptPrompt))
    } else {
      s.conceptPrompt = base   // normalize — drop any weak split angle-modifier
      accepted.push(w)
    }
  }
  return timed
}

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
      if (out[i].role === 'social_proof') continue   // P5w — never split a static FB-post card
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

// P6p — sticker generation removed from the Ads Video director (localizeStickersToMs +
// sanitizeStickers deleted). Legacy ActionInserts sticker mode is untouched (separate flow).
