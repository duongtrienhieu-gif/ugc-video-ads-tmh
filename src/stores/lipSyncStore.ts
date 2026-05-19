/**
 * Lip Sync history store — Supabase-backed for cross-device sync.
 *
 * Persistence layers:
 *   1. zustand-managed in-memory state + manual localStorage cache
 *      (`lip-sync-history-v1`) — offline / fast boot
 *   2. Supabase `user_outputs` table with kind='lip-sync-history'
 *      (source of truth)
 *
 * Asset blobs (image / audio / video) ALREADY live in Supabase Storage
 * via assetStore — `imageAssetId` / `audioAssetId` / `videoAssetId` are
 * portable refs. Only the per-item metadata (script, voice, status,
 * createdAt) needs the sync layer to be cross-device.
 *
 * Stays callable offline / not-logged-in — every cloud op is best-effort.
 */
import { create } from 'zustand'
import type { LipSyncHistoryItem } from '../apps/lip-sync/types'
import {
  listOutputs, createOutput, updateOutput, deleteOutput,
} from '../services/userOutputsAPI'

const STORAGE_KEY = 'lip-sync-history-v1'
const KIND = 'lip-sync-history' as const

interface LipSyncCloudItem extends LipSyncHistoryItem {
  /** userOutputsAPI requires this field on items it ingests. Always
   *  derived from voiceName + first words of script. */
  title?: string
}

interface LipSyncState {
  history: LipSyncHistoryItem[]
  hydrated: boolean
  hydrating: boolean

  hydrate: () => Promise<void>
  addItem: (item: LipSyncHistoryItem) => void
  updateItem: (id: string, patch: Partial<LipSyncHistoryItem>) => void
  removeItem: (id: string) => void
  setHistory: (items: LipSyncHistoryItem[]) => void
  clearAll: () => void
}

// ── localStorage cache (no transient blob URLs) ──────────────────────────

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
    return parsed.map(rehydrateItem)
  } catch {
    return []
  }
}

function rehydrateItem(p: Partial<LipSyncHistoryItem>): LipSyncHistoryItem {
  return {
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
  } as LipSyncHistoryItem
}

function saveToStorage(items: LipSyncHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(items))
  } catch { /* quota exceeded, silent */ }
}

function deriveTitle(item: LipSyncHistoryItem): string {
  const scriptPreview = (item.scriptText ?? '').slice(0, 40).replace(/\s+/g, ' ').trim()
  const voice = item.voiceName ? `[${item.voiceName}]` : ''
  return `${voice} ${scriptPreview}`.trim() || `Lip Sync · ${new Date(item.createdAt).toLocaleString('vi-VN')}`
}

// ── Store ────────────────────────────────────────────────────────────────

export const useLipSyncStore = create<LipSyncState>((set, get) => ({
  history: loadFromStorage(),
  hydrated: false,
  hydrating: false,

  hydrate: async () => {
    if (get().hydrating) return
    set({ hydrating: true })
    try {
      const remote = await listOutputs<LipSyncCloudItem>(KIND)
      if (remote === null) {
        set({ hydrating: false, hydrated: true })
        return
      }

      const local = get().history
      const remoteIds = new Set(remote.map((r) => r.id))
      const localOnly = local.filter((l) => !remoteIds.has(l.id))

      // First-sync — upload localStorage history to Supabase once
      if (localOnly.length > 0 && remote.length === 0) {
        console.info(`[lipSyncStore] first-sync: uploading ${localOnly.length} local items`)
        for (const item of localOnly) {
          await createOutput(KIND, { ...item, title: deriveTitle(item) }, deriveTitle(item))
        }
        const refreshed = await listOutputs<LipSyncCloudItem>(KIND) ?? []
        const merged = refreshed.length > 0 ? refreshed.map(rehydrateItem) : local
        saveToStorage(merged)
        set({ history: merged, hydrating: false, hydrated: true })
        return
      }

      // Normal merge — remote items rehydrated to clear stale transient
      // urls; local-only items kept in front so unsynced offline writes
      // aren't lost
      const remoteRehydrated = remote.map(rehydrateItem)
      const merged = [...remoteRehydrated, ...localOnly]
      saveToStorage(merged)
      set({ history: merged, hydrating: false, hydrated: true })
    } catch (err) {
      console.error('[lipSyncStore] hydrate failed:', err)
      set({ hydrating: false, hydrated: true })
    }
  },

  addItem: (item) => {
    const next = [item, ...get().history]
    saveToStorage(next)
    set({ history: next })
    void createOutput(KIND, { ...item, title: deriveTitle(item) }, deriveTitle(item))
  },

  updateItem: (id, patch) => {
    const next = get().history.map((h) => (h.id === id ? { ...h, ...patch } : h))
    saveToStorage(next)
    set({ history: next })
    const updated = next.find((h) => h.id === id)
    if (updated) {
      void updateOutput(KIND, id, { ...updated, title: deriveTitle(updated) }, deriveTitle(updated))
    }
  },

  removeItem: (id) => {
    const next = get().history.filter((h) => h.id !== id)
    saveToStorage(next)
    set({ history: next })
    void deleteOutput(KIND, id)
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
