import { create } from 'zustand'
import type { LipSyncHistoryItem } from '../apps/lip-sync/types'

const STORAGE_KEY = 'lip-sync-history-v1'

interface LipSyncState {
  history: LipSyncHistoryItem[]
  addItem: (item: LipSyncHistoryItem) => void
  updateItem: (id: string, patch: Partial<LipSyncHistoryItem>) => void
  removeItem: (id: string) => void
  setHistory: (items: LipSyncHistoryItem[]) => void
  clearAll: () => void
}

// Serialize only persistent fields (no transient blob URLs)
function serialize(items: LipSyncHistoryItem[]): string {
  return JSON.stringify(items.map((h) => ({
    id:           h.id,
    imageAssetId: h.imageAssetId ?? null,
    audioAssetId: h.audioAssetId ?? null,
    videoAssetId: h.videoAssetId ?? null,
    scriptText:   h.scriptText,
    voiceName:    h.voiceName,
    modelName:    h.modelName,
    status:       h.status,
    errorMessage: h.errorMessage,
    taskId:       h.taskId,
    createdAt:    h.createdAt,
  })))
}

function loadFromStorage(): LipSyncHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Partial<LipSyncHistoryItem>>
    return parsed.map((p) => ({
      id:           p.id ?? crypto.randomUUID(),
      imageAssetId: p.imageAssetId ?? null,
      audioAssetId: p.audioAssetId ?? null,
      videoAssetId: p.videoAssetId ?? null,
      imageUrl:     '',
      audioUrl:     '',
      videoUrl:     null,
      scriptText:   p.scriptText ?? '',
      voiceName:    p.voiceName ?? '',
      modelName:    p.modelName ?? '',
      status:       p.status ?? 'completed',
      errorMessage: p.errorMessage,
      taskId:       p.taskId ?? '',
      createdAt:    p.createdAt ?? Date.now(),
    } as LipSyncHistoryItem))
  } catch {
    return []
  }
}

function saveToStorage(items: LipSyncHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(items))
  } catch { /* quota exceeded, silent */ }
}

export const useLipSyncStore = create<LipSyncState>((set, get) => ({
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
