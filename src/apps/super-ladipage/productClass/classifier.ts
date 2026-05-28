// ─────────────────────────────────────────────────────────────────────
// Product Class — Gemini classifier (P-PRODUCT-CLASS, 2026-05-27)
//
// 1 Gemini call. Returns ProductRealityModel (7 axes filled).
// Falls back to safe defaults if classification fails.
//
// Output format: STRICT JSON. Each axis is one of finite enum values.
// Classifier reads product context (USP, benefits, mechanism, ingredients,
// price, form factor) — NOT just niche.
// ─────────────────────────────────────────────────────────────────────

import { textGenWithFallback } from '../services/textGenWithFallback'
import type {
  ProductRealityModel,
  ProductClassifierInput,
  ProductClassifierKeys,
  ProductForm,
  UsageMode,
  SensationTiming,
  DiscoveryContext,
  ImpulseType,
  MechanismFamily,
  PacingProfile,
} from './types'

// ─── Valid enum values (for strict parsing) ───────────────────────

const VALID = {
  productForm: ['oral-pill', 'oral-liquid', 'topical-cream', 'topical-spray', 'wearable-device', 'patch', 'tool', 'cosmetic'] as ProductForm[],
  usageMode: ['swallow', 'wear', 'apply', 'inhale', 'massage', 'use'] as UsageMode[],
  sensationTiming: ['immediate', 'fast', 'gradual', 'cumulative'] as SensationTiming[],
  discoveryContext: ['social-ads', 'tiktok-viral', 'friend-referral', 'pharmacy', 'doctor-clinic', 'self-research'] as DiscoveryContext[],
  impulseType: ['impulse-cod', 'considered', 'premium'] as ImpulseType[],
  mechanismFamily: ['physical-stabilization', 'wearable-support', 'mechanical-aid', 'oral-bioactive', 'topical-soothe', 'spray-relief', 'patch-delivery', 'biochemical-repair', 'cosmetic-aesthetic'] as MechanismFamily[],
  pacingProfile: ['fast-cod', 'medium-narrative', 'slow-burn'] as PacingProfile[],
}

// ─── Safe fallback (when classifier fails) ────────────────────────

const SAFE_FALLBACK: ProductRealityModel = {
  productForm: 'oral-pill',
  usageMode: 'swallow',
  sensationTiming: 'gradual',
  discoveryContext: 'social-ads',
  impulseType: 'impulse-cod',
  mechanismFamily: 'oral-bioactive',
  pacingProfile: 'medium-narrative',
  source: 'fallback',
}

// ─── Prompts ──────────────────────────────────────────────────────

const CLASSIFIER_SYSTEM = `You are a product reality classifier. Read product info and output STRICT JSON with 7 axis values + 1 rationale line.

OUTPUT ONLY VALID JSON. No prose, no markdown fences. All axis values MUST be from the allowed enums.`

function buildClassifierPrompt(input: ProductClassifierInput): string {
  return `Classify this product's REALITY across 7 axes. Output JSON only.

PRODUCT INFO:
- Name: ${input.productName || '(no name)'}
- Pain points: ${input.painPoints || '(none)'}
- Benefits: ${input.benefits || '(none)'}
- Unique selling points: ${input.uniqueSellingPoints || '(none)'}
- Offer / pricing: ${input.offerPricing || '(none)'}
- Category: ${input.category || '(none)'}

AXES + ALLOWED VALUES:

1. productForm — physical form factor of the product:
   - oral-pill: viên uống (pill, capsule, tablet)
   - oral-liquid: liquid drunk (siro, drink supplement)
   - topical-cream: cream/oil applied to skin
   - topical-spray: spray applied (nasal, skin, muscle)
   - wearable-device: brace/support worn on body (đai, nẹp, vớ y khoa, knee/back/wrist brace)
   - patch: adhesive patch stuck on skin
   - tool: device used externally (massager, posture corrector chair)
   - cosmetic: makeup / shampoo / aesthetic skincare

2. usageMode — how user uses it:
   swallow / wear / apply / inhale / massage / use

3. sensationTiming — when user feels effect:
   - immediate: tức thì khi dùng (đai → đeo vào là cảm thấy stable)
   - fast: vài phút-giờ (xịt mũi, dán giảm đau)
   - gradual: vài ngày-tuần (kem dưỡng)
   - cumulative: 2-4 tuần+ (supplement bổ sung, collagen)

4. discoveryContext — how reader discovers the product realistically:
   - social-ads: Facebook / Instagram ads
   - tiktok-viral: TikTok review / influencer
   - friend-referral: bạn bè / nhóm Zalo / WhatsApp
   - pharmacy: dược sĩ tại hiệu thuốc (only for OTC pills / standard supplements)
   - doctor-clinic: bác sĩ / clinic khuyên dùng (prescription / medical-grade)
   - self-research: tự research / đọc bài viết

5. impulseType — buying decision pattern:
   - impulse-cod: <RM100, COD impulse-buy, không cần suy nghĩ nhiều
   - considered: RM100-300, hỏi vợ/chồng, cần proof
   - premium: >RM300, cần đủ proof + warranty

6. mechanismFamily — HOW the product physically works:
   - physical-stabilization: đai/nẹp ổn định khớp bằng cấu trúc cơ học (lò xo, exoskeleton)
   - wearable-support: băng/vớ áp lực nhẹ
   - mechanical-aid: ghế chỉnh dáng / posture device
   - oral-bioactive: viên uống hoạt chất hấp thu qua tiêu hóa
   - topical-soothe: kem/dầu bôi làm dịu tại chỗ
   - spray-relief: xịt giảm tại chỗ
   - patch-delivery: miếng dán phóng thích qua da
   - biochemical-repair: bổ sung nguyên liệu để cơ thể tự sửa chữa (collagen / glucosamine / chondroitin)
   - cosmetic-aesthetic: thẩm mỹ bề mặt da/tóc

7. pacingProfile — landing page pacing strategy:
   - fast-cod: 6-8 sections, productReveal sớm, CTA dày (impulse COD products)
   - medium-narrative: 10-12 sections, productReveal mid (considered products)
   - slow-burn: 14-17 sections, productReveal trễ (premium / narrative-heavy)

CRITICAL RULES:
- KNEE BRACE / BACK BRACE / SUPPORT DEVICE: productForm=wearable-device, mechanism=physical-stabilization, timing=immediate, NOT oral-bioactive
- ORAL SUPPLEMENT (glucosamine, collagen, vitamin): productForm=oral-pill, mechanism=biochemical-repair OR oral-bioactive, timing=gradual/cumulative
- NASAL SPRAY: productForm=topical-spray, usageMode=inhale, mechanism=spray-relief, timing=fast
- TOPICAL CREAM (kem dưỡng da, dầu nóng): productForm=topical-cream, mechanism=topical-soothe, timing=gradual
- Pacing rule: COD products (<RM100) almost always fast-cod. Premium narrative products = slow-burn.

OUTPUT (strict JSON, no other text):
{
  "productForm": "<one of allowed>",
  "usageMode": "<one of allowed>",
  "sensationTiming": "<one of allowed>",
  "discoveryContext": "<one of allowed>",
  "impulseType": "<one of allowed>",
  "mechanismFamily": "<one of allowed>",
  "pacingProfile": "<one of allowed>",
  "rationale": "1-line explanation of key signals"
}`
}

// ─── Strict parser ────────────────────────────────────────────────

function parseClassifierOutput(raw: string): ProductRealityModel | null {
  // Strip markdown fences if present
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    console.warn(`[productClass/parse] JSON parse failed for: ${cleaned.slice(0, 100)}`)
    return null
  }

  // Strict axis-by-axis validation
  const productForm = parsed.productForm as string
  if (!VALID.productForm.includes(productForm as ProductForm)) {
    console.warn(`[productClass/parse] Invalid productForm: ${productForm}`)
    return null
  }
  const usageMode = parsed.usageMode as string
  if (!VALID.usageMode.includes(usageMode as UsageMode)) {
    console.warn(`[productClass/parse] Invalid usageMode: ${usageMode}`)
    return null
  }
  const sensationTiming = parsed.sensationTiming as string
  if (!VALID.sensationTiming.includes(sensationTiming as SensationTiming)) {
    console.warn(`[productClass/parse] Invalid sensationTiming: ${sensationTiming}`)
    return null
  }
  const discoveryContext = parsed.discoveryContext as string
  if (!VALID.discoveryContext.includes(discoveryContext as DiscoveryContext)) {
    console.warn(`[productClass/parse] Invalid discoveryContext: ${discoveryContext}`)
    return null
  }
  const impulseType = parsed.impulseType as string
  if (!VALID.impulseType.includes(impulseType as ImpulseType)) {
    console.warn(`[productClass/parse] Invalid impulseType: ${impulseType}`)
    return null
  }
  const mechanismFamily = parsed.mechanismFamily as string
  if (!VALID.mechanismFamily.includes(mechanismFamily as MechanismFamily)) {
    console.warn(`[productClass/parse] Invalid mechanismFamily: ${mechanismFamily}`)
    return null
  }
  const pacingProfile = parsed.pacingProfile as string
  if (!VALID.pacingProfile.includes(pacingProfile as PacingProfile)) {
    console.warn(`[productClass/parse] Invalid pacingProfile: ${pacingProfile}`)
    return null
  }

  return {
    productForm: productForm as ProductForm,
    usageMode: usageMode as UsageMode,
    sensationTiming: sensationTiming as SensationTiming,
    discoveryContext: discoveryContext as DiscoveryContext,
    impulseType: impulseType as ImpulseType,
    mechanismFamily: mechanismFamily as MechanismFamily,
    pacingProfile: pacingProfile as PacingProfile,
    source: 'gemini',
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 200) : undefined,
  }
}

// ─── Main entry ───────────────────────────────────────────────────

export async function classifyProductReality(
  input: ProductClassifierInput,
  keys: ProductClassifierKeys,
): Promise<ProductRealityModel> {
  if (!keys.geminiApiKey) {
    console.warn('[productClass] No Gemini key — using safe fallback')
    return SAFE_FALLBACK
  }

  try {
    const raw = await textGenWithFallback({
      geminiApiKey: keys.geminiApiKey,
      kieApiKey: keys.kieApiKey,
      prompt: buildClassifierPrompt(input),
      systemInstruction: CLASSIFIER_SYSTEM,
      jsonMode: true,
      maxOutputTokens: 400,
      timeoutMs: 20_000,
      label: 'product-class',
    })

    const result = parseClassifierOutput(raw)
    if (result) return result

    console.warn('[productClass] Classifier output invalid — using safe fallback')
    return SAFE_FALLBACK
  } catch (err) {
    console.warn('[productClass] Classifier call failed — using safe fallback:', err)
    return SAFE_FALLBACK
  }
}
