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
import type { IdentityPack, MasterFrame, ConsistencyConfig, VisualStyleDna, CompiledPrompt, SectionOverrides, QcScore } from '../types'
import { defaultVisualStyleDna } from '../types'
import { compileMasterFramePrompt } from './promptCompiler'
import { runQcLoop } from './qcRetry'

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

// ── Internal helper: one shot of master-frame gen (no QC) ────────────────────

async function generateMasterFrameOnce(params: {
  kieApiKey: string
  identity: IdentityPack
  productName: string
  consistency: ConsistencyConfig
  dna: VisualStyleDna
  overrides?: SectionOverrides
}): Promise<{ remoteUrl: string; compiled: CompiledPrompt }> {
  const compiled = compileMasterFramePrompt({
    identity: params.identity,
    productName: params.productName,
    consistency: params.consistency,
    dna: params.dna,
    overrides: params.overrides,
  })

  const filesUrl: string[] = []
  for (const role of compiled.filesUrlOrder) {
    if (role === 'product') filesUrl.push(params.identity.productImageUrl)
    if (role === 'avatar')  filesUrl.push(params.identity.avatarImageUrl)
  }
  // Bumped product lock → duplicate product reference slot for stronger weight
  if (params.overrides?.bumpProductLock && filesUrl.length > 1) {
    filesUrl.unshift(params.identity.productImageUrl)
  }

  const remoteUrl = await generateGpt4oImage({
    apiKey: params.kieApiKey,
    prompt: compiled.final,
    filesUrl: filesUrl.slice(0, 5),
    size: '2:3',
    timeoutMs: 5 * 60 * 1000,
  })

  return { remoteUrl, compiled }
}

async function persistImage(remoteUrl: string): Promise<string> {
  if (isAssetRef(remoteUrl)) return remoteUrl
  const fetchRes = await fetch(remoteUrl)
  const blob = await fetchRes.blob()
  const assetId = await saveAsset(blob, blob.type || 'image/png')
  const resolved = await getUrl(assetId)
  return resolved ?? assetId
}

/**
 * Generate ONE master frame candidate (no QC).
 * Used when QC is disabled. Returns frame + compiled prompt for the debug panel.
 */
export async function generateMasterFrame(params: {
  kieApiKey: string
  identity: IdentityPack
  productName: string
  consistency: ConsistencyConfig
  dna?: VisualStyleDna
  overrides?: SectionOverrides
  onStatusChange?: (status: string, progress?: number) => void
}): Promise<{ frame: MasterFrame; compiled: CompiledPrompt }> {
  const dna = params.dna ?? defaultVisualStyleDna()
  const { remoteUrl, compiled } = await generateMasterFrameOnce({ ...params, dna })
  const storedUrl = await persistImage(remoteUrl)

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

/**
 * Generate ONE master frame with FULL QC LOOP — auto-retry on fail.
 * Returns the best image + its final QC + the compiled prompt that produced it.
 *
 * Intermediate failed attempts are NOT exposed (per spec). Caller only sees:
 *   - Status changes ("đang tạo lại để khớp sản phẩm...") via onAttempt callback
 *   - Final accepted/best-of-N result
 */
export async function generateMasterFrameWithQc(params: {
  kieApiKey: string
  geminiKey: string
  identity: IdentityPack
  productName: string
  consistency: ConsistencyConfig
  dna?: VisualStyleDna
  /** Fires once per attempt — UI can show "retry N/M..." progress */
  onAttempt?: (attemptIdx: number, qc: QcScore | null) => void
}): Promise<{ frame: MasterFrame; compiled: CompiledPrompt; qc: QcScore }> {
  const dna = params.dna ?? defaultVisualStyleDna()
  let lastCompiled: CompiledPrompt | null = null

  const loopResult = await runQcLoop({
    geminiKey: params.geminiKey,
    avatarImageUrl: params.identity.avatarImageUrl,
    productImageUrl: params.identity.productImageUrl,
    consistency: params.consistency,
    maxRetries: params.consistency.maxRetries,
    generateFn: async (overrides, attemptIdx) => {
      params.onAttempt?.(attemptIdx, null)
      const { remoteUrl, compiled } = await generateMasterFrameOnce({
        kieApiKey: params.kieApiKey,
        identity: params.identity,
        productName: params.productName,
        consistency: params.consistency,
        dna,
        overrides,
      })
      lastCompiled = compiled
      return await persistImage(remoteUrl)
    },
    onAttempt: (attempt) => {
      params.onAttempt?.(attempt.attemptIdx, attempt.qc)
    },
  })

  const finalCompiled: CompiledPrompt = lastCompiled ?? {
    identityLock: '', productLock: '', sceneBlueprint: '',
    visualDna: '', negativePrompt: '', final: '', filesUrlOrder: [],
  }

  return {
    frame: {
      imageUrl: loopResult.finalImageUrl,
      promptUsed: finalCompiled.final,
      createdAt: Date.now(),
      status: 'pending-approval',
    },
    compiled: finalCompiled,
    qc: loopResult.finalQc,
  }
}
