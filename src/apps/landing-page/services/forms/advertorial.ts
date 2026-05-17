// ─────────────────────────────────────────────────────────────────────────
// services/forms/advertorial.ts — Phase 2 STUB
//
// Kể Chuyện Hành Trình — storytelling / advertorial / review form.
//
// Phase 2: metadata declared, but buildPack() delegates to ugc-malaysia
// because the storytelling engine is not implemented yet. Phase 3 will
// replace buildPack with the real story-driven engine (long-form copy,
// character continuity, soft single-CTA, cinematic image strategy).
//
// User-visible behavior at end of Phase 2: picking this form still
// generates the form-1 output. This is intentional — it ships the
// infrastructure safely; Phase 3 swaps the body.
// ─────────────────────────────────────────────────────────────────────────

import type { LandingGenParams, LandingPagePack, SectionType } from '../../types'
import type { FormBlueprintModule } from './_types'
import { module as ugcMalaysia } from './ugc-malaysia'

// Storytelling blueprint — declared now so the registry + UI can preview
// the intended shape. Phase 3 will USE these values when implementing
// the real engine.
const STORYTELLING_SECTIONS: SectionType[] = [
  'hero',              // first-person editorial opener
  'pain',              // personal story, not bullets
  'failed-solutions',  // "I tried everything before…"
  'product-discovery', // discovery moment narrative
  'mechanism',         // doctor/expert explanation in prose
  'ingredients',       // ingredient breakdown integrated into story
  'benefits',          // personal results journey
  'social-proof',      // curated testimonials integrated into narrative
  'faq',               // reader Q&A style
  'final-cta',         // soft single CTA at the end
]

export const module: FormBlueprintModule = {
  formId: 'advertorial',
  label: {
    vi: 'Kể Chuyện Hành Trình',
    en: 'Storytelling Advertorial',
  },
  description: {
    vi: 'Landing page dạng kể chuyện của 1 nhân vật xuyên suốt từ vấn đề → gặp sản phẩm → thay đổi → giới thiệu người khác.',
  },
  tooltip: {
    vi: 'Phù hợp ngách y tế, sức khỏe, supplement cao cấp. Tone first-person, paragraph dài, build trust trước khi sell. Phase 2: stub — output tạm giống form mặc định.',
  },
  sections: STORYTELLING_SECTIONS,
  psychology: {
    readingBehavior: 'deep-read',
    pacing: 'flowing',
    densityChu: 'high',
    densityAnh: 'medium',
  },
  cta: {
    placement: 'single-end',
    tone: 'invitation',
    ctaSections: ['final-cta'],
  },
  imageStrategy: {
    overallStyle: 'cinematic-lifestyle',
    characterContinuity: true,  // one hero character across the journey
    allowStudioLook: false,
    imagesPerSection: {
      'hero': 1,
      'pain': 2,
      'failed-solutions': 1,
      'product-discovery': 1,
      'mechanism': 2,
      'ingredients': 2,
      'benefits': 2,
      'social-proof': 2,
      'final-cta': 1,
    },
  },

  // Phase 2 — delegate to form 1. Phase 3 will replace with real engine.
  async buildPack(params: LandingGenParams): Promise<LandingPagePack> {
    console.info('[FORM advertorial] Phase 2 stub — delegating to ugc-malaysia.buildPack')
    return ugcMalaysia.buildPack(params)
  },
}
