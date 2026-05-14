import { create } from 'zustand'

const STORAGE_KEY = 'ai-ugc-lab-settings'

interface SettingsState {
  kieApiKey: string
  geminiApiKey: string
  kieCredits: number | null
  setKieApiKey: (key: string) => void
  setGeminiApiKey: (key: string) => void
  setKieCredits: (credits: number | null) => void
  hasApiKey: () => boolean
  getApiKey: () => string
  getGeminiApiKey: () => string
  hasGeminiKey: () => boolean
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        kieApiKey: parsed.kieApiKey ?? '',
        geminiApiKey: parsed.geminiApiKey ?? '',
      }
    }
  } catch {}
  return { kieApiKey: '', geminiApiKey: '' }
}

function saveToStorage(kieApiKey: string, geminiApiKey: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ kieApiKey, geminiApiKey }))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadFromStorage(),
  kieCredits: null,

  setKieApiKey: (key) => {
    set({ kieApiKey: key })
    saveToStorage(key, get().geminiApiKey)
  },

  setGeminiApiKey: (key) => {
    set({ geminiApiKey: key })
    saveToStorage(get().kieApiKey, key)
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
}))
