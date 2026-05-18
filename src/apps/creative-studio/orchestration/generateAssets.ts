// ── Creative Studio — Public Entry Orchestrator (Phase 2 scaffold) ─────────
//
// Single public function callers use to generate an asset of any type.
// Pipeline:
//
//   generateAssets(assetTypeId, params)
//     → resolveAssetType(assetTypeId)   // returns AssetModule (typed union)
//     → dispatchToEngine(module, params) // routes by module.engineGroup
//     → engine pipeline (P3/P5/P8)
//     → GeneratedAsset
//
// P2 stub. The existing CreativeStudio.tsx app does NOT call this entry
// point yet — it continues to use its direct KIE calls until P3 migration.
// This file is here so the architecture is in place; nothing in the
// current bundle invokes it until a module is wired.

import type { AssetTypeId, GenerateAssetParams, GeneratedAsset } from '../types/asset'
import { resolveAssetType } from '../registry/resolveAssetType'
import { dispatchToEngine } from './dispatch'

/**
 * Public Creative Studio entry point. Resolves the requested asset type
 * via the registry, dispatches to its engine group, and returns the
 * normalised asset.
 *
 * Throws `AssetNotImplementedError` if the asset type's module is not
 * yet wired into ASSET_REGISTRY.
 */
export async function generateAssets(
  assetTypeId: AssetTypeId,
  params: GenerateAssetParams,
): Promise<GeneratedAsset> {
  console.info('[Creative Studio]', 'generateAssets', { assetTypeId, productId: params.productId })

  // Resolve module from registry — throws if not implemented yet
  const module = resolveAssetType(assetTypeId)

  // Dispatch to engine group based on module's engineGroup discriminator
  return dispatchToEngine(module, params)
}
