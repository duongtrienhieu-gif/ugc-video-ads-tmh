// ── Prompt Compiler v2 ───────────────────────────────────────────────────────
// Replaces the old "giant cinematic paragraph" prompts with a structured
// 5-section compiler. Every prompt sent to the image API is built by this
// module from the locked identity pack + scene blueprint + DNA + strength.
//
// Why structured sections matter:
//   - Easier to debug: each block can be inspected separately
//   - Easier to tune: bump strength → only lock blocks change, scene block stays
//   - Easier to extend: new modules (QC, A/B tests) can swap individual sections
//   - Models follow structured directives better than long paragraphs
//
// PRIORITY RULES (built into the language tiers below):
//   - PRODUCT LOCK is ALWAYS strict, regardless of consistency strength.
//     Reason: face drift is recoverable (people forgive a slight mismatch),
//     packaging drift is fatal (sells a wrong product = brand damage).
//   - AVATAR LOCK scales with consistency strength.
//   - filesUrl[] order: [product, avatar, ...masterFrame?] — product first.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CompiledPrompt,
  CompiledPromptContext,
  SceneBlueprint,
  ConsistencyConfig,
} from '../types'

// ── Strength tier helper (drives language strictness) ────────────────────────

type StrengthTier = 'creative' | 'balanced' | 'strict'

function getStrengthTier(c: ConsistencyConfig): StrengthTier {
  if (c.strength >= 90) return 'strict'
  if (c.strength >= 85) return 'balanced'
  return 'creative'
}

// ── [1] IDENTITY LOCK ────────────────────────────────────────────────────────

function buildIdentityLock(ctx: CompiledPromptContext, refIndex: number): string {
  const { identity, consistency } = ctx
  const tier = getStrengthTier(consistency)

  // Phrase changes by tier (avatar lock is more elastic than product lock)
  const matchPhrase = tier === 'strict'
    ? 'MUST EXACTLY match'
    : tier === 'balanced'
      ? 'must closely match'
      : 'should closely resemble'

  return `[1] IDENTITY LOCK
THE PERSON IS: the individual from reference image #${refIndex}.
The face in the output ${matchPhrase} the face in this reference: same face shape, eyes (color + shape), eyebrows, nose, lips, jawline, cheekbones, skin tone, age range.
Locked description (from analysis): ${identity.avatarDescription}
Preserve: same gender · same ethnicity · same approximate age · same hijab style + color OR same hairstyle/hair color/length · same facial hair if present · same accessories on face/neck (glasses, earrings).`
}

// ── [2] PRODUCT LOCK (always strict — see priority rule above) ───────────────

function buildProductLock(ctx: CompiledPromptContext, refIndex: number): string {
  const { identity, productName } = ctx

  // PRODUCT LOCK never softens — packaging drift is unacceptable
  return `[2] PRODUCT LOCK
THE PRODUCT IS: the EXACT product from reference image #${refIndex}.
Product name: "${productName}".
The product in the output MUST EXACTLY match this reference: same container TYPE (jar / bottle / tube / box / sachet / blister pack / spray / pump — do NOT swap types), same shape proportions (squat vs tall — do NOT change), same colors, same label, same branding text and logo placement.
Locked description (from analysis): ${identity.productDescription}

ABSOLUTE BAN: do NOT redesign the packaging. Do NOT invent a new supplement bottle / cream jar / random pharmacy bottle. Do NOT change the brand logo or label text. Do NOT substitute a "similar-looking" product. The uploaded product is the ONLY valid product source — every pixel of packaging must derive from reference image #${refIndex}.`
}

// ── [3] SCENE BLUEPRINT ──────────────────────────────────────────────────────

/** Master frame baseline composition (when no scene blueprint provided). */
function buildMasterFrameComposition(): string {
  return `[3] SCENE BLUEPRINT (baseline master frame)
Composition: vertical medium close-up portrait optimized for ecommerce / landing-page / social-proof imagery. The person holds the product at chest-to-shoulder height with one or both hands, label fully facing the camera. Gentle confident expression, looking directly at the lens. Clean modern home interior background, softly out of focus only on far walls — subject + product remain sharp. Natural daylight from a window to one side.

NOTE: This is a NEUTRAL baseline pose — subsequent scenes will derive variations from this frame, so render it cleanly and centered as a stable reference.`
}

/** Scene blueprint compiled from structured JSON (replaces giant cinematic prompts). */
function buildSceneFromBlueprint(blueprint: SceneBlueprint, hasMasterFrame: boolean): string {
  const visibilityHint: Record<SceneBlueprint['productVisibility'], string> = {
    'low':    'product partially visible in background or held casually',
    'medium': 'product clearly visible held at waist or table level',
    'high':   'product prominently held at chest level, label facing camera',
  }

  const masterFrameHint = hasMasterFrame
    ? '\nIMPORTANT: This scene is a VARIATION of the approved Master Frame (reference image #3). Keep the EXACT same person and EXACT same product packaging as in the master frame — only the pose, framing, environment, and expression change.'
    : ''

  const cta = blueprint.ctaFocus ? '\nCTA scene: emphasize trustworthy direct eye contact + product clearly visible for the call-to-action moment.' : ''

  return `[3] SCENE BLUEPRINT
Goal: ${blueprint.sceneGoal}
Environment: ${blueprint.environment}
Composition: ${blueprint.composition}
Camera angle: ${blueprint.cameraAngle}
Shot type: ${blueprint.shotType}
Pose: ${blueprint.pose}
Hand usage: ${blueprint.handUsage}
Emotion / expression: ${blueprint.emotion}
Background: ${blueprint.backgroundType}
Lighting: ${blueprint.lightingStyle}
Product visibility: ${blueprint.productVisibility} (${visibilityHint[blueprint.productVisibility]})
Motion hint: ${blueprint.motionIntent}
Overlay density: ${blueprint.overlayDensity}${cta}${masterFrameHint}`
}

// ── [4] VISUAL DNA ───────────────────────────────────────────────────────────

function buildVisualDna(ctx: CompiledPromptContext): string {
  const { dna } = ctx
  // Per-scene visual tone (from blueprint, already clamped) overrides DNA default if present
  const tone = ctx.scene?.visualTone ?? dna.visualTone
  return `[4] VISUAL DNA
Style target: realistic ecommerce / landing-page / website lifestyle / advertorial / social-proof imagery (NOT cinematic movie scene, NOT studio commercial, NOT fashion editorial).
Camera: ${dna.cameraStyle}.
Tone: ${tone}.
Photography spec: authentic UGC smartphone — sharp focus across the entire subject + product area, zero bokeh on subject, zero depth-of-field blur on the product, natural ambient indoor lighting, no professional studio rim lighting, no AI-generated sheen, no digital enhancement, no watermarks, no text overlay. Skin shows real natural texture and pores, not retouched.`
}

// ── [5] NEGATIVE PROMPT ──────────────────────────────────────────────────────

function buildNegativePrompt(ctx: CompiledPromptContext): string {
  const tier = getStrengthTier(ctx.consistency)

  const baseNegs = [
    'random influencer who is not the reference person',
    'redesigned face / different ethnicity / different age',
    'redesigned product / different brand / fake supplement packaging',
    'invented bottle / generic white pharmacy bottle / placeholder packaging',
    'distorted fingers / extra fingers / malformed hands',
    'extra random objects in frame',
    'professional studio backdrop / commercial photo gloss',
    'plastic AI-sheen skin / retouched flawless skin',
    'heavy bokeh / dramatic depth of field blur on product',
    'text overlay / watermarks / brand stamps that weren\'t in the reference',
    'cartoon / illustration / 3D-render look',
  ]

  // Strict mode adds extra hard negatives
  if (tier === 'strict') {
    baseNegs.push(
      'any face that even slightly resembles a stock photo person',
      'any product that even slightly resembles a similar competing brand',
      'rotated label that hides the brand text',
    )
  }

  return `[5] NEGATIVE PROMPT (avoid all of the following)
${baseNegs.map((n) => `• ${n}`).join('\n')}`
}

// ── Main compiler ────────────────────────────────────────────────────────────

/**
 * Compile a 5-section prompt for the image generation API.
 *
 * Reference image order (filesUrl):
 *   [0] product   → referenced as "image #1" in prompt
 *   [1] avatar    → referenced as "image #2" in prompt
 *   [2] master    → referenced as "image #3" in prompt (only for scene-derived gens)
 *
 * The compiler returns each section separately for the debug panel + the
 * final joined string for the API call.
 */
export function compilePrompt(ctx: CompiledPromptContext): CompiledPrompt {
  // Reference indices — keep prompt text consistent with filesUrl order
  const PRODUCT_REF = 1
  const AVATAR_REF = 2
  const MASTER_REF = 3

  const filesUrlOrder: CompiledPrompt['filesUrlOrder'] = ['product', 'avatar']
  if (ctx.masterFrameUrl) filesUrlOrder.push('masterFrame')

  const identityLock = buildIdentityLock(ctx, ctx.masterFrameUrl ? MASTER_REF : AVATAR_REF)
  const productLock = buildProductLock(ctx, ctx.masterFrameUrl ? MASTER_REF : PRODUCT_REF)
  const sceneBlueprint = ctx.scene
    ? buildSceneFromBlueprint(ctx.scene, !!ctx.masterFrameUrl)
    : buildMasterFrameComposition()
  const visualDna = buildVisualDna(ctx)
  const negativePrompt = buildNegativePrompt(ctx)

  const header = `IMAGE-EDITING TASK — combine the attached reference images into one new photo optimized for ecommerce / landing-page / social-proof use (NOT cinematic).

Reference order:
  • Image #1 = PRODUCT (highest priority — packaging must be preserved exactly)
  • Image #2 = AVATAR (face/style identity)${ctx.masterFrameUrl ? '\n  • Image #3 = MASTER FRAME (approved baseline — re-use its person + product)' : ''}

═══════════════════════════════════════════════════════════════`

  const final = [
    header,
    productLock,    // product FIRST in the prompt body too — priority signal
    identityLock,
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
