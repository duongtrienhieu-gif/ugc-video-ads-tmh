// ── Creative Studio — Engine Group Routing (Phase 2 scaffold) ──────────────
//
// Maps each AssetTypeId to its engine group. The orchestrator reads this
// to dispatch to the right pipeline. Single source of truth for asset →
// group affiliation. P2 only declares routing; modules are wired in P3+.

import type { AssetTypeId } from '../types/asset'
import type { EngineGroup } from '../types/engine'

/**
 * Asset-id → engine-group routing table.
 *
 * Architecture rule: every AssetTypeId in the union MUST appear here.
 * TypeScript's Record<AssetTypeId, EngineGroup> enforces exhaustiveness —
 * adding a new asset id without routing it = compile error.
 */
export const ASSET_TO_GROUP: Record<AssetTypeId, EngineGroup> = {
  // ── photographic group ──────────────────────────────────────────────
  'product-shot':       'photographic',
  'ugc-selfie':         'photographic',
  'review-table':       'photographic',
  'holding-product':    'photographic',
  'before-after':       'photographic',
  'lifestyle-kitchen':  'photographic',
  'bathroom-routine':   'photographic',
  'cafe-lifestyle':     'photographic',
  'ugc-tiktok':         'photographic',

  // ── ui-native group ─────────────────────────────────────────────────
  'whatsapp-proof':     'ui-native',
  'messenger-chat':     'ui-native',
  'tiktok-feedback':    'ui-native',
  'shopee-feedback':    'ui-native',
  'facebook-comment':   'ui-native',
  'tiktok-comment':     'ui-native',

  // ── designed-graphic group ──────────────────────────────────────────
  'infographic':        'designed-graphic',
  'cta-banner':         'designed-graphic',

  // ── P27 — Phase 3 taxonomy (catalog-only; modules ship later) ──────
  'ingredients-explain':'designed-graphic',
  'mechanism-explain':  'designed-graphic',
  'benefit-timeline':   'designed-graphic',
  'group-holding':      'photographic',
  'collage-4-frames':   'photographic',
  'expert-kol':         'photographic',
} as const

/** Helper — get the engine group for an asset id (typed exhaustive). */
export function getEngineGroup(assetTypeId: AssetTypeId): EngineGroup {
  return ASSET_TO_GROUP[assetTypeId]
}

/** List all asset ids belonging to a specific engine group. */
export function listAssetsInGroup(group: EngineGroup): AssetTypeId[] {
  return (Object.keys(ASSET_TO_GROUP) as AssetTypeId[])
    .filter((id) => ASSET_TO_GROUP[id] === group)
}
