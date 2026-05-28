/**
 * Video Translate history store — Supabase-backed for cross-device sync.
 *
 * Persistence layers:
 *   1. zustand-managed in-memory state + manual localStorage cache
 *      (`video-translate-history-v1`) — offline / fast boot
 *   2. Supabase `user_outputs` table with kind='video-translate-history'
 *      (source of truth)
 *
 * Asset blobs (video / audio / extracted frame) ALREADY live in Supabase
 * Storage via assetStore — `assetId` / `audioAssetId` / `imageAssetId`
 * are portable refs. Only the per-item metadata (lang, status, dubbingId,
 * createdAt) needs the sync layer to be cross-device.
 *
 * Stays callable offline / not-logged-in — every cloud op is best-effort.
 */
import { create } from 'zustand'
import type { TranslationItem } from '../apps/video-translate/types'
import {
  listOutputs, createOutput, updateOutput, deleteOutput,
} from '../services/userOutputsAPI'

const STORAGE_KEY = 'video-translate-history-v1'
const KIND = 'video-translate-history' as const

interface VideoTranslateCloudItem extends TranslationItem {
  /** Required by userOutputsAPI — derived from item.name + lang pair. */
  title?: string
}

interface VideoTranslateState {
  history: TranslationItem[]
  hydrated: boolean
  hydrating: boolean

  hydrate: () => Promise<void>
  addItem: (item: TranslationItem) => void
  updateItem: (id: string, patch: Partial<TranslationItem>) => void
  removeItem: (id: string) => void
  setHistory: (items: TranslationItem[]) => void
  clearAll: () => void
}

// ── localStorage cache (no transient blob URLs) ──────────────────────────

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
    // Phase 5: persist these so refresh-resume can pick up in-flight jobs
    lipSyncRequestId:    h.lipSyncRequestId,
    rawErrorBody:        h.rawErrorBody,
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
    return parsed.map(rehydrateItem)
  } catch {
    return []
  }
}

function rehydrateItem(p: Partial<TranslationItem>): TranslationItem {
  return {
    id:                  p.id ?? crypto.randomUUID(),
    dubbingId:           p.dubbingId ?? '',
    name:                p.name ?? 'video',
    // Phase 1: 'auto' is no longer valid — coerce stale items to 'vi'
    sourceLang:          (p.sourceLang === 'auto' || !p.sourceLang) ? 'vi' : p.sourceLang,
    targetLang:          p.targetLang ?? 'en',
    status:              p.status ?? 'dubbed',
    videoUrl:            null,
    assetId:             p.assetId ?? null,
    audioAssetId:        p.audioAssetId ?? null,
    imageAssetId:        p.imageAssetId ?? null,
    lipSyncRequestId:    p.lipSyncRequestId,
    rawErrorBody:        p.rawErrorBody,
    errorMessage:        p.errorMessage,
    expectedDurationSec: p.expectedDurationSec,
    createdAt:           p.createdAt ?? Date.now(),
  } as TranslationItem
}

function saveToStorage(items: TranslationItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(items))
  } catch { /* silent */ }
}

function deriveTitle(item: TranslationItem): string {
  return `${item.name} (${item.sourceLang} → ${item.targetLang})`.slice(0, 160)
}

// ── Store ────────────────────────────────────────────────────────────────

export const useVideoTranslateStore = create<VideoTranslateState>((set, get) => ({
  history: loadFromStorage(),
  hydrated: false,
  hydrating: false,

  hydrate: async () => {
    if (get().hydrating) return
    set({ hydrating: true })
    try {
      const remote = await listOutputs<VideoTranslateCloudItem>(KIND)
      if (remote === null) {
        set({ hydrating: false, hydrated: true })
        return
      }

      const local = get().history
      const remoteIds = new Set(remote.map((r) => r.id))
      const localOnly = local.filter((l) => !remoteIds.has(l.id))

      if (localOnly.length > 0 && remote.length === 0) {
        console.info(`[videoTranslateStore] first-sync: uploading ${localOnly.length} local items`)
        for (const item of localOnly) {
          await createOutput(KIND, { ...item, title: deriveTitle(item) }, deriveTitle(item))
        }
        const refreshed = await listOutputs<VideoTranslateCloudItem>(KIND) ?? []
        const merged = refreshed.length > 0 ? refreshed.map(rehydrateItem) : local
        saveToStorage(merged)
        set({ history: merged, hydrating: false, hydrated: true })
        return
      }

      const remoteRehydrated = remote.map(rehydrateItem)
      const merged = [...remoteRehydrated, ...localOnly]
      saveToStorage(merged)
      set({ history: merged, hydrating: false, hydrated: true })
    } catch (err) {
      console.error('[videoTranslateStore] hydrate failed:', err)
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
