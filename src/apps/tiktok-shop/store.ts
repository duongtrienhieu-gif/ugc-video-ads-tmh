// TikTok Shop — Zustand store.
// Phase 1: skeleton selectors + mock builder.
// Phase 3: + generation lifecycle (initialize output, per-slot status/asset).
// Phase 4 will: persist listings to Supabase, snapshot brandKitVersion, etc.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Market } from '../../types/brandKit'

// ── IndexedDB storage adapter (avoids localStorage 5-10MB quota) ──
// Same pattern brandKitStore uses. Listing output (9 image refs + description
// + brief) is ~100KB which would fit localStorage in isolation, but localStorage
// is shared across all apps in the codebase — quota gets exceeded after a few
// listings. IDB has effectively unlimited quota per origin.

const IDB_NAME  = 'ugc-lab-tiktok-shop'
const IDB_STORE = 'kv'

function openTiktokIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openTiktokIDB()
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch { return null }
}

async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openTiktokIDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('[tiktok-shop store] IDB set failed', err)
  }
}

async function idbDel(key: string): Promise<void> {
  try {
    const db = await openTiktokIDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('[tiktok-shop store] IDB del failed', err)
  }
}

const idbStorage = createJSONStorage(() => ({
  getItem:    (name: string) => idbGet(name),
  setItem:    (name: string, value: string) => idbSet(name, value),
  removeItem: (name: string) => idbDel(name),
}))

// One-shot cleanup: remove the old localStorage entry from the broken
// commit 1ba13f7 (caused QuotaExceededError). After this runs once, the
// orphaned localStorage space is freed up.
;(function clearLegacyLocalStorage() {
  if (typeof window === 'undefined') return
  try {
    const KEY = 'ugc-lab:tiktok-shop'
    if (localStorage.getItem(KEY)) {
      localStorage.removeItem(KEY)
      console.info('[tiktok-shop store] removed legacy localStorage entry, migrated to IDB')
    }
  } catch { /* silent — already broken state, ignore */ }
})()
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
  /** Start a fresh listing — clears output, product, refs, brief.
   *  KEEPS brandKit + market (user is likely staying in the same shop/market). */
  startNewListing: () => void

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

export const useTikTokShopStore = create<TikTokShopState>()(
  persist(
    (set) => ({
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

  startNewListing: () => set((s) => ({
    draft: {
      ...createEmptyDraft(),
      brandKitId: s.draft.brandKitId,
      market: s.draft.market,
    },
  })),

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

  loadSavedOutput: (listing) => set((s) => {
    // Migration: legacy listings may carry block.kind values that have since
    // been removed from the union (e.g., 'offer'). Strip them so the UI
    // doesn't crash on a missing label lookup.
    const VALID_KINDS = new Set<DescriptionBlock['kind']>([
      'hook', 'pain', 'solution', 'benefits', 'specs',
      'reviews', 'usage', 'faq', 'promise', 'cta',
    ])
    const sanitizedListing: ListingOutput = {
      ...listing,
      description: {
        ...listing.description,
        blocks: listing.description.blocks.filter((b) => VALID_KINDS.has(b.kind)),
      },
    }
    return {
      draft: {
        ...s.draft,
        brandKitId: sanitizedListing.brandKitId,
        productId: sanitizedListing.productId,
        market: sanitizedListing.market,
        output: sanitizedListing,
        isGenerating: false,
      },
      showMockPreview: false,
    }
  }),

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
    }),
    {
      name: 'ugc-lab:tiktok-shop',
      storage: idbStorage,  // IDB instead of localStorage (avoid quota errors)
      // Persist working draft (output + brief cache + selections + market)
      // so a hard refresh doesn't wipe the generated listing. isGenerating
      // and showMockPreview are transient/UI state — don't persist them.
      partialize: (s) => ({
        draft: {
          brandKitId: s.draft.brandKitId,
          productId: s.draft.productId,
          referenceImageAssetIds: s.draft.referenceImageAssetIds,
          market: s.draft.market,
          output: s.draft.output,
          isGenerating: false,                  // reset on refresh (never persist mid-gen state)
          productBrief: s.draft.productBrief,
          productBriefKey: s.draft.productBriefKey,
        },
      }),
      // On rehydrate, strip block kinds that have been removed from the union
      // since the listing was saved (e.g., 'offer' as of 2026-06-09). Without
      // this, DescriptionEditor crashes on a missing label lookup.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const blocks = state.draft?.output?.description?.blocks
        if (!Array.isArray(blocks)) return
        const VALID = new Set(['hook', 'pain', 'solution', 'benefits', 'specs', 'reviews', 'usage', 'faq', 'promise', 'cta'])
        state.draft.output!.description.blocks = blocks.filter((b) => VALID.has(b.kind))
      },
    },
  ),
)

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
