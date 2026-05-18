// ── Creative Studio — Asset Type Resolver (Phase 2 scaffold) ───────────────
//
// Single dispatch point. Takes an AssetTypeId, returns the module from
// the registry. Synchronous (no async, no dynamic import). Throws a
// descriptive error if the module isn't implemented yet.

import type { AssetTypeId } from '../types/asset'
import type { EngineGroup } from '../types/engine'
import { ASSET_REGISTRY, type AssetModule } from './assetRegistry'
import { getEngineGroup } from './groups'

/** Error thrown when the requested asset type has no module in the registry. */
export class AssetNotImplementedError extends Error {
  readonly assetTypeId: AssetTypeId
  readonly engineGroup: EngineGroup
  constructor(assetTypeId: AssetTypeId, engineGroup: EngineGroup) {
    super(
      `[Creative Studio] asset module "${assetTypeId}" (group: ${engineGroup}) `
      + `is not implemented yet. Check ASSET_REGISTRY in registry/assetRegistry.ts.`,
    )
    this.name = 'AssetNotImplementedError'
    this.assetTypeId = assetTypeId
    this.engineGroup = engineGroup
  }
}

/**
 * Resolve an AssetTypeId to its module. Throws if not implemented.
 * Synchronous on purpose — no dynamic import, no Promise overhead.
 */
export function resolveAssetType(assetTypeId: AssetTypeId): AssetModule {
  const module = ASSET_REGISTRY[assetTypeId]
  if (!module) {
    throw new AssetNotImplementedError(assetTypeId, getEngineGroup(assetTypeId))
  }
  return module
}

/**
 * Soft variant — returns null instead of throwing. Useful for UI code
 * that wants to grey-out unimplemented asset tabs.
 */
export function tryResolveAssetType(assetTypeId: AssetTypeId): AssetModule | null {
  return ASSET_REGISTRY[assetTypeId] ?? null
}

/** True if the asset type has a module wired in the registry. */
export function isAssetImplemented(assetTypeId: AssetTypeId): boolean {
  return !!ASSET_REGISTRY[assetTypeId]
}
