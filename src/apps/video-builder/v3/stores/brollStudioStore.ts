// ── B-roll Studio (Mode 2) — its OWN store, fully separate from mode-1 ────────
// The user wants Mode 2 standalone: NO shared state with the hybrid/script flow. The
// only GLOBAL input is the PRODUCT (every scene revolves around it) + a language pick
// (VN / MS / EN — the user runs both markets, never hardcoded). Avatar/voice are chosen
// PER-SCENE (project pick or upload) at render time, so they don't live here. Rendered
// clips persist by angle id (Supabase asset id → survives reload). Persisted under its
// own key so it never collides with the mode-1 store.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '../../../../stores/types'
import type { ScriptLang } from '../types'
import type { StudioResolution } from '../services/brollStudioModels'

/** A finished render for one angle — the video lives in Supabase Storage (asset id). */
export interface StudioSceneResult {
  videoAssetId: string
  durationSec: number
  resolution: StudioResolution
  label: string
  createdAt: number
}

interface BrollStudioState {
  product: Product | null
  lang: ScriptLang
  scenes: Record<string, StudioSceneResult>   // keyed by angle id
  setProduct: (product: Product | null) => void
  setLang: (lang: ScriptLang) => void
  setSceneResult: (angleId: string, result: StudioSceneResult) => void
  clearSceneResult: (angleId: string) => void
}

export const useBrollStudioStore = create<BrollStudioState>()(
  persist(
    (set) => ({
      product: null,
      lang: 'vi',
      scenes: {},
      setProduct: (product) => set({ product }),
      setLang: (lang) => set({ lang }),
      setSceneResult: (angleId, result) =>
        set((s) => ({ scenes: { ...s.scenes, [angleId]: result } })),
      clearSceneResult: (angleId) =>
        set((s) => {
          const next = { ...s.scenes }; delete next[angleId]
          return { scenes: next }
        }),
    }),
    { name: 'broll-studio-v1' },
  ),
)
