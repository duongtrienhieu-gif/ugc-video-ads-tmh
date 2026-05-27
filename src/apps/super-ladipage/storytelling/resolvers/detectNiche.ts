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
  // Tier S extensions (2026-05-27)
  'sleep-insomnia',
  'menopause',
  'mental-health',
  'anti-aging-longevity',
  // SEA-6 extensions (2026-05-27)
  'dental-oral-care',
  'diabetes-blood-sugar',
  'liver-detox',
  'prostate-urology',
  'hemorrhoids-digestive-shame',
  'eye-vision-care',
]

// ─── Gemini classifier prompts ────────────────────────────────────

const NICHE_DESCRIPTIONS = `
- skincare: TOPICAL face skincare — acne cream, anti-aging cream (TOPICAL ONLY), whitening, serum, sunscreen, mặt da kem mụn
- haircare: hair loss, dandruff, shampoo, scalp issues, baldness, tóc rụng gàu
- health-functional: joint/knee/back/spine pain, orthopedic braces, nasal/sinus, respiratory/cough/allergy, digestive/stomach (NON-hemorrhoid), blood pressure (NON-diabetes), cholesterol, arthritis. GENERIC NON-AESTHETIC HEALTH PRODUCTS — use only if not fit specific niche below.
- supplement-wellness: GENERAL vitamins, oral collagen for beauty, omega, energy booster, immune support, antioxidants (use for generic supplement that doesn't fit specific niches below)
- fitness-recovery: gym, weight loss, body fat, muscle building, workout supplements, cardio recovery
- relationship: marriage/sexual health for COUPLES, libido, erectile, intimate products (NOT urinary / prostate)
- mom-baby: pregnancy, infant care, baby food, mother postpartum
- beauty-confidence: body shape, body confidence, hair removal, deodorant, breast care, posture confidence, weight-for-appearance
- sleep-insomnia: SLEEP-SPECIFIC products — melatonin, sleep aid, anti-insomnia, sleep quality, orthopedic pillow for sleep, sleep mattress, weighted blanket, sleep app/tracker. Pain points: mất ngủ / khó ngủ / trằn trọc / dậy giữa đêm / sleep cycle disruption.
- menopause: FEMALE HORMONAL TRANSITION — perimenopause/menopause supplements, hot flash relief, night sweats, hormone balance, mood swings for women 40-55. Pain points: bốc hỏa / đổ mồ hôi đêm / thay đổi tâm trạng / khô da đột ngột / mất libido / tiền mãn kinh.
- mental-health: MENTAL/EMOTIONAL — anxiety relief, stress reduction (specifically psychological, NOT general energy), depression support, burnout recovery, ashwagandha for stress, magnesium for anxiety, meditation app. Pain points: lo âu / hoảng loạn / căng thẳng / trầm cảm / kiệt sức tâm lý / burnout.
- anti-aging-longevity: LONGEVITY SCIENCE — NAD+/NMN, resveratrol, cellular senescence, biological age, mitochondrial health, autophagy, healthspan extension. Distinguished from skincare (topical aesthetic) and supplement-wellness (generic vitamins) by SPECIFIC cellular biology / longevity focus.
- dental-oral-care: DENTAL / ORAL — teeth whitening (functional NOT cosmetic-only), toothpaste, mouthwash, breath freshener, gum care, tartar removal, oral probiotics, dental floss, tongue scraper. Pain points: hơi thở hôi / cao răng / nướu viêm / răng ố vàng / ê buốt răng / kem đánh răng / nước súc miệng.
- diabetes-blood-sugar: BLOOD SUGAR / DIABETES — diabetes support supplement, chromium, berberine, glucose stabilizer, A1C support, insulin sensitivity. Pain points: tiểu đường / đường huyết cao / A1C / glucose / fasting glucose / kháng insulin. Distinguished from generic supplement-wellness by SPECIFIC glycemic focus.
- liver-detox: LIVER SUPPORT / DETOX — silymarin / milk thistle / cây kế sữa, liver enzyme support, fatty liver supplement, hangover recovery, ALT/AST support. Pain points: men gan / gan nhiễm mỡ / ALT cao / hangover / nhậu nhiều / vàng da. Distinguished from generic detox/wellness by SPECIFIC hepatic focus.
- prostate-urology: PROSTATE / MALE URINARY — saw palmetto, beta-sitosterol, prostate support, BPH supplement, frequent urination male, PSA support. Pain points: tiểu đêm / tia tiểu yếu / tuyến tiền liệt / phì đại tuyến tiền liệt / PSA / BPH. Distinguished from relationship (sexual) — this is URINARY function specifically.
- hemorrhoids-digestive-shame: HEMORRHOIDS / CONSTIPATION — anti-hemorrhoid cream/suppository, diosmin/hesperidin vein support, fiber for chronic constipation, anal fissure relief. Pain points: trĩ / búi trĩ / chảy máu hậu môn / táo bón mạn / rặn đau / chảy máu khi đi vệ sinh.
- eye-vision-care: EYE / VISION — eye drops, lutein/zeaxanthin supplement, blue light glasses, dry eye relief, macular degeneration support, screen fatigue. Pain points: mắt mỏi / mắt khô / nhìn mờ / cận thị / loạn / lutein / blue light / thoái hóa điểm vàng.
`.trim()

function buildClassifierPrompt(input: DetectInput): string {
  return `Classify this product into EXACTLY ONE niche key from the 18 options below.

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
4. Vitamins/collagen taken orally for general health → supplement-wellness, BUT see exceptions 6-15 below
5. If multiple match, pick the MOST SPECIFIC niche to the product function (what the product physically does), NOT the marketing emotion
6. SLEEP-SPECIFIC products (melatonin, sleep pillow, anti-insomnia) → sleep-insomnia (NOT supplement-wellness even though supplement form)
7. FEMALE HORMONAL TRANSITION (hot flash, perimenopause, menopause-specific) → menopause (NOT supplement-wellness — life-stage specific)
8. ANXIETY/STRESS/DEPRESSION specific products → mental-health (NOT supplement-wellness if product specifically targets psychological state)
9. NMN/NAD/LONGEVITY-SCIENCE products → anti-aging-longevity (NOT skincare which is topical, NOT supplement-wellness which is generic)
10. DENTAL products (kem đánh răng / nước súc miệng / cao răng / hơi thở) → dental-oral-care (NOT beauty-confidence cosmetic, NOT skincare)
11. BLOOD SUGAR / DIABETES products (berberine / chromium / glucose / insulin support / A1C) → diabetes-blood-sugar (NOT health-functional generic, NOT supplement-wellness)
12. LIVER / MEN GAN products (silymarin / milk thistle / cây kế sữa / gan nhiễm mỡ) → liver-detox (NOT health-functional generic, NOT supplement-wellness)
13. PROSTATE / TIỂU ĐÊM / MALE URINARY (saw palmetto / beta-sitosterol / BPH / tuyến tiền liệt) → prostate-urology (NOT relationship which is sexual, NOT health-functional)
14. HEMORRHOIDS / TRĨ / TÁO BÓN MẠN (diosmin / hesperidin / preparation H / búi trĩ) → hemorrhoids-digestive-shame (NOT health-functional generic)
15. EYE / MẮT products (lutein / zeaxanthin / eye drops / mắt khô / mỏi mắt / blue light) → eye-vision-care (NOT health-functional generic, NOT supplement-wellness)

OUTPUT FORMAT: Reply with EXACTLY ONE niche key. Just the key string, lowercase, hyphenated. NO explanation, NO quotes, NO markdown.

Example correct output:
dental-oral-care

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
  // ── Tier S extensions (regex fallback, checked BEFORE skincare/supplement) ──
  {
    niche: 'sleep-insomnia',
    keywords: [
      /\bmất ngủ\b/i, /\bkhó ngủ\b/i, /\btrằn trọc\b/i, /\bngủ không sâu\b/i,
      /\binsomnia\b/i, /\bsleep aid\b/i, /\bmelatonin\b/i,
      /\btidur\b/i, /\bsusah tidur\b/i,
      /\bsleep mask\b/i, /\bweighted blanket\b/i, /\bsleep pillow\b/i,
    ],
  },
  {
    niche: 'menopause',
    keywords: [
      /\bmãn kinh\b/i, /\btiền mãn kinh\b/i, /\bperimenopause\b/i, /\bmenopause\b/i,
      /\bbốc hỏa\b/i, /\bhot flash\b/i, /\bnight sweat\b/i, /\bđổ mồ hôi đêm\b/i,
      /\bnội tiết tố\b/i, /\bestrogen\b/i, /\bhormone phụ nữ\b/i,
      /\bmenopaus\b/i,
    ],
  },
  {
    niche: 'mental-health',
    keywords: [
      /\blo âu\b/i, /\bcăng thẳng\b/i, /\btrầm cảm\b/i, /\bstress\b/i,
      /\banxiety\b/i, /\bdepression\b/i, /\bburnout\b/i, /\bkiệt sức\b/i,
      /\bashwagandha\b/i, /\bcortisol\b/i, /\bgaba\b/i,
      /\bmeditation\b/i, /\bmindful\b/i, /\bpanic attack\b/i, /\bhoảng loạn\b/i,
    ],
  },
  {
    niche: 'anti-aging-longevity',
    keywords: [
      /\bnmn\b/i, /\bnad\b/i, /\bresveratrol\b/i, /\blongevity\b/i,
      /\btelomere\b/i, /\bautophagy\b/i, /\bmitochondria\b/i, /\bcellular\b/i,
      /\bbiological age\b/i, /\bhealthspan\b/i, /\bsenescence\b/i,
      /\bchống lão hóa\b/i, /\btrẻ hóa\b/i,
    ],
  },
  // ── SEA-6 extensions (regex fallback, checked BEFORE health-functional) ──
  {
    niche: 'dental-oral-care',
    keywords: [
      /\brăng\b/i, /\bnướu\b/i, /\bhơi thở\b/i, /\bcao răng\b/i,
      /\btẩy trắng răng\b/i, /\bkem đánh răng\b/i, /\bnước súc miệng\b/i,
      /\btoothpaste\b/i, /\bmouthwash\b/i, /\bgum\b/i, /\btartar\b/i,
      /\bdental\b/i, /\boral care\b/i, /\bteeth\b/i, /\bbreath\b/i,
      /\bgigi\b/i, /\bnafas\b/i,
    ],
  },
  {
    niche: 'diabetes-blood-sugar',
    keywords: [
      /\btiểu đường\b/i, /\bđường huyết\b/i, /\bđái tháo đường\b/i,
      /\bblood sugar\b/i, /\bdiabetes\b/i, /\ba1c\b/i, /\bglucose\b/i,
      /\binsulin\b/i, /\bberberine\b/i, /\bchromium\b/i,
      /\bmetformin\b/i, /\bglucophage\b/i,
      /\bkencing manis\b/i, /\bdiabetic\b/i,
    ],
  },
  {
    niche: 'liver-detox',
    keywords: [
      /\bgan\b/i, /\bmen gan\b/i, /\bgan nhiễm mỡ\b/i, /\bxơ gan\b/i,
      /\bliver\b/i, /\bhepatic\b/i, /\bfatty liver\b/i,
      /\bsilymarin\b/i, /\bmilk thistle\b/i, /\bcây kế sữa\b/i,
      /\balt\b/i, /\bast\b/i, /\bdetox gan\b/i, /\bthải độc gan\b/i,
      /\bhati\b/i,
    ],
  },
  {
    niche: 'prostate-urology',
    keywords: [
      /\btuyến tiền liệt\b/i, /\btiểu đêm\b/i, /\bphì đại tuyến\b/i,
      /\bprostate\b/i, /\bbph\b/i, /\bpsa\b/i,
      /\bsaw palmetto\b/i, /\bbeta-sitosterol\b/i, /\btamsulosin\b/i, /\bavodart\b/i,
      /\btiểu rắt\b/i, /\btia tiểu\b/i, /\bbàng quang\b/i,
      /\bprostat\b/i, /\bkencing malam\b/i,
    ],
  },
  {
    niche: 'hemorrhoids-digestive-shame',
    keywords: [
      /\btrĩ\b/i, /\bbúi trĩ\b/i, /\btáo bón\b/i, /\bchảy máu hậu môn\b/i,
      /\bhemorrhoid\b/i, /\bpiles\b/i, /\bconstipation\b/i,
      /\bdiosmin\b/i, /\bhesperidin\b/i, /\bpreparation h\b/i,
      /\branal fissure\b/i, /\bhậu môn\b/i, /\brặn đau\b/i,
      /\bbuasir\b/i,
    ],
  },
  {
    niche: 'eye-vision-care',
    keywords: [
      /\bmắt\b/i, /\bmỏi mắt\b/i, /\bkhô mắt\b/i, /\bcận thị\b/i,
      /\beye\b/i, /\bvision\b/i, /\bdry eye\b/i, /\bblue light\b/i,
      /\blutein\b/i, /\bzeaxanthin\b/i, /\bmacular\b/i,
      /\bthoái hóa điểm vàng\b/i, /\bsystane\b/i, /\brefresh tears\b/i,
      /\bmata\b/i, /\bpenglihatan\b/i,
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
