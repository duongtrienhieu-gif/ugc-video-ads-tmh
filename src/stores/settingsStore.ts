import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'ai-ugc-lab-settings'

// ── Z38 — Supabase cloud sync ────────────────────────────────────────────
// Settings now sync to a per-user row in Supabase `user_settings`. The
// existing localStorage cache is kept as an OFFLINE FALLBACK + initial
// hydration source — load is sync, network round-trip happens after.
//
// Flow:
//   1. App boot: hydrate from localStorage SYNCHRONOUSLY (no flicker).
//   2. Auth state change → user signs in → fetch cloud row → merge into
//      store + push back to localStorage (cloud wins on conflict).
//   3. Every setter writes BOTH localStorage AND debounced-pushes to
//      Supabase (so closing the tab mid-edit doesn't drop the change).
//   4. Auth signs out → keep localStorage (anonymous mode still works).
// ─────────────────────────────────────────────────────────────────────────

const CLOUD_DEBOUNCE_MS = 1500
let cloudPushTimer: ReturnType<typeof setTimeout> | null = null
let lastSyncedUserId: string | null = null
/** When true, suppress cloud-push during the hydrate-from-cloud pass
 *  so we don't ping-pong our own download back as an upload. */
let suppressNextCloudPush = false

// Z30 — Phase 1 reset. v3 is the new creator-first Ads Video Engine.
//   v1 = stable legacy pipeline
//   v2 = AI Director (cinematic / coverage-graph — DEPRECATED, kept for
//        reference + escape hatch; will be removed in a future cleanup)
//   v3 = Ads Video — AI UGC Ad Engine (creator-first, preview-first,
//        action-preset based — NEW DEFAULT)
export type PipelineVersion = 'v1' | 'v2' | 'v3'

/** UI theme — only 'light' or 'dark'. (Earlier draft had a 'system'
 *  option but it was removed — users prefer an explicit toggle and the
 *  OS-follow path complicated cross-device sync semantics.) */
export type ThemePreference = 'light' | 'dark'

interface SettingsState {
  kieApiKey: string
  geminiApiKey: string
  elevenLabsApiKey: string
  falApiKey: string
  shotstackApiKey: string
  youtubeApiKey: string
  kieCredits: number | null
  /** UGC Builder pipeline version. v1 = stable (production), v2 = AI Director beta. */
  pipelineVersion: PipelineVersion
  /** UI theme — drives `data-theme="dark"` on <html>. Default 'light'
   *  so existing users see no change until they opt in. */
  theme: ThemePreference
  setKieApiKey: (key: string) => void
  setGeminiApiKey: (key: string) => void
  setElevenLabsApiKey: (key: string) => void
  setFalApiKey: (key: string) => void
  setShotstackApiKey: (key: string) => void
  setYoutubeApiKey: (key: string) => void
  setKieCredits: (credits: number | null) => void
  setPipelineVersion: (v: PipelineVersion) => void
  setTheme: (t: ThemePreference) => void
  hasApiKey: () => boolean
  getApiKey: () => string
  getGeminiApiKey: () => string
  hasGeminiKey: () => boolean
  getElevenLabsApiKey: () => string
  hasElevenLabsKey: () => boolean
  getFalApiKey: () => string
  hasFalKey: () => boolean
  getShotstackApiKey: () => string
  hasShotstackKey: () => boolean
  getYoutubeApiKey: () => string
  hasYoutubeKey: () => boolean
}

interface StoredSettings {
  kieApiKey: string
  geminiApiKey: string
  elevenLabsApiKey: string
  falApiKey: string
  shotstackApiKey: string
  youtubeApiKey: string
  pipelineVersion: PipelineVersion
  theme: ThemePreference
}

function loadFromStorage(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        kieApiKey:        parsed.kieApiKey        ?? '',
        geminiApiKey:     parsed.geminiApiKey     ?? '',
        elevenLabsApiKey: parsed.elevenLabsApiKey ?? '',
        falApiKey:        parsed.falApiKey        ?? '',
        shotstackApiKey:  parsed.shotstackApiKey  ?? '',
        youtubeApiKey:    parsed.youtubeApiKey    ?? '',
        // Z37 — Auto-migrate v2 → v3. v2 cinematic pipeline is deprecated;
        // the user wants the v3 Ads Video Engine. Existing v2 users get
        // bumped forward on next load. v2 stays reachable via Legacy menu
        // in the v3 shell for anyone with in-progress work.
        // v1 stays as-is (truly stable legacy).
        pipelineVersion:  (
          parsed.pipelineVersion === 'v3' ? 'v3' :
          parsed.pipelineVersion === 'v2' ? 'v3' :  // ← auto-migrate
          parsed.pipelineVersion === 'v1' ? 'v1' :
          'v3'  // Z30 — default new sessions to v3 Ads Video Engine
        ),
        theme: (
          // Legacy: 'system' values from older settings → coerce to 'light'
          // so the toggle has a deterministic default after the OS option
          // was removed.
          parsed.theme === 'dark' ? 'dark' : 'light'
        ),
      }
    }
  } catch { /* silent */ }
  // Z30 — first-time users land on v3 (creator-first), not the legacy v1.
  return { kieApiKey: '', geminiApiKey: '', elevenLabsApiKey: '', falApiKey: '', shotstackApiKey: '', youtubeApiKey: '', pipelineVersion: 'v3', theme: 'light' }
}

function saveToStorage(s: StoredSettings) {
  const payload = JSON.stringify(s)
  try {
    localStorage.setItem(STORAGE_KEY, payload)
  } catch (err) {
    // QuotaExceededError — localStorage is full from accumulated app state.
    // Auto-cleanup known legacy keys that we've already migrated to IndexedDB
    // and retry once. Throws clear error if still fails so caller can warn user.
    console.warn('[settingsStore] localStorage write failed, attempting auto-cleanup', err)
    const legacyKeysToClear = [
      'ugc-lab:tiktok-shop',     // migrated to IDB in commit 69ed7d9
      'ugc-lab:gemini-usage',    // migrated to IDB in commit 4031d85
      'ugc-lab-brand-kits',      // brand kit legacy localStorage entry
    ]
    let freed = 0
    for (const key of legacyKeysToClear) {
      try {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key)
          freed++
        }
      } catch { /* silent */ }
    }
    if (freed > 0) console.info(`[settingsStore] freed ${freed} legacy keys, retrying save`)
    try {
      localStorage.setItem(STORAGE_KEY, payload)
    } catch (err2) {
      console.error('[settingsStore] localStorage save still failed after cleanup', err2)
      throw new Error('Không lưu được cài đặt — bộ nhớ trình duyệt đầy. Mở F12 → Application → Storage → "Clear site data", rồi reload và thử lại.')
    }
  }
  // Z38 — also push to cloud (debounced)
  schedulePushToCloud(s)
}

// ── Z38 — Cloud sync helpers ────────────────────────────────────────────

async function pushSettingsToCloud(s: StoredSettings): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Not signed in — skip; localStorage is the only persistence
      return
    }
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: user.id, settings_json: s },
        { onConflict: 'user_id' },
      )
    if (error) {
      console.warn('[SETTINGS_SYNC] upsert failed', error.message)
    }
  } catch (err) {
    // Network failure — keep localStorage as truth
    console.warn('[SETTINGS_SYNC] push failed', err)
  }
}

function schedulePushToCloud(s: StoredSettings): void {
  if (suppressNextCloudPush) {
    suppressNextCloudPush = false
    return
  }
  if (cloudPushTimer) clearTimeout(cloudPushTimer)
  // Capture the latest snapshot so flushPendingCloudPush below can pick
  // it up if the user navigates / F5 before the debounce fires.
  pendingCloudSnapshot = s
  cloudPushTimer = setTimeout(() => {
    cloudPushTimer = null
    const snap = pendingCloudSnapshot
    pendingCloudSnapshot = null
    if (snap) pushSettingsToCloud(snap).catch(() => { /* logged in push fn */ })
  }, CLOUD_DEBOUNCE_MS)
}

/** Tracks the latest pending snapshot waiting to be debounce-pushed.
 *  flushPendingCloudPush() reads this so an explicit Save / page unload
 *  can fire the upload IMMEDIATELY instead of losing the new value to
 *  the 1.5s debounce when the user F5s right after clicking Lưu. */
let pendingCloudSnapshot: StoredSettings | null = null

/** Force-push any pending settings to Supabase RIGHT NOW (bypass debounce).
 *
 *  Race fix: previously, clicking "Lưu cài đặt" then F5 within 1.5s
 *  resulted in the new value sitting in localStorage but never reaching
 *  cloud. On next page load, hydrateFromCloud() would then OVERWRITE
 *  the local new value with the stale cloud value, silently reverting
 *  the user's save.
 *
 *  Call sites:
 *   • SettingsModal handleSave() — awaits before showing "Đã lưu" toast
 *   • beforeunload / pagehide listener — best-effort flush on tab close
 *
 *  Resolves once the Supabase upsert completes (success or warning
 *  logged). Safe to call multiple times — clears the timer + drops the
 *  pending snapshot after pushing. */
export async function flushPendingCloudPush(): Promise<void> {
  if (cloudPushTimer) {
    clearTimeout(cloudPushTimer)
    cloudPushTimer = null
  }
  const snap = pendingCloudSnapshot
  pendingCloudSnapshot = null
  if (!snap) return
  await pushSettingsToCloud(snap)
}

/** Best-effort beforeunload flush. Browsers DO NOT wait for async work
 *  in pagehide, but the upsert is fire-and-forget — if the request
 *  reaches the network layer before the tab dies, the server-side
 *  upsert still completes. Catches the common "type key → close tab"
 *  scenario without relying on debounce. */
if (typeof window !== 'undefined') {
  const flushOnUnload = () => {
    if (cloudPushTimer || pendingCloudSnapshot) {
      // Fire immediately — don't await (browser won't wait anyway)
      void flushPendingCloudPush()
    }
  }
  window.addEventListener('pagehide', flushOnUnload)
  window.addEventListener('beforeunload', flushOnUnload)
}

/**
 * Z38 — Pull settings from Supabase + merge into the store. Cloud row
 * WINS over localStorage (assumption: cloud is freshest across devices).
 * Called automatically on auth state change.
 */
async function hydrateFromCloud(setStore: (patch: Partial<StoredSettings>) => void): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (lastSyncedUserId === user.id) return  // already synced this session
    lastSyncedUserId = user.id

    const { data, error } = await supabase
      .from('user_settings')
      .select('settings_json')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.warn('[SETTINGS_SYNC] cloud fetch failed', error.message)
      return
    }
    if (!data?.settings_json) {
      // No cloud row yet — push our local settings up as the initial state
      const local = loadFromStorage()
      console.log('[SETTINGS_SYNC] no cloud row — seeding from localStorage')
      pushSettingsToCloud(local).catch(() => {})
      return
    }
    const cloud = data.settings_json as Partial<StoredSettings>
    const merged: StoredSettings = {
      kieApiKey:        cloud.kieApiKey        ?? '',
      geminiApiKey:     cloud.geminiApiKey     ?? '',
      elevenLabsApiKey: cloud.elevenLabsApiKey ?? '',
      falApiKey:        cloud.falApiKey        ?? '',
      shotstackApiKey:  cloud.shotstackApiKey  ?? '',
      youtubeApiKey:    cloud.youtubeApiKey    ?? '',
      pipelineVersion:  (
        cloud.pipelineVersion === 'v3' ? 'v3' :
        cloud.pipelineVersion === 'v2' ? 'v3' :  // Z37 — auto-migrate
        cloud.pipelineVersion === 'v1' ? 'v1' :
        'v3'
      ),
      theme: (cloud.theme === 'dark' ? 'dark' : 'light'),
    }
    // Push merged into local state + mirror to localStorage
    // Suppress the cloud-push that follows so we don't echo back
    suppressNextCloudPush = true
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    } catch (err) {
      console.warn('[SETTINGS_SYNC] mirror to localStorage failed (in-memory still updated)', err)
    }
    setStore(merged)
    console.log('[SETTINGS_SYNC] hydrated from cloud · pipelineVersion=' + merged.pipelineVersion)
  } catch (err) {
    console.warn('[SETTINGS_SYNC] hydrate failed', err)
  }
}

function getStored(get: () => SettingsState): StoredSettings {
  const s = get()
  return {
    kieApiKey:        s.kieApiKey,
    geminiApiKey:     s.geminiApiKey,
    elevenLabsApiKey: s.elevenLabsApiKey,
    falApiKey:        s.falApiKey,
    shotstackApiKey:  s.shotstackApiKey,
    youtubeApiKey:    s.youtubeApiKey,
    pipelineVersion:  s.pipelineVersion,
    theme:            s.theme,
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadFromStorage(),
  kieCredits: null,

  setKieApiKey: (key) => {
    set({ kieApiKey: key })
    saveToStorage({ ...getStored(get), kieApiKey: key })
  },

  setGeminiApiKey: (key) => {
    set({ geminiApiKey: key })
    saveToStorage({ ...getStored(get), geminiApiKey: key })
  },

  setElevenLabsApiKey: (key) => {
    set({ elevenLabsApiKey: key })
    saveToStorage({ ...getStored(get), elevenLabsApiKey: key })
  },

  setFalApiKey: (key) => {
    set({ falApiKey: key })
    saveToStorage({ ...getStored(get), falApiKey: key })
  },

  setShotstackApiKey: (key) => {
    set({ shotstackApiKey: key })
    saveToStorage({ ...getStored(get), shotstackApiKey: key })
  },

  setYoutubeApiKey: (key) => {
    set({ youtubeApiKey: key })
    saveToStorage({ ...getStored(get), youtubeApiKey: key })
  },

  setKieCredits: (credits) => set({ kieCredits: credits }),

  setPipelineVersion: (v) => {
    set({ pipelineVersion: v })
    saveToStorage({ ...getStored(get), pipelineVersion: v })
  },

  setTheme: (t) => {
    set({ theme: t })
    saveToStorage({ ...getStored(get), theme: t })
  },

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

  getFalApiKey: () => {
    const key = get().falApiKey
    if (!key) throw new Error('Vui lòng nhập fal.ai API key trong Cài đặt')
    return key
  },

  hasFalKey: () => get().falApiKey.length > 0,

  getShotstackApiKey: () => {
    const key = get().shotstackApiKey
    if (!key) throw new Error('Vui lòng nhập Shotstack API key trong Cài đặt')
    return key
  },

  hasShotstackKey: () => get().shotstackApiKey.length > 0,

  getYoutubeApiKey: () => {
    const key = get().youtubeApiKey
    if (!key) throw new Error('Vui lòng nhập YouTube Data API key trong Cài đặt')
    return key
  },

  hasYoutubeKey: () => get().youtubeApiKey.length > 0,
}))

// ── Z38 — Wire Supabase auth state ──────────────────────────────────────
// When the user signs in (or page loads while already signed in), pull
// their cloud settings + merge. When they sign out, just leave the local
// state alone (anonymous mode still works via localStorage).

if (typeof window !== 'undefined') {
  // Initial hydrate — fires once on import if a session already exists
  void hydrateFromCloud((patch) => {
    useSettingsStore.setState(patch)
  })

  // Listen for subsequent sign-ins
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      void hydrateFromCloud((patch) => {
        useSettingsStore.setState(patch)
      })
    } else if (event === 'SIGNED_OUT') {
      // Reset the "last synced user" so the next sign-in re-fetches
      lastSyncedUserId = null
    }
  })
}
