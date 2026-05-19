// ── Creative Studio — Asset Module Registry (Phase 2 scaffold) ─────────────
//
// Canonical registry of all asset modules. STATIC IMPORTS ONLY — no
// `await import()`, no dynamic paths. Phase 7 lesson: dynamic chunk
// filenames change on every Vercel redeploy and break browsers that
// cached the previous index.js. Static imports bundle everything into
// the main chunk; no follow-up fetches that can fail.
//
// P2 — registry is DECLARED but EMPTY. No modules have been migrated yet.
// Each entry will be populated in its respective phase:
//   • P3 → engines/photographic/* modules
//   • P5 → engines/ui-native/chat-proof/* modules
//   • P6 → engines/ui-native/{shopee,tiktok-shop,facebook,tiktok-comment}/* modules
//   • P8 → engines/designed-graphic/* modules
//
// Until then, the registry is INTENTIONALLY empty and `resolveAssetType`
// throws a clear error when asked for an unimplemented asset type. The
// existing CreativeStudio.tsx app does NOT route through this registry yet
// — it stays on the legacy direct-call path until P3 migration.

import type { AssetTypeId } from '../types/asset'
import type { PhotographicModule } from '../types/photographic'
import type { UINativeModule } from '../types/uiNative'
import type { DesignedGraphicModule } from '../types/designedGraphic'

// ── P3: Photographic engine modules — STATIC IMPORTS ONLY ──────────────────
import { module as productShotModule }      from '../engines/photographic/product-shot/module'
import { module as holdingProductModule }   from '../engines/photographic/holding-product/module'
import { module as ugcSelfieModule }        from '../engines/photographic/ugc-selfie/module'
import { module as reviewTableModule }      from '../engines/photographic/review-table/module'
import { module as beforeAfterModule }      from '../engines/photographic/before-after/module'
import { module as lifestyleKitchenModule } from '../engines/photographic/lifestyle-kitchen/module'
import { module as bathroomRoutineModule }  from '../engines/photographic/bathroom-routine/module'
import { module as cafeLifestyleModule }    from '../engines/photographic/cafe-lifestyle/module'
import { module as ugcTiktokModule }        from '../engines/photographic/ugc-tiktok/module'
// ── P33: Phase 3 taxonomy shipped — new photographic types ─────────────────
import { module as floatingProductModule }       from '../engines/photographic/floating-product/module'
import { module as ingredientCompositionModule } from '../engines/photographic/ingredient-composition/module'
import { module as groupHoldingModule }          from '../engines/photographic/group-holding/module'
import { module as expertKolModule }             from '../engines/photographic/expert-kol/module'
// ── P43: ingredients-explain / mechanism-explain / benefit-timeline /
//        infographic — migrated from designed-graphic (Canvas template)
//        to photographic (KIE gpt-image-2) to match Ladipage's
//        illustrated infographic quality. Old designed-graphic modules
//        retained on disk for reference but unrouted.
import { module as ingredientsExplainModule } from '../engines/photographic/ingredients-explain/module'
import { module as mechanismExplainModule }   from '../engines/photographic/mechanism-explain/module'
import { module as benefitTimelineModule }    from '../engines/photographic/benefit-timeline/module'
import { module as collage4FramesModule }     from '../engines/photographic/collage-4-frames/module'
// ── P37: Ladipage-inspired creatives ──────────────────────────────────────
import { module as painOverlayModule }       from '../engines/photographic/pain-overlay/module'
import { module as newsMockModule }          from '../engines/photographic/news-mock/module'
import { module as metricCtaModule }         from '../engines/photographic/metric-cta/module'
import { module as failedSolutionsModule }   from '../engines/photographic/failed-solutions/module'
import { module as comparisonTableModule }   from '../engines/photographic/comparison-table/module'
// ── P40: Benefits Icon Grid (Ladipage benefits_01 style) ──────────────────
import { module as benefitsGridModule }      from '../engines/photographic/benefits-grid/module'

// ── P5: UI-Native chat-proof modules — STATIC IMPORTS ONLY ─────────────────
import { module as whatsappProofModule }    from '../engines/ui-native/whatsapp-proof/module'
import { module as messengerChatModule }    from '../engines/ui-native/messenger-chat/module'

// ── P6: UI-Native marketplace + social-comment modules ────────────────────
import { module as shopeeFeedbackModule }   from '../engines/ui-native/shopee-feedback/module'
import { module as tiktokFeedbackModule }   from '../engines/ui-native/tiktok-feedback/module'
import { module as facebookCommentModule }  from '../engines/ui-native/facebook-comment/module'
import { module as tiktokCommentModule }    from '../engines/ui-native/tiktok-comment/module'

// ── P8 / P43: Designed-Graphic modules — STATIC IMPORTS ONLY ─────────────
// P43 migrated `infographic` to photographic engine (KIE gpt-image-2). The
// old Canvas-template module is retained on disk for reference but is no
// longer routed. `cta-banner` stays on designed-graphic — banners are a
// different beast than infographics and the Canvas template suits them.
import { module as infographicModule }      from '../engines/photographic/infographic/module'
import { module as ctaBannerModule }        from '../engines/designed-graphic/cta-banner/module'

/** Union of all module shapes — discriminated by engineGroup field. */
export type AssetModule =
  | PhotographicModule
  | UINativeModule
  | DesignedGraphicModule

/**
 * Partial-record on purpose at Phase 2. Every key declared here will be
 * filled in across P3-P8. Until a key has a value, `resolveAssetType`
 * returns null + the orchestrator logs a clear "not yet implemented"
 * warning.
 *
 * STATIC IMPORTS ONLY when modules are added. Pattern:
 *
 *   import { module as productShotModule } from
 *     '../engines/photographic/product-shot/module'
 *
 *   export const ASSET_REGISTRY: Partial<Record<...>> = {
 *     'product-shot': productShotModule,
 *     ...
 *   }
 *
 * NEVER:
 *   'product-shot': () => import(...)   // ← BANNED. Phase 7 lesson.
 */
export const ASSET_REGISTRY: Partial<Record<AssetTypeId, AssetModule>> = {
  // ── P3: Photographic engine modules ────────────────────────────────
  'product-shot':       productShotModule,
  'holding-product':    holdingProductModule,
  'ugc-selfie':         ugcSelfieModule,
  'review-table':       reviewTableModule,
  'before-after':       beforeAfterModule,
  'lifestyle-kitchen':  lifestyleKitchenModule,
  'bathroom-routine':   bathroomRoutineModule,
  'cafe-lifestyle':     cafeLifestyleModule,
  'ugc-tiktok':         ugcTiktokModule,
  // ── P33: Phase 3 taxonomy — newly shipped ──────────────────────────
  'floating-product':       floatingProductModule,
  'ingredient-composition': ingredientCompositionModule,
  'group-holding':          groupHoldingModule,
  'expert-kol':             expertKolModule,

  // ── P5: UI-Native chat-proof modules ───────────────────────────────
  'whatsapp-proof':     whatsappProofModule,
  'messenger-chat':     messengerChatModule,

  // ── P6: UI-Native marketplace + social-comment modules ─────────────
  'shopee-feedback':    shopeeFeedbackModule,
  'tiktok-feedback':    tiktokFeedbackModule,
  'facebook-comment':   facebookCommentModule,
  'tiktok-comment':     tiktokCommentModule,

  // ── P8: Designed-Graphic modules ────────────────────────────────────
  'infographic':        infographicModule,
  'cta-banner':         ctaBannerModule,

  // ── P35: remaining roadmap fully shipped ──────────────────────────
  'ingredients-explain':    ingredientsExplainModule,
  'mechanism-explain':      mechanismExplainModule,
  'benefit-timeline':       benefitTimelineModule,
  'collage-4-frames':       collage4FramesModule,

  // ── P37: Ladipage-inspired creatives ──────────────────────────────
  'pain-overlay':           painOverlayModule,
  'news-mock':              newsMockModule,
  'metric-cta':             metricCtaModule,
  'failed-solutions':       failedSolutionsModule,
  'comparison-table':       comparisonTableModule,

  // ── P40: Benefits Icon Grid ───────────────────────────────────────
  'benefits-grid':          benefitsGridModule,
}

/** List of asset ids currently implemented (registry has a value). */
export function listImplementedAssetIds(): AssetTypeId[] {
  return Object.keys(ASSET_REGISTRY) as AssetTypeId[]
}
