// ── Master Frame service ─────────────────────────────────────────────────────
// The Master Frame is THE canonical reference image of the avatar + product
// composition. It's generated ONCE per video project, user-approved, then
// every B-Roll scene downstream is derived from it (img2img variations).
//
// This is the core consistency mechanism in v2: instead of generating each
// scene independently from raw avatar/product images (where the model is
// free to drift), all scenes inherit identity + product appearance from one
// approved frame.
//
// Pipeline:
//   1. Gemini Vision describes the avatar face (frozen text anchor)
//   2. Gemini Vision describes the product (frozen text anchor)
//   3. Compile a master-frame prompt (modular 5-section structure)
//   4. KIE GPT-4o image-edit endpoint with [productImage, avatarImage] refs
//   5. User approves → frame becomes locked for downstream scenes
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiVision } from '../../../../utils/gemini'
import { generateGpt4oImage } from '../../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import type { Model, Product } from '../../../../stores/types'
import type { IdentityPack, MasterFrame, ConsistencyConfig } from '../types'

// ── Helpers: fetch a remote/asset image as base64 for Gemini Vision ─────────

async function imageUrlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) throw new Error('Data URL không hợp lệ')
    return { mimeType: match[1], base64: match[2] }
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Không tải được ảnh tham chiếu (${res.status})`)
  const blob = await res.blob()
  const mimeType = blob.type || 'image/jpeg'
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return { base64: btoa(binary), mimeType }
}

async function resolveToPublicUrl(ref: string): Promise<string> {
  if (!ref) throw new Error('Thiếu URL ảnh')
  if (ref.startsWith('http') || ref.startsWith('data:')) return ref
  if (isAssetRef(ref)) {
    const url = await getUrl(ref)
    if (!url) throw new Error('Không resolve được asset URL')
    return url
  }
  return ref
}

// ── Identity extraction (Gemini Vision) ──────────────────────────────────────

const AVATAR_DESCRIBE_PROMPT = `Describe this person's face and identifying features in 2-3 SHORT sentences for an image-generation identity anchor. Focus ONLY on:
- Gender, approximate age range (e.g. "late 40s")
- Ethnicity / regional appearance (e.g. "Malaysian", "Vietnamese")
- Skin tone, face shape, distinctive features
- Eye color, eye shape, eyebrow style
- Hairstyle OR hijab (color, style, how it's worn)
- Any facial hair (beard, stubble, clean-shaven)
- Outfit colors and style
- Any visible accessories (glasses, jewelry)

Output: only the description, no preamble, flowing sentences (not a list).
Example: "A Malaysian woman in her late 40s with warm tan skin, soft rounded face, warm brown almond-shaped eyes, wearing a soft lavender hijab pinned modestly under the chin, lavender floral top, and a thin gold bracelet."`

const PRODUCT_DESCRIBE_PROMPT = `Describe this product as a SINGLE precise sentence (max 50 words) for an image-generation identity anchor. The description MUST disambiguate the container shape so an AI cannot confuse it for a different shape.

REQUIRED ELEMENTS:
1. Container TYPE: use ONE word — "jar" (short squat) / "bottle" (tall cylindrical) / "tube" (slim squeeze) / "sachet" / "box" / "blister pack" / "spray can" / "pump dispenser" / "pouch"
2. PROPORTIONS: "short and wide" / "tall and slim" / "flat rectangular" / "compact cube". Mention if WIDTH > HEIGHT (squat) or HEIGHT > WIDTH (tall).
3. PRIMARY container color + cap/lid color.
4. MATERIAL: clear plastic / opaque plastic / glass / aluminum / cardboard / foil pouch.
5. LABEL color + any visible brand text.
6. ROUGH SIZE relative to a hand.

Output: ONLY the description, no preamble, no markdown, no quotes.`

export async function describeAvatar(imageUrl: string, geminiKey: string): Promise<string> {
  const { base64, mimeType } = await imageUrlToBase64(imageUrl)
  const response = await directGeminiVision({
    apiKey: geminiKey,
    parts: [
      { inlineData: { mimeType, data: base64 } },
      { text: AVATAR_DESCRIBE_PROMPT },
    ],
    maxOutputTokens: 350,
    model: 'gemini-2.5-flash',
  })
  return response.trim().replace(/^["']|["']$/g, '')
}

export async function describeProduct(imageUrl: string, geminiKey: string): Promise<string> {
  const { base64, mimeType } = await imageUrlToBase64(imageUrl)
  const response = await directGeminiVision({
    apiKey: geminiKey,
    parts: [
      { inlineData: { mimeType, data: base64 } },
      { text: PRODUCT_DESCRIBE_PROMPT },
    ],
    maxOutputTokens: 250,
    model: 'gemini-2.5-flash',
  })
  return response.trim().replace(/^["']|["']$/g, '')
}

/**
 * Extract the locked Identity Pack from an avatar Model + Product.
 * Returns frozen text anchors + resolved public URLs that downstream stages
 * use without ever re-reading the raw images.
 */
export async function extractIdentityPack(params: {
  avatar: Model
  product: Product
  geminiKey: string
}): Promise<IdentityPack> {
  const avatarUrl = await resolveToPublicUrl(params.avatar.characterImage)
  const productUrl = await resolveToPublicUrl(params.product.productImage)

  // Run both Vision calls in parallel — independent
  const [avatarDescription, productDescription] = await Promise.all([
    describeAvatar(avatarUrl, params.geminiKey),
    describeProduct(productUrl, params.geminiKey),
  ])

  return {
    avatarDescription,
    productDescription,
    avatarImageUrl: avatarUrl,
    productImageUrl: productUrl,
  }
}

// ── Master Frame prompt builder ──────────────────────────────────────────────

/**
 * Build the prompt for the very first canonical Master Frame. This is a
 * BASELINE composition — clean medium shot, avatar holding product, label
 * facing camera. Subsequent scenes will derive variations from THIS frame.
 *
 * Composed in the 5-section structure that Module 2 (Prompt Compiler) will
 * formalize. For now we hardcode the master-frame variant inline.
 */
export function buildMasterFramePrompt(params: {
  identity: IdentityPack
  productName: string
  consistency: ConsistencyConfig
}): string {
  const { identity, productName, consistency } = params
  const strictLanguage = consistency.strength >= 90
    ? 'MUST EXACTLY match'
    : 'should closely resemble'

  return `IMAGE-EDITING TASK: Combine the two attached reference images into one new baseline portrait that will serve as the master reference for an entire UGC ad photo series.

═══════════════════════════════════════════════════════════════
[1] IDENTITY LOCK
═══════════════════════════════════════════════════════════════
THE PERSON IS: the individual from the SECOND attached reference image.
The face in the output ${strictLanguage} the face in this reference: same face shape, same eyes (color + shape), same eyebrows, nose, lips, jawline, cheekbones, skin tone, age range.
Additional locked description (from analysis): ${identity.avatarDescription}
Same gender, same ethnicity, same age as reference.
Same hijab style and color if wearing one, OR same hairstyle / hair color / length.
Same facial hair if present (beard / stubble / mustache).
Same accessories on face / neck (glasses, earrings).

═══════════════════════════════════════════════════════════════
[2] PRODUCT LOCK
═══════════════════════════════════════════════════════════════
THE PRODUCT IS: the EXACT product from the FIRST attached reference image.
Product name: "${productName}".
The product in the output ${strictLanguage} this reference: same container TYPE, same shape proportions, same colors, same label, same branding text and logo placement.
Additional locked description (from analysis): ${identity.productDescription}

CRITICAL: Do NOT redesign the packaging. Do NOT invent a different product. Do NOT substitute a generic supplement bottle / cream jar / random pharmacy bottle. The uploaded product is the ONLY valid product source.

═══════════════════════════════════════════════════════════════
[3] MASTER FRAME COMPOSITION (baseline)
═══════════════════════════════════════════════════════════════
Medium close-up portrait. The person holds the product at chest-to-shoulder level with one or both hands, label fully facing the camera. Gentle confident expression, looking directly at the lens. Clean modern home interior background softly out of focus only on far walls (subject + product remain sharp). Natural daylight from a window to one side.

This is a NEUTRAL baseline pose — subsequent scenes will derive variations from this frame (different angles, environments, expressions), so render this one cleanly and centered so it works as a reference.

═══════════════════════════════════════════════════════════════
[4] VISUAL DNA (UGC iPhone aesthetic)
═══════════════════════════════════════════════════════════════
Authentic UGC smartphone photo — shot on iPhone — vertical framing. Completely unedited natural look: sharp focus across the entire subject + product area, zero bokeh on subject, zero depth-of-field blur on the product, natural ambient indoor lighting, no professional studio rim lighting, no AI-generated sheen, no digital enhancement, no watermarks, no text overlay. Photorealistic, film-quality realism. Subject skin shows real texture and natural pores, not retouched.

═══════════════════════════════════════════════════════════════
[5] NEGATIVE PROMPT (what NOT to do)
═══════════════════════════════════════════════════════════════
DO NOT: change face identity to a different person, change ethnicity, change age, invent a new product, redesign the packaging, swap brand label, add a professional studio backdrop, blur the product, add bokeh, add watermark, add text overlay, output a plastic AI-sheen look, output a different person who "looks similar".`
}

// ── Master Frame generation ──────────────────────────────────────────────────

/**
 * Generate ONE master frame candidate. The caller can call this multiple
 * times to get re-rolls before the user approves one.
 */
export async function generateMasterFrame(params: {
  kieApiKey: string
  identity: IdentityPack
  productName: string
  consistency: ConsistencyConfig
  onStatusChange?: (status: string, progress?: number) => void
}): Promise<MasterFrame> {
  const prompt = buildMasterFramePrompt({
    identity: params.identity,
    productName: params.productName,
    consistency: params.consistency,
  })

  // filesUrl order: [product, avatar] — matches prompt's "FIRST=product, SECOND=avatar"
  const remoteUrl = await generateGpt4oImage({
    apiKey: params.kieApiKey,
    prompt,
    filesUrl: [params.identity.productImageUrl, params.identity.avatarImageUrl],
    size: '2:3',  // vertical-ish (gpt4o only supports 1:1 / 3:2 / 2:3)
    timeoutMs: 5 * 60 * 1000,
    onStatusChange: params.onStatusChange,
  })

  // Persist to asset store so the URL doesn't expire mid-pipeline
  let storedUrl: string
  if (isAssetRef(remoteUrl)) {
    storedUrl = remoteUrl
  } else {
    const fetchRes = await fetch(remoteUrl)
    const blob = await fetchRes.blob()
    const assetId = await saveAsset(blob, blob.type || 'image/png')
    const resolved = await getUrl(assetId)
    storedUrl = resolved ?? assetId
  }

  return {
    imageUrl: storedUrl,
    promptUsed: prompt,
    createdAt: Date.now(),
    status: 'pending-approval',
  }
}
