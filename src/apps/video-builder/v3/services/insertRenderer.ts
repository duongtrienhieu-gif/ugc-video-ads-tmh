// ── Insert Renderer ──────────────────────────────────────────────────────────
// Z33 §10/13/14 — Per-insert render pipeline. Preview-first, low-motion,
// product-locked.
//
// Pipeline (3 stages — simpler than Phase 3 creator video):
//   1. KEYFRAME  — KIE GPT-4o image-edit produces the still with avatar
//                  + product references. Identity + product locks
//                  applied via promptBuilder.
//   2. PREVIEW   — 1s motion test at TEST_480. Cheap pre-flight check.
//                  Fails-soft (skip if too unstable).
//   3. VIDEO_FULL — KIE Kling image-to-video full insert (5s minimum,
//                   trimmed by compositor to durationPreset).
//
// Single-cut runner. Caller invokes one per insert (no bulk runner — that's
// the Z26 lesson: bulk burns credit). The ActionInsertsPhase UI provides
// per-card render + bulk-pending button which fans out via this function.
// ─────────────────────────────────────────────────────────────────────────────

import {
  generateGpt4oImageFast,
  generateVideoJob, pollVideoJobUntilDone,
} from '../../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import type { Model, Product } from '../../../../stores/types'
import type {
  ActionInsertClip, InsertRenderStage, ActionPresetId, InsertRenderMode, CameraFraming,
} from '../types'
import { pickSeedanceDuration } from '../types'
import { ACTION_PRESETS } from './actionPresets'
import { getFFmpeg } from './ffmpegLoader'
import { pickProductRefIndexes } from './insertRefPicker'
import type { ProductVisualBrief } from '../../../../services/productVisualBrief'

// ── Stage update callback ─────────────────────────────────────────────────

export interface InsertStageUpdate {
  stage: InsertRenderStage
  keyframeRef?: string
  keyframePromptUsed?: string
  previewVideoRef?: string
  fullTaskId?: string
  videoRef?: string
  error?: string
}

export interface RenderInsertParams {
  kieApiKey: string
  presetId: ActionPresetId
  /** Product is required for needsProduct presets; null OK for scene-only
   *  presets like PHONE_SCROLL or BEFORE_AFTER_REACTION. */
  product: Product | null
  /** Avatar ref — used when the insert features the speaker (e.g. DRINK,
   *  TAKE_PILL, BEFORE_AFTER_REACTION). For product-only inserts (e.g.
   *  PRODUCT_CLOSEUP, DESK_PRODUCT) the avatar ref is optional. */
  avatar: Model | null
  /** Chain anchor — the Phase 3 creator video's generated keyframe (the
   *  person already placed in the real scene + wardrobe + lighting). When
   *  present, inserts that feature the person anchor their identity to THIS
   *  frame instead of the raw avatar bank portrait, so the insert person
   *  matches the talking-head creator (no outfit / lighting / look jump). */
  creatorKeyframeRef?: string
  /** Resolution to render at — driven by cost mode */
  resolution: '480p' | '720p' | '1080p'
  /** Z39 — 'video' (Kling clip) or 'ken_burns' (still + local zoom). Default
   *  'video'. When 'ken_burns' the renderer skips Kling and produces the mp4
   *  locally from the keyframe (no KIE credit beyond the keyframe). */
  renderMode?: InsertRenderMode
  /** Overlay duration (seconds) — used to size the Ken Burns clip. Ignored for
   *  Kling video (fixed 5s). Default 3.5s. */
  durationSec?: number
  /** Skip the cheap preview-motion test (Stage 2). Default false. */
  skipPreview?: boolean
  /** Z37 — free visual prompt for a CONCEPT_SCENE insert (no product on
   *  screen). Required when presetId === 'CONCEPT_SCENE'; ignored otherwise. */
  conceptPrompt?: string
  /** Director upgrade — 'hands_noface' drops the avatar/face and renders a
   *  hands-only product-in-use shot in its real setting. Default 'creator'. */
  cameraFraming?: CameraFraming
  /** Z98 — the verbatim spoken line this scene illustrates. Used by the
   *  builder to detect "time has passed" beats (after N weeks / result / CTA)
   *  and switch the avatar wardrobe to outfit B/C so the ad reads as filmed
   *  across multiple days, not 60s in one outfit. */
  quote?: string
  /** P4b — the product's visual brief (from all 4 images). Lets the renderer
   *  pick the BEST product image(s) for THIS insert's action instead of always
   *  reusing image #1. Optional: falls back to the single image when absent. */
  visualBrief?: ProductVisualBrief
  /** Phase A — asset:xxx (or URL) of a bundled GIFT image. When present, the
   *  renderer HARD-LOCKS the product to ONE clean hero ref + adds the gift as a
   *  SEPARATE reference object (two distinct objects, never merged). Set only on
   *  the two closing cuts; absent on every other insert. */
  giftRef?: string
  /** Phase A — render this many IDENTICAL product units (the real offer quantity, capped 4).
   *  >1 hard-locks the product to ONE clean hero ref so the N copies stay consistent. Set only
   *  on the penult product-hero cut; absent/1 elsewhere. */
  productUnits?: number
  /** Per-stage status callback */
  onStageUpdate: (update: InsertStageUpdate) => void
  /** P3t — KIE poll progress fan-out so the UI can show "đang render…
   *  poll #5 · 28s" instead of a blind spinner. Best-effort: not every
   *  upstream KIE call surfaces it (the keyframe pre-roll is too short to
   *  matter), only the long Grok i2v poll is wired below. */
  onProgress?: (info: { pollCount: number; elapsedSec: number }) => void
  signal?: AbortSignal
}

export interface RenderInsertResult {
  keyframeRef: string
  keyframePromptUsed: string
  previewVideoRef?: string
  videoRef: string
  /** Present only for Kling ('video') renders — Ken Burns has no KIE task. */
  fullTaskId?: string
}

// ── Build keyframe prompt for the insert ──────────────────────────────────

// Z98 — V4 strip list. The director sometimes writes "glowing light on her face",
// "radiant skin", "soft shimmer" inside conceptPrompt. The image model honours
// those literal words and the cảnh ends up with a halo / beauty-filter look,
// breaking the "real iPhone footage" rule. Strip them BEFORE the prompt reaches
// the image model — keeps director prompt unchanged + zero new rules layered on.
const GLOW_STRIP_RE = /\b(soft |gentle |warm |bright )?(glowing|glow|radiant|shimmer(ing)?|sparkle|sparkling|halo|sun[- ]?kissed|dewy glow|luminous|luminescent|ethereal|cinematic light|soft glow|divine light|heavenly( light)?)\b,?\s*/gi

// Z98 — V1 outfit. Detect a quote that implies time has passed between scenes
// ("sau N tuần / vài tuần / kết quả / before-after / CTA cuối"). Universal
// across VN / MS / EN.
// Z98 #2 — detect a BEFORE/AFTER comparison scene (split-screen / side-by-side).
// In these the SAME person appears twice in one frame and the two halves must
// wear DIFFERENT outfits, else "time has passed" reads fake (looks like one
// sitting with two expressions). Matched off the conceptPrompt, universal.
const BEFORE_AFTER_RE = /\b(before[- ]?(and[- ]?)?after|before\s*\/\s*after|split[- ]?screen|side[- ]?by[- ]?side|trước\s*(và|\/|-)?\s*sau|sebelum\s*(dan|\/|-)?\s*selepas)\b/i

// P6at — WARDROBE = SAME as the reference (identity fix). The old P6h rule forced a DIFFERENT
// "outfit B" on every b-roll cut for a "multi-day filming" feel — but the b-roll engine
// (gpt-4o-image + Seedance) can't hold the FACE tightly across an outfit + hijab-colour change,
// so the lips cuts (Kling, outfit A, exact face) vs the b-roll cuts (outfit B + slightly drifted
// face) read as TWO DIFFERENT PEOPLE (user audited: "broll mặt khác lips, 2 người khác nhau").
// Same-person consistency matters far more than the multi-day look, so the b-roll creator now
// wears the EXACT SAME outfit + hijab as the keyframe → face AND clothing match → one creator.
// before/after is still EXEMPT (it deliberately dictates two contrasting outfits in one frame).
/** Wardrobe instruction: keep the creator's outfit IDENTICAL to the reference keyframe. */
function brollWardrobeClause(_product: Product | null, refIndex: number): string {
  return (
    `WARDROBE — the creator wears the EXACT SAME outfit, top and headwear as reference image ` +
    `#${refIndex}: the SAME clothing, the SAME hijab/scarf COLOUR and style (or the SAME hair if ` +
    `they wear none). Do NOT change the outfit or the hijab colour — SAME person, SAME outfit ` +
    `across the WHOLE video, so every cut is unmistakably the same creator. Only the pose / action ` +
    `/ setting / facial expression changes between cuts.`
  )
}

function buildInsertKeyframePrompt(
  presetId: ActionPresetId,
  product: Product | null,
  productRefIndex: number,
  personRefIndex: number,
  conceptPrompt?: string,
  renderMode?: InsertRenderMode,
  is3D = false,
  _quote?: string,   // P6h — was used by the removed "after-time wardrobe" branch; kept positionally
  noFace = false,
  giftRefIndex = 0,   // Phase A — >0 means a bundled gift image rides as ref #giftRefIndex
): string {
  const preset = ACTION_PRESETS[presetId]
  const paragraphs: string[] = []
  // V4 — strip glow words from conceptPrompt for person scenes (3D mechanism
  // animations keep the glow because they're scientific renders, not people).
  const safeConcept = conceptPrompt && personRefIndex > 0 && !is3D
    ? conceptPrompt.replace(GLOW_STRIP_RE, '').replace(/\s+/g, ' ').trim()
    : conceptPrompt

  // Z37 — CONCEPT_SCENE: a free concept B-roll written by the AI scene director.
  // No product on screen → no product lock, no identity lock, no preset action.
  // Pure text-to-image illustration of the dialogue span.
  if (presetId === 'CONCEPT_SCENE') {
    const scene = safeConcept?.trim()
    // Z61 — emotion concept (video) features a PERSON; lock it to the creator
    // avatar so the same face appears across the whole ad (not a random
    // stranger). Graphic concept (ken_burns infographic) has no person.
    // Identity-grounding fix: lock to the avatar whenever a person ref is attached,
    // in ANY render mode (not only 'video') — so a creator concept never renders a
    // random stranger / wrong gender just because it was a still-mode preview.
    const isEmotionPerson = personRefIndex > 0
    if (isEmotionPerson) {
      paragraphs.push(
        `IDENTITY LOCK: The person in this scene is the SAME person from reference ` +
        `image #${personRefIndex} — preserve EXACTLY their FACE, skin tone, ` +
        `GENDER, age and build. This must read as the same creator who appears elsewhere ` +
        `in the video, NOT a different model and NEVER a different gender. The scene text ` +
        `only describes what they DO and the setting — their identity comes from this reference.`,
      )
      // P6h — this concept cut is a B-ROLL → wear the shared outfit B (different from the
      // lips/keyframe outfit, identical across b-roll). EXEMPT the before/after split, whose
      // conceptPrompt already dictates two contrasting outfits in the one frame.
      if (!BEFORE_AFTER_RE.test(safeConcept ?? '')) {
        paragraphs.push(brollWardrobeClause(product, personRefIndex))
      }
    }
    paragraphs.push(
      `SCENE: ${scene && scene.length > 0
        ? scene
        : preset.promptPreset}`,
    )
    paragraphs.push(
      'COMPOSITION: vertical 9:16 aspect ratio, ONE clear focal subject centred ' +
      'with generous empty margins. The frame is cropped to tall vertical and ' +
      'slowly zoomed, so EVERY visible element — subject, icons, and especially ' +
      'TEXT LABELS — MUST sit within the CENTRAL 60% of the frame (≥20% padding ' +
      'from EVERY edge: top, bottom, left, right). NO text touching or running ' +
      'off any edge. If a label is long, break it into two stacked short lines ' +
      'rather than letting it stretch toward the edges.',
    )
    if (!isEmotionPerson) {
      // Z70 — strengthen no-product rule. Even "generic" devices that look like
      // a competitor / fake version of the product (a generic knee brace, a
      // generic jar of powder, an unbranded toothbrush head) are NOT allowed
      // here. The viewer should see anatomy, ingredients, mechanism, or feeling
      // — never any object that competes visually with the real product.
      paragraphs.push(
        'NO PRODUCT — concept / mood illustration only. ZERO product-like objects in ' +
        'frame: no brace, no jar, no bottle, no tube, no sachet, no pill, no device, ' +
        'no toothbrush head, no medical appliance — branded OR unbranded, real OR ' +
        'generic, full OR partial. Also NO manufactured object as the hero subject: no ' +
        'appliance, electronics, gadget, speaker, box or furniture. Any object the scene ' +
        'text names only as SETTING (e.g. an air-conditioner, a fan) stays small in the ' +
        'BACKGROUND — it is NEVER the focal subject. Show ONLY anatomy, ingredients in ' +
        'their raw form, mechanism diagrams, body parts, or feelings/emotions. The product ' +
        'belongs in CUT scenes (HOLD_PRODUCT, PRODUCT_IN_ACTION, etc.), never here.',
      )
    } else {
      paragraphs.push(
        'No product packaging in frame — this is a reaction / emotion shot of the PERSON only. ' +
        'The person is the SOLE hero subject: do NOT render any appliance, device, gadget, ' +
        'speaker, box or furniture as a focal/hero subject. An object named only as setting ' +
        '(an air-conditioner, a fan…) stays small in the background, never the subject.',
      )
    }

    // Z48 — the ART STYLE now lives INSIDE the conceptPrompt (the Director
    // writes either a hand-drawn UGC infographic — with ${lang} text labels +
    // icons — or a realistic microscopy look, per scene). So the keyframe
    // builder must NOT impose its own conflicting style anymore. The old Z46
    // block forced "scientific microscopy, monochrome, NO text" onto EVERY
    // graphic scene, which fought an infographic conceptPrompt and produced
    // abstract art with no labels. We now DEFER to the conceptPrompt and only
    // add non-conflicting guards (these apply to both looks):
    const isGraphic = renderMode === 'ken_burns'
    if (is3D) {
      // Z98 — clean 3D scientific animation for a product-mechanism beat. No
      // person, no product, no text — a premium commercial mechanism shot.
      paragraphs.push(
        'STYLE: Clean photorealistic 3D scientific / medical ANIMATION render — like a ' +
        'premium toothpaste / skincare commercial mechanism shot. Smooth studio 3D, ' +
        'cross-section or macro of the body part, soft depth of field, soft clinical ' +
        'light. NO people, NO avatar, NO hands, NO text / labels, NO product packaging, ' +
        'NO hand-drawn / sketch / cartoon / flat-illustration look. Photoreal 3D only.',
      )
    } else if (isGraphic) {
      // Graphic concept (ken_burns): infographic OR realistic — conceptPrompt
      // decides. Text labels are ALLOWED here (infographics need them).
      paragraphs.push(
        'STYLE: Follow the art direction in the SCENE above. If it is a sketch / ' +
        'infographic, make it a SIMPLE friendly HAND-DRAWN visual — clean line-art ' +
        'doodle, warm marker feel, one clear idea, lots of empty space, absorbable ' +
        'at a glance. Render the SHORT text labels the SCENE specifies (ingredient ' +
        'names, a number, the key term) EXACTLY as written in the SCENE — same ' +
        'language, do NOT translate or change them — a few short labels (1-3 words ' +
        'each), BIG and correctly spelled. NO sentences or paragraphs. If the SCENE ' +
        'asks for a realistic microscopy / medical look instead, make it photoreal.',
      )
      paragraphs.push(
        'Avoid: paragraphs or sentences of text, dense medical-poster layout, ' +
        'multiple stacked sections, title bars, rows of bottom icons, busy ' +
        'cluttered compositions, watermarks, brand logos, product packaging, ' +
        'glossy plastic 3D-render, neon glow, rainbow gradient. Keep ONLY the few ' +
        'key-term labels — no explanatory prose.',
      )
    } else {
      // Emotion concept (video): real human/lifestyle footage, no text.
      paragraphs.push(
        'STYLE: Authentic UGC iPhone footage — real lived-in moment, natural daylight, ' +
        'subtle grain, real texture. NOT cinematic, NOT studio, NOT magazine, NOT stock-photo.',
      )
      paragraphs.push(
        'Avoid: text overlays, watermarks, logos, product packaging, 3D-render look, ' +
        'cartoon, beauty filter, cinematic color grade.',
      )
    }
    return paragraphs.join('\n\n')
  }

  // 1. Subject locks — reference each image by its ACTUAL position in filesUrl
  if (productRefIndex > 0 && product) {
    paragraphs.push(
      `PRODUCT LOCK: ${product.productName ?? 'the product'} from reference image #${productRefIndex}. ` +
      // P5s — keep the product IDENTICAL across every scene + honor the real form. The
      // model was inventing packaging (a different pouch each scene) for a LOOSE product
      // whose photos have no pack → "gói đỏ cảnh này, gói vàng cảnh kia". Lock it.
      `Match its appearance EXACTLY to the reference photo — same form, color, label, and ` +
      `the SAME packaging-or-no-packaging. Do NOT invent a package / pouch / box / label / ` +
      `text that is NOT in the reference. If the reference shows the product LOOSE (no ` +
      `packaging — e.g. loose food, powder, loose items), keep it LOOSE (in a bowl / hand / ` +
      `on a surface), NEVER a made-up pack. The product must look the SAME in every scene. ` +
      preset.objectInteraction,
    )
    // Texture fidelity — when the CONTENTS / material are shown (open jar, scoop, dab, a
    // macro / close-up / zoom into the product), the model must keep their TRUE physical
    // consistency from the reference photo + brief, not default to a thin liquid. This is
    // the gel/cream/balm/paste drift fix (a thick gel rendered as runny water on zoom).
    paragraphs.push(
      `TEXTURE FIDELITY: if the product's CONTENTS / material are shown (open lid, on a ` +
      `fingertip, on a spoon, a macro or close-up), render them at the EXACT consistency in ` +
      `the reference photo + product brief — a thick gel / cream / balm / paste / ointment ` +
      `HOLDS ITS SHAPE and looks dense, glossy and substantial; a serum/oil is viscous, not ` +
      `watery; a powder stays granular. NEVER turn a thick gel/cream/balm into thin runny ` +
      `liquid or water. Match the reference's color AND material-state, including inside the jar.`,
    )
  }
  // Phase A — GIFT LOCK. A bundled free gift rides as a SEPARATE reference object. Keep the
  // product (#productRefIndex) and the gift (#giftRefIndex) as TWO distinct objects — never
  // merge / blend / swap / restyle one into the other. This is the hard product lock the
  // closing cuts (product+gift hero; creator holding both) depend on.
  if (giftRefIndex > 0) {
    paragraphs.push(
      `GIFT LOCK: reference image #${giftRefIndex} is a SEPARATE FREE BONUS GIFT — a DIFFERENT ` +
      `object from the product. The PRODUCT (#${productRefIndex || 1}) and the GIFT (#${giftRefIndex}) ` +
      `appear TOGETHER in the frame but are TWO SEPARATE items, clearly apart — NEVER merge, blend, ` +
      `fuse, swap, or restyle one into the other; do NOT turn the product into the gift or vice-versa. ` +
      // FIX5 (merged in place) — anti-invent-packaging: the model dreamed up a fake box + garbled
      // label ("Sandr Berb / Suitable for blood pressure") over a loose snack. Mirror the LOOSE rule.
      `Reproduce the gift EXACTLY as in reference #${giftRefIndex} and NOTHING more: do NOT invent a ` +
      `box / pack / wrapper / label / logo / sticker / any text or words NOT visible in that reference. ` +
      `If the gift reference is LOOSE / has NO packaging (loose food, fruit, an unpackaged item), keep ` +
      `it LOOSE exactly as shown — never wrap it in a made-up package; copy any existing text verbatim.`,
    )
  }
  if (personRefIndex > 0) {
    // P6at — wardrobe policy = SAME outfit as the keyframe (identity fix; see brollWardrobeClause).
    // FACE *and* CLOTHING both match the reference so b-roll reads as the same creator as the lips
    // cuts. before/after stays exempt (two contrasting outfits in one frame).
    const isBeforeAfter = presetId === 'BEFORE_AFTER_REACTION' ||
      (!!conceptPrompt && BEFORE_AFTER_RE.test(conceptPrompt))
    paragraphs.push(
      `IDENTITY LOCK: Person from reference image #${personRefIndex}. Preserve EXACTLY the FACE, ` +
      `skin tone, gender, age and build — the SAME recognizable human being in every scene — AND ` +
      `keep the SAME clothing + headwear as the reference (see the wardrobe rule below).`,
    )
    if (isBeforeAfter) {
      // before/after split — two contrasting outfits in ONE frame (EXEMPT from the shared B,
      // its conceptPrompt already dictates the two looks).
      paragraphs.push(
        `BEFORE/AFTER WARDROBE: the two halves are the SAME person on TWO DIFFERENT DAYS — they ` +
        `MUST wear a COMPLETELY DIFFERENT outfit on each half: different top, different bottoms, ` +
        `AND different headwear/hairstyle (if any — e.g. a different hijab color). The AFTER half ` +
        `looks fresher / brighter. Keep ONLY the SAME FACE — everything WORN differs so it reads ` +
        `"before" vs weeks later. NEVER the same outfit on both sides.`,
      )
    } else {
      paragraphs.push(brollWardrobeClause(product, personRefIndex))
    }
  }
  // Z98 — REAL-WORLD SCALE lock. Universal anti-drift for any scene where the
  // product shares the frame with the person. Image models often emphasise the
  // product by enlarging it (a 30 ml serum bottle the size of a fist, a 15 cm
  // toothpaste tube the size of a water bottle) or shrinking it the other way —
  // both kill the "real UGC" feel instantly. The reference photo already pins
  // the appearance; this line pins the SIZE relationship to the hand/face.
  if (productRefIndex > 0 && product && personRefIndex > 0) {
    paragraphs.push(
      `REAL-WORLD SCALE: Render the product at its TRUE physical size relative ` +
      `to the person's hand and face — exactly the proportions visible in ` +
      `reference image #${productRefIndex}. Do NOT scale it up to "hero" it ` +
      `and do NOT shrink it; the size must look natural and physically ` +
      `plausible for a viewer who has handled this kind of product in real life.`,
    )
  }

  // 2. Composition
  paragraphs.push(`COMPOSITION: ${preset.framingPreset} shot, vertical 9:16 aspect ratio.`)

  // 3. Action prompt — Z42: PRODUCT_IN_ACTION uses the director's free action
  // (conceptPrompt) instead of the fixed preset verb, while still keeping the
  // product lock above. The 12 fixed presets keep their hard-won stable prompt.
  // P6ag — PRODUCT_CLOSEUP also honours the free concept (so each macro shows a DIFFERENT detail,
  // not the same fixed shot) — but it renders PRODUCT-ONLY (no hands; see block below).
  const freeAction = (presetId === 'PRODUCT_IN_ACTION' || presetId === 'PRODUCT_CLOSEUP') ? safeConcept?.trim() : ''
  paragraphs.push(`ACTION: ${freeAction && freeAction.length > 0 ? freeAction : preset.promptPreset}`)

  // P6ag — PRODUCT-ONLY framing for a macro/detail cut: NO hands, NO person, product static on a
  // surface (NOT held, NOT rotated). Holding + rotating a product is the #1 cause of i2v packaging
  // DRIFT/morph; keeping it untouched on a surface keeps the product locked to its reference.
  if (presetId === 'PRODUCT_CLOSEUP') {
    // FIX2 — gift/quantity-aware: drop the "sits ALONE / product alone" wording (it contradicted a
    // gift-bundle or multi-unit offer cut). Keep the real intent: NO hands / NO person / STATIC.
    const subject = giftRefIndex > 0
      ? 'The product and the free gift sit STATIC together'
      : 'The product (or the product units) sit STATIC'
    paragraphs.push(
      'PRODUCT-ONLY FRAMING — NO hands, NO fingers, NO person, NO body part anywhere in frame. ' +
      `${subject} on a clean real surface — NOT held and NOT rotated (a held / rotating product makes ` +
      'the packaging morph). Clean macro / medium-close with only a gentle slow camera push. Everything ' +
      'stays EXACTLY as its reference image (same colour, shape, label). Soft natural daylight on a real surface.',
    )
  }

  // Director upgrade — no-face hands-in-action shot. No avatar ref was sent, so
  // there is no IDENTITY LOCK; enforce hands-only + the real setting so the model
  // renders genuine product-in-use B-roll instead of a posed person.
  if (noFace) {
    paragraphs.push(
      'HANDS-ONLY FRAMING — NO face, NO head, NO full person in the frame. Show ' +
      'ONLY the hands (and forearms) performing the ACTION above, together with the ' +
      'real-world SETTING / background it describes. First-person / over-the-hands ' +
      'phone angle. The product stays EXACTLY as its reference image (same colour, ' +
      'shape, label). Authentic UGC iPhone footage of a real moment — natural light, ' +
      'real textures, slight handheld feel. NOT studio, NOT staged, NOT cinematic.',
    )
  }

  // 4. Hand behaviour
  paragraphs.push(`HANDS: ${preset.handBehavior}`)

  // 5. Realism
  paragraphs.push(
    'STYLE: Authentic UGC iPhone photo — real lived-in moment, natural daylight, ' +
    'subtle grain, real skin texture. NOT cinematic, NOT studio, NOT magazine.',
  )

  // 6. Negative
  paragraphs.push(
    'Avoid: malformed hands, extra fingers, distorted product, redesigned packaging, ' +
    'cinematic lighting, 3D-render look, cartoon, beauty filter.',
  )
  // P6f — motion-drift guard (one shared place): the i2v step morphs/warps on complex or
  // implausible motion. Pin ONE simple physically-coherent movement + a stable product shape.
  // P6az — HARD anti-"product bay tứ tung": i2v flings/duplicates/floats the product on action
  // cuts. Pin it: the product STAYS in the hand or on the surface for the WHOLE clip — never
  // tossed, thrown, spun, flipped, bounced, or floating; its position + scale + orientation stay
  // steady; the ONLY motion is a slow, calm, everyday gesture. Universal VN / MS.
  paragraphs.push(
    'MOTION: ONE simple, slow, calm, physically-plausible movement only — natural human pace, ' +
    'no morphing, no warping, no extra or vanishing limbs/fingers. EVERY object in frame (the ' +
    'product — plus any extra unit or bundled gift the scene shows) stays HELD in the hand or ' +
    'resting on the surface the WHOLE shot — NEVER thrown, tossed, spun, flipped, bounced, ' +
    'floating or flying; steady position + scale + orientation, stable shape, size and identity ' +
    '(never melts, bends, drifts or changes form). Do NOT add or remove objects mid-shot. ' +
    'No fast or chaotic motion.',
  )
  // FIX B — PRODUCT-IN-USE coherence (demo cuts keep hands BY DESIGN, but must not drift). When the
  // product is applied to / used on the body, lock it to the SAME body site + one anatomically-sane
  // hand + a stable single human, so "tay bôi lên người/mặt" never renders chaotic / wrong-logic.
  if (presetId === 'PRODUCT_IN_ACTION') {
    paragraphs.push(
      'PRODUCT-IN-USE COHERENCE: if the product is applied to / rubbed on / used on a body part, apply ' +
      'it to the EXACT body area the action describes, on the SAME spot the whole shot — ONE hand, five ' +
      'correct fingers, a natural grip, one realistic gesture (no second hand appearing, no hand passing ' +
      'through the body). The person stays ONE consistent human: face, skin tone, hair and proportions do ' +
      'NOT morph, duplicate, smear or distort, and NO second face appears. Realistic human anatomy only.',
    )
  }

  return paragraphs.join('\n\n')
}

/** Z61 — which scenes feature the CREATOR and must lock to the avatar so the
 *  same person appears across the whole ad. Without this, emotion concept
 *  scenes + product-in-action scenes generated RANDOM strangers, so a single
 *  review showed 2-3 different faces (authenticity killer).
 *    • HOLD_PRODUCT / DRINK / TAKE_PILL / BEFORE_AFTER_REACTION — person + product
 *    • PRODUCT_IN_ACTION — the person uses/applies the product (brush, rub…)
 *    • CONCEPT_SCENE + video (emotion) — a person expressing a feeling
 *  Graphic CONCEPT_SCENE (ken_burns infographic) has NO person → no avatar. */
function usesAvatarRef(presetId: ActionPresetId, renderMode?: InsertRenderMode, is3D = false, cameraFraming?: CameraFraming): boolean {
  // Z98 — a 3D mechanism animation has NO person, even though it's a video concept.
  if (is3D) return false
  if (['HOLD_PRODUCT', 'DRINK', 'TAKE_PILL', 'BEFORE_AFTER_REACTION', 'PRODUCT_IN_ACTION'].includes(presetId)) {
    return true
  }
  // Emotion concept scenes feature the creator → MUST lock the avatar so the same person
  // appears (a female avatar must never render as a man). Identity-grounding fix: lock
  // whenever the cut is creator-framed, in ANY render mode (still preview included) — not
  // only 'video'. A graphic infographic concept (no person) is cameraFraming !== 'creator'.
  // P6as — a NO-FACE concept (a 3D mechanism, or any hands_noface concept) must NEVER inject the
  // avatar, even in video mode. The old `|| renderMode === 'video'` forced a face onto every video
  // concept cut → a hands_noface 3D cut still got the creator (the "cảnh 3D có người" bug, belt to
  // the is3D fix above). Lock the avatar only for a CREATOR-framed concept; keep the video-mode
  // lock for the legacy/undefined-framing path but exclude hands_noface.
  if (presetId === 'CONCEPT_SCENE') return cameraFraming === 'creator' || (renderMode === 'video' && cameraFraming !== 'hands_noface')
  return false
}

/** Pick which assets to send to KIE as filesUrl — product first, then the
 *  person reference. The person reference chains to the creator video's
 *  keyframe when available (visual continuity), falling back to the raw
 *  avatar bank portrait only when there is no creator keyframe yet. */
async function resolveRefs(
  preset: typeof ACTION_PRESETS[ActionPresetId],
  product: Product | null,
  avatar: Model | null,
  creatorKeyframeRef?: string,
  renderMode?: InsertRenderMode,
  is3D = false,
  visualBrief?: ProductVisualBrief,
  quote?: string,
  conceptPrompt?: string,
  noFace = false,
  cameraFraming?: CameraFraming,
  giftRef?: string,
  productUnits = 1,
): Promise<{ refs: string[]; productRefIndex: number; personRefIndex: number; giftRefIndex: number }> {
  const refs: string[] = []
  let productRefIndex = 0
  let personRefIndex = 0
  let giftRefIndex = 0
  // Phase A — when a gift rides along OR we must render multiple identical units (a quantity
  // offer), HARD-LOCK the product to ONE clean hero ref so the model has a single source of
  // truth to replicate (no blend with the gift; the N copies stay consistent).
  const hasGift = !!(giftRef && giftRef.trim())
  const singleHero = hasGift || productUnits > 1
  // Z98 — a 3D mechanism animation shows no product + no person.
  if (preset.needsProduct && product && !is3D) {
    // P4b — pick which of the product's 4 images fit THIS insert (hero + a
    // scene-match + clean diversity, ≥2, capped). The FIRST pushed image is the
    // hero, so productRefIndex stays = the "#N" the prompt names; the extra
    // product refs reinforce identity / supply the right state to GPT-4o.
    const imgs = (product.productImages?.length ? product.productImages : (product.productImage ? [product.productImage] : []))
      .filter((r) => !!r && r.trim() !== '')
    if (imgs.length > 0) {
      const picked = pickProductRefIndexes(visualBrief, preset.id, quote, conceptPrompt)
        .filter((i) => i >= 0 && i < imgs.length)
      // Phase A — with a gift in frame OR a multi-unit deal, use ONLY the hero (1 ref) so
      // the model has a single clean product to preserve / replicate. Otherwise the usual
      // hero + scene-match + diversity pick.
      const chosen = singleHero
        ? [picked.length ? picked[0] : 0]
        : picked.length ? [...picked] : [0]
      // Guarantee ≥2 product refs when ≥2 images exist (anti-lazy) — SKIPPED when we deliberately
      // keep the product to a single hero ref (gift bundle / multi-unit deal).
      if (!singleHero) {
        for (let i = 0; chosen.length < Math.min(2, imgs.length) && i < imgs.length; i++) {
          if (!chosen.includes(i)) chosen.push(i)
        }
      }
      for (const i of chosen) {
        const ref = imgs[i]
        const url = isAssetRef(ref) ? await getUrl(ref) : ref
        if (url) {
          refs.push(url)
          if (productRefIndex === 0) productRefIndex = refs.length  // first = hero = the prompt's "#N"
        }
      }
    }
  }
  // Phase A — the gift reference goes right AFTER the product, BEFORE the person,
  // so its "#N" is stable for the GIFT LOCK paragraph in the keyframe prompt.
  if (hasGift && !is3D) {
    const url = isAssetRef(giftRef!) ? await getUrl(giftRef!) : giftRef!
    if (url) { refs.push(url); giftRefIndex = refs.length }
  }
  if (!noFace && usesAvatarRef(preset.id, renderMode, is3D, cameraFraming)) {
    // Director upgrade — a 'hands_noface' shot deliberately omits the avatar so
    // no face appears; personRefIndex stays 0 → no IDENTITY LOCK in the prompt.
    // Chain anchor first, raw avatar portrait second.
    const personRef = creatorKeyframeRef ?? avatar?.characterImage
    if (personRef) {
      const url = isAssetRef(personRef) ? await getUrl(personRef) : personRef
      if (url) { refs.push(url); personRefIndex = refs.length }
    }
  }
  return { refs, productRefIndex, personRefIndex, giftRefIndex }
}

// P6as — the image model (gpt-4o-image) HARD-rejects medical/anatomical/graphic prompts with
// "Image did not pass content moderation, please try another picture." Worst for health niches
// (a 3D throat/joint cross-section, "blockage / inflamed tissue / pain / wincing"). Detect it…
function isModerationError(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return m.includes('moderation') || m.includes('did not pass') || m.includes('content policy') ||
    m.includes('safety system') || m.includes('flagged')
}
// …and soften the prompt for ONE retry: swap the clinical/graphic trigger words for neutral,
// non-anatomical wording + force a clean abstract wellness visual. Only runs AFTER a real block,
// so being aggressive here never degrades the 95% of scenes that pass first try.
function softenForModeration(prompt: string): string {
  const soft = prompt
    .replace(/cross-?sections?/gi, 'stylised cutaway')
    .replace(/\besophagus\b/gi, 'throat area')
    .replace(/\binflamed\b/gi, 'irritated')
    .replace(/\binflammation\b/gi, 'discomfort')
    .replace(/\bblockages?\b/gi, 'congestion')
    .replace(/\b(mucus|phlegm)\b/gi, 'discomfort')
    .replace(/\bpainful\b/gi, 'uncomfortable')
    .replace(/\bpain\b/gi, 'discomfort')
    .replace(/\b(wincing|wince)\b/gi, 'uneasy')
    .replace(/\b(distressed|struggling)\b/gi, 'uncomfortable')
    .replace(/\b(bacteria|pathogens?|germs?)\b/gi, 'impurities')
    .replace(/\bblood cells?\b/gi, 'nutrient flow')
    .replace(/\bnerves?\b/gi, 'the area')
  return `${soft} Keep it a CLEAN, ABSTRACT, NON-graphic wellness visualisation — no medical/anatomical realism, no gore, no distressing imagery.`
}

// ── Public: render a single insert end-to-end ──────────────────────────────

export async function renderInsert(
  params: RenderInsertParams,
): Promise<RenderInsertResult> {
  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')

  // Z98 #5 — stickers never go through this Grok pipeline. They're drawn
  // locally (stickerRenderer) + auto-applied in ActionInsertsPhase, so reaching
  // here means a stale call; fail loud rather than burn a Grok render.
  if (params.renderMode === 'sticker') {
    throw new Error('Sticker được tạo sẵn (local, 0 credit) — không cần render qua AI.')
  }

  const preset = ACTION_PRESETS[params.presetId]
  // Z98 — a mechanism scene rebuilt into a clean 3D scientific animation (no
  // person, no product). Marked by the director layer via this conceptPrompt prefix.
  // P6as — detect 3D for BOTH prefixes. Legacy ActionInserts writes "3D MECHANISM ANIMATION";
  // the HYBRID pipeline (hybridRenderer) wraps it as "3D ANIMATION (no people, no hands…)". The
  // old check matched ONLY the legacy prefix → a hybrid mechanism3d cut had is3D=false → the
  // no-person 3D guard never fired → the avatar got injected into the 3D scene (the audited
  // "cảnh 3D có người" bug). Match either prefix.
  const is3D = /^\s*3D (MECHANISM )?ANIMATION/i.test(params.conceptPrompt ?? '')
  // Director upgrade — a no-face hands-in-action shot: drop the avatar ref so no
  // face appears, keep the product + setting. Only ever a real PRODUCT_IN_ACTION
  // scene (never CTA/3D — guarded both in the director parse and here).
  const noFace = params.cameraFraming === 'hands_noface' && !is3D && params.presetId === 'PRODUCT_IN_ACTION'
  const { refs: filesUrl, productRefIndex, personRefIndex, giftRefIndex } = await resolveRefs(
    preset, params.product, params.avatar, params.creatorKeyframeRef, params.renderMode, is3D,
    params.visualBrief, params.quote, params.conceptPrompt, noFace, params.cameraFraming, params.giftRef,
    params.productUnits ?? 1,
  )

  // Z37 — the scene verb that drives the Kling motion prompts (Stage 2/3).
  // For CONCEPT_SCENE it comes from the AI scene director's free prompt; for
  // the 12 product presets it stays the hard-won stable preset prompt.
  // Z42 — CONCEPT_SCENE has NO product on screen (special keyframe branch +
  // Ken Burns default). PRODUCT_IN_ACTION keeps the product but uses the
  // director's free action. Both pull their scene verb from conceptPrompt.
  const isConcept = params.presetId === 'CONCEPT_SCENE'
  const usesFreeAction = isConcept || params.presetId === 'PRODUCT_IN_ACTION'
  const motionScene = usesFreeAction
    ? (params.conceptPrompt?.trim() || preset.promptPreset)
    : preset.promptPreset
  const cameraMotion = preset.cameraPreset === 'static'
    ? 'Locked-off camera.'
    : 'Subtle handheld micro-motion.'

  // ── STAGE 1: KEYFRAME ─────────────────────────────────────────────────
  params.onStageUpdate({ stage: 'keyframe' })

  const keyframePromptUsed = buildInsertKeyframePrompt(
    params.presetId, params.product, productRefIndex, personRefIndex,
    params.conceptPrompt, params.renderMode, is3D, params.quote, noFace, giftRefIndex,
  )
  console.log(`[INSERT ${params.presetId}] Stage 1 keyframe prompt len=${keyframePromptUsed.length}, refs=${filesUrl.length}`)

  const kfOpts = {
    apiKey: params.kieApiKey,
    filesUrl,
    size: '2:3' as const,  // closest GPT-4o supports to vertical 9:16
    // Z43 — KIE GPT-4o image-edit with 2 reference images routinely takes
    // 90-140s when the KIE queue is busy. The old 90s hard cap abandoned
    // tasks that would have finished at ~100s, turning a slow-but-fine run
    // into a "TIMEOUT" failure. Give it a realistic window (150s) and one
    // extra fresh attempt so a transient KIE "Internal Error" gets a 3rd shot.
    softTimeoutMs: 100_000,
    attemptTimeoutMs: 150_000,
    maxAttempts: 3,
    signal: params.signal,
  }
  // P6as — on a content-moderation BLOCK (medical/anatomical/graphic prompt), retry ONCE with a
  // softened, non-graphic prompt instead of failing the whole scene. Other errors bubble as before.
  let keyframeRemoteUrl: string
  try {
    keyframeRemoteUrl = await generateGpt4oImageFast({ ...kfOpts, prompt: keyframePromptUsed })
  } catch (err) {
    if (!isModerationError(err)) throw err
    const softened = softenForModeration(keyframePromptUsed)
    console.warn(`[INSERT ${params.presetId}] keyframe bị moderation chặn → thử lại với prompt đã làm nhẹ`)
    keyframeRemoteUrl = await generateGpt4oImageFast({ ...kfOpts, prompt: softened })
  }

  const keyframeBlob = await fetch(keyframeRemoteUrl).then((r) => r.blob())
  const keyframeRef = await saveAsset(keyframeBlob, keyframeBlob.type || 'image/png')
  params.onStageUpdate({ stage: 'keyframe', keyframeRef, keyframePromptUsed })

  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')

  // ── STAGE 2 (still mode): NO video API — hold the keyframe locally ─────
  // Z39/Z76 — for concept / ingredient / mechanism scenes we don't pay the i2v
  // model just to add motion. Render a STATIC image clip over the keyframe with
  // ffmpeg.wasm IN THE BROWSER (free) and save it as a normal mp4 so the planner
  // + final assembler treat it exactly like a video insert.
  // Z76 — was a Ken Burns zoom; the zoom+crop kept cutting off the infographic
  // text labels ("ảng bám" / "Vi khu" sheared at the edges). User wants 100%
  // of the content visible, so it's now a non-moving fit (see renderStaticImageClip).
  if ((params.renderMode ?? 'video') === 'ken_burns') {
    params.onStageUpdate({ stage: 'video_full', keyframeRef, keyframePromptUsed })
    console.log(`[INSERT ${params.presetId}] Stage 2 static-image start (local ffmpeg, no video API)`)
    const videoRef = await renderStaticImageClip({
      imageBlob: keyframeBlob,
      durationSec: params.durationSec ?? 3.5,
      resolution: params.resolution,
    })
    params.onStageUpdate({ stage: 'completed', keyframeRef, keyframePromptUsed, videoRef })
    return { keyframeRef, keyframePromptUsed, videoRef }
  }

  // ── STAGE 2: VIDEO — SINGLE Kling i2v pass ─────────────────────────────
  // Z38 — there used to be a separate 480p "preview" Kling render here BEFORE
  // the full render — and the two ran back-to-back with NO approval gate in
  // between, so the cheap preview was never actually used to decide anything;
  // it just doubled the Kling submissions (2 paid jobs per insert → 10 for a
  // 5-insert ad). Deleted. One Kling job per insert now. Its taskId is
  // persisted BEFORE polling so a timeout can RESUME the already-paid job
  // (resumeInsertVideo) instead of re-submitting and charging again.
  params.onStageUpdate({ stage: 'video_full', keyframeRef, keyframePromptUsed })
  console.log(`[INSERT ${params.presetId}] Stage 2 video_full start (${params.resolution}, bytedance/seedance-1.5-pro)`)

  const keyframePublicUrl = await getUrl(keyframeRef)
  if (!keyframePublicUrl) throw new Error('Không lấy được URL keyframe (asset store)')

  // Z76 — i2v model history: Kling 3.0 (422) → Veo 3.1 Fast (audio fails, ~60c)
  // → Wan 2.7 (16cr/s) → grok-imagine-video-1-5-preview (PREMIUM 14.5cr/s) →
  // grok-imagine/image-to-video (1.6cr/s @480p) → NOW `bytedance/seedance-1.5-pro`
  // i2v @480p (1.75 cr/s — ~same price as Grok but stronger prompt-adherence /
  // less logic-drift). Keyframe goes in as first_frame_image_url so the GPT-4o
  // face+product lock is preserved; prompt + director (brain) UNCHANGED — only the
  // animate model swapped. VIDEO-ONLY. ~11cr/clip at 480p. Static-image auto-fallback
  // (Z63/Z76) still covers any failure. Seedance renders ONLY 4/8/12s → pick the
  // smallest that covers THIS scene's slot (assembler trims the rest). Short cuts get
  // the cheap 4s, longer ones 8/12 — credit chip uses the SAME pickSeedanceDuration.
  const videoDuration = pickSeedanceDuration(params.durationSec ?? 4)

  // Z77 — keep b-roll people SILENT. Grok i2v otherwise animates the person
  // mouthing ENGLISH words (it's English-trained), which clashes with the
  // creator lipsync that actually owns the voiceover → the viewer saw two
  // people "talking" at once (#4 brushing, #6 holding the jar). We forbid
  // SPEECH ONLY, never mouth movement: scenes like brushing teeth / applying
  // the product MUST be able to open the mouth for the action — we only stop
  // it from forming words. Applies to any scene that features a person.
  const personPresent = usesAvatarRef(params.presetId, params.renderMode, is3D)
  const noSpeech = personPresent
    ? ' IMPORTANT: the person does NOT speak, talk, or mouth any words — no dialogue, no lip-syncing of speech, no conversation. The mouth may still open naturally as the physical action requires (e.g. brushing teeth, applying the product, an open relaxed smile); it simply never forms words. The creator voiceover owns all speech.'
    : ''
  try {
    const fullSubmission = await generateVideoJob({
      apiKey: params.kieApiKey,
      jobModelId: 'bytedance/seedance-1.5-pro',
      prompt: (isConcept
        ? `${motionScene} ${cameraMotion} No product packaging in frame.`
        : `${motionScene} ${cameraMotion} ${preset.handBehavior}`) + noSpeech,
      aspectRatio: '9:16',
      resolution: params.resolution,
      duration: videoDuration,
      // Seedance i2v: the keyframe is the FIRST FRAME (first_frame_image_url) so the
      // GPT-4o face+product lock carries into the clip (Grok used referenceImageUrls).
      startFrameUrl: keyframePublicUrl,
    })
    console.log(`[INSERT ${params.presetId}] Seedance submitted taskId=${fullSubmission.taskId.slice(0, 12)} dur=${videoDuration}s`)
    params.onStageUpdate({
      stage: 'video_full', keyframeRef, keyframePromptUsed,
      fullTaskId: fullSubmission.taskId,
    })

    const videoRef = await pollAndSaveInsertVideo({
      apiKey: params.kieApiKey,
      taskId: fullSubmission.taskId,
      timeoutMs: 10 * 60 * 1000,  // 10min ceiling for a 5s i2v clip
      logTag: `${params.presetId}/full`,
      onProgress: params.onProgress,
    })

    params.onStageUpdate({
      stage: 'completed',
      keyframeRef, keyframePromptUsed,
      fullTaskId: fullSubmission.taskId, videoRef,
    })

    return {
      keyframeRef,
      keyframePromptUsed,
      videoRef,
      fullTaskId: fullSubmission.taskId,
    }
  } catch (videoErr) {
    if (params.signal?.aborted) throw videoErr  // user cancelled — surface as-is
    // Z98 V5 — NO MORE silent fallback to a static-image clip. The old fallback
    // marked the clip "DONE" with a frozen keyframe, so the user thought they
    // had a video and the 16cr credit was burnt without recourse. Now we
    // surface the failure honestly: stage='failed' fires the red "Lỗi" badge
    // in the UI + the user clicks "Lại" to retry. (Grok itself doesn't charge
    // for a failed render, so retry is free.)
    const msg = videoErr instanceof Error ? videoErr.message : String(videoErr)
    console.warn(`[INSERT ${params.presetId}] Grok i2v failed (${msg.slice(0, 140)})`)
    params.onStageUpdate({
      stage: 'failed', keyframeRef, keyframePromptUsed,
      error: msg.slice(0, 240),
    })
    throw new Error(`Video render lỗi: ${msg.slice(0, 160)} — bấm "Lại" để thử lại (không tốn thêm credit).`)
  }
}

// ── Resume a paid-but-unfinished insert video job ───────────────────────────
// Z38 — same recovery path as the creator video: when the poll above times out
// (or the user refreshed), the Kling job is still running on KIE and was
// already charged. Re-poll the SAME taskId — never submit a new job, so it
// does NOT spend more credit.

export interface ResumeInsertParams {
  kieApiKey: string
  /** The fullTaskId persisted from a prior (timed-out) insert render. */
  taskId: string
  onStageUpdate: (update: InsertStageUpdate) => void
  timeoutMs?: number
  signal?: AbortSignal
}

export async function resumeInsertVideo(
  params: ResumeInsertParams,
): Promise<{ videoRef: string }> {
  if (params.signal?.aborted) throw new Error('CANCELLED — user huỷ')
  console.log(`[INSERT resume] re-polling paid task ${params.taskId} (no new charge)`)
  params.onStageUpdate({ stage: 'video_full', fullTaskId: params.taskId })

  const videoRef = await pollAndSaveInsertVideo({
    apiKey: params.kieApiKey,
    taskId: params.taskId,
    timeoutMs: params.timeoutMs ?? 10 * 60 * 1000,
    logTag: 'resume',
  })

  params.onStageUpdate({ stage: 'completed', fullTaskId: params.taskId, videoRef })
  return { videoRef }
}

// ── Static image clip: still → mp4 (local, free) ───────────────────────────
// Z76 — replaces the old Ken Burns zoom. User feedback: the zoom+crop kept
// shearing the infographic text labels off the edges, and no amount of prompt
// tuning fully fixed it. The ONLY way to guarantee 100% of the content stays
// visible is to NOT crop and NOT move. So this renders a fully static clip:
//   • foreground = the whole keyframe scaled to FIT (force_original_aspect_
//     ratio=decrease) → never cropped, every label intact.
//   • background = the same keyframe scaled to COVER + heavily blurred, filling
//     the letterbox gap so there are no hard black bars (the standard vertical-
//     content fill look). The keyframe bg is light cream, so the blur reads as
//     a soft extension, not a bar.
// Output is a normal 9:16 mp4 (no audio) saved to the asset store, so the rest
// of the pipeline (planner / assembler) is UNCHANGED — it just sees a videoRef.
// Runs in the browser → costs ZERO KIE credit.
async function renderStaticImageClip(args: {
  imageBlob: Blob
  durationSec: number
  resolution: '480p' | '720p' | '1080p'
}): Promise<string> {
  const ffmpeg = await getFFmpeg()
  const dur = Math.max(1.5, Math.min(8, args.durationSec || 3.5))
  const shortSide = args.resolution === '1080p' ? 1080 : args.resolution === '720p' ? 720 : 480
  const W = shortSide % 2 === 0 ? shortSide : shortSide + 1
  const h0 = Math.round((shortSide * 16) / 9)
  const H = h0 % 2 === 0 ? h0 : h0 + 1
  const fps = 30
  const id = Math.random().toString(36).slice(2, 8)
  const ext = (args.imageBlob.type || '').includes('png') ? 'png' : 'jpg'
  const inName = `st_${id}.${ext}`
  const outName = `st_${id}.mp4`

  await ffmpeg.writeFile(inName, new Uint8Array(await args.imageBlob.arrayBuffer()))

  // split: [bg] cover+blur fills the frame, [fg] full image fit on top centred.
  // NO crop on fg → text can never be cut. NO zoompan → fully static.
  const filter =
    `[0:v]split=2[bg][fg];` +
    `[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=20:2,setsar=1[bgb];` +
    `[fg]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1[fgs];` +
    `[bgb][fgs]overlay=(W-w)/2:(H-h)/2:format=auto,format=yuv420p[v]`

  await ffmpeg.exec([
    '-loop', '1', '-t', String(dur), '-i', inName,
    '-filter_complex', filter, '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-pix_fmt', 'yuv420p', '-r', String(fps), '-t', String(dur),
    '-an', '-y', outName,
  ])

  const data = await ffmpeg.readFile(outName)
  const blob = new Blob(
    [data instanceof Uint8Array ? (data as unknown as BlobPart) : new Uint8Array()],
    { type: 'video/mp4' },
  )
  await ffmpeg.deleteFile(inName).catch(() => {})
  await ffmpeg.deleteFile(outName).catch(() => {})
  return saveAsset(blob, 'video/mp4')
}

/** Poll an i2v task to completion, then download + persist the MP4.
 *  Z67 — Wan i2v uses the /jobs API (createTask + recordInfo), so poll with
 *  pollVideoJobUntilDone (was Veo /veo/record-info in Z46). */
async function pollAndSaveInsertVideo(args: {
  apiKey: string
  taskId: string
  timeoutMs: number
  logTag?: string
  onProgress?: (info: { pollCount: number; elapsedSec: number }) => void
}): Promise<string> {
  const remoteUrl = await pollVideoJobUntilDone({
    apiKey: args.apiKey,
    taskId: args.taskId,
    timeoutMs: args.timeoutMs,
    logTag: args.logTag,
    onProgress: args.onProgress,
  })
  const blob = await fetch(remoteUrl).then((r) => r.blob())
  return saveAsset(blob, blob.type || 'video/mp4')
}

/** Helper: list cuts that are eligible for a bulk render call. Excludes
 *  locked / approved / rejected / generating items (Z26 lesson). */
export function listEligibleInsertsForBulk(inserts: ActionInsertClip[]): ActionInsertClip[] {
  return inserts.filter((it) => {
    if (it.status === 'locked' || it.status === 'approved' || it.status === 'rejected') return false
    if (it.stage === 'keyframe' || it.stage === 'preview_motion' || it.stage === 'video_full') return false
    // Idle + failed are eligible (failed inserts can be retried)
    return it.stage === 'idle' || it.stage === 'failed'
  })
}
