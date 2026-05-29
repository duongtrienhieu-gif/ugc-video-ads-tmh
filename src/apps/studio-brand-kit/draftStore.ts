import { create } from 'zustand'
import type { InferredBrandFields, LogoConcept } from './service'
import type { BrandCategory, Market } from '../../types/brandKit'

// In-memory only — draft state shared between the create form, the
// generate-result editor, and back to the create form when re-rolling.
// Cleared on save / cancel.
//
// IMPORTANT: no persistence. The draft is throw-away. Persisted state
// only lives in brandKitStore after the user clicks "Lưu vào ngân hàng".

export interface BrandKitDraft {
  brandName: string
  category: BrandCategory
  isExistingBrand: boolean
  market: Market
  inferred: InferredBrandFields | null
  logoConcepts: LogoConcept[]
  // User picks from generated concepts OR uploads — only one wins.
  pickedLogoAssetId: string | null
  pickedLogoBlobUrl: string | null
  uploadedLogoAssetId: string | null
  uploadedLogoBlobUrl: string | null
}

interface DraftStore {
  draft: BrandKitDraft
  setSeed: (seed: Pick<BrandKitDraft, 'brandName' | 'category' | 'isExistingBrand' | 'market'>) => void
  setInferred: (inferred: InferredBrandFields) => void
  patchInferred: (patch: Partial<InferredBrandFields>) => void
  setLogoConcepts: (concepts: LogoConcept[]) => void
  pickLogo: (assetId: string, blobUrl: string) => void
  setUploadedLogo: (assetId: string, blobUrl: string) => void
  reset: () => void
}

const empty: BrandKitDraft = {
  brandName: '',
  category: 'other',
  isExistingBrand: false,
  market: 'ms',
  inferred: null,
  logoConcepts: [],
  pickedLogoAssetId: null,
  pickedLogoBlobUrl: null,
  uploadedLogoAssetId: null,
  uploadedLogoBlobUrl: null,
}

export const useDraftStore = create<DraftStore>((set) => ({
  draft: empty,
  setSeed: (seed) => set((s) => ({ draft: { ...s.draft, ...seed } })),
  setInferred: (inferred) => set((s) => ({ draft: { ...s.draft, inferred } })),
  patchInferred: (patch) =>
    set((s) => ({
      draft: {
        ...s.draft,
        inferred: s.draft.inferred ? { ...s.draft.inferred, ...patch } : s.draft.inferred,
      },
    })),
  setLogoConcepts: (logoConcepts) => set((s) => ({ draft: { ...s.draft, logoConcepts } })),
  pickLogo: (assetId, blobUrl) =>
    set((s) => ({
      draft: {
        ...s.draft,
        pickedLogoAssetId: assetId,
        pickedLogoBlobUrl: blobUrl,
        uploadedLogoAssetId: null,
        uploadedLogoBlobUrl: null,
      },
    })),
  setUploadedLogo: (assetId, blobUrl) =>
    set((s) => ({
      draft: {
        ...s.draft,
        uploadedLogoAssetId: assetId,
        uploadedLogoBlobUrl: blobUrl,
        pickedLogoAssetId: null,
        pickedLogoBlobUrl: null,
      },
    })),
  reset: () => set({ draft: empty }),
}))
