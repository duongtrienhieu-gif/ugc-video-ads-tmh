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

/** P35 — variant-specific copy directives. Each variant reshapes the
 *  example schema + bullet pattern Gemini sees, so the SAME JSON
 *  structure carries different SEMANTICS. The Canvas renderer doesn't
 *  need to change — heroStat + bullets + footnote already accommodate
 *  ingredient pairs, mechanism steps, and time-anchored milestones. */
const VARIANT_GUIDANCE: Record<InfographicVariant, {
  bulletExamples: [string, string, string, string]
  heroStatExample: { value: string; unit: string; label: string }
  rules: string[]
}> = {
  'stats': {
    heroStatExample: { value: '92', unit: '%', label: 'customer satisfaction after 2 weeks' },
    bulletExamples: ['<short benefit 1>', '<short benefit 2>', '<short benefit 3>', '<short benefit 4>'],
    rules: [
      '- This is a STATS-driven infographic. Bullets = concise benefit claims (4-9 words each).',
      '- heroStat = the single most impressive metric (rating / % satisfaction / time-to-result).',
    ],
  },
  'ingredients': {
    heroStatExample: { value: '5', unit: '', label: 'thành phần hoạt tính chính' },
    bulletExamples: [
      'Cúc La Mã — làm dịu da kích ứng',
      'Vitamin C — sáng da, mờ thâm',
      'Hyaluronic Acid — cấp ẩm sâu',
      'Niacinamide — kiểm soát dầu',
    ],
    rules: [
      '- This is an INGREDIENTS infographic. Each bullet MUST be "Ingredient name — its specific benefit".',
      '- heroStat.value = number of key active ingredients. heroStat.unit = "" (empty). heroStat.label = "thành phần hoạt tính chính" or locale equivalent.',
      '- Use REAL ingredient names from the product knowledge — do NOT invent. If product has no listed ingredients, infer plausibly from niche.',
      '- 4-5 bullets total. Each ingredient + benefit pair.',
      '- footnote = certification / sourcing line ("Chứng nhận organic" / "Nguyên liệu nhập khẩu" / etc.).',
    ],
  },
  'mechanism': {
    heroStatExample: { value: '3', unit: '', label: 'bước cơ chế hoạt động' },
    bulletExamples: [
      'Bước 1: Thẩm thấu nhanh qua lớp sừng da',
      'Bước 2: Kích hoạt collagen tự nhiên',
      'Bước 3: Phục hồi và làm sáng da từ bên trong',
      'Bước 4: Bảo vệ khỏi tác hại môi trường',
    ],
    rules: [
      '- This is a MECHANISM infographic. Each bullet = an ordered mechanism step starting with "Bước N:" or locale equivalent.',
      '- heroStat.value = number of mechanism steps OR key delivery metric (e.g. "30s" absorption time).',
      '- heroStat.label = describes the mechanism category ("bước cơ chế hoạt động" / "phút tác dụng" / etc.).',
      '- Each step must describe HOW the product works on the body — not what the user feels.',
      '- 3-5 steps total. Order matters.',
      '- footnote = scientific source / proven mechanism / clinical reference cue.',
    ],
  },
  'timeline': {
    heroStatExample: { value: '30', unit: 'ngày', label: 'để đạt kết quả tối đa' },
    bulletExamples: [
      'Sau 5 phút: Da dịu, giảm đỏ rõ rệt',
      'Sau 7 ngày: Da căng mịn hơn, lỗ chân lông se',
      'Sau 14 ngày: Đốm thâm nhạt đi, da đều màu',
      'Sau 30 ngày: Da săn chắc, sáng khỏe rõ rệt',
    ],
    rules: [
      '- This is a TIMELINE infographic. Each bullet MUST start with a TIME MARKER like "Sau 5 phút:" / "Sau 7 ngày:" / "Sau 30 ngày:" / locale equivalent.',
      '- heroStat.value = the TOTAL duration to reach full effect. heroStat.unit = "ngày" / "tuần" / "days" per locale.',
      '- heroStat.label = "để đạt kết quả tối đa" or locale equivalent.',
      '- 3-5 milestones, monotonically increasing time. Each describes a SPECIFIC visible / felt change.',
      '- Set realistic expectations — never promise "instant cure" in the 5-min bullet.',
      '- footnote = "Kết quả có thể khác nhau tùy cơ địa" or locale equivalent.',
    ],
  },
}

function buildInfographicPrompt(req: ContentRequest): string {
  const knowledge = productKnowledgeBlock(req)
  const variant = req.infographicVariant ?? 'stats'
  const guide = VARIANT_GUIDANCE[variant]
  const heroExample = `{ "value": "${guide.heroStatExample.value}", "unit": "${guide.heroStatExample.unit}", "label": "${guide.heroStatExample.label}" }`
  const bulletExample = guide.bulletExamples.map((b) => `"${b}"`).join(', ')
  return [
    `Generate ${variant.toUpperCase()} infographic copy for this product.`,
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    req.productDescription ? `Description: ${req.productDescription}` : '',
    knowledge,
    req.benefits?.length    ? `Stated benefits: ${req.benefits.join('; ')}` : '',
    req.usps?.length        ? `USPs: ${req.usps.join('; ')}`              : '',
    `Language: ${LOCALE_LANG[req.locale]}`,
    `Tone: ${req.tone ?? 'confident-natural'}`,
    '',
    'STRICT JSON OUTPUT:',
    '{',
    '  "title": "<5-9 word headline matching the variant theme>",',
    `  "heroStat": ${heroExample},`,
    `  "bullets": [ ${bulletExample} ],`,
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
  return [
    'Generate CTA banner copy for this product.',
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    req.productDescription ? `Description: ${req.productDescription}` : '',
    knowledge,
    req.benefits?.length    ? `Benefits: ${req.benefits.join('; ')}` : '',
    req.offer               ? `Offer terms: ${req.offer}` : '',
    `Language: ${LOCALE_LANG[req.locale]}`,
    `Tone: ${req.tone ?? 'confident-natural'}`,
    '',
    'STRICT JSON OUTPUT:',
    '{',
    '  "headline": "<4-9 word attention line>",',
    '  "subheadline": "<6-12 word supporting hook>",',
    '  "offerLine": "<single benefit line, eg Tiết kiệm 30% — giao 24h>",',
    '  "ctaText": "<2-3 word action verb phrase>"',
    '}',
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
