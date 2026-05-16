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
  identityRef: number
  productRef: number | null
  ctx: CompiledPromptContext
}): string {
  const { identityRef, productRef, ctx } = opts

  const identityBump = ctx.overrides?.bumpIdentityLock
    ? ' Retry: previous attempt drifted face — match LITERALLY.'
    : ''

  const identityLine = `Same person from ref #${identityRef} — face / age / ethnicity locked. Outfit + environment vary per scene.${identityBump}`

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
  // Build phrases in natural reading order: action → emotion → outfit →
  // environment → light → framing → camera → motion → product visibility.
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

  const beat = blueprint.sceneType ? `[${blueprint.sceneType.toUpperCase()}] ` : ''
  return `${beat}${phrases.join('. ')}.`
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

  const filesUrlOrder: CompiledPrompt['filesUrlOrder'] = []
  if (!productAbsent) filesUrlOrder.push('product')
  filesUrlOrder.push('avatar')
  if (ctx.masterFrameUrl) filesUrlOrder.push('masterFrame')

  // Reference indices follow the ACTUAL filesUrl order (1-indexed)
  const productRefIdx = productAbsent ? null : 1
  const avatarRefIdx  = productAbsent ? 1 : 2
  const masterRefIdx  = ctx.masterFrameUrl
    ? (productAbsent ? 2 : 3)
    : null
  const identityRef = masterRefIdx ?? avatarRefIdx
  const productLockRef = masterRefIdx ?? productRefIdx

  // Build the 4 prompt sections
  const locks = buildLocks({
    identityRef,
    productRef: productAbsent ? null : productLockRef,
    ctx,
  })
  const sceneDelta = ctx.scene ? buildSceneDelta(ctx.scene) : buildMasterFrameDelta()
  const visualDna = ctx.overrides?.bumpRealism
    ? `${GLOBAL_STYLE} Retry: emphasise visible skin texture, no AI sheen.`
    : GLOBAL_STYLE
  const negativePrompt = GLOBAL_NEGATIVE

  // Header — single short line listing actual ref map
  const refMap: string[] = []
  if (productRefIdx) refMap.push(`#${productRefIdx}=product`)
  refMap.push(`#${avatarRefIdx}=avatar`)
  if (masterRefIdx)  refMap.push(`#${masterRefIdx}=master frame`)
  const header = `Image-edit: ${refMap.join(' · ')}${productAbsent ? ' (product ref omitted)' : ''}.`

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
