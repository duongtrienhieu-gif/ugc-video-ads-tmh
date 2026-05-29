// ─────────────────────────────────────────────────────────────────────
// Ladipage Adapter — ladipageBundleJsonSerializer (P16A)
//
// LadipageExportBundle → portable JSON. Round-trip safe (no functions,
// no class instances). Suitable for download / share / re-import.
// ─────────────────────────────────────────────────────────────────────

import type { LadipageExportBundle } from '../types'

export function serializeBundleJson(bundle: LadipageExportBundle, pretty = true): string {
  return pretty ? JSON.stringify(bundle, null, 2) : JSON.stringify(bundle)
}
