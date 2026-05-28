// TikTok Shop — Zustand store (Phase 1: skeleton).
// Phase 3+ adds: generate action, retry, re-roll visual/text, save to Supabase.

import { create } from 'zustand'
import type { Market } from '../../types/brandKit'
import type {
  ListingDraft,
  ListingOutput,
  ListingImage,
  DraftReadiness,
} from './types'
import {
  SLOT_MAP,
  MOCK_OVERLAY_BY_SLOT,
  MOCK_DESCRIPTION,
} from './constants'

interface TikTokShopState {
  draft: ListingDraft
  // Phase 1 toggle: render mock 9-slot + mock description so UI looks alive
  // even before Phase 3 wires real generation. Toggle off later phases.
  showMockPreview: boolean

  selectBrandKit: (id: string | null) => void
  selectProduct: (id: string | null) => void
  setLanguage: (m: Market) => void
  addReferenceImage: (assetId: string) => void
  removeReferenceImage: (assetId: string) => void
  toggleMockPreview: () => void
  resetDraft: () => void
}

function createEmptyDraft(): ListingDraft {
  return {
    brandKitId: null,
    productId: null,
    referenceImageAssetIds: [],
    market: 'ms',     // default MY per [[project-target-market]] memory
    output: null,
    isGenerating: false,
  }
}

export const useTikTokShopStore = create<TikTokShopState>((set) => ({
  draft: createEmptyDraft(),
  showMockPreview: true,

  selectBrandKit: (id) => set((s) => ({ draft: { ...s.draft, brandKitId: id } })),
  selectProduct:  (id) => set((s) => ({ draft: { ...s.draft, productId: id } })),
  setLanguage:    (m)  => set((s) => ({ draft: { ...s.draft, market: m } })),

  addReferenceImage: (assetId) => set((s) => {
    if (s.draft.referenceImageAssetIds.includes(assetId)) return s
    if (s.draft.referenceImageAssetIds.length >= 5) return s
    return { draft: { ...s.draft, referenceImageAssetIds: [...s.draft.referenceImageAssetIds, assetId] } }
  }),

  removeReferenceImage: (assetId) => set((s) => ({
    draft: { ...s.draft, referenceImageAssetIds: s.draft.referenceImageAssetIds.filter((a) => a !== assetId) },
  })),

  toggleMockPreview: () => set((s) => ({ showMockPreview: !s.showMockPreview })),

  resetDraft: () => set({ draft: createEmptyDraft() }),
}))

// ── Validation helper ────────────────────────────────────────────────────
// Returns whether the draft has enough to start generation.

export function checkDraftReadiness(
  draft: ListingDraft,
  brandKitReady: boolean,
  hasApiKey: boolean,
): DraftReadiness {
  const missing: string[] = []
  const warnings: string[] = []

  if (!draft.brandKitId) missing.push('Brand Kit')
  else if (!brandKitReady) missing.push('Brand Kit chưa đủ thông tin')

  if (!draft.productId) missing.push('Sản phẩm')
  if (draft.referenceImageAssetIds.length < 2) missing.push('Tối thiểu 2 ảnh tham chiếu')
  if (!hasApiKey) missing.push('Kie.ai API key (vào Cài đặt)')

  if (draft.referenceImageAssetIds.length < 4 && draft.referenceImageAssetIds.length >= 2) {
    warnings.push('Khuyến nghị 4 ảnh tham chiếu để chất lượng tốt hơn')
  }

  return { ready: missing.length === 0, missing, warnings }
}

// ── Mock listing builder — Phase 1 only ─────────────────────────────────
// Produces a fake ListingOutput that ImageGrid/DescriptionEditor can render
// so the UI shell isn't empty before Phase 3 wires real generation.

export function buildMockListing(): ListingOutput {
  const images: ListingImage[] = SLOT_MAP.map((cfg) => ({
    slot: cfg.slot,
    config: cfg,
    imageAssetId: null,
    overlay: MOCK_OVERLAY_BY_SLOT[cfg.slot] ?? {},
    status: 'completed',
  }))
  const nowIso = new Date().toISOString()
  return {
    id: 'mock-listing',
    productId: 'mock-product',
    brandKitId: 'mock-brand',
    brandKitVersion: 1,
    market: 'ms',
    category: 'tpcn-health',
    paletteFamily: 'medicalBlue',
    createdAt: nowIso,
    updatedAt: nowIso,
    images,
    description: MOCK_DESCRIPTION,
  }
}
