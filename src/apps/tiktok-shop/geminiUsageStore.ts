// geminiUsageStore — tracks Gemini API calls today to warn user before
// hitting free tier daily limit (1500 RPD for gemini-2.5-flash).
//
// Storage: IndexedDB (Phase 10.3 hotfix — was localStorage but the user's
// localStorage was full from accumulated app state, even the tiny ~50 byte
// counter triggered QuotaExceededError. IDB has effectively unlimited quota).
//
// Auto-resets at midnight (when getCallsToday() runs and detects date change).

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Conservative limit — free tier gemini-2.5-flash is 1500 RPD.
const FREE_TIER_DAILY_LIMIT = 1500

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
}

// ── IndexedDB storage adapter (avoid localStorage quota) ──
const IDB_NAME  = 'ugc-lab-tiktok-shop'  // reuse same DB as main store
const IDB_STORE = 'kv'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch { return null }
}

async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('[geminiUsageStore] IDB set failed', err)
  }
}

async function idbDel(key: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('[geminiUsageStore] IDB del failed', err)
  }
}

const idbStorage = createJSONStorage(() => ({
  getItem:    (name: string) => idbGet(name),
  setItem:    (name: string, value: string) => idbSet(name, value),
  removeItem: (name: string) => idbDel(name),
}))

// One-shot cleanup: remove the legacy localStorage entry from the broken
// commit 49c582b (caused QuotaExceededError on every gemini call). After
// this runs once, the orphaned localStorage space is freed up.
;(function clearLegacyLocalStorage() {
  if (typeof window === 'undefined') return
  try {
    const KEY = 'ugc-lab:gemini-usage'
    if (localStorage.getItem(KEY)) {
      localStorage.removeItem(KEY)
      console.info('[geminiUsageStore] removed legacy localStorage entry, migrated to IDB')
    }
  } catch { /* silent — already broken state, ignore */ }
})()

interface GeminiUsageState {
  callsToday: number
  date: string

  /** Call after every successful Gemini API call. Safe — never throws. */
  increment: () => void
  /** Reset counter (also called automatically when date changes). */
  reset: () => void
  /** Number of calls remaining in free tier (approximate). */
  getRemaining: () => number
  /** Returns true when usage is high (warning UI should highlight). */
  isHigh: () => boolean
  /** Returns true when very few calls left — toast warning. */
  isCritical: () => boolean
}

export const useGeminiUsageStore = create<GeminiUsageState>()(
  persist(
    (set, get) => ({
      callsToday: 0,
      date: todayStr(),

      increment: () => {
        try {
          set((s) => {
            const today = todayStr()
            if (s.date !== today) return { callsToday: 1, date: today }
            return { callsToday: s.callsToday + 1, date: today }
          })
        } catch (err) {
          // Never throw from increment — counter is a UX feature, must not
          // break the calling flow (Vision/description/translate).
          console.warn('[geminiUsageStore] increment failed (ignored)', err)
        }
      },

      reset: () => set({ callsToday: 0, date: todayStr() }),

      getRemaining: () => {
        const s = get()
        const today = todayStr()
        if (s.date !== today) return FREE_TIER_DAILY_LIMIT
        return Math.max(0, FREE_TIER_DAILY_LIMIT - s.callsToday)
      },

      isHigh: () => get().getRemaining() < 200,
      isCritical: () => get().getRemaining() < 50,
    }),
    {
      name: 'ugc-lab:gemini-usage',
      storage: idbStorage,  // IDB — avoid localStorage quota errors
    },
  ),
)

/** Daily limit constant — exported for UI display ("X / 1500"). */
export const GEMINI_DAILY_LIMIT = FREE_TIER_DAILY_LIMIT
