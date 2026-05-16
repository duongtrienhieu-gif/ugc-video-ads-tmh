import { create } from 'zustand'

const STORAGE_KEY = 'ai-ugc-lab-settings'

interface SettingsState {
  kieApiKey: string
  geminiApiKey: string
  elevenLabsApiKey: string
  falApiKey: string
  kieCredits: number | null
  setKieApiKey: (key: string) => void
  setGeminiApiKey: (key: string) => void
  setElevenLabsApiKey: (key: string) => void
  setFalApiKey: (key: string) => void
  setKieCredits: (credits: number | null) => void
  hasApiKey: () => boolean
  getApiKey: () => string
  getGeminiApiKey: () => string
  hasGeminiKey: () => boolean
  getElevenLabsApiKey: () => string
  hasElevenLabsKey: () => boolean
  getFalApiKey: () => string
  hasFalKey: () => boolean
}

interface StoredSettings {
  kieApiKey: string
  geminiApiKey: string
  elevenLabsApiKey: string
  falApiKey: string
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
      }
    }
  } catch { /* silent */ }
  return { kieApiKey: '', geminiApiKey: '', elevenLabsApiKey: '', falApiKey: '' }
}

function saveToStorage(s: StoredSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadFromStorage(),
  kieCredits: null,

  setKieApiKey: (key) => {
    set({ kieApiKey: key })
    saveToStorage({
      kieApiKey: key,
      geminiApiKey: get().geminiApiKey,
      elevenLabsApiKey: get().elevenLabsApiKey,
      falApiKey: get().falApiKey,
    })
  },

  setGeminiApiKey: (key) => {
    set({ geminiApiKey: key })
    saveToStorage({
      kieApiKey: get().kieApiKey,
      geminiApiKey: key,
      elevenLabsApiKey: get().elevenLabsApiKey,
      falApiKey: get().falApiKey,
    })
  },

  setElevenLabsApiKey: (key) => {
    set({ elevenLabsApiKey: key })
    saveToStorage({
      kieApiKey: get().kieApiKey,
      geminiApiKey: get().geminiApiKey,
      elevenLabsApiKey: key,
      falApiKey: get().falApiKey,
    })
  },

  setFalApiKey: (key) => {
    set({ falApiKey: key })
    saveToStorage({
      kieApiKey: get().kieApiKey,
      geminiApiKey: get().geminiApiKey,
      elevenLabsApiKey: get().elevenLabsApiKey,
      falApiKey: key,
    })
  },

  setKieCredits: (credits) => set({ kieCredits: credits }),

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
}))
