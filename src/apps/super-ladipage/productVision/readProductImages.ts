// ─────────────────────────────────────────────────────────────────────
// Product Vision — readProductImages (P-VISION 2026-05-27)
//
// Single Gemini Vision call reading ALL uploaded product images at once
// (Gemini accepts multi-image in one request). Returns structured
// VisionExtractedReality.
//
// Falls back gracefully:
//   - No images uploaded → returns 'no-images' source with empty fields
//   - Vision call fails → returns 'vision-failed' with empty fields
// Downstream synthesis still runs (uses text-only context).
// ─────────────────────────────────────────────────────────────────────

import { directGeminiVision } from '../../../utils/gemini'
import { getAsBase64, isAssetRef } from '../../../utils/assetStore'
import type {
  VisionExtractedReality,
  ReadProductImagesInput,
  ReadProductImagesKeys,
} from './types'

const EMPTY_FALLBACK: Omit<VisionExtractedReality, 'source' | 'imageCount'> = {
  formFactor: '',
  visibleIngredients: [],
  brandTone: '',
  visibleClaims: [],
  usageInstructions: undefined,
  productIdentityForImage: '',
  inferredTargetAudience: '',
  inconsistencyFlags: [],
}

const VISION_SYSTEM = `You are a product reality extractor for a marketing copy pipeline.

You read product images (packaging, label, product shot) and output STRICT JSON describing what you SEE — no interpretation, no marketing language.

Critical: distinguish what is VISIBLE in image vs ASSUMED from product name. Only output what you can actually see.`

function buildVisionPrompt(productName: string, painPoints: string | undefined): string {
  return `Read the attached product image(s) and extract structured reality.

PRODUCT NAME (for grounding only — verify against image): ${productName}
${painPoints ? `PAIN POINTS TEXT: ${painPoints}` : ''}

EXTRACT these fields (output strict JSON, no other text):

{
  "formFactor": "1-line physical description — bottle size, material, shape (e.g., '30ml white plastic spray bottle' or '60-pill amber glass bottle' or 'fabric knee brace with hinges')",
  "visibleIngredients": ["ingredient1", "ingredient2"],
  "brandTone": "visual brand tone (e.g., 'minimalist medical', 'playful TikTok', 'premium pharmacy', 'mass-market COD')",
  "visibleClaims": ["claim text 1 from packaging", "claim text 2"],
  "usageInstructions": "usage instructions if visible, else null",
  "productIdentityForImage": "1 detailed sentence describing product identity for AI image generation reuse — include color, shape, label features, size hints (e.g., 'white 30ml spray bottle with green herbal leaf logo, Bahasa Melayu label, sleek modern medical design')",
  "inferredTargetAudience": "from visual cues — age range + demographic (e.g., 'women 40-55, urban Vietnamese/Malaysian', '30-45 health-conscious professional')",
  "inconsistencyFlags": ["list any mismatches between product name text and what you actually see — empty array if consistent"]
}

CRITICAL RULES:
1. ONLY describe what is VISIBLE in image. If you cannot see ingredients, leave array empty — do NOT guess from product name.
2. inconsistencyFlags: if product name says "spray" but image shows pills, add "name claims 'spray' but image shows pills".
3. productIdentityForImage: this gets reused in image generation prompts later — be SPECIFIC about visual identity (color, shape, distinguishing features).
4. brandTone: read from visual design — minimalist? playful? medical-formal? mass-market COD?
5. If image is unrelated to product or unclear → say so in inconsistencyFlags.

Output JSON only. No markdown fences. No commentary.`
}

export async function readProductImages(
  input: ReadProductImagesInput,
  keys: ReadProductImagesKeys,
): Promise<VisionExtractedReality> {
  // ── Guard: no images uploaded → graceful fallback ────────────────
  if (!input.visualMemory || input.visualMemory.length === 0) {
    return {
      ...EMPTY_FALLBACK,
      source: 'no-images',
      imageCount: 0,
    }
  }

  if (!keys.geminiApiKey) {
    return {
      ...EMPTY_FALLBACK,
      source: 'vision-failed',
      imageCount: input.visualMemory.length,
    }
  }

  // ── Load images as base64 from IndexedDB ────────────────────────
  const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = []
  for (const item of input.visualMemory.slice(0, 5)) {  // cap at 5 images
    if (!isAssetRef(item.ref)) continue
    try {
      const asset = await getAsBase64(item.ref)
      if (asset) {
        imageParts.push({
          inlineData: { mimeType: asset.mimeType, data: asset.base64 },
        })
      }
    } catch (err) {
      console.warn(`[productVision] Could not load asset ${item.ref}:`, err)
      // Skip this image, continue with others
    }
  }

  if (imageParts.length === 0) {
    return {
      ...EMPTY_FALLBACK,
      source: 'vision-failed',
      imageCount: input.visualMemory.length,
    }
  }

  // ── Single Gemini Vision call with all images at once ────────────
  try {
    const raw = await directGeminiVision({
      apiKey: keys.geminiApiKey,
      parts: [
        ...imageParts,
        { text: buildVisionPrompt(input.productName, input.productPainPoints) },
      ],
      systemInstruction: VISION_SYSTEM,
      maxOutputTokens: 800,
      responseMimeType: 'application/json',
    })

    // Strip fences if any
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    }

    const parsed = JSON.parse(cleaned) as Record<string, unknown>

    return {
      formFactor: typeof parsed.formFactor === 'string' ? parsed.formFactor : '',
      visibleIngredients: Array.isArray(parsed.visibleIngredients)
        ? (parsed.visibleIngredients as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
      brandTone: typeof parsed.brandTone === 'string' ? parsed.brandTone : '',
      visibleClaims: Array.isArray(parsed.visibleClaims)
        ? (parsed.visibleClaims as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
      usageInstructions: typeof parsed.usageInstructions === 'string'
        ? parsed.usageInstructions
        : undefined,
      productIdentityForImage: typeof parsed.productIdentityForImage === 'string'
        ? parsed.productIdentityForImage
        : '',
      inferredTargetAudience: typeof parsed.inferredTargetAudience === 'string'
        ? parsed.inferredTargetAudience
        : '',
      inconsistencyFlags: Array.isArray(parsed.inconsistencyFlags)
        ? (parsed.inconsistencyFlags as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
      source: 'gemini-vision',
      imageCount: imageParts.length,
    }
  } catch (err) {
    console.warn('[productVision] Vision call failed:', err)
    return {
      ...EMPTY_FALLBACK,
      source: 'vision-failed',
      imageCount: imageParts.length,
    }
  }
}
