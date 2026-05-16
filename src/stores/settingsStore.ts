import { create } from 'zustand'

const STORAGE_KEY = 'ai-ugc-lab-settings'

export type PipelineVersion = 'v1' | 'v2'

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
        pipelineVersion:  (parsed.pipelineVersion === 'v2' ? 'v2' : 'v1'),
      }
    }
  } catch { /* silent */ }
  return { kieApiKey: '', geminiApiKey: '', elevenLabsApiKey: '', falApiKey: '', shotstackApiKey: '', pipelineVersion: 'v1' }
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
