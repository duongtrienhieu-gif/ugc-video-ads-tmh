// ─────────────────────────────────────────────────────────────────────
// Storytelling — detectNiche (Gemini classifier, v3 2026-05-27)
//
// v3 — Option A from user discussion: REPLACE regex with Gemini-based
// product classifier. Inspired by UGC Chuyển Đổi Nhanh's approach
// (skip pre-detection, let LLM read product context).
//
// Why:
//   - v1 hardcoded 'skincare' default broke all non-skincare products
//   - v2 expanded regex keywords but still brittle (compound phrases,
//     synonyms, product brands all break regex)
//   - v3 uses Gemini to read product context and classify into one of
//     8 NicheKey values. Same downstream pipeline (NicheKey-keyed pools
//     unchanged) — only resolution layer upgraded.
//
// Failure path:
//   - Gemini call fails → fall back to regex (v2 still embedded)
//   - Regex returns 0 hits → fall back to 'health-functional' (safe generic)
//
// Cost: ~1 small Gemini call per pack gen (~0.0001$ at current rates).
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey } from '../types'
import { textGenWithFallback } from '../../services/textGenWithFallback'

interface DetectInput {
  productName: string
  painPoints?: string
  benefits?: string
  category?: string
}

interface DetectResult {
  niche: NicheKey
  confidence: 'high' | 'medium' | 'low'
  matchedKeywords: string[]
  /** Which path produced this result — for QA / observability. */
  source: 'gemini' | 'regex-fallback' | 'safe-default'
}

interface ClassifierKeys {
  geminiApiKey: string
  kieApiKey: string
}

// ─── VALID niches (must match storytelling/types.ts NicheKey union) ───

const VALID_NICHES: ReadonlyArray<NicheKey> = [
  'skincare',
  'haircare',
  'supplement-wellness',
  'health-functional',
  'mom-baby',
  'relationship',
  'fitness-recovery',
  'beauty-confidence',
]

// ─── Gemini classifier prompts ────────────────────────────────────

const NICHE_DESCRIPTIONS = `
- skincare: face skincare, acne, anti-aging, whitening, serum, cream, sunscreen, mặt da kem mụn
- haircare: hair loss, dandruff, shampoo, scalp issues, baldness, tóc rụng gàu
- health-functional: joint/knee/back/spine pain, orthopedic braces, nasal/sinus, respiratory/cough/allergy, digestive/stomach, blood pressure, diabetes, cholesterol, eye/vision, arthritis. NON-AESTHETIC HEALTH PRODUCTS.
- supplement-wellness: vitamins, collagen oral, omega, energy booster, immune support, antioxidants
- fitness-recovery: gym, weight loss, body fat, muscle building, workout supplements, cardio recovery
- relationship: marriage/sexual health for COUPLES, libido, erectile, intimate products
- mom-baby: pregnancy, infant care, baby food, mother postpartum
- beauty-confidence: body shape, body confidence, hair removal, deodorant, breast care, posture confidence, weight-for-appearance
`.trim()

function buildClassifierPrompt(input: DetectInput): string {
  return `Classify this product into EXACTLY ONE niche key from the 8 options below.

NICHE OPTIONS:
${NICHE_DESCRIPTIONS}

PRODUCT TO CLASSIFY:
- Name: ${input.productName || '(no name)'}
- Pain points: ${input.painPoints || '(none)'}
- Benefits: ${input.benefits || '(none)'}
${input.category ? `- Category: ${input.category}` : ''}

CRITICAL RULES:
1. Knee/back/joint/spine braces or supports → health-functional (NOT beauty-confidence)
2. Nasal/sinus/respiratory products → health-functional (NOT skincare)
3. Generic "boost confidence" language does NOT make it beauty-confidence — look at WHAT the product does
4. Vitamins/collagen taken orally → supplement-wellness, but topical creams → skincare
5. If multiple match, pick the MOST SPECIFIC niche to the product function (what the product physically does), NOT the marketing emotion

OUTPUT FORMAT: Reply with EXACTLY ONE niche key. Just the key string, lowercase, hyphenated. NO explanation, NO quotes, NO markdown.

Example correct output:
health-functional

Now classify:`
}

const CLASSIFIER_SYSTEM = `You are a product taxonomy classifier for a marketing copy generator. Output ONLY the niche key — no other text, no explanation.`

// ─── Gemini classifier call ───────────────────────────────────────

async function classifyWithGemini(
  input: DetectInput,
  keys: ClassifierKeys,
): Promise<NicheKey | null> {
  try {
    const raw = await textGenWithFallback({
      geminiApiKey: keys.geminiApiKey,
      kieApiKey: keys.kieApiKey,
      prompt: buildClassifierPrompt(input),
      systemInstruction: CLASSIFIER_SYSTEM,
      jsonMode: false,
      maxOutputTokens: 50,
      timeoutMs: 15_000,
      label: 'niche-classify',
    })

    // Strict parse: lowercase, strip quotes/markdown, take first token
    const cleaned = raw
      .trim()
      .toLowerCase()
      .replace(/['"`]/g, '')
      .replace(/^[^a-z]+/, '')
      .split(/[\s\n,]/)[0]

    if ((VALID_NICHES as readonly string[]).includes(cleaned)) {
      return cleaned as NicheKey
    }

    // Substring match — Gemini sometimes wraps with extra words despite instruction
    for (const niche of VALID_NICHES) {
      if (raw.toLowerCase().includes(niche)) {
        return niche
      }
    }

    console.warn(`[detectNiche/gemini] Could not parse '${raw.slice(0, 60)}' to a NicheKey — falling back`)
    return null
  } catch (err) {
    console.warn(`[detectNiche/gemini] Classifier call failed — falling back:`, err)
    return null
  }
}

// ─── Regex fallback (kept as defensive layer) ─────────────────────

const NICHE_KEYWORDS: Array<{ niche: NicheKey; keywords: RegExp[] }> = [
  {
    niche: 'mom-baby',
    keywords: [
      /\bbaby\b/i, /\bsơ sinh\b/i, /\btrẻ sơ sinh\b/i,
      /\bbayi\b/i, /\bnewborn\b/i, /\bbỉm\b/i,
      /\bmang thai\b/i, /\bhamil\b/i, /\bpregnant\b/i,
    ],
  },
  {
    niche: 'haircare',
    keywords: [
      /\btóc\b/i, /\bhói\b/i, /\brụng tóc\b/i,
      /\brambut\b/i, /\bgugur\b/i, /\bbotak\b/i,
      /\bshampoo\b/i, /\bscalp\b/i, /\bdandruff\b/i, /\bgàu\b/i,
    ],
  },
  {
    niche: 'health-functional',
    keywords: [
      /\bknee\b/i, /\bgối\b/i, /\bđầu gối\b/i,
      /\bback pain\b/i, /\blưng\b/i, /\bspine\b/i, /\bcột sống\b/i,
      /\bankle\b/i, /\belbow\b/i,
      /\bbrace\b/i, /\borthopedic\b/i, /\bđai\b/i, /\bnẹp\b/i,
      /\bpain\b/i, /\bđau\b/i, /\bsakit\b/i, /\bnhức\b/i,
      /\bxương khớp\b/i, /\bkhớp\b/i, /\bsendi\b/i, /\bjoint\b/i,
      /\barthritis\b/i, /\bthấp khớp\b/i, /\bgout\b/i,
      /\bnasal\b/i, /\bsinus\b/i, /\bmũi\b/i, /\bnghẹt\b/i, /\bxoang\b/i,
      /\bresdung\b/i, /\bsemburan\b/i,
      /\bdiabetes\b/i, /\bhuyết áp\b/i, /\btiểu đường\b/i,
    ],
  },
  {
    niche: 'supplement-wellness',
    keywords: [
      /\bvitamin\b/i, /\bsupplement\b/i, /\bomega\b/i,
      /\bcollagen\b/i, /\bkolagen\b/i, /\bglutathione\b/i,
      /\bimmune\b/i, /\bmiễn dịch\b/i,
    ],
  },
  {
    niche: 'fitness-recovery',
    keywords: [
      /\bgym\b/i, /\bworkout\b/i, /\bcơ bắp\b/i, /\bmuscle\b/i,
      /\bgiảm cân\b/i, /\bweight loss\b/i, /\bkurus\b/i,
    ],
  },
  {
    niche: 'relationship',
    keywords: [
      /\bmarriage\b/i, /\bsinh lý\b/i, /\blibido\b/i, /\berectile\b/i,
      /\bsuami\b/i, /\bisteri\b/i,
    ],
  },
  {
    niche: 'beauty-confidence',
    keywords: [
      /\bvóc dáng\b/i, /\bbody shape\b/i, /\bbody confidence\b/i,
      /\btẩy lông\b/i, /\bhair removal\b/i,
      /\bdeodorant\b/i, /\bnách\b/i, /\bketiak\b/i,
      /\bngực\b/i, /\bpayudara\b/i, /\bbreast\b/i,
    ],
  },
  {
    niche: 'skincare',
    keywords: [
      /\bskincare\b/i, /\bda mặt\b/i, /\bkem dưỡng\b/i,
      /\bjerawat\b/i, /\bacne\b/i, /\bmụn\b/i,
      /\bnám\b/i, /\bwhitening\b/i, /\banti.?aging\b/i,
      /\bserum\b/i, /\bsunscreen\b/i, /\bkem chống nắng\b/i,
    ],
  },
]

function classifyWithRegex(input: DetectInput): { niche: NicheKey; matchedKeywords: string[] } {
  const corpus = [input.productName, input.painPoints, input.benefits, input.category]
    .filter(Boolean)
    .join(' \n ')

  if (!corpus.trim()) {
    return { niche: 'health-functional', matchedKeywords: [] }
  }

  const scores: Array<{ niche: NicheKey; hits: string[] }> = []
  for (const { niche, keywords } of NICHE_KEYWORDS) {
    const hits: string[] = []
    for (const re of keywords) {
      const m = corpus.match(re)
      if (m) hits.push(m[0])
    }
    if (hits.length > 0) scores.push({ niche, hits })
  }

  if (scores.length === 0) {
    return { niche: 'health-functional', matchedKeywords: [] }
  }

  scores.sort((a, b) => b.hits.length - a.hits.length)
  return { niche: scores[0].niche, matchedKeywords: scores[0].hits }
}

// ─── Main detector (async — Gemini first, regex fallback) ─────────

export async function detectNiche(
  input: DetectInput,
  keys: ClassifierKeys,
): Promise<DetectResult> {
  // ── Path 1: Gemini classifier (universal, handles any product) ──
  if (keys.geminiApiKey) {
    const niche = await classifyWithGemini(input, keys)
    if (niche) {
      return {
        niche,
        confidence: 'high',
        matchedKeywords: ['<Gemini classifier>'],
        source: 'gemini',
      }
    }
  }

  // ── Path 2: regex fallback (Gemini failed or no API key) ────────
  const regexResult = classifyWithRegex(input)
  if (regexResult.matchedKeywords.length > 0) {
    return {
      niche: regexResult.niche,
      confidence: regexResult.matchedKeywords.length >= 2 ? 'medium' : 'low',
      matchedKeywords: regexResult.matchedKeywords,
      source: 'regex-fallback',
    }
  }

  // ── Path 3: safe default ────────────────────────────────────────
  return {
    niche: 'health-functional',
    confidence: 'low',
    matchedKeywords: [],
    source: 'safe-default',
  }
}
