// Re-Branding store — zustand + localStorage. Chỉ thuộc mode này.

import { create } from 'zustand'
import type { Market } from '../../types/brandKit'
import {
  type RebrandDraft,
  type RebrandImage,
  type RebrandImageKind,
  type RebrandIdentity,
  type PackagingType,
  type LabelModel,
  emptyRebrandDraft,
  REBRAND_IMAGE_KINDS,
  MAX_ORIGINAL_IMAGES,
} from './types'

const CACHE_KEY = 'rebrand-studio-draft-v1'
const SETS_KEY = 'rebrand-studio-sets-v1'

interface PersistShape {
  draft: RebrandDraft
  images: RebrandImage[]
  identity: RebrandIdentity | null
}

/** 1 bộ ảnh rebrand đã lưu (thư viện). */
export interface SavedRebrandSet {
  id: string
  name: string
  savedAt: number
  draft: RebrandDraft
  identity: RebrandIdentity | null
  images: RebrandImage[]
}

function freshImages(): RebrandImage[] {
  return REBRAND_IMAGE_KINDS.map((kind) => ({ kind, status: 'idle' as const }))
}

function loadSets(): SavedRebrandSet[] {
  try { return JSON.parse(localStorage.getItem(SETS_KEY) || '[]') as SavedRebrandSet[] } catch { return [] }
}
function persistSets(sets: SavedRebrandSet[]) {
  try { localStorage.setItem(SETS_KEY, JSON.stringify(sets)) } catch { /* ignore */ }
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
  setPackagingType: (t: PackagingType) => void
  setLabelModel: (m: LabelModel) => void
  setMfgDate: (v: string) => void
  setExpDate: (v: string) => void
  setMarket: (m: Market) => void
  setChosenName: (n: string | null) => void

  // ── thư viện bộ ảnh ──
  savedSets: SavedRebrandSet[]
  saveCurrentSet: (name: string) => void
  newSet: () => void
  openSet: (id: string) => void
  deleteSet: (id: string) => void

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
    savedSets: loadSets(),

    saveCurrentSet: (name) => {
      const { draft, identity, images, savedSets } = get()
      const item: SavedRebrandSet = {
        id: `set-${crypto.randomUUID().slice(0, 8)}`,
        name: name.trim() || (draft.chosenName ?? 'Bộ rebrand'),
        savedAt: Date.now(),
        draft, identity, images,
      }
      const next = [item, ...savedSets].slice(0, 50)
      set({ savedSets: next }); persistSets(next)
    },
    newSet: () => { set({ draft: emptyRebrandDraft(), images: freshImages(), identity: null }); save() },
    openSet: (id) => {
      const s = get().savedSets.find((x) => x.id === id)
      if (!s) return
      set({ draft: s.draft, identity: s.identity, images: s.images }); save()
    },
    deleteSet: (id) => {
      const next = get().savedSets.filter((x) => x.id !== id)
      set({ savedSets: next }); persistSets(next)
    },

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
    setPackagingType: (t) => { set((s) => ({ draft: { ...s.draft, packagingType: t } })); save() },
    setLabelModel: (m) => { set((s) => ({ draft: { ...s.draft, labelModel: m } })); save() },
    setMfgDate: (v) => { set((s) => ({ draft: { ...s.draft, mfgDate: v } })); save() },
    setExpDate: (v) => { set((s) => ({ draft: { ...s.draft, expDate: v } })); save() },
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
