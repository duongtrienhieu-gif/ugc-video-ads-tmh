// ─────────────────────────────────────────────────────────────────────────
// services/forms/premium.ts — Phase 2 STUB
//
// Thương Hiệu Cao Cấp — luxury / lifestyle / brand-first form.
// Phase 2: metadata declared, buildPack() delegates to ugc-malaysia.
// Phase 6 replaces with the real premium engine.
// ─────────────────────────────────────────────────────────────────────────

import type { LandingGenParams, LandingPagePack, SectionType } from '../../types'
import type { FormBlueprintModule } from './_types'
import { module as ugcMalaysia } from './ugc-malaysia'

const PREMIUM_SECTIONS: SectionType[] = [
  'hero',          // premium aspirational hero
  'pain',          // subtle problem framing (not panicky)
  'ingredients',   // ingredient showcase as quality story
  'mechanism',     // refined explanation, not technical spam
  'benefits',      // elegant benefit list
  'lifestyle',     // aspirational lifestyle moment
  'social-proof',  // curated tasteful testimonials only
  'final-cta',     // premium invitation CTA
]

export const module: FormBlueprintModule = {
  formId: 'premium',
  label: {
    vi: 'Thương Hiệu Cao Cấp',
    en: 'Premium Brand',
  },
  description: {
    vi: 'Landing page phong cách premium / lifestyle, tối giản và tập trung vào cảm giác thương hiệu.',
  },
  tooltip: {
    vi: 'Tone Apple/Dyson vibe — whitespace nhiều, ít urgency, ít emoji. Phù hợp skincare cao cấp, sản phẩm giá cao (>RM200). Phase 2: stub — output tạm giống form mặc định.',
  },
  sections: PREMIUM_SECTIONS,
  psychology: {
    readingBehavior: 'aspirational',
    pacing: 'whitespace-heavy',
    densityChu: 'low',
    densityAnh: 'medium',
  },
  cta: {
    placement: 'sparse',
    tone: 'soft',
    ctaSections: ['final-cta'],
  },
  imageStrategy: {
    overallStyle: 'luxury-editorial',
    characterContinuity: false,
    allowStudioLook: true,  // premium allows cinematic / studio look
    imagesPerSection: {
      'hero': 1,
      'ingredients': 3,
      'mechanism': 1,
      'benefits': 2,
      'lifestyle': 2,
      'social-proof': 2,
      'final-cta': 1,
    },
  },

  async buildPack(params: LandingGenParams): Promise<LandingPagePack> {
    console.info('[FORM premium] Phase 2 stub — delegating to ugc-malaysia.buildPack')
    return ugcMalaysia.buildPack(params)
  },
}
