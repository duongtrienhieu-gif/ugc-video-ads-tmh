// ─────────────────────────────────────────────────────────────────────
// Gift Studio store — zustand + localStorage cache.
//
// State chỉ thuộc app này, KHÔNG đụng store nào khác. Cache draft + ảnh +
// benefits vào localStorage để refresh không mất việc. Ảnh là asset:xxx.
// ─────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import type { Market } from '../../types/brandKit'
import {
  type GiftDraft,
  type GiftImage,
  type GiftImageKind,
  type GiftBenefits,
  type GiftTier,
  emptyGiftDraft,
  newGiftTier,
  MAX_GIFT_TIERS,
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
      const base = emptyGiftDraft()
      const draft: GiftDraft = { ...base, ...(parsed.draft ?? {}) }
      // Migration: cache cũ (trước khi có tier) → đảm bảo luôn có ≥1 tier hợp lệ.
      if (!Array.isArray(draft.tiers) || draft.tiers.length === 0) {
        draft.tiers = [newGiftTier(1, 1)]
      }
      return {
        draft,
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

  // ── tier setters ──
  addTier: () => void
  removeTier: (id: string) => void
  updateTier: (id: string, patch: Partial<Omit<GiftTier, 'id'>>) => void

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

    addTier: () => {
      set((s) => {
        if (s.draft.tiers.length >= MAX_GIFT_TIERS) return s
        const last = s.draft.tiers[s.draft.tiers.length - 1]
        const next = newGiftTier((last?.buyQty ?? 0) + 1, (last?.giftQty ?? 0) + 1)
        return { draft: { ...s.draft, tiers: [...s.draft.tiers, next] } }
      })
      save()
    },
    removeTier: (id) => {
      set((s) => {
        if (s.draft.tiers.length <= 1) return s // luôn giữ ≥1 tier
        return { draft: { ...s.draft, tiers: s.draft.tiers.filter((t) => t.id !== id) } }
      })
      save()
    },
    updateTier: (id, patch) => {
      set((s) => ({
        draft: { ...s.draft, tiers: s.draft.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) },
      }))
      save()
    },

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
