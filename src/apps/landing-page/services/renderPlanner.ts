// ── renderPlanner.ts — Phase 1 SCAFFOLDING ─────────────────────────────────
//
// Pure classifier that walks a LandingPagePack and assigns a RenderStrategy
// to every ImagePrompt. NO side effects. NO API calls. NO state mutation.
//
// In Phase 1 this file is exported but NOT WIRED into the generation flow.
// generateImages.ts still does its legacy full-AI render for every asset.
// Phase 5 will plug planner output into the generation path behind the
// ENABLE_HYBRID_RENDER feature flag.
//
// Classification logic mirrors ARCHITECTURE_DIFF_PLAN.md → Section 2 (asset
// breakdown by section). The function is also defensive: when a filename or
// style hint doesn't match any known template, the fallback is always
// 'ai_full_render' (the safe, expensive, legacy path).

import type {
  ImagePrompt,
  LandingPagePack,
  LandingSection,
  RenderStrategy,
  CompositionConfig,
} from '../types'

// ── Per-asset classification result ────────────────────────────────────────

export interface AssetPlan {
  sectionIdx: number
  imageIdx: number
  filename: string
  style: string
  strategy: RenderStrategy
  /** Short VN reason — surfaced in dev debug panel, not user UI. */
  reason: string
  /** Filename of the upstream reusable render this depends on (if any). */
  derivedFrom?: string
  /** Composer hint when strategy is non-AI. */
  compositionConfig?: CompositionConfig
  /** True if generating this asset implicitly fills the reusable pool. */
  feedsReusablePool?: boolean
}

export interface PackRenderPlan {
  /** Per-asset plan, in pack order. */
  assets: AssetPlan[]
  /** Aggregate stats — drives metrics chip + cost preview. */
  stats: {
    total: number
    aiFullCount: number
    reusableCount: number
    templateComposedCount: number
    derivedCount: number
    /** Total KIE calls actually needed (aiFullCount + reusableCount). */
    kieCallsRequired: number
    /** Estimated KIE credit (6 / call). */
    estimatedCredit: number
  }
}

// ── Internal: filename / style pattern → composer ──────────────────────────

interface ComposerHint {
  composer: string
  reason: string
}

/** V3 — Filename patterns that STILL route through template composers.
 *  User reported template-composed screenshots / collages look fake compared
 *  to AI-rendered. So this list is now VERY narrow — ONLY explicit marketing
 *  banners (offer + final-cta) which are supposed to be designed graphics,
 *  not authentic phone screenshots.
 *
 *  Removed in V3 (these now go through ai_full_render):
 *    • WhatsApp screenshots → AI renders pure phone screenshots authentically
 *    • Shopee review cards  → AI renders the screenshot
 *    • TikTok review cards  → AI renders the screenshot
 *    • FB comment screens   → AI renders the screenshot
 *    • News article screens → AI renders the screenshot
 *
 *  These screenshot composers still exist in /composers/ for power users
 *  who want to invoke them via DevTools (__testWhatsappComposer etc.), but
 *  they're no longer in the auto-routing path.
 */
const TEMPLATE_PATTERNS: Array<{ test: RegExp; hint: ComposerHint }> = [
  // Promo banner (offer + final-cta) — these ARE explicit marketing banners.
  // Kept as template-composed because the section's intent is "designed
  // promo graphic with product packshot + overlay", which is exactly what
  // canvas composition delivers cleanly.
  { test: /^(offer|finalcta)_/i,     hint: { composer: 'promo-banner',      reason: 'Promo banner = designed marketing graphic (intended)' } },
]

/** V3 — Style-keyword fallback. Same narrowing as TEMPLATE_PATTERNS.
 *  Only promo banner styles still match — everything else falls through
 *  to ai_full_render. */
const STYLE_PATTERNS: Array<{ test: RegExp; hint: ComposerHint }> = [
  { test: /promo banner/i,           hint: { composer: 'promo-banner',      reason: 'Style label nhắc promo banner' } },
]

// ── Section-level strategy hints ───────────────────────────────────────────
//
// Sections where EVERY image is template-composed (no AI render needed at all).

// V3 — emptied. WhatsApp + news-proof now AI-rendered like everything else.
// Template composition was producing AI-clone look that users could detect.
const ALL_TEMPLATE_SECTIONS = new Set<string>([])

/** Sections where exactly one image is composed from the master product
 *  packshot plus an overlay. */
const PRODUCT_OVERLAY_SECTIONS = new Set([
  'offer',      // 2 promo banners — reuse product packshot
  'final-cta',  // 2 metrics banners — reuse product packshot
])

/** Phase H1 fix — reusable feeders narrowed.
 *  hero_01 is NOT reused across all sections anymore (was causing the
 *  "same packshot / same hand / same bg" clone look that users noticed).
 *  ONLY the offer/final-cta promo banners reuse the hero packshot, since
 *  those are explicitly template-overlay banners where reuse is expected.
 *  All other sections (social-proof selfies, ingredient cards, etc.) get
 *  fresh AI renders with their own variation directives.
 *
 *  Empty for now — Phase H1 effectively disables packshot pooling. Future
 *  optimization could re-enable it ONLY for promo composer consumption,
 *  but the planner doesn't need to mark hero as reusable to make that work:
 *  the promo composer can pull the rendered hero_01 directly from the pack
 *  (see hybridRouter.findUpstreamRef) without going through the pool. */
const REUSABLE_FEEDERS = new Set<string>([])

// ── Classifier ─────────────────────────────────────────────────────────────

/** Classify ONE imagePrompt. Pure function. */
export function classifyImagePrompt(
  section: LandingSection,
  prompt: ImagePrompt,
  imageIdxInSection: number,
): AssetPlan {
  const filename = prompt.filename ?? ''
  const style = prompt.style ?? ''

  // 1. Filename pattern wins first (most specific)
  for (const { test, hint } of TEMPLATE_PATTERNS) {
    if (test.test(filename)) {
      return {
        sectionIdx: -1,  // filled by caller
        imageIdx: imageIdxInSection,
        filename,
        style,
        strategy: hint.composer === 'promo-banner' ? 'derived_asset' : 'template_composed',
        reason: hint.reason,
        derivedFrom: hint.composer === 'promo-banner' ? 'hero_01.jpg' : undefined,
        compositionConfig: { composer: hint.composer, params: {} },
      }
    }
  }

  // 2. Style keyword fallback
  for (const { test, hint } of STYLE_PATTERNS) {
    if (test.test(style)) {
      return {
        sectionIdx: -1,
        imageIdx: imageIdxInSection,
        filename,
        style,
        strategy: hint.composer === 'promo-banner' ? 'derived_asset' : 'template_composed',
        reason: hint.reason,
        derivedFrom: hint.composer === 'promo-banner' ? 'hero_01.jpg' : undefined,
        compositionConfig: { composer: hint.composer, params: {} },
      }
    }
  }

  // 3. Section-level rules
  if (ALL_TEMPLATE_SECTIONS.has(section.type)) {
    return {
      sectionIdx: -1,
      imageIdx: imageIdxInSection,
      filename,
      style,
      strategy: 'template_composed',
      reason: `Section ${section.type} render local 100%`,
      compositionConfig: { composer: section.type, params: {} },
    }
  }

  if (PRODUCT_OVERLAY_SECTIONS.has(section.type)) {
    return {
      sectionIdx: -1,
      imageIdx: imageIdxInSection,
      filename,
      style,
      strategy: 'derived_asset',
      reason: 'Banner = reuse product packshot + overlay typography',
      derivedFrom: 'hero_01.jpg',
      compositionConfig: { composer: 'promo-banner', params: {} },
    }
  }

  // V3 REMOVED sections 4a (social-proof screenshots → template), 4b
  // (before-after collages), and 5 (infographic templates). All go through
  // ai_full_render now — user feedback: template-composed assets had an
  // AI-clone look and broke conversion-quality bar.
  //
  // Section-specific routing kept ONLY for explicit marketing banners
  // (offer + final-cta) — handled above in PRODUCT_OVERLAY_SECTIONS.

  // 6. Default fallback — AI full render. Safe-expensive path.
  // Hero is also marked as a reusable feeder so its first image is cached.
  const feedsReusablePool = REUSABLE_FEEDERS.has(section.type) && imageIdxInSection === 0
  return {
    sectionIdx: -1,
    imageIdx: imageIdxInSection,
    filename,
    style,
    strategy: feedsReusablePool ? 'reusable_render' : 'ai_full_render',
    reason: feedsReusablePool
      ? 'Hero packshot — render bằng AI 1 lần, cache cho 8+ sections sau reuse'
      : `Section ${section.type} cần human emotion / true scene — AI bắt buộc`,
    feedsReusablePool,
  }
}

/** Walk an entire LandingPagePack and return per-asset plans + aggregate stats. */
export function planRenderPack(pack: LandingPagePack): PackRenderPlan {
  const assets: AssetPlan[] = []

  pack.sections.forEach((section, sectionIdx) => {
    section.imagePrompts.forEach((prompt, imageIdx) => {
      const plan = classifyImagePrompt(section, prompt, imageIdx)
      plan.sectionIdx = sectionIdx
      plan.imageIdx = imageIdx
      assets.push(plan)
    })
  })

  // ── Aggregate stats ──────────────────────────────────────────────────
  const aiFullCount           = assets.filter((a) => a.strategy === 'ai_full_render').length
  const reusableCount         = assets.filter((a) => a.strategy === 'reusable_render').length
  const templateComposedCount = assets.filter((a) => a.strategy === 'template_composed').length
  const derivedCount          = assets.filter((a) => a.strategy === 'derived_asset').length
  const kieCallsRequired      = aiFullCount + reusableCount
  const estimatedCredit       = kieCallsRequired * 6

  return {
    assets,
    stats: {
      total: assets.length,
      aiFullCount,
      reusableCount,
      templateComposedCount,
      derivedCount,
      kieCallsRequired,
      estimatedCredit,
    },
  }
}

// ── Phase 1 dev helper: expose stats from DevTools ─────────────────────────
//
// Run from console: `window.__previewRenderPlan(pack)` to see what the
// planner would do for a given pack without actually executing anything.
// Phase 1: this is purely diagnostic — no rendering happens.

if (typeof window !== 'undefined') {
  ;(window as unknown as { __previewRenderPlan?: (pack: LandingPagePack) => PackRenderPlan }).__previewRenderPlan = (pack) => {
    const plan = planRenderPack(pack)
    console.table(plan.assets.map((a) => ({
      file: a.filename,
      section: pack.sections[a.sectionIdx]?.type ?? '?',
      strategy: a.strategy,
      reason: a.reason,
    })))
    console.log('Stats:', plan.stats)
    return plan
  }
}
