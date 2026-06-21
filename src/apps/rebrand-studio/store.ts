// Re-Branding store — zustand + localStorage. Chỉ thuộc mode này.

import { create } from 'zustand'
import type { Market } from '../../types/brandKit'
import {
  type RebrandDraft,
  type RebrandImage,
  type RebrandImageKind,
  type RebrandIdentity,
  emptyRebrandDraft,
  REBRAND_IMAGE_KINDS,
  MAX_ORIGINAL_IMAGES,
} from './types'

const CACHE_KEY = 'rebrand-studio-draft-v1'

interface PersistShape {
  draft: RebrandDraft
  images: RebrandImage[]
  identity: RebrandIdentity | null
}

function freshImages(): RebrandImage[] {
  return REBRAND_IMAGE_KINDS.map((kind) => ({ kind, status: 'idle' as const }))
}

function loadCache(): PersistShape {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistShape>
      return {
        draft: { ...emptyRebrandDraft(), ...(parsed.draft ?? {}) },
        images: Array.isArray(parsed.images) && parsed.images.length === REBRAND_IMAGE_KINDS.length ? parsed.images : freshImages(),
        identity: parsed.identity ?? null,
      }
    }
  } catch { /* ignore */ }
  return { draft: emptyRebrandDraft(), images: freshImages(), identity: null }
}

interface RebrandState {
  draft: RebrandDraft
  images: RebrandImage[]
  identity: RebrandIdentity | null
  isAnalyzing: boolean

  setProductId: (id: string | null) => void
  addOriginalImage: (ref: string) => void
  removeOriginalImage: (ref: string) => void
  setWidthCm: (v: number | null) => void
  setHeightCm: (v: number | null) => void
  setMarket: (m: Market) => void
  setChosenName: (n: string | null) => void

  setIdentity: (d: RebrandIdentity | null) => void
  setAnalyzing: (v: boolean) => void
  patchImage: (kind: RebrandImageKind, patch: Partial<RebrandImage>) => void
  resetImages: () => void
}

function persist(get: () => RebrandState) {
  try {
    const { draft, images, identity } = get()
    localStorage.setItem(CACHE_KEY, JSON.stringify({ draft, images, identity } as PersistShape))
  } catch { /* ignore */ }
}

export const useRebrandStore = create<RebrandState>((set, get) => {
  const init = loadCache()
  const save = () => persist(get)
  return {
    draft: init.draft,
    images: init.images,
    identity: init.identity,
    isAnalyzing: false,

    setProductId: (id) => { set((s) => ({ draft: { ...s.draft, productId: id } })); save() },
    addOriginalImage: (ref) => {
      set((s) => {
        if (s.draft.originalImageRefs.length >= MAX_ORIGINAL_IMAGES || s.draft.originalImageRefs.includes(ref)) return s
        return { draft: { ...s.draft, originalImageRefs: [...s.draft.originalImageRefs, ref] } }
      })
      save()
    },
    removeOriginalImage: (ref) => {
      set((s) => ({ draft: { ...s.draft, originalImageRefs: s.draft.originalImageRefs.filter((r) => r !== ref) } }))
      save()
    },
    setWidthCm: (v) => { set((s) => ({ draft: { ...s.draft, widthCm: v } })); save() },
    setHeightCm: (v) => { set((s) => ({ draft: { ...s.draft, heightCm: v } })); save() },
    setMarket: (m) => { set((s) => ({ draft: { ...s.draft, market: m } })); save() },
    setChosenName: (n) => { set((s) => ({ draft: { ...s.draft, chosenName: n } })); save() },

    setIdentity: (d) => { set({ identity: d }); save() },
    setAnalyzing: (v) => set({ isAnalyzing: v }),
    patchImage: (kind, patch) => {
      set((s) => ({ images: s.images.map((im) => (im.kind === kind ? { ...im, ...patch } : im)) }))
      save()
    },
    resetImages: () => { set({ images: freshImages() }); save() },
  }
})
