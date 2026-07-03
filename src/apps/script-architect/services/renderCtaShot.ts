// renderCtaShot — B4: AI render for the CTA shot ONLY (the single ai-render beat).
//
// Two-step, credit-aware pipeline (co-pilot reviews the still before paying for
// motion):
//   1) gpt-4o-image (i2i, size 2:3) — product kept EXACTLY from the bank photos,
//      CTA headline + offer badge + a CLOSED mystery gift box baked into the frame.
//   2) Seedance 1.5 Pro i2v — animate that still into a short 9:16 clip.
//
// HARD RULES (see project_script_architect_cod):
//   • NEVER render a price / RM / currency / discount %  — the gift box stays SHUT.
//   • Product fidelity: replicate the reference product, no drift.
//   • Full-AI, text baked into the image — NO canvas / bannerRenderer / Konva.

import type { Product } from '../../../stores/types'
import type { ScriptLanguage } from '../types'
import { isAssetRef, getUrl } from '../../../utils/assetStore'
import { generateGpt4oImage, generateVideoJob, pollVideoJobUntilDone } from '../../../utils/kieai'

// Credit costs (kie.ai) — surfaced in the UI so the operator approves before paying.
export const CTA_IMAGE_CREDITS = 8        // nano-banana-2 @ 1K
export const CTA_VIDEO_CREDITS = 7        // Seedance 480p × 4s (1.75 cr/s)

const SEEDANCE_MODEL = 'bytedance/seedance-1.5-pro'

// ── Localized on-image strings (only what we ALLOW the model to render) ──────
interface CtaLabels { giftTeaser: string; freeBadge: string; langName: string }
const LABELS: Record<ScriptLanguage, CtaLabels> = {
  my: { giftTeaser: 'HADIAH MISTERI', freeBadge: 'PERCUMA', langName: 'Malay (Bahasa Malaysia)' },
  vi: { giftTeaser: 'QUÀ BÍ MẬT', freeBadge: 'MIỄN PHÍ', langName: 'Vietnamese' },
}

const quote = (s: string) => `"${s.replace(/"/g, "'").trim()}"`

/** Product name to render: prefer the localized name for this language. */
function displayName(product: Product, lang: ScriptLanguage): string {
  if (product.localizedName && product.localizedNameLang === lang) return product.localizedName.trim()
  return product.productName.trim()
}

/** Identity / fidelity lock — replicate the bank product exactly (no drift). */
function identityBlock(product: Product, lang: ScriptLanguage): string {
  const visual = (product.visualBrief ?? '').trim()
  return [
    `PRODUCT (the hero you are selling): ${displayName(product, lang)}.`,
    visual ? `Product appearance to preserve EXACTLY from the reference photos: ${visual}` : '',
    `CRITICAL: replicate the product from the reference images EXACTLY — same color, shape, label, packaging and brand text. Do NOT redesign or reinterpret it.`,
  ].filter(Boolean).join('\n')
}

const STYLE =
  `STYLE: premium Malaysian e-commerce / TikTok-Shop closing-frame creative. Designer-grade layout, ` +
  `bold modern sans-serif, strong visual hierarchy, vivid high-contrast colors, glossy badges, ` +
  `ribbons and a soft spotlight on the product. Looks like a high-converting paid ad. No watermark.`

function textRules(langName: string): string {
  return (
    `TEXT RENDERING — render ALL text INTO the image as crisp, correctly spelled ${langName}. ` +
    `Spell every word EXACTLY as written, with correct diacritics. Bold clean sans-serif, large and legible. ` +
    `Do NOT add any other text, numbers or currency you were not given.`
  )
}

/**
 * Build the gpt-4o-image prompt for the CTA closing frame.
 * @param ctaLine  the CTA voice line (rendered as the big headline)
 * @param offer    the offer/milestone badge text (e.g. "Beli 2 Percuma 1") — NO price
 */
export function buildCtaImagePrompt(params: {
  product: Product
  lang: ScriptLanguage
  ctaLine: string
  offer: string
}): string {
  const { product, lang, ctaLine, offer } = params
  const L = LABELS[lang]
  const texts = [
    `Big CTA headline: ${quote(ctaLine)}`,
    offer.trim() ? `Offer / milestone badge (starburst, NO price): ${quote(offer)}` : '',
    `Mystery-gift label on the closed box: ${quote(L.giftTeaser)}`,
    `Free-gift ribbon near the box: ${quote(L.freeBadge)}`,
  ].filter(Boolean)

  return [
    `TASK: Design a TALL PORTRAIT (9:16) CALL-TO-ACTION closing frame for a Malaysian COD video ad. High-converting, designer ad-creative look.`,
    `LAYOUT: the PRODUCT is the large hero in the lower-center with a soft spotlight. Beside/above it sits a CLOSED MYSTERY GIFT BOX — a wrapped present with a ribbon and a big "?" on it, contents fully hidden — with a glossy free-gift ribbon, so the viewer feels a valuable surprise bonus is waiting if they order now. A bold CTA headline sits at the top; an offer badge sits near the product.`,
    identityBlock(product, lang),
    STYLE,
    textRules(L.langName),
    `TEXT TO RENDER:\n` + texts.map((t) => `  - ${t}`).join('\n'),
    `HARD RULE — ABSOLUTELY NO PRICE: never render any price, money amount, currency symbol (RM, $, ₫), or discount percentage anywhere. The mystery gift box MUST stay CLOSED with its contents hidden — do NOT show what is inside. Render ONLY the text given above, correctly spelled. No invented numbers or offers.`,
  ].join('\n\n')
}

/** Seedance motion brief — gentle premium product motion, no people, no new text. */
export function buildCtaMotionPrompt(): string {
  return (
    `Subtle premium product-commercial motion: a slow, gentle camera push-in on the product; ` +
    `a soft light sweep glides across the packaging; the closed mystery gift box gently shimmers ` +
    `and its ribbon sways slightly; a few floating sparkles drift upward. All on-screen text, ` +
    `badges and layout stay perfectly stable, sharp and readable. No people, no talking, no new ` +
    `text, no changing numbers. Smooth, glossy, high-end advertising feel.`
  )
}

/** Resolve up to `cap` product images to publicly fetchable URLs for filesUrl. */
async function resolveProductUrls(product: Product, cap = 4): Promise<string[]> {
  const raw = (product.productImages?.length ? product.productImages : [product.productImage]).filter(Boolean)
  const out: string[] = []
  for (const ref of raw) {
    if (out.length >= cap) break
    if (isAssetRef(ref)) {
      const url = await getUrl(ref)
      if (url) out.push(url)
    } else if (/^https?:\/\//.test(ref)) {
      out.push(ref) // already a public URL
    }
    // data: URLs are skipped — KIE filesUrl needs a fetchable URL.
  }
  return out
}

/**
 * Step 1 — render the CTA still. Returns the gpt-4o-image result URL (KIE CDN,
 * publicly fetchable — feeds straight into Seedance as the start frame).
 */
export async function renderCtaImage(params: {
  kieApiKey: string
  product: Product
  lang: ScriptLanguage
  ctaLine: string
  offer: string
  signal?: AbortSignal
  onStatus?: (s: string) => void
}): Promise<string> {
  const { kieApiKey, product, lang, ctaLine, offer, signal, onStatus } = params
  onStatus?.('Chuẩn bị ảnh tham chiếu…')
  const filesUrl = await resolveProductUrls(product)
  if (filesUrl.length === 0) {
    throw new Error('Sản phẩm chưa có ảnh dùng được để giữ đúng mẫu. Thêm ảnh sản phẩm trong Kho rồi thử lại.')
  }
  const prompt = buildCtaImagePrompt({ product, lang, ctaLine, offer })
  onStatus?.('Đang tạo ảnh CTA (gpt-4o-image)…')
  return await generateGpt4oImage({
    apiKey: kieApiKey,
    prompt,
    filesUrl,
    size: '2:3', // KIE maps portrait video to 2:3
    signal,
    timeoutMs: 5 * 60 * 1000,
    onStatusChange: (st) => onStatus?.(`Ảnh: ${st}`),
  })
}

/**
 * Step 2 — animate the still into a short 9:16 clip via Seedance i2v.
 * Returns the video URL (KIE CDN).
 */
export async function renderCtaVideo(params: {
  kieApiKey: string
  imageUrl: string
  durationSec?: number
  onStatus?: (s: string) => void
}): Promise<string> {
  const { kieApiKey, imageUrl, durationSec = 4, onStatus } = params
  onStatus?.('Đang làm động → video (Seedance i2v)…')
  const { taskId } = await generateVideoJob({
    apiKey: kieApiKey,
    jobModelId: SEEDANCE_MODEL,
    prompt: buildCtaMotionPrompt(),
    aspectRatio: '9:16',
    resolution: '480p',
    duration: durationSec,
    startFrameUrl: imageUrl,
  })
  return await pollVideoJobUntilDone({
    apiKey: kieApiKey,
    taskId,
    logTag: 'CTA',
    timeoutMs: 10 * 60 * 1000,
    onProgress: ({ elapsedSec, status }) => onStatus?.(`Video: ${status} · ${elapsedSec}s`),
  })
}
