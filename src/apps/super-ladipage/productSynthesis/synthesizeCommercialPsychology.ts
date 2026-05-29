// ─────────────────────────────────────────────────────────────────────
// Product Synthesis — synthesizeCommercialPsychology (CP-SYNTHESIS 2026-05-27)
//
// Hybrid layered synthesis (Hướng B): produce product-specific commercial
// psychology per pack via 1 Gemini call. Output OVERRIDES niche-table
// defaults when present — same pattern as synthesizeProductBrief for
// readerSpecificSymptoms (SPEC.1 fix).
//
// Architecture rationale:
//   - Niche tables (DESIRE / CTA / OBJECTIONS / PROOF_TEXTURE / MECH_VOCAB)
//     provide deterministic CULTURAL REGISTER baseline for 22 known niches.
//   - For products outside 22 niches OR products where niche fit is loose,
//     this commercial-psychology synthesis derives BUYER PSYCHOLOGY from
//     product reality directly.
//   - Both layers coexist: niche = baseline, synthesis = refinement.
//
// LOCKED: this is structured data normalization, NOT marketing writing.
// Output describes WHAT THE BUYER WANTS / FEARS / WILL OBJECT TO for THIS
// specific product. Storytelling/CTA/proof generators pick up from there.
// ─────────────────────────────────────────────────────────────────────

import { textGenWithFallback } from '../services/textGenWithFallback'
import type {
  SynthesizedCommercialPsychology,
  SynthesizeCommercialPsychologyInput,
  SynthesizeCommercialPsychologyKeys,
} from './types'

const CP_SYSTEM = `You are a commercial-psychology synthesizer for a marketing copy pipeline.

Read the product reality (essence + symptoms + usage scene + failed attempts) and produce ACCURATE buyer-psychology data for THIS specific product.

Critical: this brief becomes the AUTHORITATIVE source for the pack's desire/CTA/objections/voice — overriding generic niche-pool defaults. So you must:
1. Stay SCOPED to THIS specific product (NOT generic "wellness category")
2. Distinguish from adjacent products (eg dental whitening powder ≠ teeth supplement ≠ mouthwash even though all "oral health")
3. Output what buyer of THIS specific product would actually feel/think/object to
4. Keep cultural register coherent (Vietnamese / Malay / English context per input)

Output STRICT JSON. No prose outside JSON.`

function buildPrompt(input: SynthesizeCommercialPsychologyInput): string {
  const langLabel =
    input.targetLanguage === 'ms' ? 'Bahasa Melayu' :
    input.targetLanguage === 'en' ? 'English' :
    'Tiếng Việt'

  return `Synthesize THIS product's commercial psychology — what buyer wants, fears, objects to.

═══ INPUT — Product reality (from upstream synthesis) ═══
Product: ${input.productName}
Niche baseline: ${input.niche}
Pain points (raw): ${input.productPainPoints || '(none)'}
Benefits (raw): ${input.productBenefits || '(none)'}
USP (raw): ${input.productUsp || '(none)'}
Pricing (raw): ${input.productPricing || '(none)'}

Product essence: ${input.productEssence}
Reader-specific symptoms: ${input.readerSpecificSymptoms.slice(0, 5).join(' / ')}
Usage scene: ${input.usageScene}
Realistic failed attempts: ${input.realisticFailedAttempts.slice(0, 4).join(' / ')}

${input.nicheBaselineCulturalHint ? `Cultural baseline (use for register, NOT for content): ${input.nicheBaselineCulturalHint}` : ''}

═══ OUTPUT (strict JSON in ${langLabel}) ═══

{
  "primaryDesire": "1 line in ${langLabel} — what buyer of THIS product ACTUALLY wants emotionally. NOT category-generic. e.g., for dental whitening powder: 'cười tự tin lại — không che miệng khi gặp người mới'. NOT 'sức khỏe răng miệng tốt'.",

  "desireTensions": ["3-5 lines in ${langLabel} — specific buying-pressure tensions. e.g., 'sợ người mới gặp nhận xét răng vàng', 'né selfie hở răng', 'tránh cười to nơi đông người'. Concrete, NOT abstract."],

  "emotionalGravity": "1 line in ${langLabel} — where Phase 4 of pack must LAND emotionally. e.g., for dental: 'social-smile-return — cười không che miệng, không né selfie' (NOT 'inner peace').",

  "ctaEnergyVibe": "1 line in ${langLabel} — what FEELING the CTA section must evoke. e.g., 'reader feels: có thể cười tự nhiên lại trong tuần sau'. NOT hard sell.",

  "ctaAvoidPatterns": ["2-4 lines in ${langLabel} — anti-defaults for CTA. e.g., 'inner peace ending only', 'aesthetic perfectionism framing'."],

  "topObjections": [
    {"objection": "'specific objection in ${langLabel} buyer of THIS product would have'", "counterPosture": "'narrator's emotional stance to counter — NOT direct refute'"}
    (provide EXACTLY 3 objections)
  ],

  "voiceTextureHint": {
    "typicalVoice": "1 line in ${langLabel} — who is the typical buyer/reviewer voice. e.g., '25-45yo socially-active adult, mild appearance-conscious'.",
    "platformFeel": "1 line in ${langLabel} — where their voice lives. e.g., 'Shopee dental review / TikTok reply / FB beauty group'.",
    "textureCues": ["3-5 product-specific phrases the voice uses. e.g., 'cười không che miệng', 'gửi ảnh trước-sau', 'đánh răng tối lẫn sáng'."]
  },

  "mechanismVocabHints": ["3-5 concrete mechanism terms in ${langLabel} specific to THIS product. e.g., for dental whitening: 'lớp men răng', 'vết ố cà phê/trà', 'baking soda + activated charcoal pH'. NOT generic 'cân bằng cơ thể'."],

  "rationale": "1 short line in ${langLabel} explaining key signals you used"
}

CRITICAL RULES:
1. primaryDesire MUST be product-paradigm-correct. Dental product = social/smile; eye drop = vision/screen; supplement = aliveness/energy. Don't mix paradigms.
2. topObjections MUST be REALISTIC objections THIS buyer would have — NOT generic "tôi đã thử rồi không hiệu quả" (specific: WHAT they tried, WHY this might be different).
3. voiceTextureHint.platformFeel MUST match the actual product context (dental product on Shopee/TikTok ≠ on Zalo mom group).
4. mechanismVocabHints MUST be CONCRETE domain terms — anti-fingerprint check: NO "từ bên trong", "gốc rễ vấn đề", "cân bằng cơ thể", "phục hồi tự nhiên".
5. All output text in ${langLabel} (JSON keys stay English).

Output JSON only.`
}

const FALLBACK_CP: SynthesizedCommercialPsychology = {
  primaryDesire: '',
  desireTensions: [],
  emotionalGravity: '',
  ctaEnergyVibe: '',
  ctaAvoidPatterns: [],
  topObjections: [],
  voiceTextureHint: {
    typicalVoice: '',
    platformFeel: '',
    textureCues: [],
  },
  mechanismVocabHints: [],
  source: 'fallback',
}

export async function synthesizeCommercialPsychology(
  input: SynthesizeCommercialPsychologyInput,
  keys: SynthesizeCommercialPsychologyKeys,
): Promise<SynthesizedCommercialPsychology> {
  if (!keys.geminiApiKey && !keys.kieApiKey) {
    console.warn('[commercialPsychology] No API key — using fallback')
    return FALLBACK_CP
  }

  try {
    const raw = await textGenWithFallback({
      geminiApiKey: keys.geminiApiKey,
      kieApiKey: keys.kieApiKey,
      prompt: buildPrompt(input),
      systemInstruction: CP_SYSTEM,
      jsonMode: true,
      maxOutputTokens: 1600,
      timeoutMs: 30_000,
      label: 'commercial-psychology-synthesis',
    })

    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    }

    const parsed = JSON.parse(cleaned) as Record<string, unknown>

    // Defensive parsing — fields can be missing/wrong type, normalize
    const filterStrings = (arr: unknown): string[] =>
      Array.isArray(arr)
        ? (arr as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : []

    const parseObjections = (raw: unknown): SynthesizedCommercialPsychology['topObjections'] => {
      if (!Array.isArray(raw)) return []
      return (raw as unknown[])
        .map((o): SynthesizedCommercialPsychology['topObjections'][0] | null => {
          if (!o || typeof o !== 'object') return null
          const rec = o as Record<string, unknown>
          if (typeof rec.objection !== 'string' || typeof rec.counterPosture !== 'string') return null
          return { objection: rec.objection.trim(), counterPosture: rec.counterPosture.trim() }
        })
        .filter((o): o is SynthesizedCommercialPsychology['topObjections'][0] => o !== null)
        .slice(0, 5)
    }

    const parseVoiceTexture = (raw: unknown): SynthesizedCommercialPsychology['voiceTextureHint'] => {
      if (!raw || typeof raw !== 'object') return FALLBACK_CP.voiceTextureHint
      const rec = raw as Record<string, unknown>
      return {
        typicalVoice:  typeof rec.typicalVoice  === 'string' ? rec.typicalVoice.trim()  : '',
        platformFeel:  typeof rec.platformFeel  === 'string' ? rec.platformFeel.trim()  : '',
        textureCues:   filterStrings(rec.textureCues),
      }
    }

    return {
      primaryDesire:       typeof parsed.primaryDesire    === 'string' ? parsed.primaryDesire.trim()    : '',
      desireTensions:      filterStrings(parsed.desireTensions),
      emotionalGravity:    typeof parsed.emotionalGravity === 'string' ? parsed.emotionalGravity.trim() : '',
      ctaEnergyVibe:       typeof parsed.ctaEnergyVibe    === 'string' ? parsed.ctaEnergyVibe.trim()    : '',
      ctaAvoidPatterns:    filterStrings(parsed.ctaAvoidPatterns),
      topObjections:       parseObjections(parsed.topObjections),
      voiceTextureHint:    parseVoiceTexture(parsed.voiceTextureHint),
      mechanismVocabHints: filterStrings(parsed.mechanismVocabHints),
      source: 'gemini-synthesis',
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 240) : undefined,
    }
  } catch (err) {
    console.warn('[commercialPsychology] Synthesis failed — using fallback:', err)
    return FALLBACK_CP
  }
}
