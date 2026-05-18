// ── Asset Reference Resolver (P9) ───────────────────────────────────────────
//
// Single source of truth for converting any URL form (asset:xxx /
// blob: / data: / https:) into a KIE-fetchable / loadImage-fetchable
// public URL. Was duplicated verbatim in all three engine dispatchers
// (photographic / ui-native / designed-graphic) pre-P9.
//
// The blob/data branch persists the data via saveAsset first — that
// keeps the URL stable across reloads (URL.createObjectURL would be
// revoked the moment the tab closes).

import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'

export async function toPublicUrl(ref: string): Promise<string | null> {
  if (!ref) return null
  if (isAssetRef(ref)) return await getUrl(ref)
  if (ref.startsWith('blob:') || ref.startsWith('data:')) {
    const r = await fetch(ref)
    if (!r.ok) return null
    const blob = await r.blob()
    const assetId = await saveAsset(blob, blob.type || 'image/jpeg')
    return await getUrl(assetId)
  }
  return ref
}
