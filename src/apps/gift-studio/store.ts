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
  type GiftItem,
  emptyGiftDraft,
  emptyGiftItem,
  offerSig,
  GIFT_IMAGE_KINDS,
  MAX_GIFTS,
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
      // Migration cache CŨ (1 quà: giftName/giftValueRM/giftImageRef) → gifts[].
      const old = parsed.draft as unknown as { giftName?: string; giftValueRM?: number | null; giftImageRef?: string | null } | undefined
      if (!Array.isArray(draft.gifts)) {
        draft.gifts = (old?.giftName || old?.giftImageRef)
          ? [{ name: old?.giftName ?? '', valueRM: old?.giftValueRM ?? null, imageRef: old?.giftImageRef ?? null }]
          : [emptyGiftItem()]
      }
      if (draft.gifts.length === 0) draft.gifts = [emptyGiftItem()]
      // Migration: cache cũ (model tier khác) → reset tiers về rỗng, giữ các field khác.
      if (!Array.isArray(draft.tiers)) draft.tiers = []
      if (typeof draft.offerText !== 'string') draft.offerText = ''
      if (typeof draft.tiersSig !== 'string') draft.tiersSig = ''
      const cachedImages = Array.isArray(parsed.images) && parsed.images.length === GIFT_IMAGE_KINDS.length
        ? parsed.images
        : freshImages()
      // Không task nào sống qua reload/đổi tab → reset spinner 'generating' kẹt về 'idle'
      // (nếu giữ nguyên, ô sẽ quay vô hạn dù chẳng có gen nào chạy).
      const images = cachedImages.map((im) => (im.status === 'generating' ? { ...im, status: 'idle' as const } : im))
      return { draft, images, benefits: parsed.benefits ?? null }
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
  /** Đang parse ô dán offer → tiers. */
  isParsing: boolean

  // ── draft setters ──
  setProductId: (id: string | null) => void
  addGift: () => void
  removeGift: (i: number) => void
  updateGift: (i: number, patch: Partial<GiftItem>) => void
  setLang: (lang: Market) => void
  setOfferText: (text: string) => void
  /** Lưu tiers AI parse + sig của (offerText, lang) hiện tại. */
  setTiers: (tiers: GiftTier[]) => void

  // ── pipeline state ──
  setBenefits: (b: GiftBenefits | null) => void
  setPreparing: (v: boolean) => void
  setParsing: (v: boolean) => void
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
    isParsing: false,

    setProductId: (id) => { set((s) => ({ draft: { ...s.draft, productId: id } })); save() },
    addGift: () => { set((s) => (s.draft.gifts.length >= MAX_GIFTS ? s : { draft: { ...s.draft, gifts: [...s.draft.gifts, emptyGiftItem()] } })); save() },
    removeGift: (i) => { set((s) => { const g = s.draft.gifts.filter((_, j) => j !== i); return { draft: { ...s.draft, gifts: g.length ? g : [emptyGiftItem()] } } }); save() },
    updateGift: (i, patch) => { set((s) => ({ draft: { ...s.draft, gifts: s.draft.gifts.map((g, j) => (j === i ? { ...g, ...patch } : g)) } })); save() },
    setLang: (lang) => { set((s) => ({ draft: { ...s.draft, lang } })); save() },
    setOfferText: (text) => { set((s) => ({ draft: { ...s.draft, offerText: text } })); save() },
    setTiers: (tiers) => {
      set((s) => ({ draft: { ...s.draft, tiers, tiersSig: offerSig(s.draft.offerText, s.draft.lang) } }))
      save()
    },

    setBenefits: (b) => { set({ benefits: b }); save() },
    setPreparing: (v) => set({ isPreparing: v }),
    setParsing: (v) => set({ isParsing: v }),
    patchImage: (kind, patch) => {
      set((s) => ({ images: s.images.map((im) => (im.kind === kind ? { ...im, ...patch } : im)) }))
      save()
    },
    resetImages: () => { set({ images: freshImages() }); save() },
    reset: () => { set({ draft: emptyGiftDraft(), images: freshImages(), benefits: null, isPreparing: false, isParsing: false }); save() },
  }
})
