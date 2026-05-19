import { create } from 'zustand'

const STORAGE_KEY = 'ai-ugc-lab-settings'

// Z30 — Phase 1 reset. v3 is the new creator-first Ads Video Engine.
//   v1 = stable legacy pipeline
//   v2 = AI Director (cinematic / coverage-graph — DEPRECATED, kept for
//        reference + escape hatch; will be removed in a future cleanup)
//   v3 = Ads Video — AI UGC Ad Engine (creator-first, preview-first,
//        action-preset based — NEW DEFAULT)
export type PipelineVersion = 'v1' | 'v2' | 'v3'

interface SettingsState {
  kieApiKey: string
  geminiApiKey: string
  elevenLabsApiKey: string
  falApiKey: string
  shotstackApiKey: string
  kieCredits: number | null
  /** UGC Builder pipeline version. v1 = stable (production), v2 = AI Director beta. */
  pipelineVersion: PipelineVersion
  setKieApiKey: (key: string) => void
  setGeminiApiKey: (key: string) => void
  setElevenLabsApiKey: (key: string) => void
  setFalApiKey: (key: string) => void
  setShotstackApiKey: (key: string) => void
  setKieCredits: (credits: number | null) => void
  setPipelineVersion: (v: PipelineVersion) => void
  hasApiKey: () => boolean
  getApiKey: () => string
  getGeminiApiKey: () => string
  hasGeminiKey: () => boolean
  getElevenLabsApiKey: () => string
  hasElevenLabsKey: () => boolean
  getFalApiKey: () => string
  hasFalKey: () => boolean
  getShotstackApiKey: () => string
  hasShotstackKey: () => boolean
}

interface StoredSettings {
  kieApiKey: string
  geminiApiKey: string
  elevenLabsApiKey: string
  falApiKey: string
  shotstackApiKey: string
  pipelineVersion: PipelineVersion
}

function loadFromStorage(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        kieApiKey:        parsed.kieApiKey        ?? '',
        geminiApiKey:     parsed.geminiApiKey     ?? '',
        elevenLabsApiKey: parsed.elevenLabsApiKey ?? '',
        falApiKey:        parsed.falApiKey        ?? '',
        shotstackApiKey:  parsed.shotstackApiKey  ?? '',
        // Z37 — Auto-migrate v2 → v3. v2 cinematic pipeline is deprecated;
        // the user wants the v3 Ads Video Engine. Existing v2 users get
        // bumped forward on next load. v2 stays reachable via Legacy menu
        // in the v3 shell for anyone with in-progress work.
        // v1 stays as-is (truly stable legacy).
        pipelineVersion:  (
          parsed.pipelineVersion === 'v3' ? 'v3' :
          parsed.pipelineVersion === 'v2' ? 'v3' :  // ← auto-migrate
          parsed.pipelineVersion === 'v1' ? 'v1' :
          'v3'  // Z30 — default new sessions to v3 Ads Video Engine
        ),
      }
    }
  } catch { /* silent */ }
  // Z30 — first-time users land on v3 (creator-first), not the legacy v1.
  return { kieApiKey: '', geminiApiKey: '', elevenLabsApiKey: '', falApiKey: '', shotstackApiKey: '', pipelineVersion: 'v3' }
}

function saveToStorage(s: StoredSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

function getStored(get: () => SettingsState): StoredSettings {
  const s = get()
  return {
    kieApiKey:        s.kieApiKey,
    geminiApiKey:     s.geminiApiKey,
    elevenLabsApiKey: s.elevenLabsApiKey,
    falApiKey:        s.falApiKey,
    shotstackApiKey:  s.shotstackApiKey,
    pipelineVersion:  s.pipelineVersion,
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadFromStorage(),
  kieCredits: null,

  setKieApiKey: (key) => {
    set({ kieApiKey: key })
    saveToStorage({ ...getStored(get), kieApiKey: key })
  },

  setGeminiApiKey: (key) => {
    set({ geminiApiKey: key })
    saveToStorage({ ...getStored(get), geminiApiKey: key })
  },

  setElevenLabsApiKey: (key) => {
    set({ elevenLabsApiKey: key })
    saveToStorage({ ...getStored(get), elevenLabsApiKey: key })
  },

  setFalApiKey: (key) => {
    set({ falApiKey: key })
    saveToStorage({ ...getStored(get), falApiKey: key })
  },

  setShotstackApiKey: (key) => {
    set({ shotstackApiKey: key })
    saveToStorage({ ...getStored(get), shotstackApiKey: key })
  },

  setKieCredits: (credits) => set({ kieCredits: credits }),

  setPipelineVersion: (v) => {
    set({ pipelineVersion: v })
    saveToStorage({ ...getStored(get), pipelineVersion: v })
  },

  hasApiKey: () => get().kieApiKey.length > 0,

  getApiKey: () => {
    const key = get().kieApiKey
    if (!key) throw new Error('Vui lòng nhập kie.ai API key trong Cài đặt')
    return key
  },

  getGeminiApiKey: () => {
    const key = get().geminiApiKey
    if (!key) throw new Error('Vui lòng nhập Google Gemini API key trong Cài đặt')
    return key
  },

  hasGeminiKey: () => get().geminiApiKey.length > 0,

  getElevenLabsApiKey: () => {
    const key = get().elevenLabsApiKey
    if (!key) throw new Error('Vui lòng nhập ElevenLabs API key trong Cài đặt')
    return key
  },

  hasElevenLabsKey: () => get().elevenLabsApiKey.length > 0,

  getFalApiKey: () => {
    const key = get().falApiKey
    if (!key) throw new Error('Vui lòng nhập fal.ai API key trong Cài đặt')
    return key
  },

  hasFalKey: () => get().falApiKey.length > 0,

  getShotstackApiKey: () => {
    const key = get().shotstackApiKey
    if (!key) throw new Error('Vui lòng nhập Shotstack API key trong Cài đặt')
    return key
  },

  hasShotstackKey: () => get().shotstackApiKey.length > 0,
}))
