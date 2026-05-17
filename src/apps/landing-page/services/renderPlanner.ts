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

/** Filename-prefix lookups for template-composed assets. Order matters —
 *  first match wins. All patterns are case-insensitive. */
const TEMPLATE_PATTERNS: Array<{ test: RegExp; hint: ComposerHint }> = [
  // WhatsApp screenshots — 4 per pack
  { test: /^wa_\d+/i,                hint: { composer: 'whatsapp-chat',     reason: 'WhatsApp UI có thể compose từ HTML + ảnh sản phẩm reuse' } },
  // Shopee review screenshots
  { test: /shopee/i,                 hint: { composer: 'shopee-review',     reason: 'Shopee review card 90% template chrome' } },
  // TikTok Shop review screenshots
  { test: /tiktok/i,                 hint: { composer: 'tiktok-review',     reason: 'TikTok Shop card 90% template chrome' } },
  // Facebook comment screenshots
  { test: /^social_fb/i,             hint: { composer: 'fb-comment',        reason: 'Facebook comment section UI thuần template' } },
  // News article screenshots
  { test: /^news_/i,                 hint: { composer: 'news-article',      reason: 'Malaysia news layout pure template — chỉ headline/body cần dynamic' } },
  // Promo banner (offer + final-cta)
  { test: /^(offer|finalcta)_/i,     hint: { composer: 'promo-banner',      reason: 'Promo banner = product packshot reuse + overlay typography' } },
]

/** Style-keyword fallback when filename doesn't match a known pattern. */
const STYLE_PATTERNS: Array<{ test: RegExp; hint: ComposerHint }> = [
  { test: /whatsapp/i,               hint: { composer: 'whatsapp-chat',     reason: 'Style label nhắc WhatsApp UI' } },
  { test: /shopee/i,                 hint: { composer: 'shopee-review',     reason: 'Style label nhắc Shopee review' } },
  { test: /tiktok shop/i,            hint: { composer: 'tiktok-review',     reason: 'Style label nhắc TikTok Shop card' } },
  { test: /facebook comment/i,       hint: { composer: 'fb-comment',        reason: 'Style label nhắc FB comment screenshot' } },
  { test: /promo banner/i,           hint: { composer: 'promo-banner',      reason: 'Style label nhắc promo banner' } },
  { test: /news article|berita|mstar/i, hint: { composer: 'news-article',   reason: 'Style label nhắc Malaysia news' } },
]

// ── Section-level strategy hints ───────────────────────────────────────────
//
// Sections where EVERY image is template-composed (no AI render needed at all).

const ALL_TEMPLATE_SECTIONS = new Set([
  'whatsapp-testimonials',  // 4 WA screenshots = pure template
  'news-proof',             // 2 news article shots = pure template
])

/** Sections where exactly one image is composed from the master product
 *  packshot plus an overlay. */
const PRODUCT_OVERLAY_SECTIONS = new Set([
  'offer',      // 2 promo banners — reuse product packshot
  'final-cta',  // 2 metrics banners — reuse product packshot
])

/** Sections that contribute to the reusable product packshot pool (the FIRST
 *  AI image of these sections becomes the master packshot). */
const REUSABLE_FEEDERS = new Set([
  'hero',  // hero_01 = canonical product-with-person packshot — heroes will
           // still be AI, but the rendered packshot is cached for promo reuse
])

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

  // 4. Section-specific section-internal mixing
  // 4a. social-proof: 3 first images = screenshots (template), last 2 = AI selfie+crowd
  if (section.type === 'social-proof' && imageIdxInSection < 3) {
    return {
      sectionIdx: -1,
      imageIdx: imageIdxInSection,
      filename,
      style,
      strategy: 'template_composed',
      reason: 'Social proof screenshot — UI template + reusable product render',
      compositionConfig: { composer: 'social-screenshot', params: { idx: imageIdxInSection } },
    }
  }

  // 4b. before-after: 4 collages — first 2 are AI portraits, last 2 are derived collages
  if (section.type === 'before-after' && imageIdxInSection >= 2) {
    return {
      sectionIdx: -1,
      imageIdx: imageIdxInSection,
      filename,
      style,
      strategy: 'derived_asset',
      reason: 'Before/after collage — build từ 2 portrait đã render bằng AI',
      derivedFrom: 'ba_01.jpg',
      compositionConfig: { composer: 'before-after-collage', params: { variantIdx: imageIdxInSection - 2 } },
    }
  }

  // 5. Infographic sections — render entirely from copy + reusable assets
  if (
    section.type === 'why-happens' ||
    section.type === 'ingredients' ||
    section.type === 'mechanism' ||
    section.type === 'benefits' ||
    section.type === 'comparison'
  ) {
    return {
      sectionIdx: -1,
      imageIdx: imageIdxInSection,
      filename,
      style,
      strategy: 'template_composed',
      reason: `${section.type} infographic — bullets/copy + reusable swatch → canvas`,
      compositionConfig: { composer: `${section.type}-infographic`, params: {} },
    }
  }

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
