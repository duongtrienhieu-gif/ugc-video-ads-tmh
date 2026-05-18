// ── Creative Studio — Asset Type System (Phase 2 scaffold) ─────────────────
//
// Common types every asset module + the orchestrator consume. P2 only —
// no logic, only contracts.

import type { EngineGroup } from './engine'

/**
 * Canonical asset type id — must match exactly the key in ASSET_REGISTRY.
 * Add new ids here as engine modules are introduced in P3+.
 *
 * Naming convention: kebab-case, prefix-free. Group affiliation is
 * declared in the module's `engineGroup` field, not in the id.
 */
export type AssetTypeId =
  // ── photographic group (populated starting in P3) ──────────────────
  | 'product-shot'
  | 'ugc-selfie'
  | 'review-table'
  | 'holding-product'
  | 'before-after'
  | 'lifestyle-kitchen'
  | 'bathroom-routine'
  | 'cafe-lifestyle'
  | 'ugc-tiktok'

  // ── ui-native group (populated starting in P5) ─────────────────────
  | 'whatsapp-proof'
  | 'messenger-chat'
  | 'tiktok-feedback'   // TikTok Shop product review
  | 'shopee-feedback'   // Shopee product review
  | 'facebook-comment'  // Facebook post comment thread
  | 'tiktok-comment'    // TikTok video comment overlay

  // ── designed-graphic group (populated starting in P8) ──────────────
  | 'infographic'
  | 'cta-banner'

/**
 * High-level asset category — used for UI grouping in tabs, filtering,
 * analytics. Orthogonal to engineGroup (multiple categories can route to
 * the same engine).
 */
export type AssetCategory =
  | 'ugc'           // selfie / review / lifestyle people-shots
  | 'product-shot'  // clean product hero / packshot variations
  | 'social-proof'  // testimonial portraits + reactions
  | 'chat-proof'    // Messenger + WhatsApp conversations
  | 'marketplace'   // Shopee + TikTok Shop review screenshots
  | 'social-comment' // Facebook + TikTok comment threads
  | 'banner'        // CTA / promo
  | 'infographic'   // mechanism / comparison / data visual
  | 'before-after'  // transformation pair

/**
 * Free-form metadata attached to every generated asset. Allows downstream
 * consumers (landing-page integration, analytics, gallery view) to filter
 * + group without depending on asset module internals.
 */
export interface AssetMetadata {
  /** When generation completed (ms since epoch) */
  generatedAt: number
  /** Asset module that produced this output */
  assetType: AssetTypeId
  /** Engine group that handled the generation */
  engineGroup: EngineGroup
  /** UI display category */
  category: AssetCategory
  /** Source product id (from bankStore) if applicable */
  productId?: string
  /** Source model/avatar id (from bankStore) if applicable */
  modelId?: string
  /** Aspect ratio of the output */
  aspectRatio: '1:1' | '4:5' | '9:16' | '3:2' | '16:9'
  /** QC verdict (engine-group-specific shape — see qc/) */
  qcSummary?: {
    passed: boolean
    overall: number  // 0-100
  }
  /** Free-form tags for analytics / filtering */
  tags?: string[]
  /** Engine-specific extras — opaque to the orchestrator */
  engineExtras?: Record<string, unknown>
}

/**
 * Final shape returned from `generateAssets`. The orchestrator
 * normalises every engine group's output to this contract.
 */
export interface GeneratedAsset {
  id: string
  /** URL or asset:xxx ref usable by useAssetUrl hook */
  outputUrl: string
  metadata: AssetMetadata
}

/**
 * Input contract for `generateAssets(assetType, params)`. Each engine
 * module narrows this further in its own typed signature.
 */
export interface GenerateAssetParams {
  /** Source product id (from bankStore). Required for product-bearing modules. */
  productId?: string
  /** Source model id (avatar). Required by some photographic modules. */
  modelId?: string
  /** Free-form module-specific knobs (scene preset, style, locale, etc.). */
  options?: Record<string, unknown>
  /** Optional abort signal — propagates to KIE calls + canvas renders. */
  signal?: AbortSignal
}
