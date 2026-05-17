// ─────────────────────────────────────────────────────────────────────────
// services/forms/chuyen-gia.ts — Phase 2 STUB (NEW FORM)
//
// Chuyên Gia / Khoa Học — credibility-led / scientific / mechanism form.
// Phase 2: metadata declared, buildPack() delegates to ugc-malaysia.
// Phase 4 replaces with the real expert engine (doctor visuals,
// infographic mechanism diagrams, citations, case studies).
//
// This is a NEW form added in Phase 2 — did not exist before. The UI
// option ships in Phase 2 but acts like form 1 until Phase 4.
// ─────────────────────────────────────────────────────────────────────────

import type { LandingGenParams, LandingPagePack, SectionType } from '../../types'
import type { FormBlueprintModule } from './_types'
import { module as ugcMalaysia } from './ugc-malaysia'

const EXPERT_SECTIONS: SectionType[] = [
  'hero',              // doctor / expert credibility hero
  'why-happens',       // scientific cause explanation
  'mechanism',         // detailed mechanism with diagram
  'ingredients',       // ingredient cards with research notes
  'comparison',        // clinical comparison vs alternatives
  'benefits',          // evidence-backed benefits
  'social-proof',      // credentialed testimonials
  'news-proof',        // media / journal mentions
  'faq',               // myth-busting / clarifications
  'final-cta',         // recommendation-style CTA
]

export const module: FormBlueprintModule = {
  formId: 'chuyen-gia',
  label: {
    vi: 'Chuyên Gia / Khoa Học',
    en: 'Expert / Scientific',
  },
  description: {
    vi: 'Landing page xây dựng niềm tin bằng chuyên gia, cơ chế sản phẩm, nghiên cứu và case study.',
  },
  tooltip: {
    vi: 'Phù hợp niche medical / supplement / health tech. Tone giáo dục, fact-heavy, infographic. CTA dạng "bác sĩ khuyên dùng". Phase 2: stub — output tạm giống form mặc định.',
  },
  sections: EXPERT_SECTIONS,
  psychology: {
    readingBehavior: 'verify-trust',
    pacing: 'methodical',
    densityChu: 'high',
    densityAnh: 'medium',
  },
  cta: {
    placement: 'sparse',
    tone: 'recommendation',
    ctaSections: ['mechanism', 'final-cta'],
  },
  imageStrategy: {
    overallStyle: 'editorial-infographic',
    characterContinuity: false,
    allowStudioLook: true,
    imagesPerSection: {
      'hero': 1,
      'why-happens': 2,
      'mechanism': 3,
      'ingredients': 4,
      'comparison': 1,
      'benefits': 2,
      'social-proof': 2,
      'news-proof': 2,
      'final-cta': 1,
    },
  },

  async buildPack(params: LandingGenParams): Promise<LandingPagePack> {
    console.info('[FORM chuyen-gia] Phase 2 stub — delegating to ugc-malaysia.buildPack')
    return ugcMalaysia.buildPack(params)
  },
}
