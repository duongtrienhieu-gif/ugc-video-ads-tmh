import type { PresetSpec, LandingForm } from '../types'

// ─────────────────────────────────────────────────────────────────────
// Preset specs — định nghĩa CỐ ĐỊNH section + image cho mỗi preset.
//
// Pha 3: chỉ implement ugc-malaysia. 4 preset còn lại stub disabled.
// Sau khi anh test ugc-malaysia OK → bổ sung từng preset.
// ─────────────────────────────────────────────────────────────────────

const UGC_MALAYSIA_SPEC: PresetSpec = {
  id: 'ugc-malaysia',
  displayName: 'UGC Chuyển Đổi Nhanh',
  totalSections: 17,
  totalImages: 34,
  toneBrief:
    'High-conversion Malaysia ecommerce landing page. Sales psychology: ' +
    'AIDA + heavy social proof + scarcity. Native Malay tone, real-person UGC ' +
    'vibe (not corporate). Target: TikTok/FB Ads → COD checkout. Hook hard ' +
    'in first 3s, validate problem, present solution, prove with testimonials, ' +
    'close with urgency offer.',
  sections: [
    // 1. HERO — 2 ảnh, recipe A (UGC photo + big text overlay + decor badges)
    {
      type: 'hero',
      imageCount: 2,
      recipeId: 'A',
      aspectRatio: '4:5',
      productPolicy: 'required',
      textFields: { headline: true, subheadline: true, cta: true, offerStrip: true, urgencyText: true, bodyCopy: true },
    },

    // 2. PAIN — 5 ảnh, recipe A (photo + small italic Q overlay + glow accent)
    //    4-tier rule: ≥3 tier1, ≤1 tier3, 0 tier4
    {
      type: 'pain',
      imageCount: 5,
      recipeId: 'A',
      aspectRatio: '4:5',
      productPolicy: 'forbidden',
      textFields: { headline: true, bodyCopy: true, bullets: true },
      tierRules: {
        distribution: {
          tier1_primary:  { min: 3, max: 5 },
          tier2_axis:     { min: 0, max: 2 },
          tier3_loose:    { min: 0, max: 1 },
          tier4_offniche: { min: 0, max: 0 },
        },
      },
    },

    // 3. WHY-HAPPENS — 1 ảnh, recipe C (infographic illustration)
    {
      type: 'why-happens',
      imageCount: 1,
      recipeId: 'C',
      aspectRatio: '1:1',
      productPolicy: 'forbidden',
      textFields: { headline: true, bodyCopy: true },
    },

    // 4. FAILED-SOLUTIONS — 1 ảnh, recipe B (UGC photo sạch, KHÔNG có sản phẩm)
    {
      type: 'failed-solutions',
      imageCount: 1,
      recipeId: 'B',
      aspectRatio: '4:5',
      productPolicy: 'forbidden',
      textFields: { headline: true, bodyCopy: true, bullets: true },
    },

    // 5. PRODUCT-DISCOVERY — 1 ảnh, recipe B (UGC photo sạch, CÓ sản phẩm)
    {
      type: 'product-discovery',
      imageCount: 1,
      recipeId: 'B',
      aspectRatio: '4:5',
      productPolicy: 'required',
      textFields: { headline: true, subheadline: true, bodyCopy: true },
    },

    // 6. INGREDIENTS — 2 ảnh, recipe D (product showcase infographic)
    {
      type: 'ingredients',
      imageCount: 2,
      recipeId: 'D',
      aspectRatio: '1:1',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true, bullets: true },
    },

    // 7. MECHANISM — 1 ảnh, recipe C (science mechanism diagram, có sản phẩm)
    {
      type: 'mechanism',
      imageCount: 1,
      recipeId: 'C',
      aspectRatio: '1:1',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true },
    },

    // 8. BENEFITS — 1 ảnh, recipe D (benefit icon grid)
    {
      type: 'benefits',
      imageCount: 1,
      recipeId: 'D',
      aspectRatio: '1:1',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true, bullets: true },
    },

    // 9. COMPARISON — 1 ảnh, recipe E (comparison table)
    {
      type: 'comparison',
      imageCount: 1,
      recipeId: 'E',
      aspectRatio: '1:1',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true, comparisonData: true },
    },

    // 10. LIFESTYLE — 1 ảnh, recipe B (outdoor candid, KHÔNG sản phẩm)
    {
      type: 'lifestyle',
      imageCount: 1,
      recipeId: 'B',
      aspectRatio: '4:5',
      productPolicy: 'forbidden',
      textFields: { headline: true, bodyCopy: true },
    },

    // 11. SOCIAL-PROOF — 4 ảnh, recipe F (platform UI screenshots)
    {
      type: 'social-proof',
      imageCount: 4,
      recipeId: 'F',
      aspectRatio: '4:5',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true, reviews: true },
    },

    // 12. WHATSAPP-TESTIMONIALS — 4 ảnh, recipe F (WhatsApp chat screenshots)
    {
      type: 'whatsapp-testimonials',
      imageCount: 4,
      recipeId: 'F',
      aspectRatio: '4:5',
      productPolicy: 'required',
      textFields: { headline: true, bodyCopy: true },
    },

    // 13. NEWS-PROOF — 2 ảnh, recipe F (news article + authority screenshots)
    {
      type: 'news-proof',
      imageCount: 2,
      recipeId: 'F',
      aspectRatio: '4:5',
      productPolicy: 'forbidden',
      textFields: { headline: true, bodyCopy: true },
    },

    // 14. BEFORE-AFTER — 4 ảnh, recipe A (transformation collage)
    //    4-tier rule: ≥3 tier1, ≤1 tier2, 0 tier3/4 (TRÁNH lỗi weight-loss-for-gut)
    {
      type: 'before-after',
      imageCount: 4,
      recipeId: 'A',
      aspectRatio: '4:5',
      productPolicy: 'forbidden',
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

    // 15. FAQ — 0 ảnh, chỉ text
    {
      type: 'faq',
      imageCount: 0,
      recipeId: 'A', // không dùng — imageCount=0
      aspectRatio: '4:5',
      productPolicy: 'forbidden',
      textFields: { headline: true, bodyCopy: true, faqs: true },
    },

    // 16. OFFER — 2 ảnh, recipe G (promo banner 16:9)
    {
      type: 'offer',
      imageCount: 2,
      recipeId: 'G',
      aspectRatio: '16:9',
      productPolicy: 'required',
      textFields: { headline: true, cta: true, offerStrip: true, urgencyText: true, bullets: true },
    },

    // 17. FINAL-CTA — 2 ảnh, recipe G (banner + metric chips)
    {
      type: 'final-cta',
      imageCount: 2,
      recipeId: 'G',
      aspectRatio: '16:9',
      productPolicy: 'required',
      textFields: { headline: true, subheadline: true, cta: true, offerStrip: true, urgencyText: true, bodyCopy: true },
    },
  ],
}

/** Map từ LandingForm → PresetSpec.
 *  Phase 3: chỉ ugc-malaysia implement. */
export const PRESET_SPECS: Partial<Record<LandingForm, PresetSpec>> = {
  'ugc-malaysia': UGC_MALAYSIA_SPEC,
  // 4 preset sau sẽ thêm khi user gửi visual reference
  // 'advertorial':    ...,
  // 'chuyen-gia':     ...,
  // 'hard-sell-cod':  ...,
  // 'premium':        ...,
}

export function getPresetSpec(form: LandingForm): PresetSpec {
  const spec = PRESET_SPECS[form]
  if (!spec) {
    throw new Error(
      `Super Ladipage: preset "${form}" chưa được implement. ` +
      `Phase 3 hiện chỉ hỗ trợ "ugc-malaysia". ` +
      `Vui lòng chọn "UGC Chuyển Đổi Nhanh".`,
    )
  }
  return spec
}

export function isPresetAvailable(form: LandingForm): boolean {
  return PRESET_SPECS[form] !== undefined
}
