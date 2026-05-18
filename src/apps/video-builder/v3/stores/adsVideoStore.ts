// ── Ads Video Engine v3 — Zustand Store ──────────────────────────────────────
// Z30 PHASE 1 — persisted pipeline state. F5 / logout survives by default
// (lesson learned from Z27 — the user explicitly demanded this).
//
// What this store owns:
//   • V3PipelineState — phase, mode, costMode, inputs, creatorVideo, inserts
//
// What this store DOES NOT own (yet — comes in later phases):
//   • Actual render runner — stub until Phase 2 builds the creator video pipe
//   • Action insert renderer — Phase 3
//   • Auto-edit / concat — Phase 4
//
// On resume, transient flags (rendering / startedAt) reset to idle / undefined
// so a refresh during a render doesn't leave the UI stuck in a loading state.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import {
  createEmptyV3State,
  type V3PipelineState, type V3Phase, type WorkflowMode, type CostMode,
  type ActionInsertClip, type CreatorVideoClip,
} from '../types'
import type { Model, Product } from '../../../../stores/types'

const STORAGE_KEY = 'ugc-lab-v3-ads-video-state'
const CURRENT_SCHEMA = 1

interface AdsVideoStoreState {
  state: V3PipelineState

  // ── Top-level setters ───────────────────────────────────────────────────

  setPhase:    (phase: V3Phase) => void
  setMode:     (mode: WorkflowMode) => void
  setCostMode: (mode: CostMode) => void

  // ── Input setters ───────────────────────────────────────────────────────

  setAvatar:  (avatar: Model | null) => void
  setProduct: (product: Product | null) => void
  setScript:  (script: string) => void
  setVoiceId: (voiceId: string | null) => void

  // ── Creator video ───────────────────────────────────────────────────────

  setCreatorVideo:   (clip: CreatorVideoClip | null) => void
  patchCreatorVideo: (patch: Partial<CreatorVideoClip>) => void

  // ── Action inserts ──────────────────────────────────────────────────────

  /** Replace the whole inserts array (used when the user re-picks presets). */
  setInserts:   (inserts: ActionInsertClip[]) => void
  /** Add one insert to the end. Auto-assigns insertId. */
  addInsert:    (insert: Omit<ActionInsertClip, 'insertId'>) => void
  /** Patch one insert by insertId. */
  patchInsert:  (insertId: number, patch: Partial<ActionInsertClip>) => void
  /** Remove one insert by insertId. */
  removeInsert: (insertId: number) => void

  // ── Resume / clear ──────────────────────────────────────────────────────

  tryResumeFromStorage: () => boolean
  /** Wipe v3 state — only the "Tạo lại từ đầu" button calls this. */
  clearState: () => void
}

function loadFromStorage(): V3PipelineState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as V3PipelineState
    if (parsed.schemaVersion !== CURRENT_SCHEMA) {
      console.warn(`[V3_STATE] discarding stale payload (schema ${parsed.schemaVersion} ≠ ${CURRENT_SCHEMA})`)
      return null
    }
    // Defensive: reset transient rendering flags so resume never deadlocks
    if (parsed.creatorVideo?.status === 'rendering') {
      parsed.creatorVideo = { ...parsed.creatorVideo, status: 'idle', startedAt: undefined }
    }
    parsed.inserts = parsed.inserts.map((it) =>
      it.status === 'rendering'
        ? { ...it, status: 'idle', startedAt: undefined }
        : it
    )
    return parsed
  } catch (err) {
    console.warn('[V3_STATE] load failed', err)
    return null
  }
}

function saveToStorage(state: V3PipelineState | null): void {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    else localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('[V3_STATE] save failed (quota?)', err)
  }
}

/** Helper: update state immutably, save, set. */
function commit(
  set: (partial: { state: V3PipelineState }) => void,
  get: () => AdsVideoStoreState,
  updater: (cur: V3PipelineState) => V3PipelineState,
): void {
  const next = updater(get().state)
  next.updatedAt = Date.now()
  set({ state: next })
  saveToStorage(next)
}

export const useAdsVideoStore = create<AdsVideoStoreState>((set, get) => ({
  // Synchronous hydrate on first import — same trick as Z27. Avoids
  // a one-frame paint of the empty state when the user already has
  // a session in localStorage.
  state: loadFromStorage() ?? createEmptyV3State(),

  setPhase: (phase) =>
    commit(set, get, (s) => ({ ...s, phase })),

  setMode: (mode) =>
    commit(set, get, (s) => ({ ...s, mode })),

  setCostMode: (costMode) =>
    commit(set, get, (s) => ({ ...s, costMode })),

  setAvatar: (avatar) =>
    commit(set, get, (s) => ({ ...s, inputs: { ...s.inputs, avatar } })),

  setProduct: (product) =>
    commit(set, get, (s) => ({ ...s, inputs: { ...s.inputs, product } })),

  setScript: (script) =>
    commit(set, get, (s) => ({ ...s, inputs: { ...s.inputs, script } })),

  setVoiceId: (voiceId) =>
    commit(set, get, (s) => ({ ...s, inputs: { ...s.inputs, voiceId } })),

  setCreatorVideo: (clip) =>
    commit(set, get, (s) => ({ ...s, creatorVideo: clip })),

  patchCreatorVideo: (patch) =>
    commit(set, get, (s) => ({
      ...s,
      creatorVideo: s.creatorVideo ? { ...s.creatorVideo, ...patch } : s.creatorVideo,
    })),

  setInserts: (inserts) =>
    commit(set, get, (s) => ({ ...s, inserts })),

  addInsert: (insert) =>
    commit(set, get, (s) => {
      const nextId = s.inserts.reduce((m, it) => Math.max(m, it.insertId), 0) + 1
      const full: ActionInsertClip = { ...insert, insertId: nextId }
      return { ...s, inserts: [...s.inserts, full] }
    }),

  patchInsert: (insertId, patch) =>
    commit(set, get, (s) => ({
      ...s,
      inserts: s.inserts.map((it) =>
        it.insertId === insertId ? { ...it, ...patch } : it
      ),
    })),

  removeInsert: (insertId) =>
    commit(set, get, (s) => ({
      ...s,
      inserts: s.inserts.filter((it) => it.insertId !== insertId),
    })),

  tryResumeFromStorage: () => {
    const loaded = loadFromStorage()
    if (!loaded) return false
    set({ state: loaded })
    return true
  },

  clearState: () => {
    set({ state: createEmptyV3State() })
    saveToStorage(null)
  },
}))
