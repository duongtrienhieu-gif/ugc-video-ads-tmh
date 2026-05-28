// Resolves a Brand Kit by id → ResolvedBrandKit ready for canvas rendering.
// Falls back to a built-in MOCK_BRAND_KIT so previews always have something
// to render, even before the user has created any brand kit.

import { useEffect, useState } from 'react'
import {
  getResolvedBrandKit,
  useBrandKitStore,
} from '../../../stores/brandKitStore'
import type { Market, ResolvedBrandKit } from '../../../types/brandKit'

export const MOCK_BRAND_KIT: ResolvedBrandKit = {
  id: 'mock-brand',
  name: 'WhitePro Demo',
  category: 'supplement',
  isExistingBrand: false,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  logo: { blobUrl: '', width: 0, height: 0 },
  palette: { primary: '#1E4D8C', secondary: '#E8F2FC', cta: '#FF6B35' },
  typography: { display: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans' },
  badges: [],
  flagOrigin: 'MY',
  storeName: 'WhitePro Official Store',
  tagline: 'Trusted by 100K+ pharmacy customers',
  voice: {},
  cta: undefined,
  markets: ['ms'],
  allowSecondaryLanguage: null,
  localizations: undefined,
  market: 'ms',
}

/** Returns a resolved brand kit ready for ListingCanvas.
 *  When id is null OR the kit fails to resolve, returns MOCK_BRAND_KIT so
 *  the canvas always has something to draw. */
export function useResolvedBrandKit(id: string | null, market: Market): ResolvedBrandKit {
  // Subscribe to brandKits list so re-resolution fires when the underlying
  // kit metadata changes (logo swap, palette edit, etc.)
  const brandKits = useBrandKitStore((s) => s.brandKits)
  const [resolved, setResolved] = useState<ResolvedBrandKit | null>(null)

  useEffect(() => {
    if (!id) { setResolved(null); return }
    // Verify the kit still exists in store before resolving — if it was
    // deleted, fall through to mock instead of throwing.
    if (!brandKits.find((k) => k.id === id)) { setResolved(null); return }

    let alive = true
    getResolvedBrandKit(id, market)
      .then((r) => { if (alive) setResolved(r) })
      .catch(() => { if (alive) setResolved(null) })
    return () => { alive = false }
  }, [id, market, brandKits])

  return resolved ?? { ...MOCK_BRAND_KIT, market }
}
