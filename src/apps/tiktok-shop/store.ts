// TikTok Shop — Zustand store.
// Phase 1: skeleton selectors + mock builder.
// Phase 3: + generation lifecycle (initialize output, per-slot status/asset).
// Phase 4 will: persist listings to Supabase, snapshot brandKitVersion, etc.

import { create } from 'zustand'
import type { Market } from '../../types/brandKit'
import type {
  ListingDraft,
  ListingOutput,
  ListingImage,
  ImageGenStatus,
  SlotNumber,
  DraftReadiness,
  PaletteFamily,
  DescriptionBlock,
  ListingDescription,
  ComboOption,
  TiktokShopProductBrief,
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

  // ── Input selection ──
  selectBrandKit: (id: string | null) => void
  selectProduct: (id: string | null) => void
  setLanguage: (m: Market) => void
  addReferenceImage: (assetId: string) => void
  removeReferenceImage: (assetId: string) => void
  toggleMockPreview: () => void
  resetDraft: () => void

  // ── Generation lifecycle (Phase 3+) ──
  initializeListingOutput: (params: {
    productId: string
    brandKitId: string
    brandKitVersion: number
    market: Market
    paletteFamily: PaletteFamily
  }) => void
  setIsGenerating: (val: boolean) => void
  setSlotStatus: (slot: SlotNumber, status: ImageGenStatus, error?: string) => void
  setSlotImage: (slot: SlotNumber, assetId: string, prompt?: string) => void

  // ── Vision brief cache (Phase 10) ──
  setProductBrief: (brief: TiktokShopProductBrief | null, cacheKey: string | null) => void

  // ── Description editing (Phase 4) ──
  setDescription: (description: ListingDescription) => void
  updateDescriptionBlock: (index: number, block: DescriptionBlock) => void

  // ── Persistence restore (Phase 5) ──
  /** Replace draft.output with a previously-saved listing (loaded from Supabase) */
  loadSavedOutput: (listing: ListingOutput) => void

  // ── Combo / variant thumbnails (Phase 7B) ──
  addCombo: (combo: Omit<ComboOption, 'id' | 'imageAssetId' | 'status'>) => void
  updateCombo: (id: string, patch: Partial<ComboOption>) => void
  removeCombo: (id: string) => void
  setComboStatus: (id: string, status: ImageGenStatus, error?: string) => void
  setComboImage: (id: string, assetId: string, prompt?: string) => void
}

function createEmptyDraft(): ListingDraft {
  return {
    brandKitId: null,
    productId: null,
    referenceImageAssetIds: [],
    market: 'ms',     // default MY per [[project-target-market]] memory
    output: null,
    isGenerating: false,
    productBrief: null,
    productBriefKey: null,
  }
}

function createPendingImages(): ListingImage[] {
  return SLOT_MAP.map((cfg) => ({
    slot: cfg.slot,
    config: cfg,
    imageAssetId: null,
    overlay: MOCK_OVERLAY_BY_SLOT[cfg.slot] ?? {},
    status: 'pending',
  }))
}

export const useTikTokShopStore = create<TikTokShopState>((set) => ({
  draft: createEmptyDraft(),
  showMockPreview: true,

  selectBrandKit: (id) => set((s) => ({ draft: { ...s.draft, brandKitId: id } })),
  // Selecting a different product invalidates the cached brief (it was Vision-
  // analyzed for a different product).
  selectProduct:  (id) => set((s) => ({
    draft: {
      ...s.draft,
      productId: id,
      productBrief: id === s.draft.productId ? s.draft.productBrief : null,
      productBriefKey: id === s.draft.productId ? s.draft.productBriefKey : null,
    },
  })),
  setLanguage:    (m)  => set((s) => ({ draft: { ...s.draft, market: m } })),

  // Adding/removing reference images invalidates the cached brief (refs changed
  // → Vision analysis is stale).
  addReferenceImage: (assetId) => set((s) => {
    if (s.draft.referenceImageAssetIds.includes(assetId)) return s
    if (s.draft.referenceImageAssetIds.length >= 5) return s
    return {
      draft: {
        ...s.draft,
        referenceImageAssetIds: [...s.draft.referenceImageAssetIds, assetId],
        productBrief: null,
        productBriefKey: null,
      },
    }
  }),

  removeReferenceImage: (assetId) => set((s) => ({
    draft: {
      ...s.draft,
      referenceImageAssetIds: s.draft.referenceImageAssetIds.filter((a) => a !== assetId),
      productBrief: null,
      productBriefKey: null,
    },
  })),

  toggleMockPreview: () => set((s) => ({ showMockPreview: !s.showMockPreview })),

  resetDraft: () => set({ draft: createEmptyDraft() }),

  // ── Phase 3: Generation lifecycle ──────────────────────────────────────

  initializeListingOutput: ({ productId, brandKitId, brandKitVersion, market, paletteFamily }) => set((s) => {
    const nowIso = new Date().toISOString()
    const output: ListingOutput = {
      id: crypto.randomUUID(),
      productId,
      brandKitId,
      brandKitVersion,
      market,
      category: 'tpcn-health',
      paletteFamily,
      createdAt: nowIso,
      updatedAt: nowIso,
      images: createPendingImages(),
      description: MOCK_DESCRIPTION,  // Phase 4 replaces with real gen
    }
    return {
      draft: { ...s.draft, output },
      showMockPreview: false,  // turn off mock — show the real (pending) output
    }
  }),

  setIsGenerating: (val) => set((s) => ({ draft: { ...s.draft, isGenerating: val } })),

  setProductBrief: (brief, cacheKey) => set((s) => ({
    draft: { ...s.draft, productBrief: brief, productBriefKey: cacheKey },
  })),

  setSlotStatus: (slot, status, error) => set((s) => {
    if (!s.draft.output) return s
    return {
      draft: {
        ...s.draft,
        output: {
          ...s.draft.output,
          updatedAt: new Date().toISOString(),
          images: s.draft.output.images.map((img) =>
            img.slot === slot ? { ...img, status, error: error ?? undefined } : img,
          ),
        },
      },
    }
  }),

  setSlotImage: (slot, assetId, prompt) => set((s) => {
    if (!s.draft.output) return s
    const nowIso = new Date().toISOString()
    return {
      draft: {
        ...s.draft,
        output: {
          ...s.draft.output,
          updatedAt: nowIso,
          images: s.draft.output.images.map((img) =>
            img.slot === slot
              ? {
                  ...img,
                  imageAssetId: assetId,
                  status: 'completed',
                  error: undefined,
                  aiGenPrompt: prompt ?? img.aiGenPrompt,
                  generatedAt: nowIso,
                }
              : img,
          ),
        },
      },
    }
  }),

  setDescription: (description) => set((s) => {
    if (!s.draft.output) return s
    return {
      draft: {
        ...s.draft,
        output: {
          ...s.draft.output,
          updatedAt: new Date().toISOString(),
          description,
        },
      },
    }
  }),

  updateDescriptionBlock: (index, block) => set((s) => {
    if (!s.draft.output) return s
    const blocks = [...s.draft.output.description.blocks]
    if (index < 0 || index >= blocks.length) return s
    blocks[index] = block
    return {
      draft: {
        ...s.draft,
        output: {
          ...s.draft.output,
          updatedAt: new Date().toISOString(),
          description: { ...s.draft.output.description, blocks },
        },
      },
    }
  }),

  loadSavedOutput: (listing) => set((s) => ({
    draft: {
      ...s.draft,
      brandKitId: listing.brandKitId,
      productId: listing.productId,
      market: listing.market,
      output: listing,
      isGenerating: false,
    },
    showMockPreview: false,
  })),

  // ── Combos ─────────────────────────────────────────────────────────────

  addCombo: (combo) => set((s) => {
    if (!s.draft.output) return s
    const next: ComboOption = {
      ...combo,
      id: crypto.randomUUID(),
      imageAssetId: null,
      status: 'pending',
    }
    const combos = [...(s.draft.output.combos ?? []), next]
    return {
      draft: {
        ...s.draft,
        output: { ...s.draft.output, updatedAt: new Date().toISOString(), combos },
      },
    }
  }),

  updateCombo: (id, patch) => set((s) => {
    if (!s.draft.output) return s
    const combos = (s.draft.output.combos ?? []).map((c) =>
      c.id === id ? { ...c, ...patch } : c,
    )
    return {
      draft: {
        ...s.draft,
        output: { ...s.draft.output, updatedAt: new Date().toISOString(), combos },
      },
    }
  }),

  removeCombo: (id) => set((s) => {
    if (!s.draft.output) return s
    const combos = (s.draft.output.combos ?? []).filter((c) => c.id !== id)
    return {
      draft: {
        ...s.draft,
        output: { ...s.draft.output, updatedAt: new Date().toISOString(), combos },
      },
    }
  }),

  setComboStatus: (id, status, error) => set((s) => {
    if (!s.draft.output) return s
    const combos = (s.draft.output.combos ?? []).map((c) =>
      c.id === id ? { ...c, status, error: error ?? undefined } : c,
    )
    return {
      draft: {
        ...s.draft,
        output: { ...s.draft.output, updatedAt: new Date().toISOString(), combos },
      },
    }
  }),

  setComboImage: (id, assetId, prompt) => set((s) => {
    if (!s.draft.output) return s
    const nowIso = new Date().toISOString()
    const combos = (s.draft.output.combos ?? []).map((c) =>
      c.id === id
        ? {
            ...c,
            imageAssetId: assetId,
            status: 'completed' as ImageGenStatus,
            error: undefined,
            aiGenPrompt: prompt ?? c.aiGenPrompt,
            generatedAt: nowIso,
          }
        : c,
    )
    return {
      draft: {
        ...s.draft,
        output: { ...s.draft.output, updatedAt: nowIso, combos },
      },
    }
  }),
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

// ── Mock listing builder ─────────────────────────────────────────────────
// Renders 9 mock slots so the UI shell isn't empty before user generates.

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
