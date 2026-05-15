import { create } from 'zustand'

const STORAGE_KEY = 'ai-ugc-lab-settings'

interface SettingsState {
  kieApiKey: string
  geminiApiKey: string
  googleTtsApiKey: string
  kieCredits: number | null
  setKieApiKey: (key: string) => void
  setGeminiApiKey: (key: string) => void
  setGoogleTtsApiKey: (key: string) => void
  setKieCredits: (credits: number | null) => void
  hasApiKey: () => boolean
  getApiKey: () => string
  getGeminiApiKey: () => string
  hasGeminiKey: () => boolean
  getGoogleTtsApiKey: () => string
  hasGoogleTtsKey: () => boolean
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        kieApiKey: parsed.kieApiKey ?? '',
        geminiApiKey: parsed.geminiApiKey ?? '',
        googleTtsApiKey: parsed.googleTtsApiKey ?? '',
      }
    }
  } catch {}
  return { kieApiKey: '', geminiApiKey: '', googleTtsApiKey: '' }
}

function saveToStorage(kieApiKey: string, geminiApiKey: string, googleTtsApiKey: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ kieApiKey, geminiApiKey, googleTtsApiKey }))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadFromStorage(),
  kieCredits: null,

  setKieApiKey: (key) => {
    set({ kieApiKey: key })
    saveToStorage(key, get().geminiApiKey, get().googleTtsApiKey)
  },

  setGeminiApiKey: (key) => {
    set({ geminiApiKey: key })
    saveToStorage(get().kieApiKey, key, get().googleTtsApiKey)
  },

  setGoogleTtsApiKey: (key) => {
    set({ googleTtsApiKey: key })
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

  getGoogleTtsApiKey: () => {
    // Fallback to Gemini key if no dedicated TTS key set (for users with unrestricted key)
    const key = get().googleTtsApiKey || get().geminiApiKey
    if (!key) throw new Error('Vui lòng nhập Google Cloud TTS API key trong Cài đặt')
    return key
  },

  hasGoogleTtsKey: () => get().googleTtsApiKey.length > 0 || get().geminiApiKey.length > 0,
}))
