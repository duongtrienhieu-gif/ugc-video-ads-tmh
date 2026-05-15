import { create } from 'zustand'
import type { TranslationItem } from '../apps/video-translate/types'

const STORAGE_KEY = 'video-translate-history-v1'

interface VideoTranslateState {
  history: TranslationItem[]
  addItem: (item: TranslationItem) => void
  updateItem: (id: string, patch: Partial<TranslationItem>) => void
  removeItem: (id: string) => void
  setHistory: (items: TranslationItem[]) => void
  clearAll: () => void
}

function serialize(items: TranslationItem[]): string {
  return JSON.stringify(items.map((h) => ({
    id:                  h.id,
    dubbingId:           h.dubbingId,
    name:                h.name,
    sourceLang:          h.sourceLang,
    targetLang:          h.targetLang,
    status:              h.status,
    assetId:             h.assetId ?? null,
    audioAssetId:        h.audioAssetId ?? null,
    imageAssetId:        h.imageAssetId ?? null,
    errorMessage:        h.errorMessage,
    expectedDurationSec: h.expectedDurationSec,
    createdAt:           h.createdAt,
  })))
}

function loadFromStorage(): TranslationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Partial<TranslationItem>>
    return parsed.map((p) => ({
      id:                  p.id ?? crypto.randomUUID(),
      dubbingId:           p.dubbingId ?? '',
      name:                p.name ?? 'video',
      sourceLang:          p.sourceLang ?? 'auto',
      targetLang:          p.targetLang ?? 'en',
      status:              p.status ?? 'dubbed',
      videoUrl:            null,
      assetId:             p.assetId ?? null,
      audioAssetId:        p.audioAssetId ?? null,
      imageAssetId:        p.imageAssetId ?? null,
      errorMessage:        p.errorMessage,
      expectedDurationSec: p.expectedDurationSec,
      createdAt:           p.createdAt ?? Date.now(),
    } as TranslationItem))
  } catch {
    return []
  }
}

function saveToStorage(items: TranslationItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(items))
  } catch { /* silent */ }
}

export const useVideoTranslateStore = create<VideoTranslateState>((set, get) => ({
  history: loadFromStorage(),

  addItem: (item) => {
    const next = [item, ...get().history]
    saveToStorage(next)
    set({ history: next })
  },

  updateItem: (id, patch) => {
    const next = get().history.map((h) => (h.id === id ? { ...h, ...patch } : h))
    saveToStorage(next)
    set({ history: next })
  },

  removeItem: (id) => {
    const next = get().history.filter((h) => h.id !== id)
    saveToStorage(next)
    set({ history: next })
  },

  setHistory: (items) => {
    saveToStorage(items)
    set({ history: items })
  },

  clearAll: () => {
    saveToStorage([])
    set({ history: [] })
  },
}))
