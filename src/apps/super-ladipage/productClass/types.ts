// ═════════════════════════════════════════════════════════════════════
// Product Class — type definitions (P-PRODUCT-CLASS, 2026-05-27)
//
// 7-axis product reality model. Sits BETWEEN niche detection and
// storytelling generation. Solves the "knee brace described as
// glucosamine pill" bug at architectural level — different sub-types
// within a niche get different pacing / discovery / mechanism / hero.
//
// LOCKED: 7 axes only. Each axis has finite enum values. Pure data.
// NO LLM prose injection at this layer. Classification is the ONLY LLM
// call; downstream consumption is library lookup.
// ═════════════════════════════════════════════════════════════════════

// ─── 7 axes (LOCKED — orthogonal product reality dimensions) ──────

export type ProductForm =
  | 'oral-pill'         // viên uống (pill / capsule)
  | 'oral-liquid'       // dạng uống lỏng / siro
  | 'topical-cream'     // kem bôi ngoài da
  | 'topical-spray'     // xịt (mũi / da / cơ)
  | 'wearable-device'   // đai / nẹp / vớ y khoa / brace (đeo ngoài)
  | 'patch'             // miếng dán
  | 'tool'              // dụng cụ trị liệu / máy massage
  | 'cosmetic'          // mỹ phẩm makeup / dầu gội

export type UsageMode =
  | 'swallow'           // nuốt
  | 'wear'              // đeo
  | 'apply'             // bôi / thoa
  | 'inhale'            // xịt / hít
  | 'massage'           // massage / vuốt
  | 'use'               // dùng / vận hành

export type SensationTiming =
  | 'immediate'         // tức thì khi dùng (đai → đeo vào là cảm thấy)
  | 'fast'              // vài giờ (xịt mũi, dán giảm đau)
  | 'gradual'           // vài ngày-tuần (kem dưỡng)
  | 'cumulative'        // 2-4 tuần+ (supplement, collagen)

export type DiscoveryContext =
  | 'social-ads'        // Facebook / Instagram ads
  | 'tiktok-viral'      // TikTok review / influencer
  | 'friend-referral'   // bạn bè / nhóm Zalo
  | 'pharmacy'          // dược sĩ tư vấn ở hiệu thuốc
  | 'doctor-clinic'     // bác sĩ / clinic khuyên
  | 'self-research'     // tự research bài viết

export type ImpulseType =
  | 'impulse-cod'       // COD impulse-buy (RM30-100, không cần suy nghĩ)
  | 'considered'        // có suy nghĩ (RM100-300, hỏi vợ/chồng)
  | 'premium'           // premium (>RM300, hỏi đủ proof)

export type MechanismFamily =
  | 'physical-stabilization'  // đai / nẹp / brace — hỗ trợ vật lý ổn định khớp
  | 'wearable-support'         // băng / vớ y khoa — hỗ trợ áp lực nhẹ
  | 'mechanical-aid'           // ghế chỉnh dáng / posture — cơ học chỉnh tư thế
  | 'oral-bioactive'           // viên uống hoạt chất → hấp thu qua tiêu hóa
  | 'topical-soothe'           // kem / dầu bôi → làm dịu tại chỗ
  | 'spray-relief'             // xịt giảm tại chỗ (mũi, cơ)
  | 'patch-delivery'           // miếng dán phóng thích hoạt chất qua da
  | 'biochemical-repair'       // bổ sung nguyên liệu cho cơ thể tự sửa chữa (collagen, glucosamine)
  | 'cosmetic-aesthetic'       // mỹ phẩm thẩm mỹ bề mặt

export type PacingProfile =
  | 'fast-cod'          // 6-8 sections, productReveal sớm (section 3-4), CTA dày
  | 'medium-narrative'  // 10-12 sections, productReveal mid (section 6-7), CTA mềm
  | 'slow-burn'         // 14-17 sections, productReveal trễ (section 8-9), narrative-heavy

// ─── ProductRealityModel — full reality vector ────────────────────

export interface ProductRealityModel {
  productForm: ProductForm
  usageMode: UsageMode
  sensationTiming: SensationTiming
  discoveryContext: DiscoveryContext
  impulseType: ImpulseType
  mechanismFamily: MechanismFamily
  pacingProfile: PacingProfile
  /** Source — where did this classification come from. */
  source: 'gemini' | 'fallback'
  /** Optional rationale from classifier (1-line, debug only — not injected into pack). */
  rationale?: string
}

// ─── Classifier input ─────────────────────────────────────────────

export interface ProductClassifierInput {
  productName: string
  painPoints?: string
  benefits?: string
  uniqueSellingPoints?: string
  offerPricing?: string
  category?: string
}

export interface ProductClassifierKeys {
  geminiApiKey: string
  kieApiKey: string
}
