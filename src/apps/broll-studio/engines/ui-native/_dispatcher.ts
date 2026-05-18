// ── UI-Native Engine Dispatcher (P5 / P6) ───────────────────────────────────
//
// Runtime pipeline for the ui-native engine group. Called by
// orchestration/dispatch.ts when a UINativeModule is resolved.
//
// Pipeline (platform-agnostic):
//   1. Determine template (size, palette) from the module
//   2. Generate text payload — Gemini Text routed by contentType
//      (chat / review / comment-thread) OR consume
//      params.options.textPayload (caller short-circuit)
//   3. Build a coherent message timeline (timestamps + date label)
//   4. Generate atomic avatar via KIE
//   5. Render the platform-specific canvas template
//   6. Post-process (crop drift + JPEG recompress)
//   7. Save asset, return GeneratedAsset normalised via module
//
// Renderer dispatch (platform → renderer fn) is kept inside this file
// because canvas APIs (HTMLCanvasElement, Image) belong to browser
// runtime, not to the module type contract.

import type { UINativeModule, UINativePlatform, UINativeTextContent, UINativeLocale } from '../../types/uiNative'
import type { GenerateAssetParams, GeneratedAsset } from '../../types/asset'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useBankStore } from '../../../../stores/bankStore'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import { generateAvatar } from './_shared/avatarGen'
import { generateTextPayload, type TextPayloadRequest, type TextPayloadContentType } from './_shared/textPayload'
import { buildTimeline } from './_shared/timestamps'
import { applyPostProcess } from './_shared/postProcess'
import { renderWhatsAppConversation } from './whatsapp-proof/template'
import { renderMessengerConversation } from './messenger-chat/template'
import { renderShopeeReview } from './shopee-feedback/template'
import { renderTikTokShopReview } from './tiktok-feedback/template'
import { renderFacebookComments } from './facebook-comment/template'
import { renderTikTokComments } from './tiktok-comment/template'

/** Superset of inputs a renderer may need. Renderers pull what they use. */
interface RendererInputs {
  text: UINativeTextContent
  timeline: ReturnType<typeof buildTimeline>
  /** Customer / commenter avatar URL (chat + review + comment all use this). */
  customerAvatarUrl: string
  /** Optional product image URL — reviews attach this as the photo thumb. */
  productImageUrl?: string
}

/** Renderer = pure rendering fn. Returns the finished canvas. */
type RendererFn = (inputs: RendererInputs) => Promise<HTMLCanvasElement>

/** Per-platform canvas renderer dispatch table. */
const TEMPLATE_RENDERERS: Record<UINativePlatform, RendererFn> = {
  whatsapp:        (i) => renderWhatsAppConversation(i),
  messenger:       (i) => renderMessengerConversation(i),
  shopee:          (i) => renderShopeeReview(i),
  'tiktok-shop':   (i) => renderTikTokShopReview(i),
  facebook:        (i) => renderFacebookComments({
    text: i.text,
    timeline: i.timeline,
    postAuthorAvatarUrl: i.customerAvatarUrl,
    commenterAvatarUrl:  i.customerAvatarUrl,
  }),
  'tiktok-comment': (i) => renderTikTokComments({
    text: i.text,
    timeline: i.timeline,
    commenterAvatarUrl: i.customerAvatarUrl,
  }),
}

/** Per-platform default content type (drives Gemini prompt selection). */
const PLATFORM_CONTENT_TYPE: Record<UINativePlatform, TextPayloadContentType> = {
  whatsapp:         'chat',
  messenger:        'chat',
  shopee:           'review',
  'tiktok-shop':    'review',
  facebook:         'comment-thread',
  'tiktok-comment': 'comment-thread',
}

/** Per-platform default message count when caller does not specify. */
const PLATFORM_DEFAULT_COUNT: Record<UINativePlatform, number> = {
  whatsapp:         8,
  messenger:        8,
  shopee:           1,
  'tiktok-shop':    1,
  facebook:         6,
  'tiktok-comment': 8,
}

async function toPublicUrl(ref: string): Promise<string | null> {
  if (!ref) return null
  if (isAssetRef(ref)) return await getUrl(ref)
  if (ref.startsWith('blob:') || ref.startsWith('data:')) {
    const r = await fetch(ref)
    if (!r.ok) return null
    const blob = await r.blob()
    const assetId = await saveAsset(blob, blob.type || 'image/jpeg')
    return await getUrl(assetId)
  }
  return ref
}

export async function dispatchUINative(
  module: UINativeModule,
  params: GenerateAssetParams,
): Promise<GeneratedAsset> {
  const settings = useSettingsStore.getState()
  if (!settings.kieApiKey) {
    throw new Error('[ui-native dispatcher] Missing KIE.ai API key in settings')
  }
  if (!settings.geminiApiKey) {
    throw new Error('[ui-native dispatcher] Missing Gemini API key in settings')
  }

  const renderer = TEMPLATE_RENDERERS[module.platform]
  if (!renderer) {
    throw new Error(`[ui-native dispatcher] No renderer for platform "${module.platform}"`)
  }

  // Resolve product context (optional — testimonial works without one,
  // but caller normally supplies it)
  const bank = useBankStore.getState()
  const product = params.productId ? bank.getProductById(params.productId) : null
  const productImageUrl = product?.productImage ? await toPublicUrl(product.productImage) : null

  // ── Step 1: build the template descriptor ──────────────────────────
  module.buildCanvasTemplate(params)  // descriptor-only; renderer reads canvas size internally

  // ── Step 2: payload params (locale / count / persona / content type)
  const opts = (params.options ?? {}) as Record<string, unknown>
  const locale = (opts.locale as UINativeLocale | undefined) ?? module.defaultLocale
  const personaId = opts.personaId as string | undefined
  const contentType: TextPayloadContentType =
    (opts.contentType as TextPayloadContentType | undefined)
    ?? PLATFORM_CONTENT_TYPE[module.platform]
  const messageCount =
    (opts.messageCount as number | undefined)
    ?? PLATFORM_DEFAULT_COUNT[module.platform]

  // Build a timeline first so text payload can stamp items with real times
  const timeline = buildTimeline(messageCount, locale, params.productId ?? 'no-product')

  // ── Step 3: text payload ───────────────────────────────────────────
  let textPayload: UINativeTextContent
  if (opts.textPayload) {
    textPayload = opts.textPayload as UINativeTextContent
  } else {
    const textReq: TextPayloadRequest = {
      platform: module.platform as UINativePlatform,
      locale,
      productName: product?.productName ?? (opts.productName as string | undefined) ?? 'this product',
      niche: (opts.niche as string | undefined) ?? product?.targetMarket,
      personaId,
      messageCount,
      tone: opts.tone as string | undefined,
      contentType,
    }
    textPayload = await generateTextPayload(settings.geminiApiKey, textReq, timeline.perMessage)
  }

  // ── Step 4: atomic avatar generation ───────────────────────────────
  const avatarSpec = module.buildAvatarPayload(textPayload)[0]
  const avatarHint = avatarSpec?.prompts[0] ?? textPayload.participants[0]?.avatarHint ?? 'casual customer'
  const customerAvatarUrl = await generateAvatar(
    settings.kieApiKey,
    { hint: avatarHint, personaId },
    params.signal,
  )

  // ── Step 5: render canvas ──────────────────────────────────────────
  const canvas = await renderer({
    text: textPayload,
    timeline,
    customerAvatarUrl,
    productImageUrl: productImageUrl ?? undefined,
  })

  // ── Step 6: post-process + persist ─────────────────────────────────
  const blob = await applyPostProcess(
    canvas,
    { intensity: module.postProcess },
    `${module.id}_${params.productId ?? 'no-product'}_${Date.now().toString(36)}`,
  )
  const assetRef = await saveAsset(blob, 'image/jpeg')

  console.info('[ui-native dispatcher]', {
    assetType: module.id,
    platform: module.platform,
    contentType,
    items: textPayload.items.length,
    avatarsGenerated: 1,
    blobSize: blob.size,
  })

  // ── Step 7: normalize ──────────────────────────────────────────────
  return module.normalizeOutput(
    { outputUrl: assetRef, productId: params.productId },
    params,
  )
}

// Helper exposed for callers that want avatar conversion explicitly
export { toPublicUrl }
