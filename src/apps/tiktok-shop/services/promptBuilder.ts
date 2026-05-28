// Prompt builder for kie.ai image generation.
//
// Design principles per [[feedback-master-template-consistency]] + TPCN niche
// constraints:
//   1. NO text in image — canvas overlays handle all typography deterministically
//   2. NO decoration / NO molecular bg / NO sparkle — anti "AI look"
//   3. Match reference photo for product fidelity (TPCN can't tolerate AI drift)
//   4. Single light source — keeps human/non-CGI feel
//   5. Output language enforced per [[feedback-language-isolation]]
//   6. EVERY slot uses the SAME locked-style block — Tier 1+2 consistency
//      across all 9 images (brand recognition test)

import type { ResolvedBrandKit, Market } from '../../../types/brandKit'
import type { Product } from '../../../stores/types'
import type { SlotConfig, PaletteFamily } from '../types'
import { TPCN_PALETTES, ATMOSPHERE_VARIANTS } from '../constants'

export interface PromptContext {
  brandKit: ResolvedBrandKit
  product: Product
  slotConfig: SlotConfig
  paletteFamily: PaletteFamily
  language: Market
}

function langLockBlock(lang: Market): string {
  if (lang === 'ms') {
    return 'STRICTLY NO TEXT IN IMAGE. If any text inevitably appears, Bahasa Malaysia ONLY — no English, Vietnamese, Chinese, Japanese, Arabic, Thai characters.'
  }
  return 'STRICTLY NO TEXT IN IMAGE. If any text inevitably appears, Vietnamese ONLY — no English, Malay, Chinese, Japanese, Arabic, Thai characters.'
}

// ── Shared locked-style block ────────────────────────────────────────────
// Prepended to EVERY slot prompt so AI keeps consistent aesthetic across all
// 9 images. Brand recognition depends on this.

function lockedStyleBlock(ctx: PromptContext): string {
  const palette = TPCN_PALETTES[ctx.paletteFamily]
  const atmosphere = ATMOSPHERE_VARIANTS[ctx.slotConfig.atmosphere]
  return `LOCKED STYLE (apply to every image — Tier 1+2 brand consistency):
- 1:1 square composition, clean medical-commerce supplement product photography
- Color palette: ONLY ${palette.primary} (primary) and ${palette.secondary} (secondary). Accent allowed: ${palette.cta}.
- Background atmosphere: ${atmosphere.promptKeyword}
- Material: matte plastic finish on bottles, NOT glossy CGI render, realistic texture
- Lighting: single soft daylight from upper-left at 30 degrees. Subtle realistic shadow falls to lower-right.
- Photography style: editorial supplement brand photography, like a premium TPCN catalog
- NO text, NO words, NO letters, NO numbers, NO logos, NO badges, NO certifications, NO watermarks
- NO decoration: no leaves, no molecular patterns, no waves, no sparkles, no glow
- NO stock-photo models, NO people, NO hands (unless slot explicitly needs them)
- ALLOWED: slight composition imperfection (3-5° rotation), micro shadow noise, subtle depth of field`
}

function productContextBlock(ctx: PromptContext): string {
  return `PRODUCT CONTEXT:
- Name: ${ctx.product.productName}
${ctx.product.productDescription ? `- Description: ${ctx.product.productDescription}` : ''}
${ctx.product.ingredients ? `- Active ingredients: ${ctx.product.ingredients}` : ''}

REFERENCE IMAGES (CRITICAL): Match the EXACT bottle shape, label design, label colors, label orientation, and cap color from the reference images provided. Do NOT invent or modify product appearance.`
}

// ── Slot 1: Hero Hook ────────────────────────────────────────────────────

export function buildPromptSlot1(ctx: PromptContext): string {
  return `A clean studio product photograph for an e-commerce hero shot.

${lockedStyleBlock(ctx)}

SLOT 1 — HERO HOOK (pill-bottle-hero-centered):
Bottle centered in frame, slight 15-degree natural rotation, ~55% of canvas height.
Bottle sits in the lower-center sweet spot.
Leave the TOP 20% and BOTTOM 20% of the canvas relatively clean (negative space for text overlay).

${productContextBlock(ctx)}

${langLockBlock(ctx.language)}

Render only the product on a clean studio background.`
}

// ── Slot 2: Pain Point ───────────────────────────────────────────────────

export function buildPromptSlot2(ctx: PromptContext): string {
  return `A documentary-style close-up showing the "before" state — the problem this product solves.

${lockedStyleBlock(ctx)}

SLOT 2 — PAIN POINT:
Show a close-up macro shot of the painful/undesired state related to the product (e.g., for teeth-whitening: yellowed teeth close-up; for skincare: tired skin texture).
Slight desaturation (-15%) to convey discomfort.
LEAVE TOP 25% of canvas relatively clean — overlay adds question headline there.
LEAVE BOTTOM 35% of canvas relatively clean — overlay adds pain bullets there.
The middle ~40% should hold the visual subject of the pain point.

${productContextBlock(ctx)}

${langLockBlock(ctx.language)}

Render a documentary realism close-up that evokes the problem (not the solution).`
}

// ── Slot 3: Transformation / Result ──────────────────────────────────────

export function buildPromptSlot3(ctx: PromptContext): string {
  return `A split-screen before/after comparison showing the transformation this product delivers.

${lockedStyleBlock(ctx)}

SLOT 3 — TRANSFORMATION:
50/50 SYMMETRIC split-screen — LEFT half shows the "before" state (e.g., yellowed teeth), RIGHT half shows the "after" state (whitened, brighter).
SAME camera angle, SAME lighting on both halves — critical for credibility, do NOT use different lighting that fakes the after.
SAME framing — show the same subject/area on both halves.
LEAVE THE CENTER 30% of canvas free — overlay will add a giant metric label there ("+8 SHADE / DALAM 14 HARI").
Small clean strip at top for "SEBELUM / SELEPAS" labels.
Bottom edge clean for disclaimer text.

${productContextBlock(ctx)}

${langLockBlock(ctx.language)}

Render a credible documentary before/after split-screen.`
}

// ── Slot 4: USP / Mechanism ──────────────────────────────────────────────

export function buildPromptSlot4(ctx: PromptContext): string {
  return `An ingredient breakdown shot showing the product bottle with its active ingredients floating around it.

${lockedStyleBlock(ctx)}

SLOT 4 — USP / MECHANISM (floating-ingredients-bottle):
Bottle centered LEFT (in the left 50-55% of canvas), the right 40% reserved for ingredient labels (canvas will add chips there — leave that area visually quiet).
Around the bottle: 4-5 floating REAL-LOOKING ingredient elements (e.g., charcoal pieces, mint leaves, vitamin powder) — each with its own realistic shadow.
Subtle depth-of-field. Single soft daylight from upper-left.
Ingredients should look like real macro photography, NOT 3D rendered icons.
TOP 15% of canvas clean for "FORMULA AKTIF" headline.

${productContextBlock(ctx)}

${langLockBlock(ctx.language)}

Render the bottle on the left with realistic ingredient elements floating around it.`
}

// ── Slot 6: Usage Demo ───────────────────────────────────────────────────

export function buildPromptSlot6(ctx: PromptContext): string {
  return `A clean instructional backdrop for showing how the product is used.

${lockedStyleBlock(ctx)}

SLOT 6 — USAGE DEMO (step-infographic):
Show the product bottle in the BOTTOM-CENTER of the canvas, smaller scale (~30% height), with a hand subtly holding it OR just placed naturally.
LEAVE THE TOP 60% of the canvas mostly clean — canvas will overlay 3 numbered step circles + text labels.
Background atmosphere should be lightly textured to give context (e.g., bathroom counter, vanity) WITHOUT clutter.
Calm instructional mood.

${productContextBlock(ctx)}

${langLockBlock(ctx.language)}

Render the product in a calm instructional context with most of the upper canvas clean.`
}

// ── Slot 7: Comparison ───────────────────────────────────────────────────

export function buildPromptSlot7(ctx: PromptContext): string {
  return `A clean product showcase shot suitable for a comparison-table overlay.

${lockedStyleBlock(ctx)}

SLOT 7 — COMPARISON:
Bottle positioned at TOP 30% of canvas, centered.
LEAVE THE BOTTOM 70% of canvas almost entirely clean — canvas will overlay a 2-column comparison table there.
Background quiet, no decoration, gradient subtle.
The product should clearly own the top half but not dominate the whole frame.

${productContextBlock(ctx)}

${langLockBlock(ctx.language)}

Render the product at the top with most of the lower canvas clean for the table overlay.`
}

// ── Slot 8: Offer / Combo ────────────────────────────────────────────────

export function buildPromptSlot8(ctx: PromptContext): string {
  return `A hero product shot with energetic "buy moment" mood.

${lockedStyleBlock(ctx)}

SLOT 8 — OFFER:
Same composition family as Slot 1 (hero centered, slight angle) but the bottle is positioned in the LOWER 40% of canvas.
LEAVE THE TOP 50% of canvas relatively clean — canvas overlay places giant price + discount badge there.
LEAVE THE BOTTOM 15% clean — canvas overlay places the CTA button there.
The bottle should feel "this is the deal" — slight forward lean, fresh lighting, optimistic tone WITHIN the brand palette.

${productContextBlock(ctx)}

${langLockBlock(ctx.language)}

Render a hero-shot of the bottle in the lower portion with optimistic confident mood.`
}

// ── Dispatcher ───────────────────────────────────────────────────────────
// Slots 5 and 9 are canvas-only (no AI scene); for those the caller should
// skip calling buildPromptForSlot entirely. We provide a fallback to slot 1
// in case it's invoked anyway.

export function buildPromptForSlot(ctx: PromptContext): string {
  switch (ctx.slotConfig.slot) {
    case 1: return buildPromptSlot1(ctx)
    case 2: return buildPromptSlot2(ctx)
    case 3: return buildPromptSlot3(ctx)
    case 4: return buildPromptSlot4(ctx)
    case 6: return buildPromptSlot6(ctx)
    case 7: return buildPromptSlot7(ctx)
    case 8: return buildPromptSlot8(ctx)
    case 5:  // canvas-only — should not be called for image gen
    case 9:  // canvas-only — should not be called for image gen
    default:
      return buildPromptSlot1(ctx)
  }
}
