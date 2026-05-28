// extractProductBrief — Phase 10: Vision-based product analysis.
//
// ONE upfront kie.ai Vision call (~3-5 credits, ~5s) before description +
// image gen. Returns a structured TiktokShopProductBrief that:
//   - reads ACTUAL product label/packaging from reference photos
//   - infers target customer + core pain feelings
//   - commits to transformation promise + key differentiator
//   - lists ONLY ingredients visible on label (no fabrication)
//
// Result flows as READ-ONLY context into generateDescription + all 9
// generateSlot calls + combo gen → unifies product understanding across
// every output. Mirrors Super Ladipage's extractProductIdentity pattern.

import type { Market } from '../../../types/brandKit'
import type { Product } from '../../../stores/types'
import type { TiktokShopProductBrief } from '../types'
import { kieAnalyzeImage } from '../../../utils/kieai'
import { getUrl } from '../../../utils/assetStore'

export interface ExtractProductBriefParams {
  apiKey: string
  product: Product
  referenceImageAssetIds: string[]
  language: Market
}

/** Build a stable cache key for a (product, refs) pair. When this changes,
 *  the cached brief is invalidated. */
export function buildBriefCacheKey(productId: string, refIds: string[]): string {
  return `${productId}::${[...refIds].sort().join(',')}`
}

export async function extractProductBrief(
  params: ExtractProductBriefParams,
): Promise<TiktokShopProductBrief> {
  const refUrls = await resolveReferenceUrls(params.referenceImageAssetIds)
  if (refUrls.length === 0) {
    throw new Error('Cần ít nhất 1 ảnh tham chiếu sản phẩm để phân tích')
  }

  const langName = params.language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'
  const systemPrompt = buildSystemPrompt(langName)
  const userPrompt = buildUserPrompt(params.product, langName)

  console.log(`[extractProductBrief] analyzing ${refUrls.length} refs · product="${params.product.productName}"`)

  // kieAnalyzeImage signature: (apiKey, imageBase64, mimeType, prompt, systemInstruction?, imageUrls?)
  // When imageUrls is provided, imageBase64+mimeType are unused (the function builds
  // vision content from urls instead of inline base64).
  const raw = await kieAnalyzeImage(
    params.apiKey,
    '',
    'image/jpeg',
    userPrompt,
    systemPrompt,
    refUrls,
  )

  const brief = parseAndValidate(raw, params.product, params.language)
  console.log(`[extractProductBrief] ✓ brief extracted · name="${brief.productNameExact}" · category="${brief.productCategory}" · ingredients=${brief.visibleIngredients.length}`)
  return brief
}

// ── System prompt ─────────────────────────────────────────────────────────

function buildSystemPrompt(langName: string): string {
  return `You are a product analyst for the TikTok Shop Malaysia/Vietnam market. Your job: examine the provided product reference photos AND the product metadata, then output ONE strict JSON brief that downstream copywriters + image generators will use.

LANGUAGE for inferred text fields (corePains, transformationPromise, specificMetric, keyDifferentiator, usageContext, commonObjections, nicheSafeClaims, forbiddenClaims, targetCustomer.dailyContext): ${langName} ONLY.
LANGUAGE for factual fields (productNameExact, productCategory, productSubtype, packagingDescription, primaryColors, visibleIngredients): match what's printed on the label (usually English) — do NOT translate.

OUTPUT: strict JSON object only. No markdown fences, no preamble, no text after the closing brace.

CRITICAL DATA INTEGRITY RULES:
1. productNameExact: read it EXACTLY from the product label as printed (preserve capitalization, brand mark like ®).
2. visibleIngredients: list ONLY ingredient names you can READ on the product label / packaging in the photos. If the label doesn't list ingredients, return [] (empty array). NEVER invent ingredient names from category assumption.
3. primaryColors: list visible packaging colors from the photos (hex codes preferred, color words OK).
4. specificMetric: a CONCRETE measurable outcome derived from product context (e.g. "DALAM 15 MINIT", "3× LEBIH LANCAR", "−2KG SEBULAN"). NOT vague superlatives like "HASIL TERBAIK".
5. corePains: write as customer self-questions ending '?', each max 12 words, customer-voice feelings (not clinical descriptions).
6. forbiddenClaims: list claims that would be legally risky for this niche (cert claims like Halal/KKM/GMP/FDA without proof, strong clinical claims like "rawat/sembuh/cure/treat", unverified efficacy statements).
7. nicheSafeClaims: list 3-5 claims that are SAFE for this niche (soft "membantu/menyokong/hỗ trợ" framing, observable benefits, comfort/feel improvements).

IF a field cannot be determined from photos + metadata, write the most reasonable inference based on category — but flag uncertainty by using safer/softer language. NEVER fabricate specific ingredient names, certifications, lab numbers, or clinical claims.`
}

// ── User prompt ──────────────────────────────────────────────────────────

function buildUserPrompt(product: Product, langName: string): string {
  const lines: string[] = [
    `Analyze the product shown in the reference photos and return the JSON brief.`,
    ``,
    `PRODUCT METADATA (provided by seller — combine with what you see in photos):`,
    `- Name: ${product.productName}`,
  ]
  if (product.productDescription) lines.push(`- Description: ${product.productDescription}`)
  if (product.painPoints)         lines.push(`- Pain points seller mentioned: ${product.painPoints}`)
  if (product.usps)               lines.push(`- USPs / differentiators: ${product.usps}`)
  if (product.benefits)           lines.push(`- Benefits: ${product.benefits}`)
  if (product.ingredients)        lines.push(`- Ingredients (seller-provided): ${product.ingredients}`)
  if (product.offer)              lines.push(`- Pricing context: ${product.offer}`)

  lines.push(``)
  lines.push(`JSON SHAPE (return EXACTLY this, all inferred text fields in ${langName}):`)
  lines.push(`{`)
  lines.push(`  "productNameExact": "<from label as printed>",`)
  lines.push(`  "productCategory": "<plain English category e.g. 'Nasal Care Spray'>",`)
  lines.push(`  "productSubtype": "<form factor: bottle/jar/tube/tablet/patch/sachet/etc>",`)
  lines.push(`  "packagingDescription": "<short visual description for image consistency, max 30 words>",`)
  lines.push(`  "primaryColors": ["<hex or color name>", "..."],`)
  lines.push(`  "visibleIngredients": ["<ONLY from label, [] if not listed>", "..."],`)
  lines.push(`  "targetCustomer": {`)
  lines.push(`    "ageRange": "<e.g. '25-45'>",`)
  lines.push(`    "primaryGender": "<female|male|mixed>",`)
  lines.push(`    "dailyContext": "<who they are + daily life context in ${langName}, 1-2 sentences>"`)
  lines.push(`  },`)
  lines.push(`  "corePains": [`)
  lines.push(`    "<customer self-question ending '?', max 12 words, in ${langName}>",`)
  lines.push(`    "<another pain question>",`)
  lines.push(`    "<another pain question>"`)
  lines.push(`  ],`)
  lines.push(`  "transformationPromise": "<what specifically changes after using, in ${langName}>",`)
  lines.push(`  "specificMetric": "<ALL CAPS measurable outcome, max 4 words, in ${langName}>",`)
  lines.push(`  "keyDifferentiator": "<specific edge vs generic alternative, in ${langName}>",`)
  lines.push(`  "usageContext": "<when/where used, in ${langName}>",`)
  lines.push(`  "commonObjections": [`)
  lines.push(`    "<top buyer concern in ${langName}>",`)
  lines.push(`    "<another concern>",`)
  lines.push(`    "<another concern>"`)
  lines.push(`  ],`)
  lines.push(`  "nicheSafeClaims": ["<safe claim in ${langName}>", "...3-5 items"],`)
  lines.push(`  "forbiddenClaims": ["<claim to avoid for this niche>", "..."]`)
  lines.push(`}`)
  lines.push(``)
  lines.push(`Return ONLY the JSON object.`)
  return lines.join('\n')
}

// ── Parse & validate ─────────────────────────────────────────────────────

function parseAndValidate(
  raw: string,
  product: Product,
  language: Market,
): TiktokShopProductBrief {
  const json = extractJsonObject(raw)
  if (!json) {
    console.warn('[extractProductBrief] could not extract JSON — using fallback brief. Raw first 500 chars:', raw.slice(0, 500))
    return buildFallbackBrief(product, language)
  }

  try {
    const parsed = JSON.parse(json) as Partial<TiktokShopProductBrief>
    return normalizeBrief(parsed, product, language)
  } catch (err) {
    console.warn('[extractProductBrief] JSON parse failed — using fallback', err)
    return buildFallbackBrief(product, language)
  }
}

function normalizeBrief(
  raw: Partial<TiktokShopProductBrief>,
  product: Product,
  language: Market,
): TiktokShopProductBrief {
  const fallback = buildFallbackBrief(product, language)
  const r = raw as Record<string, unknown>
  const tc = (r.targetCustomer ?? {}) as Record<string, unknown>

  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []

  return {
    productNameExact:      typeof r.productNameExact === 'string'      ? r.productNameExact      : fallback.productNameExact,
    productCategory:       typeof r.productCategory === 'string'       ? r.productCategory       : fallback.productCategory,
    productSubtype:        typeof r.productSubtype === 'string'        ? r.productSubtype        : fallback.productSubtype,
    packagingDescription:  typeof r.packagingDescription === 'string'  ? r.packagingDescription  : fallback.packagingDescription,
    primaryColors:         strArr(r.primaryColors).length > 0          ? strArr(r.primaryColors) : fallback.primaryColors,
    visibleIngredients:    strArr(r.visibleIngredients),  // [] is valid — don't fall back (would invite fabrication)
    targetCustomer: {
      ageRange:      typeof tc.ageRange === 'string'      ? (tc.ageRange as string)      : fallback.targetCustomer.ageRange,
      primaryGender: (tc.primaryGender === 'female' || tc.primaryGender === 'male' || tc.primaryGender === 'mixed')
                        ? (tc.primaryGender as 'female' | 'male' | 'mixed')
                        : fallback.targetCustomer.primaryGender,
      dailyContext:  typeof tc.dailyContext === 'string'  ? (tc.dailyContext as string)  : fallback.targetCustomer.dailyContext,
    },
    corePains:             strArr(r.corePains).length >= 1             ? strArr(r.corePains).slice(0, 5) : fallback.corePains,
    transformationPromise: typeof r.transformationPromise === 'string' ? r.transformationPromise : fallback.transformationPromise,
    specificMetric:        typeof r.specificMetric === 'string'        ? r.specificMetric        : fallback.specificMetric,
    keyDifferentiator:     typeof r.keyDifferentiator === 'string'     ? r.keyDifferentiator     : fallback.keyDifferentiator,
    usageContext:          typeof r.usageContext === 'string'          ? r.usageContext          : fallback.usageContext,
    commonObjections:      strArr(r.commonObjections).length >= 1      ? strArr(r.commonObjections).slice(0, 5) : fallback.commonObjections,
    nicheSafeClaims:       strArr(r.nicheSafeClaims).length >= 1       ? strArr(r.nicheSafeClaims).slice(0, 8)  : fallback.nicheSafeClaims,
    forbiddenClaims:       strArr(r.forbiddenClaims).length >= 1       ? strArr(r.forbiddenClaims).slice(0, 8)  : fallback.forbiddenClaims,
  }
}

/** Conservative fallback when Vision fails. Derives from raw product fields. */
function buildFallbackBrief(product: Product, language: Market): TiktokShopProductBrief {
  const isMS = language === 'ms'
  const usps = (product.usps || '').split(/[\n,;.]/).map((s) => s.trim()).filter(Boolean)
  const pains = (product.painPoints || '').split(/[\n;.]|•/).map((s) => s.trim()).filter(Boolean)
  const benefits = (product.benefits || '').split(/[\n,;.]/).map((s) => s.trim()).filter(Boolean)
  const ings = (product.ingredients || '').split(/[\n,;]/).map((s) => s.trim()).filter(Boolean)

  return {
    productNameExact:      product.productName || 'Product',
    productCategory:       product.productName || 'Health Product',
    productSubtype:        'bottle',  // safe default for most TPCN/personal care
    packagingDescription:  'product container as shown in reference photos',
    primaryColors:         ['#1E4D8C', '#FFFFFF'],
    visibleIngredients:    ings,  // from seller field (may be empty)
    targetCustomer: {
      ageRange:      '25-45',
      primaryGender: 'mixed',
      dailyContext:  isMS ? 'Pengguna umum yang mencari penyelesaian berkualiti' : 'Người dùng phổ thông tìm giải pháp chất lượng',
    },
    corePains:             pains.length >= 1 ? pains.slice(0, 3) : (isMS
      ? ['Mencari penyelesaian berkualiti?', 'Tidak puas hati dengan produk biasa?', 'Mahu hasil yang lebih baik?']
      : ['Đang tìm giải pháp chất lượng?', 'Không hài lòng với sản phẩm thông thường?', 'Muốn kết quả tốt hơn?']),
    transformationPromise: benefits[0] || (isMS ? 'Membantu memenuhi keperluan pengguna' : 'Hỗ trợ đáp ứng nhu cầu người dùng'),
    specificMetric:        isMS ? 'HASIL JELAS' : 'KẾT QUẢ RÕ RỆT',
    keyDifferentiator:     usps[0] || (isMS ? 'Kualiti dibuktikan' : 'Chất lượng đã được kiểm chứng'),
    usageContext:          isMS ? 'Sesuai untuk kegunaan harian' : 'Phù hợp cho sử dụng hằng ngày',
    commonObjections:      isMS
      ? ['Adakah produk ini selamat?', 'Bila nampak hasil?', 'Boleh pulangkan jika tidak puas hati?']
      : ['Sản phẩm này có an toàn không?', 'Khi nào thấy kết quả?', 'Có chính sách đổi trả không?'],
    nicheSafeClaims:       isMS
      ? ['membantu', 'menyokong', 'lembut digunakan', 'sesuai untuk kegunaan harian']
      : ['hỗ trợ', 'an toàn', 'phù hợp sử dụng hằng ngày', 'lành tính'],
    forbiddenClaims:       isMS
      ? ['rawat', 'sembuh', 'cure', 'treat', 'Halal JAKIM (tanpa sijil)', 'KKM lulus (tanpa bukti)']
      : ['chữa khỏi', 'điều trị', 'BYT cấp phép (chưa có)', 'lâm sàng (chưa kiểm chứng)'],
  }
}

// Models occasionally wrap JSON in ```json fences or add commentary.
// Extract the first balanced JSON object from the response.
function extractJsonObject(raw: string): string | null {
  const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escapeNext = false

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (escapeNext) { escapeNext = false; continue }
    if (ch === '\\') { escapeNext = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return cleaned.slice(start, i + 1)
    }
  }
  return null
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function resolveReferenceUrls(assetIds: string[]): Promise<string[]> {
  const urls: string[] = []
  for (const id of assetIds.slice(0, 5)) {
    try {
      const url = await getUrl(id)
      if (url) urls.push(url)
    } catch { /* silent skip */ }
  }
  return urls
}
