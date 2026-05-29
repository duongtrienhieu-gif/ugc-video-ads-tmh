// ─────────────────────────────────────────────────────────────────────
// Session Runtime — IndexedDB store (P16A)
//
// Persistent session storage. Uses a dedicated object store inside the
// existing UGC Lab IndexedDB database. Async, idempotent, fail-soft.
//
// LOCKED: no schema migrations — store is created on first access.
// LOCKED: storage is best-effort. If IndexedDB unavailable (private
// mode, locked storage), operations return graceful failures — caller
// can continue without persistence.
// ─────────────────────────────────────────────────────────────────────

import type { LandingSession } from '../types'

const DB_NAME = 'ugc-lab-super-ladipage'
const DB_VERSION = 1
const SESSION_STORE = 'landing-sessions'

// ─── DB open (lazy, memoized) ──────────────────────────────────────

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      console.warn('[sessionRuntime] IndexedDB unavailable — sessions will not persist')
      resolve(null)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const store = db.createObjectStore(SESSION_STORE, { keyPath: 'sessionId' })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      console.warn('[sessionRuntime] IndexedDB open failed:', request.error)
      resolve(null)
    }
  })

  return dbPromise
}

// ─── Public API (all fail-soft) ────────────────────────────────────

export async function saveSession(session: LandingSession): Promise<boolean> {
  const db = await openDb()
  if (!db) return false

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SESSION_STORE, 'readwrite')
      const store = tx.objectStore(SESSION_STORE)
      // Update updatedAt before persisting
      const payload: LandingSession = { ...session, updatedAt: new Date().toISOString() }
      store.put(payload)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => {
        console.warn('[sessionRuntime] saveSession failed:', tx.error)
        resolve(false)
      }
    } catch (err) {
      console.warn('[sessionRuntime] saveSession threw:', err)
      resolve(false)
    }
  })
}

export async function loadSession(sessionId: string): Promise<LandingSession | null> {
  const db = await openDb()
  if (!db) return null

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SESSION_STORE, 'readonly')
      const store = tx.objectStore(SESSION_STORE)
      const req = store.get(sessionId)
      req.onsuccess = () => resolve((req.result as LandingSession) ?? null)
      req.onerror = () => {
        console.warn('[sessionRuntime] loadSession failed:', req.error)
        resolve(null)
      }
    } catch (err) {
      console.warn('[sessionRuntime] loadSession threw:', err)
      resolve(null)
    }
  })
}

export async function listSessions(limit = 20): Promise<LandingSession[]> {
  const db = await openDb()
  if (!db) return []

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SESSION_STORE, 'readonly')
      const store = tx.objectStore(SESSION_STORE)
      const index = store.index('updatedAt')
      const sessions: LandingSession[] = []
      const cursorReq = index.openCursor(null, 'prev')  // most-recent first
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (cursor && sessions.length < limit) {
          sessions.push(cursor.value as LandingSession)
          cursor.continue()
        } else {
          resolve(sessions)
        }
      }
      cursorReq.onerror = () => {
        console.warn('[sessionRuntime] listSessions failed:', cursorReq.error)
        resolve(sessions)
      }
    } catch (err) {
      console.warn('[sessionRuntime] listSessions threw:', err)
      resolve([])
    }
  })
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const db = await openDb()
  if (!db) return false

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SESSION_STORE, 'readwrite')
      const store = tx.objectStore(SESSION_STORE)
      store.delete(sessionId)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}
