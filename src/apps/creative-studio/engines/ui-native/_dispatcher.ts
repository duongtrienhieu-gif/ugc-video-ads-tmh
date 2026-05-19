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
import type { AssetTypeId } from '../../types/asset'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useBankStore } from '../../../../stores/bankStore'
import { useGenerationsStore } from '../../stores/generationsStore'
import { saveAsset } from '../../../../utils/assetStore'
import { toPublicUrl } from '../../shared/utils/refResolver'
import { generateAvatar, generateAvatarBatch } from './_shared/avatarGen'
import { generateTextPayload, type TextPayloadRequest, type TextPayloadContentType } from './_shared/textPayload'
import { fromProduct } from '../../services/productKnowledge'
import { findCreativeConfig } from '../../creativeConfig/configs'
import { dnaSummary } from '../../shared/prompt/dnaDirective'
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
  /** P50 — pool of OTHER previously-generated creative URLs for the
   *  same product (ugc-selfie, holding-product, group-holding, ...).
   *  shopee-feedback + tiktok-feedback fill each review's 2x2 photo
   *  grid from this pool so reviews look like a real customer who
   *  attached their own lifestyle photos. Falls back to product image
   *  when pool is empty. */
  reviewPhotoUrls?: string[]
  /** Locale — pulled by renderers for metadata strings. */
  locale: UINativeLocale
}

// ── P50 — Option C: reuse previously-generated person+product creatives
//   from this product's workspace as review photo attachments. Filters
//   the generations store for completed jobs of THIS product, of asset
//   types that produced person-with-product imagery, then resolves each
//   asset ref to a public URL via the existing toPublicUrl helper.

const REVIEW_PHOTO_SOURCE_TYPES: ReadonlySet<AssetTypeId> = new Set<AssetTypeId>([
  'holding-product',
  'ugc-selfie',
  'ugc-tiktok',
  'group-holding',
  'cafe-lifestyle',
  'lifestyle-kitchen',
  'bathroom-routine',
  'collage-4-frames',
  'expert-kol',
  'before-after',
])

async function gatherReviewPhotos(productId: string | undefined, max: number): Promise<string[]> {
  if (!productId) return []
  const jobs = useGenerationsStore.getState().jobs
  const urls: string[] = []
  for (const job of jobs) {
    if (urls.length >= max) break
    if (job.status !== 'completed') continue
    if (job.inputs?.productId !== productId) continue
    if (!REVIEW_PHOTO_SOURCE_TYPES.has(job.creativeType)) continue
    for (const out of job.outputs) {
      const u = await toPublicUrl(out.outputUrl)
      if (u) urls.push(u)
      if (urls.length >= max) break
    }
  }
  return urls
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
  // P52 — bumped whatsapp/messenger 8 → 10 so the chat fills the
  // vertical canvas with conversation density. 2 of the 10 messages
  // are photo bubbles (per the updated Gemini prompt), which add
  // height naturally.
  whatsapp:         10,
  messenger:        10,
  // P50 — Shopee/TikTok Shop screenshots now stack 2 reviews so the
  // screen fills like a real marketplace review page (was 1 review with
  // big empty space).
  shopee:           2,
  'tiktok-shop':    2,
  facebook:         6,
  'tiktok-comment': 8,
}

/** Whether this platform benefits from a multi-participant avatar pool
 *  (varied faces across rows). The other platforms only need 1 avatar. */
const PLATFORM_NEEDS_AVATAR_POOL: Record<UINativePlatform, boolean> = {
  whatsapp:         false,
  messenger:        false,
  // P50 — Shopee + TikTok Shop now show 2 stacked reviews each with a
  // distinct avatar, so the pool is required.
  shopee:           true,
  'tiktok-shop':    true,
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

  // P28 — load Creative DNA from creativeConfig once. Used by the text
  // generator (system instruction append) and recorded on the asset
  // metadata at the end so downstream consumers can see the active
  // rule set.
  const config = findCreativeConfig(module.id)
  const dna = config?.dna

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
      dna,
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

  // P50 / P52 — Option C: pull a pool of person+product photos from
  // prior creatives. P50 wired this for shopee/tiktok-shop review
  // attachments. P52 extends it to whatsapp + messenger chats, which
  // now render 2 photo bubbles (customer sending a quick photo of the
  // product) — same data flow, different consumer template.
  const reviewPhotoUrls = (module.platform === 'shopee' || module.platform === 'tiktok-shop' || module.platform === 'whatsapp' || module.platform === 'messenger')
    ? await gatherReviewPhotos(params.productId, 6)
    : undefined

  // ── Step 5: render canvas ──────────────────────────────────────────
  const canvas = await renderer({
    text: textPayload,
    timeline,
    customerAvatarUrl: primaryAvatarUrl,
    avatarPool,
    productImageUrl: productImageUrl ?? undefined,
    reviewPhotoUrls,
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
  // P28 — record the DNA rule snapshot on the asset so downstream
  // consumers (debug panels, analytics, future QC vision pass) can see
  // which intelligence rules were active for this generation.
  if (dna) {
    asset.metadata.engineExtras = {
      ...(asset.metadata.engineExtras ?? {}),
      creativeDna: dnaSummary(dna),
    }
  }
  return asset
}
