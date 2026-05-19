// ── Template / Render Engine Registry (P29 — Phase 5) ──────────────────────
//
// Declarative spec — every creative type binds an engine + template +
// composition + locale + QC rule pack. Spec says (Phase 5 §14):
//
//   {
//     engine,           // which dispatcher routes the request
//     template,         // which renderer assembles the canvas
//     compositionRules, // how multi-asset composites are assembled
//     localeRules,      // language post-validation
//     qcRules           // pass / fail criteria
//   }
//
// This file does NOT replace the existing dispatch + render pipeline —
// the engines still own their render code. The registry exists so
// downstream tooling (debug UIs, analytics, future template-swapper)
// can introspect the per-creative wiring without grepping the engines.
//
// ARCHITECTURE BOUNDARY (Phase 5 §):
//   • Creative Studio = AI CREATIVE OPERATING SYSTEM
//   • Landing-page AI = LANDING PAGE GENERATION SYSTEM
//   • Templates here MUST NOT cross-import from src/apps/landing-page/*
//   • Stores, prompt blocks, render engines, QC pipelines stay separated

import type { AssetTypeId } from '../types/asset'
import type { EngineGroup } from '../types/engine'

/** Template kinds — what kind of canvas/composition the renderer
 *  produces. Used by tooling + analytics; the engine itself decides
 *  the actual implementation. */
export type TemplateKind =
  | 'whatsapp-chat'
  | 'messenger-chat'
  | 'facebook-comment-thread'
  | 'tiktok-comment-overlay'
  | 'shopee-review-card'
  | 'tiktok-shop-review-card'
  | 'infographic-stats'
  | 'infographic-ingredients'    // P27 roadmap
  | 'infographic-mechanism'      // P27 roadmap
  | 'infographic-timeline'       // P27 roadmap
  | 'cta-banner'
  | 'photographic-prompt'        // photographic engine — no canvas template
  | 'collage-grid'               // P27 roadmap
  | 'expert-card'                // P27 roadmap

/** Composition strategy — how the template assembles individual
 *  reference inputs. */
export type CompositionStrategy =
  | 'single-pass-prompt'         // photographic — one KIE call
  | 'structured-canvas-template' // ui-native — JSON → HTML/CSS → canvas
  | 'designed-canvas-template'   // designed-graphic — typography-first canvas
  | 'multi-asset-composite'      // collage — render N assets + assemble

/** QC rule set this template runs after render.
 *  See shared/qc for the actual validators. */
export interface TemplateQcRules {
  /** Run baseline QC (file size, dimensions, format) — every template. */
  baseline: true
  /** Run authenticity QC (crop drift / blur / chroma noise / JPEG recompress). */
  authenticity?: boolean
  /** Run locale text validator on Gemini-generated text fields. */
  localeText?: boolean
  /** Run vision-tier QC (Gemini Vision pass). Opt-in via runtime opts. */
  vision?: boolean
}

export interface TemplateRegistryEntry {
  id: AssetTypeId
  engine: EngineGroup
  template: TemplateKind
  composition: CompositionStrategy
  /** Whether locale post-validation runs on the LLM output. */
  localeValidation: boolean
  qcRules: TemplateQcRules
  /** P27 — true when the template hasn't shipped yet (ASSET_REGISTRY
   *  partial). UI surfaces "Sắp ra mắt" badge for these. */
  comingSoon?: boolean
}

/** Static map — every AssetTypeId declares its template binding. */
export const TEMPLATE_REGISTRY: Record<AssetTypeId, TemplateRegistryEntry> = {
  // ── photographic engine (KIE GPT-4o, single prompt) ─────────────────
  'product-shot':       { id: 'product-shot',       engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true, vision: true } },
  'ugc-selfie':         { id: 'ugc-selfie',         engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true } },
  'review-table':       { id: 'review-table',       engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true } },
  'holding-product':    { id: 'holding-product',    engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true } },
  'before-after':       { id: 'before-after',       engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true, vision: true } },
  'lifestyle-kitchen':  { id: 'lifestyle-kitchen',  engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true } },
  'bathroom-routine':   { id: 'bathroom-routine',   engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true } },
  'cafe-lifestyle':     { id: 'cafe-lifestyle',     engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true } },
  'ugc-tiktok':         { id: 'ugc-tiktok',         engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true } },

  // ── ui-native engine (Gemini JSON → canvas template) ────────────────
  'whatsapp-proof':     { id: 'whatsapp-proof',     engine: 'ui-native', template: 'whatsapp-chat',           composition: 'structured-canvas-template', localeValidation: true, qcRules: { baseline: true, authenticity: true, localeText: true } },
  'messenger-chat':     { id: 'messenger-chat',     engine: 'ui-native', template: 'messenger-chat',          composition: 'structured-canvas-template', localeValidation: true, qcRules: { baseline: true, authenticity: true, localeText: true } },
  'shopee-feedback':    { id: 'shopee-feedback',    engine: 'ui-native', template: 'shopee-review-card',      composition: 'structured-canvas-template', localeValidation: true, qcRules: { baseline: true, authenticity: true, localeText: true } },
  'tiktok-feedback':    { id: 'tiktok-feedback',    engine: 'ui-native', template: 'tiktok-shop-review-card', composition: 'structured-canvas-template', localeValidation: true, qcRules: { baseline: true, authenticity: true, localeText: true } },
  'facebook-comment':   { id: 'facebook-comment',   engine: 'ui-native', template: 'facebook-comment-thread', composition: 'structured-canvas-template', localeValidation: true, qcRules: { baseline: true, authenticity: true, localeText: true } },
  'tiktok-comment':     { id: 'tiktok-comment',     engine: 'ui-native', template: 'tiktok-comment-overlay',  composition: 'structured-canvas-template', localeValidation: true, qcRules: { baseline: true, authenticity: true, localeText: true } },

  // ── designed-graphic engine (Gemini JSON → typography canvas) ───────
  'infographic':        { id: 'infographic',        engine: 'designed-graphic', template: 'infographic-stats', composition: 'designed-canvas-template', localeValidation: true, qcRules: { baseline: true, localeText: true } },
  'cta-banner':         { id: 'cta-banner',         engine: 'designed-graphic', template: 'cta-banner',        composition: 'designed-canvas-template', localeValidation: true, qcRules: { baseline: true, localeText: true } },

  // ── P35 — formerly roadmap, now shipped ────────────────────────────
  'ingredients-explain':{ id: 'ingredients-explain',engine: 'designed-graphic', template: 'infographic-ingredients', composition: 'designed-canvas-template', localeValidation: true, qcRules: { baseline: true, localeText: true } },
  'mechanism-explain':  { id: 'mechanism-explain',  engine: 'designed-graphic', template: 'infographic-mechanism',   composition: 'designed-canvas-template', localeValidation: true, qcRules: { baseline: true, localeText: true } },
  'benefit-timeline':   { id: 'benefit-timeline',   engine: 'designed-graphic', template: 'infographic-timeline',    composition: 'designed-canvas-template', localeValidation: true, qcRules: { baseline: true, localeText: true } },
  'collage-4-frames':   { id: 'collage-4-frames',   engine: 'photographic',     template: 'collage-grid',            composition: 'single-pass-prompt',        localeValidation: false, qcRules: { baseline: true } },

  // ── P33 — Phase 3 pro-photo + UGC shipped ──────────────────────────
  'floating-product':       { id: 'floating-product',       engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true, vision: true } },
  'ingredient-composition': { id: 'ingredient-composition', engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true } },
  'group-holding':          { id: 'group-holding',          engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true } },
  'expert-kol':             { id: 'expert-kol',             engine: 'photographic', template: 'photographic-prompt', composition: 'single-pass-prompt', localeValidation: false, qcRules: { baseline: true } },
}

export function findTemplateBinding(id: AssetTypeId): TemplateRegistryEntry | null {
  return TEMPLATE_REGISTRY[id] ?? null
}

export function listTemplatesByKind(kind: TemplateKind): TemplateRegistryEntry[] {
  return Object.values(TEMPLATE_REGISTRY).filter((t) => t.template === kind)
}

export function listTemplatesByComposition(strategy: CompositionStrategy): TemplateRegistryEntry[] {
  return Object.values(TEMPLATE_REGISTRY).filter((t) => t.composition === strategy)
}
