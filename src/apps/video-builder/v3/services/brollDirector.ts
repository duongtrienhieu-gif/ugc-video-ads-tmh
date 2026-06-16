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
function applyProductEstablishRules(scenes: BrollScene[], product: Product | null | undefined): void {
  if (scenes.length === 0 || !product?.productName) return
  const lastIdx = scenes.length - 1

  // Rule A — the OPENING establishes the product when the HOOK names it (face+product).
  const first = scenes[0]
  if (first && lastIdx > 0 && !sceneShowsProduct(first) && quoteNamesProduct(first.quote, product)) {
    makeProductScene(first, 'creator', product)
  }

  // Rule B — any line that POINTS AT the product must show it (never a bare face).
  for (let i = 0; i < scenes.length; i++) {
    if (i === lastIdx) continue
    const s = scenes[i]
    if (s.role === 'mechanism3d') continue          // 3D internal animation — leave it
    if (!sceneShowsProduct(s) && quoteHasProductDeictic(s.quote)) {
      makeProductScene(s, i === 0 ? 'creator' : 'hands_noface', product)
    }
  }

  // Rule C — establish within the FIRST THIRD (covers a LEAD / problem-first hook):
  // if no early scene shows the product, force the first product-NAMING scene to.
  const third = Math.max(1, Math.ceil(scenes.length / 3))
  if (!scenes.slice(0, third).some(sceneShowsProduct)) {
    for (let i = 0; i < lastIdx; i++) {
      if (scenes[i].role === 'mechanism3d') continue
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
  // (b) cap face-only "concept" cuts at 2 — convert the rest to a product shot.
  let conceptKept = 0
  for (let i = 0; i < scenes.length; i++) {
    if (i === lastIdx) continue
    const s = scenes[i]
    if (s.role !== 'broll' || s.kind !== 'concept') continue
    conceptKept++
    if (conceptKept > 2) { s.kind = 'product_action'; s.cameraFraming = 'hands_noface'; s.conceptPrompt = '' }
  }
}

// P5w — social-proof card guard (anti-abuse). A 'social_proof' scene is only valid on a
// genuine crowd/sold/review line; cap at 3, never the final CTA cut. Anything else →
// demote to a product broll (weak concept → backfilled). Universal cues (VN/EN/MS).
const SOCIAL_PROOF_CUE_RE = /ngh[ìi]n ng[ưu][ờo]i|ng[àa]n ng[ưu][ờo]i|m[oọ]i ng[ưu][ờo]i|ai (?:d[ùu]ng|mua)|nhi[eề]u ng[ưu][ờo]i|b[áa]n ch[aạ]y|ch[áa]y h[àa]ng|quay l[aạ]i mua|mua l[aạ]i|l[ưu][ợo]t (?:mua|b[áa]n)|ng[ưu][ờo]i (?:mua|đ[ặa]t)|5 sao|n[ăa]m sao|c[oộ]ng đ[ồo]ng|\b(?:sold|sold[- ]?out|repeat|viral|popular)\b|ramai|terjual|bintang|\blaku\b|semua orang|orang (?:beli|guna|pakai|cuba)/i
// STRICTER cue for PROMOTE only — clear THIRD-PARTY proof, NO lone "viral"/"popular"
// (those live in hooks). Requires a %, a people-count, repeat-buyers, or reviews/stars.
const SOCIAL_PROOF_PROMOTE_RE = /\d+\s*%|ph[aầ]n tr[ăa]m|ngh[ìi]n ng[ưu][ờo]i|ng[àa]n ng[ưu][ờo]i|nhi[eề]u ng[ưu][ờo]i|quay l[aạ]i mua|mua l[aạ]i|b[áa]n ch[aạ]y|ch[áa]y h[àa]ng|review|đ[áa]nh gi[áa]|\d+\s*sao|n[ăa]m sao|terjual|ramai (?:beli|membeli)|orang (?:beli|guna|pakai)/i
function capSocialProof(scenes: BrollScene[]): void {
  const lastIdx = scenes.length - 1
  let kept = 0
  const demote = (s: BrollScene) => {
    s.role = 'broll'; s.kind = 'product_action'; s.cameraFraming = 'hands_noface'; s.conceptPrompt = ''
  }
  // A native social_proof scene carries NO kind/framing/conceptPrompt (the FB-card image
  // is generated from the product) — match that shape when promoting.
  const promote = (s: BrollScene) => {
    s.role = 'social_proof'; s.kind = undefined; s.cameraFraming = undefined; s.conceptPrompt = undefined
  }
  // Pass 1 — validate scenes Gemini already tagged social_proof (demote mis-tags / over-cap).
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i]
    if (s.role !== 'social_proof') continue
    if (i === lastIdx) { demote(s); continue }              // CTA never a card
    if (!SOCIAL_PROOF_CUE_RE.test(s.quote ?? '')) { demote(s); continue }  // mis-tagged
    kept++
    if (kept > 3) demote(s)                                 // cap 3
  }
  // Pass 2 — PROMOTE: a plain broll scene whose LINE is clearly THIRD-PARTY proof (a %,
  // a people-count, repeat buyers, reviews / stars) should be the cheap ~6cr FB-card image,
  // not the 17-20cr product video the director mis-routed it to. Uses a STRICTER cue than the
  // demote check — the broad SOCIAL_PROOF_CUE_RE matches lone "viral"/"popular" which leak
  // into HOOKS (the user audited: the hook "tại sao ... viral" wrongly became a blank card).
  // Never promotes the HOOK (scene 0) or the CTA (last), and respects the cap (3).
  for (let i = 0; i < scenes.length && kept < 3; i++) {
    const s = scenes[i]
    if (i === 0 || i === lastIdx || s.role !== 'broll') continue   // never the hook / CTA
    if (!SOCIAL_PROOF_PROMOTE_RE.test(s.quote ?? '')) continue
    promote(s); kept++
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
  // P5m — the anchor (the ONE memorable reason/number) gets a HERO cut + a sticker;
  // the OFFER lands as a sticker at the CTA so the deal is visible, not just spoken.
  const anchorHint = params.script.anchor?.trim()
    ? `\n\nANCHOR — the ONE memorable reason/number this script drives home: "${params.script.anchor.trim()}". Give it a clear HERO cut in the FIRST HALF (the spec / number / result shown BIG + clean, a real product shot) and reinforce it at the CTA. Put a number/price STICKER on the anchor, and another on the OFFER (price / "Beli 1 Free 1" / "-50%") at the CTA so the deal lands VISUALLY, not just in the voice.`
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
  // English" (right for VN), but Malaysian TikTok captions are bahasa ROJAK —
  // light English mix ("Free", "Stok", "Best", "Combo") is NATURAL. This refines
  // it for MS: rojak yes, Vietnamese NEVER. A JS validator below re-localizes any
  // sticker that still leaked Vietnamese.
  const msStickerHint = params.lang === 'ms' ? `
STICKER LANGUAGE (Malaysia) — write stickers in natural Malaysian Bahasa ROJAK, the
casual register a real MY TikTok seller types: a light English mix ("Free", "Stok",
"Best", "Combo", "Free postage") is NATURAL — keep it. Use MY callout words: "Jimat
50%", "Stok terhad", "Beli 1 Free 1", "Laris", "Murah gila", "RM59". NEVER write a
sticker in Vietnamese — not a single word.` : ''

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
   Use for GENUINE internal-mechanism lines (an ingredient acting inside the body, a
   process a phone can't film) — up to ~3 per video for an ingredient/mechanism-heavy
   product (supplement / skincare / health), fewer otherwise. Each 3D cut MUST be a
   distinct internal mechanism (Kali→mạch máu, Vitamin C→collagen dưới da, chất xơ→đường
   ruột). Do NOT 3D a line that's just a NAMING/benefit/result ("giàu Kali" = a product
   close-up + sticker, NOT 3D); and never exceed ~3 — the ad must not become a science reel.
4. "social_proof" — ONLY for a genuine SOCIAL-PROOF line: a crowd/popularity, a sold
   count, repeat buyers, or reviews — "mấy nghìn người mua rồi", "ai dùng cũng quay lại",
   "review toàn 5 sao", "bán cháy hàng", "nhỏ bạn mình dùng cũng mê". Renders as a
   realistic Facebook-post / review screenshot (handled by the app — NO conceptPrompt
   needed, just the "quote"). Use AT MOST ~2 (3 absolute max) per video, ONLY on real
   social-proof lines. NEVER for a product / benefit / demo / pain line (those stay
   broll/lips), and NEVER make the final CTA cut a social_proof card.

STICKERS (separate array — 0-credit text pops that ride on a cut, REPLACING the
old overlays). Be GENEROUS — stickers are FREE and do NOT compete with the cuts,
so pop one on EVERY beat where the voice names something concrete: a number, a
spec, a measurement, a feature, a benefit, a time, a price, a discount, a free
gift, a safety/result claim. Cover MOST such moments, not just two or three — a
spec/feature-heavy product (gadget, tool, appliance) should get MANY stickers; an
emotional/abstract script naturally gets fewer. Scale to what THIS script actually
names — never pad with vague stickers, but never leave a concrete callout bare.
  • ⛔ NON-VERBATIM (critical) — a sticker COMPRESSES the point into a punchy TAG (a
    number, %, price, ingredient, proof, offer, badge), it must NOT restate the spoken
    sentence. That line is ALREADY burned on-screen as a CAPTION, so a sticker repeating
    those same words is dead weight + clutter. E.g. line "mình hay ăn 1-2 thanh mỗi ngày"
    → "1-2/ngày" (or no sticker), NOT "1-2 Thanh Mỗi Ngày"; line "giúp tỉnh táo hơn" → an
    icon/skip, NOT "Tỉnh Táo Hơn". Prefer the hard stat/proof/offer the voice does NOT
    say word-for-word (a %, a count, an ingredient name, "Mua 1 Tặng 1", "-50%").
  • single callout → {style:"number"|"price"|"badge"|"countdown"|…, text:"2kg" /
    "tự ngắt" / "mấy giây", quote, wordAnchor}. Prepend a fitting emoji to text.
  • a line listing SEVERAL specs/claims (e.g. "20000mAh, 4 hours, 30 min", or
    "tiết kiệm thời gian, không cần trạm xăng") → ONE {style:"list", items:["🔋
    20000mAh","⏱ 4 tiếng","⚡ 30 phút"], quote} — a stacked card (each item may
    start with its own emoji).
  • MANDATORY: an INGREDIENT / NUTRIENT / ACTIVE / SPEC callout (vitamins, minerals,
    actives, mAh, %, bar, mg…) MUST get a sticker — a "list" if it names several
    (e.g. "giàu Kali, Magie, Vitamin C" → {style:"list", items:["Kali","Magie",
    "Vitamin C"], quote}), a "pill"/"number" if it names one. NEVER leave an
    ingredient/spec line bare — that is the proof the buyer screenshots.
  Stickers carry the info the old hand-drawn overlays used to; do NOT make overlay
  scenes. They pop ONE at a time, spaced ~3s apart (two within 3s collide and the
  later one is dropped) — so cover the KEY callouts; don't stack many on one line.
  ALL sticker text 100% in ${langName} — translate the idea INTO ${langName}; NEVER
  leave or switch a word to English (write the ${langName} word, not the English one).
${culturalSettingBlock}${msStickerHint}${shapeHint}
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
- Universal: infer setting/usage from the product context; never hardcode a niche.${anchorHint}

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

  // P4h — product establishment + deictic (deterministic backstop to the Layer-1
  // prompt): the hook / early lines that NAME or POINT AT the product must SHOW it,
  // so the product is never invisible while the voice keeps naming it. Runs before
  // the CTA lock (the CTA owns the last cut) and before backfill (fills any concept).
  applyProductEstablishRules(scenes, params.product)

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

  // P5o — when the CTA spans the LAST TWO scenes (two buy/offer lines), the single
  // lock above left BOTH reading as the same thumbs-up endorsement (the user audited
  // "#14 và #15 gần trùng"). Give the PENULTIMATE buy scene a DISTINCT OFFER shot
  // (product hero + the deal called out) so the close reads OFFER → ENDORSE, not two
  // identical thumbs-ups. Only fires when that scene is a broll AND its quote is a
  // buy/offer line (a CTA-block line), so a normal benefit penultimate is untouched.
  const penult = scenes[scenes.length - 2]
  const ctaCue = /(mua|ch[oố]t|gi[oỏ] h[aà]ng|link|[uư]u đãi|t[aặ]ng|sale|h[eế]t h[aà]ng|h[oố]t|s[oở] h[uữ]u|grab|beli|checkout|order|jom|cart)/i
  if (penult && penult.role === 'broll' && ctaCue.test(penult.quote ?? '')) {
    penult.kind = 'product_action'
    penult.cameraFraming = 'creator'
    penult.conceptPrompt =
      'Close-up of the creator presenting the product to camera and tapping / pointing at it excitedly as the deal is announced — the OFFER moment, the product the hero in frame (NOT a thumbs-up beside the face).'
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

  await backfillWeakConcepts(scenes, params.product, params.geminiKey)

  // P5p — render-safe holds: rewrite any present-to-camera concept that would render
  // as a "floating bowl / object" into a simple supported product hold. Runs LAST so
  // it overrides whatever the director / backfill wrote (the CTA endorsement + offer
  // shots carry no floating words, so they're untouched).
  enforceRenderSafeHolds(scenes, params.product)

  const stickers = sanitizeStickers(parsed.stickers)
  // P4l — MS sticker safety net: even with the rojak hint, Gemini sometimes leaks
  // Vietnamese onto a sticker (the dev/source language). Re-localize any flagged
  // sticker to Malay in ONE call. Only fires when ms AND a leak is actually found.
  if (params.lang === 'ms') await localizeStickersToMs(stickers, params.geminiKey)

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

const SCENE_ROLES: BrollSceneRole[] = ['lips', 'broll', 'mechanism3d', 'social_proof']
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
    // P5r — pick lips from TALK lines, not action/deictic lines. A lips promotion
    // turns a broll into a talking head, so NEVER grab a demo-action / point-at-product
    // line (that's a product visual). Prefer the talk candidate nearest the gap; only
    // fall back to a "bad" candidate if no talk line is left.
    cand.sort((a, b) => {
      const badA = isBadLipsCandidate(scenes[a].quote) ? 1 : 0
      const badB = isBadLipsCandidate(scenes[b].quote) ? 1 : 0
      if (badA !== badB) return badA - badB
      return Math.abs(a - gapMid) - Math.abs(b - gapMid)
    })
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
    // social_proof = a static FB-post card (rendered locally/AI later), no i2v kind/
    // framing/conceptPrompt. lips = talking head, also no product-cut setup.
    if (role !== 'lips' && role !== 'social_proof') {
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
const DISTINCT_SHOT_VARIANTS = [
  'an EXTREME MACRO close-up of the product texture / one key detail (no person, no full packaging)',
  "the creator's GENUINE REACTION — a face close-up with real emotion to this exact beat",
  'a WIDE lifestyle shot — the product small inside the real daily setting, a candid real-life moment',
  'a first-person POV of the hands USING / interacting with the product',
  'a clean PRODUCT-HERO still resting on a real surface in its setting (no person)',
  'an over-the-shoulder shot capturing a DIFFERENT step / angle of the same idea',
]
const CTA_ENDORSE_RE = /thumbs-up to camera|genuine endorsement at the call to buy/i
const CTA_OFFER_PROMPT =
  'Close-up of the creator presenting the product to camera and tapping / pointing at it excitedly as the deal is announced — the OFFER moment, the product the hero in frame (NOT a thumbs-up beside the face).'
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

/** P5r — guarantee every B-roll cut renders a DISTINCT image. (1) CTA: keep ONLY the last
 *  endorsement, turn earlier endorsements into the OFFER shot. (2) Any non-card/non-lips cut
 *  whose prompt is ≥70% similar to an earlier accepted cut → rewrite into a genuinely
 *  different shot. Never rewrites the locked CTA last cut. Runs AFTER split (the source of
 *  the clone pairs) so it catches both split-halves and director-authored repeats. */
function dedupeScenePrompts(timed: TimedBrollScene[]): TimedBrollScene[] {
  const lastIdx = timed.length - 1
  const endorse = timed.filter((s) => s.role !== 'lips' && s.role !== 'social_proof' && CTA_ENDORSE_RE.test(s.conceptPrompt ?? ''))
  if (endorse.length > 1) {
    for (const s of endorse.slice(0, -1)) { s.conceptPrompt = CTA_OFFER_PROMPT; s.kind = 'product_action'; s.cameraFraming = 'creator' }
  }
  const accepted: Set<string>[] = []
  let vi = 0
  for (let i = 0; i < timed.length; i++) {
    const s = timed[i]
    if (s.role === 'lips' || s.role === 'social_proof') continue
    const base = stripMod((s.conceptPrompt ?? '').trim())
    if (!base) continue
    const w = sigWords(base)
    const dup = i !== lastIdx && accepted.some((a) => jac(a, w) >= 0.7)   // never touch the locked CTA last cut
    if (dup) {
      s.conceptPrompt = `${base} — DIFFERENT SHOT (must NOT resemble the other cuts): ${DISTINCT_SHOT_VARIANTS[vi % DISTINCT_SHOT_VARIANTS.length]}`
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

// ── P4l — MS sticker localization (anti Vietnamese-leak) ─────────────────────
// Malay (rojak) uses plain a-z + light English; it has NONE of Vietnamese's tone
// marks / special vowels. So any of these characters on an MS sticker = leaked
// Vietnamese → re-localize. Clean deterministic signal, zero false positives on
// real Malay (which never carries these diacritics).
const VN_DIACRITICS_RE = /[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/

/** Re-localize any sticker that leaked Vietnamese into natural Malay rojak. ONE
 *  Gemini call, only when there IS a leak; mutates in place; graceful on failure
 *  (a stray VN sticker is better than a broken plan). Universal — no niche assumption. */
async function localizeStickersToMs(stickers: BrollSticker[], apiKey: string): Promise<void> {
  type Ptr = { si: number; kind: 'text' } | { si: number; kind: 'item'; ii: number }
  const frags: string[] = []
  const ptrs: Ptr[] = []
  stickers.forEach((s, si) => {
    if (s.text && VN_DIACRITICS_RE.test(s.text)) { frags.push(s.text); ptrs.push({ si, kind: 'text' }) }
    ;(s.items ?? []).forEach((it, ii) => {
      if (VN_DIACRITICS_RE.test(it)) { frags.push(it); ptrs.push({ si, kind: 'item', ii }) }
    })
  })
  if (frags.length === 0) return
  const numbered = frags.map((f, n) => `${n + 1}. ${f}`).join('\n')
  const systemInstruction =
`You localize short ad STICKER labels (numbers, prices, discounts, feature callouts)
into natural Malaysian Bahasa ROJAK — the casual mixed register a real Malaysian
TikTok seller types. Each label below LEAKED Vietnamese; rewrite it in Malaysian.
RULES: keep any emoji; keep any number / price / unit (RM…, %, mAh, g…); keep it
SHORT (≤24 chars); keep the MEANING. A light English mix is fine ("Free", "Stok",
"Best", "Combo"); Malaysian callout words: "Jimat", "Stok terhad", "Beli 1 Free 1",
"Laris", "Murah", "Free postage". NO Vietnamese left.
OUTPUT exactly ${frags.length} lines, ONE label per line, SAME order, no numbering,
no quotes, no commentary.`
  const prompt = `Localize these ${frags.length} sticker labels to Malaysian (one per line, same order):\n${numbered}`
  try {
    const raw = await directGeminiText({
      apiKey, systemInstruction, prompt, maxOutputTokens: 512, temperature: 0.5, thinkingBudget: 0,
    })
    const lines = raw.split('\n')
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').replace(/^["'“”\-•]+|["'“”]+$/g, '').trim())
      .filter(Boolean)
    ptrs.forEach((p, n) => {
      const v = lines[n]
      if (!v || VN_DIACRITICS_RE.test(v)) return   // skip if model still left VN
      const s = stickers[p.si]
      if (p.kind === 'text') s.text = v.slice(0, 24)
      else if (s.items) s.items[p.ii] = v.slice(0, 24)
    })
    // eslint-disable-next-line no-console
    console.log(`[BROLL_DIRECTOR] localize ${ptrs.length} sticker VN→MS`)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[BROLL_DIRECTOR] localize sticker MS lỗi (giữ nguyên):', e)
  }
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
