// ─────────────────────────────────────────────────────────────────────
// Product Synthesis — synthesizeProductBrief (P-SYNTHESIS 2026-05-27)
//
// Single Gemini deep-call combining text + vision + niche + reality.
// Outputs SynthesizedProductBrief that becomes PRIMARY context for
// storytelling generation (replacing thin niche-only template).
//
// LOCKED: synthesis is HOLISTIC reasoning, NOT marketing prose.
// Output is structured data about THIS specific product.
// ─────────────────────────────────────────────────────────────────────

import { textGenWithFallback } from '../services/textGenWithFallback'
import type {
  SynthesizedProductBrief,
  SynthesizeProductBriefInput,
  SynthesizeProductBriefKeys,
} from './types'

const SYNTHESIS_SYSTEM = `You are a product reality synthesizer for a marketing copy pipeline.

Read ALL provided product information (text + image-extracted vision + niche classification + reality model) and produce a tight, ACCURATE description of THIS specific product's reality.

Critical: this brief becomes PRIMARY context for storytelling. Drift = wrong product story. So you must:
1. Stay SCOPED to what THIS product physically does
2. Distinguish from adjacent products in same niche (e.g., nasal spray ≠ knee brace ≠ glucosamine pill even though all "health-functional")
3. Output what reader of THIS product would recognize, NOT what reader of OTHER similar products would recognize
4. List forbiddenDriftSymptoms — symptoms from OTHER sub-niches that storytelling MUST NOT use

Output STRICT JSON. No prose, no markdown.`

function buildSynthesisPrompt(input: SynthesizeProductBriefInput): string {
  const langLabel =
    input.targetLanguage === 'ms' ? 'Bahasa Melayu' :
    input.targetLanguage === 'en' ? 'English' :
    'Tiếng Việt'

  return `Synthesize THIS specific product's reality across all inputs.

═══ INPUT 1 — Text product info ═══
Product name: ${input.productName}
Pain points: ${input.productPainPoints || '(none)'}
Benefits: ${input.productBenefits || '(none)'}
USP: ${input.productUsp || '(none)'}
Pricing: ${input.productPricing || '(none)'}

═══ INPUT 2 — Vision-extracted reality (from product images) ═══
Form factor: ${input.visionReality.formFactor || '(no images uploaded)'}
Visible ingredients: ${input.visionReality.visibleIngredients.join(', ') || '(none visible)'}
Brand tone: ${input.visionReality.brandTone || '(unknown)'}
Visible claims: ${input.visionReality.visibleClaims.join(' | ') || '(none)'}
Usage instructions: ${input.visionReality.usageInstructions || '(not visible)'}
Inferred target audience: ${input.visionReality.inferredTargetAudience || '(unknown)'}
Inconsistencies: ${input.visionReality.inconsistencyFlags.join(' | ') || '(none)'}
Product visual identity: ${input.visionReality.productIdentityForImage || '(no images)'}

═══ INPUT 3 — Niche + reality classification (auto-detected) ═══
Niche: ${input.niche}
Product form: ${input.productReality.productForm}
Usage mode: ${input.productReality.usageMode}
Sensation timing: ${input.productReality.sensationTiming}
Mechanism family: ${input.productReality.mechanismFamily}
Pacing profile: ${input.productReality.pacingProfile}
Discovery context: ${input.productReality.discoveryContext}

═══ OUTPUT (strict JSON) ═══

{
  "productEssence": "3-5 LINES in ${langLabel} describing THIS product's reality. Form + mechanism + what it actually does for reader. NO marketing language. Be SPECIFIC about how this product DIFFERS from similar products in same niche.",

  "readerSpecificSymptoms": ["5-8 CONCRETE symptoms in ${langLabel} that ONLY reader of THIS product type recognizes. e.g., for nasal spray: 'sáng dậy mũi nghẹt cứng, phải hỉ mạnh mới thở được'. NOT generic 'feeling unwell'."],

  "forbiddenDriftSymptoms": ["5-10 symptoms from OTHER sub-niches that storytelling MUST NOT drift to. e.g., for nasal spray product: 'đầu gối nhói khi đi cầu thang', 'lưng đau âm ỉ', 'da xỉn màu' — these belong to knee/back/skin niches, NOT nasal."],

  "usageScene": "1-2 sentences in ${langLabel} — realistic daily-life moment when user actually USES this product. e.g., 'Sáng dậy mũi cứng, xịt 2-3 nhát mỗi bên trong nhà tắm, vài phút sau bắt đầu thở được.'",

  "discoveryRealistic": "1-2 sentences in ${langLabel} — REALISTIC discovery context for THIS specific product. Match input.productReality.discoveryContext but make it CONCRETE. e.g., 'Thấy ad Facebook tối qua khi lướt sau giờ làm — review của một chị 35 tuổi nói mãi mới thở được vào đêm.'",

  "realisticFailedAttempts": ["5-7 SPECIFIC things in ${langLabel} that reader of THIS product type realistically tried before. e.g., for nasal spray: 'thuốc uống chống dị ứng buồn ngủ', 'xông tinh dầu', 'rửa nước muối', 'thuốc xịt khác làm khô mũi'. NOT generic 'tried many things'."],

  "productIdentityForImage": "1 detailed sentence describing visual product identity for AI image generation. Use vision-extracted info if available, augment with name. e.g., '30ml white plastic spray bottle with green herbal leaf logo, sleek modern medical design'.",

  "rationale": "1 short line explaining key signals you used"
}

CRITICAL RULES:
1. forbiddenDriftSymptoms MUST be specific — list actual symptoms from neighboring sub-niches that wrong-storytelling would have used. This is the anti-drift guardrail.
2. readerSpecificSymptoms MUST be concrete (timestamp, body part, action) — NOT abstract feelings.
3. All output text MUST be in ${langLabel} (except JSON keys which stay English).
4. If vision data missing, infer conservatively from text + niche + reality model — but FLAG in rationale that vision was unavailable.

Output JSON only.`
}

const FALLBACK_BRIEF: SynthesizedProductBrief = {
  productEssence: '',
  readerSpecificSymptoms: [],
  forbiddenDriftSymptoms: [],
  usageScene: '',
  discoveryRealistic: '',
  realisticFailedAttempts: [],
  productIdentityForImage: '',
  source: 'fallback',
}

export async function synthesizeProductBrief(
  input: SynthesizeProductBriefInput,
  keys: SynthesizeProductBriefKeys,
): Promise<SynthesizedProductBrief> {
  if (!keys.geminiApiKey) {
    console.warn('[productSynthesis] No Gemini key — using fallback')
    return FALLBACK_BRIEF
  }

  try {
    const raw = await textGenWithFallback({
      geminiApiKey: keys.geminiApiKey,
      kieApiKey: keys.kieApiKey,
      prompt: buildSynthesisPrompt(input),
      systemInstruction: SYNTHESIS_SYSTEM,
      jsonMode: true,
      maxOutputTokens: 1800,
      timeoutMs: 30_000,
      label: 'product-synthesis',
    })

    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    }

    const parsed = JSON.parse(cleaned) as Record<string, unknown>

    return {
      productEssence: typeof parsed.productEssence === 'string' ? parsed.productEssence : '',
      readerSpecificSymptoms: Array.isArray(parsed.readerSpecificSymptoms)
        ? (parsed.readerSpecificSymptoms as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
      forbiddenDriftSymptoms: Array.isArray(parsed.forbiddenDriftSymptoms)
        ? (parsed.forbiddenDriftSymptoms as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
      usageScene: typeof parsed.usageScene === 'string' ? parsed.usageScene : '',
      discoveryRealistic: typeof parsed.discoveryRealistic === 'string' ? parsed.discoveryRealistic : '',
      realisticFailedAttempts: Array.isArray(parsed.realisticFailedAttempts)
        ? (parsed.realisticFailedAttempts as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
      productIdentityForImage: typeof parsed.productIdentityForImage === 'string'
        ? parsed.productIdentityForImage
        : input.visionReality.productIdentityForImage,  // fall back to vision if synthesis missed it
      source: 'gemini-synthesis',
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 240) : undefined,
    }
  } catch (err) {
    console.warn('[productSynthesis] Synthesis call failed — using fallback:', err)
    return {
      ...FALLBACK_BRIEF,
      productIdentityForImage: input.visionReality.productIdentityForImage,
    }
  }
}
