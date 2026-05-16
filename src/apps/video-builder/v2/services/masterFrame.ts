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
import type { IdentityPack, MasterFrame, ConsistencyConfig, VisualStyleDna, CompiledPrompt } from '../types'
import { defaultVisualStyleDna } from '../types'
import { compileMasterFramePrompt } from './promptCompiler'

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

// ── Master Frame generation (uses Prompt Compiler v2) ────────────────────────

/**
 * Generate ONE master frame candidate. The compiler builds the 5-section
 * prompt — this function only orchestrates the API call + asset persistence.
 *
 * Returns BOTH the resulting MasterFrame AND the compiled prompt sections,
 * so the debug panel can render them block-by-block.
 */
export async function generateMasterFrame(params: {
  kieApiKey: string
  identity: IdentityPack
  productName: string
  consistency: ConsistencyConfig
  dna?: VisualStyleDna
  onStatusChange?: (status: string, progress?: number) => void
}): Promise<{ frame: MasterFrame; compiled: CompiledPrompt }> {
  const dna = params.dna ?? defaultVisualStyleDna()

  // Compile the 5-section prompt
  const compiled = compileMasterFramePrompt({
    identity: params.identity,
    productName: params.productName,
    consistency: params.consistency,
    dna,
  })

  // filesUrl order matches the prompt's reference-index references:
  //   [0] = "image #1" = PRODUCT (highest priority)
  //   [1] = "image #2" = AVATAR
  const filesUrl: string[] = []
  for (const role of compiled.filesUrlOrder) {
    if (role === 'product') filesUrl.push(params.identity.productImageUrl)
    if (role === 'avatar')  filesUrl.push(params.identity.avatarImageUrl)
    // 'masterFrame' not used for the master-frame gen itself
  }

  const remoteUrl = await generateGpt4oImage({
    apiKey: params.kieApiKey,
    prompt: compiled.final,
    filesUrl,
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
    frame: {
      imageUrl: storedUrl,
      promptUsed: compiled.final,
      createdAt: Date.now(),
      status: 'pending-approval',
    },
    compiled,
  }
}
