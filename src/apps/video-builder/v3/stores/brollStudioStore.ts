// ── B-roll Studio (Mode 2) — its OWN store, fully separate from mode-1 ────────
// The user wants Mode 2 standalone: NO shared state with the hybrid/script flow. The
// only GLOBAL input is the PRODUCT (every scene revolves around it) + a language pick
// (VN / MS / EN — the user runs both markets, never hardcoded). Avatar/voice are chosen
// PER-SCENE (project pick or upload) at render time, so they don't live here. Persisted
// under its own key so it never collides with the mode-1 store.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '../../../../stores/types'
import type { ScriptLang } from '../types'

interface BrollStudioState {
  product: Product | null
  lang: ScriptLang
  setProduct: (product: Product | null) => void
  setLang: (lang: ScriptLang) => void
}

export const useBrollStudioStore = create<BrollStudioState>()(
  persist(
    (set) => ({
      product: null,
      lang: 'vi',
      setProduct: (product) => set({ product }),
      setLang: (lang) => set({ lang }),
    }),
    { name: 'broll-studio-v1' },
  ),
)
