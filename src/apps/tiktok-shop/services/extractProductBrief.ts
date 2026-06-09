// extractProductBrief — Phase 10 (Phase 10.1 refactor): Vision via Google direct.
//
// ONE upfront Gemini Vision call before description + image gen. Returns a
// structured TiktokShopProductBrief that:
//   - reads ACTUAL product label/packaging from reference photos
//   - infers target customer + core pain feelings
//   - commits to transformation promise + key differentiator
//   - lists ONLY ingredients visible on label (no fabrication)
//
// Routing: calls Google Gemini API DIRECTLY (directGeminiVision), bypassing
// kie.ai's /chat/completions endpoint which returns "Operation not found"
// for all our text/vision models. Image generation still uses kie.ai because
// the /gpt4o-image/generate endpoint works fine.
//
// Mirrors Super Ladipage's readProductImages + extractProductIdentity pattern.

import type { Market } from '../../../types/brandKit'
import type { Product } from '../../../stores/types'
import type { TiktokShopProductBrief } from '../types'
import { directGeminiVision } from '../../../utils/gemini'
import { getAsBase64 } from '../../../utils/assetStore'

export interface ExtractProductBriefParams {
  /** Google AI Studio API key (NOT kie.ai key — Gemini direct). */
  geminiApiKey: string
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
  if (!params.geminiApiKey?.trim()) {
    throw new Error('Cần Gemini API key trong Cài đặt để phân tích sản phẩm bằng Vision')
  }

  // Load ref images as inline base64 (Gemini Vision expects inlineData parts).
  const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = []
  for (const id of params.referenceImageAssetIds.slice(0, 5)) {
    try {
      const asset = await getAsBase64(id)
      if (asset) {
        imageParts.push({ inlineData: { mimeType: asset.mimeType, data: asset.base64 } })
      }
    } catch (err) {
      console.warn(`[extractProductBrief] Could not load asset ${id}:`, err)
    }
  }

  if (imageParts.length === 0) {
    throw new Error('Không đọc được ảnh tham chiếu nào để Vision phân tích')
  }

  const langName = params.language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'
  const systemPrompt = buildSystemPrompt(langName)
  const userPrompt = buildUserPrompt(params.product, langName)

  console.log(`[extractProductBrief] analyzing ${imageParts.length} refs via Gemini direct · product="${params.product.productName}"`)

  // directGeminiVision tries gemini-2.5-flash → flash-lite → 2.0-flash etc.
  // responseMimeType: 'application/json' forces valid JSON output.
  const raw = await directGeminiVision({
    apiKey: params.geminiApiKey,
    parts: [
      ...imageParts,
      { text: userPrompt },
    ],
    systemInstruction: systemPrompt,
    responseMimeType: 'application/json',
    maxOutputTokens: 4096,
  })

  const brief = parseAndValidate(raw, params.product, params.language)
  console.log(`[extractProductBrief] ✓ brief extracted · name="${brief.productNameExact}" · category="${brief.productCategory}" · ingredients=${brief.visibleIngredients.length}`)
  return brief
}

// ── System prompt ─────────────────────────────────────────────────────────

function buildSystemPrompt(langName: string): string {
  return `You are a product analyst for the TikTok Shop Malaysia/Vietnam market. Examine the provided product reference photos AND the product metadata, then output ONE strict JSON brief that downstream copywriters + image generators will use.

LANGUAGE for inferred text fields (corePains, transformationPromise, specificMetric, keyDifferentiator, usageContext, commonObjections, nicheSafeClaims, forbiddenClaims, targetCustomer.dailyContext): ${langName} ONLY.
LANGUAGE for factual fields (productNameExact, productCategory, productSubtype, packagingDescription, primaryColors, visibleIngredients): match what's printed on the label (usually English) — do NOT translate.

OUTPUT: strict JSON object only.

CRITICAL DATA INTEGRITY RULES:
1. productNameExact: read it EXACTLY from the product label as printed (preserve capitalization, brand mark like ®).
2. visibleIngredients: list ONLY ingredient names you can READ on the product label / packaging in the photos. If the label doesn't list ingredients, return [] (empty array). NEVER invent ingredient names from category assumption.
3. primaryColors: list visible packaging colors from the photos (hex codes preferred, color words OK).
4. specificMetric: a CONCRETE measurable outcome derived from product context (e.g. "DALAM 15 MINIT", "3× LEBIH LANCAR", "−2KG SEBULAN"). NOT vague superlatives.
5. corePains: customer self-questions ending '?', each max 12 words, customer-voice feelings.
6. forbiddenClaims: list claims that would be legally risky for this niche (Halal/KKM/GMP/FDA without proof, "rawat/sembuh/cure/treat", unverified efficacy statements).
7. nicheSafeClaims: 3-5 claims that are SAFE for this niche (soft "membantu/menyokong/hỗ trợ" framing, observable benefits).
8. keyFeatures (CRITICAL for slot 4 image — universal 3-5 product highlights): TYPE-ADAPTIVE: for TPCN / supplement list INGREDIENTS with %; for accessory / brace / massager list MATERIALS / COMPONENTS / TECHNOLOGIES; for device list FEATURES (waterproof rating, battery, sensor); for cosmetic list ACTIVE INGREDIENTS. Each item must be SOMETHING THAT EXISTS PHYSICALLY in / on the product and can be photographed as a real macro shot. NEVER abstract benefit claims like "natural", "premium quality", "effective". Examples:
   - Knee support brace → [{"name":"Lò xo thép cứng cáp","detail":"3X trợ lực","photoHint":"close-up of metal coil spring"},{"name":"Vải lưới thoáng khí","detail":"100% nylon","photoHint":"macro of breathable mesh fabric"},{"name":"Khoá Velcro Hàn Quốc","detail":"giữ chặt","photoHint":"close-up of velcro hook-loop"},{"name":"Đệm silicone êm","detail":"360°","photoHint":"silicone gel pad"},{"name":"Khung định hình 2 bên","detail":"chống xô","photoHint":"plastic lateral stabilizer rod"}]
   - Nasal spray → [{"name":"Muối biển sâu","detail":"0.9%","photoHint":"macro of sea salt crystals"},{"name":"Tinh dầu khuynh diệp","detail":"2%","photoHint":"eucalyptus leaf close-up"}, ...]
   - Smartwatch → [{"name":"Chống nước IP68","detail":"2m / 30 phút","photoHint":"watch submerged"},{"name":"Cảm biến nhịp tim","detail":"24/7","photoHint":"heart-rate sensor LED close-up"}, ...]
   Each name should be 2-5 words. detail is optional but adds credibility (% / measurement / origin). photoHint guides the image-gen toward the right macro shot.

9. applicationDetails (CRITICAL for image gen — see below): infer the SPECIFIC body zone, physical interaction, and usage scene from product type. This is what tells the image generator WHERE on the body the product goes. Examples:
   - Knee support brace → bodyZone="knee joint", howApplied="wrap around bent knee, secure velcro straps", usageScene="Person sitting on a couch with knee bent at 90°, both hands wrapping the brace around the knee joint, medium close-up on the knee"
   - Nasal spray → bodyZone="nostrils (inside nasal cavity)", howApplied="spray 1-2 puffs into each nostril, head tilted slightly back, breathe in gently", usageScene="Person standing in front of bathroom mirror, head tilted back slightly, spray nozzle inserted into one nostril, gentle pressing motion"
   - Face cream → bodyZone="facial skin (cheeks + forehead + chin)", howApplied="dot a pea-sized amount on cheeks/forehead/chin, massage in circular motion", usageScene="Person looking into mirror, fingertip dabbing cream on cheek, upward circular massage motion"
   - Hair growth oil → bodyZone="scalp (along hair partings)", howApplied="apply a few drops directly on the scalp, massage with fingertips for 1-2 minutes", usageScene="Person sitting in front of mirror, dropper applying oil to the scalp partings, fingertips massaging the scalp"
   - Oral supplement / tablet → bodyZone="(oral — swallowed, no body application)", howApplied="take 1-2 tablets with a glass of water after meal", usageScene="Person holding a tablet between fingers, a glass of water in the other hand, about to take it after a meal"
   - Toothpaste → bodyZone="teeth + gums", howApplied="brush teeth twice daily with a pea-sized amount", usageScene="Person standing in front of bathroom mirror, brushing teeth with a clean white toothbrush, foam visible"
   The usageScene line will be embedded VERBATIM into the image-gen prompt for slot 6 — make it concrete, single sentence, photo-direction quality.

IF a field cannot be determined from photos + metadata, write the most reasonable inference based on category — but flag uncertainty by using softer language. NEVER fabricate specific ingredient names, certifications, lab numbers, or clinical claims.`
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
  lines.push(`  "corePains": ["<customer self-question in ${langName} max 12 words>", "<...>", "<...>"],`)
  lines.push(`  "transformationPromise": "<what specifically changes after using, in ${langName}>",`)
  lines.push(`  "specificMetric": "<ALL CAPS measurable outcome, max 4 words, in ${langName}>",`)
  lines.push(`  "keyDifferentiator": "<specific edge vs generic alternative, in ${langName}>",`)
  lines.push(`  "usageContext": "<when/where used, in ${langName}>",`)
  lines.push(`  "commonObjections": ["<top buyer concern>", "<...>", "<...>"],`)
  lines.push(`  "nicheSafeClaims": ["<safe claim>", "...3-5 items"],`)
  lines.push(`  "forbiddenClaims": ["<claim to avoid>", "..."],`)
  lines.push(`  "applicationDetails": {`)
  lines.push(`    "bodyZone": "<SPECIFIC body part / surface the product touches — see system prompt examples. Always concrete (e.g., 'knee joint', 'nostrils', 'scalp', 'lips'), NOT vague ('body', 'skin')>",`)
  lines.push(`    "howApplied": "<concrete physical action — verb + amount + body zone + technique. In ${langName}.>",`)
  lines.push(`    "usageScene": "<ONE concrete photo-direction sentence: person + pose + action + camera angle. Used VERBATIM in image-gen prompt for slot 6. In ${langName}.>"`)
  lines.push(`  },`)
  lines.push(`  "keyFeatures": [`)
  lines.push(`    {"name": "<2-5 word physical feature/material/ingredient in ${langName}>", "detail": "<optional % or measurement>", "photoHint": "<short english macro-photo direction for image gen>"},`)
  lines.push(`    {"name": "...", "detail": "...", "photoHint": "..."}`)
  lines.push(`  ]`)
  lines.push(`}`)
  lines.push(``)
  lines.push(`IMPORTANT: keyFeatures must be PHYSICAL THINGS that exist on / in the product (materials, ingredients, components, technologies). NEVER abstract claims. Provide 3-5 items.`)
  return lines.join('\n')
}

// ── Parse & validate ─────────────────────────────────────────────────────

function parseAndValidate(
  raw: string,
  product: Product,
  language: Market,
): TiktokShopProductBrief {
  // Gemini with responseMimeType: 'application/json' usually returns clean JSON.
  // Still strip fences defensively in case the model wraps it.
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }

  try {
    const parsed = JSON.parse(cleaned) as Partial<TiktokShopProductBrief>
    return normalizeBrief(parsed, product, language)
  } catch (err) {
    console.warn('[extractProductBrief] JSON parse failed — using fallback', err, 'raw first 300:', raw.slice(0, 300))
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
  const ad = (r.applicationDetails ?? {}) as Record<string, unknown>

  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []

  return {
    productNameExact:      typeof r.productNameExact === 'string'      ? r.productNameExact      : fallback.productNameExact,
    productCategory:       typeof r.productCategory === 'string'       ? r.productCategory       : fallback.productCategory,
    productSubtype:        typeof r.productSubtype === 'string'        ? r.productSubtype        : fallback.productSubtype,
    packagingDescription:  typeof r.packagingDescription === 'string'  ? r.packagingDescription  : fallback.packagingDescription,
    primaryColors:         strArr(r.primaryColors).length > 0          ? strArr(r.primaryColors) : fallback.primaryColors,
    visibleIngredients:    strArr(r.visibleIngredients),  // [] is valid — don't fall back
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
    applicationDetails: {
      bodyZone:    typeof ad.bodyZone === 'string'    && (ad.bodyZone as string).trim().length > 0    ? (ad.bodyZone as string).trim()    : fallback.applicationDetails.bodyZone,
      howApplied:  typeof ad.howApplied === 'string'  && (ad.howApplied as string).trim().length > 0  ? (ad.howApplied as string).trim()  : fallback.applicationDetails.howApplied,
      usageScene:  typeof ad.usageScene === 'string'  && (ad.usageScene as string).trim().length > 0  ? (ad.usageScene as string).trim()  : fallback.applicationDetails.usageScene,
    },
    keyFeatures: extractKeyFeatures(r.keyFeatures, fallback),
  }
}

function extractKeyFeatures(raw: unknown, fallback: TiktokShopProductBrief): TiktokShopProductBrief['keyFeatures'] {
  if (!Array.isArray(raw)) return fallback.keyFeatures
  const out = (raw as unknown[])
    .map((x) => x as Record<string, unknown>)
    .filter((x) => typeof x.name === 'string' && (x.name as string).trim().length > 0)
    .map((x) => ({
      name:      (x.name as string).trim(),
      detail:    typeof x.detail === 'string' && (x.detail as string).trim().length > 0 ? (x.detail as string).trim() : undefined,
      photoHint: typeof x.photoHint === 'string' && (x.photoHint as string).trim().length > 0 ? (x.photoHint as string).trim() : undefined,
    }))
    .slice(0, 5)
  return out.length > 0 ? out : fallback.keyFeatures
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
    productSubtype:        'bottle',
    packagingDescription:  'product container as shown in reference photos',
    primaryColors:         ['#1E4D8C', '#FFFFFF'],
    visibleIngredients:    ings,
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
    applicationDetails: {
      bodyZone:   isMS ? 'kawasan sasaran pada badan' : 'vùng cơ thể cần chăm sóc',
      howApplied: isMS ? 'gunakan mengikut arahan pada label' : 'sử dụng theo hướng dẫn trên nhãn',
      usageScene: isMS
        ? 'Pengguna mengambil produk di rumah, demonstrasi cara guna yang ditunjukkan jelas, sudut kamera medium close-up'
        : 'Người dùng cầm sản phẩm tại nhà, thao tác sử dụng được thể hiện rõ ràng, góc máy medium close-up',
    },
    keyFeatures: ings.length > 0
      ? ings.slice(0, 5).map((name) => ({ name, photoHint: `macro photo of ${name}` }))
      : usps.slice(0, 5).map((name) => ({ name, photoHint: `commercial product detail shot of ${name}` })),
  }
}
