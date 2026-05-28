// AI inference engine for Studio Brand Kit.
//
// Triết lý: user chỉ nhập 2 trường (Brand Name + Niche). AI suy luận
// MỌI THỨ khác — palette / typography / voice / tagline / badges / CTAs.
//
// Quy tắc bắt buộc (project memory):
//   • OUTPUT LANGUAGE: 1 ngôn ngữ duy nhất / generate (BM mặc định).
//   • Không hardcode pattern Pentavite — mỗi brand AI sinh phải khác.
//   • Trust badges + cultural rules MY-centric (Halal/JAKIM/KKM…).

import { directGeminiText, geminiImageGenerate } from '../../utils/gemini'
import { saveBase64Asset } from '../../utils/assetStore'
import {
  FONT_WHITELIST,
  type BrandCategory,
  type Market,
  type VoiceTone,
} from '../../types/brandKit'

// ── Shapes returned from one structured-JSON call ────────────────────────

export interface InferredBrandFields {
  palette: {
    primary: string
    secondary: string
    cta: string
    neutral: string
  }
  typography: {
    display: string                 // ∈ FONT_WHITELIST
    body: string                    // ∈ FONT_WHITELIST
  }
  voiceTone: VoiceTone
  tagline: string
  storeName: string
  samplePhrases: string[]           // 3 câu thoại
  ctaPhrases: string[]              // 3 câu CTA
  preferredVocabulary: string[]     // 5-8 từ key
  bannedVocabulary: string[]        // 3-5 từ tránh
  badgeNames: string[]              // 5-7 badge gợi ý
  flagOrigin: string                // ISO 2-letter (vd MY, AU, JP) — '' nếu khó suy luận
  logoConceptPrompts: string[]      // 3-5 prompt tả phong cách logo (cho mode AI gen)
}

const FONT_LIST_STRING = FONT_WHITELIST.join(', ')

// ── Niche guidance — fed vào prompt như ngữ cảnh, không phải template cứng ──

const NICHE_GUIDANCE: Record<BrandCategory, string> = {
  beauty:      'Beauty/Skincare → palette pink + rose gold / nude + cream / pastel. Typography: serif display (premium) hoặc rounded sans (friendly). Voice: premium hoặc playful. Badges thường có: Halal JAKIM, KKM, dermatology cert, cruelty-free.',
  supplement:  'Supplement/Health → palette blue + green / white + mint (trust + clean). Typography: clean sans (Inter, Manrope). Voice: clinical hoặc formal. Badges BẮT BUỘC: Halal JAKIM, KKM/MOH, GMP. Quan trọng: trust + clinical credibility.',
  tech:        'Tech/Electronics → palette dark + neon accent / minimal mono. Typography: geometric sans (Plus Jakarta Sans, Inter). Voice: formal hoặc gen-z. Badges: SIRIM, ISO, country-of-origin.',
  fashion:     'Fashion → palette brand-driven, thường monochrome + 1 accent. Typography: editorial serif hoặc bold display. Voice: premium hoặc playful. Badges: country-of-origin, material cert.',
  food:        'Food → palette warm tones (red/orange/yellow) hoặc fresh (green). Typography: friendly rounded (Nunito Sans, Poppins). Voice: casual hoặc playful. Badges BẮT BUỘC: Halal JAKIM. Có thể: KKM, HACCP.',
  home:        'Home/Gia dụng → palette earth tones / wood + cream. Typography: clean sans. Voice: casual hoặc premium. Badges: SIRIM, country-of-origin.',
  'mom-baby':  'Mẹ & Bé → palette pastel (mint/peach/lavender). Typography: rounded sans (Nunito Sans). Voice: friendly hoặc premium. Badges BẮT BUỘC: Halal JAKIM, KKM. Có thể: pediatric cert.',
  other:       'Brand đa năng → infer từ Brand Name là chính. Palette + voice phải phù hợp với cảm giác tên brand gợi ra.',
}

// ── Cultural rules — MY-centric ──────────────────────────────────────────

const MY_CULTURAL_RULES = `MALAYSIA MARKET RULES (rất quan trọng):
- Ưu tiên màu sạch: green / navy / gold / white. Tránh quá sặc sỡ.
- Imagery: modest. Không pig, không alcohol, không revealing.
- Halal mindset: nếu brand thuộc food/supplement/beauty, badges PHẢI include 'Halal JAKIM'.
- 'Ready Stock Malaysia' là badge phổ biến — gần như mọi niche.
- Country-of-origin flag: nếu brand gốc nước ngoài (AU/JP/KR/US), include.`

const VI_CULTURAL_RULES = `VIETNAM MARKET RULES:
- Palette ưu tiên warm + trustworthy: red / gold / cream / pastel.
- Badges phổ biến: QCVN, Bộ Y Tế, ISO. Halal không bắt buộc.
- Ưu tiên family-warm tone, ít cold-clinical.`

// ── Per-market language lock — repeat 3× theo memory rule ────────────────

function languageLockBlock(market: Market): string {
  if (market === 'ms') {
    return `OUTPUT LANGUAGE: Bahasa Malaysia ONLY. Do NOT mix English, Vietnamese, Chinese, or any other language. Every string field MUST be Bahasa Malaysia.
OUTPUT LANGUAGE: Bahasa Malaysia ONLY. Repeat — Bahasa Malaysia, không trộn ngôn ngữ.
OUTPUT LANGUAGE: Bahasa Malaysia ONLY. Bất kỳ tagline / samplePhrase / ctaPhrase / vocabulary nào phải hoàn toàn BM.
Exception: badgeNames giữ nguyên tên gốc (Halal JAKIM, SIRIM…). storeName có thể kết "Official Store" tiếng Anh nếu phù hợp brand quốc tế.`
  }
  return `OUTPUT LANGUAGE: Tiếng Việt ONLY. KHÔNG trộn tiếng Anh / Mã Lai / Trung. Mọi string field phải Tiếng Việt.
OUTPUT LANGUAGE: Tiếng Việt ONLY. Nhắc lại — Tiếng Việt, không trộn ngôn ngữ.
OUTPUT LANGUAGE: Tiếng Việt ONLY. tagline / samplePhrase / ctaPhrase / vocabulary đều Tiếng Việt thuần.
Exception: badgeNames giữ nguyên (QCVN, ISO…). storeName có thể "Official Store" nếu phù hợp.`
}

function buildSystemInstruction(market: Market): string {
  return `Bạn là brand strategist senior chuyên về TikTok Shop Đông Nam Á. Nhiệm vụ: từ Brand Name + Niche, suy luận một bộ brand identity hoàn chỉnh — palette, typography, voice tone, tagline, sample phrases, CTAs, trust badges, country-of-origin.

${languageLockBlock(market)}

Nguyên tắc:
1. KHÔNG generic. Phải phản ánh đúng cảm giác Brand Name + Niche cho ra. 2 brand khác Name nhưng cùng Niche phải có output KHÁC nhau rõ rệt.
2. Palette hex MUST valid 6-digit hex (#RRGGBB).
3. Typography display/body chỉ chọn từ danh sách: ${FONT_LIST_STRING}.
4. voiceTone chỉ ∈: formal | casual | playful | premium | clinical | gen-z.
5. flagOrigin: 2-letter ISO code (MY, VN, AU, JP, KR, US, FR, IT, DE…) — '' nếu khó suy luận.
6. tagline ≤ 8 từ.
7. samplePhrases: 3 câu, mỗi câu là 1 cách nhân vật UGC mô tả brand này.
8. ctaPhrases: 3 câu kêu gọi mua hàng tự nhiên cho TikTok Shop.
9. logoConceptPrompts: 3 prompt tả phong cách logo bằng tiếng ANH (vì sẽ feed vào image gen model) — mỗi prompt mô tả 1 hướng visual khác nhau (vd minimalist wordmark / abstract icon + text / playful illustration).
10. badgeNames: 5-7 badge phù hợp niche + market. Tên giữ nguyên (Halal JAKIM, SIRIM, KKM, "Ready Stock Malaysia", country flag…).

Trả về JSON STRICT theo schema. Không markdown, không giải thích.`
}

const RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    palette: {
      type: 'object',
      properties: {
        primary:   { type: 'string' },
        secondary: { type: 'string' },
        cta:       { type: 'string' },
        neutral:   { type: 'string' },
      },
      required: ['primary', 'secondary', 'cta', 'neutral'],
    },
    typography: {
      type: 'object',
      properties: {
        display: { type: 'string', enum: [...FONT_WHITELIST] },
        body:    { type: 'string', enum: [...FONT_WHITELIST] },
      },
      required: ['display', 'body'],
    },
    voiceTone: {
      type: 'string',
      enum: ['formal', 'casual', 'playful', 'premium', 'clinical', 'gen-z'],
    },
    tagline:             { type: 'string' },
    storeName:           { type: 'string' },
    samplePhrases:       { type: 'array', items: { type: 'string' } },
    ctaPhrases:          { type: 'array', items: { type: 'string' } },
    preferredVocabulary: { type: 'array', items: { type: 'string' } },
    bannedVocabulary:    { type: 'array', items: { type: 'string' } },
    badgeNames:          { type: 'array', items: { type: 'string' } },
    flagOrigin:          { type: 'string' },
    logoConceptPrompts:  { type: 'array', items: { type: 'string' } },
  },
  required: [
    'palette', 'typography', 'voiceTone', 'tagline', 'storeName',
    'samplePhrases', 'ctaPhrases', 'preferredVocabulary',
    'bannedVocabulary', 'badgeNames', 'flagOrigin', 'logoConceptPrompts',
  ],
}

// ── Public API ───────────────────────────────────────────────────────────

export async function inferBrandIdentity(params: {
  apiKey: string
  brandName: string
  category: BrandCategory
  market: Market                    // default 'ms'
  isExistingBrand: boolean
}): Promise<InferredBrandFields> {
  const { apiKey, brandName, category, market, isExistingBrand } = params

  const culturalBlock = market === 'ms' ? MY_CULTURAL_RULES : VI_CULTURAL_RULES
  const nicheBlock    = NICHE_GUIDANCE[category]

  const prompt = `BRAND NAME: ${brandName}
NICHE: ${category}
MARKET: ${market === 'ms' ? 'Malaysia (Bahasa Malaysia)' : 'Vietnam (Tiếng Việt)'}
EXISTING BRAND: ${isExistingBrand ? 'YES — user sẽ upload logo riêng, logoConceptPrompts vẫn cần (làm reference brand style)' : 'NO — AI sẽ generate logo concept'}

${culturalBlock}

NICHE GUIDANCE (gợi ý, KHÔNG phải template cứng — infer dựa Brand Name):
${nicheBlock}

Sinh JSON theo schema. Brand "${brandName}" phải có cá tính riêng — KHÔNG generic, không clone brand khác.`

  // Up to 2 attempts. Gemini's schema-constrained decoding eliminates most
  // malformed-JSON cases but ~2-5% slip through (truncation, unescaped
  // quotes/newlines inside string values). Retry once with lower temp +
  // larger token budget before surfacing to the user.
  const parsed = await callJsonWithRetry<InferredBrandFields>({
    apiKey,
    prompt,
    systemInstruction: buildSystemInstruction(market),
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.8,
    maxOutputTokens: 2048,
  })

  return sanitizeInferred(parsed, brandName)
}

// ── Per-field re-roll ────────────────────────────────────────────────────
// Re-generate just one slice while keeping the rest. Lighter call.

export type RerollField =
  | 'palette'
  | 'typography'
  | 'voiceTone'
  | 'tagline'
  | 'storeName'
  | 'samplePhrases'
  | 'ctaPhrases'
  | 'badgeNames'

export async function rerollField(params: {
  apiKey: string
  brandName: string
  category: BrandCategory
  market: Market
  field: RerollField
  current: InferredBrandFields      // ngữ cảnh — tránh re-roll trùng lặp
}): Promise<Partial<InferredBrandFields>> {
  const { apiKey, brandName, category, market, field, current } = params

  const culturalBlock = market === 'ms' ? MY_CULTURAL_RULES : VI_CULTURAL_RULES
  const nicheBlock    = NICHE_GUIDANCE[category]

  const fieldSpec = describeField(field)

  const prompt = `Re-roll field "${field}" cho brand:
- BRAND NAME: ${brandName}
- NICHE: ${category}
- MARKET: ${market === 'ms' ? 'Malaysia (BM)' : 'Vietnam (VN)'}
- Giá trị hiện tại của "${field}": ${JSON.stringify(currentValueOf(current, field))}

YÊU CẦU: tạo giá trị MỚI cho field này, KHÁC giá trị hiện tại, vẫn phù hợp brand + niche + market.

${culturalBlock}

${nicheBlock}

${fieldSpec}

Trả về JSON với CHỈ field "${field}" — không thêm field khác. Schema strict.`

  const fieldSchema: Record<string, unknown> = {
    type: 'object',
    properties: { [field]: (RESPONSE_SCHEMA.properties as Record<string, unknown>)[field] },
    required: [field],
  }

  const parsed = await callJsonWithRetry<Partial<InferredBrandFields>>({
    apiKey,
    prompt,
    systemInstruction: buildSystemInstruction(market),
    responseSchema: fieldSchema,
    temperature: 0.9,
    maxOutputTokens: 1024,
  })

  return sanitizeInferred({ ...current, ...parsed } as InferredBrandFields, brandName)
}

// ── JSON helpers — tolerate Gemini quirks ────────────────────────────────
//
// Gemini's schema-constrained decoding is good but not perfect. Failure
// modes we've seen:
//   • Markdown fences wrapping the JSON when the model falls back to a
//     non-structured response (rare, but possible on cold model routes).
//   • Truncation at maxOutputTokens — closing braces missing.
//   • Unescaped quotes/newlines inside string values when the model
//     re-enters greedy mode.
//
// Strategy: try strict JSON.parse first. On fail, strip markdown fences,
// then try slicing from first `{` to last `}`. Retry once at lower temp
// if still bad — temperature 0.2 usually produces clean JSON.

async function callJsonWithRetry<T>(params: {
  apiKey: string
  prompt: string
  systemInstruction: string
  responseSchema: Record<string, unknown>
  temperature: number
  maxOutputTokens: number
}): Promise<T> {
  const attempts: { temp: number; tokens: number }[] = [
    { temp: params.temperature, tokens: params.maxOutputTokens },
    { temp: 0.2, tokens: Math.max(params.maxOutputTokens, 3072) },
  ]
  let lastErr: Error | null = null
  for (const a of attempts) {
    try {
      const raw = await directGeminiText({
        apiKey: params.apiKey,
        prompt: params.prompt,
        systemInstruction: params.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: params.responseSchema,
        temperature: a.temp,
        maxOutputTokens: a.tokens,
      })
      return safeJsonParse<T>(raw)
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      console.warn('[StudioBrandKit] JSON attempt failed, will retry', lastErr.message)
    }
  }
  throw lastErr ?? new Error('Gemini trả JSON không hợp lệ — vui lòng thử lại.')
}

function safeJsonParse<T>(raw: string): T {
  // Quick path
  try { return JSON.parse(raw) as T } catch { /* fall through */ }

  // Strip markdown fences ` ```json ... ``` `
  let cleaned = raw.trim()
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) cleaned = fence[1].trim()

  try { return JSON.parse(cleaned) as T } catch { /* fall through */ }

  // Slice between first `{` and last `}`
  const first = cleaned.indexOf('{')
  const last  = cleaned.lastIndexOf('}')
  if (first !== -1 && last > first) {
    const sliced = cleaned.slice(first, last + 1)
    try { return JSON.parse(sliced) as T } catch { /* fall through */ }
  }

  // Last resort: throw with a sample of what we got so user can report
  const preview = raw.slice(0, 300).replace(/\s+/g, ' ')
  throw new Error(`Gemini trả JSON sai cú pháp. Preview: ${preview}…`)
}

function describeField(field: RerollField): string {
  switch (field) {
    case 'palette':       return 'Tạo palette 4 màu mới (primary/secondary/cta/neutral), hex valid, phối khác với hiện tại.'
    case 'typography':    return `Chọn cặp display+body MỚI từ: ${FONT_LIST_STRING}.`
    case 'voiceTone':     return 'Chọn voiceTone khác (formal/casual/playful/premium/clinical/gen-z).'
    case 'tagline':       return 'Tagline mới ≤ 8 từ, khác hoàn toàn câu hiện tại, vẫn ngôn ngữ output đúng.'
    case 'storeName':     return 'storeName mới (vd thêm "Official Store" / "Authentic" / "Premium").'
    case 'samplePhrases': return '3 câu thoại UGC mới — góc nhìn người dùng, conversational, không quảng cáo.'
    case 'ctaPhrases':    return '3 câu CTA mua hàng mới, đa dạng (urgency / value / trust).'
    case 'badgeNames':    return '5-7 badge MỚI hoặc tổ hợp khác — phù hợp niche + market.'
  }
}

function currentValueOf(current: InferredBrandFields, field: RerollField): unknown {
  return (current as unknown as Record<string, unknown>)[field]
}

// ── Logo generation ──────────────────────────────────────────────────────

export interface LogoConcept {
  prompt: string
  assetId: string                   // đã upload xong vào asset store
  blobUrl: string                   // signed URL để preview
}

/**
 * Generate logo concepts via image-gen model.
 *
 * IMPORTANT: image generation routes through kie.ai (`geminiImageGenerate`
 * → `kieGenerateImage`), so this needs the KIE API key (Bearer token),
 * NOT the Gemini API key used by `inferBrandIdentity`.
 *
 * Returns 3 concepts mặc định — UI cho user pick 1.
 * Mỗi concept dùng 1 prompt khác nhau (đã infer ở step 1).
 */
export async function generateLogoConcepts(params: {
  kieApiKey: string                  // ← kie.ai Bearer token, NOT Gemini key
  brandName: string
  category: BrandCategory
  palette: InferredBrandFields['palette']
  conceptPrompts: string[]           // từ inferBrandIdentity().logoConceptPrompts
  count?: number                     // default 3
}): Promise<LogoConcept[]> {
  const { kieApiKey, brandName, category, palette, conceptPrompts } = params
  const count = Math.min(params.count ?? 3, conceptPrompts.length)

  const tasks = conceptPrompts.slice(0, count).map(async (basePrompt) => {
    const fullPrompt = composeLogoPrompt({ brandName, category, palette, basePrompt })
    // kie/nano-banana only accepts 9:16 or 16:9 — pick portrait so the
    // brand wordmark + supporting elements have vertical room.
    const result = await geminiImageGenerate(kieApiKey, fullPrompt, '9:16')
    const assetId = await saveBase64Asset(result.base64, result.mimeType)
    const { getUrl } = await import('../../utils/assetStore')
    const blobUrl = (await getUrl(assetId)) ?? ''
    return { prompt: basePrompt, assetId, blobUrl }
  })

  return Promise.all(tasks)
}

function composeLogoPrompt(params: {
  brandName: string
  category: BrandCategory
  palette: InferredBrandFields['palette']
  basePrompt: string
}): string {
  const { brandName, palette, basePrompt } = params
  return `Logo for brand "${brandName}". ${basePrompt}
Color palette: primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.cta}.
Style: professional, modern, vector-style, flat, clean. Centered composition on pure white background.
The brand name "${brandName}" must be spelled correctly and readable. No watermark, no signature, no extra text.
Output: clean logo only, white background, no decorative elements outside the logo mark.`
}

// ── Sanitization — guard against AI returning out-of-whitelist fonts ─────

function sanitizeInferred(raw: InferredBrandFields, brandName: string): InferredBrandFields {
  const fonts = FONT_WHITELIST as readonly string[]
  return {
    ...raw,
    palette: {
      primary:   normalizeHex(raw.palette?.primary,   '#1B2A4E'),
      secondary: normalizeHex(raw.palette?.secondary, '#F5F5F0'),
      cta:       normalizeHex(raw.palette?.cta,       '#E0A458'),
      neutral:   normalizeHex(raw.palette?.neutral,   '#FFFFFF'),
    },
    typography: {
      display: fonts.includes(raw.typography?.display) ? raw.typography.display : 'Plus Jakarta Sans',
      body:    fonts.includes(raw.typography?.body)    ? raw.typography.body    : 'Inter',
    },
    voiceTone: VALID_TONES.includes(raw.voiceTone) ? raw.voiceTone : 'casual',
    tagline:           (raw.tagline ?? '').trim(),
    storeName:         (raw.storeName ?? `${brandName} Official Store`).trim(),
    samplePhrases:     Array.isArray(raw.samplePhrases) ? raw.samplePhrases.slice(0, 5) : [],
    ctaPhrases:        Array.isArray(raw.ctaPhrases) ? raw.ctaPhrases.slice(0, 5) : [],
    preferredVocabulary: Array.isArray(raw.preferredVocabulary) ? raw.preferredVocabulary.slice(0, 12) : [],
    bannedVocabulary:    Array.isArray(raw.bannedVocabulary) ? raw.bannedVocabulary.slice(0, 8) : [],
    badgeNames:        Array.isArray(raw.badgeNames) ? raw.badgeNames.slice(0, 8) : [],
    flagOrigin:        (raw.flagOrigin ?? '').trim().slice(0, 2).toUpperCase(),
    logoConceptPrompts: Array.isArray(raw.logoConceptPrompts) ? raw.logoConceptPrompts.slice(0, 5) : [],
  }
}

const VALID_TONES: VoiceTone[] = ['formal', 'casual', 'playful', 'premium', 'clinical', 'gen-z']

function normalizeHex(input: string | undefined, fallback: string): string {
  if (!input) return fallback
  const trimmed = input.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toUpperCase()
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.toUpperCase()}`
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const r = trimmed[1], g = trimmed[2], b = trimmed[3]
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return fallback
}

// ── Helper for UI: generate a placeholder text-badge PNG ─────────────────
// Trust badges từ AI chỉ có tên — ta render thành PNG pill đơn giản
// (white pill + brand-primary border + label) để satisfy data contract.

export async function renderBadgePng(params: {
  label: string
  primaryColor: string
}): Promise<{ base64: string; mimeType: string }> {
  const { label, primaryColor } = params
  const padding = 32
  const fontSize = 36
  // Approx character width — DM Sans medium
  const approxCharW = fontSize * 0.55
  const textWidth = Math.ceil(label.length * approxCharW)
  const width = textWidth + padding * 2
  const height = fontSize + padding

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // Background pill
  const radius = height / 2
  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, 0, 0, width, height, radius)
  ctx.fill()

  // Border
  ctx.strokeStyle = primaryColor
  ctx.lineWidth = 3
  roundRect(ctx, 1.5, 1.5, width - 3, height - 3, radius - 1.5)
  ctx.stroke()

  // Label
  ctx.fillStyle = primaryColor
  ctx.font = `600 ${fontSize}px "DM Sans", "Inter", sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(label, width / 2, height / 2)

  const dataUrl = canvas.toDataURL('image/png')
  const base64 = dataUrl.split(',')[1]
  return { base64, mimeType: 'image/png' }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
