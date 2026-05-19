// ─────────────────────────────────────────────────────────────────────────
// Product packaging description extractor.
//
// Why this exists: KIE gpt-image-2 is TEXT-ONLY — it silently ignores any
// filesUrl reference images we send. So even though selectRefsForSection
// attaches the user's uploaded product photos, KIE never actually sees
// them. The only signal KIE gets is the text prompt.
//
// When the prompt just says "holding the Teeth Restoration Mineral Powder
// bottle", KIE invents whatever bottle matches the semantic ("Dr. White",
// "GoPure", "biotopics", etc.) — different invention per image → product
// identity drifts across the pack.
//
// Fix: at pack creation time, do ONE Gemini Vision call on the uploaded
// references to extract a concrete textual packaging description (shape,
// color, label text, typography, cap style). Store on pack. At image
// generation time, prepend the description to every prompt that should
// show the product. Now KIE has a stable, specific identity to render.
//
// Failure mode: if Vision call fails or no refs uploaded, returns null.
// Downstream callers fall back to the existing PRODUCT_IDENTITY_PREFIX
// behaviour (which is itself ignored by gpt-image-2 — but that is the
// pre-fix baseline, no worse than before).
// ─────────────────────────────────────────────────────────────────────────

import { directGeminiVision } from '../../../utils/gemini'
import { getAsBase64 } from '../../../utils/assetStore'
import type { VisualMemoryItem } from '../types'

/** Max ref images sent to Vision. 3 is enough — packaging shape and label
 *  text are visible from any single clear shot. More wastes tokens. */
const MAX_REFS_FOR_VISION = 3

/** Extraction prompt — concrete, specific, bounded. Asks for visual
 *  attributes only (no marketing fluff). Output bounded to ~80 words so
 *  it fits cleanly inside every per-image prompt without bloat. */
const EXTRACTION_INSTRUCTION = `You are a packaging description writer for an AI image generator.

Look at the product packaging in the attached image(s) and write ONE concise paragraph (60-90 words) that an image generator can use to render the EXACT same packaging from scratch.

Required attributes (include ALL that are visible):
- Container type: bottle / jar / tube / sachet / box / can
- Container shape: cylindrical / square / tall / squat / etc.
- Body color and finish: matte / glossy / transparent / metallic
- Label color(s) and finish
- Brand name text on label (EXACT spelling, in quotes)
- Brand name typography style: bold sans-serif / serif / script / etc.
- Any icon or symbol on label (e.g. tooth icon, leaf icon)
- Cap / lid style and color
- Approximate proportions (e.g. "wider than tall", "tall and slim")

Style rules:
- Write as descriptive English prose, NOT a bullet list.
- No marketing claims, no health benefits, no "premium / luxurious" adjectives.
- Be specific and concrete. "Dark matte purple" beats "purple". "Bold white serif text" beats "label text".
- If multiple reference images show the SAME product, describe the consistent version.
- If references show DIFFERENT products, describe ONLY what is common to all.
- If image is unclear, describe what IS clearly visible — do not invent details.

Output ONLY the description paragraph. No preamble, no markdown, no JSON.`

export async function extractPackagingDescription(params: {
  visualMemory: VisualMemoryItem[]
  apiKey: string
}): Promise<string | null> {
  const { visualMemory, apiKey } = params

  if (!visualMemory || visualMemory.length === 0) {
    console.info('[packagingExtractor] no visualMemory → skipping description extraction')
    return null
  }
  if (!apiKey) {
    console.warn('[packagingExtractor] no Gemini API key → skipping')
    return null
  }

  // Load first N refs as base64. Skip any that fail to load — Vision
  // accepts variable-length parts arrays.
  const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = []
  for (const item of visualMemory.slice(0, MAX_REFS_FOR_VISION)) {
    try {
      const loaded = await getAsBase64(item.ref)
      if (loaded) {
        imageParts.push({ inlineData: { mimeType: loaded.mimeType, data: loaded.base64 } })
      }
    } catch (err) {
      console.warn(`[packagingExtractor] failed to load ref ${item.ref.slice(0, 24)}:`, err)
    }
  }

  if (imageParts.length === 0) {
    console.warn('[packagingExtractor] no refs loadable → skipping')
    return null
  }

  try {
    const description = await directGeminiVision({
      apiKey,
      parts: [
        ...imageParts,
        { text: EXTRACTION_INSTRUCTION },
      ],
      maxOutputTokens: 512,
      responseMimeType: 'text/plain',
    })

    const cleaned = description.trim().replace(/^["']|["']$/g, '').trim()
    if (cleaned.length < 30) {
      console.warn(`[packagingExtractor] description too short (${cleaned.length} chars) — discarding`)
      return null
    }
    console.info(`[packagingExtractor] extracted ${cleaned.length} chars from ${imageParts.length} refs`)
    return cleaned
  } catch (err) {
    console.warn('[packagingExtractor] Vision call failed — pack will use fallback identity prefix:', err)
    return null
  }
}
