import type { PresetSpec, LandingForm } from '../types'

// ─────────────────────────────────────────────────────────────────────
// Preset specs — Phase 4 rewrite.
//
// User feedback driven changes (17 section):
//   - Reorder: final-cta (was 17, social-proof banner) → vị trí 2
//   - Reorder: news-proof (was 13, warning/fear) → vị trí 6
//   - Replace lifestyle (pos 10) → expert-kol (vị trí 12 mới)
//   - hero: 2→1 ảnh, bỏ price khỏi text overlay
//   - pain: 5→6 ảnh, 4:5→1:1
//   - product-discovery: thêm text overlay + trust icons (như hero)
//   - ingredients: 2→1 ảnh
//   - news-proof: tone trust → warning/scare
//   - social-proof: 4→6 ảnh
//   - before-after: outfit khác + tên/tuổi/thời gian + Malay Muslim lock
//   - faq: bilingual VN
//   - offer: 2→1 ảnh
//   - final-cta (giờ pos 2): 2→1 ảnh, 16:9→1:1, social proof banner style
// ─────────────────────────────────────────────────────────────────────

const UGC_MALAYSIA_SPEC: PresetSpec = {
  id: 'ugc-malaysia',
  displayName: 'UGC Chuyển Đổi Nhanh',
  totalSections: 17,
  totalImages: 34,
  toneBrief:
    'High-conversion Malaysia ecommerce landing page. Sales flow: ' +
    'Hook → INSTANT TRUST (social proof banner) → Pain → Education → ' +
    'Failed solutions → FEAR (news warning) → Solution → Proof stack → ' +
    'Conversion. Tone: tâm sự "bạn / chúng tôi", chia sẻ thấu hiểu, ' +
    'KHÔNG hardsell ngôn từ trung tính. Native Malay tone, real-person ' +
    'UGC vibe (không corporate). Target: TikTok/FB Ads → COD checkout.',
  sections: [
    // ═══════════════════════════════════════════════════════════════
    // 1. HERO — 1 ảnh (giảm từ 2), 4:5, recipe A
    //    Bỏ giá khỏi text overlay (giá đã chuyển sang section 2 + 17)
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'hero',
      imageCount: 1,
      recipeId: 'A',
      aspectRatio: '4:5',
      productPolicy: 'required',
      textFields: { headline: true, subheadline: true, cta: true, offerStrip: true, urgencyText: true, bodyCopy: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 2. SOCIAL PROOF BANNER (was final-cta pos 17) — 1 ảnh, 1:1, recipe G/social-proof
    //    Đẩy trust signal lên đầu sau hero
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'final-cta',
      imageCount: 1,
      recipeId: 'G',
      aspectRatio: '1:1',
      productPolicy: 'required',
      textFields: { headline: true, subheadline: true, cta: true, offerStrip: true, bodyCopy: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 3. PAIN — 6 ảnh (tăng từ 5), 1:1 (đổi từ 4:5), recipe A
    //    4-tier rule: ≥4 tier1, ≤1 tier3, 0 tier4
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'pain',
      imageCount: 6,
      recipeId: 'A',
      aspectRatio: '1:1',
      productPolicy: 'forbidden',
      textFields: { headline: true, bodyCopy: true, bullets: true },
      tierRules: {
        distribution: {
          tier1_primary:  { min: 4, max: 6 },
          tier2_axis:     { min: 0, max: 2 },
          tier3_loose:    { min: 0, max: 1 },
          tier4_offniche: { min: 0, max: 0 },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // 4. WHY-HAPPENS — 1 ảnh, 1:1, recipe C
    //    Copy phải list 4-6 nguyên nhân cụ thể có icon prefix
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'why-happens',
      imageCount: 1,
      recipeId: 'C',
      aspectRatio: '1:1',
      productPolicy: 'forbidden',
      textFields: { headline: true, bodyCopy: true, bullets: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 5. FAILED-SOLUTIONS — 1 ảnh, 4:5, recipe B
    //    Lock Malay Muslim hijab woman (fix lỗi AI ra đàn ông châu Âu)
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'failed-solutions',
      imageCount: 1,
      recipeId: 'B',
      aspectRatio: '4:5',
      productPolicy: 'forbidden',
      textFields: { headline: true, bodyCopy: true, bullets: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 6. NEWS-PROOF (WARNING) — 2 ảnh, 4:5, recipe F/warning-news
    //    Đổi tone từ "trust authority" → "warning/fear-mongering"
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'news-proof',
      imageCount: 2,
      recipeId: 'F',
      aspectRatio: '4:5',
      productPolicy: 'forbidden',
      textFields: { headline: true, bodyCopy: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 7. PRODUCT-DISCOVERY — 1 ảnh, 4:5, recipe A (đổi từ B!)
    //    User yêu cầu: hijab + text overlay (giống hero) + trust icons KKM/best seller
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'product-discovery',
      imageCount: 1,
      recipeId: 'A',
      aspectRatio: '4:5',
      productPolicy: 'required',
      textFields: { headline: true, subheadline: true, cta: true, bodyCopy: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 8. INGREDIENTS — 1 ảnh (giảm từ 2), 4:5 (đổi từ 1:1 theo user), recipe D
    //    Show ĐẦY ĐỦ thành phần khớp text
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'ingredients',
      imageCount: 1,
      recipeId: 'D',
      aspectRatio: '4:5',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true, bullets: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 9. MECHANISM — 1 ảnh, 1:1, recipe C (giữ nguyên)
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'mechanism',
      imageCount: 1,
      recipeId: 'C',
      aspectRatio: '1:1',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 10. BENEFITS — 1 ảnh, 1:1, recipe D (giữ nguyên)
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'benefits',
      imageCount: 1,
      recipeId: 'D',
      aspectRatio: '1:1',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true, bullets: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 11. COMPARISON — 1 ảnh, 4:5 (đổi từ 1:1 theo user), recipe E
    //    Visual premium hơn (recipe E updated)
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'comparison',
      imageCount: 1,
      recipeId: 'E',
      aspectRatio: '4:5',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true, comparisonData: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 12. EXPERT + KOL ENDORSEMENT (NEW — thay lifestyle pos 10) —
    //     2 ảnh, 1:1, recipe H (NEW)
    //     Ảnh 1: chuyên gia (tên + ngành + năm KN + quote box)
    //     Ảnh 2: KOL Malaysia (tên + followers + quote box)
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'expert-kol',
      imageCount: 2,
      recipeId: 'H',
      aspectRatio: '1:1',
      productPolicy: 'forbidden',
      textFields: { headline: true, bodyCopy: true, reviews: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 13. SOCIAL-PROOF — 6 ảnh (tăng từ 4), 4:5, recipe F
    //     Mix: FB / TikTok / Shopee / Muslim selfie / group photo / collage
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'social-proof',
      imageCount: 6,
      recipeId: 'F',
      aspectRatio: '4:5',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true, reviews: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 14. WHATSAPP — 4 ảnh, 4:5, recipe F/whatsapp
    //     Mix vibe khác nhau (1-1 chat, group chat đông, selfie + chat...)
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'whatsapp-testimonials',
      imageCount: 4,
      recipeId: 'F',
      aspectRatio: '4:5',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 15. BEFORE-AFTER — 4 ảnh, 4:5, recipe A
    //     Outfit khác + tên + tuổi + thời gian sử dụng overlay
    //     Lock Malay Muslim hijab / Malay male
    //     4-tier rule: ≥3 tier1, ≤1 tier2, 0 tier3/4
    //
    //     2026-05-20 BUGFIX: productPolicy 'forbidden' → 'required' vì
    //     AFTER half MUST show product (person holding bottle confident).
    //     'forbidden' route → gpt-image-2 silent-ignores filesUrl → KIE
    //     render WRONG/INVENTED bottle (user observed across all 4 ảnh).
    //     'required' route → gpt-4o-image i2i với reference → product
    //     identity locked correctly.
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'before-after',
      imageCount: 4,
      recipeId: 'A',
      aspectRatio: '4:5',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true },
      tierRules: {
        distribution: {
          tier1_primary:  { min: 3, max: 4 },
          tier2_axis:     { min: 0, max: 1 },
          tier3_loose:    { min: 0, max: 0 },
          tier4_offniche: { min: 0, max: 0 },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // 16. FAQ — 0 ảnh, có bilingual VN toggle cho mỗi Q&A
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'faq',
      imageCount: 0,
      recipeId: 'A',
      aspectRatio: '4:5',
      productPolicy: 'forbidden',
      textFields: { headline: true, bodyCopy: true, faqs: true },
    },

    // ═══════════════════════════════════════════════════════════════
    // 17. OFFER — 2 ảnh, recipe G mixed variants:
    //   offer_01.jpg — 16:9 promo banner (recipeVariant="promo")
    //   offer_02.jpg — 9:16 combo vertical (recipeVariant="combo-vertical")
    // Section aspect mặc định 16:9; offer_02 override sang 9:16 trong R9 §17.
    // ═══════════════════════════════════════════════════════════════
    {
      type: 'offer',
      imageCount: 2,
      recipeId: 'G',
      aspectRatio: '16:9',
      productPolicy: 'required',
      textFields: { headline: true, cta: true, offerStrip: true, urgencyText: true, bullets: true },
    },
  ],
}

/** Map từ LandingForm → PresetSpec.
 *  Phase 3-4: chỉ ugc-malaysia implement. */
export const PRESET_SPECS: Partial<Record<LandingForm, PresetSpec>> = {
  'ugc-malaysia': UGC_MALAYSIA_SPEC,
}

export function getPresetSpec(form: LandingForm): PresetSpec {
  const spec = PRESET_SPECS[form]
  if (!spec) {
    throw new Error(
      `Super Ladipage: preset "${form}" chưa được implement. ` +
      `Hiện chỉ hỗ trợ "ugc-malaysia". ` +
      `Vui lòng chọn "UGC Chuyển Đổi Nhanh".`,
    )
  }
  return spec
}

export function isPresetAvailable(form: LandingForm): boolean {
  return PRESET_SPECS[form] !== undefined
}
