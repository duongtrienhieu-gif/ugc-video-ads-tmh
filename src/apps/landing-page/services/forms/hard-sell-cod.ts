// ─────────────────────────────────────────────────────────────────────────
// services/forms/hard-sell-cod.ts — Phase 2 STUB
//
// Chốt Đơn Mạnh — urgency-heavy COD conversion machine.
// Phase 2: metadata declared, buildPack() delegates to ugc-malaysia.
// Phase 5 replaces with the real hard-sell engine (repeated CTAs, urgency
// strips, scarcity messaging).
// ─────────────────────────────────────────────────────────────────────────

import type { LandingGenParams, LandingPagePack, SectionType } from '../../types'
import type { FormBlueprintModule } from './_types'
import { module as ugcMalaysia } from './ugc-malaysia'

const HARDSELL_SECTIONS: SectionType[] = [
  'hero',                  // massive hook with urgency
  'pain',                  // sharp emotional pain hits
  'failed-solutions',      // "everything else failed"
  'product-discovery',     // fast reveal
  'benefits',              // benefit bullets, no fluff
  'social-proof',          // mass-screenshot social proof
  'whatsapp-testimonials', // chat proof
  'before-after',          // dramatic transformation
  'offer',                 // value stack + COD emphasis
  'comparison',            // vs competitor table
  'faq',                   // objection crushing
  'final-cta',             // final hard CTA + countdown
]

export const module: FormBlueprintModule = {
  formId: 'hard-sell-cod',
  label: {
    vi: 'Chốt Đơn Mạnh',
    en: 'Hard Sell COD',
  },
  description: {
    vi: 'Landing page tối ưu chốt đơn nhanh bằng CTA dày, ưu đãi mạnh và bố cục scan tốc độ cao.',
  },
  tooltip: {
    vi: 'Urgency tối đa, scarcity, nhiều CTA. Tối ưu cho COD, budget thấp, niche tiêu dùng nhanh. Mục tiêu chốt đơn trong vòng 60 giây đọc trang. Phase 2: stub — output tạm giống form mặc định.',
  },
  sections: HARDSELL_SECTIONS,
  psychology: {
    readingBehavior: 'impulse',
    pacing: 'punchy',
    densityChu: 'high',
    densityAnh: 'very-high',
  },
  cta: {
    placement: 'every-section',
    tone: 'urgency',
    ctaSections: HARDSELL_SECTIONS,  // CTA chip in EVERY section
  },
  imageStrategy: {
    overallStyle: 'cta-banner',
    characterContinuity: false,
    allowStudioLook: false,
    imagesPerSection: {
      'hero': 2,
      'pain': 4,
      'social-proof': 5,
      'whatsapp-testimonials': 4,
      'before-after': 4,
      'offer': 2,
      'comparison': 1,
      'final-cta': 2,
    },
  },

  async buildPack(params: LandingGenParams): Promise<LandingPagePack> {
    console.info('[FORM hard-sell-cod] Phase 2 stub — delegating to ugc-malaysia.buildPack')
    return ugcMalaysia.buildPack(params)
  },
}
