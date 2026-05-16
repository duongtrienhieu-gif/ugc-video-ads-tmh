// ── Prompt Compiler v2 — LITE ────────────────────────────────────────────────
//
// PHILOSOPHY SHIFT (Phase L1 — lite refactor):
//   Storyboard already carries structured scene data (sceneType, emotion,
//   composition, environment, motionStyle, etc). Identity comes from the
//   reference IMAGE, not from a text essay describing the face.
//
//   The old compiler produced ~2000-token prompts with massive identity
//   blocks, product essays, multi-paragraph DNA, and 20-item negative lists.
//   That over-prompting:
//     • slowed gen + cost more credits
//     • created prompt-vs-image-conditioning conflicts
//     • produced inconsistent outputs across the timeline
//
//   New compiler emits ~150-400 token prompts. Each section is ONE LINE
//   driven by the blueprint data + a global style preset. The reference
//   images do the identity heavy-lifting.
//
//   Retry overrides (bumpIdentityLock / bumpProductLock / bumpRealism /
//   bumpLabelLock) still work — they append ONE short sentence each,
//   not a multi-paragraph essay.
//
// PRESERVED:
//   • Same CompiledPrompt return shape — no caller breakage
//   • Same compileMasterFramePrompt / compileScenePrompt exports
//   • filesUrlOrder gating for productVisibility='low' (pain/pre-discovery)
//   • Reference indices auto-shift when product is omitted
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CompiledPrompt,
  CompiledPromptContext,
  SceneBlueprint,
} from '../types'

// ── Global style preset ──────────────────────────────────────────────────────
// One line. Re-used across every gen instead of repeating a 20-line essay.
const GLOBAL_STYLE = 'Style: realistic UGC ecommerce iPhone photography — natural ambient light, sharp focus on subject + product label, candid framing, lived-in real interior. NOT cinematic, NOT studio, NOT magazine editorial.'

// ── Global negative — 5 essentials only ──────────────────────────────────────
const GLOBAL_NEGATIVE = 'Avoid: wrong face / different person, redesigned packaging / different brand, distorted hands / extra fingers, text overlays / fake watermarks, cartoon / 3D-render / illustration look.'

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY LOCK — one line. Reference image carries the face.
// ─────────────────────────────────────────────────────────────────────────────
function buildIdentityLock(ctx: CompiledPromptContext, refIndex: number): string {
  const bump = ctx.overrides?.bumpIdentityLock
    ? ' RETRY: previous attempt drifted the face — render LITERALLY the same individual.'
    : ''
  // wardrobeStyle is the only piece we explicitly call out — it's the "vary
  // across timeline" exception to the otherwise-locked identity.
  const wardrobe = ctx.scene?.wardrobeStyle
    ? ` Outfit for this scene: ${ctx.scene.wardrobeStyle} (clothes vary scene-to-scene; face stays locked).`
    : ''
  return `Identity: same exact person as reference image #${refIndex} — face, hair, age, ethnicity locked.${wardrobe}${bump}`
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT LOCK — one line. Reference image carries the packaging.
// ─────────────────────────────────────────────────────────────────────────────
function buildProductLock(ctx: CompiledPromptContext, refIndex: number): string {
  const bump = ctx.overrides?.bumpProductLock
    ? ' RETRY: previous attempt redesigned the packaging — render PIXEL-FOR-PIXEL the same product.'
    : ''
  const labelBump = ctx.overrides?.bumpLabelLock
    ? ' Preserve every letter of the label exactly.'
    : ''
  return `Product: same exact product as reference image #${refIndex} — packaging shape, label, logo, colors preserved exactly. Do not redesign, do not substitute.${bump}${labelBump}`
}

/** Used when scene.productVisibility === 'low' — pain/pre-discovery beats. */
function buildNoProductDirective(): string {
  return 'Product: ABSENT from this scene (emotional/pre-discovery beat). No branded packaging, no logos, no labels — only generic everyday objects.'
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE — data-driven one-liners straight from the storyboard fields.
// ─────────────────────────────────────────────────────────────────────────────
function buildSceneFromBlueprint(blueprint: SceneBlueprint): string {
  const lines: string[] = ['Scene:']
  if (blueprint.sceneType) {
    const beat = blueprint.narrativePurpose
      ? `${blueprint.sceneType} (${blueprint.narrativePurpose})`
      : blueprint.sceneType
    lines.push(`• Beat: ${beat}`)
  }
  if (blueprint.subjectAction)    lines.push(`• Action: ${blueprint.subjectAction}`)
  if (blueprint.pose)             lines.push(`• Pose: ${blueprint.pose}`)
  if (blueprint.emotion)          lines.push(`• Emotion: ${blueprint.emotion}`)
  if (blueprint.composition)      lines.push(`• Framing: ${blueprint.composition}`)
  if (blueprint.cameraAngle)      lines.push(`• Camera: ${blueprint.cameraAngle}`)
  if (blueprint.environment)      lines.push(`• Environment: ${blueprint.environment}`)
  if (blueprint.lightingStyle)    lines.push(`• Light: ${blueprint.lightingStyle}`)
  // Motion fields — useful even for STILL so the keyframe captures mid-action
  // for downstream video animators (Kling/Veo).
  if (blueprint.motionStyle)      lines.push(`• Motion intent: ${blueprint.motionStyle.replace(/_/g, ' ')}`)
  if (blueprint.handUsage)        lines.push(`• Hands: ${blueprint.handUsage}`)
  if (blueprint.ctaFocus)         lines.push('• CTA beat: direct confident eye contact, product hero in frame.')
  return lines.join('\n')
}

/** Baseline composition for the master-frame (when no scene blueprint exists). */
function buildMasterFrameComposition(): string {
  return `Scene: baseline master frame — person holds the product at chest level with one or both hands, label facing the camera, gentle confident expression, looking at lens. Clean modern home interior, soft natural daylight from one side. Vertical medium close-up portrait. Rendered cleanly as a neutral reference for downstream scenes to derive from.`
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL DNA — global style + optional realism retry. Always ≤ 2 lines.
// ─────────────────────────────────────────────────────────────────────────────
function buildVisualDna(ctx: CompiledPromptContext): string {
  const retry = ctx.overrides?.bumpRealism
    ? ' RETRY: previous attempt looked AI-rendered — emphasise visible skin texture, natural hand proportions, no retouching.'
    : ''
  return `${GLOBAL_STYLE}${retry}`
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPILER
// ─────────────────────────────────────────────────────────────────────────────

export function compilePrompt(ctx: CompiledPromptContext): CompiledPrompt {
  // Drop product ref entirely on pain/pre-discovery beats — otherwise KIE
  // GPT-image-1's image conditioning bakes the packaging back into frame
  // even if the text says "absent".
  const productAbsent = ctx.scene?.productVisibility === 'low'

  const filesUrlOrder: CompiledPrompt['filesUrlOrder'] = []
  if (!productAbsent) filesUrlOrder.push('product')
  filesUrlOrder.push('avatar')
  if (ctx.masterFrameUrl) filesUrlOrder.push('masterFrame')

  // Reference indices follow the ACTUAL filesUrl order (1-indexed).
  const productRefIdx = productAbsent ? null : 1
  const avatarRefIdx  = productAbsent ? 1 : 2
  const masterRefIdx  = ctx.masterFrameUrl
    ? (productAbsent ? 2 : 3)
    : null

  const identityLockRef = masterRefIdx ?? avatarRefIdx
  const productLockRef = masterRefIdx ?? productRefIdx ?? 0

  const identityLock = buildIdentityLock(ctx, identityLockRef)
  const productLock = productAbsent
    ? buildNoProductDirective()
    : buildProductLock(ctx, productLockRef)
  const sceneBlueprint = ctx.scene
    ? buildSceneFromBlueprint(ctx.scene)
    : buildMasterFrameComposition()
  const visualDna = buildVisualDna(ctx)
  const negativePrompt = GLOBAL_NEGATIVE

  // Compact header — single line listing the ref map.
  const refMap: string[] = []
  if (productRefIdx) refMap.push(`#${productRefIdx}=PRODUCT`)
  refMap.push(`#${avatarRefIdx}=AVATAR`)
  if (masterRefIdx)  refMap.push(`#${masterRefIdx}=MASTER FRAME`)
  const header = `Image-edit task. References: ${refMap.join(' · ')}${productAbsent ? ' (product ref omitted — emotional/pre-discovery scene)' : ''}.`

  const final = [
    header,
    identityLock,
    productLock,
    sceneBlueprint,
    visualDna,
    negativePrompt,
  ].join('\n\n')

  return {
    identityLock,
    productLock,
    sceneBlueprint,
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
