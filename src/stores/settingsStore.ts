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

/** UI theme — 'system' resolves to OS preference at runtime. */
export type ThemePreference = 'light' | 'dark' | 'system'

interface SettingsState {
  kieApiKey: string
  geminiApiKey: string
  elevenLabsApiKey: string
  falApiKey: string
  shotstackApiKey: string
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
}

interface StoredSettings {
  kieApiKey: string
  geminiApiKey: string
  elevenLabsApiKey: string
  falApiKey: string
  shotstackApiKey: string
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
          parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
            ? parsed.theme
            : 'light'  // default — existing users see no change
        ),
      }
    }
  } catch { /* silent */ }
  // Z30 — first-time users land on v3 (creator-first), not the legacy v1.
  return { kieApiKey: '', geminiApiKey: '', elevenLabsApiKey: '', falApiKey: '', shotstackApiKey: '', pipelineVersion: 'v3', theme: 'light' }
}

function saveToStorage(s: StoredSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
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
  cloudPushTimer = setTimeout(() => {
    cloudPushTimer = null
    pushSettingsToCloud(s).catch(() => { /* logged in push fn */ })
  }, CLOUD_DEBOUNCE_MS)
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
      pipelineVersion:  (
        cloud.pipelineVersion === 'v3' ? 'v3' :
        cloud.pipelineVersion === 'v2' ? 'v3' :  // Z37 — auto-migrate
        cloud.pipelineVersion === 'v1' ? 'v1' :
        'v3'
      ),
      theme: (
        cloud.theme === 'light' || cloud.theme === 'dark' || cloud.theme === 'system'
          ? cloud.theme
          : 'light'
      ),
    }
    // Push merged into local state + mirror to localStorage
    // Suppress the cloud-push that follows so we don't echo back
    suppressNextCloudPush = true
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
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
