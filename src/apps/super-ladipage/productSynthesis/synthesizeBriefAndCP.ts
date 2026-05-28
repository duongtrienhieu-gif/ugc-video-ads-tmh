// ─────────────────────────────────────────────────────────────────────
// Product Synthesis — synthesizeBriefAndCP (OPT-F5 2026-05-28)
//
// Merges synthesizeProductBrief + synthesizeCommercialPsychology into
// ONE Gemini call. The two functions were already running back-to-back
// with CP depending on Brief outputs — combining them is the natural
// next step.
//
// FAIL-SAFE: if the combined call fails (parse error, truncation, missing
// fields), we fall back to running the two original sequential calls,
// so behavior degrades to identical-to-before instead of breaking.
//
// Saved per pack:
//   - 1 Gemini call (12% of total)
//   - ~700 duplicate input tokens (product fields were sent twice)
//   - ~2 seconds latency
// ─────────────────────────────────────────────────────────────────────

import { textGenWithFallback } from '../services/textGenWithFallback'
import type {
  SynthesizedProductBrief,
  SynthesizedCommercialPsychology,
  SynthesizeProductBriefInput,
  SynthesizeProductBriefKeys,
} from './types'
import { synthesizeProductBrief } from './synthesizeProductBrief'
import { synthesizeCommercialPsychology } from './synthesizeCommercialPsychology'
import { recoverPartialJson, stripJsonFences } from './recoverPartialJson'

const COMBINED_SYSTEM = `You are a product synthesizer + commercial-psychology synthesizer combined.

ONE Gemini call producing TWO normalized outputs from the same product input:
  1. ProductBrief — concrete product reality (essence, symptoms, scene, failed attempts, forbidden drift, image identity)
  2. CommercialPsychology — buyer wants/fears/objections for THIS specific product

Both outputs come from the same reading of the product reality, so you produce them together for efficiency. Each output stays in its own JSON sub-object — do NOT mix fields between them.

Output STRICT JSON. No prose outside JSON.`

interface CombinedJSON {
  brief: {
    productEssence?: string
    readerSpecificSymptoms?: string[]
    forbiddenDriftSymptoms?: string[]
    usageScene?: string
    discoveryRealistic?: string
    realisticFailedAttempts?: string[]
    productIdentityForImage?: string
    rationale?: string
  }
  commercialPsychology: {
    primaryDesire?: string
    desireTensions?: string[]
    emotionalGravity?: string
    ctaEnergyVibe?: string
    ctaAvoidPatterns?: string[]
    topObjections?: Array<{ objection: string; counterPosture: string }>
    voiceTextureHint?: { typicalVoice?: string; platformFeel?: string; textureCues?: string[] }
    mechanismVocabHints?: string[]
    rationale?: string
  }
}

function buildCombinedPrompt(input: SynthesizeProductBriefInput): string {
  const lang =
    input.targetLanguage === 'ms' ? 'Bahasa Melayu' :
    input.targetLanguage === 'en' ? 'English' :
    'Tiếng Việt'

  const visionLines = input.visionReality.source === 'gemini-vision'
    ? `\n── Vision-extracted reality ──\n` +
      `Form factor: ${input.visionReality.formFactor}\n` +
      `Brand tone: ${input.visionReality.brandTone}\n` +
      `Product identity for image: ${input.visionReality.productIdentityForImage}`
    : ''

  return `Read the product input below and produce BOTH the ProductBrief AND CommercialPsychology in a single JSON.

═══ PRODUCT INPUT ═══
Name: ${input.productName}
Niche: ${input.niche}
Product class form: ${input.productReality.productForm}
Product class mechanism: ${input.productReality.mechanismFamily}
Pain points (raw): ${input.productPainPoints || '(none)'}
Benefits (raw): ${input.productBenefits || '(none)'}
USP (raw): ${input.productUsp || '(none)'}
Pricing (raw): ${input.productPricing || '(none)'}
${visionLines}

═══ OUTPUT — strict JSON in ${lang} (JSON keys stay English) ═══

{
  "brief": {
    "productEssence": "3-5 line tight description of what THIS product actually IS (not what niche category says).",
    "readerSpecificSymptoms": ["5 concrete symptoms reader of THIS product realistically has — NOT generic niche symptoms."],
    "forbiddenDriftSymptoms": ["3-5 symptoms reader of THIS product does NOT have — these belong to OTHER products and the storytelling MUST NOT drift there."],
    "usageScene": "1-2 sentences describing realistic daily-life usage moment.",
    "discoveryRealistic": "1 sentence — where this product realistically gets discovered (Shopee review / FB ad / friend recommendation / pharmacy aisle / TikTok / etc.) matching the buyer demographic.",
    "realisticFailedAttempts": ["3-5 concrete things THIS reader has likely already tried before this product. Name brands / methods if culturally common."],
    "productIdentityForImage": "Concrete physical descriptor for image gen — packaging color, form factor, label style.",
    "rationale": "1 short line in ${lang} explaining key signals you used."
  },
  "commercialPsychology": {
    "primaryDesire": "1 line in ${lang} — what buyer of THIS product ACTUALLY wants emotionally. NOT category-generic.",
    "desireTensions": ["3-5 specific buying-pressure tensions. Concrete, NOT abstract."],
    "emotionalGravity": "1 line — where Phase 4 of pack must LAND emotionally.",
    "ctaEnergyVibe": "1 line — what FEELING the CTA section must evoke. NOT hard sell.",
    "ctaAvoidPatterns": ["2-4 anti-defaults for CTA."],
    "topObjections": [
      { "objection": "specific objection THIS buyer would have", "counterPosture": "narrator's emotional stance to counter" }
      // EXACTLY 3 objections
    ],
    "voiceTextureHint": {
      "typicalVoice": "1 line describing the typical buyer/reviewer voice.",
      "platformFeel": "1 line — where their voice lives.",
      "textureCues": ["3-5 product-specific phrases the voice uses."]
    },
    "mechanismVocabHints": ["3-5 concrete mechanism terms specific to THIS product. NOT generic wellness words."],
    "rationale": "1 short line in ${lang}."
  }
}

CRITICAL:
1. Both sub-objects must be present and complete. Do not skip either.
2. brief.forbiddenDriftSymptoms must contain symptoms reader does NOT have — anti-drift guardrail.
3. commercialPsychology.primaryDesire must be product-paradigm-correct (dental = social-smile; respiratory = breathing-quiet; supplement = aliveness).
4. All output text in ${lang}. JSON only. No markdown fences.`
}

/** Try the combined synthesis call. Returns null on any failure so the
 *  caller can fall back to running the two sequential synthesis calls. */
async function tryCombinedSynthesis(
  input: SynthesizeProductBriefInput,
  keys: SynthesizeProductBriefKeys,
): Promise<{
  brief: SynthesizedProductBrief
  commercialPsychology: SynthesizedCommercialPsychology
} | null> {
  if (!keys.geminiApiKey && !keys.kieApiKey) return null

  try {
    const raw = await textGenWithFallback({
      geminiApiKey: keys.geminiApiKey,
      kieApiKey: keys.kieApiKey,
      prompt: buildCombinedPrompt(input),
      systemInstruction: COMBINED_SYSTEM,
      jsonMode: true,
      // ~1300 output tokens nominal; bumped to 3500 for headroom against truncation.
      maxOutputTokens: 3500,
      timeoutMs: 60_000,
      label: 'synth-combined',
    })

    const cleaned = stripJsonFences(raw)

    // 2026-05-29 — Partial JSON recovery for nested combined output.
    // The combined call produces { brief: {...}, commercialPsychology: {...} }.
    // When Gemini truncates mid-output (free-tier 429 storms — saw 3034 chars
    // cut yielding empty essence), we walk the top-level keys ("brief",
    // "commercialPsychology") and recover each sub-object. Even if one is
    // truncated and the other complete, the complete one ships.
    let parsed: CombinedJSON
    try {
      parsed = JSON.parse(cleaned) as CombinedJSON
    } catch (parseErr) {
      const recovered = recoverPartialJson(cleaned) as unknown as CombinedJSON | null
      if (!recovered) {
        console.warn(`[synth-combined] strict parse failed and unrecoverable: ${(parseErr as Error).message.slice(0, 80)}`)
        return null
      }
      console.warn(
        `[synth-combined] strict parse failed (${(parseErr as Error).message.slice(0, 80)}); ` +
        `recovered partial — brief=${recovered.brief ? 'yes' : 'no'}, CP=${recovered.commercialPsychology ? 'yes' : 'no'}`,
      )
      parsed = recovered
    }

    // Validate critical fields. If brief is incomplete, return null so the
    // sequential fallback path runs (which has its own recovery layer in
    // synthesizeProductBrief). If only CP is incomplete, we could still
    // accept the brief, but downstream wires expect both — let sequential
    // handle the split. Conservative.
    if (!parsed?.brief?.productEssence || parsed.brief.productEssence.length < 30) return null
    if (!Array.isArray(parsed.brief.readerSpecificSymptoms) || parsed.brief.readerSpecificSymptoms.length === 0) return null
    if (!parsed?.commercialPsychology?.primaryDesire || parsed.commercialPsychology.primaryDesire.length < 8) return null
    if (!Array.isArray(parsed.commercialPsychology.topObjections) || parsed.commercialPsychology.topObjections.length === 0) return null

    // Normalize into the original shapes so downstream consumers are unchanged.
    const brief: SynthesizedProductBrief = {
      productEssence: parsed.brief.productEssence.trim(),
      readerSpecificSymptoms: parsed.brief.readerSpecificSymptoms.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, 8),
      forbiddenDriftSymptoms: Array.isArray(parsed.brief.forbiddenDriftSymptoms)
        ? parsed.brief.forbiddenDriftSymptoms.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, 8)
        : [],
      usageScene: parsed.brief.usageScene?.trim() ?? '',
      discoveryRealistic: parsed.brief.discoveryRealistic?.trim() ?? '',
      realisticFailedAttempts: Array.isArray(parsed.brief.realisticFailedAttempts)
        ? parsed.brief.realisticFailedAttempts.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, 6)
        : [],
      productIdentityForImage: parsed.brief.productIdentityForImage?.trim() ?? input.visionReality.productIdentityForImage ?? '',
      source: 'gemini-synthesis',
      rationale: parsed.brief.rationale?.trim(),
    }

    const cp: SynthesizedCommercialPsychology = {
      primaryDesire: parsed.commercialPsychology.primaryDesire.trim(),
      desireTensions: Array.isArray(parsed.commercialPsychology.desireTensions)
        ? parsed.commercialPsychology.desireTensions.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, 6)
        : [],
      emotionalGravity: parsed.commercialPsychology.emotionalGravity?.trim() ?? '',
      ctaEnergyVibe: parsed.commercialPsychology.ctaEnergyVibe?.trim() ?? '',
      ctaAvoidPatterns: Array.isArray(parsed.commercialPsychology.ctaAvoidPatterns)
        ? parsed.commercialPsychology.ctaAvoidPatterns.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, 6)
        : [],
      topObjections: parsed.commercialPsychology.topObjections
        .filter((o) => o && typeof o.objection === 'string' && typeof o.counterPosture === 'string')
        .map((o) => ({ objection: o.objection.trim(), counterPosture: o.counterPosture.trim() }))
        .slice(0, 5),
      voiceTextureHint: {
        typicalVoice: parsed.commercialPsychology.voiceTextureHint?.typicalVoice?.trim() ?? '',
        platformFeel: parsed.commercialPsychology.voiceTextureHint?.platformFeel?.trim() ?? '',
        textureCues: Array.isArray(parsed.commercialPsychology.voiceTextureHint?.textureCues)
          ? parsed.commercialPsychology.voiceTextureHint!.textureCues.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, 6)
          : [],
      },
      mechanismVocabHints: Array.isArray(parsed.commercialPsychology.mechanismVocabHints)
        ? parsed.commercialPsychology.mechanismVocabHints.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, 8)
        : [],
      source: 'gemini-synthesis',
      rationale: parsed.commercialPsychology.rationale?.trim(),
    }

    return { brief, commercialPsychology: cp }
  } catch (err) {
    console.warn('[synth-combined] failed — will fall back to 2 sequential calls:', err)
    return null
  }
}

/** Run the combined call. On failure (parse error / truncation / missing
 *  fields), fall back to the original 2 sequential calls so behavior is
 *  degraded to identical-to-before instead of broken. */
export async function synthesizeBriefAndCP(
  input: SynthesizeProductBriefInput,
  keys: SynthesizeProductBriefKeys,
): Promise<{
  brief: SynthesizedProductBrief
  commercialPsychology: SynthesizedCommercialPsychology | undefined
  source: 'combined' | 'sequential'
}> {
  // Path A — combined call
  const combined = await tryCombinedSynthesis(input, keys)
  if (combined) {
    return { brief: combined.brief, commercialPsychology: combined.commercialPsychology, source: 'combined' }
  }

  // Path B — fallback to 2 sequential calls (original behavior)
  const brief = await synthesizeProductBrief(input, keys)
  let commercialPsychology: SynthesizedCommercialPsychology | undefined
  try {
    commercialPsychology = await synthesizeCommercialPsychology(
      {
        productName: input.productName,
        productPainPoints: input.productPainPoints,
        productBenefits: input.productBenefits,
        productUsp: input.productUsp,
        productPricing: input.productPricing,
        niche: input.niche,
        productEssence: brief.productEssence,
        readerSpecificSymptoms: brief.readerSpecificSymptoms,
        usageScene: brief.usageScene,
        realisticFailedAttempts: brief.realisticFailedAttempts,
        targetLanguage: input.targetLanguage,
      },
      keys,
    )
  } catch (err) {
    console.warn('[synth-combined/fallback] commercial psychology pass also failed — pack ships without CP override:', err)
  }
  return { brief, commercialPsychology, source: 'sequential' }
}
