import type { ProductIdentity, VisualMemoryItem, LandingLanguage } from '../types'
import type { Product } from '../../../stores/types'
import { directGeminiVision } from '../../../utils/gemini'
import { getAsBase64 } from '../../../utils/assetStore'
import { SYSTEM_PROMPT_IDENTITY } from '../prompts/systemPromptIdentity'
import { withTimeout } from './withTimeout'

/** Timeout cho Gemini Vision call — 60s đủ cho identity extract.
 *  Nếu lâu hơn thì Gemini đang overload, không phải đang generate. */
const VISION_TIMEOUT_MS = 60_000

// ─────────────────────────────────────────────────────────────────────
// Extract ProductIdentity — 1 LẦN / pack.
//
// Pipeline:
//   1. Pack product info → user text
//   2. Resolve product image + reference images → base64 blobs
//   3. Call Gemini Vision với SYSTEM_PROMPT_IDENTITY + JSON mode
//   4. Parse JSON, validate shape, return ProductIdentity
//
// Output này sau đó được orchestrator dán vào system prompt text gen.
// ─────────────────────────────────────────────────────────────────────

export interface ExtractInput {
  apiKey:         string
  product:        Product
  visualMemory:   VisualMemoryItem[]
  language:       LandingLanguage
}

/** Stringify product info into structured ENG prompt for Gemini. */
function buildUserPrompt(product: Product, language: LandingLanguage): string {
  const langHint = language === 'ms' ? 'Malaysian / Malay (MY)'
                 : language === 'vi' ? 'Vietnamese (VN)'
                                       : 'English / SEA international'
  return `
PRODUCT INFO (extract identity from this + the attached image(s)):

Name:               ${product.productName || '(unknown)'}
Description:        ${product.productDescription || '(none)'}
Target market:      ${product.targetMarket || '(unknown)'} — display language: ${langHint}
Pain points (raw):  ${product.painPoints || '(none)'}
USPs:               ${product.usps || '(none)'}
Benefits:           ${product.benefits || '(none)'}
Offer / Price hint: ${product.offer || '(none — infer from market+category)'}
Ingredients:        ${product.ingredients || '(none)'}

Now output the ProductIdentity JSON exactly per the schema in the system prompt.
Output JSON ONLY.
`.trim()
}

/** Convert asset refs into Gemini Vision inline_data parts. Max 4 images
 *  (product main + up to 3 reference). */
async function buildVisionParts(args: {
  productImageRef?: string
  visualMemory: VisualMemoryItem[]
  userPrompt: string
}): Promise<Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>> {
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = []
  parts.push({ text: args.userPrompt })

  const refs: string[] = []
  if (args.productImageRef) refs.push(args.productImageRef)
  for (const v of args.visualMemory.slice(0, 3)) refs.push(v.ref)

  for (const ref of refs.slice(0, 4)) {
    try {
      const blob = await getAsBase64(ref)
      if (!blob) continue
      parts.push({
        inlineData: { data: blob.base64, mimeType: blob.mimeType },
      })
    } catch {
      // skip silently — at least the text prompt + remaining images go through
    }
  }

  return parts
}

/** Validate shape của ProductIdentity (lightweight type guard).
 *  P4: thêm check packagingShape + subjectIdentityLock. */
function isValidIdentity(x: unknown): x is ProductIdentity {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  const subjLock = o.subjectIdentityLock as Record<string, unknown> | undefined
  return (
    typeof o.productNameExact     === 'string' &&
    typeof o.packagingDescription === 'string' &&
    typeof o.packagingShape       === 'string' &&
    Array.isArray(o.primaryColors) &&
    typeof o.productScale         === 'string' &&
    typeof o.productPose          === 'string' &&
    Array.isArray(o.coBrandBadges) &&
    Array.isArray(o.trustBadges) &&
    typeof o.priceTag             === 'string' &&
    typeof o.productCategory      === 'string' &&
    !!subjLock &&
    typeof subjLock.primary       === 'string' &&
    !!o.painPointsByTier &&
    !!o.transformationByTier &&
    Array.isArray(o.visualAntiPatterns) &&
    Array.isArray(o.comboDeals)
  )
}

/** Parse + validate JSON output từ Gemini. Retry-friendly: throw cụ thể
 *  để orchestrator có thể catch + retry. */
function parseIdentityJson(raw: string): ProductIdentity {
  // Strip markdown fences if Gemini added them despite instruction
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`ProductIdentity JSON parse failed: ${err instanceof Error ? err.message : String(err)}. Raw start: ${cleaned.slice(0, 200)}`)
  }

  if (!isValidIdentity(parsed)) {
    throw new Error(`ProductIdentity validation failed — missing required fields. Got keys: ${Object.keys(parsed as object).join(', ')}`)
  }

  // Defensive default for missing tier arrays (Gemini sometimes omits empty tier4)
  const id = parsed as unknown as Record<string, unknown>
  const pbt = id.painPointsByTier as Record<string, unknown>
  const tbt = id.transformationByTier as Record<string, unknown>
  for (const tier of ['tier1_primary', 'tier2_axis', 'tier3_loose', 'tier4_offniche'] as const) {
    if (!Array.isArray(pbt[tier])) pbt[tier] = []
    if (!Array.isArray(tbt[tier])) tbt[tier] = []
  }

  // P4 defensive defaults
  if (typeof id.packagingShape !== 'string' || !id.packagingShape) {
    id.packagingShape = 'standard product container (shape inferred from description)'
  }
  const subj = id.subjectIdentityLock as Record<string, unknown> | undefined
  if (!subj || typeof subj.primary !== 'string') {
    id.subjectIdentityLock = {
      primary: 'Malaysian Muslim woman wearing hijab, mid-20s to early 40s, warm friendly genuine look',
      secondary: 'Malaysian man, mid-30s to 50s, clean appearance',
    }
  }

  // P5 defensive — comboDeals luôn là array (Gemini có thể omit nếu offer rỗng)
  if (!Array.isArray(id.comboDeals)) {
    id.comboDeals = []
  }

  return parsed as ProductIdentity
}

/** Main entry — gọi Gemini Vision 1 lần, retry max 2x nếu JSON invalid. */
export async function extractProductIdentity(input: ExtractInput): Promise<ProductIdentity> {
  const userPrompt = buildUserPrompt(input.product, input.language)
  const parts = await buildVisionParts({
    productImageRef: input.product.productImage,
    visualMemory:    input.visualMemory,
    userPrompt,
  })

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    const startedAt = Date.now()
    console.log(`[extractProductIdentity] attempt ${attempt}/2 — calling Gemini Vision (timeout ${VISION_TIMEOUT_MS / 1000}s)...`)
    try {
      const raw = await withTimeout(
        directGeminiVision({
          apiKey:             input.apiKey,
          parts,
          systemInstruction:  SYSTEM_PROMPT_IDENTITY,
          responseMimeType:   'application/json',
        }),
        VISION_TIMEOUT_MS,
        '[extractProductIdentity]',
      )
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
      console.log(`[extractProductIdentity] attempt ${attempt}/2 OK in ${elapsed}s — parsing JSON...`)
      const identity = parseIdentityJson(raw)
      console.log(`[extractProductIdentity] identity parsed OK — category="${identity.productCategory}"`)
      return identity
    } catch (err) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[extractProductIdentity] attempt ${attempt}/2 FAILED after ${elapsed}s: ${lastError.message.slice(0, 200)}`)
    }
  }

  throw new Error(
    `Không trích xuất được ProductIdentity sau 2 lần thử. ` +
    `Nguyên nhân: ${lastError?.message ?? 'không rõ'}. ` +
    `Vui lòng kiểm tra Gemini API key + thông tin sản phẩm có đầy đủ.`,
  )
}
