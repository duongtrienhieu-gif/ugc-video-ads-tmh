// ── Creative Studio — Engine Group Dispatch (Phase 2 scaffold) ─────────────
//
// After resolving an AssetTypeId → module, the orchestrator routes the
// generation request to the right engine-group pipeline. P2 only declares
// the dispatch contract; engine pipelines are stubs until their phase.
//
// Cross-engine isolation: this file IMPORTS engine entry points by group
// but does NOT call into them at runtime in P2. The dispatch table exists
// to enforce the architecture: each group has exactly one entry point,
// and the orchestrator routes by `module.engineGroup` (typed discrimination).

import type { AssetModule } from '../registry/assetRegistry'
import type { GenerateAssetParams, GeneratedAsset } from '../types/asset'

/** Dispatch contract — every engine-group entry point matches this signature. */
export type EngineDispatcher = (
  module: AssetModule,
  params: GenerateAssetParams,
) => Promise<GeneratedAsset>

/**
 * Placeholder dispatcher — throws to make it obvious when something
 * tries to dispatch before the engine pipeline is implemented.
 */
function notYetImplemented(engineGroup: string): EngineDispatcher {
  return async (module, _params) => {
    throw new Error(
      `[Creative Studio dispatch] engine group "${engineGroup}" has no runtime `
      + `implementation yet. Module "${module.id}" cannot be dispatched. `
      + `Implementation lands in: ${engineGroup === 'photographic' ? 'P3' : engineGroup === 'ui-native' ? 'P5' : 'P8'}.`,
    )
  }
}

/**
 * Engine-group dispatch table. Each engine group fills its entry in its
 * implementation phase:
 *
 *   P3 → replaces 'photographic' with the real photographic dispatcher
 *   P5 → replaces 'ui-native' with the real ui-native dispatcher
 *   P8 → replaces 'designed-graphic' with the real designed-graphic dispatcher
 *
 * The dispatcher functions consume the resolved module + params and
 * orchestrate that group's pipeline (prompt build → KIE → QC for
 * photographic; canvas template → atomic AI → post-process for ui-native;
 * etc.).
 */
export const ENGINE_DISPATCH: Record<AssetModule['engineGroup'], EngineDispatcher> = {
  'photographic':      notYetImplemented('photographic'),
  'ui-native':         notYetImplemented('ui-native'),
  'designed-graphic':  notYetImplemented('designed-graphic'),
}

/**
 * Route a module + params to its engine-group dispatcher. Single dispatch
 * point. The discriminated union on `module.engineGroup` ensures the
 * orchestrator never picks the wrong pipeline.
 */
export async function dispatchToEngine(
  module: AssetModule,
  params: GenerateAssetParams,
): Promise<GeneratedAsset> {
  const dispatcher = ENGINE_DISPATCH[module.engineGroup]
  return dispatcher(module, params)
}
