import { create } from 'zustand'

const STORAGE_KEY = 'ai-ugc-lab-settings'

interface SettingsState {
  kieApiKey: string
  geminiApiKey: string
  elevenLabsApiKey: string
  kieCredits: number | null
  setKieApiKey: (key: string) => void
  setGeminiApiKey: (key: string) => void
  setElevenLabsApiKey: (key: string) => void
  setKieCredits: (credits: number | null) => void
  hasApiKey: () => boolean
  getApiKey: () => string
  getGeminiApiKey: () => string
  hasGeminiKey: () => boolean
  getElevenLabsApiKey: () => string
  hasElevenLabsKey: () => boolean
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        kieApiKey: parsed.kieApiKey ?? '',
        geminiApiKey: parsed.geminiApiKey ?? '',
        elevenLabsApiKey: parsed.elevenLabsApiKey ?? '',
      }
    }
  } catch {}
  return { kieApiKey: '', geminiApiKey: '', elevenLabsApiKey: '' }
}

function saveToStorage(kieApiKey: string, geminiApiKey: string, elevenLabsApiKey: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ kieApiKey, geminiApiKey, elevenLabsApiKey }))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadFromStorage(),
  kieCredits: null,

  setKieApiKey: (key) => {
    set({ kieApiKey: key })
    saveToStorage(key, get().geminiApiKey, get().elevenLabsApiKey)
  },

  setGeminiApiKey: (key) => {
    set({ geminiApiKey: key })
    saveToStorage(get().kieApiKey, key, get().elevenLabsApiKey)
  },

  setElevenLabsApiKey: (key) => {
    set({ elevenLabsApiKey: key })
    saveToStorage(get().kieApiKey, get().geminiApiKey, key)
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
}))
