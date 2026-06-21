// ─────────────────────────────────────────────────────────────────────
// Gift Studio store — zustand + localStorage cache.
//
// State chỉ thuộc app này, KHÔNG đụng store nào khác. Cache draft + ảnh +
// benefits vào localStorage để refresh không mất việc (mirror cách các app
// khác cache cục bộ). Ảnh là asset:xxx nên cache nhẹ.
// ─────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import type { Market } from '../../types/brandKit'
import {
  type GiftDraft,
  type GiftImage,
  type GiftImageKind,
  type GiftBenefits,
  emptyGiftDraft,
  GIFT_IMAGE_KINDS,
} from './types'

const CACHE_KEY = 'gift-studio-draft-v1'

interface PersistShape {
  draft: GiftDraft
  images: GiftImage[]
  benefits: GiftBenefits | null
}

function freshImages(): GiftImage[] {
  return GIFT_IMAGE_KINDS.map((kind) => ({ kind, status: 'idle' as const }))
}

function loadCache(): PersistShape {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistShape>
      return {
        draft: { ...emptyGiftDraft(), ...(parsed.draft ?? {}) },
        images: Array.isArray(parsed.images) && parsed.images.length === GIFT_IMAGE_KINDS.length
          ? parsed.images
          : freshImages(),
        benefits: parsed.benefits ?? null,
      }
    }
  } catch { /* ignore corrupt cache */ }
  return { draft: emptyGiftDraft(), images: freshImages(), benefits: null }
}

interface GiftStudioState {
  draft: GiftDraft
  images: GiftImage[]
  benefits: GiftBenefits | null
  /** Đang sinh benefits (1 call Gemini) trước khi render ảnh. */
  isPreparing: boolean

  // ── draft setters ──
  setProductId: (id: string | null) => void
  setGiftName: (name: string) => void
  setGiftValueRM: (rm: number | null) => void
  setGiftImageRef: (ref: string | null) => void
  setLang: (lang: Market) => void

  // ── pipeline state ──
  setBenefits: (b: GiftBenefits | null) => void
  setPreparing: (v: boolean) => void
  patchImage: (kind: GiftImageKind, patch: Partial<GiftImage>) => void
  resetImages: () => void
  reset: () => void
}

function persist(get: () => GiftStudioState) {
  try {
    const { draft, images, benefits } = get()
    const shape: PersistShape = { draft, images, benefits }
    localStorage.setItem(CACHE_KEY, JSON.stringify(shape))
  } catch { /* quota / private mode — ignore */ }
}

export const useGiftStudioStore = create<GiftStudioState>((set, get) => {
  const init = loadCache()
  const save = () => persist(get)

  return {
    draft: init.draft,
    images: init.images,
    benefits: init.benefits,
    isPreparing: false,

    setProductId: (id) => { set((s) => ({ draft: { ...s.draft, productId: id } })); save() },
    setGiftName: (name) => { set((s) => ({ draft: { ...s.draft, giftName: name } })); save() },
    setGiftValueRM: (rm) => { set((s) => ({ draft: { ...s.draft, giftValueRM: rm } })); save() },
    setGiftImageRef: (ref) => { set((s) => ({ draft: { ...s.draft, giftImageRef: ref } })); save() },
    setLang: (lang) => { set((s) => ({ draft: { ...s.draft, lang } })); save() },

    setBenefits: (b) => { set({ benefits: b }); save() },
    setPreparing: (v) => set({ isPreparing: v }),
    patchImage: (kind, patch) => {
      set((s) => ({ images: s.images.map((im) => (im.kind === kind ? { ...im, ...patch } : im)) }))
      save()
    },
    resetImages: () => { set({ images: freshImages() }); save() },
    reset: () => { set({ draft: emptyGiftDraft(), images: freshImages(), benefits: null, isPreparing: false }); save() },
  }
})
