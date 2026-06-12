// Shared "product visual brain" — reads the 4 product images TOGETHER via Gemini
// Vision and synthesizes a structured understanding of the product, reused by
// every image-consuming app (TikTok Shop / Ladipage / UGC Builder / Avatar /
// Creative Studio) so they all "see" the same product.
//
// The 4 images are deliberately DIVERSE (clean product-only, product + text,
// open/closed lid, packaging, box, different angles). This brief tells each app
// (a) what the product looks like overall, and (b) WHICH image(s) are clean
// enough to use as an i2i generation reference — so apps stop blindly hardcoding
// image #1 and stop dumping all 4 messy images into the generator.
//
// Cached in-memory per (productId + image refs) so apps don't re-run Vision on
// every generation. JSON mode + thinkingBudget:0 keeps the response from being
// truncated (see the P0 fix in directGeminiVision).

import type { Product } from '../stores/types'
import { getAsBase64 } from '../utils/assetStore'
import { directGeminiVision } from '../utils/gemini'

export interface ProductImageRole {
  index: number    // 0-based, matches the order of product.productImages
  shows: string    // what this image shows (e.g. "clean product on white bg", "box with text overlay", "open lid showing powder")
  clean: boolean   // true = clean single-product shot, good as an i2i reference
}

export interface ProductVisualBrief {
  productSummary: string          // 2-3 sentences: what the product looks like overall (synthesized from all images)
  formFactor: string              // e.g. "tall white plastic spray bottle", "short squat amber jar", "fabric knee brace"
  packaging: string               // packaging / material / label description for image consistency
  primaryColors: string[]         // visible packaging colors (hex or color words)
  visibleText: string[]           // brand/claims/text visible on the packaging
  perImage: ProductImageRole[]    // per-image role (same order as productImages)
  heroImageIndex: number          // the single CLEANEST product shot — best default i2i reference
  recommendedRefIndexes: number[] // 1-2 clean image indexes good as i2i references
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    productSummary: { type: 'string' },
    formFactor: { type: 'string' },
    packaging: { type: 'string' },
    primaryColors: { type: 'array', items: { type: 'string' } },
    visibleText: { type: 'array', items: { type: 'string' } },
    perImage: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          shows: { type: 'string' },
          clean: { type: 'boolean' },
        },
        required: ['index', 'shows', 'clean'],
      },
    },
    heroImageIndex: { type: 'integer' },
    recommendedRefIndexes: { type: 'array', items: { type: 'integer' } },
  },
  required: ['productSummary', 'formFactor', 'packaging', 'primaryColors', 'visibleText', 'perImage', 'heroImageIndex', 'recommendedRefIndexes'],
} as const

const SYSTEM_PROMPT =
  `You are a product analyst. You are given several reference photos of ONE single product. The photos are DIVERSE and may be messy: some are clean product-only shots, some include text/graphics overlays, some show an open vs closed lid, some show the box / outer packaging, some are different angles. READ ALL OF THEM TOGETHER and synthesize one coherent understanding of what the product physically looks like. Output STRICT JSON per the schema. Rules:
- perImage: one entry per input image IN ORDER (index 0..N-1). "shows" = what that specific image depicts; "clean" = true ONLY if it is a clear single-product shot with no heavy text/graphics overlay and a usable plain-ish background (i.e. good as an AI image-generation reference).
- heroImageIndex = the index of the single CLEANEST product shot (best default reference). If none are clean, pick the least cluttered.
- recommendedRefIndexes = 1-2 indexes (clean ones) to pass as i2i references.
- Base everything ONLY on what you can see. Never invent ingredients, certifications, or claims that are not visible. Keep brand names and scientific terms as printed.`

function buildUserPrompt(n: number): string {
  return `Analyze the ${n} product image(s) above (index 0 to ${n - 1}) and return the JSON brief describing the product holistically and per-image. Identify which image(s) are clean enough to use as an image-generation reference.`
}

// ── In-memory cache ─────────────────────────────────────────────────────────
const cache = new Map<string, ProductVisualBrief>()
// Dedup concurrent callers (e.g. a bulk insert-render fires N renders that each
// ask for the brief before the first finishes) so we pay the Vision call ONCE.
const inflight = new Map<string, Promise<ProductVisualBrief>>()

function cacheKey(product: Product): string {
  return `${product.id}::${product.productImages.filter(Boolean).join('|')}`
}

/** Resolve a product image ref (asset-xxx OR data: URL) to Gemini inlineData. */
async function refToInlineData(ref: string): Promise<{ mimeType: string; data: string } | null> {
  if (ref.startsWith('data:')) {
    const m = ref.match(/^data:([^;]+);base64,(.+)$/)
    return m ? { mimeType: m[1], data: m[2] } : null
  }
  const asset = await getAsBase64(ref)
  return asset ? { mimeType: asset.mimeType, data: asset.base64 } : null
}

function normalize(raw: Record<string, unknown>, n: number): ProductVisualBrief {
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []
  const clamp = (v: unknown): number => {
    const i = typeof v === 'number' ? Math.round(v) : 0
    return Math.min(Math.max(i, 0), Math.max(n - 1, 0))
  }
  const perImageRaw = Array.isArray(raw.perImage) ? (raw.perImage as Record<string, unknown>[]) : []
  const perImage: ProductImageRole[] = perImageRaw
    .map((p, i) => ({
      index: typeof p.index === 'number' ? clamp(p.index) : i,
      shows: typeof p.shows === 'string' ? p.shows : '',
      clean: p.clean === true,
    }))
    .slice(0, n)
  const recommended = Array.isArray(raw.recommendedRefIndexes)
    ? (raw.recommendedRefIndexes as unknown[]).map(clamp)
    : []
  const heroImageIndex = clamp(raw.heroImageIndex)
  // Always keep at least the hero as a recommended ref.
  const recSet = Array.from(new Set([heroImageIndex, ...recommended])).filter((i) => i < n).slice(0, 2)

  return {
    productSummary: typeof raw.productSummary === 'string' ? raw.productSummary : '',
    formFactor: typeof raw.formFactor === 'string' ? raw.formFactor : '',
    packaging: typeof raw.packaging === 'string' ? raw.packaging : '',
    primaryColors: strArr(raw.primaryColors),
    visibleText: strArr(raw.visibleText),
    perImage,
    heroImageIndex,
    recommendedRefIndexes: recSet.length ? recSet : [heroImageIndex],
  }
}

/**
 * Read the product's images via Gemini Vision and return a cached structured
 * brief. Throws if no image could be loaded or Gemini fails.
 */
export async function getProductVisualBrief(
  product: Product,
  geminiApiKey: string,
  opts?: { force?: boolean },
): Promise<ProductVisualBrief> {
  if (!geminiApiKey?.trim()) throw new Error('Cần Gemini API key để phân tích ảnh sản phẩm')

  const key = cacheKey(product)
  if (!opts?.force) {
    const cached = cache.get(key)
    if (cached) return cached
    const pending = inflight.get(key)
    if (pending) return pending
  }

  const promise = computeBrief(product, geminiApiKey, key)
  inflight.set(key, promise)
  try {
    return await promise
  } finally {
    inflight.delete(key)
  }
}

async function computeBrief(
  product: Product,
  geminiApiKey: string,
  key: string,
): Promise<ProductVisualBrief> {
  const refs = product.productImages.filter((r) => !!r && r.trim() !== '').slice(0, 4)
  const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = []
  for (const ref of refs) {
    try {
      const inline = await refToInlineData(ref)
      if (inline) imageParts.push({ inlineData: inline })
    } catch (err) {
      console.warn('[productVisualBrief] could not load image', ref, err)
    }
  }
  if (imageParts.length === 0) throw new Error('Không đọc được ảnh sản phẩm nào để phân tích')

  const raw = await directGeminiVision({
    apiKey: geminiApiKey,
    parts: [...imageParts, { text: buildUserPrompt(imageParts.length) }],
    systemInstruction: SYSTEM_PROMPT,
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    thinkingBudget: 0,
    maxOutputTokens: 2048,
  })

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')) as Record<string, unknown>
  } catch (err) {
    console.error('[productVisualBrief] JSON parse failed, raw:', raw.slice(0, 300))
    throw new Error('AI không phân tích được ảnh sản phẩm (JSON lỗi)')
  }

  const brief = normalize(parsed, imageParts.length)
  cache.set(key, brief)
  return brief
}

/** Drop the cached brief for a product (call after its images change). */
export function invalidateProductVisualBrief(product: Pick<Product, 'id'>): void {
  for (const k of cache.keys()) {
    if (k.startsWith(`${product.id}::`)) cache.delete(k)
  }
}
