// ─────────────────────────────────────────────────────────────────────────
// services/forms/_types.ts — Phase 2 — FORM ENGINE CONTRACTS
//
// This file declares the interface every form module must implement. Phase
// 2 only adds these types + a registry + 5 stub modules — NO logic changes
// happen here. The current form-1 (UGC Malaysia) implementation lives
// unchanged in generateLandingPack.ts and is wrapped by the ugc-malaysia
// module via adapter.
//
// Phase 3 onward replaces the stub bodies of advertorial / chuyen-gia /
// hard-sell-cod / premium with real per-form engines. Each form picks its
// own section blueprint, system prompt, image strategy, CTA frequency,
// pacing — NO sharing of "default 17-section" logic.
// ─────────────────────────────────────────────────────────────────────────

import type {
  LandingForm, LandingGenParams, LandingPagePack, SectionType,
} from '../../types'

// ── Psychology + reading behavior config ───────────────────────────────────

export type ReadingBehavior =
  | 'scan-fast'         // UGC — scroll fast, social proof patches grab attention
  | 'deep-read'         // Storytelling — long-form narrative, reader invests
  | 'verify-trust'      // Expert — fact-check pacing, citations, mechanism
  | 'aspirational'      // Premium — slow browse, lifestyle gallery
  | 'impulse'           // Hard sell — short bursts, immediate CTA pressure

export type Pacing =
  | 'snappy'            // short paragraphs, mixed text/image
  | 'flowing'           // long paragraphs, story rhythm
  | 'methodical'        // structured, citation-heavy
  | 'punchy'            // 1-2 line bursts
  | 'whitespace-heavy'  // minimal text, big visuals

export type Density = 'low' | 'medium' | 'high' | 'very-high'

export interface PsychologyConfig {
  readingBehavior: ReadingBehavior
  pacing: Pacing
  /** Text content density per section average. */
  densityChu: Density
  /** Image count density per section average. */
  densityAnh: Density
}

// ── CTA strategy ──────────────────────────────────────────────────────────

export type CtaPlacement =
  | 'single-end'        // 1 CTA at the bottom only
  | 'every-2-sections'  // repeats every couple of sections
  | 'every-section'     // CTA in every section (hard sell)
  | 'sparse'            // few CTAs, well-spaced (premium)

export type CtaTone =
  | 'invitation'        // "Khám phá thêm" — soft invite
  | 'recommendation'    // "Bác sĩ khuyên dùng" — expert
  | 'urgency'           // "ORDER NGAY — STOK TERHAD"
  | 'soft'              // premium — minimal language

export interface CtaStrategy {
  placement: CtaPlacement
  tone: CtaTone
  /** Section types that should include a CTA chip/button. */
  ctaSections: SectionType[]
}

// ── Image strategy ────────────────────────────────────────────────────────

export type ImageOverallStyle =
  | 'ugc-mobile'              // phone UGC, imperfect, hand-held
  | 'cinematic-lifestyle'     // narrative, character-led, cinematic
  | 'editorial-infographic'   // expert mode, infographics, diagrams
  | 'cta-banner'              // hard-sell banners with text overlays
  | 'luxury-editorial'        // premium magazine photography

export interface ImageStrategy {
  overallStyle: ImageOverallStyle
  /** Per-form composition pool — overrides global pool from generateImages.ts. */
  compositionPool?: string[]
  /** Per-form background pool. */
  backgroundPool?: string[]
  /** Per-form negative-prompt block appended to every render. */
  negativePromptOverride?: string
  /** When true: lock 1 character identity across all people-shots in the
   *  pack (storytelling forms need this — a single hero character). */
  characterContinuity: boolean
  /** When true: allow studio / cinematic look (premium, expert). When
   *  false: force imperfect phone UGC quality. */
  allowStudioLook: boolean
  /** Per-section image count target. Maps SectionType → number. */
  imagesPerSection: Partial<Record<SectionType, number>>
}

// ── Form Blueprint Module — the main interface ───────────────────────────

export interface FormBlueprintModule {
  /** Canonical form id — must match a value in the LandingForm union. */
  formId: LandingForm

  /** UI label (Vietnamese first per master spec). */
  label: { vi: string; en: string }

  /** Short description shown under the form card in InputPanel (Vietnamese). */
  description: { vi: string }

  /** Long tooltip explaining when to use this form (Vietnamese). */
  tooltip: { vi: string }

  /** ORDERED list of section types this form produces. The output JSON
   *  sections[] array MUST contain exactly these types in this order. */
  sections: SectionType[]

  /** Psychology + reading config — drives prompt + UI density. */
  psychology: PsychologyConfig

  /** CTA strategy declaration. */
  cta: CtaStrategy

  /** Image strategy declaration. */
  imageStrategy: ImageStrategy

  /**
   * Main entry point — generate the LandingPagePack for this form using
   * the given params. Each form module owns its own Gemini prompt
   * construction, JSON parsing, and post-processing.
   *
   * Phase 2 contract: form 1 (ugc-malaysia) implements this with the
   * existing logic via adapter. Forms 2-5 delegate to ugc-malaysia.buildPack
   * temporarily — they will be replaced one by one in Phase 3-6.
   */
  buildPack(params: LandingGenParams): Promise<LandingPagePack>
}

// ── Helper: build a stub module that delegates to another module ─────────
// Used in Phase 2 so forms 2-5 share form-1's logic until their own
// engines are implemented in Phase 3-6.

export type FormResolver = () => Promise<FormBlueprintModule>
