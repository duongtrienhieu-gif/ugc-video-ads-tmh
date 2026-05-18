// ── UI-Native Engine Dispatcher (P5) ────────────────────────────────────────
//
// Runtime pipeline for the ui-native engine group. Called by
// orchestration/dispatch.ts when a UINativeModule is resolved.
//
// Flow:
//   1. Determine template (size, palette) from the module
//   2. Generate text payload — call Gemini OR consume params.options.textPayload
//   3. Build a coherent message timeline (timestamps + date label)
//   4. Generate atomic avatar via KIE
//   5. Render the platform-specific canvas template
//   6. Post-process (crop drift + JPEG recompress)
//   7. Save asset, return GeneratedAsset normalised via module
//
// Module dispatch (platform → renderer) is kept inside this dispatcher
// rather than on the module itself because canvas rendering uses
// browser APIs (HTMLCanvasElement, Image) that should stay out of the
// module type contract.

import type { UINativeModule, UINativePlatform, UINativeTextContent, UINativeLocale } from '../../types/uiNative'
import type { GenerateAssetParams, GeneratedAsset } from '../../types/asset'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useBankStore } from '../../../../stores/bankStore'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import { generateAvatar } from './_shared/avatarGen'
import { generateTextPayload, type TextPayloadRequest } from './_shared/textPayload'
import { buildTimeline } from './_shared/timestamps'
import { applyPostProcess } from './_shared/postProcess'
import { renderWhatsAppConversation } from './whatsapp-proof/template'
import { renderMessengerConversation } from './messenger-chat/template'

/** Per-platform canvas renderer dispatch table. */
const TEMPLATE_RENDERERS: Record<
  'whatsapp' | 'messenger',
  (inputs: {
    text: UINativeTextContent
    timeline: ReturnType<typeof buildTimeline>
    customerAvatarUrl: string
  }) => Promise<HTMLCanvasElement>
> = {
  whatsapp:  renderWhatsAppConversation,
  messenger: renderMessengerConversation,
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

  const renderer = TEMPLATE_RENDERERS[module.platform as 'whatsapp' | 'messenger']
  if (!renderer) {
    throw new Error(`[ui-native dispatcher] No renderer for platform "${module.platform}" yet — P6+ will add others`)
  }

  // Resolve product context (optional — testimonial works without one,
  // but caller normally supplies it)
  const bank = useBankStore.getState()
  const product = params.productId ? bank.getProductById(params.productId) : null

  // ── Step 1: build the template descriptor ──────────────────────────
  module.buildCanvasTemplate(params)  // currently descriptor-only; renderer reads canvas size internally

  // ── Step 2: text payload ───────────────────────────────────────────
  const opts = (params.options ?? {}) as Record<string, unknown>
  const messageCount = (opts.messageCount as number | undefined) ?? 8
  const locale = (opts.locale as UINativeLocale | undefined) ?? module.defaultLocale
  const personaId = opts.personaId as string | undefined

  // Build a timeline first so text payload can stamp messages with real times
  const timeline = buildTimeline(messageCount, locale, params.productId ?? 'no-product')

  let textPayload: UINativeTextContent
  if (opts.textPayload) {
    // Caller supplied pre-built text — skip Gemini
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
    }
    textPayload = await generateTextPayload(settings.geminiApiKey, textReq, timeline.perMessage)
  }

  // ── Step 3: atomic avatar generation ───────────────────────────────
  const avatarSpec = module.buildAvatarPayload(textPayload)[0]
  const avatarHint = avatarSpec?.prompts[0] ?? textPayload.participants[0].avatarHint
  const customerAvatarUrl = await generateAvatar(
    settings.kieApiKey,
    { hint: avatarHint, personaId },
    params.signal,
  )

  // ── Step 4: render canvas ──────────────────────────────────────────
  const canvas = await renderer({
    text: textPayload,
    timeline,
    customerAvatarUrl,
  })

  // ── Step 5: post-process + persist ─────────────────────────────────
  const blob = await applyPostProcess(
    canvas,
    { intensity: module.postProcess },
    `${module.id}_${params.productId ?? 'no-product'}_${Date.now().toString(36)}`,
  )
  const assetRef = await saveAsset(blob, 'image/jpeg')

  console.info('[ui-native dispatcher]', {
    assetType: module.id,
    platform: module.platform,
    messages: textPayload.items.length,
    avatarsGenerated: 1,
    blobSize: blob.size,
  })

  // ── Step 6: normalize ──────────────────────────────────────────────
  return module.normalizeOutput(
    { outputUrl: assetRef, productId: params.productId },
    params,
  )
}

// Helper exposed for callers that want avatar conversion explicitly
export { toPublicUrl }
