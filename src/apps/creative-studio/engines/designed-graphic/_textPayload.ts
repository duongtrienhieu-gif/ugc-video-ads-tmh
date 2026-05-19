// ── Designed-Graphic Content Generator (P8) ─────────────────────────────────
//
// Decoupled content generator — Gemini text turns a product brief
// into structured content payload (infographic stats / cta banner
// headline). Renderers consume the payload and lay it out via the
// design-system tokens.
//
// Caller can short-circuit by passing pre-built content via
// params.options.content, exactly like ui-native textPayload.

import type { UINativeLocale } from '../../types/uiNative'
import type { CreativeDNA } from '../../types/creativeDNA'
import { safeGenerateStructured } from '../../shared/llm/safeGenerateStructured'
import { formatProductKnowledgeForPrompt, type ProductKnowledge } from '../../services/productKnowledge'
import { assembleDnaDirective } from '../../shared/prompt/dnaDirective'
import { validateLocaleMany } from '../../shared/qc/localeValidator'

export type DesignedGraphicContentKind = 'infographic' | 'cta-banner'

// ── Infographic payload ───────────────────────────────────────────────

export interface InfographicContent {
  /** One-line headline at the top. */
  title: string
  /** Hero stat callout (large display number). */
  heroStat: { value: string; unit: string; label: string }
  /** 3-4 supporting bullet points (short benefit claims). */
  bullets: string[]
  /** Caption line — typically a disclaimer or source. */
  footnote: string
}

export interface CtaBannerContent {
  /** Primary attention-grabbing line. */
  headline: string
  /** One-line subheadline / supporting hook. */
  subheadline: string
  /** Offer label — "Tiết kiệm 30%", "Giao trong 24h", etc. */
  offerLine: string
  /** Button text. */
  ctaText: string
}

/** P35 — infographic variants share the same Canvas renderer but
 *  steer Gemini to emit type-specific bullet structures + heroStat
 *  semantics. */
export type InfographicVariant = 'stats' | 'ingredients' | 'mechanism' | 'timeline'

export interface ContentRequest {
  kind: DesignedGraphicContentKind
  locale: UINativeLocale
  productName: string
  productDescription?: string
  niche?: string
  benefits?: string[]
  usps?: string[]
  offer?: string
  /** Optional tone hint, default 'confident-natural'. */
  tone?: string
  /** P25 — full product knowledge profile loaded from bankStore. */
  productKnowledge?: ProductKnowledge
  /** P28 — Creative DNA appended to system instruction. */
  dna?: CreativeDNA
  /** P35 — infographic content variant (only meaningful when kind='infographic'). */
  infographicVariant?: InfographicVariant
}

// ── P25 — locale hard-lock appended to system instructions ───────────

function localeRule(locale: UINativeLocale): string {
  const map: Record<UINativeLocale, string> = {
    'vi-VN':  'ALL output text must be in Vietnamese (Tiếng Việt with diacritics — không bỏ dấu). NEVER mix English unless quoting an approved brand term. NEVER output Chinese, Korean, or Malay.',
    'my-MY':  'ALL output text must be in Bahasa Melayu. NEVER output Vietnamese, Chinese, English (except approved brand terms), or Korean.',
    'id-ID':  'ALL output text must be in Bahasa Indonesia. NEVER output Vietnamese, Chinese, Malay (Bahasa Melayu has subtle differences), or English.',
    'global': 'ALL output text must be in plain casual English. NEVER output Vietnamese, Chinese, Korean, or Malay.',
  }
  return `[LOCALE HARD LOCK]\n${map[locale]}`
}

function productKnowledgeBlock(req: ContentRequest): string {
  if (!req.productKnowledge) return ''
  return `[PRODUCT KNOWLEDGE — reference real benefits / pain points, do NOT invent]\n`
    + formatProductKnowledgeForPrompt(req.productKnowledge)
    + '\n'
}

const LOCALE_LANG: Record<UINativeLocale, string> = {
  'vi-VN':  'Vietnamese (Tiếng Việt) — clear, confident, NOT salesy',
  'my-MY':  'Malay (Bahasa Melayu)',
  'id-ID':  'Indonesian (Bahasa Indonesia)',
  'global': 'English, plain confident voice',
}

const INFO_SYSTEM_INSTRUCTION =
  'You generate concise infographic copy for product marketing. Output STRICT JSON — no '
  + 'prose, no markdown fences. Numbers must be specific (eg "47%", "2 weeks") rather than '
  + 'vague ("a lot", "fast"). Avoid superlative marketing fluff. NEVER use the words '
  + '"advertisement", "sponsored", "ad", "promo", "best in the world".'

const CTA_SYSTEM_INSTRUCTION =
  'You generate concise CTA banner copy for product marketing. Output STRICT JSON — no '
  + 'prose, no markdown fences. Headlines must be 4-9 words. Subheadlines 6-12 words. '
  + 'Offer line is a single clear benefit ("Tiết kiệm 30%", "Giao 24h"). CTA is an action '
  + 'verb phrase 2-3 words ("Đặt ngay", "Xem chi tiết"). Plain confident voice, NOT salesy.'

/** P35 + P38 — variant-specific copy directives. Each variant reshapes
 *  the example schema + bullet pattern Gemini sees + EXPLICITLY tells
 *  it which product field is the PRIMARY SOURCE for that variant. The
 *  SAME JSON structure carries different SEMANTICS based on which
 *  source field the model leans on.
 *
 *  P38 fix — variants were producing similar output because all 4 pulled
 *  generically from the full product knowledge dump. The new
 *  `primarySource` directive forces each variant to LEAN on the right
 *  product field exclusively. */
const VARIANT_GUIDANCE: Record<InfographicVariant, {
  bulletExamples: [string, string, string, string]
  heroStatExample: { value: string; unit: string; label: string }
  primarySource: string         // P38 — which product field is the source of truth
  forbidPatterns: string[]      // P38 — patterns this variant must NOT produce
  rules: string[]
}> = {
  'stats': {
    heroStatExample: { value: '92', unit: '%', label: 'pengguna berpuas hati selepas 2 minggu' },
    bulletExamples: [
      '4.8/5 rating dari 20,000+ pengguna',
      'Sah halal oleh JAKIM Malaysia',
      'Lebih cepat 3x berbanding suplemen lain',
      'Garansi pulangan dalam 30 hari',
    ],
    primarySource: 'CUSTOMER SOCIAL PROOF METRICS (satisfaction %, customer counts, ratings, certifications, money-back guarantee)',
    forbidPatterns: [
      'mechanism steps (those belong to mechanism variant)',
      'time-anchored bullets (those belong to timeline variant)',
      'ingredient names (those belong to ingredients variant)',
    ],
    rules: [
      '- THIS IS STATS — bullets MUST be NUMERIC SOCIAL PROOF + CERTIFICATIONS, not mechanism explanations, not time milestones, not ingredient names.',
      '- Each bullet should contain a NUMBER, a RATING, a CERTIFICATION BODY, or a GUARANTEE — never a process description.',
      '- heroStat MUST be a satisfaction % / rating / customer count — NEVER a duration (timeline\'s job) or step count (mechanism\'s job).',
      '- Pull bullets from any earned trust signal in the product brief: customer counts, satisfaction surveys, ratings, certifications, awards, guarantees.',
      '- If the product brief lacks hard metrics, infer plausible market-norm metrics (e.g. "★ 4.8/5 dari 10,000+ pengguna") but stay realistic.',
    ],
  },
  'ingredients': {
    heroStatExample: { value: '6', unit: '', label: 'strain probiotik berfaedah' },
    bulletExamples: [
      'Lactobacillus acidophilus — keseimbangan flora usus',
      'Bifidobacterium lactis — tingkatkan imuniti',
      'Inulin (prebiotik) — makanan untuk probiotik',
      'FloraFit™ formula — sains Denmark, penyerapan pantas',
    ],
    primarySource: 'PRODUCT INGREDIENTS FIELD — each ingredient name + its specific benefit',
    forbidPatterns: [
      'social proof metrics (those belong to stats variant)',
      'mechanism steps (those belong to mechanism variant)',
      'time-anchored milestones (those belong to timeline variant)',
      'inventing ingredients not in the product brief',
    ],
    rules: [
      '- THIS IS INGREDIENTS — bullets MUST follow "Ingredient name — its specific benefit" pattern, NEVER stats/mechanism/timeline.',
      '- Pull ingredient names ONLY from the product\'s ingredients field. NEVER invent ingredients not in the brief.',
      '- If the product\'s ingredients field is empty/sparse, infer 4-5 plausible ingredients from the niche (skincare → niacinamide / HA; supplement → vitamins; probiotic → strain names).',
      '- heroStat.value = number of key ingredients counted, heroStat.unit = "" (empty), heroStat.label = "thành phần / strain / ingredient" per locale.',
      '- footnote = certification / sourcing line tying back to the product brief if possible.',
    ],
  },
  'mechanism': {
    heroStatExample: { value: '4', unit: '', label: 'langkah cara kerja' },
    bulletExamples: [
      'Langkah 1: Probiotik mencapai usus melalui kapsul tahan asid',
      'Langkah 2: Mengusir bakteria jahat & mengembalikan keseimbangan flora',
      'Langkah 3: Menghasilkan enzim pencernaan secara semula jadi',
      'Langkah 4: Menguatkan dinding usus & penyerapan nutrien',
    ],
    primarySource: 'PRODUCT USPS + HOW-IT-WORKS — ordered scientific steps describing the BODILY ACTION of the product',
    forbidPatterns: [
      'social proof metrics (stats variant)',
      'time markers like "Sau 5 phút" / "Selepas 7 hari" (timeline variant)',
      'ingredient → benefit pairs (ingredients variant)',
      'user-feeling bullets like "you will feel calmer" (these belong nowhere here — must be process, not feeling)',
    ],
    rules: [
      '- THIS IS MECHANISM — bullets MUST be ordered "Bước N: / Langkah N: / Step N:" describing HOW the product physically acts on the body.',
      '- Each step describes a BODILY ACTION (enzyme released, receptor activated, barrier penetrated) — NEVER what the user feels, NEVER a time marker, NEVER an ingredient list.',
      '- Pull from product USPs field for science-grounded language. If absent, infer plausible mechanism for the niche.',
      '- heroStat.value = step count. heroStat.unit = "" empty. heroStat.label = "step / langkah / bước" per locale.',
      '- footnote = scientific reference cue tying back to product brief if possible.',
    ],
  },
  'timeline': {
    heroStatExample: { value: '30', unit: 'hari', label: 'untuk hasil optimum' },
    bulletExamples: [
      'Selepas 3 hari: Rasa lebih ringan, kurang kembung',
      'Selepas 7 hari: Pergerakan usus lebih teratur',
      'Selepas 14 hari: Pencernaan bertambah baik, kurang sakit perut',
      'Selepas 30 hari: Keseimbangan flora pulih, penyerapan nutrien optimum',
    ],
    primarySource: 'PRODUCT BENEFITS + PAIN POINTS — sequenced over time as progressive resolution milestones',
    forbidPatterns: [
      'social proof metrics (stats variant)',
      'mechanism action steps (mechanism variant)',
      'ingredient → benefit pairs (ingredients variant)',
      'instant-cure promises in the first milestone',
    ],
    rules: [
      '- THIS IS TIMELINE — bullets MUST start with a TIME MARKER ("Sau / Selepas / Setelah / After N phút / ngày / hari / minggu / days").',
      '- Each milestone describes ONE specific FELT or VISIBLE change anchored to that time — never a mechanism step, never an ingredient.',
      '- Pull from product benefits + pain points fields — sequence them so early markers show modest early relief, late markers show full transformation.',
      '- heroStat.value = TOTAL duration to peak effect. heroStat.unit = "hari / ngày / tuần / minggu / days". heroStat.label = "untuk hasil optimum" or locale equivalent.',
      '- 3-5 monotonically increasing milestones.',
      '- First milestone stays MODEST (e.g. "lighter feeling") — NEVER promise instant cure ("hết bệnh trong 5 phút").',
      '- footnote = "Kết quả có thể khác nhau tùy cơ địa" / "Keputusan boleh berbeza ikut individu" per locale.',
    ],
  },
}

function buildInfographicPrompt(req: ContentRequest): string {
  const knowledge = productKnowledgeBlock(req)
  const variant = req.infographicVariant ?? 'stats'
  const guide = VARIANT_GUIDANCE[variant]
  const heroExample = `{ "value": "${guide.heroStatExample.value}", "unit": "${guide.heroStatExample.unit}", "label": "${guide.heroStatExample.label}" }`
  const bulletExample = guide.bulletExamples.map((b) => `"${b}"`).join(',\n               ')
  return [
    `Generate ${variant.toUpperCase()} infographic copy. THIS IS NOT a generic benefit infographic — it is specifically the "${variant}" variant.`,
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    req.productDescription ? `Description: ${req.productDescription}` : '',
    knowledge,
    req.benefits?.length    ? `Stated benefits: ${req.benefits.join('; ')}` : '',
    req.usps?.length        ? `USPs: ${req.usps.join('; ')}`              : '',
    `Language: ${LOCALE_LANG[req.locale]}`,
    `Tone: ${req.tone ?? 'confident-natural'}`,
    '',
    `★ PRIMARY SOURCE for this variant: ${guide.primarySource}`,
    `★ MUST NOT produce: ${guide.forbidPatterns.join(' / ')}`,
    '',
    'STRICT JSON OUTPUT — note the bullet pattern carefully:',
    '{',
    '  "title": "<5-9 word headline matching the variant theme>",',
    `  "heroStat": ${heroExample},`,
    '  "bullets": [',
    `               ${bulletExample}`,
    '             ],',
    '  "footnote": "<one-line disclaimer / source / methodology>"',
    '}',
    '',
    `Variant-specific rules (${variant}):`,
    ...guide.rules,
    '',
    'Universal rules:',
    '- heroStat.value: a number, can include a sign.',
    '- heroStat.unit: short suffix that fits the variant ("%", "x", "ngày", or "" if no unit fits).',
    '- bullets: 3-5 items. Each follows the variant rule above.',
    '- footnote: 6-14 words. Source / timeframe / disclaimer / methodology hint.',
  ].filter(Boolean).join('\n')
}

function buildCtaPrompt(req: ContentRequest): string {
  const knowledge = productKnowledgeBlock(req)
  // P36 — Ladipage-style: thumb-stop conversion banner copy with hard
  // urgency / scarcity language matching native MY-ID-VN ecommerce ads.
  // Examples per locale match real top-converting promo banners.
  const examplesByLocale: Record<UINativeLocale, { headline: string; sub: string; offer: string; cta: string }> = {
    'vi-VN':  { headline: 'Ngủ Sâu Ngay Đêm Đầu — Thử Liền',  sub: 'Hết mất ngủ, dậy khỏe — ngàn người đã chọn',  offer: 'Giảm 50% hôm nay — Giao COD toàn quốc', cta: 'Đặt ngay' },
    'my-MY':  { headline: 'Tidur Lena Malam Pertama — Cuba Sekarang', sub: 'Lupa insomnia, bangun segar — ribuan dah cuba', offer: 'Diskaun 50% hari ini — COD seluruh Malaysia', cta: 'Pesan Sekarang' },
    'id-ID':  { headline: 'Tidur Pulas Malam Pertama — Coba Sekarang', sub: 'Bebas insomnia, bangun segar — ribuan sudah coba', offer: 'Diskon 50% hari ini — COD ke seluruh Indonesia', cta: 'Pesan Sekarang' },
    'global': { headline: 'Sleep Deep From Night One — Try Now',  sub: 'No more sleepless nights — thousands trust it',  offer: '50% off today — Free delivery nationwide', cta: 'Order Now' },
  }
  const ex = examplesByLocale[req.locale]
  return [
    'Generate CTA promo banner copy for this product. Tone must match native SEA ecommerce ads — hard-sell urgency, NOT corporate luxury.',
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    req.productDescription ? `Description: ${req.productDescription}` : '',
    knowledge,
    req.benefits?.length    ? `Benefits: ${req.benefits.join('; ')}` : '',
    req.offer               ? `Offer terms: ${req.offer}` : '',
    `Language: ${LOCALE_LANG[req.locale]}`,
    `Tone: ${req.tone ?? 'thumb-stop-urgency'}`,
    '',
    'EXAMPLE for this locale (rewrite for the specific product — do not copy verbatim):',
    `  headline    → "${ex.headline}"`,
    `  subheadline → "${ex.sub}"`,
    `  offerLine   → "${ex.offer}"`,
    `  ctaText     → "${ex.cta}"`,
    '',
    'STRICT JSON OUTPUT — no prose, no markdown fence:',
    '{',
    '  "headline":   "<4-9 word thumb-stop attention line, native ad voice>",',
    '  "subheadline":"<6-12 word supporting hook with proof or urgency>",',
    '  "offerLine":  "<single offer line — price/discount + delivery/COD when applicable>",',
    '  "ctaText":    "<2-3 word action verb, all-caps acceptable>"',
    '}',
    '',
    'Hard rules:',
    '- offerLine MUST reference the product\'s actual offer/pricing if provided — do NOT invent prices not in the offer field.',
    '- Native ad clichés OK ("Stok terhad", "Jangan tunggu", "Chỉ hôm nay", "Hari ini sahaja").',
    '- NEVER produce English boilerplate in non-global locales.',
    '- NEVER use the words "advertisement", "sponsored", "ad", "promo".',
  ].filter(Boolean).join('\n')
}

// ── Schema checks ─────────────────────────────────────────────────────

function isInfographicContent(v: unknown): v is InfographicContent {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (typeof obj.title !== 'string') return false
  if (typeof obj.heroStat !== 'object' || obj.heroStat === null) return false
  const stat = obj.heroStat as Record<string, unknown>
  if (typeof stat.value !== 'string' || typeof stat.label !== 'string') return false
  if (!Array.isArray(obj.bullets) || obj.bullets.length === 0) return false
  return obj.bullets.every((b) => typeof b === 'string')
}

function isCtaBannerContent(v: unknown): v is CtaBannerContent {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return typeof obj.headline === 'string'
      && typeof obj.ctaText === 'string'
      && obj.headline.length > 0
      && obj.ctaText.length > 0
}

// ── Fallback content (used when LLM keeps failing) ────────────────────

function infographicFallback(req: ContentRequest): InfographicContent {
  if (req.locale === 'vi-VN') {
    return {
      title: `Vì sao ${req.productName} hiệu quả`,
      heroStat: { value: '92', unit: '%', label: 'người dùng hài lòng sau 2 tuần' },
      bullets: [
        'Thành phần tự nhiên, không phụ thuộc',
        'Hiệu quả nhanh — thấy khác sau 7-10 ngày',
        'Đóng gói tiện lợi, dễ mang theo',
        'Cam kết hoàn tiền nếu không hiệu quả',
      ],
      footnote: 'Khảo sát nội bộ 200 khách hàng, 2024',
    }
  }
  return {
    title: `Why ${req.productName} works`,
    heroStat: { value: '92', unit: '%', label: 'customer satisfaction after 2 weeks' },
    bullets: [
      'Natural ingredients, no dependency',
      'Visible results in 7-10 days',
      'Travel-friendly packaging',
      '30-day money-back guarantee',
    ],
    footnote: 'Internal survey of 200 customers, 2024',
  }
}

function ctaFallback(req: ContentRequest): CtaBannerContent {
  if (req.locale === 'vi-VN') {
    return {
      headline: `Đặt ${req.productName} hôm nay`,
      subheadline: 'Giao toàn quốc — cam kết chính hãng 100%',
      offerLine: 'Giảm 30% — chỉ hôm nay',
      ctaText: 'Đặt ngay',
    }
  }
  return {
    headline: `Get ${req.productName} today`,
    subheadline: 'Free shipping nationwide — 100% authentic',
    offerLine: '30% off — today only',
    ctaText: 'Order Now',
  }
}

// ── Public generators (P12-fix: safeGenerateStructured everywhere) ────

export async function generateInfographicContent(
  apiKey: string,
  req: ContentRequest,
): Promise<InfographicContent> {
  const dnaDirective = req.dna ? assembleDnaDirective(req.dna) : ''
  const dnaAppend = dnaDirective ? '\n\n' + dnaDirective : ''
  const result = await safeGenerateStructured<InfographicContent>({
    apiKey,
    prompt: buildInfographicPrompt(req),
    systemInstruction: INFO_SYSTEM_INSTRUCTION + '\n\n' + localeRule(req.locale) + dnaAppend,
    // P12-fix: bump token budget — previous 1024 was getting truncated
    // mid-string with "Unexpected end of JSON input" errors
    maxOutputTokens: 2048,
    schema: { name: 'InfographicContent', validate: isInfographicContent },
    fallback: infographicFallback(req),
    generatorLabel: 'designed-graphic infographic',
    // P29 — every visible text field must match the locale.
    postValidate: (v) => validateLocaleMany([
      v.title,
      v.heroStat?.label ?? '',
      ...v.bullets,
      v.footnote,
    ], req.locale),
  })
  return result.value
}

export async function generateCtaBannerContent(
  apiKey: string,
  req: ContentRequest,
): Promise<CtaBannerContent> {
  const dnaDirective = req.dna ? assembleDnaDirective(req.dna) : ''
  const dnaAppend = dnaDirective ? '\n\n' + dnaDirective : ''
  const result = await safeGenerateStructured<CtaBannerContent>({
    apiKey,
    prompt: buildCtaPrompt(req),
    systemInstruction: CTA_SYSTEM_INSTRUCTION + '\n\n' + localeRule(req.locale) + dnaAppend,
    maxOutputTokens: 1024,   // P12-fix: was 512 (too tight)
    schema: { name: 'CtaBannerContent', validate: isCtaBannerContent },
    fallback: ctaFallback(req),
    generatorLabel: 'designed-graphic cta',
    // P29 — every CTA text field must match the locale.
    postValidate: (v) => validateLocaleMany([
      v.headline,
      v.subheadline,
      v.offerLine,
      v.ctaText,
    ], req.locale),
  })
  return result.value
}
