// ─────────────────────────────────────────────────────────────────────────
// services/forms/ugc-malaysia.ts — Phase 2 — FORM 1 ADAPTER
//
// FROZEN module — wraps the existing form-1 implementation without
// changing behaviour. The actual generation logic still lives inside
// generateLandingPack.ts (the legacy entry was renamed to
// `legacyGenerateUgcMalaysiaPack` to make the boundary explicit).
//
// CRITICAL PROMISE: Phase 2 must produce BIT-IDENTICAL output for form 1
// users compared to before. Any change to this module should be considered
// a regression risk and gated on snapshot testing.
//
// Forms 2-5 currently DELEGATE to this module's buildPack via the stub
// pattern. Phase 3 onward they will get their own buildPack implementations
// and stop delegating.
// ─────────────────────────────────────────────────────────────────────────

import type { LandingGenParams, LandingPagePack, SectionType } from '../../types'
import type { FormBlueprintModule } from './_types'
import { legacyGenerateUgcMalaysiaPack } from '../generateLandingPack'

// Declared blueprint — read-only metadata for the registry / UI / image
// strategy resolver. Numbers below mirror the existing 17-section spec
// EXACTLY so no behavior change leaks through.

const SECTIONS: SectionType[] = [
  'hero', 'pain', 'why-happens', 'failed-solutions', 'product-discovery',
  'ingredients', 'mechanism', 'benefits', 'comparison', 'lifestyle',
  'social-proof', 'whatsapp-testimonials', 'news-proof', 'before-after',
  'faq', 'offer', 'final-cta',
]

export const module: FormBlueprintModule = {
  formId: 'ugc-malaysia',
  label: {
    vi: 'UGC Chuyển Đổi Nhanh',
    en: 'UGC Malaysia (default)',
  },
  description: {
    vi: 'Landing page tối ưu chuyển đổi bằng social proof, review, UGC và bố cục TikTok/Shopee style.',
  },
  tooltip: {
    vi: 'Form mặc định — 17 section chuẩn MY Ecommerce: hero + pain + social proof + WhatsApp + before/after + offer. Tỉ lệ chuyển đổi cao nhất cho FB Ads Malaysia.',
  },
  sections: SECTIONS,
  psychology: {
    readingBehavior: 'scan-fast',
    pacing: 'snappy',
    densityChu: 'medium',
    densityAnh: 'high',
  },
  cta: {
    placement: 'every-2-sections',
    tone: 'urgency',
    ctaSections: ['hero', 'social-proof', 'before-after', 'offer', 'final-cta'],
  },
  imageStrategy: {
    overallStyle: 'ugc-mobile',
    characterContinuity: false,
    allowStudioLook: false,
    imagesPerSection: {
      'hero': 2,
      'pain': 5,
      'social-proof': 5,
      'whatsapp-testimonials': 4,
      'news-proof': 2,
      'before-after': 4,
      'offer': 2,
      'final-cta': 2,
    },
  },

  // ── Adapter — delegates to the legacy implementation ─────────────────
  async buildPack(params: LandingGenParams): Promise<LandingPagePack> {
    // The legacy function in generateLandingPack.ts owns all the
    // existing Gemini prompt + JSON parsing + normalization logic.
    // This adapter is a passthrough to preserve exact behavior for
    // form 1 while opening up Phase 3-6 to add real per-form engines.
    return legacyGenerateUgcMalaysiaPack(params)
  },
}
