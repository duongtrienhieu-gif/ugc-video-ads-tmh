// Form BG Studio store — zustand + localStorage cache. Chỉ thuộc app này.

import { create } from 'zustand'
import type { Market } from '../../types/brandKit'
import {
  type FormBgDraft,
  type FormBgImage,
  type FormBgPreset,
  type ProductDirection,
  emptyFormBgDraft,
  FORM_BG_VARIANTS,
} from './types'

const CACHE_KEY = 'form-bg-studio-draft-v1'

interface PersistShape {
  draft: FormBgDraft
  images: FormBgImage[]
  direction: ProductDirection | null
}

function freshImages(): FormBgImage[] {
  return Array.from({ length: FORM_BG_VARIANTS }, (_, index) => ({ index, status: 'idle' as const }))
}

function loadCache(): PersistShape {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistShape>
      // Migration: shape ảnh đổi (assetRef → headerRef/footerRef). Cache cũ → reset.
      const imgsOk = Array.isArray(parsed.images)
        && parsed.images.length === FORM_BG_VARIANTS
        && !parsed.images.some((im) => im != null && 'assetRef' in (im as object))
      return {
        draft: { ...emptyFormBgDraft(), ...(parsed.draft ?? {}) },
        images: imgsOk ? (parsed.images as FormBgImage[]) : freshImages(),
        direction: parsed.direction ?? null,
      }
    }
  } catch { /* ignore */ }
  return { draft: emptyFormBgDraft(), images: freshImages(), direction: null }
}

interface FormBgState {
  draft: FormBgDraft
  images: FormBgImage[]
  direction: ProductDirection | null
  isAnalyzing: boolean

  setProductId: (id: string | null) => void
  setGiftImageRef: (ref: string | null) => void
  setPreset: (p: FormBgPreset) => void
  setLang: (lang: Market) => void

  setDirection: (d: ProductDirection | null) => void
  setAnalyzing: (v: boolean) => void
  patchImage: (index: number, patch: Partial<FormBgImage>) => void
  resetImages: () => void
}

function persist(get: () => FormBgState) {
  try {
    const { draft, images, direction } = get()
    localStorage.setItem(CACHE_KEY, JSON.stringify({ draft, images, direction } as PersistShape))
  } catch { /* ignore */ }
}

export const useFormBgStore = create<FormBgState>((set, get) => {
  const init = loadCache()
  const save = () => persist(get)
  return {
    draft: init.draft,
    images: init.images,
    direction: init.direction,
    isAnalyzing: false,

    setProductId: (id) => { set((s) => ({ draft: { ...s.draft, productId: id } })); save() },
    setGiftImageRef: (ref) => { set((s) => ({ draft: { ...s.draft, giftImageRef: ref } })); save() },
    setPreset: (p) => { set((s) => ({ draft: { ...s.draft, preset: p } })); save() },
    setLang: (lang) => { set((s) => ({ draft: { ...s.draft, lang } })); save() },

    setDirection: (d) => { set({ direction: d }); save() },
    setAnalyzing: (v) => set({ isAnalyzing: v }),
    patchImage: (index, patch) => {
      set((s) => ({ images: s.images.map((im) => (im.index === index ? { ...im, ...patch } : im)) }))
      save()
    },
    resetImages: () => { set({ images: freshImages() }); save() },
  }
})
