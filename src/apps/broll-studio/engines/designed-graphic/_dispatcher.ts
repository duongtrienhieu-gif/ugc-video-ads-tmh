// ── Designed-Graphic Engine Dispatcher (P7 entry — scaffold for P8) ─────────
//
// Runtime pipeline for designed-graphic modules. P7 lands the typed
// entry point — replaces the notYetImplemented stub in
// orchestration/dispatch.ts. P8 will flesh out the actual canvas
// composition + KIE atomic background generation when the first
// concrete modules (infographic / cta-banner) are wired.
//
// Why land a typed entry now rather than at P8:
//   • Wiring is a one-line change in dispatch.ts — easier reviewed when
//     paired with the QC v2 commit than later with the module commits
//   • The error message becomes more useful (cites the resolved module
//     id and points to the right phase) than a generic stub
//   • Future P8 work doesn't need to touch orchestration

import type { DesignedGraphicModule } from '../../types/designedGraphic'
import type { GeneratedAsset } from '../../types/asset'

export async function dispatchDesignedGraphic(
  module: DesignedGraphicModule,
): Promise<GeneratedAsset> {
  // P8 will:
  //   1. Resolve product + supporting refs from bankStore
  //   2. Build layout + typography + colorTheme via module builders
  //   3. Generate the background AI region (KIE GPT-4o atomic)
  //   4. Compose the canvas (typography + layout + bg region)
  //   5. Post-process + saveAsset
  //   6. Normalize output

  throw new Error(
    `[designed-graphic dispatcher] Module "${module.id}" is registered, but the `
    + 'designed-graphic runtime pipeline has not been implemented yet. '
    + 'Pipeline lands in P8 (infographic + cta-banner). For now, the foundation '
    + '(types, factory, design-system tokens) is in place — see '
    + 'engines/designed-graphic/_buildModule.ts and shared/design-system/.',
  )
}
