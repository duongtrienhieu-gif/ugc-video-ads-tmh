// ── Prompt Compiler v2 — LAYERED ARCHITECTURE ───────────────────────────────
//
// Phase L2 refactor. The first lite pass reduced section verbosity but kept
// the 5-section bullet-list structure (~1200-1500 chars per prompt). User
// reported KIE timeouts + queue stalls — prompts still too big.
//
// NEW LAYERED ARCHITECTURE:
//   1. GLOBAL_STYLE     — module-level constant, ~110 chars, shared every call
//   2. GLOBAL_NEGATIVE  — module-level constant, ~90 chars, shared every call
//   3. LOCKS            — 2 short lines: "Same person from #N. Same product from #M"
//   4. SCENE DELTA      — ONE flowing paragraph from blueprint fields
//   5. Header           — single line referencing the image refs
//
// Target prompt size: 400-900 chars per scene (vs ~4k-8k before lite, vs
// ~1500 after first lite pass).
//
// Globals are JS module constants — string allocation happens once at import
// time, every compilePrompt() call references the same memory. No need for
// runtime caching.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CompiledPrompt,
  CompiledPromptContext,
  SceneBlueprint,
  SubjectFocus,
  VisualMotif,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════
// LAYER 1 — GLOBAL STYLE (shared once per pipeline, allocated once at import)
// ═══════════════════════════════════════════════════════════════════════
const GLOBAL_STYLE = 'Authentic UGC iPhone photo · natural ambient light · sharp focus on subject + product label · real lived-in interior · NOT cinematic · NOT studio · NOT editorial.'

// ═══════════════════════════════════════════════════════════════════════
// LAYER 2 — GLOBAL NEGATIVE (shared once)
// ═══════════════════════════════════════════════════════════════════════
const GLOBAL_NEGATIVE = 'Avoid: wrong face · redesigned packaging · distorted hands / extra fingers · text overlay / watermark · cartoon / 3D-render look.'

// ═══════════════════════════════════════════════════════════════════════
// LAYER 3 — IDENTITY + PRODUCT LOCKS (2 short lines from refs)
// ═══════════════════════════════════════════════════════════════════════
function buildLocks(opts: {
  identityRef: number | null
  productRef: number | null
  ctx: CompiledPromptContext
  /** Z11: when true, this scene has NO person — replace identity lock with
   *  an explicit "no person" directive. */
  avatarAbsent: boolean
  focus: SubjectFocus
}): string {
  const { identityRef, productRef, ctx, avatarAbsent, focus } = opts

  let identityLine: string
  if (avatarAbsent) {
    identityLine = `NO PERSON in this scene — subjectFocus=${focus}. Do NOT render any human, face, hands, or body. Reference images are for product / object identity only.`
  } else if (identityRef === null) {
    identityLine = 'No identity reference for this scene.'
  } else {
    const identityBump = ctx.overrides?.bumpIdentityLock
      ? ' Retry: previous attempt drifted face — match LITERALLY.'
      : ''
    identityLine = `Same person from ref #${identityRef} — face / age / ethnicity locked. Outfit + environment vary per scene.${identityBump}`
  }

  const productLine = productRef === null
    ? 'Product ABSENT this scene — pre-discovery beat, generic objects only.'
    : (() => {
        const bump = ctx.overrides?.bumpProductLock
          ? ' Retry: previous attempt redesigned the packaging — render pixel-for-pixel.'
          : ''
        const label = ctx.overrides?.bumpLabelLock
          ? ' Preserve every label letter.'
          : ''
        return `Same product from ref #${productRef} — packaging / label / logo / shape preserved exactly.${bump}${label}`
      })()

  return `${identityLine}\n${productLine}`
}

// ═══════════════════════════════════════════════════════════════════════
// LAYER 4 — SCENE DELTA (one flowing paragraph from blueprint fields)
// ═══════════════════════════════════════════════════════════════════════
//
// Combines every meaningful blueprint axis into a single natural-language
// sentence rather than a labelled bullet list. Models follow flowing
// descriptions better than enumerations of the same length.

const MOTION_PHRASE: Partial<Record<NonNullable<SceneBlueprint['motionStyle']>, string>> = {
  subtle_head_turn:   'subtle head turn',
  stomach_holding:    'holding stomach with slight wince',
  eating_motion:      'mid-bite / casual sip',
  selfie_talk:        'talking to phone camera',
  pointing_product:   'pointing at product label',
  laugh_with_family:  'warm laugh with others',
  unboxing_reveal:    'lifting / rotating package',
  walking_in:         'walking into frame',
  static_pose:        'holding the exact pose',
}

const VISIBILITY_PHRASE = {
  low:    'product NOT in frame',
  medium: 'product visible but not hero',
  high:   'product hero, label clearly readable',
} as const

function buildSceneDelta(blueprint: SceneBlueprint): string {
  // Z11: route by subjectFocus. Non-person scenes get a totally different
  // shape (no wardrobe, no pose, no avatar instruction).
  const focus = blueprint.subjectFocus ?? 'person'

  if (focus !== 'person') {
    return buildNonPersonDelta(blueprint, focus)
  }

  // ── Default: person-centric scene (existing behavior) ─────────────────
  const phrases: string[] = []

  // Lead: action + emotion fuse into the opening clause
  if (blueprint.subjectAction && blueprint.emotion) {
    phrases.push(`Subject ${blueprint.subjectAction} with ${blueprint.emotion} expression`)
  } else if (blueprint.subjectAction) {
    phrases.push(`Subject ${blueprint.subjectAction}`)
  } else if (blueprint.pose) {
    phrases.push(`Subject ${blueprint.pose}`)
  }

  // Wardrobe + environment as a single contextual clause
  const contextBits: string[] = []
  if (blueprint.wardrobeStyle) contextBits.push(`wearing ${blueprint.wardrobeStyle}`)
  if (blueprint.environment)   contextBits.push(`in ${blueprint.environment}`)
  else if (blueprint.environmentType) contextBits.push(`in ${blueprint.environmentType}`)
  if (contextBits.length) phrases.push(contextBits.join(' '))

  if (blueprint.lightingStyle) phrases.push(blueprint.lightingStyle)

  // Camera as one clause
  const camBits: string[] = []
  if (blueprint.composition) camBits.push(blueprint.composition)
  if (blueprint.cameraAngle) camBits.push(blueprint.cameraAngle)
  if (camBits.length) phrases.push(camBits.join(', '))

  // Motion intent (drives video animation later)
  if (blueprint.motionStyle && MOTION_PHRASE[blueprint.motionStyle]) {
    phrases.push(`mid-action: ${MOTION_PHRASE[blueprint.motionStyle]}`)
  }

  // Product visibility — explicit so model knows whether to show packaging
  phrases.push(VISIBILITY_PHRASE[blueprint.productVisibility])

  if (blueprint.ctaFocus) phrases.push('CTA beat: direct confident eye contact')

  // Z12: layer motif anchor so person scenes don't all share the same mood
  const motif = motifAnchor(blueprint.visualMotif)

  const beat = blueprint.sceneType ? `[${blueprint.sceneType.toUpperCase()}] ` : ''
  return `${beat}${phrases.join('. ')}.${motif}`
}

// ─── Z12: motif phrases injected into non-person scene delta ───────────────
// Adds a concrete aesthetic anchor on top of subjectFocus so two infographic
// scenes don't look identical.
//
// Example: subjectFocus='infographic' + motif='chemistry' →
//   "render as glowing 3D molecular structures, atomic bonds, chemical formulas
//    orbiting the product"
//
// vs subjectFocus='infographic' + motif='social-proof' →
//   "render as floating metric cards with ★ stars, user count badges,
//    testimonial chips around the product"

const MOTIF_PHRASE: Record<VisualMotif, string> = {
  'medical':      'clinical diagram aesthetic: cell pathway / body system / diagnostic infographic feel, sterile blue-white palette',
  'chemistry':    'molecular structures, atomic bonds, chemical formulas, lab beaker hint, deep blue/teal gradient',
  'energy':       'glowing 3D particles, light streaks, motion-blur energy waves, electric cyan/amber glow',
  'premium':      'soft gradient backdrop, gold/cream accent, halo glow, refined minimal',
  'luxury':       'black velvet backdrop, marble pedestal, dramatic chiaroscuro lighting',
  'scientific':   'data viz, microscope-feel detail, sterile clean palette, technical labels',
  'organic':      'fresh herbs / leaves / fruit accent, soft natural daylight, earthy tones',
  'social-proof': 'floating metric cards (★ stars, user count, COD badge), testimonial chips, multi-card composition',
  'kinetic':      'motion blur, dynamic crop, fast-feel composition, action streak',
  'emotional':    'warm window light, golden hour, intimate / vulnerable mood',
}

function motifAnchor(motif: VisualMotif | undefined): string {
  if (!motif) return ''
  return ` Motif: ${MOTIF_PHRASE[motif]}.`
}

// ─── Z11: scene-delta variants for non-person subjectFocus ─────────────────
//
// These produce entirely different prompt shapes so a "Vitamin B floating
// particles" scene doesn't end up as a portrait of a person holding a bottle.
// Z12 layers a motif anchor on top so two infographic scenes feel distinct.
//
function buildNonPersonDelta(blueprint: SceneBlueprint, focus: Exclude<SubjectFocus, 'person'>): string {
  const beat = blueprint.sceneType ? `[${blueprint.sceneType.toUpperCase()}] ` : ''
  const camBits: string[] = []
  if (blueprint.composition) camBits.push(blueprint.composition)
  if (blueprint.cameraAngle) camBits.push(blueprint.cameraAngle)
  const camera = camBits.length ? camBits.join(', ') : 'centered composition'
  const lighting = blueprint.lightingStyle ?? 'clean even product light'
  // subjectAction is repurposed in non-person scenes to describe the VISUAL
  // (particles orbit, capsule splits, ingredient swirls, etc).
  const visualAction = blueprint.subjectAction?.trim() || blueprint.visualObjective?.trim() || ''
  // Z12: motif phrase anchors the aesthetic so this scene doesn't look like
  // every other scene of the same focus.
  const motif = motifAnchor(blueprint.visualMotif)

  switch (focus) {
    case 'product': {
      // Hero product macro, NO PERSON in frame.
      return `${beat}NO PERSON IN FRAME — hero product macro shot. ` +
        `Product centered, label clearly readable, preserve packaging exactly from reference image. ` +
        `${visualAction ? `Visual: ${visualAction}. ` : ''}` +
        `${camera}. ${lighting}.${motif} ` +
        `Background: clean minimal seamless surface that complements the packaging color. ` +
        `Product hero, no avatar, no hands, no body parts.`
    }
    case 'infographic': {
      // 3D animation / floating molecules / mechanism diagram.
      return `${beat}NO PERSON IN FRAME — infographic / 3D animation visual. ` +
        `${visualAction ? `Show: ${visualAction}. ` : ''}` +
        `Render as glowing 3D particles / molecular structures / floating energy / capsule explode view / ` +
        `mechanism diagram surrounding the product. The product (from reference) sits centered with its ` +
        `packaging preserved exactly — particles and labels orbit / float / animate AROUND it. ` +
        `Clean dark gradient background with subtle glow. ${camera}. ${lighting}.${motif} ` +
        `Native Malaysia ecommerce infographic feel — NOT pharma-clinical, NOT cinematic. ` +
        `No avatar, no person, no hands.`
    }
    case 'ingredient': {
      // Raw ingredient closeup / capsule cross-section.
      return `${beat}NO PERSON IN FRAME — ingredient macro shot. ` +
        `${visualAction ? `Show: ${visualAction}. ` : ''}` +
        `Render the key ingredient (capsule cross-section, fruit/herb macro, powder swirl, gummy split, ` +
        `vitamin tablet closeup) with the product packaging visible in background or beside the ingredient. ` +
        `Shallow depth of field. ${camera}. ${lighting}.${motif} ` +
        `Native ecommerce ingredient card aesthetic. No avatar, no person.`
    }
    case 'lifestyle': {
      // Environment / context shot — no person, product subtle or absent.
      return `${beat}NO PERSON IN FRAME — lifestyle environment context. ` +
        `${visualAction ? `Scene: ${visualAction}. ` : `Setting: ${blueprint.environment ?? 'home interior'}`}. ` +
        `${blueprint.productVisibility === 'low'
          ? 'Product NOT in frame — pure environment / mood shot.'
          : 'Product subtly placed in context (kitchen counter, desk corner, etc) — not held by anyone.'} ` +
        `${camera}. ${lighting}.${motif} ` +
        `Native UGC environment shot feel. No avatar, no person, no hands.`
    }
  }
}

/** Baseline master-frame paragraph (no scene blueprint exists). */
function buildMasterFrameDelta(): string {
  return 'Subject holds product at chest level with label facing camera, gentle confident expression, looking at lens. Clean modern home interior, soft natural daylight from one side. Vertical medium close-up portrait. Product hero, label clearly readable.'
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPILER
// ═══════════════════════════════════════════════════════════════════════

export function compilePrompt(ctx: CompiledPromptContext): CompiledPrompt {
  // Pain / pre-discovery scenes: drop product from filesUrl so KIE image
  // conditioning doesn't smuggle the packaging into a "no product" frame.
  const productAbsent = ctx.scene?.productVisibility === 'low'

  // Z11: when subjectFocus is non-person, DROP the avatar ref entirely.
  // Otherwise the image model treats the avatar as a "must include" and
  // forces the avatar into product / infographic / ingredient scenes.
  const focus: SubjectFocus = ctx.scene?.subjectFocus ?? 'person'
  const avatarAbsent = focus !== 'person'

  const filesUrlOrder: CompiledPrompt['filesUrlOrder'] = []
  if (!productAbsent) filesUrlOrder.push('product')
  if (!avatarAbsent)  filesUrlOrder.push('avatar')
  if (ctx.masterFrameUrl) filesUrlOrder.push('masterFrame')

  // Reference indices follow the ACTUAL filesUrl order (1-indexed)
  let cursor = 1
  const productRefIdx = !productAbsent ? cursor++ : null
  const avatarRefIdx  = !avatarAbsent  ? cursor++ : null
  const masterRefIdx  = ctx.masterFrameUrl ? cursor++ : null

  // identity = master frame if we have it, else avatar, else null (non-person scene)
  const identityRef = masterRefIdx ?? avatarRefIdx
  const productLockRef = masterRefIdx ?? productRefIdx

  // Build the 4 prompt sections
  const locks = buildLocks({
    identityRef,
    productRef: productAbsent ? null : productLockRef,
    ctx,
    avatarAbsent,
    focus,
  })
  const sceneDelta = ctx.scene ? buildSceneDelta(ctx.scene) : buildMasterFrameDelta()
  const visualDna = ctx.overrides?.bumpRealism
    ? `${GLOBAL_STYLE} Retry: emphasise visible skin texture, no AI sheen.`
    : GLOBAL_STYLE
  // Z11: non-person scenes need a different negative — explicitly forbid
  // accidentally inserting a person.
  const negativePrompt = avatarAbsent
    ? `${GLOBAL_NEGATIVE} Also avoid: any person, face, hands, body parts, model — this is a product/infographic scene only.`
    : GLOBAL_NEGATIVE

  // Header — single short line listing actual ref map
  const refMap: string[] = []
  if (productRefIdx) refMap.push(`#${productRefIdx}=product`)
  if (avatarRefIdx)  refMap.push(`#${avatarRefIdx}=avatar`)
  if (masterRefIdx)  refMap.push(`#${masterRefIdx}=master frame`)
  const refTag = refMap.length > 0 ? refMap.join(' · ') : 'no reference images'
  const omitted: string[] = []
  if (productAbsent) omitted.push('product ref omitted')
  if (avatarAbsent)  omitted.push(`avatar ref omitted — subjectFocus=${focus}`)
  const header = `Image-edit: ${refTag}${omitted.length ? ` (${omitted.join(', ')})` : ''}.`

  // Assemble — locks immediately under header so model sees identity before scene
  const final = [header, locks, sceneDelta, visualDna, negativePrompt].join('\n\n')

  // Return preserves the legacy CompiledPrompt shape (5 named sections) so
  // existing debug panel + smart-retry logic keep working. identityLock
  // and productLock are stored as the two halves of `locks`.
  const lockLines = locks.split('\n')
  return {
    identityLock: lockLines[0] ?? '',
    productLock: lockLines[1] ?? '',
    sceneBlueprint: sceneDelta,
    visualDna,
    negativePrompt,
    final,
    filesUrlOrder,
  }
}

/** Convenience: master frame baseline (no scene blueprint, no master ref). */
export function compileMasterFramePrompt(ctx: Omit<CompiledPromptContext, 'scene' | 'masterFrameUrl'>): CompiledPrompt {
  return compilePrompt({ ...ctx, scene: undefined, masterFrameUrl: undefined })
}

/** Convenience: scene gen derived from approved master frame. */
export function compileScenePrompt(
  ctx: Omit<CompiledPromptContext, 'scene' | 'masterFrameUrl'>,
  scene: SceneBlueprint,
  masterFrameUrl: string,
): CompiledPrompt {
  return compilePrompt({ ...ctx, scene, masterFrameUrl })
}
