import { create } from 'zustand'

const STORAGE_KEY = 'ai-ugc-lab-settings'

interface SettingsState {
  kieApiKey: string
  kieCredits: number | null
  setKieApiKey: (key: string) => void
  setKieCredits: (credits: number | null) => void
  hasApiKey: () => boolean
  getApiKey: () => string
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { kieApiKey: parsed.kieApiKey ?? '' }
    }
  } catch {}
  return { kieApiKey: '' }
}

function saveToStorage(kieApiKey: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ kieApiKey }))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadFromStorage(),
  kieCredits: null,

  setKieApiKey: (key) => {
    set({ kieApiKey: key })
    saveToStorage(key)
  },

  setKieCredits: (credits) => set({ kieCredits: credits }),

  hasApiKey: () => get().kieApiKey.length > 0,

  getApiKey: () => {
    const key = get().kieApiKey
    if (!key) throw new Error('Vui lòng nhập kie.ai API key trong Cài đặt')
    return key
  },
}))
