// ── UI-Native Engine Dispatcher (P5 / P6 / P7 / P9 / P12) ──────────────────
//
// Runtime pipeline for the ui-native engine group. Called by
// orchestration/dispatch.ts when a UINativeModule is resolved.
//
// Pipeline (platform-agnostic):
//   1. Determine template (size, palette) from the module
//   2. Generate text payload — Gemini Text routed by contentType
//      (chat / review / comment-thread); P12 wires archetype mix for
//      comment threads so output is messy / mixed-length / typo-OK
//   3. Build coherent message timeline + cadence (presence, seen)
//   4. Generate participant pool + atomic avatars (P12 batch-aware;
//      facebook + tiktok-comment get N unique avatars up to ceiling)
//   5. Render the platform-specific canvas template
//   6. Authenticity pipeline (crop drift + gaussian blur + chroma
//      noise + JPEG recompress — P12 replaces the P5 postProcess)
//   7. Authenticity QC
//   8. Save asset, return GeneratedAsset normalised via module

import type { UINativeModule, UINativePlatform, UINativeTextContent, UINativeLocale } from '../../types/uiNative'
import type { GenerateAssetParams, GeneratedAsset } from '../../types/asset'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useBankStore } from '../../../../stores/bankStore'
import { saveAsset } from '../../../../utils/assetStore'
import { toPublicUrl } from '../../shared/utils/refResolver'
import { generateAvatar, generateAvatarBatch } from './_shared/avatarGen'
import { generateTextPayload, type TextPayloadRequest, type TextPayloadContentType } from './_shared/textPayload'
import { fromProduct } from '../../services/productKnowledge'
import { buildTimeline } from './_shared/timestamps'
import { applyAuthenticityPipeline } from './_shared/authenticityPipeline'
import { generateParticipantPool, buildAvatarHint, type ChatParticipant } from './_shared/participants'
import { renderWhatsAppConversation } from './whatsapp-proof/template'
import { renderMessengerConversation } from './messenger-chat/template'
import { renderShopeeReview } from './shopee-feedback/template'
import { renderTikTokShopReview } from './tiktok-feedback/template'
import { renderFacebookComments } from './facebook-comment/template'
import { renderTikTokComments } from './tiktok-comment/template'
import { runAuthenticityQC } from '../../shared/qc/authenticityQC'
import type { QCRunOptions } from '../../types/qc'

/** Superset of inputs a renderer may need. Renderers pull what they use. */
export interface RendererInputs {
  text: UINativeTextContent
  timeline: ReturnType<typeof buildTimeline>
  /** Primary customer / chat-partner avatar URL (always present). */
  customerAvatarUrl: string
  /** Multi-participant avatar pool — keyed by participants[].avatarHint.
   *  For platforms with N unique commenters (facebook / tiktok-comment),
   *  the renderer should look up an avatar by participant index. When
   *  the lookup misses, fall back to customerAvatarUrl. */
  avatarPool?: Map<number, string>
  /** Optional product image URL — reviews attach this as the photo thumb. */
  productImageUrl?: string
  /** Locale — pulled by renderers for metadata strings. */
  locale: UINativeLocale
}

/** Renderer = pure rendering fn. Returns the finished canvas. */
type RendererFn = (inputs: RendererInputs) => Promise<HTMLCanvasElement>

const TEMPLATE_RENDERERS: Record<UINativePlatform, RendererFn> = {
  whatsapp:        (i) => renderWhatsAppConversation(i),
  messenger:       (i) => renderMessengerConversation(i),
  shopee:          (i) => renderShopeeReview(i),
  'tiktok-shop':   (i) => renderTikTokShopReview(i),
  facebook:        (i) => renderFacebookComments(i),
  'tiktok-comment': (i) => renderTikTokComments(i),
}

const PLATFORM_CONTENT_TYPE: Record<UINativePlatform, TextPayloadContentType> = {
  whatsapp:         'chat',
  messenger:        'chat',
  shopee:           'review',
  'tiktok-shop':    'review',
  facebook:         'comment-thread',
  'tiktok-comment': 'comment-thread',
}

const PLATFORM_DEFAULT_COUNT: Record<UINativePlatform, number> = {
  whatsapp:         8,
  messenger:        8,
  shopee:           1,
  'tiktok-shop':    1,
  facebook:         6,
  'tiktok-comment': 8,
}

/** Whether this platform benefits from a multi-participant avatar pool
 *  (varied faces across rows). The other platforms only need 1 avatar. */
const PLATFORM_NEEDS_AVATAR_POOL: Record<UINativePlatform, boolean> = {
  whatsapp:         false,
  messenger:        false,
  shopee:           false,
  'tiktok-shop':    false,
  facebook:         true,
  'tiktok-comment': true,
}

export async function dispatchUINative(
  module: UINativeModule,
  params: GenerateAssetParams,
): Promise<GeneratedAsset> {
  const settings = useSettingsStore.getState()
  if (!settings.kieApiKey)    throw new Error('[ui-native dispatcher] Missing KIE.ai API key in settings')
  if (!settings.geminiApiKey) throw new Error('[ui-native dispatcher] Missing Gemini API key in settings')

  const renderer = TEMPLATE_RENDERERS[module.platform]
  if (!renderer) throw new Error(`[ui-native dispatcher] No renderer for platform "${module.platform}"`)

  const bank = useBankStore.getState()
  const product = params.productId ? bank.getProductById(params.productId) : null
  const productImageUrl = product?.productImage ? await toPublicUrl(product.productImage) : null

  // ── Step 1: template descriptor ────────────────────────────────────
  module.buildCanvasTemplate(params)

  // ── Step 2: payload params ─────────────────────────────────────────
  const opts = (params.options ?? {}) as Record<string, unknown>
  const locale = (opts.locale as UINativeLocale | undefined) ?? module.defaultLocale
  const personaId = opts.personaId as string | undefined
  const contentType: TextPayloadContentType =
    (opts.contentType as TextPayloadContentType | undefined) ?? PLATFORM_CONTENT_TYPE[module.platform]
  const messageCount =
    (opts.messageCount as number | undefined) ?? PLATFORM_DEFAULT_COUNT[module.platform]
  const seed = `${module.id}_${params.productId ?? 'no-product'}_${locale}`

  const timeline = buildTimeline(messageCount, locale, seed)

  // ── Step 3: text payload ───────────────────────────────────────────
  let textPayload: UINativeTextContent
  if (opts.textPayload) {
    textPayload = opts.textPayload as UINativeTextContent
  } else {
    // P25 — load full product knowledge from bankStore so chat / review /
    // comment generation references real benefits + pain points + USPs.
    const productKnowledge = product ? fromProduct(product, locale) : undefined

    const textReq: TextPayloadRequest = {
      platform: module.platform as UINativePlatform,
      locale,
      productName: product?.productName ?? (opts.productName as string | undefined) ?? 'this product',
      niche: (opts.niche as string | undefined) ?? product?.targetMarket,
      personaId,
      messageCount,
      tone: opts.tone as string | undefined,
      contentType,
      productKnowledge,
    }
    textPayload = await generateTextPayload(settings.geminiApiKey, textReq, timeline.perMessage)
  }

  // ── Step 4: avatar generation (P12 — pool-aware) ───────────────────
  let primaryAvatarUrl: string
  let avatarPool: Map<number, string> | undefined

  if (PLATFORM_NEEDS_AVATAR_POOL[module.platform]) {
    // Resolve how many unique avatars to generate. Default conservative
    // — caller can opt up via options.uniqueAvatarCount up to ceiling 8.
    const requestedCount =
      (opts.uniqueAvatarCount as number | undefined) ?? Math.min(4, textPayload.participants.length || 4)

    // Build participant pool — names + seeds for diversity
    const pool: ChatParticipant[] = generateParticipantPool({
      platform: module.platform as UINativePlatform,
      locale,
      count: requestedCount,
      seed,
    })
    const specs = pool.map((p) => ({
      hint: buildAvatarHint(p, locale),
      personaId,
    }))

    console.info('[ui-native dispatcher] generating avatar batch', { platform: module.platform, count: specs.length })
    const urls = await generateAvatarBatch(settings.kieApiKey, specs, params.signal)

    avatarPool = new Map<number, string>()
    let firstNonNull: string | null = null
    for (let i = 0; i < urls.length; i++) {
      const u = urls[i]
      if (u) {
        avatarPool.set(i, u)
        if (!firstNonNull) firstNonNull = u
      }
    }
    if (!firstNonNull) throw new Error('[ui-native dispatcher] All batch avatars failed')
    primaryAvatarUrl = firstNonNull
  } else {
    // Single-avatar platforms (chat / review) — one call, reused
    const avatarSpec = module.buildAvatarPayload(textPayload)[0]
    const avatarHint = avatarSpec?.prompts[0] ?? textPayload.participants[0]?.avatarHint ?? 'casual customer'
    primaryAvatarUrl = await generateAvatar(
      settings.kieApiKey,
      { hint: avatarHint, personaId },
      params.signal,
    )
  }

  // ── Step 5: render canvas ──────────────────────────────────────────
  const canvas = await renderer({
    text: textPayload,
    timeline,
    customerAvatarUrl: primaryAvatarUrl,
    avatarPool,
    productImageUrl: productImageUrl ?? undefined,
    locale,
  })

  // ── Step 6: authenticity pipeline (P12) ────────────────────────────
  const blob = await applyAuthenticityPipeline(
    canvas,
    { intensity: module.postProcess },
    `${module.id}_${params.productId ?? 'no-product'}_${Date.now().toString(36)}`,
  )

  // ── Step 7: authenticity QC ────────────────────────────────────────
  const qcOpts: QCRunOptions = {
    runVisionQC:  (opts.runVisionQC as boolean | undefined) ?? false,
    minPassScore: opts.minPassScore as number | undefined,
    geminiApiKey: settings.geminiApiKey,
  }
  const template = module.buildCanvasTemplate(params)
  const qcVerdict = await runAuthenticityQC({
    blob,
    expectedWidth:  template.canvasSize.width,
    expectedHeight: template.canvasSize.height,
    authenticity:   module.authenticity,
    platform:       module.platform,
    canvasPeek:     canvas,
    options:        qcOpts,
  })

  // ── Step 8: persist + normalize ────────────────────────────────────
  const assetRef = await saveAsset(blob, 'image/jpeg')

  console.info('[ui-native dispatcher]', {
    assetType: module.id,
    platform: module.platform,
    contentType,
    items: textPayload.items.length,
    avatarsGenerated: avatarPool?.size ?? 1,
    blobSize: blob.size,
    qc: { passed: qcVerdict.passed, overall: qcVerdict.overall, issues: qcVerdict.issues.length },
  })

  const asset = module.normalizeOutput(
    { outputUrl: assetRef, productId: params.productId },
    params,
  )
  asset.metadata.qcSummary = {
    passed:     qcVerdict.passed,
    overall:    qcVerdict.overall,
    issues:     qcVerdict.issues,
    visionPass: qcVerdict.visionPass,
  }
  return asset
}
