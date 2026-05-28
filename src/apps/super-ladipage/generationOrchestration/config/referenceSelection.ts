// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — reference selection (P12)
//
// Per-imageRole strict filter mapping available references → references
// injected for the section. Pure declarative — no aesthetic logic.
//
// Renderer-aware tuning of HOW references are wired (img2img weights,
// ControlNet, IP-Adapter, etc.) is EXECUTOR responsibility, not
// orchestration. Orchestration only decides WHICH references go to
// WHICH section.
// ─────────────────────────────────────────────────────────────────────

import type { ImageIntent } from '../../imageSemantics'
import type { ReferenceAsset, ReferenceAssetKind } from '../types'

const ROLE_REFERENCE_KINDS: Record<ImageIntent['imageRole'], ReferenceAssetKind[]> = {
  'hero-anchor':       ['character-reference'],
  'mood-supporting':   ['character-reference'],
  'object-trace':      ['packaging', 'product-shot'],
  'lifestyle-context': ['packaging', 'product-shot', 'character-reference'],
  'proof-callout':     ['logo', 'packaging'],
  'none':              [],
}

export function selectReferences(
  intent: ImageIntent,
  available: ReferenceAsset[],
): ReferenceAsset[] {
  const allowedKinds = ROLE_REFERENCE_KINDS[intent.imageRole]
  if (allowedKinds.length === 0) return []
  return available.filter((r) => allowedKinds.includes(r.kind))
}
