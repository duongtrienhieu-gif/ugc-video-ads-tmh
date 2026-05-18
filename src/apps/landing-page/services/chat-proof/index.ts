// ─────────────────────────────────────────────────────────────────────
// Chat Proof — public entry point.
//
// renderChatProof() composes background + phone frame + chat template +
// product card injection + screenshot realism post-process into a final
// Blob ready for saveAsset().
//
// generateAndRenderChatProof() is the higher-level helper that also
// kicks off content generation (Gemini) and product thumb generation
// (KIE) before rendering — exposed to the landing-page service so the
// generateImages.ts queue can call a single function per image slot.
// ─────────────────────────────────────────────────────────────────────

import { applyLayout } from './layouts'
import { loadImage } from './canvasUtils'
import { postProcess } from './postProcess'
import { generateChatContent } from './contentGen'
import { generateProductThumb } from './productThumb'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import type {
  ChatProofSpec, ChatProofResult, ChatProofVariant, ChatProofLayout,
  ChatProofBackground, PhoneFrame, ChatProofContent,
} from './types'

// ──────────────────────────────────────────────────────────────────────
// Variant rotation pools — used by renderForLandingSlot() to pick
// different variant / layout / background for each of the 4 chat images
// in a landing-page whatsapp section, deterministically per slot index.
// ──────────────────────────────────────────────────────────────────────

const VARIANT_ROTATION: ChatProofVariant[] = [
  'whatsapp-ios',
  'imessage-ios',
  'whatsapp-android',
  'messenger-ios',
]

const LAYOUT_ROTATION: ChatProofLayout[] = [
  'centered-phone',
  'centered-phone',
  'partial-crop',
  'full-vertical',
]

const BG_ROTATION: ChatProofBackground[] = [
  'ad-creative-grid',
  'dark-gradient',
  'soft-neutral',
  'minimal-light',
]

const FRAME_ROTATION: PhoneFrame[] = [
  'iphone-black',
  'iphone-black',
  'iphone-white',
  'android-samsung',
]

// ──────────────────────────────────────────────────────────────────────
// renderChatProof — pure render. Caller supplies everything.
// ──────────────────────────────────────────────────────────────────────

export async function renderChatProof(spec: ChatProofSpec): Promise<ChatProofResult> {
  const width = spec.width ?? 1080
  const height = spec.height ?? 1350

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  // Resolve thumbnail to an HTMLImageElement (or null if not provided)
  let thumbImage: HTMLImageElement | null = null
  if (spec.content.productCard?.thumbnailRef) {
    const src = isAssetRef(spec.content.productCard.thumbnailRef)
      ? await getUrl(spec.content.productCard.thumbnailRef)
      : spec.content.productCard.thumbnailRef
    if (src) {
      try {
        thumbImage = await loadImage(src)
      } catch (err) {
        console.warn('[chat-proof] failed to load product thumb — rendering with placeholder:', err)
      }
    }
  }

  applyLayout(spec.layout, {
    ctx,
    width,
    height,
    background: spec.background,
    phoneFrame: spec.phoneFrame,
    variant: spec.variant,
    content: spec.content,
    thumbImage,
  })

  const { blob, mimeType } = await postProcess(canvas, spec.realism ?? 'medium')

  return { blob, mimeType, width, height }
}

// ──────────────────────────────────────────────────────────────────────
// renderForLandingSlot — high-level helper invoked by generateImages.ts.
//
// Given a slot index (0-3 for the whatsapp-testimonials section) and the
// product context, it:
//   1. Generates the chat conversation via Gemini
//   2. Generates the product thumbnail via KIE GPT-image-1 (single call)
//   3. Picks variant / layout / background / frame deterministically
//      from the rotation pools so 4 slots stay visually distinct
//   4. Renders + post-processes via renderChatProof()
//   5. Saves the result to the assetStore and returns its assetRef
// ──────────────────────────────────────────────────────────────────────

export interface RenderForLandingSlotArgs {
  /** 0-based slot index inside the whatsapp-testimonials section. */
  slotIdx: number
  productName: string
  /** Optional pain point / niche — used by Gemini to thread context. */
  productNiche?: string
  productPainPoint?: string
  productDomain?: string
  /** Reference asset URLs (from pack.visualMemory) — passed to KIE for the
   *  product thumbnail call to lock identity. */
  productRefUrls: string[]
  /** Locale → drives both content language and contact-name pool. */
  locale: 'my' | 'vi' | 'en'
  /** Keys. */
  geminiApiKey: string
  kieApiKey: string
  /** Optional realism intensity override. */
  realism?: 'subtle' | 'medium' | 'heavy'
  /** Optional variation seed (stable across regenerations of the same slot). */
  variationSeed?: string
}

export async function renderForLandingSlot(args: RenderForLandingSlotArgs): Promise<{
  assetRef: string
  mimeType: string
}> {
  const variant    = VARIANT_ROTATION[args.slotIdx % VARIANT_ROTATION.length]
  const layout     = LAYOUT_ROTATION[args.slotIdx % LAYOUT_ROTATION.length]
  const background = BG_ROTATION[args.slotIdx % BG_ROTATION.length]
  const frame      = FRAME_ROTATION[args.slotIdx % FRAME_ROTATION.length]

  const seed = args.variationSeed ?? `slot${args.slotIdx}`

  // 1) Generate text content
  const content: ChatProofContent = await generateChatContent({
    productName: args.productName,
    productNiche: args.productNiche,
    productPainPoint: args.productPainPoint,
    productDomain: args.productDomain,
    variant,
    locale: args.locale,
    variationSeed: seed,
    geminiApiKey: args.geminiApiKey,
  })

  // 2) Generate product thumb (only if we have a ref to lock identity)
  if (content.productCard && args.productRefUrls.length > 0) {
    try {
      const thumbAssetRef = await generateProductThumb({
        productName: args.productName,
        productRefUrls: args.productRefUrls,
        kieApiKey: args.kieApiKey,
        variationSeed: seed,
      })
      content.productCard.thumbnailRef = thumbAssetRef
    } catch (err) {
      console.warn('[chat-proof] product thumb gen failed — falling back to ref image:', err)
      content.productCard.thumbnailRef = args.productRefUrls[0]
    }
  } else if (content.productCard && args.productRefUrls.length === 0) {
    // No reference and no KIE thumb — leave thumbnailRef undefined so the
    // renderer draws the placeholder gradient.
  }

  // 3) Render
  const result = await renderChatProof({
    variant,
    layout,
    background,
    phoneFrame: frame,
    content,
    realism: args.realism ?? 'medium',
  })

  // 4) Save
  const assetRef = await saveAsset(result.blob, result.mimeType)
  return { assetRef, mimeType: result.mimeType }
}

// Re-exports for callers that want fine control.
export type { ChatProofSpec, ChatProofResult, ChatProofContent } from './types'
export { generateChatContent } from './contentGen'
export { generateProductThumb } from './productThumb'
