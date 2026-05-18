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
import { directGeminiText } from '../../../../utils/gemini'

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

function buildInfographicPrompt(req: ContentRequest): string {
  return [
    'Generate infographic copy for this product.',
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    req.productDescription ? `Description: ${req.productDescription}` : '',
    req.benefits?.length    ? `Stated benefits: ${req.benefits.join('; ')}` : '',
    req.usps?.length        ? `USPs: ${req.usps.join('; ')}`              : '',
    `Language: ${LOCALE_LANG[req.locale]}`,
    `Tone: ${req.tone ?? 'confident-natural'}`,
    '',
    'STRICT JSON OUTPUT:',
    '{',
    '  "title": "<5-9 word headline>",',
    '  "heroStat": { "value": "47", "unit": "%", "label": "improvement after 2 weeks" },',
    '  "bullets": [ "<short benefit 1>", "<short benefit 2>", "<short benefit 3>", "<short benefit 4>" ],',
    '  "footnote": "<one-line disclaimer or claim source>"',
    '}',
    '',
    'Rules:',
    '- heroStat.value: a number, can include a sign (eg "+47", "-3").',
    '- heroStat.unit: short suffix ("%", "x", "days", "kg"). Pick what fits.',
    '- heroStat.label: 3-7 words describing what the number means.',
    '- bullets: 3-5 items, each 4-9 words. Pure benefit claims.',
    '- footnote: 6-14 words. Source / timeframe / methodology hint.',
  ].filter(Boolean).join('\n')
}

function buildCtaPrompt(req: ContentRequest): string {
  return [
    'Generate CTA banner copy for this product.',
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    req.productDescription ? `Description: ${req.productDescription}` : '',
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

function stripFence(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
}

export async function generateInfographicContent(
  apiKey: string,
  req: ContentRequest,
): Promise<InfographicContent> {
  const raw = await directGeminiText({
    apiKey,
    prompt: buildInfographicPrompt(req),
    systemInstruction: INFO_SYSTEM_INSTRUCTION,
    maxOutputTokens: 1024,
  })
  let parsed: InfographicContent
  try {
    parsed = JSON.parse(stripFence(raw).trim()) as InfographicContent
  } catch (err) {
    throw new Error(`[designed-graphic infographic] JSON parse failed: ${(err as Error).message}`)
  }
  if (!parsed.title || !parsed.heroStat || !Array.isArray(parsed.bullets)) {
    throw new Error('[designed-graphic infographic] missing required fields')
  }
  return parsed
}

export async function generateCtaBannerContent(
  apiKey: string,
  req: ContentRequest,
): Promise<CtaBannerContent> {
  const raw = await directGeminiText({
    apiKey,
    prompt: buildCtaPrompt(req),
    systemInstruction: CTA_SYSTEM_INSTRUCTION,
    maxOutputTokens: 512,
  })
  let parsed: CtaBannerContent
  try {
    parsed = JSON.parse(stripFence(raw).trim()) as CtaBannerContent
  } catch (err) {
    throw new Error(`[designed-graphic cta] JSON parse failed: ${(err as Error).message}`)
  }
  if (!parsed.headline || !parsed.ctaText) {
    throw new Error('[designed-graphic cta] missing required fields')
  }
  return parsed
}
